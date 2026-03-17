import { create } from 'zustand';

type Screen =
  | 'main_menu'
  | 'mode_select'
  | 'player_create'
  | 'team_select'
  | 'dashboard'
  | 'match'
  | 'draft'
  | 'roster'
  | 'schedule'
  | 'transfer'
  | 'training'
  | 'meeting';

interface UiState {
  currentScreen: Screen;
  sidebarOpen: boolean;
  modalOpen: string | null; // 모달 ID

  setScreen: (screen: Screen) => void;
  setSidebarOpen: (open: boolean) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  currentScreen: 'main_menu',
  sidebarOpen: true,
  modalOpen: null,

  setScreen: (currentScreen) => set({ currentScreen }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  openModal: (modalId) => set({ modalOpen: modalId }),
  closeModal: () => set({ modalOpen: null }),
}));
