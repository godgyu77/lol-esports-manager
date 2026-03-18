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
import {
  createDraftState,
  executeDraftAction,
  isChampionAvailable,
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

export function DraftView() {
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
  }, [draft?.currentStep, draft?.currentSide, userSide, blueInfo, redInfo]);

  // 밴픽 완료 시
  useEffect(() => {
    if (draft?.isComplete) {
      setDraftResult(draft);
      const timer = setTimeout(() => {
        setDayPhase('live_match');
        navigate(`${basePath}/match`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [draft?.isComplete, navigate, setDayPhase, setDraftResult]);

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
  }, [draft?.currentStep, draft?.currentSide, userSide, blueInfo, redInfo, isUserBlue]);

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

    // 피어리스로 인해 사용 불가한 챔피언 ID 수집
    const disabled = new Set<string>();
    if (draft.fearlessMode) {
      for (const id of draft.fearlessPool.blue) disabled.add(id);
      for (const id of draft.fearlessPool.red) disabled.add(id);
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
    return <p style={{ color: '#6a6a7a' }}>밴픽 데이터 로딩 중...</p>;
  }

  const currentIsUser = mode === 'manager' && draft.currentSide === userSide;

  return (
    <div style={styles.container}>
      {/* 피어리스 드래프트 표시 */}
      {draft.fearlessMode && (
        <div style={styles.fearlessBanner}>
          FEARLESS DRAFT — 이전 세트에서 사용한 챔피언 재사용 불가
          {(fearlessPool.blue.length > 0 || fearlessPool.red.length > 0) && (
            <span style={styles.fearlessCount}>
              (블루 {fearlessPool.blue.length}챔 / 레드 {fearlessPool.red.length}챔 제한)
            </span>
          )}
        </div>
      )}

      {/* 상단: 팀 표시 */}
      <div style={styles.header}>
        <div style={{ ...styles.teamHeader, borderColor: '#3498db' }}>
          <span style={styles.teamSide}>블루</span>
          <span style={styles.teamName}>{homeTeam?.shortName ?? '블루팀'}</span>
          {isUserBlue && <span style={styles.userBadge}>YOU</span>}
        </div>
        <div style={styles.vsText}>VS</div>
        <div style={{ ...styles.teamHeader, borderColor: '#e74c3c' }}>
          <span style={styles.teamSide}>레드</span>
          <span style={styles.teamName}>{awayTeam?.shortName ?? '레드팀'}</span>
          {!isUserBlue && <span style={styles.userBadge}>YOU</span>}
        </div>
      </div>

      {/* 밴 목록 */}
      <BanSection
        blueBans={draft.blue.bans}
        redBans={draft.red.bans}
        championDb={CHAMPION_DB}
      />

      {/* 픽 목록 */}
      <div style={styles.pickSection}>
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
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
  },
  fearlessBanner: {
    textAlign: 'center' as const,
    padding: '8px 16px',
    marginBottom: '16px',
    background: 'linear-gradient(90deg, rgba(200,155,60,0.15), rgba(200,155,60,0.05))',
    border: '1px solid rgba(200,155,60,0.4)',
    borderRadius: '6px',
    color: '#c89b3c',
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '1px',
  },
  fearlessCount: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 400,
    color: '#8a8a9a',
    marginTop: '2px',
  },
  header: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '32px',
    marginBottom: '24px',
  },
  teamHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 20px',
    borderBottom: '3px solid',
    borderRadius: '8px 8px 0 0',
    background: 'rgba(255,255,255,0.03)',
  },
  teamSide: {
    fontSize: '12px',
    color: '#6a6a7a',
  },
  teamName: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#f0e6d2',
  },
  userBadge: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#c89b3c',
    background: 'rgba(200,155,60,0.15)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  vsText: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#3a3a5c',
  },
  pickSection: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
  },
};
