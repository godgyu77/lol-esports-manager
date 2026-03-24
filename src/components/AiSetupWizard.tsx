import { useState, useEffect, useCallback } from 'react';
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

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'none',
    name: 'AI 비활성화',
    model: '',
    size: '0MB',
    ram: '-',
    quality: '템플릿만 사용',
    description: 'AI 없이 게임 가능. 뉴스, 대화 등은 템플릿 기반으로 동작합니다.',
  },
  {
    id: 'light',
    name: '경량 AI',
    model: 'qwen3:0.6b',
    size: '~400MB',
    ram: 'VRAM 2GB+',
    quality: '기본',
    description: '가벼운 AI 대화. 빠른 응답, 기본적인 대화 품질.',
  },
  {
    id: 'standard',
    name: '표준 AI',
    model: 'qwen3:1.7b',
    size: '~1.5GB',
    ram: 'VRAM 4GB+',
    quality: '좋음',
    description: '자연스러운 AI 대화. 균형 잡힌 속도와 품질.',
  },
  {
    id: 'high',
    name: '고품질 AI',
    model: 'qwen3:8b',
    size: '~5GB',
    ram: 'VRAM 8GB+',
    quality: '우수',
    description: '최고 품질 AI. 풍부한 맥락 이해와 자연스러운 대화. (RTX 3060 이상 권장)',
  },
];

interface DownloadProgress {
  progress: number;
  status: string;
  total: number;
  completed: number;
}

type WizardStep = 'select' | 'downloading' | 'complete';

export function AiSetupWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<WizardStep>('select');
  const [selectedOption, setSelectedOption] = useState<ModelOption>(MODEL_OPTIONS[2]);
  const [progress, setProgress] = useState<DownloadProgress>({
    progress: 0,
    status: '',
    total: 0,
    completed: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);

  const setAiModel = useSettingsStore((s) => s.setAiModel);
  const setAiEnabled = useSettingsStore((s) => s.setAiEnabled);

  // Ollama 상태 확인 (sidecar 시작 대기 — 최대 15초 재시도)
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
            return;
          }
        } catch { /* 무시 */ }
        attempt++;
        if (!cancelled) {
          await new Promise(r => setTimeout(r, 1000)); // 1초 대기
        }
      }
      if (!cancelled) setOllamaOnline(false);
    };

    checkStatus();
    return () => { cancelled = true; };
  }, []);

  // 다운로드 진행률 이벤트 리스너
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    listen<DownloadProgress>('model-download-progress', (event) => {
      setProgress(event.payload);
    }).then((fn) => {
      if (cancelled) { fn(); return; }
      unlisten = fn;
    });

    return () => { cancelled = true; unlisten?.(); };
  }, []);

  const handleStartDownload = useCallback(async () => {
    if (selectedOption.id === 'none') {
      setAiModel('');
      setAiEnabled(false);
      onComplete();
      return;
    }

    // Ollama가 오프라인이면 재시도 안내
    if (!ollamaOnline) {
      // 한번 더 확인
      try {
        const retry = await invoke<boolean>('check_ollama_status');
        if (!retry) {
          setError('Ollama가 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요. (앱 시작 후 10~15초 소요)');
          return;
        }
        setOllamaOnline(true);
      } catch {
        setError('Ollama 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }
    }

    setStep('downloading');
    setError(null);
    setProgress({ progress: 0, status: '다운로드 준비 중...', total: 0, completed: 0 });

    try {
      await invoke<string>('pull_model', { modelName: selectedOption.model });
      setAiModel(selectedOption.model);
      setAiEnabled(true);
      setStep('complete');
    } catch (e) {
      setError(typeof e === 'string' ? e : '모델 다운로드에 실패했습니다.');
      setStep('select');
    }
  }, [selectedOption, ollamaOnline, setAiModel, setAiEnabled, onComplete]);

  const handleSkip = useCallback(() => {
    setAiModel('');
    setAiEnabled(false);
    onComplete();
  }, [setAiModel, setAiEnabled, onComplete]);

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
        {/* 헤더 */}
        <div className="fm-text-center fm-mb-lg">
          <h1 className="wizard-title">AI 모델 설정</h1>
          <p className="fm-text-md fm-text-muted" style={{ lineHeight: 1.6, margin: 0 }}>
            LoL Esports Manager는 로컬 AI를 사용하여 풍부한 게임 경험을 제공합니다.
          </p>
          {ollamaOnline === null && (
            <div className="fm-alert fm-alert--warning fm-mt-md" style={{ justifyContent: 'center' }}>
              <span className="fm-alert__text fm-text-center">
                AI 엔진 연결 중... 잠시만 기다려주세요.
              </span>
            </div>
          )}
          {ollamaOnline === false && (
            <div className="fm-alert fm-alert--danger fm-mt-md" style={{ justifyContent: 'center' }}>
              <span className="fm-alert__text fm-text-center">
                AI 엔진이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.
              </span>
            </div>
          )}
        </div>

        {/* 단계 1: 모델 선택 */}
        {step === 'select' && (
          <>
            <div className="wizard-cards-grid">
              {MODEL_OPTIONS.map((option) => {
                const isSelected = selectedOption.id === option.id;
                return (
                  <button
                    key={option.id}
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
                    {option.model && (
                      <span className="wizard-model-tag">{option.model}</span>
                    )}
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
                {selectedOption.id === 'none' ? '계속하기' : '다운로드 시작'}
              </button>
            </div>
          </>
        )}

        {/* 단계 2: 다운로드 중 */}
        {step === 'downloading' && (
          <div className="fm-text-center fm-p-lg">
            <div className="fm-flex fm-items-center fm-justify-between fm-mb-md">
              <span className="fm-text-xl fm-font-bold fm-text-accent fm-text-mono">
                {selectedOption.model}
              </span>
              <span className="fm-text-md fm-text-muted">
                {progress.status || '준비 중...'}
              </span>
            </div>

            <div className="wizard-progress-track">
              <div
                className="wizard-progress-fill"
                style={{ width: `${Math.max(progress.progress, 2)}%` }}
              />
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
              다운로드 중에는 창을 닫지 마세요. 네트워크 상태에 따라 시간이 소요될 수 있습니다.
            </p>
          </div>
        )}

        {/* 단계 3: 완료 */}
        {step === 'complete' && (
          <div className="fm-text-center fm-p-lg">
            <div className="wizard-complete-icon">&#10003;</div>
            <h2 className="fm-text-2xl fm-font-bold fm-text-primary fm-mb-md">설정 완료!</h2>
            <p className="fm-text-lg fm-text-muted fm-mb-lg" style={{ lineHeight: 1.6 }}>
              <strong>{selectedOption.name}</strong> ({selectedOption.model}) 모델이 준비되었습니다.
              설정에서 언제든 모델을 변경할 수 있습니다.
            </p>
            <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={onComplete}>
              게임 시작
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
