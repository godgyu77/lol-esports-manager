/**
 * 시즌 하루 진행을 처리하는 핵심 엔진입니다.
 * - 훈련, 스크림, 휴식, 경기일 효과를 순서대로 반영합니다.
 * - 유저 경기일 경우 자동 시뮬레이션을 멈추고 LiveMatch 진입 정보를 반환합니다.
 * - 오프시즌, 시즌 종료, 일일 이벤트, 선수 상태 변화도 함께 갱신합니다.
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
import { buildLineup } from '../match/teamRating';
import { simulateMatch, type BoFormat, type MatchResult } from '../match/matchSimulator';
import { type DayType, parseDate, addDays, getDayName } from './calendar';
import { getTeamTactics, calculateTacticsBonus } from '../tactics/tacticsEngine';
import { processPlayoffMatchResult } from './playoffGenerator';
import { processTournamentMatchResult } from '../tournament/tournamentEngine';
import { advanceScoutingDay } from '../scouting/scoutingEngine';
import { generateMatchResultNews, generateInjuryNews } from '../news/newsEngine';
import { processMatchResult as processBoardMatchResult, checkFiringRisk } from '../board/boardEngine';
import { advanceAcademyDay } from '../academy/academyEngine';
import { checkForInjuries, advanceInjuryDay, getInjuredPlayerIds, formatInjuryEvent, getInjuryDebuff } from '../injury/injuryEngine';
import { isInOffseason, advanceOffseasonDay, getCurrentOffseasonState, type OffseasonPhase, OFFSEASON_PHASE_LABELS } from './offseasonEngine';
import { processBootcampDay } from './preseasonEngine';
import { processMentoringDay } from '../mentoring/mentoringEngine';
import { processTeamSoloRank } from '../soloRank/soloRankEngine';
import { processTeamChemistryDay, calculateChemistryBonus } from '../chemistry/chemistryEngine';
import { calculateTeamSoloRankBonus } from '../soloRank/soloRankEngine';
import { getDifficultyModifiers, type Difficulty } from '../difficulty/difficultyEngine';
import { generateDailyPlayerEvents, processPlayerEvent } from '../event/playerEventEngine';
import { clamp } from '../../utils/mathUtils';
import { initGlobalRng, getBaseSeed, randomInt } from '../../utils/random';
import { getTrainingScheduleEntry } from '../training/trainingEngine';
import { getActiveInterventionEffects } from '../manager/managerInterventionEngine';
import { getManagerIdentity, getManagerIdentityEffects, type ManagerIdentityEffects } from '../manager/managerIdentityEngine';
import * as dayAdvancerTasks from './dayAdvancerTasks';

// advanceDay가 중복 실행되지 않도록 단일 큐로 직렬화한다.
let _dayAdvanceQueue: Promise<void> = Promise.resolve();

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

/** 하루 진행 결과. UI는 이 객체를 기준으로 다음 화면 흐름을 결정한다. */
export interface DayResult {
  date: string;
  /** DB에 반영된 다음 날짜. UI는 이 값을 다음 기준일로 사용한다. */
  nextDate: string;
  dayOfWeek: number;
  dayName: string;
  dayType: DayType;
  /** 자동 진행된 경기 결과 목록. 유저 경기는 여기에 포함되지 않는다. */
  matchResults: DayMatchResult[];
  /** 오늘 유저 경기가 있으면 true. UI는 이 값으로 LiveMatch 진입 여부를 판단한다. */
  hasUserMatch: boolean;
  /** 오늘 유저 경기 원본 데이터. LiveMatch 진입 시 사용한다. */
  userMatch?: Match;
  /** 하루 진행 중 생성된 로그 메시지. */
  events: string[];
  /** 하루 동안 발생한 선수 이벤트 목록. */
  playerEvents?: import('../event/playerEventEngine').PlayerEvent[];
  /** 시즌 종료일이면 true. UI는 이 값을 기준으로 시즌 종료 화면을 띄운다. */
  isSeasonEnd?: boolean;
  /** 현재 날짜가 오프시즌인지 여부. */
  isOffseason?: boolean;
  /** 현재 오프시즌 단계. */
  offseasonPhase?: OffseasonPhase;
  /** 오프시즌 단계의 남은 일수. */
  offseasonDaysRemaining?: number;
  /** 오프시즌 종료일이면 true. UI는 새 시즌 전환 연출에 활용할 수 있다. */
  isOffseasonEnd?: boolean;
}

/** 자동 진행된 단일 경기 결과. 유저 경기는 별도 LiveMatch 흐름으로 빠진다. */
interface DayMatchResult {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  result: MatchResult;
  isUserMatch: boolean;
}

// -----------------------------------------------------------------------------
// Day condition presets
// -----------------------------------------------------------------------------

/** 일반 훈련일 기본 변화량 */
const TRAINING_EFFECT = { stamina: -6, morale: 0, form: 4 };
/** 스크림일 기본 변화량 */
const SCRIM_EFFECT = { stamina: -9, morale: 3, form: 6 };
/** 휴식일 기본 변화량 */
const REST_EFFECT = { stamina: 12, morale: 4, form: -1 };
/** 경기일 기본 변화량 */
const MATCH_DAY_EFFECT = { stamina: -15, morale: 0, form: 0 };

/** 컨디션 수치를 0~100 범위로 고정한다. */
const clampCondition = (value: number, min = 0, max = 100): number => clamp(value, min, max);

async function updateAllTeamConditions(
  date: string,
  prevDate: string,
  dayType: DayType,
  managerEffects?: ManagerIdentityEffects | null,
): Promise<void> {
  const effect =
    dayType === 'training' ? TRAINING_EFFECT
    : dayType === 'scrim' ? SCRIM_EFFECT
    : dayType === 'rest' ? REST_EFFECT
    : dayType === 'match_day' ? MATCH_DAY_EFFECT
    : { stamina: 5, morale: 0, form: 0 };

  const playersByTeam = await getAllPlayersGroupedByTeam();
  const interventionEffects = await getActiveInterventionEffects(date).catch(() => new Map());
  const allRecords: { playerId: string; gameDate: string; stamina: number; morale: number; form: number }[] = [];

  for (const [teamId, players] of playersByTeam) {
    const prevConditions = await getTeamConditions(teamId, prevDate);

    for (const player of players) {
      const prev = prevConditions.get(player.id);
      const baseStamina = prev?.stamina ?? player.mental.stamina;
      const baseMorale = prev?.morale ?? player.mental.morale;
      const baseForm = prev?.form ?? 50;
      const intervention = interventionEffects.get(player.id);

      const variance = randomInt(-3, 3);

      allRecords.push({
        playerId: player.id,
        gameDate: date,
        stamina: clampCondition(baseStamina + effect.stamina + variance),
        morale: clampCondition(
          baseMorale +
          effect.morale +
          Math.floor(variance / 2) +
          (intervention?.moraleBonus ?? 0) +
          (dayType === 'rest' || dayType === 'event' ? (managerEffects?.complaintReliefBonus ?? 0) : 0) -
          (dayType === 'training' || dayType === 'match_day' ? Math.max(0, managerEffects?.moraleRiskModifier ?? 0) : 0),
        ),
        form: clampCondition(
          baseForm +
          effect.form +
          Math.floor(variance / 2) +
          (intervention?.formBonus ?? 0) +
          (dayType === 'training' || dayType === 'scrim' ? (managerEffects?.trainingFocusBonus ?? 0) : 0) +
          (dayType === 'match_day' ? (managerEffects?.formBoost ?? 0) : 0),
        ),
      });
    }
  }

  await batchUpsertPlayerConditions(allRecords);
}

function determineDayType(dayOfWeek: number, hasMatches: boolean): DayType {
  if (hasMatches) return 'match_day';
  if (dayOfWeek === 0) return 'rest';       // ???μ떜媛?걫?筌뚮툖???
  if (dayOfWeek === 1 || dayOfWeek === 2) return 'scrim'; // ????
  return 'training'; // ??????룸떽??????
}

/**
 *
 */
async function resolveScheduledDayType(teamId: string, dayOfWeek: number): Promise<DayType | null> {
  try {
    const entry = await getTrainingScheduleEntry(teamId, dayOfWeek);
    return entry?.activityType ?? null;
  } catch (error) {
    console.warn('[dayAdvancer] resolveScheduledDayType failed:', error);
    return null;
  }
}

export async function advanceDay(
  seasonId: number,
  currentDate: string,
  userTeamId: string,
  _gameMode: GameMode,
  overrideDayType?: DayType,
  saveId?: number,
  difficulty: Difficulty = 'normal',
): Promise<DayResult> {
  const prev = _dayAdvanceQueue;
  let releaseLock!: () => void;
  _dayAdvanceQueue = new Promise<void>(resolve => { releaseLock = resolve; });
  await prev;
  try {
  const baseSeed = getBaseSeed();
  if (baseSeed) {
    initGlobalRng(`${baseSeed}_day_${currentDate}`);
  }

  const dateObj = parseDate(currentDate);
  const dayOfWeek = dateObj.getDay();
  const dayName = getDayName(currentDate);
  const prevDate = addDays(currentDate, -1);
  const nextDate = addDays(currentDate, 1);
  const managerEffects = saveId != null
    ? await getManagerIdentity(saveId).then((identity) => identity ? getManagerIdentityEffects(identity.philosophy) : null).catch(() => null)
    : null;

  if (saveId != null) {
    const offseasonActive = await isInOffseason(saveId);
    if (offseasonActive) {
      return advanceOffseasonDayHandler(saveId, seasonId, currentDate, userTeamId, dayOfWeek, dayName, nextDate, prevDate);
    }
  }

  const todayMatches = await getMatchesByDate(seasonId, currentDate);
  const hasMatches = todayMatches.length > 0;
  const scheduledDayType = hasMatches ? null : await resolveScheduledDayType(userTeamId, dayOfWeek);
  const dayType = hasMatches
    ? 'match_day'
    : (overrideDayType ?? scheduledDayType ?? determineDayType(dayOfWeek, hasMatches));

  const events: string[] = [];
  const matchResults: DayMatchResult[] = [];
  let hasUserMatch = false;
  let userMatch: Match | undefined;

  if (dayType === 'match_day') {
    const matchDayResult = await processMatchDay(todayMatches, userTeamId, seasonId, currentDate, difficulty);
    matchResults.push(...matchDayResult.matchResults);
    events.push(...matchDayResult.events);
    hasUserMatch = matchDayResult.hasUserMatch;
    userMatch = matchDayResult.userMatch;
  } else {
    const nonMatchResult = await dayAdvancerTasks.processNonMatchDay(dayType, dayOfWeek, userTeamId, seasonId, currentDate);
    events.push(...nonMatchResult.events);
  }

  let staffInjuryPrevention = 0;
  let staffInjuryRecovery = 0;
  try {
    const { calculateStaffBonuses } = await import('../staff/staffEngine');
    const sb = await calculateStaffBonuses(userTeamId);
    staffInjuryPrevention = sb.injuryPreventionBonus;
    staffInjuryRecovery = sb.injuryRecoveryBonus;
  } catch { /* ??????썼キ??????쇰뮛??????癲??嶺???ル맪????????⑤슣?????嶺뚮Ĳ????*/ }

  try {
    const newInjuries = await checkForInjuries(userTeamId, currentDate, dayType, staffInjuryPrevention);
    for (const injury of newInjuries) {
      const injuredPlayer = (await getPlayersByTeamId(userTeamId)).find(p => p.id === injury.playerId);
      const playerName = injuredPlayer?.name ?? injury.playerId;
      events.push(`?????뼿???????썹땟戮녹??醫딆맚嶺뚮㉡???? ${formatInjuryEvent(playerName, injury)}`);
      await insertDailyEvent(seasonId, currentDate, 'injury', userTeamId, formatInjuryEvent(playerName, injury));

      try {
        const teamRows = await (await getDatabase()).select<{ name: string }[]>(
          'SELECT name FROM teams WHERE id = $1', [userTeamId],
        );
        const teamName = teamRows[0]?.name ?? userTeamId;
        await generateInjuryNews(seasonId, currentDate, playerName, teamName, injury.injuryType, injury.severity, injury.daysRemaining, userTeamId, injury.playerId);
      } catch { /* ??????깅즽癲????熬곣뫖利?????????⑤슣?????嶺뚮Ĳ????*/ }
    }
  } catch (e) {
    console.warn('[dayAdvancer] checkForInjuries failed:', e);
  }

  try {
    const recoveredNames = await advanceInjuryDay(userTeamId, currentDate, undefined, staffInjuryRecovery);
    for (const name of recoveredNames) {
      events.push(`?????뼿???????? ${name} ????쇰뮛?筌믡꺂?뜻ㅀ袁⑦뀘??`);
    }
  } catch (e) {
    console.warn('[dayAdvancer] advanceInjuryDay failed:', e);
  }

  try {
    await advanceScoutingDay(userTeamId, currentDate);
  } catch (e) {
    console.warn('[dayAdvancer] advanceScoutingDay failed:', e);
  }

  try {
    await advanceAcademyDay(userTeamId);
  } catch (e) {
    console.warn('[dayAdvancer] advanceAcademyDay failed:', e);
  }

  try {
    await processMentoringDay(userTeamId);
  } catch (e) {
    console.warn('[dayAdvancer] processMentoringDay failed:', e);
  }

  try {
    await processTeamChemistryDay(userTeamId);
  } catch (e) {
    console.warn('[dayAdvancer] processTeamChemistryDay failed:', e);
  }

  try {
    const soloRankResults = await processTeamSoloRank(userTeamId, dayType);
    const tierChanges = soloRankResults.filter(r => r.tierChanged);
    if (tierChanges.length > 0) {
      events.push(`Solo rank tier changes: ${tierChanges.length}`);
    }
    const champExpansions = soloRankResults.filter(r => r.championPoolExpansion);
    if (champExpansions.length > 0) {
      events.push(`Solo rank pool growth: ${champExpansions.length}`);
    }
  } catch (e) {
    console.warn('[dayAdvancer] processTeamSoloRank failed:', e);
  }

  let dailyPlayerEvents: import('../event/playerEventEngine').PlayerEvent[] = [];
  try {
    dailyPlayerEvents = await generateDailyPlayerEvents(userTeamId, currentDate);
    for (const evt of dailyPlayerEvents) {
      await processPlayerEvent(evt, seasonId, currentDate, userTeamId);
      const severityLabel = evt.severity === 'critical' ? '[치명]' : evt.severity === 'major' ? '[주의]' : '';
      events.push(`${severityLabel} ${evt.title}: ${evt.description}`);
    }
  } catch (e) {
    console.warn('[dayAdvancer] generateDailyPlayerEvents failed:', e);
  }

  try {
    await updateAllTeamConditions(currentDate, prevDate, dayType, managerEffects);
  } catch (e) {
    console.warn('[dayAdvancer] updateAllTeamConditions failed:', e);
  }

  try {
    await updateSeasonDate(seasonId, nextDate);
  } catch (e) {
    console.warn('[dayAdvancer] updateSeasonDate failed:', e);
  }

  if (dayOfWeek === 1) {
    const weeklyResult = await dayAdvancerTasks.processWeeklyTasks(seasonId, userTeamId, currentDate, saveId);
    events.push(...weeklyResult.events);
  }

  if (dateObj.getDate() === 1) {
    const monthlyResult = await dayAdvancerTasks.processMonthlyTasks();
    events.push(...monthlyResult.events);
  }

  const seasonTransitionResult = await dayAdvancerTasks.processSeasonTransition(saveId, userTeamId, seasonId, currentDate, dayType, nextDate);
  events.push(...seasonTransitionResult.events);
  const isSeasonEnd = seasonTransitionResult.isSeasonEnd;

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
    playerEvents: dailyPlayerEvents.length > 0 ? dailyPlayerEvents : undefined,
    isSeasonEnd,
  };
  } finally {
    releaseLock();
  }
}

async function processMatchDay(
  todayMatches: Match[],
  userTeamId: string,
  seasonId: number,
  currentDate: string,
  difficulty: Difficulty,
): Promise<{ matchResults: DayMatchResult[]; events: string[]; hasUserMatch: boolean; userMatch?: Match }> {
  const events: string[] = [];
  const matchResults: DayMatchResult[] = [];
  let hasUserMatch = false;
  let userMatch: Match | undefined;

  for (const match of todayMatches) {
    if (match.isPlayed) continue;

    if (match.teamHomeId.startsWith('TBD') || match.teamAwayId.startsWith('TBD')) {
      continue;
    }

    const isUserMatch =
      match.teamHomeId === userTeamId || match.teamAwayId === userTeamId;

    if (isUserMatch) {
      hasUserMatch = true;
      userMatch = match;
      events.push('오늘은 유저 팀 경기가 있습니다. 경기 화면에서 직접 진행해 주세요.');
      continue;
    }

    const result = await simulateMatchAuto(match, currentDate, difficulty);
    if (result) {
      matchResults.push({
        matchId: match.id,
        homeTeamId: match.teamHomeId,
        awayTeamId: match.teamAwayId,
        result,
        isUserMatch: false,
      });

      try {
        await generateMatchResultNews(seasonId, currentDate, match.teamHomeId, match.teamAwayId, result.scoreHome, result.scoreAway);
      } catch (e) {
        console.warn('[dayAdvancer] generateMatchResultNews failed:', e);
      }

      if (match.matchType !== 'regular') {
        const winnerTeamId = result.winner === 'home' ? match.teamHomeId : match.teamAwayId;

        const tournamentPrefixes = ['msi_', 'worlds_', 'lck_cup_', 'fst_', 'ewc_'];
        const isTournament = tournamentPrefixes.some(p => match.id.startsWith(p));

        if (isTournament) {
          await processTournamentMatchResult(seasonId, match.id, winnerTeamId);
        } else {
          await processPlayoffMatchResult(seasonId, match.id, winnerTeamId);
        }
      }
    }
  }

  events.push(`???? ???????. ?? ??? ?? ?: ${todayMatches.length}`);
  await insertDailyEvent(seasonId, currentDate, 'match_day', undefined, `${todayMatches.length}?? ?? ??`);

  return { matchResults, events, hasUserMatch, userMatch };
}

async function simulateMatchAuto(match: Match, matchDate: string, difficulty: Difficulty = 'normal'): Promise<MatchResult | null> {
  const homePlayers = await getPlayersByTeamId(match.teamHomeId);
  const awayPlayers = await getPlayersByTeamId(match.teamAwayId);

  const homeInjured = await getInjuredPlayerIds(match.teamHomeId);
  const awayInjured = await getInjuredPlayerIds(match.teamAwayId);

  const homeLineup = buildLineup(homePlayers, homeInjured);
  const awayLineup = buildLineup(awayPlayers, awayInjured);

  if (!homeLineup || !awayLineup) return null;

  const homeTraits = await getTraitsByTeamId(match.teamHomeId);
  const awayTraits = await getTraitsByTeamId(match.teamAwayId);
  const homeForm = await getFormByTeamId(match.teamHomeId, matchDate);
  const awayForm = await getFormByTeamId(match.teamAwayId, matchDate);

  try {
    const positions: import('../../types/game').Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
    for (const pos of positions) {
      const homePlayer = homeLineup[pos];
      const debuff = await getInjuryDebuff(homePlayer.id, matchDate);
      if (debuff) homeForm[homePlayer.id] = (homeForm[homePlayer.id] ?? 50) + debuff.statPenalty * 3;
    }
    for (const pos of positions) {
      const awayPlayer = awayLineup[pos];
      const debuff = await getInjuryDebuff(awayPlayer.id, matchDate);
      if (debuff) awayForm[awayPlayer.id] = (awayForm[awayPlayer.id] ?? 50) + debuff.statPenalty * 3;
    }
  } catch { /* ????嫄???????怨쀫뮡??????????⑤슣?????嶺뚮Ĳ????*/ }
  const homePlayStyle = await getTeamPlayStyle(match.teamHomeId);
  const awayPlayStyle = await getTeamPlayStyle(match.teamAwayId);

  const homeTactics = await getTeamTactics(match.teamHomeId);
  const awayTactics = await getTeamTactics(match.teamAwayId);
  const homeTacticsBonus = homeTactics ? calculateTacticsBonus(homeTactics) : undefined;
  const awayTacticsBonus = awayTactics ? calculateTacticsBonus(awayTactics) : undefined;

  let homeChampionPicks: import('../match/matchSimulator').MatchChampionPicks | undefined;
  let awayChampionPicks: import('../match/matchSimulator').MatchChampionPicks | undefined;
  let matchSynergyData: import('../../types/champion').ChampionSynergy[] = [];
  try {
    const { CHAMPION_MAP, CHAMPION_SYNERGIES } = await import('../../data/championDb');
    matchSynergyData = CHAMPION_SYNERGIES;
    const { autoCompleteDraft, buildDraftTeamInfo } = await import('../draft/draftEngine');
    const { CHAMPION_DB } = await import('../../data/championDb');

    const buildTeamInfo = (players: typeof homePlayers) => {
      const positions: import('../../types/game').Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
      return buildDraftTeamInfo(
        positions.map(pos => {
          const player = players.find(p => p.position === pos && p.division === 'main');
          return { position: pos, championPool: player?.championPool ?? [] };
        }),
      );
    };

    const homeInfo = buildTeamInfo(homePlayers);
    const awayInfo = buildTeamInfo(awayPlayers);
    const fearless = match.fearlessDraft ?? false;
    const draftState = await autoCompleteDraft(homeInfo, awayInfo, CHAMPION_DB, fearless);

    const buildPicks = (side: 'blue' | 'red', players: typeof homePlayers): import('../match/matchSimulator').MatchChampionPicks => {
      const picks = draftState[side].picks;
      const champStats: Record<string, { earlyGame: number; lateGame: number; teamfight: number; splitPush: number; difficulty: number }> = {};
      const champTags: Record<string, string[]> = {};
      const champDamageProfiles: Record<string, string> = {};
      const champProficiency: Record<import('../../types/game').Position, number> = { top: 50, jungle: 50, mid: 50, adc: 50, support: 50 };

      for (const pick of picks) {
        const champ = CHAMPION_MAP[pick.championId];
        if (champ) {
          champStats[pick.championId] = champ.stats;
          champTags[pick.championId] = champ.tags;
          champDamageProfiles[pick.championId] = champ.damageProfile;
        }
        if (pick.position) {
          const player = players.find(p => p.position === pick.position && p.division === 'main');
          const prof = player?.championPool?.find(cp => cp.championId === pick.championId);
          champProficiency[pick.position] = prof?.proficiency ?? 40; // ??????????⑤뜤?嶺뚮Ĳ?쒒?40 (??? ?????櫻??
        }
      }
      return { picks, champStats, champTags, champDamageProfiles, champProficiency };
    };

    homeChampionPicks = buildPicks('blue', homePlayers);
    awayChampionPicks = buildPicks('red', awayPlayers);
  } catch (e) {
    console.warn('[dayAdvancer] auto draft for match sim failed:', e);
  }

  const format: BoFormat = match.boFormat ?? 'Bo3';

  const homeBench = homePlayers.filter(p => p.division === 'sub') as import('../../types/player').Player[];
  const awayBench = awayPlayers.filter(p => p.division === 'sub') as import('../../types/player').Player[];

  let homeExtraBonus = 0;
  let awayExtraBonus = 0;
  try {
    const [homeChem, awayChem, homeSolo, awaySolo] = await Promise.all([
      calculateChemistryBonus(match.teamHomeId),
      calculateChemistryBonus(match.teamAwayId),
      calculateTeamSoloRankBonus(match.teamHomeId),
      calculateTeamSoloRankBonus(match.teamAwayId),
    ]);
    homeExtraBonus = homeChem + homeSolo;
    awayExtraBonus = awayChem + awaySolo;
  } catch { /* ????쇰뮛???????鶯ㅺ동????????????⑤슣????0 ????*/ }

  const diffMods = getDifficultyModifiers(difficulty);
  homeExtraBonus += diffMods.aiTeamRatingBonus;
  awayExtraBonus += diffMods.aiTeamRatingBonus;

  const result = simulateMatch(homeLineup, awayLineup, format, match.id, homeTraits, awayTraits, homeForm, awayForm, homePlayStyle, awayPlayStyle, homeTacticsBonus, awayTacticsBonus, homeChampionPicks, awayChampionPicks, matchSynergyData, homeTactics ?? undefined, awayTactics ?? undefined, homeBench, awayBench, homeExtraBonus, awayExtraBonus);

  await updateMatchResult(match.id, result.scoreHome, result.scoreAway);

  for (let i = 0; i < result.games.length; i++) {
    const game = result.games[i];
    const gameId = `${match.id}_g${i + 1}`;
    const winnerTeamId = game.winnerSide === 'home' ? match.teamHomeId : match.teamAwayId;
    await insertGameResult(
      gameId, match.id, i + 1, winnerTeamId,
      game.durationMinutes * 60, game.goldDiffAt15, game.killsHome, game.killsAway,
    );

    const playerStats = buildPlayerGameStatsRecords(
      game, gameId, match.id, match.teamHomeId, match.teamAwayId,
    );
    await insertPlayerGameStats(playerStats);
  }

  return result;
}

export async function saveUserMatchResult(
  match: Match,
  result: MatchResult,
  seasonId?: number,
  userTeamId?: string,
  saveId?: number,
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

    const playerStats = buildPlayerGameStatsRecords(
      game, gameId, match.id, match.teamHomeId, match.teamAwayId,
    );
    await insertPlayerGameStats(playerStats);
  }

  if (seasonId != null && userTeamId) {
    try {
      const isWin =
        (result.winner === 'home' && match.teamHomeId === userTeamId) ||
        (result.winner === 'away' && match.teamAwayId === userTeamId);
      await processBoardMatchResult(userTeamId, seasonId, isWin, true, saveId);

      const firingStatus = await checkFiringRisk(userTeamId, seasonId, saveId);
      if (firingStatus === 'fired') {
        console.warn('[dayAdvancer] manager was fired after board review');
      }
    } catch (e) {
      console.warn('[dayAdvancer] processBoardMatchResult failed:', e);
    }
  }

  try {
    await updateCareerStats(result, match.teamHomeId, match.teamAwayId);
  } catch (e) {
    console.warn('[dayAdvancer] updateCareerStats failed:', e);
  }
}

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

async function updateCareerStats(
  result: MatchResult,
  homeTeamId: string,
  awayTeamId: string,
): Promise<void> {
  const db = await getDatabase();

  for (const game of result.games) {
    const allStats = [...game.playerStatsHome, ...game.playerStatsAway];
    for (const stat of allStats) {
      const teamId = game.playerStatsHome.includes(stat) ? homeTeamId : awayTeamId;
      try {
        await db.execute('UPDATE players SET career_games = COALESCE(career_games, 0) + 1 WHERE id = $1', [stat.playerId]);
      } catch { /* career_games ???棺堉?댆???????븍툖??野껊갭?????????嶺뚮Ĳ????*/ }

      // UPSERT into player_career_stats
      await db.execute(
        `INSERT INTO player_career_stats (player_id, team_id, total_games, total_kills, total_deaths, total_assists, total_cs, total_damage)
         VALUES ($1, $2, 1, $3, $4, $5, $6, $7)
         ON CONFLICT(player_id) DO UPDATE SET
           total_games = total_games + 1,
           total_kills = total_kills + $3,
           total_deaths = total_deaths + $4,
           total_assists = total_assists + $5,
           total_cs = total_cs + $6,
           total_damage = total_damage + $7`,
        [stat.playerId, teamId, stat.kills, stat.deaths, stat.assists, stat.cs, stat.goldEarned],
      );

      const kda = stat.deaths === 0 ? (stat.kills + stat.assists) * 2 : (stat.kills + stat.assists) / stat.deaths;
      const formScore = Math.min(100, Math.max(0, Math.round(kda * 12))); // KDA 4.0 ????48, KDA 8.0 ????96
      try {
        await db.execute(
          `INSERT INTO player_form_history (player_id, game_date, form_score)
           VALUES ($1, datetime('now'), $2)`,
          [stat.playerId, formScore],
        );
        await db.execute(
          `DELETE FROM player_form_history WHERE player_id = $1 AND id NOT IN (
             SELECT id FROM player_form_history WHERE player_id = $1 ORDER BY id DESC LIMIT 10
           )`,
          [stat.playerId],
        );
      } catch { /* ??????????븍툖??野껊갭?????????嶺뚮Ĳ????*/ }
    }
  }

  const winnerSide = result.winner;
  const winTeamId = winnerSide === 'home' ? homeTeamId : awayTeamId;
  try {
    const winPlayers = await getPlayersByTeamId(winTeamId);
    for (let i = 0; i < winPlayers.length; i++) {
      for (let j = i + 1; j < winPlayers.length; j++) {
        await db.execute(
          `INSERT INTO player_chemistry (player_a_id, player_b_id, chemistry_score)
           VALUES ($1, $2, 51)
           ON CONFLICT(player_a_id, player_b_id) DO UPDATE SET
             chemistry_score = MIN(100, chemistry_score + 1)`,
          [winPlayers[i].id, winPlayers[j].id],
        );
      }
    }
  } catch { /* ??????????븍툖??野껊갭?????????嶺뚮Ĳ????*/ }
}

export async function isSeasonFinished(seasonId: number): Promise<boolean> {
  const season = await getActiveSeason();
  if (!season || season.id !== seasonId) return true;
  return season.currentDate > season.endDate;
}

export async function skipToNextMatchDay(
  seasonId: number,
  currentDate: string,
  userTeamId: string,
  gameMode: GameMode,
  endDate: string,
  defaultActivity?: DayType,
  difficulty: Difficulty = 'normal',
): Promise<DayResult[]> {
  const results: DayResult[] = [];
  let date = currentDate;

  while (date <= endDate) {
    const todayMatches = await getMatchesByDate(seasonId, date);
    const isMatchDay = todayMatches.length > 0;
    const hasUserMatch = todayMatches.some(
      m => m.teamHomeId === userTeamId || m.teamAwayId === userTeamId,
    );

    if (isMatchDay && hasUserMatch && results.length > 0) {
      break;
    }

    const dayResult = await advanceDay(seasonId, date, userTeamId, gameMode, defaultActivity, undefined, difficulty);
    results.push(dayResult);

    if (dayResult.hasUserMatch) break;

    date = addDays(date, 1);
  }

  return results;
}

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

  const offseasonState = await getCurrentOffseasonState(saveId);
  if (!offseasonState) {
    return {
      date: currentDate,
      nextDate,
      dayOfWeek,
      dayName,
      dayType: 'rest',
      matchResults: [],
      hasUserMatch: false,
      events: ['오프시즌 상태를 찾지 못해 하루 진행을 종료했습니다.'],
    };
  }

  const phaseLabel = OFFSEASON_PHASE_LABELS[offseasonState.phase];
  events.push(`오프시즌 단계: ${phaseLabel} (${offseasonState.daysRemaining}일 남음)`);

  if (offseasonState.phase === 'preseason') {
    try {
      const bootcampEffects = await processBootcampDay(userTeamId, currentDate);
      events.push('프리시즌 부트캠프 효과를 적용했습니다.');
      for (const effect of bootcampEffects) {
        events.push(`  ${effect}`);
      }
    } catch (err) {
      console.warn('[dayAdvancer] processBootcampDay failed:', err);
    }
  }

  const updatedState = await advanceOffseasonDay(saveId, currentDate);
  const isOffseasonEnd = updatedState === null;

  if (isOffseasonEnd) {
    events.push('오프시즌이 종료되었습니다. 다음 시즌 준비를 시작합니다.');
  } else if (updatedState.phase !== offseasonState.phase) {
    const newPhaseLabel = OFFSEASON_PHASE_LABELS[updatedState.phase];
    events.push(`${newPhaseLabel} 단계가 시작되었습니다.`);
  }

  await updateAllTeamConditions(currentDate, prevDate, 'rest', null);

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
