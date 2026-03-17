import type React from 'react';
import { useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';

const TUTORIAL_STEPS = [
  '시즌 진행에서 "다음 날"을 클릭하여 시즌을 진행합니다.',
  '로스터에서 1군/2군 선수를 관리할 수 있습니다.',
  '경기일에는 밴픽 후 라이브 경기가 진행됩니다.',
  '이적 시장에서 선수를 영입/방출할 수 있습니다.',
  '재정을 관리하여 샐러리캡을 초과하지 않도록 주의하세요.',
];

export function TutorialOverlay() {
  const [step, setStep] = useState(0);
  const setTutorialComplete = useSettingsStore((s) => s.setTutorialComplete);

  const handleNext = () => {
    if (step < TUTORIAL_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      setTutorialComplete(true);
    }
  };

  const handleSkip = () => {
    setTutorialComplete(true);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <h2 style={styles.title}>게임 가이드</h2>
        <div style={styles.stepIndicator}>
          {TUTORIAL_STEPS.map((_, i) => (
            <span
              key={i}
              style={{
                ...styles.stepDot,
                background: i === step ? '#c89b3c' : 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </div>
        <p style={styles.message}>{TUTORIAL_STEPS[step]}</p>
        <div style={styles.stepCount}>
          {step + 1} / {TUTORIAL_STEPS.length}
        </div>
        <div style={styles.buttonRow}>
          <button style={styles.skipBtn} onClick={handleSkip}>
            건너뛰기
          </button>
          <button style={styles.nextBtn} onClick={handleNext}>
            {step < TUTORIAL_STEPS.length - 1 ? '다음' : '시작하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    background: '#1a1a3a',
    border: '2px solid #c89b3c',
    borderRadius: '16px',
    padding: '40px',
    textAlign: 'center',
    minWidth: '420px',
    maxWidth: '500px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#f0e6d2',
    marginBottom: '20px',
  },
  stepIndicator: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '24px',
  },
  stepDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    transition: 'background 0.2s',
  },
  message: {
    fontSize: '16px',
    lineHeight: '1.6',
    color: '#e0e0e0',
    marginBottom: '16px',
    minHeight: '52px',
  },
  stepCount: {
    fontSize: '13px',
    color: '#6a6a7a',
    marginBottom: '24px',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
  },
  skipBtn: {
    padding: '12px 24px',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.05)',
    color: '#8a8a9a',
    fontSize: '14px',
    cursor: 'pointer',
  },
  nextBtn: {
    padding: '12px 32px',
    background: '#c89b3c',
    color: '#0d0d1a',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
