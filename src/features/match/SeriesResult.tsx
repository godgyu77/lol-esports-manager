import type React from 'react';
import type { GameResult } from '../../engine/match/matchSimulator';
import { MatchHighlights } from './MatchHighlights';
import './match.css';

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
    <div className="fm-overlay" role="dialog" aria-modal="true" aria-label="경기 결과" onKeyDown={handleKeyDown}>
      <div className="animate-scaleIn match-result-box">
        <h2 className="match-result-title">경기 종료</h2>
        <div className="match-result-score">
          <span className="match-result-team">{homeTeamShortName}</span>
          <span className="match-result-final">
            {seriesScore.home} : {seriesScore.away}
          </span>
          <span className="match-result-team">{awayTeamShortName}</span>
        </div>
        <p className="match-result-winner">
          {seriesScore.home > seriesScore.away
            ? homeTeamName
            : awayTeamName}{' '}
          승리!
        </p>
        {gameResults && gameResults.length > 0 && (
          <div className="match-result-highlights">
            <MatchHighlights
              gameResults={gameResults}
              homeTeamName={homeTeamShortName}
              awayTeamName={awayTeamShortName}
            />
          </div>
        )}
        {postMatchComment && (
          <div className="match-result-comment">
            <p className="match-result-headline">{postMatchComment.headline}</p>
            <p className="match-result-coach-comment">"{postMatchComment.coachComment}"</p>
          </div>
        )}
        <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={onReturn} autoFocus>
          대시보드로 돌아가기
        </button>
      </div>
    </div>
  );
}
