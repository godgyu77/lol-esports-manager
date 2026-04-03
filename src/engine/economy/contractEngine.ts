import { getDatabase } from '../../db/database';
import {
  getExpiringContracts,
  getPlayerById,
  updatePlayerContract,
} from '../../db/queries';
import { agentNegotiate } from '../agent/agentEngine';
import { evaluatePayrollImpact, getTeamPayrollSnapshot } from './payrollEngine';
import { calculateFairSalary } from './transferEngine';
import type { Player } from '../../types/player';
import { getPlayerOverall } from '../../utils/playerUtils';
import type {
  ContractDecisionFactors,
  ContractNegotiation,
  NegotiationInitiator,
  NegotiationMessage,
  NegotiationStatus,
  TeamEvaluation,
} from '../../types/contract';

export interface RenewalResult {
  success: boolean;
  reason: string;
}

export interface RenewalDifficulty {
  salaryMultiplier: number;
  rejectProbability: number;
  reason: string[];
}

export interface CounterOfferState {
  attempt: number;
  maxAttempts: number;
  lastOfferedSalary: number;
  difficulty: RenewalDifficulty;
}

interface NegotiationRow {
  id: number;
  season_id: number;
  player_id: string;
  team_id: string;
  initiator: NegotiationInitiator;
  status: NegotiationStatus;
  current_round: number;
  team_salary: number;
  team_years: number;
  team_signing_bonus: number;
  player_salary: number | null;
  player_years: number | null;
  player_signing_bonus: number | null;
  factor_money: number;
  factor_winning: number;
  factor_playtime: number;
  factor_loyalty: number;
  factor_reputation: number;
  final_salary: number | null;
  final_years: number | null;
  final_signing_bonus: number | null;
  messages: string;
}

function parseMessages(value: string): NegotiationMessage[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapRowToNegotiation(row: NegotiationRow): ContractNegotiation {
  return {
    id: row.id,
    seasonId: row.season_id,
    playerId: row.player_id,
    teamId: row.team_id,
    initiator: row.initiator,
    status: row.status,
    currentRound: row.current_round,
    teamSalary: row.team_salary,
    teamYears: row.team_years,
    teamSigningBonus: row.team_signing_bonus,
    playerSalary: row.player_salary,
    playerYears: row.player_years,
    playerSigningBonus: row.player_signing_bonus,
    factors: {
      money: row.factor_money,
      winning: row.factor_winning,
      playtime: row.factor_playtime,
      loyalty: row.factor_loyalty,
      reputation: row.factor_reputation,
    },
    finalSalary: row.final_salary,
    finalYears: row.final_years,
    finalSigningBonus: row.final_signing_bonus,
    messages: parseMessages(row.messages),
  };
}

async function canAbsorbPayroll(teamId: string, nextPayroll: number): Promise<{
  allowed: boolean;
  salaryCap: number;
  luxuryTax: number;
  pressureBand: 'safe' | 'taxed' | 'warning' | 'hard_stop';
}> {
  const snapshot = await getTeamPayrollSnapshot(teamId);
  const impact = evaluatePayrollImpact({
    totalPayroll: nextPayroll,
    salaryCap: snapshot.salaryCap,
  });
  return {
    allowed: impact.pressureBand !== 'hard_stop',
    salaryCap: snapshot.salaryCap,
    luxuryTax: impact.luxuryTax,
    pressureBand: impact.pressureBand,
  };
}

export function calculateRenewalOffer(player: Player): {
  suggestedSalary: number;
  suggestedYears: number;
} {
  const fairSalary = calculateFairSalary(player);
  const ovr = getPlayerOverall(player);

  let suggestedYears = 2;
  if (player.age >= 28 || player.potential < 40) suggestedYears = 1;

  let multiplier = 1;
  if (ovr >= 80) multiplier = 1.1;
  else if (ovr >= 70) multiplier = 1.05;
  else if (ovr < 55) multiplier = 0.9;

  return {
    suggestedSalary: Math.round(fairSalary * multiplier),
    suggestedYears,
  };
}

export function evaluatePlayerDemand(player: Player): {
  minSalary: number;
  maxSalary: number;
  idealSalary: number;
} {
  const fairSalary = calculateFairSalary(player);
  const currentSalary = player.contract.salary;
  const ovr = getPlayerOverall(player);
  const baseSalary = Math.max(currentSalary, fairSalary);

  let factor = 1;
  if (ovr >= 80) factor = 1.2;
  else if (ovr >= 70) factor = 1.1;
  else if (ovr < 55) factor = 0.9;

  const idealSalary = Math.round(baseSalary * factor);
  return {
    minSalary: Math.round(idealSalary * 0.8),
    maxSalary: Math.round(idealSalary * 1.2),
    idealSalary,
  };
}

export async function attemptRenewal(
  player: Player,
  teamId: string,
  offeredSalary: number,
  years: number,
  currentSeasonId: number,
  teamMorale?: number,
  signingBonus?: number,
): Promise<RenewalResult> {
  const projectedPayroll = (await getTeamPayrollSnapshot(teamId)).totalPayroll - player.contract.salary + offeredSalary;
  const payrollCheck = await canAbsorbPayroll(teamId, projectedPayroll);
  if (!payrollCheck.allowed) {
    return {
      success: false,
      reason: `샐러리캡 초과 폭이 너무 큽니다. 예상 payroll ${projectedPayroll.toLocaleString()} / cap ${payrollCheck.salaryCap.toLocaleString()}`,
    };
  }

  const fairSalary = calculateFairSalary(player);
  const agentResult = await agentNegotiate(player.id, offeredSalary, fairSalary);
  if (!agentResult.accepted) {
    return {
      success: false,
      reason: `에이전트가 거절했습니다. 요구 연봉 ${agentResult.counterOffer.toLocaleString()}`,
    };
  }

  const demand = evaluatePlayerDemand(player);
  let acceptThreshold = demand.idealSalary * 0.9;
  if (typeof teamMorale === 'number') {
    const moraleModifier = ((teamMorale - 50) / 50) * 0.1;
    acceptThreshold *= 1 - moraleModifier;
  }

  if (offeredSalary < Math.round(acceptThreshold)) {
    return {
      success: false,
      reason: `선수 요구치가 더 높습니다. 제안 ${offeredSalary.toLocaleString()} / 최소 ${Math.round(acceptThreshold).toLocaleString()}`,
    };
  }

  const contractEndSeason = currentSeasonId + years * 2;
  await updatePlayerContract(player.id, offeredSalary, contractEndSeason);

  if (signingBonus && signingBonus > 0) {
    const db = await getDatabase();
    await db.execute('UPDATE teams SET budget = budget - $1 WHERE id = $2', [signingBonus, teamId]);
    const { addClause } = await import('./clauseEngine');
    await addClause(player.id, 'signing_bonus', signingBonus, `Season ${currentSeasonId} signing bonus`);
  }

  const payrollNote = payrollCheck.pressureBand === 'safe'
    ? ''
    : ` (${payrollCheck.pressureBand} band, luxury tax ${payrollCheck.luxuryTax.toLocaleString()})`;

  return {
    success: true,
    reason: `재계약 완료: ${offeredSalary.toLocaleString()} / ${years}년${payrollNote}`,
  };
}

export async function getTeamExpiringContracts(
  teamId: string,
  currentSeasonId: number,
): Promise<(Player & { division: string })[]> {
  const expiring = await getExpiringContracts(currentSeasonId + 1);
  return expiring.filter((p) => p.teamId === teamId);
}

export function calculateRenewalDifficulty(
  player: Player,
  teamReputation: number,
  recentForm?: number,
): RenewalDifficulty {
  const ovr = getPlayerOverall(player);
  let salaryMultiplier = 1;
  let rejectProbability = 0.1;
  const reason: string[] = [];

  if (ovr >= 80) {
    salaryMultiplier = 1.3;
    rejectProbability += 0.2;
    reason.push('Star player premium');
  }
  if (teamReputation < 50) {
    rejectProbability += 0.2;
    reason.push('Low team reputation');
  }
  if (typeof recentForm === 'number' && recentForm >= 70) {
    salaryMultiplier *= 1.15;
    reason.push('Strong recent form');
  }

  return {
    salaryMultiplier,
    rejectProbability: Math.min(0.9, rejectProbability),
    reason,
  };
}

export async function attemptRenewalWithCounter(
  player: Player,
  teamId: string,
  offeredSalary: number,
  years: number,
  currentSeasonId: number,
  teamMorale?: number,
  counterState: CounterOfferState | null = null,
): Promise<RenewalResult & { counterState: CounterOfferState | null }> {
  const attempt = (counterState?.attempt ?? 0) + 1;
  const result = await attemptRenewal(player, teamId, offeredSalary, years, currentSeasonId, teamMorale);

  if (result.success) {
    return { ...result, counterState: null };
  }

  if (attempt >= 3) {
    return { ...result, counterState: null };
  }

  return {
    ...result,
    counterState: {
      attempt,
      maxAttempts: 3,
      lastOfferedSalary: offeredSalary,
      difficulty: calculateRenewalDifficulty(player, 50),
    },
  };
}

export function generateDecisionFactors(player: Player): ContractDecisionFactors {
  const ovr = getPlayerOverall(player);
  const age = player.age;
  const clamp = (value: number) => Math.max(0, Math.min(100, value));

  let money = 50;
  let winning = 50;
  let playtime = 50;
  let loyalty = 50;
  let reputation = 50;

  if (age <= 20) {
    playtime += 25;
    winning += 10;
    money -= 10;
  } else if (age >= 27) {
    winning += 20;
    loyalty += 15;
    playtime -= 10;
  } else {
    money += 10;
    winning += 10;
  }

  if (ovr >= 80) {
    money += 15;
    reputation += 15;
  } else if (ovr < 60) {
    playtime += 15;
  }

  const mentalOffset = (player.mental.mental - 50) / 10;
  loyalty += Math.round(mentalOffset * 3);
  winning += Math.round(mentalOffset * 2);

  return {
    money: clamp(money),
    winning: clamp(winning),
    playtime: clamp(playtime),
    loyalty: clamp(loyalty),
    reputation: clamp(reputation),
  };
}

export function evaluateTeam(
  player: Player,
  factors: ContractDecisionFactors,
  teamInfo: {
    reputation: number;
    recentWinRate: number;
    rosterStrength: number;
    isCurrentTeam: boolean;
    positionCompetitorOvr: number;
  },
  offeredSalary: number,
): TeamEvaluation {
  const fairSalary = calculateFairSalary(player);
  const reasons: string[] = [];

  const salaryRatio = offeredSalary / Math.max(fairSalary, 1);
  const salaryScore = salaryRatio >= 1.2 ? 90 : salaryRatio >= 1 ? 70 : salaryRatio >= 0.85 ? 50 : 25;
  const winningScore = teamInfo.recentWinRate >= 0.65 ? 85 : teamInfo.recentWinRate >= 0.5 ? 65 : 35;
  const playtimeScore = teamInfo.positionCompetitorOvr <= 0
    ? 95
    : getPlayerOverall(player) >= teamInfo.positionCompetitorOvr
      ? 75
      : 35;
  const loyaltyScore = teamInfo.isCurrentTeam ? 70 + Math.round(player.mental.morale * 0.2) : 35;
  const reputationScore = teamInfo.reputation >= 80 ? 90 : teamInfo.reputation >= 60 ? 70 : teamInfo.reputation >= 40 ? 50 : 25;

  if (salaryScore >= 70) reasons.push('Competitive salary');
  if (winningScore >= 65) reasons.push('Strong chance to win');
  if (playtimeScore >= 70) reasons.push('Path to playtime');
  if (teamInfo.isCurrentTeam) reasons.push('Familiar environment');
  if (reputationScore >= 70) reasons.push('Brand and reputation');

  const totalWeight = factors.money + factors.winning + factors.playtime + factors.loyalty + factors.reputation;
  const overall = Math.round(
    (salaryScore * factors.money +
      winningScore * factors.winning +
      playtimeScore * factors.playtime +
      loyaltyScore * factors.loyalty +
      reputationScore * factors.reputation) / Math.max(1, totalWeight),
  );

  return {
    overall,
    salaryScore,
    winningScore,
    playtimeScore,
    loyaltyScore,
    reputationScore,
    reasons,
  };
}

export function generatePlayerCounterOffer(
  player: Player,
  factors: ContractDecisionFactors,
  teamOffer: { salary: number; years: number; signingBonus: number },
  evaluation: TeamEvaluation,
): { salary: number; years: number; signingBonus: number; message: string } {
  const demand = evaluatePlayerDemand(player);
  let salary = demand.idealSalary;
  if (evaluation.overall >= 75) salary = Math.round(salary * 0.92);
  else if (evaluation.overall < 45) salary = Math.round(salary * 1.1);

  salary = Math.max(salary, teamOffer.salary);
  const years = player.age >= 27 ? 1 : Math.min(2, Math.max(1, teamOffer.years));
  const signingBonus = factors.money >= 60 ? Math.round(salary * 0.1) : 0;
  const message = evaluation.overall >= 70
    ? '좋은 프로젝트지만 조건을 조금 더 올려주길 바랍니다.'
    : '현재 제안만으로는 부족합니다. 조건 개선이 필요합니다.';

  return { salary, years, signingBonus, message };
}

async function appendNegotiationMessage(
  negotiationId: number,
  messages: NegotiationMessage[],
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE contract_negotiations SET messages = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [JSON.stringify(messages), negotiationId],
  );
}

export async function createNegotiation(params: {
  seasonId: number;
  playerId: string;
  teamId: string;
  initiator: NegotiationInitiator;
  teamSalary: number;
  teamYears: number;
  teamSigningBonus?: number;
  factors: ContractDecisionFactors;
}): Promise<ContractNegotiation> {
  const db = await getDatabase();
  const existing = await db.select<NegotiationRow[]>(
    `SELECT *
     FROM contract_negotiations
     WHERE player_id = $1 AND team_id = $2 AND status IN ('pending', 'in_progress')
     ORDER BY id DESC
     LIMIT 1`,
    [params.playerId, params.teamId],
  );
  if (existing[0]) return mapRowToNegotiation(existing[0]);

  const firstMessage: NegotiationMessage = {
    round: 1,
    from: params.initiator === 'team_to_player' ? 'team' : 'player',
    text: `Opening proposal: ${params.teamSalary.toLocaleString()} / ${params.teamYears}y`,
    salary: params.teamSalary,
    years: params.teamYears,
    signingBonus: params.teamSigningBonus ?? 0,
    timestamp: new Date().toISOString(),
  };

  const result = await db.execute(
    `INSERT INTO contract_negotiations (
      season_id, player_id, team_id, initiator, status, current_round,
      team_salary, team_years, team_signing_bonus,
      factor_money, factor_winning, factor_playtime, factor_loyalty, factor_reputation,
      messages
    ) VALUES ($1, $2, $3, $4, 'in_progress', 1, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      params.seasonId,
      params.playerId,
      params.teamId,
      params.initiator,
      params.teamSalary,
      params.teamYears,
      params.teamSigningBonus ?? 0,
      params.factors.money,
      params.factors.winning,
      params.factors.playtime,
      params.factors.loyalty,
      params.factors.reputation,
      JSON.stringify([firstMessage]),
    ],
  );

  const rows = await db.select<NegotiationRow[]>('SELECT * FROM contract_negotiations WHERE id = $1', [result.lastInsertId]);
  return mapRowToNegotiation(rows[0]);
}

export async function respondToNegotiation(
  negotiationId: number,
  response: 'accept' | 'reject' | 'counter',
  counterOffer?: { salary: number; years: number; signingBonus?: number },
  message?: string,
): Promise<ContractNegotiation> {
  const db = await getDatabase();
  const rows = await db.select<NegotiationRow[]>('SELECT * FROM contract_negotiations WHERE id = $1', [negotiationId]);
  if (!rows[0]) throw new Error('Negotiation not found');

  const negotiation = mapRowToNegotiation(rows[0]);
  const messages = [...negotiation.messages];

  if (response === 'accept') {
    const finalSalary = counterOffer?.salary ?? negotiation.teamSalary;
    const finalYears = counterOffer?.years ?? negotiation.teamYears;
    const finalSigningBonus = counterOffer?.signingBonus ?? negotiation.teamSigningBonus;
    messages.push({
      round: negotiation.currentRound,
      from: negotiation.initiator === 'team_to_player' ? 'player' : 'team',
      text: message ?? 'Accepted.',
      salary: finalSalary,
      years: finalYears,
      signingBonus: finalSigningBonus,
      timestamp: new Date().toISOString(),
    });
    await db.execute(
      `UPDATE contract_negotiations
       SET status = 'accepted',
           final_salary = $1,
           final_years = $2,
           final_signing_bonus = $3,
           messages = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [finalSalary, finalYears, finalSigningBonus, JSON.stringify(messages), negotiationId],
    );
  } else if (response === 'reject') {
    messages.push({
      round: negotiation.currentRound,
      from: negotiation.initiator === 'team_to_player' ? 'player' : 'team',
      text: message ?? 'Rejected.',
      timestamp: new Date().toISOString(),
    });
    await db.execute(
      `UPDATE contract_negotiations
       SET status = 'rejected',
           messages = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(messages), negotiationId],
    );
  } else {
    if (!counterOffer) throw new Error('Counter offer required');
    const nextRound = negotiation.currentRound + 1;
    messages.push({
      round: nextRound,
      from: negotiation.initiator === 'team_to_player' ? 'player' : 'team',
      text: message ?? 'Counter offer submitted.',
      salary: counterOffer.salary,
      years: counterOffer.years,
      signingBonus: counterOffer.signingBonus ?? 0,
      timestamp: new Date().toISOString(),
    });
    await db.execute(
      `UPDATE contract_negotiations
       SET current_round = $1,
           player_salary = $2,
           player_years = $3,
           player_signing_bonus = $4,
           messages = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [nextRound, counterOffer.salary, counterOffer.years, counterOffer.signingBonus ?? 0, JSON.stringify(messages), negotiationId],
    );
  }

  await appendNegotiationMessage(negotiationId, messages);
  const updated = await db.select<NegotiationRow[]>('SELECT * FROM contract_negotiations WHERE id = $1', [negotiationId]);
  return mapRowToNegotiation(updated[0]);
}

export async function getTeamNegotiations(teamId: string, seasonId: number): Promise<ContractNegotiation[]> {
  const db = await getDatabase();
  const rows = await db.select<NegotiationRow[]>(
    'SELECT * FROM contract_negotiations WHERE team_id = $1 AND season_id = $2 ORDER BY updated_at DESC, id DESC',
    [teamId, seasonId],
  );
  return rows.map(mapRowToNegotiation);
}

export async function getPlayerNegotiations(playerId: string, seasonId: number): Promise<ContractNegotiation[]> {
  const db = await getDatabase();
  const rows = await db.select<NegotiationRow[]>(
    'SELECT * FROM contract_negotiations WHERE player_id = $1 AND season_id = $2 ORDER BY updated_at DESC, id DESC',
    [playerId, seasonId],
  );
  return rows.map(mapRowToNegotiation);
}

export async function finalizeNegotiation(
  negotiation: ContractNegotiation,
  currentSeasonId: number,
): Promise<RenewalResult> {
  if (negotiation.status !== 'accepted' || !negotiation.finalSalary || !negotiation.finalYears) {
    return { success: false, reason: 'Accepted negotiation required.' };
  }

  const existingPlayer = await getPlayerById(negotiation.playerId);
  const currentSalary = existingPlayer?.contract.salary ?? 0;
  const snapshot = await getTeamPayrollSnapshot(negotiation.teamId);
  const projectedPayroll = snapshot.totalPayroll - currentSalary + negotiation.finalSalary;
  const payrollCheck = await canAbsorbPayroll(negotiation.teamId, projectedPayroll);

  if (!payrollCheck.allowed) {
    return { success: false, reason: '샐러리캡 초과 폭이 너무 커서 보드가 승인을 거부합니다.' };
  }

  const contractEndSeason = currentSeasonId + negotiation.finalYears * 2;
  await updatePlayerContract(negotiation.playerId, negotiation.finalSalary, contractEndSeason);

  if (negotiation.finalSigningBonus && negotiation.finalSigningBonus > 0) {
    const db = await getDatabase();
    await db.execute('UPDATE teams SET budget = budget - $1 WHERE id = $2', [
      negotiation.finalSigningBonus,
      negotiation.teamId,
    ]);
    const { addClause } = await import('./clauseEngine');
    await addClause(negotiation.playerId, 'signing_bonus', negotiation.finalSigningBonus, `Season ${currentSeasonId} signing bonus`);
  }

  return {
    success: true,
    reason: `계약 체결: ${negotiation.finalSalary.toLocaleString()} / ${negotiation.finalYears}년`,
  };
}

export async function aiPlayerRespondToOffer(
  negotiation: ContractNegotiation,
  player: Player,
  teamInfo: {
    reputation: number;
    recentWinRate: number;
    rosterStrength: number;
    positionCompetitorOvr: number;
  },
): Promise<ContractNegotiation> {
  const evaluation = evaluateTeam(
    player,
    negotiation.factors,
    { ...teamInfo, isCurrentTeam: true },
    negotiation.teamSalary,
  );

  if (evaluation.overall >= 65) {
    return respondToNegotiation(
      negotiation.id,
      'accept',
      {
        salary: negotiation.teamSalary,
        years: negotiation.teamYears,
        signingBonus: negotiation.teamSigningBonus,
      },
      'The player accepts the current terms.',
    );
  }

  if (evaluation.overall < 35) {
    return respondToNegotiation(negotiation.id, 'reject', undefined, 'The player rejects the current terms.');
  }

  const counter = generatePlayerCounterOffer(
    player,
    negotiation.factors,
    {
      salary: negotiation.teamSalary,
      years: negotiation.teamYears,
      signingBonus: negotiation.teamSigningBonus,
    },
    evaluation,
  );

  return respondToNegotiation(
    negotiation.id,
    'counter',
    { salary: counter.salary, years: counter.years, signingBonus: counter.signingBonus },
    counter.message,
  );
}

export async function playerRequestContract(params: {
  seasonId: number;
  playerId: string;
  teamId: string;
  requestedSalary: number;
  requestedYears: number;
}): Promise<ContractNegotiation> {
  const player = await getPlayerById(params.playerId);
  const factors = player
    ? generateDecisionFactors(player)
    : { money: 50, winning: 50, playtime: 50, loyalty: 50, reputation: 50 };

  return createNegotiation({
    seasonId: params.seasonId,
    playerId: params.playerId,
    teamId: params.teamId,
    initiator: 'player_to_team',
    teamSalary: params.requestedSalary,
    teamYears: params.requestedYears,
    factors,
  });
}

export async function aiTeamRespondToRequest(
  negotiation: ContractNegotiation,
  player: Player,
): Promise<ContractNegotiation> {
  const fairSalary = calculateFairSalary(player);
  const snapshot = await getTeamPayrollSnapshot(negotiation.teamId);
  const projectedPayroll = snapshot.totalPayroll + negotiation.teamSalary;
  const payrollCheck = await canAbsorbPayroll(negotiation.teamId, projectedPayroll);

  if (!payrollCheck.allowed) {
    return respondToNegotiation(
      negotiation.id,
      'reject',
      undefined,
      '샐러리캡 초과 폭이 너무 커서 이 조건은 수용할 수 없습니다.',
    );
  }

  if (negotiation.teamSalary <= fairSalary * 1.05) {
    return respondToNegotiation(
      negotiation.id,
      'accept',
      {
        salary: negotiation.teamSalary,
        years: negotiation.teamYears,
        signingBonus: negotiation.teamSigningBonus,
      },
      'The team accepts the player request.',
    );
  }

  if (negotiation.teamSalary > fairSalary * 1.3) {
    return respondToNegotiation(negotiation.id, 'reject', undefined, 'The requested salary is too high.');
  }

  return respondToNegotiation(
    negotiation.id,
    'counter',
    {
      salary: Math.round(fairSalary * 1.05),
      years: Math.min(2, negotiation.teamYears),
      signingBonus: 0,
    },
    'The team responds with a lower contract offer.',
  );
}
