/**
 * 계약 갱신 엔진
 * - 갱신 제안 연봉/기간 계산
 * - 선수 요구 연봉 범위 산출
 * - 갱신 시도 (수락/거절 판정)
 * - 만료 임박 선수 조회
 */

import { FINANCIAL_CONSTANTS } from '../../data/systemPrompt';
import {
  getExpiringContracts,
  getTeamTotalSalary,
  updatePlayerContract,
} from '../../db/queries';
import {
  calculateFairSalary,
  calculatePlayerValue,
} from './transferEngine';
import type { Player } from '../../types/player';

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────

/** 연봉 상한 (억 원 → 만 원) */
const SALARY_CAP = FINANCIAL_CONSTANTS.salaryCap * 10000;

/** 선수 OVR 계산 */
function getPlayerOverall(player: Player): number {
  const s = player.stats;
  return (s.mechanical + s.gameSense + s.teamwork + s.consistency + s.laning + s.aggression) / 6;
}

// ─────────────────────────────────────────
// 갱신 제안 계산
// ─────────────────────────────────────────

/**
 * 팀에서 선수에게 제안할 연봉/기간 계산
 * OVR, 나이, 잠재력 기반
 */
export function calculateRenewalOffer(player: Player): {
  suggestedSalary: number;
  suggestedYears: number;
} {
  const fairSalary = calculateFairSalary(player);
  const ovr = getPlayerOverall(player);
  const potential = player.potential;

  // 잠재력 높고 젊으면 더 긴 계약 제안
  let suggestedYears = 2;
  if (player.age <= 22 && potential >= 70) {
    suggestedYears = 3;
  } else if (player.age >= 28 || potential < 40) {
    suggestedYears = 1;
  }

  // OVR 높을수록 적정 연봉 대비 약간 프리미엄
  let salaryMultiplier = 1.0;
  if (ovr >= 80) salaryMultiplier = 1.1;
  else if (ovr >= 70) salaryMultiplier = 1.05;
  else if (ovr < 55) salaryMultiplier = 0.9;

  const suggestedSalary = Math.round(fairSalary * salaryMultiplier);

  return { suggestedSalary, suggestedYears };
}

// ─────────────────────────────────────────
// 선수 요구 연봉
// ─────────────────────────────────────────

/**
 * 선수가 원하는 연봉 범위 (현재 연봉 대비 ±20%, 성적 좋으면 더 높게)
 */
export function evaluatePlayerDemand(player: Player): {
  minSalary: number;
  maxSalary: number;
  idealSalary: number;
} {
  const currentSalary = player.contract.salary;
  const fairSalary = calculateFairSalary(player);
  const ovr = getPlayerOverall(player);

  // 기준: 현재 연봉과 적정 연봉 중 높은 쪽
  const baseSalary = Math.max(currentSalary, fairSalary);

  // 성적(OVR)에 따라 요구 범위 조정
  let demandFactor = 1.0;
  if (ovr >= 80) demandFactor = 1.2;       // 스타급: +20%
  else if (ovr >= 70) demandFactor = 1.1;  // 준수: +10%
  else if (ovr < 55) demandFactor = 0.9;   // 하위: -10%

  const idealSalary = Math.round(baseSalary * demandFactor);
  const minSalary = Math.round(idealSalary * 0.8);  // 이상적 연봉의 80%
  const maxSalary = Math.round(idealSalary * 1.2);   // 이상적 연봉의 120%

  return { minSalary, maxSalary, idealSalary };
}

// ─────────────────────────────────────────
// 갱신 시도
// ─────────────────────────────────────────

export interface RenewalResult {
  success: boolean;
  reason: string;
}

/**
 * 계약 갱신 시도 → 수락/거절 판정
 * - 수락 조건: 제안 연봉 >= 선수 요구의 90%, 팀 사기 높으면 보너스
 * - 연봉 상한 초과 시 거절
 */
export async function attemptRenewal(
  player: Player,
  teamId: string,
  offeredSalary: number,
  years: number,
  currentSeasonId: number,
  teamMorale?: number,
): Promise<RenewalResult> {
  // 1. 연봉 상한 확인
  const currentTotalSalary = await getTeamTotalSalary(teamId);
  // 기존 선수 연봉은 빠지고 새 연봉이 들어가므로 차이만큼 체크
  const salaryCost = offeredSalary - player.contract.salary;
  if (currentTotalSalary + salaryCost > SALARY_CAP) {
    return {
      success: false,
      reason: `연봉 상한 초과: 현재 ${currentTotalSalary.toLocaleString()}만 + 증가분 ${salaryCost.toLocaleString()}만 > 상한 ${SALARY_CAP.toLocaleString()}만`,
    };
  }

  // 2. 선수 요구 연봉 평가
  const demand = evaluatePlayerDemand(player);

  // 기본 수락 기준: 이상적 연봉의 90%
  let acceptThreshold = demand.idealSalary * 0.9;

  // 팀 사기(morale) 보너스: 높을수록 낮은 연봉도 수락
  if (teamMorale !== undefined) {
    // morale 0~100, 50이 기준
    // morale 80이면 기준 -10%, morale 30이면 기준 +10%
    const moraleBonus = (teamMorale - 50) / 50 * 0.1;
    acceptThreshold = acceptThreshold * (1 - moraleBonus);
  }

  acceptThreshold = Math.round(acceptThreshold);

  if (offeredSalary < acceptThreshold) {
    return {
      success: false,
      reason: `연봉 부족: 제안 ${offeredSalary.toLocaleString()}만 < 최소 요구 ${acceptThreshold.toLocaleString()}만 (희망 ${demand.idealSalary.toLocaleString()}만)`,
    };
  }

  // 3. 수락 → DB 업데이트
  const contractEndSeason = currentSeasonId + years;
  await updatePlayerContract(player.id, offeredSalary, contractEndSeason);

  return {
    success: true,
    reason: `계약 갱신 완료: ${offeredSalary.toLocaleString()}만/년, ${years}년 (시즌 ${contractEndSeason}까지)`,
  };
}

// ─────────────────────────────────────────
// 만료 임박 선수 조회
// ─────────────────────────────────────────

/**
 * 팀의 만료 임박 선수 목록
 * (현재 시즌 또는 다음 시즌에 만료되는 선수)
 */
export async function getTeamExpiringContracts(
  teamId: string,
  currentSeasonId: number,
): Promise<(Player & { division: string })[]> {
  // 현재 시즌 + 1까지 만료 대상 조회
  const expiring = await getExpiringContracts(currentSeasonId + 1);
  return expiring.filter(p => p.teamId === teamId);
}
