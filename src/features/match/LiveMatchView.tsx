import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/gameStore';
import { useMatchStore, type MatchSpeedPreset } from '../../stores/matchStore';
import { useBgm } from '../../hooks/useBgm';
import { LiveMatchEngine, type Decision, type LiveGameState } from '../../engine/match/liveMatch';
import { conductTeamTalk } from '../../engine/teamTalk/teamTalkEngine';
import { buildLineup } from '../../engine/match/teamRating';
import { buildBroadcastNarrativeBrief } from '../../engine/manager/competitiveIdentityEngine';
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
import { SeriesResult } from './SeriesResult';
import { TacticsPanel } from './TacticsPanel';
import { BroadcastHud } from './BroadcastHud';
import { BroadcastTeamColumn } from './BroadcastTeamColumn';
import { soundManager } from '../../audio/soundManager';
import './match.css';

const BroadcastBattlefield = lazy(() => import('./BroadcastBattlefield').then((module) => ({ default: module.BroadcastBattlefield })));
const BroadcastMiniMap = lazy(() => import('./BroadcastMiniMap').then((module) => ({ default: module.BroadcastMiniMap })));

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
  const leader = diff >= 0 ? 'Blue side' : 'Red side';
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
    const timer = setTimeout(() => {
      setIsRunning(false);
    }, 0);
    clearNavigationPause();
    return () => clearTimeout(timer);
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
    const timer = setTimeout(() => {
      void initGame(currentGameNum);
    }, 0);
    return () => clearTimeout(timer);
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
    const nextPool = hardFearlessSeries
      ? accumulateFearlessChampions(seriesFearlessPool.blue.length || seriesFearlessPool.red.length ? seriesFearlessPool : fearlessPool, draftResult)
      : seriesFearlessPool;
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
    if (!gameState?.focusEvent) return 'No hard commit yet. The observer is tracking the next setup window.';
    return `${gameState.focusEvent.label} at ${gameState.focusEvent.tick}m: ${gameState.focusEvent.detail}`;
  }, [gameState?.focusEvent]);

  const lastMajorEvent = useMemo(() => {
    if (!gameState) return null;
    return [...gameState.events].reverse().find((event) => ['teamfight', 'ace', 'dragon', 'baron', 'elder_dragon', 'tower_destroy', 'steal', 'pentakill'].includes(event.type)) ?? null;
  }, [gameState]);

  const goldTrendSummary = useMemo(() => {
    if (!gameState || gameState.goldHistory.length < 2) return 'Gold flow is still forming. Early lanes are testing for priority.';
    const recent = gameState.goldHistory.slice(-5);
    const start = recent[0]?.diff ?? 0;
    const end = recent[recent.length - 1]?.diff ?? 0;
    const swing = end - start;
    if (Math.abs(swing) < 400) return `The map remains relatively even. Current edge: ${formatGoldDiff(end)}.`;
    const momentum = swing > 0 ? 'Blue side has taken the recent tempo.' : 'Red side has taken the recent tempo.';
    return `${momentum} The last swing was ${Math.abs(Math.round(swing / 100)) / 10}k.`;
  }, [gameState]);

  const objectivePressureSummary = useMemo(() => {
    if (!gameState) return 'Major neutral objectives are not active yet.';
    const nextObjective = [...gameState.objectiveStates]
      .filter((objective) => objective.nextSpawnTick !== undefined)
      .sort((left, right) => (left.nextSpawnTick ?? Number.MAX_SAFE_INTEGER) - (right.nextSpawnTick ?? Number.MAX_SAFE_INTEGER))[0];
    if (!nextObjective) return 'No contested neutral objective is currently scheduled.';
    return `${nextObjective.key} is the next flashpoint at ${nextObjective.nextSpawnTick}:00 near ${formatZone(nextObjective.zone)}.`;
  }, [gameState]);

  const currentFocusSummary = useMemo(() => {
    if (!gameState) return 'Camera is waiting for the next meaningful shift on the map.';
    if (!gameState.focusEvent) return `Camera is hovering around ${formatZone(gameState.cameraZone)} to track the next rotation.`;
    return `${gameState.focusEvent.eventType} is pulling attention toward ${formatZone(gameState.focusEvent.zone)}.`;
  }, [gameState]);

  const winrateSummary = useMemo(() => {
    if (!gameState) return null;
    const homePct = Math.round(gameState.currentWinRate * 100);
    return {
      homePct,
      awayPct: 100 - homePct,
      leader: homePct >= 50 ? (homeTeam?.shortName ?? 'HOME') : (awayTeam?.shortName ?? 'AWAY'),
    };
  }, [awayTeam?.shortName, gameState, homeTeam?.shortName]);

  const objectiveCountdown = useMemo(() => {
    if (!gameState) return null;
    const nextObjective = [...gameState.objectiveStates]
      .filter((objective) => objective.nextSpawnTick !== undefined)
      .sort((left, right) => (left.nextSpawnTick ?? Number.MAX_SAFE_INTEGER) - (right.nextSpawnTick ?? Number.MAX_SAFE_INTEGER))[0];
    if (!nextObjective || nextObjective.nextSpawnTick === undefined) return null;
    return {
      key: nextObjective.key.toUpperCase(),
      time: `${nextObjective.nextSpawnTick}:00`,
      zone: formatZone(nextObjective.zone),
    };
  }, [gameState]);

  const broadcastNarrative = useMemo(() => {
    if (!pendingMatch || !gameState) return null;
    return buildBroadcastNarrativeBrief({
      pendingMatch,
      homeTeam,
      awayTeam,
      goldDiff: gameState.goldHome - gameState.goldAway,
      phase: gameState.phase,
      dragonStacksHome: gameState.dragonSoul.homeStacks,
      dragonStacksAway: gameState.dragonSoul.awayStacks,
      nextObjective: objectiveCountdown
        ? {
            key: objectiveCountdown.key,
            tick: Number.parseInt(objectiveCountdown.time, 10),
            zone: objectiveCountdown.zone,
          }
        : null,
      lastMajorEventDescription: lastMajorEvent?.description ?? null,
    });
  }, [awayTeam, gameState, homeTeam, lastMajorEvent?.description, objectiveCountdown, pendingMatch]);

  const momentumWindows = useMemo(() => {
    if (!gameState) return [];
    const recent = gameState.goldHistory.slice(-6);
    return recent.map((entry) => ({
      tick: entry.tick,
      diff: entry.diff,
      favored: entry.diff >= 0 ? 'home' : 'away',
      width: Math.min(100, Math.max(18, Math.abs(entry.diff) / 90)),
    }));
  }, [gameState]);

  const recentEventHeadlines = useMemo(() => {
    if (!gameState) return [];
    return [...gameState.events]
      .reverse()
      .slice(0, 4)
      .map((event) => ({
        id: `${event.type}-${event.tick}-${event.side}`,
        label: event.type.replace(/_/g, ' '),
        tick: event.tick,
        side: event.side,
      }));
  }, [gameState]);

  const replayModeActive = recentEventHeadlines.length > 0;

  const replayHighlights = useMemo(() => {
    if (!gameState) return [];
    return [...gameState.events]
      .reverse()
      .filter((event) => ['ace', 'pentakill', 'steal', 'baron', 'dragon', 'teamfight', 'tower_destroy'].includes(event.type))
      .slice(0, 3)
      .map((event) => ({
        id: `${event.type}-${event.tick}-${event.side}-replay`,
        title: event.type.replace(/_/g, ' ').toUpperCase(),
        detail: event.description,
        tick: `${event.tick}:00`,
        side: event.side,
      }));
  }, [gameState]);

  if (matchError) {
    return <div className="fm-panel fm-p-lg"><p className="fm-text-danger fm-text-md fm-mb-md">{matchError}</p></div>;
  }

  if (!pendingMatch || !gameState) {
    return <p className="fm-text-muted fm-text-md">Loading live match...</p>;
  }

  return (
    <div className="match-container">
      <BroadcastHud
        gameState={gameState}
        homeTeamShortName={homeTeam?.shortName ?? 'HOME'}
        awayTeamShortName={awayTeam?.shortName ?? 'AWAY'}
        seriesScore={seriesScore}
        currentGameNum={currentGameNum}
        phaseLabels={PHASE_LABELS}
        replayMode={replayModeActive}
      />

      {!gameState.isFinished && (
        <div className="match-control-bar">
          <button className={`fm-btn ${isRunning ? 'fm-btn--danger' : 'fm-btn--success'}`} onClick={() => setIsRunning((previous) => !previous)}>
            {isRunning ? 'Pause' : 'Start'}
          </button>
          <div className="match-speed-row">
            {SPEED_PRESETS.map((preset) => (
              <button key={preset.key} className={`match-speed-btn ${speedPreset === preset.key ? 'match-speed-btn--active' : ''}`} onClick={() => setSpeedPreset(preset.key)}>
                {preset.label}
              </button>
            ))}
          </div>
          {mode === 'manager' && engine ? <TacticsPanel engine={engine} onTacticsChanged={handleTacticsChanged} /> : null}
        </div>
      )}

      {currentDecision ? <DecisionPopup decision={currentDecision} onDecision={handleDecision} /> : null}

      <div className="broadcast-layout">
        <div className="broadcast-layout__team">
          <BroadcastTeamColumn title={homeTeam?.shortName ?? 'HOME'} side="home" gameState={gameState} playerStats={gameState.playerStatsHome} />
          {mode === 'manager' && engine && !gameState.isFinished ? (
            <PlayerInstructions engine={engine} playerStats={gameState.playerStatsHome} side="home" teamShortName={homeTeam?.shortName ?? 'HOME'} onInstructionChanged={handleTacticsChanged} />
          ) : null}
        </div>

        <div className="broadcast-layout__center">
          <div className="broadcast-focus-strip">
            <span className="broadcast-focus-strip__eyebrow">Director Focus</span>
            <span className="broadcast-focus-strip__copy">{focusSummary}</span>
          </div>

          <div className="broadcast-main-stage">
            <Suspense fallback={<div className="match-minimap-placeholder" />}>
              <BroadcastBattlefield gameState={gameState} width={920} height={560} />
            </Suspense>
          </div>

          <div className="broadcast-stage-notes">
            {broadcastNarrative ? (
              <div className="broadcast-stage-note">
                <h3 className="broadcast-stage-note__title">Broadcast Story</h3>
                <div className="broadcast-stage-note__metric-row">
                  <span className="broadcast-stage-note__metric">{broadcastNarrative.storyTag}</span>
                  <span className="broadcast-stage-note__metric-label">LoL desk angle</span>
                </div>
                <p className="broadcast-stage-note__copy">{broadcastNarrative.openingLine}</p>
                <p className="broadcast-stage-note__copy">{broadcastNarrative.castingLine}</p>
              </div>
            ) : null}
            <div className="broadcast-stage-note">
              <h3 className="broadcast-stage-note__title">Current Focus</h3>
              <p className="broadcast-stage-note__copy">{currentFocusSummary}</p>
            </div>
            <div className="broadcast-stage-note">
              <h3 className="broadcast-stage-note__title">Latest Highlight</h3>
              <p className="broadcast-stage-note__copy">
                {lastMajorEvent ? `${lastMajorEvent.tick}:00 ${formatZone(lastMajorEvent.zone ?? 'center')} - ${lastMajorEvent.type}. ${lastMajorEvent.description}` : 'Waiting for the next major fight.'}
              </p>
            </div>
            <div className="broadcast-stage-note">
              <h3 className="broadcast-stage-note__title">Gold Trend</h3>
              {winrateSummary ? (
                <div className="broadcast-stage-note__metric-row">
                  <span className="broadcast-stage-note__metric">{winrateSummary.homePct}% / {winrateSummary.awayPct}%</span>
                  <span className="broadcast-stage-note__metric-label">{winrateSummary.leader} favored</span>
                </div>
              ) : null}
              <p className="broadcast-stage-note__copy">{goldTrendSummary}</p>
              {broadcastNarrative ? (
                <p className="broadcast-stage-note__copy">{broadcastNarrative.tacticalLens}</p>
              ) : null}
            </div>
            <div className="broadcast-stage-note">
              <h3 className="broadcast-stage-note__title">Objective Pressure</h3>
              {objectiveCountdown ? (
                <div className="broadcast-stage-note__metric-row">
                  <span className="broadcast-stage-note__metric">{objectiveCountdown.key}</span>
                  <span className="broadcast-stage-note__metric-label">{objectiveCountdown.time} / {objectiveCountdown.zone}</span>
                </div>
              ) : null}
              <p className="broadcast-stage-note__copy">{objectivePressureSummary}</p>
              {broadcastNarrative ? (
                <p className="broadcast-stage-note__copy">{broadcastNarrative.objectiveCall}</p>
              ) : null}
            </div>
          </div>

          <div className="broadcast-momentum-strip">
            <div className="broadcast-momentum-strip__rail">
              {momentumWindows.length > 0 ? momentumWindows.map((window) => (
                <div key={`momentum-${window.tick}`} className="broadcast-momentum-strip__segment">
                  <span className="broadcast-momentum-strip__tick">{window.tick}:00</span>
                  <div className="broadcast-momentum-strip__bar">
                    <div
                      className={`broadcast-momentum-strip__fill broadcast-momentum-strip__fill--${window.favored}`}
                      style={{ width: `${window.width}%` }}
                    />
                  </div>
                </div>
              )) : (
                <span className="broadcast-momentum-strip__empty">Momentum rail is waiting for more gold snapshots.</span>
              )}
            </div>
            <div className="broadcast-momentum-strip__events">
              {recentEventHeadlines.map((event) => (
                <span key={event.id} className={`broadcast-momentum-strip__event broadcast-momentum-strip__event--${event.side}`}>
                  {event.tick}:00 {event.label}
                </span>
              ))}
            </div>
          </div>

          {replayHighlights.length > 0 ? (
            <div className="broadcast-highlight-reel">
              <div className="broadcast-highlight-reel__header">
                <h3>Highlight Reel</h3>
                <span>Director queue</span>
              </div>
              <div className="broadcast-highlight-reel__list">
                {replayHighlights.map((highlight) => (
                  <article key={highlight.id} className={`broadcast-highlight-reel__item broadcast-highlight-reel__item--${highlight.side}`}>
                    <span className="broadcast-highlight-reel__time">{highlight.tick}</span>
                    <div className="broadcast-highlight-reel__copy">
                      <strong>{highlight.title}</strong>
                      <p>{highlight.detail}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="broadcast-layout__team">
          <BroadcastTeamColumn title={awayTeam?.shortName ?? 'AWAY'} side="away" gameState={gameState} playerStats={gameState.playerStatsAway} />
          {mode === 'manager' && engine && !gameState.isFinished ? (
            <PlayerInstructions engine={engine} playerStats={gameState.playerStatsAway} side="away" teamShortName={awayTeam?.shortName ?? 'AWAY'} onInstructionChanged={handleTacticsChanged} />
          ) : null}
          <div className="broadcast-support-rail">
            <CommentaryPanel commentary={gameState.commentary} panelRef={commentaryRef} />
            <div className="match-chat-panel" ref={chatRef}>
              <h3 className="match-chat-title">Live Chat</h3>
              {liveChatMessages.length === 0 ? <p className="match-chat-empty">Audience reactions will appear after major moments.</p> : liveChatMessages.map((message, index) => (
                <div key={`${message.username}-${index}`} className="match-chat-item">
                  <span className="match-chat-username" style={{ color: CHAT_TYPE_COLORS[message.type] ?? '#8a8a9a' }}>{message.username}</span>
                  <span className="match-chat-message">{message.message}</span>
                </div>
              ))}
            </div>
            <Suspense fallback={<div className="broadcast-minimap-panel broadcast-minimap-panel--loading" />}>
              <BroadcastMiniMap gameState={gameState} />
            </Suspense>
          </div>
        </div>
      </div>

      {gameState.isFinished && !betweenGames && !seriesComplete ? (
        <div className="match-end-cta">
          <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={() => void handleGameEnd()}>
            {pendingMatch.boFormat === 'Bo1' ? 'Open Match Summary' : `Wrap Up Game ${currentGameNum}`}
          </button>
        </div>
      ) : null}

      {betweenGames ? (
        <div className="fm-overlay">
          <div className="match-between-modal">
            <h2 className="match-between-title">Between Games</h2>
            {gameResults.length > 0 ? (
              <PostGameStats
                gameResult={gameResults[gameResults.length - 1]}
                homeTeamName={homeTeam?.shortName ?? 'HOME'}
                awayTeamName={awayTeam?.shortName ?? 'AWAY'}
                gameNumber={currentGameNum}
                insightReport={buildPostMatchInsightReport(gameResults[gameResults.length - 1], userSide)}
              />
            ) : null}
            <div className="match-between-series-score">
              <span className="match-between-series-label">Series Score</span>
              <span className="match-between-series-value">{seriesScore.home} - {seriesScore.away}</span>
            </div>
            {mode === 'manager' ? (
              <div className="match-between-talk-section">
                <span className="match-between-talk-label">Team Talk</span>
                {!teamTalkDone ? (
                  <div className="match-between-talk-btns">
                    <button className="fm-btn fm-btn--success" onClick={() => void handleBetweenGamesTalk('motivate')}>Motivate</button>
                    <button className="fm-btn fm-btn--info" onClick={() => void handleBetweenGamesTalk('calm')}>Calm</button>
                    <button className="fm-btn fm-btn--warning" onClick={() => void handleBetweenGamesTalk('warn')}>Warn</button>
                  </div>
                ) : <p className="match-between-talk-result">{teamTalkResult}</p>}
              </div>
            ) : null}
            <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={handleProceedToNextGame}>Go To Next Draft</button>
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
          onReturn={handleReturnToDashboard}
        />
      ) : null}
    </div>
  );
}
