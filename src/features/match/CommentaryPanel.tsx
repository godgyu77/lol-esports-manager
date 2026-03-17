import { type RefObject } from 'react';
import type React from 'react';
import type { Commentary } from '../../engine/match/liveMatch';

interface CommentaryPanelProps {
  commentary: Commentary[];
  panelRef: RefObject<HTMLDivElement | null>;
}

export function CommentaryPanel({ commentary, panelRef }: CommentaryPanelProps) {
  return (
    <div style={styles.commentaryPanel} ref={panelRef}>
      <h3 style={styles.commentaryTitle}>경기 중계</h3>
      {commentary.map((c, i) => (
        <div key={i} style={styles.commentaryItem}>
          <span style={styles.commentaryTick}>{c.tick}분</span>
          <span
            style={{
              ...styles.commentaryMsg,
              color: getCommentaryColor(c.type),
            }}
          >
            {c.message}
          </span>
        </div>
      ))}
    </div>
  );
}

function getCommentaryColor(type: Commentary['type']): string {
  switch (type) {
    case 'kill': return '#e74c3c';
    case 'objective': return '#f39c12';
    case 'teamfight': return '#e74c3c';
    case 'decision': return '#c89b3c';
    case 'highlight': return '#2ecc71';
    default: return '#8a8a9a';
  }
}

const styles: Record<string, React.CSSProperties> = {
  commentaryPanel: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid #2a2a4a',
    borderRadius: '10px',
    padding: '16px',
    maxHeight: '250px',
    overflowY: 'auto',
  },
  commentaryTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#c89b3c',
    marginBottom: '10px',
  },
  commentaryItem: {
    display: 'flex',
    gap: '10px',
    padding: '4px 0',
    borderBottom: '1px solid rgba(255,255,255,0.02)',
  },
  commentaryTick: {
    fontSize: '11px',
    color: '#6a6a7a',
    minWidth: '36px',
    fontFamily: 'monospace',
  },
  commentaryMsg: {
    fontSize: '13px',
    lineHeight: 1.4,
  },
};
