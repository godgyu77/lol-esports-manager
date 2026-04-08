import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/gameStore';
import { useMatchStore, type MatchSpeedPreset } from '../../stores/matchStore';
import { useBgm } from '../../hooks/useBgm';
import { LiveMatchEngine, type Decision, type LiveGameState } from '../../engine/match/liveMatch';
import { buildLineup } from '../../engine/match/teamRating';
import { getFormByTeamId, getPlayersByTeamId, getTeamPlayStyle, getTraitsByTeamId } from '../../db/queries';
import { calculateChemistryBonus } from '../../engine/chemistry/chemistryEngine';
import { calculateTeamSoloRankBonus } from '../../engine/soloRank/soloRankEngine';
import { saveUserMatchResult } from '../../engine/season/dayAdvancer';
import { processPlayoffMatchResult } from '../../engine/season/playoffGenerator';
import { processTournamentMatchResult } from '../../engine/tournament/tournamentEngine';
import { generatePostMatchComment, type PostMatchComment } from '../../ai/gameAiService';
import { generateLiveChatMessages, type LiveChatMessage } from '../../ai/advancedAiService';
import { accumulateFearlessChampions } from '../../engine/draft/draftEngine';
import type { GameResult, MatchResult } from '../../engine/match/matchSimulator';
import { CommentaryPanel } from './CommentaryPanel';
import { DecisionPopup } from './DecisionPopup';
import { SeriesResult } from './SeriesResult';
import { TacticsPanel } from './TacticsPanel';
import { BroadcastHud } from './BroadcastHud';
import './match.css';

const BroadcastBattlefield = lazy(() =>
  import('./BroadcastBattlefield').then((module) => ({ default: module.BroadcastBattlefield })),
);

const SPEED_PRESETS: Array<{ key: MatchSpeedPreset; label: string }> = [
  { key: 'focus', label: '집중' },
  { key: 'standard', label: '기본' },
  { key: 'fast', label: '고속' },
];

const PHASE_LABELS: Record<string, string> = {
  loading: '로딩',
  laning: '라인전',
  mid_game: '중반',
  late_game: '후반',
  finished: '종료',
};

function getTickInterval(speed: number) {
  return Math.max(360, 1800 / Math.max(speed, 0.5));
}

function toGameResult(state: LiveGameState): GameResult {
  return {
    winnerSide: state.winner ?? (state.goldHome >= state.goldAway ? 'home' : 'away'),
    durationMinutes: state.currentTick,
    goldDiffAt15: state.goldHistory.find((entry) => entry.tick >= 15)?.diff ?? 0,
    killsHome: state.killsHome,
    killsAway: state.killsAway,
    goldHome: state.goldHome,
    goldAway: state.goldAway,
    towersHome: state.towersHome,
    towersAway: state.towersAway,
    events: state.events,
    playerStatsHome: state.playerStatsHome.map((player) => ({
      playerId: player.playerId,
      position: player.position,
      kills: player.kills,
      deaths: player.deaths,
      assists: player.assists,
      cs: player.cs,
      goldEarned: player.goldEarned,
      damageDealt: player.damageDealt,
    })),
    playerStatsAway: state.playerStatsAway.map((player) => ({
      playerId: player.playerId,
      position: player.position,
      kills: player.kills,
      deaths: player.deaths,
      assists: player.assists,
      cs: player.cs,
      goldEarned: player.goldEarned,
      damageDealt: player.damageDealt,
    })),
    dragonSoul: state.dragonSoul,
    grubsHome: state.grubsHome,
    grubsAway: state.grubsAway,
    goldHistory: state.goldHistory,
  };
}

export function LiveMatchView() {
  useBgm('match');
  const navigate = useNavigate();

  const save = useGameStore((s) => s.save);
  const pendingMatch = useGameStore((s) => s.pendingUserMatch);
  const teams = useGameStore((s) => s.teams);
  const draftResult = useGameStore((s) => s.draftResult);
  const setDraftResult = useGameStore((s) => s.setDraftResult);
  const setFearlessPool = useGameStore((s) => s.setFearlessPool);
  const setDayPhase = useGameStore((s) => s.setDayPhase);
  const setPendingUserMatch = useGameStore((s) => s.setPendingUserMatch);
  const mode = useGameStore((s) => s.mode);
  const currentDate = useGameStore((s) => s.season)?.currentDate ?? '';

  const speed = useMatchStore((s) => s.speed);
  const speedPreset = useMatchStore((s) => s.speedPreset);
  const setSpeedPreset = useMatchStore((s) => s.setSpeedPreset);
  const seriesScore = useMatchStore((s) => s.seriesScore);
  const setSeriesScore = useMatchStore((s) => s.setSeriesScore);
  const currentGameNum = useMatchStore((s) => s.currentGameNum);
  const gameResults = useMatchStore((s) => s.gameResults);
  const setGameResults = useMatchStore((s) => s.setGameResults);
  const betweenGames = useMatchStore((s) => s.betweenGames);
  const setBetweenGames = useMatchStore((s) => s.setBetweenGames);
  const hardFearlessSeries = useMatchStore((s) => s.hardFearlessSeries);
  const currentGameDraftRequired = useMatchStore((s) => s.currentGameDraftRequired);
  const setCurrentGameDraftRequired = useMatchStore((s) => s.setCurrentGameDraftRequired);
  const seriesFearlessPool = useMatchStore((s) => s.seriesFearlessPool);
  const setSeriesFearlessPool = useMatchStore((s) => s.setSeriesFearlessPool);
  const resetSeries = useMatchStore((s) => s.resetSeries);
  const setMatchActive = useMatchStore((s) => s.setMatchActive);
  const winsNeeded = useMatchStore((s) => s.winsNeeded);

  const [engine, setEngine] = useState<LiveMatchEngine | null>(null);
  const [gameState, setGameState] = useState<LiveGameState | null>(null);
  const [currentDecision, setCurrentDecision] = useState<Decision | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [seriesComplete, setSeriesComplete] = useState(false);
  const [postMatchComment, setPostMatchComment] = useState<PostMatchComment | null>(null);
  const [liveChatMessages, setLiveChatMessages] = useState<LiveChatMessage[]>([]);
  const [matchError, setMatchError] = useState<string | null>(null);

  const commentaryRef = useRef<HTMLDivElement>(null);
  const lastEventCount = useRef(0);
  const finalizedGame = useRef<number | null>(null);
  const userScrolled = useRef(false);

  const basePath = mode === 'player' ? '/player' : '/manager';
  const homeTeam = teams.find((team) => team.id === pendingMatch?.teamHomeId);
  const awayTeam = teams.find((team) => team.id === pendingMatch?.teamAwayId);
  const userSide =
    pendingMatch && save?.userTeamId ? (pendingMatch.teamHomeId === save.userTeamId ? 'home' : 'away') : 'home';

  useEffect(() => {
    setMatchActive(true);
    return () => setMatchActive(false);
  }, [setMatchActive]);

  useEffect(() => {
    if (userScrolled.current) return;
    if (commentaryRef.current) commentaryRef.current.scrollTop = commentaryRef.current.scrollHeight;
  }, [gameState?.commentary.length]);

  useEffect(() => {
    const el = commentaryRef.current;
    if (!el) return;
    const handleScroll = () => {
      userScrolled.current = el.scrollTop + el.clientHeight < el.scrollHeight - 40;
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [engine]);

  const initGame = useCallback(async () => {
    if (!pendingMatch || !save) return;
    if (currentGameDraftRequired && !draftResult) {
      setEngine(null);
      setGameState(null);
      return;
    }

    const [homePlayers, awayPlayers] = await Promise.all([
      getPlayersByTeamId(pendingMatch.teamHomeId),
      getPlayersByTeamId(pendingMatch.teamAwayId),
    ]);
    const homeLineup = buildLineup(homePlayers);
    const awayLineup = buildLineup(awayPlayers);
    if (!homeLineup || !awayLineup) {
      setMatchError('라인업을 완성하지 못해 경기를 시작할 수 없습니다.');
      return;
    }

    const [
      homeTraits,
      awayTraits,
      homePlayStyle,
      awayPlayStyle,
      homeForm,
      awayForm,
      homeChem,
      awayChem,
      homeSolo,
      awaySolo,
    ] = await Promise.all([
      getTraitsByTeamId(pendingMatch.teamHomeId),
      getTraitsByTeamId(pendingMatch.teamAwayId),
      getTeamPlayStyle(pendingMatch.teamHomeId),
      getTeamPlayStyle(pendingMatch.teamAwayId),
      currentDate ? getFormByTeamId(pendingMatch.teamHomeId, currentDate) : Promise.resolve({}),
      currentDate ? getFormByTeamId(pendingMatch.teamAwayId, currentDate) : Promise.resolve({}),
      calculateChemistryBonus(pendingMatch.teamHomeId).catch(() => 0),
      calculateChemistryBonus(pendingMatch.teamAwayId).catch(() => 0),
      calculateTeamSoloRankBonus(pendingMatch.teamHomeId).catch(() => 0),
      calculateTeamSoloRankBonus(pendingMatch.teamAwayId).catch(() => 0),
    ]);

    const liveEngine = new LiveMatchEngine({
      homeLineup,
      awayLineup,
      homeTraits,
      awayTraits,
      homeForm,
      awayForm,
      seed: `${pendingMatch.id}_g${currentGameNum}`,
      gameMode: save.mode,
      draftResult,
      homePlayStyle,
      awayPlayStyle,
      homeExtraBonus: homeChem + homeSolo,
      awayExtraBonus: awayChem + awaySolo,
    });

    setEngine(liveEngine);
    setGameState(liveEngine.getState());
    setCurrentDecision(null);
    setIsRunning(false);
    setMatchError(null);
    setLiveChatMessages([]);
    lastEventCount.current = 0;
    finalizedGame.current = null;
    setSpeedPreset('focus');
  }, [currentDate, currentGameDraftRequired, currentGameNum, draftResult, pendingMatch, save, setSpeedPreset]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void initGame();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initGame]);

  useEffect(() => {
    if (!engine || !isRunning || currentDecision) return;
    const tickInterval = getTickInterval(speed);
    let lastTickTime = performance.now();
    let animationId = 0;
    const loop = (now: number) => {
      if (now - lastTickTime >= tickInterval) {
        lastTickTime = now;
        const paused = engine.advance();
        const nextState = engine.getState();
        setGameState({ ...nextState });
        if (paused && nextState.pendingDecision) {
          setCurrentDecision(nextState.pendingDecision);
          setIsRunning(false);
          return;
        }
        if (nextState.isFinished) {
          setIsRunning(false);
          return;
        }
      }
      animationId = requestAnimationFrame(loop);
    };
    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [currentDecision, engine, isRunning, speed]);

  useEffect(() => {
    if (!gameState || gameState.isFinished) return;
    const newEvents = gameState.events.slice(lastEventCount.current);
    if (newEvents.length === 0) return;
    lastEventCount.current = gameState.events.length;
    const majorEvent = [...newEvents].reverse().find((event) =>
      ['kill', 'dragon', 'baron', 'tower_destroy', 'teamfight'].includes(event.type),
    );
    if (!majorEvent) return;
    generateLiveChatMessages({
      teamName: homeTeam?.shortName ?? 'HOME',
      opponentName: awayTeam?.shortName ?? 'AWAY',
      event: majorEvent.type,
      isWinning: gameState.goldHome >= gameState.goldAway,
      goldDiff: gameState.goldHome - gameState.goldAway,
      gameTime: gameState.currentTick,
      count: 3,
    })
      .then((messages) => setLiveChatMessages((prev) => [...prev, ...messages].slice(-12)))
      .catch(() => {});
  }, [awayTeam?.shortName, gameState, homeTeam?.shortName]);

  useEffect(() => {
    if (!gameState?.isFinished || !pendingMatch || finalizedGame.current === currentGameNum) return;
    finalizedGame.current = currentGameNum;

    const finalize = async () => {
      const result = toGameResult(gameState);
      const nextResults = [...gameResults, result];
      const nextScore = { ...seriesScore };
      if (result.winnerSide === 'home') nextScore.home += 1;
      else nextScore.away += 1;

      setGameResults(nextResults);
      setSeriesScore(nextScore);

      if (hardFearlessSeries && draftResult) {
        const nextPool = accumulateFearlessChampions(seriesFearlessPool, draftResult);
        setSeriesFearlessPool(nextPool);
        setFearlessPool(nextPool);
      }

      const isComplete = nextScore.home >= winsNeeded() || nextScore.away >= winsNeeded();
      if (!isComplete) {
        setBetweenGames(true);
        setCurrentGameDraftRequired(true);
        setDraftResult(null);
        setDayPhase('banpick');
        return;
      }

      const matchResult: MatchResult = {
        scoreHome: nextScore.home,
        scoreAway: nextScore.away,
        winner: nextScore.home > nextScore.away ? 'home' : 'away',
        games: nextResults,
        substitutions: [],
        sideSelections: nextResults.map((_, index) => ({
          gameNumber: index + 1,
          blueSide: index % 2 === 0 ? 'home' : 'away',
        })),
      };

      await saveUserMatchResult(
        pendingMatch,
        matchResult,
        pendingMatch.seasonId,
        save?.userTeamId,
        typeof save?.id === 'number' ? save.id : undefined,
      ).catch(() => setMatchError('경기 결과 저장 중 문제가 발생했습니다.'));

      const winnerTeamId = matchResult.winner === 'home' ? pendingMatch.teamHomeId : pendingMatch.teamAwayId;
      if (pendingMatch.matchType.startsWith('playoff_')) {
        await processPlayoffMatchResult(pendingMatch.seasonId, pendingMatch.id, winnerTeamId).catch(() => {});
      }
      if (
        pendingMatch.matchType.startsWith('msi_') ||
        pendingMatch.matchType.startsWith('worlds_') ||
        pendingMatch.matchType.startsWith('lck_cup_') ||
        pendingMatch.matchType.startsWith('fst_') ||
        pendingMatch.matchType.startsWith('ewc_')
      ) {
        await processTournamentMatchResult(pendingMatch.seasonId, pendingMatch.id, winnerTeamId).catch(() => {});
      }

      await generatePostMatchComment({
        teamName: userSide === 'home' ? homeTeam?.name ?? '우리 팀' : awayTeam?.name ?? '우리 팀',
        opponentName: userSide === 'home' ? awayTeam?.name ?? '상대 팀' : homeTeam?.name ?? '상대 팀',
        isWin: result.winnerSide === userSide,
        scoreHome: nextScore.home,
        scoreAway: nextScore.away,
        duration: result.durationMinutes,
      })
        .then(setPostMatchComment)
        .catch(() => setPostMatchComment(null));

      setSeriesComplete(true);
      setBetweenGames(false);
      setCurrentGameDraftRequired(false);
      setDayPhase('result');
    };

    void finalize();
  }, [
    awayTeam?.name,
    currentGameNum,
    draftResult,
    gameResults,
    gameState,
    hardFearlessSeries,
    homeTeam?.name,
    pendingMatch,
    save,
    seriesFearlessPool,
    seriesScore,
    setBetweenGames,
    setCurrentGameDraftRequired,
    setDayPhase,
    setDraftResult,
    setFearlessPool,
    setGameResults,
    setSeriesFearlessPool,
    setSeriesScore,
    userSide,
    winsNeeded,
  ]);

  const handleDecision = useCallback(
    (optionId: string) => {
      if (!engine) return;
      engine.resolveDecision(optionId);
      setGameState({ ...engine.getState() });
      setCurrentDecision(null);
      setIsRunning(true);
    },
    [engine],
  );

  const handleReturn = useCallback(() => {
    setPendingUserMatch(null);
    setDraftResult(null);
    setCurrentGameDraftRequired(false);
    resetSeries();
    setDayPhase('idle');
    navigate(basePath);
  }, [basePath, navigate, resetSeries, setCurrentGameDraftRequired, setDayPhase, setDraftResult, setPendingUserMatch]);

  const lastGameStats = useMemo(() => {
    const lastGame = gameResults[gameResults.length - 1];
    if (!lastGame) return null;
    const homeKda = lastGame.playerStatsHome.reduce(
      (acc, p) => ({ k: acc.k + p.kills, d: acc.d + p.deaths, a: acc.a + p.assists }),
      { k: 0, d: 0, a: 0 },
    );
    const awayKda = lastGame.playerStatsAway.reduce(
      (acc, p) => ({ k: acc.k + p.kills, d: acc.d + p.deaths, a: acc.a + p.assists }),
      { k: 0, d: 0, a: 0 },
    );
    const goldDiff = lastGame.goldHome - lastGame.goldAway;
    return { homeKda, awayKda, goldDiff, towersHome: lastGame.towersHome, towersAway: lastGame.towersAway };
  }, [gameResults]);

  if (!pendingMatch) {
    return <p className="fm-text-muted fm-text-md">진행 중인 경기가 없습니다.</p>;
  }

  if (currentGameDraftRequired && !draftResult) {
    return (
      <div className="match-container fm-animate-in">
        <div className="fm-panel">
          <div className="fm-panel__body">
            <h1 className="fm-page-title">드래프트가 먼저 필요합니다</h1>
            <p className="fm-text-secondary fm-mt-sm">다음 세트는 밴픽을 완료한 뒤에만 시작됩니다.</p>
            <button type="button" className="fm-btn fm-btn--primary fm-mt-md" onClick={() => navigate(`${basePath}/draft`)}>
              밴픽 화면으로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (matchError) {
    return (
      <div className="match-container fm-animate-in">
        <div className="fm-panel">
          <div className="fm-panel__body">
            <h1 className="fm-page-title">경기 진행 중 문제가 발생했습니다</h1>
            <p className="fm-text-secondary fm-mt-sm">{matchError}</p>
            <button type="button" className="fm-btn fm-btn--primary fm-mt-md" onClick={handleReturn}>
              대시보드로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState || !engine) {
    return <p className="fm-text-muted fm-text-md">실시간 경기를 불러오는 중입니다...</p>;
  }

  return (
    <div className="match-container fm-animate-in">
      <div className="fm-topbar fm-mb-md">
        <div className="fm-topbar__section">
          <button
            type="button"
            className="fm-btn fm-btn--primary fm-btn--sm"
            onClick={() => setIsRunning((prev) => !prev)}
            disabled={gameState.isFinished}
          >
            {isRunning ? '일시 정지' : '재생'}
          </button>
          <div className="match-speed-row">
            {SPEED_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={`match-speed-btn ${speedPreset === preset.key ? 'match-speed-btn--active' : ''}`}
                onClick={() => setSpeedPreset(preset.key)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <BroadcastHud
        gameState={gameState}
        homeTeamShortName={homeTeam?.shortName ?? 'HOME'}
        awayTeamShortName={awayTeam?.shortName ?? 'AWAY'}
        seriesScore={seriesScore}
        currentGameNum={currentGameNum}
        phaseLabels={PHASE_LABELS}
      />

      <div className="fm-grid fm-grid--2 fm-mt-md">
        <div className="fm-flex-col fm-gap-md">
          <Suspense fallback={<div className="fm-card fm-text-muted">전장을 준비하는 중입니다...</div>}>
            <BroadcastBattlefield gameState={gameState} />
          </Suspense>
          <TacticsPanel engine={engine} onTacticsChanged={() => setGameState({ ...engine.getState() })} />
        </div>

        <div className="fm-flex-col fm-gap-md">
          <CommentaryPanel commentary={gameState.commentary} panelRef={commentaryRef} />
          <div className="fm-panel">
            <div className="fm-panel__header">
              <span className="fm-panel__title">실시간 반응</span>
            </div>
            <div className="fm-panel__body fm-flex-col fm-gap-sm">
              {liveChatMessages.length === 0 ? (
                <p className="fm-text-muted">주요 이벤트가 나오면 반응이 여기에 쌓입니다.</p>
              ) : (
                liveChatMessages.map((message, index) => (
                  <div key={`${message.message}-${index}`} className="fm-card">
                    <strong className="fm-text-primary">{message.username}</strong>
                    <div className="fm-text-secondary">{message.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {currentDecision ? <DecisionPopup decision={currentDecision} onDecision={handleDecision} /> : null}

      {betweenGames ? (
        <div className="fm-overlay" role="dialog" aria-modal="true" aria-label="세트 종료">
          <div className="animate-scaleIn match-result-box">
            <h2 className="match-result-title">{currentGameNum}세트 종료</h2>
            <div className="match-result-score">
              <span className="match-result-team">{homeTeam?.shortName ?? '홈'}</span>
              <span className="match-result-final">{seriesScore.home} : {seriesScore.away}</span>
              <span className="match-result-team">{awayTeam?.shortName ?? '원정'}</span>
            </div>
            {seriesScore.home === seriesScore.away && (
              <p style={{ color: 'var(--warning)', fontWeight: 700, textAlign: 'center', margin: '4px 0 0' }}>결정전</p>
            )}
            {lastGameStats && (
              <div className="match-between-result" style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13 }}>
                  {lastGameStats.homeKda.k}/{lastGameStats.homeKda.d}/{lastGameStats.homeKda.a}
                  <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>KDA</span>
                  {lastGameStats.awayKda.k}/{lastGameStats.awayKda.d}/{lastGameStats.awayKda.a}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                  골드 차이 {lastGameStats.goldDiff > 0 ? '+' : ''}{(Math.round(lastGameStats.goldDiff / 100) / 10).toFixed(1)}k
                  &nbsp;·&nbsp;
                  타워 {lastGameStats.towersHome} vs {lastGameStats.towersAway}
                </div>
              </div>
            )}
            <p className="fm-text-secondary" style={{ marginTop: 10 }}>다음 세트 밴픽을 완료하면 경기가 이어집니다.</p>
            <button type="button" className="fm-btn fm-btn--primary fm-mt-md" onClick={() => navigate(`${basePath}/draft`)}>
              다음 세트 밴픽으로 이동
            </button>
          </div>
        </div>
      ) : null}

      {seriesComplete ? (
        <SeriesResult
          homeTeamShortName={homeTeam?.shortName}
          awayTeamShortName={awayTeam?.shortName}
          homeTeamName={homeTeam?.name}
          awayTeamName={awayTeam?.name}
          seriesScore={seriesScore}
          postMatchComment={postMatchComment}
          gameResults={gameResults}
          onReturn={handleReturn}
        />
      ) : null}
    </div>
  );
}
