import { create } from 'zustand';
import type { GameResult } from '../engine/match/matchSimulator';

export type BoFormat = 'Bo1' | 'Bo3' | 'Bo5';

interface MatchState {
  // 경기 속도 상태
  speed: number; // 1x, 2x, 4x

  // 시리즈 진행 상태 (피어리스 재드래프트 시 유지 필요)
  seriesScore: { home: number; away: number };
  currentGameNum: number;
  gameResults: GameResult[];

  // 세트 간 휴식 상태
  betweenGames: boolean;

  // 경기 포맷
  boFormat: BoFormat;

  // 액션
  setSpeed: (speed: number) => void;
  setSeriesScore: (score: { home: number; away: number }) => void;
  setCurrentGameNum: (num: number) => void;
  setGameResults: (results: GameResult[]) => void;
  setBetweenGames: (v: boolean) => void;
  setBoFormat: (format: BoFormat) => void;
  winsNeeded: () => number;
  resetSeries: () => void;
  reset: () => void;
}

const initialSeriesState = {
  seriesScore: { home: 0, away: 0 },
  currentGameNum: 1,
  gameResults: [] as GameResult[],
  betweenGames: false,
  boFormat: 'Bo3' as BoFormat,
};

const initialState = {
  speed: 1,
  ...initialSeriesState,
};

export const useMatchStore = create<MatchState>((set, get) => ({
  ...initialState,

  setSpeed: (speed) => set({ speed }),
  setSeriesScore: (score) => set({ seriesScore: score }),
  setCurrentGameNum: (num) => set({ currentGameNum: num }),
  setGameResults: (results) => set({ gameResults: results }),
  setBetweenGames: (v) => set({ betweenGames: v }),
  setBoFormat: (format) => set({ boFormat: format }),
  winsNeeded: () => {
    const format = get().boFormat;
    return format === 'Bo5' ? 3 : format === 'Bo3' ? 2 : 1;
  },
  resetSeries: () => set(initialSeriesState),
  reset: () => set(initialState),
}));
