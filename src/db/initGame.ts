/**
 * 게임 초기화 — 새 게임 시작 & store 로딩
 */
import type { GameMode, GameSave, Position, Region } from '../types';
import type { PlayerBackground } from '../types/player';
import type { PendingManager } from '../stores/gameStore';
import { generateLeagueSchedule } from '../engine/season/scheduleGenerator';
import { assignMatchDates, SEASON_DATES } from '../engine/season/calendar';
import { getDatabase, withTransaction } from './database';
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
import { isSeeded, seedAllData } from './seed';
import { useGameStore } from '../stores/gameStore';
import { generateLCKCup } from '../engine/tournament/tournamentEngine';

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
  pendingManager?: PendingManager | null,
): Promise<GameSave> {
  // 1. 기존 데이터 정리 (트랜잭션)
  await withTransaction(async (db) => {
    await db.execute('DELETE FROM manager_profiles');
    await db.execute('DELETE FROM save_metadata');
    await db.execute('DELETE FROM daily_events');
    await db.execute('DELETE FROM player_daily_condition');
    await db.execute('DELETE FROM swiss_records');
    await db.execute('DELETE FROM tournament_participants');
    await db.execute('DELETE FROM tournaments');
    await db.execute('DELETE FROM games');
    await db.execute('DELETE FROM matches');
    await db.execute('DELETE FROM champion_stat_modifiers');
    await db.execute('DELETE FROM champion_patches');
    await db.execute('DELETE FROM champion_proficiency');
    await db.execute('DELETE FROM player_traits');
    await db.execute('DELETE FROM players');
    await db.execute('DELETE FROM seasons');
    await db.execute('DELETE FROM champions');
    await db.execute('DELETE FROM teams');
  });

  // 2. 시딩 (자체 트랜잭션 사용)
  await seedAllData();

  // 3~5. 시즌/스케줄/세이브 생성 (트랜잭션)
  return await withTransaction(async () => {
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

    // LCK Cup (윈터) 자동 생성 — 스프링 시즌 시작 전 1~2월
    const lckTeams = await getTeamsByRegion('LCK');
    const lckTeamIds = lckTeams.map(t => t.id);
    await generateLCKCup(seasonId, 2026, lckTeamIds);

    // 세이브 생성
    const saveId = await createSave(mode, teamId, userPlayerId, seasonId);
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

  // 모든 팀 + 로스터 일괄 로딩 (N+1 방지)
  const teams = await getAllTeams();
  const playersByTeam = await getAllPlayersGroupedByTeam();
  for (const team of teams) {
    team.roster = playersByTeam.get(team.id) ?? [];
  }
  store.setTeams(teams);
}
