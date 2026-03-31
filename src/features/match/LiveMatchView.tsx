/**
 * 라이브 경기 뷰
 * - 틱 기반 경기 진행 시각화
 * - 실시간 스코어보드
 * - 중계 메시지 스트리밍
 * - 선택지 팝업 (일시정지 → 선택 → 재개)
 * - 속도 조절 (1x, 2x, 4x)
 */

import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/gameStore';
import { useMatchStore } from '../../stores/matchStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useBgm } from '../../hooks/useBgm';
import {
  LiveMatchEngine,
  type LiveGameState,
  type Decision,
} from '../../engine/match/liveMatch';
import { conductTeamTalk } from '../../engine/teamTalk/teamTalkEngine';
import { buildLineup } from '../../engine/match/teamRating';
import { getPlayersByTeamId, getTraitsByTeamId, getFormByTeamId, getTeamPlayStyle } from '../../db/queries';
import { calculateChemistryBonus } from '../../engine/chemistry/chemistryEngine';
import { calculateTeamSoloRankBonus } from '../../engine/soloRank/soloRankEngine';
import { saveUserMatchResult } from '../../engine/season/dayAdvancer';
import { processPlayoffMatchResult } from '../../engine/season/playoffGenerator';
import { processTournamentMatchResult } from '../../engine/tournament/tournamentEngine';
import { buildPostMatchInsightReport } from '../../engine/analysis/postMatchInsightEngine';
import { generatePostMatchComment, type PostMatchComment } from '../../ai/gameAiService';
import { generateMatchCommentary, generateLiveChatMessages, type LiveChatMessage } from '../../ai/advancedAiService';
import { accumulateFearlessChampions } from '../../engine/draft/draftEngine';
import type { MatchResult, GameResult } from '../../engine/match/matchSimulator';

import { Scoreboard } from './Scoreboard';
import { DecisionPopup } from './DecisionPopup';
import { CommentaryPanel } from './CommentaryPanel';
import { SeriesResult } from './SeriesResult';
import { TacticsPanel } from './TacticsPanel';
import { PlayerInstructions } from './PlayerInstructions';
import { PlayerStatsTable } from './PlayerStatsTable';
import { PostGameStats } from './PostGameStats';
import { soundManager } from '../../audio/soundManager';
import './match.css';
const MatchMinimap = lazy(() => import('./MatchMinimap').then((m) => ({ default: m.MatchMinimap })));
const MatchMinimap3D = lazy(() => import('./MatchMinimap3D').then((m) => ({ default: m.MatchMinimap3D })));

const AI_COMMENTARY_EVENT_TYPES = new Set(['kill', 'dragon', 'baron', 'tower_destroy', 'teamfight']);
const AI_COMMENTARY_COOLDOWN_MS = 30_000;
const LIVE_CHAT_COOLDOWN_MS = 20_000;

/** 엔진 이벤트 타입 -> 라이브 채팅 이벤트 매핑 */
const EVENT_TO_CHAT: Record<string, string> = {
  kill: 'firstBlood',
  dragon: 'dragon',
  baron: 'baron',
  teamfight: 'teamfight',
  tower_destroy: 'teamfight',
};

/** 채팅 타입별 색상 */
const CHAT_TYPE_COLORS: Record<string, string> = {
  cheer: '#2ecc71',
  flame: '#e74c3c',
  meme: '#f39c12',
  analysis: '#60a5fa',
  neutral: '#8a8a9a',
};

const phaseLabels: Record<string, string> = {
  loading: '로딩',
  laning: '라인전',
  mid_game: '중반',
  late_game: '후반',
  finished: '종료',
};

export function LiveMatchView() {
  useBgm('match');
  const navigate = useNavigate();
  const save = useGameStore((s) => s.save);
  const pendingMatch = useGameStore((s) => s.pendingUserMatch);
  const teams = useGameStore((s) => s.teams);
  const setDayPhase = useGameStore((s) => s.setDayPhase);
  const setPendingUserMatch = useGameStore((s) => s.setPendingUserMatch);

  const draftResult = useGameStore((s) => s.draftResult);
  const setDraftResult = useGameStore((s) => s.setDraftResult);
  const fearlessPool = useGameStore((s) => s.fearlessPool);
  const setFearlessPool = useGameStore((s) => s.setFearlessPool);
  const mode = useGameStore((s) => s.mode);
  const basePath = mode === 'player' ? '/player' : '/manager';

  const matchSpeed = useMatchStore((s) => s.speed);
  const setSpeed = useMatchStore((s) => s.setSpeed);
  // 시리즈 상태 (matchStore — 피어리스 재드래프트 시 유지)
  const seriesScore = useMatchStore((s) => s.seriesScore);
  const setSeriesScore = useMatchStore((s) => s.setSeriesScore);
  const currentGameNum = useMatchStore((s) => s.currentGameNum);
  const setCurrentGameNum = useMatchStore((s) => s.setCurrentGameNum);
  const gameResults = useMatchStore((s) => s.gameResults);
  const setGameResults = useMatchStore((s) => s.setGameResults);
  const betweenGames = useMatchStore((s) => s.betweenGames);
  const setBetweenGames = useMatchStore((s) => s.setBetweenGames);
  const resetSeries = useMatchStore((s) => s.resetSeries);

  const [engine, setEngine] = useState<LiveMatchEngine | null>(null);
  const [gameState, setGameState] = useState<LiveGameState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentDecision, setCurrentDecision] = useState<Decision | null>(null);
  const [seriesComplete, setSeriesComplete] = useState(false);
  const [is3D, setIs3D] = useState(false);
  const [postMatchComment, setPostMatchComment] = useState<PostMatchComment | null>(null);
  const [homePlayerIds, setHomePlayerIds] = useState<string[]>([]);
  const [awayPlayerIds, setAwayPlayerIds] = useState<string[]>([]);
  const [teamTalkResult, setTeamTalkResult] = useState<string | null>(null);
  const [teamTalkDone, setTeamTalkDone] = useState(false);
  const [liveChatMessages, setLiveChatMessages] = useState<LiveChatMessage[]>([]);
  const [matchError, setMatchError] = useState<string | null>(null);

  const commentaryRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const lastAiCommentaryTime = useRef<number>(0);
  const lastProcessedEventCount = useRef<number>(0);
  const lastChatEventCount = useRef<number>(0);
  const lastChatTime = useRef<number>(0);

  const homeTeam = teams.find((t) => t.id === pendingMatch?.teamHomeId);
  const awayTeam = teams.find((t) => t.id === pendingMatch?.teamAwayId);
  const userSide = pendingMatch && save?.userTeamId
    ? (pendingMatch.teamHomeId === save.userTeamId ? 'home' : 'away')
    : 'home';

  const currentDate = useGameStore((s) => s.season)?.currentDate ?? '';

  // 게임 초기화
  const initGame = useCallback(async (gameNum: number) => {
    if (!pendingMatch || !save) return;

    const homePlayers = await getPlayersByTeamId(pendingMatch.teamHomeId);
    const awayPlayers = await getPlayersByTeamId(pendingMatch.teamAwayId);

    const homeLineup = buildLineup(homePlayers);
    const awayLineup = buildLineup(awayPlayers);

    if (!homeLineup || !awayLineup) {
      setMatchError('출전 가능한 선수가 부족하여 경기를 진행할 수 없습니다.');
      return;
    }

    // 미니맵용 플레이어 ID 저장
    const positions: Array<'top' | 'jungle' | 'mid' | 'adc' | 'support'> = ['top', 'jungle', 'mid', 'adc', 'support'];
    setHomePlayerIds(positions.map((pos) => homeLineup[pos].id));
    setAwayPlayerIds(positions.map((pos) => awayLineup[pos].id));

    // 특성 + 폼 조회
    const homeTraits = await getTraitsByTeamId(pendingMatch.teamHomeId);
    const awayTraits = await getTraitsByTeamId(pendingMatch.teamAwayId);
    const homeForm = currentDate ? await getFormByTeamId(pendingMatch.teamHomeId, currentDate) : {};
    const awayForm = currentDate ? await getFormByTeamId(pendingMatch.teamAwayId, currentDate) : {};
    const homePlayStyle = await getTeamPlayStyle(pendingMatch.teamHomeId);
    const awayPlayStyle = await getTeamPlayStyle(pendingMatch.teamAwayId);

    // 케미스트리 + 솔로랭크 보너스
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
    } catch { /* 보너스 계산 실패 시 0 사용 */ }

    const newEngine = new LiveMatchEngine({
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

    // 설정의 기본 속도를 경기 속도로 적용
    const { defaultSpeed } = useSettingsStore.getState();
    setSpeed(defaultSpeed);

    setEngine(newEngine);
    setGameState(newEngine.getState());
    setCurrentDecision(null);
    setIsRunning(false);
  }, [pendingMatch, save, currentDate, setSpeed, draftResult]);

  // 게임 초기화 (첫 세트 또는 피어리스 재드래프트 후 복귀)
  useEffect(() => {
    initGame(currentGameNum);
  }, [initGame, currentGameNum]);

  // 틱 루프 — requestAnimationFrame 기반 (부드러운 렌더링)
  useEffect(() => {
    if (!engine || !isRunning || currentDecision) return;

    const tickInterval = Math.max(50, 500 / matchSpeed);
    let lastTickTime = performance.now();
    let animId = 0;

    const loop = (now: number) => {
      const elapsed = now - lastTickTime;
      if (elapsed >= tickInterval) {
        lastTickTime = now - (elapsed % tickInterval);
        const paused = engine.advance();
        const state = engine.getState();
        setGameState({ ...state });

        if (paused && state.pendingDecision) {
          setCurrentDecision(state.pendingDecision);
          setIsRunning(false);
          return;
        }

        if (state.isFinished) {
          setIsRunning(false);
          return;
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [engine, isRunning, matchSpeed, currentDecision]);

  // AI 경기 중계: 주요 이벤트(kill, dragon, baron, tower_destroy, teamfight) 발생 시 호출
  // 최소 30초(실시간) 간격 제한
  useEffect(() => {
    let cancelled = false;
    if (!gameState || !engine || gameState.isFinished) return;

    const events = gameState.events;
    const prevCount = lastProcessedEventCount.current;
    if (events.length <= prevCount) return;

    // 새 이벤트 중 주요 이벤트 필터링
    const newEvents = events.slice(prevCount);
    lastProcessedEventCount.current = events.length;

    const majorEvent = newEvents.find(e => AI_COMMENTARY_EVENT_TYPES.has(e.type));
    if (!majorEvent) return;

    const now = Date.now();
    if (now - lastAiCommentaryTime.current < AI_COMMENTARY_COOLDOWN_MS) return;
    lastAiCommentaryTime.current = now;

    // 게임 페이즈 매핑
    const phase = gameState.phase === 'laning' ? 'laning'
      : gameState.phase === 'mid_game' ? 'mid_game' : 'late_game';

    // 비동기 AI 중계 호출 (fire-and-forget, 실패 시 무시)
    generateMatchCommentary({
      phase,
      event: majorEvent.type,
      details: majorEvent.description,
      goldDiff: gameState.goldHome - gameState.goldAway,
      gameTime: gameState.currentTick,
      kills: { home: gameState.killsHome, away: gameState.killsAway },
      teamName: homeTeam?.shortName,
    }).then(result => {
      if (cancelled || !engine) return;
      const state = engine.getState();
      // 불변성 유지: 새 배열 생성
      const newCommentary = [...state.commentary, {
        tick: state.currentTick,
        message: result.text,
        type: (majorEvent.type === 'kill' || majorEvent.type === 'teamfight' ? 'highlight' : 'info') as 'highlight' | 'info',
      }];
      setGameState({ ...state, commentary: newCommentary });
    }).catch(() => { /* AI 실패 시 기존 중계 유지 */ });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- engine/gameState를 deps에 추가하면 매 틱마다 실행되어 AI 호출 폭주. 이벤트 수 변경 시에만 실행
  }, [gameState?.events.length]);

  // 라이브 채팅: 주요 이벤트 시 커뮤니티 채팅 생성
  useEffect(() => {
    let cancelled = false;
    if (!gameState || !engine || gameState.isFinished) return;

    const events = gameState.events;
    const prevCount = lastChatEventCount.current;
    if (events.length <= prevCount) return;

    const newEvents = events.slice(prevCount);
    lastChatEventCount.current = events.length;

    const majorEvent = newEvents.find(e => AI_COMMENTARY_EVENT_TYPES.has(e.type));
    if (!majorEvent) return;

    const now = Date.now();
    if (now - lastChatTime.current < LIVE_CHAT_COOLDOWN_MS) return;
    lastChatTime.current = now;

    const chatEvent = EVENT_TO_CHAT[majorEvent.type] ?? 'teamfight';
    const isWinning = gameState.goldHome >= gameState.goldAway;

    generateLiveChatMessages({
      teamName: homeTeam?.shortName ?? '블루',
      opponentName: awayTeam?.shortName ?? '레드',
      event: chatEvent,
      isWinning,
      goldDiff: gameState.goldHome - gameState.goldAway,
      gameTime: gameState.currentTick,
      count: 4,
    }).then(messages => {
      if (cancelled) return;
      setLiveChatMessages(prev => [...prev, ...messages].slice(-30));
    }).catch(() => { /* 채팅 생성 실패 무시 */ });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- engine/gameState/teamNames를 deps에 추가하면 매 틱마다 실행되어 채팅 생성 폭주. 이벤트 수 변경 시에만 실행
  }, [gameState?.events.length]);

  // 채팅 패널 자동 스크롤
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [liveChatMessages.length]);

  // 중계 메시지 자동 스크롤
  useEffect(() => {
    if (commentaryRef.current) {
      commentaryRef.current.scrollTop = commentaryRef.current.scrollHeight;
    }
  }, [gameState?.commentary.length]);

  // 전술 변경 후 상태 갱신
  const handleTacticsChanged = useCallback(() => {
    if (!engine) return;
    setGameState({ ...engine.getState() });
  }, [engine]);

  // 선택지 응답
  const handleDecision = useCallback((optionId: string) => {
    if (!engine) return;
    engine.resolveDecision(optionId);
    setCurrentDecision(null);
    setGameState({ ...engine.getState() });
    setIsRunning(true);
  }, [engine]);

  // 게임 종료 → 다음 세트 or 시리즈 종료
  const handleGameEnd = async () => {
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
    if (gameState.winner === 'home') newScore.home++;
    else newScore.away++;
    setSeriesScore(newScore);
    setGameResults(newResults);

    // Bo 포맷별 승수 계산 (Bo3: 2승, Bo5: 3승)
    const winsNeeded = pendingMatch.boFormat === 'Bo5' ? 3 : 2;
    if (newScore.home >= winsNeeded || newScore.away >= winsNeeded) {
      // 시리즈 종료
      setSeriesComplete(true);

      // 승리/패배 사운드
      const userIsHome = pendingMatch.teamHomeId === save?.userTeamId;
      const isUserWinner = (newScore.home > newScore.away && userIsHome) ||
        (newScore.away > newScore.home && !userIsHome);
      soundManager.play(isUserWinner ? 'victory' : 'defeat');

      // DB 저장
      const matchResult: MatchResult = {
        scoreHome: newScore.home,
        scoreAway: newScore.away,
        winner: newScore.home > newScore.away ? 'home' : 'away',
        games: newResults,
        substitutions: [],
        sideSelections: [],
      };
      await saveUserMatchResult(pendingMatch, matchResult, pendingMatch.seasonId, save?.userTeamId, save?.id);

      // 경기 후 AI 코멘트 생성
      const isUserWin =
        (matchResult.winner === 'home' && pendingMatch.teamHomeId === save?.userTeamId) ||
        (matchResult.winner === 'away' && pendingMatch.teamAwayId === save?.userTeamId);
      generatePostMatchComment({
        teamName: homeTeam?.shortName ?? '',
        opponentName: awayTeam?.shortName ?? '',
        isWin: isUserWin,
        scoreHome: newScore.home,
        scoreAway: newScore.away,
      }).then(setPostMatchComment).catch(() => {});

      // 플레이오프 / 토너먼트 경기인 경우 다음 라운드 자동 처리
      if (pendingMatch.matchType !== 'regular') {
        const winnerTeamId = matchResult.winner === 'home'
          ? pendingMatch.teamHomeId : pendingMatch.teamAwayId;

        if (pendingMatch.matchType.startsWith('msi_') || pendingMatch.matchType.startsWith('worlds_')) {
          // 국제대회 경기
          await processTournamentMatchResult(
            pendingMatch.seasonId, pendingMatch.id, winnerTeamId,
          );
        } else {
          // 플레이오프 경기
          await processPlayoffMatchResult(
            pendingMatch.seasonId, pendingMatch.id, winnerTeamId,
          );
        }
      }
    } else {
      // 세트 간 휴식 화면 진입
      setBetweenGames(true);
      setTeamTalkResult(null);
      setTeamTalkDone(false);
    }
  };

  // 세트 간 팀 토크 실행
  const handleBetweenGamesTalk = useCallback(async (tone: 'motivate' | 'calm' | 'warn') => {
    if (!pendingMatch || !save || teamTalkDone) return;
    const result = await conductTeamTalk(
      pendingMatch.id,
      save.userTeamId,
      'between_games',
      tone,
      null,
    );
    setTeamTalkResult(result.message);
    setTeamTalkDone(true);
  }, [pendingMatch, save, teamTalkDone]);

  // 세트 간 휴식 → 다음 세트 진행
  const handleProceedToNextGame = useCallback(async () => {
    if (!pendingMatch) return;
    setBetweenGames(false);

    const nextGame = currentGameNum + 1;
    setCurrentGameNum(nextGame);

    // 피어리스 드래프트: 사용된 챔피언 풀 누적 → 재드래프트
    if (pendingMatch.fearlessDraft && draftResult) {
      const newPool = accumulateFearlessChampions(fearlessPool, draftResult);
      setFearlessPool(newPool);
      setDayPhase('banpick');
      navigate(`${basePath}/draft`);
      return;
    }

    await initGame(nextGame);
  }, [pendingMatch, currentGameNum, initGame, draftResult, fearlessPool, setFearlessPool, setDayPhase, navigate, basePath, setBetweenGames, setCurrentGameNum]);

  // 시리즈 완료 → 대시보드 복귀
  const handleReturnToDashboard = useCallback(() => {
    setPendingUserMatch(null);
    setDraftResult(null);
    setFearlessPool({ blue: [], red: [] });
    resetSeries();
    setDayPhase('idle');
    navigate(`${basePath}/day`);
  }, [navigate, basePath, setDayPhase, setPendingUserMatch, setDraftResult, setFearlessPool, resetSeries]);

  if (matchError) {
    return (
      <div className="fm-panel fm-p-lg">
        <p className="fm-text-danger fm-text-md fm-mb-md">{matchError}</p>
        <button className="fm-btn fm-btn--secondary" onClick={handleReturnToDashboard}>돌아가기</button>
      </div>
    );
  }

  if (!pendingMatch || !gameState) {
    return <p className="fm-text-muted fm-text-md">경기 데이터 로딩 중...</p>;
  }

  return (
    <div className="match-container">
      <Scoreboard
        gameState={gameState}
        homeTeamShortName={homeTeam?.shortName ?? '블루'}
        awayTeamShortName={awayTeam?.shortName ?? '레드'}
        seriesScore={seriesScore}
        currentGameNum={currentGameNum}
        phaseLabels={phaseLabels}
      />

      {/* 컨트롤 바 */}
      <div className="match-control-bar">
        {!gameState.isFinished ? (
          <>
            <button
              className={`fm-btn ${isRunning ? 'fm-btn--danger' : 'fm-btn--success'}`}
              onClick={() => {
                if (!isRunning && gameState?.phase === 'loading') {
                  soundManager.play('match_start');
                }
                setIsRunning(!isRunning);
              }}
              aria-label={isRunning ? '일시정지' : '재생'}
            >
              {isRunning ? '일시정지' : '재생'}
            </button>
            <div className="match-speed-row">
              {[1, 2, 4].map((s) => (
                <button
                  key={s}
                  className={`match-speed-btn ${matchSpeed === s ? 'match-speed-btn--active' : ''}`}
                  onClick={() => setSpeed(s)}
                  aria-label={`속도 ${s}배`}
                >
                  {s}x
                </button>
              ))}
            </div>
            {mode === 'manager' && engine && (
              <TacticsPanel engine={engine} onTacticsChanged={handleTacticsChanged} />
            )}
          </>
        ) : (
          <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={handleGameEnd}>
            {seriesScore.home >= (pendingMatch?.boFormat === 'Bo5' ? 3 : 2) || seriesScore.away >= (pendingMatch?.boFormat === 'Bo5' ? 3 : 2)
              ? '시리즈 결과 확인'
              : `다음 세트 (SET ${currentGameNum + 1})`}
          </button>
        )}
      </div>

      {currentDecision && (
        <DecisionPopup
          decision={currentDecision}
          onDecision={handleDecision}
        />
      )}

      {/* 개별 선수 지시 (감독 모드, 경기 진행 중) */}
      {mode === 'manager' && engine && !gameState.isFinished && (
        <div className="match-instructions-row">
          <PlayerInstructions
            engine={engine}
            playerStats={gameState.playerStatsHome}
            side="home"
            teamShortName={homeTeam?.shortName ?? '블루'}
            onInstructionChanged={handleTacticsChanged}
          />
          <PlayerInstructions
            engine={engine}
            playerStats={gameState.playerStatsAway}
            side="away"
            teamShortName={awayTeam?.shortName ?? '레드'}
            onInstructionChanged={handleTacticsChanged}
          />
        </div>
      )}

      {/* 메인 영역: 미니맵(좌) + 중계/채팅(우) */}
      <div className="match-main-area">
        <div className="match-main-left">
          <div className="minimap-toggle-bar">
            <button
              className={`minimap-toggle-btn ${!is3D ? 'minimap-toggle-btn--active' : ''}`}
              onClick={() => setIs3D(false)}
            >2D</button>
            <button
              className={`minimap-toggle-btn ${is3D ? 'minimap-toggle-btn--active' : ''}`}
              onClick={() => setIs3D(true)}
            >3D</button>
          </div>
          <Suspense fallback={<div className="match-minimap-placeholder" />}>
            {is3D ? (
              <MatchMinimap3D
                gameState={gameState}
                homePlayerIds={homePlayerIds}
                awayPlayerIds={awayPlayerIds}
                width={450}
                height={450}
              />
            ) : (
              <MatchMinimap
                gameState={gameState}
                homePlayerIds={homePlayerIds}
                awayPlayerIds={awayPlayerIds}
                width={450}
                height={450}
              />
            )}
          </Suspense>
        </div>
        <div className="match-main-right">
          <CommentaryPanel
            commentary={gameState.commentary}
            panelRef={commentaryRef}
          />
          <div className="match-chat-panel" ref={chatRef}>
            <h3 className="match-chat-title">라이브 채팅</h3>
            {liveChatMessages.length === 0 ? (
              <p className="match-chat-empty">이벤트 발생 시 채팅이 표시됩니다</p>
            ) : (
              liveChatMessages.map((msg, i) => (
                <div key={i} className="match-chat-item">
                  <span
                    className="match-chat-username"
                    style={{ color: CHAT_TYPE_COLORS[msg.type] ?? '#8a8a9a' }}
                  >
                    {msg.username}
                  </span>
                  <span className="match-chat-message">{msg.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 하단: 실시간 선수 스탯 테이블 */}
      <PlayerStatsTable
        playerStatsHome={gameState.playerStatsHome}
        playerStatsAway={gameState.playerStatsAway}
        currentTick={gameState.currentTick}
        killsHome={gameState.killsHome}
        killsAway={gameState.killsAway}
        homeTeamName={homeTeam?.shortName ?? '블루'}
        awayTeamName={awayTeam?.shortName ?? '레드'}
      />

      {betweenGames && gameState && (
        <div className="fm-overlay">
          <div className="match-between-modal">
            <h2 className="match-between-title">세트 간 휴식</h2>

            {/* LCK 스타일 경기 후 통계 */}
            {gameResults.length > 0 && (
              <PostGameStats
                gameResult={gameResults[gameResults.length - 1]}
                homeTeamName={homeTeam?.shortName ?? '블루'}
                awayTeamName={awayTeam?.shortName ?? '레드'}
                gameNumber={currentGameNum}
                insightReport={buildPostMatchInsightReport(gameResults[gameResults.length - 1], userSide)}
              />
            )}

            {/* 시리즈 스코어 */}
            <div className="match-between-series-score">
              <span className="match-between-series-label">시리즈 스코어</span>
              <span className="match-between-series-value">
                {seriesScore.home} - {seriesScore.away}
              </span>
            </div>

            {/* 팀 토크 */}
            {mode === 'manager' && (
              <div className="match-between-talk-section">
                <span className="match-between-talk-label">팀 토크</span>
                {!teamTalkDone ? (
                  <div className="match-between-talk-btns">
                    <button
                      className="fm-btn fm-btn--success"
                      onClick={() => handleBetweenGamesTalk('motivate')}
                    >
                      격려
                    </button>
                    <button
                      className="fm-btn fm-btn--info"
                      onClick={() => handleBetweenGamesTalk('calm')}
                    >
                      진정
                    </button>
                    <button
                      className="fm-btn fm-btn--warning"
                      onClick={() => handleBetweenGamesTalk('warn')}
                    >
                      경고
                    </button>
                  </div>
                ) : (
                  <p className="match-between-talk-result">{teamTalkResult}</p>
                )}
              </div>
            )}

            {/* 다음 세트 버튼 */}
            <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={handleProceedToNextGame}>
              다음 세트 시작 (SET {currentGameNum + 1})
            </button>
          </div>
        </div>
      )}

      {seriesComplete && (
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
      )}
    </div>
  );
}
