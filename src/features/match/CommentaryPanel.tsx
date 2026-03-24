import { type RefObject } from 'react';
import type { Commentary } from '../../engine/match/liveMatch';
import './match.css';

interface CommentaryPanelProps {
  commentary: Commentary[];
  panelRef: RefObject<HTMLDivElement | null>;
}

function getCommentaryMsgClass(type: Commentary['type']): string {
  switch (type) {
    case 'kill': return 'match-commentary-msg match-commentary-msg--kill';
    case 'objective': return 'match-commentary-msg match-commentary-msg--objective';
    case 'teamfight': return 'match-commentary-msg match-commentary-msg--teamfight';
    case 'decision': return 'match-commentary-msg match-commentary-msg--decision';
    case 'highlight': return 'match-commentary-msg match-commentary-msg--highlight';
    default: return 'match-commentary-msg match-commentary-msg--default';
  }
}

export function CommentaryPanel({ commentary, panelRef }: CommentaryPanelProps) {
  return (
    <div className="match-commentary-panel" ref={panelRef}>
      <h3 className="match-commentary-title">경기 중계</h3>
      {commentary.map((c, i) => (
        <div key={i} className="match-commentary-item">
          <span className="match-commentary-tick">{c.tick}분</span>
          <span className={getCommentaryMsgClass(c.type)}>
            {c.message}
          </span>
        </div>
      ))}
    </div>
  );
}
