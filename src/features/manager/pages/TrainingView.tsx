/**
 * 훈련 관리 페이지
 * - 탭 1: 주간 훈련 스케줄 설정
 * - 탭 2: 선수 개별 훈련 배정
 * - 탭 3: 훈련 이력
 * - 탭 4: 멘토링
 */

import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  getTrainingSchedule,
  setTrainingSchedule,
  getPlayerTraining,
  setPlayerTraining,
  getRecentTrainingLogs,
  initDefaultSchedule,
} from '../../../engine/training/trainingEngine';
import type {
  TrainingScheduleEntry,
  PlayerTrainingAssignment,
  TrainingType,
  TrainingIntensity,
  TrainableStat,
} from '../../../types/training';
import { TRAINING_TYPE_LABELS } from '../../../types/training';
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
import type { TrainingRecommendation } from '../../../engine/season/scrimEngine';
import type { Player } from '../../../types/player';
import { POSITION_LABELS_SHORT as POSITION_LABELS } from '../../../utils/constants';

type Tab = 'schedule' | 'individual' | 'logs' | 'mentoring';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
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

export function TrainingView() {
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);

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

  const userTeamId = save?.userTeamId ?? '';
  const userTeam = teams.find(t => t.id === userTeamId);
  const roster = userTeam?.roster ?? [];

  const loadData = useCallback(async () => {
    if (!save) return;
    setIsLoading(true);
    try {
      let sched = await getTrainingSchedule(userTeamId);
      if (sched.length === 0) {
        await initDefaultSchedule(userTeamId);
        sched = await getTrainingSchedule(userTeamId);
      }
      const [assign, recentLogs] = await Promise.all([
        getPlayerTraining(userTeamId),
        getRecentTrainingLogs(userTeamId, 30),
      ]);
      const [pairs, mentors, mentees] = await Promise.all([
        getMentoringPairs(userTeamId).catch(() => [] as MentoringPair[]),
        getEligibleMentors(userTeamId).catch(() => [] as Player[]),
        getEligibleMentees(userTeamId).catch(() => [] as Player[]),
      ]);
      setScheduleState(sched);
      setAssignments(assign);
      setLogs(recentLogs);
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

  const handleScheduleChange = async (dayOfWeek: number, field: 'type' | 'intensity', value: string) => {
    const existing = schedule.find(s => s.dayOfWeek === dayOfWeek);
    const type = field === 'type' ? value as TrainingType : (existing?.trainingType ?? 'general');
    const intensity = field === 'intensity' ? value as TrainingIntensity : (existing?.intensity ?? 'normal');

    try {
      await setTrainingSchedule(userTeamId, dayOfWeek, type, intensity);
      setMessage({ text: `${DAY_LABELS[dayOfWeek]}요일 훈련 변경 완료`, type: 'success' });
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

      <div className="fm-tabs">
        <button className={`fm-tab ${tab === 'schedule' ? 'fm-tab--active' : ''}`}
                onClick={() => setTab('schedule')}>주간 스케줄</button>
        <button className={`fm-tab ${tab === 'individual' ? 'fm-tab--active' : ''}`}
                onClick={() => setTab('individual')}>개별 훈련</button>
        <button className={`fm-tab ${tab === 'logs' ? 'fm-tab--active' : ''}`}
                onClick={() => setTab('logs')}>훈련 이력</button>
        <button className={`fm-tab ${tab === 'mentoring' ? 'fm-tab--active' : ''}`}
                onClick={() => setTab('mentoring')}>멘토링</button>
      </div>

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
              const gameDate = useGameStore.getState().season?.currentDate ?? new Date().toISOString().slice(0, 10);
              const gameDateObj = new Date(gameDate + 'T00:00:00');
              const dayOfWeek = gameDateObj.getDay(); // 0=일 ~ 6=토
              // 다음 훈련 가능 요일 (일요일/경기일 제외)
              let targetDay = dayOfWeek === 0 ? 1 : dayOfWeek; // 일요일이면 월요일
              if (targetDay === 7) targetDay = 1; // 안전장치
              try {
                await setTrainingSchedule(
                  userTeamId,
                  targetDay,
                  scrimRecommendation.trainingType as TrainingType,
                  scrimRecommendation.intensity as TrainingIntensity,
                );
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

      {/* 탭 1: 주간 스케줄 */}
      {tab === 'schedule' && (
        <div>
          <p className="fm-text-md fm-text-secondary fm-mb-md">경기일/일요일(휴식)을 제외한 요일별 훈련을 설정합니다.</p>
          <div className="fm-panel">
            <div className="fm-panel__body--flush fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th>요일</th>
                    <th>훈련 유형</th>
                    <th>강도</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5, 6].map(day => {
                    const entry = schedule.find(s => s.dayOfWeek === day);
                    return (
                      <tr key={day}>
                        <td className="fm-cell--name">{DAY_LABELS[day]}</td>
                        <td>
                          <select
                            className="fm-select"
                            value={entry?.trainingType ?? 'general'}
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
                    const currentDate = season?.currentDate ?? new Date().toISOString().slice(0, 10);
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
  );
}
