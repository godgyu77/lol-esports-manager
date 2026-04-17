import type { TeamDraftState } from '../../engine/draft/draftEngine';
import type { Champion } from '../../types/champion';
import './draft.css';

interface BanSectionProps {
  blueBans: TeamDraftState['bans'];
  redBans: TeamDraftState['bans'];
  championDb: Champion[];
}

export function BanSection({ blueBans, redBans, championDb }: BanSectionProps) {
  return (
    <div className="draft-ban-section">
      <BanRow label="블루 밴" bans={blueBans} color="#3b82f6" championDb={championDb} />
      <BanRow label="레드 밴" bans={redBans} color="#ef4444" championDb={championDb} />
    </div>
  );
}

interface BanRowProps {
  label: string;
  bans: string[];
  color: string;
  championDb: Champion[];
}

function BanRow({ label, bans, color, championDb }: BanRowProps) {
  return (
    <div className="draft-ban-row">
      <span className="draft-ban-label">{label}</span>
      {bans.map((id, index) => {
        const champ = championDb.find((c) => c.id === id);
        return (
          <div key={index} className="draft-ban-slot" style={{ borderColor: `${color}55` }}>
            <span className="draft-ban-champ-name">{champ?.nameKo ?? champ?.name ?? id}</span>
          </div>
        );
      })}
      {Array.from({ length: 5 - bans.length }).map((_, index) => (
        <div key={`empty-${index}`} className="draft-ban-slot draft-ban-slot--empty" style={{ borderColor: `${color}22` }} />
      ))}
    </div>
  );
}
