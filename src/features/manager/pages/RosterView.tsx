/**
 * 로스터 관리 뷰
 * - 1군/2군 선수 목록
 * - 1군 ↔ 2군 교체 기능
 * - 선수 스탯 테이블
 */

import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGameStore } from '../../../stores/gameStore';
import { updatePlayerDivision } from '../../../db/queries';
import type { Player } from '../../../types/player';

type Division = 'main' | 'sub';

const POSITION_LABELS: Record<string, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: '원딜',
  support: '서포터',
};

const POSITION_ORDER = ['top', 'jungle', 'mid', 'adc', 'support'];

function sortByPosition<T extends { position: string }>(arr: T[]): T[] {
  return [...arr].sort(
    (a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position),
  );
}

function getOvr(player: Player): number {
  const s = player.stats;
  return Math.round(
    (s.mechanical + s.gameSense + s.teamwork + s.consistency + s.laning + s.aggression) / 6,
  );
}

function getOvrStyle(ovr: number): React.CSSProperties {
  if (ovr >= 90) return { color: '#ffd700', fontWeight: 700 };
  if (ovr >= 80) return { color: '#a0d0ff', fontWeight: 600 };
  if (ovr >= 70) return { color: '#90ee90', fontWeight: 500 };
  return { color: '#e0e0e0' };
}

export function RosterView() {
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);
  const setTeams = useGameStore((s) => s.setTeams);

  const [swapSource, setSwapSource] = useState<{ id: string; division: Division } | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const userTeam = teams.find((t) => t.id === save?.userTeamId);

  const handleSwap = useCallback(async (
    playerId: string,
    currentDivision: Division,
  ) => {
    if (!userTeam) return;

    // 첫 번째 클릭: 교체 대상 선택
    if (!swapSource) {
      setSwapSource({ id: playerId, division: currentDivision });
      setMessage(null);
      return;
    }

    // 같은 선수 다시 클릭 → 취소
    if (swapSource.id === playerId) {
      setSwapSource(null);
      setMessage(null);
      return;
    }

    // 두 번째 클릭: 교체 실행
    setIsSwapping(true);
    try {
      const sourcePlayer = userTeam.roster.find(p => p.id === swapSource.id);
      const targetPlayer = userTeam.roster.find(p => p.id === playerId);

      if (!sourcePlayer || !targetPlayer) return;

      const sourceDivision = swapSource.division;
      const targetDivision = currentDivision;

      // 같은 디비전 내 교체는 무의미
      if (sourceDivision === targetDivision) {
        // 같은 디비전이면 단순히 선택 변경
        setSwapSource({ id: playerId, division: currentDivision });
        return;
      }

      // DB 업데이트
      await updatePlayerDivision(swapSource.id, targetDivision);
      await updatePlayerDivision(playerId, sourceDivision);

      // store 갱신
      const updatedTeams = teams.map(team => {
        if (team.id !== userTeam.id) return team;
        return {
          ...team,
          roster: team.roster.map(p => {
            if (p.id === swapSource.id) {
              return { ...p, division: targetDivision } as typeof p;
            }
            if (p.id === playerId) {
              return { ...p, division: sourceDivision } as typeof p;
            }
            return p;
          }),
        };
      });
      setTeams(updatedTeams);
      setMessage(`${sourcePlayer.name} ↔ ${targetPlayer.name} 교체 완료`);
    } finally {
      setSwapSource(null);
      setIsSwapping(false);
    }
  }, [swapSource, userTeam, teams, setTeams]);

  // 단일 승격/강등 (반대 디비전에 같은 포지션 선수가 없을 때)
  const handlePromoteDemote = useCallback(async (
    playerId: string,
    currentDivision: Division,
  ) => {
    if (!userTeam) return;
    const newDivision: Division = currentDivision === 'main' ? 'sub' : 'main';

    setIsSwapping(true);
    try {
      await updatePlayerDivision(playerId, newDivision);

      const updatedTeams = teams.map(team => {
        if (team.id !== userTeam.id) return team;
        return {
          ...team,
          roster: team.roster.map(p => {
            if (p.id === playerId) {
              return { ...p, division: newDivision } as typeof p;
            }
            return p;
          }),
        };
      });
      setTeams(updatedTeams);

      const player = userTeam.roster.find(p => p.id === playerId);
      setMessage(`${player?.name} ${newDivision === 'main' ? '1군 승격' : '2군 강등'}`);
    } finally {
      setSwapSource(null);
      setIsSwapping(false);
    }
  }, [userTeam, teams, setTeams]);

  if (!userTeam) {
    return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  }

  const mainRoster = userTeam.roster.filter(
    (p) => (p as { division?: string }).division === 'main',
  );
  const subRoster = userTeam.roster.filter(
    (p) => (p as { division?: string }).division === 'sub',
  );

  const renderTable = (players: typeof userTeam.roster, title: string, division: Division) => (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>
        {title} ({players.length}명)
      </h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>포지션</th>
            <th style={styles.th}>이름</th>
            <th style={styles.th}>나이</th>
            <th style={styles.th}>OVR</th>
            <th style={styles.th}>기계</th>
            <th style={styles.th}>센스</th>
            <th style={styles.th}>팀워크</th>
            <th style={styles.th}>일관</th>
            <th style={styles.th}>라인</th>
            <th style={styles.th}>공격</th>
            <th style={styles.th}>멘탈</th>
            <th style={styles.th}>계약</th>
            <th style={styles.th}></th>
          </tr>
        </thead>
        <tbody>
          {sortByPosition(players).map((player) => {
            const avgOvr = getOvr(player);
            const isSelected = swapSource?.id === player.id;
            return (
              <tr
                key={player.id}
                style={{
                  ...styles.tr,
                  ...(isSelected ? styles.selectedRow : {}),
                }}
              >
                <td style={styles.td}>
                  <span style={styles.posTag}>
                    {POSITION_LABELS[player.position] ?? player.position}
                  </span>
                </td>
                <td style={{ ...styles.td, ...styles.nameCell }}>
                  <Link to={'/manager/player/' + player.id} style={styles.nameLink}>
                    {player.name}
                  </Link>
                </td>
                <td style={styles.td}>{player.age}</td>
                <td style={{ ...styles.td, ...getOvrStyle(avgOvr) }}>{avgOvr}</td>
                <td style={styles.td}>{player.stats.mechanical}</td>
                <td style={styles.td}>{player.stats.gameSense}</td>
                <td style={styles.td}>{player.stats.teamwork}</td>
                <td style={styles.td}>{player.stats.consistency}</td>
                <td style={styles.td}>{player.stats.laning}</td>
                <td style={styles.td}>{player.stats.aggression}</td>
                <td style={styles.td}>{player.mental.mental}</td>
                <td style={styles.td}>{player.contract.contractEndSeason}</td>
                <td style={styles.td}>
                  <div style={styles.actionBtns}>
                    <button
                      style={{
                        ...styles.swapBtn,
                        ...(isSelected ? styles.swapBtnActive : {}),
                      }}
                      onClick={() => handleSwap(player.id, division)}
                      disabled={isSwapping}
                      title="교체할 선수 선택"
                    >
                      {isSelected ? '취소' : '교체'}
                    </button>
                    <button
                      style={styles.moveBtn}
                      onClick={() => handlePromoteDemote(player.id, division)}
                      disabled={isSwapping}
                      title={division === 'main' ? '2군으로 강등' : '1군으로 승격'}
                    >
                      {division === 'main' ? '↓' : '↑'}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <h1 style={styles.title}>로스터 관리</h1>

      {/* 안내 메시지 */}
      {swapSource && (
        <div style={styles.swapNotice}>
          교체할 상대 선수를 선택하세요 (1군 ↔ 2군)
        </div>
      )}

      {message && (
        <div style={styles.successMsg}>{message}</div>
      )}

      {renderTable(mainRoster, '1군', 'main')}
      {subRoster.length > 0 && renderTable(subRoster, '2군', 'sub')}
      {subRoster.length === 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>2군 (0명)</h2>
          <p style={{ color: '#6a6a7a', fontSize: '13px' }}>2군 선수가 없습니다.</p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '16px',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#c89b3c',
    marginBottom: '12px',
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
    transition: 'background 0.15s',
  },
  selectedRow: {
    background: 'rgba(200,155,60,0.12)',
    borderBottom: '1px solid rgba(200,155,60,0.3)',
  },
  td: {
    padding: '8px 10px',
    color: '#c0c0d0',
  },
  nameCell: {
    fontWeight: 500,
    color: '#e0e0e0',
  },
  nameLink: {
    color: '#e0e0e0',
    textDecoration: 'none',
    borderBottom: '1px solid transparent',
    transition: 'border-color 0.15s',
  },
  posTag: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#c89b3c',
    background: 'rgba(200,155,60,0.1)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  actionBtns: {
    display: 'flex',
    gap: '4px',
  },
  swapBtn: {
    padding: '3px 8px',
    fontSize: '11px',
    fontWeight: 500,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #3a3a5c',
    borderRadius: '4px',
    color: '#8a8a9a',
    cursor: 'pointer',
  },
  swapBtnActive: {
    background: 'rgba(200,155,60,0.2)',
    borderColor: '#c89b3c',
    color: '#c89b3c',
  },
  moveBtn: {
    padding: '3px 8px',
    fontSize: '12px',
    fontWeight: 700,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #3a3a5c',
    borderRadius: '4px',
    color: '#8a8a9a',
    cursor: 'pointer',
  },
  swapNotice: {
    padding: '10px 16px',
    marginBottom: '12px',
    border: '1px solid #c89b3c44',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#c89b3c',
    background: 'rgba(200,155,60,0.05)',
  },
  successMsg: {
    padding: '10px 16px',
    marginBottom: '12px',
    border: '1px solid #2ecc7144',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#2ecc71',
    background: 'rgba(46,204,113,0.05)',
  },
};
