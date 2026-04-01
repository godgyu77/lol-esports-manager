import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { soundManager } from '../audio/soundManager';
import { Client, Stronghold } from '@tauri-apps/plugin-stronghold';
import { appDataDir } from '@tauri-apps/api/path';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type Theme = 'dark' | 'light';
export type WindowMode = 'windowed' | 'fullscreen' | 'borderless';
export type AiProvider = 'ollama' | 'openai' | 'claude' | 'gemini' | 'grok' | 'template';
type CloudAiProvider = Exclude<AiProvider, 'ollama' | 'template'>;

export const isMobileRuntime = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 480;
};

const VAULT_PASSWORD = 'lol-esports-manager';
const CLIENT_NAME = 'api-keys';
const API_KEY_RECORDS: Record<CloudAiProvider, string> = {
  openai: 'openai-api-key',
  claude: 'claude-api-key',
  gemini: 'gemini-api-key',
  grok: 'grok-api-key',
};

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

function resolveApiKeyRecord(provider: AiProvider): string | null {
  if (provider === 'ollama' || provider === 'template') return null;
  return API_KEY_RECORDS[provider];
}

async function storeApiKeyToVault(provider: AiProvider, key: string): Promise<void> {
  const record = resolveApiKeyRecord(provider);
  if (!record) return;
  const client = await getStrongholdClient();
  const store = client.getStore();
  const data = Array.from(new TextEncoder().encode(key));
  await store.insert(record, data);
  if (strongholdInstance) {
    await strongholdInstance.save();
  }
}

async function getApiKeyFromVault(provider: AiProvider): Promise<string> {
  const record = resolveApiKeyRecord(provider);
  if (!record) return '';
  try {
    const client = await getStrongholdClient();
    const store = client.getStore();
    const data = await store.get(record);
    if (!data || data.length === 0) return '';
    return new TextDecoder().decode(new Uint8Array(data));
  } catch {
    return '';
  }
}

async function deleteApiKeyFromVault(provider: AiProvider): Promise<void> {
  const record = resolveApiKeyRecord(provider);
  if (!record) return;
  try {
    const client = await getStrongholdClient();
    const store = client.getStore();
    await store.remove(record);
    if (strongholdInstance) {
      await strongholdInstance.save();
    }
  } catch {
    // 삭제 실패는 무시한다.
  }
}

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
  aiProvider: AiProvider;
  hasApiKey: boolean;
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
  setApiKey: (key: string, provider?: AiProvider) => Promise<void>;
  setApiEndpoint: (endpoint: string) => void;
  setApiModel: (model: string) => void;
  getApiKey: (provider?: AiProvider) => Promise<string>;
  initApiKeyStatus: (provider?: AiProvider) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultSpeed: 0.75,
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
      aiProvider: isMobileRuntime() ? 'template' : 'ollama',
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
      setAiProvider: (provider) => {
        const nextProvider = isMobileRuntime() && provider === 'ollama' ? 'template' : provider;
        set({ aiProvider: nextProvider });
        void getApiKeyFromVault(nextProvider).then((key) => {
          set({ hasApiKey: !!key });
        });
      },
      setApiKey: async (key, provider = useSettingsStore.getState().aiProvider) => {
        if (key) {
          await storeApiKeyToVault(provider, key);
          set({ hasApiKey: true });
        } else {
          await deleteApiKeyFromVault(provider);
          set({ hasApiKey: false });
        }
      },
      setApiEndpoint: (endpoint) => set({ apiEndpoint: endpoint }),
      setApiModel: (model) => set({ apiModel: model }),
      getApiKey: (provider = useSettingsStore.getState().aiProvider) => getApiKeyFromVault(provider),
      initApiKeyStatus: async (provider = useSettingsStore.getState().aiProvider) => {
        const key = await getApiKeyFromVault(provider);
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
          state.initApiKeyStatus().catch(() => {});
        }
      },
    },
  ),
);
