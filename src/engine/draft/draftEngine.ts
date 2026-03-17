/**
 * 밴픽(드래프트) 엔진
 * - LoL 프로 리그 규칙: 5밴 5픽 × 2페이즈
 * - 감독 모드: 유저가 직접 밴/픽
 * - 선수 모드: AI 감독이 밴/픽, 유저는 추천 가능
 * - AI 팀: 전력/메타/챔피언 풀 기반 자동 밴/픽
 */

import type { Position } from '../../types/game';
import type { Champion } from '../../types/champion';
import type { ChampionProficiency } from '../../types/player';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

/** 드래프트 페이즈 */
export type DraftPhase = 'ban1' | 'pick1' | 'ban2' | 'pick2' | 'complete';

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
    // pick에는 포지션 필요
    if (!position) return false;
    teamState.picks.push({ championId, position });
    state.pickedChampions.push(championId);
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
    state.isComplete = true;
    state.phase = 'complete';
  } else {
    const next = DRAFT_ORDER[state.currentStep];
    state.phase = next.phase;
    state.currentSide = next.side;
    state.currentActionType = next.type;
  }

  return true;
}

// ─────────────────────────────────────────
// AI 밴픽 로직
// ─────────────────────────────────────────

/**
 * AI의 밴 선택
 * 상대팀 핵심 챔피언 (높은 숙련도) 위주로 밴
 */
export function aiSelectBan(
  state: DraftState,
  opponentInfo: DraftTeamInfo,
  allChampions: Champion[],
): string {
  // 상대팀 전체 챔피언 풀에서 숙련도 높은 순으로 정렬
  const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
  const candidateMap = new Map<string, number>();

  for (const pos of positions) {
    const pool = opponentInfo.playerPools[pos] ?? [];
    for (const cp of pool) {
      if (!isChampionAvailable(state, cp.championId)) continue;
      const champ = allChampions.find(c => c.id === cp.championId);
      if (!champ) continue;

      // 점수 = 숙련도 + 티어 보너스
      const tierBonus = champ.tier === 'S' ? 20 : champ.tier === 'A' ? 10 : 0;
      const score = cp.proficiency + tierBonus;
      const existing = candidateMap.get(cp.championId) ?? 0;
      candidateMap.set(cp.championId, Math.max(existing, score));
    }
  }

  // 점수 높은 순 정렬
  const sorted = [...candidateMap.entries()].sort((a, b) => b[1] - a[1]);

  // 최상위 챔피언 밴 (약간의 랜덤성)
  if (sorted.length === 0) {
    // 풀이 없으면 S/A 티어 챔피언 중 랜덤 밴
    const highTier = allChampions.filter(
      c => (c.tier === 'S' || c.tier === 'A') && isChampionAvailable(state, c.id),
    );
    return highTier[Math.floor(Math.random() * highTier.length)]?.id ?? 'aatrox';
  }

  // 상위 3개 중 랜덤 (예측 불가능성)
  const topN = sorted.slice(0, Math.min(3, sorted.length));
  const pick = topN[Math.floor(Math.random() * topN.length)];
  return pick[0];
}

/**
 * AI의 픽 선택
 * 아직 픽하지 않은 포지션 중 필요한 포지션의 최적 챔피언 선택
 */
export function aiSelectPick(
  state: DraftState,
  side: 'blue' | 'red',
  teamInfo: DraftTeamInfo,
  allChampions: Champion[],
): { championId: string; position: Position } {
  const teamState = side === 'blue' ? state.blue : state.red;
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

  for (const pos of sortedRemaining) {
    const pool = teamInfo.playerPools[pos] ?? [];

    for (const cp of pool) {
      if (!isChampionAvailable(state, cp.championId)) continue;
      const champ = allChampions.find(c => c.id === cp.championId);
      if (!champ) continue;

      // 점수 = 숙련도 + 티어 보너스 + 팀 선호 태그 매칭
      const tierBonus = champ.tier === 'S' ? 15 : champ.tier === 'A' ? 8 : 0;
      const tagBonus = champ.tags.some(t => teamInfo.preferredTags.includes(t)) ? 5 : 0;
      const score = cp.proficiency + tierBonus + tagBonus;

      if (score > bestScore) {
        bestScore = score;
        bestChampId = champ.id;
        bestPosition = pos;
      }
    }
  }

  // 풀에서 못 찾으면 해당 포지션 S/A 티어 챔피언 중 아무거나
  if (!bestChampId) {
    const fallbackPos = sortedRemaining[0] ?? 'mid';
    const available = allChampions.filter(
      c => c.primaryRole === fallbackPos
        && (c.tier === 'S' || c.tier === 'A' || c.tier === 'B')
        && isChampionAvailable(state, c.id),
    );
    bestChampId = available[Math.floor(Math.random() * available.length)]?.id ?? 'aatrox';
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

/**
 * 전체 드래프트를 AI끼리 자동 완료
 * (타 팀 경기 시뮬레이션용)
 */
export function autoCompleteDraft(
  blueInfo: DraftTeamInfo,
  redInfo: DraftTeamInfo,
  allChampions: Champion[],
): DraftState {
  const state = createDraftState();
  const maxIterations = DRAFT_ORDER.length + 1;
  let iterations = 0;

  while (!state.isComplete && iterations < maxIterations) {
    iterations++;
    const step = DRAFT_ORDER[state.currentStep];
    if (!step) break;

    if (step.type === 'ban') {
      const opponentInfo = step.side === 'blue' ? redInfo : blueInfo;
      const champId = aiSelectBan(state, opponentInfo, allChampions);
      const success = executeDraftAction(state, champId);
      if (!success) break;
    } else {
      const teamInfo = step.side === 'blue' ? blueInfo : redInfo;
      const { championId, position } = aiSelectPick(state, step.side, teamInfo, allChampions);
      const success = executeDraftAction(state, championId, position);
      if (!success) break;
    }
  }

  return state;
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
