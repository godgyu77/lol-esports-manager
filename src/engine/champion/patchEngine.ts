/**
 * 챔피언 패치/메타 시스템
 * - 시즌 중 정기적으로 챔피언 밸런스 패치를 생성
 * - 랜덤 + 가중치 기반으로 3~5개 챔피언의 스탯/티어 조정
 * - champion_patches + champion_stat_modifiers에 INSERT
 * - 패치 노트 텍스트 생성 (한국어)
 */

import { CHAMPION_DB } from '../../data/championDb';
import type { Champion } from '../../types/champion';
import {
  insertChampionPatch,
  upsertChampionStatModifier,
  getChampionStatModifier,
} from '../../db/queries';
import { getDatabase } from '../../db/database';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

/** 패치 대상 스탯 키 (DB stat_key 컬럼과 일치) */
type PatchStatKey = 'early_game' | 'late_game' | 'teamfight' | 'split_push' | 'tier';

/** 개별 챔피언 패치 항목 */
interface PatchEntry {
  championId: string;
  championNameKo: string;
  statKey: PatchStatKey;
  oldValue: string;
  newValue: string;
  reason: string;
  /** 양수면 버프, 음수면 너프 */
  delta: number;
}

/** 패치 결과 */
export interface PatchResult {
  seasonId: number;
  week: number;
  patchNumber: number;
  entries: PatchEntry[];
  /** 한국어 패치 노트 */
  patchNote: string;
}

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────

/** 스탯 변동 범위 (최소~최대) */
const STAT_DELTA_MIN = 3;
const STAT_DELTA_MAX = 10;

/** 티어 순서 (인덱스 기반 변환) */
const TIER_ORDER: Champion['tier'][] = ['S', 'A', 'B', 'C', 'D'];

/** 스탯 키 → 한국어 이름 매핑 */
const STAT_NAME_KO: Record<PatchStatKey, string> = {
  early_game: '초반력',
  late_game: '후반력',
  teamfight: '한타',
  split_push: '스플릿',
  tier: '티어',
};

/** 패치 가능한 스탯 키 (tier 제외) */
const PATCHABLE_STATS: PatchStatKey[] = ['early_game', 'late_game', 'teamfight', 'split_push'];

/** 버프/너프 사유 풀 (한국어) */
const BUFF_REASONS = [
  '프로 무대에서 낮은 픽률을 보여 상향 조정',
  '다른 챔피언 대비 영향력이 부족하여 강화',
  '메타 다양성을 위해 기본 수치 상향',
  '최근 패치에서 간접 너프를 받아 보상 버프',
  '고유 플레이 스타일 강화를 위해 수치 조정',
];

const NERF_REASONS = [
  '프로 무대에서 과도한 밴률을 기록하여 하향 조정',
  '다른 챔피언 대비 지나치게 높은 승률로 약화',
  '메타 독점을 방지하기 위해 기본 수치 하향',
  '특정 아이템과의 시너지가 과도하여 조정',
  '상위 티어에서 대안 부재 문제를 해결하기 위해 너프',
];

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

/** min 이상 max 이하 랜덤 정수 */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 배열에서 랜덤 요소 선택 */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 배열에서 중복 없이 n개 선택 (Fisher-Yates 셔플 기반) */
function pickRandomN<T>(arr: readonly T[], n: number): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

/** 0~100 범위 클램프 */
function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

/** 티어 인덱스 → 티어 문자 */
function tierFromIndex(index: number): Champion['tier'] {
  return TIER_ORDER[Math.max(0, Math.min(TIER_ORDER.length - 1, index))];
}

/** 티어 → 인덱스 */
function tierToIndex(tier: Champion['tier']): number {
  return TIER_ORDER.indexOf(tier);
}

/** camelCase 스탯키를 snake_case PatchStatKey로 변환 */
function toStatKey(camel: keyof Champion['stats']): PatchStatKey {
  const map: Record<string, PatchStatKey> = {
    earlyGame: 'early_game',
    lateGame: 'late_game',
    teamfight: 'teamfight',
    splitPush: 'split_push',
  };
  return map[camel];
}

/** snake_case → camelCase 스탯 키 */
function toCamelStat(snake: PatchStatKey): keyof Champion['stats'] | null {
  const map: Record<string, keyof Champion['stats']> = {
    early_game: 'earlyGame',
    late_game: 'lateGame',
    teamfight: 'teamfight',
    split_push: 'splitPush',
  };
  return map[snake] ?? null;
}

// ─────────────────────────────────────────
// 대상 선정
// ─────────────────────────────────────────

/**
 * 패치 대상 챔피언 선정
 * - S티어, D티어에 가중치 부여 (너프/버프 확률 높음)
 * - 3~5개 챔피언 선택
 */
function selectPatchTargets(): Champion[] {
  const count = randInt(3, 5);

  // 가중치 배열: S/D 티어에 높은 가중치
  const weighted: Champion[] = [];
  for (const champ of CHAMPION_DB) {
    const weight =
      champ.tier === 'S' ? 4 :
      champ.tier === 'A' ? 2 :
      champ.tier === 'D' ? 4 :
      champ.tier === 'C' ? 2 : 1;
    for (let i = 0; i < weight; i++) {
      weighted.push(champ);
    }
  }

  // 중복 제거하며 선택
  const selected = new Map<string, Champion>();
  let attempts = 0;
  while (selected.size < count && attempts < 100) {
    const champ = pickRandom(weighted);
    if (!selected.has(champ.id)) {
      selected.set(champ.id, champ);
    }
    attempts++;
  }

  return Array.from(selected.values());
}

// ─────────────────────────────────────────
// 패치 생성
// ─────────────────────────────────────────

/**
 * 개별 챔피언에 대한 패치 항목 생성
 * - S티어: 너프 확률 높음
 * - D티어: 버프 확률 높음
 * - 중간 티어: 50/50
 */
function generateChampionPatchEntries(champ: Champion): PatchEntry[] {
  const entries: PatchEntry[] = [];
  const tierIdx = tierToIndex(champ.tier);

  // 버프/너프 방향 결정
  const isBuffChance =
    champ.tier === 'D' ? 0.9 :
    champ.tier === 'C' ? 0.7 :
    champ.tier === 'S' ? 0.1 :
    champ.tier === 'A' ? 0.3 : 0.5;
  const isBuff = Math.random() < isBuffChance;

  // 1~2개 스탯 변경
  const statCount = randInt(1, 2);
  const targetStats = pickRandomN(PATCHABLE_STATS, statCount);

  for (const statKey of targetStats) {
    const camelKey = toCamelStat(statKey);
    if (!camelKey) continue;

    const currentValue = champ.stats[camelKey];
    const delta = randInt(STAT_DELTA_MIN, STAT_DELTA_MAX) * (isBuff ? 1 : -1);
    const newValue = clamp(currentValue + delta);

    entries.push({
      championId: champ.id,
      championNameKo: champ.nameKo,
      statKey,
      oldValue: String(currentValue),
      newValue: String(newValue),
      reason: isBuff ? pickRandom(BUFF_REASONS) : pickRandom(NERF_REASONS),
      delta,
    });
  }

  // 20% 확률로 티어 변경도 포함
  if (Math.random() < 0.2) {
    const tierDelta = isBuff ? -1 : 1; // 티어는 인덱스가 낮을수록 높음
    const newTierIdx = Math.max(0, Math.min(TIER_ORDER.length - 1, tierIdx + tierDelta));
    if (newTierIdx !== tierIdx) {
      entries.push({
        championId: champ.id,
        championNameKo: champ.nameKo,
        statKey: 'tier',
        oldValue: champ.tier,
        newValue: tierFromIndex(newTierIdx),
        reason: isBuff ? '전반적인 성능 향상으로 티어 상향' : '전반적인 성능 하락으로 티어 하향',
        delta: isBuff ? 1 : -1,
      });
    }
  }

  return entries;
}

// ─────────────────────────────────────────
// 패치 노트 생성
// ─────────────────────────────────────────

/** 패치 노트 텍스트 생성 (한국어) */
function buildPatchNote(patchNumber: number, week: number, entries: PatchEntry[]): string {
  const lines: string[] = [];
  lines.push(`── 패치 ${patchNumber} (${week}주차) ──`);
  lines.push('');

  // 챔피언별로 그룹핑
  const byChampion = new Map<string, PatchEntry[]>();
  for (const entry of entries) {
    const existing = byChampion.get(entry.championId) ?? [];
    existing.push(entry);
    byChampion.set(entry.championId, existing);
  }

  for (const [champId, champEntries] of byChampion) {
    const nameKo = champEntries[0].championNameKo;
    const isBuff = champEntries[0].delta > 0;
    const icon = isBuff ? '[BUFF]' : '[NERF]';

    lines.push(`${icon} ${nameKo}`);

    for (const entry of champEntries) {
      const statName = STAT_NAME_KO[entry.statKey];
      if (entry.statKey === 'tier') {
        lines.push(`  - ${statName}: ${entry.oldValue} -> ${entry.newValue}`);
      } else {
        const sign = entry.delta > 0 ? '+' : '';
        lines.push(`  - ${statName}: ${entry.oldValue} -> ${entry.newValue} (${sign}${entry.delta})`);
      }
    }

    lines.push(`  사유: ${champEntries[0].reason}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────
// 메인 함수
// ─────────────────────────────────────────

/**
 * 패치 생성 및 DB 저장
 * - 3~5개 챔피언의 스탯/티어를 조정
 * - champion_patches + champion_stat_modifiers에 INSERT
 *
 * @param seasonId 현재 시즌 ID
 * @param patchNumber 패치 번호 (1, 2, 3...)
 * @param week 현재 주차
 * @returns 패치 결과 (노트 포함)
 */
export async function generatePatch(
  seasonId: number,
  patchNumber: number,
  week: number,
): Promise<PatchResult> {
  // 1. 대상 선정
  const targets = selectPatchTargets();

  // 2. 패치 항목 생성
  const allEntries: PatchEntry[] = [];
  for (const champ of targets) {
    const entries = generateChampionPatchEntries(champ);
    allEntries.push(...entries);
  }

  // 3. DB에 패치 이력 저장 + 모디파이어 업데이트
  for (const entry of allEntries) {
    // champion_patches에 이력 삽입
    await insertChampionPatch({
      seasonId,
      week,
      championId: entry.championId,
      statKey: entry.statKey,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      reason: entry.reason,
    });

    // 스탯 변경인 경우 champion_stat_modifiers 누적 업데이트
    if (entry.statKey !== 'tier') {
      const existing = await getChampionStatModifier(entry.championId, seasonId);
      const currentMod = existing ?? {
        earlyGameMod: 0,
        lateGameMod: 0,
        teamfightMod: 0,
        splitPushMod: 0,
      };

      // 해당 스탯의 모디파이어에 delta 누적
      const modKey = statKeyToModKey(entry.statKey);
      if (modKey) {
        currentMod[modKey] += entry.delta;
      }

      await upsertChampionStatModifier({
        championId: entry.championId,
        seasonId,
        earlyGameMod: currentMod.earlyGameMod,
        lateGameMod: currentMod.lateGameMod,
        teamfightMod: currentMod.teamfightMod,
        splitPushMod: currentMod.splitPushMod,
      });
    }

    // 티어 변경인 경우 champions 테이블의 tier 직접 업데이트
    if (entry.statKey === 'tier') {
      const db = await getDatabase();
      await db.execute(
        'UPDATE champions SET tier = $1 WHERE id = $2',
        [entry.newValue, entry.championId],
      );
    }
  }

  // 4. 패치 노트 생성
  const patchNote = buildPatchNote(patchNumber, week, allEntries);

  return {
    seasonId,
    week,
    patchNumber,
    entries: allEntries,
    patchNote,
  };
}

/** PatchStatKey → 모디파이어 객체 키 매핑 */
function statKeyToModKey(
  statKey: PatchStatKey,
): 'earlyGameMod' | 'lateGameMod' | 'teamfightMod' | 'splitPushMod' | null {
  const map: Record<string, 'earlyGameMod' | 'lateGameMod' | 'teamfightMod' | 'splitPushMod'> = {
    early_game: 'earlyGameMod',
    late_game: 'lateGameMod',
    teamfight: 'teamfightMod',
    split_push: 'splitPushMod',
  };
  return map[statKey] ?? null;
}
