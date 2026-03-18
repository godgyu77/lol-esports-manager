/**
 * 약속 관리 대시보드
 */

import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getActivePromises, getAllPromises } from '../../../engine/promise/promiseEngine';
import type { ManagerPromise } from '../../../types/promise';
import { PROMISE_TYPE_LABELS } from '../../../types/promise';

type Tab = 'active' | 'history';

export function PromisesView() {
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);

  const [tab, setTab] = useState<Tab>('active');
  const [active, setActive] = useState<ManagerPromise[]>([]);
  const [all, setAll] = useState<ManagerPromise[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userTeamId = save?.userTeamId ?? '';
  const currentDate = season?.currentDate ?? '';

  const loadData = useCallback(async () => {
    if (!save) return;
    setIsLoading(true);
    try {
      const [act, hist] = await Promise.all([
        getActivePromises(userTeamId),
        getAllPromises(userTeamId),
      ]);
      setActive(act);
      setAll(hist);
    } catch (err) {
      console.error('약속 데이터 로딩 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, [save, userTeamId]);

  useEffect(() => { loadData(); }, [loadData]);

  const getPlayerName = (playerId: string): string => {
    for (const team of teams) {
      const p = team.roster?.find(r => r.id === playerId);
      if (p) return p.name;
    }
    return playerId;
  };

  const getDaysRemaining = (deadline: string): number => {
    if (!currentDate) return 0;
    const d = new Date(deadline).getTime() - new Date(currentDate).getTime();
    return Math.max(0, Math.ceil(d / (1000 * 60 * 60 * 24)));
  };

  const getStatusColor = (promise: ManagerPromise) => {
    if (promise.isFulfilled) return '#2ecc71';
    if (promise.isBroken) return '#e74c3c';
    const days = getDaysRemaining(promise.deadlineDate);
    if (days <= 7) return '#e74c3c';
    if (days <= 14) return '#f39c12';
    return '#2ecc71';
  };

  if (!save) return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  if (isLoading) return <p style={{ color: '#6a6a7a' }}>약속 정보를 불러오는 중...</p>;

  const fulfilled = all.filter(p => p.isFulfilled).length;
  const broken = all.filter(p => p.isBroken).length;
  const total = all.length;
  const rate = total > 0 ? Math.round((fulfilled / total) * 100) : 100;

  return (
    <div>
      <h1 style={styles.title}>약속 관리</h1>

      <div style={styles.statsBar}>
        <span style={styles.stat}>활성 약속: <strong style={{ color: '#c89b3c' }}>{active.length}</strong></span>
        <span style={styles.stat}>이행: <strong style={{ color: '#2ecc71' }}>{fulfilled}</strong></span>
        <span style={styles.stat}>불이행: <strong style={{ color: '#e74c3c' }}>{broken}</strong></span>
        <span style={styles.stat}>이행률: <strong style={{ color: rate >= 70 ? '#2ecc71' : '#e74c3c' }}>{rate}%</strong></span>
      </div>

      <div style={styles.tabs}>
        <button style={{ ...styles.tab, ...(tab === 'active' ? styles.activeTab : {}) }} onClick={() => setTab('active')}>
          활성 ({active.length})
        </button>
        <button style={{ ...styles.tab, ...(tab === 'history' ? styles.activeTab : {}) }} onClick={() => setTab('history')}>
          이력 ({all.length})
        </button>
      </div>

      {tab === 'active' && (
        active.length === 0 ? (
          <p style={{ color: '#6a6a7a', fontSize: '13px' }}>활성 약속이 없습니다.</p>
        ) : (
          <div style={styles.grid}>
            {active.map(p => {
              const days = getDaysRemaining(p.deadlineDate);
              return (
                <div key={p.id} style={{ ...styles.card, borderLeft: `3px solid ${getStatusColor(p)}` }}>
                  <div style={styles.cardHeader}>
                    <span style={styles.playerName}>{getPlayerName(p.playerId)}</span>
                    <span style={{ fontSize: '12px', color: getStatusColor(p), fontWeight: 600 }}>D-{days}</span>
                  </div>
                  <div style={styles.promiseType}>{PROMISE_TYPE_LABELS[p.promiseType]}</div>
                  <div style={styles.dates}>
                    <span>약속일: {p.promiseDate}</span>
                    <span>마감일: {p.deadlineDate}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === 'history' && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>선수</th>
              <th style={styles.th}>약속</th>
              <th style={styles.th}>약속일</th>
              <th style={styles.th}>마감일</th>
              <th style={styles.th}>상태</th>
            </tr>
          </thead>
          <tbody>
            {all.map(p => (
              <tr key={p.id} style={styles.tr}>
                <td style={{ ...styles.td, fontWeight: 500, color: '#e0e0e0' }}>{getPlayerName(p.playerId)}</td>
                <td style={styles.td}>{PROMISE_TYPE_LABELS[p.promiseType]}</td>
                <td style={styles.td}>{p.promiseDate}</td>
                <td style={styles.td}>{p.deadlineDate}</td>
                <td style={{ ...styles.td, fontWeight: 600, color: p.isFulfilled ? '#2ecc71' : p.isBroken ? '#e74c3c' : '#f39c12' }}>
                  {p.isFulfilled ? '이행' : p.isBroken ? '불이행' : '진행중'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { fontSize: '24px', fontWeight: 700, color: '#f0e6d2', marginBottom: '16px' },
  statsBar: {
    display: 'flex', gap: '24px', marginBottom: '16px', padding: '12px 16px',
    background: '#12122a', border: '1px solid #2a2a4a', borderRadius: '8px', fontSize: '13px',
  },
  stat: { color: '#8a8a9a' },
  tabs: { display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid #2a2a4a' },
  tab: {
    padding: '10px 20px', background: 'none', border: 'none',
    borderBottom: '2px solid transparent', color: '#6a6a7a', fontSize: '13px', cursor: 'pointer',
  },
  activeTab: { color: '#c89b3c', borderBottomColor: '#c89b3c' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' },
  card: {
    background: '#12122a', border: '1px solid #2a2a4a', borderRadius: '8px', padding: '14px',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
  playerName: { fontSize: '14px', fontWeight: 600, color: '#e0e0e0' },
  promiseType: { fontSize: '13px', color: '#c89b3c', marginBottom: '8px' },
  dates: { display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', color: '#6a6a7a' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #3a3a5c', color: '#6a6a7a', fontSize: '12px' },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  td: { padding: '8px 10px', color: '#c0c0d0' },
};
