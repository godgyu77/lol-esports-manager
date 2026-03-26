/**
 * 솔로랭크 시뮬레이션 엔진
 * - 프로 선수의 솔로큐 활동 시뮬레이션
 * - 솔로랭크 순위가 컨디션/폼/팬 반응에 영향
 * - 솔로큐에서 신챔 연습 → 챔피언풀 확장 경로
 */

import { getDatabase } from '../../db/database';
import type { PlayerSoloRank, SoloRankTier, SoloRankDayResult } from '../../types/soloRank';
import { nextRandom, randomInt } from '../../utils/random';

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────

/** 티어별 LP 범위 */
export const TIER_LP_THRESHOLDS: Record<SoloRankTier, { min: number; max: number }> = {
  challenger: { min: 1000, max: 1500 },
  grandmaster: { min: 700, max: 999 },
  master: { min: 400, max: 699 },
  diamond: { min: 200, max: 399 },
  emerald: { min: 100, max: 199 },
  platinum: { min: 0, max: 99 },
};

/** 선수 OVR → 기대 솔로랭크 티어 매핑 */
export function expectedTierByOvr(ovr: number): SoloRankTier {
  if (ovr >= 85) return 'challenger';
  if (ovr >= 78) return 'grandmaster';
  if (ovr >= 70) return 'master';
  if (ovr >= 62) return 'diamond';
  if (ovr >= 55) return 'emerald';
  return 'platinum';
}

/** 티어 순서 (높은 순) */
const TIER_ORDER: SoloRankTier[] = ['challenger', 'grandmaster', 'master', 'diamond', 'emerald', 'platinum'];

function tierIndex(tier: SoloRankTier): number {
  return TIER_ORDER.indexOf(tier);
}

// ─────────────────────────────────────────
// 초기화
// ─────────────────────────────────────────

/**
 * 선수의 솔로랭크 초기 상태 생성
 * OVR에 기반하여 적절한 티어/LP 배정
 */
export function initializeSoloRank(playerId: string, ovr: number): PlayerSoloRank {
  const tier = expectedTierByOvr(ovr);
  const range = TIER_LP_THRESHOLDS[tier];
  const lp = Math.round(range.min + nextRandom() * (range.max - range.min));

  return {
    playerId,
    tier,
    lp,
    recentWinRate: 0.50 + (ovr - 70) * 0.01, // OVR 80 → 60%, OVR 85 → 65%
    gamesPlayedToday: 0,
    rank: Math.max(1, Math.round(500 - ovr * 5 + nextRandom() * 50)),
  };
}

// ─────────────────────────────────────────
// 일간 시뮬레이션
// ─────────────────────────────────────────

/**
 * 선수의 하루 솔로랭크 활동 시뮬레이션
 * @param playerId 선수 ID
 * @param ovr 선수 종합 능력치
 * @param stamina 현재 스태미나
 * @param practiceChampionId 연습 중인 챔피언 (null이면 기존 풀 사용)
 * @param dayType 오늘의 활동 유형
 */
export async function simulateSoloRankDay(
  playerId: string,
  ovr: number,
  stamina: number,
  practiceChampionId: string | null,
  dayType: string,
): Promise<SoloRankDayResult> {
  const db = await getDatabase();

  // 현재 솔로랭크 상태 조회
  let current: PlayerSoloRank;
  try {
    const rows = await db.select<{
      player_id: string; tier: SoloRankTier; lp: number;
      recent_win_rate: number; practice_champion_id: string | null; rank_position: number;
    }[]>(
      'SELECT * FROM player_solo_rank WHERE player_id = $1',
      [playerId],
    );
    if (rows.length > 0) {
      const r = rows[0];
      current = {
        playerId: r.player_id,
        tier: r.tier,
        lp: r.lp,
        recentWinRate: r.recent_win_rate,
        practiceChampionId: r.practice_champion_id ?? undefined,
        gamesPlayedToday: 0,
        rank: r.rank_position,
      };
    } else {
      current = initializeSoloRank(playerId, ovr);
    }
  } catch {
    current = initializeSoloRank(playerId, ovr);
  }

  // 활동 유형에 따른 솔로큐 게임 수 결정
  // 경기일: 1-2게임, 훈련일: 2-4게임, 스크림일: 1-2게임, 휴식일: 3-6게임
  let baseGames: number;
  switch (dayType) {
    case 'match_day': baseGames = randomInt(1, 2); break;
    case 'training': baseGames = randomInt(2, 4); break;
    case 'scrim': baseGames = randomInt(1, 2); break;
    case 'rest': baseGames = randomInt(3, 6); break;
    default: baseGames = randomInt(2, 4); break;
  }

  // 스태미나가 낮으면 게임 수 감소
  if (stamina < 30) baseGames = Math.max(1, baseGames - 2);
  else if (stamina < 50) baseGames = Math.max(1, baseGames - 1);

  const gamesPlayed = baseGames;

  // 승패 시뮬레이션
  const baseWinRate = 0.45 + ovr * 0.004; // OVR 80 → 77% 승률
  const staminaMod = (stamina - 50) * 0.001; // 스태미나 보정
  const effectiveWinRate = Math.max(0.3, Math.min(0.85, baseWinRate + staminaMod));

  let wins = 0;
  let losses = 0;
  for (let i = 0; i < gamesPlayed; i++) {
    if (nextRandom() < effectiveWinRate) wins++;
    else losses++;
  }

  // LP 변동
  const lpPerWin = randomInt(18, 23);
  const lpPerLoss = -randomInt(15, 20);
  const lpChange = wins * lpPerWin + losses * lpPerLoss;

  // 새 LP 계산
  let newLp = Math.max(0, current.lp + lpChange);

  // 티어 변동 체크
  let newTier = current.tier;
  let tierChanged = false;

  const currentIdx = tierIndex(current.tier);
  if (newLp > TIER_LP_THRESHOLDS[current.tier].max && currentIdx > 0) {
    // 승급
    newTier = TIER_ORDER[currentIdx - 1];
    newLp = TIER_LP_THRESHOLDS[newTier].min;
    tierChanged = true;
  } else if (newLp < TIER_LP_THRESHOLDS[current.tier].min && currentIdx < TIER_ORDER.length - 1) {
    // 강등
    newTier = TIER_ORDER[currentIdx + 1];
    newLp = TIER_LP_THRESHOLDS[newTier].max;
    tierChanged = true;
  }

  // 순위 재계산
  const newRank = Math.max(1, Math.round(current.rank - lpChange * 0.1 + (nextRandom() - 0.5) * 10));

  // 승률 업데이트 (최근 20게임 이동 평균)
  const newWinRate = current.recentWinRate * 0.8 + (gamesPlayed > 0 ? wins / gamesPlayed : 0.5) * 0.2;

  // 챔피언풀 확장 (연습 챔피언)
  let championPoolExpansion: SoloRankDayResult['championPoolExpansion'];
  if (practiceChampionId && gamesPlayed >= 2) {
    const profGain = Math.round(gamesPlayed * (1.5 + nextRandom()));
    championPoolExpansion = {
      championId: practiceChampionId,
      proficiencyGain: profGain,
    };

    // DB에 숙련도 증가 반영
    try {
      await db.execute(
        `UPDATE champion_proficiency SET proficiency = MIN(100, proficiency + $1)
         WHERE player_id = $2 AND champion_id = $3`,
        [profGain, playerId, practiceChampionId],
      );
    } catch { /* 무시 */ }
  }

  // 컨디션 영향
  const staminaCost = Math.round(gamesPlayed * 1.5); // 게임당 1.5 스태미나 소모
  const formBonus = wins > losses ? Math.round((wins - losses) * 1.5) : 0; // 이기면 폼 상승

  // DB 저장
  try {
    await db.execute(
      `INSERT INTO player_solo_rank (player_id, tier, lp, recent_win_rate, practice_champion_id, rank_position)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT(player_id) DO UPDATE SET
         tier = $2, lp = $3, recent_win_rate = $4, practice_champion_id = $5, rank_position = $6`,
      [playerId, newTier, newLp, newWinRate, practiceChampionId, newRank],
    );
  } catch (e) { console.warn('[soloRankEngine] player_solo_rank 저장 실패:', e); }

  return {
    playerId,
    gamesPlayed,
    wins,
    losses,
    lpChange,
    tierChanged,
    newTier: tierChanged ? newTier : undefined,
    championPoolExpansion,
    staminaCost,
    formBonus,
  };
}

/**
 * 팀 전체 선수의 솔로랭크 일간 처리
 */
export async function processTeamSoloRank(
  teamId: string,
  dayType: string,
): Promise<SoloRankDayResult[]> {
  const db = await getDatabase();
  const results: SoloRankDayResult[] = [];

  try {
    const players = await db.select<{
      id: string; mechanical: number; game_sense: number; teamwork: number;
      consistency: number; laning: number; aggression: number; stamina: number;
    }[]>(
      `SELECT id, mechanical, game_sense, teamwork, consistency, laning, aggression, stamina
       FROM players WHERE team_id = $1 AND division = 'main'`,
      [teamId],
    );

    for (const p of players) {
      const ovr = (p.mechanical + p.game_sense + p.teamwork + p.consistency + p.laning + p.aggression) / 6;

      // 연습 챔피언 조회
      let practiceChampId: string | null = null;
      try {
        const rankRow = await db.select<{ practice_champion_id: string | null }[]>(
          'SELECT practice_champion_id FROM player_solo_rank WHERE player_id = $1',
          [p.id],
        );
        if (rankRow.length > 0) practiceChampId = rankRow[0].practice_champion_id;
      } catch { /* 무시 */ }

      const result = await simulateSoloRankDay(p.id, ovr, p.stamina, practiceChampId, dayType);
      results.push(result);

      // 스태미나/폼 반영
      try {
        await db.execute(
          `UPDATE player_daily_condition SET
             stamina = MAX(0, stamina - $1),
             form = MIN(100, form + $2)
           WHERE player_id = $3`,
          [result.staminaCost, result.formBonus, p.id],
        );
      } catch (e) { console.warn('[soloRankEngine] 컨디션 업데이트 실패:', e); }
    }
  } catch (e) { console.warn('[soloRankEngine] processTeamSoloRank 실패:', e); }

  return results;
}

// ─────────────────────────────────────────
// 솔로랭크 → 팀 성능 연동
// ─────────────────────────────────────────

/** 솔로랭크 활동 기반 선수 보너스 */
export interface SoloRankPerformanceBonus {
  playerId: string;
  /** 자신감 보너스 (-3 ~ +3): 높은 티어/승률 → 경기 자신감 */
  confidenceBonus: number;
  /** 러스트 페널티 (-5 ~ 0): 솔로큐 비활동 → 감각 둔화 */
  rustPenalty: number;
  /** 챔피언 숙련도 보너스: 솔로큐에서 연습한 챔피언 숙련도 반영 */
  practiceChampionId: string | null;
}

/**
 * 선수의 솔로랭크 활동 기반 팀 경기 보너스 계산
 * - challenger/grandmaster 티어: 자신감 +2~3
 * - 승률 60%+: 추가 자신감 +1
 * - 비활동(솔로랭크 데이터 없음): 러스트 -3
 * - 낮은 티어(diamond 이하): 러스트 -1~-2
 */
export async function calculateSoloRankBonus(playerId: string): Promise<SoloRankPerformanceBonus> {
  const db = await getDatabase();

  try {
    const rows = await db.select<{
      player_id: string; tier: SoloRankTier; lp: number;
      recent_win_rate: number; practice_champion_id: string | null; rank_position: number;
    }[]>(
      'SELECT * FROM player_solo_rank WHERE player_id = $1',
      [playerId],
    );

    if (rows.length === 0) {
      // 솔로랭크 데이터 없음 → 러스트 페널티
      return { playerId, confidenceBonus: 0, rustPenalty: -3, practiceChampionId: null };
    }

    const rank = rows[0];
    const tier: SoloRankTier = rank.tier;
    const winRate: number = rank.recent_win_rate;
    const practiceChampionId: string | null = rank.practice_champion_id;

    // 자신감 보너스 (티어 기반)
    let confidenceBonus = 0;
    if (tier === 'challenger') confidenceBonus = 3;
    else if (tier === 'grandmaster') confidenceBonus = 2;
    else if (tier === 'master') confidenceBonus = 1;

    // 승률 보너스
    if (winRate >= 0.65) confidenceBonus += 1;
    else if (winRate >= 0.55) confidenceBonus += 0.5;

    confidenceBonus = Math.min(3, confidenceBonus);

    // 러스트 페널티 (낮은 티어)
    let rustPenalty = 0;
    if (tier === 'emerald') rustPenalty = -1;
    else if (tier === 'platinum') rustPenalty = -2;
    else if (tier === 'diamond') rustPenalty = -0.5;

    // 낮은 승률 → 추가 러스트
    if (winRate < 0.40) rustPenalty -= 1;

    rustPenalty = Math.max(-5, rustPenalty);

    return { playerId, confidenceBonus, rustPenalty, practiceChampionId };
  } catch {
    return { playerId, confidenceBonus: 0, rustPenalty: 0, practiceChampionId: null };
  }
}

/**
 * 팀 전체 솔로랭크 보너스 합산 (팀 레이팅에 적용)
 * @returns -5 ~ +5 범위의 팀 전체 보너스
 */
export async function calculateTeamSoloRankBonus(teamId: string): Promise<number> {
  const db = await getDatabase();

  try {
    const players = await db.select<{ id: string }[]>(
      "SELECT id FROM players WHERE team_id = $1 AND division = 'main'",
      [teamId],
    );

    let totalBonus = 0;
    for (const p of players) {
      const bonus = await calculateSoloRankBonus(p.id);
      totalBonus += bonus.confidenceBonus + bonus.rustPenalty;
    }

    // 5명 평균, -5~+5 범위
    const avgBonus = players.length > 0 ? totalBonus / players.length : 0;
    return Math.max(-5, Math.min(5, Math.round(avgBonus * 10) / 10));
  } catch {
    return 0;
  }
}

/**
 * 솔로랭크 순위표 조회 (지역 내 프로선수)
 */
export async function getSoloRankLeaderboard(
  limit = 50,
): Promise<PlayerSoloRank[]> {
  const db = await getDatabase();
  try {
    const rows = await db.select<{
      player_id: string; tier: SoloRankTier; lp: number;
      recent_win_rate: number; practice_champion_id: string | null; rank_position: number;
      player_name: string; team_id: string | null;
    }[]>(
      `SELECT sr.*, p.name as player_name, p.team_id
       FROM player_solo_rank sr
       JOIN players p ON p.id = sr.player_id
       ORDER BY sr.lp DESC LIMIT $1`,
      [limit],
    );
    return rows.map(r => ({
      playerId: r.player_id,
      tier: r.tier,
      lp: r.lp,
      recentWinRate: r.recent_win_rate,
      practiceChampionId: r.practice_champion_id ?? undefined,
      gamesPlayedToday: 0,
      rank: r.rank_position,
    }));
  } catch {
    return [];
  }
}
