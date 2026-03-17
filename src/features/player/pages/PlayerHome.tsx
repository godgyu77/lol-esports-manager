/**
 * 선수 모드 대시보드
 * - 내 선수 정보 (이름, 포지션, 나이, OVR, 스탯)
 * - 오늘의 일정
 * - 현재 컨디션 (체력, 사기, 폼)
 * - 팀 내 위치 (1군/2군, 경쟁자)
 */

import { useEffect, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getTeamConditions } from '../../../db/queries';
import type { Player } from '../../../types/player';

const POSITION_LABELS: Record<string, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: '원딜',
  support: '서포터',
};

const DAY_TYPE_LABELS: Record<string, string> = {
  training: '훈련일',
  scrim: '스크림일',
  match: '경기일',
  rest: '휴식일',
};

const STAT_LABELS: Record<string, string> = {
  mechanical: '기계적 숙련도',
  gameSense: '게임 이해도',
  teamwork: '팀워크',
  consistency: '일관성',
  laning: '라인전',
  aggression: '공격성',
};

function getOvr(player: Player): number {
  const s = player.stats;
  return Math.round(
    (s.mechanical + s.gameSense + s.teamwork + s.consistency + s.laning + s.aggression) / 6,
  );
}

function getBarColor(value: number): string {
  if (value > 70) return '#50c878';
  if (value > 40) return '#c89b3c';
  return '#dc3c3c';
}

export function PlayerHome() {
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);
  const dayType = useGameStore((s) => s.dayType);

  const [conditions, setConditions] = useState<Map<string, { stamina: number; morale: number; form: number }>>(new Map());
  const [loading, setLoading] = useState(true);

  const userTeam = teams.find((t) => t.id === save?.userTeamId);
  const myPlayer = userTeam?.roster.find((p) => p.id === save?.userPlayerId);

  useEffect(() => {
    if (!userTeam || !season) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const cond = await getTeamConditions(userTeam.id, season.currentDate);
        if (!cancelled) setConditions(cond);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userTeam?.id, season?.id, season?.currentDate]);

  if (!userTeam || !season || !myPlayer) {
    return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  }

  const ovr = getOvr(myPlayer);
  const myCond = conditions.get(myPlayer.id);
  const stamina = myCond?.stamina ?? myPlayer.mental.stamina;
  const morale = myCond?.morale ?? myPlayer.mental.morale;
  const form = myCond?.form ?? 50;

  // 1군/2군 판별
  const myDivision = (myPlayer as { division?: string }).division === 'main' ? '1군' : '2군';

  // 같은 포지션 경쟁자
  const rivals = userTeam.roster.filter(
    (p) => p.position === myPlayer.position && p.id !== myPlayer.id,
  );

  return (
    <div>
      <h1 style={styles.title}>선수 대시보드</h1>

      {/* 내 선수 정보 카드 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>내 선수 정보</h2>
        <div style={styles.profileRow}>
          <div style={styles.profileMain}>
            <span style={styles.playerName}>{myPlayer.name}</span>
            <span style={styles.posTag}>
              {POSITION_LABELS[myPlayer.position] ?? myPlayer.position}
            </span>
          </div>
          <div style={styles.profileMeta}>
            <span style={styles.metaItem}>{myPlayer.age}세</span>
            <span style={styles.metaItem}>{myPlayer.nationality}</span>
            <span style={styles.ovrBadge}>OVR {ovr}</span>
          </div>
        </div>

        {/* 스탯 그리드 */}
        <div style={styles.statGrid}>
          {Object.entries(myPlayer.stats).map(([key, value]) => (
            <div key={key} style={styles.statItem}>
              <span style={styles.statLabel}>{STAT_LABELS[key] ?? key}</span>
              <div style={styles.statBarBg}>
                <div
                  style={{
                    ...styles.statBarFill,
                    width: `${value}%`,
                    background: value >= 80 ? '#a0d0ff' : value >= 60 ? '#50c878' : '#c89b3c',
                  }}
                />
              </div>
              <span style={styles.statValue}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 위젯 그리드 */}
      <div style={styles.widgetGrid}>
        {/* 오늘의 일정 */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>오늘의 일정</h2>
          <div style={styles.scheduleInfo}>
            <span style={styles.scheduleDate}>{season.currentDate}</span>
            <span style={styles.scheduleWeek}>{season.currentWeek}주차</span>
          </div>
          <div style={styles.scheduleType}>
            {dayType ? (DAY_TYPE_LABELS[dayType] ?? dayType) : '대기 중'}
          </div>
        </div>

        {/* 현재 컨디션 */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>현재 컨디션</h2>
          {loading ? (
            <p style={styles.dimText}>불러오는 중...</p>
          ) : (
            <div style={styles.conditionList}>
              {[
                { label: '체력', value: stamina },
                { label: '사기', value: morale },
                { label: '폼', value: form },
              ].map((item) => (
                <div key={item.label} style={styles.conditionRow}>
                  <span style={styles.conditionLabel}>{item.label}</span>
                  <div style={styles.conditionBarBg}>
                    <div
                      style={{
                        ...styles.conditionBarFill,
                        width: `${item.value}%`,
                        background: getBarColor(item.value),
                      }}
                    />
                  </div>
                  <span style={styles.conditionValue}>{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 팀 내 위치 */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>팀 내 위치</h2>
          <div style={styles.teamPositionInfo}>
            <div style={styles.divisionRow}>
              <span style={styles.infoLabel}>소속</span>
              <span style={{
                ...styles.divisionBadge,
                background: myDivision === '1군' ? 'rgba(80,200,120,0.15)' : 'rgba(220,60,60,0.15)',
                color: myDivision === '1군' ? '#50c878' : '#dc3c3c',
              }}>
                {myDivision}
              </span>
            </div>
            <div style={styles.divisionRow}>
              <span style={styles.infoLabel}>팀</span>
              <span style={styles.infoValue}>{userTeam.name}</span>
            </div>
          </div>

          {/* 경쟁자 */}
          {rivals.length > 0 && (
            <div style={styles.rivalsSection}>
              <span style={styles.rivalsSectionTitle}>
                같은 포지션 경쟁자 ({POSITION_LABELS[myPlayer.position]})
              </span>
              {rivals.map((rival) => {
                const rivalOvr = getOvr(rival);
                const rivalDiv = (rival as { division?: string }).division === 'main' ? '1군' : '2군';
                return (
                  <div key={rival.id} style={styles.rivalItem}>
                    <span style={styles.rivalName}>{rival.name}</span>
                    <span style={styles.rivalDiv}>{rivalDiv}</span>
                    <span style={styles.rivalOvr}>OVR {rivalOvr}</span>
                  </div>
                );
              })}
            </div>
          )}
          {rivals.length === 0 && (
            <p style={styles.dimText}>같은 포지션 경쟁자가 없습니다.</p>
          )}
        </div>

        {/* 멘탈 스탯 */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>멘탈</h2>
          <div style={styles.conditionList}>
            {[
              { label: '멘탈 강도', value: myPlayer.mental.mental },
              { label: '체력', value: myPlayer.mental.stamina },
              { label: '사기', value: myPlayer.mental.morale },
            ].map((item) => (
              <div key={item.label} style={styles.conditionRow}>
                <span style={styles.conditionLabel}>{item.label}</span>
                <div style={styles.conditionBarBg}>
                  <div
                    style={{
                      ...styles.conditionBarFill,
                      width: `${item.value}%`,
                      background: getBarColor(item.value),
                    }}
                  />
                </div>
                <span style={styles.conditionValue}>{item.value}</span>
              </div>
            ))}
          </div>
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
  profileRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  profileMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  playerName: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#f0e6d2',
  },
  posTag: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#c89b3c',
    background: 'rgba(200,155,60,0.1)',
    padding: '4px 10px',
    borderRadius: '4px',
  },
  profileMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  metaItem: {
    fontSize: '13px',
    color: '#8a8a9a',
  },
  ovrBadge: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#a0d0ff',
    background: 'rgba(160,208,255,0.1)',
    padding: '4px 12px',
    borderRadius: '6px',
  },
  statGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  statLabel: {
    fontSize: '12px',
    color: '#8a8a9a',
    minWidth: '100px',
  },
  statBarBg: {
    flex: 1,
    height: '8px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  statValue: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e0e0e0',
    minWidth: '30px',
    textAlign: 'right',
  },
  widgetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  scheduleInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  scheduleDate: {
    fontSize: '14px',
    color: '#e0e0e0',
    fontWeight: 500,
  },
  scheduleWeek: {
    fontSize: '13px',
    color: '#8a8a9a',
  },
  scheduleType: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#f0e6d2',
    padding: '12px',
    background: 'rgba(200,155,60,0.08)',
    borderRadius: '6px',
    textAlign: 'center',
  },
  conditionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  conditionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  conditionLabel: {
    fontSize: '12px',
    color: '#8a8a9a',
    minWidth: '60px',
  },
  conditionBarBg: {
    flex: 1,
    height: '8px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  conditionBarFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  conditionValue: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#8a8a9a',
    minWidth: '30px',
    textAlign: 'right',
  },
  teamPositionInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '16px',
  },
  divisionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: '12px',
    color: '#6a6a7a',
  },
  infoValue: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#e0e0e0',
  },
  divisionBadge: {
    fontSize: '13px',
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: '4px',
  },
  rivalsSection: {
    borderTop: '1px solid #2a2a4a',
    paddingTop: '12px',
  },
  rivalsSectionTitle: {
    fontSize: '12px',
    color: '#6a6a7a',
    marginBottom: '8px',
    display: 'block',
  },
  rivalItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
    marginBottom: '4px',
  },
  rivalName: {
    flex: 1,
    fontSize: '13px',
    fontWeight: 500,
    color: '#e0e0e0',
  },
  rivalDiv: {
    fontSize: '11px',
    color: '#8a8a9a',
  },
  rivalOvr: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#a0d0ff',
  },
  dimText: {
    fontSize: '13px',
    color: '#6a6a7a',
  },
};
