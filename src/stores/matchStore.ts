import { create } from 'zustand';
import type { MatchTickState, MatchEvent } from '../types';

interface MatchState {
  // 현재 매치 진행 상태
  isPlaying: boolean;
  isPaused: boolean;
  speed: number; // 1x, 2x, 4x, 8x
  currentTick: number;
  maxTick: number;
  tickState: MatchTickState | null;
  events: MatchEvent[];

  // 액션
  setPlaying: (playing: boolean) => void;
  setPaused: (paused: boolean) => void;
  setSpeed: (speed: number) => void;
  setCurrentTick: (tick: number) => void;
  setTickState: (state: MatchTickState) => void;
  addEvent: (event: MatchEvent) => void;
  reset: () => void;
}

const initialState = {
  isPlaying: false,
  isPaused: false,
  speed: 1,
  currentTick: 0,
  maxTick: 0,
  tickState: null,
  events: [],
};

export const useMatchStore = create<MatchState>((set) => ({
  ...initialState,

  setPlaying: (isPlaying) => set({ isPlaying }),
  setPaused: (isPaused) => set({ isPaused }),
  setSpeed: (speed) => set({ speed }),
  setCurrentTick: (currentTick) => set({ currentTick }),
  setTickState: (tickState) => set({ tickState }),
  addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
  reset: () => set(initialState),
}));
