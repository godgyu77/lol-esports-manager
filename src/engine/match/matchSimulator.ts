/**
 * 경기 시뮬레이션 엔진
 * - teamRating의 승률을 기반으로 세트(Game) 결과 생성
 * - Bo3/Bo5 포맷 지원
 * - 라인전 → 중반 → 후반 흐름에 따른 이벤트 생성
 * - 멘탈/체력이 후반 세트에 영향
 */

import { MATCH_CONSTANTS } from '../../data/systemPrompt';
import type { Position } from '../../types/game';
import type { Game, MatchEvent, MatchEventType } from '../../types/match';
import type { Player } from '../../types/player';
import {
  type Lineup,
  type MatchupResult,
  evaluateMatchup,
} from './teamRating';
import { createRng } from '../../utils/rng';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export type BoFormat = 'Bo1' | 'Bo3' | 'Bo5';

/** 단일 세트 결과 */
export interface GameResult {
  winnerSide: 'home' | 'away';
  durationMinutes: number;
  goldDiffAt15: number;
  killsHome: number;
  killsAway: number;
  events: MatchEvent[];
}

/** 매치(시리즈) 전체 결과 */
export interface MatchResult {
  scoreHome: number;
  scoreAway: number;
  winner: 'home' | 'away';
  games: GameResult[];
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
  gameNumber: number,
  fatigueHome: number,
  fatigueAway: number,
  seed: string,
): GameResult {
  const rand = createRng(seed);
  const { homeWinRate, homeRating, awayRating, laneMatchups } = matchup;

  // 피로 보정: 후반 세트일수록 체력이 낮은 팀 불리
  const fatigueDiff = (fatigueAway - fatigueHome) * 0.02;
  let currentWinRate = Math.max(0.15, Math.min(0.85, homeWinRate + fatigueDiff));

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

  // 각 라인별 라인전 결과
  for (const pos of positions) {
    if (pos === 'jungle') continue;
    const laneDiff = laneMatchups[pos];
    const laneWin: 'home' | 'away' = laneDiff > 0 ? 'home' : 'away';

    const csDiffGold = Math.round(Math.abs(laneDiff) * 15 + rand() * 200);
    if (laneWin === 'home') goldHome += csDiffGold;
    else goldAway += csDiffGold;

    // 라인전 결과가 승률에 반영
    adjustWinRate(laneDiff * 0.003);

    if (Math.abs(laneDiff) > 5 && rand() < 0.3 + Math.abs(laneDiff) * 0.01) {
      const tick = Math.round(180 + rand() * 720);
      if (laneWin === 'home') { killsHome++; goldHome += 300; adjustWinRate(0.02); }
      else { killsAway++; goldAway += 300; adjustWinRate(-0.02); }
      events.push({ tick, type: 'kill', side: laneWin, description: `${pos} 라인에서 솔로킬 발생`, goldChange: 300 });
    }
  }

  // 정글 갱킹
  const gangkCount = 1 + Math.floor(rand() * 3);
  for (let g = 0; g < gangkCount; g++) {
    const jglDiff = laneMatchups.jungle;
    const gangkSuccess = rand() < 0.5 + jglDiff * 0.01;
    const tick = Math.round(180 + rand() * 600);
    const targetLane = positions[Math.floor(rand() * 3) * 2];

    if (gangkSuccess && jglDiff > 0) {
      killsHome++; goldHome += 450; adjustWinRate(0.025);
      events.push({ tick, type: 'gank', side: 'home', description: `${targetLane} 라인 갱킹 성공`, goldChange: 450 });
    } else if (gangkSuccess && jglDiff <= 0) {
      killsAway++; goldAway += 450; adjustWinRate(-0.025);
      events.push({ tick, type: 'gank', side: 'away', description: `${targetLane} 라인 갱킹 성공`, goldChange: 450 });
    }
  }

  const goldDiffAt15 = goldHome - goldAway;

  // ── 중반 시뮬레이션 (15~25분) ──
  const dragonCount = 2 + Math.floor(rand() * 2);
  for (let d = 0; d < dragonCount; d++) {
    const tick = Math.round(900 + d * 300 + rand() * 180);
    const tfPower = homeRating.teamfightPower - awayRating.teamfightPower;
    const dragonWin = rand() < 0.5 + tfPower * 0.008 + (currentWinRate - 0.5) * 0.15;

    if (dragonWin) {
      goldHome += 200; adjustWinRate(0.03);
      events.push({ tick, type: 'dragon', side: 'home', description: '드래곤 확보', goldChange: 200 });
    } else {
      goldAway += 200; adjustWinRate(-0.03);
      events.push({ tick, type: 'dragon', side: 'away', description: '드래곤 확보', goldChange: 200 });
    }

    if (rand() < 0.6) {
      const teamfightKills = 1 + Math.floor(rand() * 3);
      const tfSide: 'home' | 'away' = dragonWin ? 'home' : 'away';
      if (tfSide === 'home') { killsHome += teamfightKills; goldHome += teamfightKills * 300; adjustWinRate(0.02 * teamfightKills); }
      else { killsAway += teamfightKills; goldAway += teamfightKills * 300; adjustWinRate(-0.02 * teamfightKills); }
      events.push({ tick: tick + 10, type: 'teamfight', side: tfSide, description: `드래곤 교전 ${teamfightKills}킬`, goldChange: teamfightKills * 300 });
    }
  }

  // 타워 (중반)
  const leadingSide: 'home' | 'away' = goldHome > goldAway ? 'home' : 'away';
  const towersTaken = 1 + Math.floor(rand() * 3);
  for (let t = 0; t < towersTaken; t++) {
    const tick = Math.round(1000 + t * 120 + rand() * 300);
    if (leadingSide === 'home') { goldHome += 550; adjustWinRate(0.015); }
    else { goldAway += 550; adjustWinRate(-0.015); }
    events.push({ tick, type: 'tower_destroy', side: leadingSide, description: '외곽 타워 파괴', goldChange: 550 });
  }

  // ── 후반 시뮬레이션 (25분+) ──
  if (durationMinutes > 25) {
    const baronTick = Math.round(1500 + rand() * 300);
    const baronWin = rand() < currentWinRate;
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

  return { winnerSide, durationMinutes, goldDiffAt15, killsHome, killsAway, events };
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
): MatchResult {
  const matchup = evaluateMatchup(homeLineup, awayLineup, homeTraits, awayTraits, homeForm, awayForm);
  const maxGames = format === 'Bo5' ? 5 : format === 'Bo3' ? 3 : 1;
  const winsNeeded = format === 'Bo1' ? 1 : format === 'Bo3' ? 2 : 3;

  let scoreHome = 0;
  let scoreAway = 0;
  const games: GameResult[] = [];

  for (let gameNum = 1; gameNum <= maxGames; gameNum++) {
    if (scoreHome >= winsNeeded || scoreAway >= winsNeeded) break;

    // 후반 세트 피로도: 각 선수의 stamina 평균으로 계산
    const avgStaminaHome = averageStamina(homeLineup);
    const avgStaminaAway = averageStamina(awayLineup);
    const fatigueHome = (gameNum - 1) * (1 - avgStaminaHome / 100) * 2;
    const fatigueAway = (gameNum - 1) * (1 - avgStaminaAway / 100) * 2;

    const seed = `${matchId}_game${gameNum}`;
    const result = simulateGame(matchup, gameNum, fatigueHome, fatigueAway, seed);

    games.push(result);

    if (result.winnerSide === 'home') scoreHome++;
    else scoreAway++;
  }

  return {
    scoreHome,
    scoreAway,
    winner: scoreHome > scoreAway ? 'home' : 'away',
    games,
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
