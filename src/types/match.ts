export type MatchType =
  | 'regular'
  | 'playoff_quarters'
  | 'playoff_semis'
  | 'playoff_finals'
  // MSI
  | 'msi_group'
  | 'msi_semis'
  | 'msi_final'
  // Worlds (스위스 스테이지)
  | 'worlds_swiss'
  | 'worlds_quarter'
  | 'worlds_semi'
  | 'worlds_final'
  // LCK Cup (윈터)
  | 'lck_cup_regular'
  | 'lck_cup_playoff_quarters'
  | 'lck_cup_playoff_semis'
  | 'lck_cup_playoff_finals'
  // First Stand (국제전)
  | 'fst_quarter'
  | 'fst_semi'
  | 'fst_final'
  // EWC (Esports World Cup)
  | 'ewc_quarter'
  | 'ewc_semi'
  | 'ewc_final';

export interface Match {
  id: string;
  seasonId: number;
  week: number;
  matchDate?: string;    // YYYY-MM-DD (경기 날짜)
  teamHomeId: string;
  teamAwayId: string;
  scoreHome: number;
  scoreAway: number;
  isPlayed: boolean;
  playedAt?: string;
  games: Game[];
  matchType: MatchType;
  boFormat: 'Bo1' | 'Bo3' | 'Bo5';
  fearlessDraft?: boolean;
  /** 사이드 선택권 팀 (시드 높은 팀) */
  sidePickTeamId?: string;
}

export interface Game {
  id: string;
  matchId: string;
  gameNumber: number;
  winnerTeamId?: string;
  durationSeconds?: number;
  goldDiffAt15: number;
  totalKillsHome: number;
  totalKillsAway: number;
}

/** 드래곤 타입 (4종류) */
export type DragonType = 'infernal' | 'ocean' | 'mountain' | 'cloud';

/** 드래곤 소울 상태 */
export interface DragonSoulState {
  /** 각 팀의 드래곤 스택 */
  homeStacks: number;
  awayStacks: number;
  /** 드래곤 타입 히스토리 */
  dragonTypes: { type: DragonType; side: 'home' | 'away' }[];
  /** 소울 획득 팀 (4스택 달성) */
  soulTeam?: 'home' | 'away';
  soulType?: DragonType;
}

// 매치 엔진 Tick 이벤트
export type MatchEventType =
  | 'kill'
  | 'tower_destroy'
  | 'dragon'
  | 'baron'
  | 'teamfight'
  | 'gank'
  | 'lane_swap'
  | 'solo_kill'
  | 'dive'
  | 'invade'
  | 'elder_dragon'
  | 'rift_herald'
  | 'void_grub'
  | 'ace'
  | 'base_race'
  | 'backdoor'
  | 'steal'
  | 'pentakill';

export interface MatchEvent {
  tick: number;           // 게임 내 시간 (초)
  type: MatchEventType;
  side: 'home' | 'away';  // 이벤트 주체 진영
  playerId?: string;
  targetPlayerId?: string;
  description: string;    // 텍스트 중계용
  goldChange: number;
  position?: { x: number; y: number }; // 미니맵 위치
}

/** 선수 개별 경기 스탯 (DB 레코드용) */
export interface PlayerGameStats {
  id: string;
  gameId: string;
  matchId: string;
  playerId: string;
  teamId: string;
  side: 'home' | 'away';
  position: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  goldEarned: number;
  damageDealt: number;
}

// Tick별 게임 상태
export interface MatchTickState {
  tick: number;
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
  /** 보이드 그럽 (각 팀 처치 수, 최대 6) */
  grubsHome: number;
  grubsAway: number;
  /** 드래곤 소울 상태 */
  dragonSoul: DragonSoulState;
  events: MatchEvent[];
  playerPositions: Record<string, { x: number; y: number }>;
}
