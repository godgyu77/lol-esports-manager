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

  const getStatusBadgeClass = (promise: ManagerPromise): string => {
    if (promise.isFulfilled) return 'fm-badge--success';
    if (promise.isBroken) return 'fm-badge--danger';
    const days = getDaysRemaining(promise.deadlineDate);
    if (days <= 7) return 'fm-badge--danger';
    if (days <= 14) return 'fm-badge--warning';
    return 'fm-badge--success';
  };

  if (!save) return <p className="fm-text-muted fm-text-md">데이터를 불러오는 중...</p>;
  if (isLoading) return <p className="fm-text-muted fm-text-md">약속 정보를 불러오는 중...</p>;

  const fulfilled = all.filter(p => p.isFulfilled).length;
  const broken = all.filter(p => p.isBroken).length;
  const total = all.length;
  const rate = total > 0 ? Math.round((fulfilled / total) * 100) : 100;

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">약속 관리</h1>
      </div>

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__body--compact">
          <div className="fm-flex fm-gap-lg fm-text-md">
            <span className="fm-text-secondary">활성 약속: <strong className="fm-text-accent">{active.length}</strong></span>
            <span className="fm-text-secondary">이행: <strong className="fm-text-success">{fulfilled}</strong></span>
            <span className="fm-text-secondary">불이행: <strong className="fm-text-danger">{broken}</strong></span>
            <span className="fm-text-secondary">이행률: <strong className={rate >= 70 ? 'fm-text-success' : 'fm-text-danger'}>{rate}%</strong></span>
          </div>
        </div>
      </div>

      <div className="fm-tabs">
        <button className={`fm-tab ${tab === 'active' ? 'fm-tab--active' : ''}`} onClick={() => setTab('active')}>
          활성 ({active.length})
        </button>
        <button className={`fm-tab ${tab === 'history' ? 'fm-tab--active' : ''}`} onClick={() => setTab('history')}>
          이력 ({all.length})
        </button>
      </div>

      {tab === 'active' && (
        active.length === 0 ? (
          <p className="fm-text-muted fm-text-md">활성 약속이 없습니다.</p>
        ) : (
          <div className="fm-grid fm-grid--auto">
            {active.map(p => {
              const days = getDaysRemaining(p.deadlineDate);
              return (
                <div key={p.id} className="fm-card" style={{ borderLeft: '3px solid' }}>
                  <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
                    <span className="fm-text-lg fm-font-semibold fm-text-primary">{getPlayerName(p.playerId)}</span>
                    <span className={`fm-badge ${getStatusBadgeClass(p)}`}>D-{days}</span>
                  </div>
                  <div className="fm-text-md fm-text-accent fm-mb-sm">{PROMISE_TYPE_LABELS[p.promiseType]}</div>
                  <div className="fm-flex-col fm-gap-xs fm-text-sm fm-text-muted">
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
        <div className="fm-panel">
          <div className="fm-panel__body--flush fm-table-wrap">
            <table className="fm-table fm-table--striped">
              <thead>
                <tr>
                  <th>선수</th>
                  <th>약속</th>
                  <th>약속일</th>
                  <th>마감일</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {all.map(p => (
                  <tr key={p.id}>
                    <td className="fm-cell--name">{getPlayerName(p.playerId)}</td>
                    <td>{PROMISE_TYPE_LABELS[p.promiseType]}</td>
                    <td>{p.promiseDate}</td>
                    <td>{p.deadlineDate}</td>
                    <td className={`fm-font-semibold ${
                      p.isFulfilled ? 'fm-cell--green' : p.isBroken ? 'fm-cell--red' : 'fm-cell--accent'
                    }`}>
                      {p.isFulfilled ? '이행' : p.isBroken ? '불이행' : '진행중'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
