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

  let identity = '리그 기반형 감독';
  if (dynastyPath) identity = '왕조를 설계하는 감독';
  else if (multiTeamCareer && summary.totalTrophies > 0) identity = '여러 팀을 거친 우승 경험자';
  else if (stabilizerPath) identity = '안정형 운영가';
  else if (survivorPath) identity = '재건을 넘어선 감독';

  const outlookParts = [
    `${summary.totalSeasons}시즌`,
    `${summary.totalWins}승 ${summary.totalLosses}패`,
    `우승 ${summary.totalTrophies}회`,
  ];

  if (peakSeason) {
    outlookParts.push(`최고 시즌: ${peakSeason.year} ${peakSeason.split} (${peakSeason.teamName})`);
  }

  const pillars = [
    `최장 재임: ${summary.longestTenure.teamName} (${summary.longestTenure.seasons}시즌)`,
    summary.playoffAppearances > 0
      ? `플레이오프 경험 ${summary.playoffAppearances}회`
      : '아직 안정적인 플레이오프 진출 기반을 만들지 못했습니다',
    multiTeamCareer
      ? '다양한 팀에서 쌓은 경력으로 커리어가 풍부해졌습니다'
      : '한 팀에서 오래 이어온 커리어는 재건, 우승 도전, 리셋 중 어느 방향으로든 전개될 수 있습니다',
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

  let identity = `${team.region} 지역 강자, 자체 시대를 만들어갈 여지 있음`;
  if (consecutiveTitles >= 2) identity = `${team.region} 왕조 건설 중`;
  else if (totalTitles >= 2) identity = `${team.region} 우승의 기준점`;
  else if (podiumFinishes >= 3) identity = `${team.region} 플레이오프 단골 강팀`;

  let internationalPosture = '국내 성장 단계. 국제 무대 기대치는 아직 형성 중입니다.';
  if (team.reputation >= 80 || totalTitles >= 3) {
    internationalPosture = '이제는 국제 무대 압박이 현실입니다. 깊은 대회 진출 없이는 기대에 못 미쳤다는 평가를 받을 수 있습니다.';
  } else if (team.reputation >= 70 || podiumFinishes >= 2) {
    internationalPosture = '타 지역의 인정을 받기 시작했습니다. 국내 강세를 바탕으로 국제 무대 신뢰도를 쌓을 수 있습니다.';
  }

  let timelineHook = '새로운 코어가 팀의 정체성을 만들어갈 기회가 있습니다.';
  if (youthCount >= 3 && veteranCount >= 2) {
    timelineHook = '세대 교체가 진행 중입니다. 베테랑이 중심을 잡고 있는 사이 차세대 코어가 출전 기회를 노리고 있습니다.';
  } else if (veteranCount >= 3) {
    timelineHook = '경험 중심의 로스터입니다. 다음 세대 교체 결정이 향후 3시즌을 결정할 것입니다.';
  } else if (youthCount >= 3) {
    timelineHook = '젊은 선수 중심의 구단입니다. 육성 방향이 단기 결과만큼 중요한 시기입니다.';
  }

  const legendLead = legends[0];
  const replayHooks = [
    legendLead
      ? `${legendLead.name}이(가) ${legendLead.totalGames}경기를 소화하며 구단 역사의 기준점으로 남아 있습니다`
      : '아직 확고한 구단 레전드가 없습니다. 이번 커리어가 첫 번째 시대를 기록할 수 있습니다',
    totalTitles > 0
      ? `역대 우승 ${totalTitles}회. 이것이 왕조로 이어질지, 추억 속 한 시절로 남을지가 관건입니다`
      : '아직 우승 기록이 없습니다. 매 시즌 결과에 따라 구단 정체성이 빠르게 바뀝니다',
    '패치 변화, 로스터 교체, 스태프 케미스트리에 따라 같은 구단도 매번 다른 커리어가 펼쳐집니다',
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
    return '아직 스태프가 없습니다. 첫 영입부터 팀 문화를 즉각적으로 형성하게 됩니다.';
  }

  const bestFit = [...fitSummary].sort((left, right) => right.fitScore - left.fitScore)[0] ?? null;
  const lowestFit = [...fitSummary].sort((left, right) => left.fitScore - right.fitScore)[0] ?? null;
  if (!bestFit || !lowestFit) {
    return `스태프 ${staffList.length}명이 활동 중입니다. 인원 수보다 역할 명확성이 더 중요한 시점입니다.`;
  }

  if (lowestFit.fitScore <= 45) {
    return `${bestFit.name}이(가) 스태프룸을 이끌고 있지만, ${lowestFit.name}이(가) 핏 ${lowestFit.fitScore}/100으로 마찰 요소로 남아 있습니다.`;
  }

  return `${bestFit.name}이(가) 분위기를 주도하고 있으며, 현재 스태프룸은 장기 커리어를 지탱하기에 충분히 안정적입니다.`;
}

export async function buildRelationshipNetworkReport(args: {
  roster: Player[];
  staffList: Staff[];
  fitSummary: StaffFitSummary[];
}): Promise<RelationshipNetworkReport> {
  const { roster, staffList, fitSummary } = args;
  if (roster.length < 2) {
    return {
      headline: '아직 관계 지도가 충분히 형성되지 않았습니다',
      summary: '케미스트리가 장기 레버로 작동하려면 더 많은 로스터 데이터가 필요합니다.',
      strongLink: '아직 안정적인 파트너 관계 없음',
      riskLink: '아직 뚜렷한 갈등 요소 없음',
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

  let headline = '팀 분위기는 균형을 유지하고 있습니다';
  if (averageAffinity >= 68) headline = '현 로스터를 중심으로 팀의 핵심이 자리잡고 있습니다';
  else if (averageAffinity <= 42) headline = '팀 분위기가 아직 불안정합니다';

  const summary = `관계 추적 ${pairs.length}건 · 평균 친밀도 ${averageAffinity}/100 · 21세 이하 ${roster.filter((player) => player.age <= 21).length}명`;

  return {
    headline,
    summary,
    strongLink: bestPair
      ? `${bestPair.left} + ${bestPair.right}, 친밀도 ${bestPair.affinity}/100으로 팀 내 가장 강한 파트너`
      : '아직 두드러지는 파트너 관계 없음',
    riskLink: riskPair
      ? `${riskPair.left} + ${riskPair.right}, 친밀도 ${riskPair.affinity}/100으로 주요 관찰 대상`
      : '아직 뚜렷한 갈등 요소 없음',
    staffPulse: describeStaffPulse(staffList, fitSummary),
  };
}
