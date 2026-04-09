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
      summary: '아직 큰 패치 변동은 감지되지 않았으므로, 메타 급변보다 팀 완성도와 실행력이 더 중요합니다.',
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
    summary: `패치 ${modifierRow.patch_number} 기준으로는 ${strongestAxis[0]} 해석이 특히 중요하므로, 단순 폼 못지않게 메타 이해도가 중요합니다.`,
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
      summary: '패치 해석이 아직 굳어지지 않았으므로, 준비를 더 깔끔한 실행으로 옮기는 팀이 경기를 잡을 가능성이 큽니다.',
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
    watchPoints.push(`${opponentReport.weakPosition} 라인을 초반부터 압박해 상대가 안정되기 전에 흔들 필요가 있습니다.`);
  }
  if (opponentReport?.opponentWeaknesses?.weakPhase) {
    if (opponentReport.opponentWeaknesses.weakPhase === 'early') {
      watchPoints.push('상대의 가장 약한 구간이 초반이므로, 첫 오브젝트와 주도권 타이밍을 강하게 흔드는 편이 좋습니다.');
    } else if (opponentReport.opponentWeaknesses.weakPhase === 'late') {
      watchPoints.push('상대가 후반 25분 이후 무너지는 편이라면, 무리한 후반 승부수보다 안정적인 운영이 더 좋습니다.');
    }
  }
  if (opponentReport?.opponentPatterns?.averageGameDuration) {
    watchPoints.push(`상대 경기 평균 시간은 ${opponentReport.opponentPatterns.averageGameDuration}분이므로, 템포 조절이 중요합니다.`);
  }

  const directives = [
    leadCoachRecommendation?.headline,
    leadCoachRecommendation?.summary,
    latestPrep ? summarizePrepRecord(latestPrep) : null,
    params.budgetPressure?.pressureLevel === 'critical'
      ? '보드 압박이 큰 상황이므로, 무리한 승부수보다 기본기와 안정적인 운영을 우선해야 합니다.'
      : null,
  ].filter((value): value is string => Boolean(value));

  const deskHeadline = `${params.userTeam.shortName} vs ${params.opponentTeam.shortName}: 패치 해석, 드래프트 방향, 준비 완성도가 이번 시리즈를 가를 전망입니다.`;
  const deskSummary = [
    metaSnapshot.summary,
    latestScrim
      ? `최근 ${latestScrim.opponentName} 상대로 치른 스크림은 ${latestScrim.wins}-${latestScrim.losses}였고, ${latestScrim.feedback.summary}`
      : '최근 스크림 표본이 많지 않아서, 오늘 경기가 현재 준비가 실전 압박 아래서도 유지되는지 보여줄 가능성이 큽니다.',
    storyPulse.summary,
  ].join(' ');

  return {
    deskHeadline,
    deskSummary,
    patchPulse: {
      label: metaSnapshot.patchNumber ? `패치 ${metaSnapshot.patchNumber}` : '메타 점검',
      summary: metaSnapshot.summary,
      shifts: metaSnapshot.shifts.slice(0, 3),
    },
    scrimPulse: {
      label: latestScrim ? `${latestScrim.opponentName} 상대 스크림 요약` : '스크림 표본 부족',
      summary: latestScrim
        ? latestScrim.feedback.summary
        : '최근 스크림 신호만으로 전체 플랜을 고정하기 어려우니, 오늘 경기를 실전 점검 무대로 써야 합니다.',
      takeaway: latestPrep
        ? summarizePrepRecord(latestPrep)
        : '훈련 내용을 한 번에 많이 들고 가기보다, 실전에 바로 쓸 수 있는 한두 가지 우선순위로 압축하는 편이 좋습니다.',
    },
    draftPulse: {
      label: '드래프트 우선순위',
      summary: opponentReport
        ? `스카우팅 신뢰도는 ${opponentReport.accuracy} 수준입니다. 현재 약점은 ${opponentReport.weakPosition ?? '운영 안정감'} 쪽으로 읽히므로, 밴픽도 그 점을 반영해야 합니다.`
        : '스카우팅 표본이 아직 얕으므로, 드래프트는 우선 우리 팀이 익숙한 구조를 중심으로 가는 편이 안전합니다.',
      bans,
      watchPoints: watchPoints.slice(0, 3),
    },
    coachPulse: {
      label: '코치 브리핑',
      summary: leadCoachRecommendation?.summary ?? '코칭 스태프는 화려한 승부수보다 더 깔끔하고 규율 있는 경기 운영을 원하고 있습니다.',
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
