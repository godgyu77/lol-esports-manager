import type { BoardExpectation, FanReaction } from '../../types/board';
import { getDatabase } from '../../db/database';
import { clamp } from '../../utils/mathUtils';
import { getManagerIdentity, getManagerIdentityEffects } from '../manager/managerIdentityEngine';
import { getInternationalExpectationSnapshot } from '../manager/releaseDepthEngine';

interface BoardExpectationRow {
  id: number;
  team_id: string;
  season_id: number;
  target_standing: number;
  target_playoff: number;
  target_international: number;
  satisfaction: number;
  fan_happiness: number;
  warning_count: number;
  is_fired: number;
}

interface FanReactionRow {
  id: number;
  team_id: string;
  reaction_date: string;
  event_type: string;
  happiness_change: number;
  message: string | null;
  created_at: string;
}

function mapRowToBoardExpectation(row: BoardExpectationRow): BoardExpectation {
  return {
    teamId: row.team_id,
    seasonId: row.season_id,
    targetStanding: row.target_standing,
    targetPlayoff: Boolean(row.target_playoff),
    targetInternational: Boolean(row.target_international),
    satisfaction: row.satisfaction,
    fanHappiness: row.fan_happiness,
    warningCount: row.warning_count,
    isFired: Boolean(row.is_fired),
  };
}

function mapRowToFanReaction(row: FanReactionRow): FanReaction {
  return {
    id: row.id,
    teamId: row.team_id,
    reactionDate: row.reaction_date,
    eventType: row.event_type,
    happinessChange: row.happiness_change,
    message: row.message,
  };
}

async function getBoardManagerContext(saveId?: number): Promise<{
  boardPressure: number;
  fanBonus: number;
  newsContext: string | null;
}> {
  if (!saveId) {
    return { boardPressure: 0, fanBonus: 0, newsContext: null };
  }

  const identity = await getManagerIdentity(saveId).catch(() => null);
  if (!identity) {
    return { boardPressure: 0, fanBonus: 0, newsContext: null };
  }

  const effects = getManagerIdentityEffects(identity.philosophy);
  const boardPressure = Math.max(0, effects.moraleRiskModifier);
  const fanBonus = effects.pressEffectBonus;
  const newsContext =
    fanBonus > 0
      ? 'The manager’s media-friendly tone is helping keep the outside mood from overheating.'
      : boardPressure > 0
        ? 'A results-first manager image is pushing outside expectations higher than usual.'
        : null;

  return { boardPressure, fanBonus, newsContext };
}

function getTargetStanding(reputation: number): number {
  if (reputation >= 90) return 1;
  if (reputation >= 80) return 2;
  if (reputation >= 70) return 3;
  if (reputation >= 55) return 4;
  if (reputation >= 40) return 6;
  return 8;
}

function expectsPlayoff(reputation: number): boolean {
  return reputation >= 55;
}

function expectsInternational(reputation: number): boolean {
  return reputation >= 80;
}

export async function initBoardExpectations(
  teamId: string,
  seasonId: number,
  reputation: number,
): Promise<BoardExpectation> {
  const db = await getDatabase();

  const targetStanding = getTargetStanding(reputation);
  const targetPlayoff = expectsPlayoff(reputation);
  const targetInternational = expectsInternational(reputation);
  const initialSatisfaction = 50;
  const initialFanHappiness = 50;

  await db.execute(
    `INSERT INTO board_expectations (team_id, season_id, target_standing, target_playoff, target_international, satisfaction, fan_happiness, warning_count, is_fired)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0)
     ON CONFLICT(team_id, season_id) DO UPDATE SET
       target_standing = $3,
       target_playoff = $4,
       target_international = $5`,
    [teamId, seasonId, targetStanding, targetPlayoff ? 1 : 0, targetInternational ? 1 : 0, initialSatisfaction, initialFanHappiness],
  );

  return {
    teamId,
    seasonId,
    targetStanding,
    targetPlayoff,
    targetInternational,
    satisfaction: initialSatisfaction,
    fanHappiness: initialFanHappiness,
    warningCount: 0,
    isFired: false,
  };
}

export async function updateBoardSatisfaction(
  teamId: string,
  seasonId: number,
  currentStanding: number,
  wins: number,
  losses: number,
  saveId?: number,
): Promise<BoardExpectation | null> {
  const expectations = await getBoardExpectations(teamId, seasonId);
  if (!expectations) return null;

  const [managerContext, internationalSnapshot] = await Promise.all([
    getBoardManagerContext(saveId),
    getInternationalExpectationSnapshot(teamId, seasonId, null, saveId).catch(() => null),
  ]);
  const totalGames = wins + losses;
  if (totalGames === 0) return expectations;

  const winRate = wins / totalGames;
  const standingDiff = expectations.targetStanding - currentStanding;

  let satisfactionDelta = 0;
  if (standingDiff >= 0) {
    satisfactionDelta = Math.min(standingDiff * 3, 15);
  } else {
    satisfactionDelta = Math.max(standingDiff * 4, -20);
  }

  if (winRate >= 0.7) satisfactionDelta += 5;
  else if (winRate <= 0.3) satisfactionDelta -= 5;

  if (internationalSnapshot?.level === 'contender') {
    satisfactionDelta += winRate >= 0.65 ? 2 : -2;
  } else if (internationalSnapshot?.level === 'must_deliver') {
    satisfactionDelta += winRate >= 0.65 ? 4 : -4;
  }

  satisfactionDelta -= managerContext.boardPressure;

  const newSatisfaction = clamp(expectations.satisfaction + satisfactionDelta, 0, 100);
  const db = await getDatabase();
  await db.execute(
    `UPDATE board_expectations SET satisfaction = $1 WHERE team_id = $2 AND season_id = $3`,
    [newSatisfaction, teamId, seasonId],
  );

  return { ...expectations, satisfaction: newSatisfaction };
}

export async function processMatchResult(
  teamId: string,
  seasonId: number,
  isWin: boolean,
  isUserMatch: boolean,
  currentDate: string,
  saveId?: number,
): Promise<BoardExpectation | null> {
  const expectations = await getBoardExpectations(teamId, seasonId);
  if (!expectations) return null;

  const db = await getDatabase();
  const [managerContext, internationalSnapshot] = await Promise.all([
    getBoardManagerContext(saveId),
    getInternationalExpectationSnapshot(teamId, seasonId, null, saveId).catch(() => null),
  ]);

  let satisfactionDelta = isWin ? 4 : -3;
  let fanDelta = isWin ? 5 : -3;

  if (isUserMatch) {
    fanDelta = isWin ? 8 : -6;
  }

  if (internationalSnapshot?.level === 'contender') {
    satisfactionDelta += isWin ? 2 : -3;
    fanDelta += isWin ? 2 : -2;
  } else if (internationalSnapshot?.level === 'must_deliver') {
    satisfactionDelta += isWin ? 3 : -5;
    fanDelta += isWin ? 3 : -3;
  }

  satisfactionDelta += isWin ? managerContext.boardPressure : -managerContext.boardPressure;
  fanDelta += isWin ? managerContext.fanBonus : -Math.max(0, managerContext.boardPressure - managerContext.fanBonus);

  const recentReactions = await getFanReactions(teamId, 5);
  if (!isWin) {
    const recentLosses = recentReactions.filter((reaction) => reaction.eventType === 'match_loss');
    if (recentLosses.length >= 2) {
      satisfactionDelta -= 2;
      fanDelta -= 4;
      if (recentLosses.length >= 3) {
        try {
          const { generateFanReactionNews } = await import('../news/newsEngine');
          const teamRows = await db.select<{ name: string }[]>('SELECT name FROM teams WHERE id = $1', [teamId]);
          await generateFanReactionNews(
            seasonId,
            currentDate,
            teamRows[0]?.name ?? teamId,
            'lose_streak',
            'negative',
            teamId,
            managerContext.newsContext ?? undefined,
          );
        } catch {
          void 0;
        }
      }
    }
  } else {
    const recentWins = recentReactions.filter((reaction) => reaction.eventType === 'match_win');
    if (recentWins.length >= 3) {
      try {
        const { generateFanReactionNews } = await import('../news/newsEngine');
        const teamRows = await db.select<{ name: string }[]>('SELECT name FROM teams WHERE id = $1', [teamId]);
        await generateFanReactionNews(
          seasonId,
          currentDate,
          teamRows[0]?.name ?? teamId,
          'win_streak',
          'positive',
          teamId,
          managerContext.newsContext ?? undefined,
        );
      } catch {
        void 0;
      }
    }
  }

  const newSatisfaction = clamp(expectations.satisfaction + satisfactionDelta, 0, 100);
  const newFanHappiness = clamp(expectations.fanHappiness + fanDelta, 0, 100);

  await db.execute(
    `UPDATE board_expectations SET satisfaction = $1, fan_happiness = $2 WHERE team_id = $3 AND season_id = $4`,
    [newSatisfaction, newFanHappiness, teamId, seasonId],
  );

  const eventType = isWin ? 'match_win' : 'match_loss';
  const message = isWin
    ? managerContext.fanBonus > 0
      ? 'Fans are celebrating the win and the media tone is landing well.'
      : 'Fans are celebrating the result.'
    : managerContext.boardPressure > 0
      ? 'Fans are reacting sharply because the results-first tone is raising expectations.'
      : 'Fans are frustrated by the loss.';

  await processFanReaction(teamId, currentDate, eventType, fanDelta, message);
  return { ...expectations, satisfaction: newSatisfaction, fanHappiness: newFanHappiness };
}

export async function checkFiringRisk(
  teamId: string,
  seasonId: number,
  currentDate: string,
  saveId?: number,
): Promise<'safe' | 'warning' | 'fired'> {
  const expectations = await getBoardExpectations(teamId, seasonId);
  if (!expectations) return 'safe';

  const db = await getDatabase();
  const managerContext = await getBoardManagerContext(saveId);
  const effectiveSatisfaction = expectations.satisfaction - managerContext.boardPressure;

  if (effectiveSatisfaction <= 15) {
    await db.execute(
      `UPDATE board_expectations SET is_fired = 1 WHERE team_id = $1 AND season_id = $2`,
      [teamId, seasonId],
    );
    await processFanReaction(teamId, currentDate, 'fired', -20, 'The board has dismissed the manager.');
    return 'fired';
  }

  if (effectiveSatisfaction <= 25) {
    const newWarningCount = expectations.warningCount + 1;
    await db.execute(
      `UPDATE board_expectations SET warning_count = $1 WHERE team_id = $2 AND season_id = $3`,
      [newWarningCount, teamId, seasonId],
    );
    await processFanReaction(teamId, currentDate, 'warning', -5, `The board has issued warning #${newWarningCount}.`);
    return 'warning';
  }

  return 'safe';
}

export async function processFanReaction(
  teamId: string,
  date: string,
  eventType: string,
  happinessChange: number,
  message: string | null,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO fan_reactions (team_id, reaction_date, event_type, happiness_change, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [teamId, date, eventType, happinessChange, message],
  );
}

export async function getBoardExpectations(
  teamId: string,
  seasonId: number,
): Promise<BoardExpectation | null> {
  const db = await getDatabase();
  const rows = await db.select<BoardExpectationRow[]>(
    `SELECT * FROM board_expectations WHERE team_id = $1 AND season_id = $2`,
    [teamId, seasonId],
  );

  if (rows.length === 0) return null;
  return mapRowToBoardExpectation(rows[0]);
}

export async function getFanReactions(
  teamId: string,
  limit = 20,
): Promise<FanReaction[]> {
  const db = await getDatabase();
  const rows = await db.select<FanReactionRow[]>(
    `SELECT * FROM fan_reactions WHERE team_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [teamId, limit],
  );

  return rows.map(mapRowToFanReaction);
}
