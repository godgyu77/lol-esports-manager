/**
 * 시즌 종료 처리
 * - 정규시즌 종료 → 플레이오프 생성
 * - 플레이오프 종료 → 성장/하락 적용 → 다음 스플릿
 * - 대회 자동 생성 (LCK Cup, FST, MSI, EWC, Worlds)
 */

import type { Region, Season, Split } from '../../types/game';
import {
  getAllPlayers,
  getStandings,
  getPlayerAverageForm,
  updatePlayerStats,
  incrementAllPlayerAges,
  deactivateSeason,
  createSeason,
  getTeamsByRegion,
  insertMatch,
  updateSeasonDate,
} from '../../db/queries';
import { withTransaction } from '../../db/database';
import { calculateTeamGrowth, type GrowthResult } from '../player/playerGrowth';
import { generateLeagueSchedule } from './scheduleGenerator';
import { assignMatchDates, SEASON_DATES, addDays } from './calendar';
import { generatePlayoffSchedule } from './playoffGenerator';
import { initializeTeamChemistry } from '../chemistry/chemistryEngine';
import { generatePlayerGoals } from '../playerGoal/playerGoalEngine';
import { processExpiredContracts } from '../economy/transferEngine';
import {
  generateMSI,
  generateWorlds,
  generateEWC,
  generateLCKCup,
  generateFST,
  getWorldsQualifiedTeams,
} from '../tournament/tournamentEngine';
import { calculateSeasonAwards } from '../award/awardEngine';
import { saveSeasonRecord, addHallOfFameEntry, checkAndInductHallOfFame } from '../records/recordsEngine';
import { checkRetirementCandidates } from '../retirement/retirementEngine';
import { startOffseason } from './offseasonEngine';
import { checkGoalAchievement } from '../playerGoal/playerGoalEngine';
import { checkOwnershipChange } from '../board/ownershipEngine';
import { getBoardExpectations } from '../board/boardEngine';
import { buildAchievementContext, checkAndUnlockAchievements } from '../achievement/achievementEngine';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

/** 정규시즌 종료 결과 */
export interface RegularSeasonEndResult {
  standings: {
    teamId: string;
    wins: number;
    losses: number;
    setWins: number;
    setLosses: number;
  }[];
  /** 플레이오프 진출 팀 (상위 6팀) */
  playoffTeamIds: string[];
  /** 플레이오프 시작일 */
  playoffStartDate: string;
}

/** 플레이오프 종료 후 전체 시즌 결과 */
export interface SeasonEndResult {
  standings: {
    teamId: string;
    wins: number;
    losses: number;
    setWins: number;
    setLosses: number;
  }[];
  growthResults: GrowthResult[];
  nextSeasonId: number | null;
  nextSplit: Split;
  /** 다음 시즌 연도 */
  nextYear: number;
  /** 플레이오프 우승 팀 */
  championTeamId?: string;
  /** 계약 만료로 자유계약 전환된 선수 IDs */
  freedPlayerIds?: string[];
  /** 생성된 대회 목록 */
  createdTournaments?: string[];
  /** 은퇴한 선수 목록 */
  retiredPlayers?: { playerId: string; playerName: string; reason: string }[];
}

// ─────────────────────────────────────────
// 정규시즌 종료 → 플레이오프 생성
// ─────────────────────────────────────────

/**
 * 정규시즌 종료 처리: 순위 확정 + 플레이오프 스케줄 생성
 */
export async function processRegularSeasonEnd(
  season: Season,
  userTeamRegion: Region,
): Promise<RegularSeasonEndResult> {
  const standings = await getStandings(season.id);

  const regionTeams = await getTeamsByRegion(userTeamRegion);
  const regionTeamIds = new Set(regionTeams.map(t => t.id));
  const regionStandings = standings.filter(s => regionTeamIds.has(s.teamId));
  const playoffTeamIds = regionStandings.slice(0, 6).map(s => s.teamId);

  // 플레이오프 시작일: 정규시즌 종료일 + 3일
  const playoffStartDate = addDays(season.endDate, 3);

  await generatePlayoffSchedule(season.id, regionStandings.slice(0, 6), playoffStartDate);

  await updateSeasonDate(season.id, playoffStartDate);

  return {
    standings,
    playoffTeamIds,
    playoffStartDate,
  };
}

// ─────────────────────────────────────────
// 전체 시즌 종료 (플레이오프 후)
// ─────────────────────────────────────────

/**
 * 전체 시즌 종료 처리
 * 플레이오프까지 완료된 후 호출
 */
export async function processFullSeasonEnd(
  season: Season,
  championTeamId?: string,
  saveId?: number,
  userTeamId?: string,
): Promise<SeasonEndResult> {
  const standings = await getStandings(season.id);

  // 성장 계산
  const allPlayers = await getAllPlayers();
  const formAverages: Record<string, number> = {};
  for (const player of allPlayers) {
    formAverages[player.id] = await getPlayerAverageForm(player.id);
  }

  // 선수별 출전 경기 수 조회
  const playerGamesPlayed: Record<string, number> = {};
  try {
    const db = await (await import('../../db/database')).getDatabase();
    const gamesRows = await db.select<{ player_id: string; cnt: number }[]>(
      `SELECT pgs.player_id, COUNT(*) as cnt
       FROM player_game_stats pgs
       JOIN matches m ON m.id = pgs.match_id
       WHERE m.season_id = $1 AND m.is_played = 1
       GROUP BY pgs.player_id`,
      [season.id],
    );
    for (const row of gamesRows) {
      playerGamesPlayed[row.player_id] = row.cnt;
    }
  } catch { /* 출전 수 조회 실패 시 기본값 사용 */ }

  const seasonSeed = `s${season.year}_${season.split}`;
  const growthResults = calculateTeamGrowth(allPlayers, seasonSeed, formAverages, playerGamesPlayed);

  // spring → summer (같은 해), summer → spring (다음 해)
  const nextSplit: Split = season.split === 'spring' ? 'summer' : 'spring';
  const nextYear = season.split === 'spring' ? season.year : season.year + 1;

  const txResult = await withTransaction(async () => {
    // 성장 스탯 적용
    for (const gr of growthResults) {
      await updatePlayerStats(gr.playerId, gr.newStats);
    }

    // 나이 증가 (summer 종료 시)
    if (season.split === 'summer') {
      await incrementAllPlayerAges();
    }

    // 계약 만료 선수 자유계약 전환
    const freedPlayerIds = await processExpiredContracts(season.id);

    // 현재 시즌 비활성화
    await deactivateSeason(season.id);

    // 다음 스플릿 생성
    const newSeasonId = await createSeason(nextYear, nextSplit);

    const regions: Region[] = ['LCK', 'LPL', 'LEC', 'LCS'];
    const baseStartDate = SEASON_DATES[nextSplit].start;
    const startDate = `${nextYear}${baseStartDate.slice(4)}`;

    for (const region of regions) {
      const teams = await getTeamsByRegion(region);
      const teamIds = teams.map(t => t.id);
      const schedule = generateLeagueSchedule(region, teamIds);
      const datedSchedule = assignMatchDates(schedule, startDate);

      for (let i = 0; i < datedSchedule.length; i++) {
        const match = datedSchedule[i];
        const matchId = `${region.toLowerCase()}_s${newSeasonId}_w${match.week}_${i}`;
        await insertMatch({
          id: matchId,
          seasonId: newSeasonId,
          week: match.week,
          teamHomeId: match.homeTeamId,
          teamAwayId: match.awayTeamId,
          matchDate: match.date,
          fearlessDraft: nextSplit === 'spring', // 스프링 정규시즌 피어리스 적용
        });
      }
    }

    // 다음 시즌 케미스트리/목표 초기화
    try {
      const allTeams2 = await getTeamsByRegion('LCK');
      const allTeams3 = await getTeamsByRegion('LPL');
      const allTeams4 = await getTeamsByRegion('LEC');
      const allTeams5 = await getTeamsByRegion('LCS');
      for (const team of [...allTeams2, ...allTeams3, ...allTeams4, ...allTeams5]) {
        await initializeTeamChemistry(team.id);
        await generatePlayerGoals(team.id, newSeasonId);
      }
    } catch (e) {
      console.warn('[seasonEnd] 케미스트리/목표 초기화 실패:', e);
    }

    return { newSeasonId, freedPlayerIds };
  });

  // 대회 자동 생성
  const createdTournaments: string[] = [];
  const tournamentSeasonId = txResult?.newSeasonId ?? season.id;

  if (championTeamId) {
    if (season.split === 'spring') {
      // 스프링 종료 → MSI + EWC 생성
      const springChampions = await getRegionChampions(standings);
      const msiId = await generateMSI(tournamentSeasonId, season.year, springChampions);
      createdTournaments.push(msiId);

      // EWC: 각 리전 스프링 상위 2팀
      const ewcTeams = await getRegionTopTeams(season.year, 2);
      const ewcId = await generateEWC(tournamentSeasonId, season.year, ewcTeams);
      createdTournaments.push(ewcId);

    } else if (season.split === 'summer') {
      // 서머 종료 → Worlds + 다음해 LCK Cup + FST 생성
      const qualifiedTeams = await getWorldsQualifiedTeams(season.year);
      const worldsId = await generateWorlds(tournamentSeasonId, season.year, qualifiedTeams);
      createdTournaments.push(worldsId);

      // 다음해 LCK Cup
      const lckTeams = await getTeamsByRegion('LCK');
      const lckTeamIds = lckTeams.map(t => t.id);
      const lckCupId = await generateLCKCup(tournamentSeasonId, nextYear, lckTeamIds);
      createdTournaments.push(lckCupId);

      // FST: LCK Cup 결과는 아직 없으므로, 각 리전 상위 팀으로 예비 등록
      // (LCK Cup 완료 후 실제 참가팀으로 업데이트됨)
      const fstParticipants = await getFSTParticipants(nextYear);
      const fstId = await generateFST(tournamentSeasonId, nextYear, fstParticipants);
      createdTournaments.push(fstId);
    }
  }

  // 은퇴 체크 (서머 시즌 종료 시에만)
  let retiredPlayers: { playerId: string; playerName: string; reason: string }[] = [];
  if (season.split === 'summer') {
    try {
      const candidates = await checkRetirementCandidates(season.id, season.endDate);
      retiredPlayers = candidates.map(c => ({
        playerId: c.playerId,
        playerName: c.playerName,
        reason: c.reason,
      }));
    } catch (err) {
      console.error('은퇴 체크 실패:', err);
    }
  }

  // 어워드 산출
  try {
    await calculateSeasonAwards(season.id);
  } catch (err) {
    console.error('어워드 산출 실패:', err);
  }

  // 시즌 기록 저장
  try {
    for (const standing of standings) {
      const isChampion = standing.teamId === championTeamId;
      await saveSeasonRecord(
        season.id, standing.teamId,
        standings.indexOf(standing) + 1,
        standing.wins, standing.losses,
        isChampion ? '우승' : null,
        isChampion,
      );
    }
    if (championTeamId) {
      const seasonInfo = `${season.year} ${season.split === 'spring' ? '스프링' : '서머'}`;
      await addHallOfFameEntry(
        season.id, 'champion', null, championTeamId, null,
        `${seasonInfo} 우승`, season.endDate,
      );
    }
  } catch (err) {
    console.error('시즌 기록 저장 실패:', err);
  }

  // 은퇴 선수 명예의 전당 자동 심사
  if (retiredPlayers.length > 0) {
    try {
      const retiredIds = retiredPlayers.map(r => r.playerId);
      await checkAndInductHallOfFame(season.id, retiredIds, season.endDate);
    } catch (err) {
      console.error('명예의 전당 심사 실패:', err);
    }
  }

  // 선수 목표 달성 확인
  try {
    for (const player of allPlayers) {
      await checkGoalAchievement(player.id, season.id);
    }
  } catch (err) {
    console.error('선수 목표 달성 확인 실패:', err);
  }

  // 구단주 교체 체크
  try {
    const allTeams = [...new Set(standings.map(s => s.teamId))];
    for (const teamId of allTeams) {
      const boardExp = await getBoardExpectations(teamId, season.id);
      if (boardExp) {
        await checkOwnershipChange(teamId, season.id, boardExp.satisfaction);
      }
    }
  } catch (err) {
    console.error('구단주 교체 체크 실패:', err);
  }

  // 업적 체크 (시즌 종료 시)
  if (saveId != null) {
    try {
      // save_metadata에서 실제 유저 팀 ID 조회
      const ctx = await buildAchievementContext(saveId, userTeamId ?? '', season.id);
      ctx.isPlayoffChampion = championTeamId != null && ctx.trophyCount > 0;
      ctx.isFirstSeason = ctx.seasonsPlayed <= 1;
      await checkAndUnlockAchievements(saveId, ctx, season.endDate);
    } catch (err) {
      console.error('업적 체크 실패:', err);
    }
  }

  // 오프시즌 시작
  if (saveId != null) {
    try {
      const offseasonStart = addDays(season.endDate, 1);
      await startOffseason(saveId, offseasonStart);
    } catch (err) {
      console.error('오프시즌 시작 실패:', err);
    }
  }

  return {
    standings,
    growthResults,
    nextSeasonId: txResult?.newSeasonId ?? null,
    nextSplit,
    nextYear,
    championTeamId,
    freedPlayerIds: txResult?.freedPlayerIds ?? [],
    createdTournaments,
    retiredPlayers,
  };
}

// ─────────────────────────────────────────
// 헬퍼 함수
// ─────────────────────────────────────────

/** 각 리전 1위 팀을 챔피언으로 지정 */
async function getRegionChampions(
  standings: { teamId: string }[],
): Promise<Record<Region, string>> {
  const regions: Region[] = ['LCK', 'LPL', 'LEC', 'LCS'];
  const champions = {} as Record<Region, string>;

  for (const region of regions) {
    const regionTeams = await getTeamsByRegion(region);
    const regionTeamIds = new Set(regionTeams.map(t => t.id));
    const regionStandings = standings.filter(s => regionTeamIds.has(s.teamId));
    champions[region] = regionStandings[0]?.teamId ?? regionTeams[0]?.id ?? '';
  }

  return champions;
}

/** 각 리전 상위 N팀 조회 */
async function getRegionTopTeams(
  _year: number,
  count: number,
): Promise<Record<Region, string[]>> {
  const regions: Region[] = ['LCK', 'LPL', 'LEC', 'LCS'];
  const result: Record<Region, string[]> = { LCK: [], LPL: [], LEC: [], LCS: [] };

  for (const region of regions) {
    const teams = await getTeamsByRegion(region);
    // reputation 기반 상위 N팀
    const sorted = [...teams].sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0));
    result[region] = sorted.slice(0, count).map(t => t.id);
  }

  return result;
}

/** FST 참가팀 결정 (각 리전 1시드 + LCK 추가 2팀) */
async function getFSTParticipants(
  _year: number,
): Promise<{ teamId: string; region: Region }[]> {
  const participants: { teamId: string; region: Region }[] = [];
  const regions: Region[] = ['LCK', 'LPL', 'LEC', 'LCS'];

  for (const region of regions) {
    const teams = await getTeamsByRegion(region);
    const sorted = [...teams].sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0));

    // 각 리전 1시드
    if (sorted[0]) {
      participants.push({ teamId: sorted[0].id, region });
    }

    // LCK는 추가 1팀 (LCK Cup 우승/준우승 예비)
    if (region === 'LCK' && sorted[1]) {
      participants.push({ teamId: sorted[1].id, region });
    }
  }

  // 8팀 채우기 위해 나머지 리전에서 추가
  const remaining: Region[] = ['LPL', 'LEC', 'LCS'];
  for (const region of remaining) {
    if (participants.length >= 8) break;
    const teams = await getTeamsByRegion(region);
    const sorted = [...teams].sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0));
    if (sorted[1] && !participants.some(p => p.teamId === sorted[1].id)) {
      participants.push({ teamId: sorted[1].id, region });
    }
  }

  return participants.slice(0, 8);
}
