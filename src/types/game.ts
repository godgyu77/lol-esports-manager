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
