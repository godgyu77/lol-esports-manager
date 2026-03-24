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
    <div className="draft-ban-row">
      <span className="draft-ban-label">BAN</span>
      {bans.map((id, i) => {
        const champ = championDb.find((c) => c.id === id);
        return (
          <div key={i} className="draft-ban-slot" style={{ borderColor: `${color}44` }}>
            <span className="draft-ban-champ-name">{champ?.nameKo ?? id}</span>
          </div>
        );
      })}
      {Array.from({ length: 5 - bans.length }).map((_, i) => (
        <div key={`e${i}`} className="draft-ban-slot" style={{ borderColor: `${color}22` }} />
      ))}
    </div>
  );
}
