/**
 * 전술 관리 페이지
 * - 초반/중반/후반 전략 선택
 * - 와드 우선도, 드래곤/바론 우선도, 공격성 레벨 슬라이더
 * - 현재 전술 보정 효과 미리보기
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../../stores/gameStore';
import {
  getTeamTactics,
  setTeamTactics,
  createDefaultTactics,
  calculateTacticsBonus,
} from '../../../engine/tactics/tacticsEngine';
import type {
  TeamTactics,
  EarlyStrategy,
  MidStrategy,
  LateStrategy,
  WardPriority,
} from '../../../types/tactics';
import {
  EARLY_STRATEGY_LABELS,
  MID_STRATEGY_LABELS,
  LATE_STRATEGY_LABELS,
  WARD_PRIORITY_LABELS,
} from '../../../types/tactics';
import { generateTacticalSuggestion, type TacticalSuggestion } from '../../../ai/advancedAiService';
import { applyCoachTacticsRecommendation, generateInitialCoachRecommendations } from '../../../engine/manager/managerSetupEngine';
import { getPrepRecommendationRecords, recordPrepRecommendation } from '../../../engine/manager/systemDepthEngine';
import type { CoachSetupRecommendation } from '../../../types/managerSetup';
import type { PrepRecommendationRecord } from '../../../types/systemDepth';
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

  useEffect(() => { loadData(); }, [loadData]);

  const handleChange = async <K extends keyof Omit<TeamTactics, 'teamId'>>(
    field: K,
    value: TeamTactics[K],
  ) => {
    if (!tactics) return;

    const updated: TeamTactics = { ...tactics, [field]: value };
    setTacticsState(updated);

    try {
      const { teamId: _, ...rest } = updated;
      await setTeamTactics(userTeamId, rest);
      setMessage({ text: '전술이 변경되었습니다.', type: 'success' });
    } catch (err) {
      console.error('전술 저장 실패:', err);
      setMessage({ text: '전술 저장에 실패했습니다.', type: 'error' });
    }
  };

  const handleAiCoach = async () => {
    if (aiSuggestionLoading) return;
    setAiSuggestionLoading(true);
    setAiSuggestion(null);

    const userTeam = teams.find(t => t.id === userTeamId);
    const opponentTeam = pendingMatch
      ? teams.find(t => t.id === (pendingMatch.teamHomeId === userTeamId ? pendingMatch.teamAwayId : pendingMatch.teamHomeId))
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
      // AI 실패 시 무시
    } finally {
      setAiSuggestionLoading(false);
    }
  };

  if (!save) return <p className="fm-text-muted">데이터를 불러오는 중...</p>;
  if (isLoading) return <p className="fm-text-muted">전술 정보를 불러오는 중...</p>;
  if (!tactics) return <p className="fm-text-muted">전술 데이터를 찾을 수 없습니다.</p>;

  const bonus = calculateTacticsBonus(tactics);
  const nextOpponent = pendingMatch
    ? teams.find((team) => team.id === (pendingMatch.teamHomeId === userTeamId ? pendingMatch.teamAwayId : pendingMatch.teamHomeId))?.name ?? '상대 대기'
    : null;
  const latestPrepRecord = prepRecords[0] ?? null;

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

      {/* AI 전술 조언 카드 */}
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
              const s = aiSuggestion.suggestion;
              const updated = { ...tactics };
              if (s.includes('어그로') || s.includes('공격')) {
                updated.earlyStrategy = 'invade';
                updated.aggressionLevel = Math.min(10, (updated.aggressionLevel ?? 5) + 2);
              } else if (s.includes('스플릿')) {
                updated.midStrategy = 'split_push';
                updated.lateStrategy = 'split_push';
              } else if (s.includes('오브젝트') || s.includes('드래곤') || s.includes('바론')) {
                updated.midStrategy = 'objective_control';
              } else if (s.includes('후반') || s.includes('스케일링') || s.includes('파밍')) {
                updated.earlyStrategy = 'safe_farm';
                updated.lateStrategy = 'teamfight';
              } else if (s.includes('비전') || s.includes('시야')) {
                updated.wardPriority = 'aggressive';
              } else if (s.includes('로밍')) {
                updated.midStrategy = 'pick_comp';
              }
              setTacticsState(updated);
              try {
                const { teamId: _, ...rest } = updated;
                await setTeamTactics(userTeamId, rest);
                await recordPrepRecommendation({
                  teamId: userTeamId,
                  seasonId: save.currentSeasonId,
                  source: 'opponent_analysis',
                  focusArea: 'tactics',
                  title: 'AI tactical adjustment',
                  summary: aiSuggestion.reason,
                  recommendedChanges: [aiSuggestion.suggestion, aiSuggestion.expectedEffect],
                  appliedChanges: [
                    `Early: ${EARLY_STRATEGY_LABELS[updated.earlyStrategy]}`,
                    `Mid: ${MID_STRATEGY_LABELS[updated.midStrategy]}`,
                    `Late: ${LATE_STRATEGY_LABELS[updated.lateStrategy]}`,
                  ],
                  targetMatchId: pendingMatch?.id ?? null,
                  targetDate: pendingMatch?.matchDate ?? season?.currentDate ?? null,
                  gameDate: season?.currentDate ?? pendingMatch?.matchDate ?? '2000-01-01',
                });
                setMessage({ text: 'AI 추천 전술이 적용되었습니다.', type: 'success' });
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
                setMessage({ text: '코치 추천 전술안을 적용했습니다.', type: 'success' });
              } catch (error) {
                console.error('코치 전술 추천 적용 실패:', error);
                setMessage({ text: '코치 추천 전술안 적용에 실패했습니다.', type: 'error' });
              }
            }}
          >
            전술 추천 적용
          </button>
        </div>
      )}

      {message && (
        <div className={`fm-alert ${message.type === 'success' ? 'fm-alert--success' : 'fm-alert--danger'} fm-mb-md`}>
          <span className="fm-alert__text">{message.text}</span>
        </div>
      )}

      {/* 전략 선택 섹션 */}
      <MainLoopPanel
        eyebrow="Tactics Loop"
        title="전술 조정도 다음 경기 준비 흐름 안에서 바로 읽히게 정리했습니다"
        subtitle="세부 수치보다 먼저, 지금 전술이 무엇을 노리고 있고 어떤 리스크를 안고 있는지 한 화면에서 파악할 수 있게 상단 요약을 추가했습니다."
        insights={[
          {
            label: '오늘 해야 할 일',
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
            detail: pendingMatch ? '밴픽과 오브젝트 우선순위 판단을 미리 맞춰 두면 경기 당일 판단이 훨씬 빨라집니다.' : '경기 일정이 가까워지면 이 화면의 결정이 DayView와 프리매치 준비에 바로 연결됩니다.',
            tone: 'accent',
          },
          {
            label: '코치 조언',
            value: coachRecommendation?.authorName ?? (aiSuggestion ? 'AI 코치' : '준비 완료'),
            detail: coachRecommendation?.headline ?? aiSuggestion?.suggestion ?? '현재 전술 보정치와 운영 축이 안정권입니다. 다음 상대가 잡히면 세부 조정을 이어가면 됩니다.',
            tone: 'success',
          },
        ]}
        actions={[
          { label: 'DayView로 돌아가기', onClick: () => navigate('/manager/day'), variant: 'primary' },
          { label: '훈련 조정', onClick: () => navigate('/manager/training') },
          { label: 'AI 코치 다시 받기', onClick: () => void handleAiCoach(), variant: 'info', disabled: aiSuggestionLoading },
        ]}
        note={`현재 전술 보정치는 공격 ${bonus.offense}, 수비 ${bonus.defense}, 운영 ${bonus.objective}입니다.`}
      />

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

      <div className="fm-panel fm-mb-lg">
        <div className="fm-panel__header">
          <span className="fm-panel__title">게임 페이즈별 전략</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--auto">
            {/* 초반 전략 */}
            <div className="fm-card">
              <label className="fm-text-base fm-font-semibold fm-text-primary fm-mb-sm" style={{ display: 'block' }}>초반 전략</label>
              <p className="fm-text-xs fm-text-muted fm-mb-sm" style={{ marginTop: 0 }}>라인전 ~ 1차 오브젝트</p>
              <select
                className="fm-select"
                style={{ width: '100%' }}
                value={tactics.earlyStrategy}
                onChange={e => handleChange('earlyStrategy', e.target.value as EarlyStrategy)}
              >
                {EARLY_STRATEGIES.map(s => (
                  <option key={s} value={s}>{EARLY_STRATEGY_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {/* 중반 전략 */}
            <div className="fm-card">
              <label className="fm-text-base fm-font-semibold fm-text-primary fm-mb-sm" style={{ display: 'block' }}>중반 전략</label>
              <p className="fm-text-xs fm-text-muted fm-mb-sm" style={{ marginTop: 0 }}>오브젝트 쟁탈 ~ 타워 압박</p>
              <select
                className="fm-select"
                style={{ width: '100%' }}
                value={tactics.midStrategy}
                onChange={e => handleChange('midStrategy', e.target.value as MidStrategy)}
              >
                {MID_STRATEGIES.map(s => (
                  <option key={s} value={s}>{MID_STRATEGY_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {/* 후반 전략 */}
            <div className="fm-card">
              <label className="fm-text-base fm-font-semibold fm-text-primary fm-mb-sm" style={{ display: 'block' }}>후반 전략</label>
              <p className="fm-text-xs fm-text-muted fm-mb-sm" style={{ marginTop: 0 }}>바론 이후 ~ 넥서스 공략</p>
              <select
                className="fm-select"
                style={{ width: '100%' }}
                value={tactics.lateStrategy}
                onChange={e => handleChange('lateStrategy', e.target.value as LateStrategy)}
              >
                {LATE_STRATEGIES.map(s => (
                  <option key={s} value={s}>{LATE_STRATEGY_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {/* 와드 우선도 */}
            <div className="fm-card">
              <label className="fm-text-base fm-font-semibold fm-text-primary fm-mb-sm" style={{ display: 'block' }}>와드 운용</label>
              <p className="fm-text-xs fm-text-muted fm-mb-sm" style={{ marginTop: 0 }}>시야 장악 성향</p>
              <select
                className="fm-select"
                style={{ width: '100%' }}
                value={tactics.wardPriority}
                onChange={e => handleChange('wardPriority', e.target.value as WardPriority)}
              >
                {WARD_PRIORITIES.map(w => (
                  <option key={w} value={w}>{WARD_PRIORITY_LABELS[w]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 슬라이더 섹션 */}
      <div className="fm-panel fm-mb-lg">
        <div className="fm-panel__header">
          <span className="fm-panel__title">세부 수치 조정</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-flex-col fm-gap-md">
            {/* 드래곤 우선도 */}
            <div className="fm-card">
              <div className="fm-flex fm-items-center fm-justify-between fm-mb-sm">
                <label className="fm-text-base fm-font-semibold fm-text-primary">드래곤 우선도</label>
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

            {/* 바론 우선도 */}
            <div className="fm-card">
              <div className="fm-flex fm-items-center fm-justify-between fm-mb-sm">
                <label className="fm-text-base fm-font-semibold fm-text-primary">바론 우선도</label>
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

            {/* 공격성 레벨 */}
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

      {/* 전술 효과 미리보기 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">전술 보정 효과</span>
        </div>
        <div className="fm-panel__body">
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
              <div><strong style={{ color: '#4ecdc4' }}>초반 보정:</strong> 라인전 및 초반 교전 승률에 영향</div>
              <div><strong style={{ color: 'var(--accent)' }}>중반 보정:</strong> 중반 운영 및 로밍 효율에 영향</div>
              <div><strong style={{ color: '#9b59b6' }}>후반 보정:</strong> 후반 한타 및 마무리 능력에 영향</div>
              <div><strong style={{ color: '#e67e22' }}>오브젝트 보정:</strong> 드래곤/바론 확보율에 영향</div>
            </div>
          </div>
        </div>
      </div>
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
