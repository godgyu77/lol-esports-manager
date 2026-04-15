import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/gameStore';
import { useMatchStore, type MatchSpeedPreset } from '../../stores/matchStore';
import { useBgm } from '../../hooks/useBgm';
import { LiveMatchEngine, type Decision, type LiveGameState, type LivePlayerStat } from '../../engine/match/liveMatch';
import { buildLineup } from '../../engine/match/teamRating';
import { getFormByTeamId, getPlayersByTeamId, getTeamPlayStyle, getTraitsByTeamId } from '../../db/queries';
import { calculateChemistryBonus } from '../../engine/chemistry/chemistryEngine';
import { calculateTeamSoloRankBonus } from '../../engine/soloRank/soloRankEngine';
import { saveUserMatchResult } from '../../engine/season/dayAdvancer';
import { processPlayoffMatchResult } from '../../engine/season/playoffGenerator';
import { processTournamentMatchResult } from '../../engine/tournament/tournamentEngine';
import { generatePostMatchComment } from '../../ai/gameAiService';
import { generateLiveChatMessages, type LiveChatMessage } from '../../ai/advancedAiService';
import { accumulateFearlessChampions } from '../../engine/draft/draftEngine';
import type { GameResult, MatchResult } from '../../engine/match/matchSimulator';
import {
  buildMatchResultInboxMemoParagraph,
  generateFanReactionNews,
  generateInterviewNews,
  generateMatchResultNews,
  generateSocialMediaReaction,
} from '../../engine/news/newsEngine';
import { getInboxMessages, syncMatchResultInboxMemo } from '../../engine/inbox/inboxEngine';
import { buildPostMatchInsightReport } from '../../engine/analysis/postMatchInsightEngine';
import { selectBroadcastCrew } from '../../engine/match/broadcastLineupEngine';
import {
  buildBroadcastHighlight,
  buildBroadcastLines,
  buildPostMatchInterviewPackage,
  determinePom,
  type BroadcastHighlight,
  type BroadcastLine,
  type CoachInterviewTone,
  type PostMatchInterviewPackage,
} from '../../engine/match/broadcastPresentation';
import { getDisplayEntityName } from '../../utils/displayName';
import { DecisionPopup } from './DecisionPopup';
import { SeriesResult } from './SeriesResult';
import { TacticsPanel } from './TacticsPanel';
import { BroadcastHud } from './BroadcastHud';
import { buildFollowUpNewsParagraph, getFollowUpRoute, getPrimaryFollowUp } from './postMatchFollowUp';
import './match.css';

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

const COACH_INTERVIEW_TOPICS: Record<CoachInterviewTone, string> = {
  calm: '준비한 운영이 잘 나왔다',
  confident: '준비의 결과를 증명했다',
  reflective: '보완점과 수확을 함께 봤다',
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

function statusLabel(player: LivePlayerStat) {
  if (player.deaths >= 4 && player.kills === 0) return '집중 필요';
  if (player.kills + player.assists >= 10) return '활약 중';
  if (player.comfortPick) return '주력 카드';
  return '안정적';
}

function toneClass(tone: BroadcastHighlight['tone']) {
  switch (tone) {
    case 'good':
      return 'match-broadcast-highlight--good';
    case 'danger':
      return 'match-broadcast-highlight--danger';
    default:
      return 'match-broadcast-highlight--neutral';
  }
}

function lineToneClass(tone: BroadcastLine['tone']) {
  return `match-broadcast-line--${tone}`;
}

interface MatchFollowUpSummary {
  title: string;
  summary: string;
  actionRoute: string | null;
}

function isMatchResultInboxMessage(message: { relatedId: string | null; title: string }): boolean {
  return message.relatedId?.startsWith('match_result:') || message.title.startsWith('[경기 결과]');
}

function TeamSideBoard({
  teamName,
  teamShortName,
  side,
  players,
}: {
  teamName: string;
  teamShortName: string;
  side: 'home' | 'away';
  players: LivePlayerStat[];
}) {
  const totalDamage = Math.round(players.reduce((sum, player) => sum + player.damageDealt, 0));

  return (
    <section className={`match-side-board ${side === 'home' ? 'match-side-board--home' : 'match-side-board--away'}`}>
      <div className="match-side-board__header">
        <div>
          <h3 className="match-side-board__title">{teamShortName}</h3>
          <p className="match-side-board__sub">{teamName}</p>
        </div>
        <div className="match-side-board__teamline">
          <span>{side === 'home' ? '우리 팀' : '상대 팀'}</span>
          <span>누적 피해 {totalDamage.toLocaleString()}</span>
        </div>
      </div>
      <div className="match-side-board__players">
        {players.map((player) => (
          <article key={player.playerId} className="match-side-player">
            <div className="match-side-player__top">
              <div>
                <strong className="match-side-player__name">{getDisplayEntityName(player.playerName)}</strong>
                <p className="match-side-player__meta">
                  {player.position} · {player.championId ?? '챔피언 비공개'}
                </p>
              </div>
              <span className="match-side-player__state">{statusLabel(player)}</span>
            </div>
            <div className="match-side-player__stats">
              <span>KDA {player.kills}/{player.deaths}/{player.assists}</span>
              <span>CS {player.cs}</span>
              <span>{Math.round(player.goldEarned / 100) / 10}k</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
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
  const [liveChatMessages, setLiveChatMessages] = useState<LiveChatMessage[]>([]);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [studioPackage, setStudioPackage] = useState<PostMatchInterviewPackage | null>(null);
  const [selectedCoachTone, setSelectedCoachTone] = useState<CoachInterviewTone>('calm');
  const [postMatchPublished, setPostMatchPublished] = useState(false);
  const [featuredMatchFollowUp, setFeaturedMatchFollowUp] = useState<MatchFollowUpSummary | null>(null);

  const commentaryRef = useRef<HTMLDivElement>(null);
  const lastEventCount = useRef(0);
  const finalizedGame = useRef<number | null>(null);
  const userScrolled = useRef(false);

  const basePath = mode === 'player' ? '/player' : '/manager';
  const homeTeam = teams.find((team) => team.id === pendingMatch?.teamHomeId);
  const awayTeam = teams.find((team) => team.id === pendingMatch?.teamAwayId);
  const userSide =
    pendingMatch && save?.userTeamId ? (pendingMatch.teamHomeId === save.userTeamId ? 'home' : 'away') : 'home';
  const broadcastCrew = useMemo(
    () =>
      selectBroadcastCrew({
        seed: `${pendingMatch?.id ?? 'match'}-${currentGameNum}`,
        matchType: pendingMatch?.matchType,
        homeTeamId: homeTeam?.id,
        awayTeamId: awayTeam?.id,
        homeTeamName: homeTeam?.name,
        awayTeamName: awayTeam?.name,
      }),
    [awayTeam?.id, awayTeam?.name, currentGameNum, homeTeam?.id, homeTeam?.name, pendingMatch?.id, pendingMatch?.matchType],
  );

  useEffect(() => {
    setMatchActive(true);
    return () => setMatchActive(false);
  }, [setMatchActive]);

  useEffect(() => {
    if (!save?.userTeamId) return;

    let cancelled = false;
    const loadLatestMatchFollowUp = async () => {
      try {
        const inboxMessages = await getInboxMessages(save.userTeamId, 12, false).catch(() => []);
        if (cancelled) return;

        const latestMatchFollowUp = inboxMessages.find(isMatchResultInboxMessage) ?? null;
        setFeaturedMatchFollowUp(
          latestMatchFollowUp
            ? {
                title: latestMatchFollowUp.title,
                summary: latestMatchFollowUp.content,
                actionRoute: latestMatchFollowUp.actionRoute,
              }
            : null,
        );
      } catch {
        if (!cancelled) setFeaturedMatchFollowUp(null);
      }
    };

    void loadLatestMatchFollowUp();
    return () => {
      cancelled = true;
    };
  }, [save?.userTeamId]);

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
  }, []);

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
      .then((messages) => setLiveChatMessages((prev) => [...prev, ...messages].slice(-10)))
      .catch(() => {});
  }, [awayTeam?.shortName, gameState, homeTeam?.shortName]);

  const publishPostMatchCoverage = useCallback(
    async (tone: CoachInterviewTone) => {
      if (!pendingMatch || !studioPackage || postMatchPublished || !homeTeam || !awayTeam) return;

      const didUserWin = seriesScore[userSide] > seriesScore[userSide === 'home' ? 'away' : 'home'];
      const pomTopic = studioPackage.pomReason.split('.').shift() ?? studioPackage.pomReason;
      const latestGameResult = gameResults[gameResults.length - 1];
      const primaryFollowUp = latestGameResult
        ? getPrimaryFollowUp(buildPostMatchInsightReport(latestGameResult, userSide).followUps)
        : null;
      const followUpContextNote = primaryFollowUp
        ? buildFollowUpNewsParagraph(primaryFollowUp.action, primaryFollowUp.summary)
        : null;

      await generateMatchResultNews(
        pendingMatch.seasonId,
        currentDate,
        homeTeam.name,
        awayTeam.name,
        seriesScore.home,
        seriesScore.away,
        {
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          matchType: pendingMatch.matchType,
          followUpAction: primaryFollowUp?.action,
          followUpSummary: primaryFollowUp?.summary,
        },
      ).catch(() => {});

      await generateInterviewNews(
        pendingMatch.seasonId,
        currentDate,
        studioPackage.pomName,
        studioPackage.pomTeamName,
        pomTopic,
        didUserWin ? save?.userTeamId ?? null : pendingMatch.teamAwayId,
        null,
      ).catch(() => {});

      await generateInterviewNews(
        pendingMatch.seasonId,
        currentDate,
        `${save?.managerName ?? '감독'}`,
        userSide === 'home' ? homeTeam.name : awayTeam.name,
        COACH_INTERVIEW_TOPICS[tone],
        save?.userTeamId ?? null,
        null,
      ).catch(() => {});

      await generateSocialMediaReaction(
        pendingMatch.seasonId,
        currentDate,
        studioPackage.socialReaction,
        save?.userTeamId ?? null,
      ).catch(() => {});

      await generateFanReactionNews(
        pendingMatch.seasonId,
        currentDate,
        userSide === 'home' ? homeTeam.name : awayTeam.name,
        didUserWin ? 'win_streak' : 'lose_streak',
        didUserWin ? 'positive' : 'negative',
        save?.userTeamId ?? null,
        [studioPackage.fanReaction, followUpContextNote].filter(Boolean).join('\n\n'),
      ).catch(() => {});

      if (save?.userTeamId) {
        const opponentName = userSide === 'home' ? awayTeam.name : homeTeam.name;
        const userScore = seriesScore[userSide];
        const opponentScore = seriesScore[userSide === 'home' ? 'away' : 'home'];
        const inboxTitle = `[경기 결과] ${opponentName}전 ${userScore}:${opponentScore} ${didUserWin ? '승리' : '패배'}`;
        const inboxContent = [
          `${opponentName}전 시리즈가 ${userScore}:${opponentScore}로 마무리됐습니다.`,
          buildMatchResultInboxMemoParagraph({
            followUpAction: primaryFollowUp?.action,
            followUpSummary: primaryFollowUp?.summary,
          }),
        ].filter(Boolean).join('\n\n');

        await syncMatchResultInboxMemo(
          save.userTeamId,
          currentDate,
          pendingMatch.id,
          inboxTitle,
          inboxContent,
          primaryFollowUp ? getFollowUpRoute(primaryFollowUp.action) : '/manager/inbox',
        ).catch(() => {});
      }

      setPostMatchPublished(true);
    },
    [
      awayTeam,
      currentDate,
      homeTeam,
      pendingMatch,
      postMatchPublished,
      save?.managerName,
      save?.userTeamId,
      seriesScore,
      gameResults,
      studioPackage,
      userSide,
    ],
  );

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

      const pom = determinePom(gameState, homeTeam?.name ?? '홈 팀', awayTeam?.name ?? '원정 팀');
      const generatedComment = await generatePostMatchComment({
        teamName: userSide === 'home' ? homeTeam?.name ?? '우리 팀' : awayTeam?.name ?? '우리 팀',
        opponentName: userSide === 'home' ? awayTeam?.name ?? '상대 팀' : homeTeam?.name ?? '상대 팀',
        isWin: result.winnerSide === userSide,
        scoreHome: nextScore.home,
        scoreAway: nextScore.away,
        mvpName: pom.player.playerName,
        duration: result.durationMinutes,
      }).catch(() => null);

      setStudioPackage(
        buildPostMatchInterviewPackage({
          crew: broadcastCrew,
          gameState,
          homeTeamId: homeTeam?.id,
          awayTeamId: awayTeam?.id,
          homeTeamName: homeTeam?.name ?? '홈 팀',
          awayTeamName: awayTeam?.name ?? '원정 팀',
          userTeamName: userSide === 'home' ? homeTeam?.name ?? '우리 팀' : awayTeam?.name ?? '우리 팀',
          opponentTeamName: userSide === 'home' ? awayTeam?.name ?? '상대 팀' : homeTeam?.name ?? '상대 팀',
          postMatchComment: generatedComment,
          matchType: pendingMatch?.matchType,
        }),
      );

      setSeriesComplete(true);
      setBetweenGames(false);
      setCurrentGameDraftRequired(false);
      setDayPhase('result');
    };

    void finalize();
  }, [
    awayTeam?.id,
    awayTeam?.name,
    currentGameNum,
    draftResult,
    gameResults,
    gameState,
    hardFearlessSeries,
    homeTeam?.id,
    homeTeam?.name,
    pendingMatch,
    save,
    seriesFearlessPool,
    seriesScore,
    broadcastCrew,
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

  const handleReturn = useCallback(async () => {
    if (seriesComplete && !postMatchPublished) {
      await publishPostMatchCoverage(selectedCoachTone);
    }
    setPendingUserMatch(null);
    setDraftResult(null);
    setCurrentGameDraftRequired(false);
    resetSeries();
    setDayPhase('idle');
    navigate(basePath);
  }, [
    basePath,
    navigate,
    postMatchPublished,
    publishPostMatchCoverage,
    resetSeries,
    selectedCoachTone,
    seriesComplete,
    setCurrentGameDraftRequired,
    setDayPhase,
    setDraftResult,
    setPendingUserMatch,
  ]);

  const lastGameStats = useMemo(() => {
    const lastGame = gameResults[gameResults.length - 1];
    if (!lastGame) return null;
    const homeKda = lastGame.playerStatsHome.reduce(
      (acc, player) => ({ k: acc.k + player.kills, d: acc.d + player.deaths, a: acc.a + player.assists }),
      { k: 0, d: 0, a: 0 },
    );
    const awayKda = lastGame.playerStatsAway.reduce(
      (acc, player) => ({ k: acc.k + player.kills, d: acc.d + player.deaths, a: acc.a + player.assists }),
      { k: 0, d: 0, a: 0 },
    );
    const goldDiff = lastGame.goldHome - lastGame.goldAway;
    return { homeKda, awayKda, goldDiff, towersHome: lastGame.towersHome, towersAway: lastGame.towersAway };
  }, [gameResults]);

  const broadcastLines = useMemo(
    () =>
      gameState
        ? buildBroadcastLines(gameState.commentary, broadcastCrew, gameState, {
            matchType: pendingMatch?.matchType,
            homeTeamId: homeTeam?.id,
            awayTeamId: awayTeam?.id,
            homeTeamName: homeTeam?.name,
            awayTeamName: awayTeam?.name,
            currentGameNum,
            draftResult,
          })
        : [],
    [awayTeam?.id, awayTeam?.name, broadcastCrew, currentGameNum, draftResult, gameState, homeTeam?.id, homeTeam?.name, pendingMatch?.matchType],
  );
  const highlight = useMemo(
    () => (gameState ? buildBroadcastHighlight(gameState) : { title: '중계 대기', detail: '경기 정보를 불러오는 중입니다.', tone: 'neutral' as const }),
    [gameState],
  );

  if (!pendingMatch) {
    return <p className="fm-text-muted fm-text-md">진행 중인 경기가 없습니다.</p>;
  }

  if (currentGameDraftRequired && !draftResult) {
    return (
      <div className="match-container fm-animate-in">
        <div className="fm-panel">
          <div className="fm-panel__body">
            <h1 className="fm-page-title">드래프트가 먼저 필요합니다.</h1>
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
            <h1 className="fm-page-title">경기 진행 중 문제가 발생했습니다.</h1>
            <p className="fm-text-secondary fm-mt-sm">{matchError}</p>
            <button type="button" className="fm-btn fm-btn--primary fm-mt-md" onClick={() => void handleReturn()}>
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

      {featuredMatchFollowUp ? (
        <div className="fm-card fm-mt-md" data-testid="live-match-followup-panel">
          <div className="fm-flex fm-items-center fm-justify-between fm-gap-md" style={{ flexWrap: 'wrap' }}>
            <div className="fm-flex-col fm-gap-xs">
              <span className="fm-text-sm fm-text-muted">직전 경기 후속</span>
              <strong className="fm-text-primary">{featuredMatchFollowUp.title}</strong>
              <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>
                {featuredMatchFollowUp.summary}
              </p>
            </div>
            <button
              type="button"
              className="fm-btn fm-btn--info"
              onClick={() => navigate(featuredMatchFollowUp.actionRoute ?? `${basePath}/inbox`)}
            >
              직전 경기 정리하러 가기
            </button>
          </div>
        </div>
      ) : null}

      <div className="match-broadcast-layout fm-mt-md">
        <TeamSideBoard
          teamName={homeTeam?.name ?? '홈 팀'}
          teamShortName={homeTeam?.shortName ?? 'HOME'}
          side="home"
          players={gameState.playerStatsHome}
        />

        <div className="fm-flex-col fm-gap-md">
          <section className="match-center-stage">
            <div className="match-center-stage__header">
              <div>
                <span className="match-center-stage__eyebrow">라이브 중계 스테이지</span>
                <h2 className="match-center-stage__title">캐스터와 해설이 경기 흐름을 전달하고 있습니다.</h2>
              </div>
              <div className="match-center-stage__meta">
                <span>{PHASE_LABELS[gameState.phase]}</span>
                <span>{gameState.currentTick}:00</span>
              </div>
            </div>

            <article className={`match-broadcast-highlight ${toneClass(highlight.tone)}`}>
              <span className="match-broadcast-highlight__eyebrow">현재 장면</span>
              <h3 className="match-broadcast-highlight__title">{highlight.title}</h3>
              <p className="match-broadcast-highlight__detail">{highlight.detail}</p>
            </article>

            <div className="match-broadcast-lines" ref={commentaryRef}>
              {broadcastLines.map((line) => (
                <article key={line.id} className={`match-broadcast-line ${lineToneClass(line.tone)} ${line.highlight ? 'match-broadcast-line--highlight' : ''}`}>
                  <div className="match-broadcast-line__meta">
                    <span className="match-broadcast-line__speaker">{line.speaker.name}</span>
                    <span className="match-broadcast-line__role">{line.roleLabel}</span>
                    <span className="match-broadcast-line__tick">{line.tickLabel}</span>
                  </div>
                  <p className="match-broadcast-line__message">{line.message}</p>
                </article>
              ))}
            </div>

            <div className="fm-card" style={{ marginTop: 14 }}>
              <strong className="fm-text-primary">
                오늘 중계진: {broadcastCrew.caster.name} · {broadcastCrew.analystPrimary.name} · {broadcastCrew.analystSecondary.name}
                {broadcastCrew.guestAnalyst ? ` · 특별 해설 ${broadcastCrew.guestAnalyst.name}` : ''}
              </strong>
              <div className="fm-text-secondary" style={{ marginTop: 6 }}>
                진행 {broadcastCrew.announcer.name} 아나운서
              </div>
            </div>
          </section>

          <div className="match-center-bottom">
            <section className="fm-panel">
              <div className="fm-panel__header">
                <span className="fm-panel__title">실시간 채팅 반응</span>
              </div>
              <div className="fm-panel__body fm-flex-col fm-gap-sm">
                {liveChatMessages.length === 0 ? (
                  <p className="fm-text-muted">큰 장면이 나오면 팬 반응이 여기에 바로 올라옵니다.</p>
                ) : (
                  liveChatMessages.map((message, index) => (
                    <div key={`${message.message}-${index}`} className="fm-card">
                      <strong className="fm-text-primary">{message.username}</strong>
                      <div className="fm-text-secondary">{message.message}</div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <TacticsPanel engine={engine} onTacticsChanged={() => setGameState({ ...engine.getState() })} />
          </div>
        </div>

        <TeamSideBoard
          teamName={awayTeam?.name ?? '원정 팀'}
          teamShortName={awayTeam?.shortName ?? 'AWAY'}
          side="away"
          players={gameState.playerStatsAway}
        />
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
            {seriesScore.home === seriesScore.away ? (
              <p style={{ color: 'var(--warning)', fontWeight: 700, textAlign: 'center', margin: '4px 0 0' }}>결정전 구도입니다.</p>
            ) : null}
            {lastGameStats ? (
              <div className="match-between-result" style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13 }}>
                  {lastGameStats.homeKda.k}/{lastGameStats.homeKda.d}/{lastGameStats.homeKda.a}
                  <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>KDA</span>
                  {lastGameStats.awayKda.k}/{lastGameStats.awayKda.d}/{lastGameStats.awayKda.a}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                  골드 차이 {lastGameStats.goldDiff > 0 ? '+' : ''}
                  {(Math.round(lastGameStats.goldDiff / 100) / 10).toFixed(1)}k
                  <span style={{ margin: '0 8px' }}>·</span>
                  타워 {lastGameStats.towersHome} vs {lastGameStats.towersAway}
                </div>
              </div>
            ) : null}
            <p className="fm-text-secondary" style={{ marginTop: 10 }}>다음 세트 밴픽을 마치면 시리즈가 계속 진행됩니다.</p>
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
          studioPackage={studioPackage}
          gameResults={gameResults}
          perspectiveSide={pendingMatch.teamHomeId === save?.userTeamId ? 'home' : 'away'}
          onSelectCoachTone={setSelectedCoachTone}
          onReturn={() => void handleReturn()}
        />
      ) : null}
    </div>
  );
}
