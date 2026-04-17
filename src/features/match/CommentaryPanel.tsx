import { type RefObject } from 'react';
import type { Commentary } from '../../engine/match/liveMatch';
import './match.css';

interface CommentaryPanelProps {
  commentary: Commentary[];
  panelRef: RefObject<HTMLDivElement | null>;
}

const KEY_EVENT_TYPES = new Set(['kill', 'teamfight', 'objective', 'highlight']);

const EVENT_PREFIX: Partial<Record<Commentary['type'], string>> = {
  kill: '킬',
  teamfight: '한타',
  objective: '오브젝트',
  highlight: '주목',
  decision: '판단',
};

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
  const orderedCommentary = [...commentary].reverse();

  return (
    <div className="match-commentary-panel" ref={panelRef}>
      <h3 className="match-commentary-title">경기 중계</h3>
      {orderedCommentary.map((c, i) => (
        <div key={`${c.tick}-${i}`} className={`match-commentary-item${KEY_EVENT_TYPES.has(c.type) ? ' match-commentary-item--key' : ''}`}>
          <span className="match-commentary-tick">{c.tick}분</span>
          <span className={getCommentaryMsgClass(c.type)}>
            {EVENT_PREFIX[c.type] ? <span className="match-commentary-icon">{EVENT_PREFIX[c.type]}</span> : null}
            {c.message}
          </span>
        </div>
      ))}
    </div>
  );
}
