import type { Position } from '../../types/game';
import type { Champion } from '../../types/champion';
import { POSITION_LABELS_KR as POSITION_LABELS } from '../../utils/constants';
import './draft.css';

interface ChampionGridProps {
  filteredChampions: Champion[];
  selectedChampion: string | null;
  filterPosition: Position | 'all';
  fearlessDisabledIds?: Set<string>;
  onSelectChampion: (id: string) => void;
  onFilterChange: (pos: Position | 'all') => void;
}

function getTierClass(tier: string): string {
  if (tier === 'S') return 'draft-champ-tier--s';
  if (tier === 'A') return 'draft-champ-tier--a';
  return 'draft-champ-tier--default';
}

export function ChampionGrid({
  filteredChampions,
  selectedChampion,
  filterPosition,
  fearlessDisabledIds,
  onSelectChampion,
  onFilterChange,
}: ChampionGridProps) {
  return (
    <div className="draft-champ-grid">
      {/* 포지션 필터 */}
      <div className="draft-filter-row">
        <button
          className={`draft-filter-btn ${filterPosition === 'all' ? 'draft-filter-btn--active' : ''}`}
          onClick={() => onFilterChange('all')}
        >
          전체
        </button>
        {(['top', 'jungle', 'mid', 'adc', 'support'] as Position[]).map((pos) => (
          <button
            key={pos}
            className={`draft-filter-btn ${filterPosition === pos ? 'draft-filter-btn--active' : ''}`}
            onClick={() => onFilterChange(pos)}
          >
            {POSITION_LABELS[pos]}
          </button>
        ))}
      </div>

      <div className="draft-champ-list">
        {filteredChampions.map((champ) => {
          const isFearlessBlocked = fearlessDisabledIds?.has(champ.id) ?? false;
          const isSelected = selectedChampion === champ.id;

          const itemClass = [
            'draft-champ-item',
            isFearlessBlocked ? 'draft-champ-item--fearless' : '',
            !isFearlessBlocked && isSelected ? 'draft-champ-item--selected' : '',
          ].filter(Boolean).join(' ');

          return (
            <div
              key={champ.id}
              className={itemClass}
              onClick={() => !isFearlessBlocked && onSelectChampion(champ.id)}
              title={isFearlessBlocked ? '피어리스: 이전 세트에서 사용됨' : undefined}
            >
              <span className="draft-champ-name">{champ.nameKo}</span>
              {isFearlessBlocked ? (
                <span className="draft-fearless-tag">사용됨</span>
              ) : (
                <span className={`draft-champ-tier ${getTierClass(champ.tier)}`}>
                  {champ.tier}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
