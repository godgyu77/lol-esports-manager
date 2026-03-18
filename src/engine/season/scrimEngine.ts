/**
 * 스크림 결과 엔진
 * - 스크림 시뮬레이션 + 결과 저장
 */

import { getDatabase } from '../../db/database';
import { getPlayersByTeamId } from '../../db/queries';
import { buildLineup, evaluateMatchup } from '../match/teamRating';

export interface ScrimResult {
  opponentTeamId: string;
  opponentName: string;
  wins: number;
  losses: number;
  mvpPlayerName: string | null;
}

export async function simulateScrim(teamId: string, currentDate: string): Promise<ScrimResult | null> {
  const db = await getDatabase();

  // 같은 리전 팀 중 랜덤 상대 선택
  const teamRows = await db.select<{ id: string; region: string }[]>(
    'SELECT id, region FROM teams WHERE id = $1',
    [teamId],
  );
  if (teamRows.length === 0) return null;
  const region = teamRows[0].region;

  const opponents = await db.select<{ id: string; name: string }[]>(
    'SELECT id, name FROM teams WHERE region = $1 AND id != $2',
    [region, teamId],
  );
  if (opponents.length === 0) return null;

  const opponent = opponents[Math.floor(Math.random() * opponents.length)];

  // 간단 Bo3 시뮬
  const homePlayers = await getPlayersByTeamId(teamId);
  const awayPlayers = await getPlayersByTeamId(opponent.id);
  const homeLineup = buildLineup(homePlayers);
  const awayLineup = buildLineup(awayPlayers);

  if (!homeLineup || !awayLineup) return null;

  const matchup = evaluateMatchup(homeLineup, awayLineup);
  let wins = 0;
  let losses = 0;

  for (let i = 0; i < 3; i++) {
    const roll = Math.random();
    if (roll < matchup.homeWinRate) wins++;
    else losses++;
    if (wins >= 2 || losses >= 2) break;
  }

  // MVP = 가장 높은 OVR 선수
  let mvpName: string | null = null;
  let maxOvr = 0;
  for (const p of homePlayers) {
    const ovr = (p.stats.mechanical + p.stats.gameSense + p.stats.teamwork + p.stats.consistency + p.stats.laning + p.stats.aggression) / 6;
    if (ovr > maxOvr) { maxOvr = ovr; mvpName = p.name; }
  }

  await db.execute(
    `INSERT INTO scrim_results (team_id, opponent_team_id, scrim_date, wins, losses, mvp_player_id, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [teamId, opponent.id, currentDate, wins, losses, null, `vs ${opponent.name}`],
  );

  return {
    opponentTeamId: opponent.id,
    opponentName: opponent.name,
    wins,
    losses,
    mvpPlayerName: mvpName,
  };
}

export async function getRecentScrims(teamId: string, limit = 10): Promise<ScrimResult[]> {
  const db = await getDatabase();
  const rows = await db.select<any[]>(
    `SELECT sr.*, t.name as opponent_name FROM scrim_results sr
     JOIN teams t ON t.id = sr.opponent_team_id
     WHERE sr.team_id = $1 ORDER BY sr.scrim_date DESC LIMIT $2`,
    [teamId, limit],
  );
  return rows.map(r => ({
    opponentTeamId: r.opponent_team_id,
    opponentName: r.opponent_name,
    wins: r.wins,
    losses: r.losses,
    mvpPlayerName: null,
  }));
}
