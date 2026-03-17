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

// 매치 엔진 Tick 이벤트
export type MatchEventType =
  | 'kill'
  | 'tower_destroy'
  | 'dragon'
  | 'baron'
  | 'teamfight'
  | 'gank'
  | 'lane_swap';

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
  events: MatchEvent[];
  playerPositions: Record<string, { x: number; y: number }>;
}
