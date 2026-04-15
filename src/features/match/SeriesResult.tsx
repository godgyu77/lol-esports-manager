import { useMemo, useState } from 'react';
import type React from 'react';
import type { GameResult } from '../../engine/match/matchSimulator';
import type { CoachInterviewTone, PostMatchInterviewPackage } from '../../engine/match/broadcastPresentation';
import { buildPostMatchInsightReport } from '../../engine/analysis/postMatchInsightEngine';
import { useNavigate } from 'react-router-dom';
import { MatchHighlights } from './MatchHighlights';
import { PostGameStats } from './PostGameStats';
import { getFollowUpRoute, getPrimaryFollowUp } from './postMatchFollowUp';
import './match.css';

interface SeriesResultProps {
  homeTeamShortName: string | undefined;
  awayTeamShortName: string | undefined;
  homeTeamName: string | undefined;
  awayTeamName: string | undefined;
  seriesScore: { home: number; away: number };
  studioPackage?: PostMatchInterviewPackage | null;
  gameResults?: GameResult[];
  perspectiveSide?: 'home' | 'away';
  onSelectCoachTone?: (tone: CoachInterviewTone) => void;
  onReturn: () => void;
}

function buildSeriesEmotion(params: {
  seriesScore: { home: number; away: number };
  homeTeamName: string | undefined;
  awayTeamName: string | undefined;
  perspectiveSide: 'home' | 'away';
  primaryFollowUpAction: string | null;
}) {
  const { seriesScore, homeTeamName, awayTeamName, perspectiveSide, primaryFollowUpAction } = params;
  const isHomeWin = seriesScore.home > seriesScore.away;
  const perspectiveWin = (perspectiveSide === 'home' && isHomeWin) || (perspectiveSide === 'away' && !isHomeWin);
  const winnerName = isHomeWin ? homeTeamName ?? '홈팀' : awayTeamName ?? '원정팀';
  const loserName = isHomeWin ? awayTeamName ?? '원정팀' : homeTeamName ?? '홈팀';
  const scoreGap = Math.abs(seriesScore.home - seriesScore.away);

  if (perspectiveWin && scoreGap >= 2) {
    return {
      label: '오늘의 감정',
      title: `${winnerName}이 시리즈를 확실하게 가져갔습니다`,
      summary: '한 세트짜리 업셋이 아니라, 준비와 실행이 시리즈 전체에서 먹혔다는 느낌이 남는 승리입니다.',
    };
  }

  if (!perspectiveWin && scoreGap >= 2) {
    return {
      label: '오늘의 감정',
      title: `${loserName}에게는 더 아픈 패배였습니다`,
      summary: `${primaryFollowUpAction ?? '후속 정리'}가 바로 떠오를 만큼, 오늘 시리즈는 패턴과 약점이 분명하게 드러났습니다.`,
    };
  }

  return {
    label: '오늘의 감정',
    title: perspectiveWin ? `${winnerName}이 끝 승부를 가져갔습니다` : `${loserName}은 마지막 한 걸음을 넘지 못했습니다`,
    summary: '매 세트의 흐름이 팽팽하게 흔들렸고, 마지막 판단과 집중력이 시리즈의 온도를 갈랐습니다.',
  };
}

function buildSeriesSignature(params: {
  gameResults?: GameResult[];
  homeTeamName: string | undefined;
  awayTeamName: string | undefined;
}) {
  const { gameResults, homeTeamName, awayTeamName } = params;
  const featuredGame = gameResults?.at(-1);
  if (!featuredGame) {
    return {
      label: '기억할 포인트',
      title: '마지막 세트의 체감이 이번 시리즈를 남깁니다',
      summary: '숫자보다 마지막에 누가 흐름을 붙잡았는지가 이번 시리즈 인상을 결정합니다.',
    };
  }

  const baronHome = featuredGame.events.filter((event) => event.type === 'baron' && event.side === 'home').length;
  const baronAway = featuredGame.events.filter((event) => event.type === 'baron' && event.side === 'away').length;
  if (baronHome + baronAway > 0) {
    const sideName = baronHome > baronAway ? homeTeamName ?? '홈팀' : awayTeamName ?? '원정팀';
    return {
      label: '기억할 포인트',
      title: `${sideName}의 마지막 오브젝트 장악`,
      summary: '결정적인 오브젝트 타이밍 하나가 시리즈의 마침표처럼 남았습니다.',
    };
  }

  return {
    label: '기억할 포인트',
    title: '마지막 세트의 주도권 싸움',
    summary: '마지막 게임에서 먼저 흐름을 쥔 쪽이 그대로 시리즈를 닫았습니다. 복기할 때 가장 먼저 떠올릴 장면입니다.',
  };
}

function buildSeriesPlayerStory(params: {
  gameResults?: GameResult[];
  homeTeamName: string | undefined;
  awayTeamName: string | undefined;
}) {
  const { gameResults, homeTeamName, awayTeamName } = params;
  const featuredGame = gameResults?.at(-1);

  if (!featuredGame) {
    return {
      label: '시리즈의 얼굴',
      title: '이번 시리즈를 남긴 핵심 선수 축이 아직 정리되지 않았습니다',
      summary: '마지막 세트의 중심 교전이 뚜렷해지면 어느 라인이 시리즈를 끌고 갔는지 더 분명하게 보이게 됩니다.',
    };
  }

  const isHomeWin = featuredGame.winnerSide === 'home';
  const winningPlayers = isHomeWin ? featuredGame.playerStatsHome : featuredGame.playerStatsAway;
  const losingPlayers = isHomeWin ? featuredGame.playerStatsAway : featuredGame.playerStatsHome;
  const winningTeamName = isHomeWin ? homeTeamName ?? '홈 팀' : awayTeamName ?? '원정 팀';
  const losingTeamName = isHomeWin ? awayTeamName ?? '원정 팀' : homeTeamName ?? '홈 팀';
  const standout = [...winningPlayers].sort((a, b) => b.damageDealt - a.damageDealt)[0];
  const burden = [...losingPlayers].sort((a, b) => b.deaths - a.deaths || a.damageDealt - b.damageDealt)[0];
  const standoutLane = standout?.position?.toUpperCase() ?? 'CORE';
  const burdenLane = burden?.position?.toUpperCase() ?? 'CORE';

  return {
    label: '시리즈의 얼굴',
    title: `${winningTeamName} ${standoutLane} 라인이 마지막 세트의 얼굴이 됐습니다`,
    summary:
      standout && burden
        ? `${winningTeamName}의 ${standoutLane} 라인이 딜 교환을 주도했고, ${losingTeamName} ${burdenLane} 라인은 ${burden.deaths}데스로 버티는 시간이 길지 않았습니다.`
        : '한 라인의 주도권과 무너진 대응이 시리즈 전체 인상을 남겼습니다.',
  };
}

export function SeriesResult({
  homeTeamShortName,
  awayTeamShortName,
  homeTeamName,
  awayTeamName,
  seriesScore,
  studioPackage,
  gameResults,
  perspectiveSide = 'home',
  onSelectCoachTone,
  onReturn,
}: SeriesResultProps) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'studio' | 'highlights' | 'stats'>('studio');
  const [selectedGameIdx, setSelectedGameIdx] = useState(0);
  const [selectedTone, setSelectedTone] = useState<CoachInterviewTone>('calm');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onReturn();
  };

  const winnerName = seriesScore.home > seriesScore.away ? homeTeamName : awayTeamName;
  const featuredGameIdx = gameResults && gameResults.length > 0 ? gameResults.length - 1 : 0;
  const coachAnswer = useMemo(
    () => studioPackage?.coachToneOptions.find((option) => option.tone === selectedTone)?.answer ?? '',
    [selectedTone, studioPackage],
  );
  const insightReports = useMemo(
    () => (gameResults ?? []).map((gameResult) => buildPostMatchInsightReport(gameResult, perspectiveSide)),
    [gameResults, perspectiveSide],
  );
  const featuredInsightReport = insightReports[featuredGameIdx];
  const primaryFollowUp = featuredInsightReport ? getPrimaryFollowUp(featuredInsightReport.followUps) : null;
  const emotionSummary = buildSeriesEmotion({
    seriesScore,
    homeTeamName,
    awayTeamName,
    perspectiveSide,
    primaryFollowUpAction: primaryFollowUp?.action ?? null,
  });
  const signatureMoment = buildSeriesSignature({ gameResults, homeTeamName, awayTeamName });
  const playerStory = buildSeriesPlayerStory({ gameResults, homeTeamName, awayTeamName });
  const normalizedEmotionSummary = useMemo(
    () => ({
      ...emotionSummary,
      label: '팬이 기억할 한 문장',
      summary: emotionSummary.summary.replace('승리입니다.', '승리였습니다.').replace('온도를 갈랐습니다.', '결말을 갈랐습니다.'),
    }),
    [emotionSummary],
  );
  const normalizedSignatureMoment = useMemo(
    () => ({
      ...signatureMoment,
      label: '팬이 기억할 장면',
    }),
    [signatureMoment],
  );

  const normalizedPlayerStory = useMemo(
    () => ({
      ...playerStory,
      label: '시리즈의 얼굴',
    }),
    [playerStory],
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
        <div className="match-between-result" style={{ margin: '12px 0 16px' }} data-testid="series-result-emotion-panel">
          <div className="match-between-result-label">{normalizedEmotionSummary.label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, textAlign: 'center' }}>{normalizedEmotionSummary.title}</div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', textAlign: 'center' }}>{normalizedEmotionSummary.summary}</p>
          <div
            className="match-studio-card"
            style={{ width: '100%', background: 'rgba(255,255,255,0.02)', padding: 12, marginTop: 4 }}
            data-testid="series-result-signature-card"
          >
            <span className="match-studio-card__eyebrow">{normalizedSignatureMoment.label}</span>
            <p className="match-studio-card__question">{normalizedSignatureMoment.title}</p>
            <p className="match-studio-card__body">{normalizedSignatureMoment.summary}</p>
          </div>
          <div
            className="match-studio-card"
            style={{ width: '100%', background: 'rgba(255,255,255,0.02)', padding: 12, marginTop: 4 }}
            data-testid="series-result-player-story-card"
          >
            <span className="match-studio-card__eyebrow">{normalizedPlayerStory.label}</span>
            <p className="match-studio-card__question">{normalizedPlayerStory.title}</p>
            <p className="match-studio-card__body">{normalizedPlayerStory.summary}</p>
          </div>
        </div>
        {primaryFollowUp ? (
          <div className="match-between-result" style={{ margin: '12px 0 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>다음 우선 행동</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{primaryFollowUp.action}</div>
            <p style={{ margin: '8px 0 12px', color: 'var(--text-secondary)' }}>{primaryFollowUp.summary}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="fm-btn fm-btn--primary"
                data-testid="series-result-primary-followup"
                onClick={() => navigate(getFollowUpRoute(primaryFollowUp.action))}
              >
                바로 정리하러 가기
              </button>
              <button
                type="button"
                className="fm-btn fm-btn--ghost"
                onClick={() => {
                  setSelectedGameIdx(featuredGameIdx);
                  setViewMode('stats');
                }}
              >
                근거 보기
              </button>
            </div>
          </div>
        ) : null}

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
                insightReport={insightReports[selectedGameIdx]}
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
