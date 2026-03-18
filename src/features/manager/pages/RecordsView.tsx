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
    return <p style={{ color: '#6a6a7a' }}>시즌 데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p style={{ color: '#6a6a7a' }}>기록 데이터를 불러오는 중...</p>;
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
    <div>
      <h1 style={styles.title}>기록실</h1>

      {/* 탭 네비게이션 */}
      <div style={styles.tabRow}>
        {([
          ['hallOfFame', '명예의 전당'],
          ['allTimeRecords', '역대 기록'],
          ['teamHistory', '팀 히스토리'],
        ] as [TabType, string][]).map(([tab, label]) => (
          <button
            key={tab}
            style={{
              ...styles.tabBtn,
              ...(activeTab === tab ? styles.tabBtnActive : {}),
            }}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 탭1: 명예의 전당 */}
      {activeTab === 'hallOfFame' && (
        <div>
          {hofSeasonIds.length === 0 ? (
            <div style={styles.card}>
              <p style={styles.emptyText}>
                아직 기록된 명예의 전당 데이터가 없습니다. 시즌이 완료되면 기록됩니다.
              </p>
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
                <div key={seasonId} style={styles.card}>
                  <div style={styles.timelineHeader}>
                    <span style={styles.seasonBadge}>시즌 {seasonId}</span>
                  </div>

                  <div style={styles.timelineContent}>
                    {/* 우승팀 */}
                    {championEntry && (
                      <div style={styles.highlightRow}>
                        <span style={styles.highlightIcon}>🏆</span>
                        <div>
                          <span style={styles.highlightLabel}>우승</span>
                          <span style={styles.highlightValue}>
                            {championEntry.teamId ? getTeamName(championEntry.teamId) : '-'}
                          </span>
                          {championEntry.description && (
                            <span style={styles.highlightDesc}>{championEntry.description}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* MVP */}
                    {mvpEntry && (
                      <div style={styles.highlightRow}>
                        <span style={styles.highlightIcon}>⭐</span>
                        <div>
                          <span style={styles.highlightLabel}>MVP</span>
                          <span style={styles.highlightValue}>
                            {mvpEntry.playerId ? getPlayerName(mvpEntry.playerId) : '-'}
                          </span>
                          {mvpEntry.teamId && (
                            <span style={styles.highlightTeam}>
                              ({getTeamName(mvpEntry.teamId)})
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 기타 기록 */}
                    {otherEntries.length > 0 && (
                      <div style={styles.otherRecords}>
                        {otherEntries.map((entry) => (
                          <div key={entry.id} style={styles.otherRecordItem}>
                            <span style={styles.otherRecordType}>
                              {RECORD_TYPE_LABELS[entry.recordType]}
                            </span>
                            <span style={styles.otherRecordValue}>
                              {entry.playerId
                                ? getPlayerName(entry.playerId)
                                : entry.teamId
                                  ? getTeamName(entry.teamId)
                                  : '-'}
                            </span>
                            {entry.value != null && (
                              <span style={styles.otherRecordStat}>
                                {entry.value.toLocaleString()}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
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
            <div style={styles.card}>
              <p style={styles.emptyText}>
                아직 기록된 데이터가 없습니다. 경기가 진행되면 기록이 집계됩니다.
              </p>
            </div>
          ) : (
            categories.map((category) => {
              const records = recordsByCategory[category];
              return (
                <div key={category} style={styles.card}>
                  <h2 style={styles.sectionTitle}>{category}</h2>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>#</th>
                        <th style={styles.th}>선수/팀</th>
                        <th style={styles.th}>소속</th>
                        <th style={styles.th}>기록</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((rec, idx) => (
                        <tr key={`${rec.playerId}-${idx}`} style={styles.tr}>
                          <td
                            style={{
                              ...styles.td,
                              color: idx < 3 ? '#c89b3c' : '#c0c0d0',
                              fontWeight: idx < 3 ? 700 : 400,
                            }}
                          >
                            {idx + 1}
                          </td>
                          <td style={{ ...styles.td, ...styles.nameCell }}>
                            {rec.playerName}
                          </td>
                          <td style={styles.td}>
                            {rec.teamId ? getTeamName(rec.teamId) : '-'}
                          </td>
                          <td
                            style={{
                              ...styles.td,
                              color: '#c89b3c',
                              fontWeight: 600,
                            }}
                          >
                            {rec.value.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 탭3: 팀 히스토리 */}
      {activeTab === 'teamHistory' && (
        <div>
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>
              {userTeamName} 시즌별 성적
            </h2>

            {teamHistory.length === 0 ? (
              <p style={styles.emptyText}>
                아직 기록된 시즌 성적이 없습니다.
              </p>
            ) : (
              <>
                {/* 요약 카드 */}
                <div style={styles.summaryRow}>
                  <div style={styles.summaryCard}>
                    <span style={styles.summaryLabel}>총 시즌</span>
                    <span style={styles.summaryValue}>{teamHistory.length}</span>
                  </div>
                  <div style={styles.summaryCard}>
                    <span style={styles.summaryLabel}>우승 횟수</span>
                    <span style={{ ...styles.summaryValue, color: '#c89b3c' }}>
                      {teamHistory.filter((r) => r.champion).length}
                    </span>
                  </div>
                  <div style={styles.summaryCard}>
                    <span style={styles.summaryLabel}>통산 전적</span>
                    <span style={styles.summaryValue}>
                      {teamHistory.reduce((s, r) => s + r.wins, 0)}승{' '}
                      {teamHistory.reduce((s, r) => s + r.losses, 0)}패
                    </span>
                  </div>
                  <div style={styles.summaryCard}>
                    <span style={styles.summaryLabel}>통산 승률</span>
                    <span style={styles.summaryValue}>
                      {(() => {
                        const totalW = teamHistory.reduce((s, r) => s + r.wins, 0);
                        const totalL = teamHistory.reduce((s, r) => s + r.losses, 0);
                        const total = totalW + totalL;
                        return total > 0 ? ((totalW / total) * 100).toFixed(1) + '%' : '0.0%';
                      })()}
                    </span>
                  </div>
                </div>

                {/* 시즌별 테이블 */}
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>시즌</th>
                      <th style={styles.th}>순위</th>
                      <th style={styles.th}>승</th>
                      <th style={styles.th}>패</th>
                      <th style={styles.th}>승률</th>
                      <th style={styles.th}>플레이오프</th>
                      <th style={styles.th}>우승</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamHistory.map((record) => {
                      const total = record.wins + record.losses;
                      const winRate = total > 0 ? ((record.wins / total) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={record.id} style={styles.tr}>
                          <td style={styles.td}>시즌 {record.seasonId}</td>
                          <td style={styles.td}>
                            {record.finalStanding != null ? `${record.finalStanding}위` : '-'}
                          </td>
                          <td style={styles.td}>{record.wins}</td>
                          <td style={styles.td}>{record.losses}</td>
                          <td style={styles.td}>{winRate}%</td>
                          <td style={styles.td}>{record.playoffResult ?? '-'}</td>
                          <td
                            style={{
                              ...styles.td,
                              color: record.champion ? '#c89b3c' : '#6a6a7a',
                              fontWeight: record.champion ? 700 : 400,
                            }}
                          >
                            {record.champion ? '🏆' : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '24px',
  },
  tabRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
  },
  tabBtn: {
    padding: '8px 20px',
    fontSize: '13px',
    fontWeight: 500,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #3a3a5c',
    borderRadius: '6px',
    color: '#8a8a9a',
    cursor: 'pointer',
  },
  tabBtnActive: {
    background: 'rgba(200,155,60,0.15)',
    borderColor: '#c89b3c',
    color: '#c89b3c',
    fontWeight: 700,
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a2a4a',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#c89b3c',
    marginBottom: '16px',
    borderBottom: '1px solid #3a3a5c',
    paddingBottom: '8px',
  },
  emptyText: {
    fontSize: '14px',
    color: '#6a6a7a',
    textAlign: 'center',
    padding: '24px 0',
  },
  // 명예의 전당 타임라인
  timelineHeader: {
    marginBottom: '16px',
  },
  seasonBadge: {
    display: 'inline-block',
    padding: '4px 14px',
    background: 'rgba(200,155,60,0.15)',
    border: '1px solid rgba(200,155,60,0.3)',
    borderRadius: '20px',
    color: '#c89b3c',
    fontSize: '13px',
    fontWeight: 700,
  },
  timelineContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  highlightRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
  },
  highlightIcon: {
    fontSize: '24px',
    width: '40px',
    textAlign: 'center',
    flexShrink: 0,
  },
  highlightLabel: {
    fontSize: '12px',
    color: '#6a6a7a',
    fontWeight: 500,
    marginRight: '8px',
  },
  highlightValue: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#f0e6d2',
  },
  highlightTeam: {
    fontSize: '13px',
    color: '#8a8a9a',
    marginLeft: '6px',
  },
  highlightDesc: {
    fontSize: '12px',
    color: '#6a6a7a',
    marginLeft: '8px',
  },
  otherRecords: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  otherRecordItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '6px',
    fontSize: '13px',
  },
  otherRecordType: {
    color: '#6a6a7a',
    fontWeight: 500,
  },
  otherRecordValue: {
    color: '#e0e0e0',
    fontWeight: 500,
  },
  otherRecordStat: {
    color: '#c89b3c',
    fontWeight: 600,
    marginLeft: '4px',
  },
  // 팀 히스토리 요약
  summaryRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    marginBottom: '20px',
  },
  summaryCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  summaryLabel: {
    fontSize: '12px',
    color: '#6a6a7a',
    fontWeight: 500,
  },
  summaryValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#f0e6d2',
  },
  // 공통 테이블
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
  nameCell: {
    fontWeight: 500,
    color: '#e0e0e0',
  },
};
