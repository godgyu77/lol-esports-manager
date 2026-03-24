/**
 * 이적 시장 엔진
 * - 선수 시장 가치 계산
 * - 이적 제안 유효성 검증
 * - 이적 수락/거절 처리
 * - 자유계약 영입
 * - 계약 만료 처리
 */

import { FINANCIAL_CONSTANTS } from '../../data/systemPrompt';
import {
  createTransferOffer,
  updateTransferOfferStatus,
  getTransferOffers,
  updatePlayerTeam,
  updatePlayerContract,
  getTeamTotalSalary,
  getExpiringContracts,
  getFreeAgents as dbGetFreeAgents,
  getPlayersByTeamId,
  getPlayerById,
  getAllTeams,
  insertFinanceLog,
  type TransferOffer,
} from '../../db/queries';
import { getDatabase } from '../../db/database';
import { agentNegotiate } from '../agent/agentEngine';
import { canSignForeignPlayer } from '../rules/leagueRulesEngine';
import type { Player } from '../../types/player';
import type { Position, Region } from '../../types/game';
import { initializeTeamChemistry } from '../chemistry/chemistryEngine';

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────

/** 연봉 상한 (억 원 → 만 원) */
const SALARY_CAP = FINANCIAL_CONSTANTS.salaryCap * 10000;

/** 선수 가치 계산용 나이 계수 */
const AGE_VALUE_CURVE: Record<number, number> = {
  17: 0.7, 18: 0.85, 19: 0.95, 20: 1.0, 21: 1.05, 22: 1.1,
  23: 1.1, 24: 1.05, 25: 1.0, 26: 0.9, 27: 0.75, 28: 0.6,
  29: 0.45, 30: 0.3,
};

function getAgeFactor(age: number): number {
  if (age in AGE_VALUE_CURVE) return AGE_VALUE_CURVE[age];
  if (age < 17) return 0.5;
  return 0.2;
}

// ─────────────────────────────────────────
// 선수 가치 평가
// ─────────────────────────────────────────

/** 선수 평균 스탯 (OVR 대용) */
function getPlayerOverall(player: Player): number {
  const s = player.stats;
  return (s.mechanical + s.gameSense + s.teamwork + s.consistency + s.laning + s.aggression) / 6;
}

/**
 * 선수 시장 가치 계산 (만 원 단위)
 * = OVR × 나이계수 × 잠재력보정 × 인기도보정
 */
export function calculatePlayerValue(player: Player): number {
  const ovr = getPlayerOverall(player);
  const ageFactor = getAgeFactor(player.age);
  const potentialFactor = 0.8 + (player.potential / 100) * 0.4; // 0.8 ~ 1.2
  const popFactor = 0.9 + (player.popularity / 100) * 0.2;     // 0.9 ~ 1.1

  // 기본 가치: OVR 80 = 약 16000만(16억) 기준
  const baseValue = ovr * 200;
  const value = baseValue * ageFactor * potentialFactor * popFactor;

  return Math.round(Math.max(value, 1000)); // 최소 1000만 원
}

/**
 * 적정 연봉 계산 (만 원/년)
 */
export function calculateFairSalary(player: Player): number {
  const ovr = getPlayerOverall(player);
  const ageFactor = getAgeFactor(player.age);

  // OVR 80 기준 약 4000만 원/년
  const baseSalary = ovr * 50;
  const salary = baseSalary * ageFactor;

  return Math.round(Math.max(salary, 500)); // 최소 500만 원
}

// ─────────────────────────────────────────
// 에이전트 수수료
// ─────────────────────────────────────────

/** 에이전트 수수료 계산 (이적료의 5%, 최소 500만) */
export function calculateAgentFee(transferFee: number): number {
  if (transferFee <= 0) return 0;
  return Math.max(500, Math.round(transferFee * 0.05));
}

// ─────────────────────────────────────────
// 이적 제안 유효성 검증
// ─────────────────────────────────────────

export interface TransferValidation {
  valid: boolean;
  reason?: string;
}

/**
 * 이적 제안 유효성 검증
 */
export async function validateTransferOffer(
  fromTeamId: string,
  playerId: string,
  transferFee: number,
  offeredSalary: number,
): Promise<TransferValidation> {
  // 1. 팀 예산 확인
  const db = await getDatabase();
  const teamRows = await db.select<{ budget: number; region: string }[]>(
    'SELECT budget, region FROM teams WHERE id = $1',
    [fromTeamId],
  );

  if (!teamRows.length) return { valid: false, reason: '팀을 찾을 수 없습니다.' };

  const teamBudget = teamRows[0].budget;
  const teamRegion = teamRows[0].region as Region;

  const agentFee = calculateAgentFee(transferFee);
  const totalCost = transferFee + agentFee;
  if (teamBudget < totalCost) {
    return { valid: false, reason: `예산 부족: 보유 ${teamBudget.toLocaleString()}만 / 필요 ${totalCost.toLocaleString()}만 (이적료 ${transferFee.toLocaleString()} + 에이전트 ${agentFee.toLocaleString()})` };
  }

  // 2. [W13] 연봉 상한 확인 — 이적 대상 선수의 기존 연봉을 차감하여 계산
  // 이적으로 떠나는 선수의 연봉이 빠지므로 순증가분만 체크해야 함
  const currentTotalSalary = await getTeamTotalSalary(fromTeamId);
  const player = await getPlayerById(playerId);
  // 이적 대상 선수가 영입팀(fromTeam) 소속이 아닐 경우 기존 연봉 차감 불필요
  const departingPlayerSalary = (player && player.teamId === fromTeamId) ? player.contract.salary : 0;
  const projectedSalary = currentTotalSalary - departingPlayerSalary + offeredSalary;
  if (projectedSalary > SALARY_CAP) {
    return {
      valid: false,
      reason: `연봉 상한 초과: 현재 ${currentTotalSalary.toLocaleString()}만 - 기존 ${departingPlayerSalary.toLocaleString()}만 + 제안 ${offeredSalary.toLocaleString()}만 = ${projectedSalary.toLocaleString()}만 > 상한 ${SALARY_CAP.toLocaleString()}만`,
    };
  }

  // 3. 이미 진행중인 제안이 있는지 확인
  const existingOffers = await db.select<{ id: number }[]>(
    `SELECT id FROM transfer_offers
     WHERE from_team_id = $1 AND player_id = $2 AND status = 'pending'`,
    [fromTeamId, playerId],
  );

  if (existingOffers.length > 0) {
    return { valid: false, reason: '해당 선수에 대한 진행중인 제안이 있습니다.' };
  }

  // 4. 외국인 선수 규정 체크 (player는 위 연봉 상한 체크에서 이미 조회됨)
  if (player) {
    const REGION_LOCAL: Record<Region, string[]> = {
      LCK: ['KR'],
      LPL: ['CN'],
      LEC: ['DE', 'FR', 'ES', 'PL', 'SE', 'DK', 'CZ', 'RO', 'BG', 'IT', 'PT', 'NL', 'BE', 'AT', 'GR', 'FI', 'NO', 'HU', 'SK', 'SI', 'HR', 'LT', 'LV', 'EE', 'IE', 'GB', 'EU'],
      LCS: ['US', 'CA', 'NA'],
    };
    const localNats = REGION_LOCAL[teamRegion] ?? [];
    const isForeign = !localNats.includes(player.nationality.toUpperCase());

    if (isForeign) {
      const foreignCheck = await canSignForeignPlayer(fromTeamId, teamRegion);
      if (!foreignCheck.allowed) {
        return { valid: false, reason: foreignCheck.reason ?? '외국인 선수 규정 위반' };
      }
    }
  }

  return { valid: true };
}

// ─────────────────────────────────────────
// 이적 처리
// ─────────────────────────────────────────

/**
 * 자유계약 선수 영입 제안
 * - 에이전트 협상 단계 포함
 */
export async function offerFreeAgent(params: {
  seasonId: number;
  fromTeamId: string;
  playerId: string;
  offeredSalary: number;
  contractYears: number;
  offerDate: string;
}): Promise<{ success: boolean; offerId?: number; reason?: string; agentMessage?: string }> {
  const validation = await validateTransferOffer(
    params.fromTeamId, params.playerId, 0, params.offeredSalary,
  );

  if (!validation.valid) {
    return { success: false, reason: validation.reason };
  }

  // 에이전트 협상
  const fairSalary = calculateFairSalary(
    await getPlayerForAgent(params.playerId),
  );
  const agentResult = await agentNegotiate(params.playerId, params.offeredSalary, fairSalary);

  if (!agentResult.accepted) {
    return {
      success: false,
      reason: agentResult.message,
      agentMessage: `에이전트 요구 연봉: ${agentResult.counterOffer.toLocaleString()}만`,
    };
  }

  const offerId = await createTransferOffer({
    seasonId: params.seasonId,
    fromTeamId: params.fromTeamId,
    toTeamId: null, // 자유계약
    playerId: params.playerId,
    transferFee: 0,
    offeredSalary: params.offeredSalary,
    contractYears: params.contractYears,
    offerDate: params.offerDate,
  });

  return { success: true, offerId, agentMessage: agentResult.message };
}

/**
 * 타 팀 선수에게 이적 제안
 * - 에이전트 협상 단계 포함
 */
export async function offerTransfer(params: {
  seasonId: number;
  fromTeamId: string;
  toTeamId: string;
  playerId: string;
  transferFee: number;
  offeredSalary: number;
  contractYears: number;
  offerDate: string;
}): Promise<{ success: boolean; offerId?: number; reason?: string; agentMessage?: string }> {
  const validation = await validateTransferOffer(
    params.fromTeamId, params.playerId, params.transferFee, params.offeredSalary,
  );

  if (!validation.valid) {
    return { success: false, reason: validation.reason };
  }

  // 에이전트 협상
  const fairSalary = calculateFairSalary(
    await getPlayerForAgent(params.playerId),
  );
  const agentResult = await agentNegotiate(params.playerId, params.offeredSalary, fairSalary);

  if (!agentResult.accepted) {
    return {
      success: false,
      reason: agentResult.message,
      agentMessage: `에이전트 요구 연봉: ${agentResult.counterOffer.toLocaleString()}만`,
    };
  }

  const offerId = await createTransferOffer({
    seasonId: params.seasonId,
    fromTeamId: params.fromTeamId,
    toTeamId: params.toTeamId,
    playerId: params.playerId,
    transferFee: params.transferFee,
    offeredSalary: params.offeredSalary,
    contractYears: params.contractYears,
    offerDate: params.offerDate,
  });

  return { success: true, offerId, agentMessage: agentResult.message };
}

/**
 * 이적 제안 수락 처리
 * - 선수 소속팀 변경
 * - 계약 업데이트
 * - 이적료 처리 (budget 이동)
 * - 재정 로그 기록
 */
export async function acceptTransferOffer(
  offer: TransferOffer,
  currentSeasonId: number,
  resolvedDate: string,
): Promise<void> {
  const db = await getDatabase();

  // 1. 제안 상태 변경
  await updateTransferOfferStatus(offer.id, 'accepted', resolvedDate);

  // 2. 선수 소속팀 변경
  await updatePlayerTeam(offer.playerId, offer.fromTeamId);

  // 3. [C11] 계약 업데이트 (1년 = 2스플릿이므로 years * 2)
  const contractEndSeason = currentSeasonId + (offer.contractYears * 2);
  await updatePlayerContract(offer.playerId, offer.offeredSalary, contractEndSeason);

  // 4. 이적료 + 에이전트 수수료 처리
  if (offer.transferFee > 0 && offer.toTeamId) {
    const agentFee = calculateAgentFee(offer.transferFee);

    // 영입팀: 이적료 + 에이전트 수수료 지출
    await db.execute(
      'UPDATE teams SET budget = budget - $1 WHERE id = $2',
      [offer.transferFee + agentFee, offer.fromTeamId],
    );
    await insertFinanceLog(
      offer.fromTeamId, offer.seasonId, resolvedDate,
      'expense', 'transfer', offer.transferFee,
      `선수 이적료 지급 (${offer.playerId})`,
    );
    if (agentFee > 0) {
      await insertFinanceLog(
        offer.fromTeamId, offer.seasonId, resolvedDate,
        'expense', 'agent_fee', agentFee,
        `에이전트 수수료 (${offer.playerId})`,
      );
    }

    // 원팀: 이적료 수입
    await db.execute(
      'UPDATE teams SET budget = budget + $1 WHERE id = $2',
      [offer.transferFee, offer.toTeamId],
    );
    await insertFinanceLog(
      offer.toTeamId, offer.seasonId, resolvedDate,
      'income', 'transfer', offer.transferFee,
      `선수 이적료 수입 (${offer.playerId})`,
    );
  }

  // 5. 영입팀 케미스트리 초기화 (새 선수와의 관계 생성)
  try {
    await initializeTeamChemistry(offer.fromTeamId);
  } catch { /* 케미스트리 초기화 실패 무시 */ }

  // 6. [C12] 이적 완료 뉴스 생성
  // fromTeamId = 영입팀(buyer), toTeamId = 판매팀(seller/원소속팀)
  // generateTransferCompleteNews 시그니처: (seasonId, date, playerName, fromTeam, toTeam, fee, teamId, playerId)
  //   fromTeam = 원소속팀(떠나는 팀), toTeam = 영입팀(새 팀)
  try {
    const { generateTransferCompleteNews } = await import('../news/newsEngine');
    const playerRows = await db.select<{ name: string }[]>('SELECT name FROM players WHERE id = $1', [offer.playerId]);
    const buyerTeamRows = await db.select<{ name: string }[]>('SELECT name FROM teams WHERE id = $1', [offer.fromTeamId]);
    const sellerTeamRows = await db.select<{ name: string }[]>('SELECT name FROM teams WHERE id = $1', [offer.toTeamId ?? '']);
    const playerName = playerRows[0]?.name ?? offer.playerId;
    const buyerTeamName = buyerTeamRows[0]?.name ?? offer.fromTeamId;   // 영입팀(buyer)
    const sellerTeamName = sellerTeamRows[0]?.name ?? (offer.toTeamId ?? 'FA'); // 판매팀(seller)
    // 뉴스 함수: fromTeam = 원소속(seller), toTeam = 새팀(buyer)
    await generateTransferCompleteNews(
      offer.seasonId, resolvedDate, playerName,
      sellerTeamName,  /* fromTeam: 원소속팀(판매팀) */
      buyerTeamName,   /* toTeam: 영입팀(구매팀) */
      offer.transferFee,
      offer.fromTeamId, /* teamId: 영입팀 ID (뉴스 연결용) */
      offer.playerId,
    );
  } catch { /* 뉴스 생성 실패 무시 */ }
}

/**
 * 이적 제안 거절 처리
 */
export async function rejectTransferOffer(
  offerId: number,
  resolvedDate: string,
): Promise<void> {
  await updateTransferOfferStatus(offerId, 'rejected', resolvedDate);
}

/**
 * 이적 제안 취소 처리
 */
export async function cancelTransferOffer(
  offerId: number,
  resolvedDate: string,
): Promise<void> {
  await updateTransferOfferStatus(offerId, 'cancelled', resolvedDate);
}

// ─────────────────────────────────────────
// 자유계약 수락 (즉시 처리)
// ─────────────────────────────────────────

/**
 * 자유계약 제안 수락 처리
 * 에이전트 협상은 offerFreeAgent/processAIFreeAgentSignings에서 사전 수행됨
 */
export async function acceptFreeAgentOffer(
  offer: TransferOffer,
  currentSeasonId: number,
  resolvedDate: string,
): Promise<void> {
  const db = await getDatabase();

  // 1. 제안 상태 변경
  await updateTransferOfferStatus(offer.id, 'accepted', resolvedDate);

  // 2. 선수 소속팀 변경
  await updatePlayerTeam(offer.playerId, offer.fromTeamId);

  // 3. 계약 업데이트 (1년 = 2스플릿이므로 years * 2)
  const contractEndSeason = currentSeasonId + (offer.contractYears * 2);
  await updatePlayerContract(offer.playerId, offer.offeredSalary, contractEndSeason);

  // 4. [C10] FA 영입 시 계약금 + 에이전트 수수료를 팀 예산에서 차감
  // 계약금 = 연봉 1년치의 50%, 에이전트 수수료 = 계약금의 5%
  const signingFee = Math.round(offer.offeredSalary * 0.5);
  const agentFee = calculateAgentFee(signingFee);
  const totalCost = signingFee + agentFee;

  if (totalCost > 0) {
    await db.execute(
      'UPDATE teams SET budget = budget - $1 WHERE id = $2',
      [totalCost, offer.fromTeamId],
    );
    await insertFinanceLog(
      offer.fromTeamId, offer.seasonId, resolvedDate,
      'expense', 'transfer', signingFee,
      `FA 선수 계약금 (${offer.playerId})`,
    );
    if (agentFee > 0) {
      await insertFinanceLog(
        offer.fromTeamId, offer.seasonId, resolvedDate,
        'expense', 'agent_fee', agentFee,
        `FA 에이전트 수수료 (${offer.playerId})`,
      );
    }
  }

  // 5. 영입팀 케미스트리 초기화
  try {
    await initializeTeamChemistry(offer.fromTeamId);
  } catch { /* 케미스트리 초기화 실패 무시 */ }
}

// ─────────────────────────────────────────
// 계약 만료 처리 (시즌 종료 시)
// ─────────────────────────────────────────

/**
 * 시즌 종료 시 계약 만료 선수를 자유계약으로 전환
 */
export async function processExpiredContracts(seasonId: number): Promise<string[]> {
  const expiring = await getExpiringContracts(seasonId);
  const freedPlayerIds: string[] = [];

  for (const player of expiring) {
    await updatePlayerTeam(player.id, null);
    freedPlayerIds.push(player.id);
  }

  return freedPlayerIds;
}

/**
 * 유저 팀의 보낸/받은 이적 제안 조회
 */
export async function getTeamTransferOffers(
  seasonId: number,
  teamId: string,
): Promise<{ sent: TransferOffer[]; received: TransferOffer[] }> {
  const allOffers = await getTransferOffers(seasonId);

  const sent = allOffers.filter(o => o.fromTeamId === teamId);
  const received = allOffers.filter(o => o.toTeamId === teamId);

  return { sent, received };
}

// ─────────────────────────────────────────
// 자유계약 선수 조회
// ─────────────────────────────────────────

/**
 * 현재 자유계약(teamId가 null인) 선수 목록 조회
 */
export async function getFreeAgents(): Promise<Player[]> {
  return dbGetFreeAgents();
}

// ─────────────────────────────────────────
// AI 팀 자동 FA 영입
// ─────────────────────────────────────────

/** 5개 포지션 */
const POSITIONS: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];

/** AI 이적 시도 확률 (팀당 10%) */
const AI_TRANSFER_ATTEMPT_RATE = 0.1;

/** 약한 포지션 OVR 기준 (이하일 때 이적 시도) */
const WEAK_POSITION_THRESHOLD = 60;

/**
 * 팀 로스터에서 가장 약한 포지션 판별
 * 해당 포지션에 선수가 없거나, 선수의 OVR이 가장 낮은 포지션을 반환
 */
function findWeakestPosition(roster: Player[]): { position: Position; currentOvr: number } | null {
  let weakest: { position: Position; currentOvr: number } | null = null;

  for (const pos of POSITIONS) {
    const posPlayers = roster.filter(p => p.position === pos);

    if (posPlayers.length === 0) {
      // 해당 포지션에 선수가 없으면 즉시 반환
      return { position: pos, currentOvr: 0 };
    }

    const bestOvr = Math.max(...posPlayers.map(p => getPlayerOverall(p)));

    if (!weakest || bestOvr < weakest.currentOvr) {
      weakest = { position: pos, currentOvr: bestOvr };
    }
  }

  return weakest;
}

/**
 * 매주 AI 팀이 자동으로 FA 선수를 영입
 * - 각 AI 팀의 약한 포지션을 파악
 * - 해당 포지션의 FA 선수 중 적합한 선수에게 제안
 * - 즉시 수락 처리 (자유계약이므로)
 */
export async function processAIFreeAgentSignings(
  seasonId: number,
  currentDate: string,
  userTeamId: string,
): Promise<string[]> {
  const teams = await getAllTeams();
  const freeAgents = await dbGetFreeAgents();
  const signedPlayerIds: string[] = [];

  if (freeAgents.length === 0) return signedPlayerIds;

  // AI 팀만 필터 (유저 팀 제외)
  const aiTeams = teams.filter(t => t.id !== userTeamId);

  // 팀 순서를 랜덤으로 섞어 공정하게 영입 기회 부여
  const shuffledTeams = aiTeams.sort(() => Math.random() - 0.5);

  for (const team of shuffledTeams) {
    // 매주 최대 1명만 영입
    const roster = await getPlayersByTeamId(team.id);
    const weak = findWeakestPosition(roster);

    if (!weak) continue;

    // 약한 포지션의 OVR이 이미 65 이상이면 보강 불필요
    if (weak.currentOvr >= 65) continue;

    // 해당 포지션의 FA 선수 중 아직 영입되지 않은 선수 찾기
    const candidates = freeAgents
      .filter(p => p.position === weak.position && !signedPlayerIds.includes(p.id))
      .sort((a, b) => getPlayerOverall(b) - getPlayerOverall(a));

    if (candidates.length === 0) continue;

    // 최고 OVR 선수 선택 (상위 3명 중 랜덤)
    const topCandidates = candidates.slice(0, Math.min(3, candidates.length));
    const target = topCandidates[Math.floor(Math.random() * topCandidates.length)];

    // 연봉 검증: 팀 연봉 상한 확인
    const fairSalary = calculateFairSalary(target);
    const currentTotalSalary = await getTeamTotalSalary(team.id);

    if (currentTotalSalary + fairSalary > SALARY_CAP) continue;

    // 예산 확인 (연봉의 1년치를 예산에서 감당 가능한지)
    if (team.budget < fairSalary) continue;

    // 에이전트 협상 — FA 선수도 수락/거절 판정
    const agentResult = await agentNegotiate(target.id, fairSalary, fairSalary);
    if (!agentResult.accepted) continue; // 에이전트 거절 시 스킵

    const contractYears = Math.floor(Math.random() * 2) + 1; // 1~2년
    const offerId = await createTransferOffer({
      seasonId,
      fromTeamId: team.id,
      toTeamId: null,
      playerId: target.id,
      transferFee: 0,
      offeredSalary: fairSalary,
      contractYears,
      offerDate: currentDate,
    });

    const offer: TransferOffer = {
      id: offerId,
      seasonId,
      fromTeamId: team.id,
      toTeamId: null,
      playerId: target.id,
      transferFee: 0,
      offeredSalary: fairSalary,
      contractYears,
      status: 'pending',
      offerDate: currentDate,
    };

    await acceptFreeAgentOffer(offer, seasonId, currentDate);
    signedPlayerIds.push(target.id);
  }

  return signedPlayerIds;
}

// ─────────────────────────────────────────
// AI 팀 간 이적 거래
// ─────────────────────────────────────────

/**
 * AI 팀이 다른 팀의 벤치 선수에게 이적 제안
 * - 각 AI 팀의 약한 포지션(OVR 60 이하) 식별
 * - 다른 팀의 벤치(sub) 선수 중 더 나은 선수 검색
 * - 유저 팀 선수에 대한 제안은 자동 수락 안 함
 * - 주 1회 호출, 팀당 10% 확률로 이적 시도
 */
export async function processAITransfers(
  seasonId: number,
  currentDate: string,
  userTeamId: string,
): Promise<{ fromTeam: string; toTeam: string; playerId: string; playerName: string }[]> {
  const db = await getDatabase();
  const teams = await getAllTeams();
  const completedTransfers: { fromTeam: string; toTeam: string; playerId: string; playerName: string }[] = [];

  // AI 팀만 필터 (유저 팀 제외)
  const aiTeams = teams.filter(t => t.id !== userTeamId);
  const shuffledTeams = aiTeams.sort(() => Math.random() - 0.5);

  for (const buyingTeam of shuffledTeams) {
    // 팀당 10% 확률로 이적 시도
    if (Math.random() >= AI_TRANSFER_ATTEMPT_RATE) continue;

    const roster = await getPlayersByTeamId(buyingTeam.id);
    const weak = findWeakestPosition(roster);

    if (!weak) continue;
    // OVR 60 이하인 포지션만 이적 시도
    if (weak.currentOvr > WEAK_POSITION_THRESHOLD) continue;

    // 다른 팀의 벤치(sub) 선수 중 해당 포지션 검색
    const benchCandidates: { player: Player; sellingTeamId: string }[] = [];

    for (const otherTeam of teams) {
      if (otherTeam.id === buyingTeam.id) continue;

      const otherRoster = await getPlayersByTeamId(otherTeam.id);
      const subs = otherRoster.filter(
        p => (p as { division?: string }).division === 'sub'
          && p.position === weak.position
          && getPlayerOverall(p) > weak.currentOvr,
      );

      for (const sub of subs) {
        benchCandidates.push({ player: sub, sellingTeamId: otherTeam.id });
      }
    }

    if (benchCandidates.length === 0) continue;

    // OVR 높은 순으로 정렬, 상위 3명 중 랜덤 선택
    benchCandidates.sort((a, b) => getPlayerOverall(b.player) - getPlayerOverall(a.player));
    const topCandidates = benchCandidates.slice(0, Math.min(3, benchCandidates.length));
    const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];

    const transferFee = calculatePlayerValue(selected.player);
    const offeredSalary = Math.round(calculateFairSalary(selected.player) * 1.2);

    // 영입팀 예산 확인
    if (buyingTeam.budget < transferFee) continue;

    // 영입팀 샐러리캡 확인
    const buyingTotalSalary = await getTeamTotalSalary(buyingTeam.id);
    if (buyingTotalSalary + offeredSalary > SALARY_CAP) continue;

    // 판매 팀 수락 조건 체크
    const sellingTeam = teams.find(t => t.id === selected.sellingTeamId);
    if (!sellingTeam) continue;

    // 수락 조건 1: 이적료 >= 시장가치 * 0.8
    const playerMarketValue = calculatePlayerValue(selected.player);
    if (transferFee < playerMarketValue * 0.8) continue;

    // 수락 조건 2: 판매 팀에 해당 포지션 대체 선수 있음
    const sellingRoster = await getPlayersByTeamId(selected.sellingTeamId);
    const positionPlayers = sellingRoster.filter(p => p.position === weak.position);
    if (positionPlayers.length <= 1) continue; // 대체 선수 없으면 거절

    // 유저 팀 선수에 대한 제안은 자동 수락 안 함 (제안만 생성)
    if (selected.sellingTeamId === userTeamId) {
      const contractYears = Math.floor(Math.random() * 2) + 1;
      await createTransferOffer({
        seasonId,
        fromTeamId: buyingTeam.id,
        toTeamId: selected.sellingTeamId,
        playerId: selected.player.id,
        transferFee,
        offeredSalary,
        contractYears,
        offerDate: currentDate,
      });
      // 유저 팀이므로 completedTransfers에 추가하지 않음 (UI에서 처리)
      continue;
    }

    // AI 팀 간 이적: 제안 생성 + 즉시 수락
    const contractYears = Math.floor(Math.random() * 2) + 1;
    const offerId = await createTransferOffer({
      seasonId,
      fromTeamId: buyingTeam.id,
      toTeamId: selected.sellingTeamId,
      playerId: selected.player.id,
      transferFee,
      offeredSalary,
      contractYears,
      offerDate: currentDate,
    });

    const offer: TransferOffer = {
      id: offerId,
      seasonId,
      fromTeamId: buyingTeam.id,
      toTeamId: selected.sellingTeamId,
      playerId: selected.player.id,
      transferFee,
      offeredSalary,
      contractYears,
      status: 'pending',
      offerDate: currentDate,
    };

    await acceptTransferOffer(offer, seasonId, currentDate);

    // 선수 이름 조회
    const playerRows = await db.select<{ name: string }[]>(
      'SELECT name FROM players WHERE id = $1',
      [selected.player.id],
    );
    const playerName = playerRows[0]?.name ?? selected.player.id;

    completedTransfers.push({
      fromTeam: selected.sellingTeamId,
      toTeam: buyingTeam.id,
      playerId: selected.player.id,
      playerName,
    });
  }

  return completedTransfers;
}

// ─────────────────────────────────────────
// 에이전트 협상용 선수 조회 헬퍼
// ─────────────────────────────────────────

/**
 * 에이전트 협상을 위해 playerId로 Player 객체 조회
 * 조회 실패 시 기본값 반환 (에이전트 협상은 계속 진행)
 */
async function getPlayerForAgent(playerId: string): Promise<Player> {
  const player = await getPlayerById(playerId);
  if (player) return player;

  // 폴백: 최소한의 Player 객체
  return {
    id: playerId,
    name: 'Unknown',
    teamId: null,
    position: 'mid',
    age: 22,
    nationality: 'KR',
    stats: { mechanical: 60, gameSense: 60, teamwork: 60, consistency: 60, laning: 60, aggression: 60 },
    mental: { mental: 50, stamina: 50, morale: 50 },
    contract: { salary: 1000, contractEndSeason: 1 },
    championPool: [],
    potential: 50,
    peakAge: 23,
    popularity: 30,
    secondaryPosition: null,
    playstyle: 'versatile',
    careerGames: 0,
    chemistry: {},
    formHistory: [],
  };
}

// ─────────────────────────────────────────
// 국제 이적 시스템
// ─────────────────────────────────────────

/** 국적 → 리전 매핑 */
const NATIONALITY_TO_REGION: Record<string, Region> = {
  KR: 'LCK', CN: 'LPL', EU: 'LEC', NA: 'LCS',
  DE: 'LEC', FR: 'LEC', ES: 'LEC', PL: 'LEC', SE: 'LEC',
  DK: 'LEC', NO: 'LEC', FI: 'LEC', UK: 'LEC', NL: 'LEC',
  US: 'LCS', CA: 'LCS',
  TW: 'LPL', HK: 'LPL',
};

/** 리전 간 언어 호환성 (0~1, 1이면 완전 호환) */
const LANGUAGE_COMPATIBILITY: Record<string, Record<string, number>> = {
  LCK: { LCK: 1.0, LPL: 0.2, LEC: 0.3, LCS: 0.4 },
  LPL: { LCK: 0.2, LPL: 1.0, LEC: 0.2, LCS: 0.3 },
  LEC: { LCK: 0.3, LPL: 0.2, LEC: 1.0, LCS: 0.8 },
  LCS: { LCK: 0.4, LPL: 0.3, LEC: 0.8, LCS: 1.0 },
};

/** 국제 이적 평가 결과 */
export interface InternationalTransferAssessment {
  /** 비자 취득 난이도 (0~1, 1이 가장 어려움) */
  visaDifficulty: number;
  /** 예상 비자 처리 기간 (일) */
  visaProcessingDays: number;
  /** 비자 거절 확률 (0~1) */
  visaDenialRisk: number;
  /** 언어 장벽 (0~1, 0이면 장벽 없음) */
  languageBarrier: number;
  /** 문화 적응 기간 (일) */
  culturalAdaptationDays: number;
  /** 적응 기간 중 퍼포먼스 페널티 (0~1, 0.3이면 -30%) */
  adaptationPerformancePenalty: number;
  /** 홈시크 리스크 (0~1) */
  homesicknessRisk: number;
  /** 국제 이적 추가 비용 (만 원) */
  relocationCost: number;
  /** 이적 가능 여부 */
  canTransfer: boolean;
  /** 불가 사유 (있을 경우) */
  blockReason?: string;
  /** 종합 이적 리스크 등급 */
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  /** 한국어 요약 */
  summary: string;
}

/**
 * 국제 이적 평가
 * 선수의 국적과 이적 대상 리전을 비교하여 비자/언어/문화 요소 분석
 */
export function assessInternationalTransfer(
  playerNationality: string,
  playerAge: number,
  fromRegion: Region,
  toRegion: Region,
): InternationalTransferAssessment {
  // 같은 리전이면 국제 이적이 아님
  const playerHomeRegion = NATIONALITY_TO_REGION[playerNationality] ?? fromRegion;
  const isInternational = playerHomeRegion !== toRegion;

  if (!isInternational) {
    return {
      visaDifficulty: 0, visaProcessingDays: 0, visaDenialRisk: 0,
      languageBarrier: 0, culturalAdaptationDays: 0, adaptationPerformancePenalty: 0,
      homesicknessRisk: 0, relocationCost: 0, canTransfer: true,
      riskLevel: 'low', summary: '국내 이적 — 추가 리스크 없음',
    };
  }

  // 비자 난이도 (리전에 따라 다름)
  const visaDifficultyMap: Record<Region, number> = {
    LCK: 0.4, LPL: 0.6, LEC: 0.3, LCS: 0.5,
  };
  const visaDifficulty = visaDifficultyMap[toRegion] ?? 0.4;

  // 비자 처리 기간 (7~30일)
  const visaProcessingDays = Math.round(7 + visaDifficulty * 23);

  // 비자 거절 확률 (낮은 능력치 → 높은 거절률은 적용 안함, 기본 5~15%)
  const visaDenialRisk = 0.05 + visaDifficulty * 0.1;

  // 언어 장벽
  const langCompat = LANGUAGE_COMPATIBILITY[playerHomeRegion]?.[toRegion] ?? 0.3;
  const languageBarrier = 1 - langCompat;

  // 문화 적응 기간 (14~60일, 언어장벽 비례)
  const culturalAdaptationDays = Math.round(14 + languageBarrier * 46);

  // 적응 기간 퍼포먼스 페널티 (언어장벽 * 0.3)
  const adaptationPerformancePenalty = Math.round(languageBarrier * 30) / 100;

  // 홈시크 리스크 (젊을수록, 언어장벽 클수록 높음)
  const ageFactor = playerAge <= 20 ? 0.3 : playerAge <= 23 ? 0.15 : 0.05;
  const homesicknessRisk = Math.min(1, languageBarrier * 0.4 + ageFactor);

  // 이주 비용 (리전 거리 기반)
  const distanceCostMap: Record<string, number> = {
    'LCK→LPL': 500, 'LPL→LCK': 500,
    'LCK→LEC': 1500, 'LEC→LCK': 1500,
    'LCK→LCS': 2000, 'LCS→LCK': 2000,
    'LPL→LEC': 1500, 'LEC→LPL': 1500,
    'LPL→LCS': 2000, 'LCS→LPL': 2000,
    'LEC→LCS': 1000, 'LCS→LEC': 1000,
  };
  const relocationCost = distanceCostMap[`${fromRegion}→${toRegion}`] ?? 1500;

  // 종합 리스크 등급
  const riskScore = visaDifficulty * 0.3 + languageBarrier * 0.4 + homesicknessRisk * 0.3;
  let riskLevel: InternationalTransferAssessment['riskLevel'];
  if (riskScore >= 0.7) riskLevel = 'very_high';
  else if (riskScore >= 0.5) riskLevel = 'high';
  else if (riskScore >= 0.3) riskLevel = 'medium';
  else riskLevel = 'low';

  // 요약 생성
  const riskLabels = { low: '낮음', medium: '보통', high: '높음', very_high: '매우 높음' };
  const summary = `국제 이적 (${fromRegion}→${toRegion}): 리스크 ${riskLabels[riskLevel]}, 언어장벽 ${Math.round(languageBarrier * 100)}%, 적응 ${culturalAdaptationDays}일, 비자 ${visaProcessingDays}일`;

  return {
    visaDifficulty,
    visaProcessingDays,
    visaDenialRisk,
    languageBarrier,
    culturalAdaptationDays,
    adaptationPerformancePenalty,
    homesicknessRisk,
    relocationCost,
    canTransfer: true,
    riskLevel,
    summary,
  };
}

/** 문화 적응 진행 상태 */
export interface CulturalAdaptationState {
  playerId: string;
  /** 원래 리전 */
  homeRegion: Region;
  /** 현재 리전 */
  currentRegion: Region;
  /** 적응도 (0~100, 100이면 완전 적응) */
  adaptationLevel: number;
  /** 남은 적응 일수 */
  daysRemaining: number;
  /** 현재 퍼포먼스 페널티 (0~0.3) */
  currentPenalty: number;
  /** 언어 습득도 (0~100) */
  languageProficiency: number;
}

/**
 * 일일 문화 적응 진행 계산
 * - 매일 적응도가 소폭 증가
 * - 팀 내 같은 국적 선수가 있으면 적응 가속
 * - 스포츠 심리상담사가 있으면 추가 가속
 */
export function advanceCulturalAdaptation(
  state: CulturalAdaptationState,
  hasSameNationalityTeammate: boolean,
  hasSportsPsychologist: boolean,
): CulturalAdaptationState {
  let dailyProgress = 1.5; // 기본 일일 적응 진행량

  // 같은 국적 팀메이트 → +50% 적응 가속
  if (hasSameNationalityTeammate) dailyProgress *= 1.5;

  // 스포츠 심리상담사 → +30% 적응 가속
  if (hasSportsPsychologist) dailyProgress *= 1.3;

  const newAdaptation = Math.min(100, state.adaptationLevel + dailyProgress);
  const newDaysRemaining = Math.max(0, state.daysRemaining - 1);

  // 퍼포먼스 페널티: 적응도에 반비례 (100이면 페널티 0)
  const maxPenalty = state.currentPenalty > 0 ? state.currentPenalty : 0.3;
  const currentPenalty = maxPenalty * (1 - newAdaptation / 100);

  // 언어 습득: 적응도보다 느리게 진행 (0.7배)
  const languageProficiency = Math.min(100, state.languageProficiency + dailyProgress * 0.7);

  return {
    ...state,
    adaptationLevel: Math.round(newAdaptation * 10) / 10,
    daysRemaining: newDaysRemaining,
    currentPenalty: Math.round(currentPenalty * 1000) / 1000,
    languageProficiency: Math.round(languageProficiency * 10) / 10,
  };
}
