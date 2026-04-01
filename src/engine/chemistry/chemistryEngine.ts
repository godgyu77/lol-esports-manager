/**
 * 케미스트리 엔진
 * - 선수 간 케미스트리 점수 관리
 * - 경기/성격/일상 기반 케미 변동
 * - 팀 레이팅 보너스 산출
 */

import { getDatabase } from '../../db/database';
import {
  getPlayersByTeamId,
  adjustPlayerChemistry,
  getPlayerChemistryLinks,
  upsertPlayerChemistry,
} from '../../db/queries';
import {
  getPlayerPersonality,
  calculatePersonalityCompatibility,
} from '../personality/personalityEngine';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export interface ChemistryPair {
  playerAId: string;
  playerBId: string;
  chemistryScore: number;
}

export interface TeamChemistryReport {
  teamId: string;
  averageChemistry: number;
  pairs: ChemistryPair[];
  hotPairs: ChemistryPair[];
  coldPairs: ChemistryPair[];
}

interface ChemistryRow {
  player_a_id: string;
  player_b_id: string;
  chemistry_score: number;
}

function mapRow(r: ChemistryRow): ChemistryPair {
  return {
    playerAId: r.player_a_id,
    playerBId: r.player_b_id,
    chemistryScore: r.chemistry_score,
  };
}

// ─────────────────────────────────────────
// 1. 팀 케미스트리 리포트 조회
// ─────────────────────────────────────────

/**
 * 팀의 모든 선수 간 케미스트리 점수 조회 및 리포트 생성
 */
export async function getTeamChemistry(teamId: string): Promise<TeamChemistryReport> {
  try {
    const db = await getDatabase();
    const players = await getPlayersByTeamId(teamId);
    const playerIds = players.map(p => p.id);

    if (playerIds.length < 2) {
      return { teamId, averageChemistry: 50, pairs: [], hotPairs: [], coldPairs: [] };
    }

    // [C14] 팀 선수들 간의 모든 케미스트리 쌍 조회
    // player_a_id와 player_b_id 각각 별도 플레이스홀더를 사용하여
    // SQL 파라미터 바인딩 불일치 방지 ($1~$N: player_a_id, $N+1~$2N: player_b_id)
    const n = playerIds.length;
    const placeholdersA = playerIds.map((_, i) => `$${i + 1}`).join(', ');
    const placeholdersB = playerIds.map((_, i) => `$${n + i + 1}`).join(', ');
    const rows = await db.select<ChemistryRow[]>(
      `SELECT * FROM player_chemistry
       WHERE player_a_id IN (${placeholdersA})
         AND player_b_id IN (${placeholdersB})`,
      [...playerIds, ...playerIds],
    );

    const pairs = rows.map(mapRow);
    const averageChemistry =
      pairs.length > 0
        ? Math.round((pairs.reduce((sum, p) => sum + p.chemistryScore, 0) / pairs.length) * 10) / 10
        : 50;

    const hotPairs = pairs.filter(p => p.chemistryScore >= 80);
    const coldPairs = pairs.filter(p => p.chemistryScore < 30);

    return { teamId, averageChemistry, pairs, hotPairs, coldPairs };
  } catch {
    return { teamId, averageChemistry: 50, pairs: [], hotPairs: [], coldPairs: [] };
  }
}

// ─────────────────────────────────────────
// 2. 특정 선수의 케미스트리 관계 조회
// ─────────────────────────────────────────

/**
 * 특정 선수의 모든 케미스트리 관계 조회
 */
export async function getPlayerChemistry(playerId: string): Promise<ChemistryPair[]> {
  try {
    const rows = await getPlayerChemistryLinks(playerId);
    return rows.map((row) => ({
      playerAId: playerId,
      playerBId: row.otherPlayerId,
      chemistryScore: row.chemistryScore,
    }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────
// 3. 경기 후 케미스트리 업데이트
// ─────────────────────────────────────────

/**
 * 경기 후 팀원 간 케미 업데이트
 * - 승리: +2, 패배: +0.5
 * - dayAdvancer.ts에서 승리팀에 +1 이미 적용 중이므로,
 *   여기서는 승리 시 추가 +1, 패배 시 +0.5만 적용
 */
export async function updateChemistryAfterMatch(teamId: string, isWin: boolean): Promise<void> {
  try {
    const players = await getPlayersByTeamId(teamId);

    // dayAdvancer에서 승리 시 +1 이미 적용 → 여기서는 승리 +1 추가, 패배 +0.5
    const increment = isWin ? 1 : 0.5;

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        await adjustPlayerChemistry(players[i].id, players[j].id, increment);
      }
    }
  } catch (e) {
    console.warn('[chemistryEngine] updateChemistryAfterMatch failed:', e);
  }
}

// ─────────────────────────────────────────
// 4. 성격 호환성 기반 케미스트리 변동
// ─────────────────────────────────────────

/**
 * 두 선수 간 성격 호환성에 따른 케미스트리 변동값 반환
 * - 호환성 +5 이상: +0.5/일
 * - 호환성 -5 이하: -0.3/일
 * - 그 외: 0
 * @returns 적용된 변동값
 */
export async function updateChemistryFromPersonality(
  playerAId: string,
  playerBId: string,
): Promise<number> {
  try {
    const db = await getDatabase();
    const [personalityA, personalityB] = await Promise.all([
      getPlayerPersonality(playerAId),
      getPlayerPersonality(playerBId),
    ]);

    const compatibility = calculatePersonalityCompatibility(personalityA, personalityB);

    let delta = 0;
    if (compatibility >= 5) {
      delta = 0.5;
    } else if (compatibility <= -5) {
      delta = -0.3;
    } else {
      return 0;
    }

    await db.execute(
      `UPDATE player_chemistry
       SET chemistry_score = MAX(0, MIN(100, chemistry_score + $3))
       WHERE (player_a_id = $1 AND player_b_id = $2)
          OR (player_a_id = $2 AND player_b_id = $1)`,
      [playerAId, playerBId, delta],
    );

    return delta;
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────
// 5. 일간 팀 케미스트리 처리
// ─────────────────────────────────────────

/**
 * 일간 팀 케미스트리 처리
 * - 같은 팀 하루 → 기본 +0.1
 * - 성격 호환성 반영
 */
export async function processTeamChemistryDay(teamId: string): Promise<void> {
  try {
    const players = await getPlayersByTeamId(teamId);

    if (players.length < 2) return;

    // 기본 +0.1 (같은 팀에서 하루 보냄)
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        await adjustPlayerChemistry(players[i].id, players[j].id, 0.1);

        // 성격 호환성 기반 추가 변동
        await updateChemistryFromPersonality(players[i].id, players[j].id);
      }
    }
  } catch (e) {
    console.warn('[chemistryEngine] processTeamChemistryDay failed:', e);
  }
}

// ─────────────────────────────────────────
// 6. 팀 레이팅 케미스트리 보너스 산출
// ─────────────────────────────────────────

/**
 * 팀 레이팅에 적용할 케미스트리 보너스 계산 (-5 ~ +5)
 * - 평균 70+: +3 ~ +5
 * - 평균 50: 0
 * - 평균 30-: -3 ~ -5
 */
export async function calculateChemistryBonus(teamId: string): Promise<number> {
  const report = await getTeamChemistry(teamId);
  const avg = report.averageChemistry;

  // 선형 보간: 0 → -5, 30 → -3, 50 → 0, 70 → +3, 100 → +5
  let bonus: number;
  if (avg >= 70) {
    // 70~100 → +3~+5
    bonus = 3 + ((avg - 70) / 30) * 2;
  } else if (avg >= 50) {
    // 50~70 → 0~+3
    bonus = ((avg - 50) / 20) * 3;
  } else if (avg >= 30) {
    // 30~50 → -3~0
    bonus = ((avg - 50) / 20) * 3;
  } else {
    // 0~30 → -5~-3
    bonus = -3 - ((30 - avg) / 30) * 2;
  }

  return Math.round(Math.max(-5, Math.min(5, bonus)) * 10) / 10;
}

// ─────────────────────────────────────────
// 7. 팀 케미스트리 초기화
// ─────────────────────────────────────────

/**
 * 팀의 모든 선수 쌍에 대해 초기 케미스트리(50) 세팅
 * 이미 존재하는 쌍은 무시 (INSERT OR IGNORE)
 */
export async function initializeTeamChemistry(teamId: string): Promise<void> {
  try {
    const players = await getPlayersByTeamId(teamId);

    if (players.length < 2) return;

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        await upsertPlayerChemistry(players[i].id, players[j].id, 50);
      }
    }
  } catch (e) {
    console.warn('[chemistryEngine] initializeTeamChemistry failed:', e);
  }
}
