export type GameMode = 'manager' | 'player';
export type ModeAvailability = 'available' | 'coming_soon';

export type Position = 'top' | 'jungle' | 'mid' | 'adc' | 'support';

export type Split = 'spring' | 'summer';

export type Region = 'LCK' | 'LPL' | 'LEC' | 'LCS';

export interface GameSave {
  id: number;
  metadataId: number;
  mode: GameMode;
  userTeamId: string;
  userPlayerId?: string;
  currentSeasonId: number;
  dbFilename: string;
  createdAt: string;
  updatedAt: string;
  slotNumber: number;
  saveName: string;
  playTimeMinutes: number;
  teamName?: string;
  seasonInfo?: string;
  rngSeed?: string;
}

export interface SaveSlot {
  slotNumber: number;
  save: GameSave | null;
}

export interface Season {
  id: number;
  year: number;
  split: Split;
  currentWeek: number;
  currentDate: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}
