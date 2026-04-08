import { create } from 'zustand';
import type { GameResult } from '../engine/match/matchSimulator';

export type BoFormat = 'Bo1' | 'Bo3' | 'Bo5';
export type MatchSpeedPreset = 'focus' | 'standard' | 'fast';

interface MatchState {
  speed: number;
  speedPreset: MatchSpeedPreset;
  seriesScore: { home: number; away: number };
  currentGameNum: number;
  gameResults: GameResult[];
  hardFearlessSeries: boolean;
  currentGameDraftRequired: boolean;
  seriesFearlessPool: Record<'blue' | 'red', string[]>;
  betweenGames: boolean;
  matchActive: boolean;
  navigationPauseRequested: boolean;
  boFormat: BoFormat;
  setSpeed: (speed: number) => void;
  setSpeedPreset: (preset: MatchSpeedPreset) => void;
  setSeriesScore: (score: { home: number; away: number }) => void;
  setCurrentGameNum: (num: number) => void;
  setGameResults: (results: GameResult[]) => void;
  setBetweenGames: (v: boolean) => void;
  setBoFormat: (format: BoFormat) => void;
  setHardFearlessSeries: (enabled: boolean) => void;
  setCurrentGameDraftRequired: (required: boolean) => void;
  setSeriesFearlessPool: (pool: Record<'blue' | 'red', string[]>) => void;
  setMatchActive: (active: boolean) => void;
  requestNavigationPause: () => void;
  clearNavigationPause: () => void;
  winsNeeded: () => number;
  resetSeries: () => void;
  reset: () => void;
}

const SPEED_MAP: Record<MatchSpeedPreset, number> = {
  focus: 0.75,
  standard: 1,
  fast: 1.5,
};

const initialSeriesState = {
  seriesScore: { home: 0, away: 0 },
  currentGameNum: 1,
  gameResults: [] as GameResult[],
  hardFearlessSeries: false,
  currentGameDraftRequired: true,
  seriesFearlessPool: { blue: [], red: [] } as Record<'blue' | 'red', string[]>,
  betweenGames: false,
  boFormat: 'Bo3' as BoFormat,
  matchActive: false,
  navigationPauseRequested: false,
};

const initialState = {
  speed: SPEED_MAP.focus,
  speedPreset: 'focus' as MatchSpeedPreset,
  ...initialSeriesState,
};

export const useMatchStore = create<MatchState>((set, get) => ({
  ...initialState,

  setSpeed: (speed) => set({ speed }),
  setSpeedPreset: (preset) => set({ speedPreset: preset, speed: SPEED_MAP[preset] }),
  setSeriesScore: (score) => set({ seriesScore: score }),
  setCurrentGameNum: (num) => set({ currentGameNum: num }),
  setGameResults: (results) => set({ gameResults: results }),
  setBetweenGames: (v) => set({ betweenGames: v }),
  setBoFormat: (format) => set({ boFormat: format }),
  setHardFearlessSeries: (enabled) => set({ hardFearlessSeries: enabled }),
  setCurrentGameDraftRequired: (required) => set({ currentGameDraftRequired: required }),
  setSeriesFearlessPool: (pool) => set({ seriesFearlessPool: pool }),
  setMatchActive: (active) => set({ matchActive: active }),
  requestNavigationPause: () => set({ navigationPauseRequested: true }),
  clearNavigationPause: () => set({ navigationPauseRequested: false }),
  winsNeeded: () => {
    const format = get().boFormat;
    return format === 'Bo5' ? 3 : format === 'Bo3' ? 2 : 1;
  },
  resetSeries: () => set({ ...initialSeriesState, speed: SPEED_MAP.focus, speedPreset: 'focus' }),
  reset: () => set(initialState),
}));
