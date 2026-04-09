import { getDatabase } from '../../db/database';
import type { Team } from '../../types';
import type { CoachSetupRecommendation, ManagerSetupStatus } from '../../types/managerSetup';
import type { Staff, StaffRole } from '../../types/staff';
import type { TeamTactics } from '../../types/tactics';
import type { TrainingActivity, TrainingIntensity, TrainingScheduleEntry, TrainingType } from '../../types/training';
import { getTeamStaff } from '../staff/staffEngine';
import { getTeamTactics, setTeamTactics } from '../tactics/tacticsEngine';
import { getTrainingSchedule, setTrainingSchedule } from '../training/trainingEngine';
import { generateCoachBriefingNews } from '../news/newsEngine';

type PlayerProfileRow = {
  id: string;
  position: string;
  mechanical: number;
  game_sense: number;
  teamwork: number;
  consistency: number;
  laning: number;
  aggression: number;
  potential: number;
};

const DEFAULT_TACTICS: Omit<TeamTactics, 'teamId'> = {
  earlyStrategy: 'standard',
  midStrategy: 'balanced',
  lateStrategy: 'teamfight',
  wardPriority: 'balanced',
  dragonPriority: 5,
  baronPriority: 5,
  aggressionLevel: 5,
};

const DAY_PLAN: Array<{ dayOfWeek: number; activityType: TrainingActivity }> = [
  { dayOfWeek: 0, activityType: 'rest' },
  { dayOfWeek: 1, activityType: 'training' },
  { dayOfWeek: 2, activityType: 'scrim' },
  { dayOfWeek: 3, activityType: 'training' },
  { dayOfWeek: 4, activityType: 'scrim' },
  { dayOfWeek: 5, activityType: 'training' },
  { dayOfWeek: 6, activityType: 'training' },
];

export class ManagerSetupBlockedError extends Error {
  readonly status: ManagerSetupStatus;

  constructor(status: ManagerSetupStatus) {
    super(status.blockingReasons[0] ?? '운영 세팅이 완료되지 않았습니다.');
    this.name = 'ManagerSetupBlockedError';
    this.status = status;
  }
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function chooseRecommendationAuthor(staffList: Staff[], preferredRoles: StaffRole[]): Staff | null {
  const scoreCoachInfluence = (staff: Staff): number => {
    let score = staff.ability;
    if (staff.careerOrigin === 'head_coach') score += 12;
    if (staff.preferredRole === 'head_coach') score += 6;
    return score;
  };

  for (const role of preferredRoles) {
    const candidate = staffList
      .filter((staff) => staff.role === role)
      .sort((left, right) => scoreCoachInfluence(right) - scoreCoachInfluence(left))[0];
    if (candidate) return candidate;
  }
  return [...staffList].sort((left, right) => scoreCoachInfluence(right) - scoreCoachInfluence(left))[0] ?? null;
}

function buildTrainingSchedule(trainingType: TrainingType, intensity: TrainingIntensity): TrainingScheduleEntry[] {
  return DAY_PLAN.map((entry, index) => ({
    teamId: '',
    dayOfWeek: entry.dayOfWeek,
    activityType: entry.activityType,
    trainingType:
      entry.activityType === 'rest'
        ? 'mental'
        : entry.activityType === 'scrim'
          ? index % 2 === 0
            ? trainingType
            : 'general'
          : trainingType,
    intensity: entry.activityType === 'rest' ? 'light' : intensity,
  }));
}

function buildTrainingRecommendationPayload(teamId: string, players: PlayerProfileRow[], team: Team | null): Omit<CoachSetupRecommendation, 'authorStaffId' | 'authorName' | 'authorRole'> {
  const avgPotential = average(players.map((player) => player.potential));
  const avgTeamwork = average(players.map((player) => player.teamwork));
  const avgGameSense = average(players.map((player) => player.game_sense));
  const avgLaning = average(players.map((player) => player.laning));
  const avgAggression = average(players.map((player) => player.aggression));

  let trainingType: TrainingType = 'general';
  let intensity: TrainingIntensity | undefined = avgPotential > 95 ? 'light' : 'normal';
  const reasons: string[] = [];
  let headline = '초기 운영 훈련안을 준비했습니다.';

  if (avgPotential >= 78) {
    trainingType = 'champion_pool';
    intensity = 'normal';
    headline = '성장 여지가 큰 선수단이라 챔피언 폭 확장을 우선 제안합니다.';
    reasons.push('잠재력이 높은 선수 비중이 커 초반 성장 효율을 챙길 가치가 있습니다.');
  } else if (avgLaning <= 62) {
    trainingType = 'laning';
    intensity = 'intense';
    headline = '라인전 안정감을 먼저 끌어올리는 편이 좋겠습니다.';
    reasons.push('주전 평균 라인전 수치가 낮아 경기 초반 주도권 손실이 예상됩니다.');
  } else if (avgTeamwork <= 64) {
    trainingType = 'teamfight';
    intensity = 'normal';
    headline = '합류 타이밍과 교전 호흡을 먼저 맞춰야 합니다.';
    reasons.push('팀워크 수치가 낮아 교전 설계와 합류 속도 보완이 우선입니다.');
  } else if (avgGameSense <= 64) {
    trainingType = 'macro';
    intensity = 'normal';
    headline = '오브젝트 운영과 맵 판단 훈련을 먼저 제안합니다.';
    reasons.push('운영 판단 수치가 낮아 중반 이후 설계 미스 가능성이 큽니다.');
  } else if (avgAggression >= 72 || team?.playStyle === 'aggressive') {
    trainingType = 'teamfight';
    intensity = 'intense';
    headline = '공격 성향을 살리는 교전 중심 주간 훈련이 어울립니다.';
    reasons.push('공격 성향이 강한 로스터라 교전 완성도를 높이면 강점이 더 살아납니다.');
  } else {
    reasons.push('현재 전력은 특정 약점보다 기본기와 운영 균형을 다지는 편이 좋습니다.');
  }

  reasons.push(`추천 주간 플랜은 ${trainingType === 'macro' ? '운영' : trainingType === 'teamfight' ? '교전' : trainingType === 'laning' ? '라인전' : trainingType === 'champion_pool' ? '챔피언 폭' : '기본기'} 중심으로 구성했습니다.`);

  return {
    id: `training-${teamId}`,
    kind: 'training',
    headline,
    summary: `${headline} ${intensity === 'intense' ? '강도는 높게' : intensity === 'light' ? '강도는 가볍게' : '강도는 표준으로'} 시작하는 안입니다.`,
    reasons: reasons.slice(0, 3),
    payload: buildTrainingSchedule(trainingType, intensity ?? 'normal').map((entry) => ({ ...entry, teamId })),
  };
}

function buildTacticsRecommendationPayload(teamId: string, players: PlayerProfileRow[], team: Team | null): Omit<CoachSetupRecommendation, 'authorStaffId' | 'authorName' | 'authorRole'> {
  const avgAggression = average(players.map((player) => player.aggression));
  const avgLaning = average(players.map((player) => player.laning));
  const avgTeamwork = average(players.map((player) => player.teamwork));
  const avgGameSense = average(players.map((player) => player.game_sense));
  const avgConsistency = average(players.map((player) => player.consistency));

  let payload: Omit<TeamTactics, 'teamId'> = { ...DEFAULT_TACTICS };
  const reasons: string[] = [];
  let headline = '선수단 특성에 맞춘 기본 전술안을 만들었습니다.';

  if (team?.playStyle === 'split' || (avgLaning >= 70 && avgConsistency >= 68)) {
    payload = {
      earlyStrategy: 'safe_farm',
      midStrategy: 'split_push',
      lateStrategy: 'siege',
      wardPriority: 'aggressive',
      dragonPriority: 4,
      baronPriority: 7,
      aggressionLevel: 6,
    };
    headline = '사이드 운영과 포탑 압박 중심 전술이 가장 잘 맞습니다.';
    reasons.push('라인전과 안정성이 괜찮아 스플릿 운영으로 강점을 살릴 수 있습니다.');
  } else if (team?.playStyle === 'aggressive' || (avgAggression >= 72 && avgLaning >= 68)) {
    payload = {
      earlyStrategy: 'invade',
      midStrategy: 'pick_comp',
      lateStrategy: 'pick',
      wardPriority: 'aggressive',
      dragonPriority: 6,
      baronPriority: 5,
      aggressionLevel: 8,
    };
    headline = '초반 주도권과 픽오프로 흐름을 잡는 안을 추천합니다.';
    reasons.push('공격성과 라인전 수치가 좋아 초반 적극성이 이득으로 이어질 가능성이 큽니다.');
  } else if (avgGameSense >= 68 || avgTeamwork >= 68 || team?.playStyle === 'controlled') {
    payload = {
      earlyStrategy: 'standard',
      midStrategy: 'objective_control',
      lateStrategy: 'teamfight',
      wardPriority: 'balanced',
      dragonPriority: 7,
      baronPriority: 7,
      aggressionLevel: 5,
    };
    headline = '오브젝트 중심의 안정적인 한타 운영이 가장 무난합니다.';
    reasons.push('운영 이해도와 팀 합류가 좋아 중반 오브젝트 설계에서 이점을 기대할 수 있습니다.');
  } else {
    reasons.push('선수단 수치가 고르게 분포해 극단적 전술보다 균형형 세팅이 안전합니다.');
  }

  reasons.push(`초기 전술의 핵심은 ${payload.midStrategy === 'split_push' ? '사이드 압박' : payload.midStrategy === 'pick_comp' ? '시야 기반 픽오프' : '오브젝트 운영'}입니다.`);

  return {
    id: `tactics-${teamId}`,
    kind: 'tactics',
    headline,
    summary: `${headline} 초반은 ${payload.earlyStrategy}, 중반은 ${payload.midStrategy}, 후반은 ${payload.lateStrategy} 쪽으로 설계했습니다.`,
    reasons: reasons.slice(0, 3),
    payload,
  };
}

async function getTeamContext(teamId: string): Promise<{ team: Team | null; players: PlayerProfileRow[]; staffList: Staff[] }> {
  const db = await getDatabase();
  const [teamRows, playerRows, staffList] = await Promise.all([
    db.select<Array<{ id: string; name: string; short_name: string; region: Team['region']; budget: number; salary_cap: number; reputation: number; play_style: Team['playStyle'] }>>(
      `SELECT id, name, short_name, region, budget, salary_cap, reputation, play_style
       FROM teams
       WHERE id = $1`,
      [teamId],
    ),
    db.select<PlayerProfileRow[]>(
      `SELECT id, position, mechanical, game_sense, teamwork, consistency, laning, aggression, potential
       FROM players
       WHERE team_id = $1`,
      [teamId],
    ),
    getTeamStaff(teamId).catch(() => []),
  ]);

  const row = teamRows[0];
  const team = row
    ? {
        id: row.id,
        name: row.name,
        shortName: row.short_name,
        region: row.region,
        budget: row.budget,
        salaryCap: row.salary_cap,
        reputation: row.reputation,
        playStyle: row.play_style,
        roster: [],
      }
    : null;

  return { team, players: playerRows, staffList };
}

export async function getManagerSetupStatus(teamId: string): Promise<ManagerSetupStatus> {
  const [schedule, tactics] = await Promise.all([getTrainingSchedule(teamId), getTeamTactics(teamId)]);
  const isTrainingConfigured = schedule.length > 0;
  const isTacticsConfigured = tactics !== null;
  const blockingReasons: string[] = [];

  if (!isTrainingConfigured) blockingReasons.push('주간 훈련 계획을 아직 확정하지 않았습니다.');
  if (!isTacticsConfigured) blockingReasons.push('팀 전술 세팅을 아직 확정하지 않았습니다.');

  return {
    isTrainingConfigured,
    isTacticsConfigured,
    isReadyToAdvance: isTrainingConfigured && isTacticsConfigured,
    blockingReasons,
  };
}

export async function assertManagerReadyToAdvance(teamId: string): Promise<void> {
  const status = await getManagerSetupStatus(teamId);
  if (!status.isReadyToAdvance) {
    throw new ManagerSetupBlockedError(status);
  }
}

export async function generateInitialCoachRecommendations(teamId: string, _seasonId: number): Promise<CoachSetupRecommendation[]> {
  const { team, players, staffList } = await getTeamContext(teamId);
  const trainingAuthor = chooseRecommendationAuthor(staffList, ['coach', 'head_coach']);
  const tacticsAuthor = chooseRecommendationAuthor(staffList, ['analyst', 'coach', 'head_coach']);

  const trainingRecBase = buildTrainingRecommendationPayload(teamId, players, team);
  const tacticsRecBase = buildTacticsRecommendationPayload(teamId, players, team);

  return [
    {
      ...trainingRecBase,
      authorStaffId: trainingAuthor?.id ?? null,
      authorName: trainingAuthor?.name ?? '수석 코치진',
      authorRole: trainingAuthor?.role ?? null,
    },
    {
      ...tacticsRecBase,
      authorStaffId: tacticsAuthor?.id ?? null,
      authorName: tacticsAuthor?.name ?? '전술 코치',
      authorRole: tacticsAuthor?.role ?? null,
    },
  ];
}

export async function applyCoachTrainingRecommendation(teamId: string, recommendation: CoachSetupRecommendation | TrainingScheduleEntry[]): Promise<void> {
  const payload = Array.isArray(recommendation) ? recommendation : recommendation.payload;
  if (!Array.isArray(payload)) return;

  for (const entry of payload) {
    await setTrainingSchedule(teamId, entry.dayOfWeek, entry.activityType, entry.trainingType, entry.intensity);
  }
}

export async function applyCoachTacticsRecommendation(teamId: string, recommendation: CoachSetupRecommendation | Omit<TeamTactics, 'teamId'>): Promise<void> {
  const payload = Array.isArray(recommendation) ? null : 'kind' in recommendation ? recommendation.payload : recommendation;
  if (!payload || Array.isArray(payload)) return;
  await setTeamTactics(teamId, payload);
}

export async function ensureInitialCoachBriefingNews(teamId: string, seasonId: number, date: string): Promise<void> {
  const db = await getDatabase();
  const existing = await db.select<Array<{ id: number }>>(
    `SELECT id
     FROM news_articles
     WHERE season_id = $1
       AND category = 'coach_briefing'
       AND related_team_id = $2
       AND article_date = $3
     LIMIT 1`,
    [seasonId, teamId, date],
  );

  if (existing.length > 0) return;

  const recommendations = await generateInitialCoachRecommendations(teamId, seasonId);
  await generateCoachBriefingNews(seasonId, date, teamId, recommendations);
}
