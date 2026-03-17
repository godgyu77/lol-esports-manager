/**
 * 선수 모드 훈련 페이지
 * - 훈련 유형 선택 (솔로랭크, 챔피언 풀 확장, 팀 연습, 영상 분석, 체력 관리)
 * - 일일 3슬롯 훈련 실행
 * - 결과: 스탯 변화량 표시
 */

import { useState, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import type { Player, PlayerStats, PlayerMental } from '../../../types/player';
import { updatePlayerStats, updatePlayerMental, getTeamWithRoster } from '../../../db/queries';

interface TrainingType {
  id: string;
  name: string;
  description: string;
  effects: { stat: string; label: string; amount: string }[];
}

const TRAINING_TYPES: TrainingType[] = [
  {
    id: 'solorank',
    name: '솔로랭크',
    description: '솔로 큐를 통해 개인 기량을 연마합니다.',
    effects: [
      { stat: 'mechanical', label: '기계적 숙련도', amount: '+2~4' },
      { stat: 'laning', label: '라인전', amount: '+1~3' },
      { stat: 'aggression', label: '공격성', amount: '+1~2' },
    ],
  },
  {
    id: 'champion_pool',
    name: '챔피언 풀 확장',
    description: '새로운 챔피언을 연습하여 챔피언 풀을 넓힙니다.',
    effects: [
      { stat: 'gameSense', label: '게임 이해도', amount: '+1~3' },
      { stat: 'consistency', label: '일관성', amount: '+1~2' },
    ],
  },
  {
    id: 'team_practice',
    name: '팀 연습',
    description: '팀원들과 함께 전략을 맞추고 팀 플레이를 향상시킵니다.',
    effects: [
      { stat: 'teamwork', label: '팀워크', amount: '+2~4' },
      { stat: 'gameSense', label: '게임 이해도', amount: '+1~2' },
    ],
  },
  {
    id: 'vod_review',
    name: '영상 분석',
    description: '프로 경기 영상을 분석하여 게임 이해도를 높입니다.',
    effects: [
      { stat: 'gameSense', label: '게임 이해도', amount: '+2~4' },
      { stat: 'consistency', label: '일관성', amount: '+1~3' },
    ],
  },
  {
    id: 'fitness',
    name: '체력 관리',
    description: '운동과 휴식으로 체력과 멘탈을 관리합니다.',
    effects: [
      { stat: 'stamina', label: '체력', amount: '+3~5' },
      { stat: 'morale', label: '사기', amount: '+1~3' },
    ],
  },
];

const MAX_SLOTS = 3;

interface TrainingResult {
  slotIndex: number;
  trainingName: string;
  changes: { label: string; amount: number }[];
}

function getOvr(player: Player): number {
  const s = player.stats;
  return Math.round(
    (s.mechanical + s.gameSense + s.teamwork + s.consistency + s.laning + s.aggression) / 6,
  );
}

export function PlayerTraining() {
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);

  const [selectedSlots, setSelectedSlots] = useState<(string | null)[]>([null, null, null]);
  const [results, setResults] = useState<TrainingResult[]>([]);
  const [executed, setExecuted] = useState(false);

  const userTeam = teams.find((t) => t.id === save?.userTeamId);
  const myPlayer = userTeam?.roster.find((p) => p.id === save?.userPlayerId);

  const handleSelectTraining = useCallback((slotIndex: number, trainingId: string) => {
    if (executed) return;
    setSelectedSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = next[slotIndex] === trainingId ? null : trainingId;
      return next;
    });
  }, [executed]);

  const handleExecute = useCallback(async () => {
    if (executed || !myPlayer) return;

    const filledSlots = selectedSlots.filter((s) => s !== null);
    if (filledSlots.length === 0) return;

    // 스탯/멘탈 키 분류
    const STATS_KEYS: Set<string> = new Set(['mechanical', 'gameSense', 'teamwork', 'consistency', 'laning', 'aggression']);
    const MENTAL_KEYS: Set<string> = new Set(['mental', 'stamina', 'morale']);

    // 훈련 결과 시뮬레이션 (랜덤 스탯 변화)
    const newResults: TrainingResult[] = [];
    // 스탯 변화량 누적 (DB 반영용)
    const statDeltas: Record<string, number> = {};

    selectedSlots.forEach((trainingId, index) => {
      if (!trainingId) return;

      const training = TRAINING_TYPES.find((t) => t.id === trainingId);
      if (!training) return;

      const changes = training.effects.map((effect) => {
        // amount 파싱: "+2~4" → 2~4 사이 랜덤
        const match = effect.amount.match(/\+(\d+)~(\d+)/);
        const min = match ? parseInt(match[1]) : 1;
        const max = match ? parseInt(match[2]) : 3;
        const amount = Math.floor(Math.random() * (max - min + 1)) + min;

        // 변화량 누적
        statDeltas[effect.stat] = (statDeltas[effect.stat] || 0) + amount;

        return { label: effect.label, amount };
      });

      newResults.push({
        slotIndex: index,
        trainingName: training.name,
        changes,
      });
    });

    setResults(newResults);
    setExecuted(true);

    // DB에 훈련 결과 반영 (스탯 상한 100)
    const clamp = (value: number) => Math.min(100, Math.max(0, value));

    // 스탯 업데이트 여부 확인
    const hasStatChanges = Object.keys(statDeltas).some((k) => STATS_KEYS.has(k));
    const hasMentalChanges = Object.keys(statDeltas).some((k) => MENTAL_KEYS.has(k));

    try {
      if (hasStatChanges) {
        const newStats: PlayerStats = {
          mechanical: clamp(myPlayer.stats.mechanical + (statDeltas['mechanical'] || 0)),
          gameSense: clamp(myPlayer.stats.gameSense + (statDeltas['gameSense'] || 0)),
          teamwork: clamp(myPlayer.stats.teamwork + (statDeltas['teamwork'] || 0)),
          consistency: clamp(myPlayer.stats.consistency + (statDeltas['consistency'] || 0)),
          laning: clamp(myPlayer.stats.laning + (statDeltas['laning'] || 0)),
          aggression: clamp(myPlayer.stats.aggression + (statDeltas['aggression'] || 0)),
        };
        await updatePlayerStats(myPlayer.id, newStats);
      }

      if (hasMentalChanges) {
        const newMental: PlayerMental = {
          mental: clamp(myPlayer.mental.mental + (statDeltas['mental'] || 0)),
          stamina: clamp(myPlayer.mental.stamina + (statDeltas['stamina'] || 0)),
          morale: clamp(myPlayer.mental.morale + (statDeltas['morale'] || 0)),
        };
        await updatePlayerMental(myPlayer.id, newMental);
      }

      // 스토어 새로고침: 팀 데이터 다시 로드
      if (userTeam) {
        const refreshedTeam = await getTeamWithRoster(userTeam.id);
        if (refreshedTeam) {
          const updatedTeams = teams.map((t) => (t.id === userTeam.id ? refreshedTeam : t));
          useGameStore.getState().setTeams(updatedTeams);
        }
      }
    } catch (err) {
      console.error('훈련 결과 DB 저장 실패:', err);
    }
  }, [selectedSlots, executed, myPlayer, userTeam, teams]);

  const handleReset = useCallback(() => {
    setSelectedSlots([null, null, null]);
    setResults([]);
    setExecuted(false);
  }, []);

  if (!myPlayer) {
    return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  }

  const ovr = getOvr(myPlayer);
  const filledCount = selectedSlots.filter((s) => s !== null).length;

  return (
    <div>
      <h1 style={styles.title}>훈련</h1>

      {/* 선수 요약 */}
      <div style={styles.playerSummary}>
        <span style={styles.playerName}>{myPlayer.name}</span>
        <span style={styles.ovrBadge}>OVR {ovr}</span>
      </div>

      {/* 훈련 슬롯 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>일일 훈련 슬롯 ({filledCount}/{MAX_SLOTS})</h2>
        <div style={styles.slotsRow}>
          {selectedSlots.map((slotId, index) => {
            const training = slotId ? TRAINING_TYPES.find((t) => t.id === slotId) : null;
            return (
              <div key={index} style={styles.slot}>
                <span style={styles.slotLabel}>슬롯 {index + 1}</span>
                {training ? (
                  <span style={styles.slotValue}>{training.name}</span>
                ) : (
                  <span style={styles.slotEmpty}>미선택</span>
                )}
              </div>
            );
          })}
        </div>

        <div style={styles.actionRow}>
          <button
            style={{
              ...styles.executeBtn,
              opacity: filledCount === 0 || executed ? 0.4 : 1,
              cursor: filledCount === 0 || executed ? 'default' : 'pointer',
            }}
            onClick={handleExecute}
            disabled={filledCount === 0 || executed}
          >
            훈련 실행
          </button>
          {executed && (
            <button style={styles.resetBtn} onClick={handleReset}>
              초기화
            </button>
          )}
        </div>
      </div>

      {/* 훈련 결과 */}
      {results.length > 0 && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>훈련 결과</h2>
          <div style={styles.resultsList}>
            {results.map((result) => (
              <div key={result.slotIndex} style={styles.resultItem}>
                <span style={styles.resultTrainingName}>{result.trainingName}</span>
                <div style={styles.resultChanges}>
                  {result.changes.map((change) => (
                    <span key={change.label} style={styles.resultChange}>
                      {change.label}{' '}
                      <span style={styles.resultPlus}>+{change.amount}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 훈련 유형 선택 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>훈련 유형</h2>
        <div style={styles.trainingGrid}>
          {TRAINING_TYPES.map((training) => {
            // 현재 비어있는 첫 번째 슬롯 찾기
            const nextEmptySlot = selectedSlots.findIndex((s) => s === null);
            // 이미 선택된 슬롯이 있는지
            const selectedSlotIndex = selectedSlots.indexOf(training.id);
            const isSelected = selectedSlotIndex !== -1;

            return (
              <div
                key={training.id}
                style={{
                  ...styles.trainingCard,
                  ...(isSelected ? styles.trainingCardSelected : {}),
                  cursor: executed ? 'default' : 'pointer',
                }}
                onClick={() => {
                  if (executed) return;
                  if (isSelected) {
                    // 선택 해제
                    handleSelectTraining(selectedSlotIndex, training.id);
                  } else if (nextEmptySlot !== -1) {
                    // 다음 빈 슬롯에 할당
                    handleSelectTraining(nextEmptySlot, training.id);
                  }
                }}
              >
                <div style={styles.trainingHeader}>
                  <span style={styles.trainingName}>{training.name}</span>
                  {isSelected && (
                    <span style={styles.slotBadge}>슬롯 {selectedSlotIndex + 1}</span>
                  )}
                </div>
                <p style={styles.trainingDesc}>{training.description}</p>
                <div style={styles.effectList}>
                  {training.effects.map((effect) => (
                    <div key={effect.stat} style={styles.effectItem}>
                      <span style={styles.effectLabel}>{effect.label}</span>
                      <span style={styles.effectAmount}>{effect.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '24px',
  },
  playerSummary: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  playerName: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#f0e6d2',
  },
  ovrBadge: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#a0d0ff',
    background: 'rgba(160,208,255,0.1)',
    padding: '3px 10px',
    borderRadius: '4px',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a2a4a',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '16px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#c89b3c',
    marginBottom: '16px',
  },
  slotsRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  slot: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '14px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
  },
  slotLabel: {
    fontSize: '11px',
    color: '#6a6a7a',
    fontWeight: 600,
  },
  slotValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#c89b3c',
  },
  slotEmpty: {
    fontSize: '13px',
    color: '#3a3a5c',
  },
  actionRow: {
    display: 'flex',
    gap: '10px',
  },
  executeBtn: {
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#0d0d1a',
    background: '#c89b3c',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  resetBtn: {
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#8a8a9a',
    background: 'transparent',
    border: '1px solid #3a3a5c',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  resultsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  resultItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px',
    background: 'rgba(80,200,120,0.05)',
    border: '1px solid rgba(80,200,120,0.15)',
    borderRadius: '8px',
  },
  resultTrainingName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#e0e0e0',
    minWidth: '100px',
  },
  resultChanges: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
  },
  resultChange: {
    fontSize: '13px',
    color: '#8a8a9a',
  },
  resultPlus: {
    color: '#50c878',
    fontWeight: 600,
  },
  trainingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
  },
  trainingCard: {
    padding: '16px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    transition: 'all 0.2s',
  },
  trainingCardSelected: {
    border: '1px solid #c89b3c',
    background: 'rgba(200,155,60,0.08)',
  },
  trainingHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  trainingName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#f0e6d2',
  },
  slotBadge: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#c89b3c',
    background: 'rgba(200,155,60,0.15)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  trainingDesc: {
    fontSize: '12px',
    color: '#8a8a9a',
    marginBottom: '12px',
    lineHeight: '1.4',
  },
  effectList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  effectItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  effectLabel: {
    fontSize: '12px',
    color: '#6a6a7a',
  },
  effectAmount: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#50c878',
  },
};
