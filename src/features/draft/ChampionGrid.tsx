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
    <div className="draft-champ-grid fm-card">
      <div className="draft-champ-grid-header">
        <div>
          <span className="draft-grid-kicker">챔피언 풀</span>
          <h3 className="draft-grid-title">선픽 후보</h3>
        </div>
        <span className="draft-grid-count">{filteredChampions.length}명 선택 가능</span>
      </div>

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

      <div className="draft-grid-note">
        픽 단계에서는 포지션 상관없이 먼저 챔피언을 확보하고, 마지막 스왑에서 선수 자리에 재배치할 수 있습니다.
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
            <button
              key={champ.id}
              type="button"
              className={itemClass}
              onClick={() => !isFearlessBlocked && onSelectChampion(champ.id)}
              title={isFearlessBlocked ? '하드 피어리스 규칙으로 이번 세트에서는 사용할 수 없습니다.' : undefined}
            >
              <span className="draft-champ-name">{champ.nameKo}</span>
              {isFearlessBlocked ? (
                <span className="draft-fearless-tag">제한됨</span>
              ) : (
                <span className={`draft-champ-tier ${getTierClass(champ.tier)}`}>{champ.tier}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
