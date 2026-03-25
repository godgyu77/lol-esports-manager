/**
 * 저장/불러오기 엔진
 * - 수동 저장, 불러오기, 삭제, 슬롯 조회
 */
import type { GameSave, SaveSlot } from '../../types/game';
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

/** 현재 게임 상태에서 수동 저장 생성 */
export async function createManualSaveFromCurrent(
  slotNumber: number,
  saveName: string,
): Promise<number> {
  const state = useGameStore.getState();
  const save = state.save;
  const season = state.season;
  const team = state.teams.find((t) => t.id === save?.userTeamId);

  if (!save || !season) {
    throw new Error('저장할 게임 상태가 없습니다.');
  }

  const seasonInfo = `${season.year} ${season.split === 'spring' ? '스프링' : '서머'} W${season.currentWeek}`;
  const teamName = team?.name ?? null;

  const newSaveId = await createManualSave(
    save.mode,
    save.userTeamId,
    save.userPlayerId ?? null,
    save.currentSeasonId,
    slotNumber,
    saveName,
    teamName,
    seasonInfo,
    getBaseSeed() || null,
  );

  return newSaveId;
}

/** 세이브 무결성 검증 */
export async function validateSaveIntegrity(save: GameSave): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  if (!save.mode) errors.push('게임 모드 정보 없음');
  if (!save.userTeamId) errors.push('유저 팀 ID 없음');
  if (!save.currentSeasonId || save.currentSeasonId <= 0) errors.push('시즌 ID 유효하지 않음');
  if (save.mode === 'player' && !save.userPlayerId) errors.push('선수 모드인데 선수 ID 없음');

  // DB 참조 무결성 체크
  try {
    const { getDatabase } = await import('../../db/database');
    const db = await getDatabase();

    // 팀 존재 확인
    const teamRows = await db.select<{ id: string }[]>('SELECT id FROM teams WHERE id = $1', [save.userTeamId]);
    if (teamRows.length === 0) errors.push(`팀 ${save.userTeamId}이 DB에 존재하지 않음`);

    // 시즌 존재 확인
    const seasonRows = await db.select<{ id: number }[]>('SELECT id FROM seasons WHERE id = $1', [save.currentSeasonId]);
    if (seasonRows.length === 0) errors.push(`시즌 ${save.currentSeasonId}이 DB에 존재하지 않음`);

    // 선수 모드일 때 선수 존재 확인
    if (save.userPlayerId) {
      const playerRows = await db.select<{ id: string }[]>('SELECT id FROM players WHERE id = $1', [save.userPlayerId]);
      if (playerRows.length === 0) errors.push(`선수 ${save.userPlayerId}가 DB에 존재하지 않음`);
    }

    // 팀 선수 존재 확인
    const rosterRows = await db.select<{ cnt: number }[]>(
      'SELECT COUNT(*) as cnt FROM players WHERE team_id = $1',
      [save.userTeamId],
    );
    if ((rosterRows[0]?.cnt ?? 0) === 0) errors.push('팀에 선수가 없음');

    // 신규 시스템 테이블 존재 확인 (데이터 유효성)
    try {
      await db.select<Record<string, unknown>[]>('SELECT 1 FROM player_chemistry LIMIT 1');
    } catch {
      errors.push('player_chemistry 테이블 없음 (마이그레이션 필요)');
    }
    try {
      await db.select<Record<string, unknown>[]>('SELECT 1 FROM player_satisfaction LIMIT 1');
    } catch {
      errors.push('player_satisfaction 테이블 없음 (마이그레이션 필요)');
    }
    try {
      await db.select<Record<string, unknown>[]>('SELECT 1 FROM player_solo_rank LIMIT 1');
    } catch {
      errors.push('player_solo_rank 테이블 없음 (마이그레이션 필요)');
    }
  } catch (e) {
    errors.push(`DB 검증 실패: ${e}`);
  }

  return { valid: errors.length === 0, errors };
}

/** 저장본 불러오기 — 무결성 검증 후 GameSave 반환 */
export async function loadSave(saveId: number): Promise<GameSave> {
  const save = await getSaveById(saveId);
  if (!save) {
    throw new Error('저장본을 찾을 수 없습니다.');
  }

  // 무결성 검증
  const validation = await validateSaveIntegrity(save);
  if (!validation.valid) {
    console.warn('[saveEngine] 세이브 무결성 문제 감지:', validation.errors);
    // 경고만 하고 진행 (사용자에게 알릴 수 있도록)
  }

  return save;
}

/** 저장 삭제 */
export async function deleteSave(saveId: number): Promise<void> {
  await deleteSaveQuery(saveId);
}

/** 모든 저장 슬롯 조회 (빈 슬롯 포함, 최대 10개) */
export async function getSaveSlots(): Promise<SaveSlot[]> {
  const saves = await getAllSaves();

  const slots: SaveSlot[] = [];

  // 자동 저장 슬롯 (슬롯 0)
  const autoSave = saves.find((s) => s.slotNumber === 0);
  slots.push({ slotNumber: 0, save: autoSave ?? null });

  // 수동 저장 슬롯 (1~10)
  for (let i = 1; i <= MAX_SLOTS; i++) {
    const save = saves.find((s) => s.slotNumber === i);
    slots.push({ slotNumber: i, save: save ?? null });
  }

  return slots;
}

/** 자동 저장 조회 */
export async function getAutoSave(): Promise<GameSave | null> {
  return getAutoSaveQuery();
}

/** 플레이 시간 업데이트 */
export async function updatePlayTime(saveId: number, minutes: number): Promise<void> {
  await updatePlayTimeQuery(saveId, minutes);
}

/** 저장 메타 정보 업데이트 */
export async function updateSaveInfo(
  saveId: number,
  updates: { saveName?: string; teamName?: string; seasonInfo?: string; playTimeMinutes?: number },
): Promise<void> {
  await updateSaveMeta(saveId, updates);
}
