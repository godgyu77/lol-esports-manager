import type React from 'react';
import type { GameResult } from '../../engine/match/matchSimulator';
import { MatchHighlights } from './MatchHighlights';

interface SeriesResultProps {
  homeTeamShortName: string | undefined;
  awayTeamShortName: string | undefined;
  homeTeamName: string | undefined;
  awayTeamName: string | undefined;
  seriesScore: { home: number; away: number };
  postMatchComment?: { headline: string; coachComment: string } | null;
  gameResults?: GameResult[];
  onReturn: () => void;
}

export function SeriesResult({
  homeTeamShortName,
  awayTeamShortName,
  homeTeamName,
  awayTeamName,
  seriesScore,
  postMatchComment,
  gameResults,
  onReturn,
}: SeriesResultProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onReturn();
  };

  return (
    <div style={styles.decisionOverlay} role="dialog" aria-modal="true" aria-label="경기 결과" onKeyDown={handleKeyDown}>
      <div className="animate-scaleIn" style={styles.resultBox}>
        <h2 style={styles.resultTitle}>경기 종료</h2>
        <div style={styles.resultScore}>
          <span style={styles.resultTeam}>{homeTeamShortName}</span>
          <span style={styles.resultFinal}>
            {seriesScore.home} : {seriesScore.away}
          </span>
          <span style={styles.resultTeam}>{awayTeamShortName}</span>
        </div>
        <p style={styles.resultWinner}>
          {seriesScore.home > seriesScore.away
            ? homeTeamName
            : awayTeamName}{' '}
          승리!
        </p>
        {gameResults && gameResults.length > 0 && (
          <div style={{ maxHeight: '300px', overflowY: 'auto', textAlign: 'left', marginBottom: '16px' }}>
            <MatchHighlights
              gameResults={gameResults}
              homeTeamName={homeTeamShortName}
              awayTeamName={awayTeamShortName}
            />
          </div>
        )}
        {postMatchComment && (
          <div style={styles.commentSection}>
            <p style={styles.headline}>{postMatchComment.headline}</p>
            <p style={styles.coachComment}>"{postMatchComment.coachComment}"</p>
          </div>
        )}
        <button style={styles.returnBtn} onClick={onReturn} autoFocus>
          대시보드로 돌아가기
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  decisionOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  resultBox: {
    background: '#1a1a3a',
    border: '2px solid #c89b3c',
    borderRadius: '16px',
    padding: '40px',
    textAlign: 'center',
    minWidth: '400px',
  },
  resultTitle: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#f0e6d2',
    marginBottom: '20px',
  },
  resultScore: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '24px',
    marginBottom: '16px',
  },
  resultTeam: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#e0e0e0',
  },
  resultFinal: {
    fontSize: '36px',
    fontWeight: 800,
    color: '#c89b3c',
  },
  resultWinner: {
    fontSize: '16px',
    color: '#2ecc71',
    fontWeight: 600,
    marginBottom: '24px',
  },
  commentSection: {
    marginBottom: '20px',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    borderLeft: '3px solid #c89b3c',
  },
  headline: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#c89b3c',
    marginBottom: '6px',
  },
  coachComment: {
    fontSize: '13px',
    color: '#8a8a9a',
    fontStyle: 'italic',
  },
  returnBtn: {
    padding: '12px 32px',
    background: '#c89b3c',
    color: '#0d0d1a',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
