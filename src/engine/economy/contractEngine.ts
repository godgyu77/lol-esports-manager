/**
 * 계약 갱신 엔진
 * - 갱신 제안 연봉/기간 계산
 * - 선수 요구 연봉 범위 산출
 * - 갱신 시도 (수락/거절 판정)
 * - 만료 임박 선수 조회
 * - 양방향 계약 협상 (감독↔선수)
 * - 선수 의사결정 팩터 (돈, 우승, 출전, 충성도, 명성)
 */

import { FINANCIAL_CONSTANTS } from '../../data/systemPrompt';
import {
  getExpiringContracts,
  getTeamTotalSalary,
  updatePlayerContract,
} from '../../db/queries';
import {
  calculateFairSalary,
} from './transferEngine';
import { agentNegotiate } from '../agent/agentEngine';
import type { Player } from '../../types/player';
import { getPlayerOverall } from '../../utils/playerUtils';
import type {
  ContractNegotiation,
  ContractDecisionFactors,
  NegotiationMessage,
  NegotiationStatus,
  NegotiationInitiator,
  TeamEvaluation,
} from '../../types/contract';

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────

/** 연봉 상한 (억 원 → 만 원) */
const SALARY_CAP = FINANCIAL_CONSTANTS.salaryCap * 10000;

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
    suggestedYears = 2; // 젊은 선수 장기 락인 방지 (최대 2년)
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
  signingBonus?: number,
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

  // 2. 에이전트 협상
  const fairSalary = calculateFairSalary(player);
  const agentResult = await agentNegotiate(player.id, offeredSalary, fairSalary);

  if (!agentResult.accepted) {
    return {
      success: false,
      reason: `에이전트 거절: ${agentResult.message} (요구 연봉: ${agentResult.counterOffer.toLocaleString()}만)`,
    };
  }

  // 3. 선수 요구 연봉 평가 (에이전트 통과 후 선수 본인 판단)
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

  // 4. [C11] 수락 → DB 업데이트 (1년 = 2스플릿이므로 years * 2)
  const contractEndSeason = currentSeasonId + (years * 2);
  await updatePlayerContract(player.id, offeredSalary, contractEndSeason);

  // 5. 계약 보너스 처리 (일시불)
  if (signingBonus && signingBonus > 0) {
    const db = await (await import('../../db/database')).getDatabase();
    await db.execute('UPDATE teams SET budget = budget - $1 WHERE id = $2', [signingBonus, teamId]);

    // 계약 보너스 조항 기록
    const { addClause } = await import('./clauseEngine');
    await addClause(player.id, 'signing_bonus', signingBonus, `시즌 ${currentSeasonId} 계약 보너스`);
  }

  const bonusText = signingBonus ? ` + 계약 보너스 ${signingBonus.toLocaleString()}만` : '';
  return {
    success: true,
    reason: `계약 갱신 완료: ${offeredSalary.toLocaleString()}만/년, ${years}년 (시즌 ${contractEndSeason}까지)${bonusText}`,
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

// ─────────────────────────────────────────
// 갱신 난이도 계산
// ─────────────────────────────────────────

export interface RenewalDifficulty {
  salaryMultiplier: number;   // 연봉 요구 배수
  rejectProbability: number;  // 거절 확률 (0~1)
  reason: string[];           // 요인 설명
}

/**
 * 계약 갱신 난이도 계산
 * - OVR 80+ → 연봉 요구 1.3배, 거절 확률 30%
 * - 팀 reputation 낮으면 → 거절 확률 +20%
 * - 최근 폼 70+ → 연봉 요구 1.2배
 * - 다른 팀의 관심(reputation 기반) → 거절 확률 +10%
 */
export function calculateRenewalDifficulty(
  player: Player,
  teamReputation: number,
  recentForm?: number,
): RenewalDifficulty {
  const ovr = getPlayerOverall(player);
  let salaryMultiplier = 1.0;
  let rejectProbability = 0.1; // 기본 거절 확률 10%
  const reasons: string[] = [];

  // OVR 80+ → 연봉 요구 1.3배, 거절 확률 30%
  if (ovr >= 80) {
    salaryMultiplier = Math.max(salaryMultiplier, 1.3);
    rejectProbability = 0.3;
    reasons.push(`스타급 선수 (OVR ${Math.round(ovr)}): 연봉 1.3배, 거절 30%`);
  }

  // 팀 reputation 낮으면 (50 미만) → 거절 확률 +20%
  if (teamReputation < 50) {
    rejectProbability += 0.2;
    reasons.push(`팀 명성 부족 (${teamReputation}): 거절 확률 +20%`);
  }

  // 최근 폼 70+ → 연봉 요구 1.2배
  if (recentForm !== undefined && recentForm >= 70) {
    salaryMultiplier = Math.max(salaryMultiplier, salaryMultiplier * 1.2);
    reasons.push(`최근 폼 우수 (${recentForm}): 연봉 1.2배`);
  }

  // 다른 팀의 관심 (reputation 기반: 선수 OVR이 높고 팀 reputation이 낮으면)
  if (ovr >= 70 && teamReputation < 60) {
    rejectProbability += 0.1;
    reasons.push('다른 팀의 관심: 거절 확률 +10%');
  }

  // 거절 확률 상한 클램프
  rejectProbability = Math.min(rejectProbability, 0.9);

  return { salaryMultiplier, rejectProbability, reason: reasons };
}

// ─────────────────────────────────────────
// 카운터 오퍼 시스템
// ─────────────────────────────────────────

export interface CounterOfferState {
  attempt: number;           // 현재 시도 횟수 (1~3)
  maxAttempts: number;       // 최대 시도 횟수 (3)
  lastOfferedSalary: number; // 마지막 제안 연봉
  difficulty: RenewalDifficulty;
}

/**
 * 카운터 오퍼로 재시도
 * - 첫 제안 거절 → 더 높은 연봉으로 재제안 가능 (최대 3회)
 * - 매 시도마다 거절 확률이 10%씩 감소 (연봉 인상에 대한 선수 반응)
 */
export async function attemptRenewalWithCounter(
  player: Player,
  teamId: string,
  offeredSalary: number,
  years: number,
  currentSeasonId: number,
  teamMorale: number | undefined,
  counterState: CounterOfferState | null,
): Promise<RenewalResult & { counterState: CounterOfferState | null }> {
  const attempt = counterState ? counterState.attempt + 1 : 1;
  const maxAttempts = 3;

  // 연봉이 이전 제안보다 높아야 함 (재시도 시)
  if (counterState && offeredSalary <= counterState.lastOfferedSalary) {
    return {
      success: false,
      reason: `이전 제안(${counterState.lastOfferedSalary.toLocaleString()}만)보다 높은 연봉을 제시해야 합니다.`,
      counterState: { ...counterState, attempt },
    };
  }

  // 기본 갱신 시도
  const result = await attemptRenewal(player, teamId, offeredSalary, years, currentSeasonId, teamMorale);

  if (result.success) {
    return { ...result, counterState: null };
  }

  // 실패 시: 최대 시도 횟수 확인
  if (attempt >= maxAttempts) {
    return {
      success: false,
      reason: `${result.reason} (최대 ${maxAttempts}회 제안 완료 — 더 이상 재제안 불가)`,
      counterState: null,
    };
  }

  // 카운터 오퍼 상태 반환 (재시도 가능)
  const teamRows = await (await import('../../db/database')).getDatabase()
    .then(db => db.select<{ reputation: number }[]>('SELECT reputation FROM teams WHERE id = $1', [teamId]));
  const teamReputation = teamRows[0]?.reputation ?? 50;
  const difficulty = calculateRenewalDifficulty(player, teamReputation);

  return {
    success: false,
    reason: `${result.reason} (${attempt}/${maxAttempts}회 시도 — 더 높은 연봉으로 재제안 가능)`,
    counterState: {
      attempt,
      maxAttempts,
      lastOfferedSalary: offeredSalary,
      difficulty,
    },
  };
}

// ═════════════════════════════════════════
// 양방향 계약 협상 시스템
// ═════════════════════════════════════════

// ─────────────────────────────────────────
// DB Row 매핑
// ─────────────────────────────────────────

interface NegotiationRow {
  id: number;
  season_id: number;
  player_id: string;
  team_id: string;
  initiator: string;
  status: string;
  current_round: number;
  team_salary: number;
  team_years: number;
  team_signing_bonus: number;
  player_salary: number | null;
  player_years: number | null;
  player_signing_bonus: number | null;
  factor_money: number;
  factor_winning: number;
  factor_playtime: number;
  factor_loyalty: number;
  factor_reputation: number;
  final_salary: number | null;
  final_years: number | null;
  final_signing_bonus: number | null;
  messages: string;
}

function mapRowToNegotiation(row: NegotiationRow): ContractNegotiation {
  let messages: NegotiationMessage[] = [];
  try { messages = JSON.parse(row.messages); } catch { /* empty */ }

  return {
    id: row.id,
    seasonId: row.season_id,
    playerId: row.player_id,
    teamId: row.team_id,
    initiator: row.initiator as NegotiationInitiator,
    status: row.status as NegotiationStatus,
    currentRound: row.current_round,
    teamSalary: row.team_salary,
    teamYears: row.team_years,
    teamSigningBonus: row.team_signing_bonus,
    playerSalary: row.player_salary,
    playerYears: row.player_years,
    playerSigningBonus: row.player_signing_bonus,
    factors: {
      money: row.factor_money,
      winning: row.factor_winning,
      playtime: row.factor_playtime,
      loyalty: row.factor_loyalty,
      reputation: row.factor_reputation,
    },
    finalSalary: row.final_salary,
    finalYears: row.final_years,
    finalSigningBonus: row.final_signing_bonus,
    messages,
  };
}

// ─────────────────────────────────────────
// 선수 의사결정 팩터 생성
// ─────────────────────────────────────────

/**
 * 선수의 계약 의사결정 성향을 생성한다.
 * 롤 선수 특성 반영:
 * - 젊은 선수: 출전 기회 + 성장 중시
 * - 스타급: 돈 + 우승 중시
 * - 베테랑: 우승 + 충성도 중시
 */
export function generateDecisionFactors(player: Player): ContractDecisionFactors {
  const ovr = getPlayerOverall(player);
  const age = player.age;

  // 기본값 (각각 30~70 범위에서 시작)
  let money = 50;
  let winning = 50;
  let playtime = 50;
  let loyalty = 50;
  let reputation = 50;

  // 나이별 성향
  if (age <= 20) {
    // 신인: 출전 기회 > 성장 > 돈
    playtime += 25;
    winning += 10;
    money -= 10;
    loyalty -= 10;
  } else if (age <= 23) {
    // 성장기: 돈 + 우승 균형
    money += 15;
    winning += 15;
    playtime += 10;
  } else if (age <= 26) {
    // 전성기: 돈 + 우승 최우선
    money += 20;
    winning += 20;
    reputation += 10;
  } else {
    // 베테랑: 우승 >> 충성도 > 돈
    winning += 25;
    loyalty += 20;
    money += 5;
    playtime -= 15;
  }

  // OVR별 보정
  if (ovr >= 80) {
    // 스타급: 돈 + 명성 중시
    money += 15;
    reputation += 15;
    playtime -= 10; // 이미 주전 확보
  } else if (ovr < 60) {
    // 하위: 출전 기회 절실
    playtime += 20;
    money -= 10;
    reputation -= 10;
  }

  // 성격 기반 약간의 랜덤성 (mental 활용)
  const mentalOffset = (player.mental.mental - 50) / 10;
  loyalty += Math.round(mentalOffset * 3);
  winning += Math.round(mentalOffset * 2);

  // 클램프 0~100
  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  return {
    money: clamp(money),
    winning: clamp(winning),
    playtime: clamp(playtime),
    loyalty: clamp(loyalty),
    reputation: clamp(reputation),
  };
}

// ─────────────────────────────────────────
// 팀 평가 (선수 시점)
// ─────────────────────────────────────────

/**
 * 선수가 팀을 평가한다.
 * 돈, 우승 가능성, 출전 기회, 충성도, 명성을 종합 평가.
 */
export function evaluateTeam(
  player: Player,
  factors: ContractDecisionFactors,
  teamInfo: {
    reputation: number;          // 0~100
    recentWinRate: number;       // 0~1
    rosterStrength: number;      // 팀 평균 OVR
    isCurrentTeam: boolean;
    positionCompetitorOvr: number; // 같은 포지션 경쟁자 OVR (0이면 경쟁 없음)
  },
  offeredSalary: number,
): TeamEvaluation {
  const ovr = getPlayerOverall(player);
  const fairSalary = calculateFairSalary(player);
  const reasons: string[] = [];

  // 1. 연봉 만족도 (제안 vs 적정연봉)
  const salaryRatio = offeredSalary / Math.max(fairSalary, 1);
  let salaryScore: number;
  if (salaryRatio >= 1.3) { salaryScore = 95; reasons.push('파격적인 연봉 제안'); }
  else if (salaryRatio >= 1.1) { salaryScore = 80; reasons.push('시장가 이상의 좋은 연봉'); }
  else if (salaryRatio >= 0.9) { salaryScore = 60; reasons.push('적정 수준의 연봉'); }
  else if (salaryRatio >= 0.7) { salaryScore = 35; reasons.push('기대 이하의 연봉'); }
  else { salaryScore = 15; reasons.push('매우 낮은 연봉 — 불만족'); }

  // 2. 우승 가능성
  let winningScore: number;
  if (teamInfo.recentWinRate >= 0.7 && teamInfo.rosterStrength >= 75) {
    winningScore = 90; reasons.push('우승 후보팀');
  } else if (teamInfo.recentWinRate >= 0.5 && teamInfo.rosterStrength >= 68) {
    winningScore = 65; reasons.push('플레이오프 진출 가능');
  } else if (teamInfo.rosterStrength >= 60) {
    winningScore = 40; reasons.push('중위권 팀');
  } else {
    winningScore = 20; reasons.push('하위권 팀 — 우승 가능성 낮음');
  }

  // 3. 출전 기회
  let playtimeScore: number;
  if (teamInfo.positionCompetitorOvr === 0) {
    playtimeScore = 95; reasons.push('해당 포지션 유일한 선수');
  } else if (ovr > teamInfo.positionCompetitorOvr + 5) {
    playtimeScore = 85; reasons.push('주전 확보 가능');
  } else if (ovr >= teamInfo.positionCompetitorOvr - 3) {
    playtimeScore = 50; reasons.push('주전 경쟁 필요');
  } else {
    playtimeScore = 20; reasons.push('벤치 가능성 높음');
  }

  // 4. 충성도 (현재 팀이면 보너스)
  let loyaltyScore = 40;
  if (teamInfo.isCurrentTeam) {
    loyaltyScore = 60 + Math.round(player.mental.morale * 0.3);
    reasons.push('현재 소속팀 — 팀 환경에 익숙');
  } else {
    loyaltyScore = 30;
    reasons.push('새 팀 — 적응 필요');
  }

  // 5. 팀 명성
  let reputationScore: number;
  if (teamInfo.reputation >= 80) {
    reputationScore = 90; reasons.push('명문팀');
  } else if (teamInfo.reputation >= 60) {
    reputationScore = 65; reasons.push('인지도 있는 팀');
  } else if (teamInfo.reputation >= 40) {
    reputationScore = 40; reasons.push('보통 수준의 팀');
  } else {
    reputationScore = 20; reasons.push('명성 낮은 팀');
  }

  // 가중 평균 (팩터 비중 반영)
  const totalWeight = factors.money + factors.winning + factors.playtime
    + factors.loyalty + factors.reputation;

  const overall = totalWeight > 0
    ? Math.round(
        (salaryScore * factors.money
        + winningScore * factors.winning
        + playtimeScore * factors.playtime
        + loyaltyScore * factors.loyalty
        + reputationScore * factors.reputation) / totalWeight,
      )
    : 50;

  return {
    overall,
    salaryScore,
    winningScore,
    playtimeScore,
    loyaltyScore,
    reputationScore,
    reasons,
  };
}

// ─────────────────────────────────────────
// 선수의 역제안 계산
// ─────────────────────────────────────────

/**
 * 선수가 팀 제안에 대한 역제안을 생성한다.
 * 롤 특성: 1~3년 계약, 대부분 1년
 */
export function generatePlayerCounterOffer(
  player: Player,
  factors: ContractDecisionFactors,
  teamOffer: { salary: number; years: number; signingBonus: number },
  evaluation: TeamEvaluation,
): { salary: number; years: number; signingBonus: number; message: string } {
  const demand = evaluatePlayerDemand(player);

  // 기본 역제안 연봉: 선수 이상적 연봉
  let counterSalary = demand.idealSalary;

  // 팀 평가 높으면 양보 가능
  if (evaluation.overall >= 80) {
    counterSalary = Math.round(counterSalary * 0.9);
  } else if (evaluation.overall >= 60) {
    counterSalary = Math.round(counterSalary * 0.95);
  } else if (evaluation.overall < 40) {
    // 팀 매력도 낮으면 더 높은 연봉 요구
    counterSalary = Math.round(counterSalary * 1.15);
  }

  // 최소한 팀 제안 이상
  counterSalary = Math.max(counterSalary, teamOffer.salary);

  // 계약 기간: 롤은 1~3년, 대부분 1년 선호
  let counterYears: number;
  if (player.age >= 26) {
    counterYears = 1; // 베테랑은 1년 선호
  } else if (evaluation.overall >= 75) {
    counterYears = Math.min(teamOffer.years, 2); // 좋은 팀이면 2년까지
  } else {
    counterYears = 1; // 기본 1년 (자유도 유지)
  }

  // 계약 보너스: 돈 중시 성향이면 요구
  let counterBonus = 0;
  if (factors.money >= 60) {
    counterBonus = Math.round(counterSalary * 0.1); // 연봉의 10%
  }

  // 메시지 생성
  let message: string;
  if (evaluation.overall >= 75) {
    message = '팀의 비전에 공감합니다. 조건만 맞으면 잔류하고 싶습니다.';
  } else if (evaluation.overall >= 50) {
    message = '나쁘지 않은 제안이지만, 좀 더 나은 조건을 기대합니다.';
  } else {
    message = '솔직히 이 조건으로는 계약하기 어렵습니다. 다시 고려해주세요.';
  }

  return { salary: counterSalary, years: counterYears, signingBonus: counterBonus, message };
}

// ─────────────────────────────────────────
// 협상 DB 조작
// ─────────────────────────────────────────

/**
 * 새 협상을 생성한다.
 */
export async function createNegotiation(params: {
  seasonId: number;
  playerId: string;
  teamId: string;
  initiator: NegotiationInitiator;
  teamSalary: number;
  teamYears: number;
  teamSigningBonus?: number;
  factors: ContractDecisionFactors;
}): Promise<ContractNegotiation> {
  const db = await (await import('../../db/database')).getDatabase();

  // 기존 진행중인 협상 확인
  const existing = await db.select<{ id: number }[]>(
    `SELECT id FROM contract_negotiations
     WHERE player_id = $1 AND team_id = $2 AND status IN ('pending', 'in_progress')`,
    [params.playerId, params.teamId],
  );

  if (existing.length > 0) {
    // 기존 협상이 있으면 가져오기
    const rows = await db.select<NegotiationRow[]>(
      'SELECT * FROM contract_negotiations WHERE id = $1',
      [existing[0].id],
    );
    return mapRowToNegotiation(rows[0]);
  }

  const initialMessage: NegotiationMessage = {
    round: 1,
    from: params.initiator === 'team_to_player' ? 'team' : 'player',
    text: params.initiator === 'team_to_player'
      ? `연봉 ${params.teamSalary.toLocaleString()}만, ${params.teamYears}년 계약을 제안합니다.`
      : '재계약 협상을 요청합니다.',
    salary: params.teamSalary,
    years: params.teamYears,
    signingBonus: params.teamSigningBonus,
    timestamp: new Date().toISOString(),
  };

  const result = await db.execute(
    `INSERT INTO contract_negotiations
     (season_id, player_id, team_id, initiator, status, current_round,
      team_salary, team_years, team_signing_bonus,
      factor_money, factor_winning, factor_playtime, factor_loyalty, factor_reputation,
      messages)
     VALUES ($1, $2, $3, $4, 'in_progress', 1,
             $5, $6, $7,
             $8, $9, $10, $11, $12,
             $13)`,
    [
      params.seasonId, params.playerId, params.teamId, params.initiator,
      params.teamSalary, params.teamYears, params.teamSigningBonus ?? 0,
      params.factors.money, params.factors.winning, params.factors.playtime,
      params.factors.loyalty, params.factors.reputation,
      JSON.stringify([initialMessage]),
    ],
  );

  return {
    id: result.lastInsertId ?? 0,
    seasonId: params.seasonId,
    playerId: params.playerId,
    teamId: params.teamId,
    initiator: params.initiator,
    status: 'in_progress',
    currentRound: 1,
    teamSalary: params.teamSalary,
    teamYears: params.teamYears,
    teamSigningBonus: params.teamSigningBonus ?? 0,
    playerSalary: null,
    playerYears: null,
    playerSigningBonus: null,
    factors: params.factors,
    finalSalary: null,
    finalYears: null,
    finalSigningBonus: null,
    messages: [initialMessage],
  };
}

/**
 * 협상에 응답한다 (역제안 또는 수락/거절).
 */
export async function respondToNegotiation(
  negotiationId: number,
  response: 'accept' | 'reject' | 'counter',
  counterOffer?: { salary: number; years: number; signingBonus?: number },
  message?: string,
): Promise<ContractNegotiation> {
  const db = await (await import('../../db/database')).getDatabase();

  const rows = await db.select<NegotiationRow[]>(
    'SELECT * FROM contract_negotiations WHERE id = $1',
    [negotiationId],
  );

  if (rows.length === 0) throw new Error('협상을 찾을 수 없습니다.');

  const neg = mapRowToNegotiation(rows[0]);

  if (neg.status !== 'in_progress') {
    throw new Error(`이미 종료된 협상입니다 (상태: ${neg.status})`);
  }

  const newMessages = [...neg.messages];

  if (response === 'accept') {
    // 수락 — 최종 조건 확정
    const finalSalary = counterOffer?.salary ?? neg.teamSalary;
    const finalYears = counterOffer?.years ?? neg.teamYears;
    const finalBonus = counterOffer?.signingBonus ?? neg.teamSigningBonus;

    newMessages.push({
      round: neg.currentRound,
      from: neg.initiator === 'team_to_player' ? 'player' : 'team',
      text: message ?? '계약 조건에 동의합니다.',
      salary: finalSalary,
      years: finalYears,
      signingBonus: finalBonus,
      timestamp: new Date().toISOString(),
    });

    await db.execute(
      `UPDATE contract_negotiations SET
        status = 'accepted',
        final_salary = $1, final_years = $2, final_signing_bonus = $3,
        messages = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [finalSalary, finalYears, finalBonus, JSON.stringify(newMessages), negotiationId],
    );

    return { ...neg, status: 'accepted', finalSalary, finalYears, finalSigningBonus: finalBonus, messages: newMessages };
  }

  if (response === 'reject') {
    newMessages.push({
      round: neg.currentRound,
      from: neg.initiator === 'team_to_player' ? 'player' : 'team',
      text: message ?? '제안을 거절합니다.',
      timestamp: new Date().toISOString(),
    });

    await db.execute(
      `UPDATE contract_negotiations SET
        status = 'rejected', messages = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(newMessages), negotiationId],
    );

    return { ...neg, status: 'rejected', messages: newMessages };
  }

  // counter — 역제안
  if (!counterOffer) throw new Error('역제안 시 조건을 제시해야 합니다.');

  if (neg.currentRound >= 3) {
    // 3라운드 초과 시 자동 거절
    newMessages.push({
      round: neg.currentRound,
      from: neg.initiator === 'team_to_player' ? 'player' : 'team',
      text: '더 이상 협상을 진행할 수 없습니다.',
      timestamp: new Date().toISOString(),
    });

    await db.execute(
      `UPDATE contract_negotiations SET
        status = 'rejected', messages = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(newMessages), negotiationId],
    );

    return { ...neg, status: 'rejected', messages: newMessages };
  }

  const nextRound = neg.currentRound + 1;
  // 누가 역제안하는지 결정
  const isPlayerResponding = neg.initiator === 'team_to_player';

  newMessages.push({
    round: nextRound,
    from: isPlayerResponding ? 'player' : 'team',
    text: message ?? `연봉 ${counterOffer.salary.toLocaleString()}만, ${counterOffer.years}년을 제안합니다.`,
    salary: counterOffer.salary,
    years: counterOffer.years,
    signingBonus: counterOffer.signingBonus,
    timestamp: new Date().toISOString(),
  });

  if (isPlayerResponding) {
    await db.execute(
      `UPDATE contract_negotiations SET
        current_round = $1, player_salary = $2, player_years = $3, player_signing_bonus = $4,
        messages = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [nextRound, counterOffer.salary, counterOffer.years, counterOffer.signingBonus ?? 0,
       JSON.stringify(newMessages), negotiationId],
    );
  } else {
    await db.execute(
      `UPDATE contract_negotiations SET
        current_round = $1, team_salary = $2, team_years = $3, team_signing_bonus = $4,
        messages = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [nextRound, counterOffer.salary, counterOffer.years, counterOffer.signingBonus ?? 0,
       JSON.stringify(newMessages), negotiationId],
    );
  }

  return {
    ...neg,
    currentRound: nextRound,
    ...(isPlayerResponding
      ? { playerSalary: counterOffer.salary, playerYears: counterOffer.years, playerSigningBonus: counterOffer.signingBonus ?? 0 }
      : { teamSalary: counterOffer.salary, teamYears: counterOffer.years, teamSigningBonus: counterOffer.signingBonus ?? 0 }),
    messages: newMessages,
  };
}

/**
 * 팀의 진행중인 협상 목록을 조회한다.
 */
export async function getTeamNegotiations(
  teamId: string,
  seasonId: number,
): Promise<ContractNegotiation[]> {
  const db = await (await import('../../db/database')).getDatabase();
  const rows = await db.select<NegotiationRow[]>(
    `SELECT * FROM contract_negotiations
     WHERE team_id = $1 AND season_id = $2
     ORDER BY updated_at DESC`,
    [teamId, seasonId],
  );
  return rows.map(mapRowToNegotiation);
}

/**
 * 선수의 진행중인 협상 목록을 조회한다.
 */
export async function getPlayerNegotiations(
  playerId: string,
  seasonId: number,
): Promise<ContractNegotiation[]> {
  const db = await (await import('../../db/database')).getDatabase();
  const rows = await db.select<NegotiationRow[]>(
    `SELECT * FROM contract_negotiations
     WHERE player_id = $1 AND season_id = $2
     ORDER BY updated_at DESC`,
    [playerId, seasonId],
  );
  return rows.map(mapRowToNegotiation);
}

/**
 * 협상 수락 후 실제 계약을 체결한다.
 */
export async function finalizeNegotiation(
  negotiation: ContractNegotiation,
  currentSeasonId: number,
): Promise<RenewalResult> {
  if (negotiation.status !== 'accepted' || !negotiation.finalSalary || !negotiation.finalYears) {
    return { success: false, reason: '수락된 협상이 아닙니다.' };
  }

  // 연봉 상한 체크
  const currentTotalSalary = await getTeamTotalSalary(negotiation.teamId);
  if (currentTotalSalary + negotiation.finalSalary > SALARY_CAP) {
    return { success: false, reason: '연봉 상한을 초과합니다.' };
  }

  // [C11] 계약 업데이트 (1년 = 2스플릿이므로 years * 2)
  const contractEndSeason = currentSeasonId + (negotiation.finalYears * 2);
  await updatePlayerContract(negotiation.playerId, negotiation.finalSalary, contractEndSeason);

  // 계약 보너스 처리
  if (negotiation.finalSigningBonus && negotiation.finalSigningBonus > 0) {
    const db = await (await import('../../db/database')).getDatabase();
    await db.execute('UPDATE teams SET budget = budget - $1 WHERE id = $2', [negotiation.finalSigningBonus, negotiation.teamId]);

    const { addClause } = await import('./clauseEngine');
    await addClause(negotiation.playerId, 'signing_bonus', negotiation.finalSigningBonus, `시즌 ${currentSeasonId} 계약 보너스`);
  }

  return {
    success: true,
    reason: `계약 체결: ${negotiation.finalSalary.toLocaleString()}만/년, ${negotiation.finalYears}년 (시즌 ${contractEndSeason}까지)`,
  };
}

// ─────────────────────────────────────────
// AI 선수 자동 응답 (감독 모드용)
// ─────────────────────────────────────────

/**
 * AI 선수가 팀 제안에 자동 응답한다.
 * 감독 모드에서 소속 선수에게 재계약 제안 시 호출.
 */
export async function aiPlayerRespondToOffer(
  negotiation: ContractNegotiation,
  player: Player,
  teamInfo: {
    reputation: number;
    recentWinRate: number;
    rosterStrength: number;
    positionCompetitorOvr: number;
  },
): Promise<ContractNegotiation> {
  const evaluation = evaluateTeam(player, negotiation.factors, {
    ...teamInfo,
    isCurrentTeam: true,
  }, negotiation.teamSalary);

  // 수락 기준: 종합 평가 65 이상이면 수락
  if (evaluation.overall >= 65) {
    return respondToNegotiation(
      negotiation.id,
      'accept',
      { salary: negotiation.teamSalary, years: negotiation.teamYears, signingBonus: negotiation.teamSigningBonus },
      `${evaluation.reasons.slice(0, 2).join('. ')}. 좋은 조건입니다, 수락하겠습니다.`,
    );
  }

  // 거절 기준: 종합 평가 30 미만이면 거절
  if (evaluation.overall < 30) {
    return respondToNegotiation(
      negotiation.id,
      'reject',
      undefined,
      `${evaluation.reasons.slice(0, 2).join('. ')}. 이 조건으로는 계약할 수 없습니다.`,
    );
  }

  // 역제안
  const counter = generatePlayerCounterOffer(
    player,
    negotiation.factors,
    { salary: negotiation.teamSalary, years: negotiation.teamYears, signingBonus: negotiation.teamSigningBonus },
    evaluation,
  );

  return respondToNegotiation(
    negotiation.id,
    'counter',
    { salary: counter.salary, years: counter.years, signingBonus: counter.signingBonus },
    counter.message,
  );
}

// ─────────────────────────────────────────
// 선수 모드: 팀에 계약 요청
// ─────────────────────────────────────────

/**
 * 선수 모드에서 팀에 재계약/연봉 인상을 요청한다.
 */
export async function playerRequestContract(params: {
  seasonId: number;
  playerId: string;
  teamId: string;
  requestedSalary: number;
  requestedYears: number;
}): Promise<ContractNegotiation> {
  const player = await (await import('../../db/queries')).getPlayerById(params.playerId);
  const factors = player ? generateDecisionFactors(player) : {
    money: 50, winning: 50, playtime: 50, loyalty: 50, reputation: 50,
  };

  return createNegotiation({
    seasonId: params.seasonId,
    playerId: params.playerId,
    teamId: params.teamId,
    initiator: 'player_to_team',
    teamSalary: params.requestedSalary,
    teamYears: params.requestedYears,
    factors,
  });
}

/**
 * AI 감독이 선수의 계약 요청에 자동 응답한다.
 * 선수 모드에서 팀에 계약 요청 시 호출.
 */
export async function aiTeamRespondToRequest(
  negotiation: ContractNegotiation,
  player: Player,
): Promise<ContractNegotiation> {
  const ovr = getPlayerOverall(player);
  const fairSalary = calculateFairSalary(player);

  // 팀 예산 확인
  const currentTotalSalary = await getTeamTotalSalary(negotiation.teamId);
  const canAfford = currentTotalSalary + negotiation.teamSalary <= SALARY_CAP;

  if (!canAfford) {
    return respondToNegotiation(
      negotiation.id,
      'reject',
      undefined,
      '연봉 상한으로 인해 이 조건을 수용할 수 없습니다.',
    );
  }

  // 선수 가치 대비 요구 연봉 평가
  const salaryRatio = negotiation.teamSalary / Math.max(fairSalary, 1);

  if (salaryRatio <= 1.0 && ovr >= 65) {
    // 적정 연봉 이하 + 주전급이면 수락
    return respondToNegotiation(
      negotiation.id,
      'accept',
      { salary: negotiation.teamSalary, years: negotiation.teamYears },
      '좋은 제안입니다. 계약 조건에 동의합니다.',
    );
  }

  if (salaryRatio > 1.3 || ovr < 55) {
    // 요구가 너무 높거나 실력 부족이면 거절
    return respondToNegotiation(
      negotiation.id,
      'reject',
      undefined,
      ovr < 55
        ? '현재 로스터 상황에서 그 조건은 어렵습니다.'
        : '요구 연봉이 너무 높습니다. 다시 제안해주세요.',
    );
  }

  // 역제안: 적정 연봉 수준으로
  const counterSalary = Math.round(fairSalary * (ovr >= 75 ? 1.1 : 1.0));
  const counterYears = Math.min(negotiation.teamYears, 2);

  return respondToNegotiation(
    negotiation.id,
    'counter',
    { salary: counterSalary, years: counterYears },
    `연봉 ${counterSalary.toLocaleString()}만, ${counterYears}년을 제안합니다.`,
  );
}
