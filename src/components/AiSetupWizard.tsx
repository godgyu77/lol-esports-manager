import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useSettingsStore } from '../stores/settingsStore';
import './AiSetupWizard.css';

interface ModelOption {
  id: string;
  name: string;
  model: string;
  size: string;
  ram: string;
  quality: string;
  description: string;
}

interface DownloadProgress {
  progress: number;
  status: string;
  total: number;
  completed: number;
}

type WizardStep = 'select' | 'downloading' | 'complete';

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'none',
    name: 'AI 비활성화',
    model: '',
    size: '0MB',
    ram: '-',
    quality: '템플릿 전용',
    description: 'AI 없이도 게임은 진행되며, 기본 템플릿 응답만 사용합니다.',
  },
  {
    id: 'light',
    name: '경량 모델',
    model: 'qwen3:1.7b',
    size: '~1.5GB',
    ram: '권장 4GB+',
    quality: '기본',
    description: '속도와 품질의 균형이 좋아 대부분의 환경에서 무난합니다.',
  },
  {
    id: 'standard',
    name: '표준 모델',
    model: 'qwen3:4b',
    size: '~2.6GB',
    ram: '권장 6GB+',
    quality: '좋음',
    description: '더 자연스러운 문장과 안정적인 결과를 기대할 수 있습니다.',
  },
  {
    id: 'high',
    name: '고품질 모델',
    model: 'qwen3:8b',
    size: '~5GB',
    ram: '권장 8GB+',
    quality: '우수',
    description: '가장 풍부한 응답을 제공하지만 다운로드와 실행 비용이 큽니다.',
  },
];

export function AiSetupWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<WizardStep>('select');
  const [selectedOption, setSelectedOption] = useState<ModelOption>(MODEL_OPTIONS[1]);
  const [progress, setProgress] = useState<DownloadProgress>({
    progress: 0,
    status: '',
    total: 0,
    completed: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [installedModels, setInstalledModels] = useState<string[]>([]);

  const setAiModel = useSettingsStore((s) => s.setAiModel);
  const setAiEnabled = useSettingsStore((s) => s.setAiEnabled);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 15;

    const checkStatus = async () => {
      while (attempt < maxAttempts && !cancelled) {
        try {
          const online = await invoke<boolean>('check_ollama_status');
          if (online && !cancelled) {
            setOllamaOnline(true);
            const models = await invoke<string[]>('list_models').catch(() => []);
            if (!cancelled) {
              setInstalledModels(models);
            }
            return;
          }
        } catch {}

        attempt += 1;
        if (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (!cancelled) {
        setOllamaOnline(false);
      }
    };

    void checkStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    listen<DownloadProgress>('model-download-progress', (event) => {
      setProgress(event.payload);
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

  const installedModelOption = useMemo<ModelOption | null>(() => {
    const model = installedModels[0];
    if (!model) return null;
    return {
      id: 'installed',
      name: '설치된 모델 사용',
      model,
      size: '설치됨',
      ram: '현재 환경 기준',
      quality: '즉시 사용',
      description: `현재 설치된 모델 ${model}을 바로 사용합니다.`,
    };
  }, [installedModels]);

  const availableOptions = useMemo(
    () => (installedModelOption ? [MODEL_OPTIONS[0], installedModelOption, ...MODEL_OPTIONS.slice(1)] : MODEL_OPTIONS),
    [installedModelOption],
  );

  const handleStartDownload = useCallback(async () => {
    if (selectedOption.id === 'none') {
      setAiModel('');
      setAiEnabled(false);
      onComplete();
      return;
    }

    if (!ollamaOnline) {
      try {
        const retry = await invoke<boolean>('check_ollama_status');
        if (!retry) {
          setError('Ollama가 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
          return;
        }
        setOllamaOnline(true);
      } catch {
        setError('Ollama 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }
    }

    if (selectedOption.id === 'installed') {
      setAiModel(selectedOption.model);
      setAiEnabled(true);
      setStep('complete');
      return;
    }

    setStep('downloading');
    setError(null);
    setProgress({ progress: 0, status: '다운로드 준비 중...', total: 0, completed: 0 });

    try {
      await invoke<string>('pull_model', { modelName: selectedOption.model });
      setAiModel(selectedOption.model);
      setAiEnabled(true);
      setInstalledModels((prev) => (prev.includes(selectedOption.model) ? prev : [selectedOption.model, ...prev]));
      setStep('complete');
    } catch (downloadError) {
      setError(typeof downloadError === 'string' ? downloadError : '모델 다운로드에 실패했습니다.');
      setStep('select');
    }
  }, [ollamaOnline, onComplete, selectedOption, setAiEnabled, setAiModel]);

  const handleSkip = useCallback(() => {
    setAiModel('');
    setAiEnabled(false);
    onComplete();
  }, [onComplete, setAiEnabled, setAiModel]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="wizard-overlay">
      <div className="wizard-container">
        <div className="fm-text-center fm-mb-lg">
          <h1 className="wizard-title">AI 모델 설정</h1>
          <p className="fm-text-md fm-text-muted" style={{ lineHeight: 1.6, margin: 0 }}>
            한국어 중심 게임 경험을 위해 로컬 AI 모델을 선택할 수 있습니다.
          </p>

          {ollamaOnline === null && (
            <div className="fm-alert fm-alert--warning fm-mt-md" style={{ justifyContent: 'center' }}>
              <span className="fm-alert__text fm-text-center">AI 엔진 연결을 확인하는 중입니다...</span>
            </div>
          )}

          {ollamaOnline === false && (
            <div className="fm-alert fm-alert--danger fm-mt-md" style={{ justifyContent: 'center' }}>
              <span className="fm-alert__text fm-text-center">
                Ollama가 아직 준비되지 않았습니다. 잠시 후 다시 시도하거나 클라우드 AI를 사용해주세요.
              </span>
            </div>
          )}
        </div>

        {step === 'select' && (
          <>
            <div className="wizard-cards-grid">
              {availableOptions.map((option) => {
                const isSelected = selectedOption.id === option.id;
                return (
                  <button
                    key={`${option.id}-${option.model}`}
                    className={`fm-card fm-card--clickable wizard-model-card ${isSelected ? 'wizard-model-card--selected' : ''}`}
                    onClick={() => setSelectedOption(option)}
                    aria-label={`${option.name} 선택`}
                  >
                    <div className="fm-flex fm-items-center fm-justify-between">
                      <span className={`fm-text-xl fm-font-bold ${isSelected ? 'fm-text-accent' : 'fm-text-primary'}`}>
                        {option.name}
                      </span>
                      {isSelected && <span className="wizard-checkmark">&#10003;</span>}
                    </div>
                    {option.model && <span className="wizard-model-tag">{option.model}</span>}
                    <p className="fm-text-md fm-text-muted" style={{ lineHeight: 1.5, margin: 0 }}>
                      {option.description}
                    </p>
                    <div className="wizard-spec-row">
                      <div className="fm-stat">
                        <span className="fm-stat__label">용량</span>
                        <span className="fm-text-md fm-font-semibold fm-text-secondary">{option.size}</span>
                      </div>
                      <div className="fm-stat">
                        <span className="fm-stat__label">메모리</span>
                        <span className="fm-text-md fm-font-semibold fm-text-secondary">{option.ram}</span>
                      </div>
                      <div className="fm-stat">
                        <span className="fm-stat__label">품질</span>
                        <span className="fm-text-md fm-font-semibold fm-text-secondary">{option.quality}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {error && (
              <p className="fm-text-md fm-text-danger fm-text-center fm-mb-md">{error}</p>
            )}

            <div className="fm-flex fm-items-center fm-justify-between fm-gap-md">
              <button className="fm-btn fm-btn--ghost fm-btn--lg" onClick={handleSkip}>
                건너뛰기
              </button>
              <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={handleStartDownload}>
                {selectedOption.id === 'none'
                  ? '계속하기'
                  : selectedOption.id === 'installed'
                    ? '이 모델 사용'
                    : '다운로드 시작'}
              </button>
            </div>
          </>
        )}

        {step === 'downloading' && (
          <div className="fm-text-center fm-p-lg">
            <div className="fm-flex fm-items-center fm-justify-between fm-mb-md">
              <span className="fm-text-xl fm-font-bold fm-text-accent fm-text-mono">{selectedOption.model}</span>
              <span className="fm-text-md fm-text-muted">{progress.status || '준비 중...'}</span>
            </div>

            <div className="wizard-progress-track">
              <div className="wizard-progress-fill" style={{ width: `${Math.max(progress.progress, 2)}%` }} />
            </div>

            <div className="fm-flex fm-justify-between fm-text-md fm-text-muted fm-mb-lg">
              <span>{progress.progress}%</span>
              {progress.total > 0 && (
                <span>
                  {formatBytes(progress.completed)} / {formatBytes(progress.total)}
                </span>
              )}
            </div>

            <p className="fm-text-sm fm-text-muted" style={{ fontStyle: 'italic' }}>
              다운로드 중에는 창을 닫지 않는 편이 안전합니다.
            </p>
          </div>
        )}

        {step === 'complete' && (
          <div className="fm-text-center fm-p-lg">
            <div className="wizard-complete-icon">&#10003;</div>
            <h2 className="fm-text-2xl fm-font-bold fm-text-primary fm-mb-md">설정 완료</h2>
            <p className="fm-text-lg fm-text-muted fm-mb-lg" style={{ lineHeight: 1.6 }}>
              <strong>{selectedOption.name}</strong>
              {selectedOption.model ? ` (${selectedOption.model})` : ''} 준비가 끝났습니다.
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
