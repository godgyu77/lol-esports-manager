/**
 * 밴픽 UI
 * - 프로 리그 표준 밴픽 순서 시각화
 * - 감독 모드: 유저가 직접 밴/픽 + AI 추천
 * - 선수 모드: AI가 밴/픽, 유저는 관전
 * - 밴픽 완료 → 라이브 매치로 이동
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/gameStore';
import { useBgm } from '../../hooks/useBgm';
import {
  createDraftState,
  executeDraftAction,
  swapChampions,
  finalizeDraft,
  aiSelectBan,
  aiSelectPick,
  buildDraftTeamInfo,
  getRecommendedBans,
  getRecommendedPicks,
  type DraftState,
  type DraftTeamInfo,
} from '../../engine/draft/draftEngine';
import { CHAMPION_DB } from '../../data/championDb';
import { getPlayersByTeamId } from '../../db/queries';
import type { Position } from '../../types/game';
import { BanSection } from './BanSection';
import { PickSection } from './PickSection';
import { ChampionGrid } from './ChampionGrid';
import { DraftCenterPanel } from './DraftCenterPanel';
import { soundManager } from '../../audio/soundManager';
import { generateDraftAdvice, type DraftAdvice } from '../../ai/advancedAiService';
import './draft.css';

export function DraftView() {
  useBgm('draft');
  const navigate = useNavigate();
  const save = useGameStore((s) => s.save);
  const pendingMatch = useGameStore((s) => s.pendingUserMatch);
  const teams = useGameStore((s) => s.teams);
  const setDayPhase = useGameStore((s) => s.setDayPhase);
  const setDraftResult = useGameStore((s) => s.setDraftResult);
  const fearlessPool = useGameStore((s) => s.fearlessPool);
  const mode = useGameStore((s) => s.mode);
  const basePath = mode === 'player' ? '/player' : '/manager';

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [blueInfo, setBlueInfo] = useState<DraftTeamInfo | null>(null);
  const [redInfo, setRedInfo] = useState<DraftTeamInfo | null>(null);
  const [selectedChampion, setSelectedChampion] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<Position>('mid');
  const [isAiTurn, setIsAiTurn] = useState(false);
  const [filterPosition, setFilterPosition] = useState<Position | 'all'>('all');
  const [aiAdvice, setAiAdvice] = useState<DraftAdvice | null>(null);
  const [aiAdviceLoading, setAiAdviceLoading] = useState(false);

  const userTeamId = save?.userTeamId ?? '';
  const isUserBlue = pendingMatch?.teamHomeId === userTeamId;
  const userSide = isUserBlue ? 'blue' : 'red';
  const homeTeam = teams.find((t) => t.id === pendingMatch?.teamHomeId);
  const awayTeam = teams.find((t) => t.id === pendingMatch?.teamAwayId);

  // 초기화
  useEffect(() => {
    if (!pendingMatch) return;

    const init = async () => {
      const homePlayers = await getPlayersByTeamId(pendingMatch.teamHomeId);
      const awayPlayers = await getPlayersByTeamId(pendingMatch.teamAwayId);

      const blue = buildDraftTeamInfo(homePlayers);
      const red = buildDraftTeamInfo(awayPlayers);
      setBlueInfo(blue);
      setRedInfo(red);
      const isFearless = pendingMatch.fearlessDraft ?? false;
      setDraft(createDraftState(isFearless, isFearless ? fearlessPool : undefined));
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fearlessPool은 초기화 시점에만 사용. 밴픽 중 변경되지 않으므로 deps 제외
  }, [pendingMatch]);

  // AI 턴 자동 처리
  useEffect(() => {
    if (!draft || !blueInfo || !redInfo || draft.isComplete) return;

    // 선수 모드: AI가 양쪽 다 밴픽 (유저는 관전)
    const currentIsUser = mode === 'manager' && draft.currentSide === userSide;
    if (currentIsUser) {
      setIsAiTurn(false);
      return;
    }

    // AI 턴
    setIsAiTurn(true);
    const timer = setTimeout(async () => {
      const newDraft = structuredClone(draft);

      if (draft.currentActionType === 'ban') {
        const opponentInfo = draft.currentSide === 'blue' ? redInfo : blueInfo;
        const champId = await aiSelectBan(newDraft, opponentInfo, CHAMPION_DB);
        executeDraftAction(newDraft, champId);
      } else {
        const teamInfo = draft.currentSide === 'blue' ? blueInfo : redInfo;
        const { championId, position } = await aiSelectPick(
          newDraft,
          draft.currentSide,
          teamInfo,
          CHAMPION_DB,
        );
        executeDraftAction(newDraft, championId, position);
      }

      setDraft(newDraft);
      setIsAiTurn(false);
    }, 800); // AI 딜레이

    return () => clearTimeout(timer);
  }, [draft, userSide, blueInfo, redInfo, mode]);

  // 추천 목록
  const recommendations = useMemo(() => {
    if (!draft || !blueInfo || !redInfo || draft.isComplete) return [];
    if (draft.currentSide !== userSide) return [];

    if (draft.currentActionType === 'ban') {
      const opponentInfo = isUserBlue ? redInfo : blueInfo;
      return getRecommendedBans(draft, opponentInfo, CHAMPION_DB).map((r) => ({
        ...r,
        position: undefined as Position | undefined,
      }));
    } else {
      const teamInfo = isUserBlue ? blueInfo : redInfo;
      return getRecommendedPicks(draft, userSide, teamInfo, CHAMPION_DB).map((r) => ({
        championId: r.championId,
        reason: r.reason,
        position: r.position,
      }));
    }
  }, [draft, userSide, blueInfo, redInfo, isUserBlue]);

  // 유저 턴 시 AI 조언 생성
  useEffect(() => {
    if (!draft || draft.isComplete) return;
    const currentIsUserTurn = mode === 'manager' && draft.currentSide === userSide;
    if (!currentIsUserTurn) {
      setAiAdvice(null);
      return;
    }

    setAiAdviceLoading(true);
    setAiAdvice(null);

    const recommendedBans = draft.currentActionType === 'ban' && recommendations.length > 0
      ? recommendations.map(r => r.championId ?? '').filter(Boolean)
      : undefined;

    generateDraftAdvice({
      phase: draft.currentActionType,
      turn: draft.currentStep,
      myTeam: isUserBlue ? (homeTeam?.shortName ?? '블루') : (awayTeam?.shortName ?? '레드'),
      opponentTeam: isUserBlue ? (awayTeam?.shortName ?? '레드') : (homeTeam?.shortName ?? '블루'),
      myBans: isUserBlue ? draft.blue.bans : draft.red.bans,
      opponentBans: isUserBlue ? draft.red.bans : draft.blue.bans,
      myPicks: (isUserBlue ? draft.blue.picks : draft.red.picks).map(p => p.championId),
      opponentPicks: (isUserBlue ? draft.red.picks : draft.blue.picks).map(p => p.championId),
      recommendedBans,
    }).then(advice => {
      setAiAdvice(advice);
    }).catch(() => {
      // AI 실패 시 조언 표시하지 않음
    }).finally(() => {
      setAiAdviceLoading(false);
    });
  }, [draft, mode, userSide, isUserBlue, homeTeam?.shortName, awayTeam?.shortName, recommendations]);

  // 스왑용 선택 상태
  const [swapSelection, setSwapSelection] = useState<number | null>(null);

  // 밴픽 완료 시 (스왑 완료 후)
  useEffect(() => {
    if (draft?.isComplete) {
      setDraftResult(draft);
      const timer = setTimeout(() => {
        setDayPhase('live_match');
        navigate(`${basePath}/match`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [draft, navigate, setDayPhase, setDraftResult, basePath]);

  const handleSwap = useCallback((index: number) => {
    if (!draft || draft.phase !== 'swap') return;
    if (swapSelection === null) {
      setSwapSelection(index);
    } else {
      if (swapSelection !== index) {
        const newDraft = structuredClone(draft);
        swapChampions(newDraft, userSide, swapSelection, index);
        setDraft(newDraft);
      }
      setSwapSelection(null);
    }
  }, [draft, swapSelection, userSide]);

  const handleFinalizeDraft = useCallback(() => {
    if (!draft) return;
    const newDraft = structuredClone(draft);
    finalizeDraft(newDraft);
    setDraft(newDraft);
  }, [draft]);

  const handleConfirm = useCallback(() => {
    if (!draft || !selectedChampion) return;

    const newDraft = structuredClone(draft);
    const pos = draft.currentActionType === 'pick' ? selectedPosition : undefined;
    const success = executeDraftAction(newDraft, selectedChampion, pos);

    if (success) {
      soundManager.play('draft_pick');
      setDraft(newDraft);
      setSelectedChampion(null);
    }
  }, [draft, selectedChampion, selectedPosition]);

  // 챔피언 목록 필터링 (피어리스 제한 챔피언은 비활성으로 표시)
  const { filteredChampions, fearlessDisabledIds } = useMemo(() => {
    if (!draft) return { filteredChampions: [], fearlessDisabledIds: new Set<string>() };

    // 피어리스로 인해 사용 불가한 챔피언 ID 수집 (현재 턴 side만 제한)
    const disabled = new Set<string>();
    if (draft.fearlessMode && draft.currentSide) {
      const pool = draft.currentSide === 'blue' ? draft.fearlessPool.blue : draft.fearlessPool.red;
      for (const id of pool) disabled.add(id);
    }

    const filtered = CHAMPION_DB.filter((c) => {
      // 밴/픽된 챔피언은 제외 (피어리스 제한은 제외하지 않고 비활성 표시)
      if (draft.bannedChampions.includes(c.id)) return false;
      if (draft.pickedChampions.includes(c.id)) return false;
      if (filterPosition !== 'all' && c.primaryRole !== filterPosition) return false;
      return true;
    });

    return { filteredChampions: filtered, fearlessDisabledIds: disabled };
  }, [draft, filterPosition]);

  if (!pendingMatch || !draft) {
    return <p className="fm-text-muted fm-text-md">밴픽 데이터 로딩 중...</p>;
  }

  const currentIsUser = mode === 'manager' && draft.currentSide === userSide;

  return (
    <div className="draft-container">
      {/* 피어리스 드래프트 표시 */}
      {draft.fearlessMode && (
        <div className="draft-fearless-banner">
          FEARLESS DRAFT — 이전 세트에서 사용한 챔피언 재사용 불가
          {(fearlessPool.blue.length > 0 || fearlessPool.red.length > 0) && (
            <span className="draft-fearless-count">
              (블루 {fearlessPool.blue.length}챔 / 레드 {fearlessPool.red.length}챔 제한)
            </span>
          )}
        </div>
      )}

      {/* 상단: 팀 표시 */}
      <div className="draft-header">
        <div className="draft-team-header draft-team-header--blue">
          <span className="draft-team-side">블루</span>
          <span className="draft-team-name">{homeTeam?.shortName ?? '블루팀'}</span>
          {isUserBlue && <span className="draft-user-badge">YOU</span>}
        </div>
        <div className="draft-vs-text">VS</div>
        <div className="draft-team-header draft-team-header--red">
          <span className="draft-team-side">레드</span>
          <span className="draft-team-name">{awayTeam?.shortName ?? '레드팀'}</span>
          {!isUserBlue && <span className="draft-user-badge">YOU</span>}
        </div>
      </div>

      {/* 밴 목록 */}
      <BanSection
        blueBans={draft.blue.bans}
        redBans={draft.red.bans}
        championDb={CHAMPION_DB}
      />

      {/* 픽 목록 */}
      <div className="draft-pick-section">
        <PickSection
          picks={draft.blue.picks}
          color="#3498db"
          championDb={CHAMPION_DB}
        />

        {/* 중앙: 현재 상태 */}
        <DraftCenterPanel
          draft={draft}
          isAiTurn={isAiTurn}
          currentIsUser={currentIsUser}
          selectedChampion={selectedChampion}
          selectedPosition={selectedPosition}
          recommendations={recommendations}
          championDb={CHAMPION_DB}
          onSelectChampion={setSelectedChampion}
          onSelectPosition={setSelectedPosition}
          onConfirm={handleConfirm}
        />

        <PickSection
          picks={draft.red.picks}
          color="#e74c3c"
          championDb={CHAMPION_DB}
        />
      </div>

      {/* 챔피언 목록 (유저 턴에만 표시) */}
      {currentIsUser && !draft.isComplete && (
        <ChampionGrid
          filteredChampions={filteredChampions}
          selectedChampion={selectedChampion}
          filterPosition={filterPosition}
          fearlessDisabledIds={fearlessDisabledIds}
          onSelectChampion={setSelectedChampion}
          onFilterChange={setFilterPosition}
        />
      )}

      {/* AI 코치 조언 (유저 턴에만 표시) */}
      {currentIsUser && !draft.isComplete && draft.phase !== 'swap' && (
        <div className="draft-ai-advice">
          <span className="draft-ai-advice-label">AI 코치 조언</span>
          {aiAdviceLoading ? (
            <span className="draft-ai-advice-loading">분석 중...</span>
          ) : aiAdvice ? (
            <div className="draft-ai-advice-content">
              <span className="draft-ai-advice-suggestion">{aiAdvice.suggestion}</span>
              <span className="draft-ai-advice-reason">{aiAdvice.reason}</span>
              <span className="draft-ai-advice-confidence">신뢰도: {aiAdvice.confidence}%</span>
            </div>
          ) : (
            <span className="draft-ai-advice-loading">조언을 불러올 수 없습니다.</span>
          )}
        </div>
      )}

      {/* 챔피언 스왑 단계 */}
      {draft.phase === 'swap' && mode === 'manager' && (
        <div className="draft-swap-phase">
          <h3 className="draft-swap-title">챔피언 스왑</h3>
          <p className="draft-swap-desc">두 챔피언을 클릭하여 교환하세요. 완료 후 경기 시작 버튼을 누르세요.</p>
          <div className="draft-swap-picks">
            {(userSide === 'blue' ? draft.blue : draft.red).picks.map((pick, idx) => {
              const champ = CHAMPION_DB.find(c => c.id === pick.championId);
              return (
                <button
                  key={idx}
                  className={`draft-swap-card ${swapSelection === idx ? 'draft-swap-card--selected' : ''}`}
                  onClick={() => handleSwap(idx)}
                >
                  <span className="draft-swap-pos">{pick.position.toUpperCase()}</span>
                  <span className="draft-swap-champ">{champ?.name ?? pick.championId}</span>
                </button>
              );
            })}
          </div>
          <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={handleFinalizeDraft}>
            경기 시작
          </button>
        </div>
      )}
    </div>
  );
}
