/**
 * 어워드 뷰
 * - 현재 시즌 어워드 목록 (시즌 종료 후)
 * - MVP 후보 순위 (시즌 진행 중 예측)
 * - 포지션별 All-Pro 팀 시각화
 * - 선수 수상 이력
 */

import { useEffect, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getAwardsBySeason, getMvpCandidates } from '../../../engine/award/awardEngine';
import type { Award } from '../../../types/award';
import { AWARD_TYPE_LABELS } from '../../../types/award';
import type { Position } from '../../../types/game';

interface MvpCandidate {
  playerId: string;
  playerName: string;
  teamId: string;
  position: string;
  kda: number;
  score: number;
  games: number;
}

type TabType = 'overview' | 'allpro' | 'candidates';

const POSITION_LABELS: Record<Position, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: 'ADC',
  support: '서포터',
};

export function AwardsView() {
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);

  const [awards, setAwards] = useState<Award[]>([]);
  const [candidates, setCandidates] = useState<MvpCandidate[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!season) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const [awardsData, candidatesData] = await Promise.all([
        getAwardsBySeason(season.id),
        getMvpCandidates(season.id),
      ]);
      if (!cancelled) {
        setAwards(awardsData);
        setCandidates(candidatesData);
        setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [season]);

  if (!season) {
    return <p style={{ color: '#6a6a7a' }}>시즌 데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p style={{ color: '#6a6a7a' }}>어워드 데이터를 불러오는 중...</p>;
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

  // 어워드 분류
  const mvpAward = awards.find((a) => a.awardType === 'mvp');
  const rookieAward = awards.find((a) => a.awardType === 'rookie_of_year');
  const allPro1st = awards.filter((a) => a.awardType === 'all_pro_1st');
  const allPro2nd = awards.filter((a) => a.awardType === 'all_pro_2nd');
  const monthlyMvps = awards.filter((a) => a.awardType === 'monthly_mvp');
  const hasSeasonAwards = mvpAward || allPro1st.length > 0;

  return (
    <div>
      <h1 style={styles.title}>
        {season.year}년 {season.split === 'spring' ? '스프링' : '서머'} 어워드
      </h1>

      {/* 탭 네비게이션 */}
      <div style={styles.tabRow}>
        {([
          ['overview', '시즌 어워드'],
          ['allpro', 'All-Pro Team'],
          ['candidates', 'MVP 레이스'],
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

      {/* 시즌 어워드 탭 */}
      {activeTab === 'overview' && (
        <div>
          {!hasSeasonAwards && (
            <div style={styles.card}>
              <p style={styles.emptyText}>
                시즌 어워드는 시즌 종료 후 산출됩니다. 아래 MVP 레이스 탭에서 현재 순위를 확인하세요.
              </p>
            </div>
          )}

          {mvpAward && (
            <div style={styles.card}>
              <div style={styles.awardHeader}>
                <span style={styles.awardIcon}>MVP</span>
                <h2 style={styles.awardTitle}>{AWARD_TYPE_LABELS.mvp}</h2>
              </div>
              <div style={styles.mvpDisplay}>
                <span style={styles.mvpName}>
                  {mvpAward.playerId ? getPlayerName(mvpAward.playerId) : '-'}
                </span>
                <span style={styles.mvpTeam}>
                  {mvpAward.teamId ? getTeamName(mvpAward.teamId) : ''}
                </span>
                {mvpAward.value != null && (
                  <span style={styles.mvpScore}>점수: {mvpAward.value}</span>
                )}
              </div>
            </div>
          )}

          {rookieAward && (
            <div style={styles.card}>
              <div style={styles.awardHeader}>
                <span style={styles.awardIconRookie}>ROY</span>
                <h2 style={styles.awardTitle}>{AWARD_TYPE_LABELS.rookie_of_year}</h2>
              </div>
              <div style={styles.mvpDisplay}>
                <span style={styles.mvpName}>
                  {rookieAward.playerId ? getPlayerName(rookieAward.playerId) : '-'}
                </span>
                <span style={styles.mvpTeam}>
                  {rookieAward.teamId ? getTeamName(rookieAward.teamId) : ''}
                </span>
              </div>
            </div>
          )}

          {monthlyMvps.length > 0 && (
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>{AWARD_TYPE_LABELS.monthly_mvp}</h2>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>구간</th>
                    <th style={styles.th}>선수</th>
                    <th style={styles.th}>팀</th>
                    <th style={styles.th}>KDA</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyMvps.map((award, idx) => (
                    <tr key={award.id} style={styles.tr}>
                      <td style={styles.td}>W{idx * 4 + 1}~W{(idx + 1) * 4}</td>
                      <td style={{ ...styles.td, ...styles.nameCell }}>
                        {award.playerId ? getPlayerName(award.playerId) : '-'}
                      </td>
                      <td style={styles.td}>
                        {award.teamId ? getTeamName(award.teamId) : ''}
                      </td>
                      <td style={{ ...styles.td, color: '#c89b3c', fontWeight: 600 }}>
                        {award.value?.toFixed(2) ?? '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* All-Pro Team 탭 */}
      {activeTab === 'allpro' && (
        <div>
          {allPro1st.length === 0 && allPro2nd.length === 0 ? (
            <div style={styles.card}>
              <p style={styles.emptyText}>
                All-Pro Team은 시즌 종료 후 산출됩니다.
              </p>
            </div>
          ) : (
            <>
              {/* 1st Team */}
              <div style={styles.card}>
                <h2 style={styles.sectionTitle}>All-Pro 1st Team</h2>
                <div style={styles.allProGrid}>
                  {(['top', 'jungle', 'mid', 'adc', 'support'] as Position[]).map((pos) => {
                    const award = allPro1st.find((a) => {
                      if (!a.playerId) return false;
                      for (const team of teams) {
                        const player = team.roster?.find((p) => p.id === a.playerId);
                        if (player && player.position === pos) return true;
                      }
                      return false;
                    });
                    return (
                      <div key={pos} style={styles.allProCard}>
                        <span style={styles.posLabel}>{POSITION_LABELS[pos]}</span>
                        <span style={styles.allProName}>
                          {award?.playerId ? getPlayerName(award.playerId) : '-'}
                        </span>
                        <span style={styles.allProTeam}>
                          {award?.teamId ? getTeamName(award.teamId) : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2nd Team */}
              <div style={styles.card}>
                <h2 style={styles.sectionTitle}>All-Pro 2nd Team</h2>
                <div style={styles.allProGrid}>
                  {(['top', 'jungle', 'mid', 'adc', 'support'] as Position[]).map((pos) => {
                    const award = allPro2nd.find((a) => {
                      if (!a.playerId) return false;
                      for (const team of teams) {
                        const player = team.roster?.find((p) => p.id === a.playerId);
                        if (player && player.position === pos) return true;
                      }
                      return false;
                    });
                    return (
                      <div key={pos} style={{ ...styles.allProCard, borderColor: '#3a3a5c' }}>
                        <span style={styles.posLabel}>{POSITION_LABELS[pos]}</span>
                        <span style={styles.allProName}>
                          {award?.playerId ? getPlayerName(award.playerId) : '-'}
                        </span>
                        <span style={styles.allProTeam}>
                          {award?.teamId ? getTeamName(award.teamId) : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* MVP 레이스 탭 */}
      {activeTab === 'candidates' && (
        <div>
          {candidates.length === 0 ? (
            <div style={styles.card}>
              <p style={styles.emptyText}>
                경기 데이터가 부족합니다. 시즌이 진행되면 순위가 표시됩니다.
              </p>
            </div>
          ) : (
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>MVP 후보 순위</h2>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>#</th>
                    <th style={styles.th}>선수</th>
                    <th style={styles.th}>팀</th>
                    <th style={styles.th}>포지션</th>
                    <th style={styles.th}>경기</th>
                    <th style={styles.th}>KDA</th>
                    <th style={styles.th}>MVP 점수</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.slice(0, 20).map((c, idx) => (
                    <tr key={c.playerId} style={styles.tr}>
                      <td style={{
                        ...styles.td,
                        color: idx < 3 ? '#c89b3c' : '#c0c0d0',
                        fontWeight: idx < 3 ? 700 : 400,
                      }}>
                        {idx + 1}
                      </td>
                      <td style={{ ...styles.td, ...styles.nameCell }}>
                        {c.playerName}
                      </td>
                      <td style={styles.td}>{getTeamName(c.teamId)}</td>
                      <td style={styles.td}>{POSITION_LABELS[c.position as Position] ?? c.position}</td>
                      <td style={styles.td}>{c.games}</td>
                      <td style={{ ...styles.td, color: '#c89b3c', fontWeight: 600 }}>
                        {c.kda.toFixed(2)}
                      </td>
                      <td style={{ ...styles.td, fontWeight: 700, color: '#f0e6d2' }}>
                        {c.score.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
  awardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  awardIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #c89b3c, #e0c068)',
    color: '#0d0d1a',
    fontWeight: 800,
    fontSize: '14px',
  },
  awardIconRookie: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2ecc71, #27ae60)',
    color: '#0d0d1a',
    fontWeight: 800,
    fontSize: '14px',
  },
  awardTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#f0e6d2',
  },
  mvpDisplay: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
    paddingLeft: '60px',
  },
  mvpName: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#f0e6d2',
  },
  mvpTeam: {
    fontSize: '14px',
    color: '#8a8a9a',
  },
  mvpScore: {
    fontSize: '13px',
    color: '#6a6a7a',
    marginLeft: 'auto',
  },
  allProGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '12px',
  },
  allProCard: {
    background: 'rgba(200,155,60,0.06)',
    border: '1px solid rgba(200,155,60,0.2)',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  posLabel: {
    fontSize: '11px',
    color: '#6a6a7a',
    textTransform: 'uppercase',
    fontWeight: 600,
    letterSpacing: '0.5px',
  },
  allProName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f0e6d2',
    textAlign: 'center',
  },
  allProTeam: {
    fontSize: '12px',
    color: '#8a8a9a',
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
  nameCell: {
    fontWeight: 500,
    color: '#e0e0e0',
  },
};
