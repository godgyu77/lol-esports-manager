import { CHAMPION_DB } from '../../data/championDb';
import { getDatabase } from '../../db/database';
import { generateOpponentReport } from '../analysis/matchAnalysisEngine';
import { getRecentScrims } from '../season/scrimEngine';
import type { Match, MatchType } from '../../types/match';
import type { Player } from '../../types/player';
import type { Team } from '../../types/team';
import type { BudgetPressureSnapshot, PrepRecommendationRecord } from '../../types/systemDepth';

interface BriefingRecommendation {
  headline?: string;
  summary: string;
}

interface MetaSnapshot {
  patchNumber: number | null;
  summary: string;
  shifts: string[];
}

export interface CompetitiveOperationBrief {
  deskHeadline: string;
  deskSummary: string;
  patchPulse: {
    label: string;
    summary: string;
    shifts: string[];
  };
  scrimPulse: {
    label: string;
    summary: string;
    takeaway: string;
  };
  draftPulse: {
    label: string;
    summary: string;
    bans: string[];
    watchPoints: string[];
  };
  coachPulse: {
    label: string;
    summary: string;
    directives: string[];
  };
  storyPulse: {
    label: string;
    summary: string;
    broadcastAngle: string;
    tags: string[];
  };
}

export interface BroadcastNarrativeBrief {
  openingLine: string;
  tacticalLens: string;
  objectiveCall: string;
  castingLine: string;
  storyTag: string;
}

function averageAge(players: Player[]): number {
  if (players.length === 0) return 0;
  return players.reduce((sum, player) => sum + player.age, 0) / players.length;
}

function averageCareerGames(players: Player[]): number {
  if (players.length === 0) return 0;
  return players.reduce((sum, player) => sum + player.careerGames, 0) / players.length;
}

function championName(championId: string): string {
  return CHAMPION_DB.find((champion) => champion.id === championId)?.nameKo ?? championId;
}

function matchTypeLabel(matchType: MatchType): string {
  if (matchType.startsWith('worlds')) return 'Worlds';
  if (matchType.startsWith('msi')) return 'MSI';
  if (matchType.startsWith('ewc')) return 'EWC';
  if (matchType.startsWith('fst')) return 'First Stand';
  if (matchType.startsWith('playoff')) return 'Playoffs';
  return 'League Stage';
}

function summarizePrepRecord(record: PrepRecommendationRecord | null): string {
  if (!record) return 'Recent prep changes are still light, so today is more about clean execution than surprise tech.';
  if (record.impactSummary) return record.impactSummary;
  return record.summary;
}

function buildStoryPulse(params: {
  userTeam: Team;
  opponentTeam: Team;
  pendingMatch: Match;
  userPlayers: Player[];
  opponentPlayers: Player[];
  budgetPressure: BudgetPressureSnapshot | null;
}): CompetitiveOperationBrief['storyPulse'] {
  const tags: string[] = [];
  const labelParts: string[] = [];

  const isInternational =
    params.pendingMatch.matchType.startsWith('worlds') ||
    params.pendingMatch.matchType.startsWith('msi') ||
    params.pendingMatch.matchType.startsWith('ewc') ||
    params.pendingMatch.matchType.startsWith('fst');
  const sameRegion = params.userTeam.region === params.opponentTeam.region;
  const reputationGap = Math.abs(params.userTeam.reputation - params.opponentTeam.reputation);

  if (isInternational) {
    tags.push(matchTypeLabel(params.pendingMatch.matchType));
    labelParts.push('International Stage');
  }

  if (sameRegion && reputationGap <= 12) {
    tags.push('Rivalry');
    labelParts.push('Regional Rivalry');
  }

  const userAvgAge = averageAge(params.userPlayers);
  const opponentAvgAge = averageAge(params.opponentPlayers);
  const userCareer = averageCareerGames(params.userPlayers);
  const opponentCareer = averageCareerGames(params.opponentPlayers);
  const ageGap = Math.abs(userAvgAge - opponentAvgAge);
  const careerGap = Math.abs(userCareer - opponentCareer);

  if (ageGap >= 2.5 || careerGap >= 60) {
    tags.push('Generation Shift');
    labelParts.push('Veterans vs Rookies');
  }

  const veteran = [...params.userPlayers, ...params.opponentPlayers].find(
    (player) => player.age >= 27 || player.careerGames >= 250,
  );
  if (veteran) {
    tags.push('Legacy Watch');
  }

  if (params.budgetPressure?.pressureLevel === 'critical') {
    tags.push('Board Pressure');
  }

  const label = labelParts[0] ?? 'League Storyline';
  const summarySegments = [
    isInternational
      ? `${matchTypeLabel(params.pendingMatch.matchType)} means every draft read and objective setup carries cross-region weight.`
      : 'This match still matters beyond a single result because the league will read it as a statement of direction.',
    sameRegion && reputationGap <= 12
      ? `${params.userTeam.shortName} and ${params.opponentTeam.shortName} sit close enough in reputation that every clean win feeds a real rivalry narrative.`
      : `${params.userTeam.shortName} need this game to define whether their current project is stable or still searching for identity.`,
    ageGap >= 2.5 || careerGap >= 60
      ? 'It also reads like a generation test: veteran game sense against a newer, lighter roster profile.'
      : null,
    params.budgetPressure?.pressureLevel === 'critical'
      ? 'Board pressure adds another layer, so today is not just about winning but proving the current plan deserves more runway.'
      : null,
  ].filter(Boolean);

  const broadcastAngle = isInternational
    ? 'Frame the series as a clash of regional reads on the patch, not just a one-off result.'
    : sameRegion && reputationGap <= 12
      ? 'Sell every dragon setup and draft trade as part of a growing rivalry ledger.'
      : veteran
        ? `${veteran.name}'s long-career arc gives the series a legacy angle whenever the game slows into setup.`
        : 'Keep the focus on how today\'s choices reveal the team\'s long-term identity.';

  return {
    label,
    summary: summarySegments.join(' '),
    broadcastAngle,
    tags: tags.length > 0 ? tags : ['League Storyline'],
  };
}

async function getLatestMetaSnapshot(seasonId: number): Promise<MetaSnapshot> {
  const db = await getDatabase();
  const [modifierRow] = await db.select<
    Array<{
      patch_number: number;
      teamfight_efficiency: number;
      split_push_efficiency: number;
      early_aggro_efficiency: number;
      objective_efficiency: number;
    }>
  >(
    `SELECT patch_number, teamfight_efficiency, split_push_efficiency,
            early_aggro_efficiency, objective_efficiency
     FROM patch_meta_modifiers
     WHERE season_id = $1
     ORDER BY patch_number DESC
     LIMIT 1`,
    [seasonId],
  );

  const patchRows = await db.select<
    Array<{
      champion_id: string;
      stat_key: string;
      old_value: string;
      new_value: string;
    }>
  >(
    `SELECT champion_id, stat_key, old_value, new_value
     FROM champion_patches
     WHERE season_id = $1
     ORDER BY week DESC, id DESC
     LIMIT 4`,
    [seasonId],
  );

  const shifts = patchRows.map((row) => {
    const before = Number.parseFloat(row.old_value);
    const after = Number.parseFloat(row.new_value);
    const delta = Number.isFinite(before) && Number.isFinite(after) ? after - before : 0;
    const verb = delta > 0 ? 'up' : delta < 0 ? 'down' : 'adjusted';
    return `${championName(row.champion_id)} ${row.stat_key.replace(/_/g, ' ')} ${verb}`;
  });

  if (!modifierRow) {
    return {
      patchNumber: null,
      summary: 'No major patch swings are logged yet, so team-specific execution should matter more than raw meta volatility.',
      shifts,
    };
  }

  const axes: Array<[string, number]> = [
    ['teamfight', modifierRow.teamfight_efficiency],
    ['split push', modifierRow.split_push_efficiency],
    ['early tempo', modifierRow.early_aggro_efficiency],
    ['objective setup', modifierRow.objective_efficiency],
  ];
  const strongestAxis = axes.sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))[0] ?? ['teamfight', 0];

  return {
    patchNumber: modifierRow.patch_number,
    summary: `Patch ${modifierRow.patch_number} is currently rewarding ${strongestAxis[0]} reads first, so clean interpretation matters as much as raw form.`,
    shifts,
  };
}

export async function buildCompetitiveOperationBrief(params: {
  seasonId: number;
  currentDate: string;
  pendingMatch: Match;
  userTeam: Team;
  opponentTeam: Team;
  userPlayers: Player[];
  opponentPlayers: Player[];
  recommendedBans: string[];
  prepRecords: PrepRecommendationRecord[];
  staffRecommendations: BriefingRecommendation[];
  budgetPressure: BudgetPressureSnapshot | null;
}): Promise<CompetitiveOperationBrief> {
  const [metaSnapshot, recentScrims, opponentReport] = await Promise.all([
    getLatestMetaSnapshot(params.seasonId).catch(() => ({
      patchNumber: null,
      summary: 'Patch read is still forming, so the team that turns prep into cleaner execution should control the match.',
      shifts: [] as string[],
    })),
    getRecentScrims(params.userTeam.id, 3).catch(() => []),
    generateOpponentReport(params.userTeam.id, params.opponentTeam.id, params.currentDate).catch(() => null),
  ]);

  const latestScrim = recentScrims[0] ?? null;
  const latestPrep = params.prepRecords[0] ?? null;
  const leadCoachRecommendation = params.staffRecommendations[0] ?? null;
  const storyPulse = buildStoryPulse({
    userTeam: params.userTeam,
    opponentTeam: params.opponentTeam,
    pendingMatch: params.pendingMatch,
    userPlayers: params.userPlayers,
    opponentPlayers: params.opponentPlayers,
    budgetPressure: params.budgetPressure,
  });

  const bans = params.recommendedBans.slice(0, 3);
  const watchPoints: string[] = [];
  if (opponentReport?.weakPosition) {
    watchPoints.push(`Pressure ${opponentReport.weakPosition} side early before they stabilize.`);
  }
  if (opponentReport?.opponentWeaknesses?.weakPhase) {
    if (opponentReport.opponentWeaknesses.weakPhase === 'early') {
      watchPoints.push('Their weakest phase is early game, so contest first setup windows aggressively.');
    } else if (opponentReport.opponentWeaknesses.weakPhase === 'late') {
      watchPoints.push('Do not rush late-game flips if they tend to fall apart after 25 minutes.');
    }
  }
  if (opponentReport?.opponentPatterns?.averageGameDuration) {
    watchPoints.push(`Their games average ${opponentReport.opponentPatterns.averageGameDuration} minutes, so tempo control matters.`);
  }

  const directives = [
    leadCoachRecommendation?.headline,
    leadCoachRecommendation?.summary,
    latestPrep ? summarizePrepRecord(latestPrep) : null,
    params.budgetPressure?.pressureLevel === 'critical'
      ? 'Because board pressure is high, prioritise clean fundamentals over expensive improvisation.'
      : null,
  ].filter((value): value is string => Boolean(value));

  const deskHeadline = `${params.userTeam.shortName} vs ${params.opponentTeam.shortName}: patch read, draft posture, and setup discipline will decide the series.`;
  const deskSummary = [
    metaSnapshot.summary,
    latestScrim
      ? `Recent scrims versus ${latestScrim.opponentName} finished ${latestScrim.wins}-${latestScrim.losses} and pointed toward ${latestScrim.feedback.summary}`
      : 'Recent scrim data is light, so today will reveal whether the current prep really holds under stage pressure.',
    storyPulse.summary,
  ].join(' ');

  return {
    deskHeadline,
    deskSummary,
    patchPulse: {
      label: metaSnapshot.patchNumber ? `Patch ${metaSnapshot.patchNumber}` : 'Meta Watch',
      summary: metaSnapshot.summary,
      shifts: metaSnapshot.shifts.slice(0, 3),
    },
    scrimPulse: {
      label: latestScrim ? `Scrim read vs ${latestScrim.opponentName}` : 'Scrim read still thin',
      summary: latestScrim
        ? latestScrim.feedback.summary
        : 'Use today as a live read because recent scrim signals are not strong enough to anchor the whole plan.',
      takeaway: latestPrep
        ? summarizePrepRecord(latestPrep)
        : 'Translate practice into one or two sharp stage-ready priorities instead of carrying too many ideas at once.',
    },
    draftPulse: {
      label: 'Draft priorities',
      summary: opponentReport
        ? `Scouting confidence ${opponentReport.accuracy}. Their weak point currently reads through ${opponentReport.weakPosition ?? 'macro stability'} and the ban board should reflect that.`
        : 'Draft should lean on your comfort structure first because the scouting model is still thin.',
      bans,
      watchPoints: watchPoints.slice(0, 3),
    },
    coachPulse: {
      label: 'Coach briefing',
      summary: leadCoachRecommendation?.summary ?? 'The coaching staff want a cleaner, more disciplined game than a flashy one.',
      directives: directives.slice(0, 3),
    },
    storyPulse,
  };
}

export function buildBroadcastNarrativeBrief(params: {
  pendingMatch: Match;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  goldDiff: number;
  phase: string;
  dragonStacksHome: number;
  dragonStacksAway: number;
  nextObjective: { key: string; tick: number; zone: string } | null;
  lastMajorEventDescription: string | null;
}): BroadcastNarrativeBrief {
  const homeTeam = params.homeTeam?.shortName ?? 'HOME';
  const awayTeam = params.awayTeam?.shortName ?? 'AWAY';
  const isInternational =
    params.pendingMatch.matchType.startsWith('worlds') ||
    params.pendingMatch.matchType.startsWith('msi') ||
    params.pendingMatch.matchType.startsWith('ewc') ||
    params.pendingMatch.matchType.startsWith('fst');
  const sameRegion = params.homeTeam?.region != null && params.homeTeam.region === params.awayTeam?.region;
  const rivalry = sameRegion && Math.abs((params.homeTeam?.reputation ?? 50) - (params.awayTeam?.reputation ?? 50)) <= 12;

  const leader = params.goldDiff >= 0 ? homeTeam : awayTeam;
  const goldGap = Math.abs(Math.round(params.goldDiff / 100)) / 10;
  const phaseLabel = params.phase === 'laning' ? 'lane priority' : params.phase === 'mid_game' ? 'mid-game setup' : 'late-game nerve';
  const soulThreat =
    params.dragonStacksHome >= 3 || params.dragonStacksAway >= 3
      ? `${params.dragonStacksHome >= 3 ? homeTeam : awayTeam} are one clean setup away from soul point pressure.`
      : 'Neither side has reached a soul-point chokehold yet.';

  return {
    openingLine: isInternational
      ? `${matchTypeLabel(params.pendingMatch.matchType)} spotlight on ${homeTeam} vs ${awayTeam}: the series is being read as a regional test as much as a scoreboard.`
      : rivalry
        ? `${homeTeam} and ${awayTeam} are playing a match that feels heavier than the standings because every small edge feeds the rivalry ledger.`
        : `${homeTeam} versus ${awayTeam} is turning into a clear read on whose game plan survives stage pressure.`,
    tacticalLens: `${leader} currently control the ${phaseLabel} conversation with about ${goldGap}k in hand, so the next setup is less about mechanics and more about who dictates the map first.`,
    objectiveCall: params.nextObjective
      ? `${params.nextObjective.key.toUpperCase()} at ${params.nextObjective.tick}:00 near ${params.nextObjective.zone}. ${soulThreat}`
      : `Neutral control is briefly quiet, so both teams are really fighting for wave states and vision tempo. ${soulThreat}`,
    castingLine: params.lastMajorEventDescription
      ? `That last sequence matters because ${params.lastMajorEventDescription.toLowerCase()} and it now bends the whole map around the next objective window.`
      : 'The cast should keep the focus on setup quality here, because the next mistake will probably decide the map state.',
    storyTag: isInternational
      ? 'Cross-region read'
      : rivalry
        ? 'Rivalry pressure'
        : 'Stage identity check',
  };
}
