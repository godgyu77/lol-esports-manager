import { getDatabase } from '../../db/database';
import { getPlayerRelations, getPlayersByTeamId } from '../../db/queries';
import { getBoardExpectations } from '../board/boardEngine';
import { getManagerCareer, getCareerSummary } from './managerCareerEngine';
import { getStaffFitSummary } from '../staff/staffEngine';
import { createOngoingConsequence } from './systemDepthEngine';
import type {
  CareerArcEvent,
  CareerArcStage,
  CareerArcType,
  InternationalExpectationSnapshot,
  RelationshipInfluenceSnapshot,
  TeamHistoryLedger,
  TeamHistoryLedgerType,
} from '../../types/systemDepth';

function toJson(value: string[]): string {
  return JSON.stringify(value);
}

function fromJson(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addGameDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return formatUtcDate(next);
}

function mapCareerArcRow(row: {
  id: number;
  save_id: number;
  team_id: string;
  season_id: number;
  arc_type: CareerArcType;
  stage: CareerArcStage;
  started_at: string;
  resolved_at: string | null;
  headline: string;
  summary: string;
  consequences_json: string;
}): CareerArcEvent {
  return {
    id: row.id,
    saveId: row.save_id,
    teamId: row.team_id,
    seasonId: row.season_id,
    arcType: row.arc_type,
    stage: row.stage,
    startedAt: row.started_at,
    resolvedAt: row.resolved_at,
    headline: row.headline,
    summary: row.summary,
    consequences: fromJson(row.consequences_json),
  };
}

function mapLedgerRow(row: {
  id: number;
  team_id: string;
  season_id: number;
  ledger_type: TeamHistoryLedgerType;
  subject_id: string | null;
  subject_name: string;
  opponent_team_id: string | null;
  stat_value: number;
  secondary_value: number;
  note: string | null;
  extra_json: string;
  updated_at: string;
}): TeamHistoryLedger {
  return {
    id: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    ledgerType: row.ledger_type,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    opponentTeamId: row.opponent_team_id,
    statValue: row.stat_value,
    secondaryValue: row.secondary_value,
    note: row.note,
    extra: fromJson(row.extra_json),
    updatedAt: row.updated_at,
  };
}

async function getTeamContext(teamId: string): Promise<{
  name: string;
  region: string;
  reputation: number;
  playStyle: string | null;
} | null> {
  const db = await getDatabase();
  const rows = await db.select<Array<{ name: string; region: string; reputation: number; play_style: string | null }>>(
    'SELECT name, region, reputation, play_style FROM teams WHERE id = $1 LIMIT 1',
    [teamId],
  );
  if (!rows[0]) return null;
  return {
    name: rows[0].name,
    region: rows[0].region,
    reputation: rows[0].reputation,
    playStyle: rows[0].play_style,
  };
}

async function hasCareerArcEvent(
  saveId: number,
  teamId: string,
  seasonId: number,
  arcType: CareerArcType,
  stage: CareerArcStage,
): Promise<boolean> {
  const db = await getDatabase();
  const rows = await db.select<Array<{ id: number }>>(
    `SELECT id
     FROM career_arc_events
     WHERE save_id = $1
       AND team_id = $2
       AND season_id = $3
       AND arc_type = $4
       AND stage = $5
     LIMIT 1`,
    [saveId, teamId, seasonId, arcType, stage],
  );
  return rows.length > 0;
}

export async function recordCareerArcEvent(params: {
  saveId: number;
  teamId: string;
  seasonId: number;
  arcType: CareerArcType;
  stage: CareerArcStage;
  startedAt: string;
  headline: string;
  summary: string;
  consequences: string[];
  resolvedAt?: string | null;
}): Promise<CareerArcEvent | null> {
  if (await hasCareerArcEvent(params.saveId, params.teamId, params.seasonId, params.arcType, params.stage)) {
    return null;
  }

  const db = await getDatabase();
  const result = await db.execute(
    `INSERT INTO career_arc_events (
      save_id, team_id, season_id, arc_type, stage, started_at, resolved_at, headline, summary, consequences_json
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      params.saveId,
      params.teamId,
      params.seasonId,
      params.arcType,
      params.stage,
      params.startedAt,
      params.resolvedAt ?? null,
      params.headline,
      params.summary,
      toJson(params.consequences),
    ],
  );

  const rows = await db.select<
    Array<{
      id: number;
      save_id: number;
      team_id: string;
      season_id: number;
      arc_type: CareerArcType;
      stage: CareerArcStage;
      started_at: string;
      resolved_at: string | null;
      headline: string;
      summary: string;
      consequences_json: string;
    }>
  >(
    'SELECT * FROM career_arc_events WHERE id = $1 LIMIT 1',
    [result.lastInsertId ?? 0],
  );

  return rows[0] ? mapCareerArcRow(rows[0]) : null;
}

export async function getCareerArcEvents(
  saveId: number,
  teamId?: string,
  limit = 8,
): Promise<CareerArcEvent[]> {
  const db = await getDatabase();
  const rows = await db.select<
    Array<{
      id: number;
      save_id: number;
      team_id: string;
      season_id: number;
      arc_type: CareerArcType;
      stage: CareerArcStage;
      started_at: string;
      resolved_at: string | null;
      headline: string;
      summary: string;
      consequences_json: string;
    }>
  >(
    `SELECT *
     FROM career_arc_events
     WHERE save_id = $1
       AND ($2 IS NULL OR team_id = $2)
     ORDER BY started_at DESC, id DESC
     LIMIT $3`,
    [saveId, teamId ?? null, limit],
  );
  return rows.map(mapCareerArcRow);
}

async function upsertTeamHistoryLedger(params: {
  teamId: string;
  seasonId: number;
  ledgerType: TeamHistoryLedgerType;
  subjectId?: string | null;
  subjectName: string;
  opponentTeamId?: string | null;
  statValue?: number;
  secondaryValue?: number;
  note?: string | null;
  extra?: string[];
  updatedAt: string;
}): Promise<void> {
  const db = await getDatabase();
  const existing = await db.select<Array<{ id: number; stat_value: number; secondary_value: number; extra_json: string }>>(
    `SELECT id, stat_value, secondary_value, extra_json
     FROM team_history_ledger
     WHERE team_id = $1
       AND season_id = $2
       AND ledger_type = $3
       AND subject_name = $4
       AND (($5 IS NULL AND opponent_team_id IS NULL) OR opponent_team_id = $5)
     LIMIT 1`,
    [params.teamId, params.seasonId, params.ledgerType, params.subjectName, params.opponentTeamId ?? null],
  );

  const nextExtra = params.extra ?? [];
  if (existing[0]) {
    const mergedExtra = Array.from(new Set([...fromJson(existing[0].extra_json), ...nextExtra]));
    const nextStatValue = params.ledgerType === 'rivalry_record'
      ? existing[0].stat_value + (params.statValue ?? 0)
      : (params.statValue ?? existing[0].stat_value);
    const nextSecondaryValue = params.ledgerType === 'rivalry_record'
      ? existing[0].secondary_value + (params.secondaryValue ?? 0)
      : (params.secondaryValue ?? existing[0].secondary_value);
    await db.execute(
      `UPDATE team_history_ledger
       SET subject_id = $2,
           stat_value = $3,
           secondary_value = $4,
           note = $5,
           extra_json = $6,
           updated_at = $7
       WHERE id = $1`,
      [
        existing[0].id,
        params.subjectId ?? null,
        nextStatValue,
        nextSecondaryValue,
        params.note ?? null,
        toJson(mergedExtra),
        params.updatedAt,
      ],
    );
    return;
  }

  await db.execute(
    `INSERT INTO team_history_ledger (
      team_id, season_id, ledger_type, subject_id, subject_name, opponent_team_id,
      stat_value, secondary_value, note, extra_json, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      params.teamId,
      params.seasonId,
      params.ledgerType,
      params.subjectId ?? null,
      params.subjectName,
      params.opponentTeamId ?? null,
      params.statValue ?? 0,
      params.secondaryValue ?? 0,
      params.note ?? null,
      toJson(nextExtra),
      params.updatedAt,
    ],
  );
}

export async function getTeamHistoryLedger(
  teamId: string,
  seasonId?: number,
  limit = 24,
): Promise<TeamHistoryLedger[]> {
  const db = await getDatabase();
  const rows = await db.select<
    Array<{
      id: number;
      team_id: string;
      season_id: number;
      ledger_type: TeamHistoryLedgerType;
      subject_id: string | null;
      subject_name: string;
      opponent_team_id: string | null;
      stat_value: number;
      secondary_value: number;
      note: string | null;
      extra_json: string;
      updated_at: string;
    }>
  >(
    `SELECT *
     FROM team_history_ledger
     WHERE team_id = $1
       AND ($2 IS NULL OR season_id = $2)
     ORDER BY updated_at DESC, id DESC
     LIMIT $3`,
    [teamId, seasonId ?? null, limit],
  );
  return rows.map(mapLedgerRow);
}

export async function getRelationshipInfluenceSnapshot(
  teamId: string,
  saveId?: number,
): Promise<RelationshipInfluenceSnapshot> {
  const roster = await getPlayersByTeamId(teamId);
  const relationRows = await Promise.all(roster.map((player) => getPlayerRelations(player.id).catch(() => [])));
  const pairMap = new Map<string, { leftName: string; rightName: string; score: number; ageGap: number }>();

  relationRows.forEach((rows, sourceIndex) => {
    const source = roster[sourceIndex];
    rows.forEach((relation) => {
      const target = roster.find((player) => player.id === relation.targetPlayerId);
      if (!target) return;
      const key = [source.id, target.id].sort().join('::');
      const existing = pairMap.get(key);
      const nextScore = existing ? Math.round((existing.score + relation.affinity) / 2) : relation.affinity;
      pairMap.set(key, {
        leftName: source.name < target.name ? source.name : target.name,
        rightName: source.name < target.name ? target.name : source.name,
        score: nextScore,
        ageGap: Math.abs(source.age - target.age),
      });
    });
  });

  const pairs = Array.from(pairMap.values());
  const strongPairs = pairs
    .filter((pair) => pair.score >= 70)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((pair) => ({ names: [pair.leftName, pair.rightName] as [string, string], score: pair.score, tag: 'duo' as const }));
  const riskPairs = pairs
    .filter((pair) => pair.score <= 42)
    .sort((left, right) => left.score - right.score)
    .slice(0, 3)
    .map((pair) => ({ names: [pair.leftName, pair.rightName] as [string, string], score: pair.score, tag: 'rift' as const }));
  const mentorLinks = pairs
    .filter((pair) => pair.score >= 60 && pair.ageGap >= 4)
    .sort((left, right) => right.score - left.score)
    .slice(0, 2)
    .map((pair) => ({ names: [pair.leftName, pair.rightName] as [string, string], score: pair.score, tag: 'mentor' as const }));

  const fitSummary = await getStaffFitSummary(teamId, saveId).catch(() => []);
  const staffTrust = fitSummary.length > 0
    ? Math.round(fitSummary.reduce((sum, staff) => sum + staff.fitScore, 0) / fitSummary.length)
    : 55;
  const moraleImpact = Math.round(strongPairs.length * 4 - riskPairs.length * 6 + (staffTrust - 55) * 0.2);
  const transferImpact = Math.max(0, Math.round(strongPairs.length * 6 + mentorLinks.length * 4 - riskPairs.length * 2));

  const summary =
    riskPairs[0]
      ? `${riskPairs[0].names[0]}와 ${riskPairs[0].names[1]} 조합이 현재 라커룸의 주요 리스크입니다. 그래도 ${strongPairs[0]?.names.join(' + ') ?? '핵심 축'}이 팀 균형을 어느 정도 지탱하고 있습니다.`
      : strongPairs[0]
        ? `${strongPairs[0].names[0]}와 ${strongPairs[0].names[1]} 조합이 팀 케미스트리를 이끌고 있고, 스태프 신뢰도는 약 ${staffTrust}/100 수준입니다.`
        : `관계 신호는 아직 옅지만 스태프 신뢰도는 약 ${staffTrust}/100 수준입니다.`;

  return {
    teamId,
    strongPairs,
    riskPairs,
    mentorLinks,
    staffTrust,
    moraleImpact,
    transferImpact,
    summary,
  };
}

function getStyleClash(region: string, playStyle: string | null): string {
  const styleLabel =
    playStyle === 'aggressive'
      ? '초반 템포와 교전 주도'
      : playStyle === 'defensive'
        ? '느린 준비와 후반 성장 운영'
        : playStyle === 'objective'
          ? '오브젝트 규율과 맵 교환 타이밍'
          : '균형 잡힌 준비와 중반 운영';

  if (region === 'LPL') return `이 리그는 빠른 드래프트 우선순위와 큰 템포 변화를 더 강하게 요구합니다. 현재 팀 정체성은 ${styleLabel} 쪽에 가깝습니다.`;
  if (region === 'LCK') return `이 리그는 정교한 오브젝트 타이밍과 후반 집중력을 더 중시합니다. 현재 팀 정체성은 ${styleLabel} 쪽에 가깝습니다.`;
  if (region === 'LEC') return `이 리그는 유연한 드래프트와 템포 전환 대응을 더 요구합니다. 현재 팀 정체성은 ${styleLabel} 쪽에 가깝습니다.`;
  return `이 리그는 라인 압박과 과감한 리셋 타이밍을 더 요구합니다. 현재 팀 정체성은 ${styleLabel} 쪽에 가깝습니다.`;
}

export async function getInternationalExpectationSnapshot(
  teamId: string,
  seasonId: number,
  matchType?: string | null,
  saveId?: number,
): Promise<InternationalExpectationSnapshot> {
  const [team, board, summary, arcs] = await Promise.all([
    getTeamContext(teamId),
    getBoardExpectations(teamId, seasonId).catch(() => null),
    saveId != null ? getCareerSummary(saveId).catch(() => null) : Promise.resolve(null),
    saveId != null ? getCareerArcEvents(saveId, teamId, 4).catch(() => []) : Promise.resolve([]),
  ]);

  const internationalStage = Boolean(
    matchType?.startsWith('worlds') ||
    matchType?.startsWith('msi') ||
    matchType?.startsWith('ewc') ||
    matchType?.startsWith('fst'),
  );
  const boardWantsInternational = board?.targetInternational ?? false;
  const reputation = team?.reputation ?? 50;
  const recentDynasty = arcs.some((arc) => arc.arcType === 'dynasty');
  const recentCollapse = arcs.some((arc) => arc.arcType === 'collapse');

  let level: InternationalExpectationSnapshot['level'] = 'baseline';
  if (boardWantsInternational && reputation >= 78) level = 'contender';
  if (boardWantsInternational && (reputation >= 86 || recentDynasty)) level = 'must_deliver';
  if (recentCollapse && level === 'must_deliver') level = 'contender';

  const label = internationalStage ? '국제 무대 기대 점검' : '지역 기대 압박 점검';
  const summaryLine =
    level === 'must_deliver'
      ? '이 구단은 이제 국내 우위만으로는 충분하지 않고, 국제 무대 깊은 진출까지 요구받는 단계입니다.'
      : level === 'contender'
        ? '국내 성과가 쌓이면서 이제는 국제전 기대와 외부 시선도 함께 따라붙고 있습니다.'
        : '국제전 압박이 서서히 형성되고 있지만, 아직 시즌 전체를 좌우할 단계는 아닙니다.';
  const boardPressureNote =
    boardWantsInternational
      ? '보드진은 이미 국제 무대 성과를 신뢰 기준으로 보기 시작했습니다.'
      : '보드진이 아직 국제전 성과를 강하게 요구하는 단계는 아니지만, 국내 성과가 쌓이면 기준도 함께 높아집니다.';
  const legacyImpact =
    summary && summary.totalTrophies >= 3
      ? '이제 국제전 결과 하나하나가 왕조 유지인지 하락세 시작인지 평가받는 단계로 이어집니다.'
      : '첫 본격적인 국제전 성과만으로도 구단 서사를 새롭게 바꿀 수 있습니다.';

  return {
    teamId,
    seasonId,
    label,
    level,
    summary: summaryLine,
    styleClash: getStyleClash(team?.region ?? 'LCK', team?.playStyle ?? null),
    boardPressureNote,
    legacyImpact,
    tags: [
      internationalStage ? 'international' : 'league',
      level === 'must_deliver' ? 'pressure' : 'legacy',
      recentCollapse ? 'rebuild' : 'rivalry',
    ],
  };
}

async function generateCareerArcChainNews(event: CareerArcEvent): Promise<void> {
  const { generateCareerArcNews } = await import('../news/newsEngine');
  await generateCareerArcNews({
    seasonId: event.seasonId,
    date: event.startedAt,
    teamId: event.teamId,
    headline: event.headline,
    summary: event.summary,
    consequences: event.consequences,
    stage: event.stage,
    arcType: event.arcType,
  }).catch(() => undefined);
}

function buildArcHeadline(teamName: string, arcType: CareerArcType): string {
  switch (arcType) {
    case 'dynasty':
      return `${teamName} is starting to look like a dynasty`;
    case 'collapse':
      return `${teamName} is sliding into a visible collapse`;
    case 'rebuild':
      return `${teamName} is showing signs of a real rebuild`;
    case 'legend_retirement':
      return `${teamName} is entering a legend retirement chapter`;
    case 'icon_transition':
      return `${teamName} is living through a franchise icon transition`;
    default:
      return `${teamName} franchise arc updated`;
  }
}

async function recordFranchiseLineage(teamId: string, seasonId: number, updatedAt: string): Promise<void> {
  const roster = await getPlayersByTeamId(teamId);
  const sortedBySalary = [...roster].sort((left, right) => right.contract.salary - left.contract.salary);
  const franchiseIcon = sortedBySalary[0];
  if (franchiseIcon) {
    await upsertTeamHistoryLedger({
      teamId,
      seasonId,
      ledgerType: 'franchise_icon',
      subjectId: franchiseIcon.id,
      subjectName: franchiseIcon.name,
      statValue: franchiseIcon.contract.salary,
      note: `Current franchise face at ${franchiseIcon.contract.salary.toLocaleString()} salary.`,
      extra: [franchiseIcon.position],
      updatedAt,
    });
  }

  const eraCore = sortedBySalary.slice(0, 3);
  for (const player of eraCore) {
    await upsertTeamHistoryLedger({
      teamId,
      seasonId,
      ledgerType: 'era_core',
      subjectId: player.id,
      subjectName: player.name,
      statValue: player.contract.salary,
      note: 'One of the current core pillars for this era.',
      extra: [player.position, `${player.age}`],
      updatedAt,
    });
  }
}

async function recordRetiredLegends(teamId: string, seasonId: number, updatedAt: string): Promise<void> {
  const db = await getDatabase();
  const rows = await db.select<Array<{ player_id: string; player_name: string; total_games: number; is_hall_of_fame: number }>>(
    `SELECT player_id, player_name, total_games, is_hall_of_fame
     FROM retirement_hall
     WHERE team_id = $1
     ORDER BY retired_date DESC
     LIMIT 5`,
    [teamId],
  ).catch(() => []);

  for (const row of rows) {
    await upsertTeamHistoryLedger({
      teamId,
      seasonId,
      ledgerType: 'retired_legend',
      subjectId: row.player_id,
      subjectName: row.player_name,
      statValue: row.total_games,
      note: row.is_hall_of_fame ? 'Retired as a hall of fame level figure.' : 'Retired after shaping a prior era.',
      updatedAt,
    });
  }
}

async function recordRivalDefectors(teamId: string, seasonId: number, updatedAt: string): Promise<void> {
  const db = await getDatabase();
  const rows = await db.select<Array<{ player_id: string; name: string; from_team_id: string | null; to_team_id: string | null }>>(
    `SELECT DISTINCT t.player_id, p.name, t.from_team_id, t.to_team_id
     FROM transfer_offers t
     JOIN players p ON p.id = t.player_id
     WHERE t.status = 'accepted'
       AND (t.from_team_id = $1 OR t.to_team_id = $1)
       AND t.from_team_id IS NOT NULL
       AND t.to_team_id IS NOT NULL
     ORDER BY t.id DESC
     LIMIT 6`,
    [teamId],
  ).catch(() => []);

  for (const row of rows) {
    const opponentTeamId = row.from_team_id === teamId ? row.to_team_id : row.from_team_id;
    if (!opponentTeamId) continue;
    await upsertTeamHistoryLedger({
      teamId,
      seasonId,
      ledgerType: 'rival_defector',
      subjectId: row.player_id,
      subjectName: row.name,
      opponentTeamId,
      note: 'Transfer route that fans are likely to remember in rivalry framing.',
      updatedAt,
    });
  }
}

export async function recordMatchNarrativeHooks(params: {
  seasonId: number;
  currentDate: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  matchType?: string | null;
  saveId?: number;
  userTeamId?: string;
}): Promise<void> {
  const db = await getDatabase();
  const [homeTeam, awayTeam] = await Promise.all([
    getTeamContext(params.homeTeamId),
    getTeamContext(params.awayTeamId),
  ]);
  if (!homeTeam || !awayTeam) return;

  const homeWon = params.homeScore > params.awayScore;
  const rivalryRows = await db.select<Array<{ team_a_id: string; team_b_id: string }>>(
    `SELECT team_a_id, team_b_id
     FROM rivalries
     WHERE (team_a_id = $1 AND team_b_id = $2) OR (team_a_id = $2 AND team_b_id = $1)
     LIMIT 1`,
    [params.homeTeamId, params.awayTeamId],
  ).catch(() => []);
  const rivalryActive = rivalryRows.length > 0;

  await upsertTeamHistoryLedger({
    teamId: params.homeTeamId,
    seasonId: params.seasonId,
    ledgerType: 'rivalry_record',
    subjectName: awayTeam.name,
    opponentTeamId: params.awayTeamId,
    statValue: homeWon ? 1 : 0,
    secondaryValue: homeWon ? 0 : 1,
    note: rivalryActive
      ? `Regional rivalry series updated. Latest meeting: ${params.homeScore}-${params.awayScore}.`
      : `Head-to-head series updated. Latest meeting: ${params.homeScore}-${params.awayScore}.`,
    extra: rivalryActive ? ['rivalry'] : ['league'],
    updatedAt: params.currentDate,
  });

  await upsertTeamHistoryLedger({
    teamId: params.awayTeamId,
    seasonId: params.seasonId,
    ledgerType: 'rivalry_record',
    subjectName: homeTeam.name,
    opponentTeamId: params.homeTeamId,
    statValue: homeWon ? 0 : 1,
    secondaryValue: homeWon ? 1 : 0,
    note: rivalryActive
      ? `Regional rivalry series updated. Latest meeting: ${params.awayScore}-${params.homeScore}.`
      : `Head-to-head series updated. Latest meeting: ${params.awayScore}-${params.homeScore}.`,
    extra: rivalryActive ? ['rivalry'] : ['league'],
    updatedAt: params.currentDate,
  });

  await Promise.all([
    recordFranchiseLineage(params.homeTeamId, params.seasonId, params.currentDate),
    recordFranchiseLineage(params.awayTeamId, params.seasonId, params.currentDate),
    recordRetiredLegends(params.homeTeamId, params.seasonId, params.currentDate),
    recordRetiredLegends(params.awayTeamId, params.seasonId, params.currentDate),
    recordRivalDefectors(params.homeTeamId, params.seasonId, params.currentDate),
    recordRivalDefectors(params.awayTeamId, params.seasonId, params.currentDate),
  ]);

  const internationalStage = Boolean(
    params.matchType?.startsWith('worlds') ||
    params.matchType?.startsWith('msi') ||
    params.matchType?.startsWith('ewc') ||
    params.matchType?.startsWith('fst'),
  );

  if (internationalStage && params.saveId != null && params.userTeamId && (params.homeTeamId === params.userTeamId || params.awayTeamId === params.userTeamId)) {
    const snapshot = await getInternationalExpectationSnapshot(params.userTeamId, params.seasonId, params.matchType, params.saveId).catch(() => null);
    if (snapshot) {
      const { generateInternationalPulseNews } = await import('../news/newsEngine');
      await generateInternationalPulseNews({
        seasonId: params.seasonId,
        date: params.currentDate,
        teamId: params.userTeamId,
        title: snapshot.label,
        summary: snapshot.summary,
        styleClash: snapshot.styleClash,
        boardPressureNote: snapshot.boardPressureNote,
      }).catch(() => undefined);
    }
  }

  if (params.saveId != null && params.userTeamId) {
    await evaluateCareerArcProgress(params.saveId, params.userTeamId, params.seasonId, params.currentDate);
  }
}

export async function evaluateCareerArcProgress(
  saveId: number,
  teamId: string,
  seasonId: number,
  currentDate: string,
): Promise<CareerArcEvent[]> {
  const [summary, career, board, team, ledger] = await Promise.all([
    getCareerSummary(saveId).catch(() => null),
    getManagerCareer(saveId).catch(() => []),
    getBoardExpectations(teamId, seasonId).catch(() => null),
    getTeamContext(teamId),
    getTeamHistoryLedger(teamId, seasonId, 24),
  ]);

  if (!team || !summary) return [];

  const created: CareerArcEvent[] = [];
  const recentCareer = career.filter((entry) => entry.teamId === teamId).slice(-3);
  const recentTitles = recentCareer.reduce((sum, entry) => sum + entry.trophies.length, 0);
  const recentStandings = recentCareer.map((entry) => entry.standing).filter((standing) => standing > 0);
  const improving = recentStandings.length >= 2 && recentStandings[recentStandings.length - 1] < recentStandings[0];
  const franchiseIcon = ledger.find((entry) => entry.ledgerType === 'franchise_icon');
  const retiredLegend = ledger.find((entry) => entry.ledgerType === 'retired_legend');

  const maybeCreate = async (
    arcType: CareerArcType,
    stage: CareerArcStage,
    summaryLine: string,
    consequences: string[],
  ) => {
    const event = await recordCareerArcEvent({
      saveId,
      teamId,
      seasonId,
      arcType,
      stage,
      startedAt: currentDate,
      headline: buildArcHeadline(team.name, arcType),
      summary: summaryLine,
      consequences,
    });
    if (!event) return;
    created.push(event);
    await generateCareerArcChainNews(event).catch(() => undefined);
  };

  if (recentTitles >= 2 || summary.totalTrophies >= 3) {
    await maybeCreate(
      'dynasty',
      'active',
      `${team.name} is no longer chasing relevance. The room is now defending a standard that looks like a dynasty chapter.`,
      ['legacy pressure rising', 'board expectation raised', 'international scrutiny up'],
    );
  }

  if ((board?.satisfaction ?? 60) <= 32 && recentStandings.length > 0 && recentStandings[recentStandings.length - 1] >= 5 && summary.totalTrophies > 0) {
    await maybeCreate(
      'collapse',
      'active',
      `${team.name} still has the memory of past highs, but results and board patience are sliding hard enough to frame this as a collapse arc.`,
      ['morale under strain', 'board pressure increasing', 'legacy at risk'],
    );
    await createOngoingConsequence({
      teamId,
      seasonId,
      consequenceType: 'media',
      source: 'career_arc',
      title: 'Collapse narrative',
      summary: 'The outside framing has shifted from temporary slump to genuine decline pressure.',
      severity: 'medium',
      startedDate: currentDate,
      expiresDate: addGameDays(currentDate, 12),
      statKey: 'legacy_pressure',
      statDelta: 4,
    }).catch(() => undefined);
  }

  if (improving && summary.totalTrophies === 0) {
    await maybeCreate(
      'rebuild',
      'emerging',
      `${team.name} is starting to look like a real rebuild instead of a holding pattern. The next split can turn that into a franchise story.`,
      ['young core rising', 'board patience can recover', 'identity stabilizing'],
    );
  }

  if (retiredLegend) {
    await maybeCreate(
      'legend_retirement',
      'active',
      `${retiredLegend.subjectName} leaving the stage changes how ${team.name} is remembered and who now carries the badge of the club.`,
      ['room leadership changing', 'legacy comparison rising'],
    );
  }

  if (franchiseIcon) {
    const iconTransitionAlready = await hasCareerArcEvent(saveId, teamId, seasonId, 'icon_transition', 'active');
    if (!iconTransitionAlready && summary.totalSeasons >= 2) {
      await maybeCreate(
        'icon_transition',
        'emerging',
        `${franchiseIcon.subjectName} is becoming the new face of ${team.name}, and that changes how the next era will be read.`,
        ['franchise icon changing', 'new core taking ownership'],
      );
    }
  }

  return created;
}
