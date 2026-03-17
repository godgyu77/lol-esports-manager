/**
 * 게임 초기화 — 새 게임 시작 & store 로딩
 */
import type { GameMode, GameSave, Position } from '../types';
import type { PlayerBackground } from '../types/player';
import { getDatabase } from './database';
import {
  createSave,
  createSeason,
  getActiveSeason,
  getAllTeams,
  getPlayersByTeamId,
  getSaveById,
  insertPlayer,
} from './queries';
import { isSeeded, seedAllData } from './seed';
import { useGameStore } from '../stores/gameStore';

// ─────────────────────────────────────────
// 유저 선수 생성용 배경별 스탯
// ─────────────────────────────────────────

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
    gameSense: 60,
    teamwork: 45,
    consistency: 55,
    laning: 70,
    aggression: 70,
  },
  academy: {
    mechanical: 60,
    gameSense: 65,
    teamwork: 65,
    consistency: 65,
    laning: 60,
    aggression: 55,
  },
  overseas: {
    mechanical: 65,
    gameSense: 70,
    teamwork: 55,
    consistency: 60,
    laning: 65,
    aggression: 60,
  },
};

// ─────────────────────────────────────────
// 게임 초기화
// ─────────────────────────────────────────

export interface PendingPlayer {
  name: string;
  position: Position;
  background: PlayerBackground;
}

/**
 * 새 게임 초기화
 * 1. 기존 데이터 정리
 * 2. 시딩
 * 3. 시즌 생성
 * 4. 유저 선수 생성 (선수 모드)
 * 5. 세이브 생성
 */
export async function initializeNewGame(
  mode: GameMode,
  teamId: string,
  pendingPlayer?: PendingPlayer | null,
): Promise<GameSave> {
  const db = await getDatabase();

  // 1. 기존 데이터 정리 (새 게임이므로 전부 삭제)
  await db.execute('DELETE FROM save_metadata');
  await db.execute('DELETE FROM games');
  await db.execute('DELETE FROM matches');
  await db.execute('DELETE FROM champion_proficiency');
  await db.execute('DELETE FROM players');
  await db.execute('DELETE FROM seasons');
  await db.execute('DELETE FROM teams');

  // 2. 시딩
  await seedAllData();

  // 3. 시즌 생성
  const seasonId = await createSeason(2026, 'spring');

  // 4. 유저 선수 생성 (선수 모드)
  let userPlayerId: string | null = null;
  if (mode === 'player' && pendingPlayer) {
    userPlayerId = `${teamId}_${pendingPlayer.name}`;
    const bgStats = BACKGROUND_STATS[pendingPlayer.background];

    await insertPlayer({
      id: userPlayerId,
      name: pendingPlayer.name,
      teamId,
      position: pendingPlayer.position,
      age: 18,
      nationality: 'KR',
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
  }

  // 5. 세이브 생성
  const saveId = await createSave(mode, teamId, userPlayerId, seasonId);
  const save = await getSaveById(saveId);

  if (!save) {
    throw new Error('세이브 생성 실패');
  }

  return save;
}

/**
 * 세이브 데이터를 store에 로딩
 */
export async function loadGameIntoStore(saveId: number): Promise<void> {
  const store = useGameStore.getState();

  const save = await getSaveById(saveId);
  if (!save) throw new Error('세이브를 찾을 수 없습니다');

  store.setSave(save);
  store.setMode(save.mode);

  const season = await getActiveSeason();
  if (season) store.setSeason(season);

  // 모든 팀 + 로스터 로딩
  const teams = await getAllTeams();
  for (const team of teams) {
    const players = await getPlayersByTeamId(team.id);
    team.roster = players;
  }
  store.setTeams(teams);
}
