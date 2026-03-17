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
import {
  LiveMatchEngine,
  type LiveGameState,
  type Decision,
} from '../../engine/match/liveMatch';
import { buildLineup } from '../../engine/match/teamRating';
import { getPlayersByTeamId, getTraitsByTeamId, getFormByTeamId } from '../../db/queries';
import { saveUserMatchResult } from '../../engine/season/dayAdvancer';
import { processPlayoffMatchResult } from '../../engine/season/playoffGenerator';
import { processTournamentMatchResult } from '../../engine/tournament/tournamentEngine';
import { generatePostMatchComment, type PostMatchComment } from '../../ai/gameAiService';
import type { MatchResult, GameResult } from '../../engine/match/matchSimulator';

import { Scoreboard } from './Scoreboard';
import { DecisionPopup } from './DecisionPopup';
import { CommentaryPanel } from './CommentaryPanel';
import { SeriesResult } from './SeriesResult';
const MatchMinimap = lazy(() => import('./MatchMinimap').then((m) => ({ default: m.MatchMinimap })));

const phaseLabels: Record<string, string> = {
  loading: '로딩',
  laning: '라인전',
  mid_game: '중반',
  late_game: '후반',
  finished: '종료',
};

export function LiveMatchView() {
  const navigate = useNavigate();
  const save = useGameStore((s) => s.save);
  const pendingMatch = useGameStore((s) => s.pendingUserMatch);
  const teams = useGameStore((s) => s.teams);
  const setDayPhase = useGameStore((s) => s.setDayPhase);
  const setPendingUserMatch = useGameStore((s) => s.setPendingUserMatch);

  const draftResult = useGameStore((s) => s.draftResult);

  const matchSpeed = useMatchStore((s) => s.speed);
  const setSpeed = useMatchStore((s) => s.setSpeed);

  const [engine, setEngine] = useState<LiveMatchEngine | null>(null);
  const [gameState, setGameState] = useState<LiveGameState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentDecision, setCurrentDecision] = useState<Decision | null>(null);

  // Bo3 시리즈 상태
  const [seriesScore, setSeriesScore] = useState({ home: 0, away: 0 });
  const [currentGameNum, setCurrentGameNum] = useState(1);
  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [seriesComplete, setSeriesComplete] = useState(false);
  const [postMatchComment, setPostMatchComment] = useState<PostMatchComment | null>(null);
  const [homePlayerIds, setHomePlayerIds] = useState<string[]>([]);
  const [awayPlayerIds, setAwayPlayerIds] = useState<string[]>([]);

  const commentaryRef = useRef<HTMLDivElement>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const homeTeam = teams.find((t) => t.id === pendingMatch?.teamHomeId);
  const awayTeam = teams.find((t) => t.id === pendingMatch?.teamAwayId);

  const currentDate = useGameStore((s) => s.season)?.currentDate ?? '';

  // 게임 초기화
  const initGame = useCallback(async (gameNum: number) => {
    if (!pendingMatch || !save) return;

    const homePlayers = await getPlayersByTeamId(pendingMatch.teamHomeId);
    const awayPlayers = await getPlayersByTeamId(pendingMatch.teamAwayId);

    const homeLineup = buildLineup(homePlayers);
    const awayLineup = buildLineup(awayPlayers);

    if (!homeLineup || !awayLineup) return;

    // 미니맵용 플레이어 ID 저장
    const positions: Array<'top' | 'jungle' | 'mid' | 'adc' | 'support'> = ['top', 'jungle', 'mid', 'adc', 'support'];
    setHomePlayerIds(positions.map((pos) => homeLineup[pos].id));
    setAwayPlayerIds(positions.map((pos) => awayLineup[pos].id));

    // 특성 + 폼 조회
    const homeTraits = await getTraitsByTeamId(pendingMatch.teamHomeId);
    const awayTraits = await getTraitsByTeamId(pendingMatch.teamAwayId);
    const homeForm = currentDate ? await getFormByTeamId(pendingMatch.teamHomeId, currentDate) : {};
    const awayForm = currentDate ? await getFormByTeamId(pendingMatch.teamAwayId, currentDate) : {};

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
    });

    // 설정의 기본 속도를 경기 속도로 적용
    const { defaultSpeed } = useSettingsStore.getState();
    setSpeed(defaultSpeed);

    setEngine(newEngine);
    setGameState(newEngine.getState());
    setCurrentDecision(null);
    setIsRunning(false);
  }, [pendingMatch, save, currentDate, setSpeed, draftResult]);

  // 첫 게임 초기화
  useEffect(() => {
    initGame(1);
  }, [initGame]);

  // 틱 루프
  useEffect(() => {
    if (!engine || !isRunning || currentDecision) return;

    const interval = Math.max(50, 500 / matchSpeed);
    tickTimer.current = setInterval(() => {
      const paused = engine.advance();
      const state = engine.getState();
      setGameState({ ...state });

      if (paused && state.pendingDecision) {
        setCurrentDecision(state.pendingDecision);
        setIsRunning(false);
      }

      if (state.isFinished) {
        setIsRunning(false);
      }
    }, interval);

    return () => {
      if (tickTimer.current) clearInterval(tickTimer.current);
    };
  }, [engine, isRunning, matchSpeed, currentDecision]);

  // 중계 메시지 자동 스크롤
  useEffect(() => {
    if (commentaryRef.current) {
      commentaryRef.current.scrollTop = commentaryRef.current.scrollHeight;
    }
  }, [gameState?.commentary.length]);

  // 선택지 응답
  const handleDecision = useCallback((optionId: string) => {
    if (!engine) return;
    engine.resolveDecision(optionId);
    setCurrentDecision(null);
    setGameState({ ...engine.getState() });
    setIsRunning(true);
  }, [engine]);

  // 게임 종료 → 다음 세트 or 시리즈 종료
  const handleGameEnd = useCallback(async () => {
    if (!gameState || !pendingMatch) return;

    const result: GameResult = {
      winnerSide: gameState.winner!,
      durationMinutes: gameState.maxTick,
      goldDiffAt15: gameState.goldHome - gameState.goldAway,
      killsHome: gameState.killsHome,
      killsAway: gameState.killsAway,
      events: gameState.events,
    };

    const newResults = [...gameResults, result];
    setGameResults(newResults);

    const newScore = { ...seriesScore };
    if (gameState.winner === 'home') newScore.home++;
    else newScore.away++;
    setSeriesScore(newScore);

    // Bo3: 2승 필요
    if (newScore.home >= 2 || newScore.away >= 2) {
      // 시리즈 종료
      setSeriesComplete(true);

      // DB 저장
      const matchResult: MatchResult = {
        scoreHome: newScore.home,
        scoreAway: newScore.away,
        winner: newScore.home > newScore.away ? 'home' : 'away',
        games: newResults,
      };
      await saveUserMatchResult(pendingMatch, matchResult);

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
      // 다음 세트
      const nextGame = currentGameNum + 1;
      setCurrentGameNum(nextGame);
      await initGame(nextGame);
    }
  }, [gameState, pendingMatch, gameResults, seriesScore, currentGameNum, initGame]);

  // 시리즈 완료 → 대시보드 복귀
  const setDraftResult = useGameStore((s) => s.setDraftResult);

  const handleReturnToDashboard = useCallback(() => {
    setPendingUserMatch(null);
    setDraftResult(null);
    setDayPhase('idle');
    navigate('/manager/day');
  }, [navigate, setDayPhase, setPendingUserMatch, setDraftResult]);

  if (!pendingMatch || !gameState) {
    return <p style={{ color: '#6a6a7a' }}>경기 데이터 로딩 중...</p>;
  }

  return (
    <div style={styles.container}>
      <Scoreboard
        gameState={gameState}
        homeTeamShortName={homeTeam?.shortName ?? '블루'}
        awayTeamShortName={awayTeam?.shortName ?? '레드'}
        seriesScore={seriesScore}
        currentGameNum={currentGameNum}
        phaseLabels={phaseLabels}
      />

      {/* 컨트롤 바 */}
      <div style={styles.controlBar}>
        {!gameState.isFinished ? (
          <>
            <button
              style={{
                ...styles.ctrlBtn,
                background: isRunning ? '#e74c3c' : '#2ecc71',
              }}
              onClick={() => setIsRunning(!isRunning)}
              aria-label={isRunning ? '일시정지' : '재생'}
            >
              {isRunning ? '일시정지' : '재생'}
            </button>
            <div style={styles.speedRow}>
              {[1, 2, 4].map((s) => (
                <button
                  key={s}
                  style={{
                    ...styles.speedBtn,
                    background: matchSpeed === s ? '#c89b3c' : 'transparent',
                    color: matchSpeed === s ? '#0d0d1a' : '#8a8a9a',
                  }}
                  onClick={() => setSpeed(s)}
                  aria-label={`속도 ${s}배`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </>
        ) : (
          <button style={styles.nextBtn} onClick={handleGameEnd}>
            {seriesScore.home >= 2 || seriesScore.away >= 2
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

      <div style={styles.matchContent}>
        <CommentaryPanel
          commentary={gameState.commentary}
          panelRef={commentaryRef}
        />
        <Suspense fallback={<div style={{ width: 280, height: 280, background: '#0a1a0a', borderRadius: '8px' }} />}>
          <MatchMinimap
            gameState={gameState}
            homePlayerIds={homePlayerIds}
            awayPlayerIds={awayPlayerIds}
          />
        </Suspense>
      </div>

      {seriesComplete && (
        <SeriesResult
          homeTeamShortName={homeTeam?.shortName}
          awayTeamShortName={awayTeam?.shortName}
          homeTeamName={homeTeam?.name}
          awayTeamName={awayTeam?.name}
          seriesScore={seriesScore}
          postMatchComment={postMatchComment}
          onReturn={handleReturnToDashboard}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
  },
  matchContent: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px',
  },
  controlBar: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px',
  },
  ctrlBtn: {
    padding: '8px 24px',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  speedRow: {
    display: 'flex',
    gap: '6px',
  },
  speedBtn: {
    padding: '6px 12px',
    border: '1px solid #3a3a5c',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  nextBtn: {
    padding: '10px 32px',
    background: '#c89b3c',
    color: '#0d0d1a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
