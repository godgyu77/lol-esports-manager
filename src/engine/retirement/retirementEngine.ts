/**
 * Retirement engine
 * - identifies retirement candidates near season end
 * - processes retirement and retirement hall entries
 * - offers simple post-career paths into staff/free-agent staff pools
 */

import { getDatabase } from '../../db/database';
import { getAllPlayers } from '../../db/queries';
import type { Player } from '../../types/player';
import { nextRandom } from '../../utils/random';
import {
  getInternationalExpectationSnapshot,
  getRelationshipInfluenceSnapshot,
} from '../manager/releaseDepthEngine';

export type PostCareer = 'coach' | 'analyst' | 'streamer' | 'none';

export interface RetirementCandidate {
  playerId: string;
  playerName: string;
  teamId: string | null;
  position: string;
  age: number;
  reason: string;
  probability: number;
}

export interface RetirementHallEntry {
  id: number;
  playerId: string;
  playerName: string;
  teamId: string | null;
  position: string;
  retiredDate: string;
  careerSeasons: number;
  careerHighlights: string | null;
  postCareer: string | null;
}

interface RetirementHallRow {
  id: number;
  player_id: string;
  player_name: string;
  team_id: string | null;
  position: string;
  retired_date: string;
  career_seasons: number;
  career_highlights: string | null;
  post_career: string | null;
}

function mapRowToHallEntry(row: RetirementHallRow): RetirementHallEntry {
  return {
    id: row.id,
    playerId: row.player_id,
    playerName: row.player_name,
    teamId: row.team_id,
    position: row.position,
    retiredDate: row.retired_date,
    careerSeasons: row.career_seasons,
    careerHighlights: row.career_highlights,
    postCareer: row.post_career,
  };
}

function calculateOVR(player: Player): number {
  const s = player.stats;
  return (
    s.mechanical * 0.2 +
    s.gameSense * 0.2 +
    s.teamwork * 0.15 +
    s.consistency * 0.15 +
    s.laning * 0.15 +
    s.aggression * 0.15
  );
}

export async function checkRetirementCandidates(
  seasonId: number,
  date: string,
  saveId?: number,
): Promise<RetirementCandidate[]> {
  const allPlayers = await getAllPlayers();
  const db = await getDatabase();
  const candidates: RetirementCandidate[] = [];

  for (const player of allPlayers) {
    let probability = 0;
    let reason = '';

    if (player.age >= 32) {
      probability = Math.max(probability, 0.8);
      reason = '고령 (32+)';
    } else if (player.age >= 30) {
      probability = Math.max(probability, 0.4);
      reason = '나이 (30+)';
    } else if (player.age >= 28) {
      probability = Math.max(probability, 0.1);
      reason = '나이 (28+)';
    }

    const ovr = calculateOVR(player);
    if (ovr <= 50 && player.age >= 25) {
      const ovrProb = 0.3;
      if (ovrProb > probability) {
        probability = ovrProb;
        reason = '기량 저하 + 나이 (OVR 50 이하, 25+)';
      }
    }

    if (probability <= 0) continue;

    const trophyRows = await db.select<{ cnt: number }[]>(
      `SELECT COUNT(*) as cnt
       FROM player_awards
       WHERE player_id = $1
         AND award_type IN ('champion', 'mvp', 'worlds_champion')`,
      [player.id],
    );
    const hasTrophies = (trophyRows[0]?.cnt ?? 0) > 0;
    if (hasTrophies) {
      probability *= 0.9;
    } else if (player.age >= 28) {
      probability *= 1.15;
    }

    if (player.teamId) {
      const [relationshipSnapshot, internationalSnapshot] = await Promise.all([
        getRelationshipInfluenceSnapshot(player.teamId, saveId).catch(() => null),
        getInternationalExpectationSnapshot(player.teamId, seasonId, null, saveId).catch(() => null),
      ]);

      const inStrongPair = relationshipSnapshot?.strongPairs.some((pair) => pair.names.includes(player.name)) ?? false;
      const inMentorLink = relationshipSnapshot?.mentorLinks.some((pair) => pair.names.includes(player.name)) ?? false;
      const inRiskPair = relationshipSnapshot?.riskPairs.some((pair) => pair.names.includes(player.name)) ?? false;

      if (inStrongPair) {
        probability *= 0.86;
        reason += ' + 강한 팀 결속';
      }
      if (inMentorLink) {
        probability *= 0.88;
        reason += ' + 멘토 연결';
      }
      if (inRiskPair) {
        probability *= 1.18;
        reason += ' + 라커룸 마찰';
      }

      if (hasTrophies && internationalSnapshot?.level === 'must_deliver') {
        probability *= 0.82;
        reason += ' + 국제전 레거시 도전';
      } else if (hasTrophies && internationalSnapshot?.level === 'contender') {
        probability *= 0.9;
        reason += ' + 국제전 기대';
      }
    }

    if (player.formHistory.length >= 6) {
      const recentHalf = player.formHistory.slice(-Math.floor(player.formHistory.length / 2));
      const olderHalf = player.formHistory.slice(0, Math.floor(player.formHistory.length / 2));
      const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
      const olderAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;
      if (recentAvg < olderAvg - 5) {
        probability *= 1.2;
        reason += ' + 폼 하락';
      }
    }

    probability = Math.min(probability, 0.95);
    probability = Math.max(probability, 0.01);

    if (nextRandom() < probability) {
      candidates.push({
        playerId: player.id,
        playerName: player.name,
        teamId: player.teamId,
        position: player.position,
        age: player.age,
        reason,
        probability,
      });
    }
  }

  for (const candidate of candidates) {
    const player = allPlayers.find((entry) => entry.id === candidate.playerId);
    const postCareer = player ? pickPostCareerByStats(player) : pickPostCareer();
    await processRetirement(candidate.playerId, date, postCareer);
  }

  return candidates;
}

export async function processRetirement(
  playerId: string,
  date: string,
  postCareer: PostCareer,
): Promise<void> {
  const db = await getDatabase();
  const playerRows = await db.select<{
    id: string;
    name: string;
    team_id: string | null;
    position: string;
    age: number;
    game_sense: number;
  }[]>(
    'SELECT id, name, team_id, position, age, game_sense FROM players WHERE id = $1',
    [playerId],
  );

  if (playerRows.length === 0) return;
  const player = playerRows[0];
  const careerSeasons = Math.max(1, player.age - 17);

  await db.execute(
    `UPDATE players
     SET is_retired = 1, retired_date = $1, post_career = $2, team_id = NULL
     WHERE id = $3`,
    [date, postCareer, playerId],
  );

  let careerHighlights = '';
  try {
    const awardRows = await db.select<{ award_type: string; cnt: number }[]>(
      `SELECT award_type, COUNT(*) as cnt
       FROM awards
       WHERE player_id = $1
       GROUP BY award_type`,
      [playerId],
    );
    const highlights: string[] = [];
    for (const award of awardRows) {
      const label =
        award.award_type === 'mvp'
          ? 'MVP'
          : award.award_type === 'all_pro'
            ? 'All-Pro'
            : award.award_type;
      highlights.push(`${label} ${award.cnt}회`);
    }
    const statsRows = await db.select<{
      total_games: number;
      total_kills: number;
      total_deaths: number;
      total_assists: number;
    }[]>(
      'SELECT total_games, total_kills, total_deaths, total_assists FROM player_career_stats WHERE player_id = $1',
      [playerId],
    );
    if (statsRows.length > 0) {
      const stats = statsRows[0];
      highlights.push(`통산 ${stats.total_games}경기`);
      if (stats.total_deaths > 0) {
        highlights.push(`KDA ${((stats.total_kills + stats.total_assists) / stats.total_deaths).toFixed(1)}`);
      }
    }
    careerHighlights = highlights.join(', ');
  } catch {
    careerHighlights = '';
  }

  await db.execute(
    `INSERT INTO retirement_hall (
      player_id, player_name, team_id, position, retired_date, career_seasons, career_highlights, post_career
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [playerId, player.name, player.team_id, player.position, date, careerSeasons, careerHighlights || null, postCareer],
  );

  if (postCareer === 'coach') {
    const ability = Math.min(100, Math.max(30, Math.round(player.game_sense * 0.8)));
    await db.execute(
      `INSERT INTO staff (team_id, name, role, ability, specialty, salary, morale, contract_end_season, hired_date, is_free_agent)
       VALUES (NULL, $1, 'coach', $2, 'mentoring', $3, 70, 999, $4, 1)`,
      [`${player.name} (은퇴선수)`, ability, Math.round(ability * 15), date],
    );
  }

  if (postCareer === 'analyst') {
    const ability = Math.min(100, Math.max(30, Math.round(player.game_sense * 0.7)));
    await db.execute(
      `INSERT INTO staff (team_id, name, role, ability, specialty, salary, morale, contract_end_season, hired_date, is_free_agent)
       VALUES (NULL, $1, 'analyst', $2, 'draft', $3, 70, 999, $4, 1)`,
      [`${player.name} (은퇴선수)`, ability, Math.round(ability * 12), date],
    );
  }
}

export async function getRetirementHall(): Promise<RetirementHallEntry[]> {
  const db = await getDatabase();
  const rows = await db.select<RetirementHallRow[]>(
    'SELECT * FROM retirement_hall ORDER BY retired_date DESC',
  );
  return rows.map(mapRowToHallEntry);
}

function pickPostCareer(): PostCareer {
  const roll = nextRandom();
  if (roll < 0.25) return 'coach';
  if (roll < 0.4) return 'analyst';
  if (roll < 0.6) return 'streamer';
  return 'none';
}

function pickPostCareerByStats(player: Player): PostCareer {
  const { gameSense, teamwork } = player.stats;
  const popularity = player.popularity ?? 0;

  const coachScore = teamwork * 1.2 + gameSense * 0.5;
  const analystScore = gameSense * 1.3 + player.stats.consistency * 0.4;
  const streamerScore = popularity * 1.5 + player.stats.aggression * 0.3;
  const maxScore = Math.max(coachScore, analystScore, streamerScore);

  if (nextRandom() < 0.2) return pickPostCareer();
  if (maxScore === coachScore) return 'coach';
  if (maxScore === analystScore) return 'analyst';
  if (maxScore === streamerScore) return 'streamer';
  return 'none';
}

export interface PlayerCareerSummary {
  playerId: string;
  playerName: string;
  position: string;
  age: number;
  careerGames: number;
  trophies: { awardType: string; count: number }[];
  totalTrophyCount: number;
  peakOVR: number;
  currentOVR: number;
  postCareer: PostCareer | null;
  isRetired: boolean;
}

export async function getPlayerCareerSummary(
  playerId: string,
): Promise<PlayerCareerSummary | null> {
  const db = await getDatabase();

  const playerRows = await db.select<{
    id: string;
    name: string;
    position: string;
    age: number;
    career_games: number;
    mechanical: number;
    game_sense: number;
    teamwork: number;
    consistency: number;
    laning: number;
    aggression: number;
    is_retired: number;
    post_career: string | null;
  }[]>(
    `SELECT id, name, position, age, career_games,
            mechanical, game_sense, teamwork, consistency, laning, aggression,
            is_retired, post_career
     FROM players WHERE id = $1`,
    [playerId],
  );

  if (playerRows.length === 0) return null;
  const player = playerRows[0];

  const trophyRows = await db.select<{ award_type: string; cnt: number }[]>(
    `SELECT award_type, COUNT(*) as cnt
     FROM player_awards
     WHERE player_id = $1
     GROUP BY award_type`,
    [playerId],
  );

  const trophies = trophyRows.map((row) => ({ awardType: row.award_type, count: row.cnt }));
  const totalTrophyCount = trophies.reduce((sum, trophy) => sum + trophy.count, 0);

  const currentOVR = Math.round(
    player.mechanical * 0.2 +
    player.game_sense * 0.2 +
    player.teamwork * 0.15 +
    player.consistency * 0.15 +
    player.laning * 0.15 +
    player.aggression * 0.15,
  );
  const agePastPeak = Math.max(0, player.age - 24);
  const peakOVR = Math.min(100, currentOVR + agePastPeak * 2);

  return {
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    age: player.age,
    careerGames: player.career_games ?? 0,
    trophies,
    totalTrophyCount,
    peakOVR,
    currentOVR,
    postCareer: (player.post_career as PostCareer) ?? null,
    isRetired: Boolean(player.is_retired),
  };
}
