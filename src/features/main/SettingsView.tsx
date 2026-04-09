import type React from 'react';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { checkOllamaStatus, testCloudConnection } from '../../ai/provider';
import { AI_FEATURE_POLICIES, describeProviderExecution, getProviderRecommendation } from '../../ai/featurePolicy';
import { AiSetupWizard } from '../../components/AiSetupWizard';
import { useSettingsStore } from '../../stores/settingsStore';
import type { AiProvider, Difficulty, Theme } from '../../stores/settingsStore';
import type { SettingsState } from '../../stores/settingsStore';
import { isMobileRuntime, normalizeAiProviderForRuntime } from '../../stores/settingsStore';
import './introFlow.css';

const SPEED_OPTIONS = [
  { value: 0.75, label: '집중', desc: '천천히 보면서 경기 흐름을 읽기 좋은 속도입니다.' },
  { value: 1, label: '표준', desc: '가장 무난한 기본 진행 속도입니다.' },
  { value: 1.5, label: '빠르게', desc: '결과 중심으로 시즌을 빠르게 넘길 때 적합합니다.' },
];

const AUTO_SAVE_OPTIONS = [
  { value: 'daily' as const, label: '매일', desc: '하루 일정이 끝날 때마다 자동 저장합니다.' },
  { value: 'weekly' as const, label: '매주', desc: '주간 흐름을 기준으로 저장합니다.' },
  { value: 'manual' as const, label: '수동', desc: '직접 저장할 때만 데이터를 남깁니다.' },
];

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; desc: string; color: string }[] = [
  { value: 'easy', label: '쉬움', desc: '부담 없이 시즌 흐름을 익히기 좋습니다.', color: '#4caf50' },
  { value: 'normal', label: '보통', desc: '균형 잡힌 관리 시뮬레이션 경험입니다.', color: '#f59e0b' },
  { value: 'hard', label: '도전', desc: '강한 압박과 빡빡한 의사결정을 요구합니다.', color: '#ef4444' },
];

const IS_MOBILE = isMobileRuntime();

const AI_PROVIDER_OPTIONS: { value: AiProvider; label: string; desc: string; usage: string }[] = [
  { value: 'template', label: '템플릿만 사용', desc: '설치나 네트워크 없이도 안정적으로 동작합니다.', usage: '가장 가볍고 안정적' },
  ...(!IS_MOBILE ? [{
    value: 'ollama' as AiProvider,
    label: '로컬 Ollama',
    desc: '내 PC에서 직접 실행하는 로컬 AI 방식입니다.',
    usage: '비용 없이 몰입감 강화',
  }] : []),
  { value: 'openai', label: '클라우드 OpenAI', desc: '빠르고 품질 좋은 문장 생성에 강합니다.', usage: '균형형 고품질' },
  { value: 'claude', label: '클라우드 Claude', desc: '자연스러운 설명과 긴 문장에 강점이 있습니다.', usage: '서술형 고품질' },
  { value: 'gemini', label: '클라우드 Gemini', desc: '속도와 품질의 균형이 좋은 편입니다.', usage: '반응형 고품질' },
  { value: 'grok', label: '클라우드 Grok', desc: '대체 클라우드 옵션으로 사용할 수 있습니다.', usage: '추가 클라우드 선택지' },
];

const AVAILABLE_AI_PROVIDER_OPTIONS = AI_PROVIDER_OPTIONS.filter(
  (option) => normalizeAiProviderForRuntime(option.value) === option.value,
);

const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1-nano'];
const CLAUDE_MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250514'];
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash-preview-05-20', 'gemini-2.5-pro-preview-05-06'];
const GROK_MODELS = ['grok-3-mini', 'grok-3'];
const CLOUD_PROVIDERS: AiProvider[] = ['openai', 'claude', 'gemini', 'grok'];

const PRESETS = [
  ['권장 설정', '처음 플레이하는 경우 현재 기본값으로 시작하는 것이 가장 안정적입니다.'],
  ['오프라인 추천', '로컬 AI가 없으면 템플릿만 사용해도 게임은 충분히 자연스럽게 진행됩니다.'],
  ['고품질 AI 추천', 'Ollama나 클라우드 AI를 연결하면 뉴스, 중계, 브리핑 문장이 더 풍부해집니다.'],
] as const;

function getProviderEndpointPlaceholder(provider: AiProvider): string {
  if (provider === 'openai') return 'https://api.openai.com/v1/chat/completions';
  if (provider === 'claude') return 'https://api.anthropic.com/v1/messages';
  if (provider === 'gemini') return 'https://generativelanguage.googleapis.com/v1beta';
  return 'https://api.x.ai/v1/chat/completions';
}

function getPriorityLabel(priority: 'high' | 'medium' | 'low'): string {
  if (priority === 'high') return '높음';
  if (priority === 'medium') return '보통';
  return '낮음';
}

export function SettingsView() {
  const navigate = useNavigate();
  const defaultSpeed = useSettingsStore((s: SettingsState) => s.defaultSpeed);
  const aiEnabled = useSettingsStore((s: SettingsState) => s.aiEnabled);
  const aiModel = useSettingsStore((s: SettingsState) => s.aiModel);
  const aiSetupCompleted = useSettingsStore((s: SettingsState) => s.aiSetupCompleted);
  const aiSetupSkipped = useSettingsStore((s: SettingsState) => s.aiSetupSkipped);
  const autoSaveInterval = useSettingsStore((s: SettingsState) => s.autoSaveInterval);
  const difficulty = useSettingsStore((s: SettingsState) => s.difficulty);
  const soundEnabled = useSettingsStore((s: SettingsState) => s.soundEnabled);
  const soundVolume = useSettingsStore((s: SettingsState) => s.soundVolume);
  const theme = useSettingsStore((s: SettingsState) => s.theme);
  const windowMode = useSettingsStore((s: SettingsState) => s.windowMode);
  const aiProvider = useSettingsStore((s: SettingsState) => s.aiProvider);
  const hasApiKey = useSettingsStore((s: SettingsState) => s.hasApiKey);
  const apiEndpoint = useSettingsStore((s: SettingsState) => s.apiEndpoint);
  const apiModel = useSettingsStore((s: SettingsState) => s.apiModel);
  const setDefaultSpeed = useSettingsStore((s: SettingsState) => s.setDefaultSpeed);
  const setAiEnabled = useSettingsStore((s: SettingsState) => s.setAiEnabled);
  const setAiModel = useSettingsStore((s: SettingsState) => s.setAiModel);
  const setAutoSaveInterval = useSettingsStore((s: SettingsState) => s.setAutoSaveInterval);
  const setDifficulty = useSettingsStore((s: SettingsState) => s.setDifficulty);
  const setSoundEnabled = useSettingsStore((s: SettingsState) => s.setSoundEnabled);
  const setSoundVolume = useSettingsStore((s: SettingsState) => s.setSoundVolume);
  const setTheme = useSettingsStore((s: SettingsState) => s.setTheme);
  const setWindowMode = useSettingsStore((s: SettingsState) => s.setWindowMode);
  const setAiProvider = useSettingsStore((s: SettingsState) => s.setAiProvider);
  const setApiKey = useSettingsStore((s: SettingsState) => s.setApiKey);
  const setApiEndpoint = useSettingsStore((s: SettingsState) => s.setApiEndpoint);
  const setApiModel = useSettingsStore((s: SettingsState) => s.setApiModel);
  const getApiKey = useSettingsStore((s: SettingsState) => s.getApiKey);

  const [ollamaStatus, setOllamaStatus] = useState<boolean | null>(null);
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [showAiWizard, setShowAiWizard] = useState(false);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [dbResetConfirm, setDbResetConfirm] = useState(false);
  const [dbResetting, setDbResetting] = useState(false);
  const [providerKeyStatus, setProviderKeyStatus] = useState<Record<string, boolean>>({});

  const isCloudProvider = aiProvider === 'openai' || aiProvider === 'claude' || aiProvider === 'gemini' || aiProvider === 'grok';
  const modelOptions = aiProvider === 'openai' ? OPENAI_MODELS : aiProvider === 'claude' ? CLAUDE_MODELS : aiProvider === 'gemini' ? GEMINI_MODELS : aiProvider === 'grok' ? GROK_MODELS : [];

  useEffect(() => {
    if (!hasApiKey) return void setApiKeyInput('');
    getApiKey(aiProvider).then((key) => key && setApiKeyInput(key));
  }, [aiProvider, getApiKey, hasApiKey]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(CLOUD_PROVIDERS.map(async (provider) => [provider, !!(await getApiKey(provider))] as const)).then((entries) => {
      if (!cancelled) setProviderKeyStatus(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [aiProvider, getApiKey, hasApiKey]);

  useEffect(() => {
    checkOllamaStatus().then((status) => {
      setOllamaStatus(status);
      if (status && aiProvider === 'ollama') invoke<string[]>('list_models').then(setInstalledModels).catch(() => setInstalledModels([]));
      else setInstalledModels([]);
    });
  }, [aiProvider, deletingModel, showAiWizard]);

  useEffect(() => { setConnectionTestResult(null); }, [aiProvider]);

  const refreshModelList = () => {
    if (!ollamaStatus) return;
    invoke<string[]>('list_models').then(setInstalledModels).catch(() => setInstalledModels([]));
  };

  const handleDeleteModel = async (modelName: string) => {
    if (!window.confirm(`"${modelName}" 모델을 삭제하시겠습니까?\n다시 사용하려면 다시 다운로드해야 합니다.`)) return;
    setDeletingModel(modelName);
    setDeleteMessage(null);
    try {
      await invoke<string>('delete_model', { modelName });
      if (aiModel === modelName) setAiModel('');
      setDeleteMessage({ text: `${modelName} 모델을 삭제했습니다.`, type: 'success' });
      refreshModelList();
    } catch (error) {
      setDeleteMessage({ text: `모델 삭제에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`, type: 'error' });
    } finally {
      setDeletingModel(null);
    }
  };

  const handleDeleteAllModels = async () => {
    if (installedModels.length === 0) return;
    if (!window.confirm(`설치된 모델 ${installedModels.length}개를 모두 삭제하시겠습니까?\n다시 사용하려면 다시 다운로드해야 합니다.`)) return;
    let deleted = 0;
    setDeleteMessage(null);
    for (const model of installedModels) {
      try {
        setDeletingModel(model);
        await invoke<string>('delete_model', { modelName: model });
        deleted += 1;
      } catch {
        // continue
      }
    }
    setDeletingModel(null);
    setAiModel('');
    setDeleteMessage({ text: `${deleted}개 모델을 삭제했습니다.`, type: 'success' });
    refreshModelList();
  };

  const handleProviderChange = (provider: AiProvider) => {
    setAiProvider(provider);
    if (provider === 'openai') setApiModel('gpt-4o-mini');
    if (provider === 'claude') setApiModel('claude-haiku-4-5-20251001');
    if (provider === 'gemini') setApiModel('gemini-2.0-flash');
    if (provider === 'grok') setApiModel('grok-3-mini');
    setAiEnabled(provider !== 'template');
  };

  const handleSaveApiKey = async () => {
    await setApiKey(apiKeyInput.trim());
    setConnectionTestResult(null);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionTestResult(null);
    try {
      setConnectionTestResult(await testCloudConnection());
    } catch (error) {
      setConnectionTestResult({ ok: false, message: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsTesting(false);
    }
  };

  const handleResetDatabase = async () => {
    setDbResetting(true);
    try {
      const { closeDatabase } = await import('../../db/database');
      await closeDatabase();
      const { appDataDir } = await import('@tauri-apps/api/path');
      const { remove } = await import('@tauri-apps/plugin-fs');
      const { exit } = await import('@tauri-apps/plugin-process');
      const dir = await appDataDir();
      await remove(`${dir}/lol_esports_manager.db`).catch(() => {});
      await remove(`${dir}/lol_esports_manager.db-wal`).catch(() => {});
      await remove(`${dir}/lol_esports_manager.db-shm`).catch(() => {});
      await exit(0);
    } catch (error) {
      console.error('[SettingsView] DB reset failed:', error);
      setDbResetting(false);
      setDbResetConfirm(false);
    }
  };

  return (
    <div className="intro-page" style={{ maxWidth: 920, margin: '0 auto', overflowY: 'auto', height: '100vh' }}>
      <div className="fm-page-header">
        <div className="fm-flex fm-items-center fm-gap-md">
          <button className="fm-btn fm-btn--ghost" onClick={() => navigate('/')}>메인 메뉴</button>
          <h1 className="fm-page-title fm-text-accent">환경 설정</h1>
        </div>
      </div>

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header"><span className="fm-panel__title">추천 프리셋</span></div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--3" style={{ gap: 14 }}>
            {PRESETS.map(([title, description]) => (
              <div key={title} className="fm-card">
                <div className="fm-text-sm fm-font-semibold fm-text-primary">{title}</div>
                <div className="fm-text-xs fm-text-muted fm-mt-sm" style={{ lineHeight: 1.6 }}>{description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header"><span className="fm-panel__title">경기 속도</span></div>
        <div className="fm-panel__body">
          <p className="fm-text-sm fm-text-muted fm-mb-md">라이브 경기의 기본 관전 템포를 선택합니다.</p>
          <div className="fm-grid fm-grid--3" style={{ gap: 14 }}>
            {SPEED_OPTIONS.map((speed) => (
              <button key={speed.value} className={`fm-card fm-card--clickable fm-flex-col fm-gap-xs ${defaultSpeed === speed.value ? 'fm-card--highlight' : ''}`} onClick={() => setDefaultSpeed(speed.value)}>
                <span className="fm-text-base fm-font-semibold fm-text-primary">{speed.label}</span>
                <span className="fm-text-xs fm-text-muted" style={{ textAlign: 'left' }}>{speed.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header"><span className="fm-panel__title">난이도</span></div>
        <div className="fm-panel__body">
          <p className="fm-text-sm fm-text-muted fm-mb-md">예산 압박과 운영 난도를 조정합니다.</p>
          <div className="fm-grid fm-grid--3">
            {DIFFICULTY_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`fm-card fm-card--clickable fm-flex-col fm-items-center fm-gap-xs ${difficulty === option.value ? 'fm-card--highlight' : ''}`}
                style={difficulty === option.value ? { borderColor: option.color, background: `${option.color}12` } : undefined}
                onClick={() => setDifficulty(option.value)}
              >
                <span className="fm-text-lg fm-font-bold" style={{ color: difficulty === option.value ? option.color : 'var(--text-primary)' }}>{option.label}</span>
                <span className="fm-text-xs fm-text-muted fm-text-center">{option.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header"><span className="fm-panel__title">AI</span></div>
        <div className="fm-panel__body">
          <div className="fm-info-row">
            <span className="fm-info-row__label">AI 콘텐츠 사용</span>
            <button
              style={{ position: 'relative', width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', padding: 0, background: aiEnabled ? 'var(--accent)' : 'var(--bg-elevated)' }}
              onClick={() => setAiEnabled(!aiEnabled)}
              aria-label="AI 콘텐츠 사용 전환"
            >
              <span style={{ position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: aiEnabled ? 'translateX(20px)' : 'translateX(0)' }} />
            </button>
          </div>

          <div className="fm-mt-md">
            <div className="fm-card fm-mb-md" style={{ padding: 12 }}>
              <div className="fm-flex fm-justify-between fm-items-center fm-gap-sm">
                <div>
                  <div className="fm-text-sm fm-font-semibold fm-text-primary">로컬 AI 자동 준비</div>
                  <div className="fm-text-xs fm-text-muted fm-mt-sm">
                    {aiSetupCompleted
                      ? `권장 로컬 AI가 준비되었습니다.${aiModel ? ` 현재 모델: ${aiModel}` : ''}`
                      : aiSetupSkipped
                        ? '초기 설정에서 AI 준비를 건너뛰었습니다. 필요할 때 다시 실행할 수 있습니다.'
                        : '첫 실행용 AI 준비가 아직 완료되지 않았습니다.'}
                  </div>
                </div>
                <button className="fm-btn fm-btn--sm fm-btn--primary" onClick={() => setShowAiWizard(true)}>
                  {aiSetupCompleted ? '복구/재설치' : 'AI 준비'}
                </button>
              </div>
            </div>
            <span className="fm-text-sm fm-font-semibold fm-text-primary">AI 사용 방식</span>
            <div className="fm-grid fm-grid--2 fm-mt-sm">
              {AVAILABLE_AI_PROVIDER_OPTIONS.map((option) => (
                <button key={option.value} className={`fm-card fm-card--clickable fm-flex-col fm-items-start fm-gap-xs ${aiProvider === option.value ? 'fm-card--highlight' : ''}`} onClick={() => handleProviderChange(option.value)}>
                  <span className="fm-text-base fm-font-semibold fm-text-primary">{option.label}</span>
                  <span className="fm-text-xs fm-text-accent">{option.usage}</span>
                  <span className="fm-text-xs fm-text-muted">{option.desc}</span>
                  <span className="fm-text-xs fm-text-muted">{getProviderRecommendation(option.value)}</span>
                  {CLOUD_PROVIDERS.includes(option.value) && (
                    <span className="fm-text-xs" style={{ color: providerKeyStatus[option.value] ? 'var(--success)' : 'var(--text-muted)' }}>
                      {providerKeyStatus[option.value] ? 'API 키 저장됨' : 'API 키 없음'}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="fm-card fm-mt-sm" style={{ padding: 12 }}>
              <div className="fm-text-sm fm-font-semibold fm-text-primary">현재 실행 정책</div>
              <div className="fm-text-xs fm-text-muted fm-mt-sm">{describeProviderExecution(aiProvider)}</div>
            </div>
          </div>

          {aiProvider === 'ollama' && (
            <div className="fm-mt-md">
              <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
                <span className="fm-text-sm fm-font-semibold fm-text-primary">로컬 모델 관리</span>
                <div className="fm-flex fm-gap-sm">
                  <button className="fm-btn fm-btn--sm" onClick={() => setShowAiWizard(true)}>모델 설치</button>
                  <button className="fm-btn fm-btn--sm" onClick={refreshModelList} disabled={!ollamaStatus}>새로고침</button>
                </div>
              </div>
              <div className={`fm-alert ${ollamaStatus ? 'fm-alert--success' : 'fm-alert--warning'}`}>
                <span className="fm-alert__text">{ollamaStatus ? 'Ollama 연결이 정상입니다.' : 'Ollama가 실행 중이 아니거나 연결할 수 없습니다.'}</span>
              </div>
              {deleteMessage && (
                <div className={`fm-alert fm-mt-sm ${deleteMessage.type === 'success' ? 'fm-alert--success' : 'fm-alert--warning'}`}>
                  <span className="fm-alert__text">{deleteMessage.text}</span>
                </div>
              )}
              {ollamaStatus && (
                <div className="fm-mt-md">
                  <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
                    <span className="fm-text-sm fm-font-semibold fm-text-primary">설치된 모델</span>
                    {installedModels.length > 0 && <button className="fm-btn fm-btn--sm" onClick={() => void handleDeleteAllModels()} disabled={!!deletingModel}>전체 삭제</button>}
                  </div>
                  {installedModels.length === 0 ? (
                    <p className="fm-text-sm fm-text-muted">아직 설치된 로컬 모델이 없습니다.</p>
                  ) : (
                    <div className="fm-flex-col fm-gap-sm">
                      {installedModels.map((model) => (
                        <div key={model} className="fm-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <div className="fm-text-primary fm-font-semibold">{model}</div>
                            <div className="fm-text-xs fm-text-muted">{aiModel === model ? '현재 기본 로컬 모델입니다.' : '설치된 로컬 모델입니다.'}</div>
                          </div>
                          <div className="fm-flex fm-gap-sm">
                            <button className={`fm-btn fm-btn--sm ${aiModel === model ? 'fm-btn--primary' : ''}`} onClick={() => setAiModel(model)}>
                              {aiModel === model ? '사용 중' : '기본값으로 선택'}
                            </button>
                            <button className="fm-btn fm-btn--sm" onClick={() => void handleDeleteModel(model)} disabled={deletingModel === model}>
                              {deletingModel === model ? '삭제 중...' : '삭제'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {isCloudProvider && (
            <div className="fm-mt-md">
              <div className="fm-mb-md">
                <label className="fm-text-sm fm-font-semibold fm-text-primary" style={{ display: 'block', marginBottom: 6 }}>API 키</label>
                <div className="fm-flex fm-gap-sm">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setApiKeyInput(event.target.value)}
                    className="fm-input"
                    style={{ flex: 1 }}
                    placeholder="클라우드 API 키를 입력해 주세요"
                  />
                  <button className="fm-btn" onClick={() => setShowApiKey((prev) => !prev)}>{showApiKey ? '숨기기' : '보기'}</button>
                  <button className="fm-btn fm-btn--primary" onClick={() => void handleSaveApiKey()}>저장</button>
                </div>
              </div>
              <div className="fm-mb-md">
                <label className="fm-text-sm fm-font-semibold fm-text-primary" style={{ display: 'block', marginBottom: 6 }}>모델 선택</label>
                <select className="fm-input" value={apiModel} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setApiModel(event.target.value)} style={{ width: '100%' }}>
                  {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
                </select>
              </div>
              <div className="fm-mb-md">
                <label className="fm-text-sm fm-font-semibold fm-text-primary" style={{ display: 'block', marginBottom: 6 }}>커스텀 엔드포인트</label>
                <input
                  type="text"
                  value={apiEndpoint}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setApiEndpoint(event.target.value)}
                  placeholder={getProviderEndpointPlaceholder(aiProvider)}
                  className="fm-input"
                  style={{ width: '100%', fontFamily: 'monospace' }}
                />
                <p className="fm-text-xs fm-text-muted fm-mt-sm">비워두면 기본 엔드포인트를 사용합니다.</p>
              </div>
              <button className="fm-btn fm-btn--primary" onClick={() => void handleTestConnection()} disabled={isTesting || !hasApiKey}>
                {isTesting ? '연결 확인 중...' : '연결 테스트'}
              </button>
              {connectionTestResult && (
                <div className={`fm-alert fm-mt-sm ${connectionTestResult.ok ? 'fm-alert--success' : 'fm-alert--warning'}`}>
                  <span className="fm-alert__text">{connectionTestResult.message}</span>
                </div>
              )}
            </div>
          )}

          {aiProvider === 'template' && (
            <div className="fm-alert fm-alert--warning fm-mt-md">
              <span className="fm-alert__text">템플릿 모드는 네트워크 연결 없이도 안정적으로 동작합니다.</span>
            </div>
          )}

          <div className="fm-mt-md">
            <span className="fm-text-sm fm-font-semibold fm-text-primary">기능별 AI 정책</span>
            <div className="fm-flex-col fm-gap-sm fm-mt-sm">
              {AI_FEATURE_POLICIES.map((policy) => (
                <div key={policy.id} className="fm-card" style={{ padding: 12 }}>
                  <div className="fm-flex fm-justify-between fm-items-center fm-gap-sm">
                    <span className="fm-text-sm fm-font-semibold fm-text-primary">{policy.label}</span>
                    <span className="fm-text-xs fm-text-muted">우선순위: {getPriorityLabel(policy.priority)}</span>
                  </div>
                  <div className="fm-text-xs fm-text-muted fm-mt-sm">{policy.note}</div>
                  <div className="fm-flex fm-gap-sm fm-mt-sm" style={{ flexWrap: 'wrap' }}>
                    <span className="fm-badge">로컬 우선: {policy.localFirst ? '예' : '아니오'}</span>
                    <span className="fm-badge">클라우드 허용: {policy.cloudAllowed ? '예' : '아니오'}</span>
                    <span className="fm-badge">템플릿 폴백: {policy.templateFallback ? '예' : '아니오'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header"><span className="fm-panel__title">사운드</span></div>
        <div className="fm-panel__body">
          <p className="fm-text-sm fm-text-muted fm-mb-md">배경음과 효과음 볼륨을 조절합니다.</p>
          <div className="fm-info-row">
            <span className="fm-info-row__label">사운드 사용</span>
            <button
              style={{ position: 'relative', width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', padding: 0, background: soundEnabled ? 'var(--accent)' : 'var(--bg-elevated)' }}
              onClick={() => setSoundEnabled(!soundEnabled)}
              aria-label="사운드 사용 전환"
            >
              <span style={{ position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: soundEnabled ? 'translateX(20px)' : 'translateX(0)' }} />
            </button>
          </div>
          <div className="fm-mt-md">
            <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
              <span className="fm-text-base fm-text-primary">볼륨</span>
              <span className="fm-text-sm fm-text-secondary">{Math.round(soundVolume * 100)}%</span>
            </div>
            <input type="range" min="0" max="100" value={Math.round(soundVolume * 100)} onChange={(event) => setSoundVolume(Number(event.target.value) / 100)} disabled={!soundEnabled} style={{ width: '100%', accentColor: 'var(--accent)', opacity: soundEnabled ? 1 : 0.4 }} aria-label="볼륨 조절" />
          </div>
        </div>
      </div>

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header"><span className="fm-panel__title">화면</span></div>
        <div className="fm-panel__body">
          <div className="fm-mb-md">
            <span className="fm-text-sm fm-font-semibold fm-text-primary">테마</span>
            <div className="fm-flex fm-gap-sm fm-mt-sm">
              {([{ value: 'dark' as Theme, label: '다크' }, { value: 'light' as Theme, label: '라이트' }]).map((option) => (
                <button key={option.value} className={`fm-btn ${theme === option.value ? 'fm-btn--primary' : ''}`} onClick={() => setTheme(option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="fm-text-sm fm-font-semibold fm-text-primary">창 모드</span>
            <div className="fm-flex fm-gap-sm fm-mt-sm">
              {(['windowed', 'fullscreen', 'borderless'] as const).map((mode) => (
                <button
                  key={mode}
                  className={`fm-btn ${windowMode === mode ? 'fm-btn--primary' : ''}`}
                  onClick={async () => {
                    setWindowMode(mode);
                    const { applyWindowMode } = await import('../../utils/windowManager');
                    await applyWindowMode(mode);
                  }}
                >
                  {mode === 'windowed' ? '창 모드' : mode === 'fullscreen' ? '전체 화면' : '테두리 없음'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header"><span className="fm-panel__title">저장</span></div>
        <div className="fm-panel__body">
          <p className="fm-text-sm fm-text-muted fm-mb-md">진행 데이터를 저장하는 주기를 선택합니다.</p>
          <div className="fm-grid fm-grid--3">
            {AUTO_SAVE_OPTIONS.map((option) => (
              <button key={option.value} className={`fm-card fm-card--clickable fm-flex-col fm-items-start fm-gap-xs ${autoSaveInterval === option.value ? 'fm-card--highlight' : ''}`} onClick={() => setAutoSaveInterval(option.value)}>
                <span className="fm-text-base fm-font-semibold fm-text-primary">{option.label}</span>
                <span className="fm-text-xs fm-text-muted" style={{ textAlign: 'left' }}>{option.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header"><span className="fm-panel__title">데이터 관리</span></div>
        <div className="fm-panel__body">
          <p className="fm-text-sm fm-text-muted fm-mb-md">데이터베이스를 초기화하면 저장된 선수, 팀, 경기 진행 상태가 모두 삭제됩니다.</p>
          {!dbResetConfirm ? (
            <button className="fm-btn" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={() => setDbResetConfirm(true)}>
              데이터베이스 초기화
            </button>
          ) : (
            <div className="fm-flex fm-gap-sm fm-items-center">
              <span className="fm-text-sm" style={{ color: '#ef4444' }}>정말 초기화하시겠습니까? 모든 데이터가 삭제됩니다.</span>
              <button className="fm-btn" style={{ background: '#ef4444', color: '#fff', borderColor: '#ef4444' }} disabled={dbResetting} onClick={() => void handleResetDatabase()}>
                {dbResetting ? '초기화 중...' : '확인'}
              </button>
              <button className="fm-btn" onClick={() => setDbResetConfirm(false)} disabled={dbResetting}>취소</button>
            </div>
          )}
        </div>
      </div>

      <div className="fm-panel fm-mb-lg">
        <div className="fm-panel__header"><span className="fm-panel__title">게임 정보</span></div>
        <div className="fm-panel__body">
          <div className="fm-info-row"><span className="fm-info-row__label">버전</span><span className="fm-info-row__value">{__APP_VERSION__}</span></div>
          <div className="fm-info-row"><span className="fm-info-row__label">프런트엔드</span><span className="fm-info-row__value">React 19 + TypeScript 5.9 + Vite 8</span></div>
          <div className="fm-info-row"><span className="fm-info-row__label">백엔드</span><span className="fm-info-row__value">Tauri 2 (Rust)</span></div>
          <div className="fm-info-row">
            <span className="fm-info-row__label">AI 엔진</span>
            <span className="fm-info-row__value">
              {aiProvider === 'ollama'
                ? `Ollama (${aiModel || '모델 미선택'})`
                : aiProvider === 'openai'
                  ? `OpenAI (${apiModel})`
                  : aiProvider === 'claude'
                    ? `Claude (${apiModel})`
                    : aiProvider === 'gemini'
                      ? `Gemini (${apiModel})`
                      : aiProvider === 'grok'
                        ? `Grok (${apiModel})`
                        : '템플릿 모드'}
            </span>
          </div>
          <div className="fm-info-row"><span className="fm-info-row__label">데이터베이스</span><span className="fm-info-row__value">SQLite</span></div>
        </div>
      </div>

      {showAiWizard && <AiSetupWizard onComplete={() => { setShowAiWizard(false); refreshModelList(); }} />}
    </div>
  );
}
