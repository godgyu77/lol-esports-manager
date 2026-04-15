/**
 * 전술 관리 페이지
 * - 초반/중반/후반 운영 전략 선택
 * - 시야 운용과 오브젝트 우선순위 조정
 * - 현재 전술 보정 효과 미리보기
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateTacticalSuggestion, type TacticalSuggestion } from '../../../ai/advancedAiService';
import { applyCoachTacticsRecommendation, generateInitialCoachRecommendations } from '../../../engine/manager/managerSetupEngine';
import { getPrepRecommendationRecords, recordPrepRecommendation } from '../../../engine/manager/systemDepthEngine';
import {
  calculateTacticsBonus,
  createDefaultTactics,
  getTeamTactics,
  setTeamTactics,
} from '../../../engine/tactics/tacticsEngine';
import { useGameStore } from '../../../stores/gameStore';
import type { CoachSetupRecommendation } from '../../../types/managerSetup';
import type { PrepRecommendationRecord } from '../../../types/systemDepth';
import type {
  EarlyStrategy,
  LateStrategy,
  MidStrategy,
  TeamTactics,
  WardPriority,
} from '../../../types/tactics';
import {
  EARLY_STRATEGY_LABELS,
  LATE_STRATEGY_LABELS,
  MID_STRATEGY_LABELS,
  WARD_PRIORITY_LABELS,
} from '../../../types/tactics';
import { MainLoopPanel } from '../components/MainLoopPanel';

const EARLY_STRATEGIES: EarlyStrategy[] = ['standard', 'lane_swap', 'invade', 'safe_farm'];
const MID_STRATEGIES: MidStrategy[] = ['balanced', 'pick_comp', 'split_push', 'objective_control'];
const LATE_STRATEGIES: LateStrategy[] = ['teamfight', 'split_push', 'siege', 'pick'];
const WARD_PRIORITIES: WardPriority[] = ['aggressive', 'balanced', 'defensive'];

function getPrepOutcomeTone(record: PrepRecommendationRecord | null): 'success' | 'info' | 'danger' {
  if (!record) return 'info';
  if (record.observedOutcome === 'positive') return 'success';
  if (record.status === 'observed') return 'danger';
  return 'info';
}

function getTacticsSeasonDirection(prepRecords: PrepRecommendationRecord[]): {
  label: string;
  detail: string;
  tone: 'accent' | 'success' | 'danger';
} {
  const positiveCount = prepRecords.filter((record) => record.observedOutcome === 'positive').length;
  const negativeCount = prepRecords.filter((record) => record.observedOutcome === 'negative').length;
  const pendingCount = prepRecords.filter((record) => record.status === 'applied').length;

  if (negativeCount > positiveCount) {
    return {
      label: '재정렬 필요',
      detail: `최근 전술 검증 실패 ${negativeCount}회가 누적돼 시즌 운영 방향을 다시 점검해야 합니다.`,
      tone: 'danger',
    };
  }

  if (positiveCount > 0) {
    return {
      label: '검증된 방향',
      detail: `긍정 검증 ${positiveCount}회로 현재 전술 축이 시즌 운영에 안정적으로 쌓이고 있습니다.`,
      tone: 'success',
    };
  }

  return {
    label: pendingCount > 0 ? '검증 진행 중' : '축적 중',
    detail: pendingCount > 0
      ? `아직 ${pendingCount}개의 전술 조정이 다음 경기 결과를 기다리고 있습니다.`
      : '시즌 누적 전술 데이터가 아직 충분히 쌓이지 않았습니다.',
    tone: 'accent',
  };
}

export function TacticsView() {
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);
  const pendingMatch = useGameStore((s) => s.pendingUserMatch);
  const navigate = useNavigate();

  const [tactics, setTacticsState] = useState<TeamTactics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<TacticalSuggestion | null>(null);
  const [aiSuggestionLoading, setAiSuggestionLoading] = useState(false);
  const [coachRecommendation, setCoachRecommendation] = useState<CoachSetupRecommendation | null>(null);
  const [prepRecords, setPrepRecords] = useState<PrepRecommendationRecord[]>([]);

  const userTeamId = save?.userTeamId ?? '';

  const loadData = useCallback(async () => {
    if (!save) return;
    setIsLoading(true);
    try {
      const [data, setupRecommendations, recentPrep] = await Promise.all([
        getTeamTactics(userTeamId),
        generateInitialCoachRecommendations(userTeamId, save.currentSeasonId).catch(() => []),
        getPrepRecommendationRecords(userTeamId, save.currentSeasonId, 3).catch(() => []),
      ]);
      setTacticsState(data ?? createDefaultTactics(userTeamId));
      setCoachRecommendation(
        setupRecommendations.find((recommendation) => recommendation.kind === 'tactics') ?? null,
      );
      setPrepRecords(recentPrep.filter((record) => record.focusArea === 'tactics'));
    } catch (err) {
      console.error('전술 데이터 로딩 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, [save, userTeamId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleChange = async <K extends keyof Omit<TeamTactics, 'teamId'>>(
    field: K,
    value: TeamTactics[K],
  ) => {
    if (!tactics) return;

    const updated: TeamTactics = { ...tactics, [field]: value };
    setTacticsState(updated);

    try {
      const { teamId: _teamId, ...rest } = updated;
      await setTeamTactics(userTeamId, rest);
      setMessage({ text: '전술을 변경했습니다.', type: 'success' });
    } catch (err) {
      console.error('전술 저장 실패:', err);
      setMessage({ text: '전술 저장에 실패했습니다.', type: 'error' });
    }
  };

  const handleAiCoach = async () => {
    if (aiSuggestionLoading) return;
    setAiSuggestionLoading(true);
    setAiSuggestion(null);

    const userTeam = teams.find((team) => team.id === userTeamId);
    const opponentTeam = pendingMatch
      ? teams.find((team) => team.id === (
        pendingMatch.teamHomeId === userTeamId ? pendingMatch.teamAwayId : pendingMatch.teamHomeId
      ))
      : null;

    try {
      const result = await generateTacticalSuggestion({
        teamName: userTeam?.shortName ?? '우리 팀',
        opponentName: opponentTeam?.shortName ?? '다음 상대',
        currentTactics: tactics
          ? `초반: ${EARLY_STRATEGY_LABELS[tactics.earlyStrategy]}, 중반: ${MID_STRATEGY_LABELS[tactics.midStrategy]}, 후반: ${LATE_STRATEGY_LABELS[tactics.lateStrategy]}`
          : undefined,
        teamStrength: tactics
          ? `공격성 ${tactics.aggressionLevel}/10, 드래곤 우선 ${tactics.dragonPriority}/10, 바론 우선 ${tactics.baronPriority}/10`
          : '데이터 부족',
      });
      setAiSuggestion(result);
    } catch {
      // AI 제안 실패는 조용히 무시한다.
    } finally {
      setAiSuggestionLoading(false);
    }
  };

  if (!save) return <p className="fm-text-muted">데이터를 불러오는 중...</p>;
  if (isLoading) return <p className="fm-text-muted">전술 정보를 불러오는 중...</p>;
  if (!tactics) return <p className="fm-text-muted">전술 데이터를 찾을 수 없습니다.</p>;

  const bonus = calculateTacticsBonus(tactics);
  const nextOpponent = pendingMatch
    ? teams.find((team) => team.id === (
      pendingMatch.teamHomeId === userTeamId ? pendingMatch.teamAwayId : pendingMatch.teamHomeId
    ))?.name ?? '상대 팀 미정'
    : null;
  const latestPrepRecord = prepRecords[0] ?? null;
  const tacticsSeasonDirection = getTacticsSeasonDirection(prepRecords);
  const observedPrepCount = prepRecords.filter((record) => record.status === 'observed').length;
  const primaryLoopRoute = pendingMatch ? '/manager/pre-match' : '/manager/day';
  const primaryLoopLabel = pendingMatch ? '경기 준비로 복귀' : 'DayView로 돌아가기';

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">전술 관리</h1>
        <button
          className="fm-btn fm-btn--primary"
          onClick={handleAiCoach}
          disabled={aiSuggestionLoading}
        >
          {aiSuggestionLoading ? '분석 중...' : 'AI 코치'}
        </button>
      </div>

      {(aiSuggestion || coachRecommendation || latestPrepRecord) ? (
        <details className="fm-disclosure fm-mb-md">
          <summary>전술 브리핑 보기</summary>
          <div className="fm-disclosure__body">
      {aiSuggestion && (
        <div className="fm-alert fm-alert--info fm-flex-col fm-gap-xs fm-mb-md" style={{ alignItems: 'flex-start' }}>
          <span className="fm-text-xs fm-font-bold fm-text-accent">AI 코치 조언</span>
          <span className="fm-text-md fm-font-semibold fm-text-primary">{aiSuggestion.suggestion}</span>
          <span className="fm-text-xs fm-text-secondary">{aiSuggestion.reason}</span>
          <span className="fm-text-xs fm-font-semibold fm-text-success">예상 효과: {aiSuggestion.expectedEffect}</span>
          <button
            className="fm-btn fm-btn--primary fm-btn--sm fm-mt-sm"
            onClick={async () => {
              if (!tactics) return;

              const suggestion = aiSuggestion.suggestion;
              const updated = { ...tactics };

              if (suggestion.includes('공격') || suggestion.includes('초반 압박')) {
                updated.earlyStrategy = 'invade';
                updated.aggressionLevel = Math.min(10, (updated.aggressionLevel ?? 5) + 2);
              } else if (suggestion.includes('스플릿')) {
                updated.midStrategy = 'split_push';
                updated.lateStrategy = 'split_push';
              } else if (
                suggestion.includes('오브젝트')
                || suggestion.includes('드래곤')
                || suggestion.includes('바론')
              ) {
                updated.midStrategy = 'objective_control';
              } else if (
                suggestion.includes('후반')
                || suggestion.includes('안정')
                || suggestion.includes('수비')
              ) {
                updated.earlyStrategy = 'safe_farm';
                updated.lateStrategy = 'teamfight';
              } else if (suggestion.includes('비전') || suggestion.includes('시야')) {
                updated.wardPriority = 'aggressive';
              } else if (suggestion.includes('로밍')) {
                updated.midStrategy = 'pick_comp';
              }

              setTacticsState(updated);

              try {
                const { teamId: _teamId, ...rest } = updated;
                await setTeamTactics(userTeamId, rest);
                await recordPrepRecommendation({
                  teamId: userTeamId,
                  seasonId: save.currentSeasonId,
                  source: 'opponent_analysis',
                  focusArea: 'tactics',
                  title: 'AI 전술 조정',
                  summary: aiSuggestion.reason,
                  recommendedChanges: [aiSuggestion.suggestion, aiSuggestion.expectedEffect],
                  appliedChanges: [
                    `초반: ${EARLY_STRATEGY_LABELS[updated.earlyStrategy]}`,
                    `중반: ${MID_STRATEGY_LABELS[updated.midStrategy]}`,
                    `후반: ${LATE_STRATEGY_LABELS[updated.lateStrategy]}`,
                  ],
                  targetMatchId: pendingMatch?.id ?? null,
                  targetDate: pendingMatch?.matchDate ?? season?.currentDate ?? null,
                  gameDate: season?.currentDate ?? pendingMatch?.matchDate ?? '2000-01-01',
                });
                setMessage({ text: 'AI 추천 전술을 적용했습니다.', type: 'success' });
              } catch {
                setMessage({ text: '전술 적용에 실패했습니다.', type: 'error' });
              }

              setAiSuggestion(null);
            }}
          >
            추천 적용
          </button>
        </div>
      )}

      {coachRecommendation && (
        <div className="fm-alert fm-alert--info fm-flex-col fm-gap-xs fm-mb-md" style={{ alignItems: 'flex-start' }}>
          <div className="fm-flex fm-items-center fm-gap-xs">
            <span className="fm-text-xs fm-font-bold fm-text-accent">코치 브리핑</span>
            <span className="fm-text-xs fm-text-secondary">{coachRecommendation.authorName}</span>
          </div>
          <span className="fm-text-md fm-font-semibold fm-text-primary">{coachRecommendation.headline}</span>
          <span className="fm-text-xs fm-text-secondary">{coachRecommendation.summary}</span>
          <ul className="fm-text-xs fm-text-secondary" style={{ margin: 0, paddingLeft: 18 }}>
            {coachRecommendation.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <button
            className="fm-btn fm-btn--primary fm-btn--sm"
            onClick={async () => {
              try {
                await applyCoachTacticsRecommendation(userTeamId, coachRecommendation);
                await recordPrepRecommendation({
                  teamId: userTeamId,
                  seasonId: save.currentSeasonId,
                  source: 'coach_briefing',
                  focusArea: 'tactics',
                  title: coachRecommendation.headline,
                  summary: coachRecommendation.summary,
                  recommendedChanges: coachRecommendation.reasons,
                  appliedChanges: coachRecommendation.reasons,
                  targetMatchId: pendingMatch?.id ?? null,
                  targetDate: pendingMatch?.matchDate ?? season?.currentDate ?? null,
                  gameDate: season?.currentDate ?? pendingMatch?.matchDate ?? '2000-01-01',
                });
                const refreshed = await getTeamTactics(userTeamId);
                setTacticsState(refreshed ?? createDefaultTactics(userTeamId));
                setMessage({ text: '코치 추천 전술을 적용했습니다.', type: 'success' });
              } catch (error) {
                console.error('코치 전술 추천 적용 실패:', error);
                setMessage({ text: '코치 추천 전술 적용에 실패했습니다.', type: 'error' });
              }
            }}
          >
            전술 추천 적용
          </button>
        </div>
      )}

      {latestPrepRecord && (
        <div className={`fm-alert fm-alert--${getPrepOutcomeTone(latestPrepRecord)} fm-mb-md`} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
          <div className="fm-flex fm-items-center fm-justify-between" style={{ width: '100%' }}>
            <span className="fm-text-sm fm-font-semibold">준비 추적</span>
            <span className="fm-badge fm-badge--default">{latestPrepRecord.status}</span>
          </div>
          <span className="fm-text-md fm-font-semibold fm-text-primary">{latestPrepRecord.title}</span>
          <p className="fm-text-xs fm-text-secondary" style={{ margin: 0 }}>
            {latestPrepRecord.impactSummary ?? latestPrepRecord.summary}
          </p>
          <div className="fm-flex fm-gap-xs fm-flex-wrap">
            {latestPrepRecord.appliedChanges.slice(0, 3).map((change) => (
              <span key={change} className="fm-badge fm-badge--info">{change}</span>
            ))}
          </div>
        </div>
      )}
          </div>
        </details>
      ) : null}

      {message && (
        <div className={`fm-alert ${message.type === 'success' ? 'fm-alert--success' : 'fm-alert--danger'} fm-mb-md`}>
          <span className="fm-alert__text">{message.text}</span>
        </div>
      )}

      <MainLoopPanel
        eyebrow="전술 루프"
        title="전술 조정을 다음 경기 준비 흐름 안에서 바로 읽히게 정리했습니다"
        subtitle="세부 수치를 보기 전에, 지금 전술이 무엇을 밀고 있고 어떤 리스크를 안고 있는지 먼저 파악할 수 있게 상단 요약을 추가했습니다."
        insights={[
          {
            label: '오늘의 핵심 전술',
            value: `${EARLY_STRATEGY_LABELS[tactics.earlyStrategy]} / ${MID_STRATEGY_LABELS[tactics.midStrategy]}`,
            detail: `후반 운영은 ${LATE_STRATEGY_LABELS[tactics.lateStrategy]}, 시야 우선순위는 ${WARD_PRIORITY_LABELS[tactics.wardPriority]}입니다.`,
            tone: 'accent',
          },
          {
            label: '가장 큰 리스크',
            value: coachRecommendation ? '코치 피드백' : aiSuggestion ? 'AI 제안' : '안정',
            detail: coachRecommendation?.summary ?? aiSuggestion?.reason ?? '즉시 수정이 필요한 전술 리스크는 아직 크게 보이지 않습니다.',
            tone: coachRecommendation || aiSuggestion ? 'danger' : 'success',
          },
          {
            label: '다음 경기',
            value: pendingMatch ? `${pendingMatch.matchDate ?? '일정'} vs ${nextOpponent}` : '경기 일정 대기',
            detail: pendingMatch
              ? '밴픽과 오브젝트 우선순위를 미리 맞추면 경기 판단도 훨씬 빨라집니다.'
              : '경기 일정이 가까워지면 여기서 정한 방향이 DayView와 프리매치 준비로 바로 연결됩니다.',
            tone: 'accent',
          },
          {
            label: '코치 조언',
            value: coachRecommendation?.authorName ?? (aiSuggestion ? 'AI 코치' : '준비 완료'),
            detail: coachRecommendation?.headline ?? aiSuggestion?.suggestion ?? '현재 전술 보정치는 운영 축이 안정권입니다. 다음 상대가 잡히면 세부 조정을 이어가면 됩니다.',
            tone: 'success',
          },
        ]}
        actions={[
          { label: primaryLoopLabel, onClick: () => navigate(primaryLoopRoute), variant: 'primary' },
          { label: '훈련 조정', onClick: () => navigate('/manager/training') },
          { label: 'AI 코치 다시 받기', onClick: () => void handleAiCoach(), variant: 'info', disabled: aiSuggestionLoading },
        ]}
        note={`현재 전술 보정치는 공격 ${bonus.offense}, 수비 ${bonus.defense}, 운영 ${bonus.objective}입니다.`}
      />

      <div className="fm-grid fm-grid--3 fm-mb-md" data-testid="tactics-season-strip">
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">시즌 전술 방향</span>
            <span className={`fm-stat__value ${
              tacticsSeasonDirection.tone === 'danger'
                ? 'fm-text-danger'
                : tacticsSeasonDirection.tone === 'success'
                  ? 'fm-text-success'
                  : 'fm-text-accent'
            }`}
            >
              {tacticsSeasonDirection.label}
            </span>
          </div>
          <p className="fm-text-xs fm-text-secondary fm-mt-xs" style={{ marginBottom: 0 }}>
            {tacticsSeasonDirection.detail}
          </p>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">누적 준비 검증</span>
            <span className="fm-stat__value">{observedPrepCount > 0 ? `${observedPrepCount}회` : '대기'}</span>
          </div>
          <p className="fm-text-xs fm-text-secondary fm-mt-xs" style={{ marginBottom: 0 }}>
            전술 조정이 실제 경기 흐름과 얼마나 맞았는지 시즌 단위로 추적합니다.
          </p>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">현재 운영 보정</span>
            <span className="fm-stat__value fm-text-accent">{`공 ${bonus.offense} / 수 ${bonus.defense} / 운영 ${bonus.objective}`}</span>
          </div>
          <p className="fm-text-xs fm-text-secondary fm-mt-xs" style={{ marginBottom: 0 }}>
            지금 선택한 전략이 시즌 누적 방향과 어긋나지 않는지 함께 확인합니다.
          </p>
        </div>
      </div>

      <div className="fm-panel fm-mb-lg">
        <div className="fm-panel__header">
          <span className="fm-panel__title">게임 페이즈별 전략</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--auto">
            <div className="fm-card">
              <label className="fm-text-base fm-font-semibold fm-text-primary fm-mb-sm" style={{ display: 'block' }}>
                초반 전략
              </label>
              <p className="fm-text-xs fm-text-muted fm-mb-sm" style={{ marginTop: 0 }}>
                라인전부터 첫 오브젝트까지의 운영 기조를 정합니다.
              </p>
              <select
                className="fm-select"
                style={{ width: '100%' }}
                value={tactics.earlyStrategy}
                onChange={e => handleChange('earlyStrategy', e.target.value as EarlyStrategy)}
              >
                {EARLY_STRATEGIES.map((strategy) => (
                  <option key={strategy} value={strategy}>{EARLY_STRATEGY_LABELS[strategy]}</option>
                ))}
              </select>
            </div>

            <div className="fm-card">
              <label className="fm-text-base fm-font-semibold fm-text-primary fm-mb-sm" style={{ display: 'block' }}>
                중반 전략
              </label>
              <p className="fm-text-xs fm-text-muted fm-mb-sm" style={{ marginTop: 0 }}>
                오브젝트 교환과 시야 압박 구간의 운영 성향을 조정합니다.
              </p>
              <select
                className="fm-select"
                style={{ width: '100%' }}
                value={tactics.midStrategy}
                onChange={e => handleChange('midStrategy', e.target.value as MidStrategy)}
              >
                {MID_STRATEGIES.map((strategy) => (
                  <option key={strategy} value={strategy}>{MID_STRATEGY_LABELS[strategy]}</option>
                ))}
              </select>
            </div>

            <div className="fm-card">
              <label className="fm-text-base fm-font-semibold fm-text-primary fm-mb-sm" style={{ display: 'block' }}>
                후반 전략
              </label>
              <p className="fm-text-xs fm-text-muted fm-mb-sm" style={{ marginTop: 0 }}>
                바론 이후 한타와 마무리 단계의 집중 방향을 정합니다.
              </p>
              <select
                className="fm-select"
                style={{ width: '100%' }}
                value={tactics.lateStrategy}
                onChange={e => handleChange('lateStrategy', e.target.value as LateStrategy)}
              >
                {LATE_STRATEGIES.map((strategy) => (
                  <option key={strategy} value={strategy}>{LATE_STRATEGY_LABELS[strategy]}</option>
                ))}
              </select>
            </div>

            <div className="fm-card">
              <label className="fm-text-base fm-font-semibold fm-text-primary fm-mb-sm" style={{ display: 'block' }}>
                시야 운용
              </label>
              <p className="fm-text-xs fm-text-muted fm-mb-sm" style={{ marginTop: 0 }}>
                와드 투자와 맵 장악 우선순위를 조절합니다.
              </p>
              <select
                className="fm-select"
                style={{ width: '100%' }}
                value={tactics.wardPriority}
                onChange={e => handleChange('wardPriority', e.target.value as WardPriority)}
              >
                {WARD_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>{WARD_PRIORITY_LABELS[priority]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="fm-panel fm-mb-lg">
        <div className="fm-panel__header">
          <span className="fm-panel__title">세부 수치 조정</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-flex-col fm-gap-md">
            <div className="fm-card">
              <div className="fm-flex fm-items-center fm-justify-between fm-mb-sm">
                <label className="fm-text-base fm-font-semibold fm-text-primary">드래곤 우선순위</label>
                <span className="fm-text-xl fm-font-bold fm-text-accent">{tactics.dragonPriority}</span>
              </div>
              <div className="fm-flex fm-items-center fm-gap-sm">
                <span className="fm-text-sm fm-text-muted" style={{ minWidth: '40px' }}>낮음</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={tactics.dragonPriority}
                  onChange={e => handleChange('dragonPriority', Number(e.target.value))}
                  style={{ flex: 1, height: '6px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
                <span className="fm-text-sm fm-text-muted" style={{ minWidth: '40px' }}>높음</span>
              </div>
            </div>

            <div className="fm-card">
              <div className="fm-flex fm-items-center fm-justify-between fm-mb-sm">
                <label className="fm-text-base fm-font-semibold fm-text-primary">바론 우선순위</label>
                <span className="fm-text-xl fm-font-bold fm-text-accent">{tactics.baronPriority}</span>
              </div>
              <div className="fm-flex fm-items-center fm-gap-sm">
                <span className="fm-text-sm fm-text-muted" style={{ minWidth: '40px' }}>낮음</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={tactics.baronPriority}
                  onChange={e => handleChange('baronPriority', Number(e.target.value))}
                  style={{ flex: 1, height: '6px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
                <span className="fm-text-sm fm-text-muted" style={{ minWidth: '40px' }}>높음</span>
              </div>
            </div>

            <div className="fm-card">
              <div className="fm-flex fm-items-center fm-justify-between fm-mb-sm">
                <label className="fm-text-base fm-font-semibold fm-text-primary">공격성 레벨</label>
                <span className="fm-text-xl fm-font-bold fm-text-accent">{tactics.aggressionLevel}</span>
              </div>
              <div className="fm-flex fm-items-center fm-gap-sm">
                <span className="fm-text-sm fm-text-muted" style={{ minWidth: '40px' }}>수비적</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={tactics.aggressionLevel}
                  onChange={e => handleChange('aggressionLevel', Number(e.target.value))}
                  style={{ flex: 1, height: '6px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
                <span className="fm-text-sm fm-text-muted" style={{ minWidth: '40px' }}>공격적</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <details className="fm-disclosure">
        <summary>전술 보정 효과 보기</summary>
        <div className="fm-disclosure__body">
          <p className="fm-text-xs fm-text-muted fm-mb-md">현재 전술 설정에 따른 경기 보정 수치입니다.</p>

          <div className="fm-grid fm-grid--auto fm-mb-md">
            <BonusCard label="초반 보정" value={bonus.earlyBonus} />
            <BonusCard label="중반 보정" value={bonus.midBonus} />
            <BonusCard label="후반 보정" value={bonus.lateBonus} />
            <BonusCard label="오브젝트 보정" value={bonus.objectiveBonus} />
          </div>

          <div className="fm-card">
            <h3 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-sm">전술 효과 설명</h3>
            <div className="fm-flex-col fm-gap-xs fm-text-xs fm-text-secondary">
              <div><strong style={{ color: '#4ecdc4' }}>초반 보정:</strong> 라인전과 초반 교전 승률에 영향</div>
              <div><strong style={{ color: 'var(--accent)' }}>중반 보정:</strong> 중반 운영과 로밍 효율에 영향</div>
              <div><strong style={{ color: '#9b59b6' }}>후반 보정:</strong> 후반 한타와 마무리 능력에 영향</div>
              <div><strong style={{ color: '#e67e22' }}>오브젝트 보정:</strong> 드래곤과 바론 장악력에 영향</div>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

function BonusCard({ label, value }: { label: string; value: number }) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  const displayValue = isNeutral ? '0%' : `${isPositive ? '+' : ''}${(value * 100).toFixed(1)}%`;
  const color = isNeutral ? 'var(--text-muted)' : isPositive ? 'var(--success)' : 'var(--danger)';

  return (
    <div className="fm-card fm-flex-col fm-items-center fm-gap-xs">
      <span className="fm-text-xs fm-text-muted fm-font-medium">{label}</span>
      <span className="fm-text-2xl fm-font-bold" style={{ color }}>{displayValue}</span>
    </div>
  );
}
