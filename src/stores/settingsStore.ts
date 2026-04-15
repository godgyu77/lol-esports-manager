import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';
import { soundManager } from '../audio/soundManager';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type Theme = 'dark' | 'light';
export type WindowMode = 'windowed' | 'fullscreen' | 'borderless';
export type AiProvider = 'ollama' | 'openai' | 'claude' | 'gemini' | 'grok' | 'template';
type CloudAiProvider = Exclude<AiProvider, 'ollama' | 'template'>;

interface StrongholdStoreLike {
  insert: (record: string, data: number[]) => Promise<void>;
  get: (record: string) => Promise<number[] | null>;
  remove: (record: string) => Promise<void>;
}

interface StrongholdClientLike {
  getStore: () => StrongholdStoreLike;
}

interface StrongholdInstanceLike {
  loadClient: (name: string) => Promise<StrongholdClientLike>;
  createClient: (name: string) => Promise<StrongholdClientLike>;
  save: () => Promise<void>;
}

export const isTauriRuntime = (): boolean => {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
};

export const isMobileRuntime = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

const VAULT_PASSWORD = 'lol-esports-manager';
const CLIENT_NAME = 'api-keys';
const API_KEY_RECORDS: Record<CloudAiProvider, string> = {
  openai: 'openai-api-key',
  claude: 'claude-api-key',
  gemini: 'gemini-api-key',
  grok: 'grok-api-key',
};

export function normalizeAiProviderForRuntime(provider: AiProvider): AiProvider {
  if (isMobileRuntime() && provider === 'ollama') {
    return 'template';
  }
  return provider;
}

let strongholdInstance: StrongholdInstanceLike | null = null;
let strongholdClient: StrongholdClientLike | null = null;

function getApiKeyStorageKey(provider: CloudAiProvider): string {
  return `lol-esports-manager:${provider}:api-key`;
}

function getApiKeyFromLocalStorage(provider: CloudAiProvider): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(getApiKeyStorageKey(provider)) ?? '';
  } catch {
    return '';
  }
}

function setApiKeyToLocalStorage(provider: CloudAiProvider, key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getApiKeyStorageKey(provider), key);
  } catch {
    // ignore storage failures and keep runtime stable
  }
}

function removeApiKeyFromLocalStorage(provider: CloudAiProvider): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getApiKeyStorageKey(provider));
  } catch {
    // ignore storage failures and keep runtime stable
  }
}

async function getStrongholdClient(): Promise<StrongholdClientLike> {
  if (strongholdClient) return strongholdClient;
  if (!isTauriRuntime() || isMobileRuntime()) {
    throw new Error('Stronghold unavailable');
  }

  const { appDataDir } = await import('@tauri-apps/api/path');
  const { Stronghold } = await import('@tauri-apps/plugin-stronghold');
  const vaultPath = `${await appDataDir()}/vault.hold`;
  strongholdInstance = await Stronghold.load(vaultPath, VAULT_PASSWORD) as unknown as StrongholdInstanceLike;

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

function isCloudAiProvider(provider: AiProvider): provider is CloudAiProvider {
  return provider !== 'ollama' && provider !== 'template';
}

async function storeApiKeyToVault(provider: AiProvider, key: string): Promise<void> {
  const record = resolveApiKeyRecord(provider);
  if (!record) return;
  if (!isTauriRuntime() || isMobileRuntime()) {
    if (isCloudAiProvider(provider)) {
      setApiKeyToLocalStorage(provider, key);
    }
    return;
  }
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
  if (!isTauriRuntime() || isMobileRuntime()) {
    return isCloudAiProvider(provider) ? getApiKeyFromLocalStorage(provider) : '';
  }
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
  if (!isTauriRuntime() || isMobileRuntime()) {
    if (isCloudAiProvider(provider)) {
      removeApiKeyFromLocalStorage(provider);
    }
    return;
  }
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

export interface SettingsState {
  defaultSpeed: number;
  aiEnabled: boolean;
  aiModel: string;
  aiSetupCompleted: boolean;
  aiSetupSkipped: boolean;
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
  setAiSetupSkipped: (skipped: boolean) => void;
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

const createSettingsState: StateCreator<SettingsState, [], [], SettingsState> = (set) => ({
      defaultSpeed: 0.75,
      aiEnabled: true,
      aiModel: '',
      aiSetupCompleted: false,
      aiSetupSkipped: false,
      autoSaveInterval: 'daily',
      tutorialComplete: false,
      difficulty: 'normal',
      soundEnabled: true,
      soundVolume: 0.5,
      theme: 'dark',
      windowMode: 'windowed',
      aiProvider: 'template',
      hasApiKey: false,
      apiEndpoint: '',
      apiModel: 'gpt-4o-mini',

      setDefaultSpeed: (speed) => set({ defaultSpeed: speed }),
      setAiEnabled: (enabled) => set({ aiEnabled: enabled }),
      setAiModel: (model) => set({ aiModel: model }),
      setAiSetupCompleted: (done) => set({ aiSetupCompleted: done }),
      setAiSetupSkipped: (skipped) => set({ aiSetupSkipped: skipped }),
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
        const nextProvider = normalizeAiProviderForRuntime(provider);
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
    });

export const useSettingsStore = create<SettingsState>()(
  persist<SettingsState, [], [], Partial<SettingsState>>(
    createSettingsState,
    {
      name: 'lol-esports-settings',
      partialize: (state) => ({
        defaultSpeed: state.defaultSpeed,
        aiEnabled: state.aiEnabled,
        aiModel: state.aiModel,
        aiSetupCompleted: state.aiSetupCompleted,
        aiSetupSkipped: state.aiSetupSkipped,
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
          const normalizedProvider = normalizeAiProviderForRuntime(state.aiProvider);
          if (normalizedProvider !== state.aiProvider) {
            state.setAiProvider(normalizedProvider);
          }
          soundManager.setEnabled(state.soundEnabled);
          soundManager.setVolume(state.soundVolume);
          state.initApiKeyStatus(normalizedProvider).catch(() => {});
        }
      },
    },
  ),
);
