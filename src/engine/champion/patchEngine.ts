/**
 * 챔피언 패치/메타 시스템
 * - 시즌 중 정기적으로 챔피언 밸런스 패치를 생성
 * - 랜덤 + 가중치 기반으로 3~5개 챔피언의 스탯/티어 조정
 * - champion_patches + champion_stat_modifiers에 INSERT
 * - 패치 노트 텍스트 생성 (한국어)
 */

import { CHAMPION_DB } from '../../data/championDb';
import type { Champion } from '../../types/champion';
import type { PatchMetaModifiers } from '../../types/tactics';
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
  /** 패치 메타 전략 효율 보정 */
  metaModifiers: PatchMetaModifiers;
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
function pickRandom<T>(arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pickRandom: empty array');
  return arr[Math.floor(Math.random() * arr.length)]!;
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
function buildPatchNote(patchNumber: number, week: number, entries: PatchEntry[], meta?: PatchMetaModifiers): string {
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

  for (const [_champId, champEntries] of byChampion) {
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

  // 메타 전략 변동 정보
  if (meta) {
    lines.push('── 메타 전략 변동 ──');
    const formatMeta = (label: string, value: number) => {
      if (Math.abs(value) < 0.005) return null;
      const sign = value > 0 ? '▲' : '▼';
      return `  ${sign} ${label}: ${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
    };
    const metaLines = [
      formatMeta('한타 전략 효율', meta.teamfightEfficiency),
      formatMeta('스플릿 전략 효율', meta.splitPushEfficiency),
      formatMeta('초반 어그로 효율', meta.earlyAggroEfficiency),
      formatMeta('오브젝트 컨트롤 효율', meta.objectiveEfficiency),
    ].filter(Boolean);
    if (metaLines.length > 0) {
      lines.push(...metaLines as string[]);
    } else {
      lines.push('  전략 메타 변동 없음');
    }
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

  // 4. 패치 메타 전략 효율 생성 (패치마다 전략 밸런스 변동)
  const metaModifiers: PatchMetaModifiers = generateMetaModifiers(allEntries);

  // DB에 메타 보정값 저장
  try {
    const { upsertPatchMetaModifiers } = await import('../../db/queries');
    await upsertPatchMetaModifiers({
      seasonId,
      patchNumber,
      teamfightEfficiency: metaModifiers.teamfightEfficiency,
      splitPushEfficiency: metaModifiers.splitPushEfficiency,
      earlyAggroEfficiency: metaModifiers.earlyAggroEfficiency,
      objectiveEfficiency: metaModifiers.objectiveEfficiency,
    });
  } catch (e) { console.warn('[patchEngine] 메타 보정값 저장 실패:', e); }

  // 5. 패치 노트 생성
  const patchNote = buildPatchNote(patchNumber, week, allEntries, metaModifiers);

  return {
    seasonId,
    week,
    patchNumber,
    entries: allEntries,
    patchNote,
    metaModifiers,
  };
}

/**
 * 패치 항목을 분석하여 전략 메타 효율 보정값 생성
 * 한타 챔피언 버프가 많으면 한타 메타, 스플릿 챔피언 버프가 많으면 스플릿 메타
 */
function generateMetaModifiers(entries: PatchEntry[]): PatchMetaModifiers {
  let teamfightBias = 0;
  let splitBias = 0;
  let earlyBias = 0;
  let objectiveBias = 0;

  for (const entry of entries) {
    if (entry.statKey === 'tier') continue;
    const direction = entry.delta > 0 ? 1 : -1;
    switch (entry.statKey) {
      case 'teamfight': teamfightBias += direction * 0.01; break;
      case 'split_push': splitBias += direction * 0.01; break;
      case 'early_game': earlyBias += direction * 0.01; break;
      case 'late_game': earlyBias -= direction * 0.005; break;
    }
  }

  // 랜덤 노이즈 추가 (패치마다 미세한 메타 변동)
  const noise = () => (Math.random() - 0.5) * 0.02;

  return {
    teamfightEfficiency: Math.max(-0.1, Math.min(0.1, teamfightBias + noise())),
    splitPushEfficiency: Math.max(-0.1, Math.min(0.1, splitBias + noise())),
    earlyAggroEfficiency: Math.max(-0.1, Math.min(0.1, earlyBias + noise())),
    objectiveEfficiency: Math.max(-0.1, Math.min(0.1, objectiveBias + noise())),
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

// ─────────────────────────────────────────
// 역할군 메타 시프트 시스템
// ─────────────────────────────────────────

/** 역할군(태그) 기반 메타 상태 */
export interface RoleMetaState {
  /** 각 태그별 메타 강도 (-1.0 ~ +1.0, 0이 중립) */
  tagStrength: Record<string, number>;
  /** 현재 지배적 메타 유형 */
  dominantMeta: 'tank' | 'assassin' | 'mage' | 'marksman' | 'fighter' | 'balanced';
  /** 메타 안정도 (0~1, 높을수록 급변 위험) */
  volatility: number;
}

/** 챔피언 태그별 가중치 → 메타 지표 */
const META_TAG_WEIGHTS: Record<string, string[]> = {
  tank: ['tank', 'engage'],
  assassin: ['assassin'],
  mage: ['mage', 'poke'],
  marksman: ['marksman'],
  fighter: ['fighter', 'splitpush'],
};

/**
 * 패치 결과를 분석하여 역할군 메타 상태 계산
 * 버프된 챔피언의 태그 → 해당 역할군 메타 강도 상승
 */
export function analyzeRoleMeta(entries: PatchEntry[], allChampions: readonly Champion[]): RoleMetaState {
  const tagImpact: Record<string, number> = {};

  for (const entry of entries) {
    if (entry.statKey === 'tier') continue;
    const champ = allChampions.find(c => c.id === entry.championId);
    if (!champ) continue;

    const direction = entry.delta > 0 ? 1 : -1;
    const magnitude = Math.abs(entry.delta) / STAT_DELTA_MAX; // 0~1 정규화

    for (const tag of champ.tags) {
      tagImpact[tag] = (tagImpact[tag] ?? 0) + direction * magnitude * 0.1;
    }
  }

  // 태그 강도 클램프 (-1 ~ 1)
  const tagStrength: Record<string, number> = {};
  for (const [tag, val] of Object.entries(tagImpact)) {
    tagStrength[tag] = Math.max(-1, Math.min(1, val));
  }

  // 지배적 메타 결정
  let bestMeta: RoleMetaState['dominantMeta'] = 'balanced';
  let bestScore = 0;
  for (const [metaType, tags] of Object.entries(META_TAG_WEIGHTS)) {
    const score = tags.reduce((sum, t) => sum + (tagStrength[t] ?? 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestMeta = metaType as RoleMetaState['dominantMeta'];
    }
  }

  // 변동성: 패치 항목 수에 비례
  const volatility = Math.min(1, entries.filter(e => e.statKey !== 'tier').length / 10);

  return { tagStrength, dominantMeta: bestMeta, volatility };
}

// ─────────────────────────────────────────
// 팀 메타 적응도 시스템
// ─────────────────────────────────────────

/** 팀의 메타 적응 상태 */
export interface TeamMetaFitness {
  teamId: string;
  /** 현재 메타 적합도 (0~100) */
  fitness: number;
  /** 메타와 잘 맞는 선수 수 */
  fittingPlayers: number;
  /** 메타와 안 맞는 선수 수 */
  misfitPlayers: number;
  /** 적응 필요 일수 (0이면 완전 적응) */
  adaptationDaysLeft: number;
}

/**
 * 팀의 현재 메타 적합도 계산
 * - 팀의 전술 스타일 + 선수 챔피언 풀이 현재 메타와 얼마나 맞는지
 * - 패치 직후에는 적합도가 낮고, 시간이 지나면 적응
 *
 * @param teamTactics 팀 전술 (earlyStrategy, midStrategy, lateStrategy)
 * @param playerChampionTags 선수들이 주로 사용하는 챔피언 태그 목록
 * @param roleMeta 현재 역할군 메타 상태
 * @param daysSincePatch 패치 이후 경과 일수
 */
export function calculateTeamMetaFitness(
  teamId: string,
  teamTactics: { earlyStrategy: string; midStrategy: string; lateStrategy: string },
  playerChampionTags: string[][],
  roleMeta: RoleMetaState,
  daysSincePatch: number,
): TeamMetaFitness {
  // 1. 전술-메타 매칭 점수 (0~50)
  let tacticsScore = 25; // 기본 50%

  // 지배적 메타와 전술 시너지
  const metaTacticsMap: Record<string, string[]> = {
    tank: ['teamfight', 'objective_control'],
    assassin: ['pick_comp', 'invade'],
    mage: ['siege', 'balanced'],
    marksman: ['teamfight', 'safe_farm'],
    fighter: ['split_push', 'lane_swap'],
    balanced: [],
  };

  const synergisticTactics = metaTacticsMap[roleMeta.dominantMeta] ?? [];
  if (synergisticTactics.includes(teamTactics.midStrategy) ||
      synergisticTactics.includes(teamTactics.lateStrategy) ||
      synergisticTactics.includes(teamTactics.earlyStrategy)) {
    tacticsScore += 15;
  }

  // 2. 선수 챔피언 풀-메타 매칭 점수 (0~50)
  let fittingPlayers = 0;
  let misfitPlayers = 0;
  const strongTags = Object.entries(roleMeta.tagStrength)
    .filter(([_, v]) => v > 0.05)
    .map(([t]) => t);

  for (const playerTags of playerChampionTags) {
    const hasMetaChamp = playerTags.some(t => strongTags.includes(t));
    if (hasMetaChamp) fittingPlayers++;
    else misfitPlayers++;
  }

  const playerScore = playerChampionTags.length > 0
    ? (fittingPlayers / playerChampionTags.length) * 50
    : 25;

  // 3. 시간 기반 적응 보정
  // 패치 직후 0~7일: 적응 중 (-20% ~ 0%), 7일 후: 완전 적응
  const ADAPTATION_DAYS = 7;
  const adaptationDaysLeft = Math.max(0, ADAPTATION_DAYS - daysSincePatch);
  const adaptationPenalty = (adaptationDaysLeft / ADAPTATION_DAYS) * 20;

  const rawFitness = tacticsScore + playerScore - adaptationPenalty;
  const fitness = Math.max(0, Math.min(100, Math.round(rawFitness)));

  return {
    teamId,
    fitness,
    fittingPlayers,
    misfitPlayers,
    adaptationDaysLeft,
  };
}

// ─────────────────────────────────────────
// 챔피언 클래스 연쇄 효과
// ─────────────────────────────────────────

/** 간접 영향 결과 */
export interface IndirectEffect {
  championId: string;
  championNameKo: string;
  /** 영향 유형 */
  effectType: 'counter_value_up' | 'counter_value_down' | 'synergy_boost' | 'synergy_weaken';
  /** 원인 챔피언 */
  causedBy: string;
  /** 영향 크기 (0~1) */
  magnitude: number;
  description: string;
}

/**
 * 패치로 인한 간접(연쇄) 효과 계산
 * - 챔피언 A가 버프되면 → A의 카운터 챔피언 가치 상승
 * - 챔피언 A가 너프되면 → A에게 카운터당하던 챔피언 가치 상승
 */
export function calculateIndirectEffects(
  entries: PatchEntry[],
  allChampions: readonly Champion[],
  synergies: { championA: string; championB: string; synergy: number }[],
): IndirectEffect[] {
  const effects: IndirectEffect[] = [];

  for (const entry of entries) {
    if (entry.statKey === 'tier') continue;

    const buffed = entry.delta > 0;
    const magnitude = Math.min(1, Math.abs(entry.delta) / STAT_DELTA_MAX);

    // 상성 데이터에서 관련 챔피언 찾기
    for (const syn of synergies) {
      const isA = syn.championA === entry.championId;
      const isB = syn.championB === entry.championId;
      if (!isA && !isB) continue;

      const relatedId = isA ? syn.championB : syn.championA;
      const relatedChamp = allChampions.find(c => c.id === relatedId);
      if (!relatedChamp) continue;

      const isCounter = syn.synergy < -30; // 강한 카운터 관계
      const isSynergy = syn.synergy > 30;  // 강한 시너지 관계

      if (isCounter) {
        if (buffed) {
          // A 버프 → A의 카운터 가치 상승
          effects.push({
            championId: relatedId,
            championNameKo: relatedChamp.nameKo,
            effectType: 'counter_value_up',
            causedBy: entry.championId,
            magnitude: magnitude * 0.5,
            description: `${entry.championNameKo} 버프로 카운터인 ${relatedChamp.nameKo}의 픽 가치 상승`,
          });
        } else {
          // A 너프 → A의 카운터 가치 하락
          effects.push({
            championId: relatedId,
            championNameKo: relatedChamp.nameKo,
            effectType: 'counter_value_down',
            causedBy: entry.championId,
            magnitude: magnitude * 0.3,
            description: `${entry.championNameKo} 너프로 카운터인 ${relatedChamp.nameKo}의 픽 가치 하락`,
          });
        }
      }

      if (isSynergy) {
        effects.push({
          championId: relatedId,
          championNameKo: relatedChamp.nameKo,
          effectType: buffed ? 'synergy_boost' : 'synergy_weaken',
          causedBy: entry.championId,
          magnitude: magnitude * 0.3,
          description: buffed
            ? `${entry.championNameKo} 버프로 시너지 파트너 ${relatedChamp.nameKo}의 조합 가치 상승`
            : `${entry.championNameKo} 너프로 시너지 파트너 ${relatedChamp.nameKo}의 조합 가치 하락`,
        });
      }
    }
  }

  // 중복 제거 (같은 챔피언에 대한 여러 효과 → 가장 큰 것만)
  const deduped = new Map<string, IndirectEffect>();
  for (const effect of effects) {
    const key = `${effect.championId}_${effect.effectType}`;
    const existing = deduped.get(key);
    if (!existing || effect.magnitude > existing.magnitude) {
      deduped.set(key, effect);
    }
  }

  return Array.from(deduped.values());
}

// ─────────────────────────────────────────
// 메타 스냅샷 (전체 메타 상태 요약)
// ─────────────────────────────────────────

/** 시즌 중 특정 시점의 메타 상태 */
export interface MetaSnapshot {
  seasonId: number;
  patchNumber: number;
  week: number;
  /** 역할군 메타 */
  roleMeta: RoleMetaState;
  /** 간접 효과 목록 */
  indirectEffects: IndirectEffect[];
  /** S/A 티어 챔피언 수 */
  highTierCount: number;
  /** 메타 요약 한국어 텍스트 */
  summary: string;
}

/**
 * 패치 후 전체 메타 스냅샷 생성
 */
export function createMetaSnapshot(
  patchResult: PatchResult,
  allChampions: readonly Champion[],
  synergies: { championA: string; championB: string; synergy: number }[],
): MetaSnapshot {
  const roleMeta = analyzeRoleMeta(patchResult.entries, allChampions);
  const indirectEffects = calculateIndirectEffects(patchResult.entries, allChampions, synergies);

  const highTierCount = allChampions.filter(c => c.tier === 'S' || c.tier === 'A').length;

  // 메타 요약 생성
  const metaName: Record<string, string> = {
    tank: '탱크 메타',
    assassin: '암살자 메타',
    mage: '마법사 메타',
    marksman: '원거리 딜러 메타',
    fighter: '전사 메타',
    balanced: '균형 메타',
  };

  const indirectSummary = indirectEffects.length > 0
    ? `간접 영향 ${indirectEffects.length}건 발생.`
    : '';

  const summary = `패치 ${patchResult.patchNumber}: ${metaName[roleMeta.dominantMeta] ?? '균형 메타'} (변동성 ${Math.round(roleMeta.volatility * 100)}%). ${indirectSummary}`;

  return {
    seasonId: patchResult.seasonId,
    patchNumber: patchResult.patchNumber,
    week: patchResult.week,
    roleMeta,
    indirectEffects,
    highTierCount,
    summary,
  };
}
