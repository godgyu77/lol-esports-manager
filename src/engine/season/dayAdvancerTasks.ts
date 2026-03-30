import { getDatabase } from '../../db/database';
import {
  getActiveSeason,
  getAllTeams,
  getPlayersByTeamId,
  insertDailyEvent,
} from '../../db/queries';
import { generateDailyEvent } from '../../ai/gameAiService';
import type { DayType } from './calendar';
import { simulateScrim } from './scrimEngine';
import { processTrainingDay, processRestDay } from '../training/trainingEngine';
import { generateDailyNews, generateScandalNews } from '../news/newsEngine';
import { processWeeklyFinances } from '../economy/financeEngine';
import { checkForComplaints } from '../complaint/complaintEngine';
import { acceptSponsor, checkSponsorChanges } from '../economy/sponsorEngine';
import { checkPromises } from '../promise/promiseEngine';
import { processWeeklySatisfaction } from '../satisfaction/playerSatisfactionEngine';
import { checkTeamConflicts } from '../personality/personalityEngine';
import { processAIFreeAgentSignings, processAITransfers } from '../economy/transferAi';
import { weeklyStaffMoraleRecovery } from '../staff/staffEngine';
import { calculateMaintenanceCost, processFacilityDecay } from '../facility/facilityEngine';
import { generatePatch } from '../champion/patchEngine';
import { buildAchievementContext, checkAndUnlockAchievements } from '../achievement/achievementEngine';
import { checkGoalAchievement } from '../playerGoal/playerGoalEngine';

export async function processNonMatchDay(
  dayType: DayType,
  dayOfWeek: number,
  userTeamId: string,
  seasonId: number,
  currentDate: string,
): Promise<{ events: string[] }> {
  const events: string[] = [];

  const typeLabel = dayType === 'training' ? '훈련' : dayType === 'scrim' ? '스크림' : '휴식';
  events.push(`${typeLabel} 일정 진행`);
  await insertDailyEvent(seasonId, currentDate, dayType, userTeamId, `${typeLabel} 진행`);

  if (dayType === 'scrim') {
    try {
      const scrimResult = await simulateScrim(userTeamId, currentDate);
      if (scrimResult) {
        events.push(`스크림 vs ${scrimResult.opponentName}: ${scrimResult.wins}승 ${scrimResult.losses}패`);
      }
    } catch {
      void 0;
    }
  }

  if (dayType === 'rest') {
    try {
      const restResult = await processRestDay(userTeamId);
      if (restResult.facilityGymBonus > 0 || restResult.facilityCafeteriaBonus > 0) {
        events.push(`시설 보너스: 체력 +${restResult.facilityGymBonus}, 사기 +${restResult.facilityCafeteriaBonus}`);
      }
    } catch {
      void 0;
    }
  }

  if (dayType === 'training' || dayType === 'scrim') {
    try {
      const trainingResult = await processTrainingDay(userTeamId, currentDate, dayOfWeek);
      if (trainingResult.statChanges.length > 0) {
        events.push(`훈련 효과: 스탯 변화 ${trainingResult.statChanges.length}건`);
      }
      if (trainingResult.championChanges.length > 0) {
        events.push(`챔피언 숙련도 상승: ${trainingResult.championChanges.length}건`);
      }
    } catch (e) {
      console.warn('[dayAdvancer] processTrainingDay failed:', e);
    }
  }

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

  try {
    const allTeamsForNews = await getAllTeams();
    const teamsForNews = allTeamsForNews.map(t => ({ id: t.id, name: t.name, shortName: t.shortName }));
    if (teamsForNews.length > 0) {
      await generateDailyNews(seasonId, currentDate, teamsForNews);
    }
  } catch (e) {
    console.warn('[dayAdvancer] generateDailyNews failed:', e);
  }

  return { events };
}

export async function processWeeklyTasks(
  seasonId: number,
  userTeamId: string,
  currentDate: string,
): Promise<{ events: string[] }> {
  const events: string[] = [];
  const db = await getDatabase();

  await db.execute('UPDATE seasons SET current_week = current_week + 1 WHERE id = $1', [seasonId]);
  await processWeeklyFinances(seasonId, currentDate);
  events.push('주간 재정 처리 완료');

  try {
    const complaints = await checkForComplaints(userTeamId, seasonId, currentDate);
    if (complaints.length > 0) events.push(`선수 불만 ${complaints.length}건`);
  } catch (e) {
    console.warn('[dayAdvancer] checkForComplaints failed:', e);
  }

  try {
    const sponsorChanges = await checkSponsorChanges(userTeamId, seasonId, currentDate);
    if (sponsorChanges.lostSponsors.length > 0) {
      events.push(`스폰서 이탈: ${sponsorChanges.lostSponsors.join(', ')}`);
    }
    if (sponsorChanges.newOffers.length > 0) {
      for (const offer of sponsorChanges.newOffers) {
        await acceptSponsor(userTeamId, seasonId, offer, currentDate);
        events.push(`신규 스폰서 계약: ${offer.name} (${offer.tier})`);
      }
    }
  } catch (e) {
    console.warn('[dayAdvancer] checkSponsorChanges failed:', e);
  }

  try {
    const promiseResult = await checkPromises(userTeamId, currentDate);
    if (promiseResult.fulfilled > 0) events.push(`약속 이행 ${promiseResult.fulfilled}건`);
    if (promiseResult.broken > 0) events.push(`약속 불이행 ${promiseResult.broken}건`);
  } catch (e) {
    console.warn('[dayAdvancer] checkPromises failed:', e);
  }

  try {
    await processWeeklySatisfaction(userTeamId, seasonId, currentDate);
    events.push('주간 만족도 점검 완료');
  } catch (e) {
    console.warn('[dayAdvancer] processWeeklySatisfaction failed:', e);
  }

  try {
    const conflicts = await checkTeamConflicts(userTeamId);
    for (const c of conflicts) {
      events.push(`선수 갈등: ${c.playerAName} vs ${c.playerBName} (${c.severity})`);
    }
  } catch (e) {
    console.warn('[dayAdvancer] checkTeamConflicts failed:', e);
  }

  try {
    const signedIds = await processAIFreeAgentSignings(seasonId, currentDate, userTeamId);
    if (signedIds.length > 0) events.push(`AI 팀 FA 영입 ${signedIds.length}건`);
  } catch (e) {
    console.warn('[dayAdvancer] processAIFreeAgentSignings failed:', e);
  }

  try {
    const aiTransfers = await processAITransfers(seasonId, currentDate, userTeamId);
    if (aiTransfers.length > 0) {
      events.push(`AI 팀 이적 ${aiTransfers.length}건`);
    }
  } catch (e) {
    console.warn('[dayAdvancer] processAITransfers failed:', e);
  }

  try {
    await weeklyStaffMoraleRecovery(userTeamId);
  } catch (e) {
    console.warn('[dayAdvancer] weeklyStaffMoraleRecovery failed:', e);
  }

  try {
    const decayEvents = await processFacilityDecay(userTeamId);
    events.push(...decayEvents);
    const maintenanceCost = await calculateMaintenanceCost(userTeamId);
    if (maintenanceCost > 0) {
      await db.execute('UPDATE teams SET budget = budget - $1 WHERE id = $2', [maintenanceCost, userTeamId]);
      events.push(`시설 유지비: ${maintenanceCost.toLocaleString()}만`);
    }
  } catch (e) {
    console.warn('[dayAdvancer] facility maintenance failed:', e);
  }

  try {
    const allTeams = await getAllTeams();
    const teamsInfo = allTeams.map(t => ({ id: t.id, name: t.name, shortName: t.shortName ?? t.name }));
    const scandal = await generateScandalNews(seasonId, currentDate, teamsInfo);
    if (scandal) {
      events.push(`스캔들 발생: ${scandal.teamId}`);
      const scandalPlayers = await getPlayersByTeamId(scandal.teamId);
      if (scandalPlayers.length > 0) {
        await db.execute(
          `UPDATE player_daily_condition SET morale = MAX(0, morale - $1)
           WHERE player_id IN (${scandalPlayers.map((_, i) => `$${i + 2}`).join(',')})`,
          [scandal.moralePenalty, ...scandalPlayers.map(p => p.id)],
        ).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('[dayAdvancer] scandal news failed:', e);
  }

  const season2 = await getActiveSeason();
  const currentWeek = season2?.currentWeek ?? 0;
  if (currentWeek > 0 && currentWeek % 2 === 0) {
    const patchNumber = Math.floor(currentWeek / 2);
    const patchResult = await generatePatch(seasonId, patchNumber, currentWeek);
    events.push(`패치 ${patchNumber} 적용 (${patchResult.entries.length}건 변경)`);
    await insertDailyEvent(seasonId, currentDate, 'patch', undefined, patchResult.patchNote);
  }

  return { events };
}

export async function processMonthlyTasks(): Promise<{ events: string[] }> {
  return { events: [] };
}

export async function processSeasonTransition(
  saveId: number | undefined,
  userTeamId: string,
  seasonId: number,
  currentDate: string,
  dayType: DayType,
  nextDate: string,
): Promise<{ events: string[]; isSeasonEnd: boolean }> {
  const events: string[] = [];

  const season = await getActiveSeason();
  const isSeasonEnd = season ? nextDate > season.endDate : false;

  if (isSeasonEnd) {
    events.push('시즌 종료');

    try {
      const userPlayers = await getPlayersByTeamId(userTeamId);
      let goalsAchieved = 0;
      let goalsFailed = 0;
      for (const p of userPlayers) {
        const result = await checkGoalAchievement(p.id, seasonId);
        if (result?.achieved) goalsAchieved++;
        else if (result) goalsFailed++;
      }
      if (goalsAchieved > 0) events.push(`선수 목표 달성 ${goalsAchieved}건`);
      if (goalsFailed > 0) events.push(`선수 목표 실패 ${goalsFailed}건`);
    } catch (e) {
      console.warn('[dayAdvancer] checkGoalAchievement failed:', e);
    }
  }

  if (saveId != null && (dayType === 'match_day' || isSeasonEnd)) {
    try {
      const ctx = await buildAchievementContext(saveId, userTeamId, seasonId);
      if (isSeasonEnd) ctx.isFirstSeason = (ctx.seasonsPlayed ?? 1) <= 1;
      const newAchievements = await checkAndUnlockAchievements(saveId, ctx, currentDate);
      for (const a of newAchievements) {
        events.push(`업적 해금: ${a.name}`);
      }
    } catch (e) {
      console.warn('[dayAdvancer] checkAchievements failed:', e);
    }
  }

  return { events, isSeasonEnd };
}
