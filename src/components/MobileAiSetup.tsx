import { useMemo, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import type { AiProvider } from '../stores/settingsStore';
import './AiSetupWizard.css';

const MOBILE_PROVIDER_OPTIONS: Array<{
  value: Exclude<AiProvider, 'ollama'>;
  label: string;
  description: string;
  defaultModel: string;
}> = [
  { value: 'template', label: '템플릿만 사용', description: 'API 없이도 기본 서사와 안내 흐름으로 플레이할 수 있습니다.', defaultModel: '' },
  { value: 'openai', label: 'OpenAI', description: '빠르고 안정적인 API 기반 AI 흐름입니다.', defaultModel: 'gpt-4o-mini' },
  { value: 'claude', label: 'Claude', description: '설명형 문장과 브리핑 품질을 우선할 때 좋습니다.', defaultModel: 'claude-haiku-4-5-20251001' },
  { value: 'gemini', label: 'Gemini', description: '속도와 품질의 균형이 좋은 API 기반 옵션입니다.', defaultModel: 'gemini-2.0-flash' },
  { value: 'grok', label: 'Grok', description: '추가 API 대안으로 사용할 수 있습니다.', defaultModel: 'grok-3-mini' },
];

export function MobileAiSetup({ onComplete }: { onComplete: () => void }) {
  const setAiEnabled = useSettingsStore((state) => state.setAiEnabled);
  const setAiModel = useSettingsStore((state) => state.setAiModel);
  const setAiProvider = useSettingsStore((state) => state.setAiProvider);
  const setAiSetupCompleted = useSettingsStore((state) => state.setAiSetupCompleted);
  const setAiSetupSkipped = useSettingsStore((state) => state.setAiSetupSkipped);
  const setApiKey = useSettingsStore((state) => state.setApiKey);

  const [provider, setProvider] = useState<Exclude<AiProvider, 'ollama'>>('template');
  const [apiKey, setApiKeyInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedOption = useMemo(
    () => MOBILE_PROVIDER_OPTIONS.find((option) => option.value === provider) ?? MOBILE_PROVIDER_OPTIONS[0],
    [provider],
  );

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      setAiProvider(provider);
      setAiModel(selectedOption.defaultModel);

      if (provider === 'template') {
        setAiEnabled(false);
        setAiSetupCompleted(false);
        setAiSetupSkipped(true);
        onComplete();
        return;
      }

      await setApiKey(apiKey.trim(), provider);
      setAiEnabled(true);
      setAiSetupCompleted(true);
      setAiSetupSkipped(false);
      onComplete();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="wizard-overlay">
      <div className="wizard-container">
        <div className="fm-text-center fm-mb-lg">
          <h1 className="wizard-title">모바일 AI 설정</h1>
          <p className="fm-text-md fm-text-muted" style={{ lineHeight: 1.6, margin: 0 }}>
            모바일에서는 로컬 LLM 대신 API 기반 AI만 사용합니다.
            <br />
            먼저 플레이 가능한 기본 모드를 고르고, 필요하면 API 키를 바로 연결하세요.
          </p>
        </div>

        <div className="fm-grid fm-grid--2 fm-mb-md" style={{ gap: 14 }}>
          {MOBILE_PROVIDER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`fm-card fm-card--clickable fm-flex-col fm-items-start fm-gap-xs ${provider === option.value ? 'fm-card--highlight' : ''}`}
              onClick={() => setProvider(option.value)}
            >
              <span className="fm-text-base fm-font-semibold fm-text-primary">{option.label}</span>
              <span className="fm-text-xs fm-text-muted" style={{ textAlign: 'left', lineHeight: 1.5 }}>
                {option.description}
              </span>
            </button>
          ))}
        </div>

        {provider !== 'template' && (
          <div className="fm-panel fm-mb-md">
            <div className="fm-panel__header">
              <span className="fm-panel__title">API 키 입력</span>
            </div>
            <div className="fm-panel__body">
              <p className="fm-text-sm fm-text-muted fm-mb-sm">
                모바일에서는 {selectedOption.label} API를 사용합니다. 키를 저장하면 뉴스, 브리핑, 해설 품질을 높일 수 있습니다.
              </p>
              <input
                className="fm-input"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKeyInput(event.target.value)}
                placeholder={`${selectedOption.label} API key`}
              />
            </div>
          </div>
        )}

        <div className="fm-flex fm-items-center fm-justify-between fm-gap-md">
          <button
            type="button"
            className="fm-btn fm-btn--ghost fm-btn--lg"
            onClick={() => {
              setProvider('template');
              setApiKeyInput('');
            }}
          >
            템플릿으로 시작
          </button>
          <button
            type="button"
            className="fm-btn fm-btn--primary fm-btn--lg"
            onClick={() => void handleContinue()}
            disabled={isSaving || (provider !== 'template' && apiKey.trim().length === 0)}
          >
            계속 진행
          </button>
        </div>
      </div>
    </div>
  );
}
