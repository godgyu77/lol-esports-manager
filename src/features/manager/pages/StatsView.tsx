import { useEffect, useState, useMemo } from 'react';
import { getMatchesByTeam, getStandings, getGamesByTeamSeason, getSeasonPlayerRankings } from '../../../db/queries';
import type { GameRow } from '../../../db/queries';
import { useGameStore } from '../../../stores/gameStore';
import type { Match } from '../../../types/match';
import type { Position } from '../../../types/game';
import type { Player } from '../../../types/player';
import { Skeleton, SkeletonTable, SkeletonCards } from '../../../components/Skeleton';
import {
  getDetailedPlayerStats,
  getTeamDetailedStats,
  getPlayerRanking,
  type DetailedPlayerStats,
  type TeamDetailedStats,
  type PlayerRankingEntry,
} from '../../../engine/stats/detailedStatsEngine';

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
type StatsTab = 'overview' | 'detailed' | 'playerRanking' | 'teamStats' | 'mvpBoard';
type PositionFilter = 'ALL' | 'top' | 'jungle' | 'mid' | 'adc' | 'support';
type RankingSortKey = 'kda' | 'kills' | 'deaths' | 'assists' | 'cs' | 'damage' | 'gold';

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

function getBarFillClass(value: number): string {
  if (value >= 80) return 'fm-bar__fill--accent';
  if (value >= 60) return 'fm-bar__fill--blue';
  if (value >= 40) return 'fm-bar__fill--green';
  return 'fm-bar__fill--red';
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
  const [activeTab, setActiveTab] = useState<StatsTab>('overview');
  const [detailedPlayerStats, setDetailedPlayerStats] = useState<Map<string, DetailedPlayerStats>>(new Map());
  const [teamDetailedStats, setTeamDetailedStats] = useState<TeamDetailedStats | null>(null);
  const [detailedRankings, setDetailedRankings] = useState<PlayerRankingEntry[]>([]);
  const [detailedRankingStat, setDetailedRankingStat] = useState<string>('kda');
  const [isDetailedLoading, setIsDetailedLoading] = useState(false);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL');
  const [rankingSortKey, setRankingSortKey] = useState<RankingSortKey>('kda');

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

  // 심화 통계 로드
  useEffect(() => {
    if (!season || !userTeamId || activeTab !== 'detailed') return;
    let cancelled = false;

    const loadDetailed = async () => {
      setIsDetailedLoading(true);
      try {
        const userTeam2 = teams.find((t) => t.id === userTeamId);
        const roster = userTeam2?.roster ?? [];

        // 선수별 심화 통계
        const statsMap = new Map<string, DetailedPlayerStats>();
        for (const player of roster) {
          const stats = await getDetailedPlayerStats(player.id, season.id);
          if (!cancelled) statsMap.set(player.id, stats);
        }

        // 팀 상세 통계
        const teamStats = await getTeamDetailedStats(userTeamId, season.id);

        // 리그 순위
        const rankings = await getPlayerRanking(season.id, detailedRankingStat as 'kda', 10);

        if (!cancelled) {
          setDetailedPlayerStats(statsMap);
          setTeamDetailedStats(teamStats);
          setDetailedRankings(rankings);
        }
      } catch (e) {
        console.warn('심화 통계 로딩 실패:', e);
      } finally {
        if (!cancelled) setIsDetailedLoading(false);
      }
    };

    loadDetailed();
    return () => { cancelled = true; };
  }, [season, userTeamId, activeTab, teams, detailedRankingStat]);

  // ─── 선수 랭킹 탭: 필터링 + 정렬 ───
  const filteredRankings = useMemo(() => {
    if (!playerRankings.length) return [];
    let list = [...playerRankings];
    if (positionFilter !== 'ALL') {
      list = list.filter((pr) => pr.position === positionFilter);
    }
    list.sort((a, b) => {
      switch (rankingSortKey) {
        case 'kda': {
          const kdaA = a.totalDeaths === 0 ? a.totalKills + a.totalAssists : (a.totalKills + a.totalAssists) / a.totalDeaths;
          const kdaB = b.totalDeaths === 0 ? b.totalKills + b.totalAssists : (b.totalKills + b.totalAssists) / b.totalDeaths;
          return kdaB - kdaA;
        }
        case 'kills': return b.avgKills - a.avgKills;
        case 'deaths': return a.avgDeaths - b.avgDeaths;
        case 'assists': return b.avgAssists - a.avgAssists;
        case 'cs': return b.avgCs - a.avgCs;
        case 'damage': return b.avgDamage - a.avgDamage;
        case 'gold': return b.avgDamage - a.avgDamage; // gold 데이터가 없으므로 damage 대용
      }
    });
    return list;
  }, [playerRankings, positionFilter, rankingSortKey]);

  // ─── MVP 보드: 최근 경기 KDA TOP 10 ───
  const mvpBoard = useMemo(() => {
    if (!playerRankings.length) return [];
    const ranked = [...playerRankings]
      .filter((pr) => pr.games >= 1)
      .map((pr) => {
        const kda = pr.totalDeaths === 0
          ? pr.totalKills + pr.totalAssists
          : (pr.totalKills + pr.totalAssists) / pr.totalDeaths;
        return { ...pr, kda };
      })
      .sort((a, b) => b.kda - a.kda)
      .slice(0, 10);
    return ranked;
  }, [playerRankings]);

  // ─── 팀 통계 탭: 전체 팀 순위 데이터 ───
  const teamStatsData = useMemo(() => {
    if (!standings.length) return [];
    return [...standings]
      .sort((a, b) => {
        const winRateA = (a.wins + a.losses) > 0 ? a.wins / (a.wins + a.losses) : 0;
        const winRateB = (b.wins + b.losses) > 0 ? b.wins / (b.wins + b.losses) : 0;
        return winRateB - winRateA;
      })
      .map((s, idx) => {
        const team = teams.find((t) => t.id === s.teamId);
        const total = s.wins + s.losses;
        const wr = total > 0 ? ((s.wins / total) * 100).toFixed(1) : '0.0';
        return {
          rank: idx + 1,
          teamId: s.teamId,
          teamName: team?.name ?? s.teamId,
          wins: s.wins,
          losses: s.losses,
          setWins: s.setWins,
          setLosses: s.setLosses,
          winRate: wr,
        };
      });
  }, [standings, teams]);

  if (!season || !userTeamId) {
    return <p className="fm-text-muted">시즌 데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return (
      <div>
        <Skeleton width="180px" height="28px" variant="text" />
        <div className="fm-mt-lg">
          <SkeletonCards count={4} />
        </div>
        <div className="fm-mt-lg">
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

  // filteredRankings, mvpBoard, teamStatsData는 early return 위에서 선언됨

  return (
    <div>
      <h1 className="fm-page-title fm-mb-lg">경기 통계</h1>

      {/* ─── 탭 ─── */}
      <div className="fm-tabs" style={{ flexWrap: 'wrap' }}>
        <button
          className={`fm-tab ${activeTab === 'overview' ? 'fm-tab--active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          기본 통계
        </button>
        <button
          className={`fm-tab ${activeTab === 'detailed' ? 'fm-tab--active' : ''}`}
          onClick={() => setActiveTab('detailed')}
        >
          심화 통계
        </button>
        <button
          className={`fm-tab ${activeTab === 'playerRanking' ? 'fm-tab--active' : ''}`}
          onClick={() => setActiveTab('playerRanking')}
        >
          선수 랭킹
        </button>
        <button
          className={`fm-tab ${activeTab === 'teamStats' ? 'fm-tab--active' : ''}`}
          onClick={() => setActiveTab('teamStats')}
        >
          팀 통계
        </button>
        <button
          className={`fm-tab ${activeTab === 'mvpBoard' ? 'fm-tab--active' : ''}`}
          onClick={() => setActiveTab('mvpBoard')}
        >
          MVP 보드
        </button>
      </div>

      {/* ─── 심화 통계 탭 ─── */}
      {activeTab === 'detailed' && (
        <div>
          {isDetailedLoading ? (
            <div>
              <SkeletonCards count={3} />
              <div className="fm-mt-md"><SkeletonTable rows={5} cols={4} /></div>
            </div>
          ) : (
            <>
              {/* 팀 상세 통계 */}
              {teamDetailedStats && teamDetailedStats.totalGames > 0 && (
                <div className="fm-panel fm-mb-lg">
                  <div className="fm-panel__header">
                    <span className="fm-panel__title">{userTeamName} 팀 심화 지표</span>
                  </div>
                  <div className="fm-panel__body">
                    <div className="fm-grid fm-grid--4">
                      <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
                        <span className="fm-stat__label">퍼스트 블러드율</span>
                        <span className="fm-stat__value">{teamDetailedStats.firstBloodRate}%</span>
                      </div>
                      <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
                        <span className="fm-stat__label">드래곤 컨트롤율</span>
                        <span className="fm-stat__value">{teamDetailedStats.dragonControlRate}%</span>
                      </div>
                      <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
                        <span className="fm-stat__label">바론 컨트롤율</span>
                        <span className="fm-stat__value">{teamDetailedStats.baronControlRate}%</span>
                      </div>
                      <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
                        <span className="fm-stat__label">역전률</span>
                        <span className="fm-stat__value">{teamDetailedStats.comebackRate}%</span>
                      </div>
                    </div>
                    <div className="fm-grid fm-grid--4 fm-mt-md">
                      <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
                        <span className="fm-stat__label">초반 레이팅</span>
                        <DetailedStatBar value={teamDetailedStats.earlyGameRating} />
                      </div>
                      <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
                        <span className="fm-stat__label">중반 레이팅</span>
                        <DetailedStatBar value={teamDetailedStats.midGameRating} />
                      </div>
                      <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
                        <span className="fm-stat__label">후반 레이팅</span>
                        <DetailedStatBar value={teamDetailedStats.lateGameRating} />
                      </div>
                      <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
                        <span className="fm-stat__label">사이드 승률</span>
                        <span className="fm-text-sm fm-text-secondary">
                          블루 {teamDetailedStats.blueWinRate}% / 레드 {teamDetailedStats.redWinRate}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 선수별 심화 통계 */}
              {detailedPlayerStats.size > 0 && (
                <div className="fm-panel fm-mb-lg">
                  <div className="fm-panel__header">
                    <span className="fm-panel__title">선수별 심화 통계</span>
                  </div>
                  <div className="fm-panel__body--flush fm-table-wrap">
                    <table className="fm-table fm-table--striped">
                      <thead>
                        <tr>
                          <th>선수</th>
                          <th>KDA</th>
                          <th>CS/분</th>
                          <th>15분 골드차</th>
                          <th>퍼블율</th>
                          <th>라인전 승률</th>
                          <th>킬 관여</th>
                          <th>일관성</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userRoster.map((player) => {
                          const ps = detailedPlayerStats.get(player.id);
                          if (!ps || ps.totalGames === 0) return null;
                          return (
                            <tr key={player.id}>
                              <td className="fm-cell--name">
                                <span className="fm-text-accent fm-text-xs" style={{ marginRight: '4px' }}>
                                  {POSITION_LABELS[player.position]}
                                </span>
                                {player.name}
                              </td>
                              <td className={ps.kda >= 4 ? 'fm-cell--green' : ps.kda >= 2.5 ? '' : 'fm-cell--red'} style={{ fontWeight: 600 }}>
                                {ps.kda.toFixed(2)}
                              </td>
                              <td>{ps.csPerMin.toFixed(1)}</td>
                              <td className={ps.goldDiffAt15 > 0 ? 'fm-cell--green' : ps.goldDiffAt15 < 0 ? 'fm-cell--red' : ''}>
                                {ps.goldDiffAt15 > 0 ? '+' : ''}{ps.goldDiffAt15}
                              </td>
                              <td>{ps.firstBloodRate.toFixed(0)}%</td>
                              <td className={ps.laneWinRate >= 55 ? 'fm-cell--green' : ps.laneWinRate <= 45 ? 'fm-cell--red' : ''}>
                                {ps.laneWinRate.toFixed(0)}%
                              </td>
                              <td>{ps.killParticipation.toFixed(0)}%</td>
                              <td>
                                <DetailedStatBar value={ps.consistencyScore} maxWidth="60px" />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 리그 심화 순위 */}
              <div className="fm-panel fm-mb-lg">
                <div className="fm-panel__header">
                  <span className="fm-panel__title">리그 심화 순위</span>
                </div>
                <div className="fm-panel__body">
                  <div className="fm-tabs">
                    {([
                      ['kda', 'KDA'],
                      ['csPerMin', 'CS/분'],
                      ['goldPerMin', '골드/분'],
                      ['damagePerMin', '데미지/분'],
                      ['killParticipation', '킬 관여율'],
                      ['goldDiffAt15', '15분 골드차'],
                      ['laneWinRate', '라인전 승률'],
                      ['consistencyScore', '일관성'],
                    ] as [string, string][]).map(([stat, label]) => (
                      <button
                        key={stat}
                        className={`fm-tab ${detailedRankingStat === stat ? 'fm-tab--active' : ''}`}
                        onClick={() => setDetailedRankingStat(stat)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {detailedRankings.length === 0 ? (
                    <p className="fm-text-muted fm-text-md">데이터가 부족합니다 (최소 3경기 필요)</p>
                  ) : (
                    <div className="fm-table-wrap">
                      <table className="fm-table fm-table--striped">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>선수</th>
                            <th>수치</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailedRankings.map((entry, idx) => (
                            <tr key={entry.playerId}>
                              <td className={idx < 3 ? 'fm-cell--accent' : ''} style={{ fontWeight: idx < 3 ? 700 : 400 }}>
                                {idx + 1}
                              </td>
                              <td className="fm-cell--name">{entry.name}</td>
                              <td className="fm-font-semibold fm-text-primary">
                                {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── 선수 랭킹 탭 ─── */}
      {activeTab === 'playerRanking' && (
        <div>
          {/* 포지션 필터 */}
          <div className="fm-flex fm-gap-sm fm-mb-md fm-items-center" style={{ flexWrap: 'wrap' }}>
            <span className="fm-text-sm fm-text-muted fm-font-semibold">포지션:</span>
            {(['ALL', 'top', 'jungle', 'mid', 'adc', 'support'] as PositionFilter[]).map((pos) => (
              <button
                key={pos}
                className={`fm-btn fm-btn--sm ${positionFilter === pos ? 'fm-btn--primary' : 'fm-btn--ghost'}`}
                onClick={() => setPositionFilter(pos)}
              >
                {pos === 'ALL' ? 'ALL' : POSITION_LABELS[pos as Position]}
              </button>
            ))}
          </div>

          {/* 정렬 기준 */}
          <div className="fm-flex fm-gap-sm fm-mb-md fm-items-center" style={{ flexWrap: 'wrap' }}>
            <span className="fm-text-sm fm-text-muted fm-font-semibold">정렬:</span>
            {([
              ['kda', 'KDA'],
              ['kills', '킬'],
              ['deaths', '데스'],
              ['assists', '어시'],
              ['cs', 'CS'],
              ['damage', '데미지'],
            ] as [RankingSortKey, string][]).map(([key, label]) => (
              <button
                key={key}
                className={`fm-btn fm-btn--sm ${rankingSortKey === key ? 'fm-btn--primary' : 'fm-btn--ghost'}`}
                onClick={() => setRankingSortKey(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 선수 랭킹 테이블 */}
          <div className="fm-panel">
            <div className="fm-panel__header">
              <span className="fm-panel__title">
                선수 랭킹 — {positionFilter === 'ALL' ? '전체' : POSITION_LABELS[positionFilter as Position]}
              </span>
              <span className="fm-text-sm fm-text-muted">{filteredRankings.length}명</span>
            </div>
            <div className="fm-panel__body--flush fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>선수명</th>
                    <th>포지션</th>
                    <th>경기수</th>
                    <th>K/D/A</th>
                    <th>KDA</th>
                    <th>CS/분</th>
                    <th>데미지/분</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRankings.map((pr, idx) => {
                    const kda = pr.totalDeaths === 0
                      ? (pr.totalKills + pr.totalAssists).toFixed(1)
                      : ((pr.totalKills + pr.totalAssists) / pr.totalDeaths).toFixed(2);
                    const csPerMin = pr.avgCs;
                    const dmgPerMin = pr.avgDamage;
                    return (
                      <tr key={pr.playerId} className={pr.teamId === userTeamId ? 'fm-table__row--selected' : ''}>
                        <td className={idx < 3 ? 'fm-cell--accent' : ''} style={{ fontWeight: idx < 3 ? 700 : 400 }}>
                          {idx + 1}
                        </td>
                        <td className="fm-cell--name">{pr.playerName}</td>
                        <td>
                          <span className="fm-text-accent fm-text-xs">{POSITION_LABELS[pr.position as Position] ?? pr.position}</span>
                        </td>
                        <td>{pr.games}</td>
                        <td>
                          <span className="fm-text-success">{pr.avgKills.toFixed(1)}</span>
                          {' / '}
                          <span className="fm-text-danger">{pr.avgDeaths.toFixed(1)}</span>
                          {' / '}
                          <span className="fm-text-secondary">{pr.avgAssists.toFixed(1)}</span>
                        </td>
                        <td className={Number(kda) >= 4 ? 'fm-cell--green' : Number(kda) >= 2.5 ? '' : 'fm-cell--red'} style={{ fontWeight: 600 }}>
                          {kda}
                        </td>
                        <td>{csPerMin.toFixed(1)}</td>
                        <td>{dmgPerMin.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── 팀 통계 탭 ─── */}
      {activeTab === 'teamStats' && (
        <div>
          <div className="fm-panel">
            <div className="fm-panel__header">
              <span className="fm-panel__title">리그 팀 순위</span>
            </div>
            <div className="fm-panel__body--flush fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>팀</th>
                    <th>승</th>
                    <th>패</th>
                    <th>승률</th>
                    <th>세트 승</th>
                    <th>세트 패</th>
                  </tr>
                </thead>
                <tbody>
                  {teamStatsData.map((ts) => (
                    <tr key={ts.teamId} className={ts.teamId === userTeamId ? 'fm-table__row--selected' : ''}>
                      <td className={ts.rank <= 3 ? 'fm-cell--accent' : ''} style={{ fontWeight: ts.rank <= 3 ? 700 : 400 }}>
                        {ts.rank}
                      </td>
                      <td className="fm-cell--name">{ts.teamName}</td>
                      <td className="fm-cell--green">{ts.wins}</td>
                      <td className="fm-cell--red">{ts.losses}</td>
                      <td style={{ fontWeight: 600 }}>{ts.winRate}%</td>
                      <td>{ts.setWins}</td>
                      <td>{ts.setLosses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 팀 킬/데스 비교 바 */}
          <div className="fm-panel fm-mt-lg">
            <div className="fm-panel__header">
              <span className="fm-panel__title">{getTeamName(userTeamId)} 시즌 통계 요약</span>
            </div>
            <div className="fm-panel__body">
              <div className="fm-grid fm-grid--3">
                <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
                  <span className="fm-stat__label">총 킬</span>
                  <span className="fm-stat__value fm-text-success">{totalKills}</span>
                </div>
                <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
                  <span className="fm-stat__label">총 데스</span>
                  <span className="fm-stat__value fm-text-danger">{totalDeaths}</span>
                </div>
                <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
                  <span className="fm-stat__label">팀 K/D</span>
                  <span className="fm-stat__value">{teamKdRatio}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MVP 보드 탭 ─── */}
      {activeTab === 'mvpBoard' && (
        <div>
          <div className="fm-panel">
            <div className="fm-panel__header">
              <span className="fm-panel__title">MVP 보드 — KDA TOP 10</span>
            </div>
            <div className="fm-panel__body">
              {mvpBoard.length === 0 ? (
                <p className="fm-text-muted">경기 데이터가 부족합니다.</p>
              ) : (
                <div className="fm-flex-col fm-gap-md">
                  {mvpBoard.map((entry, idx) => {
                    const maxKda = mvpBoard[0]?.kda ?? 1;
                    const barWidth = maxKda > 0 ? (entry.kda / maxKda) * 100 : 0;
                    return (
                      <div key={entry.playerId} className="fm-flex fm-items-center fm-gap-sm">
                        {/* 순위 */}
                        <span
                          className={`fm-font-bold fm-flex-shrink-0 ${idx < 3 ? 'fm-text-accent' : 'fm-text-muted'}`}
                          style={{ width: '28px', textAlign: 'right', fontSize: idx < 3 ? '16px' : '13px' }}
                        >
                          {idx + 1}
                        </span>

                        {/* 선수 정보 */}
                        <div className="fm-flex-col fm-flex-shrink-0" style={{ width: '120px' }}>
                          <span className="fm-text-primary fm-font-semibold fm-text-md">{entry.playerName}</span>
                          <span className="fm-text-xs fm-text-accent">{POSITION_LABELS[entry.position as Position] ?? entry.position}</span>
                        </div>

                        {/* KDA 바 차트 */}
                        <div className="fm-flex-1">
                          <div style={{ position: 'relative', height: '20px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${barWidth}%`,
                              height: '100%',
                              background: idx === 0
                                ? 'linear-gradient(90deg, var(--accent), #e0c068)'
                                : idx < 3
                                  ? 'linear-gradient(90deg, rgba(200,170,110,0.6), rgba(200,170,110,0.3))'
                                  : 'rgba(100,181,246,0.4)',
                              borderRadius: '4px',
                              transition: 'width 0.3s ease',
                            }} />
                            <span style={{
                              position: 'absolute',
                              right: '8px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                            }}>
                              {entry.kda.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* 세부 스탯 */}
                        <div className="fm-flex fm-gap-md fm-flex-shrink-0 fm-text-sm" style={{ width: '180px' }}>
                          <span>
                            <span className="fm-text-muted">CS </span>
                            <span className="fm-text-primary fm-font-semibold">{entry.avgCs.toFixed(0)}</span>
                          </span>
                          <span>
                            <span className="fm-text-muted">DMG </span>
                            <span className="fm-text-primary fm-font-semibold">{entry.avgDamage.toLocaleString()}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 최근 5경기 KDA 바 차트 (사용자 팀 로스터 기준) */}
          {userRoster.length > 0 && (
            <div className="fm-panel fm-mt-lg">
              <div className="fm-panel__header">
                <span className="fm-panel__title">{getTeamName(userTeamId)} 로스터 시즌 KDA</span>
              </div>
              <div className="fm-panel__body">
                <div className="fm-flex-col fm-gap-sm">
                  {userRoster
                    .filter((p) => {
                      const pr = playerRankings.find((r) => r.playerId === p.id);
                      return pr && pr.games > 0;
                    })
                    .map((player) => {
                      const pr = playerRankings.find((r) => r.playerId === player.id);
                      if (!pr) return null;
                      const kda = pr.totalDeaths === 0
                        ? pr.totalKills + pr.totalAssists
                        : (pr.totalKills + pr.totalAssists) / pr.totalDeaths;
                      const maxKda = 8;
                      const barPct = Math.min((kda / maxKda) * 100, 100);
                      return (
                        <div key={player.id} className="fm-bar">
                          <span className="fm-text-accent fm-font-semibold fm-text-sm fm-flex-shrink-0" style={{ width: '32px' }}>
                            {POSITION_LABELS[player.position]}
                          </span>
                          <span className="fm-text-primary fm-text-sm fm-flex-shrink-0" style={{ width: '80px' }}>
                            {player.name}
                          </span>
                          <div className="fm-bar__track" style={{ height: '16px', borderRadius: '4px' }}>
                            <div
                              className={`fm-bar__fill ${kda >= 4 ? 'fm-bar__fill--green' : kda >= 2.5 ? 'fm-bar__fill--accent' : 'fm-bar__fill--red'}`}
                              style={{ width: `${barPct}%`, borderRadius: '4px' }}
                            />
                          </div>
                          <span className="fm-bar__value fm-font-semibold fm-flex-shrink-0" style={{ width: '50px' }}>
                            {kda.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── 기본 통계 탭 ─── */}
      {activeTab === 'overview' && <>

      {/* ─── 팀 통계 요약 카드 ─── */}
      <div className="fm-panel fm-mb-lg">
        <div className="fm-panel__header">
          <span className="fm-panel__title">{userTeamName} 핵심 지표</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--4">
            {/* 승률 원형 */}
            <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
              <span className="fm-stat__label">승률</span>
              <div
                className="fm-flex fm-items-center fm-justify-center"
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: `conic-gradient(var(--accent) ${winRateNum * 3.6}deg, var(--bg-tertiary) ${winRateNum * 3.6}deg)`,
                }}
              >
                <div
                  className="fm-flex fm-items-center fm-justify-center"
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'var(--bg-card)',
                  }}
                >
                  <span className="fm-text-lg fm-font-bold fm-text-accent">{winRate}%</span>
                </div>
              </div>
              <span className="fm-text-sm fm-text-muted">{userStanding?.wins ?? 0}승 {userStanding?.losses ?? 0}패</span>
            </div>

            {/* 평균 게임 시간 */}
            <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
              <span className="fm-stat__label">평균 게임 시간</span>
              <span className="fm-stat__value">
                {avgGameMinutes}:{String(avgGameSeconds).padStart(2, '0')}
              </span>
              <span className="fm-text-sm fm-text-muted">{totalGames}경기 기준</span>
            </div>

            {/* 평균 K/D */}
            <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
              <span className="fm-stat__label">팀 K/D</span>
              <span className="fm-stat__value">{teamKdRatio}</span>
              <span className="fm-text-sm fm-text-muted">{totalKills}킬 / {totalDeaths}데스</span>
            </div>

            {/* 연승/연패 */}
            <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
              <span className="fm-stat__label">
                {streakType === 'win' ? '연승' : streakType === 'loss' ? '연패' : '기록 없음'}
              </span>
              <span className={`fm-stat__value ${streakType === 'win' ? 'fm-text-success' : streakType === 'loss' ? 'fm-text-danger' : 'fm-text-secondary'}`}>
                {currentStreak > 0 ? `${currentStreak}${streakType === 'win' ? '연승' : '연패'}` : '-'}
              </span>
              <span className="fm-text-sm fm-text-muted">현재 스트릭</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 최근 10경기 승/패 바 차트 ─── */}
      {recentGamesForChart.length > 0 && (
        <div className="fm-panel fm-mb-lg">
          <div className="fm-panel__header">
            <span className="fm-panel__title">최근 경기 승패 (킬 수 기준)</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-gap-sm fm-items-center" style={{ alignItems: 'flex-end', height: '110px', paddingTop: '20px' }}>
              {recentGamesForChart.map((game, i) => (
                <div key={i} className="fm-flex-col fm-items-center fm-gap-xs" style={{ justifyContent: 'flex-end', height: '100%' }}>
                  <span className="fm-text-sm fm-font-bold fm-text-secondary">
                    {game.isWin ? 'W' : 'L'}
                  </span>
                  <div style={{
                    width: '28px',
                    height: `${Math.max(Math.min(game.kills * 4, 80), 6)}px`,
                    background: game.isWin ? 'var(--success)' : 'var(--danger)',
                    borderRadius: '3px 3px 0 0',
                    transition: 'height 0.3s ease',
                  }} />
                  <span className="fm-text-xs fm-text-muted">{game.kills}</span>
                </div>
              ))}
            </div>
            <div className="fm-flex fm-gap-md fm-mt-sm">
              <span className="fm-text-sm fm-text-success">■ 승리</span>
              <span className="fm-text-sm fm-text-danger">■ 패배</span>
              <span className="fm-text-sm fm-text-muted">숫자 = 총 킬</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── 포지션별 평균 OVR ─── */}
      {userRoster.length > 0 && (
        <div className="fm-panel fm-mb-lg">
          <div className="fm-panel__header">
            <span className="fm-panel__title">포지션별 평균 OVR</span>
          </div>
          <div className="fm-panel__body" style={{ maxWidth: '500px' }}>
            {positionAvgOvr.map(({ position, avgOvr }) => (
              <div key={position} className="fm-bar fm-mb-sm">
                <span className="fm-text-accent fm-font-semibold fm-text-base" style={{ width: '40px' }}>
                  {POSITION_LABELS[position]}
                </span>
                <div className="fm-bar__track" style={{ height: '16px', borderRadius: '8px' }}>
                  <div
                    className={`fm-bar__fill ${getBarFillClass(avgOvr)}`}
                    style={{ width: `${avgOvr}%`, borderRadius: '8px' }}
                  />
                </div>
                <span className="fm-bar__value fm-text-primary fm-font-semibold">{avgOvr}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 선수 성장 추적 ─── */}
      {userRoster.length > 0 && (
        <div className="fm-panel fm-mb-lg">
          <div className="fm-panel__header">
            <span className="fm-panel__title">선수 OVR 현황</span>
          </div>
          <div className="fm-panel__body" style={{ maxWidth: '600px' }}>
            {POSITION_ORDER.map((pos) => {
              const posPlayers = userRoster.filter((p) => p.position === pos);
              return posPlayers.map((player) => {
                const currentOvr = getOverall(player);
                const potentialOvr = player.potential;
                const diff = currentOvr - potentialOvr;

                return (
                  <div key={player.id} className="fm-flex fm-items-center fm-gap-sm fm-mb-sm">
                    <div className="fm-flex fm-items-center fm-gap-sm fm-flex-shrink-0" style={{ width: '120px' }}>
                      <span className="fm-text-sm fm-text-accent fm-font-semibold" style={{ width: '30px' }}>
                        {POSITION_LABELS[player.position]}
                      </span>
                      <span className="fm-text-md fm-text-primary fm-font-medium">{player.name}</span>
                    </div>
                    <div className="fm-flex-1">
                      <div style={{ position: 'relative', height: '14px', background: 'var(--bg-card)', borderRadius: '6px', overflow: 'hidden' }}>
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
                            ? 'linear-gradient(90deg, var(--accent), #e0c068)'
                            : 'linear-gradient(90deg, var(--danger), #ec7063)',
                          borderRadius: '6px',
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    </div>
                    <span className="fm-text-md fm-font-bold fm-text-primary fm-flex-shrink-0" style={{ width: '30px', textAlign: 'right' }}>
                      {currentOvr}
                    </span>
                    <span
                      className={`fm-text-base fm-font-semibold fm-flex-shrink-0 ${diff > 0 ? 'fm-text-success' : diff < 0 ? 'fm-text-danger' : 'fm-text-muted'}`}
                      style={{ width: '40px', textAlign: 'right' }}
                    >
                      {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '='}
                      {diff > 0 ? ' \u2191' : diff < 0 ? ' \u2193' : ''}
                    </span>
                  </div>
                );
              });
            })}
            <p className="fm-text-sm fm-text-muted fm-mt-sm">
              회색 바 = 잠재력, 컬러 바 = 현재 OVR, 화살표 = 잠재력 대비 차이
            </p>
          </div>
        </div>
      )}

      {/* ─── 기존: 팀 전적 요약 ─── */}
      <div className="fm-panel fm-mb-lg">
        <div className="fm-panel__header">
          <span className="fm-panel__title">{userTeamName} 시즌 전적</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--4">
            <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
              <span className="fm-stat__label">매치 승</span>
              <span className="fm-stat__value">{userStanding?.wins ?? 0}</span>
            </div>
            <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
              <span className="fm-stat__label">매치 패</span>
              <span className="fm-stat__value">{userStanding?.losses ?? 0}</span>
            </div>
            <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
              <span className="fm-stat__label">세트 승</span>
              <span className="fm-stat__value">{userStanding?.setWins ?? 0}</span>
            </div>
            <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
              <span className="fm-stat__label">세트 패</span>
              <span className="fm-stat__value">{userStanding?.setLosses ?? 0}</span>
            </div>
            <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
              <span className="fm-stat__label">승률</span>
              <span className="fm-stat__value fm-stat__value--accent">{winRate}%</span>
            </div>
            <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
              <span className="fm-stat__label">평균 킬/게임</span>
              <span className="fm-stat__value">{avgKillsPerGame}</span>
            </div>
            <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
              <span className="fm-stat__label">평균 15분 골드차</span>
              <span className={`fm-stat__value ${avgGoldDiffAt15 > 0 ? 'fm-text-success' : avgGoldDiffAt15 < 0 ? 'fm-text-danger' : ''}`}>
                {avgGoldDiffAt15 > 0 ? `+${avgGoldDiffAt15}` : avgGoldDiffAt15}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 주차별 승률 변화 차트 */}
      {cumulativeWinRates.length > 0 && (
        <div className="fm-panel fm-mb-lg">
          <div className="fm-panel__header">
            <span className="fm-panel__title">주차별 누적 승률</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex-col fm-gap-sm">
              {cumulativeWinRates.map((entry) => (
                <div key={entry.week} className="fm-bar">
                  <span className="fm-text-base fm-text-muted fm-text-right fm-flex-shrink-0" style={{ width: '36px' }}>
                    W{entry.week}
                  </span>
                  <div className="fm-bar__track" style={{ height: '16px', borderRadius: '4px' }}>
                    <div
                      className="fm-bar__fill fm-bar__fill--accent"
                      style={{ width: `${entry.rate}%`, borderRadius: '4px' }}
                    />
                  </div>
                  <span className="fm-bar__value fm-flex-shrink-0" style={{ width: '40px' }}>
                    {entry.rate}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 최근 10경기 기록 */}
      <div className="fm-panel fm-mb-lg">
        <div className="fm-panel__header">
          <span className="fm-panel__title">최근 경기 기록</span>
        </div>
        {playedMatches.length === 0 ? (
          <div className="fm-panel__body">
            <p className="fm-text-muted">진행된 경기가 없습니다.</p>
          </div>
        ) : (
          <div className="fm-panel__body--flush fm-table-wrap">
            <table className="fm-table fm-table--striped">
              <thead>
                <tr>
                  <th>주차</th>
                  <th>상대팀</th>
                  <th>결과</th>
                  <th>스코어</th>
                  <th>유형</th>
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
                    <tr key={match.id}>
                      <td>W{match.week}</td>
                      <td className="fm-cell--name">{opponentName}</td>
                      <td className={result === 'win' ? 'fm-cell--green' : 'fm-cell--red'} style={{ fontWeight: 600 }}>
                        {result === 'win' ? '승' : '패'}
                      </td>
                      <td>{score}</td>
                      <td>{getMatchTypeLabel(match.matchType)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 개인 순위 */}
      {playerRankings.length > 0 && (
        <div className="fm-panel fm-mb-lg">
          <div className="fm-panel__header">
            <span className="fm-panel__title">개인 순위</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-tabs">
              {([
                ['kills', '킬왕'],
                ['kda', 'KDA왕'],
                ['cs', 'CS왕'],
                ['damage', '데미지왕'],
              ] as [RankingCategory, string][]).map(([cat, label]) => (
                <button
                  key={cat}
                  className={`fm-tab ${rankingCategory === cat ? 'fm-tab--active' : ''}`}
                  onClick={() => setRankingCategory(cat)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>선수</th>
                    <th>팀</th>
                    <th>경기</th>
                    <th>
                      {rankingCategory === 'kills' ? '총 킬'
                        : rankingCategory === 'kda' ? 'KDA'
                        : rankingCategory === 'cs' ? '평균 CS'
                        : '평균 데미지'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedRankings(playerRankings, rankingCategory).slice(0, 10).map((pr, idx) => (
                    <tr key={pr.playerId}>
                      <td className={idx < 3 ? 'fm-cell--accent' : ''} style={{ fontWeight: idx < 3 ? 700 : 400 }}>
                        {idx + 1}
                      </td>
                      <td className="fm-cell--name">{pr.playerName}</td>
                      <td>{getTeamName(pr.teamId)}</td>
                      <td>{pr.games}</td>
                      <td className="fm-font-semibold fm-text-primary">
                        {getRankingValue(pr, rankingCategory)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      </>}
    </div>
  );
}

/** 수평 바 컴포넌트 (심화 통계용) */
function DetailedStatBar({ value, maxWidth }: { value: number; maxWidth?: string }) {
  const colorClass = value >= 70 ? 'fm-bar__fill--green' : value >= 50 ? 'fm-bar__fill--accent' : value >= 30 ? 'fm-bar__fill--yellow' : 'fm-bar__fill--red';
  const textClass = value >= 70 ? 'fm-text-success' : value >= 50 ? 'fm-text-accent' : value >= 30 ? 'fm-text-warning' : 'fm-text-danger';
  return (
    <div className="fm-bar" style={{ maxWidth: maxWidth ?? '100%' }}>
      <div className="fm-bar__track" style={{ height: '8px' }}>
        <div className={`fm-bar__fill ${colorClass}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className={`fm-bar__value fm-font-semibold ${textClass}`}>{value}</span>
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
