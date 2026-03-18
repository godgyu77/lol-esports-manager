import { useEffect, useState } from 'react';
import { getMatchesByTeam, getStandings, getGamesByTeamSeason, getSeasonPlayerRankings } from '../../../db/queries';
import type { GameRow } from '../../../db/queries';
import { useGameStore } from '../../../stores/gameStore';
import type { Match } from '../../../types/match';
import type { Position } from '../../../types/game';
import type { Player } from '../../../types/player';
import { Skeleton, SkeletonTable, SkeletonCards } from '../../../components/Skeleton';

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

interface PlayerRanking {
  playerId: string;
  playerName: string;
  teamId: string;
  position: string;
  games: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalCs: number;
  totalDamage: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  avgCs: number;
  avgDamage: number;
}

type RankingCategory = 'kills' | 'kda' | 'cs' | 'damage';

const POSITION_ORDER: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
const POSITION_LABELS: Record<Position, string> = {
  top: 'TOP',
  jungle: 'JGL',
  mid: 'MID',
  adc: 'ADC',
  support: 'SPT',
};

function getOverall(player: Player): number {
  const s = player.stats;
  return Math.round((s.mechanical + s.gameSense + s.teamwork + s.consistency + s.laning + s.aggression) / 6);
}

function getBarColor(value: number): string {
  if (value >= 80) return 'linear-gradient(90deg, #c89b3c, #e0c068)';
  if (value >= 60) return 'linear-gradient(90deg, #3498db, #5dade2)';
  if (value >= 40) return 'linear-gradient(90deg, #2ecc71, #58d68d)';
  return 'linear-gradient(90deg, #e74c3c, #ec7063)';
}

export function StatsView() {
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);
  const save = useGameStore((s) => s.save);

  const [standings, setStandings] = useState<Standing[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);
  const [playerRankings, setPlayerRankings] = useState<PlayerRanking[]>([]);
  const [rankingCategory, setRankingCategory] = useState<RankingCategory>('kills');
  const [isLoading, setIsLoading] = useState(true);

  const userTeamId = save?.userTeamId;

  useEffect(() => {
    if (!season || !userTeamId) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const [standingsData, matchesData, gamesData, rankingsData] = await Promise.all([
        getStandings(season.id),
        getMatchesByTeam(season.id, userTeamId),
        getGamesByTeamSeason(season.id, userTeamId),
        getSeasonPlayerRankings(season.id),
      ]);
      if (!cancelled) {
        setStandings(standingsData);
        setMatches(matchesData);
        setGames(gamesData);
        setPlayerRankings(rankingsData);
        setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [season, userTeamId]);

  if (!season || !userTeamId) {
    return <p style={{ color: 'var(--text-muted)' }}>시즌 데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return (
      <div>
        <Skeleton width="180px" height="28px" variant="text" />
        <div style={{ marginTop: '24px' }}>
          <SkeletonCards count={4} />
        </div>
        <div style={{ marginTop: '24px' }}>
          <SkeletonTable rows={6} cols={5} />
        </div>
      </div>
    );
  }

  const getTeamName = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    return team?.name ?? teamId;
  };

  const userTeamName = getTeamName(userTeamId);
  const userTeam = teams.find((t) => t.id === userTeamId);
  const userRoster = userTeam?.roster ?? [];

  // 팀 전적 요약
  const userStanding = standings.find((s) => s.teamId === userTeamId);
  const totalMatches = (userStanding?.wins ?? 0) + (userStanding?.losses ?? 0);
  const winRateNum = totalMatches > 0
    ? (userStanding?.wins ?? 0) / totalMatches * 100
    : 0;
  const winRate = winRateNum.toFixed(1);

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
  const totalDeaths = games.reduce((sum, g) => {
    const m = matches.find((match) => match.id === g.match_id);
    if (!m) return sum;
    const isHome = m.teamHomeId === userTeamId;
    return sum + (isHome ? g.total_kills_away : g.total_kills_home);
  }, 0);
  const totalGoldDiffAt15 = games.reduce((sum, g) => {
    const m = matches.find((match) => match.id === g.match_id);
    if (!m) return sum;
    const isHome = m.teamHomeId === userTeamId;
    return sum + (isHome ? g.gold_diff_at_15 : -g.gold_diff_at_15);
  }, 0);
  const avgKillsPerGame = totalGames > 0 ? (totalKills / totalGames).toFixed(1) : '0.0';
  const avgGoldDiffAt15 = totalGames > 0 ? Math.round(totalGoldDiffAt15 / totalGames) : 0;

  // 평균 KDA 계산
  const avgKda = totalDeaths > 0
    ? ((totalKills + totalDeaths * 0) / totalDeaths).toFixed(2) // kills/deaths만
    : totalKills > 0 ? 'Perfect' : '0.00';
  // 팀 KDA = (kills) / deaths (어시스트 정보가 게임 레벨에서 없으므로 K/D)
  const teamKdRatio = totalDeaths > 0
    ? (totalKills / totalDeaths).toFixed(2)
    : totalKills > 0 ? 'Perfect' : '0.00';

  // 평균 게임 시간
  const totalDuration = games.reduce((sum, g) => sum + (g.duration_seconds ?? 0), 0);
  const avgGameDuration = totalGames > 0 ? Math.round(totalDuration / totalGames) : 0;
  const avgGameMinutes = Math.floor(avgGameDuration / 60);
  const avgGameSeconds = avgGameDuration % 60;

  // 연승/연패 계산
  const sortedPlayedMatches = matches
    .filter((m) => m.isPlayed)
    .sort((a, b) => a.week - b.week);

  let currentStreak = 0;
  let streakType: 'win' | 'loss' | null = null;
  for (let i = sortedPlayedMatches.length - 1; i >= 0; i--) {
    const result = getMatchResult(sortedPlayedMatches[i]);
    if (streakType === null) {
      streakType = result;
      currentStreak = 1;
    } else if (result === streakType) {
      currentStreak++;
    } else {
      break;
    }
  }

  // 최근 10경기 킬 데이터 (바 차트용)
  const recentGamesForChart = playedMatches
    .slice()
    .reverse() // 오래된 순서로
    .map((match) => {
      const result = getMatchResult(match);
      const matchGames = games.filter((g) => g.match_id === match.id);
      const killsInMatch = matchGames.reduce((sum, g) => {
        const isHome = match.teamHomeId === userTeamId;
        return sum + (isHome ? g.total_kills_home : g.total_kills_away);
      }, 0);
      return {
        isWin: result === 'win',
        kills: killsInMatch,
        opponent: getTeamName(getOpponentId(match)),
      };
    });

  // 포지션별 평균 OVR
  const positionOvrMap: Record<Position, number[]> = {
    top: [], jungle: [], mid: [], adc: [], support: [],
  };
  for (const player of userRoster) {
    positionOvrMap[player.position].push(getOverall(player));
  }
  const positionAvgOvr = POSITION_ORDER.map((pos) => {
    const ovrs = positionOvrMap[pos];
    const avg = ovrs.length > 0 ? Math.round(ovrs.reduce((a, b) => a + b, 0) / ovrs.length) : 0;
    return { position: pos, avgOvr: avg };
  });

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

      {/* ─── 팀 통계 요약 카드 ─── */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>{userTeamName} 핵심 지표</h2>
        <div style={vizStyles.summaryCardsRow}>
          {/* 승률 원형 */}
          <div style={vizStyles.summaryStatCard}>
            <span style={vizStyles.summaryStatLabel}>승률</span>
            <div style={{
              ...vizStyles.circleOuter,
              background: `conic-gradient(#c89b3c ${winRateNum * 3.6}deg, #2a2a4a ${winRateNum * 3.6}deg)`,
            }}>
              <div style={vizStyles.circleInner}>
                <span style={vizStyles.circleValue}>{winRate}%</span>
              </div>
            </div>
            <span style={vizStyles.summaryStatSub}>{userStanding?.wins ?? 0}승 {userStanding?.losses ?? 0}패</span>
          </div>

          {/* 평균 게임 시간 */}
          <div style={vizStyles.summaryStatCard}>
            <span style={vizStyles.summaryStatLabel}>평균 게임 시간</span>
            <span style={vizStyles.summaryStatBig}>
              {avgGameMinutes}:{String(avgGameSeconds).padStart(2, '0')}
            </span>
            <span style={vizStyles.summaryStatSub}>{totalGames}경기 기준</span>
          </div>

          {/* 평균 K/D */}
          <div style={vizStyles.summaryStatCard}>
            <span style={vizStyles.summaryStatLabel}>팀 K/D</span>
            <span style={vizStyles.summaryStatBig}>{teamKdRatio}</span>
            <span style={vizStyles.summaryStatSub}>{totalKills}킬 / {totalDeaths}데스</span>
          </div>

          {/* 연승/연패 */}
          <div style={vizStyles.summaryStatCard}>
            <span style={vizStyles.summaryStatLabel}>
              {streakType === 'win' ? '연승' : streakType === 'loss' ? '연패' : '기록 없음'}
            </span>
            <span style={{
              ...vizStyles.summaryStatBig,
              color: streakType === 'win' ? 'var(--success)' : streakType === 'loss' ? 'var(--danger)' : 'var(--text-secondary)',
            }}>
              {currentStreak > 0 ? `${currentStreak}${streakType === 'win' ? '연승' : '연패'}` : '-'}
            </span>
            <span style={vizStyles.summaryStatSub}>현재 스트릭</span>
          </div>
        </div>
      </section>

      {/* ─── 최근 10경기 승/패 바 차트 ─── */}
      {recentGamesForChart.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>최근 경기 승패 (킬 수 기준)</h2>
          <div style={vizStyles.recentBarContainer}>
            {recentGamesForChart.map((game, i) => (
              <div key={i} style={vizStyles.recentBarCol}>
                <span style={vizStyles.recentBarWL}>
                  {game.isWin ? 'W' : 'L'}
                </span>
                <div style={{
                  width: '28px',
                  height: `${Math.max(Math.min(game.kills * 4, 80), 6)}px`,
                  background: game.isWin ? '#2ecc71' : '#e74c3c',
                  borderRadius: '3px 3px 0 0',
                  transition: 'height 0.3s ease',
                }} />
                <span style={vizStyles.recentBarKills}>{game.kills}</span>
              </div>
            ))}
          </div>
          <div style={vizStyles.recentBarLegend}>
            <span style={{ color: 'var(--success)', fontSize: '11px' }}>■ 승리</span>
            <span style={{ color: 'var(--danger)', fontSize: '11px' }}>■ 패배</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>숫자 = 총 킬</span>
          </div>
        </section>
      )}

      {/* ─── 포지션별 평균 OVR ─── */}
      {userRoster.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>포지션별 평균 OVR</h2>
          <div style={{ maxWidth: '500px' }}>
            {positionAvgOvr.map(({ position, avgOvr }) => (
              <div key={position} style={vizStyles.posBarRow}>
                <span style={vizStyles.posBarLabel}>{POSITION_LABELS[position]}</span>
                <div style={vizStyles.posBarBg}>
                  <div style={{
                    width: `${avgOvr}%`,
                    height: '100%',
                    background: getBarColor(avgOvr),
                    borderRadius: '8px',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <span style={vizStyles.posBarValue}>{avgOvr}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── 선수 성장 추적 ─── */}
      {userRoster.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>선수 OVR 현황</h2>
          <div style={{ maxWidth: '600px' }}>
            {POSITION_ORDER.map((pos) => {
              const posPlayers = userRoster.filter((p) => p.position === pos);
              return posPlayers.map((player) => {
                const currentOvr = getOverall(player);
                // potential을 시즌 초 기준 참고치로 표시 (잠재력 대비 현재)
                const potentialOvr = player.potential;
                const diff = currentOvr - potentialOvr;

                return (
                  <div key={player.id} style={vizStyles.growthRow}>
                    <div style={vizStyles.growthNameCol}>
                      <span style={vizStyles.growthPos}>{POSITION_LABELS[player.position]}</span>
                      <span style={vizStyles.growthName}>{player.name}</span>
                    </div>
                    <div style={vizStyles.growthBarCol}>
                      {/* 잠재력 바 (회색 배경) */}
                      <div style={vizStyles.growthBarBg}>
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          width: `${potentialOvr}%`,
                          height: '100%',
                          background: 'rgba(138, 138, 154, 0.3)',
                          borderRadius: '6px',
                        }} />
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          width: `${currentOvr}%`,
                          height: '100%',
                          background: diff >= 0
                            ? 'linear-gradient(90deg, #c89b3c, #e0c068)'
                            : 'linear-gradient(90deg, #e74c3c, #ec7063)',
                          borderRadius: '6px',
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    </div>
                    <span style={vizStyles.growthOvr}>{currentOvr}</span>
                    <span style={{
                      ...vizStyles.growthArrow,
                      color: diff > 0 ? '#2ecc71' : diff < 0 ? '#e74c3c' : '#8a8a9a',
                    }}>
                      {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '='}
                      {diff > 0 ? ' ↑' : diff < 0 ? ' ↓' : ''}
                    </span>
                  </div>
                );
              });
            })}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            회색 바 = 잠재력, 컬러 바 = 현재 OVR, 화살표 = 잠재력 대비 차이
          </p>
        </section>
      )}

      {/* ─── 기존: 팀 전적 요약 ─── */}
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
            <span style={{ ...styles.summaryValue, color: 'var(--accent)' }}>{winRate}%</span>
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
          <p style={{ color: 'var(--text-muted)' }}>진행된 경기가 없습니다.</p>
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

      {/* 개인 순위 */}
      {playerRankings.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>개인 순위</h2>
          <div style={statsViewStyles.categoryRow}>
            {([
              ['kills', '킬왕'],
              ['kda', 'KDA왕'],
              ['cs', 'CS왕'],
              ['damage', '데미지왕'],
            ] as [RankingCategory, string][]).map(([cat, label]) => (
              <button
                key={cat}
                style={{
                  ...statsViewStyles.categoryBtn,
                  ...(rankingCategory === cat ? statsViewStyles.categoryBtnActive : {}),
                }}
                onClick={() => setRankingCategory(cat)}
              >
                {label}
              </button>
            ))}
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>#</th>
                <th style={styles.th}>선수</th>
                <th style={styles.th}>팀</th>
                <th style={styles.th}>경기</th>
                <th style={styles.th}>
                  {rankingCategory === 'kills' ? '총 킬'
                    : rankingCategory === 'kda' ? 'KDA'
                    : rankingCategory === 'cs' ? '평균 CS'
                    : '평균 데미지'}
                </th>
              </tr>
            </thead>
            <tbody>
              {getSortedRankings(playerRankings, rankingCategory).slice(0, 10).map((pr, idx) => (
                <tr key={pr.playerId} style={styles.tr}>
                  <td style={{
                    ...styles.td,
                    color: idx < 3 ? 'var(--accent)' : '#c0c0d0',
                    fontWeight: idx < 3 ? 700 : 400,
                  }}>
                    {idx + 1}
                  </td>
                  <td style={{ ...styles.td, ...styles.nameCell }}>{pr.playerName}</td>
                  <td style={styles.td}>{getTeamName(pr.teamId)}</td>
                  <td style={styles.td}>{pr.games}</td>
                  <td style={{ ...styles.td, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {getRankingValue(pr, rankingCategory)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function getSortedRankings(rankings: PlayerRanking[], category: RankingCategory): PlayerRanking[] {
  return [...rankings].sort((a, b) => {
    switch (category) {
      case 'kills': return b.totalKills - a.totalKills;
      case 'kda': {
        const kdaA = a.totalDeaths === 0 ? a.totalKills + a.totalAssists : (a.totalKills + a.totalAssists) / a.totalDeaths;
        const kdaB = b.totalDeaths === 0 ? b.totalKills + b.totalAssists : (b.totalKills + b.totalAssists) / b.totalDeaths;
        return kdaB - kdaA;
      }
      case 'cs': return b.avgCs - a.avgCs;
      case 'damage': return b.avgDamage - a.avgDamage;
    }
  });
}

function getRankingValue(pr: PlayerRanking, category: RankingCategory): string {
  switch (category) {
    case 'kills': return String(pr.totalKills);
    case 'kda': {
      const kda = pr.totalDeaths === 0
        ? (pr.totalKills + pr.totalAssists).toFixed(1)
        : ((pr.totalKills + pr.totalAssists) / pr.totalDeaths).toFixed(2);
      return kda;
    }
    case 'cs': return String(pr.avgCs);
    case 'damage': return pr.avgDamage.toLocaleString();
  }
}

// ─── 기존 스타일 ───

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '24px',
  },
  section: {
    marginBottom: '32px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--accent)',
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
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  summaryLabel: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  summaryValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--text-primary)',
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
    color: 'var(--text-muted)',
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
    color: 'var(--text-primary)',
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
    color: 'var(--text-muted)',
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

const statsViewStyles: Record<string, React.CSSProperties> = {
  categoryRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  categoryBtn: {
    padding: '6px 16px',
    fontSize: '13px',
    fontWeight: 500,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #3a3a5c',
    borderRadius: '6px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  categoryBtnActive: {
    background: 'rgba(200,155,60,0.15)',
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
    fontWeight: 700,
  },
};

// ─── 시각화 추가 스타일 ───

const vizStyles: Record<string, React.CSSProperties> = {
  // 팀 통계 요약 카드
  summaryCardsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '16px',
  },
  summaryStatCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  summaryStatLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  summaryStatBig: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  summaryStatSub: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },

  // 원형 퍼센트 바
  circleOuter: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleInner: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'var(--bg-card)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleValue: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--accent)',
  },

  // 최근 경기 바 차트
  recentBarContainer: {
    display: 'flex',
    gap: '6px',
    alignItems: 'flex-end',
    height: '110px',
    padding: '20px 0 0 0',
  },
  recentBarCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    justifyContent: 'flex-end',
    height: '100%',
  },
  recentBarWL: {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--text-secondary)',
  },
  recentBarKills: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  recentBarLegend: {
    display: 'flex',
    gap: '16px',
    marginTop: '8px',
  },

  // 포지션별 바 차트
  posBarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  },
  posBarLabel: {
    width: '40px',
    fontSize: '12px',
    color: 'var(--accent)',
    fontWeight: 600,
  },
  posBarBg: {
    flex: 1,
    height: '16px',
    background: 'var(--bg-card)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  posBarValue: {
    width: '30px',
    fontSize: '12px',
    color: 'var(--text-primary)',
    textAlign: 'right',
    fontWeight: 600,
  },

  // 선수 성장 추적
  growthRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  growthNameCol: {
    width: '120px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  growthPos: {
    fontSize: '11px',
    color: 'var(--accent)',
    fontWeight: 600,
    width: '30px',
  },
  growthName: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    fontWeight: 500,
  },
  growthBarCol: {
    flex: 1,
  },
  growthBarBg: {
    position: 'relative',
    height: '14px',
    background: 'var(--bg-card)',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  growthOvr: {
    width: '30px',
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    textAlign: 'right',
    flexShrink: 0,
  },
  growthArrow: {
    width: '40px',
    fontSize: '12px',
    fontWeight: 600,
    textAlign: 'right',
    flexShrink: 0,
  },
};
