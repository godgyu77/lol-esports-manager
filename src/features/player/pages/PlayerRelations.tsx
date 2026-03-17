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

function getSynergyDescription(affinity: number): { text: string; color: string } {
  if (affinity >= 80) return { text: '최고 시너지 — 팀워크 +5, 일관성 +3', color: '#ffd700' };
  if (affinity >= 60) return { text: '좋은 시너지 — 팀워크 +3, 일관성 +1', color: '#50c878' };
  if (affinity >= 40) return { text: '보통 — 특별한 효과 없음', color: '#8a8a9a' };
  if (affinity >= 20) return { text: '서먹함 — 팀워크 -1', color: '#c89b3c' };
  return { text: '갈등 — 팀워크 -3, 사기 -2', color: '#dc3c3c' };
}

function getAffinityBarColor(value: number): string {
  if (value >= 70) return '#50c878';
  if (value >= 40) return '#c89b3c';
  return '#dc3c3c';
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
    return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  }

  // 1군 위주 팀원 (본인 제외)
  const teammates = userTeam.roster.filter((p) => p.id !== myPlayer.id);
  const mainTeammates = teammates.filter(
    (p) => (p as { division?: string }).division === 'main',
  );
  const displayTeammates = mainTeammates.length > 0 ? mainTeammates : teammates.slice(0, 5);

  return (
    <div>
      <h1 style={styles.title}>팀원 관계</h1>

      {/* 상호작용 잔여 횟수 */}
      <div style={styles.interactionCounter}>
        <span style={styles.counterLabel}>오늘 남은 상호작용</span>
        <span style={styles.counterValue}>
          {MAX_INTERACTIONS - interactionsUsed} / {MAX_INTERACTIONS}
        </span>
      </div>

      {/* 최근 행동 알림 */}
      {lastAction && (
        <div style={styles.actionNotice}>{lastAction}</div>
      )}

      {/* 팀원 목록 */}
      <div style={styles.teammateList}>
        {displayTeammates.map((teammate) => {
          const affinity = affinities[teammate.id] ?? 50;
          const synergy = getSynergyDescription(affinity);
          const ovr = getOvr(teammate);

          return (
            <div key={teammate.id} style={styles.card}>
              {/* 팀원 정보 */}
              <div style={styles.teammateHeader}>
                <div style={styles.teammateInfo}>
                  <span style={styles.posTag}>
                    {POSITION_LABELS[teammate.position] ?? teammate.position}
                  </span>
                  <span style={styles.teammateName}>{teammate.name}</span>
                  <span style={styles.teammateOvr}>OVR {ovr}</span>
                </div>
              </div>

              {/* 친밀도 바 */}
              <div style={styles.affinityRow}>
                <span style={styles.affinityLabel}>친밀도</span>
                <div style={styles.affinityBarBg}>
                  <div
                    style={{
                      ...styles.affinityBarFill,
                      width: `${affinity}%`,
                      background: getAffinityBarColor(affinity),
                    }}
                  />
                </div>
                <span style={styles.affinityValue}>{affinity}</span>
              </div>

              {/* 시너지 효과 */}
              <div style={styles.synergyRow}>
                <span style={{ fontSize: '12px', color: synergy.color }}>
                  {synergy.text}
                </span>
              </div>

              {/* 상호작용 버튼 */}
              <div style={styles.interactionBtns}>
                {INTERACTIONS.map((interaction) => (
                  <button
                    key={interaction.id}
                    style={{
                      ...styles.interactionBtn,
                      opacity: interactionsUsed >= MAX_INTERACTIONS ? 0.4 : 1,
                      cursor: interactionsUsed >= MAX_INTERACTIONS ? 'default' : 'pointer',
                    }}
                    onClick={() => handleInteract(teammate.id, interaction)}
                    disabled={interactionsUsed >= MAX_INTERACTIONS}
                    title={interaction.description}
                  >
                    {interaction.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
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
  interactionCounter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    marginBottom: '12px',
  },
  counterLabel: {
    fontSize: '13px',
    color: '#8a8a9a',
  },
  counterValue: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#c89b3c',
  },
  actionNotice: {
    padding: '10px 16px',
    marginBottom: '12px',
    border: '1px solid rgba(80,200,120,0.2)',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#50c878',
    background: 'rgba(80,200,120,0.05)',
  },
  teammateList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a2a4a',
    borderRadius: '10px',
    padding: '16px 20px',
  },
  teammateHeader: {
    marginBottom: '12px',
  },
  teammateInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  posTag: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#c89b3c',
    background: 'rgba(200,155,60,0.1)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  teammateName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#e0e0e0',
  },
  teammateOvr: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#a0d0ff',
  },
  affinityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
  },
  affinityLabel: {
    fontSize: '12px',
    color: '#6a6a7a',
    minWidth: '44px',
  },
  affinityBarBg: {
    flex: 1,
    height: '8px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  affinityBarFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  affinityValue: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#8a8a9a',
    minWidth: '30px',
    textAlign: 'right',
  },
  synergyRow: {
    marginBottom: '12px',
    padding: '6px 10px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '4px',
  },
  interactionBtns: {
    display: 'flex',
    gap: '8px',
  },
  interactionBtn: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#e0e0e0',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #3a3a5c',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};
