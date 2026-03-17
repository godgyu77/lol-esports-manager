import type { Position } from '../../types/game';
import type { Champion } from '../../types/champion';

const POSITION_LABELS: Record<Position, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: '원딜',
  support: '서포터',
};

interface ChampionGridProps {
  filteredChampions: Champion[];
  selectedChampion: string | null;
  filterPosition: Position | 'all';
  onSelectChampion: (id: string) => void;
  onFilterChange: (pos: Position | 'all') => void;
}

export function ChampionGrid({
  filteredChampions,
  selectedChampion,
  filterPosition,
  onSelectChampion,
  onFilterChange,
}: ChampionGridProps) {
  return (
    <div style={styles.champGrid}>
      {/* 포지션 필터 */}
      <div style={styles.filterRow}>
        <button
          style={{
            ...styles.filterBtn,
            background: filterPosition === 'all' ? '#c89b3c33' : 'transparent',
            color: filterPosition === 'all' ? '#c89b3c' : '#6a6a7a',
          }}
          onClick={() => onFilterChange('all')}
        >
          전체
        </button>
        {(['top', 'jungle', 'mid', 'adc', 'support'] as Position[]).map((pos) => (
          <button
            key={pos}
            style={{
              ...styles.filterBtn,
              background: filterPosition === pos ? '#c89b3c33' : 'transparent',
              color: filterPosition === pos ? '#c89b3c' : '#6a6a7a',
            }}
            onClick={() => onFilterChange(pos)}
          >
            {POSITION_LABELS[pos]}
          </button>
        ))}
      </div>

      <div style={styles.champList}>
        {filteredChampions.map((champ) => (
          <div
            key={champ.id}
            style={{
              ...styles.champItem,
              borderColor: selectedChampion === champ.id ? '#c89b3c' : '#2a2a4a',
              background: selectedChampion === champ.id ? 'rgba(200,155,60,0.08)' : 'transparent',
            }}
            onClick={() => onSelectChampion(champ.id)}
          >
            <span style={styles.champName}>{champ.nameKo}</span>
            <span style={{
              ...styles.champTier,
              color: champ.tier === 'S' ? '#e74c3c' : champ.tier === 'A' ? '#f39c12' : '#6a6a7a',
            }}>
              {champ.tier}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  champGrid: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid #2a2a4a',
    borderRadius: '10px',
    padding: '16px',
  },
  filterRow: {
    display: 'flex',
    gap: '6px',
    marginBottom: '12px',
  },
  filterBtn: {
    padding: '4px 10px',
    border: '1px solid #2a2a4a',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  champList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: '6px',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  champItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    border: '1px solid',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  champName: {
    fontSize: '11px',
    color: '#e0e0e0',
  },
  champTier: {
    fontSize: '10px',
    fontWeight: 700,
  },
};
