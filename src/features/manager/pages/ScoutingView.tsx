/**
 * 스카우팅 페이지
 * - 탭 1: 스카우트 관리 (고용/해고/배정)
 * - 탭 2: 리포트 열람 (완료/진행중)
 * - 탭 3: 관심 선수 목록
 */

import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  getTeamScouts,
  hireScout,
  fireScout,
  assignScouting,
  getCompletedReports,
  getPendingReports,
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
} from '../../../engine/scouting/scoutingEngine';
import type { Scout, ScoutingReport } from '../../../types/scout';
import type { Player } from '../../../types/player';
import { getFreeAgents } from '../../../db/queries';
import { Skeleton, SkeletonTable } from '../../../components/Skeleton';

type Tab = 'scouts' | 'reports' | 'watchlist';

const POSITION_LABELS: Record<string, string> = {
  top: 'TOP', jungle: 'JGL', mid: 'MID', adc: 'ADC', support: 'SUP',
};

const GRADE_COLORS: Record<string, string> = {
  S: '#ff6b6b', A: '#c89b3c', B: '#4ecdc4', C: '#8a8a9a', D: '#555',
};

export function ScoutingView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);

  const [tab, setTab] = useState<Tab>('scouts');
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [completedReports, setCompletedReports] = useState<ScoutingReport[]>([]);
  const [pendingReports, setPendingReports] = useState<ScoutingReport[]>([]);
  const [watchlist, setWatchlistState] = useState<{ playerId: string; addedDate: string; notes: string | null }[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [assignModal, setAssignModal] = useState<Scout | null>(null);
  const [posFilter, setPosFilter] = useState<string>('all');

  const userTeamId = save?.userTeamId ?? '';

  // 전체 선수 목록 (타팀 + 자유계약)
  const otherTeamPlayers: Player[] = teams
    .filter(t => t.id !== userTeamId)
    .flatMap(t => t.roster ?? []);

  const loadData = useCallback(async () => {
    if (!save) return;
    setIsLoading(true);
    try {
      const [sc, completed, pending, wl, freeAgents] = await Promise.all([
        getTeamScouts(userTeamId),
        getCompletedReports(userTeamId),
        getPendingReports(userTeamId),
        getWatchlist(userTeamId),
        getFreeAgents(),
      ]);
      setScouts(sc);
      setCompletedReports(completed);
      setPendingReports(pending);
      setWatchlistState(wl);
      setAllPlayers([...otherTeamPlayers, ...freeAgents]);
    } catch (err) {
      console.error('스카우팅 데이터 로딩 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, [save, userTeamId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleHireScout = async () => {
    if (!season) return;
    try {
      await hireScout(userTeamId, season.currentDate);
      setMessage({ text: '새 스카우트를 고용했습니다.', type: 'success' });
      await loadData();
    } catch (err) {
      console.error('스카우트 고용 실패:', err);
      setMessage({ text: '스카우트 고용에 실패했습니다.', type: 'error' });
    }
  };

  const handleFireScout = async (scoutId: number) => {
    try {
      await fireScout(scoutId);
      setMessage({ text: '스카우트를 해고했습니다.', type: 'success' });
      await loadData();
    } catch (err) {
      console.error('스카우트 해고 실패:', err);
      setMessage({ text: '스카우트 해고에 실패했습니다.', type: 'error' });
    }
  };

  const handleAssign = async (scoutId: number, playerId: string) => {
    if (!season) return;
    try {
      const result = await assignScouting(scoutId, playerId, userTeamId, season.currentDate);
      if (result) {
        setMessage({ text: '스카우팅을 배정했습니다.', type: 'success' });
        setAssignModal(null);
        await loadData();
      } else {
        setMessage({ text: '이 스카우트는 이미 작업 중입니다.', type: 'error' });
      }
    } catch (err) {
      console.error('스카우팅 배정 실패:', err);
      setMessage({ text: '스카우팅 배정에 실패했습니다.', type: 'error' });
    }
  };

  const handleToggleWatchlist = async (playerId: string) => {
    if (!season) return;
    const isInList = watchlist.some(w => w.playerId === playerId);
    if (isInList) {
      await removeFromWatchlist(userTeamId, playerId);
    } else {
      await addToWatchlist(userTeamId, playerId, season.currentDate);
    }
    await loadData();
  };

  const findPlayer = (playerId: string): Player | undefined =>
    allPlayers.find(p => p.id === playerId) ??
    teams.flatMap(t => t.roster ?? []).find(p => p.id === playerId);

  const findTeamName = (playerId: string): string => {
    for (const team of teams) {
      if (team.roster?.some(p => p.id === playerId)) return team.shortName;
    }
    return '자유계약';
  };

  const isScoutBusy = (scoutId: number) =>
    pendingReports.some(r => r.scoutId === scoutId);

  if (!season || !save) {
    return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return (
      <div>
        <Skeleton width="160px" height="28px" variant="text" />
        <div style={{ marginTop: '16px', display: 'flex', gap: '4px', marginBottom: '16px' }}>
          <Skeleton width="80px" height="36px" variant="rect" />
          <Skeleton width="80px" height="36px" variant="rect" />
          <Skeleton width="80px" height="36px" variant="rect" />
        </div>
        <SkeletonTable rows={5} cols={4} />
      </div>
    );
  }

  const filteredPlayers = posFilter === 'all'
    ? allPlayers
    : allPlayers.filter(p => p.position === posFilter);

  return (
    <div>
      <h1 style={styles.title}>스카우팅</h1>

      {message && (
        <div style={{
          ...styles.message,
          borderColor: message.type === 'success' ? '#2ecc71' : '#e74c3c',
          color: message.type === 'success' ? '#2ecc71' : '#e74c3c',
        }}>
          {message.text}
        </div>
      )}

      {/* 탭 */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(tab === 'scouts' ? styles.activeTab : {}) }}
          onClick={() => setTab('scouts')}
        >
          스카우트 ({scouts.length})
        </button>
        <button
          style={{ ...styles.tab, ...(tab === 'reports' ? styles.activeTab : {}) }}
          onClick={() => setTab('reports')}
        >
          리포트 ({completedReports.length})
        </button>
        <button
          style={{ ...styles.tab, ...(tab === 'watchlist' ? styles.activeTab : {}) }}
          onClick={() => setTab('watchlist')}
        >
          관심 목록 ({watchlist.length})
        </button>
      </div>

      {/* 탭 1: 스카우트 관리 */}
      {tab === 'scouts' && (
        <div>
          <div style={styles.sectionHeader}>
            <h2 style={styles.subTitle}>소속 스카우트</h2>
            <button style={styles.hireBtn} onClick={handleHireScout}>
              + 스카우트 고용
            </button>
          </div>

          {scouts.length === 0 ? (
            <p style={styles.empty}>고용된 스카우트가 없습니다. 스카우트를 고용하세요.</p>
          ) : (
            <div style={styles.scoutGrid}>
              {scouts.map(scout => {
                const busy = isScoutBusy(scout.id);
                const busyReport = pendingReports.find(r => r.scoutId === scout.id);
                const busyPlayer = busyReport ? findPlayer(busyReport.playerId) : null;
                return (
                  <div key={scout.id} style={styles.scoutCard}>
                    <div style={styles.scoutHeader}>
                      <span style={styles.scoutName}>{scout.name}</span>
                      <span style={styles.scoutAbility}>능력 {scout.ability}</span>
                    </div>
                    <div style={styles.scoutDetails}>
                      <span>특화 리전: {scout.regionSpecialty ?? '없음'}</span>
                      <span>경험: {scout.experience}건</span>
                      <span>연봉: {scout.salary}만</span>
                    </div>
                    <div style={styles.scoutStatus}>
                      {busy ? (
                        <span style={{ color: '#f39c12', fontSize: '12px' }}>
                          스카우팅 중: {busyPlayer?.name ?? '???'} (D-{busyReport?.daysRemaining})
                        </span>
                      ) : (
                        <span style={{ color: '#2ecc71', fontSize: '12px' }}>대기중</span>
                      )}
                    </div>
                    <div style={styles.scoutActions}>
                      <button
                        style={{
                          ...styles.assignBtn,
                          opacity: busy ? 0.4 : 1,
                        }}
                        disabled={busy}
                        onClick={() => setAssignModal(scout)}
                      >
                        배정
                      </button>
                      <button style={styles.fireBtn} onClick={() => handleFireScout(scout.id)}>
                        해고
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 탭 2: 리포트 */}
      {tab === 'reports' && (
        <div>
          {/* 진행 중 */}
          {pendingReports.length > 0 && (
            <>
              <h2 style={styles.subTitle}>진행 중 ({pendingReports.length})</h2>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>선수</th>
                    <th style={styles.th}>소속</th>
                    <th style={styles.th}>스카우트</th>
                    <th style={styles.th}>남은 일수</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingReports.map(report => {
                    const player = findPlayer(report.playerId);
                    const scout = scouts.find(s => s.id === report.scoutId);
                    return (
                      <tr key={report.id} style={styles.tr}>
                        <td style={{ ...styles.td, fontWeight: 500, color: '#e0e0e0' }}>
                          {player?.name ?? report.playerId}
                        </td>
                        <td style={styles.td}>{findTeamName(report.playerId)}</td>
                        <td style={styles.td}>{scout?.name ?? '???'}</td>
                        <td style={{ ...styles.td, color: '#f39c12', fontWeight: 600 }}>
                          D-{report.daysRemaining}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {/* 완료된 리포트 */}
          <h2 style={{ ...styles.subTitle, marginTop: pendingReports.length > 0 ? '24px' : '0' }}>
            완료된 리포트 ({completedReports.length})
          </h2>
          {completedReports.length === 0 ? (
            <p style={styles.empty}>완료된 리포트가 없습니다.</p>
          ) : (
            <div style={styles.reportGrid}>
              {completedReports.map(report => {
                const player = findPlayer(report.playerId);
                return (
                  <div key={report.id} style={styles.reportCard}>
                    <div style={styles.reportHeader}>
                      <span style={{
                        ...styles.reportGrade,
                        color: GRADE_COLORS[report.overallGrade] ?? '#8a8a9a',
                      }}>
                        {report.overallGrade}
                      </span>
                      <span style={styles.reportName}>{player?.name ?? report.playerId}</span>
                      <span style={styles.reportTeam}>{findTeamName(report.playerId)}</span>
                    </div>
                    <div style={styles.reportAccuracy}>
                      정확도: {report.accuracy}%
                    </div>
                    <div style={styles.reportStats}>
                      {report.reportedStats.mechanical != null && (
                        <div style={styles.statRow}>
                          <span>기계적</span>
                          <span style={styles.statValue}>{report.reportedStats.mechanical}</span>
                        </div>
                      )}
                      {report.reportedStats.gameSense != null && (
                        <div style={styles.statRow}>
                          <span>판단력</span>
                          <span style={styles.statValue}>{report.reportedStats.gameSense}</span>
                        </div>
                      )}
                      {report.reportedStats.teamwork != null && (
                        <div style={styles.statRow}>
                          <span>팀워크</span>
                          <span style={styles.statValue}>{report.reportedStats.teamwork}</span>
                        </div>
                      )}
                      {report.reportedStats.laning != null && (
                        <div style={styles.statRow}>
                          <span>라인전</span>
                          <span style={styles.statValue}>{report.reportedStats.laning}</span>
                        </div>
                      )}
                      {report.reportedStats.consistency != null && (
                        <div style={styles.statRow}>
                          <span>일관성</span>
                          <span style={styles.statValue}>{report.reportedStats.consistency}</span>
                        </div>
                      )}
                      {report.reportedStats.aggression != null && (
                        <div style={styles.statRow}>
                          <span>공격성</span>
                          <span style={styles.statValue}>{report.reportedStats.aggression}</span>
                        </div>
                      )}
                      {report.reportedPotential != null && (
                        <div style={styles.statRow}>
                          <span>잠재력</span>
                          <span style={{ ...styles.statValue, color: '#c89b3c' }}>
                            {report.reportedPotential}
                          </span>
                        </div>
                      )}
                      {report.reportedMental != null && (
                        <div style={styles.statRow}>
                          <span>멘탈</span>
                          <span style={styles.statValue}>{report.reportedMental}</span>
                        </div>
                      )}
                    </div>
                    {report.scoutComment && (
                      <div style={styles.reportComment}>
                        "{report.scoutComment}"
                      </div>
                    )}
                    <div style={styles.reportDate}>
                      {report.reportDate}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 탭 3: 관심 목록 */}
      {tab === 'watchlist' && (
        <div>
          <h2 style={styles.subTitle}>관심 선수 목록</h2>
          {watchlist.length === 0 ? (
            <p style={styles.empty}>관심 목록이 비어있습니다. 선수 배정 화면에서 추가하세요.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>포지션</th>
                  <th style={styles.th}>이름</th>
                  <th style={styles.th}>소속</th>
                  <th style={styles.th}>추가일</th>
                  <th style={styles.th}>최신 리포트</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map(entry => {
                  const player = findPlayer(entry.playerId);
                  const report = completedReports.find(r => r.playerId === entry.playerId);
                  return (
                    <tr key={entry.playerId} style={styles.tr}>
                      <td style={{ ...styles.td, color: '#c89b3c', fontWeight: 600 }}>
                        {player ? POSITION_LABELS[player.position] ?? player.position : '???'}
                      </td>
                      <td style={{ ...styles.td, fontWeight: 500, color: '#e0e0e0' }}>
                        {player?.name ?? entry.playerId}
                      </td>
                      <td style={styles.td}>{findTeamName(entry.playerId)}</td>
                      <td style={styles.td}>{entry.addedDate}</td>
                      <td style={styles.td}>
                        {report ? (
                          <span style={{ color: GRADE_COLORS[report.overallGrade], fontWeight: 600 }}>
                            {report.overallGrade} ({report.accuracy}%)
                          </span>
                        ) : (
                          <span style={{ color: '#6a6a7a' }}>없음</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <button
                          style={styles.removeBtn}
                          onClick={() => handleToggleWatchlist(entry.playerId)}
                        >
                          제거
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 배정 모달 */}
      {assignModal && (
        <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="스카우팅 배정" onClick={() => setAssignModal(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>
              스카우팅 배정 — {assignModal.name}
            </h2>

            <div style={styles.filterRow}>
              {['all', 'top', 'jungle', 'mid', 'adc', 'support'].map(pos => (
                <button
                  key={pos}
                  style={{ ...styles.filterBtn, ...(posFilter === pos ? styles.filterActive : {}) }}
                  onClick={() => setPosFilter(pos)}
                >
                  {pos === 'all' ? '전체' : POSITION_LABELS[pos]}
                </button>
              ))}
            </div>

            <div style={styles.playerList}>
              {filteredPlayers.slice(0, 50).map(player => {
                const hasReport = completedReports.some(r => r.playerId === player.id);
                const isPending = pendingReports.some(r => r.playerId === player.id);
                const inWatchlist = watchlist.some(w => w.playerId === player.id);
                return (
                  <div key={player.id} style={styles.playerRow}>
                    <span style={{ color: '#c89b3c', fontSize: '12px', width: '36px' }}>
                      {POSITION_LABELS[player.position]}
                    </span>
                    <span style={{ flex: 1, color: '#e0e0e0', fontSize: '13px' }}>
                      {player.name}
                    </span>
                    <span style={{ color: '#6a6a7a', fontSize: '12px', width: '60px' }}>
                      {findTeamName(player.id)}
                    </span>
                    <span style={{ color: '#6a6a7a', fontSize: '12px', width: '36px' }}>
                      {player.age}세
                    </span>
                    {hasReport && (
                      <span style={{ color: '#2ecc71', fontSize: '11px', width: '50px' }}>리포트有</span>
                    )}
                    {isPending && (
                      <span style={{ color: '#f39c12', fontSize: '11px', width: '50px' }}>진행중</span>
                    )}
                    <button
                      style={{
                        ...styles.watchBtn,
                        color: inWatchlist ? '#c89b3c' : '#6a6a7a',
                      }}
                      onClick={() => handleToggleWatchlist(player.id)}
                      title={inWatchlist ? '관심 해제' : '관심 등록'}
                    >
                      {inWatchlist ? '\u2605' : '\u2606'}
                    </button>
                    <button
                      style={{
                        ...styles.smallBtn,
                        opacity: isPending ? 0.4 : 1,
                      }}
                      disabled={isPending}
                      onClick={() => handleAssign(assignModal.id, player.id)}
                    >
                      배정
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={{ textAlign: 'right', marginTop: '16px' }}>
              <button style={styles.modalCancel} onClick={() => setAssignModal(null)}>
                닫기
              </button>
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
  subTitle: { fontSize: '15px', fontWeight: 600, color: '#c89b3c', marginBottom: '12px' },
  empty: { color: '#6a6a7a', fontSize: '13px' },
  sectionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px',
  },
  hireBtn: {
    padding: '8px 16px', background: '#c89b3c', color: '#0d0d1a', border: 'none',
    borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  // 스카우트 카드
  scoutGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' },
  scoutCard: {
    background: '#12122a', border: '1px solid #2a2a4a', borderRadius: '8px', padding: '16px',
  },
  scoutHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px',
  },
  scoutName: { fontSize: '15px', fontWeight: 600, color: '#e0e0e0' },
  scoutAbility: {
    fontSize: '13px', fontWeight: 700, color: '#c89b3c',
    background: 'rgba(200,155,60,0.15)', padding: '2px 8px', borderRadius: '4px',
  },
  scoutDetails: {
    display: 'flex', flexDirection: 'column', gap: '2px',
    fontSize: '12px', color: '#8a8a9a', marginBottom: '8px',
  },
  scoutStatus: { marginBottom: '10px' },
  scoutActions: { display: 'flex', gap: '8px' },
  assignBtn: {
    padding: '6px 14px', background: 'rgba(200,155,60,0.15)', border: '1px solid #c89b3c',
    borderRadius: '4px', color: '#c89b3c', fontSize: '12px', cursor: 'pointer',
  },
  fireBtn: {
    padding: '6px 14px', background: 'none', border: '1px solid #6a6a7a',
    borderRadius: '4px', color: '#6a6a7a', fontSize: '12px', cursor: 'pointer',
  },
  // 리포트 카드
  reportGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' },
  reportCard: {
    background: '#12122a', border: '1px solid #2a2a4a', borderRadius: '8px', padding: '16px',
  },
  reportHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  reportGrade: { fontSize: '20px', fontWeight: 800 },
  reportName: { fontSize: '14px', fontWeight: 600, color: '#e0e0e0' },
  reportTeam: { fontSize: '12px', color: '#6a6a7a', marginLeft: 'auto' },
  reportAccuracy: {
    fontSize: '11px', color: '#8a8a9a', marginBottom: '10px',
    padding: '2px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', display: 'inline-block',
  },
  reportStats: { display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '8px' },
  statRow: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8a8a9a' },
  statValue: { fontWeight: 600, color: '#c0c0d0' },
  reportComment: {
    fontSize: '12px', color: '#8a8a9a', fontStyle: 'italic',
    padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', marginBottom: '6px',
  },
  reportDate: { fontSize: '11px', color: '#555' },
  // 테이블
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #3a3a5c',
    color: '#6a6a7a', fontSize: '12px', fontWeight: 500,
  },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  td: { padding: '8px 10px', color: '#c0c0d0' },
  removeBtn: {
    padding: '4px 10px', background: 'none', border: '1px solid #6a6a7a',
    borderRadius: '4px', color: '#6a6a7a', fontSize: '12px', cursor: 'pointer',
  },
  // 필터
  filterRow: { display: 'flex', gap: '6px', marginBottom: '12px' },
  filterBtn: {
    padding: '6px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid #2a2a4a',
    borderRadius: '6px', color: '#8a8a9a', fontSize: '12px', cursor: 'pointer',
  },
  filterActive: {
    background: 'rgba(200,155,60,0.15)', borderColor: '#c89b3c', color: '#c89b3c',
  },
  // 모달
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modal: {
    background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: '12px',
    padding: '24px', width: '600px', maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto',
  },
  modalTitle: { fontSize: '18px', fontWeight: 700, color: '#f0e6d2', marginBottom: '16px' },
  modalCancel: {
    padding: '8px 18px', background: 'none', border: '1px solid #3a3a5c',
    borderRadius: '6px', color: '#8a8a9a', fontSize: '13px', cursor: 'pointer',
  },
  playerList: { display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '400px', overflow: 'auto' },
  playerRow: {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
    borderRadius: '4px', background: 'rgba(255,255,255,0.02)',
  },
  watchBtn: {
    background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', padding: '2px 6px',
  },
  smallBtn: {
    padding: '4px 10px', background: '#c89b3c', color: '#0d0d1a', border: 'none',
    borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
  },
};
