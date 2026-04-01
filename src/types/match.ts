export type MatchType =
  | 'regular'
  | 'playoff_quarters'
  | 'playoff_semis'
  | 'playoff_finals'
  | 'msi_group'
  | 'msi_semis'
  | 'msi_final'
  | 'worlds_swiss'
  | 'worlds_quarter'
  | 'worlds_semi'
  | 'worlds_final'
  | 'lck_cup_regular'
  | 'lck_cup_playoff_quarters'
  | 'lck_cup_playoff_semis'
  | 'lck_cup_playoff_finals'
  | 'fst_quarter'
  | 'fst_semi'
  | 'fst_final'
  | 'ewc_quarter'
  | 'ewc_semi'
  | 'ewc_final';

export interface Match {
  id: string;
  seasonId: number;
  week: number;
  matchDate?: string;
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
  hardFearlessSeries?: boolean;
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

export type DragonType = 'infernal' | 'ocean' | 'mountain' | 'cloud';

export interface DragonSoulState {
  homeStacks: number;
  awayStacks: number;
  dragonTypes: { type: DragonType; side: 'home' | 'away' }[];
  soulTeam?: 'home' | 'away';
  soulType?: DragonType;
}

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

export type MatchZone =
  | 'home_base'
  | 'away_base'
  | 'top_lane'
  | 'mid_lane'
  | 'bot_lane'
  | 'top_river'
  | 'mid_river'
  | 'bot_river'
  | 'home_jungle'
  | 'away_jungle'
  | 'dragon_pit'
  | 'baron_pit'
  | 'center';

export interface MatchEvent {
  tick: number;
  type: MatchEventType;
  side: 'home' | 'away';
  playerId?: string;
  targetPlayerId?: string;
  description: string;
  goldChange: number;
  position?: { x: number; y: number };
  zone?: MatchZone;
  participants?: string[];
}

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
  grubsHome: number;
  grubsAway: number;
  dragonSoul: DragonSoulState;
  events: MatchEvent[];
  playerPositions: Record<string, { x: number; y: number }>;
}
