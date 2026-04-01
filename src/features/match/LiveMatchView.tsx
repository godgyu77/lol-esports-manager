import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/gameStore';
import { useMatchStore, type MatchSpeedPreset } from '../../stores/matchStore';
import { useBgm } from '../../hooks/useBgm';
import { LiveMatchEngine, type Decision, type LiveGameState } from '../../engine/match/liveMatch';
import { conductTeamTalk } from '../../engine/teamTalk/teamTalkEngine';
import { buildLineup } from '../../engine/match/teamRating';
import { getFormByTeamId, getPlayersByTeamId, getTeamPlayStyle, getTraitsByTeamId } from '../../db/queries';
import { calculateChemistryBonus } from '../../engine/chemistry/chemistryEngine';
import { calculateTeamSoloRankBonus } from '../../engine/soloRank/soloRankEngine';
import { saveUserMatchResult } from '../../engine/season/dayAdvancer';
import { processPlayoffMatchResult } from '../../engine/season/playoffGenerator';
import { processTournamentMatchResult } from '../../engine/tournament/tournamentEngine';
import { buildPostMatchInsightReport } from '../../engine/analysis/postMatchInsightEngine';
import { generatePostMatchComment, type PostMatchComment } from '../../ai/gameAiService';
import { generateLiveChatMessages, generateMatchCommentary, type LiveChatMessage } from '../../ai/advancedAiService';
import { accumulateFearlessChampions } from '../../engine/draft/draftEngine';
import type { GameResult, MatchResult } from '../../engine/match/matchSimulator';
import { CommentaryPanel } from './CommentaryPanel';
import { DecisionPopup } from './DecisionPopup';
import { PlayerInstructions } from './PlayerInstructions';
import { PostGameStats } from './PostGameStats';
import { Scoreboard } from './Scoreboard';
import { SeriesResult } from './SeriesResult';
import { TacticsPanel } from './TacticsPanel';
import { TeamStatusBoard } from './TeamStatusBoard';
import { soundManager } from '../../audio/soundManager';
import './match.css';

const MatchMinimap = lazy(() => import('./MatchMinimap').then((module) => ({ default: module.MatchMinimap })));

const SPEED_PRESETS: Array<{ key: MatchSpeedPreset; label: string }> = [
  { key: 'focus', label: 'Focus' },
  { key: 'standard', label: 'Standard' },
  { key: 'fast', label: 'Fast' },
];

const PHASE_LABELS: Record<string, string> = {
  loading: 'Loading',
  laning: 'Laning',
  mid_game: 'Mid Game',
  late_game: 'Late Game',
  finished: 'Finished',
};

const CHAT_TYPE_COLORS: Record<string, string> = {
  cheer: '#2ecc71',
  flame: '#e74c3c',
  meme: '#f39c12',
  analysis: '#60a5fa',
  neutral: '#8a8a9a',
};

function getTickInterval(speed: number) {
  return Math.max(360, 1800 / Math.max(speed, 0.5));
}

function formatZone(zone: string) {
  return zone.replace(/_/g, ' ');
}

function formatGoldDiff(diff: number) {
  const leader = diff >= 0 ? '블루' : '레드';
  return `${leader} +${Math.abs(Math.round(diff / 100)) / 10}k`;
}

export function LiveMatchView() {
  useBgm('match');

  const navigate = useNavigate();
  const save = useGameStore((state) => state.save);
  const pendingMatch = useGameStore((state) => state.pendingUserMatch);
  const teams = useGameStore((state) => state.teams);
  const setDayPhase = useGameStore((state) => state.setDayPhase);
  const setPendingUserMatch = useGameStore((state) => state.setPendingUserMatch);
  const draftResult = useGameStore((state) => state.draftResult);
  const setDraftResult = useGameStore((state) => state.setDraftResult);
  const fearlessPool = useGameStore((state) => state.fearlessPool);
  const setFearlessPool = useGameStore((state) => state.setFearlessPool);
  const mode = useGameStore((state) => state.mode);
  const currentDate = useGameStore((state) => state.season)?.currentDate ?? '';
  const basePath = mode === 'player' ? '/player' : '/manager';

  const matchSpeed = useMatchStore((state) => state.speed);
  const speedPreset = useMatchStore((state) => state.speedPreset);
  const setSpeedPreset = useMatchStore((state) => state.setSpeedPreset);
  const seriesScore = useMatchStore((state) => state.seriesScore);
  const setSeriesScore = useMatchStore((state) => state.setSeriesScore);
  const currentGameNum = useMatchStore((state) => state.currentGameNum);
  const setCurrentGameNum = useMatchStore((state) => state.setCurrentGameNum);
  const gameResults = useMatchStore((state) => state.gameResults);
  const setGameResults = useMatchStore((state) => state.setGameResults);
  const betweenGames = useMatchStore((state) => state.betweenGames);
  const setBetweenGames = useMatchStore((state) => state.setBetweenGames);
  const hardFearlessSeries = useMatchStore((state) => state.hardFearlessSeries);
  const setCurrentGameDraftRequired = useMatchStore((state) => state.setCurrentGameDraftRequired);
  const seriesFearlessPool = useMatchStore((state) => state.seriesFearlessPool);
  const setSeriesFearlessPool = useMatchStore((state) => state.setSeriesFearlessPool);
  const resetSeries = useMatchStore((state) => state.resetSeries);
  const setMatchActive = useMatchStore((state) => state.setMatchActive);
  const navigationPauseRequested = useMatchStore((state) => state.navigationPauseRequested);
  const clearNavigationPause = useMatchStore((state) => state.clearNavigationPause);

  const [engine, setEngine] = useState<LiveMatchEngine | null>(null);
  const [gameState, setGameState] = useState<LiveGameState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentDecision, setCurrentDecision] = useState<Decision | null>(null);
  const [seriesComplete, setSeriesComplete] = useState(false);
  const [postMatchComment, setPostMatchComment] = useState<PostMatchComment | null>(null);
  const [teamTalkResult, setTeamTalkResult] = useState<string | null>(null);
  const [teamTalkDone, setTeamTalkDone] = useState(false);
  const [liveChatMessages, setLiveChatMessages] = useState<LiveChatMessage[]>([]);
  const [matchError, setMatchError] = useState<string | null>(null);

  const commentaryRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const lastAiCommentaryTime = useRef<number>(0);
  const lastChatTime = useRef<number>(0);
  const lastEventCount = useRef<number>(0);

  const homeTeam = teams.find((team) => team.id === pendingMatch?.teamHomeId);
  const awayTeam = teams.find((team) => team.id === pendingMatch?.teamAwayId);
  const userSide = pendingMatch && save?.userTeamId
    ? pendingMatch.teamHomeId === save.userTeamId ? 'home' : 'away'
    : 'home';

  useEffect(() => {
    setMatchActive(true);
    return () => {
      setMatchActive(false);
      clearNavigationPause();
    };
  }, [clearNavigationPause, setMatchActive]);

  useEffect(() => {
    if (!navigationPauseRequested) return;
    setIsRunning(false);
    clearNavigationPause();
  }, [clearNavigationPause, navigationPauseRequested]);

  const initGame = useCallback(async (gameNum: number) => {
    if (!pendingMatch || !save) return;

    const [homePlayers, awayPlayers] = await Promise.all([
      getPlayersByTeamId(pendingMatch.teamHomeId),
      getPlayersByTeamId(pendingMatch.teamAwayId),
    ]);

    const homeLineup = buildLineup(homePlayers);
    const awayLineup = buildLineup(awayPlayers);
    if (!homeLineup || !awayLineup) {
      setMatchError('Unable to start the set because one team does not have a valid lineup.');
      return;
    }

    const [homeTraits, awayTraits, homePlayStyle, awayPlayStyle] = await Promise.all([
      getTraitsByTeamId(pendingMatch.teamHomeId),
      getTraitsByTeamId(pendingMatch.teamAwayId),
      getTeamPlayStyle(pendingMatch.teamHomeId),
      getTeamPlayStyle(pendingMatch.teamAwayId),
    ]);

    const [homeForm, awayForm] = await Promise.all([
      currentDate ? getFormByTeamId(pendingMatch.teamHomeId, currentDate) : Promise.resolve({}),
      currentDate ? getFormByTeamId(pendingMatch.teamAwayId, currentDate) : Promise.resolve({}),
    ]);

    let homeExtraBonus = 0;
    let awayExtraBonus = 0;
    try {
      const [homeChem, awayChem, homeSolo, awaySolo] = await Promise.all([
        calculateChemistryBonus(pendingMatch.teamHomeId),
        calculateChemistryBonus(pendingMatch.teamAwayId),
        calculateTeamSoloRankBonus(pendingMatch.teamHomeId),
        calculateTeamSoloRankBonus(pendingMatch.teamAwayId),
      ]);
      homeExtraBonus = homeChem + homeSolo;
      awayExtraBonus = awayChem + awaySolo;
    } catch {
      homeExtraBonus = 0;
      awayExtraBonus = 0;
    }

    const liveEngine = new LiveMatchEngine({
      homeLineup,
      awayLineup,
      homeTraits,
      awayTraits,
      homeForm,
      awayForm,
      seed: `${pendingMatch.id}_g${gameNum}`,
      gameMode: save.mode,
      draftResult,
      homePlayStyle,
      awayPlayStyle,
      homeExtraBonus,
      awayExtraBonus,
    });

    setEngine(liveEngine);
    setGameState(liveEngine.getState());
    setCurrentDecision(null);
    setIsRunning(false);
    setMatchError(null);
    setLiveChatMessages([]);
    lastAiCommentaryTime.current = 0;
    lastChatTime.current = 0;
    lastEventCount.current = 0;
    setSpeedPreset('focus');
  }, [currentDate, draftResult, pendingMatch, save, setSpeedPreset]);

  useEffect(() => {
    void initGame(currentGameNum);
  }, [currentGameNum, initGame]);

  useEffect(() => {
    if (!engine || !isRunning || currentDecision) return;
    const tickInterval = getTickInterval(matchSpeed);
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
  }, [currentDecision, engine, isRunning, matchSpeed]);

  useEffect(() => {
    if (!gameState || !engine || gameState.isFinished) return;
    const newEvents = gameState.events.slice(lastEventCount.current);
    if (newEvents.length === 0) return;
    lastEventCount.current = gameState.events.length;
    const majorEvent = [...newEvents].reverse().find((event) => ['kill', 'dragon', 'baron', 'tower_destroy', 'teamfight'].includes(event.type));
    if (!majorEvent) return;

    const now = Date.now();
    if (now - lastAiCommentaryTime.current >= 22000) {
      lastAiCommentaryTime.current = now;
      generateMatchCommentary({
        phase: gameState.phase === 'laning' ? 'laning' : gameState.phase === 'mid_game' ? 'mid_game' : 'late_game',
        event: majorEvent.type,
        details: majorEvent.description,
        goldDiff: gameState.goldHome - gameState.goldAway,
        gameTime: gameState.currentTick,
        kills: { home: gameState.killsHome, away: gameState.killsAway },
        teamName: homeTeam?.shortName,
      }).then((result) => {
        const state = engine.getState();
        setGameState({
          ...state,
          commentary: [...state.commentary, { tick: state.currentTick, message: result.text, type: 'highlight' }],
        });
      }).catch(() => {});
    }

    if (now - lastChatTime.current >= 16000) {
      lastChatTime.current = now;
      generateLiveChatMessages({
        teamName: homeTeam?.shortName ?? 'HOME',
        opponentName: awayTeam?.shortName ?? 'AWAY',
        event: majorEvent.type,
        isWinning: gameState.goldHome >= gameState.goldAway,
        goldDiff: gameState.goldHome - gameState.goldAway,
        gameTime: gameState.currentTick,
        count: 4,
      }).then((messages) => {
        setLiveChatMessages((previous) => [...previous, ...messages].slice(-24));
      }).catch(() => {});
    }
  }, [awayTeam?.shortName, engine, gameState, homeTeam?.shortName]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [liveChatMessages.length]);

  useEffect(() => {
    if (commentaryRef.current) commentaryRef.current.scrollTop = commentaryRef.current.scrollHeight;
  }, [gameState?.commentary.length]);

  const handleDecision = useCallback((optionId: string) => {
    if (!engine) return;
    engine.resolveDecision(optionId);
    setCurrentDecision(null);
    setGameState({ ...engine.getState() });
    setIsRunning(true);
  }, [engine]);

  const handleTacticsChanged = useCallback(() => {
    if (!engine) return;
    setGameState({ ...engine.getState() });
  }, [engine]);

  const handleGameEnd = useCallback(async () => {
    if (!gameState || !pendingMatch || !engine || !gameState.winner) return;

    const playerStatLines = engine.getPlayerStatLines();
    const result: GameResult = {
      winnerSide: gameState.winner,
      durationMinutes: gameState.maxTick,
      goldDiffAt15: gameState.goldHome - gameState.goldAway,
      killsHome: gameState.killsHome,
      killsAway: gameState.killsAway,
      goldHome: gameState.goldHome,
      goldAway: gameState.goldAway,
      towersHome: gameState.towersHome,
      towersAway: gameState.towersAway,
      events: gameState.events,
      playerStatsHome: playerStatLines.home,
      playerStatsAway: playerStatLines.away,
      dragonSoul: gameState.dragonSoul,
      grubsHome: gameState.grubsHome,
      grubsAway: gameState.grubsAway,
      goldHistory: gameState.goldHistory ?? [],
    };

    const newResults = [...gameResults, result];
    const newScore = { ...seriesScore };
    if (gameState.winner === 'home') newScore.home += 1;
    else newScore.away += 1;
    setSeriesScore(newScore);
    setGameResults(newResults);

    const winsNeeded = pendingMatch.boFormat === 'Bo5' ? 3 : pendingMatch.boFormat === 'Bo3' ? 2 : 1;
    if (newScore.home >= winsNeeded || newScore.away >= winsNeeded) {
      setSeriesComplete(true);
      const matchResult: MatchResult = {
        scoreHome: newScore.home,
        scoreAway: newScore.away,
        winner: newScore.home > newScore.away ? 'home' : 'away',
        games: newResults,
        substitutions: [],
        sideSelections: [],
      };

      await saveUserMatchResult(pendingMatch, matchResult, pendingMatch.seasonId, save?.userTeamId, save?.id);
      const isUserWin =
        (matchResult.winner === 'home' && pendingMatch.teamHomeId === save?.userTeamId) ||
        (matchResult.winner === 'away' && pendingMatch.teamAwayId === save?.userTeamId);
      soundManager.play(isUserWin ? 'victory' : 'defeat');

      generatePostMatchComment({
        teamName: homeTeam?.shortName ?? '',
        opponentName: awayTeam?.shortName ?? '',
        isWin: isUserWin,
        scoreHome: newScore.home,
        scoreAway: newScore.away,
      }).then(setPostMatchComment).catch(() => {});

      if (pendingMatch.matchType !== 'regular') {
        const winnerTeamId = matchResult.winner === 'home' ? pendingMatch.teamHomeId : pendingMatch.teamAwayId;
        if (pendingMatch.matchType.startsWith('msi_') || pendingMatch.matchType.startsWith('worlds_')) {
          await processTournamentMatchResult(pendingMatch.seasonId, pendingMatch.id, winnerTeamId);
        } else {
          await processPlayoffMatchResult(pendingMatch.seasonId, pendingMatch.id, winnerTeamId);
        }
      }
      return;
    }

    setBetweenGames(true);
    setTeamTalkResult(null);
    setTeamTalkDone(false);
  }, [awayTeam?.shortName, engine, gameResults, gameState, homeTeam?.shortName, pendingMatch, save?.id, save?.userTeamId, seriesScore, setBetweenGames, setGameResults, setSeriesScore]);

  const handleBetweenGamesTalk = useCallback(async (tone: 'motivate' | 'calm' | 'warn') => {
    if (!pendingMatch || !save || teamTalkDone) return;
    const result = await conductTeamTalk(pendingMatch.id, save.userTeamId, 'between_games', tone, null);
    setTeamTalkResult(result.message);
    setTeamTalkDone(true);
  }, [pendingMatch, save, teamTalkDone]);

  const handleProceedToNextGame = useCallback(() => {
    if (!pendingMatch || !draftResult) return;
    const nextGame = currentGameNum + 1;
    const nextPool = hardFearlessSeries ? accumulateFearlessChampions(seriesFearlessPool.blue.length || seriesFearlessPool.red.length ? seriesFearlessPool : fearlessPool, draftResult) : seriesFearlessPool;
    setSeriesFearlessPool(nextPool);
    setFearlessPool(nextPool);
    setCurrentGameNum(nextGame);
    setCurrentGameDraftRequired(true);
    setBetweenGames(false);
    setDraftResult(null);
    setDayPhase('banpick');
    navigate(`${basePath}/draft`);
  }, [basePath, currentGameNum, draftResult, fearlessPool, hardFearlessSeries, navigate, pendingMatch, seriesFearlessPool, setBetweenGames, setCurrentGameDraftRequired, setCurrentGameNum, setDayPhase, setDraftResult, setFearlessPool, setSeriesFearlessPool]);

  const handleReturnToDashboard = useCallback(() => {
    setPendingUserMatch(null);
    setDraftResult(null);
    setFearlessPool({ blue: [], red: [] });
    setSeriesFearlessPool({ blue: [], red: [] });
    resetSeries();
    setDayPhase('idle');
    setMatchActive(false);
    navigate(`${basePath}/day`);
  }, [basePath, navigate, resetSeries, setDayPhase, setDraftResult, setFearlessPool, setMatchActive, setPendingUserMatch, setSeriesFearlessPool]);

  const focusSummary = useMemo(() => {
    if (!gameState?.focusEvent) return '아직 큰 사건은 없습니다. 다음 교전 준비를 지켜보세요.';
    return `${gameState.focusEvent.label} at ${gameState.focusEvent.tick}m: ${gameState.focusEvent.detail}`;
  }, [gameState?.focusEvent]);

  const lastMajorEvent = useMemo(() => {
    if (!gameState) return null;
    return [...gameState.events].reverse().find((event) => ['teamfight', 'ace', 'dragon', 'baron', 'elder_dragon', 'tower_destroy', 'steal', 'pentakill'].includes(event.type)) ?? null;
  }, [gameState]);

  const goldTrendSummary = useMemo(() => {
    if (!gameState || gameState.goldHistory.length < 2) return '골드 흐름이 아직 형성되는 중입니다.';
    const recent = gameState.goldHistory.slice(-5);
    const start = recent[0]?.diff ?? 0;
    const end = recent[recent.length - 1]?.diff ?? 0;
    const swing = end - start;
    if (Math.abs(swing) < 400) return `라인 구도는 비교적 안정적입니다. 현재 격차는 ${formatGoldDiff(end)}입니다.`;
    const momentum = swing > 0 ? '블루가 최근 주도권을 넓히고 있습니다.' : '레드가 최근 주도권을 넓히고 있습니다.';
    return `${momentum} 최근 구간 스윙은 ${Math.abs(Math.round(swing / 100)) / 10}k입니다.`;
  }, [gameState]);

  const objectivePressureSummary = useMemo(() => {
    if (!gameState) return '주요 오브젝트가 아직 등장하지 않았습니다.';
    const nextObjective = [...gameState.objectiveStates]
      .filter((objective) => objective.nextSpawnTick !== undefined)
      .sort((left, right) => (left.nextSpawnTick ?? Number.MAX_SAFE_INTEGER) - (right.nextSpawnTick ?? Number.MAX_SAFE_INTEGER))[0];
    if (!nextObjective) return '당장 남은 주요 중립 오브젝트는 없습니다.';
    return `${nextObjective.key} 교전 구간은 ${nextObjective.nextSpawnTick}:00, ${formatZone(nextObjective.zone)} 근처입니다.`;
  }, [gameState]);

  const currentFocusSummary = useMemo(() => {
    if (!gameState) return '카메라는 다음 의미 있는 장면을 기다리고 있습니다.';
    if (!gameState.focusEvent) return `카메라는 다음 로테이션을 위해 ${formatZone(gameState.cameraZone)} 근처를 비추고 있습니다.`;
    return `${gameState.focusEvent.eventType} 때문에 시선이 ${formatZone(gameState.focusEvent.zone)} 쪽으로 모였습니다.`;
  }, [gameState]);

  if (matchError) {
    return <div className="fm-panel fm-p-lg"><p className="fm-text-danger fm-text-md fm-mb-md">{matchError}</p></div>;
  }

  if (!pendingMatch || !gameState) {
    return <p className="fm-text-muted fm-text-md">라이브 경기를 불러오는 중...</p>;
  }

  return (
    <div className="match-container">
      <Scoreboard gameState={gameState} homeTeamShortName={homeTeam?.shortName ?? 'HOME'} awayTeamShortName={awayTeam?.shortName ?? 'AWAY'} seriesScore={seriesScore} currentGameNum={currentGameNum} phaseLabels={PHASE_LABELS} />

      {!gameState.isFinished && (
        <div className="match-control-bar">
          <button className={`fm-btn ${isRunning ? 'fm-btn--danger' : 'fm-btn--success'}`} onClick={() => setIsRunning((previous) => !previous)}>
            {isRunning ? 'Pause' : 'Start'}
          </button>
          <div className="match-speed-row">
            {SPEED_PRESETS.map((preset) => (
              <button key={preset.key} className={`match-speed-btn ${speedPreset === preset.key ? 'match-speed-btn--active' : ''}`} onClick={() => setSpeedPreset(preset.key)}>
                {preset.key === 'focus' ? '집중' : preset.key === 'standard' ? '표준' : '빠르게'}
              </button>
            ))}
          </div>
          {mode === 'manager' && engine ? <TacticsPanel engine={engine} onTacticsChanged={handleTacticsChanged} /> : null}
        </div>
      )}

      {currentDecision ? <DecisionPopup decision={currentDecision} onDecision={handleDecision} /> : null}

      <div className="match-broadcast-layout">
        <div className="match-broadcast-side">
          <TeamStatusBoard title={homeTeam?.shortName ?? 'HOME'} side="home" gameState={gameState} playerStats={gameState.playerStatsHome} />
          {mode === 'manager' && engine && !gameState.isFinished ? (
            <PlayerInstructions engine={engine} playerStats={gameState.playerStatsHome} side="home" teamShortName={homeTeam?.shortName ?? 'HOME'} onInstructionChanged={handleTacticsChanged} />
          ) : null}
        </div>

        <div className="match-broadcast-center">
          <div className="match-focus-banner">
            <span>중계 포커스</span>
            <span>{focusSummary}</span>
          </div>
          <div className="match-center-stage">
            <Suspense fallback={<div className="match-minimap-placeholder" />}>
              <MatchMinimap gameState={gameState} width={640} height={640} />
            </Suspense>
          </div>
          <div className="match-center-bottom">
            <div className="match-center-card">
              <h3 className="match-center-card__title">현재 시점</h3>
              <p className="match-center-card__copy">{currentFocusSummary}</p>
            </div>
            <div className="match-center-card">
              <h3 className="match-center-card__title">직전 큰 장면</h3>
              <p className="match-center-card__copy">
                {lastMajorEvent ? `${lastMajorEvent.tick}:00 ${formatZone(lastMajorEvent.zone ?? 'center')}에서 ${lastMajorEvent.type}. ${lastMajorEvent.description}` : '아직 큰 교전은 없었습니다.'}
              </p>
            </div>
            <div className="match-center-card">
              <h3 className="match-center-card__title">골드 흐름</h3>
              <p className="match-center-card__copy">{goldTrendSummary}</p>
            </div>
            <div className="match-center-card">
              <h3 className="match-center-card__title">다음 포인트</h3>
              <p className="match-center-card__copy">{objectivePressureSummary}</p>
            </div>
          </div>
        </div>

        <div className="match-broadcast-side">
          <TeamStatusBoard title={awayTeam?.shortName ?? 'AWAY'} side="away" gameState={gameState} playerStats={gameState.playerStatsAway} />
          {mode === 'manager' && engine && !gameState.isFinished ? (
            <PlayerInstructions engine={engine} playerStats={gameState.playerStatsAway} side="away" teamShortName={awayTeam?.shortName ?? 'AWAY'} onInstructionChanged={handleTacticsChanged} />
          ) : null}
          <CommentaryPanel commentary={gameState.commentary} panelRef={commentaryRef} />
          <div className="match-chat-panel" ref={chatRef}>
            <h3 className="match-chat-title">실시간 채팅</h3>
            {liveChatMessages.length === 0 ? <p className="match-chat-empty">큰 장면이 나오면 채팅이 반응합니다.</p> : liveChatMessages.map((message, index) => (
              <div key={`${message.username}-${index}`} className="match-chat-item">
                <span className="match-chat-username" style={{ color: CHAT_TYPE_COLORS[message.type] ?? '#8a8a9a' }}>{message.username}</span>
                <span className="match-chat-message">{message.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {gameState.isFinished && !betweenGames && !seriesComplete ? (
        <div className="match-end-cta">
          <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={() => void handleGameEnd()}>
            {pendingMatch.boFormat === 'Bo1' ? '경기 결과 보기' : `${currentGameNum}세트 정리하기`}
          </button>
        </div>
      ) : null}

      {betweenGames ? (
        <div className="fm-overlay">
          <div className="match-between-modal">
            <h2 className="match-between-title">세트 정비</h2>
            {gameResults.length > 0 ? (
              <PostGameStats gameResult={gameResults[gameResults.length - 1]} homeTeamName={homeTeam?.shortName ?? 'HOME'} awayTeamName={awayTeam?.shortName ?? 'AWAY'} gameNumber={currentGameNum} insightReport={buildPostMatchInsightReport(gameResults[gameResults.length - 1], userSide)} />
            ) : null}
            <div className="match-between-series-score">
              <span className="match-between-series-label">시리즈 스코어</span>
              <span className="match-between-series-value">{seriesScore.home} - {seriesScore.away}</span>
            </div>
            {mode === 'manager' ? (
              <div className="match-between-talk-section">
                <span className="match-between-talk-label">세트 간 팀 토크</span>
                {!teamTalkDone ? (
                  <div className="match-between-talk-btns">
                    <button className="fm-btn fm-btn--success" onClick={() => void handleBetweenGamesTalk('motivate')}>격려</button>
                    <button className="fm-btn fm-btn--info" onClick={() => void handleBetweenGamesTalk('calm')}>진정</button>
                    <button className="fm-btn fm-btn--warning" onClick={() => void handleBetweenGamesTalk('warn')}>경고</button>
                  </div>
                ) : <p className="match-between-talk-result">{teamTalkResult}</p>}
              </div>
            ) : null}
            <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={handleProceedToNextGame}>다음 세트 밴픽으로</button>
          </div>
        </div>
      ) : null}

      {seriesComplete ? (
        <SeriesResult homeTeamShortName={homeTeam?.shortName} awayTeamShortName={awayTeam?.shortName} homeTeamName={homeTeam?.name} awayTeamName={awayTeam?.name} seriesScore={seriesScore} postMatchComment={postMatchComment} gameResults={gameResults} onReturn={handleReturnToDashboard} />
      ) : null}
    </div>
  );
}
