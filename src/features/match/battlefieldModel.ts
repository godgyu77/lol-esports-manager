import type {
  FocusEventSummary,
  LiveGameState,
  LivePlayerStat,
  ObjectiveState,
  PlayerMapState,
} from '../../engine/match/liveMatch';
import type { MatchEventType, MatchZone } from '../../types/match';

function zoneLabel(zone: string): string {
  const labels: Record<string, string> = {
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
  return labels[zone] ?? zone.replace(/_/g, ' ');
}

export interface BattlefieldCameraModel {
  x: number;
  y: number;
  zoom: number;
  zone: MatchZone;
  intensity: 'ambient' | 'tracking' | 'clash';
  emphasisLabel: string;
}

export interface BattlefieldEffectModel {
  id: string;
  type: MatchEventType;
  visual: 'burst' | 'shockwave' | 'beam' | 'objective' | 'spotlight';
  label: string;
  detail: string;
  x: number;
  y: number;
  side: 'home' | 'away';
  intensity: number;
  age: number;
  ttl: number;
}

export interface BattlefieldPlayerModel {
  id: string;
  name: string;
  position: LivePlayerStat['position'];
  championId?: string;
  side: 'home' | 'away';
  x: number;
  y: number;
  screenX: number;
  screenY: number;
  healthPct: number;
  level: number;
  cs: number;
  gold: number;
  kills: number;
  deaths: number;
  assists: number;
  activity: PlayerMapState['activity'];
  statusTag: 'stable' | 'rotating' | 'skirmishing' | 'objective' | 'recalling';
  highlight: boolean;
  powerSpike: boolean;
  zone: MatchZone;
}

export interface BattlefieldObjectiveModel {
  key: ObjectiveState['key'];
  zone: MatchZone;
  x: number;
  y: number;
  status: ObjectiveState['status'];
  controlledBy?: 'home' | 'away';
  nextSpawnTick?: number;
}

export interface BattlefieldFrameModel {
  tick: number;
  phase: LiveGameState['phase'];
  camera: BattlefieldCameraModel;
  players: BattlefieldPlayerModel[];
  objectives: BattlefieldObjectiveModel[];
  effects: BattlefieldEffectModel[];
  focusEvent: FocusEventSummary | null;
  homePressure: number;
  awayPressure: number;
}

export interface BattlefieldReplayFocus {
  x: number;
  y: number;
  side: 'home' | 'away';
  label: string;
}

export const BATTLEFIELD_ZONE_POINTS: Record<MatchZone, { x: number; y: number }> = {
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function deriveHealthPct(player: LivePlayerStat, mapState: PlayerMapState) {
  const pressurePenalty = player.deaths * 0.08;
  const highlightPenalty = mapState.highlight ? 0.06 : 0;
  const base = player.form / 100;
  return clamp(base - pressurePenalty - highlightPenalty + player.kills * 0.02, 0.24, 1);
}

function deriveLevel(player: LivePlayerStat) {
  return clamp(1 + Math.floor(player.cs / 28) + player.kills, 1, 18);
}

function deriveStatusTag(mapState: PlayerMapState): BattlefieldPlayerModel['statusTag'] {
  if (mapState.activity === 'reset' || mapState.zone === 'home_base' || mapState.zone === 'away_base') {
    return 'recalling';
  }
  if (mapState.activity === 'teamfight') {
    return 'skirmishing';
  }
  if (mapState.activity === 'objective') {
    return 'objective';
  }
  if (mapState.activity === 'rotating') {
    return 'rotating';
  }
  return 'stable';
}

function derivePowerSpike(player: LivePlayerStat, level: number) {
  return level >= 6 && (player.kills + player.assists >= 4 || player.goldEarned >= 9000 || player.comfortPick);
}

function projectIsometric(point: { x: number; y: number }) {
  const centeredX = point.x - 0.5;
  const centeredY = point.y - 0.5;
  return {
    x: 0.5 + centeredX * 0.98 - centeredY * 0.18,
    y: 0.5 + centeredY * 0.72 + centeredX * 0.08,
  };
}

function buildPlayerModel(player: LivePlayerStat, mapState: PlayerMapState): BattlefieldPlayerModel {
  const projected = projectIsometric({ x: mapState.x, y: mapState.y });
  const level = deriveLevel(player);
  return {
    id: player.playerId,
    name: player.playerName,
    position: player.position,
    championId: player.championId,
    side: mapState.side,
    x: mapState.x,
    y: mapState.y,
    screenX: projected.x,
    screenY: projected.y,
    healthPct: deriveHealthPct(player, mapState),
    level,
    cs: player.cs,
    gold: player.goldEarned,
    kills: player.kills,
    deaths: player.deaths,
    assists: player.assists,
    activity: mapState.activity,
    statusTag: deriveStatusTag(mapState),
    highlight: mapState.highlight,
    powerSpike: derivePowerSpike(player, level),
    zone: mapState.zone,
  };
}

function buildObjectiveModel(objective: ObjectiveState): BattlefieldObjectiveModel {
  const point = projectIsometric(BATTLEFIELD_ZONE_POINTS[objective.zone]);
  return {
    key: objective.key,
    zone: objective.zone,
    x: point.x,
    y: point.y,
    status: objective.status,
    controlledBy: objective.controlledBy,
    nextSpawnTick: objective.nextSpawnTick,
  };
}

function classifyEffect(type: MatchEventType): BattlefieldEffectModel['visual'] {
  if (type === 'dragon' || type === 'baron' || type === 'elder_dragon' || type === 'rift_herald' || type === 'void_grub') {
    return 'objective';
  }
  if (type === 'steal' || type === 'pentakill' || type === 'ace') {
    return 'spotlight';
  }
  if (type === 'teamfight' || type === 'base_race' || type === 'backdoor') {
    return 'shockwave';
  }
  if (type === 'tower_destroy' || type === 'dive') {
    return 'beam';
  }
  return 'burst';
}

function effectLifetime(type: MatchEventType) {
  switch (type) {
    case 'pentakill':
    case 'ace':
    case 'steal':
      return 10;
    case 'dragon':
    case 'baron':
    case 'elder_dragon':
    case 'rift_herald':
    case 'void_grub':
      return 12;
    case 'teamfight':
    case 'tower_destroy':
      return 8;
    default:
      return 6;
  }
}

function derivePressure(gameState: LiveGameState) {
  const killEdge = gameState.killsHome - gameState.killsAway;
  const goldEdge = (gameState.goldHome - gameState.goldAway) / 1200;
  const towerEdge = (gameState.towersHome - gameState.towersAway) * 1.8;
  const dragonEdge = (gameState.dragonsHome - gameState.dragonsAway) * 1.5;
  const baronEdge = (Number(gameState.baronHome) - Number(gameState.baronAway)) * 2.5;
  const homePressure = clamp(50 + killEdge * 2.6 + goldEdge + towerEdge + dragonEdge + baronEdge, 8, 92);
  return {
    homePressure,
    awayPressure: 100 - homePressure,
  };
}

export function buildBattlefieldFrame(gameState: LiveGameState): BattlefieldFrameModel {
  const playerById = new Map([
    ...gameState.playerStatsHome.map((player) => [player.playerId, player] as const),
    ...gameState.playerStatsAway.map((player) => [player.playerId, player] as const),
  ]);

  const players = gameState.playerMapStates
    .map((mapState) => {
      const player = playerById.get(mapState.playerId);
      if (!player) return null;
      return buildPlayerModel(player, mapState);
    })
    .filter((entry): entry is BattlefieldPlayerModel => entry !== null);

  const objectives = gameState.objectiveStates.map(buildObjectiveModel);
  const effects = gameState.events.slice(-5).map((event, index) => {
    const basePoint = event.position ?? BATTLEFIELD_ZONE_POINTS[event.zone ?? 'center'];
    const projected = projectIsometric(basePoint);
    const ttl = effectLifetime(event.type);
    return {
      id: `${event.type}-${event.tick}-${index}`,
      type: event.type,
      visual: classifyEffect(event.type),
      label: event.type.replace(/_/g, ' ').toUpperCase(),
      detail: event.description,
      x: projected.x,
      y: projected.y,
      side: event.side,
      intensity: clamp(1 - index * 0.16, 0.28, 1),
      age: gameState.currentTick - event.tick,
      ttl,
    };
  });

  const focusZone = gameState.focusEvent?.zone ?? gameState.cameraZone;
  const focusPoint = projectIsometric(BATTLEFIELD_ZONE_POINTS[focusZone]);
  const focusIntensity: BattlefieldCameraModel['intensity'] = gameState.focusEvent
    ? ['teamfight', 'steal', 'ace', 'pentakill', 'baron', 'elder_dragon'].includes(gameState.focusEvent.eventType)
      ? 'clash'
      : 'tracking'
    : 'ambient';
  const pressure = derivePressure(gameState);
  const camera: BattlefieldCameraModel = {
    x: focusPoint.x,
    y: focusPoint.y,
    zoom:
      focusIntensity === 'clash'
        ? 1.18
        : focusIntensity === 'tracking'
          ? 1.1
          : gameState.phase === 'late_game'
            ? 1.07
            : 1.02,
    zone: focusZone,
    intensity: focusIntensity,
    emphasisLabel: gameState.focusEvent?.label ?? `${zoneLabel(focusZone)} 추적`,
  };

  return {
    tick: gameState.currentTick,
    phase: gameState.phase,
    camera,
    players,
    objectives,
    effects,
    focusEvent: gameState.focusEvent,
    homePressure: pressure.homePressure,
    awayPressure: pressure.awayPressure,
  };
}

export function buildReplayCamera(frame: BattlefieldFrameModel, replayEffect?: BattlefieldEffectModel | null): BattlefieldCameraModel {
  if (!replayEffect) return frame.camera;

  return {
    x: replayEffect.x,
    y: replayEffect.y,
    zoom: Math.max(frame.camera.zoom, replayEffect.visual === 'spotlight' ? 1.28 : 1.22),
    zone: frame.camera.zone,
    intensity: 'clash',
    emphasisLabel: `리플레이: ${replayEffect.label}`,
  };
}
