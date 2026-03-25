/**
 * 경기 시뮬레이션 엔진
 * - teamRating의 승률을 기반으로 세트(Game) 결과 생성
 * - Bo3/Bo5 포맷 지원
 * - 라인전 → 중반 → 후반 흐름에 따른 이벤트 생성
 * - 멘탈/체력이 후반 세트에 영향
 */

import { MATCH_CONSTANTS } from '../../data/systemPrompt';
import type { Position } from '../../types/game';
import type { MatchEvent, DragonType, DragonSoulState } from '../../types/match';
import type { Player } from '../../types/player';
import type { PlayStyle } from '../../types/team';
import type { ChampionSynergy } from '../../types/champion';
import type { TacticsBonus } from '../tactics/tacticsEngine';
import { checkTacticalAdjustment, calculateRoleBonuses } from '../tactics/tacticsEngine';
import type { TeamTactics } from '../../types/tactics';
import {
  type Lineup,
  type MatchupResult,
  evaluateMatchup,
  calculateChampionSynergyBonus,
  evaluateTeamComposition,
} from './teamRating';
import { createRng } from '../../utils/rng';

// ─────────────────────────────────────────
// 드래곤 / 그럽 상수
// ─────────────────────────────────────────

/** 배열에서 최빈값 반환 */
function getMostFrequent<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  const freq = new Map<T, number>();
  for (const item of arr) freq.set(item, (freq.get(item) ?? 0) + 1);
  let maxItem = arr[0];
  let maxCount = 0;
  for (const [item, count] of freq) {
    if (count > maxCount) { maxCount = count; maxItem = item; }
  }
  return maxItem;
}

const DRAGON_TYPES: DragonType[] = ['infernal', 'ocean', 'mountain', 'cloud'];
const DRAGON_SOUL_WIN_RATE_BONUS: Record<DragonType, number> = {
  infernal: 0.10, ocean: 0.07, mountain: 0.08, cloud: 0.06,
};
const DRAGON_STACK_BONUS: Record<DragonType, number> = {
  infernal: 0.020, ocean: 0.012, mountain: 0.015, cloud: 0.010,
};

// ─────────────────────────────────────────
// 챔피언 픽 정보
// ─────────────────────────────────────────

/** 경기에서 사용되는 챔피언 픽 정보 */
export interface MatchChampionPicks {
  picks: { championId: string; position: Position }[];
  /** 챔피언별 스탯 (earlyGame, lateGame, teamfight, splitPush, difficulty) */
  champStats: Record<string, { earlyGame: number; lateGame: number; teamfight: number; splitPush: number; difficulty: number }>;
  /** 챔피언별 태그 */
  champTags: Record<string, string[]>;
  /** 챔피언별 데미지 프로필 */
  champDamageProfiles: Record<string, string>;
  /** 포지션별 선수의 해당 챔피언 숙련도 (0-100) */
  champProficiency: Record<Position, number>;
}

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export type BoFormat = 'Bo1' | 'Bo3' | 'Bo5';

/** 엔진 산출용 선수별 스탯 라인 */
export interface PlayerGameStatLine {
  playerId: string;
  position: Position;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  goldEarned: number;
  damageDealt: number;
}

/** 단일 세트 결과 */
export interface GameResult {
  winnerSide: 'home' | 'away';
  durationMinutes: number;
  goldDiffAt15: number;
  killsHome: number;
  killsAway: number;
  goldHome: number;
  goldAway: number;
  towersHome: number;
  towersAway: number;
  events: MatchEvent[];
  playerStatsHome: PlayerGameStatLine[];
  playerStatsAway: PlayerGameStatLine[];
  /** 드래곤 소울 상태 */
  dragonSoul: DragonSoulState;
  /** 보이드 그럽 (각 팀) */
  grubsHome: number;
  grubsAway: number;
  /** 골드 차이 히스토리 */
  goldHistory: { tick: number; diff: number }[];
}

/** 세트간 선수 교체 기록 */
export interface BetweenGameSubstitution {
  gameNumber: number;
  side: 'home' | 'away';
  outPlayerId: string;
  inPlayerId: string;
  position: Position;
}

/** 매치(시리즈) 전체 결과 */
export interface MatchResult {
  scoreHome: number;
  scoreAway: number;
  winner: 'home' | 'away';
  games: GameResult[];
  /** 세트간 선수 교체 기록 */
  substitutions: BetweenGameSubstitution[];
  /** 사이드 선택 기록 (세트별) */
  sideSelections: { gameNumber: number; blueSide: 'home' | 'away' }[];
}

// ─────────────────────────────────────────
// 전술 이벤트 보정 계수
// ─────────────────────────────────────────

const PLAY_STYLE_EVENT_MODIFIERS: Record<PlayStyle, {
  soloKill: number;
  dragon: number;
  tower: number;
  teamfight: number;
}> = {
  aggressive: { soloKill: 1.3, dragon: 1.0, tower: 0.9, teamfight: 1.3 },
  controlled: { soloKill: 0.8, dragon: 1.2, tower: 1.15, teamfight: 0.7 },
  split: { soloKill: 1.1, dragon: 0.9, tower: 1.1, teamfight: 0.9 },
};

// ─────────────────────────────────────────
// 선수별 스탯 생성 (사후 분배)
// ─────────────────────────────────────────

/** 킬 분배 가중치 (포지션별) */
const KILL_WEIGHT: Record<Position, number> = {
  top: 0.18, jungle: 0.20, mid: 0.22, adc: 0.30, support: 0.10,
};

/** 데스 분배 가중치 (역방향 — 서포트/탑이 더 많이 죽음) */
const DEATH_WEIGHT: Record<Position, number> = {
  top: 0.25, jungle: 0.20, mid: 0.18, adc: 0.15, support: 0.18,
};

/** 데미지 비율 가중치 */
const DAMAGE_WEIGHT: Record<Position, number> = {
  top: 0.18, jungle: 0.15, mid: 0.25, adc: 0.30, support: 0.12,
};

/** CS/분 기본값 */
const BASE_CS_PER_MIN: Record<Position, number> = {
  top: 8.0, jungle: 5.5, mid: 8.5, adc: 9.5, support: 1.5,
};

/**
 * 게임 종료 후 팀 킬/데스를 선수별로 분배
 */
function generatePlayerStats(
  lineup: Lineup,
  teamKills: number,
  teamDeaths: number,
  durationMinutes: number,
  rand: () => number,
): PlayerGameStatLine[] {
  const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
  const stats: PlayerGameStatLine[] = [];

  // 킬 분배 (가중치 + aggression 미세조정)
  const killWeights = positions.map(pos => {
    const base = KILL_WEIGHT[pos];
    const aggressionMod = (lineup[pos].stats.aggression - 60) * 0.002;
    return Math.max(0.05, base + aggressionMod);
  });
  const killWeightSum = killWeights.reduce((a, b) => a + b, 0);
  const killShares = killWeights.map(w => w / killWeightSum);

  // 데스 분배
  const deathShares = positions.map(pos => DEATH_WEIGHT[pos]);
  const deathSum = deathShares.reduce((a, b) => a + b, 0);

  // 분배 실행
  let remainingKills = teamKills;
  let remainingDeaths = teamDeaths;
  const killAssigned: number[] = [];
  const deathAssigned: number[] = [];

  for (let i = 0; i < positions.length; i++) {
    if (i === positions.length - 1) {
      killAssigned.push(Math.max(0, remainingKills));
      deathAssigned.push(Math.max(0, remainingDeaths));
    } else {
      const k = Math.round(teamKills * killShares[i] + (rand() - 0.5) * 1.5);
      const clamped = Math.max(0, Math.min(remainingKills, k));
      killAssigned.push(clamped);
      remainingKills -= clamped;

      const d = Math.round(teamDeaths * (deathShares[i] / deathSum) + (rand() - 0.5) * 1.5);
      const clampedD = Math.max(0, Math.min(remainingDeaths, d));
      deathAssigned.push(clampedD);
      remainingDeaths -= clampedD;
    }
  }

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const player = lineup[pos];
    const kills = killAssigned[i];
    const deaths = deathAssigned[i];

    // 어시스트: 킬당 평균 2명, 킬러 제외 랜덤
    // 서포트는 어시스트 비중 상향 (0.7), 나머지 포지션 (0.5)
    const assistRate = pos === 'support' ? 0.7 : 0.5;
    const assistBase = Math.round((teamKills - kills) * assistRate + rand() * 2);
    const assists = Math.max(0, assistBase);

    // CS
    const laningMod = 1 + (player.stats.laning - 60) * 0.005;
    const cs = Math.round(BASE_CS_PER_MIN[pos] * durationMinutes * laningMod + (rand() - 0.5) * 20);

    // 골드
    const killGold = kills * 275;
    const csGold = cs * 17;
    const baseGold = durationMinutes * 82;
    const goldEarned = killGold + csGold + baseGold;

    // 데미지
    const baseDamage = durationMinutes * 450;
    const mechanicalMod = 1 + (player.stats.mechanical - 60) * 0.005;
    const aggressionMod = 1 + (player.stats.aggression - 60) * 0.003;
    const damageDealt = Math.round(baseDamage * DAMAGE_WEIGHT[pos] / 0.2 * mechanicalMod * aggressionMod + (rand() - 0.5) * 2000);

    stats.push({
      playerId: player.id,
      position: pos,
      kills,
      deaths,
      assists,
      cs: Math.max(0, cs),
      goldEarned: Math.max(0, goldEarned),
      damageDealt: Math.max(0, damageDealt),
    });
  }

  return stats;
}

// ─────────────────────────────────────────
// 단일 세트(Game) 시뮬레이션
// ─────────────────────────────────────────

/**
 * 단일 세트 시뮬레이션
 * @param matchup 매치업 평가 결과
 * @param gameNumber 세트 번호 (1~5)
 * @param fatigueHome 홈 팀 피로도 보정 (0~)
 * @param fatigueAway 어웨이 팀 피로도 보정 (0~)
 * @param seed 난수 시드
 */
function simulateGame(
  matchup: MatchupResult,
  _gameNumber: number,
  fatigueHome: number,
  fatigueAway: number,
  seed: string,
  homeLineup: Lineup,
  awayLineup: Lineup,
  homePlayStyle: PlayStyle = 'controlled',
  awayPlayStyle: PlayStyle = 'controlled',
  homeTacticsBonus?: TacticsBonus,
  awayTacticsBonus?: TacticsBonus,
  homeChampions?: MatchChampionPicks,
  awayChampions?: MatchChampionPicks,
  synergyData: ChampionSynergy[] = [],
  homeTactics?: TeamTactics,
  awayTactics?: TeamTactics,
): GameResult {
  const rand = createRng(seed);
  const { homeWinRate, homeRating, awayRating, laneMatchups } = matchup;

  // 피로 보정: 후반 세트일수록 체력이 낮은 팀 불리 (3배 강화)
  const fatigueDiff = (fatigueAway - fatigueHome) * 0.04;

  // ── 챔피언 보정 ──
  let championBonus = 0;
  if (homeChampions && awayChampions) {
    // 팀 시너지 보너스
    const homeSynergy = calculateChampionSynergyBonus(
      homeChampions.picks, awayChampions.picks, synergyData,
    );
    const awaySynergy = calculateChampionSynergyBonus(
      awayChampions.picks, homeChampions.picks, synergyData,
    );

    // 팀 구성 보너스 (AP/AD 밸런스, 이니시에이터, 한타 잠재력)
    const homeComp = evaluateTeamComposition(
      homeChampions.picks.map(p => ({
        championId: p.championId,
        tags: (homeChampions.champTags[p.championId] ?? []) as import('../../types/champion').ChampionTag[],
        teamfight: homeChampions.champStats[p.championId]?.teamfight ?? 50,
        damageType: inferDamageType(homeChampions.champTags[p.championId] ?? [], homeChampions.champDamageProfiles?.[p.championId]),
      })),
    );
    const awayComp = evaluateTeamComposition(
      awayChampions.picks.map(p => ({
        championId: p.championId,
        tags: (awayChampions.champTags[p.championId] ?? []) as import('../../types/champion').ChampionTag[],
        teamfight: awayChampions.champStats[p.championId]?.teamfight ?? 50,
        damageType: inferDamageType(awayChampions.champTags[p.championId] ?? [], awayChampions.champDamageProfiles?.[p.championId]),
      })),
    );

    // 챔피언 보정: 시너지 + 구성 차이 → 승률 보정 (최대 ±8%)
    championBonus = ((homeSynergy - awaySynergy) + (homeComp - awayComp)) * 0.004;
  }

  let currentWinRate = Math.max(0.15, Math.min(0.85, homeWinRate + fatigueDiff + championBonus));

  /** 승률 보정 (클램프 적용) */
  const adjustWinRate = (delta: number) => {
    currentWinRate = Math.max(0.15, Math.min(0.85, currentWinRate + delta));
  };

  // 경기 시간: 전력 차이가 클수록 빠른 게임 (25~45분)
  const ratingDiff = Math.abs(homeRating.overall - awayRating.overall);
  const baseDuration = MATCH_CONSTANTS.gameDuration.max - ratingDiff * 0.3;
  const durationMinutes = Math.round(
    Math.max(MATCH_CONSTANTS.gameDuration.min,
      Math.min(MATCH_CONSTANTS.gameDuration.max,
        baseDuration + (rand() - 0.5) * 10)),
  );

  // ── 라인전 시뮬레이션 (0~15분) ──
  const events: MatchEvent[] = [];
  let goldHome = 0;
  let goldAway = 0;
  let killsHome = 0;
  let killsAway = 0;

  const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];

  // 전술 보정값 추출 (없으면 0)
  const homeEarly = homeTacticsBonus?.earlyBonus ?? 0;
  const awayEarly = awayTacticsBonus?.earlyBonus ?? 0;
  const homeMid = homeTacticsBonus?.midBonus ?? 0;
  const awayMid = awayTacticsBonus?.midBonus ?? 0;
  const homeLate = homeTacticsBonus?.lateBonus ?? 0;
  const awayLate = awayTacticsBonus?.lateBonus ?? 0;
  const homeObj = homeTacticsBonus?.objectiveBonus ?? 0;
  const awayObj = awayTacticsBonus?.objectiveBonus ?? 0;

  // 역할별 지시 보너스 계산
  const homeRoleBonuses = homeTactics?.roleInstructions ? calculateRoleBonuses(
    homeTactics.roleInstructions,
    Object.fromEntries(positions.map(pos => [pos, homeLineup[pos].stats])) as unknown as Record<Position, { aggression: number; laning: number; gameSense: number }>,
  ) : [];
  const awayRoleBonuses = awayTactics?.roleInstructions ? calculateRoleBonuses(
    awayTactics.roleInstructions,
    Object.fromEntries(positions.map(pos => [pos, awayLineup[pos].stats])) as unknown as Record<Position, { aggression: number; laning: number; gameSense: number }>,
  ) : [];

  // 역할별 보너스를 라인전 승률에 반영
  for (const rb of homeRoleBonuses) {
    adjustWinRate(rb.laningBonus + rb.gankSuccessBonus * 0.5);
  }
  for (const rb of awayRoleBonuses) {
    adjustWinRate(-(rb.laningBonus + rb.gankSuccessBonus * 0.5));
  }

  // 각 라인별 라인전 결과
  for (const pos of positions) {
    if (pos === 'jungle') continue;
    const laneDiff = laneMatchups[pos];
    const laneWin: 'home' | 'away' = laneDiff > 0 ? 'home' : 'away';

    const csDiffGold = Math.round(Math.abs(laneDiff) * 15 + rand() * 200);
    if (laneWin === 'home') goldHome += csDiffGold;
    else goldAway += csDiffGold;

    // 라인전 결과가 승률에 반영 + 전술 초반 보정
    const earlyTacticsDiff = homeEarly - awayEarly;
    adjustWinRate(laneDiff * 0.003 + earlyTacticsDiff * 0.5);

    const soloKillMod = laneWin === 'home'
      ? PLAY_STYLE_EVENT_MODIFIERS[homePlayStyle].soloKill
      : PLAY_STYLE_EVENT_MODIFIERS[awayPlayStyle].soloKill;
    if (Math.abs(laneDiff) > 5 && rand() < (0.3 + Math.abs(laneDiff) * 0.01) * soloKillMod) {
      const tick = Math.round(180 + rand() * 720);
      if (laneWin === 'home') { killsHome++; goldHome += 300; adjustWinRate(0.02); }
      else { killsAway++; goldAway += 300; adjustWinRate(-0.02); }
      events.push({ tick, type: 'kill', side: laneWin, description: `${pos} 라인에서 솔로킬 발생`, goldChange: 300 });
    }
  }

  // 정글 갱킹 (전술 초반 보정: invade → 갱킹 성공률 상승, safe_farm → 안정)
  const gangkCount = 1 + Math.floor(rand() * 3);
  for (let g = 0; g < gangkCount; g++) {
    const jglDiff = laneMatchups.jungle;
    const gangkTacticsMod = (homeEarly - awayEarly) * 0.5;
    const gangkSuccess = rand() < 0.5 + jglDiff * 0.01 + gangkTacticsMod;
    const tick = Math.round(180 + rand() * 600);
    // 갱킹 대상 라인: top(0), mid(2), adc(3) — jungle(1)은 갱킹 주체, support(4)는 제외
    const gangkTargets = [0, 2, 3];
    const targetLane = positions[gangkTargets[Math.floor(rand() * gangkTargets.length)]];

    if (gangkSuccess && jglDiff > 0) {
      killsHome++; goldHome += 450; adjustWinRate(0.025);
      events.push({ tick, type: 'gank', side: 'home', description: `${targetLane} 라인 갱킹 성공`, goldChange: 450 });
    } else if (gangkSuccess && jglDiff <= 0) {
      killsAway++; goldAway += 450; adjustWinRate(-0.025);
      events.push({ tick, type: 'gank', side: 'away', description: `${targetLane} 라인 갱킹 성공`, goldChange: 450 });
    }
  }

  // ── 보이드 그럽 (5~8분, 첫 웨이브) ──
  let grubsHome = 0;
  let grubsAway = 0;
  const grubTick1 = Math.round(300 + rand() * 180);
  const grubWin1 = rand() < currentWinRate;
  const grubSide1: 'home' | 'away' = grubWin1 ? 'home' : 'away';
  if (grubSide1 === 'home') { grubsHome += 3; goldHome += 150; adjustWinRate(0.01); }
  else { grubsAway += 3; goldAway += 150; adjustWinRate(-0.01); }
  events.push({ tick: grubTick1, type: 'void_grub' as MatchEvent['type'], side: grubSide1, description: '보이드 그럽 3마리 처치', goldChange: 150 });

  // 두번째 그럽 웨이브 (11~14분)
  const grubTick2 = Math.round(660 + rand() * 180);
  const grubWin2 = rand() < currentWinRate;
  const grubSide2: 'home' | 'away' = grubWin2 ? 'home' : 'away';
  if (grubSide2 === 'home') { grubsHome += 3; goldHome += 150; adjustWinRate(0.01); }
  else { grubsAway += 3; goldAway += 150; adjustWinRate(-0.01); }
  events.push({ tick: grubTick2, type: 'void_grub' as MatchEvent['type'], side: grubSide2, description: '보이드 그럽 3마리 처치', goldChange: 150 });

  // 6마리 달성 시 추가 타워 공격 보정
  if (grubsHome >= 6) adjustWinRate(0.02);
  if (grubsAway >= 6) adjustWinRate(-0.02);

  // ── 리프트 헤럴드 (14분) ──
  const heraldTick = Math.round(840 + rand() * 60);
  const heraldWin = rand() < currentWinRate;
  const heraldSide: 'home' | 'away' = heraldWin ? 'home' : 'away';
  if (heraldSide === 'home') { goldHome += 400; adjustWinRate(0.02); }
  else { goldAway += 400; adjustWinRate(-0.02); }
  events.push({ tick: heraldTick, type: 'rift_herald', side: heraldSide, description: '리프트 헤럴드 처치', goldChange: 400 });

  // 헤럴드 → 타워 파괴
  if (rand() < 0.7) {
    if (heraldSide === 'home') goldHome += 550;
    else goldAway += 550;
    events.push({ tick: heraldTick + 30, type: 'tower_destroy', side: heraldSide, description: '헤럴드로 1티어 타워 파괴', goldChange: 550 });
  }

  // 다이브 이벤트 (라인전 후반)
  for (const pos of positions) {
    if (pos === 'jungle' || pos === 'support') continue;
    const laneDiff = laneMatchups[pos];
    if (Math.abs(laneDiff) > 8 && rand() < 0.25) {
      const diveSide: 'home' | 'away' = laneDiff > 0 ? 'home' : 'away';
      const diveTick = Math.round(600 + rand() * 300);
      if (diveSide === 'home') { killsHome++; goldHome += 450; adjustWinRate(0.025); }
      else { killsAway++; goldAway += 450; adjustWinRate(-0.025); }
      events.push({ tick: diveTick, type: 'dive', side: diveSide, description: `${pos} 타워 다이브 성공`, goldChange: 450 });
    }
  }

  // 인베이드 이벤트 (초반 전술에 따라)
  if ((homeEarly > 0.03 || awayEarly > 0.03) && rand() < 0.3) {
    const invadeSide: 'home' | 'away' = homeEarly > awayEarly ? 'home' : 'away';
    if (invadeSide === 'home') { killsHome++; goldHome += 400; adjustWinRate(0.02); }
    else { killsAway++; goldAway += 400; adjustWinRate(-0.02); }
    events.push({ tick: Math.round(60 + rand() * 120), type: 'invade', side: invadeSide, description: '정글 인베이드 성공', goldChange: 400 });
  }

  const goldDiffAt15 = goldHome - goldAway;

  // 골드 차이 → 승률 동적 반영 (3000골드당 +3%)
  adjustWinRate(goldDiffAt15 / 3000 * 0.03);

  // 챔피언 초반력 보정 (earlyGame 스탯 평균 비교)
  if (homeChampions && awayChampions) {
    const homeEarlyAvg = homeChampions.picks.reduce((s, p) => s + (homeChampions.champStats[p.championId]?.earlyGame ?? 50), 0) / 5;
    const awayEarlyAvg = awayChampions.picks.reduce((s, p) => s + (awayChampions.champStats[p.championId]?.earlyGame ?? 50), 0) / 5;
    adjustWinRate((homeEarlyAvg - awayEarlyAvg) * 0.001); // 초반 챔피언 차이 반영
  }

  // ── 중반 시뮬레이션 (15~25분) — 드래곤 타입/소울 시스템 ──
  const dragonSoul: DragonSoulState = { homeStacks: 0, awayStacks: 0, dragonTypes: [] };
  const dragonCount = 2 + Math.floor(rand() * 2);
  for (let d = 0; d < dragonCount; d++) {
    const tick = Math.round(900 + d * 300 + rand() * 180);
    const tfPower = homeRating.teamfightPower - awayRating.teamfightPower;
    const dragonModHome = PLAY_STYLE_EVENT_MODIFIERS[homePlayStyle].dragon;
    const dragonModAway = PLAY_STYLE_EVENT_MODIFIERS[awayPlayStyle].dragon;
    const dragonBias = (dragonModHome - dragonModAway) * 0.05;
    const midTacticsDiff = (homeMid - awayMid) + (homeObj - awayObj);
    const dragonWin = rand() < 0.5 + tfPower * 0.008 + (currentWinRate - 0.5) * 0.15 + dragonBias + midTacticsDiff;

    // 드래곤 타입 결정
    const dragonType = DRAGON_TYPES[Math.floor(rand() * DRAGON_TYPES.length)];

    if (dragonWin) {
      goldHome += 200;
      dragonSoul.homeStacks++;
      dragonSoul.dragonTypes.push({ type: dragonType, side: 'home' });
      adjustWinRate(DRAGON_STACK_BONUS[dragonType]);
      events.push({ tick, type: 'dragon', side: 'home', description: `${dragonType} 드래곤 확보`, goldChange: 200 });

      // 소울 달성 체크 (4스택) — 소울 타입은 해당 팀이 잡은 드래곤 중 최빈 타입
      if (dragonSoul.homeStacks >= 4 && !dragonSoul.soulTeam) {
        dragonSoul.soulTeam = 'home';
        const homeDragons = dragonSoul.dragonTypes.filter(d => d.side === 'home').map(d => d.type);
        const soulType = getMostFrequent(homeDragons) ?? dragonType;
        dragonSoul.soulType = soulType;
        adjustWinRate(DRAGON_SOUL_WIN_RATE_BONUS[soulType]);
      }
    } else {
      goldAway += 200;
      dragonSoul.awayStacks++;
      dragonSoul.dragonTypes.push({ type: dragonType, side: 'away' });
      adjustWinRate(-DRAGON_STACK_BONUS[dragonType]);
      events.push({ tick, type: 'dragon', side: 'away', description: `${dragonType} 드래곤 확보`, goldChange: 200 });

      if (dragonSoul.awayStacks >= 4 && !dragonSoul.soulTeam) {
        dragonSoul.soulTeam = 'away';
        const awayDragons = dragonSoul.dragonTypes.filter(d => d.side === 'away').map(d => d.type);
        const soulType = getMostFrequent(awayDragons) ?? dragonType;
        dragonSoul.soulType = soulType;
        adjustWinRate(-DRAGON_SOUL_WIN_RATE_BONUS[soulType]);
      }
    }

    const tfMod = dragonWin
      ? PLAY_STYLE_EVENT_MODIFIERS[homePlayStyle].teamfight
      : PLAY_STYLE_EVENT_MODIFIERS[awayPlayStyle].teamfight;
    if (rand() < 0.6 * tfMod) {
      const teamfightKills = 1 + Math.floor(rand() * 3);
      const tfSide: 'home' | 'away' = dragonWin ? 'home' : 'away';
      if (tfSide === 'home') { killsHome += teamfightKills; goldHome += teamfightKills * 300; adjustWinRate(0.02 * teamfightKills); }
      else { killsAway += teamfightKills; goldAway += teamfightKills * 300; adjustWinRate(-0.02 * teamfightKills); }
      events.push({ tick: tick + 10, type: 'teamfight', side: tfSide, description: `드래곤 교전 ${teamfightKills}킬`, goldChange: teamfightKills * 300 });
    }
  }

  // 타워 (중반)
  const leadingSide: 'home' | 'away' = goldHome > goldAway ? 'home' : 'away';
  const towerMod = PLAY_STYLE_EVENT_MODIFIERS[leadingSide === 'home' ? homePlayStyle : awayPlayStyle].tower;
  const towersTaken = Math.round((1 + Math.floor(rand() * 3)) * towerMod);
  for (let t = 0; t < towersTaken; t++) {
    const tick = Math.round(1000 + t * 120 + rand() * 300);
    if (leadingSide === 'home') { goldHome += 550; adjustWinRate(0.015); }
    else { goldAway += 550; adjustWinRate(-0.015); }
    events.push({ tick, type: 'tower_destroy', side: leadingSide, description: '외곽 타워 파괴', goldChange: 550 });
  }

  // 인게임 전술 전환 (중반 골드 차이/초반 상황 기반)
  const currentGoldDiff = goldHome - goldAway;
  const isWinningEarly = currentWinRate > 0.5;
  if (homeTactics) {
    const adjusted = checkTacticalAdjustment(homeTactics, currentGoldDiff, isWinningEarly);
    if (adjusted) {
      adjustWinRate((adjusted.lateBonus - (homeTacticsBonus?.lateBonus ?? 0)) * 0.5);
    }
  }
  if (awayTactics) {
    const adjusted = checkTacticalAdjustment(awayTactics, -currentGoldDiff, !isWinningEarly);
    if (adjusted) {
      adjustWinRate(-(adjusted.lateBonus - (awayTacticsBonus?.lateBonus ?? 0)) * 0.5);
    }
  }

  // 챔피언 후반력 보정 (lateGame 스탯 평균 비교)
  if (homeChampions && awayChampions) {
    const homeLateAvg = homeChampions.picks.reduce((s, p) => s + (homeChampions.champStats[p.championId]?.lateGame ?? 50), 0) / 5;
    const awayLateAvg = awayChampions.picks.reduce((s, p) => s + (awayChampions.champStats[p.championId]?.lateGame ?? 50), 0) / 5;
    adjustWinRate((homeLateAvg - awayLateAvg) * 0.0015); // 후반 스케일링 챔피언 반영
  }

  // ── 후반 시뮬레이션 (25분+) ──
  if (durationMinutes > 25) {
    const baronTick = Math.round(1500 + rand() * 300);
    // 전술 후반 보정 + 오브젝트 우선도 보정
    const lateTacticsDiff = (homeLate - awayLate) + (homeObj - awayObj);
    const baronWin = rand() < currentWinRate + lateTacticsDiff;
    const baronSide: 'home' | 'away' = baronWin ? 'home' : 'away';

    if (baronSide === 'home') { goldHome += 1500; adjustWinRate(0.06); }
    else { goldAway += 1500; adjustWinRate(-0.06); }
    events.push({ tick: baronTick, type: 'baron', side: baronSide, description: '내셔 남작 처치', goldChange: 1500 });

    if (rand() < 0.7) {
      const baronKills = 2 + Math.floor(rand() * 3);
      if (baronSide === 'home') { killsHome += baronKills; goldHome += baronKills * 300; adjustWinRate(0.02 * baronKills); }
      else { killsAway += baronKills; goldAway += baronKills * 300; adjustWinRate(-0.02 * baronKills); }
      events.push({ tick: baronTick + 15, type: 'teamfight', side: baronSide, description: `바론 교전 ${baronKills}킬`, goldChange: baronKills * 300 });
    }

    // 후반 타워 (현재 유리한 쪽이 밀어냄)
    const lateLead: 'home' | 'away' = currentWinRate >= 0.5 ? 'home' : 'away';
    const lateTowers = 1 + Math.floor(rand() * 2);
    for (let t = 0; t < lateTowers; t++) {
      const tick = Math.round(baronTick + 60 + t * 90);
      if (lateLead === 'home') goldHome += 550;
      else goldAway += 550;
      events.push({ tick, type: 'tower_destroy', side: lateLead, description: '내부 타워 파괴', goldChange: 550 });
    }

    // 바론 스틸 이벤트 (5% 확률, 지고 있는 팀이 시도)
    const losingSide: 'home' | 'away' = baronSide === 'home' ? 'away' : 'home';
    if (rand() < 0.05) {
      if (losingSide === 'home') { goldHome += 1500; adjustWinRate(0.08); }
      else { goldAway += 1500; adjustWinRate(-0.08); }
      events.push({ tick: baronTick + 5, type: 'steal', side: losingSide, description: '바론 스틸! 역전의 기회', goldChange: 1500 });
    }
  }

  // 엘더 드래곤 (35분 이상 장기전)
  if (durationMinutes > 35) {
    const elderTick = Math.round(2100 + rand() * 300);
    const elderWin = rand() < currentWinRate;
    const elderSide: 'home' | 'away' = elderWin ? 'home' : 'away';
    if (elderSide === 'home') { adjustWinRate(0.10); }
    else { adjustWinRate(-0.10); }
    events.push({ tick: elderTick, type: 'elder_dragon', side: elderSide, description: '장로 드래곤 처치! 강력한 버프 획득', goldChange: 0 });

    // 엘더 후 교전 → 에이스 가능
    if (rand() < 0.4) {
      const aceKills = 4 + Math.floor(rand() * 2);
      if (elderSide === 'home') { killsHome += aceKills; goldHome += aceKills * 300; adjustWinRate(0.05); }
      else { killsAway += aceKills; goldAway += aceKills * 300; adjustWinRate(-0.05); }
      events.push({ tick: elderTick + 20, type: 'ace', side: elderSide, description: `에이스! ${aceKills}킬로 상대 전멸`, goldChange: aceKills * 300 });
    }
  }

  // 최종 승패: 누적된 승률을 기반으로 결정
  const winnerSide: 'home' | 'away' = rand() < currentWinRate ? 'home' : 'away';

  // 최종 교전
  const finalTick = durationMinutes * 60 - 30;
  const finalKills = 1 + Math.floor(rand() * 4);
  if (winnerSide === 'home') { killsHome += finalKills; goldHome += finalKills * 300; }
  else { killsAway += finalKills; goldAway += finalKills * 300; }
  events.push({ tick: finalTick, type: 'teamfight', side: winnerSide, description: `마지막 교전 ${finalKills}킬로 게임 종료`, goldChange: finalKills * 300 });

  // 패배 팀 최소 킬 보장
  if (winnerSide === 'home' && killsAway < 3) killsAway += Math.floor(rand() * 4) + 1;
  if (winnerSide === 'away' && killsHome < 3) killsHome += Math.floor(rand() * 4) + 1;

  events.sort((a, b) => a.tick - b.tick);

  // 타워 파괴 횟수 집계 (events에서 tower_destroy 카운트)
  const towersHome = events.filter(e => e.type === 'tower_destroy' && e.side === 'home').length;
  const towersAway = events.filter(e => e.type === 'tower_destroy' && e.side === 'away').length;

  // 골드 히스토리: 15분 골드차 + 최종 골드차
  const finalGoldDiff = goldHome - goldAway;
  const goldHistory: { tick: number; diff: number }[] = [
    { tick: 900, diff: goldDiffAt15 },
    { tick: durationMinutes * 60, diff: finalGoldDiff },
  ];

  // 선수별 스탯 생성 (사후 분배)
  const playerStatsHome = generatePlayerStats(homeLineup, killsHome, killsAway, durationMinutes, rand);
  const playerStatsAway = generatePlayerStats(awayLineup, killsAway, killsHome, durationMinutes, rand);

  return { winnerSide, durationMinutes, goldDiffAt15, killsHome, killsAway, goldHome, goldAway, towersHome, towersAway, events, playerStatsHome, playerStatsAway, dragonSoul, grubsHome, grubsAway, goldHistory };
}

// ─────────────────────────────────────────
// 세트간 교체 로직 (AI 자동)
// ─────────────────────────────────────────

/**
 * 게임 결과에서 가장 성적이 나쁜 선수의 포지션을 찾는다.
 * 기준: deaths 최대 & KDA 최저
 */
function findWorstPerformer(stats: PlayerGameStatLine[]): Position | null {
  if (stats.length === 0) return null;
  let worst = stats[0];
  let worstKda = (worst.kills + worst.assists) / Math.max(1, worst.deaths);
  for (const s of stats) {
    const kda = (s.kills + s.assists) / Math.max(1, s.deaths);
    // 더 많이 죽고 KDA도 낮으면 교체 후보
    if (s.deaths > worst.deaths || (s.deaths === worst.deaths && kda < worstKda)) {
      worst = s;
      worstKda = kda;
    }
  }
  return worst.position;
}

/**
 * 벤치에서 해당 포지션에 투입 가능한 선수를 찾는다.
 * 주포지션 또는 부포지션이 일치하는 선수 중 가장 높은 전투력을 가진 선수 반환.
 */
function findBenchReplacement(bench: Player[], position: Position, currentPlayerId: string): Player | null {
  const candidates = bench.filter(p =>
    p.id !== currentPlayerId && (p.position === position || p.secondaryPosition === position),
  );
  if (candidates.length === 0) return null;
  // 종합 스탯 기준 정렬
  candidates.sort((a, b) => {
    const ratingA = a.stats.mechanical * 0.2 + a.stats.gameSense * 0.2 + a.stats.teamwork * 0.15 + a.stats.consistency * 0.15 + a.stats.laning * 0.15 + a.stats.aggression * 0.15;
    const ratingB = b.stats.mechanical * 0.2 + b.stats.gameSense * 0.2 + b.stats.teamwork * 0.15 + b.stats.consistency * 0.15 + b.stats.laning * 0.15 + b.stats.aggression * 0.15;
    return ratingB - ratingA;
  });
  return candidates[0];
}

/**
 * AI 팀의 세트간 교체 시도
 * @returns 교체 정보 또는 null
 */
function attemptSubstitution(
  lineup: Lineup,
  bench: Player[],
  lastGameStats: PlayerGameStatLine[],
  scoreDiff: number,
  rand: () => number,
): { position: Position; outPlayer: Player; inPlayer: Player } | null {
  if (bench.length === 0) return null;

  // 교체 확률: 1점차 뒤지면 25%, 2점차 이상 뒤지면 40%
  const subProbability = Math.abs(scoreDiff) >= 2 ? 0.40 : 0.25;
  if (rand() >= subProbability) return null;

  const worstPos = findWorstPerformer(lastGameStats);
  if (!worstPos) return null;

  const currentPlayer = lineup[worstPos];
  const replacement = findBenchReplacement(bench, worstPos, currentPlayer.id);
  if (!replacement) return null;

  return { position: worstPos, outPlayer: currentPlayer, inPlayer: replacement };
}

// ─────────────────────────────────────────
// 시리즈 모멘텀/틸트 시스템
// ─────────────────────────────────────────

interface MomentumState {
  homeConsecutiveWins: number;
  awayConsecutiveWins: number;
  /** 홈 팀이 뒤쳐진 적이 있었는지 */
  homeWasBehind: boolean;
  awayWasBehind: boolean;
}

/**
 * 시리즈 모멘텀 보정값 계산 (홈 기준, 양수면 홈 유리)
 */
function calculateMomentumModifier(
  state: MomentumState,
  lastGameWinner: 'home' | 'away',
  _scoreHome: number,
  _scoreAway: number,
  homeLineup: Lineup,
  awayLineup: Lineup,
  gameNum: number,
  maxGames: number,
  rand: () => number,
): number {
  let modifier = 0;
  const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];

  // 1. 연승 보너스: 시리즈 내 연속 승리 → +4% per streak
  if (state.homeConsecutiveWins > 1) {
    modifier += (state.homeConsecutiveWins - 1) * 0.04;
  }
  if (state.awayConsecutiveWins > 1) {
    modifier -= (state.awayConsecutiveWins - 1) * 0.04;
  }

  // 2. 컴백 모멘텀: 뒤지고 있다가 이기면 +6% 사기 부스트
  if (lastGameWinner === 'home' && state.homeWasBehind) {
    modifier += 0.06;
  }
  if (lastGameWinner === 'away' && state.awayWasBehind) {
    modifier -= 0.06;
  }

  // 3. 틸트: 패배 팀에서 멘탈이 낮은 선수 → -2~6% 페널티
  const losingLineup = lastGameWinner === 'home' ? awayLineup : homeLineup;
  const losingSide = lastGameWinner === 'home' ? 'away' : 'home';
  for (const pos of positions) {
    const player = losingLineup[pos];
    if (player.mental.mental < 50) {
      // 멘탈이 낮을수록 큰 페널티 (30 → -6%, 40 → -4%, 50 → 0%)
      const tiltPenalty = (50 - player.mental.mental) / 50 * 0.06 * (0.5 + rand() * 0.5);
      if (losingSide === 'home') modifier -= tiltPenalty;
      else modifier += tiltPenalty;
    }
  }

  // 4. 베테랑 클러치: 24세+ & 높은 consistency → 결정 세트(Bo3 game3, Bo5 game5)에서 +2%
  const isDecidingGame = (maxGames === 3 && gameNum === 3) || (maxGames === 5 && gameNum === 5);
  if (isDecidingGame) {
    for (const pos of positions) {
      const homePlayer = homeLineup[pos];
      if (homePlayer.age >= 24 && homePlayer.stats.consistency >= 70) {
        modifier += 0.02;
      }
      const awayPlayer = awayLineup[pos];
      if (awayPlayer.age >= 24 && awayPlayer.stats.consistency >= 70) {
        modifier -= 0.02;
      }
    }
  }

  // 클램프: 모멘텀 합산 최대 ±8%
  return Math.max(-0.08, Math.min(0.08, modifier));
}

// ─────────────────────────────────────────
// 시리즈(Bo3/Bo5) 시뮬레이션
// ─────────────────────────────────────────

/**
 * 전체 매치 시뮬레이션
 * @param homeLineup 홈 팀 라인업
 * @param awayLineup 어웨이 팀 라인업
 * @param format Bo1/Bo3/Bo5
 * @param matchId 매치 ID (시드용)
 * @param homeTraits 홈 팀 선수별 특성
 * @param awayTraits 어웨이 팀 선수별 특성
 * @param homeForm 홈 팀 선수별 폼
 * @param awayForm 어웨이 팀 선수별 폼
 */
export function simulateMatch(
  homeLineup: Lineup,
  awayLineup: Lineup,
  format: BoFormat,
  matchId: string,
  homeTraits: Record<string, string[]> = {},
  awayTraits: Record<string, string[]> = {},
  homeForm: Record<string, number> = {},
  awayForm: Record<string, number> = {},
  homePlayStyle: PlayStyle = 'controlled',
  awayPlayStyle: PlayStyle = 'controlled',
  homeTacticsBonus?: TacticsBonus,
  awayTacticsBonus?: TacticsBonus,
  homeChampions?: MatchChampionPicks,
  awayChampions?: MatchChampionPicks,
  synergyData?: ChampionSynergy[],
  homeTactics?: TeamTactics,
  awayTactics?: TeamTactics,
  /** 홈 팀 벤치 선수 목록 (세트간 교체용) */
  homeBench: Player[] = [],
  /** 어웨이 팀 벤치 선수 목록 (세트간 교체용) */
  awayBench: Player[] = [],
  /** 홈 팀 추가 보너스 (케미스트리+솔로랭크) */
  homeExtraBonus?: number,
  /** 어웨이 팀 추가 보너스 (케미스트리+솔로랭크) */
  awayExtraBonus?: number,
): MatchResult {
  // 챔피언 숙련도/난이도 추출
  const homeChampProf = homeChampions?.champProficiency;
  const awayChampProf = awayChampions?.champProficiency;
  const extractDifficulty = (picks: MatchChampionPicks | undefined): Record<Position, number> | undefined => {
    if (!picks) return undefined;
    const result = {} as Record<Position, number>;
    for (const p of picks.picks) {
      if (p.position) result[p.position] = picks.champStats[p.championId]?.difficulty ?? 50;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  };
  const homeChampDiff = extractDifficulty(homeChampions);
  const awayChampDiff = extractDifficulty(awayChampions);

  let currentHomeLineup = homeLineup;
  let currentAwayLineup = awayLineup;

  const matchup = evaluateMatchup(currentHomeLineup, currentAwayLineup, homeTraits, awayTraits, homeForm, awayForm, homePlayStyle, awayPlayStyle, homeChampProf, awayChampProf, homeChampDiff, awayChampDiff, homeExtraBonus, awayExtraBonus);
  const maxGames = format === 'Bo5' ? 5 : format === 'Bo3' ? 3 : 1;
  const winsNeeded = format === 'Bo1' ? 1 : format === 'Bo3' ? 2 : 3;

  let scoreHome = 0;
  let scoreAway = 0;
  const games: GameResult[] = [];
  const substitutions: BetweenGameSubstitution[] = [];
  const sideSelections: { gameNumber: number; blueSide: 'home' | 'away' }[] = [];

  // 모멘텀 상태 추적
  const momentum: MomentumState = {
    homeConsecutiveWins: 0,
    awayConsecutiveWins: 0,
    homeWasBehind: false,
    awayWasBehind: false,
  };
  let momentumModifier = 0;

  // 벤치 선수 풀 (교체 시 소진되지 않도록 복사)
  const homeBenchPool = [...homeBench];
  const awayBenchPool = [...awayBench];

  for (let gameNum = 1; gameNum <= maxGames; gameNum++) {
    if (scoreHome >= winsNeeded || scoreAway >= winsNeeded) break;

    // ── 사이드 선택: 홀수 세트는 홈팀 블루, 짝수 세트는 어웨이 블루 ──
    const blueSide: 'home' | 'away' = gameNum % 2 === 1 ? 'home' : 'away';
    sideSelections.push({ gameNumber: gameNum, blueSide });

    // 블루 사이드 미세 보정 (선픽 이점 +1%)
    const sideBonus = blueSide === 'home' ? 0.01 : -0.01;

    // 후반 세트 피로도: 각 선수의 stamina 평균으로 계산
    const avgStaminaHome = averageStamina(currentHomeLineup);
    const avgStaminaAway = averageStamina(currentAwayLineup);
    const fatigueHome = (gameNum - 1) * (1 - avgStaminaHome / 100) * 2;
    const fatigueAway = (gameNum - 1) * (1 - avgStaminaAway / 100) * 2;

    // 매치업 재평가 (세트간 교체 반영)
    const gameMatchup = gameNum === 1
      ? matchup
      : evaluateMatchup(currentHomeLineup, currentAwayLineup, homeTraits, awayTraits, homeForm, awayForm, homePlayStyle, awayPlayStyle, homeChampProf, awayChampProf, homeChampDiff, awayChampDiff, homeExtraBonus, awayExtraBonus);

    // 사이드 보정 + 모멘텀 보정 적용
    gameMatchup.homeWinRate = Math.max(0.15, Math.min(0.85, gameMatchup.homeWinRate + sideBonus + momentumModifier));

    const seed = `${matchId}_game${gameNum}`;
    const result = simulateGame(gameMatchup, gameNum, fatigueHome, fatigueAway, seed, currentHomeLineup, currentAwayLineup, homePlayStyle, awayPlayStyle, homeTacticsBonus, awayTacticsBonus, homeChampions, awayChampions, synergyData ?? [], homeTactics, awayTactics);

    games.push(result);

    if (result.winnerSide === 'home') scoreHome++;
    else scoreAway++;

    // 시리즈가 끝나지 않았으면 세트간 로직 적용
    if (scoreHome < winsNeeded && scoreAway < winsNeeded) {
      const subRand = createRng(`${matchId}_sub_${gameNum}`);

      // ── 모멘텀 상태 업데이트 ──
      if (result.winnerSide === 'home') {
        momentum.homeConsecutiveWins++;
        momentum.awayConsecutiveWins = 0;
      } else {
        momentum.awayConsecutiveWins++;
        momentum.homeConsecutiveWins = 0;
      }
      // 뒤처진 경험 추적
      if (scoreHome < scoreAway) momentum.homeWasBehind = true;
      if (scoreAway < scoreHome) momentum.awayWasBehind = true;

      // 모멘텀 보정값 계산 (다음 세트에 적용)
      momentumModifier = calculateMomentumModifier(
        momentum,
        result.winnerSide,
        scoreHome,
        scoreAway,
        currentHomeLineup,
        currentAwayLineup,
        gameNum + 1,
        maxGames,
        subRand,
      );

      // ── 세트간 선수 교체 (AI 자동, Bo3/Bo5만) ──
      if (format !== 'Bo1') {
        // 패배 팀이 교체를 시도
        if (result.winnerSide === 'away') {
          // 홈 팀 패배 → 홈 팀 교체 시도
          const sub = attemptSubstitution(
            currentHomeLineup,
            homeBenchPool,
            result.playerStatsHome,
            scoreHome - scoreAway,
            subRand,
          );
          if (sub) {
            // 라인업 업데이트 (새 객체 생성)
            currentHomeLineup = { ...currentHomeLineup, [sub.position]: sub.inPlayer };
            // 벤치에서 투입된 선수 제거, 교체된 선수를 벤치에 추가
            const idx = homeBenchPool.findIndex(p => p.id === sub.inPlayer.id);
            if (idx >= 0) homeBenchPool.splice(idx, 1);
            homeBenchPool.push(sub.outPlayer);
            substitutions.push({
              gameNumber: gameNum,
              side: 'home',
              outPlayerId: sub.outPlayer.id,
              inPlayerId: sub.inPlayer.id,
              position: sub.position,
            });
          }
        } else {
          // 어웨이 팀 패배 → 어웨이 팀 교체 시도
          const sub = attemptSubstitution(
            currentAwayLineup,
            awayBenchPool,
            result.playerStatsAway,
            scoreAway - scoreHome,
            subRand,
          );
          if (sub) {
            currentAwayLineup = { ...currentAwayLineup, [sub.position]: sub.inPlayer };
            const idx = awayBenchPool.findIndex(p => p.id === sub.inPlayer.id);
            if (idx >= 0) awayBenchPool.splice(idx, 1);
            awayBenchPool.push(sub.outPlayer);
            substitutions.push({
              gameNumber: gameNum,
              side: 'away',
              outPlayerId: sub.outPlayer.id,
              inPlayerId: sub.inPlayer.id,
              position: sub.position,
            });
          }
        }
      }
    }
  }

  return {
    scoreHome,
    scoreAway,
    // 동점 방어: 골드 합산이 높은 쪽 승리, 그래도 동점이면 홈 어드밴티지
    winner: scoreHome > scoreAway ? 'home' : scoreAway > scoreHome ? 'away' : 'home',
    games,
    substitutions,
    sideSelections,
  };
}

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

/** 라인업 평균 체력 */
function averageStamina(lineup: Lineup): number {
  const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
  const total = positions.reduce((sum, pos) => sum + lineup[pos].mental.stamina, 0);
  return total / 5;
}

/** 챔피언 데미지 프로필 → 팀 구성 평가용 변환 */
function inferDamageType(tags: string[], damageProfile?: string): 'ap' | 'ad' | 'mixed' {
  // damageProfile이 있으면 우선 사용
  if (damageProfile === 'magic') return 'ap';
  if (damageProfile === 'physical') return 'ad';
  if (damageProfile === 'hybrid' || damageProfile === 'true') return 'mixed';
  // fallback: 태그 기반 추론
  const isMage = tags.includes('mage');
  const isAD = tags.includes('marksman') || tags.includes('fighter') || tags.includes('assassin');
  if (isMage && !isAD) return 'ap';
  if (isAD && !isMage) return 'ad';
  return 'mixed';
}
