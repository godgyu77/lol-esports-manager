/**
 * 업적/도전과제 엔진
 * - 업적 정의 및 해금 조건 관리
 * - DB 기반 업적 상태 저장/조회
 * - 경기/시즌/커리어 이벤트 연동
 */

import { getDatabase } from '../../db/database';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export type AchievementCategory = 'match' | 'season' | 'career' | 'player' | 'special';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  condition: string;
  isUnlocked: boolean;
  unlockedDate?: string;
  progress?: number;
  target?: number;
}

export interface AchievementContext {
  totalGames: number;
  winStreak: number;
  seasonStanding: number | null;
  trophyCount: number;
  seasonsPlayed: number;
  hasMvpAward: boolean;
  maxPlayerOvr: number;
  hasYouthPromotion: boolean;
  avgChemistry: number;
  isFirstSeason: boolean;
  /** Bo5 역전승 여부 (0:2에서 3:2) */
  hasComebackWin: boolean;
  /** 퍼펙트 게임 여부 (0데스 승리) */
  hasPerfectGame: boolean;
  /** Bo3 2:0 클린 스윕 여부 */
  hasDominantWin: boolean;
  /** 월간 무패 여부 */
  hasUndefeatedMonth: boolean;
  /** 순위 차이 5+ 언더독 승리 */
  hasUnderdogWin: boolean;
  /** 플레이오프 우승 여부 */
  isPlayoffChampion: boolean;
  /** Worlds 우승 여부 */
  isWorldsChampion: boolean;
}

// ─────────────────────────────────────────
// 업적 정의 목록
// ─────────────────────────────────────────

type AchievementDefinition = Omit<Achievement, 'isUnlocked' | 'unlockedDate'>;

const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // 매치
  { id: 'first_win', name: '첫 승리', description: '첫 경기에서 승리', category: 'match', condition: '경기 1승' },
  { id: 'perfect_game', name: '퍼펙트 게임', description: '한 세트에서 0데스로 승리', category: 'match', condition: '0데스 승리' },
  { id: 'comeback_king', name: '역전의 제왕', description: '0:2에서 역전승', category: 'match', condition: 'Bo5 0:2에서 3:2' },
  { id: 'dominant_win', name: '완벽한 승리', description: 'Bo3 2:0 클린 스윕', category: 'match', condition: 'Bo3 2:0' },

  // 시즌
  { id: 'win_streak_5', name: '5연승', description: '5연속 시리즈 승리', category: 'season', condition: '5연승' },
  { id: 'win_streak_10', name: '10연승', description: '10연속 시리즈 승리', category: 'season', condition: '10연승', progress: 0, target: 10 },
  { id: 'undefeated_month', name: '무패의 달', description: '한 달간 무패', category: 'season', condition: '4주 무패' },
  { id: 'playoff_champion', name: '챔피언', description: 'LCK 우승', category: 'season', condition: 'LCK 우승' },
  { id: 'regular_first', name: '정규시즌 1위', description: '정규시즌 1위 달성', category: 'season', condition: '순위 1위' },

  // 커리어
  { id: 'games_100', name: '100경기', description: '통산 100경기 달성', category: 'career', condition: '100경기', progress: 0, target: 100 },
  { id: 'games_500', name: '500경기', description: '통산 500경기 달성', category: 'career', condition: '500경기', progress: 0, target: 500 },
  { id: 'trophies_3', name: '트리플 크라운', description: '3개 트로피 수집', category: 'career', condition: '트로피 3개', progress: 0, target: 3 },
  { id: 'worlds_champion', name: '세계 챔피언', description: 'Worlds 우승', category: 'career', condition: 'Worlds 우승' },
  { id: 'multi_season_5', name: '장수 감독', description: '5시즌 이상 진행', category: 'career', condition: '5시즌', progress: 0, target: 5 },

  // 선수
  { id: 'mvp_award', name: 'MVP', description: 'MVP 수상', category: 'player', condition: 'MVP 수상' },
  { id: 'player_ovr_90', name: '레전드 선수', description: 'OVR 90+ 선수 보유', category: 'player', condition: 'OVR 90+' },
  { id: 'youth_promotion', name: '유스 졸업', description: '아카데미에서 1군 승격', category: 'player', condition: '아카데미 승격' },
  { id: 'perfect_chemistry', name: '팀 케미 만점', description: '팀 평균 케미 80+', category: 'player', condition: '케미 80+' },

  // 특수
  { id: 'first_season', name: '시즌 완주', description: '첫 시즌 완료', category: 'special', condition: '시즌 종료' },
  { id: 'underdog_win', name: '자이언트 킬링', description: '순위 차이 5+ 팀에게 승리', category: 'special', condition: '언더독 승리' },
];

// ─────────────────────────────────────────
// DB 초기화
// ─────────────────────────────────────────

async function ensureTable(): Promise<void> {
  const db = await getDatabase();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS achievements (
      save_id INTEGER NOT NULL,
      achievement_id TEXT NOT NULL,
      unlocked_date TEXT NOT NULL,
      PRIMARY KEY (save_id, achievement_id)
    )
  `);
}

// ─────────────────────────────────────────
// 조회
// ─────────────────────────────────────────

interface AchievementRow {
  achievement_id: string;
  unlocked_date: string;
}

/**
 * 현재 세이브의 모든 업적 상태 조회
 */
export async function getAchievements(saveId: number): Promise<Achievement[]> {
  await ensureTable();

  const db = await getDatabase();
  const rows = await db.select<AchievementRow[]>(
    'SELECT achievement_id, unlocked_date FROM achievements WHERE save_id = $1',
    [saveId],
  );

  const unlockedMap = new Map<string, string>();
  for (const row of rows) {
    unlockedMap.set(row.achievement_id, row.unlocked_date);
  }

  return ACHIEVEMENT_DEFINITIONS.map((def) => {
    const unlockedDate = unlockedMap.get(def.id);
    return {
      ...def,
      isUnlocked: unlockedDate != null,
      unlockedDate: unlockedDate ?? undefined,
    };
  });
}

/**
 * 해금된 업적 수 조회
 */
export async function getUnlockedCount(saveId: number): Promise<number> {
  await ensureTable();

  const db = await getDatabase();
  const rows = await db.select<{ cnt: number }[]>(
    'SELECT COUNT(*) as cnt FROM achievements WHERE save_id = $1',
    [saveId],
  );
  return rows[0]?.cnt ?? 0;
}

/**
 * 총 업적 수
 */
export function getTotalAchievementCount(): number {
  return ACHIEVEMENT_DEFINITIONS.length;
}

// ─────────────────────────────────────────
// 업적 해금 체크
// ─────────────────────────────────────────

/**
 * 컨텍스트 기반으로 업적 조건을 체크하고 신규 해금된 업적을 반환
 */
export async function checkAndUnlockAchievements(
  saveId: number,
  context: AchievementContext,
  currentDate: string,
): Promise<Achievement[]> {
  await ensureTable();

  const db = await getDatabase();
  const existing = await db.select<AchievementRow[]>(
    'SELECT achievement_id, unlocked_date FROM achievements WHERE save_id = $1',
    [saveId],
  );
  const alreadyUnlocked = new Set(existing.map((r) => r.achievement_id));

  const newlyUnlocked: Achievement[] = [];

  const conditionChecks: Record<string, boolean> = {
    // 매치
    first_win: context.totalGames >= 1,
    perfect_game: context.hasPerfectGame,
    comeback_king: context.hasComebackWin,
    dominant_win: context.hasDominantWin,

    // 시즌
    win_streak_5: context.winStreak >= 5,
    win_streak_10: context.winStreak >= 10,
    undefeated_month: context.hasUndefeatedMonth,
    playoff_champion: context.isPlayoffChampion,
    regular_first: context.seasonStanding === 1,

    // 커리어
    games_100: context.totalGames >= 100,
    games_500: context.totalGames >= 500,
    trophies_3: context.trophyCount >= 3,
    worlds_champion: context.isWorldsChampion,
    multi_season_5: context.seasonsPlayed >= 5,

    // 선수
    mvp_award: context.hasMvpAward,
    player_ovr_90: context.maxPlayerOvr >= 90,
    youth_promotion: context.hasYouthPromotion,
    perfect_chemistry: context.avgChemistry >= 80,

    // 특수
    first_season: context.isFirstSeason && context.seasonsPlayed >= 1,
    underdog_win: context.hasUnderdogWin,
  };

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (alreadyUnlocked.has(def.id)) continue;

    const isUnlocked = conditionChecks[def.id] ?? false;
    if (!isUnlocked) continue;

    // DB에 저장
    await db.execute(
      'INSERT OR IGNORE INTO achievements (save_id, achievement_id, unlocked_date) VALUES ($1, $2, $3)',
      [saveId, def.id, currentDate],
    );

    newlyUnlocked.push({
      ...def,
      isUnlocked: true,
      unlockedDate: currentDate,
    });
  }

  return newlyUnlocked;
}

/**
 * 현재 진행도가 있는 업적의 progress 값 계산
 */
export function calculateProgress(
  achievementId: string,
  context: AchievementContext,
): number {
  switch (achievementId) {
    case 'win_streak_10': return Math.min(context.winStreak, 10);
    case 'games_100': return Math.min(context.totalGames, 100);
    case 'games_500': return Math.min(context.totalGames, 500);
    case 'trophies_3': return Math.min(context.trophyCount, 3);
    case 'multi_season_5': return Math.min(context.seasonsPlayed, 5);
    default: return 0;
  }
}

/**
 * 업적 컨텍스트 빌드를 위한 DB 조회 헬퍼
 */
export async function buildAchievementContext(
  _saveId: number,
  userTeamId: string,
  seasonId: number,
): Promise<AchievementContext> {
  const db = await getDatabase();

  // 통산 경기 수
  const gameCountRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM matches
     WHERE (team_home_id = $1 OR team_away_id = $1) AND is_played = 1`,
    [userTeamId],
  );
  const totalGames = gameCountRows[0]?.cnt ?? 0;

  // 연승 기록 계산
  const matchRows = await db.select<{
    id: string;
    team_home_id: string;
    team_away_id: string;
    score_home: number;
    score_away: number;
    match_date: string;
  }[]>(
    `SELECT id, team_home_id, team_away_id, score_home, score_away, match_date
     FROM matches
     WHERE (team_home_id = $1 OR team_away_id = $1) AND is_played = 1
     ORDER BY match_date DESC`,
    [userTeamId],
  );

  let winStreak = 0;
  for (const m of matchRows) {
    const isHome = m.team_home_id === userTeamId;
    const won = isHome ? m.score_home > m.score_away : m.score_away > m.score_home;
    if (won) winStreak++;
    else break;
  }

  // 시즌 순위
  let seasonStanding: number | null = null;
  try {
    const standingRows = await db.select<{ team_id: string }[]>(
      `SELECT team_id FROM standings
       WHERE season_id = $1
       ORDER BY wins DESC, (wins * 1.0 / CASE WHEN wins + losses = 0 THEN 1 ELSE wins + losses END) DESC`,
      [seasonId],
    );
    const idx = standingRows.findIndex((r) => r.team_id === userTeamId);
    if (idx >= 0) seasonStanding = idx + 1;
  } catch { /* standings 테이블 미존재 시 무시 */ }

  // 트로피 수
  const trophyRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM season_records
     WHERE team_id = $1 AND champion = 1`,
    [userTeamId],
  ).catch(() => [{ cnt: 0 }]);
  const trophyCount = trophyRows[0]?.cnt ?? 0;

  // 시즌 수
  const seasonCountRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(DISTINCT season_id) as cnt FROM season_records
     WHERE team_id = $1`,
    [userTeamId],
  ).catch(() => [{ cnt: 0 }]);
  const seasonsPlayed = Math.max(seasonCountRows[0]?.cnt ?? 0, 1);

  // MVP 수상 여부
  const mvpRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM awards
     WHERE team_id = $1 AND award_type = 'mvp'`,
    [userTeamId],
  ).catch(() => [{ cnt: 0 }]);
  const hasMvpAward = (mvpRows[0]?.cnt ?? 0) > 0;

  // 최고 OVR
  const ovrRows = await db.select<{ ovr: number }[]>(
    `SELECT CAST((mechanical + game_sense + teamwork + consistency + laning + aggression) / 6.0 AS INTEGER) as ovr
     FROM players WHERE team_id = $1
     ORDER BY ovr DESC LIMIT 1`,
    [userTeamId],
  ).catch(() => [{ ovr: 0 }]);
  const maxPlayerOvr = ovrRows[0]?.ovr ?? 0;

  // 아카데미 승격 여부
  const promoRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM daily_events
     WHERE event_type = 'academy_promotion' AND target_id = $1`,
    [userTeamId],
  ).catch(() => [{ cnt: 0 }]);
  const hasYouthPromotion = (promoRows[0]?.cnt ?? 0) > 0;

  // 팀 케미스트리 평균
  let avgChemistry = 0;
  try {
    const chemRows = await db.select<{ avg_val: number }[]>(
      `SELECT AVG(value) as avg_val FROM team_chemistry WHERE team_id = $1`,
      [userTeamId],
    );
    avgChemistry = chemRows[0]?.avg_val ?? 0;
  } catch { /* 무시 */ }

  // 첫 시즌 여부
  const isFirstSeason = seasonsPlayed <= 1;

  return {
    totalGames,
    winStreak,
    seasonStanding,
    trophyCount,
    seasonsPlayed,
    hasMvpAward,
    maxPlayerOvr,
    hasYouthPromotion,
    avgChemistry,
    isFirstSeason,
    // 아래 항목은 이벤트 기반으로 외부에서 설정
    hasComebackWin: false,
    hasPerfectGame: false,
    hasDominantWin: false,
    hasUndefeatedMonth: false,
    hasUnderdogWin: false,
    isPlayoffChampion: false,
    isWorldsChampion: false,
  };
}
