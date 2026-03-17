/**
 * rosterDb → SQLite 시딩
 * OVR 등급 → 6개 스탯 변환 포함
 */
import { FINANCIAL_CONSTANTS, MATCH_CONSTANTS } from '../data/systemPrompt';
import { LCK_TEAMS, LCS_TEAMS, LEC_TEAMS, LPL_TEAMS } from '../data/rosterDb';
import type { Role, RosterPlayer, TeamData } from '../data/rosterDb';
import type { Position, Region } from '../types';
import { getDatabase } from './database';
import { insertPlayer, insertTeam } from './queries';

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
    await seedTeams(LCK_TEAMS, 'LCK');
    await seedTeams(LPL_TEAMS, 'LPL');
    await seedTeams(LCS_TEAMS, 'LCS');
    await seedTeams(LEC_TEAMS, 'LEC');
    await db.execute('COMMIT');
  } catch (error) {
    await db.execute('ROLLBACK');
    throw error;
  }
}
