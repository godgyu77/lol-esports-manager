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
import { processExpiredContracts } from '../economy/transferEngine';
import {
  generateMSI,
  generateWorlds,
  generateEWC,
  generateLCKCup,
  generateFST,
  getWorldsQualifiedTeams,
  getTournamentStandings,
} from '../tournament/tournamentEngine';

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
): Promise<SeasonEndResult> {
  const standings = await getStandings(season.id);

  // 성장 계산
  const allPlayers = await getAllPlayers();
  const formAverages: Record<string, number> = {};
  for (const player of allPlayers) {
    formAverages[player.id] = await getPlayerAverageForm(player.id);
  }

  const seasonSeed = `s${season.year}_${season.split}`;
  const growthResults = calculateTeamGrowth(allPlayers, seasonSeed, formAverages);

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

  return {
    standings,
    growthResults,
    nextSeasonId: txResult?.newSeasonId ?? null,
    nextSplit,
    nextYear,
    championTeamId,
    freedPlayerIds: txResult?.freedPlayerIds ?? [],
    createdTournaments,
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
  year: number,
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
  year: number,
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
