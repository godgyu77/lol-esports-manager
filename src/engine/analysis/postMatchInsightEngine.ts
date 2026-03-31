import type { GameResult, PlayerGameStatLine } from '../match/matchSimulator';

export type MatchInsightImpact = 'high' | 'medium' | 'low';
export type MatchInsightAction =
  | 'Review tactics'
  | 'Adjust training'
  | 'Protect player condition'
  | 'Revisit draft priorities'
  | 'Consider roster changes';

export interface MatchInsightReason {
  title: string;
  summary: string;
  impact: MatchInsightImpact;
  nextAction: MatchInsightAction;
}

export interface PostMatchInsightReport {
  headline: string;
  outcomeLabel: string;
  reasons: MatchInsightReason[];
  recommendedActions: MatchInsightAction[];
}

function sumTeamKda(stats: PlayerGameStatLine[]) {
  return stats.reduce(
    (acc, player) => {
      acc.kills += player.kills;
      acc.deaths += player.deaths;
      acc.assists += player.assists;
      acc.damage += player.damageDealt;
      return acc;
    },
    { kills: 0, deaths: 0, assists: 0, damage: 0 },
  );
}

function impactFromValue(value: number): MatchInsightImpact {
  if (value >= 0.75) return 'high';
  if (value >= 0.4) return 'medium';
  return 'low';
}

function dedupeActions(reasons: MatchInsightReason[]): MatchInsightAction[] {
  return Array.from(new Set(reasons.map((reason) => reason.nextAction))).slice(0, 3);
}

export function buildPostMatchInsightReport(
  gameResult: GameResult,
  perspectiveSide: 'home' | 'away',
): PostMatchInsightReport {
  const isPerspectiveWin = gameResult.winnerSide === perspectiveSide;
  const ownKills = perspectiveSide === 'home' ? gameResult.killsHome : gameResult.killsAway;
  const ownGold = perspectiveSide === 'home' ? gameResult.goldHome : gameResult.goldAway;
  const ownTowers = perspectiveSide === 'home' ? gameResult.towersHome : gameResult.towersAway;
  const ownGrubs = perspectiveSide === 'home' ? gameResult.grubsHome : gameResult.grubsAway;
  const ownStats = perspectiveSide === 'home' ? gameResult.playerStatsHome : gameResult.playerStatsAway;
  const enemyStats = perspectiveSide === 'home' ? gameResult.playerStatsAway : gameResult.playerStatsHome;
  const enemyKills = perspectiveSide === 'home' ? gameResult.killsAway : gameResult.killsHome;
  const enemyGold = perspectiveSide === 'home' ? gameResult.goldAway : gameResult.goldHome;
  const enemyTowers = perspectiveSide === 'home' ? gameResult.towersAway : gameResult.towersHome;
  const enemyGrubs = perspectiveSide === 'home' ? gameResult.grubsAway : gameResult.grubsHome;
  const ownSoulCount = gameResult.dragonSoul.dragonTypes.filter((dragon) => dragon.side === perspectiveSide).length;
  const enemySoulCount = gameResult.dragonSoul.dragonTypes.filter((dragon) => dragon.side !== perspectiveSide).length;
  const ownBarons = gameResult.events.filter((event) => event.type === 'baron' && event.side === perspectiveSide).length;
  const enemyBarons = gameResult.events.filter((event) => event.type === 'baron' && event.side !== perspectiveSide).length;
  const ownHeralds = gameResult.events.filter((event) => event.type === 'rift_herald' && event.side === perspectiveSide).length;
  const enemyHeralds = gameResult.events.filter((event) => event.type === 'rift_herald' && event.side !== perspectiveSide).length;
  const ownTeam = sumTeamKda(ownStats);
  const enemyTeam = sumTeamKda(enemyStats);
  const reasons: MatchInsightReason[] = [];

  const earlyDiff = perspectiveSide === 'home'
    ? gameResult.goldDiffAt15
    : -gameResult.goldDiffAt15;
  if (Math.abs(earlyDiff) >= 1800) {
    const lostEarly = earlyDiff < 0;
    reasons.push({
      title: lostEarly ? 'Early game slipped away' : 'Strong early setup paid off',
      summary: lostEarly
        ? `You were down ${Math.abs(earlyDiff)} gold at 15 minutes, so lane pressure and first rotations snowballed against you.`
        : `You built a ${earlyDiff} gold lead by 15 minutes and converted lane pressure into tempo for the rest of the game.`,
      impact: impactFromValue(Math.min(Math.abs(earlyDiff) / 3500, 1)),
      nextAction: lostEarly ? 'Adjust training' : 'Review tactics',
    });
  }

  const towerDiff = ownTowers - enemyTowers;
  if (Math.abs(towerDiff) >= 3) {
    const lostMap = towerDiff < 0;
    reasons.push({
      title: lostMap ? 'Map control broke down' : 'Map pressure stayed in your hands',
      summary: lostMap
        ? `You lost the tower race ${ownTowers}-${enemyTowers}, which usually means weak lane assignments or poor side lane protection.`
        : `You won the tower race ${ownTowers}-${enemyTowers}, which kept neutral setup and side lane pressure in your favor.`,
      impact: impactFromValue(Math.min(Math.abs(towerDiff) / 6, 1)),
      nextAction: lostMap ? 'Review tactics' : 'Revisit draft priorities',
    });
  }

  const objectiveDiff = (ownSoulCount + ownBarons * 2 + ownHeralds + ownGrubs * 0.25)
    - (enemySoulCount + enemyBarons * 2 + enemyHeralds + enemyGrubs * 0.25);
  if (Math.abs(objectiveDiff) >= 1.5) {
    const lostObjectives = objectiveDiff < 0;
    reasons.push({
      title: lostObjectives ? 'Neutral objective setup was behind' : 'Objective control created the win window',
      summary: lostObjectives
        ? 'The opponent controlled more dragons, heralds, barons, or grubs, so their setup around big objectives translated into a cleaner game state.'
        : 'Your team secured the more valuable neutral objectives, which gave you the cleanest route to close the game out.',
      impact: impactFromValue(Math.min(Math.abs(objectiveDiff) / 4, 1)),
      nextAction: lostObjectives ? 'Revisit draft priorities' : 'Review tactics',
    });
  }

  const killDiff = ownKills - enemyKills;
  const damageDiff = ownTeam.damage - enemyTeam.damage;
  if (Math.abs(killDiff) >= 5 || Math.abs(damageDiff) >= 9000) {
    const lostFights = killDiff < 0 || damageDiff < 0;
    reasons.push({
      title: lostFights ? 'Teamfights favored the opponent' : 'Your teamfights converted well',
      summary: lostFights
        ? `The fight profile ended ${ownKills}-${enemyKills} in kills with ${Math.abs(damageDiff)} less total damage, which points to execution, spacing, or engage timing issues.`
        : `The fight profile ended ${ownKills}-${enemyKills} in kills with ${damageDiff} more total damage, so your skirmish execution clearly held up.`,
      impact: impactFromValue(Math.min(Math.max(Math.abs(killDiff) / 12, Math.abs(damageDiff) / 15000), 1)),
      nextAction: lostFights ? 'Adjust training' : 'Review tactics',
    });
  }

  const worstOwnDeaths = [...ownStats].sort((left, right) => right.deaths - left.deaths)[0];
  if (worstOwnDeaths && worstOwnDeaths.deaths >= 5) {
    reasons.push({
      title: 'One role became a pressure point',
      summary: `${worstOwnDeaths.position.toUpperCase()} died ${worstOwnDeaths.deaths} times, which often signals matchup strain, poor protection, or a lineup issue worth revisiting.`,
      impact: impactFromValue(Math.min(worstOwnDeaths.deaths / 8, 1)),
      nextAction: worstOwnDeaths.deaths >= 7 ? 'Consider roster changes' : 'Protect player condition',
    });
  }

  if (reasons.length < 3) {
    const finalGoldDiff = ownGold - enemyGold;
    reasons.push({
      title: isPerspectiveWin ? 'Closing discipline held' : 'The game stayed close until late',
      summary: isPerspectiveWin
        ? `You finished with a ${finalGoldDiff} gold lead, so the team kept enough structure to turn pressure into a result.`
        : `The final gold gap was ${Math.abs(finalGoldDiff)}, which suggests the result was still recoverable with better mid-to-late decisions.`,
      impact: impactFromValue(Math.min(Math.abs(finalGoldDiff) / 6000, 1)),
      nextAction: isPerspectiveWin ? 'Review tactics' : 'Protect player condition',
    });
  }

  const trimmedReasons = reasons
    .sort((left, right) => {
      const order = { high: 3, medium: 2, low: 1 };
      return order[right.impact] - order[left.impact];
    })
    .slice(0, 5);

  return {
    headline: isPerspectiveWin ? 'Your preparation translated into the result.' : 'The result exposed a few controllable weak points.',
    outcomeLabel: isPerspectiveWin ? 'What worked' : 'Why it slipped',
    reasons: trimmedReasons,
    recommendedActions: dedupeActions(trimmedReasons),
  };
}
