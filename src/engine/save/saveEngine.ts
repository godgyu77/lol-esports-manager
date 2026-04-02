import type { GameSave, SaveSlot } from '../../types/game';
import {
  AUTOSAVE_DATABASE_FILE,
  checkpointActiveGameDatabase,
  closeDatabase,
  copyGameDatabase,
  deleteGameDatabase,
  gameDatabaseExists,
  getActiveGameDatabaseName,
  getDatabase,
  getGameDatabaseFileName,
  setActiveGameDatabase,
} from '../../db/database';
import {
  createManualSave,
  getAllSaves,
  getAutoSave as getAutoSaveQuery,
  getSaveById,
  deleteSave as deleteSaveQuery,
  updatePlayTime as updatePlayTimeQuery,
  updateSaveMeta,
} from '../../db/queries';
import { useGameStore } from '../../stores/gameStore';
import { getBaseSeed } from '../../utils/random';

const MAX_SLOTS = 10;

async function snapshotCurrentDatabaseToFile(targetFileName: string): Promise<void> {
  const currentFileName = getActiveGameDatabaseName();
  await checkpointActiveGameDatabase();
  if (currentFileName === targetFileName) {
    return;
  }
  await closeDatabase();
  await copyGameDatabase(currentFileName, targetFileName);
  await setActiveGameDatabase(currentFileName);
}

async function validateDatabaseContents(save: GameSave): Promise<string[]> {
  const errors: string[] = [];
  const previousFileName = getActiveGameDatabaseName();

  try {
    if (!(await gameDatabaseExists(save.dbFilename))) {
      errors.push(`세이브 파일 ${save.dbFilename} 이 존재하지 않습니다.`);
      return errors;
    }

    await setActiveGameDatabase(save.dbFilename);
    const db = await getDatabase();

    const teamRows = await db.select<{ id: string }[]>('SELECT id FROM teams WHERE id = $1', [save.userTeamId]);
    if (teamRows.length === 0) errors.push(`팀 ${save.userTeamId} 이 DB에 없습니다.`);

    const seasonRows = await db.select<{ id: number }[]>('SELECT id FROM seasons WHERE id = $1', [save.currentSeasonId]);
    if (seasonRows.length === 0) errors.push(`시즌 ${save.currentSeasonId} 이 DB에 없습니다.`);

    if (save.userPlayerId) {
      const playerRows = await db.select<{ id: string }[]>('SELECT id FROM players WHERE id = $1', [save.userPlayerId]);
      if (playerRows.length === 0) errors.push(`유저 선수 ${save.userPlayerId} 이 DB에 없습니다.`);
    }

    const rosterRows = await db.select<{ cnt: number }[]>(
      'SELECT COUNT(*) as cnt FROM players WHERE team_id = $1',
      [save.userTeamId],
    );
    if ((rosterRows[0]?.cnt ?? 0) === 0) errors.push('해당 팀 로스터가 비어 있습니다.');

    try {
      await db.select<Record<string, unknown>[]>('SELECT 1 FROM player_chemistry LIMIT 1');
    } catch {
      errors.push('player_chemistry 테이블이 없습니다.');
    }
    try {
      await db.select<Record<string, unknown>[]>('SELECT 1 FROM player_satisfaction LIMIT 1');
    } catch {
      errors.push('player_satisfaction 테이블이 없습니다.');
    }
    try {
      await db.select<Record<string, unknown>[]>('SELECT 1 FROM player_solo_rank LIMIT 1');
    } catch {
      errors.push('player_solo_rank 테이블이 없습니다.');
    }
  } catch (error) {
    errors.push(`DB 검증 중 오류가 발생했습니다: ${String(error)}`);
  } finally {
    await setActiveGameDatabase(previousFileName);
  }

  return errors;
}

export async function createManualSaveFromCurrent(
  slotNumber: number,
  saveName: string,
): Promise<number> {
  const state = useGameStore.getState();
  const save = state.save;
  const season = state.season;
  const team = state.teams.find((candidate) => candidate.id === save?.userTeamId);

  if (!save || !season) {
    throw new Error('저장할 게임 상태가 없습니다.');
  }

  const targetFileName = getGameDatabaseFileName(slotNumber);
  const currentFileName = getActiveGameDatabaseName();
  const seasonInfo = `${season.year} ${season.split === 'spring' ? 'Spring' : 'Summer'} W${season.currentWeek}`;
  const teamName = team?.name ?? null;

  if (targetFileName !== currentFileName) {
    await snapshotCurrentDatabaseToFile(targetFileName);
  }

  if (save.slotNumber === slotNumber) {
    await updateSaveMeta(save.metadataId, {
      saveName,
      teamName,
      seasonInfo,
      playTimeMinutes: save.playTimeMinutes,
      dbFilename: targetFileName,
    });
    useGameStore.getState().setSave({
      ...save,
      saveName,
      teamName: teamName ?? undefined,
      seasonInfo: seasonInfo ?? undefined,
      dbFilename: targetFileName,
    });
    return save.metadataId;
  }

  const metadataId = await createManualSave({
    mode: save.mode,
    teamId: save.userTeamId,
    playerId: save.userPlayerId ?? null,
    seasonId: save.currentSeasonId,
    gameSaveId: save.id,
    slotNumber,
    saveName,
    teamName,
    seasonInfo,
    rngSeed: getBaseSeed() || save.rngSeed || null,
    dbFilename: targetFileName,
    playTimeMinutes: save.playTimeMinutes,
  });
  if (save.slotNumber === 0 && slotNumber === 0) {
    useGameStore.getState().setSave({
      ...save,
      metadataId,
      saveName: '자동 저장',
      teamName: teamName ?? undefined,
      seasonInfo: seasonInfo ?? undefined,
      dbFilename: targetFileName,
    });
  }
  return metadataId;
}

export async function createAutoSaveFromCurrent(): Promise<number> {
  const state = useGameStore.getState();
  const save = state.save;
  const season = state.season;
  const team = state.teams.find((candidate) => candidate.id === save?.userTeamId);

  if (!save || !season) {
    throw new Error('자동 저장할 게임 상태가 없습니다.');
  }

  await snapshotCurrentDatabaseToFile(AUTOSAVE_DATABASE_FILE);

  const metadataId = await createManualSave({
    mode: save.mode,
    teamId: save.userTeamId,
    playerId: save.userPlayerId ?? null,
    seasonId: save.currentSeasonId,
    gameSaveId: save.id,
    slotNumber: 0,
    saveName: '자동 저장',
    teamName: team?.name ?? null,
    seasonInfo: `${season.year} ${season.split === 'spring' ? 'Spring' : 'Summer'} W${season.currentWeek}`,
    rngSeed: getBaseSeed() || save.rngSeed || null,
    dbFilename: AUTOSAVE_DATABASE_FILE,
    playTimeMinutes: save.playTimeMinutes,
  });
  if (save.slotNumber === 0) {
    useGameStore.getState().setSave({
      ...save,
      metadataId,
      saveName: '자동 저장',
      teamName: team?.name,
      seasonInfo: `${season.year} ${season.split === 'spring' ? 'Spring' : 'Summer'} W${season.currentWeek}`,
      dbFilename: AUTOSAVE_DATABASE_FILE,
    });
  }
  return metadataId;
}

export async function validateSaveIntegrity(save: GameSave): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  if (!save.mode) errors.push('게임 모드 정보가 없습니다.');
  if (!save.userTeamId) errors.push('유저 팀 ID가 없습니다.');
  if (!save.currentSeasonId || save.currentSeasonId <= 0) errors.push('현재 시즌 ID가 유효하지 않습니다.');
  if (!save.dbFilename) errors.push('세이브 DB 파일명이 없습니다.');
  if (save.mode === 'player' && !save.userPlayerId) errors.push('선수 모드인데 유저 선수 ID가 없습니다.');

  errors.push(...await validateDatabaseContents(save));

  return { valid: errors.length === 0, errors };
}

export async function loadSave(metadataId: number): Promise<GameSave> {
  const save = await getSaveById(metadataId);
  if (!save) {
    throw new Error('불러올 세이브를 찾을 수 없습니다.');
  }

  const validation = await validateSaveIntegrity(save);
  if (!validation.valid) {
    throw new Error(`저장 데이터가 손상되었거나 불완전합니다: ${validation.errors.join(', ')}`);
  }

  return save;
}

export async function deleteSave(metadataId: number): Promise<void> {
  const save = await getSaveById(metadataId);
  if (!save) return;
  const currentSave = useGameStore.getState().save;

  if (currentSave?.metadataId === metadataId) {
    throw new Error('현재 플레이 중인 세이브는 삭제할 수 없습니다.');
  }

  if (getActiveGameDatabaseName() === save.dbFilename) {
    await closeDatabase();
  }

  await deleteSaveQuery(metadataId);
  await deleteGameDatabase(save.dbFilename);
}

export async function getSaveSlots(): Promise<SaveSlot[]> {
  const saves = await getAllSaves();
  const slots: SaveSlot[] = [];

  const autoSave = saves.find((save) => save.slotNumber === 0);
  slots.push({ slotNumber: 0, save: autoSave ?? null });

  for (let i = 1; i <= MAX_SLOTS; i += 1) {
    const save = saves.find((candidate) => candidate.slotNumber === i);
    slots.push({ slotNumber: i, save: save ?? null });
  }

  return slots;
}

export async function getAutoSave(): Promise<GameSave | null> {
  return getAutoSaveQuery();
}

export async function updatePlayTime(metadataId: number, minutes: number): Promise<void> {
  await updatePlayTimeQuery(metadataId, minutes);
}

export async function updateSaveInfo(
  metadataId: number,
  updates: { saveName?: string; teamName?: string; seasonInfo?: string; playTimeMinutes?: number },
): Promise<void> {
  await updateSaveMeta(metadataId, updates);
}
