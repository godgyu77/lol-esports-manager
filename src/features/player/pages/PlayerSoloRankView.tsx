/**
 * 선수 모드 솔로랭크 페이지
 * - 솔로랭크 상태 (티어, LP, 승률, 랭킹)
 * - 챔피언 연습 선택
 * - 최근 솔로랭크 경기 결과
 * - LP 추이 그래프
 */

import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getDatabase } from '../../../db/database';

interface SoloRankStatus {
  tier: string;
  lp: number;
  recentWinRate: number;
  rank: number;
  practiceChampionId: string | null;
}

interface DailyLog {
  id: number;
  gameDate: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  lpChange: number;
  tierChanged: boolean;
  newTier: string | null;
  practiceChampionId: string | null;
  proficiencyGain: number;
}

interface ChampionPractice {
  championId: string;
  name: string;
  proficiency: number;
  gamesPlayed: number;
  selected: boolean;
}

interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  teamId: string | null;
  tier: string;
  lp: number;
  rank: number;
}

const TIER_LABELS: Record<string, string> = {
  challenger: '챌린저',
  grandmaster: '그랜드마스터',
  master: '마스터',
  diamond: '다이아몬드',
  emerald: '에메랄드',
  platinum: '플래티넘',
};

const TIER_COLORS: Record<string, string> = {
  challenger: '#f0c94d',
  grandmaster: '#dc3c3c',
  master: '#9b59b6',
  diamond: '#3498db',
  emerald: '#2ecc71',
  platinum: '#27ae60',
};

function getProficiencyBarClass(value: number): string {
  if (value >= 80) return 'fm-bar__fill--green';
  if (value >= 60) return 'fm-bar__fill--yellow';
  if (value >= 40) return 'fm-bar__fill--blue';
  return 'fm-bar__fill--red';
}

export function PlayerSoloRankView() {
  const save = useGameStore((s) => s.save);

  const [status, setStatus] = useState<SoloRankStatus | null>(null);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [champions, setChampions] = useState<ChampionPractice[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSoloRankData() {
      try {
        setLoading(true);
        setError(null);
        const db = await getDatabase();

        // 유저 선수 ID 조회
        const playerRows = await db.select<{ id: string; name: string }[]>(
          'SELECT id, name FROM players WHERE is_user_player = 1 LIMIT 1',
        );
        if (playerRows.length === 0) {
          setError('유저 선수를 찾을 수 없습니다.');
          return;
        }
        const playerId = playerRows[0].id;

        // 솔로랭크 상태 조회
        const rankRows = await db.select<{
          player_id: string;
          tier: string;
          lp: number;
          recent_win_rate: number;
          practice_champion_id: string | null;
          rank_position: number;
        }[]>(
          'SELECT * FROM player_solo_rank WHERE player_id = $1',
          [playerId],
        );

        if (rankRows.length > 0) {
          const r = rankRows[0];
          setStatus({
            tier: r.tier,
            lp: r.lp,
            recentWinRate: r.recent_win_rate,
            rank: r.rank_position,
            practiceChampionId: r.practice_champion_id,
          });
        } else {
          setStatus(null);
        }

        // 일간 기록 조회 (최근 10일)
        const logRows = await db.select<{
          id: number;
          game_date: string;
          games_played: number;
          wins: number;
          losses: number;
          lp_change: number;
          tier_changed: number;
          new_tier: string | null;
          practice_champion_id: string | null;
          proficiency_gain: number;
        }[]>(
          `SELECT * FROM solo_rank_daily_log
           WHERE player_id = $1
           ORDER BY game_date DESC LIMIT 10`,
          [playerId],
        );
        setDailyLogs(
          logRows.map((r) => ({
            id: r.id,
            gameDate: r.game_date,
            gamesPlayed: r.games_played,
            wins: r.wins,
            losses: r.losses,
            lpChange: r.lp_change,
            tierChanged: r.tier_changed === 1,
            newTier: r.new_tier,
            practiceChampionId: r.practice_champion_id,
            proficiencyGain: r.proficiency_gain ?? 0,
          })),
        );

        // 챔피언 숙련도 조회
        const champRows = await db.select<{
          champion_id: string;
          proficiency: number;
          games_played: number;
        }[]>(
          `SELECT champion_id, proficiency, games_played
           FROM champion_proficiency
           WHERE player_id = $1
           ORDER BY proficiency DESC LIMIT 12`,
          [playerId],
        );

        // 챔피언 이름 조회
        const champData: ChampionPractice[] = [];
        for (const c of champRows) {
          const nameRows = await db.select<{ name: string }[]>(
            'SELECT name FROM champions WHERE id = $1',
            [c.champion_id],
          );
          champData.push({
            championId: c.champion_id,
            name: nameRows.length > 0 ? nameRows[0].name : c.champion_id,
            proficiency: c.proficiency,
            gamesPlayed: c.games_played,
            selected: rankRows.length > 0 && rankRows[0].practice_champion_id === c.champion_id,
          });
        }
        setChampions(champData);

        // 리더보드 조회 (상위 20명)
        const lbRows = await db.select<{
          player_id: string;
          player_name: string;
          team_id: string | null;
          tier: string;
          lp: number;
          rank_position: number;
        }[]>(
          `SELECT sr.player_id, p.name AS player_name, p.team_id,
                  sr.tier, sr.lp, sr.rank_position
           FROM player_solo_rank sr
           JOIN players p ON p.id = sr.player_id
           ORDER BY sr.lp DESC LIMIT 20`,
        );
        setLeaderboard(
          lbRows.map((r) => ({
            playerId: r.player_id,
            playerName: r.player_name,
            teamId: r.team_id,
            tier: r.tier,
            lp: r.lp,
            rank: r.rank_position,
          })),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'DB 조회 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    loadSoloRankData();
  }, [save]);

  const handleToggleChampion = useCallback((championId: string) => {
    setChampions((prev) =>
      prev.map((c) => (c.championId === championId ? { ...c, selected: !c.selected } : c)),
    );
  }, []);

  if (loading) {
    return <div className="fm-text-secondary fm-text-md">솔로랭크 정보를 불러오는 중...</div>;
  }

  if (error) {
    return (
      <div className="fm-alert fm-alert--danger">
        <span className="fm-alert__icon">!</span>
        <span className="fm-alert__text">{error}</span>
      </div>
    );
  }

  if (!status) {
    return (
      <div>
        <div className="fm-page-header">
          <h1 className="fm-page-title">솔로랭크</h1>
        </div>
        <p className="fm-text-muted fm-text-md">솔로랭크 데이터가 없습니다.</p>
      </div>
    );
  }

  const tierLabel = TIER_LABELS[status.tier] ?? status.tier;
  const tierColor = TIER_COLORS[status.tier] ?? '#e0e0e0';
  const winRate = (status.recentWinRate * 100).toFixed(1);

  // LP 추이 데이터 (일간 기록에서 역순으로)
  const lpHistory = [...dailyLogs].reverse();
  const lpValues = lpHistory.map((d) => d.lpChange);
  const cumulativeLp: number[] = [];
  let baseLp = status.lp;
  // 역산: 현재 LP에서 역으로 빼기
  for (let i = lpHistory.length - 1; i >= 0; i--) {
    baseLp -= lpHistory[i].lpChange;
  }
  let runningLp = baseLp;
  for (const d of lpHistory) {
    runningLp += d.lpChange;
    cumulativeLp.push(runningLp);
  }

  const lpMin = cumulativeLp.length > 0 ? Math.min(...cumulativeLp) : 0;
  const lpMax = cumulativeLp.length > 0 ? Math.max(...cumulativeLp) : 1;
  const lpRange = lpMax - lpMin || 1;

  // 일간 로그에서 총 승/패 계산
  const totalWins = dailyLogs.reduce((s, d) => s + d.wins, 0);
  const totalLosses = dailyLogs.reduce((s, d) => s + d.losses, 0);

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">솔로랭크</h1>
      </div>

      {/* 랭크 상태 카드 */}
      <div className="fm-panel">
        <div className="fm-panel__body">
          <div className="fm-flex fm-items-center fm-gap-lg">
            {/* 티어 디스플레이 */}
            <div className="fm-flex-col fm-items-center fm-flex-shrink-0" style={{ minWidth: '140px' }}>
              <div
                className="fm-flex fm-items-center fm-justify-center fm-font-bold"
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '50%',
                  border: `4px solid ${tierColor}`,
                  color: tierColor,
                  fontSize: '28px',
                }}
              >
                {status.rank}
              </div>
              <p className="fm-text-xl fm-font-bold fm-mt-sm" style={{ color: tierColor }}>
                {tierLabel}
              </p>
              <p className="fm-text-md fm-text-muted">{status.lp} LP</p>
            </div>

            {/* 통계 그리드 */}
            <div className="fm-flex-1 fm-grid fm-grid--4">
              <div className="fm-card fm-text-center">
                <div className="fm-stat">
                  <span className="fm-stat__label">최근 승률</span>
                  <span className="fm-stat__value">{winRate}%</span>
                </div>
                <span className="fm-text-xs fm-text-muted">{totalWins}승 {totalLosses}패</span>
              </div>
              <div className="fm-card fm-text-center">
                <div className="fm-stat">
                  <span className="fm-stat__label">서버 랭킹</span>
                  <span className="fm-stat__value" style={{ color: tierColor }}>#{status.rank}</span>
                </div>
              </div>
              <div className="fm-card fm-text-center">
                <div className="fm-stat">
                  <span className="fm-stat__label">최근 LP 변동</span>
                  {lpValues.length > 0 ? (
                    <span className={`fm-stat__value ${lpValues[lpValues.length - 1] >= 0 ? 'fm-text-success' : 'fm-text-danger'}`}>
                      {lpValues[lpValues.length - 1] >= 0 ? '+' : ''}{lpValues[lpValues.length - 1]}
                    </span>
                  ) : (
                    <span className="fm-stat__value fm-text-muted">-</span>
                  )}
                </div>
              </div>
              <div className="fm-card fm-text-center">
                <div className="fm-stat">
                  <span className="fm-stat__label">총 게임 (최근)</span>
                  <span className="fm-stat__value">{totalWins + totalLosses}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LP 추이 */}
      {cumulativeLp.length > 0 && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">LP 추이 (최근 기록)</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-items-center fm-gap-xs" style={{ height: '160px', alignItems: 'flex-end' }}>
              {cumulativeLp.map((lp, i) => {
                const height = ((lp - lpMin) / lpRange) * 100;
                const isUp = i > 0 && lp >= cumulativeLp[i - 1];
                return (
                  <div key={lpHistory[i].gameDate} className="fm-flex-1 fm-flex-col fm-items-center fm-gap-xs">
                    <span className="fm-text-xs fm-text-muted">{lp}</span>
                    <div
                      style={{
                        width: '100%',
                        height: `${Math.max(height, 8)}%`,
                        borderRadius: '3px 3px 0 0',
                        background: isUp || i === 0 ? 'var(--success)' : 'var(--danger)',
                        transition: 'height 0.3s ease',
                      }}
                      title={`${lpHistory[i].gameDate}: ${lp} LP`}
                    />
                    <span className="fm-text-xs fm-text-muted">{lpHistory[i].gameDate.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 챔피언 연습 선택 */}
      {champions.length > 0 && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">챔피언 연습 선택</span>
          </div>
          <div className="fm-panel__body">
            <p className="fm-text-md fm-text-secondary fm-mb-md">연습할 챔피언을 선택하면 솔로랭크에서 해당 챔피언을 집중적으로 플레이합니다.</p>
            <div className="fm-grid fm-grid--3">
              {champions.map((champ) => (
                <div
                  key={champ.championId}
                  className={`fm-card fm-card--clickable ${champ.selected ? 'fm-card--highlight' : ''}`}
                  onClick={() => handleToggleChampion(champ.championId)}
                  role="button"
                  aria-pressed={champ.selected}
                  aria-label={`${champ.name} 연습 ${champ.selected ? '해제' : '선택'}`}
                >
                  <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
                    <span className="fm-text-lg fm-font-medium fm-text-primary">{champ.name}</span>
                    {champ.selected && <span className="fm-badge fm-badge--info">연습 중</span>}
                  </div>
                  <div className="fm-bar fm-mb-sm">
                    <span className="fm-text-xs fm-text-muted" style={{ minWidth: '36px' }}>숙련도</span>
                    <div className="fm-bar__track">
                      <div
                        className={`fm-bar__fill ${getProficiencyBarClass(champ.proficiency)}`}
                        style={{ width: `${champ.proficiency}%` }}
                      />
                    </div>
                    <span className="fm-bar__value">{champ.proficiency}</span>
                  </div>
                  <span className="fm-text-xs fm-text-muted">{champ.gamesPlayed}게임</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 리더보드 */}
      {leaderboard.length > 0 && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">솔로 랭크 리더보드</span>
          </div>
          <div className="fm-panel__body--flush">
            <table className="fm-table fm-table--striped">
              <thead>
                <tr>
                  <th>순위</th>
                  <th>선수</th>
                  <th className="text-center">티어</th>
                  <th className="text-center">LP</th>
                  <th className="text-right">서버 순위</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, i) => {
                  const entryTierColor = TIER_COLORS[entry.tier] ?? '#e0e0e0';
                  const isMe = entry.playerId === save?.userPlayerId;
                  return (
                    <tr key={entry.playerId} className={isMe ? 'fm-table__row--selected' : ''}>
                      <td className={i < 3 ? 'fm-cell--gold' : 'fm-cell--name'}>
                        {i + 1}
                      </td>
                      <td className={isMe ? 'fm-cell--accent' : 'fm-cell--name'}>
                        {entry.playerName}
                      </td>
                      <td className="text-center" style={{ color: entryTierColor, fontWeight: 600 }}>
                        {TIER_LABELS[entry.tier] ?? entry.tier}
                      </td>
                      <td className="text-center">{entry.lp}</td>
                      <td className="text-right fm-text-muted">#{entry.rank}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 최근 솔랭 기록 */}
      {dailyLogs.length > 0 && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">최근 솔랭 기록</span>
          </div>
          <div className="fm-panel__body--flush">
            <table className="fm-table fm-table--striped">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th className="text-center">플레이</th>
                  <th className="text-center">승</th>
                  <th className="text-center">패</th>
                  <th className="text-center">LP 변동</th>
                  <th className="text-right">비고</th>
                </tr>
              </thead>
              <tbody>
                {dailyLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="fm-cell--name">{log.gameDate}</td>
                    <td className="text-center">{log.gamesPlayed}</td>
                    <td className="text-center fm-cell--green">{log.wins}</td>
                    <td className="text-center fm-cell--red">{log.losses}</td>
                    <td className={`text-center ${log.lpChange >= 0 ? 'fm-cell--green' : 'fm-cell--red'}`}>
                      {log.lpChange >= 0 ? '+' : ''}{log.lpChange}
                    </td>
                    <td className="text-right fm-text-muted">
                      {log.tierChanged && log.newTier ? `${TIER_LABELS[log.newTier] ?? log.newTier} 승급` : ''}
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
