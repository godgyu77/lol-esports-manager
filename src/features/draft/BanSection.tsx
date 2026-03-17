import type { TeamDraftState } from '../../engine/draft/draftEngine';
import type { Champion } from '../../types/champion';

interface BanSectionProps {
  blueBans: TeamDraftState['bans'];
  redBans: TeamDraftState['bans'];
  championDb: Champion[];
}

export function BanSection({ blueBans, redBans, championDb }: BanSectionProps) {
  return (
    <div style={styles.banSection}>
      <BanRow bans={blueBans} color="#3498db" championDb={championDb} />
      <BanRow bans={redBans} color="#e74c3c" championDb={championDb} />
    </div>
  );
}

interface BanRowProps {
  bans: string[];
  color: string;
  championDb: Champion[];
}

function BanRow({ bans, color, championDb }: BanRowProps) {
  return (
    <div style={styles.banRow}>
      <span style={styles.banLabel}>BAN</span>
      {bans.map((id, i) => {
        const champ = championDb.find((c) => c.id === id);
        return (
          <div key={i} style={{ ...styles.banSlot, borderColor: `${color}44` }}>
            <span style={styles.banChampName}>{champ?.nameKo ?? id}</span>
          </div>
        );
      })}
      {Array.from({ length: 5 - bans.length }).map((_, i) => (
        <div key={`e${i}`} style={{ ...styles.banSlot, borderColor: `${color}22` }} />
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '24px',
  },
  banRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  banLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#6a6a7a',
    minWidth: '32px',
  },
  banSlot: {
    width: '100px',
    height: '32px',
    border: '1px solid',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.02)',
  },
  banChampName: {
    fontSize: '11px',
    color: '#8a8a9a',
    textDecoration: 'line-through',
  },
};
