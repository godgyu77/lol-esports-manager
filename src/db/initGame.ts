/**
 * 게임 초기화 — 새 게임 시작 & store 로딩
 */
import type { GameMode, GameSave, Position, Region } from '../types';
import type { PlayerBackground } from '../types/player';
import type { PendingManager } from '../stores/gameStore';
import { generateLeagueSchedule } from '../engine/season/scheduleGenerator';
import { assignMatchDates, SEASON_DATES } from '../engine/season/calendar';
import { getDatabase, withTransaction, closeDatabase } from './database';
import {
  createSave,
  createSeason,
  getActiveSeason,
  getAllPlayersGroupedByTeam,
  getAllTeams,
  getTeamsByRegion,
  getSaveById,
  insertMatch,
  insertPlayer,
} from './queries';
import { seedAllData } from './seed';
import { useGameStore } from '../stores/gameStore';
import { generateLCKCup } from '../engine/tournament/tournamentEngine';
import { initializeTeamChemistry } from '../engine/chemistry/chemistryEngine';
import { generatePlayerGoals } from '../engine/playerGoal/playerGoalEngine';
import { initializeKnowledgeBase } from '../ai/rag/ragEngine';
import { initGlobalRng } from '../utils/random';
import { updateRngSeed } from './queries';

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

// ─────────────────────────────────────────
// 게임 초기화
// ─────────────────────────────────────────

export interface PendingPlayer {
  name: string;
  age: number;
  nationality: string;
  position: Position;
  background: PlayerBackground;
  traits: string[];
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
  pendingManager?: PendingManager | null,
): Promise<GameSave> {
  // 1. 기존 데이터 정리 — DB 재연결 + 무결성 검사 + 전체 삭제
  await closeDatabase();
  let db = await getDatabase();

  // DB 무결성 검사 — 손상 시 자동 복구
  try {
    const integrity = await db.select<{ integrity_check: string }[]>('PRAGMA integrity_check');
    if (integrity[0]?.integrity_check !== 'ok') {
      console.warn('[initGame] DB 손상 감지, 재생성합니다.');
      await closeDatabase();
      // DB 파일 삭제는 Tauri 플러그인이 재연결 시 자동 재생성
      const { appDataDir } = await import('@tauri-apps/api/path');
      const { remove } = await import('@tauri-apps/plugin-fs');
      const dir = await appDataDir();
      await remove(`${dir}lol_esports_manager.db`).catch(() => {});
      await remove(`${dir}lol_esports_manager.db-wal`).catch(() => {});
      await remove(`${dir}lol_esports_manager.db-shm`).catch(() => {});
      db = await getDatabase();
    }
  } catch {
    // integrity_check 실패 시에도 계속 진행
  }

  // PRAGMA는 반드시 트랜잭션 밖에서 (SQLite 제약)
  await db.execute('PRAGMA foreign_keys = OFF');

  // sqlite_master에서 모든 사용자 테이블을 조회하여 삭제 (누락 방지)
  try {
    const tableRows = await db.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_sqlx_%'",
    );
    for (const row of tableRows) {
      await db.execute(`DELETE FROM "${row.name}"`).catch(() => {});
    }
  } catch {
    // 테이블 조회 실패 시 무시 (첫 실행)
  }

  // FK OFF 상태 유지한 채 시딩 진행
  console.log('[initGame] 1단계 완료: 테이블 정리 (FK OFF)');

  // 2. 시딩 (FK OFF 상태에서 진행)
  await seedAllData();
  console.log('[initGame] 2단계 완료: 시딩');

  // 2.5. RAG 지식 베이스 초기화
  try {
    await initializeKnowledgeBase();
  } catch (e) {
    console.warn('[initGame] RAG 지식 베이스 초기화 실패 (무시):', e);
  }

  // 3~5. 시즌/스케줄/세이브 생성 (FK OFF 상태에서 트랜잭션)
  console.log('[initGame] 3단계 시작: 시즌/스케줄/세이브');
  const result = await withTransaction(async () => {
    const seasonId = await createSeason(2026, 'spring');

    // 리그별 경기 스케줄 생성 + 날짜 배정
    const regions: Region[] = ['LCK', 'LPL', 'LEC', 'LCS'];
    const startDate = SEASON_DATES.spring.start;

    for (const region of regions) {
      const teams = await getTeamsByRegion(region);
      const teamIds = teams.map(t => t.id);
      const schedule = generateLeagueSchedule(region, teamIds);

      const datedSchedule = assignMatchDates(schedule, startDate);

      for (let i = 0; i < datedSchedule.length; i++) {
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

    // 유저 선수 생성 (선수 모드)
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

      // 유저 선수 특성 저장
      if (pendingPlayer.traits && pendingPlayer.traits.length > 0) {
        const db = await getDatabase();
        for (const traitId of pendingPlayer.traits) {
          await db.execute(
            'INSERT INTO player_traits (player_id, trait_id) VALUES ($1, $2)',
            [userPlayerId, traitId],
          );
        }
      }
    }

    // LCK Cup (윈터) 자동 생성 — 스프링 시즌 시작 전 1~2월
    const lckTeams = await getTeamsByRegion('LCK');
    const lckTeamIds = lckTeams.map(t => t.id);
    await generateLCKCup(seasonId, 2026, lckTeamIds);

    // 모든 팀의 케미스트리 초기화 + 선수 목표 생성
    try {
      const allTeams = await getAllTeams();
      for (const team of allTeams) {
        await initializeTeamChemistry(team.id);
        await generatePlayerGoals(team.id, seasonId);
      }
    } catch (e) {
      console.warn('[initGame] 케미스트리/목표 초기화 실패:', e);
    }

    // 시드 생성 + 세이브 생성
    const rngSeed = crypto.randomUUID();
    const saveId = await createSave(mode, teamId, userPlayerId, seasonId, rngSeed);
    const save = await getSaveById(saveId);

    if (!save) {
      throw new Error('세이브 생성 실패');
    }

    // 감독 프로필 저장 (감독 모드)
    if (mode === 'manager' && pendingManager) {
      const db = await getDatabase();
      await db.execute(
        `INSERT INTO manager_profiles
          (save_id, name, nationality, age, background,
           tactical_knowledge, motivation, discipline,
           adaptability, scouting_eye, media_handling, reputation)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          saveId,
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
        ],
      );
    }

    return save;
  });

  // 모든 초기화 완료 후 FK 다시 활성화
  const dbFinal = await getDatabase();
  await dbFinal.execute('PRAGMA foreign_keys = ON');
  console.log('[initGame] 완료: FK ON 복원');

  // 전역 RNG 초기화
  if (result.rngSeed) {
    initGlobalRng(result.rngSeed);
  }

  return result;
}

/**
 * 세이브 데이터를 store에 로딩
 */
export async function loadGameIntoStore(saveId: number): Promise<void> {
  const store = useGameStore.getState();

  let save = await getSaveById(saveId);
  if (!save) throw new Error('세이브를 찾을 수 없습니다');

  // RNG 시드 초기화 (기존 세이브에 시드가 없으면 새로 생성 후 DB 업데이트)
  let rngSeed = save.rngSeed;
  if (!rngSeed) {
    rngSeed = crypto.randomUUID();
    await updateRngSeed(save.id, rngSeed);
    save = { ...save, rngSeed };
  }
  initGlobalRng(rngSeed);

  store.setSave(save);
  store.setMode(save.mode);

  const season = await getActiveSeason();
  if (season) store.setSeason(season);

  // 모든 팀 + 로스터 일괄 로딩 (N+1 방지)
  const teams = await getAllTeams();
  const playersByTeam = await getAllPlayersGroupedByTeam();
  for (const team of teams) {
    team.roster = playersByTeam.get(team.id) ?? [];
  }
  store.setTeams(teams);
}
