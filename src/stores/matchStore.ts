import { create } from 'zustand';

interface MatchState {
  // 경기 속도 상태
  speed: number; // 1x, 2x, 4x

  // 액션
  setSpeed: (speed: number) => void;
  reset: () => void;
}

const initialState = {
  speed: 1,
};

export const useMatchStore = create<MatchState>((set) => ({
  ...initialState,

  setSpeed: (speed) => set({ speed }),
  reset: () => set(initialState),
}));
