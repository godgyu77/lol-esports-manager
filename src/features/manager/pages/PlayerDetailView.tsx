/**
 * 선수 상세 뷰
 * - 프로필, 스탯, 멘탈, 계약, 챔피언 풀, 잠재력 표시
 * - RosterView에서 선수 이름 클릭으로 진입
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../../../stores/gameStore';
import type { Player, PlayerStats } from '../../../types/player';
import type { PlayerGameStats } from '../../../types/match';
import { getPlayerGameStatsByPlayer } from '../../../db/queries';
import { PlayerAvatar } from '../../../components/PlayerAvatar';

const POSITION_LABELS: Record<string, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: '원딜',
  support: '서포터',
};

const STAT_LABELS: Record<keyof PlayerStats, string> = {
  mechanical: '기계적 숙련도',
  gameSense: '게임 이해도',
  teamwork: '팀워크',
  consistency: '일관성',
  laning: '라인전',
  aggression: '공격성',
};

function getStatColor(value: number): string {
  if (value >= 90) return '#ffd700';
  if (value >= 80) return '#a0d0ff';
  if (value >= 70) return '#50c878';
  if (value >= 50) return '#c89b3c';
  return '#dc3c3c';
}

function getGrowthStage(player: Player): { label: string; color: string } {
  if (player.age < player.peakAge - 1) return { label: '성장기', color: '#50c878' };
  if (player.age <= player.peakAge + 1) return { label: '전성기', color: '#ffd700' };
  return { label: '하락기', color: '#dc3c3c' };
}

function formatSalary(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}억`;
  }
  return `${value.toLocaleString()}만`;
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.statRow}>
      <span style={styles.statLabel}>{label}</span>
      <div style={styles.statBarBg}>
        <div
          style={{
            ...styles.statBarFill,
            width: `${value}%`,
            background: getStatColor(value),
          }}
        />
      </div>
      <span style={{ ...styles.statValue, color: getStatColor(value) }}>{value}</span>
    </div>
  );
}

function MentalBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.statRow}>
      <span style={styles.statLabel}>{label}</span>
      <div style={styles.statBarBg}>
        <div
          style={{
            ...styles.statBarFill,
            width: `${value}%`,
            background: value > 70 ? '#50c878' : value > 40 ? '#c89b3c' : '#dc3c3c',
          }}
        />
      </div>
      <span style={styles.statValue}>{value}</span>
    </div>
  );
}

export function PlayerDetailView() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const teams = useGameStore((s) => s.teams);
  const [recentGames, setRecentGames] = useState<PlayerGameStats[]>([]);

  useEffect(() => {
    if (!playerId) return;
    getPlayerGameStatsByPlayer(playerId, 10).then(setRecentGames);
  }, [playerId]);

  let player: Player | undefined;
  let teamName = '';
  let division = '';

  for (const team of teams) {
    const found = team.roster.find((p) => p.id === playerId);
    if (found) {
      player = found;
      teamName = team.name;
      division = (found as { division?: string }).division === 'main' ? '1군' : '2군';
      break;
    }
  }

  if (!player) {
    return (
      <div>
        <p style={{ color: '#6a6a7a' }}>선수를 찾을 수 없습니다.</p>
        <button style={styles.backBtn} onClick={() => navigate('/manager/roster')}>
          로스터로 돌아가기
        </button>
      </div>
    );
  }

  const growth = getGrowthStage(player);
  const ovr = Math.round(
    (player.stats.mechanical +
      player.stats.gameSense +
      player.stats.teamwork +
      player.stats.consistency +
      player.stats.laning +
      player.stats.aggression) /
      6,
  );

  return (
    <div>
      <button style={styles.backBtn} onClick={() => navigate('/manager/roster')}>
        ← 로스터로 돌아가기
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <PlayerAvatar
          position={player.position}
          nationality={player.nationality}
          size={56}
          name={player.name}
        />
        <h1 style={{ ...styles.title, marginBottom: 0 }}>{player.name}</h1>
      </div>

      {/* 프로필 카드 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>프로필</h2>
        <div style={styles.profileGrid}>
          <div style={styles.profileItem}>
            <span style={styles.profileLabel}>포지션</span>
            <span style={styles.profileValue}>
              {POSITION_LABELS[player.position] ?? player.position}
            </span>
          </div>
          <div style={styles.profileItem}>
            <span style={styles.profileLabel}>나이</span>
            <span style={styles.profileValue}>{player.age}세</span>
          </div>
          <div style={styles.profileItem}>
            <span style={styles.profileLabel}>국적</span>
            <span style={styles.profileValue}>{player.nationality}</span>
          </div>
          <div style={styles.profileItem}>
            <span style={styles.profileLabel}>소속</span>
            <span style={styles.profileValue}>{teamName}</span>
          </div>
          <div style={styles.profileItem}>
            <span style={styles.profileLabel}>군</span>
            <span style={styles.profileValue}>{division}</span>
          </div>
          <div style={styles.profileItem}>
            <span style={styles.profileLabel}>OVR</span>
            <span style={{ ...styles.profileValue, color: getStatColor(ovr), fontWeight: 700 }}>
              {ovr}
            </span>
          </div>
        </div>
      </div>

      <div style={styles.twoCol}>
        {/* 스탯 레이더 */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>스탯</h2>
          <div style={styles.statList}>
            {(Object.keys(STAT_LABELS) as (keyof PlayerStats)[]).map((key) => (
              <StatBar key={key} label={STAT_LABELS[key]} value={player.stats[key]} />
            ))}
          </div>
        </div>

        {/* 멘탈 정보 */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>멘탈 / 컨디션</h2>
          <div style={styles.statList}>
            <MentalBar label="체력" value={player.mental.stamina} />
            <MentalBar label="사기" value={player.mental.morale} />
            <MentalBar label="멘탈" value={player.mental.mental} />
          </div>
        </div>
      </div>

      <div style={styles.twoCol}>
        {/* 계약 정보 */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>계약 정보</h2>
          <div style={styles.contractGrid}>
            <div style={styles.profileItem}>
              <span style={styles.profileLabel}>연봉</span>
              <span style={styles.profileValue}>{formatSalary(player.contract.salary)}</span>
            </div>
            <div style={styles.profileItem}>
              <span style={styles.profileLabel}>계약 만료</span>
              <span style={styles.profileValue}>{player.contract.contractEndSeason} 시즌</span>
            </div>
          </div>
        </div>

        {/* 잠재력 / 피크 에이지 */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>성장 정보</h2>
          <div style={styles.contractGrid}>
            <div style={styles.profileItem}>
              <span style={styles.profileLabel}>잠재력</span>
              <span style={{ ...styles.profileValue, color: getStatColor(player.potential) }}>
                {player.potential}
              </span>
            </div>
            <div style={styles.profileItem}>
              <span style={styles.profileLabel}>피크 나이</span>
              <span style={styles.profileValue}>{player.peakAge}세</span>
            </div>
            <div style={styles.profileItem}>
              <span style={styles.profileLabel}>성장 단계</span>
              <span style={{ ...styles.profileValue, color: growth.color, fontWeight: 700 }}>
                {growth.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 챔피언 풀 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>챔피언 풀</h2>
        {player.championPool.length === 0 ? (
          <p style={{ color: '#6a6a7a', fontSize: '13px' }}>등록된 챔피언이 없습니다.</p>
        ) : (
          <div style={styles.champGrid}>
            {player.championPool.map((champ) => (
              <div key={champ.championId} style={styles.champItem}>
                <span style={styles.champName}>{champ.championId}</span>
                <div style={styles.champBarBg}>
                  <div
                    style={{
                      ...styles.champBarFill,
                      width: `${champ.proficiency}%`,
                      background: getStatColor(champ.proficiency),
                    }}
                  />
                </div>
                <span style={{ ...styles.champProf, color: getStatColor(champ.proficiency) }}>
                  {champ.proficiency}
                </span>
                <span style={styles.champGames}>{champ.gamesPlayed}게임</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 최근 경기 기록 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>최근 경기 기록</h2>
        {recentGames.length === 0 ? (
          <p style={{ color: '#6a6a7a', fontSize: '13px' }}>경기 기록이 없습니다.</p>
        ) : (
          <>
            {/* 시즌 평균 요약 */}
            <div style={detailStyles.avgGrid}>
              <div style={detailStyles.avgItem}>
                <span style={detailStyles.avgLabel}>평균 K/D/A</span>
                <span style={detailStyles.avgValue}>
                  {(recentGames.reduce((s, g) => s + g.kills, 0) / recentGames.length).toFixed(1)} /
                  {' '}{(recentGames.reduce((s, g) => s + g.deaths, 0) / recentGames.length).toFixed(1)} /
                  {' '}{(recentGames.reduce((s, g) => s + g.assists, 0) / recentGames.length).toFixed(1)}
                </span>
              </div>
              <div style={detailStyles.avgItem}>
                <span style={detailStyles.avgLabel}>평균 CS</span>
                <span style={detailStyles.avgValue}>
                  {Math.round(recentGames.reduce((s, g) => s + g.cs, 0) / recentGames.length)}
                </span>
              </div>
              <div style={detailStyles.avgItem}>
                <span style={detailStyles.avgLabel}>평균 데미지</span>
                <span style={detailStyles.avgValue}>
                  {Math.round(recentGames.reduce((s, g) => s + g.damageDealt, 0) / recentGames.length).toLocaleString()}
                </span>
              </div>
            </div>

            <table style={detailStyles.table}>
              <thead>
                <tr>
                  <th style={detailStyles.th}>매치</th>
                  <th style={detailStyles.th}>K</th>
                  <th style={detailStyles.th}>D</th>
                  <th style={detailStyles.th}>A</th>
                  <th style={detailStyles.th}>CS</th>
                  <th style={detailStyles.th}>골드</th>
                  <th style={detailStyles.th}>데미지</th>
                </tr>
              </thead>
              <tbody>
                {recentGames.map((g) => (
                  <tr key={g.id} style={detailStyles.tr}>
                    <td style={detailStyles.td}>{g.gameId}</td>
                    <td style={{ ...detailStyles.td, color: '#90ee90' }}>{g.kills}</td>
                    <td style={{ ...detailStyles.td, color: '#ff6b6b' }}>{g.deaths}</td>
                    <td style={detailStyles.td}>{g.assists}</td>
                    <td style={detailStyles.td}>{g.cs}</td>
                    <td style={detailStyles.td}>{g.goldEarned.toLocaleString()}</td>
                    <td style={detailStyles.td}>{g.damageDealt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '20px',
  },
  backBtn: {
    padding: '6px 14px',
    fontSize: '13px',
    fontWeight: 500,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #3a3a5c',
    borderRadius: '6px',
    color: '#8a8a9a',
    cursor: 'pointer',
    marginBottom: '16px',
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
  twoCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  profileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  profileItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  profileLabel: {
    fontSize: '12px',
    color: '#6a6a7a',
  },
  profileValue: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#e0e0e0',
  },
  contractGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  statList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  statLabel: {
    fontSize: '13px',
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
    fontSize: '14px',
    fontWeight: 600,
    color: '#e0e0e0',
    minWidth: '32px',
    textAlign: 'right',
  },
  champGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  champItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
  },
  champName: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#e0e0e0',
    minWidth: '80px',
  },
  champBarBg: {
    flex: 1,
    height: '6px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  champBarFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  champProf: {
    fontSize: '13px',
    fontWeight: 600,
    minWidth: '28px',
    textAlign: 'right',
  },
  champGames: {
    fontSize: '11px',
    color: '#6a6a7a',
    minWidth: '48px',
    textAlign: 'right',
  },
};

const detailStyles: Record<string, React.CSSProperties> = {
  avgGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '16px',
  },
  avgItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
  },
  avgLabel: {
    fontSize: '12px',
    color: '#6a6a7a',
  },
  avgValue: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#e0e0e0',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    padding: '8px 10px',
    textAlign: 'left',
    borderBottom: '1px solid #3a3a5c',
    color: '#6a6a7a',
    fontSize: '12px',
    fontWeight: 500,
  },
  tr: {
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  td: {
    padding: '8px 10px',
    color: '#c0c0d0',
  },
};
