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
  );

  return newSaveId;
}

/** 저장본 불러오기 — GameSave 반환 (호출부에서 gameStore에 set) */
export async function loadSave(saveId: number): Promise<GameSave> {
  const save = await getSaveById(saveId);
  if (!save) {
    throw new Error('저장본을 찾을 수 없습니다.');
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
