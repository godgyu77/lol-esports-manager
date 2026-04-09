/**
 * 선수 모드 통계 페이지
 * - 커리어 통계 (킬, 데스, 어시스트, 총 게임 수)
 * - 시즌별 성과 평점
 * - 챔피언 풀 숙련도 바
 * - 리그 평균과 비교
 */

import { useState, useEffect } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getDatabase } from '../../../db/database';
import { MainLoopPanel } from '../../manager/components/MainLoopPanel';

interface CareerStats {
  totalGames: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalCs: number;
  totalDamage: number;
}

interface RecentGameStat {
  matchId: string;
  matchDate: string | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  goldEarned: number;
  damageDealt: number;
  side: string;
  position: string;
}

interface ChampionPool {
  name: string;
  games: number;
  proficiency: number;
}

interface LeagueComparison {
  stat: string;
  player: number;
  leagueAvg: number;
  unit: string;
}

function getProficiencyBarClass(value: number): string {
  if (value >= 80) return 'fm-bar__fill--green';
  if (value >= 60) return 'fm-bar__fill--yellow';
  if (value >= 40) return 'fm-bar__fill--blue';
  return 'fm-bar__fill--red';
}

function getComparisonBarClass(player: number, avg: number): string {
  const diff = ((player - avg) / avg) * 100;
  if (diff >= 10) return 'fm-bar__fill--green';
  if (diff >= 0) return 'fm-bar__fill--blue';
  if (diff >= -10) return 'fm-bar__fill--yellow';
  return 'fm-bar__fill--red';
}

function getComparisonTextClass(player: number, avg: number): string {
  const diff = ((player - avg) / avg) * 100;
  if (diff >= 10) return 'fm-text-success';
  if (diff >= 0) return 'fm-text-info';
  if (diff >= -10) return 'fm-text-warning';
  return 'fm-text-danger';
}

export function PlayerStatsView() {
  const save = useGameStore((s) => s.save);

  const [career, setCareer] = useState<CareerStats | null>(null);
  const [recentGames, setRecentGames] = useState<RecentGameStat[]>([]);
  const [championPool, setChampionPool] = useState<ChampionPool[]>([]);
  const [comparisons, setComparisons] = useState<LeagueComparison[]>([]);
  const [activeTab, setActiveTab] = useState<'recent' | 'champions' | 'comparison'>('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStatsData() {
      try {
        setLoading(true);
        setError(null);
        const db = await getDatabase();

        // 유저 선수 조회
        const playerRows = await db.select<{ id: string; name: string; position: string }[]>(
          'SELECT id, name, position FROM players WHERE is_user_player = 1 LIMIT 1',
        );
        if (playerRows.length === 0) {
          setError('유저 선수를 찾을 수 없습니다.');
          return;
        }
        const playerId = playerRows[0].id;

        // 커리어 통계 조회
        const careerRows = await db.select<{
          total_games: number;
          total_kills: number;
          total_deaths: number;
          total_assists: number;
          total_cs: number;
          total_damage: number;
        }[]>(
          'SELECT * FROM player_career_stats WHERE player_id = $1',
          [playerId],
        );

        if (careerRows.length > 0) {
          const c = careerRows[0];
          setCareer({
            totalGames: c.total_games,
            totalKills: c.total_kills,
            totalDeaths: c.total_deaths,
            totalAssists: c.total_assists,
            totalCs: c.total_cs,
            totalDamage: c.total_damage,
          });
        } else {
          // player_career_stats가 없으면 player_game_stats에서 집계
          const aggRows = await db.select<{
            total_games: number;
            total_kills: number;
            total_deaths: number;
            total_assists: number;
            total_cs: number;
            total_damage: number;
          }[]>(
            `SELECT
              COUNT(*) as total_games,
              COALESCE(SUM(kills), 0) as total_kills,
              COALESCE(SUM(deaths), 0) as total_deaths,
              COALESCE(SUM(assists), 0) as total_assists,
              COALESCE(SUM(cs), 0) as total_cs,
              COALESCE(SUM(damage_dealt), 0) as total_damage
            FROM player_game_stats WHERE player_id = $1`,
            [playerId],
          );
          if (aggRows.length > 0 && aggRows[0].total_games > 0) {
            const a = aggRows[0];
            setCareer({
              totalGames: a.total_games,
              totalKills: a.total_kills,
              totalDeaths: a.total_deaths,
              totalAssists: a.total_assists,
              totalCs: a.total_cs,
              totalDamage: a.total_damage,
            });
          } else {
            setCareer(null);
          }
        }

        // 최근 경기 스탯 조회 (최대 10경기)
        const gameRows = await db.select<{
          match_id: string;
          match_date: string | null;
          kills: number;
          deaths: number;
          assists: number;
          cs: number;
          gold_earned: number;
          damage_dealt: number;
          side: string;
          position: string;
        }[]>(
          `SELECT pgs.match_id, m.played_at AS match_date,
                  pgs.kills, pgs.deaths, pgs.assists, pgs.cs,
                  pgs.gold_earned, pgs.damage_dealt, pgs.side, pgs.position
           FROM player_game_stats pgs
           LEFT JOIN matches m ON m.id = pgs.match_id
           WHERE pgs.player_id = $1
           ORDER BY m.played_at DESC, pgs.game_id DESC
           LIMIT 10`,
          [playerId],
        );
        setRecentGames(
          gameRows.map((r) => ({
            matchId: r.match_id,
            matchDate: r.match_date,
            kills: r.kills,
            deaths: r.deaths,
            assists: r.assists,
            cs: r.cs,
            goldEarned: r.gold_earned,
            damageDealt: r.damage_dealt,
            side: r.side,
            position: r.position,
          })),
        );

        // 챔피언 풀 조회
        const champRows = await db.select<{
          champion_id: string;
          proficiency: number;
          games_played: number;
        }[]>(
          `SELECT champion_id, proficiency, games_played
           FROM champion_proficiency
           WHERE player_id = $1
           ORDER BY proficiency DESC`,
          [playerId],
        );

        const champPool: ChampionPool[] = [];
        for (const c of champRows) {
          const nameRows = await db.select<{ name: string }[]>(
            'SELECT name FROM champions WHERE id = $1',
            [c.champion_id],
          );
          champPool.push({
            name: nameRows.length > 0 ? nameRows[0].name : c.champion_id,
            games: c.games_played,
            proficiency: c.proficiency,
          });
        }
        setChampionPool(champPool);

        // 리그 평균 비교 (전체 선수 평균 vs 유저 선수)
        const avgRows = await db.select<{
          avg_kills: number;
          avg_deaths: number;
          avg_assists: number;
          avg_cs: number;
          avg_damage: number;
        }[]>(
          `SELECT
            ROUND(AVG(kills), 1) as avg_kills,
            ROUND(AVG(deaths), 1) as avg_deaths,
            ROUND(AVG(assists), 1) as avg_assists,
            ROUND(AVG(cs), 0) as avg_cs,
            ROUND(AVG(damage_dealt), 0) as avg_damage
          FROM player_game_stats`,
        );

        const playerAvgRows = await db.select<{
          avg_kills: number;
          avg_deaths: number;
          avg_assists: number;
          avg_cs: number;
          avg_damage: number;
        }[]>(
          `SELECT
            ROUND(AVG(kills), 1) as avg_kills,
            ROUND(AVG(deaths), 1) as avg_deaths,
            ROUND(AVG(assists), 1) as avg_assists,
            ROUND(AVG(cs), 0) as avg_cs,
            ROUND(AVG(damage_dealt), 0) as avg_damage
          FROM player_game_stats WHERE player_id = $1`,
          [playerId],
        );

        if (avgRows.length > 0 && playerAvgRows.length > 0) {
          const la = avgRows[0];
          const pa = playerAvgRows[0];
          const comps: LeagueComparison[] = [];

          if (pa.avg_kills != null) {
            const playerKda = pa.avg_deaths > 0
              ? ((pa.avg_kills + pa.avg_assists) / pa.avg_deaths)
              : pa.avg_kills + pa.avg_assists;
            const leagueKda = la.avg_deaths > 0
              ? ((la.avg_kills + la.avg_assists) / la.avg_deaths)
              : la.avg_kills + la.avg_assists;

            comps.push({ stat: 'KDA', player: Number(playerKda.toFixed(2)), leagueAvg: Number(leagueKda.toFixed(2)), unit: '' });
            comps.push({ stat: '평균 킬', player: pa.avg_kills, leagueAvg: la.avg_kills, unit: '' });
            comps.push({ stat: '평균 데스', player: pa.avg_deaths, leagueAvg: la.avg_deaths, unit: '' });
            comps.push({ stat: '평균 어시스트', player: pa.avg_assists, leagueAvg: la.avg_assists, unit: '' });
            comps.push({ stat: '평균 CS', player: pa.avg_cs, leagueAvg: la.avg_cs, unit: '' });
            comps.push({ stat: '평균 데미지', player: pa.avg_damage, leagueAvg: la.avg_damage, unit: '' });
          }
          setComparisons(comps);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'DB 조회 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    loadStatsData();
  }, [save]);

  if (loading) {
    return <div className="fm-text-secondary fm-text-md">통계 정보를 불러오는 중...</div>;
  }

  if (error) {
    return (
      <div className="fm-alert fm-alert--danger">
        <span className="fm-alert__icon">!</span>
        <span className="fm-alert__text">{error}</span>
      </div>
    );
  }

  const overallKda = career && career.totalDeaths > 0
    ? ((career.totalKills + career.totalAssists) / career.totalDeaths).toFixed(2)
    : career ? '퍼펙트' : '-';
  const recentGameLabel = recentGames[0]?.matchDate ? recentGames[0].matchDate.slice(0, 10) : '기록 없음';
  const championLead = championPool[0];

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">선수 통계</h1>
      </div>

      <MainLoopPanel
        eyebrow="선수 루프"
        title="최근 폼과 강점을 먼저 읽는 통계 허브"
        subtitle="커리어 누적치와 탭 전체를 한 번에 보기보다, 지금 확인해야 할 최근 흐름과 대표 지표를 먼저 읽도록 정리했습니다."
        insights={[
          {
            label: '커리어 핵심',
            value: career ? `${career.totalGames}경기 / KDA ${overallKda}` : '기록 없음',
            detail: career ? `${career.totalKills}/${career.totalDeaths}/${career.totalAssists}` : '경기 데이터가 쌓이면 여기서 핵심 흐름을 볼 수 있습니다.',
            tone: career ? 'accent' : 'warning',
          },
          {
            label: '최근 흐름',
            value: recentGames.length > 0 ? `${recentGames.length}경기 집계` : '최근 경기 없음',
            detail: recentGames.length > 0 ? `가장 최근 기록 ${recentGameLabel}` : '최근 경기 데이터가 아직 없습니다.',
            tone: recentGames.length > 0 ? 'success' : 'warning',
          },
          {
            label: '대표 챔피언',
            value: championLead?.name ?? '데이터 없음',
            detail: championLead ? `숙련도 ${championLead.proficiency} / ${championLead.games}게임` : '챔피언 풀이 쌓이면 강점을 더 빠르게 읽을 수 있습니다.',
            tone: championLead ? 'accent' : 'neutral',
          },
          {
            label: '현재 보기',
            value: activeTab === 'recent' ? '최근 경기' : activeTab === 'champions' ? '챔피언 풀' : '리그 평균 비교',
            detail: '아래 탭에서 최근 경기, 챔피언 숙련도, 리그 평균 비교를 이어서 볼 수 있습니다.',
            tone: 'accent',
          },
        ]}
        note="상단은 현재 폼을 읽는 용도, 아래 탭은 상세 기록을 비교하는 용도로 나눴습니다."
      />

      {/* 커리어 요약 카드 */}
      {career ? (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">커리어 요약</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-grid fm-grid--4" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              <div className="fm-card fm-text-center">
                <div className="fm-stat">
                  <span className="fm-stat__label">총 게임</span>
                  <span className="fm-stat__value">{career.totalGames}</span>
                </div>
              </div>
              <div className="fm-card fm-text-center">
                <div className="fm-stat">
                  <span className="fm-stat__label">통산 KDA</span>
                  <span className="fm-stat__value fm-text-warning">{overallKda}</span>
                </div>
                <span className="fm-text-xs fm-text-muted">{career.totalKills}/{career.totalDeaths}/{career.totalAssists}</span>
              </div>
              <div className="fm-card fm-text-center">
                <div className="fm-stat">
                  <span className="fm-stat__label">총 CS</span>
                  <span className="fm-stat__value fm-text-info">{career.totalCs.toLocaleString()}</span>
                </div>
              </div>
              <div className="fm-card fm-text-center">
                <div className="fm-stat">
                  <span className="fm-stat__label">총 데미지</span>
                  <span className="fm-stat__value fm-text-danger">{career.totalDamage.toLocaleString()}</span>
                </div>
              </div>
              <div className="fm-card fm-text-center">
                <div className="fm-stat">
                  <span className="fm-stat__label">게임당 CS</span>
                  <span className="fm-stat__value fm-text-success">
                    {career.totalGames > 0 ? (career.totalCs / career.totalGames).toFixed(0) : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="fm-panel">
          <div className="fm-panel__body">
            <p className="fm-text-muted fm-text-md">커리어 통계 데이터가 없습니다.</p>
          </div>
        </div>
      )}

      {/* 탭 네비게이션 */}
      <div className="fm-tabs" role="tablist">
        {([
          { key: 'recent', label: '최근 경기' },
          { key: 'champions', label: '챔피언 풀' },
          { key: 'comparison', label: '리그 평균 비교' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`fm-tab ${activeTab === tab.key ? 'fm-tab--active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 최근 경기 */}
      {activeTab === 'recent' && (
        <div className="fm-panel">
          <div className="fm-panel__body--flush">
            {recentGames.length === 0 ? (
              <div className="fm-panel__body">
                <p className="fm-text-muted fm-text-md">최근 경기 기록이 없습니다.</p>
              </div>
            ) : (
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th className="text-center">K/D/A</th>
                    <th className="text-center">KDA</th>
                    <th className="text-center">CS</th>
                    <th className="text-center">골드</th>
                    <th className="text-center">데미지</th>
                    <th className="text-right">포지션</th>
                  </tr>
                </thead>
                <tbody>
                  {recentGames.map((game, i) => {
                    const kda = game.deaths === 0 ? '퍼펙트' : ((game.kills + game.assists) / game.deaths).toFixed(2);
                    return (
                      <tr key={`${game.matchId}-${i}`}>
                        <td className="fm-cell--name">
                          {game.matchDate ? game.matchDate.slice(0, 10) : '-'}
                        </td>
                        <td className="text-center">
                          {game.kills}/{game.deaths}/{game.assists}
                        </td>
                        <td className={`text-center ${Number(kda) >= 4 || kda === '퍼펙트' ? 'fm-cell--gold' : ''}`}>
                          {kda}
                        </td>
                        <td className="text-center">{game.cs}</td>
                        <td className="text-center fm-cell--green">{game.goldEarned.toLocaleString()}</td>
                        <td className="text-center fm-cell--red">{game.damageDealt.toLocaleString()}</td>
                        <td className="text-right fm-text-muted" style={{ textTransform: 'uppercase' }}>{game.position}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 챔피언 풀 */}
      {activeTab === 'champions' && (
        <div className="fm-panel">
          <div className="fm-panel__body">
            {championPool.length === 0 ? (
              <p className="fm-text-muted fm-text-md">챔피언 풀 데이터가 없습니다.</p>
            ) : (
              <div className="fm-flex-col fm-gap-sm">
                {championPool.map((champ) => (
                  <div key={champ.name} className="fm-card">
                    <div className="fm-flex fm-items-center fm-gap-md">
                      <div style={{ minWidth: '80px' }}>
                        <span className="fm-text-lg fm-font-medium fm-text-primary">{champ.name}</span>
                        <p className="fm-text-xs fm-text-muted">{champ.games}게임</p>
                      </div>
                      <div className="fm-flex-1">
                        <div className="fm-bar">
                          <span className="fm-text-xs fm-text-muted" style={{ minWidth: '36px' }}>숙련도</span>
                          <div className="fm-bar__track" style={{ height: '8px' }}>
                            <div
                              className={`fm-bar__fill ${getProficiencyBarClass(champ.proficiency)}`}
                              style={{ width: `${champ.proficiency}%` }}
                            />
                          </div>
                          <span className="fm-bar__value">{champ.proficiency}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 리그 평균 비교 */}
      {activeTab === 'comparison' && (
        <div className="fm-panel">
          <div className="fm-panel__body">
            {comparisons.length === 0 ? (
              <p className="fm-text-muted fm-text-md">비교 데이터가 없습니다. 경기를 더 진행하면 데이터가 누적됩니다.</p>
            ) : (
              <div className="fm-flex-col fm-gap-sm">
                {comparisons.map((comp) => {
                  const diff = comp.player - comp.leagueAvg;
                  const diffPercent = comp.leagueAvg > 0 ? ((diff / comp.leagueAvg) * 100).toFixed(1) : '0';
                  const isPositive = diff >= 0;
                  const barWidth = Math.min((comp.player / (comp.leagueAvg * 1.5)) * 100, 100);
                  const avgBarWidth = Math.min((comp.leagueAvg / (comp.leagueAvg * 1.5)) * 100, 100);

                  return (
                    <div key={comp.stat} className="fm-card">
                      <div className="fm-flex fm-items-center fm-justify-between fm-mb-sm">
                        <span className="fm-text-lg fm-font-medium fm-text-primary">{comp.stat}</span>
                        <span className={`fm-text-sm fm-font-medium ${getComparisonTextClass(comp.player, comp.leagueAvg)}`}>
                          {isPositive ? '+' : ''}{diffPercent}%
                        </span>
                      </div>
                      <div className="fm-flex-col fm-gap-xs">
                        <div className="fm-bar">
                          <span className="fm-text-xs fm-text-info" style={{ minWidth: '56px' }}>나</span>
                          <div className="fm-bar__track" style={{ height: '8px' }}>
                            <div
                              className={`fm-bar__fill ${getComparisonBarClass(comp.player, comp.leagueAvg)}`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="fm-bar__value fm-text-primary" style={{ minWidth: '56px' }}>
                            {comp.player}{comp.unit}
                          </span>
                        </div>
                        <div className="fm-bar">
                          <span className="fm-text-xs fm-text-muted" style={{ minWidth: '56px' }}>리그 평균</span>
                          <div className="fm-bar__track" style={{ height: '8px' }}>
                            <div
                              className="fm-bar__fill"
                              style={{ width: `${avgBarWidth}%`, background: 'var(--text-muted)' }}
                            />
                          </div>
                          <span className="fm-bar__value" style={{ minWidth: '56px' }}>
                            {comp.leagueAvg}{comp.unit}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
