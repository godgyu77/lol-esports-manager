import type { Position } from './game';
import type { PlayerStats } from './player';

export interface AcademyPlayer {
  id: number;
  teamId: string;
  name: string;
  position: Position;
  age: number;
  potential: number;
  stats: PlayerStats;
  trainingProgress: number;  // 0-100
  promotionReady: boolean;
  joinedDate: string;
}

export interface RookieDraftEntry {
  id: number;
  seasonId: number;
  name: string;
  position: Position;
  age: number;
  potential: number;
  estimatedAbility: number;
  nationality: string;
  isDrafted: boolean;
  draftedByTeamId: string | null;
}
