/**
 * 계약 조항 엔진
 * - 조항 추가/조회
 * - 시즌 종료 시 조건 체크 및 트리거
 */

import { getDatabase } from '../../db/database';
import type { ClauseType, ContractClause } from '../../types/contract';

// ─────────────────────────────────────────
// Row 타입
// ─────────────────────────────────────────

interface ClauseRow {
  id: number;
  player_id: string;
  clause_type: string;
  clause_value: number;
  condition_text: string | null;
  is_triggered: number;
  created_at: string;
}

const mapRowToClause = (row: ClauseRow): ContractClause => ({
  id: row.id,
  playerId: row.player_id,
  clauseType: row.clause_type as ClauseType,
  clauseValue: row.clause_value,
  conditionText: row.condition_text,
  isTriggered: row.is_triggered === 1,
});

// ─────────────────────────────────────────
// 조항 추가
// ─────────────────────────────────────────

/**
 * 선수에게 계약 조항을 추가한다.
 */
export async function addClause(
  playerId: string,
  type: ClauseType,
  value: number,
  condition?: string,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO contract_clauses (player_id, clause_type, clause_value, condition_text)
     VALUES ($1, $2, $3, $4)`,
    [playerId, type, value, condition ?? null],
  );
}

// ─────────────────────────────────────────
// 조항 조회
// ─────────────────────────────────────────

/**
 * 특정 선수의 모든 계약 조항을 조회한다.
 */
export async function getPlayerClauses(playerId: string): Promise<ContractClause[]> {
  const db = await getDatabase();
  const rows = await db.select<ClauseRow[]>(
    'SELECT * FROM contract_clauses WHERE player_id = $1 ORDER BY created_at DESC',
    [playerId],
  );
  return rows.map(mapRowToClause);
}

// ─────────────────────────────────────────
// 시즌 종료 시 조건 체크
// ─────────────────────────────────────────

/** 조항 트리거 결과 */
interface ClauseCheckResult {
  clause: ContractClause;
  triggered: boolean;
  bonusAmount: number;
}

/**
 * 바이아웃 조항 조회
 * @returns 바이아웃 가격 (없으면 null)
 */
export async function checkReleaseClause(playerId: string): Promise<number | null> {
  const clauses = await getPlayerClauses(playerId);
  const releaseClause = clauses.find(c => c.clauseType === 'release_clause' && !c.isTriggered);
  return releaseClause?.clauseValue ?? null;
}

/**
 * 바이아웃 조항 실행 (자동 이적 처리용)
 * @returns 바이아웃 금액
 */
export async function triggerReleaseClause(playerId: string): Promise<number | null> {
  const db = await getDatabase();
  const clauses = await getPlayerClauses(playerId);
  const releaseClause = clauses.find(c => c.clauseType === 'release_clause' && !c.isTriggered);
  if (!releaseClause) return null;

  await db.execute(
    'UPDATE contract_clauses SET is_triggered = 1 WHERE id = $1',
    [releaseClause.id],
  );

  return releaseClause.clauseValue;
}

/**
 * 시즌 종료 시 팀 선수들의 계약 조항을 체크한다.
 * - appearance_bonus: 20경기 이상 출전 시 보너스 지급
 * - performance_bonus: All-Pro 선정 or MVP 시 / KDA 5.0+ 시 보너스 지급
 * - loyalty_bonus: 2시즌 이상 잔류 시 보너스 지급
 * - relegation_release: 체크만 (트리거는 강등 로직에서 처리)
 * - release_clause, signing_bonus: 별도 처리 (체크 대상 아님)
 */
export async function checkClauses(
  teamId: string,
  seasonId: number,
  _currentDate: string,
): Promise<ClauseCheckResult[]> {
  const db = await getDatabase();
  const results: ClauseCheckResult[] = [];

  // 팀 소속 선수들의 미트리거 조항 조회
  const rows = await db.select<ClauseRow[]>(
    `SELECT cc.* FROM contract_clauses cc
     JOIN players p ON p.id = cc.player_id
     WHERE p.team_id = $1 AND cc.is_triggered = 0`,
    [teamId],
  );
  const clauses = rows.map((row, idx) => ({ ...mapRowToClause(row), _rowIdx: idx }));

  for (const clause of clauses) {
    let triggered = false;

    switch (clause.clauseType) {
      case 'appearance_bonus': {
        // 해당 시즌 출전 경기 수 조회
        const gameCountRows = await db.select<{ cnt: number }[]>(
          `SELECT COUNT(*) as cnt FROM player_game_stats pgs
           JOIN matches m ON m.id = pgs.match_id
           WHERE pgs.player_id = $1 AND m.season_id = $2`,
          [clause.playerId, seasonId],
        );
        const gameCount = gameCountRows[0]?.cnt ?? 0;
        triggered = gameCount >= 20;
        break;
      }

      case 'performance_bonus': {
        // All-Pro 또는 MVP 수상 여부 조회
        const awardRows = await db.select<{ cnt: number }[]>(
          `SELECT COUNT(*) as cnt FROM awards
           WHERE player_id = $1 AND season_id = $2
           AND (award_type = 'all_pro' OR award_type = 'mvp')`,
          [clause.playerId, seasonId],
        );
        const hasAward = (awardRows[0]?.cnt ?? 0) > 0;

        // KDA 5.0 이상 체크
        const kdaRows = await db.select<{ avg_kda: number }[]>(
          `SELECT AVG(CAST(kills + assists AS REAL) / MAX(deaths, 1)) as avg_kda
           FROM player_game_stats pgs
           JOIN matches m ON m.id = pgs.match_id
           WHERE pgs.player_id = $1 AND m.season_id = $2`,
          [clause.playerId, seasonId],
        );
        const avgKda = kdaRows[0]?.avg_kda ?? 0;

        triggered = hasAward || avgKda >= 5.0;
        break;
      }

      case 'loyalty_bonus': {
        // [W18] 해당 팀에서 현재 계약 기간 내 2시즌 이상 잔류했는지 조회
        // clause.created_at(조항 생성 시점) 이후의 시즌만 카운트하여
        // 이적 전 다른 팀 경기가 포함되지 않도록 함
        const seasonRows = await db.select<{ cnt: number }[]>(
          `SELECT COUNT(DISTINCT m.season_id) as cnt FROM player_game_stats pgs
           JOIN matches m ON m.id = pgs.match_id
           JOIN players p ON p.id = pgs.player_id
           WHERE pgs.player_id = $1 AND p.team_id = $2
             AND m.season_id >= (
               SELECT MIN(s.id) FROM seasons s
               WHERE s.start_date >= $3
             )`,
          [clause.playerId, teamId, rows[clause._rowIdx].created_at],
        );
        triggered = (seasonRows[0]?.cnt ?? 0) >= 2;
        break;
      }

      case 'relegation_release':
        // 강등 시 방출 조항은 강등 로직에서 별도 처리
        triggered = false;
        break;

      case 'release_clause':
      case 'signing_bonus':
        // 바이아웃/계약보너스는 시즌 종료 체크 대상 아님
        triggered = false;
        break;
    }

    if (triggered) {
      // 트리거 상태 업데이트
      await db.execute(
        'UPDATE contract_clauses SET is_triggered = 1 WHERE id = $1',
        [clause.id],
      );
    }

    results.push({
      clause,
      triggered,
      bonusAmount: triggered ? clause.clauseValue : 0,
    });
  }

  return results;
}
