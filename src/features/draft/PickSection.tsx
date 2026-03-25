import type { TeamDraftState } from '../../engine/draft/draftEngine';
import type { Champion } from '../../types/champion';
import { POSITION_LABELS_KR as POSITION_LABELS } from '../../utils/constants';
import './draft.css';

interface PickSectionProps {
  picks: TeamDraftState['picks'];
  color: string;
  championDb: Champion[];
}

export function PickSection({ picks, color, championDb }: PickSectionProps) {
  return (
    <div className="draft-pick-column">
      {picks.map((p, i) => {
        const champ = championDb.find((c) => c.id === p.championId);
        return (
          <div key={i} className="draft-pick-slot" style={{ borderLeftColor: color }}>
            <span className="draft-pick-pos">{POSITION_LABELS[p.position]}</span>
            <span className="draft-pick-champ">{champ?.nameKo ?? p.championId}</span>
          </div>
        );
      })}
      {Array.from({ length: Math.max(0, 5 - picks.length) }).map((_, i) => (
        <div key={`e${i}`} className="draft-pick-slot--empty" style={{ borderLeftColor: `${color}33` }}>
          <span className="draft-pick-empty-text">—</span>
        </div>
      ))}
    </div>
  );
}
