import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  defaultSpeed: number;
  aiEnabled: boolean;
  autoSaveInterval: 'daily' | 'weekly' | 'manual';
  tutorialComplete: boolean;
  setDefaultSpeed: (speed: number) => void;
  setAiEnabled: (enabled: boolean) => void;
  setAutoSaveInterval: (interval: 'daily' | 'weekly' | 'manual') => void;
  setTutorialComplete: (complete: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultSpeed: 1,
      aiEnabled: true,
      autoSaveInterval: 'daily',
      tutorialComplete: false,
      setDefaultSpeed: (speed) => set({ defaultSpeed: speed }),
      setAiEnabled: (enabled) => set({ aiEnabled: enabled }),
      setAutoSaveInterval: (interval) => set({ autoSaveInterval: interval }),
      setTutorialComplete: (complete) => set({ tutorialComplete: complete }),
    }),
    {
      name: 'lol-esports-settings',
    },
  ),
);
