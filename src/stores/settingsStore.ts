import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { soundManager } from '../audio/soundManager';
import { Client, Stronghold } from '@tauri-apps/plugin-stronghold';
import { appDataDir } from '@tauri-apps/api/path';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type Theme = 'dark' | 'light';
export type WindowMode = 'windowed' | 'fullscreen' | 'borderless';
export type AiProvider = 'ollama' | 'openai' | 'claude' | 'gemini' | 'grok' | 'template';

const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 480;
};

// ─────────────────────────────────────────
// Stronghold API 키 관리
// ─────────────────────────────────────────

const VAULT_PASSWORD = 'lol-esports-manager';
const CLIENT_NAME = 'api-keys';
const API_KEY_RECORD = 'cloud-api-key';

let strongholdInstance: Stronghold | null = null;
let strongholdClient: Client | null = null;

async function getStrongholdClient(): Promise<Client> {
  if (strongholdClient) return strongholdClient;

  const vaultPath = `${await appDataDir()}/vault.hold`;
  strongholdInstance = await Stronghold.load(vaultPath, VAULT_PASSWORD);

  try {
    strongholdClient = await strongholdInstance.loadClient(CLIENT_NAME);
  } catch {
    strongholdClient = await strongholdInstance.createClient(CLIENT_NAME);
  }

  return strongholdClient;
}

async function storeApiKeyToVault(key: string): Promise<void> {
  const client = await getStrongholdClient();
  const store = client.getStore();
  const data = Array.from(new TextEncoder().encode(key));
  await store.insert(API_KEY_RECORD, data);
  if (strongholdInstance) {
    await strongholdInstance.save();
  }
}

async function getApiKeyFromVault(): Promise<string> {
  try {
    const client = await getStrongholdClient();
    const store = client.getStore();
    const data = await store.get(API_KEY_RECORD);
    if (!data || data.length === 0) return '';
    return new TextDecoder().decode(new Uint8Array(data));
  } catch {
    return '';
  }
}

async function deleteApiKeyFromVault(): Promise<void> {
  try {
    const client = await getStrongholdClient();
    const store = client.getStore();
    await store.remove(API_KEY_RECORD);
    if (strongholdInstance) {
      await strongholdInstance.save();
    }
  } catch {
    // 삭제 실패 무시
  }
}

// ─────────────────────────────────────────
// Settings Store
// ─────────────────────────────────────────

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
  hasApiKey: boolean; // API 키 존재 여부 (Stronghold에 저장됨)
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
  setApiKey: (key: string) => Promise<void>;
  setApiEndpoint: (endpoint: string) => void;
  setApiModel: (model: string) => void;

  /** Stronghold에서 복호화된 API 키 조회 (비동기) */
  getApiKey: () => Promise<string>;

  /** 앱 시작 시 Stronghold에서 키 존재 여부 확인 */
  initApiKeyStatus: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, _get) => ({
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
      hasApiKey: false,
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
      setApiKey: async (key) => {
        if (key) {
          await storeApiKeyToVault(key);
          set({ hasApiKey: true });
        } else {
          await deleteApiKeyFromVault();
          set({ hasApiKey: false });
        }
      },
      setApiEndpoint: (endpoint) => set({ apiEndpoint: endpoint }),
      setApiModel: (model) => set({ apiModel: model }),

      getApiKey: () => getApiKeyFromVault(),

      initApiKeyStatus: async () => {
        const key = await getApiKeyFromVault();
        set({ hasApiKey: !!key });
      },
    }),
    {
      name: 'lol-esports-settings',
      partialize: (state) => ({
        defaultSpeed: state.defaultSpeed,
        aiEnabled: state.aiEnabled,
        aiModel: state.aiModel,
        aiSetupCompleted: state.aiSetupCompleted,
        autoSaveInterval: state.autoSaveInterval,
        tutorialComplete: state.tutorialComplete,
        difficulty: state.difficulty,
        soundEnabled: state.soundEnabled,
        soundVolume: state.soundVolume,
        theme: state.theme,
        windowMode: state.windowMode,
        aiProvider: state.aiProvider,
        hasApiKey: state.hasApiKey,
        apiEndpoint: state.apiEndpoint,
        apiModel: state.apiModel,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          soundManager.setEnabled(state.soundEnabled);
          soundManager.setVolume(state.soundVolume);
          // 앱 시작 시 Stronghold에서 키 존재 여부 확인
          state.initApiKeyStatus().catch(() => {});
        }
      },
    },
  ),
);
