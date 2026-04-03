import { getDatabase } from '../../db/database';
import { getActiveSeason } from '../../db/queries';
import { getManagerIdentity } from '../manager/managerIdentityEngine';
import { getTeamRecentWinRate } from '../../db/queries/team';
import type {
  CoachingPhilosophy,
  Staff,
  StaffAcceptanceLevel,
  StaffCandidateView,
  StaffOfferDecision,
  StaffOfferEvaluation,
  StaffRole,
  StaffRoleFlexibility,
  StaffSpecialty,
} from '../../types/staff';
import type { Region } from '../../types/game';
import { pickRandom, randomInt } from '../../utils/random';
import { getPlayerManagementInsights, type PlayerManagementInsight } from '../satisfaction/playerSatisfactionEngine';
import { getActiveComplaints } from '../complaint/complaintEngine';
import type { StaffFitSummary } from '../../types/systemDepth';

interface StaffRow {
  id: number;
  team_id: string | null;
  name: string;
  role: string;
  ability: number;
  specialty: string | null;
  salary: number;
  morale: number;
  contract_end_season: number;
  hired_date: string;
  is_free_agent: number;
  philosophy: string | null;
  nationality: string | null;
  preferred_role: string | null;
  role_flexibility: string | null;
  career_origin: string | null;
}

interface TeamContextRow {
  id: string;
  name: string;
  region: Region;
  budget: number;
  salary_cap: number;
  reputation: number;
  play_style: string | null;
}

const STAFF_LIMITS: Record<StaffRole, number> = {
  head_coach: 1,
  coach: 2,
  analyst: 1,
  scout_manager: 1,
  sports_psychologist: 1,
  nutritionist: 1,
  physiotherapist: 1,
  data_analyst: 1,
};

export const TEAM_STAFF_LIMIT = 9;

const ROLE_PRIORITY: Record<StaffRole, number> = {
  head_coach: 4,
  coach: 3,
  analyst: 2,
  scout_manager: 2,
  sports_psychologist: 1,
  nutritionist: 1,
  physiotherapist: 1,
  data_analyst: 2,
};

const REGION_TO_NATIONALITY: Record<Region, string> = {
  LCK: 'KR',
  LPL: 'CN',
  LEC: 'EU',
  LCS: 'NA',
};

const DEFAULT_SECONDARY_ROLES: Partial<Record<StaffRole, StaffRole[]>> = {
  head_coach: ['coach'],
  coach: ['analyst'],
  analyst: ['coach', 'data_analyst'],
  scout_manager: ['analyst'],
  sports_psychologist: ['coach'],
  nutritionist: ['physiotherapist'],
  physiotherapist: ['nutritionist'],
  data_analyst: ['analyst'],
};

function mapRowToStaff(row: StaffRow): Staff {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    role: row.role as StaffRole,
    ability: row.ability,
    specialty: row.specialty as StaffSpecialty | null,
    salary: row.salary,
    morale: row.morale,
    contractEndSeason: row.contract_end_season,
    hiredDate: row.hired_date,
    isFreeAgent: row.is_free_agent === 1,
    philosophy: (row.philosophy as CoachingPhilosophy) ?? null,
    nationality: row.nationality ?? null,
    preferredRole: (row.preferred_role as StaffRole) ?? (row.role as StaffRole),
    roleFlexibility: (row.role_flexibility as StaffRoleFlexibility) ?? getDefaultRoleFlexibility(row.role as StaffRole),
    careerOrigin: (row.career_origin as StaffRole | null) ?? null,
  };
}

function getDefaultRoleFlexibility(role: StaffRole): StaffRoleFlexibility {
  switch (role) {
    case 'head_coach':
      return 'strict';
    case 'coach':
    case 'analyst':
    case 'data_analyst':
      return 'normal';
    default:
      return 'flexible';
  }
}

function getDefaultSecondaryRoles(role: StaffRole): StaffRole[] {
  return DEFAULT_SECONDARY_ROLES[role] ?? [];
}

function getStaffCounts(staffList: Staff[]): Record<StaffRole, number> {
  const counts: Record<StaffRole, number> = {
    head_coach: 0,
    coach: 0,
    analyst: 0,
    scout_manager: 0,
    sports_psychologist: 0,
    nutritionist: 0,
    physiotherapist: 0,
    data_analyst: 0,
  };
  for (const staff of staffList) {
    counts[staff.role] += 1;
  }
  return counts;
}

export function canHireRole(staffList: Staff[], role: StaffRole): boolean {
  const counts = getStaffCounts(staffList);
  return counts[role] < STAFF_LIMITS[role] && staffList.length < TEAM_STAFF_LIMIT;
}

const STAFF_NAMES_BY_REGION: Record<Region, Record<StaffRole, string[]>> = {
  LCK: {
    head_coach: ['kkOma', 'Ryu', 'Homme', 'cvMax', 'Score', 'Joker', 'SSONG', 'Edo'],
    coach: ['Mowgli', 'Shin', 'Lyn', 'Nova', 'Kim Minsoo', 'Lee Sungjin', 'Park Sunghyun'],
    analyst: ['Kim Jihyun', 'Lee Dongho', 'Park Jinseok', 'Choi Woojin', 'Seo Minho'],
    scout_manager: ['Han Minjae', 'Kang Donghyun', 'Seo Jihoon', 'Ryu Jaemin'],
    sports_psychologist: [],
    nutritionist: [],
    physiotherapist: [],
    data_analyst: [],
  },
  LPL: {
    head_coach: ['Daeny', 'Tabe', 'Poppy', 'Maizijian', 'Helper', 'Teacherma'],
    coach: ['Chen', 'Wang', 'Li', 'Zhang', 'Zhao', 'Zhou', 'Huang'],
    analyst: ['Liu Wei', 'Yang Hao', 'Wu Chen', 'Xu Ming', 'Gao Lei', 'Jiang Tao'],
    scout_manager: ['Zhao Feng', 'Lin Jie', 'Sun Tao', 'Ma Jun', 'He Yi'],
    sports_psychologist: [],
    nutritionist: [],
    physiotherapist: [],
    data_analyst: [],
  },
  LEC: {
    head_coach: ['Dylan Falco', 'Striker', 'Guilhoto', 'Reapered', 'Reha', 'Melzhet', 'TheRock'],
    coach: ['Peter Dun', 'Tore', 'Jesiz', 'Hiiva', 'Lucas', 'Markus', 'Nikolaj'],
    analyst: ['Thomas', 'Marcus', 'Erik', 'Luka', 'Andreas', 'Fabian'],
    scout_manager: ['Stefan', 'Francois', 'Bjorn', 'Henrik', 'Carlos'],
    sports_psychologist: [],
    nutritionist: [],
    physiotherapist: [],
    data_analyst: [],
  },
  LCS: {
    head_coach: ['Spawn', 'Thinkcard', 'Goldenglue', 'Swiffer', 'Reapered', 'Inero'],
    coach: ['MarkZ', 'David Lim', 'Pr0lly', 'Amazing', 'Bubbadub', 'Thien'],
    analyst: ['Kevin', 'Brian', 'James', 'David', 'Michael', 'Chris'],
    scout_manager: ['Jason', 'Andrew', 'Ryan', 'Daniel', 'Matt'],
    sports_psychologist: [],
    nutritionist: [],
    physiotherapist: [],
    data_analyst: [],
  },
};

const SPECIALIST_NAMES: Partial<Record<StaffRole, string[]>> = {
  sports_psychologist: ['Kim Seoyoon', 'Park Jiyoung', 'Lee Hada', 'Dr. Sarah Chen', 'Dr. Marcus Weber'],
  nutritionist: ['Jung Arin', 'Seo Soyeon', 'Lee Sujin', 'Park Hyunji', 'Rachel Choi'],
  physiotherapist: ['Kim Jihoo', 'Lee Minsoo', 'Park Sungjin', 'Choi Dongha', 'Alex Park'],
  data_analyst: ['Han Jiwon', 'Kang Minho', 'Seo Minjae', 'Cho Youngmin', 'Kevin Liu'],
};

interface StaffGenerationOptions {
  role: StaffRole;
  region: Region;
  hiredDate: string;
  contractEndSeason: number;
  forceRoleFlexibility?: StaffRoleFlexibility;
  preferredRole?: StaffRole;
  careerOrigin?: StaffRole | null;
  isFreeAgent?: boolean;
}

function generateStaffProfile(options: StaffGenerationOptions): Omit<Staff, 'id'> {
  const regionNames = STAFF_NAMES_BY_REGION[options.region] ?? STAFF_NAMES_BY_REGION.LCK;
  const names = regionNames[options.role] ?? SPECIALIST_NAMES[options.role] ?? ['Staff'];
  const abilityRange =
    options.role === 'head_coach'
      ? [58, 84]
      : options.role === 'coach'
        ? [52, 80]
        : [45, 78];
  const ability = randomInt(abilityRange[0], abilityRange[1]);
  const specialties: StaffSpecialty[] = ['training', 'draft', 'mentoring', 'conditioning'];
  const philosophyPool: CoachingPhilosophy[] = ['aggressive', 'defensive', 'balanced', 'developmental'];

  return {
    teamId: options.isFreeAgent ? null : null,
    name: pickRandom(names),
    role: options.role,
    ability,
    specialty: options.role === 'head_coach' ? pickRandom(specialties) : pickRandom([...specialties, null]),
    salary:
      options.role === 'head_coach'
        ? 5000 + Math.round(ability * 60)
        : 2800 + Math.round(ability * 45),
    morale: 70,
    contractEndSeason: options.contractEndSeason,
    hiredDate: options.hiredDate,
    isFreeAgent: options.isFreeAgent ?? false,
    philosophy: options.role === 'head_coach' ? pickRandom(philosophyPool) : null,
    nationality: REGION_TO_NATIONALITY[options.region] ?? 'KR',
    preferredRole: options.preferredRole ?? options.role,
    roleFlexibility: options.forceRoleFlexibility ?? getDefaultRoleFlexibility(options.role),
    careerOrigin: options.careerOrigin ?? null,
  };
}

async function insertStaffRecord(staff: Omit<Staff, 'id'>, teamId: string | null): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO staff (
      team_id, name, role, ability, specialty, salary, morale, contract_end_season, hired_date,
      is_free_agent, philosophy, nationality, preferred_role, role_flexibility, career_origin
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      teamId,
      staff.name,
      staff.role,
      staff.ability,
      staff.specialty,
      staff.salary,
      staff.morale,
      staff.contractEndSeason,
      staff.hiredDate,
      staff.isFreeAgent ? 1 : 0,
      staff.philosophy,
      staff.nationality,
      staff.preferredRole,
      staff.roleFlexibility,
      staff.careerOrigin,
    ],
  );
}

async function getTeamContext(teamId: string): Promise<TeamContextRow | null> {
  const db = await getDatabase();
  const rows = await db.select<TeamContextRow[]>(
    'SELECT id, name, region, budget, salary_cap, reputation, play_style FROM teams WHERE id = $1 LIMIT 1',
    [teamId],
  );
  return rows[0] ?? null;
}

async function getStaffById(staffId: number): Promise<Staff | null> {
  const db = await getDatabase();
  const rows = await db.select<StaffRow[]>('SELECT * FROM staff WHERE id = $1 LIMIT 1', [staffId]);
  return rows[0] ? mapRowToStaff(rows[0]) : null;
}

function getManagerPhilosophyAlignment(
  philosophy: CoachingPhilosophy | null,
  identity: Awaited<ReturnType<typeof getManagerIdentity>>,
): number {
  if (!philosophy || !identity) return 0;

  const { playerCare, tacticalFocus, resultDriven } = identity.philosophy;
  switch (philosophy) {
    case 'aggressive':
      return Math.round((resultDriven - 50) * 0.5 + (tacticalFocus - 50) * 0.35);
    case 'defensive':
      return Math.round((playerCare - 50) * 0.35 - (resultDriven - 50) * 0.2);
    case 'developmental':
      return Math.round((playerCare - 50) * 0.55 - (resultDriven - 50) * 0.2);
    case 'balanced':
    default:
      return Math.round((tacticalFocus - 50) * 0.2);
  }
}

function getStaffRoleFitPenalty(staff: Staff): number {
  if (staff.role === staff.preferredRole) return 0;
  const secondaryRoles = getDefaultSecondaryRoles(staff.preferredRole);
  if (secondaryRoles.includes(staff.role)) return 0.08;
  return staff.roleFlexibility === 'strict' ? 0.22 : staff.roleFlexibility === 'normal' ? 0.12 : 0.06;
}

function buildStaffFitSummaryLine(alignmentScore: number, rolePenalty: number): string {
  if (rolePenalty >= 0.2) return 'This staff member is working in a role they do not really want, so output will be less stable.';
  if (alignmentScore <= -12) return 'The coach profile is drifting away from the manager identity, which weakens buy-in.';
  if (alignmentScore >= 12) return 'The coach profile and manager identity are aligned, so recommendations land more cleanly.';
  return 'The staff role fit is serviceable but not giving you a strong extra edge.';
}

function scoreToDecision(score: number): { decision: StaffOfferDecision; acceptance: StaffAcceptanceLevel } {
  if (score >= 72) return { decision: 'accept', acceptance: 'high' };
  if (score >= 58) return { decision: 'accept', acceptance: 'medium' };
  if (score >= 43) return { decision: 'hesitate', acceptance: 'low' };
  return { decision: 'reject', acceptance: 'unlikely' };
}

function getMarketCategory(staff: Staff, offeredRole: StaffRole): StaffCandidateView['marketCategory'] {
  if (offeredRole === 'coach' && (staff.preferredRole === 'head_coach' || staff.careerOrigin === 'head_coach')) {
    return 'former_head_coach';
  }
  if (offeredRole === 'coach') return 'coach';
  return 'specialist';
}

function buildRoleReason(staff: Staff, offeredRole: StaffRole): { scoreDelta: number; reason: string } {
  if (staff.preferredRole === offeredRole) {
    return { scoreDelta: 28, reason: '선호 역할과 정확히 맞는 제안입니다.' };
  }

  const secondaryRoles = getDefaultSecondaryRoles(staff.preferredRole);
  if (secondaryRoles.includes(offeredRole)) {
    return { scoreDelta: 10, reason: '주 역할은 아니지만 수용 가능한 범위의 제안입니다.' };
  }

  if (staff.roleFlexibility === 'strict') {
    return { scoreDelta: -38, reason: '선호 역할이 아니라 강하게 망설입니다.' };
  }
  if (staff.roleFlexibility === 'normal') {
    return { scoreDelta: -18, reason: '주 역할이 아니라 조건을 더 까다롭게 봅니다.' };
  }
  return { scoreDelta: -8, reason: '원래 역할은 아니지만 유연하게 검토합니다.' };
}

function buildCareerReason(staff: Staff, offeredRole: StaffRole): { scoreDelta: number; reason: string | null } {
  const preferredPriority = ROLE_PRIORITY[staff.preferredRole] ?? 1;
  const offeredPriority = ROLE_PRIORITY[offeredRole] ?? 1;
  const currentPriority = ROLE_PRIORITY[staff.role] ?? offeredPriority;

  if (offeredPriority < preferredPriority) {
    if (staff.preferredRole === 'head_coach' && offeredRole === 'coach') {
      return { scoreDelta: -16, reason: '감독 경험이 있어 코치 역할 제안에 자존심이 걸려 있습니다.' };
    }
    return { scoreDelta: -10, reason: '현재 커리어보다 낮은 역할 제안으로 받아들입니다.' };
  }

  if (offeredPriority > currentPriority) {
    return { scoreDelta: 8, reason: '커리어 업그레이드 기회로 보고 있습니다.' };
  }

  return { scoreDelta: 0, reason: null };
}

export async function getTeamStaff(teamId: string): Promise<Staff[]> {
  const db = await getDatabase();
  const rows = await db.select<StaffRow[]>(
    'SELECT * FROM staff WHERE team_id = $1 ORDER BY role, ability DESC',
    [teamId],
  );
  return rows.map(mapRowToStaff);
}

export async function hireStaff(
  teamId: string,
  role: StaffRole,
  contractEndSeason: number,
  hiredDate: string,
): Promise<Staff> {
  const context = await getTeamContext(teamId);
  const region = context?.region ?? 'LCK';
  const profile = generateStaffProfile({
    role,
    region,
    hiredDate,
    contractEndSeason,
  });

  await insertStaffRecord({ ...profile, isFreeAgent: false }, teamId);
  const db = await getDatabase();
  const rows = await db.select<StaffRow[]>(
    'SELECT * FROM staff WHERE team_id = $1 ORDER BY id DESC LIMIT 1',
    [teamId],
  );
  return mapRowToStaff(rows[0]);
}

export async function fireStaff(staffId: number): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE staff SET team_id = NULL, is_free_agent = 1 WHERE id = $1',
    [staffId],
  );
}

export async function getFreeAgentStaff(): Promise<Staff[]> {
  const db = await getDatabase();
  const rows = await db.select<StaffRow[]>(
    'SELECT * FROM staff WHERE is_free_agent = 1 ORDER BY ability DESC, id DESC',
  );
  return rows.map(mapRowToStaff);
}

export async function hireExistingStaff(
  staffId: number,
  teamId: string,
  contractEndSeason: number,
): Promise<void> {
  const staff = await getStaffById(staffId);
  if (!staff) return;
  await hireStaffByOffer(staffId, teamId, staff.role, contractEndSeason);
}

export async function seedInitialTeamStaff(
  teamId: string,
  seasonYear: number,
  isUserTeamCandidate = false,
): Promise<void> {
  const context = await getTeamContext(teamId);
  if (!context) return;

  const existing = await getTeamStaff(teamId);
  if (existing.length > 0) return;

  const hiredDate = `${seasonYear}-01-01`;
  const contractEndSeason = seasonYear + 1;
  const roles: StaffRole[] = ['head_coach', 'coach', 'coach', 'analyst'];

  for (const role of roles) {
    if (role === 'analyst' && !isUserTeamCandidate && randomInt(0, 100) < 35) {
      continue;
    }

    const profile = generateStaffProfile({
      role,
      region: context.region,
      hiredDate,
      contractEndSeason,
    });

    await insertStaffRecord({ ...profile, isFreeAgent: false }, teamId);
  }
}

export async function seedAllTeamsStaff(seasonYear: number, userTeamId?: string): Promise<void> {
  const db = await getDatabase();
  const teams = await db.select<Array<{ id: string }>>('SELECT id FROM teams');
  for (const team of teams) {
    await seedInitialTeamStaff(team.id, seasonYear, team.id === userTeamId);
  }
}

export async function releaseUserTeamHeadCoach(teamId: string): Promise<void> {
  const db = await getDatabase();
  const rows = await db.select<StaffRow[]>(
    'SELECT * FROM staff WHERE team_id = $1 AND role = $2 ORDER BY ability DESC LIMIT 1',
    [teamId, 'head_coach'],
  );
  const row = rows[0];
  if (!row) return;

  await db.execute(
    `UPDATE staff
     SET team_id = NULL,
         role = 'coach',
         is_free_agent = 1,
         preferred_role = COALESCE(preferred_role, 'head_coach'),
         role_flexibility = COALESCE(role_flexibility, 'strict'),
         career_origin = COALESCE(career_origin, 'head_coach')
     WHERE id = $1`,
    [row.id],
  );
}

export async function evaluateStaffOffer(
  teamId: string,
  saveId: number,
  staffId: number,
  offeredRole: StaffRole,
): Promise<StaffOfferEvaluation> {
  const staff = await getStaffById(staffId);
  if (!staff) {
    throw new Error(`Staff ${staffId} not found`);
  }

  const [context, teamStaff, identity, activeSeason] = await Promise.all([
    getTeamContext(teamId),
    getTeamStaff(teamId),
    getManagerIdentity(saveId).catch(() => null),
    getActiveSeason().catch(() => null),
  ]);

  const reasons: string[] = [];
  let score = 50;

  if (!canHireRole(teamStaff, offeredRole)) {
    return {
      staff,
      offeredRole,
      decision: 'reject',
      acceptance: 'unlikely',
      score: 0,
      reasons: ['현재 팀에 이 역할의 자리가 없습니다.'],
    };
  }

  const roleReason = buildRoleReason(staff, offeredRole);
  score += roleReason.scoreDelta;
  reasons.push(roleReason.reason);

  const careerReason = buildCareerReason(staff, offeredRole);
  score += careerReason.scoreDelta;
  if (careerReason.reason) reasons.push(careerReason.reason);

  const philosophyAlignment = getManagerPhilosophyAlignment(staff.philosophy, identity);
  if (philosophyAlignment !== 0) {
    score += philosophyAlignment;
    reasons.push(
      philosophyAlignment > 0
        ? '당신의 운영 철학과 잘 맞는 편입니다.'
        : '당신의 운영 철학과는 약간 거리감이 있습니다.',
    );
  }

  if (context) {
    const projectScore = Math.round((context.reputation - 50) * 0.35 + ((context.budget / Math.max(context.salary_cap, 1)) - 1) * 12);
    score += projectScore;
    reasons.push(
      projectScore >= 0
        ? '팀 프로젝트의 매력도는 나쁘지 않게 평가합니다.'
        : '팀 규모와 기대치가 아직 완전히 매력적이지는 않습니다.',
    );
  }

  const counts = getStaffCounts(teamStaff);
  if (offeredRole === 'coach' && counts.coach === 0) {
    score += 10;
    reasons.push('당장 현장 코칭 공백을 메울 수 있는 제안입니다.');
  } else if (offeredRole === 'analyst' && counts.analyst === 0) {
    score += 8;
    reasons.push('분석 파트 공석이라 역할 중요도가 높습니다.');
  }

  if (activeSeason) {
    const winRate = await getTeamRecentWinRate(teamId, activeSeason.id).catch(() => 0.5);
    if (winRate >= 0.6) {
      score += 8;
      reasons.push('최근 성적이 좋아 우승 프로젝트로 인식됩니다.');
    } else if (winRate <= 0.4) {
      score -= 6;
      reasons.push('최근 성적이 좋지 않아 리스크를 더 크게 봅니다.');
    }
  }

  score += Math.round((staff.ability - 60) * 0.15);

  const boundedScore = Math.max(0, Math.min(100, score));
  const outcome = scoreToDecision(boundedScore);
  return {
    staff,
    offeredRole,
    decision: outcome.decision,
    acceptance: outcome.acceptance,
    score: boundedScore,
    reasons: reasons.slice(0, 4),
  };
}

export async function hireStaffByOffer(
  staffId: number,
  teamId: string,
  offeredRole: StaffRole,
  contractEndSeason: number,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `UPDATE staff
     SET team_id = $1,
         role = $2,
         is_free_agent = 0,
         contract_end_season = $3
     WHERE id = $4`,
    [teamId, offeredRole, contractEndSeason, staffId],
  );
}

export async function buildStaffCandidateView(
  teamId: string,
  saveId: number,
  staff: Staff,
  offeredRole: StaffRole,
): Promise<StaffCandidateView> {
  const evaluation = await evaluateStaffOffer(teamId, saveId, staff.id, offeredRole);
  return {
    ...evaluation,
    marketCategory: getMarketCategory(staff, offeredRole),
  };
}

export interface StaffBonuses {
  trainingEfficiency: number;
  moraleBoost: number;
  draftAccuracy: number;
  scoutingSpeedBonus: number;
  scoutingAccuracyBonus: number;
  moraleRecoveryBonus: number;
  pressureResistanceBonus: number;
  staminaRecoveryBonus: number;
  injuryPreventionBonus: number;
  injuryRecoveryBonus: number;
  reinjuryPreventionBonus: number;
  opponentAnalysisBonus: number;
  metaAdaptationBonus: number;
}

export interface StaffRecommendation {
  role: StaffRole;
  title: string;
  summary: string;
  route: string;
  urgency: 'high' | 'medium' | 'low';
}

function getMoraleFactor(morale: number): number {
  return 0.7 + (morale / 100) * 0.6;
}

export async function calculateStaffBonuses(teamId: string): Promise<StaffBonuses> {
  const staff = await getTeamStaff(teamId);
  let managerIdentity = null;
  try {
    const db = await getDatabase();
    const rows = await db.select<{ save_id: number }[]>(
      'SELECT save_id FROM manager_profiles WHERE team_id = $1 LIMIT 1',
      [teamId],
    );
    if (rows[0]?.save_id != null) {
      managerIdentity = await getManagerIdentity(rows[0].save_id).catch(() => null);
    }
  } catch {
    managerIdentity = null;
  }

  const bonuses: StaffBonuses = {
    trainingEfficiency: 1.0,
    moraleBoost: 0,
    draftAccuracy: 0,
    scoutingSpeedBonus: 0,
    scoutingAccuracyBonus: 0,
    moraleRecoveryBonus: 0,
    pressureResistanceBonus: 0,
    staminaRecoveryBonus: 1.0,
    injuryPreventionBonus: 0,
    injuryRecoveryBonus: 0,
    reinjuryPreventionBonus: 0,
    opponentAnalysisBonus: 0,
    metaAdaptationBonus: 0,
  };

  for (const s of staff) {
    const factor = s.ability / 100;
    const moraleFactor = getMoraleFactor(s.morale);
    const rolePenalty = getStaffRoleFitPenalty(s);
    const alignmentModifier = managerIdentity ? getManagerPhilosophyAlignment(s.philosophy, managerIdentity) / 100 : 0;
    const fitModifier = Math.max(0.72, 1 - rolePenalty + alignmentModifier);

    switch (s.role) {
      case 'head_coach':
        bonuses.trainingEfficiency += (0.1 + factor * 0.15) * moraleFactor * fitModifier;
        bonuses.moraleBoost += Math.round((3 + factor * 5) * moraleFactor * fitModifier);
        break;
      case 'coach':
        bonuses.trainingEfficiency += (0.05 + factor * 0.1) * moraleFactor * fitModifier;
        break;
      case 'analyst':
        bonuses.draftAccuracy += Math.round((5 + factor * 15) * moraleFactor * fitModifier);
        break;
      case 'scout_manager':
        bonuses.scoutingSpeedBonus = -1;
        bonuses.scoutingAccuracyBonus += Math.round((5 + factor * 10) * moraleFactor * fitModifier);
        break;
      case 'sports_psychologist':
        bonuses.moraleRecoveryBonus += Math.round((1 + factor * 2) * moraleFactor * fitModifier);
        bonuses.pressureResistanceBonus += (0.03 + factor * 0.07) * moraleFactor * fitModifier;
        break;
      case 'nutritionist':
        bonuses.staminaRecoveryBonus += (0.1 + factor * 0.15) * moraleFactor * fitModifier;
        bonuses.injuryPreventionBonus -= (0.1 + factor * 0.2) * moraleFactor * fitModifier;
        break;
      case 'physiotherapist':
        bonuses.injuryRecoveryBonus -= (0.05 + factor * 0.15) * moraleFactor * fitModifier;
        bonuses.reinjuryPreventionBonus -= (0.1 + factor * 0.4) * moraleFactor * fitModifier;
        break;
      case 'data_analyst':
        bonuses.opponentAnalysisBonus += Math.round((5 + factor * 15) * moraleFactor * fitModifier);
        bonuses.metaAdaptationBonus -= Math.round((1 + factor * 2) * moraleFactor * fitModifier);
        break;
    }
  }

  return bonuses;
}

export async function getStaffFitSummary(teamId: string, saveId?: number): Promise<StaffFitSummary[]> {
  const [staffList, identity] = await Promise.all([
    getTeamStaff(teamId),
    saveId ? getManagerIdentity(saveId).catch(() => null) : Promise.resolve(null),
  ]);

  return staffList
    .map((staff) => {
      const rolePenalty = getStaffRoleFitPenalty(staff);
      const alignmentScore = identity ? getManagerPhilosophyAlignment(staff.philosophy, identity) : 0;
      const fitScore = Math.max(0, Math.min(100, Math.round(78 - rolePenalty * 100 + alignmentScore)));
      return {
        staffId: staff.id,
        name: staff.name,
        role: staff.role,
        preferredRole: staff.preferredRole,
        fitScore,
        summary: buildStaffFitSummaryLine(alignmentScore, rolePenalty),
      };
    })
    .sort((left, right) => left.fitScore - right.fitScore);
}

export async function updateStaffMorale(staffId: number, delta: number): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE staff SET morale = MAX(0, MIN(100, morale + $1)) WHERE id = $2',
    [delta, staffId],
  );
}

export async function updateTeamStaffMorale(teamId: string, delta: number): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE staff SET morale = MAX(0, MIN(100, morale + $1)) WHERE team_id = $2',
    [delta, teamId],
  );
}

export async function weeklyStaffMoraleRecovery(teamId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `UPDATE staff SET morale = CASE
       WHEN morale < 70 THEN MIN(70, morale + 2)
       WHEN morale > 70 THEN MAX(70, morale - 1)
       ELSE morale
     END
     WHERE team_id = $1`,
    [teamId],
  );
}

export interface PhilosophyBonus {
  statMultipliers: Record<string, number>;
  youngPlayerGrowth: number;
}

export async function getPhilosophyBonus(teamId: string): Promise<PhilosophyBonus> {
  const staff = await getTeamStaff(teamId);
  const headCoach = staff.find((entry) => entry.role === 'head_coach');
  const philosophy = headCoach?.philosophy ?? 'balanced';

  const base: PhilosophyBonus = {
    statMultipliers: {
      mechanical: 1.0,
      gameSense: 1.0,
      teamwork: 1.0,
      consistency: 1.0,
      laning: 1.0,
      aggression: 1.0,
    },
    youngPlayerGrowth: 1.0,
  };

  switch (philosophy) {
    case 'aggressive':
      base.statMultipliers.aggression = 1.15;
      base.statMultipliers.teamwork = 0.95;
      break;
    case 'defensive':
      base.statMultipliers.gameSense = 1.15;
      base.statMultipliers.aggression = 0.95;
      break;
    case 'developmental':
      base.youngPlayerGrowth = 1.2;
      break;
    default:
      break;
  }

  return base;
}

export function calculateCoachPlayerChemistry(coach: Staff, playerNationality: string): number {
  let chemistry = 50;
  if (coach.nationality === playerNationality) chemistry += 10;
  if (coach.specialty === 'training') chemistry += 15;
  if (coach.specialty === 'mentoring') chemistry += 10;
  if (coach.specialty === 'conditioning') chemistry += 5;
  return Math.min(100, chemistry);
}

export async function getChemistryTrainingBonus(
  teamId: string,
  playerNationalities: Record<string, string>,
): Promise<number> {
  const staff = await getTeamStaff(teamId);
  const coaches = staff.filter((entry) => entry.role === 'head_coach' || entry.role === 'coach');
  const playerIds = Object.keys(playerNationalities);

  if (coaches.length === 0 || playerIds.length === 0) return 0;

  let totalChemistry = 0;
  let count = 0;
  for (const coach of coaches) {
    for (const playerId of playerIds) {
      totalChemistry += calculateCoachPlayerChemistry(coach, playerNationalities[playerId]);
      count += 1;
    }
  }

  const avgChemistry = totalChemistry / count;
  return ((avgChemistry - 50) / 50) * 0.05;
}

function buildRecommendationFromInsight(insight: PlayerManagementInsight): StaffRecommendation {
  switch (insight.weakestFactor) {
    case 'teamChemistry':
      return {
        role: 'sports_psychologist',
        title: '심리 지원 추천',
        summary: `팀 케미 이슈가 있는 선수가 있습니다. ${insight.recommendation}`,
        route: '/manager/complaints',
        urgency: insight.urgency,
      };
    case 'roleClarity':
    case 'playtime':
      return {
        role: 'coach',
        title: '코치 추천',
        summary: `선수 역할 정리와 소통 보강이 필요합니다. ${insight.recommendation}`,
        route: '/manager/complaints',
        urgency: insight.urgency,
      };
    case 'personalPerformance':
      return {
        role: 'coach',
        title: '코치 추천',
        summary: `개인 퍼포먼스 회복을 위한 현장 코칭이 필요합니다. ${insight.recommendation}`,
        route: '/manager/training',
        urgency: insight.urgency,
      };
    case 'teamPerformance':
      return {
        role: 'analyst',
        title: '분석가 추천',
        summary: `경기 준비와 사전 분석 강화가 필요합니다. ${insight.recommendation}`,
        route: '/manager/tactics',
        urgency: insight.urgency,
      };
    default:
      return {
        role: 'data_analyst',
        title: '데이터 분석가 추천',
        summary: `근거 기반 의사결정을 강화할 여지가 있습니다. ${insight.recommendation}`,
        route: '/manager/roster',
        urgency: insight.urgency,
      };
  }
}

export async function generateStaffRecommendations(
  teamId: string,
  seasonId: number,
): Promise<StaffRecommendation[]> {
  const [staffList, complaints, insights] = await Promise.all([
    getTeamStaff(teamId),
    getActiveComplaints(teamId).catch(() => []),
    getPlayerManagementInsights(teamId, seasonId, 3).catch(() => []),
  ]);

  const availableRoles = new Set(staffList.map((staff) => staff.role));
  const recommendations: StaffRecommendation[] = [];

  if (complaints.length > 0) {
    recommendations.push({
      role: availableRoles.has('sports_psychologist') ? 'sports_psychologist' : 'coach',
      title: availableRoles.has('sports_psychologist') ? '심리 지원 추천' : '코치 추천',
      summary: `활성 불만이 ${complaints.length}건 있습니다. 선수 관리 화면에서 우선 정리하는 편이 좋습니다.`,
      route: '/manager/complaints',
      urgency: complaints.some((complaint) => complaint.severity >= 3) ? 'high' : 'medium',
    });
  }

  for (const insight of insights) {
    const recommendation = buildRecommendationFromInsight(insight);
    if (!recommendations.some((item) => item.title === recommendation.title && item.route === recommendation.route)) {
      recommendations.push(recommendation);
    }
  }

  if (!recommendations.some((item) => item.route === '/manager/tactics')) {
    recommendations.push({
      role: availableRoles.has('analyst') ? 'analyst' : 'coach',
      title: availableRoles.has('analyst') ? '분석가 추천' : '코치 추천',
      summary: '다음 경기 전 밴픽 우선순위와 상대 분석 메모를 다시 확인해두는 편이 좋습니다.',
      route: '/manager/tactics',
      urgency: 'low',
    });
  }

  return recommendations.slice(0, 3);
}
