import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../stores/settingsStore';
import type { AiProvider, Difficulty, Theme } from '../../stores/settingsStore';
import { checkOllamaStatus, testCloudConnection } from '../../ai/provider';
import { AiSetupWizard } from '../../components/AiSetupWizard';

const SPEED_OPTIONS = [1, 2, 4];
const AUTO_SAVE_OPTIONS: { value: 'daily' | 'weekly' | 'manual'; label: string }[] = [
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'manual', label: '수동' },
];
const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; desc: string; color: string }[] = [
  { value: 'easy', label: '쉬움', desc: 'AI 이적 약화, 승률 보정, 예산 130%', color: '#4caf50' },
  { value: 'normal', label: '보통', desc: '기본 밸런스', color: '#f59e0b' },
  { value: 'hard', label: '어려움', desc: 'AI 이적 강화, 승률 불리, 예산 80%', color: '#ef4444' },
];

const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const AI_PROVIDER_OPTIONS: { value: AiProvider; label: string; desc: string }[] = [
  { value: 'template', label: '템플릿 모드 (오프라인)', desc: '사전 정의된 템플릿으로 동작' },
  ...(!IS_MOBILE ? [{ value: 'ollama' as AiProvider, label: 'Ollama (로컬)', desc: '로컬 LLM 서버 사용' }] : []),
  { value: 'openai', label: 'OpenAI API', desc: 'GPT-4o, GPT-4.1 등 사용' },
  { value: 'claude', label: 'Claude API', desc: 'Anthropic Claude 사용' },
  { value: 'gemini', label: 'Gemini API', desc: 'Google Gemini 사용' },
  { value: 'grok', label: 'Grok API (xAI)', desc: 'xAI Grok 사용' },
];

const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1-nano'];
const CLAUDE_MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250514'];
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash-preview-05-20', 'gemini-2.5-pro-preview-05-06'];
const GROK_MODELS = ['grok-3-mini', 'grok-3'];

export function SettingsView() {
  const navigate = useNavigate();
  const defaultSpeed = useSettingsStore((s) => s.defaultSpeed);
  const aiEnabled = useSettingsStore((s) => s.aiEnabled);
  const autoSaveInterval = useSettingsStore((s) => s.autoSaveInterval);
  const difficulty = useSettingsStore((s) => s.difficulty);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const soundVolume = useSettingsStore((s) => s.soundVolume);
  const theme = useSettingsStore((s) => s.theme);
  const setDefaultSpeed = useSettingsStore((s) => s.setDefaultSpeed);
  const setAiEnabled = useSettingsStore((s) => s.setAiEnabled);
  const setAutoSaveInterval = useSettingsStore((s) => s.setAutoSaveInterval);
  const setDifficulty = useSettingsStore((s) => s.setDifficulty);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);
  const setSoundVolume = useSettingsStore((s) => s.setSoundVolume);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const windowMode = useSettingsStore((s) => s.windowMode);
  const setWindowMode = useSettingsStore((s) => s.setWindowMode);

  const aiModel = useSettingsStore((s) => s.aiModel);

  // Cloud AI provider state
  const aiProvider = useSettingsStore((s) => s.aiProvider);
  const hasApiKey = useSettingsStore((s) => s.hasApiKey);
  const apiEndpoint = useSettingsStore((s) => s.apiEndpoint);
  const apiModel = useSettingsStore((s) => s.apiModel);
  const setAiProvider = useSettingsStore((s) => s.setAiProvider);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const setApiEndpoint = useSettingsStore((s) => s.setApiEndpoint);
  const setApiModel = useSettingsStore((s) => s.setApiModel);
  const getApiKey = useSettingsStore((s) => s.getApiKey);

  const [ollamaStatus, setOllamaStatus] = useState<boolean | null>(null);
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [showAiWizard, setShowAiWizard] = useState(false);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Cloud API UI state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [dbResetConfirm, setDbResetConfirm] = useState(false);
  const [dbResetting, setDbResetting] = useState(false);

  const isCloudProvider = aiProvider === 'openai' || aiProvider === 'claude' || aiProvider === 'gemini' || aiProvider === 'grok';

  // Initialize API key input from Stronghold
  useEffect(() => {
    if (hasApiKey) {
      getApiKey().then((key) => {
        if (key) setApiKeyInput(key);
      });
    }
  }, [hasApiKey, getApiKey]);

  useEffect(() => {
    checkOllamaStatus().then((status) => {
      setOllamaStatus(status);
      if (status && aiProvider === 'ollama') {
        invoke<string[]>('list_models')
          .then(setInstalledModels)
          .catch(() => setInstalledModels([]));
      }
    });
  }, [showAiWizard, aiProvider, deletingModel]);

  // Reset connection test when provider changes
  useEffect(() => {
    setConnectionTestResult(null);
  }, [aiProvider]);

  const refreshModelList = () => {
    if (ollamaStatus) {
      invoke<string[]>('list_models')
        .then(setInstalledModels)
        .catch(() => setInstalledModels([]));
    }
  };

  const handleDeleteModel = async (modelName: string) => {
    const confirmed = window.confirm(
      `"${modelName}" 모델을 삭제하시겠습니까?\n\n삭제하면 다시 다운로드해야 합니다.`
    );
    if (!confirmed) return;

    setDeletingModel(modelName);
    setDeleteMessage(null);
    try {
      await invoke<string>('delete_model', { modelName });
      setDeleteMessage({ text: `${modelName} 모델이 삭제되었습니다.`, type: 'success' });
      // 현재 모델이 삭제된 경우 초기화
      if (aiModel === modelName) {
        useSettingsStore.getState().setAiModel('');
      }
      refreshModelList();
    } catch (err) {
      setDeleteMessage({
        text: `삭제 실패: ${err instanceof Error ? err.message : String(err)}`,
        type: 'error',
      });
    } finally {
      setDeletingModel(null);
    }
  };

  const handleDeleteAllModels = async () => {
    if (installedModels.length === 0) return;
    const confirmed = window.confirm(
      `설치된 모든 AI 모델(${installedModels.length}개)을 삭제하시겠습니까?\n\n총 용량이 해제됩니다. 다시 사용하려면 재다운로드가 필요합니다.`
    );
    if (!confirmed) return;

    setDeleteMessage(null);
    let deleted = 0;
    for (const model of installedModels) {
      try {
        setDeletingModel(model);
        await invoke<string>('delete_model', { modelName: model });
        deleted++;
      } catch { /* 개별 실패 무시 */ }
    }
    setDeletingModel(null);
    useSettingsStore.getState().setAiModel('');
    setDeleteMessage({ text: `${deleted}개 모델이 삭제되었습니다.`, type: 'success' });
    refreshModelList();
  };

  const handleProviderChange = (provider: AiProvider) => {
    setAiProvider(provider);

    // Set sensible default model when switching providers
    if (provider === 'openai') {
      setApiModel('gpt-4o-mini');
    } else if (provider === 'claude') {
      setApiModel('claude-haiku-4-5-20251001');
    } else if (provider === 'gemini') {
      setApiModel('gemini-2.0-flash');
    } else if (provider === 'grok') {
      setApiModel('grok-3-mini');
    }

    // Auto-enable/disable AI based on provider
    if (provider === 'template') {
      setAiEnabled(false);
    } else {
      setAiEnabled(true);
    }
  };

  const handleSaveApiKey = async () => {
    await setApiKey(apiKeyInput);
    setConnectionTestResult(null);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionTestResult(null);
    try {
      const result = await testCloudConnection();
      setConnectionTestResult(result);
    } catch (error) {
      setConnectionTestResult({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const modelOptions =
    aiProvider === 'openai' ? OPENAI_MODELS :
    aiProvider === 'claude' ? CLAUDE_MODELS :
    aiProvider === 'gemini' ? GEMINI_MODELS :
    aiProvider === 'grok' ? GROK_MODELS :
    [];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 20, overflowY: 'auto', height: '100vh' }}>
      {/* Header */}
      <div className="fm-page-header">
        <div className="fm-flex fm-items-center fm-gap-md">
          <button className="fm-btn fm-btn--ghost" onClick={() => navigate('/')}>
            ← 메인 메뉴
          </button>
          <h1 className="fm-page-title fm-text-accent">설정</h1>
        </div>
      </div>

      {/* 경기 속도 기본값 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">경기 속도 기본값</span>
        </div>
        <div className="fm-panel__body">
          <p className="fm-text-sm fm-text-muted fm-mb-md">
            라이브 경기 시작 시 기본 재생 속도를 설정합니다.
          </p>
          <div className="fm-flex fm-gap-sm">
            {SPEED_OPTIONS.map((speed) => (
              <button
                key={speed}
                className={`fm-btn ${defaultSpeed === speed ? 'fm-btn--primary' : ''}`}
                onClick={() => setDefaultSpeed(speed)}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 난이도 설정 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">난이도 설정</span>
        </div>
        <div className="fm-panel__body">
          <p className="fm-text-sm fm-text-muted fm-mb-md">
            게임 전반의 난이도를 설정합니다. 진행 중인 세이브에도 즉시 적용됩니다.
          </p>
          <div className="fm-grid fm-grid--3">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`fm-card fm-card--clickable fm-flex-col fm-items-center fm-gap-xs ${
                  difficulty === opt.value ? 'fm-card--highlight' : ''
                }`}
                style={
                  difficulty === opt.value
                    ? { borderColor: opt.color, background: `${opt.color}12` }
                    : undefined
                }
                onClick={() => setDifficulty(opt.value)}
              >
                <span
                  className="fm-text-lg fm-font-bold"
                  style={{ color: difficulty === opt.value ? opt.color : 'var(--text-primary)' }}
                >
                  {opt.label}
                </span>
                <span className="fm-text-xs fm-text-muted fm-text-center">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI 사용 설정 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">AI 사용 설정</span>
        </div>
        <div className="fm-panel__body">
          {/* Ollama 연결 상태 */}
          <div className="fm-info-row">
            <span className="fm-info-row__label">Ollama 연결 상태</span>
            <span className="fm-flex fm-items-center fm-gap-xs">
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  display: 'inline-block',
                  background: ollamaStatus ? 'var(--success)' : 'var(--danger)',
                  boxShadow: ollamaStatus ? '0 0 6px var(--success)' : 'none',
                }}
              />
              <span className="fm-text-sm fm-text-secondary">
                {ollamaStatus === null
                  ? '확인 중...'
                  : ollamaStatus
                    ? '연결됨'
                    : '오프라인'}
              </span>
            </span>
          </div>

          {/* AI 기능 사용 토글 */}
          <div className="fm-info-row">
            <span className="fm-info-row__label">AI 기능 사용</span>
            <button
              className="fm-settings-toggle"
              style={{
                position: 'relative',
                width: 44,
                height: 24,
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'background 0.2s',
                background: aiEnabled ? 'var(--accent)' : 'var(--bg-elevated)',
              }}
              onClick={() => setAiEnabled(!aiEnabled)}
              aria-label="AI 기능 토글"
            >
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  left: 2,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'transform 0.2s',
                  transform: aiEnabled ? 'translateX(20px)' : 'translateX(0)',
                }}
              />
            </button>
          </div>

          {!aiEnabled && (
            <div className="fm-alert fm-alert--warning fm-mt-sm">
              <span className="fm-alert__icon">!</span>
              <span className="fm-alert__text">AI가 비활성화되면 템플릿 기반 모드로 동작합니다.</span>
            </div>
          )}

          {/* 현재 모델 정보 */}
          <div className="fm-divider" />

          <div className="fm-info-row">
            <span className="fm-info-row__label">현재 모델</span>
            <span className={`fm-text-sm fm-text-mono ${aiModel ? 'fm-text-accent' : 'fm-text-muted'}`}>
              {aiModel || '설정되지 않음'}
            </span>
          </div>

          {/* 설치된 모델 목록 + 개별 삭제 */}
          {installedModels.length > 0 && (
            <div className="fm-mt-md">
              <span className="fm-text-sm fm-text-muted fm-mb-sm" style={{ display: 'block' }}>
                설치된 모델 ({installedModels.length}개)
              </span>
              {installedModels.map((model) => (
                <div
                  key={model}
                  className="fm-flex fm-items-center fm-justify-between fm-mb-xs"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'var(--bg-elevated)',
                    border: model === aiModel ? '1px solid var(--accent)' : '1px solid var(--border)',
                  }}
                >
                  <div className="fm-flex fm-items-center fm-gap-sm">
                    <span className="fm-text-sm fm-text-mono fm-text-secondary">{model}</span>
                    {model === aiModel && (
                      <span className="fm-badge fm-badge--success" style={{ fontSize: 10, padding: '1px 6px' }}>사용 중</span>
                    )}
                  </div>
                  <button
                    className="fm-btn fm-btn--ghost"
                    style={{ padding: '4px 8px', fontSize: 11, color: 'var(--danger)' }}
                    onClick={() => handleDeleteModel(model)}
                    disabled={deletingModel === model}
                  >
                    {deletingModel === model ? '삭제 중...' : '삭제'}
                  </button>
                </div>
              ))}

              <button
                className="fm-btn fm-mt-sm"
                style={{ width: '100%', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={handleDeleteAllModels}
                disabled={deletingModel !== null}
              >
                모든 모델 삭제
              </button>
            </div>
          )}

          {deleteMessage && (
            <div className={`fm-alert fm-mt-sm ${deleteMessage.type === 'success' ? 'fm-alert--success' : 'fm-alert--danger'}`}>
              <span className="fm-alert__text">{deleteMessage.text}</span>
            </div>
          )}

          <button
            className="fm-btn fm-btn--lg fm-mt-md"
            style={{ width: '100%' }}
            onClick={() => setShowAiWizard(true)}
          >
            모델 변경 / 다운로드
          </button>

          <p className="fm-text-xs fm-text-muted fm-mt-sm">
            모델 저장 경로: C:\Users\{'{사용자}'}\.ollama\models\ — 앱 삭제 시 자동으로 제거되지 않습니다.
          </p>
        </div>
      </div>

      {/* AI 설정 마법사 모달 */}
      {showAiWizard && (
        <AiSetupWizard
          onComplete={() => {
            setShowAiWizard(false);
          }}
        />
      )}

      {/* AI 제공자 설정 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">AI 제공자</span>
        </div>
        <div className="fm-panel__body">
          <p className="fm-text-sm fm-text-muted fm-mb-md">
            AI 엔진을 선택합니다. 모바일 기기에서는 클라우드 API를 사용하세요.
          </p>

          {/* Provider selector */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              marginBottom: 16,
            }}
          >
            {AI_PROVIDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`fm-card fm-card--clickable fm-flex-col fm-items-center fm-gap-xs ${
                  aiProvider === opt.value ? 'fm-card--highlight' : ''
                }`}
                style={
                  aiProvider === opt.value
                    ? {
                        borderColor: 'var(--accent)',
                        background: 'var(--accent-bg, rgba(59, 130, 246, 0.08))',
                      }
                    : { cursor: 'pointer' }
                }
                onClick={() => handleProviderChange(opt.value)}
              >
                <span
                  className="fm-text-sm fm-font-bold"
                  style={{
                    color:
                      aiProvider === opt.value ? 'var(--accent)' : 'var(--text-primary)',
                  }}
                >
                  {opt.label}
                </span>
                <span className="fm-text-xs fm-text-muted fm-text-center">{opt.desc}</span>
              </button>
            ))}
          </div>

          {/* Cloud provider settings (only shown for openai/claude) */}
          {isCloudProvider && (
            <>
              <div className="fm-divider" />

              {/* API Key */}
              <div style={{ marginBottom: 12 }}>
                <label className="fm-text-sm fm-text-primary" style={{ display: 'block', marginBottom: 4 }}>
                  API 키
                </label>
                <div className="fm-flex fm-gap-xs fm-items-center">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKeyInput(e.target.value)}
                    placeholder={
                      aiProvider === 'openai' ? 'sk-...' :
                      aiProvider === 'claude' ? 'sk-ant-...' :
                      aiProvider === 'gemini' ? 'AIza...' :
                      'xai-...'
                    }
                    className="fm-input"
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      fontFamily: 'monospace',
                    }}
                    aria-label="API 키 입력"
                  />
                  <button
                    className="fm-btn fm-btn--ghost"
                    style={{ padding: '6px 8px', fontSize: 12, whiteSpace: 'nowrap' }}
                    onClick={() => setShowApiKey(!showApiKey)}
                    aria-label={showApiKey ? 'API 키 숨기기' : 'API 키 보기'}
                  >
                    {showApiKey ? '숨기기' : '보기'}
                  </button>
                  <button
                    className="fm-btn fm-btn--primary"
                    style={{ padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap' }}
                    onClick={handleSaveApiKey}
                    disabled={!apiKeyInput}
                  >
                    저장
                  </button>
                </div>
                <p className="fm-text-xs fm-text-muted" style={{ marginTop: 4 }}>
                  API 키는 로컬에 인코딩되어 저장됩니다. 서버로 전송되지 않습니다.
                </p>
              </div>

              {/* API Model */}
              <div style={{ marginBottom: 12 }}>
                <label className="fm-text-sm fm-text-primary" style={{ display: 'block', marginBottom: 4 }}>
                  API 모델
                </label>
                <div className="fm-flex fm-gap-xs fm-items-center">
                  <select
                    value={modelOptions.includes(apiModel) ? apiModel : ''}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      if (e.target.value) setApiModel(e.target.value);
                    }}
                    className="fm-select"
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                    aria-label="모델 선택"
                  >
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <span className="fm-text-xs fm-text-muted" style={{ whiteSpace: 'nowrap' }}>
                    또는
                  </span>
                  <input
                    type="text"
                    value={!modelOptions.includes(apiModel) ? apiModel : ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiModel(e.target.value)}
                    placeholder="커스텀 모델명"
                    className="fm-input"
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                    aria-label="커스텀 모델 입력"
                  />
                </div>
              </div>

              {/* Custom Endpoint */}
              <div style={{ marginBottom: 12 }}>
                <label className="fm-text-sm fm-text-primary" style={{ display: 'block', marginBottom: 4 }}>
                  커스텀 엔드포인트 (선택)
                </label>
                <input
                  type="text"
                  value={apiEndpoint}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiEndpoint(e.target.value)}
                  placeholder={
                    aiProvider === 'openai' ? 'https://api.openai.com/v1/chat/completions' :
                    aiProvider === 'claude' ? 'https://api.anthropic.com/v1/messages' :
                    aiProvider === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' :
                    'https://api.x.ai/v1/chat/completions'
                  }
                  className="fm-input"
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontFamily: 'monospace',
                  }}
                  aria-label="커스텀 엔드포인트 입력"
                />
                <p className="fm-text-xs fm-text-muted" style={{ marginTop: 4 }}>
                  비워두면 기본 엔드포인트를 사용합니다. OpenAI 호환 프록시 사용 시 입력하세요.
                </p>
              </div>

              {/* Connection Test */}
              <div className="fm-divider" />
              <div className="fm-flex fm-gap-sm fm-items-center fm-mt-sm">
                <button
                  className="fm-btn fm-btn--lg"
                  style={{ flex: 1 }}
                  onClick={handleTestConnection}
                  disabled={isTesting || !hasApiKey}
                >
                  {isTesting ? '테스트 중...' : '연결 테스트'}
                </button>
              </div>

              {connectionTestResult && (
                <div
                  className={`fm-alert fm-mt-sm ${
                    connectionTestResult.ok ? 'fm-alert--success' : 'fm-alert--warning'
                  }`}
                >
                  <span className="fm-alert__icon">
                    {connectionTestResult.ok ? '✓' : '!'}
                  </span>
                  <span className="fm-alert__text">{connectionTestResult.message}</span>
                </div>
              )}
            </>
          )}

          {/* Template mode info */}
          {aiProvider === 'template' && (
            <div className="fm-alert fm-alert--warning fm-mt-sm">
              <span className="fm-alert__icon">!</span>
              <span className="fm-alert__text">
                템플릿 모드에서는 LLM 없이 사전 정의된 응답으로 동작합니다.
                모바일 기기에서 오프라인 플레이 시 적합합니다.
              </span>
            </div>
          )}

          {/* Ollama mode info */}
          {aiProvider === 'ollama' && !ollamaStatus && (
            <div className="fm-alert fm-alert--warning fm-mt-sm">
              <span className="fm-alert__icon">!</span>
              <span className="fm-alert__text">
                Ollama가 연결되지 않았습니다. Ollama를 설치하고 실행해주세요.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 사운드 설정 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">사운드 설정</span>
        </div>
        <div className="fm-panel__body">
          <p className="fm-text-sm fm-text-muted fm-mb-md">
            BGM 및 효과음 볼륨을 설정합니다. (public/audio/ 폴더에 음악 파일 배치)
          </p>

          <div className="fm-info-row">
            <span className="fm-info-row__label">효과음</span>
            <button
              style={{
                position: 'relative',
                width: 44,
                height: 24,
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'background 0.2s',
                background: soundEnabled ? 'var(--accent)' : 'var(--bg-elevated)',
              }}
              onClick={() => setSoundEnabled(!soundEnabled)}
              aria-label="효과음 토글"
            >
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  left: 2,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'transform 0.2s',
                  transform: soundEnabled ? 'translateX(20px)' : 'translateX(0)',
                }}
              />
            </button>
          </div>

          <div className="fm-mt-md">
            <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
              <span className="fm-text-base fm-text-primary">볼륨</span>
              <span className="fm-text-sm fm-text-secondary">{Math.round(soundVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(soundVolume * 100)}
              onChange={(e) => setSoundVolume(Number(e.target.value) / 100)}
              disabled={!soundEnabled}
              style={{
                width: '100%',
                accentColor: 'var(--accent)',
                opacity: soundEnabled ? 1 : 0.4,
              }}
              aria-label="볼륨 조절"
            />
          </div>
        </div>
      </div>

      {/* 테마 설정 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">테마 설정</span>
        </div>
        <div className="fm-panel__body">
          <p className="fm-text-sm fm-text-muted fm-mb-md">화면 테마를 변경합니다.</p>
          <div className="fm-flex fm-gap-sm">
            {([
              { value: 'dark' as Theme, label: '다크' },
              { value: 'light' as Theme, label: '라이트' },
            ]).map((opt) => (
              <button
                key={opt.value}
                className={`fm-btn ${theme === opt.value ? 'fm-btn--primary' : ''}`}
                onClick={() => setTheme(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 자동 저장 간격 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">자동 저장 간격</span>
        </div>
        <div className="fm-panel__body">
          <p className="fm-text-sm fm-text-muted fm-mb-md">게임 내 자동 저장 주기를 설정합니다.</p>
          <div className="fm-flex fm-gap-sm">
            {AUTO_SAVE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`fm-btn ${autoSaveInterval === opt.value ? 'fm-btn--primary' : ''}`}
                onClick={() => setAutoSaveInterval(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 화면 모드 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">화면 모드</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-flex fm-gap-sm">
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
                {mode === 'windowed' ? '창 모드' : mode === 'fullscreen' ? '전체 화면' : '테두리 없는 창'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 데이터 관리 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">데이터 관리</span>
        </div>
        <div className="fm-panel__body">
          <p className="fm-text-sm fm-text-muted fm-mb-md">
            데이터베이스를 초기화하면 모든 게임 데이터(세이브, 선수, 팀 등)가 삭제됩니다.
          </p>
          {!dbResetConfirm ? (
            <button
              className="fm-btn"
              style={{ color: '#ef4444', borderColor: '#ef4444' }}
              onClick={() => setDbResetConfirm(true)}
            >
              데이터베이스 초기화
            </button>
          ) : (
            <div className="fm-flex fm-gap-sm fm-items-center">
              <span className="fm-text-sm" style={{ color: '#ef4444' }}>
                정말 초기화하시겠습니까? 모든 데이터가 삭제됩니다.
              </span>
              <button
                className="fm-btn"
                style={{ background: '#ef4444', color: '#fff', borderColor: '#ef4444' }}
                disabled={dbResetting}
                onClick={async () => {
                  setDbResetting(true);
                  try {
                    const { closeDatabase } = await import('../../db/database');
                    await closeDatabase();
                    const { appDataDir } = await import('@tauri-apps/api/path');
                    const { remove } = await import('@tauri-apps/plugin-fs');
                    const dir = await appDataDir();
                    await remove(`${dir}/lol_esports_manager.db`).catch(() => {});
                    await remove(`${dir}/lol_esports_manager.db-wal`).catch(() => {});
                    await remove(`${dir}/lol_esports_manager.db-shm`).catch(() => {});
                    const { exit } = await import('@tauri-apps/plugin-process');
                    await exit(0);
                  } catch (e) {
                    console.error('[SettingsView] DB 초기화 실패:', e);
                    setDbResetting(false);
                    setDbResetConfirm(false);
                  }
                }}
              >
                {dbResetting ? '초기화 중...' : '확인'}
              </button>
              <button
                className="fm-btn"
                onClick={() => setDbResetConfirm(false)}
                disabled={dbResetting}
              >
                취소
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 게임 정보 */}
      <div className="fm-panel fm-mb-lg">
        <div className="fm-panel__header">
          <span className="fm-panel__title">게임 정보</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-info-row">
            <span className="fm-info-row__label">버전</span>
            <span className="fm-info-row__value">{__APP_VERSION__}</span>
          </div>
          <div className="fm-info-row">
            <span className="fm-info-row__label">프론트엔드</span>
            <span className="fm-info-row__value">React 19 + TypeScript 5.9 + Vite 8</span>
          </div>
          <div className="fm-info-row">
            <span className="fm-info-row__label">백엔드</span>
            <span className="fm-info-row__value">Tauri 2 (Rust)</span>
          </div>
          <div className="fm-info-row">
            <span className="fm-info-row__label">AI 엔진</span>
            <span className="fm-info-row__value">
              {aiProvider === 'ollama'
                ? 'Ollama (로컬 LLM)'
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
          <div className="fm-info-row">
            <span className="fm-info-row__label">DB</span>
            <span className="fm-info-row__value">SQLite</span>
          </div>
        </div>
      </div>
    </div>
  );
}
