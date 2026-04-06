import { MATCH_CONSTANTS } from '../../data/systemPrompt';
import type { Position } from '../../types/game';
import type { MatchEvent, MatchEventType, MatchZone, DragonType, DragonSoulState } from '../../types/match';
import type { PlayStyle } from '../../types/team';
import { type Lineup, type MatchupResult, evaluateMatchup } from './teamRating';
import type { PlayerGameStatLine } from './matchSimulator';
import type { DraftState } from '../draft/draftEngine';
import { createRng } from '../../utils/rng';

const POSITIONS: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
const DRAGON_TYPES: DragonType[] = ['infernal', 'ocean', 'mountain', 'cloud'];

const ZONE_POINTS: Record<MatchZone, { x: number; y: number }> = {
  home_base: { x: 0.12, y: 0.88 },
  away_base: { x: 0.88, y: 0.12 },
  top_lane: { x: 0.24, y: 0.14 },
  mid_lane: { x: 0.5, y: 0.5 },
  bot_lane: { x: 0.76, y: 0.86 },
  top_river: { x: 0.35, y: 0.26 },
  mid_river: { x: 0.5, y: 0.5 },
  bot_river: { x: 0.65, y: 0.74 },
  home_jungle: { x: 0.3, y: 0.7 },
  away_jungle: { x: 0.7, y: 0.3 },
  dragon_pit: { x: 0.62, y: 0.67 },
  baron_pit: { x: 0.38, y: 0.33 },
  center: { x: 0.5, y: 0.5 },
};

const PHASE_DEFAULT_ZONES: Record<Position, MatchZone> = {
  top: 'top_lane',
  jungle: 'home_jungle',
  mid: 'mid_lane',
  adc: 'bot_lane',
  support: 'bot_lane',
};

const COMMENTARY_SNIPPETS: Record<MatchEventType, string[]> = {
  kill: ['깔끔하게 끊어냈습니다.', '짧은 교전을 이겨냈습니다.', '상대의 빈틈을 정확히 찔렀습니다.'],
  tower_destroy: ['포탑을 밀며 맵을 열어냈습니다.', '압박을 포탑으로 바꿨습니다.', '공성 흐름을 이어갑니다.'],
  dragon: ['드래곤 주도권을 잡았습니다.', '강가 시야 싸움을 이겼습니다.', '세팅을 오브젝트로 연결했습니다.'],
  baron: ['바론을 확보했습니다.', '상단 주도권을 장악했습니다.', '바론 줄다리기에서 승리했습니다.'],
  teamfight: ['한타를 완승했습니다.', '정면 승부를 깔끔하게 받아냈습니다.', '교전 후 재정비까지 완벽합니다.'],
  gank: ['로밍을 득점으로 연결했습니다.', '합류 타이밍이 절묘했습니다.', '갱킹 타이밍을 정확히 잡았습니다.'],
  lane_swap: ['라인 구도를 다시 짰습니다.', '먼저 맵을 흔들기 시작합니다.', '매치업 구도를 바꿔냈습니다.'],
  solo_kill: ['솔로킬을 만들어냈습니다.', '라인전에서 개인 기량이 터졌습니다.', '1대1 구도를 이겨냈습니다.'],
  dive: ['과감한 다이브를 성공시켰습니다.', '포탑 아래까지 압박합니다.', '다이브 타이밍을 완벽히 읽었습니다.'],
  invade: ['상대 정글을 흔들어 놓습니다.', '인베이드 싸움을 이겨냈습니다.', '시야와 템포를 함께 가져갑니다.'],
  elder_dragon: ['장로를 가져오며 끝낼 힘을 얻었습니다.', '엘더 세팅 싸움에서 승리했습니다.', '장로와 함께 판을 뒤집습니다.'],
  rift_herald: ['전령 압박을 준비합니다.', '전령을 깔끔하게 챙깁니다.', '전령으로 템포를 당겨옵니다.'],
  void_grub: ['공허 유충을 쓸어 담습니다.', '그럽 세팅을 가져갑니다.', '초반 오브젝트 스택을 쌓습니다.'],
  ace: ['에이스를 띄웠습니다.', '상대 전원을 정리했습니다.', '완벽한 전멸을 만들어냅니다.'],
  base_race: ['팽팽한 넥서스 레이스가 시작됩니다.', '마지막 교환을 강제합니다.', '엔딩이 혼전으로 흘러갑니다.'],
  backdoor: ['백도어 엔딩을 노립니다.', '빈 틈으로 넥서스를 두드립니다.', '측면 침투로 끝내기 각을 봅니다.'],
  steal: ['오브젝트를 강탈했습니다.', '세팅을 한순간에 무너뜨렸습니다.', '막판 한 끗으로 빼앗아 냈습니다.'],
  pentakill: ['펜타킬급 마무리를 보여줍니다.', '끝까지 전부 정리합니다.', '교전의 시작부터 끝까지 지배했습니다.'],
};

export type GamePhase = 'loading' | 'laning' | 'mid_game' | 'late_game' | 'finished';

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  effect: {
    winRateMod: number;
    goldMod: number;
    moraleMod: number;
    riskFactor: number;
  };
}

export interface Decision {
  id: string;
  tick: number;
  phase: GamePhase;
  situation: string;
  mode: 'manager' | 'player';
  options: DecisionOption[];
  selectedOptionId?: string;
  resolved: boolean;
}

export interface Commentary {
  tick: number;
  message: string;
  type: 'info' | 'kill' | 'objective' | 'teamfight' | 'decision' | 'highlight';
}

export interface LivePlayerStat {
  playerId: string;
  playerName: string;
  position: Position;
  championId?: string;
  form: number;
  comfortPick: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  goldEarned: number;
  damageDealt: number;
}

export interface PlayerMapState {
  playerId: string;
  side: 'home' | 'away';
  position: Position;
  zone: MatchZone;
  x: number;
  y: number;
  activity: 'laning' | 'rotating' | 'farming' | 'objective' | 'teamfight' | 'reset';
  highlight: boolean;
}

export interface ObjectiveState {
  key: 'dragon' | 'baron' | 'herald';
  zone: MatchZone;
  status: 'up' | 'respawning' | 'secured';
  controlledBy?: 'home' | 'away';
  nextSpawnTick?: number;
}

export interface FocusEventSummary {
  eventType: MatchEventType;
  side: 'home' | 'away';
  label: string;
  detail: string;
  zone: MatchZone;
  tick: number;
}

export interface LiveGameState {
  currentTick: number;
  maxTick: number;
  phase: GamePhase;
  goldHome: number;
  goldAway: number;
  killsHome: number;
  killsAway: number;
  towersHome: number;
  towersAway: number;
  dragonsHome: number;
  dragonsAway: number;
  baronHome: boolean;
  baronAway: boolean;
  grubsHome: number;
  grubsAway: number;
  dragonSoul: DragonSoulState;
  currentWinRate: number;
  events: MatchEvent[];
  commentary: Commentary[];
  pendingDecision: Decision | null;
  resolvedDecisions: Decision[];
  playerStatsHome: LivePlayerStat[];
  playerStatsAway: LivePlayerStat[];
  goldHistory: { tick: number; diff: number }[];
  playerMapStates: PlayerMapState[];
  objectiveStates: ObjectiveState[];
  focusEvent: FocusEventSummary | null;
  cameraZone: MatchZone;
  isFinished: boolean;
  winner?: 'home' | 'away';
}

export type PlayerInstructionType = 'aggressive' | 'safe' | 'roam' | 'lane_focus';

export interface PlayerInstruction {
  playerId: string;
  instruction: PlayerInstructionType;
}

export const PLAYER_INSTRUCTION_LABELS: Record<PlayerInstructionType, string> = {
  aggressive: '공격 지향',
  safe: '안전 운영',
  roam: '로밍 우선',
  lane_focus: '라인 집중',
};

export const PLAYER_INSTRUCTION_DESCRIPTIONS: Record<PlayerInstructionType, string> = {
  aggressive: '킬 압박은 커지지만 리스크도 함께 커집니다.',
  safe: '리스크를 줄이고 라인을 안정화합니다.',
  roam: '먼저 움직이며 맵 영향력을 높입니다.',
  lane_focus: '라인에 남아 성장 템포를 챙깁니다.',
};

export type InGamePlayStyle = 'aggressive' | 'controlled' | 'split';
export type ObjectivePriority = 'dragon' | 'baron' | 'balanced';
export type TeamfightAggression = 'engage' | 'avoid' | 'situational';

export interface InGameTactics {
  playStyle: InGamePlayStyle;
  objectivePriority: ObjectivePriority;
  teamfightAggression: TeamfightAggression;
}

function sideLabel(side: 'home' | 'away'): string {
  return side === 'home' ? '블루' : '레드';
}

function positionZone(position: Position, side: 'home' | 'away'): MatchZone {
  if (position === 'jungle') {
    return side === 'home' ? 'home_jungle' : 'away_jungle';
  }
  return PHASE_DEFAULT_ZONES[position];
}

function toEventType(phase: GamePhase, objective = false): MatchEventType {
  if (objective) return phase === 'late_game' ? 'baron' : 'dragon';
  return phase === 'late_game' ? 'teamfight' : phase === 'mid_game' ? 'gank' : 'solo_kill';
}

function cloneStats(stats: LivePlayerStat[]): PlayerGameStatLine[] {
  return stats.map((stat) => ({ ...stat }));
}

function calculateDraftBonus(teamDraft: DraftState['blue'] | DraftState['red'] | undefined): number {
  if (!teamDraft) return 0;
  return teamDraft.picks.length * 0.0025;
}

function getDraftChampionId(
  draftSide: DraftState['blue'] | DraftState['red'] | undefined,
  position: Position,
): string | undefined {
  return draftSide?.picks.find((pick) => pick.position === position)?.championId;
}

function zoneName(zone: MatchZone): string {
  const labels: Record<MatchZone, string> = {
    home_base: '블루 본진',
    away_base: '레드 본진',
    top_lane: '탑 라인',
    mid_lane: '미드 라인',
    bot_lane: '봇 라인',
    top_river: '상단 강가',
    mid_river: '중앙 강가',
    bot_river: '하단 강가',
    home_jungle: '블루 정글',
    away_jungle: '레드 정글',
    dragon_pit: '드래곤 둥지',
    baron_pit: '바론 둥지',
    center: '중앙',
  };
  return labels[zone];
}

function playStyleLabel(style: InGamePlayStyle): string {
  const labels: Record<InGamePlayStyle, string> = {
    aggressive: '공격적',
    controlled: '안정',
    split: '스플릿',
  };
  return labels[style];
}

function objectivePriorityLabel(priority: ObjectivePriority): string {
  const labels: Record<ObjectivePriority, string> = {
    dragon: '드래곤 중시',
    baron: '바론 중시',
    balanced: '균형',
  };
  return labels[priority];
}

function teamfightAggressionLabel(aggression: TeamfightAggression): string {
  const labels: Record<TeamfightAggression, string> = {
    engage: '적극 교전',
    avoid: '교전 회피',
    situational: '상황 대응',
  };
  return labels[aggression];
}

function eventTypeLabel(type: MatchEventType): string {
  const labels: Record<MatchEventType, string> = {
    kill: '킬',
    tower_destroy: '포탑 파괴',
    dragon: '드래곤',
    baron: '바론',
    teamfight: '한타',
    gank: '갱킹',
    lane_swap: '라인 스왑',
    solo_kill: '솔로킬',
    dive: '다이브',
    invade: '인베이드',
    elder_dragon: '장로 드래곤',
    rift_herald: '전령',
    void_grub: '공허 유충',
    ace: '에이스',
    base_race: '넥서스 레이스',
    backdoor: '백도어',
    steal: '스틸',
    pentakill: '펜타킬',
  };
  return labels[type];
}

export class LiveMatchEngine {
  private state: LiveGameState;
  private matchup: MatchupResult;
  private rand: () => number;
  private gameMode: 'manager' | 'player';
  private homePlayStyle: PlayStyle;
  private awayPlayStyle: PlayStyle;
  private playerInstructions = new Map<string, PlayerInstructionType>();
  private inGameTactics: InGameTactics = {
    playStyle: 'controlled',
    objectivePriority: 'balanced',
    teamfightAggression: 'situational',
  };
  private tacticsCooldown = 0;
  private usedCoachVoice = 0;
  private readonly maxCoachVoice = 3;
  private readonly decisionTicks = { laning: [10], midGame: [20], lateGame: [30] };
  private readonly dragonSchedule = [12, 17, 22, 27];
  private readonly heraldSchedule = [14];
  private readonly baronSchedule = [25, 31];
  private elderTaken = false;

  constructor(params: {
    homeLineup: Lineup;
    awayLineup: Lineup;
    homeTraits?: Record<string, string[]>;
    awayTraits?: Record<string, string[]>;
    homeForm?: Record<string, number>;
    awayForm?: Record<string, number>;
    seed: string;
    gameMode: 'manager' | 'player';
    userPosition?: Position;
    durationMinutes?: number;
    draftResult?: DraftState | null;
    homePlayStyle?: PlayStyle;
    awayPlayStyle?: PlayStyle;
    homeExtraBonus?: number;
    awayExtraBonus?: number;
  }) {
    this.homePlayStyle = params.homePlayStyle ?? 'controlled';
    this.awayPlayStyle = params.awayPlayStyle ?? 'controlled';
    this.matchup = evaluateMatchup(
      params.homeLineup,
      params.awayLineup,
      params.homeTraits ?? {},
      params.awayTraits ?? {},
      params.homeForm ?? {},
      params.awayForm ?? {},
      this.homePlayStyle,
      this.awayPlayStyle,
      undefined,
      undefined,
      undefined,
      undefined,
      params.homeExtraBonus,
      params.awayExtraBonus,
    );

    if (params.draftResult) {
      this.matchup.homeWinRate += calculateDraftBonus(params.draftResult.blue);
      this.matchup.homeWinRate -= calculateDraftBonus(params.draftResult.red);
    }

    this.rand = createRng(params.seed);
    this.gameMode = params.gameMode;
    const ratingDiff = Math.abs(this.matchup.homeRating.overall - this.matchup.awayRating.overall);
    const baseDuration = params.durationMinutes ?? Math.round(
      MATCH_CONSTANTS.gameDuration.max - ratingDiff * 0.18 + (this.rand() - 0.5) * 6,
    );
    const maxTick = Math.max(MATCH_CONSTANTS.gameDuration.min, Math.min(MATCH_CONSTANTS.gameDuration.max, baseDuration));

    this.state = {
      currentTick: 0,
      maxTick,
      phase: 'loading',
      goldHome: 0,
      goldAway: 0,
      killsHome: 0,
      killsAway: 0,
      towersHome: 0,
      towersAway: 0,
      dragonsHome: 0,
      dragonsAway: 0,
      baronHome: false,
      baronAway: false,
      grubsHome: 0,
      grubsAway: 0,
      dragonSoul: { homeStacks: 0, awayStacks: 0, dragonTypes: [] },
      currentWinRate: Math.max(0.2, Math.min(0.8, this.matchup.homeWinRate)),
      events: [],
      commentary: [],
      pendingDecision: null,
      resolvedDecisions: [],
      playerStatsHome: POSITIONS.map((position) => this.createPlayerStat(
        params.homeLineup[position].id,
        params.homeLineup[position].name,
        position,
        getDraftChampionId(params.draftResult?.blue, position),
        params.homeForm?.[params.homeLineup[position].id] ?? 50,
        [...params.homeLineup[position].championPool]
          .sort((left, right) => right.proficiency - left.proficiency)
          .slice(0, 3)
          .some((entry) => entry.championId === getDraftChampionId(params.draftResult?.blue, position)),
      )),
      playerStatsAway: POSITIONS.map((position) => this.createPlayerStat(
        params.awayLineup[position].id,
        params.awayLineup[position].name,
        position,
        getDraftChampionId(params.draftResult?.red, position),
        params.awayForm?.[params.awayLineup[position].id] ?? 50,
        [...params.awayLineup[position].championPool]
          .sort((left, right) => right.proficiency - left.proficiency)
          .slice(0, 3)
          .some((entry) => entry.championId === getDraftChampionId(params.draftResult?.red, position)),
      )),
      goldHistory: [],
      playerMapStates: [],
      objectiveStates: [],
      focusEvent: null,
      cameraZone: 'mid_lane',
      isFinished: false,
    };

    this.syncSpatialState();
  }

  getState(): Readonly<LiveGameState> {
    return this.state;
  }

  getInGameTactics(): Readonly<InGameTactics> {
    return this.inGameTactics;
  }

  getTacticsCooldown(): number {
    return this.tacticsCooldown;
  }

  getPlayerInstructions(): ReadonlyMap<string, PlayerInstructionType> {
    return this.playerInstructions;
  }

  getRemainingCoachVoice(): number {
    return this.maxCoachVoice - this.usedCoachVoice;
  }

  setPlayerInstruction(playerId: string, instruction: PlayerInstructionType): boolean {
    if (!this.playerInstructions.has(playerId) && this.playerInstructions.size >= 2) {
      return false;
    }

    const bonusMap: Record<PlayerInstructionType, number> = {
      aggressive: 0.02,
      safe: 0.01,
      roam: 0.015,
      lane_focus: 0.008,
    };

    const previous = this.playerInstructions.get(playerId);
    if (previous) {
      this.state.currentWinRate -= bonusMap[previous];
    }
    this.playerInstructions.set(playerId, instruction);
    this.state.currentWinRate = Math.max(0.15, Math.min(0.85, this.state.currentWinRate + bonusMap[instruction]));
    this.addCommentary(this.state.currentTick, `${playerId} 선수가 ${PLAYER_INSTRUCTION_LABELS[instruction]} 지시로 전환했습니다.`, 'decision');
    this.syncSpatialState();
    return true;
  }

  clearPlayerInstruction(playerId: string): void {
    const previous = this.playerInstructions.get(playerId);
    if (!previous) return;
    const bonusMap: Record<PlayerInstructionType, number> = {
      aggressive: 0.02,
      safe: 0.01,
      roam: 0.015,
      lane_focus: 0.008,
    };
    this.playerInstructions.delete(playerId);
    this.state.currentWinRate = Math.max(0.15, Math.min(0.85, this.state.currentWinRate - bonusMap[previous]));
    this.addCommentary(this.state.currentTick, `${playerId} 선수가 기본 지시로 복귀했습니다.`, 'info');
    this.syncSpatialState();
  }

  setInGameTactics(playStyle: InGamePlayStyle, objectivePriority: ObjectivePriority, teamfightAggression: TeamfightAggression): boolean {
    if (this.tacticsCooldown > 0) return false;
    this.inGameTactics = { playStyle, objectivePriority, teamfightAggression };
    this.tacticsCooldown = 5;
    const styleDelta = playStyle === 'aggressive' ? 0.015 : playStyle === 'split' ? 0.01 : 0;
    const objectiveDelta = objectivePriority === 'dragon' ? 0.005 : objectivePriority === 'baron' ? 0.008 : 0;
    this.state.currentWinRate = Math.max(0.15, Math.min(0.85, this.state.currentWinRate + styleDelta + objectiveDelta));
    this.addCommentary(
      this.state.currentTick,
      `전술 변경: ${playStyleLabel(playStyle)}, ${objectivePriorityLabel(objectivePriority)}, ${teamfightAggressionLabel(teamfightAggression)}.`,
      'decision',
    );
    this.syncSpatialState();
    return true;
  }

  resolveDecision(optionId: string): void {
    const decision = this.state.pendingDecision;
    if (!decision) return;
    const option = decision.options.find((entry) => entry.id === optionId) ?? decision.options[0];
    decision.selectedOptionId = option.id;
    decision.resolved = true;
    this.state.pendingDecision = null;
    this.state.resolvedDecisions.push(decision);
    this.state.currentWinRate = Math.max(0.15, Math.min(0.85, this.state.currentWinRate + option.effect.winRateMod));
    if (option.effect.goldMod > 0) this.state.goldHome += option.effect.goldMod;
    if (option.effect.goldMod < 0) this.state.goldAway += Math.abs(option.effect.goldMod);
    this.addCommentary(this.state.currentTick, `${option.label}: ${option.description}`, 'decision');
    this.syncSpatialState();
  }

  advance(): boolean {
    if (this.state.isFinished) return false;
    if (this.state.pendingDecision) return true;

    this.state.currentTick += 1;
    const tick = this.state.currentTick;
    if (this.tacticsCooldown > 0) this.tacticsCooldown -= 1;

    if (tick === 1) {
      this.state.phase = 'laning';
      this.addCommentary(1, '양 팀이 소환사의 협곡에 입장했습니다. 중계 포커스가 시작됩니다.', 'info');
    } else if (tick === MATCH_CONSTANTS.laningPhaseEnd + 1) {
      this.state.phase = 'mid_game';
      this.addCommentary(tick, '맵이 열리기 시작합니다. 이제 로테이션과 중립 오브젝트 세팅이 중요합니다.', 'info');
    } else if (tick === 25) {
      this.state.phase = 'late_game';
      this.addCommentary(tick, '후반 구간입니다. 한 번의 한타가 경기를 끝낼 수 있습니다.', 'highlight');
    }

    this.processEconomy();
    this.processScheduledObjectives(tick);
    this.processSkirmishes(tick);

    const decision = this.checkDecision(tick);
    if (decision) {
      this.state.pendingDecision = decision;
      this.syncSpatialState();
      return true;
    }

    if (tick >= this.state.maxTick) {
      this.finishGame();
      return false;
    }

    this.syncSpatialState();
    return false;
  }

  simulateToEnd(): void {
    while (!this.state.isFinished) {
      const paused = this.advance();
      if (paused && this.state.pendingDecision) {
        this.resolveDecision(this.state.pendingDecision.options[0].id);
      }
    }
  }

  getPlayerStatLines(): { home: PlayerGameStatLine[]; away: PlayerGameStatLine[] } {
    return {
      home: cloneStats(this.state.playerStatsHome),
      away: cloneStats(this.state.playerStatsAway),
    };
  }

  private createPlayerStat(
    playerId: string,
    playerName: string,
    position: Position,
    championId: string | undefined,
    form: number,
    comfortPick: boolean,
  ): LivePlayerStat {
    return {
      playerId,
      playerName,
      position,
      championId,
      form,
      comfortPick,
      kills: 0,
      deaths: 0,
      assists: 0,
      cs: 0,
      goldEarned: 0,
      damageDealt: 0,
    };
  }

  private processEconomy(): void {
    const phaseMultiplier = this.state.phase === 'laning' ? 1 : this.state.phase === 'mid_game' ? 1.2 : 1.45;
    const laneDiff = this.matchup.homeRating.laningPower - this.matchup.awayRating.laningPower;
    const teamfightDiff = this.matchup.homeRating.teamfightPower - this.matchup.awayRating.teamfightPower;
    const goldSwing = Math.round((laneDiff * 7 + teamfightDiff * 4) * 0.5 + (this.rand() - 0.5) * 120);
    const baseTeamGold = Math.round(510 * phaseMultiplier);
    this.state.goldHome += baseTeamGold + Math.max(0, goldSwing);
    this.state.goldAway += baseTeamGold + Math.max(0, -goldSwing);

    this.state.playerStatsHome.forEach((player) => this.addFarmAndDamage(player, 'home', phaseMultiplier));
    this.state.playerStatsAway.forEach((player) => this.addFarmAndDamage(player, 'away', phaseMultiplier));

    this.state.goldHistory.push({
      tick: this.state.currentTick,
      diff: this.state.goldHome - this.state.goldAway,
    });
  }

  private addFarmAndDamage(player: LivePlayerStat, side: 'home' | 'away', phaseMultiplier: number): void {
    const instruction = this.playerInstructions.get(player.playerId);
    const csBonus = instruction === 'lane_focus' ? 1.1 : instruction === 'safe' ? 1.03 : 1;
    const roamPenalty = instruction === 'roam' ? 0.92 : 1;
    const roleFarm = player.position === 'support' ? 2 : player.position === 'jungle' ? 4.5 : player.position === 'adc' ? 8.5 : 7.2;
    const csGain = Math.round(roleFarm * phaseMultiplier * csBonus * roamPenalty + this.rand() * 2);
    player.cs += csGain;
    player.goldEarned += csGain * 18 + 90;
    player.damageDealt += Math.round((player.position === 'adc' ? 320 : player.position === 'mid' ? 290 : 220) * phaseMultiplier + this.rand() * 90);

    if (side === 'home') this.state.goldHome += 24;
    else this.state.goldAway += 24;
  }

  private processScheduledObjectives(tick: number): void {
    if (tick === 3 && this.rand() > 0.55) {
      const side = this.pickWinner(0.01);
      const zone = side === 'home' ? 'away_jungle' : 'home_jungle';
      this.addEvent(tick, 'invade', side, `${sideLabel(side)}가 날카로운 초반 인베이드를 시도합니다.`, 120, zone, this.pickParticipants(side, 3));
      this.addCommentary(tick, `${sideLabel(side)}가 시야와 캠프를 먼저 흔들기 시작합니다.`, 'info');
    }

    if (tick === 6 && this.rand() > 0.62) {
      const side = this.pickWinner(0.008);
      const zone = this.rand() > 0.5 ? 'top_lane' : 'bot_lane';
      this.addEvent(tick, 'lane_swap', side, `${sideLabel(side)}가 매치업을 피하며 라인 구도를 바꿉니다.`, 0, zone, this.pickParticipants(side, 2));
      this.addCommentary(tick, `${sideLabel(side)}가 템포를 위해 라인 구도를 흔듭니다.`, 'info');
    }

    if (this.dragonSchedule.includes(tick)) {
      const dragonWinner = this.resolveObjective('dragon', 'dragon_pit', 400, 0.03);
      if (this.rand() > 0.82) {
        const thief = dragonWinner === 'home' ? 'away' : 'home';
        this.addEvent(tick, 'steal', thief, `${sideLabel(thief)}가 마지막 순간 드래곤을 강탈했습니다.`, 0, 'dragon_pit', this.pickParticipants(thief, 2));
        this.addCommentary(tick, `${sideLabel(thief)}가 극적인 스틸로 강가 구도를 뒤집었습니다.`, 'highlight');
      }
    }

    if (this.heraldSchedule.includes(tick)) {
      this.resolveObjective('rift_herald', 'top_river', 350, 0.02);
      this.destroyTower(this.pickWinner(0.03), 'top_lane', '전령 돌진으로 첫 포탑 압박이 시작됩니다.');
    }

    if (this.baronSchedule.includes(tick)) {
      const baronWinner = this.resolveObjective('baron', 'baron_pit', 900, 0.055);
      if (baronWinner === 'home') this.state.baronHome = true;
      else this.state.baronAway = true;
      if (this.rand() > 0.84) {
        const thief = baronWinner === 'home' ? 'away' : 'home';
        this.addEvent(tick, 'steal', thief, `${sideLabel(thief)}가 바론을 강탈했습니다.`, 0, 'baron_pit', this.pickParticipants(thief, 2));
        this.addCommentary(tick, `${sideLabel(thief)}가 스틸 한 번으로 바론 구도를 무너뜨립니다.`, 'highlight');
      }
    }

    if (tick === 10 || tick === 16) {
      const side = this.pickWinner(0.018);
      if (side === 'home') this.state.grubsHome = Math.min(6, this.state.grubsHome + 3);
      else this.state.grubsAway = Math.min(6, this.state.grubsAway + 3);
      this.addEvent(tick, 'void_grub', side, `${sideLabel(side)} secures the grubs.`, 220, 'top_river', this.pickParticipants(side, 3));
      this.addCommentary(tick, `${sideLabel(side)}가 초반 공허 유충으로 사이드 템포를 챙깁니다.`, 'objective');
    }

    if (!this.elderTaken && tick >= 33 && this.rand() > 0.72) {
      this.elderTaken = true;
      this.resolveObjective('elder_dragon', 'dragon_pit', 1100, 0.07);
    }
  }

  private resolveObjective(type: MatchEventType, zone: MatchZone, goldValue: number, winRateShift: number): 'home' | 'away' {
    const side = this.pickWinner(type === 'baron' ? 0.025 : 0.015);
    if (type === 'dragon') {
      const dragonType = DRAGON_TYPES[Math.floor(this.rand() * DRAGON_TYPES.length)];
      this.state.dragonSoul.dragonTypes.push({ type: dragonType, side });
      if (side === 'home') this.state.dragonsHome += 1;
      else this.state.dragonsAway += 1;
      if (side === 'home') this.state.dragonSoul.homeStacks += 1;
      else this.state.dragonSoul.awayStacks += 1;
      const stacks = side === 'home' ? this.state.dragonSoul.homeStacks : this.state.dragonSoul.awayStacks;
      if (stacks >= 4 && !this.state.dragonSoul.soulTeam) {
        this.state.dragonSoul.soulTeam = side;
        this.state.dragonSoul.soulType = dragonType;
      }
    }

    if (side === 'home') this.state.goldHome += goldValue;
    else this.state.goldAway += goldValue;

    this.state.currentWinRate = Math.max(0.15, Math.min(0.85, this.state.currentWinRate + (side === 'home' ? winRateShift : -winRateShift)));
    this.addEvent(this.state.currentTick, type, side, `${sideLabel(side)} ${COMMENTARY_SNIPPETS[type][Math.floor(this.rand() * COMMENTARY_SNIPPETS[type].length)]}`, goldValue, zone, this.pickParticipants(side, 4));
    this.addCommentary(this.state.currentTick, `${sideLabel(side)}가 ${eventTypeLabel(type)}를 확보했습니다.`, 'objective');
    return side;
  }

  private processSkirmishes(tick: number): void {
    const phaseWeight = this.state.phase === 'laning' ? 0.07 : this.state.phase === 'mid_game' ? 0.11 : 0.16;
    if (this.rand() > phaseWeight) return;

    const aggressiveBoost = this.inGameTactics.playStyle === 'aggressive' ? 0.02 : 0;
    const engageBoost = this.inGameTactics.teamfightAggression === 'engage' ? 0.015 : 0;
    const side = this.pickWinner(aggressiveBoost + engageBoost);
    const type = this.state.phase === 'late_game' && this.rand() > 0.4 ? 'teamfight' : toEventType(this.state.phase);
    const zone = this.pickFightZone(type);
    const kills = type === 'teamfight' ? 2 + Math.floor(this.rand() * 3) : 1;

    if (this.state.phase !== 'laning' && this.rand() > 0.8) {
      this.addEvent(tick, 'dive', side, `${sideLabel(side)}가 정교한 포탑 다이브를 시도합니다.`, 180, zone, this.pickParticipants(side, 3));
      this.addCommentary(tick, `${sideLabel(side)}가 포탑 아래까지 들어가 템포를 강제로 당깁니다.`, 'teamfight');
    }

    for (let index = 0; index < kills; index += 1) {
      this.registerKill(tick, side, type === 'teamfight' ? 'They win the collapse.' : 'They convert the setup.', zone);
    }

    if (type === 'teamfight' && this.rand() > 0.78) {
      this.addEvent(tick, 'ace', side, `${sideLabel(side)} finds the ace.`, 0, zone, this.pickParticipants(side, 5));
      this.addCommentary(tick, `${sideLabel(side)}가 한타를 지우며 그대로 끝내기 각을 봅니다.`, 'highlight');
      this.destroyTower(side, zone, 'The map opens after the ace.');
    } else if (this.rand() > 0.72) {
      this.destroyTower(side, zone, 'Pressure turns into a tower.');
    }

    if (type === 'teamfight' && kills >= 4 && this.rand() > 0.7) {
      this.addEvent(tick, 'pentakill', side, `${sideLabel(side)} nearly wipes everything with a pentakill-level cleanup.`, 600, zone, this.pickParticipants(side, 1));
      this.addCommentary(tick, `${sideLabel(side)} 쪽 캐리가 경기 최고의 하이라이트를 만들어 냅니다.`, 'highlight');
    }
  }

  private destroyTower(side: 'home' | 'away', zone: MatchZone, description: string): void {
    if (side === 'home') this.state.towersHome += 1;
    else this.state.towersAway += 1;
    if (side === 'home') this.state.goldHome += 550;
    else this.state.goldAway += 550;
    this.addEvent(this.state.currentTick, 'tower_destroy', side, description, 550, zone, this.pickParticipants(side, 3));
    this.addCommentary(this.state.currentTick, `${sideLabel(side)}가 포탑 하나를 더 가져갑니다.`, 'objective');
  }

  private registerKill(tick: number, side: 'home' | 'away', description: string, zone: MatchZone): void {
    const killerPool = side === 'home' ? this.state.playerStatsHome : this.state.playerStatsAway;
    const victimPool = side === 'home' ? this.state.playerStatsAway : this.state.playerStatsHome;
    const killerIndex = Math.floor(this.rand() * killerPool.length);
    const victimIndex = Math.floor(this.rand() * victimPool.length);
    const killer = killerPool[killerIndex];
    const victim = victimPool[victimIndex];

    killer.kills += 1;
    killer.goldEarned += 300;
    killer.damageDealt += 250;
    victim.deaths += 1;

    killerPool
      .filter((_, index) => index !== killerIndex)
      .slice(0, 2)
      .forEach((assist) => {
        assist.assists += 1;
        assist.goldEarned += 80;
      });

    if (side === 'home') {
      this.state.killsHome += 1;
      this.state.goldHome += 300;
    } else {
      this.state.killsAway += 1;
      this.state.goldAway += 300;
    }

    this.addEvent(tick, 'kill', side, description, 300, zone, [killer.playerId, victim.playerId]);
    this.addCommentary(tick, `${sideLabel(side)}가 ${zoneName(zone)}에서 킬을 올립니다.`, 'kill');
  }

  private checkDecision(tick: number): Decision | null {
    if (this.usedCoachVoice >= this.maxCoachVoice) return null;
    const bucket =
      this.state.phase === 'laning'
        ? this.decisionTicks.laning
        : this.state.phase === 'mid_game'
          ? this.decisionTicks.midGame
          : this.decisionTicks.lateGame;
    if (!bucket.includes(tick)) return null;

    this.usedCoachVoice += 1;
    return {
      id: `decision_${tick}`,
      tick,
      phase: this.state.phase,
      situation: `${tick}분 구간 브리핑입니다. 다음 운영 방향을 선택하세요.`,
      mode: this.gameMode,
      resolved: false,
      options: [
        {
          id: 'press',
          label: '압박 유지',
          description: '템포를 올리며 다음 교전을 먼저 엽니다.',
          effect: { winRateMod: 0.025, goldMod: 120, moraleMod: 1, riskFactor: 0.35 },
        },
        {
          id: 'reset',
          label: '시야 재정비',
          description: '한 박자 쉬고 귀환 후 시야를 다시 잡습니다.',
          effect: { winRateMod: 0.012, goldMod: 40, moraleMod: 0, riskFactor: 0.1 },
        },
        {
          id: 'split',
          label: '사이드 운영',
          description: '공간을 교환하며 사이드 압박을 키웁니다.',
          effect: { winRateMod: 0.018, goldMod: 80, moraleMod: 0, riskFactor: 0.2 },
        },
      ],
    };
  }

  private finishGame(): void {
    const winner = this.pickWinner(0.03);
    const loser = winner === 'home' ? 'away' : 'home';
    this.registerKill(this.state.maxTick, winner, 'The final fight ends the game.', winner === 'home' ? 'away_base' : 'home_base');
    if (this.rand() > 0.68) {
      this.addEvent(this.state.maxTick, 'backdoor', winner, `${sideLabel(winner)}가 빈 틈을 파고들며 백도어를 시도합니다.`, 0, winner === 'home' ? 'away_base' : 'home_base', this.pickParticipants(winner, 2));
      this.addCommentary(this.state.maxTick, `${sideLabel(winner)}가 정면 대신 넥서스를 곧장 노립니다.`, 'highlight');
    }
    this.addEvent(this.state.maxTick, 'base_race', winner, `${sideLabel(winner)}가 넥서스를 파괴합니다.`, 0, winner === 'home' ? 'away_base' : 'home_base', this.pickParticipants(winner, 5));
    this.addCommentary(this.state.maxTick, `${sideLabel(winner)}가 세트를 마무리합니다.`, 'highlight');
    if (winner === 'home') {
      this.state.towersHome = Math.max(this.state.towersHome, 8);
      this.state.towersAway = Math.max(this.state.towersAway, 2);
    } else {
      this.state.towersAway = Math.max(this.state.towersAway, 8);
      this.state.towersHome = Math.max(this.state.towersHome, 2);
    }
    this.state.isFinished = true;
    this.state.winner = winner;
    this.state.phase = 'finished';
    if (loser === 'home') this.state.baronAway = false;
    else this.state.baronHome = false;
    this.syncSpatialState();
  }

  private pickWinner(homeBias = 0): 'home' | 'away' {
    const instructionBoost = [...this.playerInstructions.values()].filter((value) => value === 'aggressive').length * 0.006;
    const homeChance = Math.max(0.15, Math.min(0.85, this.state.currentWinRate + homeBias + instructionBoost));
    return this.rand() < homeChance ? 'home' : 'away';
  }

  private pickFightZone(type: MatchEventType): MatchZone {
    if (type === 'teamfight') {
      const candidates: MatchZone[] = this.inGameTactics.objectivePriority === 'baron'
        ? ['baron_pit', 'top_river', 'mid_lane']
        : this.inGameTactics.objectivePriority === 'dragon'
          ? ['dragon_pit', 'bot_river', 'mid_lane']
          : ['mid_lane', 'top_river', 'bot_river'];
      return candidates[Math.floor(this.rand() * candidates.length)];
    }
    if (type === 'gank') {
      const candidates: MatchZone[] = ['top_lane', 'mid_lane', 'bot_lane', 'home_jungle', 'away_jungle'];
      return candidates[Math.floor(this.rand() * candidates.length)];
    }
    if (type === 'solo_kill') {
      const candidates: MatchZone[] = ['top_lane', 'mid_lane', 'bot_lane'];
      return candidates[Math.floor(this.rand() * candidates.length)];
    }
    return 'mid_lane';
  }

  private addEvent(
    tick: number,
    type: MatchEventType,
    side: 'home' | 'away',
    description: string,
    goldChange: number,
    zone: MatchZone,
    participants: string[] = [],
  ): void {
    this.state.events.push({
      tick,
      type,
      side,
      description,
      goldChange,
      zone,
      participants,
      position: this.zonePoint(zone, side, participants.length),
    });
  }

  private addCommentary(tick: number, message: string, type: Commentary['type']): void {
    this.state.commentary.push({ tick, message, type });
  }

  private syncSpatialState(): void {
    const latestEvent = [...this.state.events].reverse().find((event) => this.state.currentTick - event.tick <= 4) ?? null;
    this.state.focusEvent = latestEvent
        ? {
          eventType: latestEvent.type,
          side: latestEvent.side,
          label: `${sideLabel(latestEvent.side)} ${eventTypeLabel(latestEvent.type)}`,
          detail: latestEvent.description,
          zone: latestEvent.zone ?? 'center',
          tick: latestEvent.tick,
        }
      : null;
    this.state.cameraZone = latestEvent?.zone ?? (this.state.phase === 'late_game' ? 'mid_lane' : 'center');
    this.state.objectiveStates = this.buildObjectiveStates();
    this.state.playerMapStates = [
      ...this.buildSideMapStates('home', this.state.playerStatsHome, latestEvent),
      ...this.buildSideMapStates('away', this.state.playerStatsAway, latestEvent),
    ];
  }

  private buildObjectiveStates(): ObjectiveState[] {
    const nextDragon = this.dragonSchedule.find((tick) => tick > this.state.currentTick);
    const nextBaron = this.baronSchedule.find((tick) => tick > this.state.currentTick);
    const nextHerald = this.heraldSchedule.find((tick) => tick > this.state.currentTick);
    return [
      {
        key: 'dragon',
        zone: 'dragon_pit',
        status: nextDragon ? (this.state.currentTick >= 12 ? 'respawning' : 'up') : 'secured',
        controlledBy: this.state.dragonsHome > this.state.dragonsAway ? 'home' : this.state.dragonsAway > this.state.dragonsHome ? 'away' : undefined,
        nextSpawnTick: nextDragon,
      },
      {
        key: 'baron',
        zone: 'baron_pit',
        status: nextBaron ? (this.state.currentTick >= 25 ? 'respawning' : 'up') : 'secured',
        controlledBy: this.state.baronHome ? 'home' : this.state.baronAway ? 'away' : undefined,
        nextSpawnTick: nextBaron,
      },
      {
        key: 'herald',
        zone: 'top_river',
        status: nextHerald ? 'up' : 'secured',
        nextSpawnTick: nextHerald,
      },
    ];
  }

  private buildSideMapStates(
    side: 'home' | 'away',
    stats: LivePlayerStat[],
    latestEvent: MatchEvent | null,
  ): PlayerMapState[] {
    return stats.map((player, index) => {
      const isInEvent = latestEvent?.participants?.includes(player.playerId) ?? false;
      const zone = isInEvent ? latestEvent?.zone ?? positionZone(player.position, side) : this.defaultZoneForPlayer(player, side);
      return {
        playerId: player.playerId,
        side,
        position: player.position,
        zone,
        ...this.zonePoint(zone, side, index),
        activity: isInEvent
          ? latestEvent?.type === 'teamfight' ? 'teamfight' : latestEvent?.type === 'dragon' || latestEvent?.type === 'baron' ? 'objective' : 'rotating'
          : this.state.phase === 'laning' ? 'laning' : 'farming',
        highlight: isInEvent,
      };
    });
  }

  private defaultZoneForPlayer(player: LivePlayerStat, side: 'home' | 'away'): MatchZone {
    const instruction = this.playerInstructions.get(player.playerId);
    if (instruction === 'roam') return this.state.phase === 'laning' ? 'mid_river' : 'center';
    if (this.state.phase !== 'laning' && this.inGameTactics.objectivePriority === 'dragon' && (player.position === 'jungle' || player.position === 'support')) {
      return 'dragon_pit';
    }
    if (this.state.phase === 'late_game' && this.inGameTactics.objectivePriority === 'baron' && (player.position === 'jungle' || player.position === 'support')) {
      return 'baron_pit';
    }
    if (this.state.phase === 'late_game' && (player.position === 'adc' || player.position === 'support')) return 'mid_lane';
    return positionZone(player.position, side);
  }

  private pickParticipants(side: 'home' | 'away', count: number): string[] {
    const source = side === 'home' ? this.state.playerStatsHome : this.state.playerStatsAway;
    return source.slice(0, count).map((player) => player.playerId);
  }

  private zonePoint(zone: MatchZone, side: 'home' | 'away', seed: number): { x: number; y: number } {
    const base = ZONE_POINTS[zone];
    const offsetSeed = (seed + 1) * 0.71 + this.state.currentTick * 0.13 + (side === 'home' ? 0.2 : 0.8);
    const dx = Math.sin(offsetSeed) * 0.03;
    const dy = Math.cos(offsetSeed * 1.17) * 0.03;
    return {
      x: Math.max(0.05, Math.min(0.95, base.x + dx)),
      y: Math.max(0.05, Math.min(0.95, base.y + dy)),
    };
  }
}
