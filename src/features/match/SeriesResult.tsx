import { useState } from 'react';
import type React from 'react';
import type { GameResult } from '../../engine/match/matchSimulator';
import { MatchHighlights } from './MatchHighlights';
import { PostGameStats } from './PostGameStats';
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
  const [viewMode, setViewMode] = useState<'highlights' | 'stats'>('highlights');
  const [selectedGameIdx, setSelectedGameIdx] = useState(0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onReturn();
  };

  const winnerName = seriesScore.home > seriesScore.away ? homeTeamName : awayTeamName;

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
        <p className="match-result-winner">{winnerName} 승리</p>

        {gameResults && gameResults.length > 0 ? (
          <div className="match-result-highlights">
            <div className="match-result-view-toggle">
              <button
                className={`match-result-tab-btn ${viewMode === 'highlights' ? 'match-result-tab-btn--active' : ''}`}
                onClick={() => setViewMode('highlights')}
              >
                하이라이트
              </button>
              <button
                className={`match-result-tab-btn ${viewMode === 'stats' ? 'match-result-tab-btn--active' : ''}`}
                onClick={() => setViewMode('stats')}
              >
                경기 통계
              </button>
            </div>

            {viewMode === 'highlights' ? (
              <MatchHighlights
                gameResults={gameResults}
                homeTeamName={homeTeamShortName}
                awayTeamName={awayTeamShortName}
              />
            ) : (
              <>
                {gameResults.length > 1 && (
                  <div className="match-result-game-tabs">
                    {gameResults.map((_, i) => (
                      <button
                        key={i}
                        className={`match-result-tab-btn ${selectedGameIdx === i ? 'match-result-tab-btn--active' : ''}`}
                        onClick={() => setSelectedGameIdx(i)}
                      >
                        {i + 1}세트
                      </button>
                    ))}
                  </div>
                )}
                {gameResults[selectedGameIdx] && (
                  <PostGameStats
                    gameResult={gameResults[selectedGameIdx]}
                    homeTeamName={homeTeamShortName ?? '홈'}
                    awayTeamName={awayTeamShortName ?? '원정'}
                    gameNumber={selectedGameIdx + 1}
                  />
                )}
              </>
            )}
          </div>
        ) : null}

        {postMatchComment ? (
          <div className="match-result-comment">
            <p className="match-result-headline">{postMatchComment.headline}</p>
            <p className="match-result-coach-comment">"{postMatchComment.coachComment}"</p>
          </div>
        ) : null}

        <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={onReturn} autoFocus>
          대시보드로 돌아가기
        </button>
      </div>
    </div>
  );
}
