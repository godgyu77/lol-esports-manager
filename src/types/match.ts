export interface Match {
  id: string;
  seasonId: number;
  week: number;
  teamHomeId: string;
  teamAwayId: string;
  scoreHome: number;
  scoreAway: number;
  isPlayed: boolean;
  playedAt?: string;
  games: Game[];
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
  teamId: string;         // 이벤트 주체 팀
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
