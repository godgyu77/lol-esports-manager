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
import type { Player } from '../../../types/player';

type Tab = 'schedule' | 'individual' | 'logs' | 'mentoring';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const TRAINING_TYPES: TrainingType[] = ['general', 'laning', 'teamfight', 'macro', 'champion_pool', 'mental', 'physical'];
const INTENSITY_OPTIONS: TrainingIntensity[] = ['light', 'normal', 'intense'];
const INTENSITY_LABELS: Record<TrainingIntensity, string> = { light: '가벼운', normal: '보통', intense: '강도 높은' };
const STAT_LABELS: Record<TrainableStat, string> = {
  mechanical: '기계적', gameSense: '판단력', teamwork: '팀워크',
  consistency: '일관성', laning: '라인전', aggression: '공격성',
};
const POSITION_LABELS: Record<string, string> = {
  top: 'TOP', jungle: 'JGL', mid: 'MID', adc: 'ADC', support: 'SUP',
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

  if (!save) return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  if (isLoading) return <p style={{ color: '#6a6a7a' }}>훈련 정보를 불러오는 중...</p>;

  return (
    <div>
      <h1 style={styles.title}>훈련 관리</h1>

      {message && (
        <div style={{
          ...styles.message,
          borderColor: message.type === 'success' ? '#2ecc71' : '#e74c3c',
          color: message.type === 'success' ? '#2ecc71' : '#e74c3c',
        }}>
          {message.text}
        </div>
      )}

      <div style={styles.tabs}>
        <button style={{ ...styles.tab, ...(tab === 'schedule' ? styles.activeTab : {}) }}
                onClick={() => setTab('schedule')}>주간 스케줄</button>
        <button style={{ ...styles.tab, ...(tab === 'individual' ? styles.activeTab : {}) }}
                onClick={() => setTab('individual')}>개별 훈련</button>
        <button style={{ ...styles.tab, ...(tab === 'logs' ? styles.activeTab : {}) }}
                onClick={() => setTab('logs')}>훈련 이력</button>
        <button style={{ ...styles.tab, ...(tab === 'mentoring' ? styles.activeTab : {}) }}
                onClick={() => setTab('mentoring')}>멘토링</button>
      </div>

      {/* 탭 1: 주간 스케줄 */}
      {tab === 'schedule' && (
        <div>
          <p style={styles.hint}>경기일/일요일(휴식)을 제외한 요일별 훈련을 설정합니다.</p>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>요일</th>
                <th style={styles.th}>훈련 유형</th>
                <th style={styles.th}>강도</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6].map(day => {
                const entry = schedule.find(s => s.dayOfWeek === day);
                return (
                  <tr key={day} style={styles.tr}>
                    <td style={{ ...styles.td, fontWeight: 600, color: '#e0e0e0' }}>
                      {DAY_LABELS[day]}
                    </td>
                    <td style={styles.td}>
                      <select
                        style={styles.select}
                        value={entry?.trainingType ?? 'general'}
                        onChange={e => handleScheduleChange(day, 'type', e.target.value)}
                      >
                        {TRAINING_TYPES.map(t => (
                          <option key={t} value={t}>{TRAINING_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </td>
                    <td style={styles.td}>
                      <select
                        style={styles.select}
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

          <div style={styles.infoBox}>
            <h3 style={styles.infoTitle}>강도별 효과</h3>
            <div style={styles.infoGrid}>
              <div><strong style={{ color: '#4ecdc4' }}>가벼운:</strong> 스탯 성장 x0.5 / 스태미나 -4 / 폼 +2</div>
              <div><strong style={{ color: '#c89b3c' }}>보통:</strong> 스탯 성장 x1.0 / 스태미나 -8 / 폼 +5</div>
              <div><strong style={{ color: '#ff6b6b' }}>강도 높은:</strong> 스탯 성장 x1.5 / 스태미나 -15 / 폼 +8</div>
            </div>
          </div>
        </div>
      )}

      {/* 탭 2: 개별 훈련 */}
      {tab === 'individual' && (
        <div>
          <p style={styles.hint}>선수별 특화 훈련을 배정합니다. 미배정 시 팀 스케줄을 따릅니다.</p>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>포지션</th>
                <th style={styles.th}>선수</th>
                <th style={styles.th}>훈련 유형</th>
                <th style={styles.th}>집중 스탯</th>
              </tr>
            </thead>
            <tbody>
              {roster.map(player => {
                const assignment = assignments.find(a => a.playerId === player.id);
                return (
                  <tr key={player.id} style={styles.tr}>
                    <td style={{ ...styles.td, color: '#c89b3c', fontWeight: 600 }}>
                      {POSITION_LABELS[player.position]}
                    </td>
                    <td style={{ ...styles.td, fontWeight: 500, color: '#e0e0e0' }}>
                      {player.name}
                    </td>
                    <td style={styles.td}>
                      <select
                        style={styles.select}
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
                    <td style={styles.td}>
                      <select
                        style={styles.select}
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
      )}

      {/* 탭 3: 훈련 이력 */}
      {tab === 'logs' && (
        <div>
          {logs.length === 0 ? (
            <p style={styles.empty}>훈련 이력이 없습니다.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>날짜</th>
                  <th style={styles.th}>선수</th>
                  <th style={styles.th}>훈련</th>
                  <th style={styles.th}>변화 스탯</th>
                  <th style={styles.th}>변화량</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={idx} style={styles.tr}>
                    <td style={styles.td}>{log.trainingDate}</td>
                    <td style={{ ...styles.td, fontWeight: 500, color: '#e0e0e0' }}>
                      {getPlayerName(log.playerId)}
                    </td>
                    <td style={styles.td}>
                      {TRAINING_TYPE_LABELS[log.trainingType as TrainingType] ?? log.trainingType}
                    </td>
                    <td style={styles.td}>
                      {log.statChanged ? (STAT_LABELS[log.statChanged as TrainableStat] ?? log.statChanged) : '-'}
                    </td>
                    <td style={{
                      ...styles.td,
                      color: log.statDelta > 0 ? '#2ecc71' : '#e74c3c',
                      fontWeight: 600,
                    }}>
                      {log.statDelta > 0 ? `+${log.statDelta.toFixed(2)}` : log.statDelta.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 탭 4: 멘토링 */}
      {tab === 'mentoring' && (
        <div>
          <p style={styles.hint}>
            시니어 선수(25세+)가 주니어 선수(22세-)를 멘토링합니다. 같은 포지션만 가능합니다.
            멘티는 멘토의 최고 스탯이 매일 +0.05 성장하고, 멘토의 팀워크가 +0.02 성장합니다.
          </p>

          {/* 현재 멘토링 쌍 */}
          <h3 style={styles.infoTitle}>현재 멘토링</h3>
          {mentoringPairs.length === 0 ? (
            <p style={styles.empty}>활성 멘토링이 없습니다.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>멘토</th>
                  <th style={styles.th}>멘티</th>
                  <th style={styles.th}>보너스 스탯</th>
                  <th style={styles.th}>일간 성장</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {mentoringPairs.map(pair => (
                  <tr key={pair.id} style={styles.tr}>
                    <td style={{ ...styles.td, fontWeight: 500, color: '#e0e0e0' }}>
                      {getPlayerName(pair.mentorId)}
                    </td>
                    <td style={{ ...styles.td, fontWeight: 500, color: '#e0e0e0' }}>
                      {getPlayerName(pair.menteeId)}
                    </td>
                    <td style={{ ...styles.td, color: '#c89b3c' }}>
                      {pair.bonusStat ? (STAT_LABELS[pair.bonusStat as TrainableStat] ?? pair.bonusStat) : '-'}
                    </td>
                    <td style={styles.td}>+{pair.dailyGrowthBonus.toFixed(2)}</td>
                    <td style={styles.td}>
                      <button
                        style={mentoringStyles.removeBtn}
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
          )}

          {/* 새 멘토링 배정 */}
          <div style={mentoringStyles.assignPanel}>
            <h3 style={styles.infoTitle}>멘토 배정</h3>
            <div style={mentoringStyles.assignRow}>
              <div style={mentoringStyles.assignField}>
                <label style={mentoringStyles.assignLabel}>멘토 (25세+)</label>
                <select
                  style={styles.select}
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
              <div style={mentoringStyles.assignField}>
                <label style={mentoringStyles.assignLabel}>멘티 (22세-)</label>
                <select
                  style={styles.select}
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
                style={mentoringStyles.assignBtn}
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

          {/* 안내 */}
          <div style={styles.infoBox}>
            <h3 style={styles.infoTitle}>멘토링 효과</h3>
            <div style={styles.infoGrid}>
              <div><strong style={{ color: '#2ecc71' }}>멘티:</strong> 멘토의 최고 스탯 +0.05/일 성장</div>
              <div><strong style={{ color: '#3498db' }}>멘토:</strong> 팀워크 +0.02/일 성장</div>
              <div><strong style={{ color: '#8a8a9a' }}>조건:</strong> 멘토 25세+, 멘티 22세-, 같은 포지션</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { fontSize: '24px', fontWeight: 700, color: '#f0e6d2', marginBottom: '16px' },
  message: {
    padding: '10px 16px', marginBottom: '12px', border: '1px solid',
    borderRadius: '6px', fontSize: '13px', background: 'rgba(255,255,255,0.02)',
  },
  tabs: { display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid #2a2a4a' },
  tab: {
    padding: '10px 20px', background: 'none', border: 'none',
    borderBottom: '2px solid transparent', color: '#6a6a7a',
    fontSize: '13px', fontWeight: 500, cursor: 'pointer',
  },
  activeTab: { color: '#c89b3c', borderBottomColor: '#c89b3c' },
  hint: { fontSize: '13px', color: '#8a8a9a', marginBottom: '16px' },
  empty: { color: '#6a6a7a', fontSize: '13px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #3a3a5c',
    color: '#6a6a7a', fontSize: '12px', fontWeight: 500,
  },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  td: { padding: '8px 10px', color: '#c0c0d0' },
  select: {
    padding: '6px 10px', background: '#0d0d1a', border: '1px solid #2a2a4a',
    borderRadius: '4px', color: '#e0e0e0', fontSize: '12px', cursor: 'pointer',
  },
  infoBox: {
    marginTop: '20px', padding: '16px', background: '#12122a',
    border: '1px solid #2a2a4a', borderRadius: '8px',
  },
  infoTitle: { fontSize: '14px', fontWeight: 600, color: '#c89b3c', marginBottom: '10px' },
  infoGrid: { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#8a8a9a' },
};

const mentoringStyles: Record<string, React.CSSProperties> = {
  removeBtn: {
    padding: '3px 10px', fontSize: '11px', fontWeight: 500,
    background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)',
    borderRadius: '4px', color: '#e74c3c', cursor: 'pointer',
  },
  assignPanel: {
    marginTop: '20px', padding: '16px', background: '#12122a',
    border: '1px solid #2a2a4a', borderRadius: '8px', marginBottom: '16px',
  },
  assignRow: {
    display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap',
  },
  assignField: {
    display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '180px',
  },
  assignLabel: {
    fontSize: '12px', fontWeight: 500, color: '#8a8a9a',
  },
  assignBtn: {
    padding: '8px 20px', fontSize: '13px', fontWeight: 600,
    background: '#c89b3c', border: 'none', borderRadius: '6px',
    color: '#0d0d1a', cursor: 'pointer', alignSelf: 'flex-end',
  },
};
