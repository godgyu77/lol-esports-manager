/**
 * 선수 모드 팀원 관계 페이지
 * - 팀원과의 친밀도 표시 (0~100)
 * - 상호작용: 대화, 함께 식사, 듀오 연습
 * - 친밀도에 따른 시너지 효과 설명
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getPlayerRelations, upsertPlayerRelation } from '../../../db/queries';
import type { Player } from '../../../types/player';

const POSITION_LABELS: Record<string, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: '원딜',
  support: '서포터',
};

interface InteractionType {
  id: string;
  name: string;
  description: string;
  effect: number; // 친밀도 변화 기본값
}

const INTERACTIONS: InteractionType[] = [
  {
    id: 'talk',
    name: '대화',
    description: '가벼운 대화를 나눕니다.',
    effect: 5,
  },
  {
    id: 'meal',
    name: '함께 식사',
    description: '같이 식사하며 친해집니다.',
    effect: 8,
  },
  {
    id: 'duo',
    name: '듀오 연습',
    description: '듀오 큐를 돌며 호흡을 맞춥니다.',
    effect: 12,
  },
];

function getSynergyDescription(affinity: number): { text: string; colorClass: string } {
  if (affinity >= 80) return { text: '최고 시너지 -- 팀워크 +5, 일관성 +3', colorClass: 'fm-text-warning' };
  if (affinity >= 60) return { text: '좋은 시너지 -- 팀워크 +3, 일관성 +1', colorClass: 'fm-text-success' };
  if (affinity >= 40) return { text: '보통 -- 특별한 효과 없음', colorClass: 'fm-text-muted' };
  if (affinity >= 20) return { text: '서먹함 -- 팀워크 -1', colorClass: 'fm-text-accent' };
  return { text: '갈등 -- 팀워크 -3, 사기 -2', colorClass: 'fm-text-danger' };
}

function getAffinityBarClass(value: number): string {
  if (value >= 70) return 'fm-bar__fill--green';
  if (value >= 40) return 'fm-bar__fill--accent';
  return 'fm-bar__fill--red';
}

function getOvr(player: Player): number {
  const s = player.stats;
  return Math.round(
    (s.mechanical + s.gameSense + s.teamwork + s.consistency + s.laning + s.aggression) / 6,
  );
}

export function PlayerRelations() {
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);
  const currentDate = useGameStore((s) => s.currentDate);

  const userTeam = teams.find((t) => t.id === save?.userTeamId);
  const myPlayer = userTeam?.roster.find((p) => p.id === save?.userPlayerId);

  // 팀원별 친밀도
  const [affinities, setAffinities] = useState<Record<string, number>>({});
  const [dbLoaded, setDbLoaded] = useState(false);

  // DB에서 친밀도 로드
  useEffect(() => {
    if (!myPlayer) return;
    let cancelled = false;

    const load = async () => {
      const relations = await getPlayerRelations(myPlayer.id);
      if (cancelled) return;

      const loaded: Record<string, number> = {};
      for (const rel of relations) {
        loaded[rel.targetPlayerId] = rel.affinity;
      }
      // DB에 없는 팀원은 기본값 50
      if (userTeam) {
        for (const p of userTeam.roster) {
          if (p.id === myPlayer.id) continue;
          if (loaded[p.id] === undefined) loaded[p.id] = 50;
        }
      }
      setAffinities(loaded);
      setDbLoaded(true);
    };

    load();
    return () => { cancelled = true; };
  }, [myPlayer?.id, userTeam]);

  // 오늘 상호작용 횟수 제한 (하루 3회)
  const [interactionsUsed, setInteractionsUsed] = useState(0);
  const [lastAction, setLastAction] = useState<string | null>(null);
  // 날짜 변경 시 상호작용 횟수 초기화
  const prevDateRef = useRef(currentDate);
  useEffect(() => {
    if (prevDateRef.current !== currentDate) {
      setInteractionsUsed(0);
      prevDateRef.current = currentDate;
    }
  }, [currentDate]);

  const MAX_INTERACTIONS = 3;

  const handleInteract = useCallback((playerId: string, interaction: InteractionType) => {
    if (interactionsUsed >= MAX_INTERACTIONS || !myPlayer) return;

    // 랜덤 변동 (-2 ~ +2)
    const randomBonus = Math.floor(Math.random() * 5) - 2;
    const change = interaction.effect + randomBonus;

    setAffinities((prev) => {
      const newAffinity = Math.max(0, Math.min(100, (prev[playerId] ?? 50) + change));
      // DB에 저장
      upsertPlayerRelation(myPlayer.id, playerId, newAffinity, currentDate ?? null);
      return { ...prev, [playerId]: newAffinity };
    });

    setInteractionsUsed((prev) => prev + 1);

    const targetName = userTeam?.roster.find((p) => p.id === playerId)?.name ?? '선수';
    setLastAction(`${targetName}와(과) ${interaction.name} → 친밀도 +${change}`);
  }, [interactionsUsed, userTeam, myPlayer, currentDate]);

  if (!userTeam || !myPlayer || !dbLoaded) {
    return <p className="fm-text-muted fm-p-lg">데이터를 불러오는 중...</p>;
  }

  // 1군 위주 팀원 (본인 제외)
  const teammates = userTeam.roster.filter((p) => p.id !== myPlayer.id);
  const mainTeammates = teammates.filter(
    (p) => (p as { division?: string }).division === 'main',
  );
  const displayTeammates = mainTeammates.length > 0 ? mainTeammates : teammates.slice(0, 5);

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">팀원 관계</h1>
      </div>

      {/* 상호작용 잔여 횟수 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__body fm-flex fm-justify-between fm-items-center">
          <span className="fm-text-md fm-text-secondary">오늘 남은 상호작용</span>
          <span className="fm-text-xl fm-font-semibold fm-text-accent">
            {MAX_INTERACTIONS - interactionsUsed} / {MAX_INTERACTIONS}
          </span>
        </div>
      </div>

      {/* 최근 행동 알림 */}
      {lastAction && (
        <div className="fm-alert fm-alert--success fm-mb-md">
          <span className="fm-alert__text">{lastAction}</span>
        </div>
      )}

      {/* 팀원 목록 */}
      <div className="fm-flex-col fm-gap-md">
        {displayTeammates.map((teammate) => {
          const affinity = affinities[teammate.id] ?? 50;
          const synergy = getSynergyDescription(affinity);
          const ovr = getOvr(teammate);

          return (
            <div key={teammate.id} className="fm-panel">
              <div className="fm-panel__body fm-flex-col fm-gap-md">
                {/* 팀원 정보 */}
                <div className="fm-flex fm-items-center fm-gap-md">
                  <span className="fm-badge fm-badge--accent">
                    {POSITION_LABELS[teammate.position] ?? teammate.position}
                  </span>
                  <span className="fm-text-lg fm-font-semibold fm-text-primary">{teammate.name}</span>
                  <span className="fm-text-md fm-font-semibold fm-text-info">OVR {ovr}</span>
                </div>

                {/* 친밀도 바 */}
                <div className="fm-flex fm-items-center fm-gap-md">
                  <span className="fm-text-sm fm-text-muted" style={{ minWidth: 44 }}>친밀도</span>
                  <div className="fm-bar fm-flex-1">
                    <div className="fm-bar__track" style={{ height: 8 }}>
                      <div
                        className={`fm-bar__fill ${getAffinityBarClass(affinity)}`}
                        style={{ width: `${affinity}%` }}
                      />
                    </div>
                    <span className="fm-bar__value">{affinity}</span>
                  </div>
                </div>

                {/* 시너지 효과 */}
                <div className="fm-p-sm" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)' }}>
                  <span className={`fm-text-sm ${synergy.colorClass}`}>
                    {synergy.text}
                  </span>
                </div>

                {/* 상호작용 버튼 */}
                <div className="fm-flex fm-gap-sm">
                  {INTERACTIONS.map((interaction) => (
                    <button
                      key={interaction.id}
                      className="fm-btn fm-flex-1"
                      onClick={() => handleInteract(teammate.id, interaction)}
                      disabled={interactionsUsed >= MAX_INTERACTIONS}
                      title={interaction.description}
                    >
                      {interaction.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
