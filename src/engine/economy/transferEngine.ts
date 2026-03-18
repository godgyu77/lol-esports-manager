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

  if (teamBudget < transferFee) {
    return { valid: false, reason: `예산 부족: 보유 ${teamBudget.toLocaleString()}만 / 필요 ${transferFee.toLocaleString()}만` };
  }

  // 2. 연봉 상한 확인
  const currentTotalSalary = await getTeamTotalSalary(fromTeamId);
  if (currentTotalSalary + offeredSalary > SALARY_CAP) {
    return {
      valid: false,
      reason: `연봉 상한 초과: 현재 ${currentTotalSalary.toLocaleString()}만 + 제안 ${offeredSalary.toLocaleString()}만 > 상한 ${SALARY_CAP.toLocaleString()}만`,
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

  // 4. 외국인 선수 규정 체크
  const player = await getPlayerById(playerId);
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

  // 3. 계약 업데이트
  const contractEndSeason = currentSeasonId + offer.contractYears;
  await updatePlayerContract(offer.playerId, offer.offeredSalary, contractEndSeason);

  // 4. 이적료 처리
  if (offer.transferFee > 0 && offer.toTeamId) {
    // 영입팀: 이적료 지출
    await db.execute(
      'UPDATE teams SET budget = budget - $1 WHERE id = $2',
      [offer.transferFee, offer.fromTeamId],
    );
    await insertFinanceLog(
      offer.fromTeamId, offer.seasonId, resolvedDate,
      'expense', 'transfer', offer.transferFee,
      `선수 이적료 지급 (${offer.playerId})`,
    );

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
 * 자유계약 제안 즉시 수락 처리
 * 자유계약은 AI 의사결정 없이 바로 수락 (추후 AI 협상 추가 가능)
 */
export async function acceptFreeAgentOffer(
  offer: TransferOffer,
  currentSeasonId: number,
  resolvedDate: string,
): Promise<void> {
  // 1. 제안 상태 변경
  await updateTransferOfferStatus(offer.id, 'accepted', resolvedDate);

  // 2. 선수 소속팀 변경
  await updatePlayerTeam(offer.playerId, offer.fromTeamId);

  // 3. 계약 업데이트
  const contractEndSeason = currentSeasonId + offer.contractYears;
  await updatePlayerContract(offer.playerId, offer.offeredSalary, contractEndSeason);
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

    // 제안 생성 + 즉시 수락
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
  };
}
