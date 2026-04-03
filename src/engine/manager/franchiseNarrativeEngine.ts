import { getPlayerRelations, type PlayerRelation } from '../../db/queries';
import type { Team } from '../../types/team';
import type { Player } from '../../types/player';
import type { Staff } from '../../types/staff';
import type { StaffFitSummary } from '../../types/systemDepth';
import type { CareerSummary, ManagerCareerRecord } from './managerCareerEngine';

export interface CareerNarrativeReport {
  identity: string;
  outlook: string;
  pillars: string[];
}

export interface TeamLegacyReport {
  identity: string;
  internationalPosture: string;
  timelineHook: string;
  replayHooks: string[];
}

export interface RelationshipNetworkReport {
  headline: string;
  summary: string;
  strongLink: string;
  riskLink: string;
  staffPulse: string;
}

function getLatestPeakSeason(career: ManagerCareerRecord[]): ManagerCareerRecord | null {
  if (career.length === 0) return null;
  return [...career].sort((left, right) => {
    const trophyDelta = right.trophies.length - left.trophies.length;
    if (trophyDelta !== 0) return trophyDelta;
    const leftRate = left.wins + left.losses > 0 ? left.wins / (left.wins + left.losses) : 0;
    const rightRate = right.wins + right.losses > 0 ? right.wins / (right.wins + right.losses) : 0;
    return rightRate - leftRate;
  })[0] ?? null;
}

export function buildCareerNarrativeReport(
  summary: CareerSummary | null,
  career: ManagerCareerRecord[],
): CareerNarrativeReport | null {
  if (!summary) return null;

  const peakSeason = getLatestPeakSeason(career);
  const multiTeamCareer = summary.teamsManaged.length >= 3;
  const dynastyPath = summary.totalTrophies >= 3;
  const stabilizerPath = summary.winRate >= 55 && summary.totalTrophies === 0;
  const survivorPath = summary.firingCount > 0 && summary.totalTrophies === 0;

  let identity = 'Steady league builder';
  if (dynastyPath) identity = 'Dynasty architect';
  else if (multiTeamCareer && summary.totalTrophies > 0) identity = 'Circuit-tested winner';
  else if (stabilizerPath) identity = 'High-floor operator';
  else if (survivorPath) identity = 'Rebuild survivor';

  const outlookParts = [
    `${summary.totalSeasons} seasons`,
    `${summary.totalWins}-${summary.totalLosses}`,
    `${summary.totalTrophies} trophies`,
  ];

  if (peakSeason) {
    outlookParts.push(`peak at ${peakSeason.year} ${peakSeason.split} with ${peakSeason.teamName}`);
  }

  const pillars = [
    `Longest chapter: ${summary.longestTenure.teamName} (${summary.longestTenure.seasons} seasons)`,
    summary.playoffAppearances > 0
      ? `Playoff habit formed in ${summary.playoffAppearances} splits`
      : 'Still searching for a repeatable playoff standard',
    multiTeamCareer
      ? 'Career variety is high enough to keep future saves from feeling samey'
      : 'A long single-club arc can still branch into rebuild, title push, or clean reset',
  ];

  return {
    identity,
    outlook: outlookParts.join(' · '),
    pillars,
  };
}

export function buildTeamLegacyReport(args: {
  team: Team;
  history: Array<{ seasonId: number; champion: boolean; finalStanding: number | null; wins: number; losses: number }>;
  legends: Array<{ name: string; totalGames: number; totalKills: number }>;
}): TeamLegacyReport {
  const { team, history, legends } = args;
  const totalTitles = history.filter((record) => record.champion).length;
  const podiumFinishes = history.filter((record) => (record.finalStanding ?? 99) <= 3).length;
  const youthCount = team.roster.filter((player) => player.age <= 21).length;
  const veteranCount = team.roster.filter((player) => player.age >= 25).length;
  const consecutiveTitles = history.reduce(
    (best, record) => {
      if (!record.champion) return { current: 0, best: best.best };
      const current = best.current + 1;
      return { current, best: Math.max(best.best, current) };
    },
    { current: 0, best: 0 },
  ).best;

  let identity = `${team.region} contender with room to define its era`;
  if (consecutiveTitles >= 2) identity = `${team.region} dynasty pressure point`;
  else if (totalTitles >= 2) identity = `${team.region} title standard bearer`;
  else if (podiumFinishes >= 3) identity = `${team.region} perennial playoff gatekeeper`;

  let internationalPosture = 'Domestic growth phase. International expectations are still forming.';
  if (team.reputation >= 80 || totalTitles >= 3) {
    internationalPosture = 'International pressure is now real. Anything short of deep runs will feel like underdelivery.';
  } else if (team.reputation >= 70 || podiumFinishes >= 2) {
    internationalPosture = 'Cross-region respect is building. Strong domestic form can now translate into real international belief.';
  }

  let timelineHook = 'A fresh core can still define the club identity.';
  if (youthCount >= 3 && veteranCount >= 2) {
    timelineHook = 'A generation shift is live: veterans still anchor the room while the next core pushes for minutes.';
  } else if (veteranCount >= 3) {
    timelineHook = 'This roster is leaning on experience. The next succession call will shape the next three seasons.';
  } else if (youthCount >= 3) {
    timelineHook = 'The club is youth-heavy. Development choices will matter as much as short-term results.';
  }

  const legendLead = legends[0];
  const replayHooks = [
    legendLead
      ? `${legendLead.name} still defines the historical benchmark with ${legendLead.totalGames} games`
      : 'No untouchable club legend yet, so this save can write the first era',
    totalTitles > 0
      ? `Past titles: ${totalTitles}. The next question is whether this becomes a dynasty or a nostalgia phase`
      : 'No championship cushion yet, so every run changes the club identity fast',
    'Patch shifts, roster turnover, and staff chemistry now create different long-career arcs even with the same club',
  ];

  return {
    identity,
    internationalPosture,
    timelineHook,
    replayHooks,
  };
}

interface RelationPair {
  left: string;
  right: string;
  affinity: number;
}

function buildPairKey(leftId: string, rightId: string): string {
  return [leftId, rightId].sort().join('::');
}

function describeStaffPulse(staffList: Staff[], fitSummary: StaffFitSummary[]): string {
  if (staffList.length === 0) {
    return 'No established staff room yet. Every hire will reshape the culture immediately.';
  }

  const bestFit = [...fitSummary].sort((left, right) => right.fitScore - left.fitScore)[0] ?? null;
  const lowestFit = [...fitSummary].sort((left, right) => left.fitScore - right.fitScore)[0] ?? null;
  if (!bestFit || !lowestFit) {
    return `${staffList.length} staff members are active. Role clarity matters more than pure headcount now.`;
  }

  if (lowestFit.fitScore <= 45) {
    return `${bestFit.name} is carrying the room, but ${lowestFit.name} is still a friction point at ${lowestFit.fitScore}/100 fit.`;
  }

  return `${bestFit.name} sets the tone, and the staff room is currently stable enough to support a long arc.`;
}

export async function buildRelationshipNetworkReport(args: {
  roster: Player[];
  staffList: Staff[];
  fitSummary: StaffFitSummary[];
}): Promise<RelationshipNetworkReport> {
  const { roster, staffList, fitSummary } = args;
  if (roster.length < 2) {
    return {
      headline: 'Relationship map is still shallow',
      summary: 'A bigger roster sample is needed before chemistry becomes a real long-term lever.',
      strongLink: 'No stable duo yet',
      riskLink: 'No clear fault line yet',
      staffPulse: describeStaffPulse(staffList, fitSummary),
    };
  }

  const relationRows = await Promise.all(
    roster.map((player) => getPlayerRelations(player.id).catch((): PlayerRelation[] => [])),
  );
  const pairMap = new Map<string, RelationPair>();

  relationRows.forEach((rows, index) => {
    const source = roster[index];
    rows.forEach((relation: PlayerRelation) => {
      const target = roster.find((player) => player.id === relation.targetPlayerId);
      if (!target) return;
      const key = buildPairKey(source.id, target.id);
      const existing = pairMap.get(key);
      if (!existing) {
        pairMap.set(key, { left: source.name, right: target.name, affinity: relation.affinity });
        return;
      }
      pairMap.set(key, {
        ...existing,
        affinity: Math.round((existing.affinity + relation.affinity) / 2),
      });
    });
  });

  const pairs = Array.from(pairMap.values());
  const bestPair = [...pairs].sort((left, right) => right.affinity - left.affinity)[0] ?? null;
  const riskPair = [...pairs].sort((left, right) => left.affinity - right.affinity)[0] ?? null;
  const averageAffinity = pairs.length > 0
    ? Math.round(pairs.reduce((sum, pair) => sum + pair.affinity, 0) / pairs.length)
    : 50;

  let headline = 'Room chemistry is balanced';
  if (averageAffinity >= 68) headline = 'A real core is forming around this roster';
  else if (averageAffinity <= 42) headline = 'The room still feels fragile';

  const summary = `${pairs.length} tracked links · average affinity ${averageAffinity}/100 · ${roster.filter((player) => player.age <= 21).length} young players in the mix`;

  return {
    headline,
    summary,
    strongLink: bestPair
      ? `${bestPair.left} + ${bestPair.right} lead the room at ${bestPair.affinity}/100`
      : 'No standout duo yet',
    riskLink: riskPair
      ? `${riskPair.left} + ${riskPair.right} are the main watch item at ${riskPair.affinity}/100`
      : 'No obvious fault line yet',
    staffPulse: describeStaffPulse(staffList, fitSummary),
  };
}
