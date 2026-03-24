import type { Decision } from '../../engine/match/liveMatch';
import './match.css';

interface DecisionPopupProps {
  decision: Decision;
  onDecision: (optionId: string) => void;
}

export function DecisionPopup({ decision, onDecision }: DecisionPopupProps) {
  return (
    <div className="fm-overlay" role="dialog" aria-modal="true" aria-label={decision.mode === 'manager' ? '감독 지시' : '행동 선택'}>
      <div className="animate-scaleIn match-decision-box">
        <h3 className="match-decision-title">
          {decision.mode === 'manager' ? '감독 지시' : '행동 선택'}
        </h3>
        <p className="match-decision-situation">{decision.situation}</p>
        <div className="match-decision-option-list">
          {decision.options.map((opt, idx) => (
            <button
              key={opt.id}
              className="match-decision-option-btn"
              onClick={() => onDecision(opt.id)}
              autoFocus={idx === 0}
            >
              <span className="match-decision-option-label">{opt.label}</span>
              <span className="match-decision-option-desc">{opt.description}</span>
              <div className="match-decision-option-meta">
                <span style={{ color: opt.effect.riskFactor > 0.3 ? 'var(--danger)' : 'var(--success)' }}>
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
