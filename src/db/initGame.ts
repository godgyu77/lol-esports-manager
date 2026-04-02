import type { GameMode, GameSave, Position, Region } from '../types';
import type { PlayerBackground } from '../types/player';
import type { PendingManager } from '../stores/gameStore';
import { generateLeagueSchedule } from '../engine/season/scheduleGenerator';
import { assignMatchDates, SEASON_DATES } from '../engine/season/calendar';
import {
  deleteGameDatabase,
  gameDatabaseExists,
  getDatabase,
  getGameDatabaseFileName,
  prepareForDatabaseFileMutation,
  setActiveGameDatabase,
  withTransaction,
} from './database';
import {
  createSave,
  createSeason,
  getActiveSeason,
  getAllPlayersGroupedByTeam,
  getAllTeams,
  getSaveById,
  getTeamsByRegion,
  insertMatch,
  insertPlayer,
  updateRngSeed,
} from './queries';
import { seedAllData } from './seed';
import { useGameStore } from '../stores/gameStore';
import { generateLCKCup } from '../engine/tournament/tournamentEngine';
import { initializeTeamChemistry } from '../engine/chemistry/chemistryEngine';
import { generatePlayerGoals } from '../engine/playerGoal/playerGoalEngine';
import { initializeKnowledgeBase } from '../ai/rag/ragEngine';
import { initGlobalRng } from '../utils/random';
import { releaseUserTeamHeadCoach, seedAllTeamsStaff } from '../engine/staff/staffEngine';
import { ensureInitialCoachBriefingNews } from '../engine/manager/managerSetupEngine';

const BACKGROUND_STATS: Record<
  PlayerBackground,
  {
    mechanical: number;
    gameSense: number;
    teamwork: number;
    consistency: number;
    laning: number;
    aggression: number;
  }
> = {
  solorank: {
    mechanical: 75,
    gameSense: 55,
    teamwork: 45,
    consistency: 55,
    laning: 72,
    aggression: 68,
  },
  trainee: {
    mechanical: 60,
    gameSense: 62,
    teamwork: 68,
    consistency: 65,
    laning: 58,
    aggression: 52,
  },
  prodigy: {
    mechanical: 70,
    gameSense: 68,
    teamwork: 50,
    consistency: 48,
    laning: 65,
    aggression: 62,
  },
};

export interface PendingPlayer {
  name: string;
  age: number;
  nationality: string;
  position: Position;
  background: PlayerBackground;
  traits: string[];
}

function formatInitialSaveName(teamName: string, year: number): string {
  return `${teamName} ${year} Spring`;
}

function formatSeasonInfo(year: number, week: number): string {
  return `${year} Spring W${week}`;
}

async function syncLocalSaveMetadata(params: {
  gameSaveId: number;
  mode: GameMode;
  teamId: string;
  playerId: string | null;
  seasonId: number;
  slotNumber: number;
  saveName: string;
  teamName: string;
  seasonInfo: string;
  rngSeed: string;
  dbFilename: string;
}): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM save_metadata');
  await db.execute(
    `INSERT INTO save_metadata (
       id, mode, user_team_id, user_player_id, current_season_id,
       created_at, updated_at, slot_number, save_name, play_time_minutes,
       team_name, season_info, rng_seed, db_filename, game_save_id
     )
     VALUES (
       $1, $2, $3, $4, $5,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $6, $7, 0,
       $8, $9, $10, $11, $12
     )`,
    [
      params.gameSaveId,
      params.mode,
      params.teamId,
      params.playerId,
      params.seasonId,
      params.slotNumber,
      params.saveName,
      params.teamName,
      params.seasonInfo,
      params.rngSeed,
      params.dbFilename,
      params.gameSaveId,
    ],
  );
}

async function resetSlotDatabase(dbFileName: string): Promise<void> {
  await prepareForDatabaseFileMutation();
  if (await gameDatabaseExists(dbFileName)) {
    await deleteGameDatabase(dbFileName);
  }
  await setActiveGameDatabase(dbFileName);
}

export async function initializeNewGame(
  mode: GameMode,
  teamId: string,
  slotNumber: number,
  pendingPlayer?: PendingPlayer | null,
  pendingManager?: PendingManager | null,
): Promise<GameSave> {
  const dbFileName = getGameDatabaseFileName(slotNumber);

  await resetSlotDatabase(dbFileName);

  let db = await getDatabase();

  try {
    const integrity = await db.select<{ integrity_check: string }[]>('PRAGMA integrity_check');
    if (integrity[0]?.integrity_check !== 'ok') {
      console.warn('[initGame] integrity check failed, resetting slot DB.');
      await resetSlotDatabase(dbFileName);
      db = await getDatabase();
    }
  } catch {
    // Fresh DBs may not have all pages yet; keep going.
  }

  await db.execute('PRAGMA foreign_keys = OFF');

  try {
    const tableRows = await db.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_sqlx_%'",
    );
    for (const row of tableRows) {
      await db.execute(`DELETE FROM "${row.name}"`).catch(() => {});
    }
  } catch {
    // Ignore on first initialization.
  }

  const rngSeed = crypto.randomUUID();
  initGlobalRng(rngSeed);

  await seedAllData();
  await seedAllTeamsStaff(2026, mode === 'manager' ? teamId : undefined);
  if (mode === 'manager') {
    await releaseUserTeamHeadCoach(teamId);
  }

  try {
    await initializeKnowledgeBase();
  } catch (error) {
    console.warn('[initGame] knowledge base initialization skipped:', error);
  }

  const result = await withTransaction(async () => {
    const seasonId = await createSeason(2026, 'spring');

    const regions: Region[] = ['LCK', 'LPL', 'LEC', 'LCS'];
    const startDate = SEASON_DATES.spring.start;

    for (const region of regions) {
      const teams = await getTeamsByRegion(region);
      const teamIds = teams.map((team) => team.id);
      const schedule = generateLeagueSchedule(region, teamIds);
      const datedSchedule = assignMatchDates(schedule, startDate);

      for (let i = 0; i < datedSchedule.length; i += 1) {
        const match = datedSchedule[i];
        const matchId = `${region.toLowerCase()}_s${seasonId}_w${match.week}_${i}`;
        await insertMatch({
          id: matchId,
          seasonId,
          week: match.week,
          teamHomeId: match.homeTeamId,
          teamAwayId: match.awayTeamId,
          matchDate: match.date,
        });
      }
    }

    let userPlayerId: string | null = null;
    if (mode === 'player' && pendingPlayer) {
      userPlayerId = `${teamId}_${pendingPlayer.name}`;
      const bgStats = BACKGROUND_STATS[pendingPlayer.background];

      await insertPlayer({
        id: userPlayerId,
        name: pendingPlayer.name,
        teamId,
        position: pendingPlayer.position,
        age: pendingPlayer.age,
        nationality: pendingPlayer.nationality,
        ...bgStats,
        mental: 65,
        stamina: 75,
        morale: 80,
        salary: 5000,
        contractEndSeason: 2028,
        potential: 85,
        peakAge: 22,
        popularity: 5,
        division: 'main',
        isUserPlayer: true,
      });

      if (pendingPlayer.traits.length > 0) {
        const conn = await getDatabase();
        for (const traitId of pendingPlayer.traits) {
          await conn.execute(
            'INSERT INTO player_traits (player_id, trait_id) VALUES ($1, $2)',
            [userPlayerId, traitId],
          );
        }
      }
    }

    const lckTeams = await getTeamsByRegion('LCK');
    await generateLCKCup(seasonId, 2026, lckTeams.map((team) => team.id));

    try {
      const allTeams = await getAllTeams();
      for (const team of allTeams) {
        await initializeTeamChemistry(team.id);
        await generatePlayerGoals(team.id, seasonId);
      }
    } catch (error) {
      console.warn('[initGame] chemistry or player-goal initialization skipped:', error);
    }

    const allTeams = await getAllTeams();
    const userTeam = allTeams.find((team) => team.id === teamId);
    const teamName = userTeam?.name ?? teamId;
    const saveId = await createSave({
      mode,
      teamId,
      playerId: userPlayerId,
      seasonId,
      gameSaveId: 1,
      slotNumber,
      saveName: formatInitialSaveName(teamName, 2026),
      teamName,
      seasonInfo: formatSeasonInfo(2026, 1),
      rngSeed,
      dbFilename: dbFileName,
    });
    const save = await getSaveById(saveId);

    if (!save) {
      throw new Error('Failed to create initial save metadata.');
    }

    await syncLocalSaveMetadata({
      gameSaveId: save.id,
      mode,
      teamId,
      playerId: userPlayerId,
      seasonId,
      slotNumber,
      saveName: save.saveName,
      teamName,
      seasonInfo: save.seasonInfo ?? formatSeasonInfo(2026, 1),
      rngSeed,
      dbFilename: dbFileName,
    });

    if (mode === 'manager' && pendingManager) {
      const conn = await getDatabase();
      await conn.execute(
        `INSERT INTO manager_profiles
          (save_id, name, nationality, age, background,
           tactical_knowledge, motivation, discipline,
           adaptability, scouting_eye, media_handling, reputation,
           player_care, tactical_focus, result_driven, media_friendly)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          save.id,
          pendingManager.name,
          pendingManager.nationality,
          pendingManager.age,
          pendingManager.background,
          pendingManager.stats.tacticalKnowledge,
          pendingManager.stats.motivation,
          pendingManager.stats.discipline,
          pendingManager.stats.adaptability,
          pendingManager.stats.scoutingEye,
          pendingManager.stats.mediaHandling,
          pendingManager.reputation,
          pendingManager.philosophy.playerCare,
          pendingManager.philosophy.tacticalFocus,
          pendingManager.philosophy.resultDriven,
          pendingManager.philosophy.mediaFriendly,
        ],
      );
    }

    return save;
  });

  const dbFinal = await getDatabase();
  await dbFinal.execute('PRAGMA foreign_keys = ON');

  if (result.rngSeed) {
    initGlobalRng(result.rngSeed);
  }

  if (mode === 'manager') {
    await ensureInitialCoachBriefingNews(teamId, result.currentSeasonId, SEASON_DATES.spring.start);
  }

  return result;
}

export async function loadGameIntoStore(saveId: number): Promise<void> {
  const store = useGameStore.getState();

  let save = await getSaveById(saveId);
  if (!save) {
    throw new Error('Save metadata not found.');
  }

  await setActiveGameDatabase(save.dbFilename);

  let rngSeed = save.rngSeed;
  if (!rngSeed) {
    rngSeed = crypto.randomUUID();
    await updateRngSeed(save.metadataId, rngSeed);
    save = { ...save, rngSeed };
  }
  initGlobalRng(rngSeed);

  store.setSave(save);
  store.setMode(save.mode);

  const season = await getActiveSeason();
  if (season) {
    store.setSeason(season);
  }

  const teams = await getAllTeams();
  const playersByTeam = await getAllPlayersGroupedByTeam();
  for (const team of teams) {
    team.roster = playersByTeam.get(team.id) ?? [];
  }
  store.setTeams(teams);
}
