import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useSettingsStore } from '../stores/settingsStore';
import type { SettingsState } from '../stores/settingsStore';
import './AiSetupWizard.css';

interface DownloadProgress {
  progress: number;
  status: string;
  total: number;
  completed: number;
}

interface OllamaStatusDetail {
  status: 'not_started' | 'starting' | 'ready' | 'failed';
  ready: boolean;
  message: string;
}

type WizardStep = 'intro' | 'preparing' | 'downloading' | 'testing' | 'complete';

const RECOMMENDED_MODEL = 'qwen3:4b';

export function AiSetupWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<WizardStep>('intro');
  const [error, setError] = useState<string | null>(null);
  const [ollamaDetail, setOllamaDetail] = useState<OllamaStatusDetail | null>(null);
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [progress, setProgress] = useState<DownloadProgress>({
    progress: 0,
    status: '',
    total: 0,
    completed: 0,
  });

  const setAiModel = useSettingsStore((s: SettingsState) => s.setAiModel);
  const setAiEnabled = useSettingsStore((s: SettingsState) => s.setAiEnabled);
  const setAiProvider = useSettingsStore((s: SettingsState) => s.setAiProvider);
  const setAiSetupCompleted = useSettingsStore((s: SettingsState) => s.setAiSetupCompleted);
  const setAiSetupSkipped = useSettingsStore((s: SettingsState) => s.setAiSetupSkipped);
  const existingSetupCompleted = useSettingsStore((s: SettingsState) => s.aiSetupCompleted);

  const modelReady = useMemo(
    () => installedModels.includes(RECOMMENDED_MODEL),
    [installedModels],
  );

  const refreshStatus = useCallback(async () => {
    try {
      const detail = await invoke<OllamaStatusDetail>('get_ollama_status_detail');
      setOllamaDetail(detail);

      if (detail.ready) {
        const models = await invoke<string[]>('list_models').catch(() => []);
        setInstalledModels(models);
      } else {
        setInstalledModels([]);
      }
    } catch (statusError) {
      setOllamaDetail({
        status: 'failed',
        ready: false,
        message: statusError instanceof Error ? statusError.message : String(statusError),
      });
      setInstalledModels([]);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    listen<DownloadProgress>('model-download-progress', (event) => {
      if (!cancelled) {
        setProgress(event.payload);
      }
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const markSkipped = useCallback(() => {
    if (existingSetupCompleted) {
      onComplete();
      return;
    }

    setAiProvider('template');
    setAiModel('');
    setAiEnabled(false);
    setAiSetupCompleted(false);
    setAiSetupSkipped(true);
    onComplete();
  }, [existingSetupCompleted, onComplete, setAiEnabled, setAiModel, setAiProvider, setAiSetupCompleted, setAiSetupSkipped]);

  const markComplete = useCallback(() => {
    setAiProvider('ollama');
    setAiModel(RECOMMENDED_MODEL);
    setAiEnabled(true);
    setAiSetupCompleted(true);
    setAiSetupSkipped(false);
    setStep('complete');
  }, [setAiEnabled, setAiModel, setAiProvider, setAiSetupCompleted, setAiSetupSkipped]);

  const handlePrepare = useCallback(async () => {
    setError(null);
    setStep('preparing');

    try {
      const detail = await invoke<OllamaStatusDetail>('ensure_ollama_ready');
      setOllamaDetail(detail);

      if (!detail.ready) {
        throw new Error(detail.message);
      }

      const models = await invoke<string[]>('list_models').catch(() => [] as string[]);
      setInstalledModels(models);

      if (models.includes(RECOMMENDED_MODEL)) {
        setStep('testing');
        await invoke<string>('chat_with_llm', {
          model: RECOMMENDED_MODEL,
          messages: [{ role: 'user', content: 'Reply with OK only.' }],
          format: null,
        });
        markComplete();
        return;
      }

      setProgress({
        progress: 0,
        status: '권장 모델 다운로드를 준비하고 있습니다.',
        total: 0,
        completed: 0,
      });
      setStep('downloading');
      await invoke<string>('pull_model', { modelName: RECOMMENDED_MODEL });

      const refreshed = await invoke<string[]>('list_models').catch(() => []);
      setInstalledModels(refreshed);

      setStep('testing');
      await invoke<string>('chat_with_llm', {
        model: RECOMMENDED_MODEL,
        messages: [{ role: 'user', content: 'Reply with OK only.' }],
        format: null,
      });
      markComplete();
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : String(prepareError));
      setStep('intro');
      await refreshStatus();
    }
  }, [markComplete, refreshStatus]);

  const formatBytes = (bytes: number): string => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
  };

  const statusLabel = useMemo(() => {
    if (!ollamaDetail) return '상태 확인 중';
    if (ollamaDetail.ready) return '준비 완료';
    if (ollamaDetail.status === 'starting') return '시작 중';
    if (ollamaDetail.status === 'failed') return '준비 실패';
    return '시작 전';
  }, [ollamaDetail]);

  return (
    <div className="wizard-overlay">
      <div className="wizard-container">
        <div className="fm-text-center fm-mb-lg">
          <h1 className="wizard-title">무료 로컬 AI 준비</h1>
          <p className="fm-text-md fm-text-muted" style={{ lineHeight: 1.6, margin: 0 }}>
            앱에 포함된 Ollama 런타임과 권장 모델을 자동으로 준비합니다.
            <br />
            준비가 끝나면 추가 비용 없이 로컬 AI 기능을 바로 사용할 수 있습니다.
          </p>
        </div>

        {step === 'intro' && (
          <>
            <div className="fm-grid fm-grid--2 fm-mb-md" style={{ gap: 14 }}>
              <div className="fm-card">
                <div className="fm-text-base fm-font-semibold fm-text-primary">기본 준비 항목</div>
                <div className="fm-text-sm fm-text-muted fm-mt-sm">런타임: Ollama sidecar</div>
                <div className="fm-text-sm fm-text-muted">권장 모델: {RECOMMENDED_MODEL}</div>
                <div className="fm-text-sm fm-text-muted">예상 다운로드: 약 2.6GB</div>
              </div>
              <div className="fm-card">
                <div className="fm-text-base fm-font-semibold fm-text-primary">현재 상태</div>
                <div className="fm-text-sm fm-text-muted fm-mt-sm">Ollama: {statusLabel}</div>
                <div className="fm-text-sm fm-text-muted">
                  모델: {modelReady ? `${RECOMMENDED_MODEL} 설치됨` : '권장 모델 미설치'}
                </div>
                <div className="fm-text-xs fm-text-muted fm-mt-sm">
                  {ollamaDetail?.message ?? '준비 상태를 확인하는 중입니다.'}
                </div>
              </div>
            </div>

            <div className="fm-alert fm-alert--warning fm-mb-md" style={{ justifyContent: 'center' }}>
              <span className="fm-alert__text fm-text-center">
                처음 한 번만 준비하면 이후에는 로컬 AI를 무료로 계속 사용할 수 있습니다.
              </span>
            </div>

            {error && (
              <div className="fm-alert fm-alert--warning fm-mb-md" style={{ justifyContent: 'center' }}>
                <span className="fm-alert__text fm-text-center">{error}</span>
              </div>
            )}

            <div className="fm-flex fm-items-center fm-justify-between fm-gap-md">
              <button className="fm-btn fm-btn--ghost fm-btn--lg" onClick={markSkipped}>
                지금은 건너뛰기
              </button>
              <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={() => void handlePrepare()}>
                AI 준비 시작
              </button>
            </div>
          </>
        )}

        {step === 'preparing' && (
          <div className="fm-text-center fm-p-lg">
            <h2 className="fm-text-2xl fm-font-bold fm-text-primary fm-mb-md">런타임 준비 중</h2>
            <p className="fm-text-md fm-text-muted fm-mb-md">
              Ollama를 시작하고 로컬 AI 서버 연결을 확인하고 있습니다.
            </p>
            <div className="wizard-progress-track">
              <div className="wizard-progress-fill" style={{ width: '35%' }} />
            </div>
            <div className="fm-text-sm fm-text-muted fm-mt-md">
              {ollamaDetail?.message ?? 'Ollama를 시작하는 중입니다.'}
            </div>
          </div>
        )}

        {step === 'downloading' && (
          <div className="fm-text-center fm-p-lg">
            <h2 className="fm-text-2xl fm-font-bold fm-text-primary fm-mb-md">권장 모델 다운로드 중</h2>
            <div className="fm-text-lg fm-text-accent fm-mb-sm">{RECOMMENDED_MODEL}</div>
            <div className="fm-text-sm fm-text-muted fm-mb-md">
              {progress.status || '다운로드를 시작하는 중입니다.'}
            </div>

            <div className="wizard-progress-track">
              <div className="wizard-progress-fill" style={{ width: `${Math.max(progress.progress, 2)}%` }} />
            </div>

            <div className="fm-flex fm-justify-between fm-text-md fm-text-muted fm-mt-md">
              <span>{progress.progress}%</span>
              <span>
                {formatBytes(progress.completed)} / {formatBytes(progress.total)}
              </span>
            </div>

            <p className="fm-text-sm fm-text-muted fm-mt-lg">
              다운로드가 오래 걸릴 수 있습니다. 완료되면 연결 테스트를 자동으로 진행합니다.
            </p>
          </div>
        )}

        {step === 'testing' && (
          <div className="fm-text-center fm-p-lg">
            <h2 className="fm-text-2xl fm-font-bold fm-text-primary fm-mb-md">연결 테스트 중</h2>
            <p className="fm-text-md fm-text-muted fm-mb-md">
              설치한 모델로 간단한 응답 테스트를 실행하고 있습니다.
            </p>
            <div className="wizard-progress-track">
              <div className="wizard-progress-fill" style={{ width: '90%' }} />
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="fm-text-center fm-p-lg">
            <div className="wizard-complete-icon">&#10003;</div>
            <h2 className="fm-text-2xl fm-font-bold fm-text-primary fm-mb-md">AI 준비 완료</h2>
            <p className="fm-text-lg fm-text-muted fm-mb-lg" style={{ lineHeight: 1.6 }}>
              <strong>{RECOMMENDED_MODEL}</strong> 이(가) 준비되었습니다.
              <br />
              이제 기본 AI 모드는 로컬 Ollama로 설정됩니다.
            </p>
            <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={onComplete}>
              계속하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
