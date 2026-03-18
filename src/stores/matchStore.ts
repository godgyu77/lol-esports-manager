import { create } from 'zustand';
import type { GameResult } from '../engine/match/matchSimulator';

interface MatchState {
  // 경기 속도 상태
  speed: number; // 1x, 2x, 4x

  // 시리즈 진행 상태 (피어리스 재드래프트 시 유지 필요)
  seriesScore: { home: number; away: number };
  currentGameNum: number;
  gameResults: GameResult[];

  // 액션
  setSpeed: (speed: number) => void;
  setSeriesScore: (score: { home: number; away: number }) => void;
  setCurrentGameNum: (num: number) => void;
  setGameResults: (results: GameResult[]) => void;
  resetSeries: () => void;
  reset: () => void;
}

const initialSeriesState = {
  seriesScore: { home: 0, away: 0 },
  currentGameNum: 1,
  gameResults: [] as GameResult[],
};

const initialState = {
  speed: 1,
  ...initialSeriesState,
};

export const useMatchStore = create<MatchState>((set) => ({
  ...initialState,

  setSpeed: (speed) => set({ speed }),
  setSeriesScore: (score) => set({ seriesScore: score }),
  setCurrentGameNum: (num) => set({ currentGameNum: num }),
  setGameResults: (results) => set({ gameResults: results }),
  resetSeries: () => set(initialSeriesState),
  reset: () => set(initialState),
}));
