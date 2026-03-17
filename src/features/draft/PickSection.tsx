import type { TeamDraftState } from '../../engine/draft/draftEngine';
import type { Position } from '../../types/game';
import type { Champion } from '../../types/champion';

const POSITION_LABELS: Record<Position, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: '원딜',
  support: '서포터',
};

interface PickSectionProps {
  picks: TeamDraftState['picks'];
  color: string;
  championDb: Champion[];
}

export function PickSection({ picks, color, championDb }: PickSectionProps) {
  return (
    <div style={styles.pickColumn}>
      {picks.map((p, i) => {
        const champ = championDb.find((c) => c.id === p.championId);
        return (
          <div key={i} style={{ ...styles.pickSlot, borderLeftColor: color }}>
            <span style={styles.pickPos}>{POSITION_LABELS[p.position]}</span>
            <span style={styles.pickChamp}>{champ?.nameKo ?? p.championId}</span>
          </div>
        );
      })}
      {Array.from({ length: 5 - picks.length }).map((_, i) => (
        <div key={`e${i}`} style={{ ...styles.pickSlotEmpty, borderLeftColor: `${color}33` }}>
          <span style={styles.pickEmptyText}>—</span>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pickColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  pickSlot: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.03)',
    borderLeft: '3px solid',
    borderRadius: '4px',
  },
  pickSlotEmpty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.01)',
    borderLeft: '3px solid',
    borderRadius: '4px',
    minHeight: '42px',
  },
  pickPos: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#c89b3c',
    minWidth: '40px',
  },
  pickChamp: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#e0e0e0',
  },
  pickEmptyText: {
    fontSize: '14px',
    color: '#2a2a4a',
  },
};
