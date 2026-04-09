/**
 * 선수 모드 훈련 페이지
 * - 훈련 유형 선택 (솔로랭크, 챔피언 풀 확장, 팀 연습, 영상 분석, 체력 관리)
 * - 일일 3슬롯 훈련 실행
 * - 결과: 스탯 변화량 표시
 */

import { useState, useCallback, useEffect } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import type { Player, PlayerStats, PlayerMental } from '../../../types/player';
import { updatePlayerStats, updatePlayerMental, getTeamWithRoster } from '../../../db/queries';
import { isAiAvailable } from '../../../ai/gameAiService';
import { chatWithLlmJson } from '../../../ai/provider';
import { buildPlayerContext } from '../../../ai/contextBuilder';
import { MainLoopPanel } from '../../manager/components/MainLoopPanel';

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

function getOvrClass(ovr: number): string {
  if (ovr >= 90) return 'fm-ovr--elite';
  if (ovr >= 80) return 'fm-ovr--high';
  if (ovr >= 70) return 'fm-ovr--mid';
  return 'fm-ovr--low';
}

export function PlayerTraining() {
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);

  const [selectedSlots, setSelectedSlots] = useState<(string | null)[]>([null, null, null]);
  const [results, setResults] = useState<TrainingResult[]>([]);
  const [executed, setExecuted] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<{ training: string; reason: string } | null>(null);

  const userTeam = teams.find((t) => t.id === save?.userTeamId);
  const myPlayer = userTeam?.roster.find((p) => p.id === save?.userPlayerId);

  // AI 훈련 추천
  useEffect(() => {
    if (!myPlayer || !save?.userPlayerId) return;
    let cancelled = false;

    const loadRecommendation = async () => {
      try {
        const aiReady = await isAiAvailable();
        if (aiReady) {
          const ctx = await buildPlayerContext(save.userPlayerId!);
          const result = await chatWithLlmJson<{ training: string; reason: string }>(
            `당신은 프로 LoL 선수의 개인 코치입니다. 이 선수에게 오늘 가장 필요한 훈련을 추천하세요.

[선수 상태]
${ctx}

훈련 유형: 솔로랭크, 챔피언 풀 확장, 팀 연습, 영상 분석, 체력 관리
JSON: {"training": "훈련 유형명", "reason": "추천 이유 (30자 이내)"}`,
          );
          if (!cancelled) setAiRecommendation(result);
        } else {
          // 폴백: 가장 낮은 스탯 기반 추천
          const stats = myPlayer.stats;
          const entries: [string, number][] = [
            ['mechanical', stats.mechanical], ['gameSense', stats.gameSense],
            ['teamwork', stats.teamwork], ['consistency', stats.consistency],
            ['laning', stats.laning], ['aggression', stats.aggression],
          ];
          entries.sort((a, b) => a[1] - b[1]);
          const weakest = entries[0][0];
          const recommendMap: Record<string, { training: string; reason: string }> = {
            mechanical: { training: '솔로랭크', reason: '기계적 숙련도가 부족합니다' },
            gameSense: { training: '영상 분석', reason: '게임 이해도를 높여야 합니다' },
            teamwork: { training: '팀 연습', reason: '팀워크 향상이 필요합니다' },
            consistency: { training: '영상 분석', reason: '일관성을 높여야 합니다' },
            laning: { training: '솔로랭크', reason: '라인전 능력이 부족합니다' },
            aggression: { training: '솔로랭크', reason: '공격성을 키워야 합니다' },
          };
          if (!cancelled) setAiRecommendation(recommendMap[weakest] ?? null);
        }
      } catch { /* AI 실패 무시 */ }
    };

    loadRecommendation();
    return () => { cancelled = true; };
  }, [myPlayer, save?.userPlayerId]);

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
    return <p className="fm-text-secondary fm-text-md">데이터를 불러오는 중...</p>;
  }

  const ovr = getOvr(myPlayer);
  const filledCount = selectedSlots.filter((s) => s !== null).length;
  const firstSelectedSlot = selectedSlots.find((slotId) => slotId !== null);
  const primaryTrainingLabel = firstSelectedSlot
    ? TRAINING_TYPES.find((training) => training.id === firstSelectedSlot)?.name ?? '선택됨'
    : '미선택';

  return (
    <div>
      <div className="fm-page-header">
        <div>
          <h1 className="fm-page-title">훈련</h1>
        </div>
        <div className="fm-flex fm-items-center fm-gap-md">
          <span className="fm-text-xl fm-font-semibold fm-text-primary">{myPlayer.name}</span>
          <span className={`fm-ovr ${getOvrClass(ovr)} fm-text-lg`}>OVR {ovr}</span>
        </div>
      </div>

      <MainLoopPanel
        eyebrow="선수 루프"
        title="오늘 루틴과 추천 훈련을 먼저 읽는 훈련 허브"
        subtitle="슬롯 수, 핵심 훈련, AI 추천을 먼저 보고 아래에서 오늘 훈련을 확정할 수 있게 정리했습니다."
        insights={[
          {
            label: '오늘 루틴',
            value: executed ? '훈련 완료' : `${filledCount}/${MAX_SLOTS} 슬롯`,
            detail: executed ? '오늘 훈련 결과가 아래에 기록되어 있습니다.' : '최대 3개의 슬롯으로 오늘 루틴을 구성합니다.',
            tone: executed ? 'success' : 'accent',
          },
          {
            label: '핵심 훈련',
            value: primaryTrainingLabel,
            detail: primaryTrainingLabel === '미선택' ? '먼저 하나의 주력 훈련부터 고르면 루틴이 빨리 읽힙니다.' : '첫 선택 훈련이 오늘 성장 방향을 가장 잘 보여줍니다.',
            tone: primaryTrainingLabel === '미선택' ? 'warning' : 'accent',
          },
          {
            label: 'AI 추천',
            value: aiRecommendation?.training ?? '수동 선택',
            detail: aiRecommendation?.reason ?? '직접 오늘 성장 방향을 고르는 단계입니다.',
            tone: aiRecommendation ? 'success' : 'neutral',
          },
          {
            label: '다음 액션',
            value: executed ? '결과 확인' : '슬롯 확정',
            detail: executed ? '결과를 확인한 뒤 다음 루틴을 다시 설계하면 됩니다.' : '슬롯을 채운 뒤 훈련 실행으로 오늘 루틴을 확정하세요.',
            tone: 'accent',
          },
        ]}
        actions={[
          { label: '훈련 실행', onClick: () => void handleExecute(), variant: 'primary', disabled: filledCount === 0 || executed },
          { label: '초기화', onClick: handleReset, disabled: !executed && filledCount === 0 },
        ]}
        note={`현재 OVR ${ovr}. 오늘은 ${aiRecommendation?.training ?? '직접 설계한 루틴'} 중심으로 성장 포인트를 쌓는 흐름입니다.`}
      />

      {/* AI 훈련 추천 */}
      {aiRecommendation && !executed && (
        <div className="fm-alert fm-alert--success">
          <span className="fm-alert__icon">AI</span>
          <span className="fm-alert__text">
            <strong>{aiRecommendation.training}</strong> &mdash; {aiRecommendation.reason}
          </span>
          <button
            className="fm-btn fm-btn--success fm-btn--sm"
            onClick={() => {
              const match = TRAINING_TYPES.find(t => t.name === aiRecommendation.training);
              if (match) {
                const nextEmpty = selectedSlots.findIndex(s => s === null);
                if (nextEmpty !== -1) handleSelectTraining(nextEmpty, match.id);
              }
            }}
          >
            적용
          </button>
        </div>
      )}

      {/* 훈련 슬롯 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">일일 훈련 슬롯 ({filledCount}/{MAX_SLOTS})</span>
          <div className="fm-panel__actions">
            <button
              className="fm-btn fm-btn--primary"
              onClick={handleExecute}
              disabled={filledCount === 0 || executed}
            >
              훈련 실행
            </button>
            {executed && (
              <button className="fm-btn" onClick={handleReset}>
                초기화
              </button>
            )}
          </div>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--3">
            {selectedSlots.map((slotId, index) => {
              const training = slotId ? TRAINING_TYPES.find((t) => t.id === slotId) : null;
              return (
                <div key={index} className="fm-card fm-text-center">
                  <div className="fm-card__title">슬롯 {index + 1}</div>
                  {training ? (
                    <span className="fm-text-lg fm-font-semibold fm-text-accent">{training.name}</span>
                  ) : (
                    <span className="fm-text-md fm-text-muted">미선택</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 훈련 결과 */}
      {results.length > 0 && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">훈련 결과</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex-col fm-gap-sm">
              {results.map((result) => (
                <div key={result.slotIndex} className="fm-card fm-card--highlight">
                  <div className="fm-flex fm-items-center fm-gap-md">
                    <span className="fm-text-lg fm-font-semibold fm-text-primary" style={{ minWidth: '100px' }}>
                      {result.trainingName}
                    </span>
                    <div className="fm-flex fm-gap-md fm-flex-wrap">
                      {result.changes.map((change) => (
                        <span key={change.label} className="fm-text-md fm-text-secondary">
                          {change.label}{' '}
                          <span className="fm-text-success fm-font-semibold">+{change.amount}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 훈련 유형 선택 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">훈련 유형</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--2">
            {TRAINING_TYPES.map((training) => {
              // 현재 비어있는 첫 번째 슬롯 찾기
              const nextEmptySlot = selectedSlots.findIndex((s) => s === null);
              // 이미 선택된 슬롯이 있는지
              const selectedSlotIndex = selectedSlots.indexOf(training.id);
              const isSelected = selectedSlotIndex !== -1;

              return (
                <div
                  key={training.id}
                  className={`fm-card fm-card--clickable ${isSelected ? 'fm-card--highlight' : ''}`}
                  style={{ cursor: executed ? 'default' : 'pointer' }}
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
                  <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
                    <span className="fm-text-lg fm-font-semibold fm-text-primary">{training.name}</span>
                    {isSelected && (
                      <span className="fm-badge fm-badge--accent">슬롯 {selectedSlotIndex + 1}</span>
                    )}
                  </div>
                  <p className="fm-text-sm fm-text-muted fm-mb-md">{training.description}</p>
                  <div className="fm-flex-col fm-gap-xs">
                    {training.effects.map((effect) => (
                      <div key={effect.stat} className="fm-info-row">
                        <span className="fm-info-row__label">{effect.label}</span>
                        <span className="fm-text-success fm-font-semibold fm-text-sm">{effect.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
