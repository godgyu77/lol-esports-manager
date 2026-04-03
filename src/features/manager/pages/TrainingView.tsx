/**
 * 훈련 관리 페이지
 * - 탭 1: 주간 훈련 스케줄 설정
 * - 탭 2: 선수 개별 훈련 배정
 * - 탭 3: 훈련 이력
 * - 탭 4: 멘토링
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../../stores/gameStore';
import {
  getTrainingSchedule,
  setTrainingSchedule,
  getPlayerTraining,
  setPlayerTraining,
  getRecentTrainingLogs,
} from '../../../engine/training/trainingEngine';
import type {
  TrainingScheduleEntry,
  PlayerTrainingAssignment,
  TrainingActivity,
  TrainingType,
  TrainingIntensity,
  TrainableStat,
} from '../../../types/training';
import { TRAINING_ACTIVITY_LABELS, TRAINING_TYPE_LABELS } from '../../../types/training';
import {
  getMentoringPairs,
  getEligibleMentors,
  getEligibleMentees,
  assignMentor,
  removeMentor,
  type MentoringPair,
} from '../../../engine/mentoring/mentoringEngine';
import {
  getRecentScrims,
  getTrainingRecommendation,
} from '../../../engine/season/scrimEngine';
import { generateScrimBriefing, generateTrainingDigest } from '../../../engine/news/newsEngine';
import type { TrainingRecommendation } from '../../../engine/season/scrimEngine';
import type { Player } from '../../../types/player';
import { POSITION_LABELS_SHORT as POSITION_LABELS } from '../../../utils/constants';
import { applyCoachTrainingRecommendation, generateInitialCoachRecommendations } from '../../../engine/manager/managerSetupEngine';
import { getPrepRecommendationRecords, recordPrepRecommendation } from '../../../engine/manager/systemDepthEngine';
import type { CoachSetupRecommendation } from '../../../types/managerSetup';
import { MainLoopPanel } from '../components/MainLoopPanel';
import { useToolbarNavigation } from '../hooks/useToolbarNavigation';
import type { PrepRecommendationRecord } from '../../../types/systemDepth';

type Tab = 'schedule' | 'individual' | 'logs' | 'mentoring';
const TRAINING_TABS: Tab[] = ['schedule', 'individual', 'logs', 'mentoring'];

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const ACTIVITY_OPTIONS: TrainingActivity[] = ['rest', 'training', 'scrim'];
const TRAINING_TYPES: TrainingType[] = ['general', 'laning', 'teamfight', 'macro', 'champion_pool', 'mental', 'physical'];
const INTENSITY_OPTIONS: TrainingIntensity[] = ['light', 'normal', 'intense'];
const INTENSITY_LABELS: Record<TrainingIntensity, string> = { light: '가벼운', normal: '보통', intense: '강도 높은' };
const STAT_LABELS: Record<TrainableStat, string> = {
  mechanical: '기계적', gameSense: '판단력', teamwork: '팀워크',
  consistency: '일관성', laning: '라인전', aggression: '공격성',
};
const POS_CLASS: Record<string, string> = {
  top: 'fm-pos-badge--top',
  jungle: 'fm-pos-badge--jgl',
  mid: 'fm-pos-badge--mid',
  adc: 'fm-pos-badge--adc',
  support: 'fm-pos-badge--sup',
};

function getPrepOutcomeTone(record: PrepRecommendationRecord | null): 'success' | 'info' | 'danger' {
  if (!record) return 'info';
  if (record.observedOutcome === 'positive') return 'success';
  if (record.status === 'observed') return 'danger';
  return 'info';
}

export function TrainingView() {
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);
  const season = useGameStore((s) => s.season);
  const pendingMatch = useGameStore((s) => s.pendingUserMatch);
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('schedule');
  const [schedule, setScheduleState] = useState<TrainingScheduleEntry[]>([]);
  const [assignments, setAssignments] = useState<PlayerTrainingAssignment[]>([]);
  const [logs, setLogs] = useState<{ playerId: string; trainingDate: string; trainingType: string; statChanged: string | null; statDelta: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // 멘토링 상태
  const [mentoringPairs, setMentoringPairs] = useState<MentoringPair[]>([]);
  const [eligibleMentors, setEligibleMentors] = useState<Player[]>([]);
  const [eligibleMentees, setEligibleMentees] = useState<Player[]>([]);
  const [selectedMentorId, setSelectedMentorId] = useState('');
  const [selectedMenteeId, setSelectedMenteeId] = useState('');
  const [scrimRecommendation, setScrimRecommendation] = useState<TrainingRecommendation | null>(null);
  const [coachRecommendation, setCoachRecommendation] = useState<CoachSetupRecommendation | null>(null);
  const [prepRecords, setPrepRecords] = useState<PrepRecommendationRecord[]>([]);
  const { getItemProps } = useToolbarNavigation({
    items: TRAINING_TABS,
    activeItem: tab,
    onSelect: setTab,
  });

  const userTeamId = save?.userTeamId ?? '';
  const userTeam = teams.find(t => t.id === userTeamId);
  const roster = userTeam?.roster ?? [];

  const loadData = useCallback(async () => {
    if (!save) return;
    setIsLoading(true);
    try {
      const [sched, assign, recentLogs, setupRecommendations, recentPrep] = await Promise.all([
        getTrainingSchedule(userTeamId),
        getPlayerTraining(userTeamId),
        getRecentTrainingLogs(userTeamId, 30),
        generateInitialCoachRecommendations(userTeamId, save.currentSeasonId).catch(() => []),
        getPrepRecommendationRecords(userTeamId, save.currentSeasonId, 3).catch(() => []),
      ]);
      const [pairs, mentors, mentees] = await Promise.all([
        getMentoringPairs(userTeamId).catch(() => [] as MentoringPair[]),
        getEligibleMentors(userTeamId).catch(() => [] as Player[]),
        getEligibleMentees(userTeamId).catch(() => [] as Player[]),
      ]);
      setScheduleState(sched);
      setAssignments(assign);
      setLogs(recentLogs);
      setCoachRecommendation(
        setupRecommendations.find((recommendation) => recommendation.kind === 'training') ?? null,
      );
      setPrepRecords(recentPrep.filter((record) => record.focusArea === 'training'));
      setMentoringPairs(pairs);
      setEligibleMentors(mentors);
      setEligibleMentees(mentees);

      // 스크림 기반 훈련 추천
      try {
        const recentScrims = await getRecentScrims(userTeamId, 3);
        if (recentScrims.length > 0) {
          const rec = getTrainingRecommendation(recentScrims[0].feedback);
          setScrimRecommendation(rec);
        } else {
          setScrimRecommendation(null);
        }
      } catch {
        setScrimRecommendation(null);
      }
    } catch (err) {
      console.error('훈련 데이터 로딩 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, [save, userTeamId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleScheduleChange = async (dayOfWeek: number, field: 'activity' | 'type' | 'intensity', value: string) => {
    const existing = schedule.find(s => s.dayOfWeek === dayOfWeek);
    const activity = field === 'activity' ? value as TrainingActivity : (existing?.activityType ?? 'training');
    const type = field === 'type' ? value as TrainingType : (existing?.trainingType ?? 'general');
    const intensity = field === 'intensity' ? value as TrainingIntensity : (existing?.intensity ?? 'normal');

    try {
      await setTrainingSchedule(userTeamId, dayOfWeek, activity, type, intensity);
      setMessage({ text: `${DAY_LABELS[dayOfWeek]}요일 일정 변경 완료`, type: 'success' });
      await loadData();
    } catch (err) {
      console.error('스케줄 변경 실패:', err);
      setMessage({ text: '스케줄 변경에 실패했습니다.', type: 'error' });
    }
  };

  const handlePlayerTrainingChange = async (
    playerId: string,
    trainingType: TrainingType,
    targetStat?: TrainableStat,
    targetChampionId?: string,
  ) => {
    try {
      await setPlayerTraining(playerId, userTeamId, trainingType, targetStat, targetChampionId);
      setMessage({ text: '개별 훈련 배정 완료', type: 'success' });
      await loadData();
    } catch (err) {
      console.error('개별 훈련 변경 실패:', err);
      setMessage({ text: '개별 훈련 배정에 실패했습니다.', type: 'error' });
    }
  };

  const getPlayerName = (playerId: string): string => {
    for (const team of teams) {
      const p = team.roster?.find(r => r.id === playerId);
      if (p) return p.name;
    }
    return playerId;
  };

  if (!save) return <p className="fm-text-muted">데이터를 불러오는 중...</p>;
  if (isLoading) return <p className="fm-text-muted">훈련 정보를 불러오는 중...</p>;

  const nextOpponent = pendingMatch
    ? teams.find((team) => team.id === (pendingMatch.teamHomeId === userTeamId ? pendingMatch.teamAwayId : pendingMatch.teamHomeId))?.name ?? '상대 대기'
    : null;
  const currentScheduleSummary = schedule.find((entry) => entry.activityType !== 'rest') ?? schedule[1] ?? null;
  const latestPrepRecord = prepRecords[0] ?? null;

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">훈련 관리</h1>
      </div>

      {message && (
        <div className={`fm-alert ${message.type === 'success' ? 'fm-alert--success' : 'fm-alert--danger'} fm-mb-md`}>
          <span className="fm-alert__text">{message.text}</span>
        </div>
      )}

      <MainLoopPanel
        eyebrow="Training Loop"
        title="훈련 화면도 메인 루프 기준으로 바로 읽히게 정리했습니다"
        subtitle="지금 이 주간 계획이 다음 경기와 팀 컨디션에 어떤 영향을 주는지 먼저 보고, 그 아래에서 세부 조정을 이어가는 구조입니다."
        insights={[
          {
            label: '오늘 해야 할 일',
            value: tab === 'schedule' ? '주간 스케줄 점검' : tab === 'individual' ? '개별 훈련 조정' : tab === 'logs' ? '훈련 결과 확인' : '멘토링 조정',
            detail: currentScheduleSummary
              ? `${TRAINING_ACTIVITY_LABELS[currentScheduleSummary.activityType]} / ${TRAINING_TYPE_LABELS[currentScheduleSummary.trainingType]} / 강도 ${currentScheduleSummary.intensity}`
              : '아직 구성된 훈련 루틴이 없습니다.',
            tone: 'accent',
          },
          {
            label: '가장 큰 리스크',
            value: scrimRecommendation ? '스크림 기반 경고' : coachRecommendation ? '코치 피드백' : '안정',
            detail: scrimRecommendation?.reason ?? coachRecommendation?.summary ?? '즉시 수정이 필요한 훈련 리스크는 없습니다.',
            tone: scrimRecommendation || coachRecommendation ? 'danger' : 'success',
          },
          {
            label: '다음 경기',
            value: pendingMatch ? `${pendingMatch.matchDate ?? season?.currentDate ?? '일정'} vs ${nextOpponent}` : 'DayView에서 일정 확인',
            detail: pendingMatch ? '경기 전까지 훈련 강도와 방향을 맞춰 두면 당일 의사결정이 훨씬 단순해집니다.' : '가까운 경기 일정이 잡히면 이 화면의 설정이 바로 준비 루프로 이어집니다.',
            tone: 'accent',
          },
          {
            label: '코치 조언',
            value: coachRecommendation?.authorName ?? '데이터 브리핑',
            detail: coachRecommendation?.headline ?? scrimRecommendation?.reason ?? '훈련 로그와 스크림 피드백을 보고 다음 조정을 선택하세요.',
            tone: 'success',
          },
        ]}
        actions={[
          { label: 'DayView로 돌아가기', onClick: () => navigate('/manager/day'), variant: 'primary' },
          { label: '전술 정리', onClick: () => navigate('/manager/tactics') },
          { label: '뉴스 브리핑 보기', onClick: () => navigate('/manager/news'), variant: 'info' },
        ]}
        note="훈련은 별도 하위 화면이 아니라 메인 루프의 준비 단계라는 점이 바로 읽히도록 상단 요약을 추가했습니다."
      />

      <div className="fm-tabs" role="tablist" aria-label="훈련 화면 섹션" aria-orientation="horizontal">
        <button className={`fm-tab ${tab === 'schedule' ? 'fm-tab--active' : ''}`}
                onClick={() => setTab('schedule')}
                role="tab"
                aria-selected={tab === 'schedule'}
                aria-controls="training-panel-schedule"
                id="training-tab-schedule"
                {...getItemProps('schedule')}>주간 스케줄</button>
        <button className={`fm-tab ${tab === 'individual' ? 'fm-tab--active' : ''}`}
                onClick={() => setTab('individual')}
                role="tab"
                aria-selected={tab === 'individual'}
                aria-controls="training-panel-individual"
                id="training-tab-individual"
                {...getItemProps('individual')}>개별 훈련</button>
        <button className={`fm-tab ${tab === 'logs' ? 'fm-tab--active' : ''}`}
                onClick={() => setTab('logs')}
                role="tab"
                aria-selected={tab === 'logs'}
                aria-controls="training-panel-logs"
                id="training-tab-logs"
                {...getItemProps('logs')}>훈련 이력</button>
        <button className={`fm-tab ${tab === 'mentoring' ? 'fm-tab--active' : ''}`}
                onClick={() => setTab('mentoring')}
                role="tab"
                aria-selected={tab === 'mentoring'}
                aria-controls="training-panel-mentoring"
                id="training-tab-mentoring"
                {...getItemProps('mentoring')}>멘토링</button>
      </div>

      <div role="tabpanel" id={`training-panel-${tab}`} aria-labelledby={`training-tab-${tab}`}>

      {coachRecommendation && tab === 'schedule' && (
        <div className="fm-alert fm-alert--info fm-mb-md" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
          <div className="fm-flex fm-items-center fm-gap-xs">
            <span className="fm-text-md fm-font-semibold fm-text-accent">코치 브리핑</span>
            <span className="fm-text-xs fm-text-secondary">{coachRecommendation.authorName}</span>
          </div>
          <span className="fm-text-md fm-font-semibold fm-text-primary">{coachRecommendation.headline}</span>
          <p className="fm-text-xs fm-text-secondary" style={{ margin: 0 }}>{coachRecommendation.summary}</p>
          <ul className="fm-text-xs fm-text-secondary" style={{ margin: 0, paddingLeft: 18 }}>
            {coachRecommendation.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <button
            className="fm-btn fm-btn--primary fm-btn--sm"
            onClick={async () => {
              try {
                const gameDate = season?.currentDate ?? pendingMatch?.matchDate ?? '2000-01-01';
                await applyCoachTrainingRecommendation(userTeamId, coachRecommendation);
                await recordPrepRecommendation({
                  teamId: userTeamId,
                  seasonId: save.currentSeasonId,
                  source: 'coach_briefing',
                  focusArea: 'training',
                  title: coachRecommendation.headline,
                  summary: coachRecommendation.summary,
                  recommendedChanges: coachRecommendation.reasons,
                  appliedChanges: coachRecommendation.reasons,
                  targetMatchId: pendingMatch?.id ?? null,
                  targetDate: pendingMatch?.matchDate ?? season?.currentDate ?? null,
                  gameDate,
                });
                await generateTrainingDigest(
                  save.currentSeasonId,
                  gameDate,
                  userTeamId,
                  coachRecommendation.authorName,
                  coachRecommendation.summary,
                  coachRecommendation.reasons,
                );
                setMessage({ text: '코치 추천 주간 훈련안을 적용했습니다.', type: 'success' });
                await loadData();
              } catch (error) {
                console.error('코치 훈련 추천 적용 실패:', error);
                setMessage({ text: '코치 추천 훈련안 적용에 실패했습니다.', type: 'error' });
              }
            }}
          >
            훈련 추천 적용
          </button>
        </div>
      )}

      {/* 스크림 기반 추천 배너 */}
      {scrimRecommendation && tab === 'schedule' && (
        <div className="fm-alert fm-alert--warning fm-mb-md" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
          <div className="fm-flex fm-items-center fm-gap-xs">
            <span className="fm-text-lg">&#9733;</span>
            <span className="fm-text-md fm-font-semibold fm-text-accent">스크림 분석 기반 추천</span>
          </div>
          <div className="fm-flex fm-items-center fm-gap-xs">
            <span className="fm-text-lg fm-font-bold fm-text-primary">
              {TRAINING_TYPE_LABELS[scrimRecommendation.trainingType as TrainingType] ?? scrimRecommendation.trainingType} 훈련
            </span>
            <span className="fm-text-xs fm-text-secondary">
              ({INTENSITY_LABELS[scrimRecommendation.intensity]} 강도)
            </span>
          </div>
          <p className="fm-text-xs fm-text-secondary" style={{ margin: '4px 0 10px' }}>{scrimRecommendation.reason}</p>
          <button
            className="fm-btn fm-btn--primary fm-btn--sm"
            onClick={async () => {
              // 게임 내 날짜 기준 요일 계산 (1=월 ~ 6=토)
              const gameDate = season?.currentDate ?? pendingMatch?.matchDate ?? '2000-01-01';
              const gameDateObj = new Date(gameDate + 'T00:00:00');
              const dayOfWeek = gameDateObj.getDay(); // 0=일 ~ 6=토
              // 다음 훈련 가능 요일 (일요일/경기일 제외)
              let targetDay = dayOfWeek === 0 ? 1 : dayOfWeek; // 일요일이면 월요일
              if (targetDay === 7) targetDay = 1; // 안전장치
              try {
                await setTrainingSchedule(
                  userTeamId,
                  targetDay,
                  'scrim',
                  scrimRecommendation.trainingType as TrainingType,
                  scrimRecommendation.intensity as TrainingIntensity,
                );
                await generateScrimBriefing(
                  save.currentSeasonId,
                  gameDate,
                  userTeamId,
                  coachRecommendation?.authorName ?? '수석',
                  '최근 스크림',
                  `${TRAINING_TYPE_LABELS[scrimRecommendation.trainingType as TrainingType] ?? scrimRecommendation.trainingType} 훈련과 ${INTENSITY_LABELS[scrimRecommendation.intensity]} 강도를 추천합니다.`,
                  [scrimRecommendation.reason],
                );
                await recordPrepRecommendation({
                  teamId: userTeamId,
                  seasonId: save.currentSeasonId,
                  source: 'coach_briefing',
                  focusArea: 'training',
                  title: '스크림 기반 훈련 조정',
                  summary: scrimRecommendation.reason,
                  recommendedChanges: [
                    `${TRAINING_TYPE_LABELS[scrimRecommendation.trainingType as TrainingType] ?? scrimRecommendation.trainingType} 훈련`,
                    `${INTENSITY_LABELS[scrimRecommendation.intensity]} 강도`,
                  ],
                  appliedChanges: [
                    `${DAY_LABELS[targetDay]}요일에 스크림 편성`,
                    `${TRAINING_TYPE_LABELS[scrimRecommendation.trainingType as TrainingType] ?? scrimRecommendation.trainingType} 훈련`,
                  ],
                  targetMatchId: pendingMatch?.id ?? null,
                  targetDate: pendingMatch?.matchDate ?? season?.currentDate ?? null,
                  gameDate,
                });
                setMessage({ text: `${DAY_LABELS[targetDay]}요일 스케줄에 추천 훈련을 적용했습니다.`, type: 'success' });
                await loadData();
              } catch {
                setMessage({ text: '추천 훈련 적용에 실패했습니다.', type: 'error' });
              }
            }}
          >
            적용
          </button>
        </div>
      )}

      {tab === 'schedule' && latestPrepRecord && (
        <div className={`fm-alert fm-alert--${getPrepOutcomeTone(latestPrepRecord)} fm-mb-md`} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
          <div className="fm-flex fm-items-center fm-justify-between" style={{ width: '100%' }}>
            <span className="fm-text-sm fm-font-semibold">
              준비 추적
            </span>
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

      {/* 탭 1: 주간 스케줄 */}
      {tab === 'schedule' && (
        <div>
          <p className="fm-text-md fm-text-secondary fm-mb-md">시즌 진행 시 이 주간 설정이 자동 적용됩니다. 경기일만 별도로 경기 일정이 우선됩니다.</p>
          <div className="fm-panel">
            <div className="fm-panel__body--flush fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th>요일</th>
                    <th>활동</th>
                    <th>훈련 유형</th>
                    <th>강도</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3, 4, 5, 6].map(day => {
                    const entry = schedule.find(s => s.dayOfWeek === day);
                    const activityType = entry?.activityType ?? (day === 0 ? 'rest' : 'training');
                    const isRestDay = activityType === 'rest';
                    return (
                      <tr key={day}>
                        <td className="fm-cell--name">{DAY_LABELS[day]}</td>
                        <td>
                          <select
                            className="fm-select"
                            value={activityType}
                            onChange={e => handleScheduleChange(day, 'activity', e.target.value)}
                          >
                            {ACTIVITY_OPTIONS.map(activity => (
                              <option key={activity} value={activity}>{TRAINING_ACTIVITY_LABELS[activity]}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="fm-select"
                            value={entry?.trainingType ?? 'general'}
                            disabled={isRestDay}
                            onChange={e => handleScheduleChange(day, 'type', e.target.value)}
                          >
                            {TRAINING_TYPES.map(t => (
                              <option key={t} value={t}>{TRAINING_TYPE_LABELS[t]}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="fm-select"
                            value={entry?.intensity ?? 'normal'}
                            disabled={isRestDay}
                            onChange={e => handleScheduleChange(day, 'intensity', e.target.value)}
                          >
                            {INTENSITY_OPTIONS.map(i => (
                              <option key={i} value={i}>{INTENSITY_LABELS[i]}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="fm-panel fm-mt-md">
            <div className="fm-panel__header">
              <span className="fm-panel__title">강도별 효과</span>
            </div>
            <div className="fm-panel__body">
              <div className="fm-flex-col fm-gap-xs fm-text-xs fm-text-secondary">
                <div><strong style={{ color: '#4ecdc4' }}>가벼운:</strong> 스탯 성장 x0.5 / 스태미나 -4 / 폼 +2</div>
                <div><strong style={{ color: 'var(--accent)' }}>보통:</strong> 스탯 성장 x1.0 / 스태미나 -8 / 폼 +5</div>
                <div><strong style={{ color: 'var(--danger)' }}>강도 높은:</strong> 스탯 성장 x1.5 / 스태미나 -15 / 폼 +8</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 탭 2: 개별 훈련 */}
      {tab === 'individual' && (
        <div>
          <p className="fm-text-md fm-text-secondary fm-mb-md">선수별 특화 훈련을 배정합니다. 미배정 시 팀 스케줄을 따릅니다.</p>
          <div className="fm-panel">
            <div className="fm-panel__body--flush fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th>포지션</th>
                    <th>선수</th>
                    <th>훈련 유형</th>
                    <th>집중 스탯</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map(player => {
                    const assignment = assignments.find(a => a.playerId === player.id);
                    return (
                      <tr key={player.id}>
                        <td>
                          <span className={`fm-pos-badge ${POS_CLASS[player.position] ?? ''}`}>
                            {POSITION_LABELS[player.position]}
                          </span>
                        </td>
                        <td className="fm-cell--name">{player.name}</td>
                        <td>
                          <select
                            className="fm-select"
                            value={assignment?.trainingType ?? 'general'}
                            onChange={e => handlePlayerTrainingChange(
                              player.id,
                              e.target.value as TrainingType,
                              assignment?.targetStat ?? undefined,
                            )}
                          >
                            <option value="">팀 스케줄 따름</option>
                            {TRAINING_TYPES.map(t => (
                              <option key={t} value={t}>{TRAINING_TYPE_LABELS[t]}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="fm-select"
                            value={assignment?.targetStat ?? ''}
                            onChange={e => handlePlayerTrainingChange(
                              player.id,
                              assignment?.trainingType ?? 'general',
                              (e.target.value || undefined) as TrainableStat | undefined,
                            )}
                          >
                            <option value="">자동 (전체)</option>
                            {(Object.entries(STAT_LABELS) as [TrainableStat, string][]).map(([key, label]) => (
                              <option key={key} value={key}>{label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 탭 3: 훈련 이력 */}
      {tab === 'logs' && (
        <div>
          {logs.length === 0 ? (
            <p className="fm-text-muted fm-text-md">훈련 이력이 없습니다.</p>
          ) : (
            <div className="fm-panel">
              <div className="fm-panel__body--flush fm-table-wrap">
                <table className="fm-table fm-table--striped">
                  <thead>
                    <tr>
                      <th>날짜</th>
                      <th>선수</th>
                      <th>훈련</th>
                      <th>변화 스탯</th>
                      <th>변화량</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, idx) => (
                      <tr key={idx}>
                        <td>{log.trainingDate}</td>
                        <td className="fm-cell--name">{getPlayerName(log.playerId)}</td>
                        <td>
                          {TRAINING_TYPE_LABELS[log.trainingType as TrainingType] ?? log.trainingType}
                        </td>
                        <td>
                          {log.statChanged ? (STAT_LABELS[log.statChanged as TrainableStat] ?? log.statChanged) : '-'}
                        </td>
                        <td>
                          <span className={log.statDelta > 0 ? 'fm-text-success fm-font-semibold' : 'fm-text-danger fm-font-semibold'}>
                            {log.statDelta > 0 ? `+${log.statDelta.toFixed(2)}` : log.statDelta.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 탭 4: 멘토링 */}
      {tab === 'mentoring' && (
        <div>
          <p className="fm-text-md fm-text-secondary fm-mb-md">
            시니어 선수(25세+)가 주니어 선수(22세-)를 멘토링합니다. 같은 포지션만 가능합니다.
            멘티는 멘토의 최고 스탯이 매일 +0.05 성장하고, 멘토의 팀워크가 +0.02 성장합니다.
          </p>

          {/* 현재 멘토링 쌍 */}
          <div className="fm-panel fm-mb-md">
            <div className="fm-panel__header">
              <span className="fm-panel__title">현재 멘토링</span>
            </div>
            <div className="fm-panel__body--flush">
              {mentoringPairs.length === 0 ? (
                <div className="fm-p-md">
                  <p className="fm-text-muted fm-text-md">활성 멘토링이 없습니다.</p>
                </div>
              ) : (
                <div className="fm-table-wrap">
                  <table className="fm-table fm-table--striped">
                    <thead>
                      <tr>
                        <th>멘토</th>
                        <th>멘티</th>
                        <th>보너스 스탯</th>
                        <th>일간 성장</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mentoringPairs.map(pair => (
                        <tr key={pair.id}>
                          <td className="fm-cell--name">{getPlayerName(pair.mentorId)}</td>
                          <td className="fm-cell--name">{getPlayerName(pair.menteeId)}</td>
                          <td className="fm-cell--accent">
                            {pair.bonusStat ? (STAT_LABELS[pair.bonusStat as TrainableStat] ?? pair.bonusStat) : '-'}
                          </td>
                          <td>+{pair.dailyGrowthBonus.toFixed(2)}</td>
                          <td>
                            <button
                              className="fm-btn fm-btn--sm fm-btn--danger"
                              onClick={async () => {
                                await removeMentor(pair.menteeId);
                                setMessage({ text: '멘토링이 해제되었습니다.', type: 'success' });
                                await loadData();
                              }}
                            >
                              해제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* 새 멘토링 배정 */}
          <div className="fm-panel fm-mb-md">
            <div className="fm-panel__header">
              <span className="fm-panel__title">멘토 배정</span>
            </div>
            <div className="fm-panel__body">
              <div className="fm-flex fm-gap-md fm-items-center fm-flex-wrap" style={{ alignItems: 'flex-end' }}>
                <div className="fm-flex-col fm-gap-xs fm-flex-1" style={{ minWidth: '180px' }}>
                  <label className="fm-text-xs fm-font-medium fm-text-secondary">멘토 (25세+)</label>
                  <select
                    className="fm-select"
                    value={selectedMentorId}
                    onChange={e => setSelectedMentorId(e.target.value)}
                  >
                    <option value="">선택...</option>
                    {eligibleMentors.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({POSITION_LABELS[p.position]}, {p.age}세)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="fm-flex-col fm-gap-xs fm-flex-1" style={{ minWidth: '180px' }}>
                  <label className="fm-text-xs fm-font-medium fm-text-secondary">멘티 (22세-)</label>
                  <select
                    className="fm-select"
                    value={selectedMenteeId}
                    onChange={e => setSelectedMenteeId(e.target.value)}
                  >
                    <option value="">선택...</option>
                    {eligibleMentees
                      .filter(p => {
                        if (!selectedMentorId) return true;
                        const mentor = eligibleMentors.find(m => m.id === selectedMentorId);
                        return mentor ? p.position === mentor.position : true;
                      })
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({POSITION_LABELS[p.position]}, {p.age}세)
                        </option>
                      ))}
                  </select>
                </div>
                <button
                  className="fm-btn fm-btn--primary"
                  disabled={!selectedMentorId || !selectedMenteeId}
                  onClick={async () => {
                    const season = useGameStore.getState().season;
                    const currentDate = season?.currentDate ?? '';
                    const result = await assignMentor(selectedMentorId, selectedMenteeId, userTeamId, currentDate);
                    setMessage({ text: result.message, type: result.success ? 'success' : 'error' });
                    if (result.success) {
                      setSelectedMentorId('');
                      setSelectedMenteeId('');
                      await loadData();
                    }
                  }}
                >
                  배정
                </button>
              </div>
            </div>
          </div>

          {/* 안내 */}
          <div className="fm-panel">
            <div className="fm-panel__header">
              <span className="fm-panel__title">멘토링 효과</span>
            </div>
            <div className="fm-panel__body">
              <div className="fm-flex-col fm-gap-xs fm-text-xs fm-text-secondary">
                <div><strong className="fm-text-success">멘티:</strong> 멘토의 최고 스탯 +0.05/일 성장</div>
                <div><strong className="fm-text-info">멘토:</strong> 팀워크 +0.02/일 성장</div>
                <div><strong className="fm-text-muted">조건:</strong> 멘토 25세+, 멘티 22세-, 같은 포지션</div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
