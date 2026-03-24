/**
 * 아카데미 엔진
 * - 아카데미 선수 관리 (추가/훈련/승격)
 * - 신인 드래프트 풀 생성 및 드래프트
 * - 일간 진행 시 아카데미 자동 훈련
 */

import { getDatabase } from '../../db/database';
import type { Position } from '../../types/game';
import type { AcademyPlayer, RookieDraftEntry } from '../../types/academy';

// ─────────────────────────────────────────
// Row 매핑
// ─────────────────────────────────────────

interface AcademyPlayerRow {
  id: number;
  team_id: string;
  name: string;
  position: Position;
  age: number;
  potential: number;
  mechanical: number;
  game_sense: number;
  teamwork: number;
  consistency: number;
  laning: number;
  aggression: number;
  training_progress: number;
  promotion_ready: number;
  joined_date: string;
}

interface RookieDraftRow {
  id: number;
  season_id: number;
  name: string;
  position: Position;
  age: number;
  potential: number;
  estimated_ability: number;
  nationality: string;
  is_drafted: number;
  drafted_by_team_id: string | null;
}

function mapRowToAcademyPlayer(row: AcademyPlayerRow): AcademyPlayer {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    position: row.position,
    age: row.age,
    potential: row.potential,
    stats: {
      mechanical: row.mechanical,
      gameSense: row.game_sense,
      teamwork: row.teamwork,
      consistency: row.consistency,
      laning: row.laning,
      aggression: row.aggression,
    },
    trainingProgress: row.training_progress,
    promotionReady: row.promotion_ready === 1,
    joinedDate: row.joined_date,
  };
}

function mapRowToRookieEntry(row: RookieDraftRow): RookieDraftEntry {
  return {
    id: row.id,
    seasonId: row.season_id,
    name: row.name,
    position: row.position,
    age: row.age,
    potential: row.potential,
    estimatedAbility: row.estimated_ability,
    nationality: row.nationality,
    isDrafted: row.is_drafted === 1,
    draftedByTeamId: row.drafted_by_team_id,
  };
}

// ─────────────────────────────────────────
// 이름 생성 유틸
// ─────────────────────────────────────────

const LAST_NAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];

const FIRST_NAME_CHARS = [
  '민', '준', '서', '현', '지', '우', '도', '진', '승', '태',
  '혁', '성', '영', '재', '호', '동', '찬', '원', '석', '규',
];

function generateKoreanName(): string {
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const first1 = FIRST_NAME_CHARS[Math.floor(Math.random() * FIRST_NAME_CHARS.length)];
  const first2 = FIRST_NAME_CHARS[Math.floor(Math.random() * FIRST_NAME_CHARS.length)];
  return `${last}${first1}${first2}`;
}

const POSITIONS: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];

function randomPosition(): Position {
  return POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
}

// ─────────────────────────────────────────
// 아카데미 선수 CRUD
// ─────────────────────────────────────────

/** 아카데미 선수 조회 */
export async function getAcademyPlayers(teamId: string): Promise<AcademyPlayer[]> {
  const db = await getDatabase();
  const rows = await db.select<AcademyPlayerRow[]>(
    'SELECT * FROM academy_players WHERE team_id = $1 ORDER BY position, name',
    [teamId],
  );
  return rows.map(mapRowToAcademyPlayer);
}

/** 아카데미 선수 추가 (랜덤 생성) */
export async function addAcademyPlayer(
  teamId: string,
  name: string | null,
  position: Position | null,
  potential: number | null,
  joinedDate: string,
): Promise<AcademyPlayer> {
  const db = await getDatabase();

  const playerName = name ?? generateKoreanName();
  const playerPosition = position ?? randomPosition();
  const playerPotential = potential ?? (50 + Math.floor(Math.random() * 40)); // 50~89

  // 잠재력에 비례한 초기 스탯 (낮은 수치, 15~35 범위)
  const baseStat = () => 15 + Math.floor(Math.random() * 20);

  const mechanical = baseStat();
  const gameSense = baseStat();
  const teamwork = baseStat();
  const consistency = baseStat();
  const laning = baseStat();
  const aggression = baseStat();

  const result = await db.execute(
    `INSERT INTO academy_players (
      team_id, name, position, age, potential,
      mechanical, game_sense, teamwork, consistency, laning, aggression,
      training_progress, promotion_ready, joined_date
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      teamId, playerName, playerPosition,
      16 + Math.floor(Math.random() * 3), // 16~18세
      playerPotential,
      mechanical, gameSense, teamwork, consistency, laning, aggression,
      0, 0, joinedDate,
    ],
  );

  return {
    id: result.lastInsertId ?? 0,
    teamId,
    name: playerName,
    position: playerPosition,
    age: 16 + Math.floor(Math.random() * 3),
    potential: playerPotential,
    stats: { mechanical, gameSense, teamwork, consistency, laning, aggression },
    trainingProgress: 0,
    promotionReady: false,
    joinedDate,
  };
}

/** 아카데미 선수 훈련 (수동) — progress +10~20, 스탯 소폭 상승 */
export async function trainAcademyPlayer(playerId: number): Promise<AcademyPlayer | null> {
  const db = await getDatabase();

  const rows = await db.select<AcademyPlayerRow[]>(
    'SELECT * FROM academy_players WHERE id = $1',
    [playerId],
  );
  if (rows.length === 0) return null;

  const row = rows[0];
  const progressGain = 10 + Math.floor(Math.random() * 11); // 10~20
  const newProgress = Math.min(100, row.training_progress + progressGain);

  // 스탯 상승 (각 스탯 +1~3, 잠재력이 높을수록 상승폭 큼)
  const potentialBonus = row.potential / 100;
  const statGain = () => Math.floor((1 + Math.random() * 2) * potentialBonus);

  const newMech = Math.min(99, row.mechanical + statGain());
  const newGS = Math.min(99, row.game_sense + statGain());
  const newTW = Math.min(99, row.teamwork + statGain());
  const newCon = Math.min(99, row.consistency + statGain());
  const newLan = Math.min(99, row.laning + statGain());
  const newAgg = Math.min(99, row.aggression + statGain());

  // 승격 가능 판정: progress >= 80 && 평균 스탯 >= 40
  const avgStat = Math.round((newMech + newGS + newTW + newCon + newLan + newAgg) / 6);
  const promotionReady = newProgress >= 80 && avgStat >= 40 ? 1 : 0;

  await db.execute(
    `UPDATE academy_players
     SET training_progress = $1,
         mechanical = $2, game_sense = $3, teamwork = $4,
         consistency = $5, laning = $6, aggression = $7,
         promotion_ready = $8
     WHERE id = $9`,
    [newProgress, newMech, newGS, newTW, newCon, newLan, newAgg, promotionReady, playerId],
  );

  return {
    ...mapRowToAcademyPlayer(row),
    stats: {
      mechanical: newMech,
      gameSense: newGS,
      teamwork: newTW,
      consistency: newCon,
      laning: newLan,
      aggression: newAgg,
    },
    trainingProgress: newProgress,
    promotionReady: promotionReady === 1,
  };
}

/** 1군 승격 — academy_players → players 테이블로 이동 */
export async function promoteToMainRoster(
  academyPlayerId: number,
  teamId: string,
  seasonId: number,
): Promise<void> {
  const db = await getDatabase();

  const rows = await db.select<AcademyPlayerRow[]>(
    'SELECT * FROM academy_players WHERE id = $1',
    [academyPlayerId],
  );
  if (rows.length === 0) throw new Error('아카데미 선수를 찾을 수 없습니다.');

  const p = rows[0];

  // 고유 ID 생성 (academy_promoted_timestamp)
  const playerId = `academy_${p.name}_${Date.now()}`;

  await db.execute(
    `INSERT INTO players (
      id, name, team_id, position, age, nationality,
      mechanical, game_sense, teamwork, consistency, laning, aggression,
      mental, stamina, morale,
      salary, contract_end_season,
      potential, peak_age, popularity,
      division, is_user_player
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11, $12,
      $13, $14, $15,
      $16, $17,
      $18, $19, $20,
      $21, $22
    )`,
    [
      playerId,
      p.name,
      teamId,
      p.position,
      p.age,
      'KR',
      p.mechanical, p.game_sense, p.teamwork, p.consistency, p.laning, p.aggression,
      50, // mental
      70, // stamina
      60, // morale
      200, // salary (신인 최저)
      seasonId + 2, // 2시즌 계약
      p.potential,
      22 + Math.floor(Math.random() * 3), // peakAge 22~24
      10, // popularity (신인은 낮음)
      'main', // division
      0, // is_user_player
    ],
  );

  // 아카데미에서 제거
  await db.execute('DELETE FROM academy_players WHERE id = $1', [academyPlayerId]);
}

// ─────────────────────────────────────────
// 신인 드래프트
// ─────────────────────────────────────────

/** 시즌 오프 신인 드래프트 풀 생성 */
export async function generateRookieDraftPool(
  seasonId: number,
  count?: number,
): Promise<RookieDraftEntry[]> {
  const db = await getDatabase();
  const poolSize = count ?? (15 + Math.floor(Math.random() * 6)); // 15~20명

  const entries: RookieDraftEntry[] = [];

  for (let i = 0; i < poolSize; i++) {
    const name = generateKoreanName();
    const position = randomPosition();
    const age = 17 + Math.floor(Math.random() * 2); // 17~18세
    const potential = 40 + Math.floor(Math.random() * 50); // 40~89
    const estimatedAbility = Math.max(20, potential - 10 + Math.floor(Math.random() * 21) - 10); // 잠재력 기반 추정치

    const result = await db.execute(
      `INSERT INTO rookie_draft_pool (
        season_id, name, position, age, potential, estimated_ability, nationality
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [seasonId, name, position, age, potential, estimatedAbility, 'KR'],
    );

    entries.push({
      id: result.lastInsertId ?? 0,
      seasonId,
      name,
      position,
      age,
      potential,
      estimatedAbility,
      nationality: 'KR',
      isDrafted: false,
      draftedByTeamId: null,
    });
  }

  return entries;
}

/** 드래프트 풀 조회 */
export async function getRookieDraftPool(seasonId: number): Promise<RookieDraftEntry[]> {
  const db = await getDatabase();
  const rows = await db.select<RookieDraftRow[]>(
    'SELECT * FROM rookie_draft_pool WHERE season_id = $1 ORDER BY estimated_ability DESC',
    [seasonId],
  );
  return rows.map(mapRowToRookieEntry);
}

/** 신인 드래프트 선택 */
export async function draftRookie(
  rookieId: number,
  teamId: string,
): Promise<void> {
  const db = await getDatabase();

  const rows = await db.select<RookieDraftRow[]>(
    'SELECT * FROM rookie_draft_pool WHERE id = $1',
    [rookieId],
  );
  if (rows.length === 0) throw new Error('신인을 찾을 수 없습니다.');
  if (rows[0].is_drafted === 1) throw new Error('이미 드래프트된 신인입니다.');

  // 드래프트 처리 → 아카데미에 추가
  await db.execute(
    'UPDATE rookie_draft_pool SET is_drafted = 1, drafted_by_team_id = $1 WHERE id = $2',
    [teamId, rookieId],
  );

  const r = rows[0];

  // 아카데미에 등록
  const baseStat = () => 15 + Math.floor(Math.random() * 15);
  await db.execute(
    `INSERT INTO academy_players (
      team_id, name, position, age, potential,
      mechanical, game_sense, teamwork, consistency, laning, aggression,
      training_progress, promotion_ready, joined_date
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      teamId, r.name, r.position, r.age, r.potential,
      baseStat(), baseStat(), baseStat(), baseStat(), baseStat(), baseStat(),
      0, 0, new Date().toISOString().slice(0, 10),
    ],
  );
}

// ─────────────────────────────────────────
// 일간 진행 — 아카데미 자동 훈련
// ─────────────────────────────────────────

/** 하루 진행 시 아카데미 선수 자동 훈련 (dayAdvancer에서 호출) */
export async function advanceAcademyDay(teamId: string): Promise<void> {
  const db = await getDatabase();

  const rows = await db.select<AcademyPlayerRow[]>(
    'SELECT * FROM academy_players WHERE team_id = $1',
    [teamId],
  );

  // 코칭 스태프 보너스 조회 (아카데미 훈련 효율에 반영)
  let staffTrainingMul = 1.0;
  try {
    const { calculateStaffBonuses, getPhilosophyBonus } = await import('../staff/staffEngine');
    const staffBonuses = await calculateStaffBonuses(teamId);
    staffTrainingMul = staffBonuses.trainingEfficiency;
    // 육성형 철학 → 아카데미 선수 추가 보너스
    const philosophy = await getPhilosophyBonus(teamId);
    staffTrainingMul *= philosophy.youngPlayerGrowth; // developmental: 1.2배
  } catch { /* 무시 */ }

  for (const row of rows) {
    // 매일 progress +1~3, 스탯 미세 증가 (코칭 스태프 보너스 적용)
    const progressGain = Math.round((1 + Math.floor(Math.random() * 3)) * staffTrainingMul);
    const newProgress = Math.min(100, row.training_progress + progressGain);

    const potentialBonus = row.potential / 100;
    // 일간 자동 훈련 (스태프 효율 적용)
    const statGain = () => Math.random() < potentialBonus * 0.3 * staffTrainingMul ? 1 : 0;

    const newMech = Math.min(99, row.mechanical + statGain());
    const newGS = Math.min(99, row.game_sense + statGain());
    const newTW = Math.min(99, row.teamwork + statGain());
    const newCon = Math.min(99, row.consistency + statGain());
    const newLan = Math.min(99, row.laning + statGain());
    const newAgg = Math.min(99, row.aggression + statGain());

    const avgStat = Math.round((newMech + newGS + newTW + newCon + newLan + newAgg) / 6);
    const promotionReady = newProgress >= 80 && avgStat >= 40 ? 1 : 0;

    await db.execute(
      `UPDATE academy_players
       SET training_progress = $1,
           mechanical = $2, game_sense = $3, teamwork = $4,
           consistency = $5, laning = $6, aggression = $7,
           promotion_ready = $8
       WHERE id = $9`,
      [newProgress, newMech, newGS, newTW, newCon, newLan, newAgg, promotionReady, row.id],
    );
  }
}
