import { create } from 'zustand';
import type { GameMode, GameSave, Position, Season } from '../types';
import type { PlayerBackground } from '../types/player';
import type { Team } from '../types';

export interface PendingPlayer {
  name: string;
  position: Position;
  background: PlayerBackground;
}

interface GameState {
  // 게임 메타
  mode: GameMode | null;
  save: GameSave | null;
  season: Season | null;
  teams: Team[];
  isLoading: boolean;
  pendingPlayer: PendingPlayer | null;

  // 액션
  setMode: (mode: GameMode) => void;
  setSave: (save: GameSave) => void;
  setSeason: (season: Season) => void;
  setTeams: (teams: Team[]) => void;
  setLoading: (loading: boolean) => void;
  setPendingPlayer: (player: PendingPlayer | null) => void;
  reset: () => void;
}

const initialState = {
  mode: null,
  save: null,
  season: null,
  teams: [],
  isLoading: false,
  pendingPlayer: null,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  setMode: (mode) => set({ mode }),
  setSave: (save) => set({ save }),
  setSeason: (season) => set({ season }),
  setTeams: (teams) => set({ teams }),
  setLoading: (loading) => set({ isLoading: loading }),
  setPendingPlayer: (player) => set({ pendingPlayer: player }),
  reset: () => set(initialState),
}));
