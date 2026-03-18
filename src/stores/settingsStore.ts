import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { soundManager } from '../audio/soundManager';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type Theme = 'dark' | 'light';

interface SettingsState {
  defaultSpeed: number;
  aiEnabled: boolean;
  autoSaveInterval: 'daily' | 'weekly' | 'manual';
  tutorialComplete: boolean;
  difficulty: Difficulty;
  soundEnabled: boolean;
  soundVolume: number;
  theme: Theme;
  setDefaultSpeed: (speed: number) => void;
  setAiEnabled: (enabled: boolean) => void;
  setAutoSaveInterval: (interval: 'daily' | 'weekly' | 'manual') => void;
  setTutorialComplete: (complete: boolean) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setSoundVolume: (volume: number) => void;
  setTheme: (theme: Theme) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultSpeed: 1,
      aiEnabled: true,
      autoSaveInterval: 'daily',
      tutorialComplete: false,
      difficulty: 'normal',
      soundEnabled: true,
      soundVolume: 0.5,
      theme: 'dark',
      setDefaultSpeed: (speed) => set({ defaultSpeed: speed }),
      setAiEnabled: (enabled) => set({ aiEnabled: enabled }),
      setAutoSaveInterval: (interval) => set({ autoSaveInterval: interval }),
      setTutorialComplete: (complete) => set({ tutorialComplete: complete }),
      setDifficulty: (difficulty) => set({ difficulty }),
      setSoundEnabled: (enabled) => {
        soundManager.setEnabled(enabled);
        set({ soundEnabled: enabled });
      },
      setSoundVolume: (volume) => {
        soundManager.setVolume(volume);
        set({ soundVolume: volume });
      },
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'lol-esports-settings',
      onRehydrateStorage: () => (state) => {
        if (state) {
          soundManager.setEnabled(state.soundEnabled);
          soundManager.setVolume(state.soundVolume);
        }
      },
    },
  ),
);
