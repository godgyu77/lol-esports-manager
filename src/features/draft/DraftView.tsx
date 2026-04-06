import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { soundManager } from '../../audio/soundManager';
import { generateDraftAdvice, type DraftAdvice } from '../../ai/advancedAiService';
import { PlayerIdentityCard } from '../../components/PlayerIdentityCard';
import { CHAMPION_DB } from '../../data/championDb';
import { getPlayersByTeamId } from '../../db/queries';
import {
  aiSelectBan,
  aiSelectPick,
  buildDraftTeamInfo,
  createDraftState,
  executeDraftAction,
  finalizeDraft,
  getRecommendedBans,
  getRecommendedPicks,
  swapChampions,
  type DraftState,
  type DraftTeamInfo,
} from '../../engine/draft/draftEngine';
import { useBgm } from '../../hooks/useBgm';
import { useGameStore } from '../../stores/gameStore';
import { useMatchStore } from '../../stores/matchStore';
import type { Player } from '../../types/player';
import { BanSection } from './BanSection';
import { ChampionGrid } from './ChampionGrid';
import { DraftCenterPanel } from './DraftCenterPanel';
import { PickSection } from './PickSection';
import './draft.css';

const POSITION_LABELS: Record<'top' | 'jungle' | 'mid' | 'adc' | 'support', string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: '원딜',
  support: '서포터',
};

function getPlayerSwapStatus(player: Player | undefined): { label: string; tone: 'good' | 'warning' | 'danger' | 'neutral' } {
  if (!player) return { label: '정보 없음', tone: 'neutral' };
  if (player.mental.morale >= 75) return { label: '컨디션 좋음', tone: 'good' };
  if (player.mental.morale >= 55) return { label: '준비 완료', tone: 'neutral' };
  if (player.mental.morale >= 40) return { label: '집중 필요', tone: 'warning' };
  return { label: '폼 조정 필요', tone: 'danger' };
}

function buildSwapTags(player: Player | undefined, championId: string): string[] {
  if (!player) return [];

  const tags: string[] = [];
  const topPool = [...player.championPool]
    .sort((left, right) => right.proficiency - left.proficiency)
    .slice(0, 3);

  if (topPool.some((entry) => entry.championId === championId)) {
    tags.push('주력픽');
  } else {
    tags.push('전략픽');
  }

  if (player.playstyle === 'aggressive') tags.push('교전형');
  if (player.playstyle === 'supportive') tags.push('보조형');
  if (player.playstyle === 'versatile') tags.push('유연함');

  return tags;
}

function _buildSwapSummary(player: Player | undefined, championId: string): string {
  if (!player) return '선수 배치가 아직 확정되지 않았습니다.';

  const comfortPick = [...player.championPool]
    .sort((left, right) => right.proficiency - left.proficiency)
    .slice(0, 3)
    .some((entry) => entry.championId === championId);

  return comfortPick
    ? '주력 챔피언 계열이라 최종 배치 적합도가 높습니다.'
    : '숙련도는 충분하지만 마지막 교정이 필요할 수 있습니다.';
}

export function DraftView() {
  useBgm('draft');

  const navigate = useNavigate();
  const save = useGameStore((state) => state.save);
  const pendingMatch = useGameStore((state) => state.pendingUserMatch);
  const teams = useGameStore((state) => state.teams);
  const setDayPhase = useGameStore((state) => state.setDayPhase);
  const setDraftResult = useGameStore((state) => state.setDraftResult);
  const fearlessPool = useGameStore((state) => state.fearlessPool);
  const mode = useGameStore((state) => state.mode);
  const hardFearlessSeries = useMatchStore((state) => state.hardFearlessSeries);
  const currentGameNum = useMatchStore((state) => state.currentGameNum);
  const seriesFearlessPool = useMatchStore((state) => state.seriesFearlessPool);
  const setCurrentGameDraftRequired = useMatchStore((state) => state.setCurrentGameDraftRequired);
  const basePath = mode === 'player' ? '/player' : '/manager';

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [blueInfo, setBlueInfo] = useState<DraftTeamInfo | null>(null);
  const [redInfo, setRedInfo] = useState<DraftTeamInfo | null>(null);
  const [homeRoster, setHomeRoster] = useState<Player[]>([]);
  const [awayRoster, setAwayRoster] = useState<Player[]>([]);
  const [selectedChampion, setSelectedChampion] = useState<string | null>(null);
  const [isAiTurn, setIsAiTurn] = useState(false);
  const [filterPosition, setFilterPosition] = useState<'top' | 'jungle' | 'mid' | 'adc' | 'support' | 'all'>('all');
  const [aiAdvice, setAiAdvice] = useState<DraftAdvice | null>(null);
  const [aiAdviceLoading, setAiAdviceLoading] = useState(false);
  const [swapSelection, setSwapSelection] = useState<number | null>(null);

  const userTeamId = save?.userTeamId ?? '';
  const isUserBlue = pendingMatch?.teamHomeId === userTeamId;
  const userSide = isUserBlue ? 'blue' : 'red';
  const homeTeam = teams.find((team) => team.id === pendingMatch?.teamHomeId);
  const awayTeam = teams.find((team) => team.id === pendingMatch?.teamAwayId);

  useEffect(() => {
    if (!pendingMatch) return;

    const init = async () => {
      const [homePlayers, awayPlayers] = await Promise.all([
        getPlayersByTeamId(pendingMatch.teamHomeId),
        getPlayersByTeamId(pendingMatch.teamAwayId),
      ]);

      setHomeRoster(homePlayers);
      setAwayRoster(awayPlayers);
      setBlueInfo(buildDraftTeamInfo(homePlayers));
      setRedInfo(buildDraftTeamInfo(awayPlayers));

      const isSeriesDraft = pendingMatch.boFormat !== 'Bo1';
      const isFearless =
        hardFearlessSeries ||
        pendingMatch.hardFearlessSeries === true ||
        pendingMatch.fearlessDraft === true ||
        isSeriesDraft;
      const pool = currentGameNum > 1 ? seriesFearlessPool : fearlessPool;
      setDraft(createDraftState(isFearless, isFearless ? pool : undefined));
      setSelectedChampion(null);
      setSwapSelection(null);
    };

    void init();
  }, [currentGameNum, fearlessPool, hardFearlessSeries, pendingMatch, seriesFearlessPool]);

  useEffect(() => {
    if (!draft || !blueInfo || !redInfo || draft.isComplete) return;

    const currentIsUserTurn = mode === 'manager' && draft.currentSide === userSide;
    if (currentIsUserTurn) return;

    const thinkingTimer = setTimeout(() => {
      setIsAiTurn(true);
    }, 0);
    const timer = setTimeout(async () => {
      const nextDraft = structuredClone(draft);
      if (draft.currentActionType === 'ban') {
        const opponentInfo = draft.currentSide === 'blue' ? redInfo : blueInfo;
        const championId = await aiSelectBan(nextDraft, opponentInfo, CHAMPION_DB);
        executeDraftAction(nextDraft, championId);
      } else {
        const teamInfo = draft.currentSide === 'blue' ? blueInfo : redInfo;
        const { championId } = await aiSelectPick(nextDraft, draft.currentSide, teamInfo, CHAMPION_DB);
        executeDraftAction(nextDraft, championId);
      }
      setDraft(nextDraft);
      setIsAiTurn(false);
    }, 900);

    return () => {
      clearTimeout(thinkingTimer);
      clearTimeout(timer);
    };
  }, [blueInfo, draft, mode, redInfo, userSide]);

  const recommendations = useMemo(() => {
    if (!draft || !blueInfo || !redInfo || draft.isComplete || draft.currentSide !== userSide) return [];

    if (draft.currentActionType === 'ban') {
      const opponentInfo = isUserBlue ? redInfo : blueInfo;
      return getRecommendedBans(draft, opponentInfo, CHAMPION_DB).map((item) => ({
        championId: item.championId,
        reason: item.reason,
      }));
    }

    const teamInfo = isUserBlue ? blueInfo : redInfo;
    return getRecommendedPicks(draft, userSide, teamInfo, CHAMPION_DB).map((item) => ({
      championId: item.championId,
      reason: item.reason,
    }));
  }, [blueInfo, draft, isUserBlue, redInfo, userSide]);

  useEffect(() => {
    if (!draft || draft.isComplete) return;

    const currentIsUserTurn = mode === 'manager' && draft.currentSide === userSide;
    if (!currentIsUserTurn) return;

    const loadingTimer = setTimeout(() => {
      setAiAdviceLoading(true);
      setAiAdvice(null);
    }, 0);

    const recommendedBans =
      draft.currentActionType === 'ban' && recommendations.length > 0
        ? recommendations.map((item) => item.championId ?? '').filter(Boolean)
        : undefined;

    generateDraftAdvice({
      phase: draft.currentActionType,
      turn: draft.currentStep,
      myTeam: isUserBlue ? (homeTeam?.shortName ?? '블루') : (awayTeam?.shortName ?? '레드'),
      opponentTeam: isUserBlue ? (awayTeam?.shortName ?? '레드') : (homeTeam?.shortName ?? '블루'),
      myBans: isUserBlue ? draft.blue.bans : draft.red.bans,
      opponentBans: isUserBlue ? draft.red.bans : draft.blue.bans,
      myPicks: (isUserBlue ? draft.blue.picks : draft.red.picks).map((pick) => pick.championId),
      opponentPicks: (isUserBlue ? draft.red.picks : draft.blue.picks).map((pick) => pick.championId),
      recommendedBans,
    })
      .then(setAiAdvice)
      .catch(() => {})
      .finally(() => setAiAdviceLoading(false));
    return () => clearTimeout(loadingTimer);
  }, [awayTeam?.shortName, draft, homeTeam?.shortName, isUserBlue, mode, recommendations, userSide]);

  useEffect(() => {
    if (!draft?.isComplete) return;

    setDraftResult(draft);
    setCurrentGameDraftRequired(false);

    const timer = setTimeout(() => {
      setDayPhase('live_match');
      navigate(`${basePath}/match`);
    }, 1400);

    return () => clearTimeout(timer);
  }, [basePath, draft, navigate, setCurrentGameDraftRequired, setDayPhase, setDraftResult]);

  const handleSwapCard = useCallback((index: number) => {
    if (!draft || draft.phase !== 'swap') return;

    if (swapSelection === null) {
      setSwapSelection(index);
      return;
    }

    if (swapSelection !== index) {
      const nextDraft = structuredClone(draft);
      swapChampions(nextDraft, userSide, swapSelection, index);
      setDraft(nextDraft);
    }

    setSwapSelection(null);
  }, [draft, swapSelection, userSide]);

  const handleFinalizeDraft = useCallback(() => {
    if (!draft) return;
    const nextDraft = structuredClone(draft);
    finalizeDraft(nextDraft);
    setDraft(nextDraft);
  }, [draft]);

  const handleConfirm = useCallback(() => {
    if (!draft || !selectedChampion) return;
    const nextDraft = structuredClone(draft);
    if (executeDraftAction(nextDraft, selectedChampion)) {
      soundManager.play('draft_pick');
      setDraft(nextDraft);
      setSelectedChampion(null);
    }
  }, [draft, selectedChampion]);

  const { filteredChampions, fearlessDisabledIds } = useMemo(() => {
    if (!draft) return { filteredChampions: [], fearlessDisabledIds: new Set<string>() };

    const disabled = new Set<string>();
    if (draft.fearlessMode && draft.currentSide) {
      const pool = draft.currentSide === 'blue' ? draft.fearlessPool.blue : draft.fearlessPool.red;
      pool.forEach((id) => disabled.add(id));
    }

    return {
      filteredChampions: CHAMPION_DB.filter((champion) => {
        if (draft.bannedChampions.includes(champion.id)) return false;
        if (draft.pickedChampions.includes(champion.id)) return false;
        if (filterPosition !== 'all' && champion.primaryRole !== filterPosition) return false;
        return true;
      }),
      fearlessDisabledIds: disabled,
    };
  }, [draft, filterPosition]);

  if (!pendingMatch || !draft) {
    return <p className="fm-text-muted fm-text-md">밴픽 화면을 준비하는 중입니다...</p>;
  }

  const currentIsUser = mode === 'manager' && draft.currentSide === userSide;
  const userTeamPicks = userSide === 'blue' ? draft.blue.picks : draft.red.picks;
  const userRoster = userSide === 'blue' ? homeRoster : awayRoster;

  return (
    <div className="draft-stage">
      <div className="draft-stage-backdrop" />
      <div className="draft-stage-shell">
        <header className="draft-stage-hero fm-card">
          <div>
            <span className="draft-stage-kicker">드래프트 룸</span>
            <h1 className="draft-stage-title">세트 {currentGameNum} 밴픽</h1>
            <p className="draft-stage-copy">
              포지션에 먼저 묶이지 않고 좋은 챔피언부터 선점한 뒤, 마지막 스왑에서 우리 선수에게 가장 어울리는 구도로 정리합니다.
            </p>
          </div>
          <div className="draft-stage-status">
            <div className="draft-stage-pill">
              <span>현재 단계</span>
              <strong>{draft.phase === 'swap' ? '최종 스왑' : draft.currentActionType === 'ban' ? '밴' : '픽'}</strong>
            </div>
            <div className="draft-stage-pill">
              <span>진행도</span>
              <strong>{Math.min(draft.currentStep + 1, 20)} / 20</strong>
            </div>
            <div className="draft-stage-pill">
              <span>입력 방식</span>
              <strong>{draft.phase === 'swap' ? '직접 재배치' : '자유 선픽'}</strong>
            </div>
          </div>
        </header>

        {draft.fearlessMode ? (
          <div className="draft-fearless-banner">
            하드 피어리스 드래프트: 이전 세트에 사용한 챔피언은 다음 세트에서 다시 쓸 수 없습니다.
            {(draft.fearlessPool.blue.length > 0 || draft.fearlessPool.red.length > 0) ? (
              <span className="draft-fearless-count">
                블루 {draft.fearlessPool.blue.length}명 제한 / 레드 {draft.fearlessPool.red.length}명 제한
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="draft-header">
          <div className="draft-team-header draft-team-header--blue">
            <span className="draft-team-side">BLUE</span>
            <span className="draft-team-name">{homeTeam?.shortName ?? '블루 팀'}</span>
            {isUserBlue ? <span className="draft-user-badge">내 팀</span> : null}
          </div>
          <div className="draft-vs-text">VS</div>
          <div className="draft-team-header draft-team-header--red">
            <span className="draft-team-side">RED</span>
            <span className="draft-team-name">{awayTeam?.shortName ?? '레드 팀'}</span>
            {!isUserBlue ? <span className="draft-user-badge">내 팀</span> : null}
          </div>
        </div>

        <div className="draft-main-grid">
          <section className="draft-board fm-card">
            <BanSection blueBans={draft.blue.bans} redBans={draft.red.bans} championDb={CHAMPION_DB} />
            <div className="draft-pick-section">
              <PickSection
                sideLabel="블루 라인업"
                picks={draft.blue.picks}
                color="#3b82f6"
                championDb={CHAMPION_DB}
                rosterPlayers={homeRoster}
              />
              <DraftCenterPanel
                draft={draft}
                isAiTurn={isAiTurn}
                currentIsUser={currentIsUser}
                selectedChampion={selectedChampion}
                recommendations={recommendations}
                championDb={CHAMPION_DB}
                onSelectChampion={setSelectedChampion}
                onConfirm={handleConfirm}
              />
              <PickSection
                sideLabel="레드 라인업"
                picks={draft.red.picks}
                color="#ef4444"
                championDb={CHAMPION_DB}
                rosterPlayers={awayRoster}
              />
            </div>
          </section>

          <aside className="draft-sidebar">
            {currentIsUser && !draft.isComplete && draft.phase !== 'swap' ? (
              <div className="draft-ai-advice fm-card">
                <span className="draft-ai-advice-label">AI 코치 브리핑</span>
                {aiAdviceLoading ? (
                  <span className="draft-ai-advice-loading">현재 밴픽 흐름을 분석하는 중입니다...</span>
                ) : currentIsUser && aiAdvice ? (
                  <div className="draft-ai-advice-content">
                    <span className="draft-ai-advice-suggestion">{aiAdvice.suggestion}</span>
                    <span className="draft-ai-advice-reason">{aiAdvice.reason}</span>
                    <span className="draft-ai-advice-confidence">신뢰도 {aiAdvice.confidence}%</span>
                  </div>
                ) : (
                  <span className="draft-ai-advice-loading">아직 추천 내용을 불러오지 못했습니다.</span>
                )}
              </div>
            ) : null}

            {draft.phase === 'swap' && mode === 'manager' ? (
              <div className="draft-swap-phase fm-card">
                <div className="draft-swap-header">
                  <span className="draft-swap-kicker">Final Setup</span>
                  <h3 className="draft-swap-title">선수 배치 스왑</h3>
                  <p className="draft-swap-desc">
                    같은 팀 카드에서 챔피언을 하나 누르고, 바꿀 다른 카드를 누르면 챔피언만 서로 맞바뀝니다. 포지션 슬롯은 그대로 유지됩니다.
                  </p>
                </div>

                <div className="fm-alert fm-alert--info" style={{ marginBottom: 12 }}>
                  <span className="fm-alert__text">주력 픽은 안정적이고 낯선 픽은 위험합니다. 최종 배치 전에 카드 상태를 한 번 더 확인하세요.</span>
                </div>

                <div className="draft-swap-picks">
                  {userTeamPicks.map((pick, index) => {
                    const champ = CHAMPION_DB.find((champion) => champion.id === pick.championId);
                    const player = userRoster.find((entry) => entry.position === pick.position);
                    const status = getPlayerSwapStatus(player);
                    return (
                      <button
                        key={pick.position}
                        className={`draft-swap-card ${swapSelection === index ? 'draft-swap-card--selected' : ''}`}
                        onClick={() => handleSwapCard(index)}
                      >
                        <PlayerIdentityCard
                          name={player?.name ?? '선수 미정'}
                          position={pick.position}
                          accentColor={userSide === 'blue' ? '#3b82f6' : '#ef4444'}
                          subtitle={champ?.nameKo ?? champ?.name ?? pick.championId}
                          tags={buildSwapTags(player, pick.championId)}
                          meta={swapSelection === index ? '이제 바꿀 다른 카드를 선택하세요' : `${POSITION_LABELS[pick.position]} 슬롯`}
                          statusLabel={swapSelection === index ? '선택됨' : status.label}
                          statusTone={swapSelection === index ? 'warning' : status.tone}
                          highlighted={swapSelection === index}
                        />
                      </button>
                    );
                  })}
                </div>

                <button className="draft-primary-action" onClick={handleFinalizeDraft}>
                  경기 시작 준비 완료
                </button>
              </div>
            ) : null}

            {currentIsUser && !draft.isComplete && draft.phase !== 'swap' ? (
              <ChampionGrid
                filteredChampions={filteredChampions}
                selectedChampion={selectedChampion}
                filterPosition={filterPosition}
                fearlessDisabledIds={fearlessDisabledIds}
                onSelectChampion={setSelectedChampion}
                onFilterChange={setFilterPosition}
              />
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
