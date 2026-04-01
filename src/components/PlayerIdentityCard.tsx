import type { Position } from '../types/game';
import './playerIdentityCard.css';

type PlayerStatusTone = 'good' | 'warning' | 'danger' | 'neutral';

interface PlayerIdentityCardProps {
  name: string;
  position: Position;
  accentColor: string;
  subtitle?: string;
  meta?: string;
  tags?: string[];
  statusLabel?: string;
  statusTone?: PlayerStatusTone;
  compact?: boolean;
  highlighted?: boolean;
}

const POSITION_SHORT_LABELS: Record<Position, string> = {
  top: 'TOP',
  jungle: 'JGL',
  mid: 'MID',
  adc: 'ADC',
  support: 'SUP',
};

function getInitials(name: string): string {
  const chunks = name
    .split(/\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (chunks.length === 0) return 'PL';
  if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
  return `${chunks[0][0] ?? ''}${chunks[chunks.length - 1][0] ?? ''}`.toUpperCase();
}

export function PlayerIdentityCard({
  name,
  position,
  accentColor,
  subtitle,
  meta,
  tags,
  statusLabel,
  statusTone = 'neutral',
  compact = false,
  highlighted = false,
}: PlayerIdentityCardProps) {
  return (
    <div
      className={[
        'player-identity-card',
        compact ? 'player-identity-card--compact' : '',
        highlighted ? 'player-identity-card--highlighted' : '',
      ].filter(Boolean).join(' ')}
      style={{ ['--player-accent' as string]: accentColor }}
    >
      <div className="player-identity-card__avatar">
        <span className="player-identity-card__initials">{getInitials(name)}</span>
      </div>
      <div className="player-identity-card__body">
        <div className="player-identity-card__topline">
          <span className="player-identity-card__position">{POSITION_SHORT_LABELS[position]}</span>
          {statusLabel ? (
            <span className={`player-identity-card__status player-identity-card__status--${statusTone}`}>
              {statusLabel}
            </span>
          ) : null}
        </div>
        <strong className="player-identity-card__name">{name}</strong>
        {subtitle ? <span className="player-identity-card__subtitle">{subtitle}</span> : null}
        {tags && tags.length > 0 ? (
          <div className="player-identity-card__tags">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="player-identity-card__tag">{tag}</span>
            ))}
          </div>
        ) : null}
        {meta ? <span className="player-identity-card__meta">{meta}</span> : null}
      </div>
    </div>
  );
}
