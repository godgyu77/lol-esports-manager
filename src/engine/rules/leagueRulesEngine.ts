/**
 * 리그 규정 엔진
 * - 외국인 선수 규정 관리
 * - 로스터 컴플라이언스 체크
 * - 이적 시 외국인 규정 검증
 */

import { getDatabase } from '../../db/database';
import { getPlayersByTeamId } from '../../db/queries';
import type { Region } from '../../types/game';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export interface LeagueRules {
  id: number;
  region: Region;
  maxForeignPlayers: number;
  minLocalPlayers: number;
  rosterSizeLimit: number;
}

export interface RosterComplianceResult {
  compliant: boolean;
  foreignCount: number;
  localCount: number;
  maxForeign: number;
  minLocal: number;
  violations: string[];
}

// ─────────────────────────────────────────
// 리전 → 기본 국적 매핑
// ─────────────────────────────────────────

const REGION_DEFAULT_NATIONALITY: Record<Region, string[]> = {
  LCK: ['KR'],
  LPL: ['CN'],
  LEC: ['DE', 'FR', 'ES', 'PL', 'SE', 'DK', 'CZ', 'RO', 'BG', 'IT', 'PT', 'NL', 'BE', 'AT', 'GR', 'FI', 'NO', 'HU', 'SK', 'SI', 'HR', 'LT', 'LV', 'EE', 'IE', 'GB', 'EU'],
  LCS: ['US', 'CA', 'NA'],
};

/** 선수 국적이 해당 리전의 로컬인지 판별 */
function isLocalPlayer(nationality: string, region: Region): boolean {
  const localNationalities = REGION_DEFAULT_NATIONALITY[region];
  return localNationalities.includes(nationality.toUpperCase());
}

// ─────────────────────────────────────────
// Row 타입
// ─────────────────────────────────────────

interface LeagueRulesRow {
  id: number;
  region: string;
  max_foreign_players: number;
  min_local_players: number;
  roster_size_limit: number;
}

// ─────────────────────────────────────────
// 리그 규정 조회
// ─────────────────────────────────────────

/**
 * 리전 규정 조회
 */
export async function getLeagueRules(region: Region): Promise<LeagueRules | null> {
  const db = await getDatabase();

  const rows = await db.select<LeagueRulesRow[]>(
    'SELECT id, region, max_foreign_players, min_local_players, roster_size_limit FROM league_rules WHERE region = $1',
    [region],
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    region: row.region as Region,
    maxForeignPlayers: row.max_foreign_players,
    minLocalPlayers: row.min_local_players,
    rosterSizeLimit: row.roster_size_limit,
  };
}

// ─────────────────────────────────────────
// 로스터 규정 준수 여부 체크
// ─────────────────────────────────────────

/**
 * 외국인 규정 준수 여부 체크
 * - 현재 로스터의 외국인/로컬 선수 수를 집계
 * - 리전 규정과 비교하여 위반 사항 반환
 */
export async function checkRosterCompliance(
  teamId: string,
  region: Region,
): Promise<RosterComplianceResult> {
  const rules = await getLeagueRules(region);
  const players = await getPlayersByTeamId(teamId);

  // 규정이 없으면 기본값 적용
  const maxForeign = rules?.maxForeignPlayers ?? 2;
  const minLocal = rules?.minLocalPlayers ?? 3;

  let foreignCount = 0;
  let localCount = 0;

  for (const player of players) {
    if (isLocalPlayer(player.nationality, region)) {
      localCount++;
    } else {
      foreignCount++;
    }
  }

  const violations: string[] = [];

  if (foreignCount > maxForeign) {
    violations.push(`외국인 선수 ${foreignCount}명 (최대 ${maxForeign}명 초과)`);
  }

  if (localCount < minLocal && players.length >= 5) {
    violations.push(`로컬 선수 ${localCount}명 (최소 ${minLocal}명 미달)`);
  }

  return {
    compliant: violations.length === 0,
    foreignCount,
    localCount,
    maxForeign,
    minLocal,
    violations,
  };
}

// ─────────────────────────────────────────
// 외국인 추가 영입 가능 여부
// ─────────────────────────────────────────

/**
 * 외국인 추가 영입 가능 여부
 * - 현재 외국인 수가 최대치 미만인 경우 true
 */
export async function canSignForeignPlayer(
  teamId: string,
  region: Region,
): Promise<{ allowed: boolean; reason?: string }> {
  const rules = await getLeagueRules(region);
  const players = await getPlayersByTeamId(teamId);

  const maxForeign = rules?.maxForeignPlayers ?? 2;
  const rosterLimit = rules?.rosterSizeLimit ?? 10;

  // 로스터 크기 제한 확인
  if (players.length >= rosterLimit) {
    return { allowed: false, reason: `로스터 인원 상한 ${rosterLimit}명에 도달했습니다.` };
  }

  // 현재 외국인 수 확인
  let foreignCount = 0;
  for (const player of players) {
    if (!isLocalPlayer(player.nationality, region)) {
      foreignCount++;
    }
  }

  if (foreignCount >= maxForeign) {
    return {
      allowed: false,
      reason: `외국인 선수 상한 ${maxForeign}명에 도달했습니다. (현재 ${foreignCount}명)`,
    };
  }

  return { allowed: true };
}
