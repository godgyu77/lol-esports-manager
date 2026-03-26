/**
 * 솔로랭크 뷰
 * - 탭1 "우리 팀": 팀 선수별 솔로랭크 현황 (티어, LP, 승률, 순위)
 * - 탭2 "리더보드": 전체 프로선수 솔로랭크 순위표
 */

import { useEffect, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getDatabase } from '../../../db/database';
import type { PlayerSoloRank, SoloRankTier } from '../../../types/soloRank';

type TabType = 'team' | 'leaderboard';

interface PlayerRankInfo extends PlayerSoloRank {
  playerName: string;
  teamId: string | null;
  teamName?: string;
}

interface SoloRankRow {
  player_id: string;
  tier: SoloRankTier;
  lp: number;
  recent_win_rate: number;
  practice_champion_id: string | null;
  games_played_today: number;
  rank_position: number;
  player_name: string;
  team_id: string | null;
}

const TIER_LABELS: Record<SoloRankTier, string> = {
  challenger: '챌린저',
  grandmaster: '그랜드마스터',
  master: '마스터',
  diamond: '다이아몬드',
  emerald: '에메랄드',
  platinum: '플래티넘',
};

const TIER_COLORS: Record<SoloRankTier, string> = {
  challenger: '#f0c000',
  grandmaster: '#e74c3c',
  master: '#9b59b6',
  diamond: '#3498db',
  emerald: '#2ecc71',
  platinum: '#1abc9c',
};

export function SoloRankView() {
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);

  const [activeTab, setActiveTab] = useState<TabType>('team');
  const [teamRanks, setTeamRanks] = useState<PlayerRankInfo[]>([]);
  const [leaderboard, setLeaderboard] = useState<PlayerRankInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userTeamId = save?.userTeamId;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const db = await getDatabase();

      // 팀 선수 솔로랭크
      if (userTeamId) {
        try {
          const rows = await db.select<SoloRankRow[]>(
            `SELECT sr.*, p.name as player_name, p.team_id
             FROM player_solo_rank sr
             JOIN players p ON p.id = sr.player_id
             WHERE p.team_id = $1
             ORDER BY sr.lp DESC`,
            [userTeamId],
          );
          if (!cancelled) {
            setTeamRanks(rows.map(mapRankRow));
          }
        } catch {
          if (!cancelled) setTeamRanks([]);
        }
      }

      // 리더보드
      try {
        const lbRows = await db.select<SoloRankRow[]>(
          `SELECT sr.*, p.name as player_name, p.team_id
           FROM player_solo_rank sr
           JOIN players p ON p.id = sr.player_id
           ORDER BY sr.lp DESC LIMIT 50`,
        );
        if (!cancelled) {
          setLeaderboard(lbRows.map(mapRankRow));
        }
      } catch {
        if (!cancelled) setLeaderboard([]);
      }

      if (!cancelled) setIsLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [userTeamId]);

  const teamMap = new Map(teams.map(t => [t.id, t.name]));

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">솔로랭크</h1>
      </div>

      {/* 탭 */}
      <div className="fm-tabs">
        {(['team', 'leaderboard'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`fm-tab ${activeTab === tab ? 'fm-tab--active' : ''}`}
          >
            {tab === 'team' ? '우리 팀' : '리더보드'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="fm-text-center fm-text-muted fm-p-lg">로딩 중...</div>
      ) : activeTab === 'team' ? (
        <TeamSoloRankTable ranks={teamRanks} />
      ) : (
        <LeaderboardTable ranks={leaderboard} teamMap={teamMap} />
      )}
    </div>
  );
}

function TeamSoloRankTable({ ranks }: { ranks: PlayerRankInfo[] }) {
  if (ranks.length === 0) {
    return (
      <div className="fm-panel">
        <div className="fm-panel__body fm-text-center fm-p-lg">
          <span className="fm-text-muted fm-text-sm">솔로랭크 데이터가 없습니다.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fm-panel">
      <div className="fm-panel__body--flush">
        <div className="fm-table-wrap">
          <table className="fm-table fm-table--striped">
            <thead>
              <tr>
                <th>선수</th>
                <th className="text-center">티어</th>
                <th className="text-center">LP</th>
                <th className="text-center">승률</th>
                <th className="text-center">순위</th>
                <th className="text-center">연습 챔피언</th>
              </tr>
            </thead>
            <tbody>
              {ranks.map((r) => {
                const wrClass = r.recentWinRate >= 0.55 ? 'fm-cell--green' : r.recentWinRate <= 0.45 ? 'fm-cell--red' : '';
                return (
                  <tr key={r.playerId}>
                    <td className="fm-cell--name">{r.playerName}</td>
                    <td className="text-center">
                      <span
                        className="fm-badge"
                        style={{ color: TIER_COLORS[r.tier], borderColor: TIER_COLORS[r.tier], border: '1px solid', background: 'transparent' }}
                      >
                        {TIER_LABELS[r.tier]}
                      </span>
                    </td>
                    <td className="text-center fm-text-mono fm-cell--name">{r.lp} LP</td>
                    <td className={`text-center ${wrClass}`}>
                      {(r.recentWinRate * 100).toFixed(1)}%
                    </td>
                    <td className="text-center">#{r.rank}</td>
                    <td className="text-center fm-text-muted">{r.practiceChampionId ?? '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LeaderboardTable({ ranks, teamMap }: { ranks: PlayerRankInfo[]; teamMap: Map<string, string> }) {
  if (ranks.length === 0) {
    return (
      <div className="fm-panel">
        <div className="fm-panel__body fm-text-center fm-p-lg">
          <span className="fm-text-muted fm-text-sm">리더보드 데이터가 없습니다.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fm-panel">
      <div className="fm-panel__body--flush">
        <div className="fm-table-wrap">
          <table className="fm-table fm-table--striped">
            <thead>
              <tr>
                <th className="text-center" style={{ width: '48px' }}>#</th>
                <th>선수</th>
                <th>팀</th>
                <th className="text-center">티어</th>
                <th className="text-center">LP</th>
                <th className="text-center">승률</th>
              </tr>
            </thead>
            <tbody>
              {ranks.map((r, idx) => {
                const wrClass = r.recentWinRate >= 0.55 ? 'fm-cell--green' : r.recentWinRate <= 0.45 ? 'fm-cell--red' : '';
                return (
                  <tr key={r.playerId}>
                    <td className={`text-center fm-text-mono ${idx < 3 ? 'fm-cell--gold' : ''}`}>{idx + 1}</td>
                    <td className="fm-cell--name">{r.playerName}</td>
                    <td className="fm-text-muted">{(r.teamId && teamMap.get(r.teamId)) ?? '-'}</td>
                    <td className="text-center">
                      <span className="fm-font-bold fm-text-xs" style={{ color: TIER_COLORS[r.tier] }}>
                        {TIER_LABELS[r.tier]}
                      </span>
                    </td>
                    <td className="text-center fm-text-mono fm-cell--name">{r.lp}</td>
                    <td className={`text-center ${wrClass}`}>
                      {(r.recentWinRate * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function mapRankRow(r: SoloRankRow): PlayerRankInfo {
  return {
    playerId: r.player_id,
    playerName: r.player_name,
    teamId: r.team_id,
    tier: r.tier,
    lp: r.lp,
    recentWinRate: r.recent_win_rate,
    practiceChampionId: r.practice_champion_id ?? undefined,
    gamesPlayedToday: 0,
    rank: r.rank_position ?? 0,
  };
}
