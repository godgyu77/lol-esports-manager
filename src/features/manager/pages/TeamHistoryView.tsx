/**
 * 팀 히스토리 뷰
 * - 팀 요약: 팀명, 리전, 총 시즌, 트로피 수
 * - 시즌별 기록 테이블: 시즌/전적/순위/플레이오프/트로피
 * - 트로피 캐비닛: 아이콘 그리드
 * - 레전드 선수: 통산 경기수/킬 기준 상위 10인
 */

import { useEffect, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getDatabase } from '../../../db/database';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

interface SeasonHistoryRecord {
  seasonId: number;
  finalStanding: number | null;
  wins: number;
  losses: number;
  playoffResult: string | null;
  champion: boolean;
}

interface AwardRecord {
  seasonId: number;
  awardType: string;
  playerId: string | null;
  teamId: string | null;
  value: number | null;
}

interface LegendPlayer {
  name: string;
  position: string;
  totalGames: number;
  totalKills: number;
}

// DB Row 타입
interface SeasonRecordRow {
  season_id: number;
  final_standing: number | null;
  wins: number;
  losses: number;
  playoff_result: string | null;
  champion: number;
}

interface TeamAwardRow {
  season_id: number;
  award_type: string;
  player_id: string | null;
  team_id: string | null;
  value: number | null;
}

interface LegendRow {
  name: string;
  position: string;
  total_games: number;
  total_kills: number;
}

// ─────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────

export function TeamHistoryView() {
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);
  const season = useGameStore((s) => s.season);

  const [history, setHistory] = useState<SeasonHistoryRecord[]>([]);
  const [awards, setAwards] = useState<AwardRecord[]>([]);
  const [legends, setLegends] = useState<LegendPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userTeam = teams.find((t) => t.id === save?.userTeamId);

  useEffect(() => {
    if (!userTeam || !season) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const db = await getDatabase();

        // 시즌별 기록
        const historyRows = await db.select<SeasonRecordRow[]>(
          `SELECT season_id, final_standing, wins, losses, playoff_result, champion
           FROM season_records
           WHERE team_id = $1
           ORDER BY season_id DESC`,
          [userTeam.id],
        ).catch((): SeasonRecordRow[] => []);

        // 수상 기록
        const awardRows = await db.select<TeamAwardRow[]>(
          `SELECT season_id, award_type, player_id, team_id, value
           FROM awards
           WHERE team_id = $1
           ORDER BY season_id DESC`,
          [userTeam.id],
        ).catch((): TeamAwardRow[] => []);

        // 레전드 선수 (통산 경기 수 기준 상위 10인)
        const legendRows = await db.select<LegendRow[]>(
          `SELECT p.name, p.position,
                  COALESCE(SUM(CASE WHEN gs.player_id IS NOT NULL THEN 1 ELSE 0 END), 0) as total_games,
                  COALESCE(SUM(gs.kills), 0) as total_kills
           FROM players p
           LEFT JOIN player_game_stats gs ON gs.player_id = p.id
           WHERE p.team_id = $1
           GROUP BY p.id, p.name, p.position
           ORDER BY total_games DESC, total_kills DESC
           LIMIT 10`,
          [userTeam.id],
        ).catch((): LegendRow[] => []);

        if (!cancelled) {
          setHistory(historyRows.map((r) => ({
            seasonId: r.season_id,
            finalStanding: r.final_standing,
            wins: r.wins,
            losses: r.losses,
            playoffResult: r.playoff_result,
            champion: r.champion === 1,
          })));

          setAwards(awardRows.map((r) => ({
            seasonId: r.season_id,
            awardType: r.award_type,
            playerId: r.player_id,
            teamId: r.team_id,
            value: r.value,
          })));

          setLegends(legendRows.map((r) => ({
            name: r.name,
            position: r.position,
            totalGames: r.total_games,
            totalKills: r.total_kills,
          })));
        }
      } catch (err) {
        console.warn('[TeamHistoryView] load failed:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [userTeam, season]);

  if (!userTeam || !season) {
    return <p className="fm-text-muted fm-p-md">데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p className="fm-text-muted fm-p-md">팀 히스토리를 불러오는 중...</p>;
  }

  const totalSeasons = history.length;
  const totalTrophies = history.filter((h) => h.champion).length;
  const totalWins = history.reduce((s, h) => s + h.wins, 0);
  const totalLosses = history.reduce((s, h) => s + h.losses, 0);
  const totalGames = totalWins + totalLosses;
  const winRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '0.0';

  const positionLabel: Record<string, string> = {
    top: '탑',
    jungle: '정글',
    mid: '미드',
    adc: '원딜',
    support: '서포터',
  };

  const awardTypeLabel: Record<string, string> = {
    mvp: 'MVP',
    rookie: '신인왕',
    all_pro_top: 'All-Pro 탑',
    all_pro_jungle: 'All-Pro 정글',
    all_pro_mid: 'All-Pro 미드',
    all_pro_adc: 'All-Pro 원딜',
    all_pro_support: 'All-Pro 서포터',
    champion: '우승',
  };

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">팀 히스토리</h1>
      </div>

      {/* 팀 요약 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">{userTeam.name}</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            <div className="fm-card fm-text-center">
              <div className="fm-stat" style={{ alignItems: 'center' }}>
                <span className="fm-stat__label">리전</span>
                <span className="fm-stat__value">{userTeam.region}</span>
              </div>
            </div>
            <div className="fm-card fm-text-center">
              <div className="fm-stat" style={{ alignItems: 'center' }}>
                <span className="fm-stat__label">총 시즌</span>
                <span className="fm-stat__value">{totalSeasons}</span>
              </div>
            </div>
            <div className="fm-card fm-text-center">
              <div className="fm-stat" style={{ alignItems: 'center' }}>
                <span className="fm-stat__label">트로피</span>
                <span className="fm-stat__value fm-stat__value--accent">{totalTrophies}</span>
              </div>
            </div>
            <div className="fm-card fm-text-center">
              <div className="fm-stat" style={{ alignItems: 'center' }}>
                <span className="fm-stat__label">통산 전적</span>
                <span className="fm-stat__value--sm fm-font-bold fm-text-primary">{totalWins}승 {totalLosses}패</span>
              </div>
            </div>
            <div className="fm-card fm-text-center">
              <div className="fm-stat" style={{ alignItems: 'center' }}>
                <span className="fm-stat__label">통산 승률</span>
                <span className="fm-stat__value--sm fm-font-bold fm-text-primary">{winRate}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 트로피 캐비닛 */}
      {totalTrophies > 0 && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">트로피 캐비닛</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-flex-wrap fm-gap-md">
              {history.filter((h) => h.champion).map((h) => (
                <div key={h.seasonId} className="fm-card fm-card--highlight fm-text-center" style={{ padding: '16px 20px' }}>
                  <span style={{ fontSize: '32px', display: 'block' }}>{'\uD83C\uDFC6'}</span>
                  <span className="fm-text-xs fm-font-semibold fm-text-accent fm-mt-sm" style={{ display: 'block' }}>시즌 {h.seasonId}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 시즌별 기록 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">시즌별 기록</span>
        </div>
        <div className="fm-panel__body--flush">
          {history.length === 0 ? (
            <p className="fm-text-sm fm-text-muted fm-text-center fm-p-md">아직 기록된 시즌 성적이 없습니다.</p>
          ) : (
            <div className="fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th>시즌</th>
                    <th className="text-center">순위</th>
                    <th className="text-center">승</th>
                    <th className="text-center">패</th>
                    <th className="text-center">승률</th>
                    <th>플레이오프</th>
                    <th className="text-center">우승</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => {
                    const total = record.wins + record.losses;
                    const wr = total > 0 ? ((record.wins / total) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={record.seasonId}>
                        <td className="fm-cell--name">시즌 {record.seasonId}</td>
                        <td className="text-center">
                          {record.finalStanding != null ? `${record.finalStanding}위` : '-'}
                        </td>
                        <td className="text-center">{record.wins}</td>
                        <td className="text-center">{record.losses}</td>
                        <td className="text-center">{wr}%</td>
                        <td>{record.playoffResult ?? '-'}</td>
                        <td className={`text-center ${record.champion ? 'fm-cell--gold' : 'fm-text-muted'}`}>
                          {record.champion ? '\uD83C\uDFC6' : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 수상 기록 */}
      {awards.length > 0 && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">수상 기록</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-flex-wrap fm-gap-sm">
              {awards.map((award, idx) => (
                <div key={`${award.seasonId}-${award.awardType}-${idx}`} className="fm-flex fm-items-center fm-gap-sm fm-badge fm-badge--accent">
                  <span className="fm-font-semibold">
                    {awardTypeLabel[award.awardType] ?? award.awardType}
                  </span>
                  <span className="fm-text-xs" style={{ opacity: 0.7 }}>시즌 {award.seasonId}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 레전드 선수 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">레전드 선수 (통산 기록)</span>
        </div>
        <div className="fm-panel__body--flush">
          {legends.length === 0 ? (
            <p className="fm-text-sm fm-text-muted fm-text-center fm-p-md">경기 기록이 아직 없습니다.</p>
          ) : (
            <div className="fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th className="text-center">#</th>
                    <th>선수</th>
                    <th>포지션</th>
                    <th className="text-center">경기</th>
                    <th className="text-center">킬</th>
                  </tr>
                </thead>
                <tbody>
                  {legends.map((player, idx) => (
                    <tr key={`${player.name}-${idx}`}>
                      <td className={`text-center ${idx < 3 ? 'fm-cell--gold' : ''}`}>
                        {idx + 1}
                      </td>
                      <td className="fm-cell--name">
                        {player.name}
                      </td>
                      <td>
                        {positionLabel[player.position] ?? player.position}
                      </td>
                      <td className="text-center">{player.totalGames}</td>
                      <td className="text-center fm-cell--accent">
                        {player.totalKills}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
