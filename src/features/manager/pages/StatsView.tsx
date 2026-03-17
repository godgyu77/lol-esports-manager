import { useEffect, useState } from 'react';
import { getMatchesByTeam, getStandings, getGamesByTeamSeason } from '../../../db/queries';
import type { GameRow } from '../../../db/queries';
import { useGameStore } from '../../../stores/gameStore';
import type { Match } from '../../../types/match';

interface Standing {
  teamId: string;
  wins: number;
  losses: number;
  setWins: number;
  setLosses: number;
}

interface WeeklyRecord {
  week: number;
  wins: number;
  losses: number;
}

export function StatsView() {
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);
  const save = useGameStore((s) => s.save);

  const [standings, setStandings] = useState<Standing[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userTeamId = save?.userTeamId;

  useEffect(() => {
    if (!season || !userTeamId) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const [standingsData, matchesData, gamesData] = await Promise.all([
        getStandings(season.id),
        getMatchesByTeam(season.id, userTeamId),
        getGamesByTeamSeason(season.id, userTeamId),
      ]);
      if (!cancelled) {
        setStandings(standingsData);
        setMatches(matchesData);
        setGames(gamesData);
        setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [season, userTeamId]);

  if (!season || !userTeamId) {
    return <p style={{ color: '#6a6a7a' }}>시즌 데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p style={{ color: '#6a6a7a' }}>통계를 불러오는 중...</p>;
  }

  const getTeamName = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    return team?.name ?? teamId;
  };

  const userTeamName = getTeamName(userTeamId);

  // 팀 전적 요약
  const userStanding = standings.find((s) => s.teamId === userTeamId);
  const totalMatches = (userStanding?.wins ?? 0) + (userStanding?.losses ?? 0);
  const winRate = totalMatches > 0
    ? ((userStanding?.wins ?? 0) / totalMatches * 100).toFixed(1)
    : '0.0';

  // 최근 10경기
  const playedMatches = matches
    .filter((m) => m.isPlayed)
    .sort((a, b) => b.week - a.week)
    .slice(0, 10);

  const getMatchTypeLabel = (matchType: string) => {
    switch (matchType) {
      case 'regular': return '정규';
      case 'playoff_quarters': return '플레이오프 8강';
      case 'playoff_semis': return '플레이오프 4강';
      case 'playoff_finals': return '플레이오프 결승';
      case 'msi_group':
      case 'msi_semis':
      case 'msi_final': return 'MSI';
      case 'worlds_swiss':
      case 'worlds_quarter':
      case 'worlds_semi':
      case 'worlds_final': return 'Worlds';
      case 'lck_cup_regular':
      case 'lck_cup_playoff_quarters':
      case 'lck_cup_playoff_semis':
      case 'lck_cup_playoff_finals': return 'LCK Cup';
      case 'fst_quarter':
      case 'fst_semi':
      case 'fst_final': return 'First Stand';
      case 'ewc_quarter':
      case 'ewc_semi':
      case 'ewc_final': return 'EWC';
      default: return matchType;
    }
  };

  const getMatchResult = (match: Match): 'win' | 'loss' => {
    const isHome = match.teamHomeId === userTeamId;
    const userScore = isHome ? match.scoreHome : match.scoreAway;
    const opponentScore = isHome ? match.scoreAway : match.scoreHome;
    return userScore > opponentScore ? 'win' : 'loss';
  };

  const getOpponentId = (match: Match): string => {
    return match.teamHomeId === userTeamId ? match.teamAwayId : match.teamHomeId;
  };

  // 게임 통계 집계
  const totalGames = games.length;
  const totalKills = games.reduce((sum, g) => {
    const m = matches.find((match) => match.id === g.match_id);
    if (!m) return sum;
    const isHome = m.teamHomeId === userTeamId;
    return sum + (isHome ? g.total_kills_home : g.total_kills_away);
  }, 0);
  const totalGoldDiffAt15 = games.reduce((sum, g) => {
    const m = matches.find((match) => match.id === g.match_id);
    if (!m) return sum;
    const isHome = m.teamHomeId === userTeamId;
    return sum + (isHome ? g.gold_diff_at_15 : -g.gold_diff_at_15);
  }, 0);
  const avgKillsPerGame = totalGames > 0 ? (totalKills / totalGames).toFixed(1) : '0.0';
  const avgGoldDiffAt15 = totalGames > 0 ? Math.round(totalGoldDiffAt15 / totalGames) : 0;

  // 주차별 승률 변화
  const weeklyRecords: WeeklyRecord[] = [];
  const playedByWeek = matches.filter((m) => m.isPlayed && m.matchType === 'regular');
  const weekSet = [...new Set(playedByWeek.map((m) => m.week))].sort((a, b) => a - b);

  for (const week of weekSet) {
    const weekMatches = playedByWeek.filter((m) => m.week === week);
    let wins = 0;
    let losses = 0;
    for (const m of weekMatches) {
      if (getMatchResult(m) === 'win') wins++;
      else losses++;
    }
    weeklyRecords.push({ week, wins, losses });
  }

  // 누적 승률 계산
  const cumulativeWinRates: { week: number; rate: number }[] = [];
  let cumWins = 0;
  let cumLosses = 0;
  for (const wr of weeklyRecords) {
    cumWins += wr.wins;
    cumLosses += wr.losses;
    const total = cumWins + cumLosses;
    cumulativeWinRates.push({
      week: wr.week,
      rate: total > 0 ? Math.round((cumWins / total) * 100) : 0,
    });
  }

  return (
    <div>
      <h1 style={styles.title}>경기 통계</h1>

      {/* 팀 전적 요약 */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>{userTeamName} 시즌 전적</h2>
        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>매치 승</span>
            <span style={styles.summaryValue}>{userStanding?.wins ?? 0}</span>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>매치 패</span>
            <span style={styles.summaryValue}>{userStanding?.losses ?? 0}</span>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>세트 승</span>
            <span style={styles.summaryValue}>{userStanding?.setWins ?? 0}</span>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>세트 패</span>
            <span style={styles.summaryValue}>{userStanding?.setLosses ?? 0}</span>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>승률</span>
            <span style={{ ...styles.summaryValue, color: '#c89b3c' }}>{winRate}%</span>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>평균 킬/게임</span>
            <span style={styles.summaryValue}>{avgKillsPerGame}</span>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>평균 15분 골드차</span>
            <span style={{
              ...styles.summaryValue,
              color: avgGoldDiffAt15 > 0 ? '#90ee90' : avgGoldDiffAt15 < 0 ? '#ff6b6b' : '#c0c0d0',
            }}>
              {avgGoldDiffAt15 > 0 ? `+${avgGoldDiffAt15}` : avgGoldDiffAt15}
            </span>
          </div>
        </div>
      </section>

      {/* 주차별 승률 변화 차트 */}
      {cumulativeWinRates.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>주차별 누적 승률</h2>
          <div style={styles.chartContainer}>
            {cumulativeWinRates.map((entry) => (
              <div key={entry.week} style={styles.chartRow}>
                <span style={styles.chartLabel}>W{entry.week}</span>
                <div style={styles.chartBarBg}>
                  <div
                    style={{
                      ...styles.chartBar,
                      width: `${entry.rate}%`,
                    }}
                  />
                </div>
                <span style={styles.chartValue}>{entry.rate}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 최근 10경기 기록 */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>최근 경기 기록</h2>
        {playedMatches.length === 0 ? (
          <p style={{ color: '#6a6a7a' }}>진행된 경기가 없습니다.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>주차</th>
                <th style={styles.th}>상대팀</th>
                <th style={styles.th}>결과</th>
                <th style={styles.th}>스코어</th>
                <th style={styles.th}>유형</th>
              </tr>
            </thead>
            <tbody>
              {playedMatches.map((match) => {
                const result = getMatchResult(match);
                const opponentName = getTeamName(getOpponentId(match));
                const isHome = match.teamHomeId === userTeamId;
                const score = isHome
                  ? `${match.scoreHome} - ${match.scoreAway}`
                  : `${match.scoreAway} - ${match.scoreHome}`;

                return (
                  <tr key={match.id} style={styles.tr}>
                    <td style={styles.td}>W{match.week}</td>
                    <td style={{ ...styles.td, ...styles.nameCell }}>{opponentName}</td>
                    <td style={{
                      ...styles.td,
                      color: result === 'win' ? '#90ee90' : '#ff6b6b',
                      fontWeight: 600,
                    }}>
                      {result === 'win' ? '승' : '패'}
                    </td>
                    <td style={styles.td}>{score}</td>
                    <td style={styles.td}>{getMatchTypeLabel(match.matchType)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
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
  section: {
    marginBottom: '32px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#c89b3c',
    marginBottom: '16px',
    borderBottom: '1px solid #3a3a5c',
    paddingBottom: '8px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '12px',
  },
  summaryCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  summaryLabel: {
    fontSize: '12px',
    color: '#6a6a7a',
  },
  summaryValue: {
    fontSize: '20px',
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
  nameCell: {
    fontWeight: 500,
    color: '#e0e0e0',
  },
  chartContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  chartRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  chartLabel: {
    width: '36px',
    fontSize: '12px',
    color: '#6a6a7a',
    textAlign: 'right',
    flexShrink: 0,
  },
  chartBarBg: {
    flex: 1,
    height: '16px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  chartBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #c89b3c, #e0c068)',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  chartValue: {
    width: '40px',
    fontSize: '12px',
    color: '#c0c0d0',
    textAlign: 'right',
    flexShrink: 0,
  },
};
