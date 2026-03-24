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
import { generateScoutingReport, type ScoutingReport as AiScoutingReport } from '../../../ai/advancedAiService';

type Tab = 'scouts' | 'reports' | 'watchlist';

const POSITION_LABELS: Record<string, string> = {
  top: 'TOP', jungle: 'JGL', mid: 'MID', adc: 'ADC', support: 'SUP',
};

const POS_CLASS: Record<string, string> = {
  top: 'fm-pos-badge--top',
  jungle: 'fm-pos-badge--jgl',
  mid: 'fm-pos-badge--mid',
  adc: 'fm-pos-badge--adc',
  support: 'fm-pos-badge--sup',
};

const GRADE_BADGE: Record<string, string> = {
  S: 'fm-badge--danger',
  A: 'fm-badge--accent',
  B: 'fm-badge--info',
  C: 'fm-badge--default',
  D: 'fm-badge--default',
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
  const [aiAnalysis, setAiAnalysis] = useState<Record<number, AiScoutingReport>>({});
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState<Record<number, boolean>>({});

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

  const handleRequestAiAnalysis = async (report: ScoutingReport) => {
    if (aiAnalysis[report.id] || aiAnalysisLoading[report.id]) return;
    const player = findPlayer(report.playerId);
    if (!player) return;

    setAiAnalysisLoading(prev => ({ ...prev, [report.id]: true }));
    try {
      const result = await generateScoutingReport({
        playerName: player.name,
        position: player.position,
        age: player.age,
        ovr: Math.round((player.stats.mechanical + player.stats.gameSense + player.stats.teamwork + player.stats.consistency + player.stats.laning + player.stats.aggression) / 6),
        potential: player.potential ?? 50,
        stats: {
          mechanical: report.reportedStats.mechanical ?? 50,
          gameSense: report.reportedStats.gameSense ?? 50,
          teamwork: report.reportedStats.teamwork ?? 50,
          consistency: report.reportedStats.consistency ?? 50,
          laning: report.reportedStats.laning ?? 50,
          aggression: report.reportedStats.aggression ?? 50,
        },
      });
      setAiAnalysis(prev => ({ ...prev, [report.id]: result }));
      // AI 분석 결과 DB 저장
      try {
        const { getDatabase } = await import('../../../db/database');
        const db = await getDatabase();
        await db.execute(
          `UPDATE scouting_reports SET ai_analysis = $1, ai_analyzed_at = datetime('now')
           WHERE id = $2`,
          [JSON.stringify(result), report.id],
        );
      } catch { /* ai_analysis 컬럼 없으면 무시 */ }
    } catch {
      // AI 분석 실패 시 무시
    } finally {
      setAiAnalysisLoading(prev => ({ ...prev, [report.id]: false }));
    }
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
    return <p className="fm-text-muted">데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return (
      <div>
        <Skeleton width="160px" height="28px" variant="text" />
        <div className="fm-mt-md fm-flex fm-gap-xs fm-mb-md">
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
      <div className="fm-page-header">
        <h1 className="fm-page-title">스카우팅</h1>
      </div>

      {message && (
        <div className={`fm-alert ${message.type === 'success' ? 'fm-alert--success' : 'fm-alert--danger'} fm-mb-md`}>
          <span className="fm-alert__text">{message.text}</span>
        </div>
      )}

      {/* 탭 */}
      <div className="fm-tabs">
        <button
          className={`fm-tab ${tab === 'scouts' ? 'fm-tab--active' : ''}`}
          onClick={() => setTab('scouts')}
        >
          스카우트 ({scouts.length})
        </button>
        <button
          className={`fm-tab ${tab === 'reports' ? 'fm-tab--active' : ''}`}
          onClick={() => setTab('reports')}
        >
          리포트 ({completedReports.length})
        </button>
        <button
          className={`fm-tab ${tab === 'watchlist' ? 'fm-tab--active' : ''}`}
          onClick={() => setTab('watchlist')}
        >
          관심 목록 ({watchlist.length})
        </button>
      </div>

      {/* 탭 1: 스카우트 관리 */}
      {tab === 'scouts' && (
        <div>
          <div className="fm-flex fm-justify-between fm-items-center fm-mb-md">
            <h2 className="fm-text-lg fm-font-semibold fm-text-accent">소속 스카우트</h2>
            <button className="fm-btn fm-btn--primary" onClick={handleHireScout}>
              + 스카우트 고용
            </button>
          </div>

          {scouts.length === 0 ? (
            <p className="fm-text-muted fm-text-md">고용된 스카우트가 없습니다. 스카우트를 고용하세요.</p>
          ) : (
            <div className="fm-grid fm-grid--auto">
              {scouts.map(scout => {
                const busy = isScoutBusy(scout.id);
                const busyReport = pendingReports.find(r => r.scoutId === scout.id);
                const busyPlayer = busyReport ? findPlayer(busyReport.playerId) : null;
                return (
                  <div key={scout.id} className="fm-card">
                    <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
                      <span className="fm-text-lg fm-font-semibold fm-text-primary">{scout.name}</span>
                      <span className="fm-badge fm-badge--accent">능력 {scout.ability}</span>
                    </div>
                    <div className="fm-flex-col fm-gap-xs fm-text-xs fm-text-secondary fm-mb-sm">
                      <span>특화 리전: {scout.regionSpecialty ?? '없음'}</span>
                      <span>경험: {scout.experience}건</span>
                      <span>연봉: {scout.salary}만</span>
                    </div>
                    <div className="fm-mb-sm">
                      {busy ? (
                        <span className="fm-badge fm-badge--warning">
                          스카우팅 중: {busyPlayer?.name ?? '???'} (D-{busyReport?.daysRemaining})
                        </span>
                      ) : (
                        <span className="fm-badge fm-badge--success">대기중</span>
                      )}
                    </div>
                    <div className="fm-flex fm-gap-sm">
                      <button
                        className="fm-btn fm-btn--sm"
                        style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                        disabled={busy}
                        onClick={() => setAssignModal(scout)}
                      >
                        배정
                      </button>
                      <button
                        className="fm-btn fm-btn--sm fm-btn--ghost"
                        onClick={() => handleFireScout(scout.id)}
                      >
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
              <h2 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-md">진행 중 ({pendingReports.length})</h2>
              <div className="fm-panel fm-mb-lg">
                <div className="fm-panel__body--flush fm-table-wrap">
                  <table className="fm-table fm-table--striped">
                    <thead>
                      <tr>
                        <th>선수</th>
                        <th>소속</th>
                        <th>스카우트</th>
                        <th>남은 일수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingReports.map(report => {
                        const player = findPlayer(report.playerId);
                        const scout = scouts.find(s => s.id === report.scoutId);
                        return (
                          <tr key={report.id}>
                            <td className="fm-cell--name">{player?.name ?? report.playerId}</td>
                            <td>{findTeamName(report.playerId)}</td>
                            <td>{scout?.name ?? '???'}</td>
                            <td><span className="fm-text-warning fm-font-semibold">D-{report.daysRemaining}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* 완료된 리포트 */}
          <h2 className={`fm-text-lg fm-font-semibold fm-text-accent fm-mb-md ${pendingReports.length > 0 ? '' : ''}`}>
            완료된 리포트 ({completedReports.length})
          </h2>
          {completedReports.length === 0 ? (
            <p className="fm-text-muted fm-text-md">완료된 리포트가 없습니다.</p>
          ) : (
            <div className="fm-grid fm-grid--auto">
              {completedReports.map(report => {
                const player = findPlayer(report.playerId);
                return (
                  <div key={report.id} className="fm-card">
                    <div className="fm-flex fm-items-center fm-gap-sm fm-mb-sm">
                      <span className={`fm-badge ${GRADE_BADGE[report.overallGrade] ?? 'fm-badge--default'}`} style={{ fontSize: '16px', fontWeight: 800, padding: '4px 10px' }}>
                        {report.overallGrade}
                      </span>
                      <span className="fm-text-lg fm-font-semibold fm-text-primary">{player?.name ?? report.playerId}</span>
                      <span className="fm-text-xs fm-text-muted" style={{ marginLeft: 'auto' }}>{findTeamName(report.playerId)}</span>
                    </div>
                    <div className="fm-mb-sm">
                      <span className="fm-badge fm-badge--default">정확도: {report.accuracy}%</span>
                    </div>
                    <div className="fm-flex-col fm-gap-xs fm-mb-sm">
                      {report.reportedStats.mechanical != null && (
                        <div className="fm-info-row">
                          <span className="fm-info-row__label">기계적</span>
                          <span className="fm-info-row__value">{report.reportedStats.mechanical}</span>
                        </div>
                      )}
                      {report.reportedStats.gameSense != null && (
                        <div className="fm-info-row">
                          <span className="fm-info-row__label">판단력</span>
                          <span className="fm-info-row__value">{report.reportedStats.gameSense}</span>
                        </div>
                      )}
                      {report.reportedStats.teamwork != null && (
                        <div className="fm-info-row">
                          <span className="fm-info-row__label">팀워크</span>
                          <span className="fm-info-row__value">{report.reportedStats.teamwork}</span>
                        </div>
                      )}
                      {report.reportedStats.laning != null && (
                        <div className="fm-info-row">
                          <span className="fm-info-row__label">라인전</span>
                          <span className="fm-info-row__value">{report.reportedStats.laning}</span>
                        </div>
                      )}
                      {report.reportedStats.consistency != null && (
                        <div className="fm-info-row">
                          <span className="fm-info-row__label">일관성</span>
                          <span className="fm-info-row__value">{report.reportedStats.consistency}</span>
                        </div>
                      )}
                      {report.reportedStats.aggression != null && (
                        <div className="fm-info-row">
                          <span className="fm-info-row__label">공격성</span>
                          <span className="fm-info-row__value">{report.reportedStats.aggression}</span>
                        </div>
                      )}
                      {report.reportedPotential != null && (
                        <div className="fm-info-row">
                          <span className="fm-info-row__label">잠재력</span>
                          <span className="fm-info-row__value fm-text-accent">{report.reportedPotential}</span>
                        </div>
                      )}
                      {report.reportedMental != null && (
                        <div className="fm-info-row">
                          <span className="fm-info-row__label">멘탈</span>
                          <span className="fm-info-row__value">{report.reportedMental}</span>
                        </div>
                      )}
                    </div>
                    {report.scoutComment && (
                      <div className="fm-text-xs fm-text-secondary fm-p-sm fm-mb-sm" style={{ fontStyle: 'italic', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                        "{report.scoutComment}"
                      </div>
                    )}
                    {/* AI 분석 섹션 */}
                    {aiAnalysis[report.id] ? (
                      <div className="fm-card--highlight fm-p-sm fm-flex-col fm-gap-xs" style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-border)', background: 'var(--accent-dim)' }}>
                        <span className="fm-text-xs fm-font-bold fm-text-accent">AI 분석</span>
                        <span className="fm-text-xs fm-font-medium fm-text-primary">{aiAnalysis[report.id].summary}</span>
                        <div className="fm-flex fm-gap-md">
                          <div>
                            <span className="fm-text-xs fm-font-semibold fm-text-success">강점</span>
                            {aiAnalysis[report.id].strengths.map((s, i) => (
                              <div key={i} className="fm-text-xs fm-text-secondary">+ {s}</div>
                            ))}
                          </div>
                          <div>
                            <span className="fm-text-xs fm-font-semibold fm-text-danger">약점</span>
                            {aiAnalysis[report.id].weaknesses.map((w, i) => (
                              <div key={i} className="fm-text-xs fm-text-secondary">- {w}</div>
                            ))}
                          </div>
                        </div>
                        <span className="fm-badge fm-badge--accent">{aiAnalysis[report.id].recommendation}</span>
                      </div>
                    ) : (
                      <button
                        className="fm-btn fm-btn--sm fm-mt-sm"
                        style={{ borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
                        disabled={aiAnalysisLoading[report.id] ?? false}
                        onClick={() => handleRequestAiAnalysis(report)}
                      >
                        {aiAnalysisLoading[report.id] ? '분석 중...' : 'AI 분석 요청'}
                      </button>
                    )}
                    <div className="fm-text-xs fm-text-muted fm-mt-sm">{report.reportDate}</div>
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
          <h2 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-md">관심 선수 목록</h2>
          {watchlist.length === 0 ? (
            <p className="fm-text-muted fm-text-md">관심 목록이 비어있습니다. 선수 배정 화면에서 추가하세요.</p>
          ) : (
            <div className="fm-panel">
              <div className="fm-panel__body--flush fm-table-wrap">
                <table className="fm-table fm-table--striped">
                  <thead>
                    <tr>
                      <th>포지션</th>
                      <th>이름</th>
                      <th>소속</th>
                      <th>추가일</th>
                      <th>최신 리포트</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlist.map(entry => {
                      const player = findPlayer(entry.playerId);
                      const report = completedReports.find(r => r.playerId === entry.playerId);
                      return (
                        <tr key={entry.playerId}>
                          <td>
                            {player ? (
                              <span className={`fm-pos-badge ${POS_CLASS[player.position] ?? ''}`}>
                                {POSITION_LABELS[player.position] ?? player.position}
                              </span>
                            ) : '???'}
                          </td>
                          <td className="fm-cell--name">{player?.name ?? entry.playerId}</td>
                          <td>{findTeamName(entry.playerId)}</td>
                          <td>{entry.addedDate}</td>
                          <td>
                            {report ? (
                              <span className={`fm-badge ${GRADE_BADGE[report.overallGrade] ?? 'fm-badge--default'}`}>
                                {report.overallGrade} ({report.accuracy}%)
                              </span>
                            ) : (
                              <span className="fm-text-muted">없음</span>
                            )}
                          </td>
                          <td>
                            <button
                              className="fm-btn fm-btn--sm fm-btn--ghost"
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
              </div>
            </div>
          )}
        </div>
      )}

      {/* 배정 모달 */}
      {assignModal && (
        <div className="fm-overlay" role="dialog" aria-modal="true" aria-label="스카우팅 배정" onClick={() => setAssignModal(null)}>
          <div className="fm-modal" style={{ width: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="fm-modal__header">
              <h2 className="fm-modal__title">스카우팅 배정 -- {assignModal.name}</h2>
              <button className="fm-modal__close" onClick={() => setAssignModal(null)}>&times;</button>
            </div>
            <div className="fm-modal__body">
              <div className="fm-flex fm-gap-xs fm-mb-md">
                {['all', 'top', 'jungle', 'mid', 'adc', 'support'].map(pos => (
                  <button
                    key={pos}
                    className={`fm-btn fm-btn--sm ${posFilter === pos ? 'fm-btn--primary' : ''}`}
                    onClick={() => setPosFilter(pos)}
                  >
                    {pos === 'all' ? '전체' : POSITION_LABELS[pos]}
                  </button>
                ))}
              </div>

              <div className="fm-flex-col fm-gap-xs" style={{ maxHeight: '400px', overflow: 'auto' }}>
                {filteredPlayers.slice(0, 50).map(player => {
                  const hasReport = completedReports.some(r => r.playerId === player.id);
                  const isPending = pendingReports.some(r => r.playerId === player.id);
                  const inWatchlist = watchlist.some(w => w.playerId === player.id);
                  return (
                    <div key={player.id} className="fm-flex fm-items-center fm-gap-sm fm-p-sm" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                      <span className={`fm-pos-badge ${POS_CLASS[player.position] ?? ''}`} style={{ minWidth: '36px' }}>
                        {POSITION_LABELS[player.position]}
                      </span>
                      <span className="fm-flex-1 fm-text-md fm-text-primary">{player.name}</span>
                      <span className="fm-text-xs fm-text-muted" style={{ width: '60px' }}>{findTeamName(player.id)}</span>
                      <span className="fm-text-xs fm-text-muted" style={{ width: '36px' }}>{player.age}세</span>
                      {hasReport && <span className="fm-badge fm-badge--success">리포트有</span>}
                      {isPending && <span className="fm-badge fm-badge--warning">진행중</span>}
                      <button
                        className="fm-btn fm-btn--sm fm-btn--ghost"
                        onClick={() => handleToggleWatchlist(player.id)}
                        title={inWatchlist ? '관심 해제' : '관심 등록'}
                        style={{ color: inWatchlist ? 'var(--accent)' : 'var(--text-muted)', fontSize: '16px' }}
                      >
                        {inWatchlist ? '\u2605' : '\u2606'}
                      </button>
                      <button
                        className="fm-btn fm-btn--primary fm-btn--sm"
                        disabled={isPending}
                        onClick={() => handleAssign(assignModal.id, player.id)}
                      >
                        배정
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="fm-modal__footer">
              <button className="fm-btn" onClick={() => setAssignModal(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
