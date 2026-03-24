/**
 * 하이라이트/리플레이 시스템
 * - 경기에서 발생한 이벤트 중 주요 장면을 하이라이트로 추출
 * - 시즌 베스트 플레이 선정
 * - 경기 후 하이라이트 리플레이 데이터 생성
 */

import type { MatchEvent, MatchEventType } from '../../types/match';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

/** 하이라이트 중요도 */
export type HighlightImportance = 'legendary' | 'major' | 'minor';

/** 하이라이트 항목 */
export interface Highlight {
  /** 경기 ID */
  matchId: string;
  /** 게임 번호 (Bo3/Bo5에서) */
  gameNumber: number;
  /** 원본 이벤트 */
  event: MatchEvent;
  /** 하이라이트 중요도 */
  importance: HighlightImportance;
  /** 한국어 해설 텍스트 */
  commentary: string;
  /** 연관 선수 이름 */
  involvedPlayers: string[];
  /** 골드 변동 영향 */
  goldImpact: number;
}

/** 경기 하이라이트 모음 */
export interface MatchHighlights {
  matchId: string;
  highlights: Highlight[];
  /** MVP 후보 (가장 많이 하이라이트에 등장한 선수) */
  mvpCandidate: string | null;
  /** 경기 전환점 (가장 큰 골드 변동 이벤트) */
  turningPoint: Highlight | null;
}

/** 시즌 베스트 플레이 */
export interface SeasonBestPlay {
  matchId: string;
  gameNumber: number;
  highlight: Highlight;
  /** 추가 설명 */
  narrativeNote: string;
}

// ─────────────────────────────────────────
// 이벤트 중요도 판정
// ─────────────────────────────────────────

/** 이벤트 유형별 기본 중요도 점수 */
const EVENT_IMPORTANCE_SCORE: Record<MatchEventType, number> = {
  kill: 3,
  tower_destroy: 4,
  dragon: 5,
  baron: 8,
  teamfight: 7,
  gank: 3,
  lane_swap: 1,
  solo_kill: 5,
  dive: 4,
  invade: 4,
  steal: 9,
  ace: 10,
  pentakill: 10,
  backdoor: 10,
  elder_dragon: 9,
  rift_herald: 5,
  void_grub: 3,
  base_race: 8,
};

/**
 * 이벤트의 하이라이트 중요도 판정
 */
function evaluateImportance(event: MatchEvent, gameMinute: number): HighlightImportance {
  const baseScore = EVENT_IMPORTANCE_SCORE[event.type] ?? 2;

  // 후반(25분 이후) 이벤트는 중요도 상승
  const timeMod = gameMinute >= 30 ? 2 : gameMinute >= 25 ? 1 : 0;

  // 골드 변동이 큰 이벤트 중요도 상승
  const goldMod = Math.abs(event.goldChange) >= 2000 ? 2 : Math.abs(event.goldChange) >= 1000 ? 1 : 0;

  const totalScore = baseScore + timeMod + goldMod;

  if (totalScore >= 9) return 'legendary';
  if (totalScore >= 6) return 'major';
  return 'minor';
}

// ─────────────────────────────────────────
// 하이라이트 해설 생성
// ─────────────────────────────────────────

const COMMENTARY_TEMPLATES: Record<MatchEventType, string[]> = {
  kill: ['{player}의 결정적인 킬!', '{player}가 상대를 처치합니다!'],
  tower_destroy: ['타워가 무너집니다! {side}팀이 맵 장악력을 높입니다.'],
  dragon: ['{side}팀이 드래곤을 획득! 오브젝트 장악 성공.'],
  baron: ['바론 내셔! {side}팀이 바론을 가져갑니다! 게임이 흔들립니다!'],
  teamfight: ['대규모 한타 발생! {side}팀이 승리합니다!', '치열한 한타! 양쪽 모두 피해가 큽니다.'],
  gank: ['{player}의 갱킹! 라인전의 흐름이 바뀝니다.'],
  lane_swap: ['라인 스왑이 발생합니다.'],
  solo_kill: ['{player}의 솔로킬! 라인전에서 압도적인 실력 차이를 보여줍니다!'],
  dive: ['{side}팀의 과감한 다이브! 타워 아래서 킬을 따냅니다!'],
  invade: ['{side}팀이 상대 정글을 침공합니다!'],
  steal: ['스틸! {player}가 오브젝트를 빼앗습니다! 관중이 폭발합니다!'],
  ace: ['에이스! {side}팀 전원 처치! 게임이 끝날 수도 있습니다!'],
  pentakill: ['펜타킬!!! {player}의 펜타킬!! 역사적인 순간입니다!!'],
  backdoor: ['백도어! {side}팀이 기지를 직접 공격합니다!'],
  elder_dragon: ['장로 드래곤 획득! {side}팀이 최종 버프를 얻습니다!'],
  rift_herald: ['{side}팀이 협곡의 전령을 처치합니다!'],
  void_grub: ['{side}팀이 공허 유충을 처치합니다.'],
  base_race: ['베이스 레이스! 양 팀이 기지를 동시에 공격합니다!'],
};

function generateCommentary(event: MatchEvent, playerNames: Record<string, string>): string {
  const templates = COMMENTARY_TEMPLATES[event.type] ?? ['{side}팀의 중요한 플레이!'];
  const template = templates[Math.floor(Math.random() * templates.length)];

  const playerName = event.playerId ? (playerNames[event.playerId] ?? event.playerId) : '선수';
  const side = event.side === 'home' ? '블루' : '레드';

  return template.replace('{player}', playerName).replace('{side}', side);
}

// ─────────────────────────────────────────
// 하이라이트 추출
// ─────────────────────────────────────────

/**
 * 한 게임의 이벤트에서 하이라이트 추출
 * major 이상의 이벤트만 선별 (최대 10개)
 */
export function extractHighlights(
  matchId: string,
  gameNumber: number,
  events: MatchEvent[],
  playerNames: Record<string, string>,
): Highlight[] {
  const highlights: Highlight[] = [];

  for (const event of events) {
    const gameMinute = Math.floor(event.tick / 60);
    const importance = evaluateImportance(event, gameMinute);

    if (importance === 'minor') continue;

    const involvedPlayers: string[] = [];
    if (event.playerId) involvedPlayers.push(playerNames[event.playerId] ?? event.playerId);
    if (event.targetPlayerId) involvedPlayers.push(playerNames[event.targetPlayerId] ?? event.targetPlayerId);

    highlights.push({
      matchId,
      gameNumber,
      event,
      importance,
      commentary: generateCommentary(event, playerNames),
      involvedPlayers,
      goldImpact: event.goldChange,
    });
  }

  // 중요도순 정렬, 최대 10개
  return highlights
    .sort((a, b) => {
      const impOrder: Record<HighlightImportance, number> = { legendary: 3, major: 2, minor: 1 };
      return impOrder[b.importance] - impOrder[a.importance];
    })
    .slice(0, 10);
}

/**
 * 전체 시리즈의 하이라이트 종합
 */
export function compileMatchHighlights(
  matchId: string,
  gameHighlights: Highlight[][],
): MatchHighlights {
  const allHighlights = gameHighlights.flat();

  // MVP 후보: 가장 많이 등장한 선수
  const playerAppearances = new Map<string, number>();
  for (const h of allHighlights) {
    for (const player of h.involvedPlayers) {
      playerAppearances.set(player, (playerAppearances.get(player) ?? 0) + 1);
    }
  }

  let mvpCandidate: string | null = null;
  let maxAppearances = 0;
  for (const [player, count] of playerAppearances) {
    if (count > maxAppearances) {
      maxAppearances = count;
      mvpCandidate = player;
    }
  }

  // 전환점: 가장 큰 골드 변동
  const turningPoint = allHighlights.reduce<Highlight | null>((best, h) => {
    if (!best || Math.abs(h.goldImpact) > Math.abs(best.goldImpact)) return h;
    return best;
  }, null);

  return {
    matchId,
    highlights: allHighlights,
    mvpCandidate,
    turningPoint,
  };
}

/**
 * 시즌 베스트 플레이 선정 (legendary 하이라이트 중 상위 5개)
 */
export function selectSeasonBestPlays(
  allMatchHighlights: MatchHighlights[],
  count = 5,
): SeasonBestPlay[] {
  const legendaryPlays: { matchId: string; highlight: Highlight }[] = [];

  for (const match of allMatchHighlights) {
    for (const h of match.highlights) {
      if (h.importance === 'legendary') {
        legendaryPlays.push({ matchId: match.matchId, highlight: h });
      }
    }
  }

  // 골드 임팩트 순으로 정렬
  legendaryPlays.sort((a, b) => Math.abs(b.highlight.goldImpact) - Math.abs(a.highlight.goldImpact));

  return legendaryPlays.slice(0, count).map((p) => ({
    matchId: p.matchId,
    gameNumber: p.highlight.gameNumber,
    highlight: p.highlight,
    narrativeNote: `${p.highlight.involvedPlayers.join(', ')}의 ${p.highlight.event.type} — ${p.highlight.commentary}`,
  }));
}
