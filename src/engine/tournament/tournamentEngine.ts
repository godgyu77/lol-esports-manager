/**
 * �?�� ?�???�진 (LCK Cup / FST / MSI / EWC / Worlds)
 * - LCK Cup: 10?� ?�블 ?�운?�로�?Bo3 ???�레?�오??(?�어리스)
 * - FST: 8?� ?��? ?�리미네?�션 Bo5 (?�일 리전 ?�전 방�?)
 * - MSI: ?�프�?챔피??4?� ??그룹 ?�블 ?�운?�로�????��? ??결승
 * - EWC: 8?� ?��? ?�리미네?�션 (8�?Bo3, 4�?결승 Bo5)
 * - Worlds: 14?� ?�위???�테?��? ??8?� ?�아??
 */

import type { Region } from '../../types/game';
import type { MatchType } from '../../types/match';
import { LEAGUE_CONSTANTS } from '../../data/systemPrompt';
import { getDatabase } from '../../db/database';
import { insertMatch, getMatchById, getPlayersByTeamId } from '../../db/queries';
import { addDays, getTournamentDates } from '../season/calendar';
import { registerTournamentAbsence, clearTournamentAbsence } from './tournamentAbsence';
import { buildSeededQuarterfinalPairs, drawFSTBracket } from './tournamentPairings';

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// ?�??
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�

export type TournamentType = 'msi' | 'worlds' | 'lck_cup' | 'fst' | 'ewc';
export type TournamentStatus = 'scheduled' | 'group_stage' | 'swiss_stage' | 'knockout' | 'completed';

export interface Tournament {
  id: string;
  type: TournamentType;
  year: number;
  seasonId: number;
  startDate: string;
  endDate: string;
  status: TournamentStatus;
}

export interface TournamentParticipant {
  tournamentId: string;
  teamId: string;
  region: Region;
  seed: number;
  groupName: string | null;
}

export interface GroupStanding {
  teamId: string;
  region: Region;
  wins: number;
  losses: number;
  groupName: string;
}

export interface SwissRecord {
  tournamentId: string;
  teamId: string;
  region: Region;
  wins: number;
  losses: number;
  round: number;
  status: 'active' | 'advanced' | 'eliminated';
}

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// DB ?�퍼
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�

/** ?�???�성 */
export async function createTournament(
  type: TournamentType,
  year: number,
  seasonId: number,
  startDate: string,
  endDate: string,
): Promise<string> {
  const db = await getDatabase();
  const id = `${type}_${year}`;
  await db.execute(
    `INSERT OR IGNORE INTO tournaments (id, type, year, season_id, start_date, end_date, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')`,
    [id, type, year, seasonId, startDate, endDate],
  );
  return id;
}

/** ?�??참�??� 추�? */
export async function addTournamentParticipant(
  tournamentId: string,
  teamId: string,
  region: Region,
  seed: number,
  group: string | null,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO tournament_participants (tournament_id, team_id, region, seed, group_name)
     VALUES ($1, $2, $3, $4, $5)`,
    [tournamentId, teamId, region, seed, group],
  );
}

/** ?�???�태 변�?*/
export async function updateTournamentStatus(
  tournamentId: string,
  status: TournamentStatus,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE tournaments SET status = $1 WHERE id = $2',
    [status, tournamentId],
  );

  // ?�???�료 ??참�? ?�수 부??기록 ?�제
  if (status === 'completed') {
    await clearTournamentAbsence(tournamentId);
  }
}

/** ?�??조회 */
export async function getTournament(tournamentId: string): Promise<Tournament | null> {
  const db = await getDatabase();
  const rows = await db.select<{
    id: string; type: string; year: number; season_id: number;
    start_date: string; end_date: string; status: string;
  }[]>('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    type: r.type as TournamentType,
    year: r.year,
    seasonId: r.season_id,
    startDate: r.start_date,
    endDate: r.end_date,
    status: r.status as TournamentStatus,
  };
}

/** ?�도�??�??목록 조회 */
export async function getTournamentsByYear(year: number): Promise<Tournament[]> {
  const db = await getDatabase();
  const rows = await db.select<{
    id: string; type: string; year: number; season_id: number;
    start_date: string; end_date: string; status: string;
  }[]>('SELECT * FROM tournaments WHERE year = $1 ORDER BY start_date', [year]);
  return rows.map((r) => ({
    id: r.id,
    type: r.type as TournamentType,
    year: r.year,
    seasonId: r.season_id,
    startDate: r.start_date,
    endDate: r.end_date,
    status: r.status as TournamentStatus,
  }));
}

/** ?�??참�??� 조회 */
export async function getTournamentParticipants(
  tournamentId: string,
): Promise<TournamentParticipant[]> {
  const db = await getDatabase();
  const rows = await db.select<{
    tournament_id: string; team_id: string; region: string;
    seed: number; group_name: string | null;
  }[]>(
    'SELECT * FROM tournament_participants WHERE tournament_id = $1 ORDER BY group_name, seed',
    [tournamentId],
  );
  return rows.map((r) => ({
    tournamentId: r.tournament_id,
    teamId: r.team_id,
    region: r.region as Region,
    seed: r.seed,
    groupName: r.group_name,
  }));
}

/** 그룹 ?�탠??조회 (MSI/LCK Cup ?? */
export async function getTournamentStandings(
  tournamentId: string,
  groupName?: string,
): Promise<GroupStanding[]> {
  const db = await getDatabase();

  const tournament = await getTournament(tournamentId);
  if (!tournament) return [];

  // ?�?�별 그룹 매치?�??결정
  let matchTypePrefix: string;
  if (tournament.type === 'msi') matchTypePrefix = 'msi_group';
  else if (tournament.type === 'lck_cup') matchTypePrefix = 'lck_cup_regular';
  else return [];

  const participants = await getTournamentParticipants(tournamentId);
  const filtered = groupName
    ? participants.filter((p) => p.groupName === groupName)
    : participants;

  const matchRows = await db.select<{
    team_home_id: string; team_away_id: string;
    score_home: number; score_away: number;
  }[]>(
    `SELECT team_home_id, team_away_id, score_home, score_away
     FROM matches
     WHERE season_id = $1 AND match_type = $2 AND is_played = TRUE
       AND id LIKE $3`,
    [tournament.seasonId, matchTypePrefix, `${tournamentId}%`],
  );

  const standingMap = new Map<string, GroupStanding>();
  for (const p of filtered) {
    standingMap.set(p.teamId, {
      teamId: p.teamId,
      region: p.region,
      wins: 0,
      losses: 0,
      groupName: p.groupName ?? '',
    });
  }

  for (const m of matchRows) {
    if (m.score_home > m.score_away) {
      const s = standingMap.get(m.team_home_id);
      if (s) s.wins++;
      const l = standingMap.get(m.team_away_id);
      if (l) l.losses++;
    } else if (m.score_away > m.score_home) {
      const s = standingMap.get(m.team_away_id);
      if (s) s.wins++;
      const l = standingMap.get(m.team_home_id);
      if (l) l.losses++;
    }
  }

  return [...standingMap.values()].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
}

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// ?�위???�코??DB ?�퍼
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�

/** ?�위???�코??초기??*/
async function initSwissRecords(
  tournamentId: string,
  participants: TournamentParticipant[],
): Promise<void> {
  const db = await getDatabase();
  for (const p of participants) {
    await db.execute(
      `INSERT INTO swiss_records (tournament_id, team_id, wins, losses, round, status)
       VALUES ($1, $2, 0, 0, 0, 'active')`,
      [tournamentId, p.teamId],
    );
  }
}

/** ?�위???�코??조회 */
export async function getSwissRecords(tournamentId: string): Promise<SwissRecord[]> {
  const db = await getDatabase();
  const rows = await db.select<{
    tournament_id: string; team_id: string; wins: number;
    losses: number; round: number; status: string;
  }[]>(
    'SELECT * FROM swiss_records WHERE tournament_id = $1 ORDER BY wins DESC, losses ASC',
    [tournamentId],
  );
  // 참�??� ?�보?�서 리전 가?�오�?
  const participants = await getTournamentParticipants(tournamentId);
  const regionMap = new Map(participants.map(p => [p.teamId, p.region]));

  return rows.map(r => ({
    tournamentId: r.tournament_id,
    teamId: r.team_id,
    region: regionMap.get(r.team_id) ?? 'LCK',
    wins: r.wins,
    losses: r.losses,
    round: r.round,
    status: r.status as SwissRecord['status'],
  }));
}

/** ?�위???�코???�데?�트 (????증�?) */
async function updateSwissRecord(
  tournamentId: string,
  teamId: string,
  isWin: boolean,
  round: number,
): Promise<void> {
  const db = await getDatabase();
  if (isWin) {
    await db.execute(
      `UPDATE swiss_records SET wins = wins + 1, round = $1 WHERE tournament_id = $2 AND team_id = $3`,
      [round, tournamentId, teamId],
    );
  } else {
    await db.execute(
      `UPDATE swiss_records SET losses = losses + 1, round = $1 WHERE tournament_id = $2 AND team_id = $3`,
      [round, tournamentId, teamId],
    );
  }
}

/** ?�위???�코???�태 변�?(진출/?�락) */
async function updateSwissStatus(
  tournamentId: string,
  teamId: string,
  status: 'advanced' | 'eliminated',
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `UPDATE swiss_records SET status = $1 WHERE tournament_id = $2 AND team_id = $3`,
    [status, tournamentId, teamId],
  );
}

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// �?��?�??참�? ?�수 부???�록 ?�퍼
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�

/** 참�??� ?�수?�의 ?�??기간 부???�괄 ?�록 */
async function registerAbsenceForParticipants(
  tournamentId: string,
  teamIds: string[],
  startDate: string,
  endDate: string,
): Promise<void> {
  for (const teamId of teamIds) {
    const players = await getPlayersByTeamId(teamId);
    for (const player of players) {
      await registerTournamentAbsence(player.id, teamId, tournamentId, startDate, endDate);
    }
  }
}

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// 그룹 ?��?�??�성 (?�운?�로�?
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�

/** ?�블 ?�운?�로�?매치 ?�성 */
export async function generateGroupSchedule(
  tournamentId: string,
  seasonId: number,
  groups: Map<string, string[]>,
  startDate: string,
  matchType: MatchType,
  boFormat: 'Bo1' | 'Bo3' | 'Bo5',
  fearlessDraft = false,
): Promise<void> {
  let matchIndex = 1;
  let dayOffset = 0;
  const matchesPerDay = boFormat === 'Bo3' ? 3 : 2;

  for (const [groupName, teamIds] of groups) {
    const pairs: [string, string][] = [];

    // ?�블 ?�운?�로�?
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        pairs.push([teamIds[i], teamIds[j]]);
        pairs.push([teamIds[j], teamIds[i]]);
      }
    }

    let dayMatchCount = 0;
    for (const [home, away] of pairs) {
      const prefix = tournamentId.startsWith('msi') ? `${tournamentId}_g` : `${tournamentId}_${groupName}`;
      const matchId = `${prefix}_${matchIndex}`;
      const matchDate = addDays(startDate, dayOffset);

      await insertMatch({
        id: matchId,
        seasonId,
        week: 0,
        teamHomeId: home,
        teamAwayId: away,
        matchDate,
        matchType,
        boFormat,
        fearlessDraft,
      });

      matchIndex++;
      dayMatchCount++;

      if (dayMatchCount >= matchesPerDay) {
        dayMatchCount = 0;
        dayOffset++;
      }
    }

    if (dayMatchCount > 0) dayOffset++;
  }
}

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// LCK Cup ?�성
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�

/**
 * LCK Cup (?�터 ?�플�? ?�성
 * - 10?� ?�블 ?�운?�로�?Bo3 (?�어리스 ?�래?�트)
 * - ?�위 6?� ?�레?�오??
 */
export async function generateLCKCup(
  seasonId: number,
  year: number,
  lckTeamIds: string[],
): Promise<string> {
  const dates = getTournamentDates('lck_cup', year);
  const tournamentId = await createTournament('lck_cup', year, seasonId, dates.start, dates.end);

  // 참�??� ?�록
  for (let i = 0; i < lckTeamIds.length; i++) {
    await addTournamentParticipant(tournamentId, lckTeamIds[i], 'LCK', i + 1, null);
  }

  // ?�블 ?�운?�로�?Bo3 (?�어리스)
  const groups = new Map<string, string[]>();
  groups.set('A', lckTeamIds);

  await generateGroupSchedule(
    tournamentId,
    seasonId,
    groups,
    dates.start,
    'lck_cup_regular',
    'Bo3',
    true, // ?�어리스 ?�래?�트
  );

  await updateTournamentStatus(tournamentId, 'group_stage');
  return tournamentId;
}

/**
 * LCK Cup ?�규?�즌 종료 ???�레?�오???�성
 * ?�위 6?�: 3vs6, 4vs5 (Bo3), 1/2?�드 준결승 직행 (Bo5), 결승 (Bo5)
 */
export async function generateLCKCupPlayoff(
  tournamentId: string,
  seasonId: number,
  standings: GroupStanding[],
): Promise<void> {
  const db = await getDatabase();

  // 마�?�??�규경기 ?�짜 + 3??
  const lastMatch = await db.select<{ match_date: string }[]>(
    `SELECT match_date FROM matches WHERE id LIKE $1 AND match_type = 'lck_cup_regular' AND is_played = TRUE ORDER BY match_date DESC LIMIT 1`,
    [`${tournamentId}%`],
  );
  const baseDate = lastMatch[0]?.match_date ?? addDays(tournamentId.includes('_') ? `${tournamentId.split('_').pop()}-02-15` : '2026-02-15', 0);
  const startDate = addDays(baseDate, 3);

  const top6 = standings.slice(0, 6);

  // 8�? 3vs6, 4vs5 (Bo3)
  await insertMatch({
    id: `${tournamentId}_q1`, seasonId, week: 0,
    teamHomeId: top6[2].teamId, teamAwayId: top6[5].teamId,
    matchDate: startDate, matchType: 'lck_cup_playoff_quarters', boFormat: 'Bo3',
    fearlessDraft: true,
  });
  await insertMatch({
    id: `${tournamentId}_q2`, seasonId, week: 0,
    teamHomeId: top6[3].teamId, teamAwayId: top6[4].teamId,
    matchDate: addDays(startDate, 1), matchType: 'lck_cup_playoff_quarters', boFormat: 'Bo3',
    fearlessDraft: true,
  });

  // 준결승: 1vs(4v5?�자), 2vs(3v6?�자) (Bo5)
  await insertMatch({
    id: `${tournamentId}_sf1`, seasonId, week: 0,
    teamHomeId: top6[1].teamId, teamAwayId: 'TBD',
    matchDate: addDays(startDate, 4), matchType: 'lck_cup_playoff_semis', boFormat: 'Bo5',
    fearlessDraft: true,
  });
  await insertMatch({
    id: `${tournamentId}_sf2`, seasonId, week: 0,
    teamHomeId: top6[0].teamId, teamAwayId: 'TBD',
    matchDate: addDays(startDate, 5), matchType: 'lck_cup_playoff_semis', boFormat: 'Bo5',
    fearlessDraft: true,
  });

  // 결승 (Bo5)
  await insertMatch({
    id: `${tournamentId}_final`, seasonId, week: 0,
    teamHomeId: 'TBD', teamAwayId: 'TBD',
    matchDate: addDays(startDate, 9), matchType: 'lck_cup_playoff_finals', boFormat: 'Bo5',
    fearlessDraft: true,
  });

  await updateTournamentStatus(tournamentId, 'knockout');
}

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// First Stand (FST) ?�성
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�

/**
 * First Stand �?��???�성
 * - 8?� ?��? ?�리미네?�션 Bo5
 * - ?�일 리전 ?�전 방�? ?�로??
 * - 참�?: LCK Cup ?�승/준?�승 + �?리전 1?�드 (LPL, LEC, LCS) + ?�?�드카드
 */
export async function generateFST(
  seasonId: number,
  year: number,
  participants: { teamId: string; region: Region }[],
): Promise<string> {
  const dates = getTournamentDates('fst', year);
  const tournamentId = await createTournament('fst', year, seasonId, dates.start, dates.end);

  // 참�??� ?�록
  for (let i = 0; i < participants.length; i++) {
    await addTournamentParticipant(
      tournamentId, participants[i].teamId, participants[i].region, i + 1, null,
    );
  }

  // ?�일 리전 ?�전 방�? ?�로??
  const bracket = drawFSTBracket(participants);

  // 8�?4경기 (Bo5)
  for (let i = 0; i < bracket.length; i++) {
    const [home, away] = bracket[i];
    await insertMatch({
      id: `${tournamentId}_qf${i + 1}`, seasonId, week: 0,
      teamHomeId: home, teamAwayId: away,
      matchDate: addDays(dates.start, i),
      matchType: 'fst_quarter', boFormat: 'Bo5',
      fearlessDraft: true,
    });
  }

  // 4�?2경기 (Bo5)
  await insertMatch({
    id: `${tournamentId}_sf1`, seasonId, week: 0,
    teamHomeId: 'TBD', teamAwayId: 'TBD',
    matchDate: addDays(dates.start, 7), matchType: 'fst_semi', boFormat: 'Bo5',
    fearlessDraft: true,
  });
  await insertMatch({
    id: `${tournamentId}_sf2`, seasonId, week: 0,
    teamHomeId: 'TBD', teamAwayId: 'TBD',
    matchDate: addDays(dates.start, 8), matchType: 'fst_semi', boFormat: 'Bo5',
    fearlessDraft: true,
  });

  // 결승 (Bo5)
  await insertMatch({
    id: `${tournamentId}_final`, seasonId, week: 0,
    teamHomeId: 'TBD', teamAwayId: 'TBD',
    matchDate: addDays(dates.start, 14), matchType: 'fst_final', boFormat: 'Bo5',
    fearlessDraft: true,
  });

  // 참�? ?�수 부???�록
  const fstTeamIds = participants.map((p) => p.teamId);
  await registerAbsenceForParticipants(tournamentId, fstTeamIds, dates.start, dates.end);

  await updateTournamentStatus(tournamentId, 'knockout');
  return tournamentId;
}

/** ?�일 리전 ?�전 방�? 8�??�로??*/

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// MSI ?�성
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�

/**
 * MSI ?�???�성
 * - 4?� (�?리전 ?�프�?챔피??
 * - 그룹: ?�블 ?�운?�로�?Bo1
 * - ?��?: 1st vs 4th, 2nd vs 3rd Bo5
 * - 결승: Bo5
 */
export async function generateMSI(
  seasonId: number,
  year: number,
  springChampions: Record<Region, string>,
): Promise<string> {
  const dates = getTournamentDates('msi', year);
  const tournamentId = await createTournament('msi', year, seasonId, dates.start, dates.end);

  const regions: Region[] = ['LCK', 'LPL', 'LEC', 'LCS'];
  const teamIds: string[] = [];
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    const teamId = springChampions[region];
    teamIds.push(teamId);
    await addTournamentParticipant(tournamentId, teamId, region, i + 1, null);
  }

  // 그룹 ?�테?��?: 4?� ?�일 그룹
  const groups = new Map<string, string[]>();
  groups.set('A', teamIds);

  await generateGroupSchedule(
    tournamentId, seasonId, groups, dates.start, 'msi_group', 'Bo1', true,
  );

  // ?��??�이??
  const semiStartDate = addDays(dates.start, 7);
  await insertMatch({
    id: `${tournamentId}_sf1`, seasonId, week: 0,
    teamHomeId: 'TBD_MSI_SF1_HOME', teamAwayId: 'TBD_MSI_SF1_AWAY',
    matchDate: semiStartDate, matchType: 'msi_semis', boFormat: 'Bo5',
    fearlessDraft: true,
  });
  await insertMatch({
    id: `${tournamentId}_sf2`, seasonId, week: 0,
    teamHomeId: 'TBD_MSI_SF2_HOME', teamAwayId: 'TBD_MSI_SF2_AWAY',
    matchDate: addDays(semiStartDate, 1), matchType: 'msi_semis', boFormat: 'Bo5',
    fearlessDraft: true,
  });

  // 결승
  await insertMatch({
    id: `${tournamentId}_final`, seasonId, week: 0,
    teamHomeId: 'TBD_MSI_FINAL_HOME', teamAwayId: 'TBD_MSI_FINAL_AWAY',
    matchDate: addDays(semiStartDate, 3), matchType: 'msi_final', boFormat: 'Bo5',
    fearlessDraft: true,
  });

  // 참�? ?�수 부???�록
  await registerAbsenceForParticipants(tournamentId, teamIds, dates.start, dates.end);

  await updateTournamentStatus(tournamentId, 'group_stage');
  return tournamentId;
}

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// EWC (Esports World Cup) ?�성
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�

/**
 * EWC ?�성
 * - 8?� ?��? ?�리미네?�션
 * - 8�? Bo3, 4�?결승: Bo5
 * - 참�??�?� ?�머 1주차 컨디???�로 ?�널???�용
 */
export async function generateEWC(
  seasonId: number,
  year: number,
  qualifiedTeams: Record<Region, string[]>,
): Promise<string> {
  const dates = getTournamentDates('ewc', year);
  const tournamentId = await createTournament('ewc', year, seasonId, dates.start, dates.end);

  // �?리전 ?�위 2?� (�?8?�)
  const participants: { teamId: string; region: Region }[] = [];
  const regions: Region[] = ['LCK', 'LPL', 'LEC', 'LCS'];
  for (const region of regions) {
    const teams = qualifiedTeams[region] ?? [];
    for (let i = 0; i < Math.min(2, teams.length); i++) {
      participants.push({ teamId: teams[i], region });
    }
  }

  for (let i = 0; i < participants.length; i++) {
    await addTournamentParticipant(
      tournamentId, participants[i].teamId, participants[i].region, i + 1, null,
    );
  }

  // 8�?4경기 (Bo3) ???�드 기반 매칭 (1vs8, 2vs7, 3vs6, 4vs5)
  const teamIds = participants.map(p => p.teamId);
  const qfPairs = buildSeededQuarterfinalPairs(teamIds);

  for (let i = 0; i < qfPairs.length; i++) {
    const pair = qfPairs[i];
    await insertMatch({
      id: `${tournamentId}_qf${i + 1}`, seasonId, week: 0,
      teamHomeId: pair[0],
      teamAwayId: pair[1],
      matchDate: addDays(dates.start, i),
      matchType: 'ewc_quarter', boFormat: 'Bo3',
    });
  }

  // 4�?(Bo5)
  await insertMatch({
    id: `${tournamentId}_sf1`, seasonId, week: 0,
    teamHomeId: 'TBD', teamAwayId: 'TBD',
    matchDate: addDays(dates.start, 5), matchType: 'ewc_semi', boFormat: 'Bo5',
  });
  await insertMatch({
    id: `${tournamentId}_sf2`, seasonId, week: 0,
    teamHomeId: 'TBD', teamAwayId: 'TBD',
    matchDate: addDays(dates.start, 6), matchType: 'ewc_semi', boFormat: 'Bo5',
  });

  // 결승 (Bo5)
  await insertMatch({
    id: `${tournamentId}_final`, seasonId, week: 0,
    teamHomeId: 'TBD', teamAwayId: 'TBD',
    matchDate: addDays(dates.start, 10), matchType: 'ewc_final', boFormat: 'Bo5',
  });

  // 참�? ?�수 부???�록
  const ewcTeamIds = participants.map((p) => p.teamId);
  await registerAbsenceForParticipants(tournamentId, ewcTeamIds, dates.start, dates.end);

  await updateTournamentStatus(tournamentId, 'knockout');
  return tournamentId;
}

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// Worlds ?�성 (?�위???�테?��?)
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�

/**
 * Worlds ?�???�성
 * - 14?� (LCK 4 + LPL 4 + LEC 3 + LCS 3) ?�위???�테?��?
 * - 3??8?� ?�아?? 8�?4�?결승 모두 Bo5
 */
export async function generateWorlds(
  seasonId: number,
  year: number,
  qualifiedTeams: Record<Region, string[]>,
): Promise<string> {
  const dates = getTournamentDates('worlds', year);
  const tournamentId = await createTournament('worlds', year, seasonId, dates.start, dates.end);

  // 참�??� ?�록
  const regions: Region[] = ['LCK', 'LPL', 'LEC', 'LCS'];
  const allParticipants: TournamentParticipant[] = [];

  for (const region of regions) {
    const teams = qualifiedTeams[region] ?? [];
    for (let i = 0; i < teams.length; i++) {
      const p: TournamentParticipant = {
        tournamentId,
        teamId: teams[i],
        region,
        seed: i + 1,
        groupName: null,
      };
      await addTournamentParticipant(tournamentId, p.teamId, p.region, p.seed, null);
      allParticipants.push(p);
    }
  }

  // ?�위???�코??초기??
  await initSwissRecords(tournamentId, allParticipants);

  // 1?�운??매칭 ?�성
  await generateSwissRound(tournamentId, seasonId, 1, dates.start);

  // ?�아??TBD 매치 미리 ?�성
  const knockoutStart = addDays(dates.start, 25); // ?�위???�료 ??
  for (let i = 1; i <= 4; i++) {
    await insertMatch({
      id: `${tournamentId}_qf${i}`, seasonId, week: 0,
      teamHomeId: 'TBD', teamAwayId: 'TBD',
      matchDate: addDays(knockoutStart, i - 1),
      matchType: 'worlds_quarter', boFormat: 'Bo5',
    });
  }
  await insertMatch({
    id: `${tournamentId}_sf1`, seasonId, week: 0,
    teamHomeId: 'TBD', teamAwayId: 'TBD',
    matchDate: addDays(knockoutStart, 7), matchType: 'worlds_semi', boFormat: 'Bo5',
  });
  await insertMatch({
    id: `${tournamentId}_sf2`, seasonId, week: 0,
    teamHomeId: 'TBD', teamAwayId: 'TBD',
    matchDate: addDays(knockoutStart, 8), matchType: 'worlds_semi', boFormat: 'Bo5',
  });
  await insertMatch({
    id: `${tournamentId}_final`, seasonId, week: 0,
    teamHomeId: 'TBD', teamAwayId: 'TBD',
    matchDate: addDays(knockoutStart, 14), matchType: 'worlds_final', boFormat: 'Bo5',
  });

  // 참�? ?�수 부???�록
  const worldsTeamIds = allParticipants.map((p) => p.teamId);
  await registerAbsenceForParticipants(tournamentId, worldsTeamIds, dates.start, dates.end);

  await updateTournamentStatus(tournamentId, 'swiss_stage');
  return tournamentId;
}

/**
 * ?�위???�테?��? ?�운?�별 매칭 ?�성
 * - 같�? ?�적(W-L)?�리 매칭
 * - 같�? 리전 ?�피 (가?�한 ??
 * - ?�운??1~2: Bo1, ?�운??3~4(진출/?�락??: Bo3
 */
export async function generateSwissRound(
  tournamentId: string,
  seasonId: number,
  round: number,
  startDate: string,
): Promise<void> {
  const records = await getSwissRecords(tournamentId);
  const active = records.filter(r => r.status === 'active');

  // ?�적�?그룹??
  const groups = new Map<string, typeof active>();
  for (const r of active) {
    const key = `${r.wins}-${r.losses}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  // 매칭 ?�성
  const pairs: [string, string][] = [];
  const matched = new Set<string>();

  // ?�적 ?�림차순 처리 (?��? ?�적부??
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    const [aw] = a.split('-').map(Number);
    const [bw] = b.split('-').map(Number);
    return bw - aw;
  });

  const overflow: typeof active = []; // 매칭 ?????�

  for (const key of sortedKeys) {
    const pool = [...(groups.get(key) ?? []), ...overflow.splice(0)];
    const unmatched: typeof active = [];

    for (let i = 0; i < pool.length; i++) {
      if (matched.has(pool[i].teamId)) continue;

      let found = false;
      // 같�? 리전???�닌 ?��? ?�선
      for (let j = i + 1; j < pool.length; j++) {
        if (matched.has(pool[j].teamId)) continue;
        if (pool[j].region !== pool[i].region) {
          pairs.push([pool[i].teamId, pool[j].teamId]);
          matched.add(pool[i].teamId);
          matched.add(pool[j].teamId);
          found = true;
          break;
        }
      }
      if (!found) {
        // 같�? 리전?�어??매칭
        for (let j = i + 1; j < pool.length; j++) {
          if (matched.has(pool[j].teamId)) continue;
          pairs.push([pool[i].teamId, pool[j].teamId]);
          matched.add(pool[i].teamId);
          matched.add(pool[j].teamId);
          found = true;
          break;
        }
      }
      if (!found) unmatched.push(pool[i]);
    }

    overflow.push(...unmatched);
  }

  // ?��? ?� 매칭 (?�?�인 경우 ??14?�?�면 7?�으�???맞음)
  for (let i = 0; i < overflow.length - 1; i += 2) {
    pairs.push([overflow[i].teamId, overflow[i + 1].teamId]);
  }

  // ?�맷 결정: ?�운??1~2??Bo1, ?�운??3~4(진출???�락????Bo3
  const boFormat: 'Bo1' | 'Bo3' = round <= 2 ? 'Bo1' : 'Bo3';

  // 매치 ?�성
  const roundStartDate = addDays(startDate, (round - 1) * 4);
  for (let i = 0; i < pairs.length; i++) {
    const [home, away] = pairs[i];
    await insertMatch({
      id: `${tournamentId}_swiss_r${round}_${i + 1}`,
      seasonId,
      week: 0,
      teamHomeId: home,
      teamAwayId: away,
      matchDate: addDays(roundStartDate, Math.floor(i / 3)),
      matchType: 'worlds_swiss',
      boFormat,
    });
  }
}

/**
 * ?�위???�운??결과 처리
 * - 3????advanced, 3????eliminated
 * - 모든 active ?�??3???�는 3?�이�??�위??종료
 * - ?�직 active ?� ?�으�??�음 ?�운???�성
 */
export async function advanceSwissStage(
  tournamentId: string,
  seasonId: number,
): Promise<{ isSwissComplete: boolean; advancedTeams?: string[] }> {
  const records = await getSwissRecords(tournamentId);

  // 3???�달 ?� ??advanced
  for (const r of records) {
    if (r.status === 'active' && r.wins >= 3) {
      await updateSwissStatus(tournamentId, r.teamId, 'advanced');
    }
    if (r.status === 'active' && r.losses >= 3) {
      await updateSwissStatus(tournamentId, r.teamId, 'eliminated');
    }
  }

  // 갱신???�코??
  const updatedRecords = await getSwissRecords(tournamentId);
  const activeCount = updatedRecords.filter(r => r.status === 'active').length;
  const advancedTeams = updatedRecords.filter(r => r.status === 'advanced').map(r => r.teamId);

  if (activeCount === 0) {
    // 모든 active ?�??결정?????�위???�료, ?�아???� 배정
    await assignWorldsKnockout(tournamentId, advancedTeams.slice(0, 8));
    return { isSwissComplete: true, advancedTeams: advancedTeams.slice(0, 8) };
  }

  // 8?� ?�상 진출?�더?�도 ?�직 active ?�???�아?�으�??�음 ?�운??계속 진행
  const currentRound = Math.max(...updatedRecords.map(r => r.round)) + 1;
  const tournament = await getTournament(tournamentId);
  if (tournament) {
    await generateSwissRound(tournamentId, seasonId, currentRound, tournament.startDate);
  }

  return { isSwissComplete: false };
}

/**
 * Worlds ?�아???� 배정
 * ?�위??진출 ?�서?��??�드 배정 (1vs8, 2vs7, 3vs6, 4vs5)
 */
async function assignWorldsKnockout(
  tournamentId: string,
  advancedTeams: string[],
): Promise<void> {
  const db = await getDatabase();

  // ?�드 기반 8�?매칭
  const qfPairs: [number, number][] = [[0, 7], [1, 6], [2, 5], [3, 4]];

  for (let i = 0; i < qfPairs.length; i++) {
    const [h, a] = qfPairs[i];
    const home = advancedTeams[h] ?? 'TBD';
    const away = advancedTeams[a] ?? 'TBD';
    await db.execute(
      'UPDATE matches SET team_home_id = $1, team_away_id = $2 WHERE id = $3',
      [home, away, `${tournamentId}_qf${i + 1}`],
    );
  }

  await updateTournamentStatus(tournamentId, 'knockout');
}

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// Worlds 출전 ?� 결정
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�

/**
 * �?리전�?Worlds 출전 ?� 결정
 * LEAGUE_CONSTANTS.worldsSlots 기�??�로 리그 ?�위 ?�위 ?� ?�발
 */
export async function getWorldsQualifiedTeams(
  year: number,
): Promise<Record<Region, string[]>> {
  const db = await getDatabase();

  const result: Record<Region, string[]> = {
    LCK: [], LPL: [], LEC: [], LCS: [],
  };

  const regions: Region[] = ['LCK', 'LPL', 'LEC', 'LCS'];

  for (const region of regions) {
    const slots = LEAGUE_CONSTANTS[region].worldsSlots;

    const rows = await db.select<{ team_id: string }[]>(
      `SELECT t.id as team_id FROM teams t WHERE t.region = $1 ORDER BY t.reputation DESC LIMIT $2`,
      [region, slots],
    );

    const seasonRows = await db.select<{ id: number }[]>(
      `SELECT id FROM seasons WHERE year = $1 AND split = 'summer' LIMIT 1`,
      [year],
    );

    if (seasonRows.length > 0) {
      const seasonId = seasonRows[0].id;
      const standingRows = await db.select<{ team_id: string }[]>(
        `SELECT
           CASE WHEN m.score_home > m.score_away THEN m.team_home_id ELSE m.team_away_id END as team_id
         FROM matches m
         JOIN teams t ON t.id = CASE WHEN m.score_home > m.score_away THEN m.team_home_id ELSE m.team_away_id END
         WHERE m.season_id = $1 AND m.is_played = TRUE AND m.match_type = 'regular'
           AND t.region = $2
         GROUP BY team_id
         ORDER BY COUNT(*) DESC
         LIMIT $3`,
        [seasonId, region, slots],
      );

      if (standingRows.length >= slots) {
        result[region] = standingRows.map((r) => r.team_id);
        continue;
      }
    }

    result[region] = rows.map((r) => r.team_id);
  }

  return result;
}

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// ?�아???�테?��? ?� 배정 (MSI)
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�

/** MSI 그룹 결과???�라 ?��??�이???� 배정 */
export async function assignMSISemiFinals(tournamentId: string): Promise<void> {
  const standings = await getTournamentStandings(tournamentId);
  if (standings.length < 4) return;

  const db = await getDatabase();

  const lastGroupMatch = await db.select<{ match_date: string }[]>(
    `SELECT match_date FROM matches
     WHERE id LIKE $1 AND match_type = 'msi_group' AND is_played = TRUE
     ORDER BY match_date DESC LIMIT 1`,
    [`${tournamentId}%`],
  );
  const lastGroupDate = lastGroupMatch[0]?.match_date;

  if (lastGroupDate) {
    const sf1Date = addDays(lastGroupDate, 1);
    const sf2Date = addDays(lastGroupDate, 2);
    const finalDate = addDays(lastGroupDate, 4);

    await db.execute(
      'UPDATE matches SET team_home_id = $1, team_away_id = $2, match_date = $3 WHERE id = $4',
      [standings[0].teamId, standings[3].teamId, sf1Date, `${tournamentId}_sf1`],
    );
    await db.execute(
      'UPDATE matches SET team_home_id = $1, team_away_id = $2, match_date = $3 WHERE id = $4',
      [standings[1].teamId, standings[2].teamId, sf2Date, `${tournamentId}_sf2`],
    );
    await db.execute(
      'UPDATE matches SET match_date = $1 WHERE id = $2',
      [finalDate, `${tournamentId}_final`],
    );
  } else {
    await db.execute(
      'UPDATE matches SET team_home_id = $1, team_away_id = $2 WHERE id = $3',
      [standings[0].teamId, standings[3].teamId, `${tournamentId}_sf1`],
    );
    await db.execute(
      'UPDATE matches SET team_home_id = $1, team_away_id = $2 WHERE id = $3',
      [standings[1].teamId, standings[2].teamId, `${tournamentId}_sf2`],
    );
  }

  await updateTournamentStatus(tournamentId, 'knockout');
}

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// ?�너먼트 경기 결과 처리 (?�합)
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�

/**
 * ?�너먼트 경기 결과 처리
 * - ?�?�별 분기: MSI, Worlds, LCK Cup, FST, EWC
 * - 그룹/?�위???�료 감�? ???�아???� 배정
 * - ?�아???�운???�자 ???�음 ?�운???� ?�데?�트
 */
export async function processTournamentMatchResult(
  seasonId: number,
  matchId: string,
  winnerTeamId: string,
): Promise<void> {
  const isMSI = matchId.startsWith('msi_');
  const isWorlds = matchId.startsWith('worlds_');
  const isLCKCup = matchId.startsWith('lck_cup_');
  const isFST = matchId.startsWith('fst_');
  const isEWC = matchId.startsWith('ewc_');

  if (!isMSI && !isWorlds && !isLCKCup && !isFST && !isEWC) return;

  // ?�너먼트 ID 추출
  const tournamentId = matchId.match(/^([a-z_]+_\d+)/)?.[1] ?? '';
  if (!tournamentId) return;

  const db = await getDatabase();

  if (isMSI) {
    await processMSIResult(tournamentId, matchId, seasonId, db);
  } else if (isWorlds) {
    await processWorldsResult(tournamentId, matchId, winnerTeamId, seasonId, db);
  } else if (isLCKCup) {
    await processLCKCupResult(tournamentId, matchId, db);
  } else if (isFST) {
    await processSingleElimResult(tournamentId, matchId, 'fst', db);
  } else if (isEWC) {
    await processSingleElimResult(tournamentId, matchId, 'ewc', db);
  }
}

/** MSI 결과 처리 */
async function processMSIResult(
  tournamentId: string, matchId: string, seasonId: number, db: Awaited<ReturnType<typeof getDatabase>>,
): Promise<void> {
  if (matchId.includes('_g')) {
    const unplayed = await db.select<{ cnt: number }[]>(
      `SELECT COUNT(*) as cnt FROM matches
       WHERE season_id = $1 AND match_type = 'msi_group' AND id LIKE $2 AND is_played = FALSE`,
      [seasonId, `${tournamentId}%`],
    );
    if (unplayed[0]?.cnt === 0) {
      await assignMSISemiFinals(tournamentId);
    }
  } else if (matchId.includes('_sf')) {
    await processKnockoutAdvance(tournamentId, 'sf', 'final', db);
  } else if (matchId.includes('_final')) {
    await updateTournamentStatus(tournamentId, 'completed');
  }
}

/** Worlds 결과 처리 */
async function processWorldsResult(
  tournamentId: string, matchId: string, winnerTeamId: string,
  seasonId: number, db: Awaited<ReturnType<typeof getDatabase>>,
): Promise<void> {
  if (matchId.includes('_swiss_')) {
    // ?�위??매치 결과 ???�코???�데?�트
    const match = await getMatchById(matchId);
    if (!match) return;

    const loserTeamId = winnerTeamId === match.teamHomeId ? match.teamAwayId : match.teamHomeId;
    const roundMatch = matchId.match(/_swiss_r(\d+)_/);
    const round = roundMatch ? parseInt(roundMatch[1]) : 1;

    await updateSwissRecord(tournamentId, winnerTeamId, true, round);
    await updateSwissRecord(tournamentId, loserTeamId, false, round);

    // ?�운????모든 경기 ?�료 ?�인
    const unplayed = await db.select<{ cnt: number }[]>(
      `SELECT COUNT(*) as cnt FROM matches
       WHERE id LIKE $1 AND match_type = 'worlds_swiss' AND is_played = FALSE`,
      [`${tournamentId}_swiss_r${round}_%`],
    );

    if (unplayed[0]?.cnt === 0) {
      await advanceSwissStage(tournamentId, seasonId);
    }
  } else if (matchId.includes('_qf')) {
    await processKnockout4to2(tournamentId, db);
  } else if (matchId.includes('_sf')) {
    await processKnockoutAdvance(tournamentId, 'sf', 'final', db);
  } else if (matchId.includes('_final')) {
    await updateTournamentStatus(tournamentId, 'completed');
  }
}

/** LCK Cup 결과 처리 */
async function processLCKCupResult(
  tournamentId: string, matchId: string, db: Awaited<ReturnType<typeof getDatabase>>,
): Promise<void> {
  // ?�규?�즌 매치 ?�료 ???�레?�오???�동 ?�성
  if (matchId.includes('_A_')) {
    const tournament = await getTournament(tournamentId);
    if (!tournament) return;

    const unplayed = await db.select<{ cnt: number }[]>(
      `SELECT COUNT(*) as cnt FROM matches
       WHERE match_type = 'lck_cup_regular' AND id LIKE $1 AND is_played = FALSE`,
      [`${tournamentId}%`],
    );
    if (unplayed[0]?.cnt === 0) {
      const standings = await getTournamentStandings(tournamentId);
      if (standings.length >= 6) {
        await generateLCKCupPlayoff(tournamentId, tournament.seasonId, standings);
      }
    }
    return;
  }

  if (matchId.includes('_q')) {
    // 8�?결과 ??준결승 ?� 배정
    const q1 = await getMatchById(`${tournamentId}_q1`);
    const q2 = await getMatchById(`${tournamentId}_q2`);

    if (q1?.isPlayed && matchId === `${tournamentId}_q1`) {
      const winner = q1.scoreHome > q1.scoreAway ? q1.teamHomeId : q1.teamAwayId;
      await db.execute(
        'UPDATE matches SET team_away_id = $1 WHERE id = $2',
        [winner, `${tournamentId}_sf1`],
      );
    }
    if (q2?.isPlayed && matchId === `${tournamentId}_q2`) {
      const winner = q2.scoreHome > q2.scoreAway ? q2.teamHomeId : q2.teamAwayId;
      await db.execute(
        'UPDATE matches SET team_away_id = $1 WHERE id = $2',
        [winner, `${tournamentId}_sf2`],
      );
    }
  } else if (matchId.includes('_sf')) {
    await processKnockoutAdvance(tournamentId, 'sf', 'final', db);
  } else if (matchId.includes('_final')) {
    await updateTournamentStatus(tournamentId, 'completed');
  }
}

/** ?��? ?�리미네?�션 결과 처리 (FST / EWC 공통) */
async function processSingleElimResult(
  tournamentId: string, matchId: string, _prefix: string,
  db: Awaited<ReturnType<typeof getDatabase>>,
): Promise<void> {
  if (matchId.includes('_qf')) {
    // 8�???4�??�자 배정
    const qf1 = await getMatchById(`${tournamentId}_qf1`);
    const qf2 = await getMatchById(`${tournamentId}_qf2`);
    const qf3 = await getMatchById(`${tournamentId}_qf3`);
    const qf4 = await getMatchById(`${tournamentId}_qf4`);

    // SF1: QF1 ?�자 vs QF2 ?�자
    if (qf1?.isPlayed && qf2?.isPlayed) {
      const w1 = qf1.scoreHome > qf1.scoreAway ? qf1.teamHomeId : qf1.teamAwayId;
      const w2 = qf2.scoreHome > qf2.scoreAway ? qf2.teamHomeId : qf2.teamAwayId;
      await db.execute(
        'UPDATE matches SET team_home_id = $1, team_away_id = $2 WHERE id = $3',
        [w1, w2, `${tournamentId}_sf1`],
      );
    }

    // SF2: QF3 ?�자 vs QF4 ?�자
    if (qf3?.isPlayed && qf4?.isPlayed) {
      const w3 = qf3.scoreHome > qf3.scoreAway ? qf3.teamHomeId : qf3.teamAwayId;
      const w4 = qf4.scoreHome > qf4.scoreAway ? qf4.teamHomeId : qf4.teamAwayId;
      await db.execute(
        'UPDATE matches SET team_home_id = $1, team_away_id = $2 WHERE id = $3',
        [w3, w4, `${tournamentId}_sf2`],
      );
    }
  } else if (matchId.includes('_sf')) {
    await processKnockoutAdvance(tournamentId, 'sf', 'final', db);
  } else if (matchId.includes('_final')) {
    await updateTournamentStatus(tournamentId, 'completed');
  }
}

/** ?�아??4�???결승 공통 로직 */
async function processKnockoutAdvance(
  tournamentId: string, round: string, nextRound: string,
  db: Awaited<ReturnType<typeof getDatabase>>,
): Promise<void> {
  const m1 = await getMatchById(`${tournamentId}_${round}1`);
  const m2 = await getMatchById(`${tournamentId}_${round}2`);

  if (m1?.isPlayed && m2?.isPlayed) {
    const w1 = m1.scoreHome > m1.scoreAway ? m1.teamHomeId : m1.teamAwayId;
    const w2 = m2.scoreHome > m2.scoreAway ? m2.teamHomeId : m2.teamAwayId;

    const lastDate = m1.matchDate && m2.matchDate
      ? (m1.matchDate > m2.matchDate ? m1.matchDate : m2.matchDate)
      : m1.matchDate ?? m2.matchDate;
    const nextDate = lastDate ? addDays(lastDate, 2) : undefined;

    if (nextDate) {
      await db.execute(
        'UPDATE matches SET team_home_id = $1, team_away_id = $2, match_date = $3 WHERE id = $4',
        [w1, w2, nextDate, `${tournamentId}_${nextRound}`],
      );
    } else {
      await db.execute(
        'UPDATE matches SET team_home_id = $1, team_away_id = $2 WHERE id = $3',
        [w1, w2, `${tournamentId}_${nextRound}`],
      );
    }
  }
}

/** Worlds 8�???4�?(4경기 ??2경기) */
async function processKnockout4to2(
  tournamentId: string,
  db: Awaited<ReturnType<typeof getDatabase>>,
): Promise<void> {
  const qf1 = await getMatchById(`${tournamentId}_qf1`);
  const qf2 = await getMatchById(`${tournamentId}_qf2`);
  const qf3 = await getMatchById(`${tournamentId}_qf3`);
  const qf4 = await getMatchById(`${tournamentId}_qf4`);

  // SF1: QF1 ?�자 vs QF2 ?�자
  if (qf1?.isPlayed && qf2?.isPlayed) {
    const w1 = qf1.scoreHome > qf1.scoreAway ? qf1.teamHomeId : qf1.teamAwayId;
    const w2 = qf2.scoreHome > qf2.scoreAway ? qf2.teamHomeId : qf2.teamAwayId;
    await db.execute(
      'UPDATE matches SET team_home_id = $1, team_away_id = $2 WHERE id = $3',
      [w1, w2, `${tournamentId}_sf1`],
    );
  }

  // SF2: QF3 ?�자 vs QF4 ?�자
  if (qf3?.isPlayed && qf4?.isPlayed) {
    const w3 = qf3.scoreHome > qf3.scoreAway ? qf3.teamHomeId : qf3.teamAwayId;
    const w4 = qf4.scoreHome > qf4.scoreAway ? qf4.teamHomeId : qf4.teamAwayId;
    await db.execute(
      'UPDATE matches SET team_home_id = $1, team_away_id = $2 WHERE id = $3',
      [w3, w4, `${tournamentId}_sf2`],
    );
  }
}
