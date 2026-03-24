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
  _seasonId: number,
  date: string,
): Promise<RetirementCandidate[]> {
  const allPlayers = await getAllPlayers();
  const db = await getDatabase();
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

    // 우승 경력 보정: 챔피언십 보유 → 은퇴 확률 -10%
    const trophyRows = await db.select<{ cnt: number }[]>(
      `SELECT COUNT(*) as cnt FROM player_awards WHERE player_id = $1 AND award_type IN ('champion', 'mvp', 'worlds_champion')`,
      [player.id],
    );
    const hasTrophies = (trophyRows[0]?.cnt ?? 0) > 0;
    if (hasTrophies) {
      probability *= 0.90; // 우승 경력 → 10% 덜 은퇴
    } else if (player.age >= 28) {
      probability *= 1.15; // 무관 + 고령 → 15% 더 은퇴
    }

    // 최근 폼 하락 보정: formHistory 활용 (하락 추세 → +20%)
    if (player.formHistory.length >= 6) {
      const recentHalf = player.formHistory.slice(-Math.floor(player.formHistory.length / 2));
      const olderHalf = player.formHistory.slice(0, Math.floor(player.formHistory.length / 2));
      const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
      const olderAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;
      if (recentAvg < olderAvg - 5) {
        probability *= 1.20; // 폼 하락 추세 → 20% 은퇴 확률 증가
        reason += ' + 폼 하락';
      }
    }

    // 확률 상한 제한
    probability = Math.min(probability, 0.95);

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
    // 선수 능력치 기반 postCareer 결정
    const player = allPlayers.find(p => p.id === candidate.playerId);
    const postCareer = player ? pickPostCareerByStats(player) : pickPostCareer();
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

  // 커리어 하이라이트 생성
  let careerHighlights = '';
  try {
    const awardRows = await db.select<{ award_type: string; cnt: number }[]>(
      `SELECT award_type, COUNT(*) as cnt FROM awards WHERE player_id = $1 GROUP BY award_type`,
      [playerId],
    );
    const highlights: string[] = [];
    for (const a of awardRows) {
      const label = a.award_type === 'mvp' ? 'MVP' : a.award_type === 'all_pro' ? 'All-Pro' : a.award_type;
      highlights.push(`${label} ${a.cnt}회`);
    }
    const statsRows = await db.select<{ total_games: number; total_kills: number; total_deaths: number; total_assists: number }[]>(
      'SELECT total_games, total_kills, total_deaths, total_assists FROM player_career_stats WHERE player_id = $1',
      [playerId],
    );
    if (statsRows.length > 0) {
      const s = statsRows[0];
      highlights.push(`통산 ${s.total_games}경기`);
      if (s.total_deaths > 0) {
        highlights.push(`KDA ${((s.total_kills + s.total_assists) / s.total_deaths).toFixed(1)}`);
      }
    }
    careerHighlights = highlights.join(', ');
  } catch { /* 하이라이트 생성 실패 시 빈 문자열 */ }

  // retirement_hall에 기록
  await db.execute(
    `INSERT INTO retirement_hall (player_id, player_name, team_id, position, retired_date, career_seasons, career_highlights, post_career)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [playerId, player.name, player.team_id, player.position, date, careerSeasons, careerHighlights || null, postCareer],
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

/** 은퇴 후 진로 랜덤 결정 (폴백) */
function pickPostCareer(): PostCareer {
  const roll = Math.random();
  if (roll < 0.25) return 'coach';
  if (roll < 0.40) return 'analyst';
  if (roll < 0.60) return 'streamer';
  return 'none';
}

/**
 * 선수 능력치 기반 은퇴 후 진로 결정
 * - gameSense 높음 → analyst (분석관)
 * - teamwork/리더십 높음 → coach (코치)
 * - popularity 높음 → streamer
 */
function pickPostCareerByStats(player: Player): PostCareer {
  const { gameSense, teamwork } = player.stats;
  const popularity = player.popularity ?? 0;

  // 점수 기반 가중 선택
  const coachScore = teamwork * 1.2 + gameSense * 0.5;
  const analystScore = gameSense * 1.3 + player.stats.consistency * 0.4;
  const streamerScore = popularity * 1.5 + player.stats.aggression * 0.3;

  const maxScore = Math.max(coachScore, analystScore, streamerScore);

  // 최고 점수 경로 + 약간의 랜덤성 (80% 최적 진로, 20% 랜덤)
  if (Math.random() < 0.2) return pickPostCareer();

  if (maxScore === coachScore) return 'coach';
  if (maxScore === analystScore) return 'analyst';
  if (maxScore === streamerScore) return 'streamer';
  return 'none';
}

// ─────────────────────────────────────────
// 커리어 요약
// ─────────────────────────────────────────

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

/**
 * 선수 커리어 요약 조회
 * - 통산 경기수, 트로피, 최고/현재 OVR, 은퇴 후 진로 포함
 */
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
  const p = playerRows[0];

  // 트로피 집계
  const trophyRows = await db.select<{ award_type: string; cnt: number }[]>(
    `SELECT award_type, COUNT(*) as cnt FROM player_awards WHERE player_id = $1 GROUP BY award_type`,
    [playerId],
  );

  const trophies = trophyRows.map(r => ({ awardType: r.award_type, count: r.cnt }));
  const totalTrophyCount = trophies.reduce((sum, t) => sum + t.count, 0);

  // 현재 OVR 계산
  const currentOVR = Math.round(
    p.mechanical * 0.20 +
    p.game_sense * 0.20 +
    p.teamwork * 0.15 +
    p.consistency * 0.15 +
    p.laning * 0.15 +
    p.aggression * 0.15,
  );

  // peak OVR: 현재 OVR + 나이 보정 (젊은 선수는 현재가 peak, 고령 선수는 추정)
  const agePastPeak = Math.max(0, p.age - 24);
  const peakOVR = Math.min(100, currentOVR + agePastPeak * 2);

  return {
    playerId: p.id,
    playerName: p.name,
    position: p.position,
    age: p.age,
    careerGames: p.career_games ?? 0,
    trophies,
    totalTrophyCount,
    peakOVR,
    currentOVR,
    postCareer: (p.post_career as PostCareer) ?? null,
    isRetired: Boolean(p.is_retired),
  };
}
