/**
 * 기록실 뷰
 * - 탭1 "명예의 전당": 시즌별 우승팀/MVP 타임라인
 * - 탭2 "역대 기록": 최다 킬/승/연승 등 기록 테이블
 * - 탭3 "팀 히스토리": 내 팀 시즌별 성적 표
 */

import { useEffect, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  getHallOfFame,
  getAllTimeRecords,
  getTeamHistory,
} from '../../../engine/records/recordsEngine';
import type { HallOfFameEntry, SeasonRecord } from '../../../types/records';
import { RECORD_TYPE_LABELS } from '../../../types/records';
import type { AllTimeRecord } from '../../../engine/records/recordsEngine';
import { MainLoopPanel } from '../components/MainLoopPanel';

type TabType = 'hallOfFame' | 'allTimeRecords' | 'teamHistory';

export function RecordsView() {
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);
  const save = useGameStore((s) => s.save);

  const [hallOfFame, setHallOfFame] = useState<HallOfFameEntry[]>([]);
  const [allTimeRecords, setAllTimeRecords] = useState<AllTimeRecord[]>([]);
  const [teamHistory, setTeamHistory] = useState<SeasonRecord[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('hallOfFame');
  const [isLoading, setIsLoading] = useState(true);

  const userTeamId = save?.userTeamId;

  useEffect(() => {
    if (!season) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const [hofData, recordsData, historyData] = await Promise.all([
        getHallOfFame(),
        getAllTimeRecords(),
        userTeamId ? getTeamHistory(userTeamId) : Promise.resolve([]),
      ]);
      if (!cancelled) {
        setHallOfFame(hofData);
        setAllTimeRecords(recordsData);
        setTeamHistory(historyData);
        setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [season, userTeamId]);

  if (!season) {
    return <p className="fm-text-muted fm-text-md">시즌 데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p className="fm-text-muted fm-text-md">기록 데이터를 불러오는 중...</p>;
  }

  const getTeamName = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    return team?.shortName ?? team?.name ?? teamId;
  };

  const getPlayerName = (playerId: string) => {
    for (const team of teams) {
      const player = team.roster?.find((p) => p.id === playerId);
      if (player) return player.name;
    }
    return playerId;
  };

  // 명예의 전당을 시즌별로 그룹화
  const hofBySeason: Record<number, HallOfFameEntry[]> = {};
  for (const entry of hallOfFame) {
    if (!hofBySeason[entry.seasonId]) {
      hofBySeason[entry.seasonId] = [];
    }
    hofBySeason[entry.seasonId].push(entry);
  }
  const hofSeasonIds = Object.keys(hofBySeason)
    .map(Number)
    .sort((a, b) => b - a);

  // 역대 기록을 카테고리별로 그룹화
  const recordsByCategory: Record<string, AllTimeRecord[]> = {};
  for (const rec of allTimeRecords) {
    if (!recordsByCategory[rec.category]) {
      recordsByCategory[rec.category] = [];
    }
    recordsByCategory[rec.category].push(rec);
  }
  const categories = Object.keys(recordsByCategory);

  const userTeamName = userTeamId ? getTeamName(userTeamId) : '';

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">기록실</h1>
      </div>

      {/* 탭 네비게이션 */}
      <MainLoopPanel
        eyebrow="참고 화면"
        title="명예의 전당과 구단 기록을 먼저 읽는 기록실"
        subtitle="탭별 표를 길게 보기 전에 지금 어느 기록 묶음을 보고 있는지와 데이터 축적 정도를 먼저 파악할 수 있게 정리했습니다."
        insights={[
          {
            label: '명예의 전당',
            value: `${hofSeasonIds.length}시즌`,
            detail: hofSeasonIds.length > 0 ? '시즌별 우승과 MVP 기록이 누적되어 있습니다.' : '아직 시즌 종료 기록이 없습니다.',
            tone: hofSeasonIds.length > 0 ? 'success' : 'warning',
          },
          {
            label: '전체 기록',
            value: `${allTimeRecords.length}개`,
            detail: `${categories.length}개 카테고리로 정리됩니다.`,
            tone: categories.length > 0 ? 'accent' : 'neutral',
          },
          {
            label: '팀 히스토리',
            value: userTeamName || '팀 미선택',
            detail: `${teamHistory.length}개 시즌 기록이 팀 히스토리에 쌓여 있습니다.`,
            tone: teamHistory.length > 0 ? 'accent' : 'neutral',
          },
          {
            label: '현재 보기',
            value: activeTab === 'hallOfFame' ? '명예의 전당' : activeTab === 'allTimeRecords' ? '전체 기록' : '팀 히스토리',
            detail: '아래 탭에서 시즌별 수상, 전체 기록, 팀 히스토리를 차례로 읽을 수 있습니다.',
            tone: 'neutral',
          },
        ]}
        note="기록실은 비교적 숨 고르는 화면이라, 상단 요약 뒤에 탭별 상세 기록을 읽는 흐름으로 유지했습니다."
      />

      <div className="fm-tabs">
        {([
          ['hallOfFame', '명예의 전당'],
          ['allTimeRecords', '역대 기록'],
          ['teamHistory', '팀 히스토리'],
        ] as [TabType, string][]).map(([tabKey, label]) => (
          <button
            key={tabKey}
            className={`fm-tab ${activeTab === tabKey ? 'fm-tab--active' : ''}`}
            onClick={() => setActiveTab(tabKey)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 탭1: 명예의 전당 */}
      {activeTab === 'hallOfFame' && (
        <div>
          {hofSeasonIds.length === 0 ? (
            <div className="fm-panel">
              <div className="fm-panel__body fm-text-center">
                <p className="fm-text-muted fm-text-md">
                  아직 기록된 명예의 전당 데이터가 없습니다. 시즌이 완료되면 기록됩니다.
                </p>
              </div>
            </div>
          ) : (
            hofSeasonIds.map((seasonId) => {
              const entries = hofBySeason[seasonId];
              const championEntry = entries.find((e) => e.recordType === 'champion');
              const mvpEntry = entries.find((e) => e.recordType === 'mvp');
              const otherEntries = entries.filter(
                (e) => e.recordType !== 'champion' && e.recordType !== 'mvp',
              );

              return (
                <div key={seasonId} className="fm-panel fm-mb-md">
                  <div className="fm-panel__header">
                    <span className="fm-badge fm-badge--accent">시즌 {seasonId}</span>
                  </div>
                  <div className="fm-panel__body">
                    <div className="fm-flex-col fm-gap-sm">
                      {/* 우승팀 */}
                      {championEntry && (
                        <div className="fm-flex fm-items-center fm-gap-md fm-p-sm">
                          <span className="fm-text-2xl fm-flex-shrink-0" style={{ width: '40px', textAlign: 'center' }}>
                            🏆
                          </span>
                          <div>
                            <span className="fm-text-base fm-text-muted fm-font-medium" style={{ marginRight: '8px' }}>
                              우승
                            </span>
                            <span className="fm-text-xl fm-font-bold fm-text-primary">
                              {championEntry.teamId ? getTeamName(championEntry.teamId) : '-'}
                            </span>
                            {championEntry.description && (
                              <span className="fm-text-base fm-text-muted" style={{ marginLeft: '8px' }}>
                                {championEntry.description}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* MVP */}
                      {mvpEntry && (
                        <div className="fm-flex fm-items-center fm-gap-md fm-p-sm">
                          <span className="fm-text-2xl fm-flex-shrink-0" style={{ width: '40px', textAlign: 'center' }}>
                            ⭐
                          </span>
                          <div>
                            <span className="fm-text-base fm-text-muted fm-font-medium" style={{ marginRight: '8px' }}>
                              MVP
                            </span>
                            <span className="fm-text-xl fm-font-bold fm-text-primary">
                              {mvpEntry.playerId ? getPlayerName(mvpEntry.playerId) : '-'}
                            </span>
                            {mvpEntry.teamId && (
                              <span className="fm-text-md fm-text-secondary" style={{ marginLeft: '6px' }}>
                                ({getTeamName(mvpEntry.teamId)})
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 기타 기록 */}
                      {otherEntries.length > 0 && (
                        <div className="fm-divider" />
                      )}
                      {otherEntries.length > 0 && (
                        <div className="fm-flex fm-flex-wrap fm-gap-sm">
                          {otherEntries.map((entry) => (
                            <div key={entry.id} className="fm-card fm-flex fm-items-center fm-gap-sm">
                              <span className="fm-text-muted fm-font-medium fm-text-md">
                                {RECORD_TYPE_LABELS[entry.recordType]}
                              </span>
                              <span className="fm-text-primary fm-font-medium fm-text-md">
                                {entry.playerId
                                  ? getPlayerName(entry.playerId)
                                  : entry.teamId
                                    ? getTeamName(entry.teamId)
                                    : '-'}
                              </span>
                              {entry.value != null && (
                                <span className="fm-text-accent fm-font-semibold fm-text-md">
                                  {entry.value.toLocaleString()}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 탭2: 역대 기록 */}
      {activeTab === 'allTimeRecords' && (
        <div>
          {categories.length === 0 ? (
            <div className="fm-panel">
              <div className="fm-panel__body fm-text-center">
                <p className="fm-text-muted fm-text-md">
                  아직 기록된 데이터가 없습니다. 경기가 진행되면 기록이 집계됩니다.
                </p>
              </div>
            </div>
          ) : (
            categories.map((category) => {
              const records = recordsByCategory[category];
              return (
                <div key={category} className="fm-panel fm-mb-md">
                  <div className="fm-panel__header">
                    <span className="fm-panel__title">{category}</span>
                  </div>
                  <div className="fm-panel__body--flush fm-table-wrap">
                    <table className="fm-table fm-table--striped">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>선수/팀</th>
                          <th>소속</th>
                          <th>기록</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((rec, idx) => (
                          <tr key={`${rec.playerId}-${idx}`}>
                            <td className={idx < 3 ? 'fm-cell--gold' : ''}>
                              {idx + 1}
                            </td>
                            <td className="fm-cell--name">
                              {rec.playerName}
                            </td>
                            <td>
                              {rec.teamId ? getTeamName(rec.teamId) : '-'}
                            </td>
                            <td className="fm-cell--accent">
                              {rec.value.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 탭3: 팀 히스토리 */}
      {activeTab === 'teamHistory' && (
        <div>
          <div className="fm-panel">
            <div className="fm-panel__header">
              <span className="fm-panel__title">{userTeamName} 시즌별 성적</span>
            </div>
            <div className="fm-panel__body">
              {teamHistory.length === 0 ? (
                <p className="fm-text-muted fm-text-md fm-text-center fm-p-lg">
                  아직 기록된 시즌 성적이 없습니다.
                </p>
              ) : (
                <>
                  {/* 요약 카드 */}
                  <div className="fm-grid fm-grid--4 fm-mb-lg">
                    <div className="fm-card fm-text-center">
                      <div className="fm-stat">
                        <span className="fm-stat__label">총 시즌</span>
                        <span className="fm-stat__value">{teamHistory.length}</span>
                      </div>
                    </div>
                    <div className="fm-card fm-text-center">
                      <div className="fm-stat">
                        <span className="fm-stat__label">우승 횟수</span>
                        <span className="fm-stat__value fm-stat__value--accent">
                          {teamHistory.filter((r) => r.champion).length}
                        </span>
                      </div>
                    </div>
                    <div className="fm-card fm-text-center">
                      <div className="fm-stat">
                        <span className="fm-stat__label">통산 전적</span>
                        <span className="fm-stat__value">
                          {teamHistory.reduce((s, r) => s + r.wins, 0)}승{' '}
                          {teamHistory.reduce((s, r) => s + r.losses, 0)}패
                        </span>
                      </div>
                    </div>
                    <div className="fm-card fm-text-center">
                      <div className="fm-stat">
                        <span className="fm-stat__label">통산 승률</span>
                        <span className="fm-stat__value">
                          {(() => {
                            const totalW = teamHistory.reduce((s, r) => s + r.wins, 0);
                            const totalL = teamHistory.reduce((s, r) => s + r.losses, 0);
                            const t = totalW + totalL;
                            return t > 0 ? ((totalW / t) * 100).toFixed(1) + '%' : '0.0%';
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 시즌별 테이블 */}
                  <div className="fm-table-wrap">
                    <table className="fm-table fm-table--striped">
                      <thead>
                        <tr>
                          <th>시즌</th>
                          <th>순위</th>
                          <th>승</th>
                          <th>패</th>
                          <th>승률</th>
                          <th>플레이오프</th>
                          <th>우승</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamHistory.map((record) => {
                          const totalGames = record.wins + record.losses;
                          const winRate = totalGames > 0 ? ((record.wins / totalGames) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={record.id}>
                              <td>시즌 {record.seasonId}</td>
                              <td>
                                {record.finalStanding != null ? `${record.finalStanding}위` : '-'}
                              </td>
                              <td>{record.wins}</td>
                              <td>{record.losses}</td>
                              <td>{winRate}%</td>
                              <td>{record.playoffResult ?? '-'}</td>
                              <td className={record.champion ? 'fm-cell--gold' : ''}>
                                {record.champion ? '🏆' : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
