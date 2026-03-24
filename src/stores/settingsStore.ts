import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { soundManager } from '../audio/soundManager';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type Theme = 'dark' | 'light';
export type WindowMode = 'windowed' | 'fullscreen' | 'borderless';
export type AiProvider = 'ollama' | 'openai' | 'claude' | 'template';

const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 480;
};

/** base64 인코딩으로 API 키를 난독화하여 저장 */
const encodeKey = (key: string): string => (key ? btoa(key) : '');
/** base64 디코딩으로 API 키 복원 */
const decodeKey = (encoded: string): string => {
  if (!encoded) return '';
  try {
    return atob(encoded);
  } catch {
    return '';
  }
};

interface SettingsState {
  defaultSpeed: number;
  aiEnabled: boolean;
  aiModel: string;
  aiSetupCompleted: boolean;
  autoSaveInterval: 'daily' | 'weekly' | 'manual';
  tutorialComplete: boolean;
  difficulty: Difficulty;
  soundEnabled: boolean;
  soundVolume: number;
  theme: Theme;
  windowMode: WindowMode;

  // Cloud AI provider fields
  aiProvider: AiProvider;
  apiKeyEncoded: string; // base64-encoded API key (never stored in plain text)
  apiEndpoint: string;
  apiModel: string;

  setDefaultSpeed: (speed: number) => void;
  setAiEnabled: (enabled: boolean) => void;
  setAiModel: (model: string) => void;
  setAiSetupCompleted: (done: boolean) => void;
  setAutoSaveInterval: (interval: 'daily' | 'weekly' | 'manual') => void;
  setTutorialComplete: (complete: boolean) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setSoundVolume: (volume: number) => void;
  setTheme: (theme: Theme) => void;
  setWindowMode: (mode: WindowMode) => void;

  setAiProvider: (provider: AiProvider) => void;
  setApiKey: (key: string) => void;
  setApiEndpoint: (endpoint: string) => void;
  setApiModel: (model: string) => void;

  /** Decoded API key (computed from apiKeyEncoded, not persisted separately) */
  getApiKey: () => string;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      defaultSpeed: 1,
      aiEnabled: true,
      aiModel: '',
      aiSetupCompleted: false,
      autoSaveInterval: 'daily',
      tutorialComplete: false,
      difficulty: 'normal',
      soundEnabled: true,
      soundVolume: 0.5,
      theme: 'dark',
      windowMode: 'windowed',

      // Cloud AI provider defaults
      aiProvider: isMobile() ? 'template' : 'ollama',
      apiKeyEncoded: '',
      apiEndpoint: '',
      apiModel: 'gpt-4o-mini',

      setDefaultSpeed: (speed) => set({ defaultSpeed: speed }),
      setAiEnabled: (enabled) => set({ aiEnabled: enabled }),
      setAiModel: (model) => set({ aiModel: model }),
      setAiSetupCompleted: (done) => set({ aiSetupCompleted: done }),
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
      setWindowMode: (mode) => set({ windowMode: mode }),

      setAiProvider: (provider) => set({ aiProvider: provider }),
      setApiKey: (key) => set({ apiKeyEncoded: encodeKey(key) }),
      setApiEndpoint: (endpoint) => set({ apiEndpoint: endpoint }),
      setApiModel: (model) => set({ apiModel: model }),

      getApiKey: () => decodeKey(get().apiKeyEncoded),
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
