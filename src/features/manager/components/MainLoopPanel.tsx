import { useId } from 'react';
import './MainLoopPanel.css';

type InsightTone = 'neutral' | 'accent' | 'danger' | 'success';
type ActionVariant = 'default' | 'primary' | 'info';

export interface MainLoopInsight {
  label: string;
  value: string;
  detail: string;
  tone?: InsightTone;
}

export interface MainLoopAction {
  label: string;
  onClick: () => void;
  variant?: ActionVariant;
  disabled?: boolean;
  ariaLabel?: string;
  testId?: string;
}

interface MainLoopPanelProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  insights: MainLoopInsight[];
  actions?: MainLoopAction[];
  note?: string;
}

function getToneClass(tone: InsightTone | undefined): string {
  switch (tone) {
    case 'danger':
      return 'manager-loop__value--danger';
    case 'success':
      return 'manager-loop__value--success';
    case 'accent':
      return 'manager-loop__value--accent';
    default:
      return '';
  }
}

function getActionClass(variant: ActionVariant | undefined): string {
  switch (variant) {
    case 'primary':
      return 'fm-btn fm-btn--primary';
    case 'info':
      return 'fm-btn fm-btn--info';
    default:
      return 'fm-btn';
  }
}

export function MainLoopPanel({ eyebrow, title, subtitle, insights, actions = [], note }: MainLoopPanelProps) {
  const titleId = useId();

  return (
    <section className="fm-panel manager-loop" aria-labelledby={titleId}>
      <div className="fm-panel__body">
        <div className="manager-loop__header">
          <div>
            {eyebrow && <p className="manager-loop__eyebrow">{eyebrow}</p>}
            <h2 id={titleId} className="manager-loop__title">
              {title}
            </h2>
            {subtitle && <p className="manager-loop__subtitle">{subtitle}</p>}
          </div>
        </div>

        <div className="manager-loop__grid">
          {insights.map((insight) => (
            <article key={`${insight.label}-${insight.value}`} className="manager-loop__card">
              <span className="manager-loop__label">{insight.label}</span>
              <strong className={`manager-loop__value ${getToneClass(insight.tone)}`}>{insight.value}</strong>
              <p className="manager-loop__detail">{insight.detail}</p>
            </article>
          ))}
        </div>

        {(actions.length > 0 || note) && (
          <div className="manager-loop__footer">
            {actions.length > 0 && (
              <div className="manager-loop__actions" aria-label="운영 루프 바로가기">
                {actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className={getActionClass(action.variant)}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    aria-label={action.ariaLabel ?? action.label}
                    data-testid={action.testId}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
            {note && <p className="manager-loop__note">{note}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
