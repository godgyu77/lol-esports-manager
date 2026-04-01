/**
 * 밴픽(드래프트) 엔진
 * - LoL 프로 리그 규칙: 5밴 5픽 × 2페이즈
 * - 감독 모드: 유저가 직접 밴/픽
 * - 선수 모드: AI 감독이 밴/픽, 유저는 추천 가능
 * - AI 팀: 전력/메타/챔피언 풀 기반 자동 밴/픽
 */

import type { Position } from '../../types/game';
import type { Champion, ChampionSynergy } from '../../types/champion';
import type { ChampionProficiency } from '../../types/player';
import { getDatabase } from '../../db/database';
import { pickRandom } from '../../utils/random';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

/** 드래프트 페이즈 */
export type DraftPhase = 'ban1' | 'pick1' | 'ban2' | 'pick2' | 'swap' | 'complete';

/** 밴/픽 행동 */
export interface DraftAction {
  type: 'ban' | 'pick';
  side: 'blue' | 'red';
  championId: string;
  position?: Position; // pick일 때 해당 포지션
}

/** 드래프트 순서 (프로 리그 표준) */
const DRAFT_ORDER: { type: 'ban' | 'pick'; side: 'blue' | 'red'; phase: DraftPhase }[] = [
  // ── Phase 1 Ban (3+3) ──
  { type: 'ban', side: 'blue', phase: 'ban1' },
  { type: 'ban', side: 'red', phase: 'ban1' },
  { type: 'ban', side: 'blue', phase: 'ban1' },
  { type: 'ban', side: 'red', phase: 'ban1' },
  { type: 'ban', side: 'blue', phase: 'ban1' },
  { type: 'ban', side: 'red', phase: 'ban1' },
  // ── Phase 1 Pick (1-2-2-1) ──
  { type: 'pick', side: 'blue', phase: 'pick1' },
  { type: 'pick', side: 'red', phase: 'pick1' },
  { type: 'pick', side: 'red', phase: 'pick1' },
  { type: 'pick', side: 'blue', phase: 'pick1' },
  { type: 'pick', side: 'blue', phase: 'pick1' },
  { type: 'pick', side: 'red', phase: 'pick1' },
  // ── Phase 2 Ban (2+2) ──
  { type: 'ban', side: 'red', phase: 'ban2' },
  { type: 'ban', side: 'blue', phase: 'ban2' },
  { type: 'ban', side: 'red', phase: 'ban2' },
  { type: 'ban', side: 'blue', phase: 'ban2' },
  // ── Phase 2 Pick (1-2-1) ──
  { type: 'pick', side: 'red', phase: 'pick2' },
  { type: 'pick', side: 'blue', phase: 'pick2' },
  { type: 'pick', side: 'blue', phase: 'pick2' },
  { type: 'pick', side: 'red', phase: 'pick2' },
];

/** 팀의 드래프트 상태 */
export interface TeamDraftState {
  bans: string[];
  picks: { championId: string; position: Position }[];
}

const POSITION_ORDER: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];

function getNextAvailablePickPosition(teamState: TeamDraftState): Position | null {
  const usedPositions = new Set(teamState.picks.map((pick) => pick.position));
  return POSITION_ORDER.find((position) => !usedPositions.has(position)) ?? null;
}

/** 전체 드래프트 상태 */
export interface DraftState {
  /** 현재 단계 인덱스 (0~19) */
  currentStep: number;
  /** 현재 페이즈 */
  phase: DraftPhase;
  /** 현재 행동할 진영 */
  currentSide: 'blue' | 'red';
  /** 현재 행동 유형 */
  currentActionType: 'ban' | 'pick';
  /** 블루팀 상태 */
  blue: TeamDraftState;
  /** 레드팀 상태 */
  red: TeamDraftState;
  /** 밴된 챔피언 ID 목록 */
  bannedChampions: string[];
  /** 픽된 챔피언 ID 목록 */
  pickedChampions: string[];
  /** 완료 여부 */
  isComplete: boolean;
  /** 액션 히스토리 */
  history: DraftAction[];
  /** 피어리스 드래프트 모드 여부 */
  fearlessMode: boolean;
  /** 이전 세트에서 사용된 챔피언 (팀별) — 다음 세트에서 본인 팀 사용 금지 */
  fearlessPool: Record<'blue' | 'red', string[]>;
}

/** AI 밴픽에 사용할 팀 정보 */
export interface DraftTeamInfo {
  /** 포지션별 선수 챔피언 풀 */
  playerPools: Record<Position, ChampionProficiency[]>;
  /** 팀 선호 스타일 태그 */
  preferredTags: string[];
}

// ─────────────────────────────────────────
// 드래프트 엔진
// ─────────────────────────────────────────

/**
 * 새 드래프트 세션 생성
 * @param fearlessMode 피어리스 드래프트 활성화 여부
 * @param fearlessPool 이전 세트에서 사용된 챔피언 (팀별 누적)
 */
export function createDraftState(
  fearlessMode = false,
  fearlessPool?: Record<'blue' | 'red', string[]>,
): DraftState {
  return {
    currentStep: 0,
    phase: 'ban1',
    currentSide: 'blue',
    currentActionType: 'ban',
    blue: { bans: [], picks: [] },
    red: { bans: [], picks: [] },
    bannedChampions: [],
    pickedChampions: [],
    isComplete: false,
    history: [],
    fearlessMode,
    fearlessPool: fearlessPool ?? { blue: [], red: [] },
  };
}

/**
 * 챔피언이 사용 가능한지 (밴/픽 되지 않았는지 + 피어리스 체크)
 */
export function isChampionAvailable(state: DraftState, championId: string): boolean {
  if (state.bannedChampions.includes(championId)) return false;
  if (state.pickedChampions.includes(championId)) return false;
  // 피어리스: 현재 진영의 이전 세트 사용 챔피언은 사용 불가
  if (state.fearlessMode) {
    const side = state.currentSide;
    if (state.fearlessPool[side].includes(championId)) return false;
  }
  return true;
}

/**
 * 피어리스 드래프트: 세트 완료 후 사용된 챔피언을 풀에 누적
 * Bo3/Bo5 시리즈에서 세트 간 호출
 */
export function accumulateFearlessChampions(
  fearlessPool: Record<'blue' | 'red', string[]>,
  state: DraftState,
): Record<'blue' | 'red', string[]> {
  const newPool = {
    blue: [...fearlessPool.blue],
    red: [...fearlessPool.red],
  };
  for (const pick of state.blue.picks) {
    if (!newPool.blue.includes(pick.championId)) {
      newPool.blue.push(pick.championId);
    }
  }
  for (const pick of state.red.picks) {
    if (!newPool.red.includes(pick.championId)) {
      newPool.red.push(pick.championId);
    }
  }
  return newPool;
}

/**
 * 밴/픽 실행
 * @returns 성공 여부
 */
export function executeDraftAction(
  state: DraftState,
  championId: string,
  position?: Position,
): boolean {
  if (state.isComplete) return false;

  const step = DRAFT_ORDER[state.currentStep];
  if (!step) return false;

  // 챔피언 사용 가능 여부 확인
  if (!isChampionAvailable(state, championId)) return false;

  const teamState = step.side === 'blue' ? state.blue : state.red;

  if (step.type === 'ban') {
    teamState.bans.push(championId);
    state.bannedChampions.push(championId);
  } else {
    const resolvedPosition = position ?? getNextAvailablePickPosition(teamState);
    if (!resolvedPosition) return false;
    if (teamState.picks.some(p => p.position === resolvedPosition)) return false;
    teamState.picks.push({ championId, position: resolvedPosition });
    state.pickedChampions.push(championId);
    position = resolvedPosition;
  }

  state.history.push({
    type: step.type,
    side: step.side,
    championId,
    position,
  });

  // 다음 단계로
  state.currentStep++;

  if (state.currentStep >= DRAFT_ORDER.length) {
    state.phase = 'swap';
  } else {
    const next = DRAFT_ORDER[state.currentStep];
    state.phase = next.phase;
    state.currentSide = next.side;
    state.currentActionType = next.type;
  }

  return true;
}

/**
 * 챔피언 스왑 (같은 팀 내에서 두 픽의 챔피언+포지션 교환)
 */
export function swapChampions(
  state: DraftState,
  side: 'blue' | 'red',
  indexA: number,
  indexB: number,
): boolean {
  if (state.phase !== 'swap') return false;
  const team = side === 'blue' ? state.blue : state.red;
  if (indexA < 0 || indexA >= team.picks.length) return false;
  if (indexB < 0 || indexB >= team.picks.length) return false;
  if (indexA === indexB) return false;

  const tempChampionId = team.picks[indexA].championId;
  team.picks[indexA].championId = team.picks[indexB].championId;
  team.picks[indexB].championId = tempChampionId;
  return true;
}

/**
 * 스왑 단계 완료 → 드래프트 최종 완료
 */
export function finalizeDraft(state: DraftState): void {
  state.phase = 'complete';
  state.isComplete = true;
}

// ─────────────────────────────────────────
// 챔피언 현재 티어 조회 (DB 기반)
// ─────────────────────────────────────────

/** C/D 티어 이하 챔피언은 AI가 밴/픽하지 않도록 필터링하는 기준 */
const AI_IGNORE_TIERS = new Set(['C', 'D']);

/**
 * DB에서 챔피언 현재 티어 조회 (champion_patches 반영)
 * DB 접근 실패 시 정적 데이터 기반 티어를 fallback으로 사용
 */
export async function getChampionCurrentTier(
  championId: string,
): Promise<Champion['tier']> {
  try {
    const db = await getDatabase();
    const rows = await db.select<{ tier: string }[]>(
      'SELECT tier FROM champions WHERE id = $1',
      [championId],
    );
    if (rows.length > 0) {
      return rows[0].tier as Champion['tier'];
    }
  } catch {
    // DB 접근 실패 시 무시
  }
  return 'B'; // 기본 폴백
}

/**
 * 전체 챔피언의 현재 티어를 일괄 조회 (캐시용)
 */
async function getChampionTierMap(): Promise<Map<string, Champion['tier']>> {
  const tierMap = new Map<string, Champion['tier']>();
  try {
    const db = await getDatabase();
    const rows = await db.select<{ id: string; tier: string }[]>(
      'SELECT id, tier FROM champions',
    );
    for (const row of rows) {
      tierMap.set(row.id, row.tier as Champion['tier']);
    }
  } catch {
    // DB 접근 실패 시 빈 맵 반환
  }
  return tierMap;
}

/** 티어 보너스 계산 (현재 DB 티어 기반) */
function getTierBonus(tier: Champion['tier']): number {
  switch (tier) {
    case 'S': return 20;
    case 'A': return 10;
    case 'B': return 0;
    case 'C': return -10;
    case 'D': return -20;
    default: return 0;
  }
}

// ─────────────────────────────────────────
// AI 밴픽 로직
// ─────────────────────────────────────────

/**
 * AI의 밴 선택
 * 상대팀 핵심 챔피언 (높은 숙련도) 위주로 밴
 * 현재 챔피언 티어를 DB에서 실시간 조회하여 패치 반영
 */
export async function aiSelectBan(
  state: DraftState,
  opponentInfo: DraftTeamInfo,
  allChampions: Champion[],
): Promise<string> {
  const tierMap = await getChampionTierMap();

  // 상대팀 전체 챔피언 풀에서 숙련도 높은 순으로 정렬
  const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
  const candidateMap = new Map<string, number>();

  for (const pos of positions) {
    const pool = opponentInfo.playerPools[pos] ?? [];
    for (const cp of pool) {
      if (!isChampionAvailable(state, cp.championId)) continue;
      const champ = allChampions.find(c => c.id === cp.championId);
      if (!champ) continue;

      // DB에서 현재 티어 조회 (패치 반영)
      const currentTier = tierMap.get(cp.championId) ?? champ.tier;

      // C/D 티어 챔피언은 밴 가치가 없으므로 스킵
      if (AI_IGNORE_TIERS.has(currentTier)) continue;

      // 점수 = 숙련도 + 현재 티어 보너스
      const tierBonus = getTierBonus(currentTier);
      const score = cp.proficiency + tierBonus;
      const existing = candidateMap.get(cp.championId) ?? 0;
      candidateMap.set(cp.championId, Math.max(existing, score));
    }
  }

  // 점수 높은 순 정렬
  const sorted = [...candidateMap.entries()].sort((a, b) => b[1] - a[1]);

  // 최상위 챔피언 밴 (약간의 랜덤성)
  if (sorted.length === 0) {
    // 풀이 없으면 S/A 티어 챔피언 중 랜덤 밴 (DB 티어 기반)
    const highTier = allChampions.filter(c => {
      const currentTier = tierMap.get(c.id) ?? c.tier;
      return (currentTier === 'S' || currentTier === 'A') && isChampionAvailable(state, c.id);
    });
    return highTier.length > 0 ? pickRandom(highTier).id : 'aatrox';
  }

  // 상위 3개 중 랜덤 (예측 불가능성)
  const topN = sorted.slice(0, Math.min(3, sorted.length));
  const picked = pickRandom(topN);
  return picked?.[0] ?? 'aatrox';
}

/**
 * AI의 픽 선택
 * 아직 픽하지 않은 포지션 중 필요한 포지션의 최적 챔피언 선택
 * 현재 챔피언 티어를 DB에서 실시간 조회하여 패치 반영
 */
export async function aiSelectPick(
  state: DraftState,
  side: 'blue' | 'red',
  teamInfo: DraftTeamInfo,
  allChampions: Champion[],
  synergyData: ChampionSynergy[] = [],
): Promise<{ championId: string; position: Position }> {
  const tierMap = await getChampionTierMap();

  const teamState = side === 'blue' ? state.blue : state.red;
  const opponentState = side === 'blue' ? state.red : state.blue;
  const pickedPositions = new Set(teamState.picks.map(p => p.position));
  const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];

  // 아직 안 픽한 포지션
  const remaining = positions.filter(p => !pickedPositions.has(p));

  // 각 남은 포지션에서 최고 점수 챔피언 찾기
  let bestChampId = '';
  let bestPosition: Position = 'mid';
  let bestScore = -1;

  // 픽 우선순위: 핵심 포지션부터 (mid > jungle > adc > top > support)
  const priorityOrder: Position[] = ['mid', 'jungle', 'adc', 'top', 'support'];
  const sortedRemaining = remaining.sort(
    (a, b) => priorityOrder.indexOf(a) - priorityOrder.indexOf(b),
  );

  // 상대 픽 목록 (카운터픽 계산용)
  const opponentPickIds = opponentState.picks.map(p => p.championId);

  for (const pos of sortedRemaining) {
    const pool = teamInfo.playerPools[pos] ?? [];

    for (const cp of pool) {
      if (!isChampionAvailable(state, cp.championId)) continue;
      const champ = allChampions.find(c => c.id === cp.championId);
      if (!champ) continue;

      // DB에서 현재 티어 조회 (패치 반영)
      const currentTier = tierMap.get(cp.championId) ?? champ.tier;

      // C/D 티어 챔피언은 AI가 픽하지 않음
      if (AI_IGNORE_TIERS.has(currentTier)) continue;

      // 기본 점수 = 숙련도 + 현재 티어 보너스 + 팀 선호 태그 매칭
      const tierBonus = getTierBonus(currentTier);
      const tagBonus = champ.tags.some(t => teamInfo.preferredTags.includes(t)) ? 5 : 0;

      // 카운터픽 점수 (상대 이미 픽한 챔피언에 대한 상성)
      const counterpickScore = calculateCounterpickScore(cp.championId, opponentPickIds, synergyData);

      // 팀 구성 점수 (부족한 역할 채우기)
      const teamCompScore = evaluateTeamCompScore(champ, teamState.picks, allChampions);

      // 긴급도 보너스: 남은 픽이 1~2개면 포지션 채우기 우선
      const urgencyBonus = remaining.length <= 2 ? 10 : 0;

      const score = cp.proficiency + tierBonus + tagBonus + counterpickScore + teamCompScore + urgencyBonus;

      if (score > bestScore) {
        bestScore = score;
        bestChampId = champ.id;
        bestPosition = pos;
      }
    }
  }

  // 풀에서 못 찾으면 해당 포지션 S/A/B 티어 챔피언 중 아무거나 (DB 티어 기반)
  if (!bestChampId) {
    const fallbackPos = sortedRemaining[0] ?? 'mid';
    const available = allChampions.filter(c => {
      const currentTier = tierMap.get(c.id) ?? c.tier;
      return c.primaryRole === fallbackPos
        && (currentTier === 'S' || currentTier === 'A' || currentTier === 'B')
        && isChampionAvailable(state, c.id);
    });
    bestChampId = available.length > 0 ? pickRandom(available).id : 'aatrox';
    bestPosition = fallbackPos;
  }

  return { championId: bestChampId, position: bestPosition };
}

/**
 * AI 팀 정보 생성 (DB 데이터 기반)
 * 각 포지션 선수의 챔피언 풀을 DraftTeamInfo로 변환
 */
export function buildDraftTeamInfo(
  players: { position: Position; championPool: ChampionProficiency[] }[],
  preferredTags: string[] = [],
): DraftTeamInfo {
  const playerPools: Record<Position, ChampionProficiency[]> = {
    top: [],
    jungle: [],
    mid: [],
    adc: [],
    support: [],
  };

  for (const player of players) {
    playerPools[player.position] = player.championPool;
  }

  return { playerPools, preferredTags };
}

/** 이전 세트 분석 결과 (세트간 밴픽 적응용) */
export interface PreviousGameAnalysis {
  /** 이전 세트에서 캐리한 상대 포지션 */
  enemyCarryPositions: Position[];
  /** 이전 세트에서 상대가 사용한 핵심 챔피언 (높은 KDA) */
  enemyKeyChampions: string[];
  /** 이전 세트 승패 */
  previousResults: ('win' | 'loss')[];
}

/**
 * 전체 드래프트를 AI끼리 자동 완료
 * (타 팀 경기 시뮬레이션용)
 * @param prevAnalysis 이전 세트 분석 (세트간 밴픽 적응)
 */
export async function autoCompleteDraft(
  blueInfo: DraftTeamInfo,
  redInfo: DraftTeamInfo,
  allChampions: Champion[],
  fearlessMode = false,
  fearlessPool?: Record<'blue' | 'red', string[]>,
  prevAnalysis?: { blue?: PreviousGameAnalysis; red?: PreviousGameAnalysis },
): Promise<DraftState> {
  const state = createDraftState(fearlessMode, fearlessPool);
  const maxIterations = DRAFT_ORDER.length + 1;
  let iterations = 0;

  while (!state.isComplete && iterations < maxIterations) {
    iterations++;
    const step = DRAFT_ORDER[state.currentStep];
    if (!step) break;

    if (step.type === 'ban') {
      const opponentInfo = step.side === 'blue' ? redInfo : blueInfo;
      // 이전 세트 분석 기반 밴 우선순위 조정
      const analysis = step.side === 'blue' ? prevAnalysis?.blue : prevAnalysis?.red;
      const champId = await aiSelectBanAdaptive(state, opponentInfo, allChampions, analysis);
      const success = executeDraftAction(state, champId);
      if (!success) break;
    } else {
      const teamInfo = step.side === 'blue' ? blueInfo : redInfo;
      const { championId, position } = await aiSelectPick(state, step.side, teamInfo, allChampions);
      const success = executeDraftAction(state, championId, position);
      if (!success) break;
    }
  }

  return state;
}

/**
 * 이전 세트 분석을 반영한 적응형 밴 선택
 * 상대가 이전 세트에서 캐리한 챔피언을 우선 밴
 */
async function aiSelectBanAdaptive(
  state: DraftState,
  opponentInfo: DraftTeamInfo,
  allChampions: Champion[],
  analysis?: PreviousGameAnalysis,
): Promise<string> {
  // 이전 세트 데이터가 없으면 기본 밴
  if (!analysis || analysis.enemyKeyChampions.length === 0) {
    return aiSelectBan(state, opponentInfo, allChampions);
  }

  // 이전 세트에서 상대가 캐리한 챔피언 우선 밴
  for (const champId of analysis.enemyKeyChampions) {
    if (isChampionAvailable(state, champId)) {
      return champId;
    }
  }

  // 이전 세트 캐리 포지션의 챔피언풀 우선 밴
  for (const pos of analysis.enemyCarryPositions) {
    const pool = opponentInfo.playerPools[pos] ?? [];
    const sorted = [...pool].sort((a, b) => b.proficiency - a.proficiency);
    for (const cp of sorted) {
      if (isChampionAvailable(state, cp.championId)) {
        return cp.championId;
      }
    }
  }

  // 폴백: 기본 밴
  return aiSelectBan(state, opponentInfo, allChampions);
}

/**
 * 유저(감독 모드)에게 추천할 밴 목록
 * 상대 핵심 챔피언 + 현재 메타 S티어 위주
 */
export function getRecommendedBans(
  state: DraftState,
  opponentInfo: DraftTeamInfo,
  allChampions: Champion[],
  count = 5,
): { championId: string; reason: string }[] {
  const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
  const candidates: { championId: string; score: number; reason: string }[] = [];

  // 상대팀 숙련도 높은 챔피언
  for (const pos of positions) {
    const pool = opponentInfo.playerPools[pos] ?? [];
    for (const cp of pool) {
      if (!isChampionAvailable(state, cp.championId)) continue;
      const champ = allChampions.find(c => c.id === cp.championId);
      if (!champ) continue;

      const tierBonus = champ.tier === 'S' ? 25 : champ.tier === 'A' ? 12 : 0;
      const score = cp.proficiency + tierBonus;
      candidates.push({
        championId: cp.championId,
        score,
        reason: `상대 ${pos} 핵심 챔피언 (숙련도 ${cp.proficiency})`,
      });
    }
  }

  // S 티어 메타 챔피언
  for (const champ of allChampions) {
    if (champ.tier !== 'S') continue;
    if (!isChampionAvailable(state, champ.id)) continue;
    if (candidates.some(c => c.championId === champ.id)) continue;

    candidates.push({
      championId: champ.id,
      score: 80,
      reason: `S 티어 메타 챔피언`,
    });
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(c => ({ championId: c.championId, reason: c.reason }));
}

// ─────────────────────────────────────────
// 카운터픽 & 팀 시너지 평가
// ─────────────────────────────────────────

/**
 * 카운터픽 점수: 상대 이미 픽한 챔피언에 대한 상성
 */
function calculateCounterpickScore(
  championId: string,
  opponentPicks: string[],
  synergyData: ChampionSynergy[],
): number {
  let score = 0;
  for (const oppChamp of opponentPicks) {
    const synergy = synergyData.find(
      s => (s.championA === championId && s.championB === oppChamp) ||
           (s.championB === championId && s.championA === oppChamp),
    );
    if (synergy) {
      // 양수 시너지 = 우리 챔피언이 유리, 음수 = 불리
      const val = synergy.championA === championId ? synergy.synergy : -synergy.synergy;
      score += val * 0.1; // ±100 → ±10 점수
    }
  }
  return score;
}

/**
 * 팀 구성 점수: 부족한 역할 채우기
 */
function evaluateTeamCompScore(
  candidateChamp: Champion,
  currentPicks: { championId: string; position: Position }[],
  allChampions: Champion[],
): number {
  let score = 0;
  const currentTags = new Set<string>();
  for (const pick of currentPicks) {
    const champ = allChampions.find(c => c.id === pick.championId);
    if (champ) champ.tags.forEach(t => currentTags.add(t));
  }

  // 이니시에이터/탱커 부족 시 보너스
  if (!currentTags.has('engage') && !currentTags.has('tank')) {
    if (candidateChamp.tags.includes('engage')) score += 8;
    if (candidateChamp.tags.includes('tank')) score += 6;
  }

  // 딜 타입 다양성 (마법사/원거리 균형)
  const hasMage = currentPicks.some(p => {
    const c = allChampions.find(ch => ch.id === p.championId);
    return c?.tags.includes('mage');
  });
  const hasMarksman = currentPicks.some(p => {
    const c = allChampions.find(ch => ch.id === p.championId);
    return c?.tags.includes('marksman');
  });

  if (!hasMage && candidateChamp.tags.includes('mage')) score += 5;
  if (!hasMarksman && candidateChamp.tags.includes('marksman')) score += 3;

  // 한타 시너지
  if (candidateChamp.tags.includes('teamfight') && currentTags.has('engage')) score += 4;

  return score;
}

/**
 * 유저(감독 모드)에게 추천할 픽 목록
 */
export function getRecommendedPicks(
  state: DraftState,
  side: 'blue' | 'red',
  teamInfo: DraftTeamInfo,
  allChampions: Champion[],
  count = 5,
): { championId: string; position: Position; reason: string }[] {
  const teamState = side === 'blue' ? state.blue : state.red;
  const pickedPositions = new Set(teamState.picks.map(p => p.position));
  const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
  const remaining = positions.filter(p => !pickedPositions.has(p));

  const candidates: { championId: string; position: Position; score: number; reason: string }[] = [];

  for (const pos of remaining) {
    const pool = teamInfo.playerPools[pos] ?? [];
    for (const cp of pool) {
      if (!isChampionAvailable(state, cp.championId)) continue;
      const champ = allChampions.find(c => c.id === cp.championId);
      if (!champ) continue;

      const tierBonus = champ.tier === 'S' ? 15 : champ.tier === 'A' ? 8 : 0;
      const score = cp.proficiency + tierBonus;
      candidates.push({
        championId: cp.championId,
        position: pos,
        score,
        reason: `${pos} 숙련도 ${cp.proficiency} (${champ.nameKo})`,
      });
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(c => ({ championId: c.championId, position: c.position, reason: c.reason }));
}
