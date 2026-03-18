/**
 * 선수 은퇴 시스템 엔진
 * - 시즌 종료 시 은퇴 후보 체크
 * - 은퇴 처리 + 명예의 전당 등록
 * - 코치 전향 시 스태프 테이블 등록
 */

import { getDatabase } from '../../db/database';
import { getAllPlayers } from '../../db/queries';
import type { Player } from '../../types/player';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

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

// ─────────────────────────────────────────
// 은퇴 확률 계산
// ─────────────────────────────────────────

/** 선수의 OVR 계산 (간이) */
function calculateOVR(player: Player): number {
  const s = player.stats;
  return (
    s.mechanical * 0.20 +
    s.gameSense * 0.20 +
    s.teamwork * 0.15 +
    s.consistency * 0.15 +
    s.laning * 0.15 +
    s.aggression * 0.15
  );
}

/**
 * 시즌 종료 시 은퇴 후보 체크
 * @returns 은퇴 처리된 선수 목록
 */
export async function checkRetirementCandidates(
  seasonId: number,
  date: string,
): Promise<RetirementCandidate[]> {
  const allPlayers = await getAllPlayers();
  const candidates: RetirementCandidate[] = [];

  for (const player of allPlayers) {
    let probability = 0;
    let reason = '';

    // 나이 기반 확률
    if (player.age >= 32) {
      probability = Math.max(probability, 0.80);
      reason = '고령 (32세+)';
    } else if (player.age >= 30) {
      probability = Math.max(probability, 0.40);
      reason = '나이 (30세+)';
    } else if (player.age >= 28) {
      probability = Math.max(probability, 0.10);
      reason = '나이 (28세+)';
    }

    // OVR 50 이하 + 25세+
    const ovr = calculateOVR(player);
    if (ovr <= 50 && player.age >= 25) {
      const ovrProb = 0.30;
      if (ovrProb > probability) {
        probability = ovrProb;
        reason = '낮은 실력 + 나이 (OVR 50이하, 25세+)';
      }
    }

    if (probability <= 0) continue;

    // 확률 판정
    if (Math.random() < probability) {
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

  // 은퇴 처리
  for (const candidate of candidates) {
    // postCareer 랜덤 결정
    const postCareer = pickPostCareer();
    await processRetirement(candidate.playerId, date, postCareer);
  }

  return candidates;
}

/**
 * 은퇴 처리
 */
export async function processRetirement(
  playerId: string,
  date: string,
  postCareer: PostCareer,
): Promise<void> {
  const db = await getDatabase();

  // 선수 정보 조회
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

  // 커리어 시즌 수 계산 (대략적: 나이 - 17)
  const careerSeasons = Math.max(1, player.age - 17);

  // players 테이블 업데이트
  await db.execute(
    `UPDATE players
     SET is_retired = 1, retired_date = $1, post_career = $2, team_id = NULL
     WHERE id = $3`,
    [date, postCareer, playerId],
  );

  // retirement_hall에 기록
  await db.execute(
    `INSERT INTO retirement_hall (player_id, player_name, team_id, position, retired_date, career_seasons, post_career)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [playerId, player.name, player.team_id, player.position, date, careerSeasons, postCareer],
  );

  // 코치 전향: staff 테이블에 FA 스태프로 추가
  if (postCareer === 'coach') {
    const ability = Math.min(100, Math.max(30, Math.round(player.game_sense * 0.8)));
    await db.execute(
      `INSERT INTO staff (team_id, name, role, ability, specialty, salary, morale, contract_end_season, hired_date, is_free_agent)
       VALUES (NULL, $1, 'coach', $2, 'mentoring', $3, 70, 999, $4, 1)`,
      [`${player.name} (전 선수)`, ability, Math.round(ability * 15), date],
    );
  }

  // 분석관 전향
  if (postCareer === 'analyst') {
    const ability = Math.min(100, Math.max(30, Math.round(player.game_sense * 0.7)));
    await db.execute(
      `INSERT INTO staff (team_id, name, role, ability, specialty, salary, morale, contract_end_season, hired_date, is_free_agent)
       VALUES (NULL, $1, 'analyst', $2, 'draft', $3, 70, 999, $4, 1)`,
      [`${player.name} (전 선수)`, ability, Math.round(ability * 12), date],
    );
  }
}

/**
 * 은퇴 명예의 전당 조회
 */
export async function getRetirementHall(): Promise<RetirementHallEntry[]> {
  const db = await getDatabase();
  const rows = await db.select<RetirementHallRow[]>(
    'SELECT * FROM retirement_hall ORDER BY retired_date DESC',
  );
  return rows.map(mapRowToHallEntry);
}

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

/** 은퇴 후 진로 랜덤 결정 */
function pickPostCareer(): PostCareer {
  const roll = Math.random();
  if (roll < 0.25) return 'coach';
  if (roll < 0.40) return 'analyst';
  if (roll < 0.60) return 'streamer';
  return 'none';
}
