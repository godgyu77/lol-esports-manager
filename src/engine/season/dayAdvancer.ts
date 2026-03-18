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
  getTeamPlayStyle,
  updateMatchResult,
  updateSeasonDate,
  getTeamConditions,
  batchUpsertPlayerConditions,
  insertDailyEvent,
  insertGameResult,
  insertPlayerGameStats,
  getActiveSeason,
} from '../../db/queries';
import type { PlayerGameStats } from '../../types/match';
import { type Lineup, buildLineup } from '../match/teamRating';
import { simulateMatch, type BoFormat, type MatchResult } from '../match/matchSimulator';
import { type DayType, parseDate, addDays, getDayName } from './calendar';
import { getTeamTactics, calculateTacticsBonus } from '../tactics/tacticsEngine';
import { processWeeklyFinances } from '../economy/financeEngine';
import { processAIFreeAgentSignings, processAITransfers } from '../economy/transferEngine';
import { processPlayoffMatchResult } from './playoffGenerator';
import { processTournamentMatchResult } from '../tournament/tournamentEngine';
import { generateDailyEvent } from '../../ai/gameAiService';
import { generatePatch } from '../champion/patchEngine';
import { advanceScoutingDay } from '../scouting/scoutingEngine';
import { processTrainingDay } from '../training/trainingEngine';
import { generateDailyNews, generateMatchResultNews } from '../news/newsEngine';
import { checkForComplaints } from '../complaint/complaintEngine';
import { checkSponsorChanges, acceptSponsor } from '../economy/sponsorEngine';
import { processMatchResult as processBoardMatchResult } from '../board/boardEngine';
import { advanceAcademyDay } from '../academy/academyEngine';
import { checkPromises } from '../promise/promiseEngine';
import { simulateScrim } from './scrimEngine';
import { checkForInjuries, advanceInjuryDay, getInjuredPlayerIds, formatInjuryEvent } from '../injury/injuryEngine';
import { isInOffseason, advanceOffseasonDay, getCurrentOffseasonState, type OffseasonPhase, OFFSEASON_PHASE_LABELS } from './offseasonEngine';
import { processBootcampDay } from './preseasonEngine';
import { processMentoringDay } from '../mentoring/mentoringEngine';

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
  /** 오프시즌 여부 */
  isOffseason?: boolean;
  /** 오프시즌 페이즈 */
  offseasonPhase?: OffseasonPhase;
  /** 오프시즌 잔여일 */
  offseasonDaysRemaining?: number;
  /** 오프시즌 종료 여부 (다음 시즌 시작) */
  isOffseasonEnd?: boolean;
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
const TRAINING_EFFECT = { stamina: -6, morale: 0, form: 4 };
/** 스크림 효과: 스태미나 많이 소모, 폼 크게 상승 */
const SCRIM_EFFECT = { stamina: -9, morale: 3, form: 6 };
/** 휴식 효과: 스태미나 회복, 사기 회복 */
const REST_EFFECT = { stamina: 12, morale: 4, form: -1 };
/** 경기일 효과: 스태미나 크게 소모 */
const MATCH_DAY_EFFECT = { stamina: -15, morale: 0, form: 0 };

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
  saveId?: number,
): Promise<DayResult> {
  const dateObj = parseDate(currentDate);
  const dayOfWeek = dateObj.getDay();
  const dayName = getDayName(currentDate);
  const prevDate = addDays(currentDate, -1);
  const nextDate = addDays(currentDate, 1);

  // 오프시즌 체크
  if (saveId != null) {
    const offseasonActive = await isInOffseason(saveId);
    if (offseasonActive) {
      return advanceOffseasonDayHandler(saveId, seasonId, currentDate, userTeamId, dayOfWeek, dayName, nextDate, prevDate);
    }
  }

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

        // 경기 결과 뉴스 생성
        try {
          await generateMatchResultNews(seasonId, currentDate, match.teamHomeId, match.teamAwayId, result.scoreHome, result.scoreAway);
        } catch (e) {
          console.warn('[dayAdvancer] generateMatchResultNews failed:', e);
        }

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

    // 스크림일에 스크림 결과 시뮬
    if (dayType === 'scrim') {
      try {
        const scrimResult = await simulateScrim(userTeamId, currentDate);
        if (scrimResult) {
          events.push(`스크림 vs ${scrimResult.opponentName}: ${scrimResult.wins}승 ${scrimResult.losses}패`);
        }
      } catch { /* 스크림 테이블 미생성 시 무시 */ }
    }

    // 훈련/스크림일에 훈련 효과 적용
    if (dayType === 'training' || dayType === 'scrim') {
      const trainingResult = await processTrainingDay(userTeamId, currentDate, dayOfWeek);
      if (trainingResult.statChanges.length > 0) {
        events.push(`훈련 효과: ${trainingResult.statChanges.length}건 스탯 변화`);
      }
      if (trainingResult.championChanges.length > 0) {
        events.push(`챔피언 숙련도: ${trainingResult.championChanges.length}건 향상`);
      }
    }

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

    // 일간 뉴스 생성
    try {
      await generateDailyNews(seasonId, currentDate, []);
    } catch (e) {
      console.warn('[dayAdvancer] generateDailyNews failed:', e);
    }
  }

  // 부상 체크 (유저 팀)
  try {
    const newInjuries = await checkForInjuries(userTeamId, currentDate, dayType);
    for (const injury of newInjuries) {
      // 선수 이름 조회
      const injuredPlayer = (await getPlayersByTeamId(userTeamId)).find(p => p.id === injury.playerId);
      const playerName = injuredPlayer?.name ?? injury.playerId;
      events.push(`부상 발생: ${formatInjuryEvent(playerName, injury)}`);
      await insertDailyEvent(seasonId, currentDate, 'injury', userTeamId, formatInjuryEvent(playerName, injury));
    }
  } catch (e) {
    console.warn('[dayAdvancer] checkForInjuries failed:', e);
  }

  // 부상 회복 처리 (유저 팀)
  try {
    const recoveredNames = await advanceInjuryDay(userTeamId, currentDate);
    for (const name of recoveredNames) {
      events.push(`부상 회복: ${name} 복귀`);
    }
  } catch (e) {
    console.warn('[dayAdvancer] advanceInjuryDay failed:', e);
  }

  // 스카우팅 리포트 진행
  await advanceScoutingDay(userTeamId, currentDate);

  // 아카데미 일간 훈련
  try {
    await advanceAcademyDay(userTeamId);
  } catch (e) {
    console.warn('[dayAdvancer] advanceAcademyDay failed:', e);
  }

  // 멘토링 일간 효과
  try {
    await processMentoringDay(userTeamId);
  } catch (e) {
    console.warn('[dayAdvancer] processMentoringDay failed:', e);
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

    // 선수 불만 체크 (주 1회)
    try {
      const complaints = await checkForComplaints(userTeamId, seasonId, currentDate);
      if (complaints.length > 0) {
        events.push(`선수 불만 ${complaints.length}건 접수`);
      }
    } catch (e) {
      console.warn('[dayAdvancer] checkForComplaints failed:', e);
    }

    // 스폰서 동적 변동 체크
    try {
      const sponsorChanges = await checkSponsorChanges(userTeamId, seasonId, currentDate);
      if (sponsorChanges.lostSponsors.length > 0) {
        events.push(`스폰서 이탈: ${sponsorChanges.lostSponsors.join(', ')}`);
      }
      if (sponsorChanges.newOffers.length > 0) {
        // 유저 팀은 첫 번째 제안만 자동 수락 (추후 UI에서 선택 가능하도록 확장 가능)
        for (const offer of sponsorChanges.newOffers) {
          await acceptSponsor(userTeamId, seasonId, offer, currentDate);
          events.push(`새 스폰서 계약: ${offer.name} (${offer.tier}, 주 ${offer.weeklyPayout}만)`);
        }
      }
    } catch (e) {
      console.warn('[dayAdvancer] checkSponsorChanges failed:', e);
    }

    // 약속 이행 체크 (주 1회)
    try {
      const promiseResult = await checkPromises(userTeamId, currentDate);
      if (promiseResult.fulfilled > 0) events.push(`약속 이행: ${promiseResult.fulfilled}건`);
      if (promiseResult.broken > 0) events.push(`약속 불이행: ${promiseResult.broken}건 (사기 하락)`);
    } catch (e) {
      console.warn('[dayAdvancer] checkPromises failed:', e);
    }

    // AI 팀 자유계약 영입 처리
    const signedIds = await processAIFreeAgentSignings(seasonId, currentDate, userTeamId);
    if (signedIds.length > 0) {
      events.push(`AI 팀 자유계약 영입: ${signedIds.length}명`);
    }

    // AI 팀 간 이적 거래 처리
    try {
      const aiTransfers = await processAITransfers(seasonId, currentDate, userTeamId);
      if (aiTransfers.length > 0) {
        events.push(`AI 팀 이적: ${aiTransfers.map(t => `${t.playerName}(${t.fromTeam}→${t.toTeam})`).join(', ')}`);
      }
    } catch (e) {
      console.warn('[dayAdvancer] processAITransfers failed:', e);
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

  // 부상 선수 제외
  const homeInjured = await getInjuredPlayerIds(match.teamHomeId);
  const awayInjured = await getInjuredPlayerIds(match.teamAwayId);

  const homeLineup = buildLineup(homePlayers, homeInjured);
  const awayLineup = buildLineup(awayPlayers, awayInjured);

  if (!homeLineup || !awayLineup) return null;

  // 특성 + 폼 + 전술 조회
  const homeTraits = await getTraitsByTeamId(match.teamHomeId);
  const awayTraits = await getTraitsByTeamId(match.teamAwayId);
  const homeForm = await getFormByTeamId(match.teamHomeId, matchDate);
  const awayForm = await getFormByTeamId(match.teamAwayId, matchDate);
  const homePlayStyle = await getTeamPlayStyle(match.teamHomeId);
  const awayPlayStyle = await getTeamPlayStyle(match.teamAwayId);

  // 전술 보정 조회
  const homeTactics = await getTeamTactics(match.teamHomeId);
  const awayTactics = await getTeamTactics(match.teamAwayId);
  const homeTacticsBonus = homeTactics ? calculateTacticsBonus(homeTactics) : undefined;
  const awayTacticsBonus = awayTactics ? calculateTacticsBonus(awayTactics) : undefined;

  const format: BoFormat = match.boFormat ?? 'Bo3';
  const result = simulateMatch(homeLineup, awayLineup, format, match.id, homeTraits, awayTraits, homeForm, awayForm, homePlayStyle, awayPlayStyle, homeTacticsBonus, awayTacticsBonus);

  // DB에 결과 저장
  await updateMatchResult(match.id, result.scoreHome, result.scoreAway);

  // 개별 게임 결과 + 선수 스탯 저장
  for (let i = 0; i < result.games.length; i++) {
    const game = result.games[i];
    const gameId = `${match.id}_g${i + 1}`;
    const winnerTeamId = game.winnerSide === 'home' ? match.teamHomeId : match.teamAwayId;
    await insertGameResult(
      gameId, match.id, i + 1, winnerTeamId,
      game.durationMinutes * 60, game.goldDiffAt15, game.killsHome, game.killsAway,
    );

    // 선수 개인 스탯 저장
    const playerStats = buildPlayerGameStatsRecords(
      game, gameId, match.id, match.teamHomeId, match.teamAwayId,
    );
    await insertPlayerGameStats(playerStats);
  }

  return result;
}

/**
 * 유저 팀 경기 결과를 DB에 저장 (LiveMatch 완료 후 호출)
 */
export async function saveUserMatchResult(
  match: Match,
  result: MatchResult,
  seasonId?: number,
  userTeamId?: string,
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

    // 선수 개인 스탯 저장
    const playerStats = buildPlayerGameStatsRecords(
      game, gameId, match.id, match.teamHomeId, match.teamAwayId,
    );
    await insertPlayerGameStats(playerStats);
  }

  // 보드 기대치 반영 (유저 팀 경기 결과만)
  if (seasonId != null && userTeamId) {
    try {
      const isWin =
        (result.winner === 'home' && match.teamHomeId === userTeamId) ||
        (result.winner === 'away' && match.teamAwayId === userTeamId);
      await processBoardMatchResult(userTeamId, seasonId, isWin, true);
    } catch (e) {
      console.warn('[dayAdvancer] processBoardMatchResult failed:', e);
    }
  }
}

/** GameResult의 playerStats를 DB 삽입용 PlayerGameStats[] 로 변환 */
function buildPlayerGameStatsRecords(
  game: import('../match/matchSimulator').GameResult,
  gameId: string,
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
): PlayerGameStats[] {
  const records: PlayerGameStats[] = [];
  let idx = 0;

  for (const stat of game.playerStatsHome) {
    records.push({
      id: `${gameId}_h${idx++}`,
      gameId,
      matchId,
      playerId: stat.playerId,
      teamId: homeTeamId,
      side: 'home',
      position: stat.position,
      kills: stat.kills,
      deaths: stat.deaths,
      assists: stat.assists,
      cs: stat.cs,
      goldEarned: stat.goldEarned,
      damageDealt: stat.damageDealt,
    });
  }

  idx = 0;
  for (const stat of game.playerStatsAway) {
    records.push({
      id: `${gameId}_a${idx++}`,
      gameId,
      matchId,
      playerId: stat.playerId,
      teamId: awayTeamId,
      side: 'away',
      position: stat.position,
      kills: stat.kills,
      deaths: stat.deaths,
      assists: stat.assists,
      cs: stat.cs,
      goldEarned: stat.goldEarned,
      damageDealt: stat.damageDealt,
    });
  }

  return records;
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

// ─────────────────────────────────────────
// 오프시즌 일간 처리
// ─────────────────────────────────────────

/**
 * 오프시즌 하루 처리
 * 경기 없음, 이적/훈련만 진행.
 * Phase 3(프리시즌)이면 부트캠프 효과 적용.
 */
async function advanceOffseasonDayHandler(
  saveId: number,
  seasonId: number,
  currentDate: string,
  userTeamId: string,
  dayOfWeek: number,
  dayName: string,
  nextDate: string,
  prevDate: string,
): Promise<DayResult> {
  const events: string[] = [];

  // 현재 오프시즌 상태 조회
  const offseasonState = await getCurrentOffseasonState(saveId);
  if (!offseasonState) {
    // 오프시즌이 아님 (정상 경로에서는 발생하지 않음)
    return {
      date: currentDate,
      nextDate,
      dayOfWeek,
      dayName,
      dayType: 'rest',
      matchResults: [],
      hasUserMatch: false,
      events: ['오프시즌 상태를 찾을 수 없습니다.'],
    };
  }

  const phaseLabel = OFFSEASON_PHASE_LABELS[offseasonState.phase];
  events.push(`오프시즌 — ${phaseLabel} (잔여 ${offseasonState.daysRemaining}일)`);

  // Phase 3: 프리시즌 부트캠프
  if (offseasonState.phase === 'preseason') {
    try {
      const bootcampEffects = await processBootcampDay(userTeamId, currentDate);
      events.push('부트캠프 진행 중');
      for (const effect of bootcampEffects) {
        events.push(`  ${effect}`);
      }
    } catch (err) {
      console.warn('[dayAdvancer] processBootcampDay failed:', err);
    }
  }

  // 오프시즌 일 진행 (페이즈 전환 포함)
  const updatedState = await advanceOffseasonDay(saveId, currentDate);
  const isOffseasonEnd = updatedState === null;

  if (isOffseasonEnd) {
    events.push('오프시즌이 종료되었습니다. 다음 시즌을 시작합니다!');
  } else if (updatedState.phase !== offseasonState.phase) {
    const newPhaseLabel = OFFSEASON_PHASE_LABELS[updatedState.phase];
    events.push(`${newPhaseLabel} 페이즈로 전환`);
  }

  // 컨디션 업데이트 (휴식 효과)
  await updateAllTeamConditions(currentDate, prevDate, 'rest');

  // 날짜 전진
  await updateSeasonDate(seasonId, nextDate);

  return {
    date: currentDate,
    nextDate,
    dayOfWeek,
    dayName,
    dayType: 'rest',
    matchResults: [],
    hasUserMatch: false,
    events,
    isOffseason: true,
    offseasonPhase: updatedState?.phase ?? offseasonState.phase,
    offseasonDaysRemaining: updatedState?.daysRemaining ?? 0,
    isOffseasonEnd,
  };
}
