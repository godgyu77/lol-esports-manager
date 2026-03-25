export type GameMode = 'manager' | 'player';

export type Position = 'top' | 'jungle' | 'mid' | 'adc' | 'support';

export type Split = 'spring' | 'summer';

export type Region = 'LCK' | 'LPL' | 'LEC' | 'LCS';

export interface GameSave {
  id: number;
  mode: GameMode;
  userTeamId: string;
  userPlayerId?: string; // 선수 모드일 때만
  currentSeasonId: number;
  createdAt: string;
  updatedAt: string;
  slotNumber: number;
  saveName: string;
  playTimeMinutes: number;
  teamName?: string;
  seasonInfo?: string;
  rngSeed?: string;
}

/** 저장 슬롯 표시용 (빈 슬롯 포함) */
export interface SaveSlot {
  slotNumber: number;
  save: GameSave | null;
}

export interface Season {
  id: number;
  year: number;
  split: Split;
  currentWeek: number;
  currentDate: string;   // YYYY-MM-DD (일간 진행 현재 날짜)
  startDate: string;     // 시즌 시작일
  endDate: string;       // 시즌 종료일
  isActive: boolean;
}
