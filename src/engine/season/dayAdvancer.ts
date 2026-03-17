/**
 * 일간 진행 시스템 (FM 스타일)
 * - "다음 날" → 해당 일의 활동 처리 (훈련/스크림/휴식/경기)
 * - 경기일: 유저 팀 경기 → LiveMatchEngine 으로 분기, 타 팀 경기 → 자동 시뮬
 * - 비경기일: 훈련/스크림/휴식에 따른 선수 컨디션 변화
 */

import type { GameMode } from '../../types/game';
import type { Match } from '../../types/match';
import { getDatabase } from '../../db/database';
import {
  getAllPlayersGroupedByTeam,
  getMatchesByDate,
  getPlayersByTeamId,
  getTraitsByTeamId,
  getFormByTeamId,
  updateMatchResult,
  updateSeasonDate,
  getTeamConditions,
  batchUpsertPlayerConditions,
  insertDailyEvent,
  insertGameResult,
  getActiveSeason,
} from '../../db/queries';
import { type Lineup, buildLineup } from '../match/teamRating';
import { simulateMatch, type BoFormat, type MatchResult } from '../match/matchSimulator';
import { type DayType, parseDate, addDays, getDayName } from './calendar';
import { processWeeklyFinances } from '../economy/financeEngine';
import { processAIFreeAgentSignings } from '../economy/transferEngine';
import { processPlayoffMatchResult } from './playoffGenerator';
import { processTournamentMatchResult } from '../tournament/tournamentEngine';
import { generateDailyEvent } from '../../ai/gameAiService';
import { generatePatch } from '../champion/patchEngine';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

/** 하루 진행 결과 */
export interface DayResult {
  date: string;
  /** DB에 저장된 다음 날짜 (UI 동기화용) */
  nextDate: string;
  dayOfWeek: number;
  dayName: string;
  dayType: DayType;
  /** 경기일일 때 경기 결과 */
  matchResults: DayMatchResult[];
  /** 유저 팀 경기가 있는지 (있으면 UI에서 LiveMatch로 분기) */
  hasUserMatch: boolean;
  /** 유저 팀 경기 정보 (LiveMatch 진입용) */
  userMatch?: Match;
  /** 일간 이벤트 설명 */
  events: string[];
  /** 시즌 종료 여부 (true이면 UI에서 시즌 종료 화면 표시) */
  isSeasonEnd?: boolean;
}

/** 개별 경기 결과 (자동 시뮬된 타 팀 경기) */
interface DayMatchResult {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  result: MatchResult;
  isUserMatch: boolean;
}

// ─────────────────────────────────────────
// 컨디션 시스템
// ─────────────────────────────────────────

/** 훈련 효과: 스태미나 소모, 폼 상승 */
const TRAINING_EFFECT = { stamina: -8, morale: 0, form: 5 };
/** 스크림 효과: 스태미나 많이 소모, 폼 크게 상승 */
const SCRIM_EFFECT = { stamina: -12, morale: 2, form: 8 };
/** 휴식 효과: 스태미나 회복, 사기 회복 */
const REST_EFFECT = { stamina: 15, morale: 5, form: -2 };
/** 경기일 효과: 스태미나 크게 소모 */
const MATCH_DAY_EFFECT = { stamina: -20, morale: 0, form: 0 };

/** 컨디션 클램프 */
function clampCondition(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 전체 팀 선수 컨디션 일괄 업데이트 (배치)
 * 팀별로 전일 컨디션을 배치 조회 → 계산 → 배치 저장
 */
async function updateAllTeamConditions(
  date: string,
  prevDate: string,
  dayType: DayType,
): Promise<void> {
  const effect =
    dayType === 'training' ? TRAINING_EFFECT
    : dayType === 'scrim' ? SCRIM_EFFECT
    : dayType === 'rest' ? REST_EFFECT
    : dayType === 'match_day' ? MATCH_DAY_EFFECT
    : { stamina: 5, morale: 0, form: 0 };

  // 전체 팀-선수 맵 일괄 로딩 (1 쿼리)
  const playersByTeam = await getAllPlayersGroupedByTeam();
  const allRecords: { playerId: string; gameDate: string; stamina: number; morale: number; form: number }[] = [];

  for (const [teamId, players] of playersByTeam) {
    // 팀 전일 컨디션 배치 조회 (1 쿼리/팀)
    const prevConditions = await getTeamConditions(teamId, prevDate);

    for (const player of players) {
      const prev = prevConditions.get(player.id);
      const baseStamina = prev?.stamina ?? player.mental.stamina;
      const baseMorale = prev?.morale ?? player.mental.morale;
      const baseForm = prev?.form ?? 50;

      const variance = Math.floor(Math.random() * 7) - 3;

      allRecords.push({
        playerId: player.id,
        gameDate: date,
        stamina: clampCondition(baseStamina + effect.stamina + variance),
        morale: clampCondition(baseMorale + effect.morale + Math.floor(variance / 2)),
        form: clampCondition(baseForm + effect.form + Math.floor(variance / 2)),
      });
    }
  }

  // 배치 저장
  await batchUpsertPlayerConditions(allRecords);
}

// ─────────────────────────────────────────
// 날짜 유형 판별
// ─────────────────────────────────────────

/**
 * 해당 날짜의 DayType 결정
 * 경기가 있으면 match_day, 없으면 요일에 따라 결정
 */
function determineDayType(dayOfWeek: number, hasMatches: boolean): DayType {
  if (hasMatches) return 'match_day';
  if (dayOfWeek === 0) return 'rest';       // 일요일
  if (dayOfWeek === 1 || dayOfWeek === 2) return 'scrim'; // 월/화
  return 'training'; // 나머지
}

// ─────────────────────────────────────────
// 하루 진행
// ─────────────────────────────────────────

/**
 * 하루를 진행한다.
 * 1. 현재 날짜의 활동 유형 판별
 * 2. 경기일이면: 유저 팀 경기 확인 → 유저 경기는 반환 (UI에서 LiveMatch 진입), 타 팀 자동시뮬
 * 3. 비경기일이면: 컨디션 변화 처리
 * 4. 날짜를 하루 전진
 *
 * @param seasonId 시즌 ID
 * @param currentDate 현재 날짜 (YYYY-MM-DD)
 * @param userTeamId 유저 팀 ID
 * @param gameMode 게임 모드
 * @param overrideDayType 유저가 선택한 활동 유형 (비경기일에만 적용)
 * @returns 하루 진행 결과
 */
export async function advanceDay(
  seasonId: number,
  currentDate: string,
  userTeamId: string,
  gameMode: GameMode,
  overrideDayType?: DayType,
): Promise<DayResult> {
  const dateObj = parseDate(currentDate);
  const dayOfWeek = dateObj.getDay();
  const dayName = getDayName(currentDate);
  const prevDate = addDays(currentDate, -1);
  const nextDate = addDays(currentDate, 1);

  // 해당 날짜의 경기 조회
  const todayMatches = await getMatchesByDate(seasonId, currentDate);
  const hasMatches = todayMatches.length > 0;
  const dayType = hasMatches ? 'match_day' : (overrideDayType ?? determineDayType(dayOfWeek, hasMatches));

  const events: string[] = [];
  const matchResults: DayMatchResult[] = [];
  let hasUserMatch = false;
  let userMatch: Match | undefined;

  if (dayType === 'match_day') {
    // ── 경기일 처리 ──
    for (const match of todayMatches) {
      if (match.isPlayed) continue;

      // TBD 팀 매치 스킵 (녹아웃 팀 미배정 상태)
      if (match.teamHomeId.startsWith('TBD') || match.teamAwayId.startsWith('TBD')) {
        continue;
      }

      const isUserMatch =
        match.teamHomeId === userTeamId || match.teamAwayId === userTeamId;

      if (isUserMatch) {
        // 유저 팀 경기: LiveMatch로 분기하기 위해 반환만 함
        hasUserMatch = true;
        userMatch = match;
        events.push(`오늘 경기: 유저 팀 경기 (밴픽 → 라이브 매치)`);
        continue;
      }

      // 타 팀 경기: 자동 시뮬레이션
      const result = await simulateMatchAuto(match, currentDate);
      if (result) {
        matchResults.push({
          matchId: match.id,
          homeTeamId: match.teamHomeId,
          awayTeamId: match.teamAwayId,
          result,
          isUserMatch: false,
        });

        // 플레이오프 / 토너먼트 경기 결과 → 다음 라운드 자동 처리
        if (match.matchType !== 'regular') {
          const winnerTeamId = result.winner === 'home' ? match.teamHomeId : match.teamAwayId;

          const tournamentPrefixes = ['msi_', 'worlds_', 'lck_cup_', 'fst_', 'ewc_'];
          const isTournament = tournamentPrefixes.some(p => match.id.startsWith(p));

          if (isTournament) {
            // 대회 경기 (MSI, Worlds, LCK Cup, FST, EWC)
            await processTournamentMatchResult(seasonId, match.id, winnerTeamId);
          } else {
            // 플레이오프 경기
            await processPlayoffMatchResult(seasonId, match.id, winnerTeamId);
          }
        }
      }
    }

    events.push(`경기일 — ${todayMatches.length}경기 진행`);
    await insertDailyEvent(seasonId, currentDate, 'match_day', undefined, `${todayMatches.length}경기 진행`);

  } else {
    // ── 비경기일 처리 ──
    const typeLabel = dayType === 'training' ? '훈련' : dayType === 'scrim' ? '스크림' : '휴식';
    events.push(`${typeLabel}일 — 선수 컨디션 변화`);
    await insertDailyEvent(seasonId, currentDate, dayType, userTeamId, `${typeLabel} 진행`);

    // AI 일간 이벤트 생성 (비경기일에만)
    const userPlayers = await getPlayersByTeamId(userTeamId);
    const dailyEvent = await generateDailyEvent({
      teamName: userTeamId,
      playerNames: userPlayers.slice(0, 5).map(p => p.name),
      currentDate,
    });

    if (dailyEvent) {
      events.push(`[${dailyEvent.title}] ${dailyEvent.description}`);
      await insertDailyEvent(seasonId, currentDate, 'event', userTeamId, `${dailyEvent.title}: ${dailyEvent.description}`);
    }
  }

  // 모든 팀의 컨디션 일괄 업데이트
  await updateAllTeamConditions(currentDate, prevDate, dayType);

  // 날짜 전진
  await updateSeasonDate(seasonId, nextDate);

  // 주차 업데이트 + 주간 재정 처리 (월요일마다)
  if (dayOfWeek === 1) {
    const db = await getDatabase();
    await db.execute(
      'UPDATE seasons SET current_week = current_week + 1 WHERE id = $1',
      [seasonId],
    );
    await processWeeklyFinances(seasonId, currentDate);
    events.push('주간 재정 처리 완료 (주급 지급 / 스폰서십 수입)');

    // AI 팀 자유계약 영입 처리
    const signedIds = await processAIFreeAgentSignings(seasonId, currentDate, userTeamId);
    if (signedIds.length > 0) {
      events.push(`AI 팀 자유계약 영입: ${signedIds.length}명`);
    }

    // 2주마다 챔피언 밸런스 패치 (짝수 주차)
    const season2 = await getActiveSeason();
    const currentWeek = season2?.currentWeek ?? 0;
    if (currentWeek > 0 && currentWeek % 2 === 0) {
      const patchNumber = Math.floor(currentWeek / 2);
      const patchResult = await generatePatch(seasonId, patchNumber, currentWeek);
      events.push(`챔피언 밸런스 패치 ${patchNumber} 적용 (${patchResult.entries.length}건 변경)`);
      await insertDailyEvent(seasonId, currentDate, 'patch', undefined, patchResult.patchNote);
    }
  }

  // 시즌 종료 감지: 시즌 종료일을 넘겼으면 플래그
  const season = await getActiveSeason();
  const isSeasonEnd = season ? nextDate > season.endDate : false;

  if (isSeasonEnd) {
    events.push('시즌이 종료되었습니다!');
  }

  return {
    date: currentDate,
    nextDate,
    dayOfWeek,
    dayName,
    dayType,
    matchResults,
    hasUserMatch,
    userMatch,
    events,
    isSeasonEnd,
  };
}

/**
 * 타 팀 경기 자동 시뮬레이션
 */
async function simulateMatchAuto(match: Match, matchDate: string): Promise<MatchResult | null> {
  const homePlayers = await getPlayersByTeamId(match.teamHomeId);
  const awayPlayers = await getPlayersByTeamId(match.teamAwayId);

  const homeLineup = buildLineup(homePlayers);
  const awayLineup = buildLineup(awayPlayers);

  if (!homeLineup || !awayLineup) return null;

  // 특성 + 폼 조회
  const homeTraits = await getTraitsByTeamId(match.teamHomeId);
  const awayTraits = await getTraitsByTeamId(match.teamAwayId);
  const homeForm = await getFormByTeamId(match.teamHomeId, matchDate);
  const awayForm = await getFormByTeamId(match.teamAwayId, matchDate);

  const format: BoFormat = match.boFormat ?? 'Bo3';
  const result = simulateMatch(homeLineup, awayLineup, format, match.id, homeTraits, awayTraits, homeForm, awayForm);

  // DB에 결과 저장
  await updateMatchResult(match.id, result.scoreHome, result.scoreAway);

  // 개별 게임 결과 저장
  for (let i = 0; i < result.games.length; i++) {
    const game = result.games[i];
    const gameId = `${match.id}_g${i + 1}`;
    const winnerTeamId = game.winnerSide === 'home' ? match.teamHomeId : match.teamAwayId;
    await insertGameResult(
      gameId, match.id, i + 1, winnerTeamId,
      game.durationMinutes * 60, game.goldDiffAt15, game.killsHome, game.killsAway,
    );
  }

  return result;
}

/**
 * 유저 팀 경기 결과를 DB에 저장 (LiveMatch 완료 후 호출)
 */
export async function saveUserMatchResult(
  match: Match,
  result: MatchResult,
): Promise<void> {
  await updateMatchResult(match.id, result.scoreHome, result.scoreAway);

  for (let i = 0; i < result.games.length; i++) {
    const game = result.games[i];
    const gameId = `${match.id}_g${i + 1}`;
    const winnerTeamId = game.winnerSide === 'home' ? match.teamHomeId : match.teamAwayId;
    await insertGameResult(
      gameId, match.id, i + 1, winnerTeamId,
      game.durationMinutes * 60, game.goldDiffAt15, game.killsHome, game.killsAway,
    );
  }
}

/**
 * 시즌이 끝났는지 확인
 */
export async function isSeasonFinished(seasonId: number): Promise<boolean> {
  const season = await getActiveSeason();
  if (!season || season.id !== seasonId) return true;
  return season.currentDate > season.endDate;
}

/**
 * 다음 경기일까지 자동 진행 (연속 "다음 날" 스킵)
 * 비경기일에서 "다음 경기까지 스킵" 기능
 */
export async function skipToNextMatchDay(
  seasonId: number,
  currentDate: string,
  userTeamId: string,
  gameMode: GameMode,
  endDate: string,
  defaultActivity?: DayType,
): Promise<DayResult[]> {
  const results: DayResult[] = [];
  let date = currentDate;

  while (date <= endDate) {
    const todayMatches = await getMatchesByDate(seasonId, date);
    const isMatchDay = todayMatches.length > 0;
    const hasUserMatch = todayMatches.some(
      m => m.teamHomeId === userTeamId || m.teamAwayId === userTeamId,
    );

    // 경기일이면 (특히 유저 팀 경기) 멈춤
    if (isMatchDay && hasUserMatch && results.length > 0) {
      break;
    }

    const dayResult = await advanceDay(seasonId, date, userTeamId, gameMode, defaultActivity);
    results.push(dayResult);

    // 유저 팀 경기일이면 바로 반환 (LiveMatch 진입)
    if (dayResult.hasUserMatch) break;

    date = addDays(date, 1);
  }

  return results;
}
