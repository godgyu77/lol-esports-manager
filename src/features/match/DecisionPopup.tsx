import type React from 'react';
import type { Decision } from '../../engine/match/liveMatch';

interface DecisionPopupProps {
  decision: Decision;
  onDecision: (optionId: string) => void;
}

export function DecisionPopup({ decision, onDecision }: DecisionPopupProps) {
  return (
    <div style={styles.decisionOverlay} role="dialog" aria-modal="true" aria-label={decision.mode === 'manager' ? '감독 지시' : '행동 선택'}>
      <div className="animate-scaleIn" style={styles.decisionBox}>
        <h3 style={styles.decisionTitle}>
          {decision.mode === 'manager' ? '감독 지시' : '행동 선택'}
        </h3>
        <p style={styles.decisionSituation}>{decision.situation}</p>
        <div style={styles.optionList}>
          {decision.options.map((opt, idx) => (
            <button
              key={opt.id}
              style={styles.optionBtn}
              onClick={() => onDecision(opt.id)}
              autoFocus={idx === 0}
            >
              <span style={styles.optionLabel}>{opt.label}</span>
              <span style={styles.optionDesc}>{opt.description}</span>
              <div style={styles.optionMeta}>
                <span style={{
                  color: opt.effect.riskFactor > 0.3 ? '#e74c3c' : '#2ecc71',
                }}>
                  위험도 {Math.round(opt.effect.riskFactor * 100)}%
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  decisionOverlay: {
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
  decisionBox: {
    background: '#1a1a3a',
    border: '1px solid #c89b3c',
    borderRadius: '12px',
    padding: '28px',
    maxWidth: '500px',
    width: '90%',
  },
  decisionTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#c89b3c',
    marginBottom: '8px',
  },
  decisionSituation: {
    fontSize: '14px',
    color: '#e0e0e0',
    marginBottom: '20px',
    lineHeight: 1.5,
  },
  optionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  optionBtn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s',
    color: '#e0e0e0',
  },
  optionLabel: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#f0e6d2',
  },
  optionDesc: {
    fontSize: '12px',
    color: '#8a8a9a',
  },
  optionMeta: {
    display: 'flex',
    gap: '12px',
    fontSize: '11px',
    marginTop: '4px',
  },
};
