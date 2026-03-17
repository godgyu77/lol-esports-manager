/**
 * rosterDb → SQLite 시딩
 * OVR 등급 → 6개 스탯 변환 포함
 */
import { CHAMPION_DB, getChampionsByPrimaryRole } from '../data/championDb';
import { SIGNATURE_CHAMPIONS } from '../data/signatureChampions';
import { FINANCIAL_CONSTANTS, MATCH_CONSTANTS } from '../data/systemPrompt';
import { LCK_TEAMS, LCS_TEAMS, LEC_TEAMS, LPL_TEAMS } from '../data/rosterDb';
import type { Role, RosterPlayer, TeamData } from '../data/rosterDb';
import type { Position, Region } from '../types';
import { getDatabase } from './database';
import { insertChampion, insertPlayer, insertPlayerTrait, insertTeam } from './queries';

// ─────────────────────────────────────────
// 상수 & 유틸
// ─────────────────────────────────────────

const ROLE_TO_POSITION: Record<Role, Position> = {
  TOP: 'top',
  JGL: 'jungle',
  MID: 'mid',
  ADC: 'adc',
  SPT: 'support',
  SUB: 'support',
};

const REGION_NATIONALITY: Record<Region, string> = {
  LCK: 'KR',
  LPL: 'CN',
  LCS: 'NA',
  LEC: 'EU',
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * 지표를 -10 ~ +10 범위의 보정값으로 정규화
 * 각 스탯의 대략적인 범위를 기반으로 변환
 */
function normalize(value: number, low: number, high: number): number {
  if (high === low) return 0;
  return ((value - low) / (high - low)) * 20 - 10;
}

// 지표별 정규화 범위 (rosterDb 데이터 기반 대략적 범위)
const STAT_RANGES = {
  dpm: { low: 100, high: 700 },
  soloKill: { low: 0, high: 22 },
  kdaPerMin: { low: 0.2, high: 0.7 },
  fbPart: { low: 10, high: 55 },
  fbVictim: { low: 2, high: 25 },
  csd15: { low: -10, high: 15 },
  gd15: { low: -60, high: 300 },
  xpd15: { low: -40, high: 200 },
};

/**
 * OVR 등급 + 세부 스탯 → 6개 DB 스탯 변환
 */
export function convertToPlayerStats(
  rosterStats: RosterPlayer['stats'],
): {
  mechanical: number;
  gameSense: number;
  teamwork: number;
  consistency: number;
  laning: number;
  aggression: number;
} {
  const baseOvr = MATCH_CONSTANTS.ovrToNumber[rosterStats.ovr] ?? 50;

  const nDpm = normalize(rosterStats.dpm, STAT_RANGES.dpm.low, STAT_RANGES.dpm.high);
  const nSoloKill = normalize(rosterStats.solo_kill, STAT_RANGES.soloKill.low, STAT_RANGES.soloKill.high);
  const nKda = normalize(rosterStats.kda_per_min, STAT_RANGES.kdaPerMin.low, STAT_RANGES.kdaPerMin.high);
  const nFbPart = normalize(rosterStats.fb_part, STAT_RANGES.fbPart.low, STAT_RANGES.fbPart.high);
  const nFbVictim = normalize(rosterStats.fb_victim, STAT_RANGES.fbVictim.low, STAT_RANGES.fbVictim.high);
  const nCsd15 = normalize(rosterStats.csd15, STAT_RANGES.csd15.low, STAT_RANGES.csd15.high);
  const nGd15 = normalize(rosterStats.gd15, STAT_RANGES.gd15.low, STAT_RANGES.gd15.high);
  const nXpd15 = normalize(rosterStats.xpd15, STAT_RANGES.xpd15.low, STAT_RANGES.xpd15.high);

  // 세부 스탯들의 분산 (표준편차 기반)
  const allNorms = [nDpm, nSoloKill, nKda, nFbPart, nCsd15, nGd15, nXpd15];
  const mean = allNorms.reduce((a, b) => a + b, 0) / allNorms.length;
  const variance = allNorms.reduce((a, b) => a + (b - mean) ** 2, 0) / allNorms.length;
  const nVariance = Math.sqrt(variance) * 1.5; // 분산이 높을수록 일관성 감소

  return {
    mechanical: clamp(baseOvr + nDpm * 0.5 + nSoloKill * 0.5),
    gameSense: clamp(baseOvr + nKda * 0.8),
    teamwork: clamp(baseOvr + nFbPart * 0.5 - nSoloKill * 0.3),
    consistency: clamp(baseOvr - nVariance),
    laning: clamp(baseOvr + nCsd15 * 0.4 + nGd15 * 0.3 + nXpd15 * 0.3),
    aggression: clamp(baseOvr + nSoloKill * 0.5 + nFbPart * 0.3 - nFbVictim * 0.2),
  };
}

// ─────────────────────────────────────────
// 시딩 함수
// ─────────────────────────────────────────

/**
 * 이미 시딩되었는지 체크
 */
export async function isSeeded(): Promise<boolean> {
  const db = await getDatabase();
  const rows = await db.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM teams');
  return rows[0].cnt > 0;
}

/**
 * 리그별 팀 + 선수 INSERT
 */
async function seedTeams(
  teams: Record<string, TeamData>,
  region: Region,
): Promise<void> {
  const nationality = REGION_NATIONALITY[region];

  for (const [key, teamData] of Object.entries(teams)) {
    const teamId = `${region.toLowerCase()}_${key}`;

    // 재정 티어에 따른 명성
    const reputationMap = { S: 90, A: 70, B: 50, C: 30 };
    const reputation = reputationMap[teamData.financialTier] ?? 50;

    // budget = 팀 보유 자금 (억 → 만 원), salaryCap = 리그 공통 연봉 상한 (억 → 만 원)
    await insertTeam({
      id: teamId,
      name: teamData.teamName,
      shortName: key,
      region,
      budget: Math.round(teamData.money * 10000),
      salaryCap: FINANCIAL_CONSTANTS.salaryCap * 10000,
      reputation,
    });

    // 선수 시딩
    for (const rosterPlayer of teamData.roster) {
      // VACANT 선수 스킵
      if (rosterPlayer.name === 'VACANT') continue;

      const playerId = `${teamId}_${rosterPlayer.name}`;
      const position = ROLE_TO_POSITION[rosterPlayer.role];
      const stats = convertToPlayerStats(rosterPlayer.stats);
      const division = rosterPlayer.div === '1군' ? 'main' : 'sub';

      // 잠재력: 나이가 어릴수록 높음
      const potential = clamp(80 - (rosterPlayer.age - 18) * 3);

      // 최적 나이: 포지션 기반 기본값
      const peakAgeMap: Record<Position, number> = {
        top: 23,
        jungle: 23,
        mid: 22,
        adc: 22,
        support: 24,
      };

      // 인기도: OVR 등급 기반
      const ovrNum = MATCH_CONSTANTS.ovrToNumber[rosterPlayer.stats.ovr] ?? 50;
      const popularity = clamp(ovrNum - 30);

      // 연봉: OVR 등급별 차등 (만 원 단위)
      // S+(97)→8억, A(86)→5.2억, B(75)→3.1억, C(63)→1.5억, D(50)→0.7억
      const salaryRatio = (ovrNum - 40) / 57;
      const salary = Math.round(salaryRatio ** 2.2 * 75000 + 5000);

      await insertPlayer({
        id: playerId,
        name: rosterPlayer.name,
        teamId,
        position,
        age: rosterPlayer.age,
        nationality,
        ...stats,
        mental: 70,
        stamina: 80,
        morale: 70,
        salary,
        contractEndSeason: rosterPlayer.contract,
        potential,
        peakAge: peakAgeMap[position],
        popularity,
        division,
        isUserPlayer: false,
      });

      // 특성 시딩
      for (const traitId of rosterPlayer.traits) {
        await insertPlayerTrait(playerId, traitId);
      }
    }
  }
}

/**
 * 챔피언 전체 시딩
 */
async function seedChampions(): Promise<void> {
  for (const champ of CHAMPION_DB) {
    await insertChampion(champ);
  }
}

// ─────────────────────────────────────────
// 챔피언 숙련도 시딩
// ─────────────────────────────────────────

/** 시드 기반 의사 난수 (결정론적 — 같은 입력이면 같은 결과) */
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
    h = (h ^ (h >>> 16)) >>> 0;
    return (h % 1000) / 1000;
  };
}

/** 배열에서 n개를 시드 기반으로 선택 */
function pickN<T>(arr: T[], n: number, rand: () => number): T[] {
  const shuffled = [...arr].sort(() => rand() - 0.5);
  return shuffled.slice(0, n);
}

/**
 * 특성 → 선호 챔피언 태그 매핑
 * 선수 특성에 따라 어울리는 챔피언을 우선 배정
 */
const TRAIT_TO_TAGS: Record<string, string[]> = {
  AGGRESSIVE: ['assassin', 'fighter'],
  SPLIT_PUSHER: ['splitpush', 'fighter'],
  STONE_HEAD: ['tank', 'fighter'],
  JOKER_PICK: ['mage', 'assassin'],       // 비주류 선호
  CHAMP_OCEAN: [],                          // 폭넓음 → 풀 사이즈 증가
  PURE_MECH: ['assassin', 'fighter'],
  COMMANDER: ['engage', 'teamfight'],
  ENGAGE_SUPPORT: ['engage', 'tank'],
  ENGAGE_GOD: ['engage', 'tank'],
  MECHANIC_SUPPORT: ['engage', 'mage'],
  DARK_TECHNOLOGY: ['mage', 'assassin'],
  MELEE_MID: ['assassin', 'fighter'],
  COMFORT_PICK: [],                         // 좁은 풀, 높은 숙련도
};

/**
 * 선수의 포지션 + OVR + 특성 → 챔피언 숙련도 목록 생성
 */
function generateChampionPool(
  playerName: string,
  position: Position,
  ovrGrade: string,
  traits: string[],
): { championId: string; proficiency: number; gamesPlayed: number }[] {
  const rand = seededRandom(playerName);
  const ovrNum = MATCH_CONSTANTS.ovrToNumber[ovrGrade] ?? 50;

  // 시그니처 챔프가 있으면 그것을 우선 사용
  const signature = SIGNATURE_CHAMPIONS[playerName];
  if (signature) {
    return signature.map((champId, i) => ({
      championId: champId,
      proficiency: clamp(95 - i * 5 + Math.round((rand() - 0.5) * 6)),
      gamesPlayed: Math.round(200 - i * 25 + rand() * 50),
    }));
  }

  // 자동 생성: OVR에 따라 챔피언 풀 크기 결정
  // S급(90+): 5~7개, A급(80+): 4~6개, B급(70+): 3~5개, C이하: 3~4개
  const hasOcean = traits.includes('CHAMP_OCEAN');
  const hasComfort = traits.includes('COMFORT_PICK');
  const hasPuddle = traits.includes('CHAMP_PUDDLE');

  let poolSize: number;
  if (ovrNum >= 90) poolSize = 5 + Math.round(rand() * 2);
  else if (ovrNum >= 80) poolSize = 4 + Math.round(rand() * 2);
  else if (ovrNum >= 70) poolSize = 3 + Math.round(rand() * 2);
  else poolSize = 3 + Math.round(rand());

  if (hasOcean) poolSize += 2;
  if (hasComfort) poolSize = Math.max(3, poolSize - 1);
  if (hasPuddle) poolSize = Math.max(2, poolSize - 2);

  // 해당 포지션의 챔피언 풀 가져오기
  const positionChamps = getChampionsByPrimaryRole(position);

  // 특성에 따라 선호 태그 수집
  const preferredTags: string[] = [];
  for (const trait of traits) {
    const tags = TRAIT_TO_TAGS[trait];
    if (tags) preferredTags.push(...tags);
  }

  // 티어 + 태그 매칭으로 정렬 (높은 티어 + 매칭 태그 = 우선)
  const tierScore: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };
  const scored = positionChamps.map(ch => {
    let score = tierScore[ch.tier] ?? 1;
    if (preferredTags.length > 0) {
      const matchCount = ch.tags.filter(t => preferredTags.includes(t)).length;
      score += matchCount * 2;
    }
    // 약간의 랜덤성
    score += rand() * 2;
    return { champ: ch, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, poolSize);

  return selected.map((s, i) => {
    // 첫 번째 챔프가 가장 숙련도 높음
    const baseProficiency = hasComfort
      ? 90 - i * 3   // COMFORT_PICK: 좁지만 높은 숙련도
      : 85 - i * 5;  // 일반: 점진적 감소

    // OVR이 높을수록 숙련도 기본값 높음
    const ovrBonus = (ovrNum - 70) * 0.2;

    return {
      championId: s.champ.id,
      proficiency: clamp(Math.round(baseProficiency + ovrBonus + (rand() - 0.5) * 8)),
      gamesPlayed: Math.round(150 - i * 20 + rand() * 80),
    };
  });
}

/**
 * 모든 선수의 챔피언 숙련도 시딩
 * seedTeams 이후에 호출 (선수 데이터가 DB에 있어야 함)
 */
async function seedChampionProficiency(
  teams: Record<string, TeamData>,
  region: Region,
): Promise<void> {
  const db = await getDatabase();

  for (const [key, teamData] of Object.entries(teams)) {
    const teamId = `${region.toLowerCase()}_${key}`;

    for (const rosterPlayer of teamData.roster) {
      if (rosterPlayer.name === 'VACANT') continue;

      const playerId = `${teamId}_${rosterPlayer.name}`;
      const position = ROLE_TO_POSITION[rosterPlayer.role];
      const pool = generateChampionPool(
        rosterPlayer.name,
        position,
        rosterPlayer.stats.ovr,
        rosterPlayer.traits,
      );

      for (const entry of pool) {
        await db.execute(
          `INSERT INTO champion_proficiency (player_id, champion_id, proficiency, games_played)
           VALUES ($1, $2, $3, $4)`,
          [playerId, entry.championId, entry.proficiency, entry.gamesPlayed],
        );
      }
    }
  }
}

/**
 * 전체 데이터 시딩 (트랜잭션)
 */
export async function seedAllData(): Promise<void> {
  const db = await getDatabase();

  await db.execute('BEGIN TRANSACTION');
  try {
    await seedChampions();
    await seedTeams(LCK_TEAMS, 'LCK');
    await seedTeams(LPL_TEAMS, 'LPL');
    await seedTeams(LCS_TEAMS, 'LCS');
    await seedTeams(LEC_TEAMS, 'LEC');
    // 챔피언 숙련도 시딩 (선수 데이터 이후)
    await seedChampionProficiency(LCK_TEAMS, 'LCK');
    await seedChampionProficiency(LPL_TEAMS, 'LPL');
    await seedChampionProficiency(LCS_TEAMS, 'LCS');
    await seedChampionProficiency(LEC_TEAMS, 'LEC');
    await db.execute('COMMIT');
  } catch (error) {
    await db.execute('ROLLBACK');
    throw error;
  }
}
