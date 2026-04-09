import { useMemo, useState } from 'react';
import type React from 'react';
import type { GameResult } from '../../engine/match/matchSimulator';
import type { CoachInterviewTone, PostMatchInterviewPackage } from '../../engine/match/broadcastPresentation';
import { MatchHighlights } from './MatchHighlights';
import { PostGameStats } from './PostGameStats';
import './match.css';

interface SeriesResultProps {
  homeTeamShortName: string | undefined;
  awayTeamShortName: string | undefined;
  homeTeamName: string | undefined;
  awayTeamName: string | undefined;
  seriesScore: { home: number; away: number };
  studioPackage?: PostMatchInterviewPackage | null;
  gameResults?: GameResult[];
  onSelectCoachTone?: (tone: CoachInterviewTone) => void;
  onReturn: () => void;
}

export function SeriesResult({
  homeTeamShortName,
  awayTeamShortName,
  homeTeamName,
  awayTeamName,
  seriesScore,
  studioPackage,
  gameResults,
  onSelectCoachTone,
  onReturn,
}: SeriesResultProps) {
  const [viewMode, setViewMode] = useState<'studio' | 'highlights' | 'stats'>('studio');
  const [selectedGameIdx, setSelectedGameIdx] = useState(0);
  const [selectedTone, setSelectedTone] = useState<CoachInterviewTone>('calm');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onReturn();
  };

  const winnerName = seriesScore.home > seriesScore.away ? homeTeamName : awayTeamName;
  const coachAnswer = useMemo(
    () => studioPackage?.coachToneOptions.find((option) => option.tone === selectedTone)?.answer ?? '',
    [selectedTone, studioPackage],
  );

  return (
    <div className="fm-overlay" role="dialog" aria-modal="true" aria-label="경기 결과" onKeyDown={handleKeyDown}>
      <div className="animate-scaleIn match-result-box match-result-box--studio">
        <h2 className="match-result-title">경기 종료</h2>
        <div className="match-result-score">
          <span className="match-result-team">{homeTeamShortName}</span>
          <span className="match-result-final">
            {seriesScore.home} : {seriesScore.away}
          </span>
          <span className="match-result-team">{awayTeamShortName}</span>
        </div>
        <p className="match-result-winner">{winnerName} 승리</p>

        <div className="match-result-view-toggle">
          <button
            className={`match-result-tab-btn ${viewMode === 'studio' ? 'match-result-tab-btn--active' : ''}`}
            onClick={() => setViewMode('studio')}
          >
            스튜디오
          </button>
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

        {viewMode === 'studio' ? (
          <div className="match-studio-grid">
            <section className="match-studio-card">
              <span className="match-studio-card__eyebrow">중계 오프닝</span>
              <p className="match-studio-card__body">{studioPackage?.openingHeadline ?? '경기 오프닝 정리 중입니다.'}</p>
              <p className="match-studio-card__sub">{studioPackage?.draftWrapUp ?? '밴픽 총평을 정리하고 있습니다.'}</p>
            </section>

            <section className="match-studio-card">
              <span className="match-studio-card__eyebrow">스튜디오 정리</span>
              <p className="match-studio-card__body">
                {studioPackage?.announcerIntro ?? '중계진이 오늘 경기 흐름을 정리하고 있습니다.'}
              </p>
              <p className="match-studio-card__sub">{studioPackage?.studioSummary ?? '경기 총평이 곧 반영됩니다.'}</p>
            </section>

            <section className="match-studio-card match-studio-card--accent">
              <span className="match-studio-card__eyebrow">오늘의 POM</span>
              <p className="match-studio-card__question">{studioPackage?.pomAnnouncement ?? 'POM 발표를 준비 중입니다.'}</p>
              <h3 className="match-studio-pom__name">{studioPackage?.pomName ?? '집계 중'}</h3>
              <p className="match-studio-pom__team">{studioPackage?.pomTeamName ?? '팀 정보 집계 중'}</p>
              <p className="match-studio-card__body">{studioPackage?.pomReason ?? '오늘 경기 최고 활약 선수를 집계하고 있습니다.'}</p>
            </section>

            <section className="match-studio-card">
              <span className="match-studio-card__eyebrow">POM 인터뷰</span>
              <p className="match-studio-card__question">{studioPackage?.pomInterviewQuestion ?? '인터뷰 질문을 준비 중입니다.'}</p>
              <p className="match-studio-card__body">{studioPackage?.pomInterviewAnswer ?? '선수 인터뷰가 곧 연결됩니다.'}</p>
            </section>

            <section className="match-studio-card">
              <span className="match-studio-card__eyebrow">감독 인터뷰</span>
              <p className="match-studio-card__question">{studioPackage?.coachQuestion ?? '감독 인터뷰 질문을 정리 중입니다.'}</p>
              <div className="match-studio-tone-row">
                {studioPackage?.coachToneOptions.map((option) => (
                  <button
                    key={option.tone}
                    type="button"
                    className={`match-studio-tone-btn ${selectedTone === option.tone ? 'match-studio-tone-btn--active' : ''}`}
                    onClick={() => {
                      setSelectedTone(option.tone);
                      onSelectCoachTone?.(option.tone);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="match-studio-card__body">{coachAnswer || '감독 코멘트를 정리하고 있습니다.'}</p>
            </section>

            <section className="match-studio-card">
              <span className="match-studio-card__eyebrow">기사 헤드라인</span>
              <p className="match-studio-card__body">{studioPackage?.aftermathHeadline ?? '기사 헤드라인을 생성 중입니다.'}</p>
            </section>

            {studioPackage?.guestSummary ? (
              <section className="match-studio-card">
                <span className="match-studio-card__eyebrow">특별 해설 총평</span>
                <p className="match-studio-card__question">{studioPackage.guestAnalystName} 특별 해설</p>
                <p className="match-studio-card__body">{studioPackage.guestSummary}</p>
              </section>
            ) : null}

            <section className="match-studio-card">
              <span className="match-studio-card__eyebrow">팬 반응</span>
              <p className="match-studio-card__body">{studioPackage?.fanReaction ?? '팬 반응을 모으는 중입니다.'}</p>
              <p className="match-studio-card__sub">{studioPackage?.socialReaction ?? '커뮤니티 반응을 정리 중입니다.'}</p>
            </section>
          </div>
        ) : null}

        {viewMode === 'highlights' && gameResults && gameResults.length > 0 ? (
          <div className="match-result-highlights">
            <MatchHighlights
              gameResults={gameResults}
              homeTeamName={homeTeamShortName}
              awayTeamName={awayTeamShortName}
            />
          </div>
        ) : null}

        {viewMode === 'stats' && gameResults && gameResults.length > 0 ? (
          <div className="match-result-highlights">
            {gameResults.length > 1 ? (
              <div className="match-result-game-tabs">
                {gameResults.map((_, index) => (
                  <button
                    key={index}
                    className={`match-result-tab-btn ${selectedGameIdx === index ? 'match-result-tab-btn--active' : ''}`}
                    onClick={() => setSelectedGameIdx(index)}
                  >
                    {index + 1}세트
                  </button>
                ))}
              </div>
            ) : null}
            {gameResults[selectedGameIdx] ? (
              <PostGameStats
                gameResult={gameResults[selectedGameIdx]}
                homeTeamName={homeTeamShortName ?? '홈'}
                awayTeamName={awayTeamShortName ?? '원정'}
                gameNumber={selectedGameIdx + 1}
              />
            ) : null}
          </div>
        ) : null}

        <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={onReturn} autoFocus>
          대시보드로 돌아가기
        </button>
      </div>
    </div>
  );
}
