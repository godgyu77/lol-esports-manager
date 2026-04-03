import {
  createTransferOffer,
  getActiveSeason,
  getPlayerById,
  getPlayersByTeamId,
  updateTransferOfferTerms,
} from '../../db/queries';
import { getDatabase } from '../../db/database';
import { agentNegotiate } from '../agent/agentEngine';
import { canSignForeignPlayer } from '../rules/leagueRulesEngine';
import type { Region } from '../../types/game';
import type { Player } from '../../types/player';
import {
  AI_TRANSFER_ATTEMPT_RATE,
  calculateAgentFee,
  calculateFairSalary,
  calculatePlayerValue,
  findWeakestPosition,
  getAgeFactor,
  POSITIONS,
  WEAK_POSITION_THRESHOLD,
} from './transferValuation';
import { evaluatePayrollImpact, getTeamPayrollSnapshot } from './payrollEngine';
import {
  acceptFreeAgentOffer,
  acceptTransferOffer,
  cancelTransferOffer,
  getFreeAgents,
  getPlayerForAgent,
  getTeamTransferOffers,
  processExpiredContracts,
  rejectTransferOffer,
} from './transferTransactions';
import {
  processAIFreeAgentSignings,
  processAITransfers,
} from './transferAi';
import { recordNegotiationExpense } from '../manager/systemDepthEngine';
import { getRelationshipInfluenceSnapshot } from '../manager/releaseDepthEngine';

export {
  AI_TRANSFER_ATTEMPT_RATE,
  acceptFreeAgentOffer,
  acceptTransferOffer,
  calculateAgentFee,
  calculateFairSalary,
  calculatePlayerValue,
  cancelTransferOffer,
  findWeakestPosition,
  getAgeFactor,
  getFreeAgents,
  getTeamTransferOffers,
  POSITIONS,
  processAIFreeAgentSignings,
  processAITransfers,
  processExpiredContracts,
  rejectTransferOffer,
  WEAK_POSITION_THRESHOLD,
};

export interface TransferValidation {
  valid: boolean;
  reason?: string;
}

export interface TransferNegotiationEvaluation {
  accepted: boolean;
  reason: string;
  counterOffer?: {
    transferFee: number;
    offeredSalary: number;
    contractYears: number;
  };
}

function roundOfferAmount(value: number): number {
  return Math.max(0, Math.round(value / 100) * 100);
}

function calculateContactCost(transferFee: number, offeredSalary: number): number {
  return Math.max(100, Math.round(offeredSalary * 0.05 + transferFee * 0.01));
}

function calculateFailureCost(contactCost: number): number {
  return Math.max(75, Math.round(contactCost * 0.65));
}

type SellingClubStance = 'closed' | 'reluctant' | 'open';

interface ContractTransferContext {
  stance: SellingClubStance;
  premiumMultiplier: number;
  salaryMultiplier: number;
  minimumYears: number;
  reason: string;
}

function getPlayerRelationshipTransferModifier(
  playerName: string,
  relationshipSnapshot: Awaited<ReturnType<typeof getRelationshipInfluenceSnapshot>> | null,
): {
  premiumDelta: number;
  salaryDelta: number;
  reasonSuffix: string;
} {
  if (!relationshipSnapshot) {
    return { premiumDelta: 0, salaryDelta: 0, reasonSuffix: '' };
  }

  const strongPairCount = relationshipSnapshot.strongPairs.filter((pair) => pair.names.includes(playerName)).length;
  const mentorLinkCount = relationshipSnapshot.mentorLinks.filter((pair) => pair.names.includes(playerName)).length;
  const riskPairCount = relationshipSnapshot.riskPairs.filter((pair) => pair.names.includes(playerName)).length;

  if (strongPairCount === 0 && mentorLinkCount === 0 && riskPairCount === 0) {
    return { premiumDelta: 0, salaryDelta: 0, reasonSuffix: '' };
  }

  return {
    premiumDelta: strongPairCount * 0.45 + mentorLinkCount * 0.3 - riskPairCount * 0.35,
    salaryDelta: strongPairCount * 0.05 + mentorLinkCount * 0.03 - riskPairCount * 0.04,
    reasonSuffix:
      strongPairCount > riskPairCount
        ? ' 핵심 듀오와 멘토 축이 있어 판매 저항이 더 강합니다.'
        : riskPairCount > 0
          ? ' 라커룸 마찰이 있어 완전 불가보다는 대화 여지가 조금 더 있습니다.'
          : '',
  };
}

async function getContractTransferContext(teamId: string, playerId: string): Promise<ContractTransferContext> {
  const db = await getDatabase();
  const [player, activeSeason, roster, relationshipSnapshot] = await Promise.all([
    getPlayerById(playerId),
    getActiveSeason().catch(() => null),
    getPlayersByTeamId(teamId),
    getRelationshipInfluenceSnapshot(teamId).catch(() => null),
  ]);

  if (!player || player.teamId !== teamId) {
    return {
      stance: 'open',
      premiumMultiplier: 1,
      salaryMultiplier: 1,
      minimumYears: 2,
      reason: '시장에 나온 선수입니다.',
    };
  }

  const division = (player as Player & { division?: string }).division ?? null;
  const samePositionPlayers = roster.filter((candidate) => candidate.position === player.position);
  const strongestAtPosition = samePositionPlayers.every((candidate) => calculatePlayerValue(candidate) <= calculatePlayerValue(player));
  const expiringSoon = activeSeason ? player.contract.contractEndSeason <= activeSeason.id + 1 : false;
  const lowMorale = player.mental.morale <= 25;
  const isBenchPlayer = division === 'sub';
  const relationshipModifier = getPlayerRelationshipTransferModifier(player.name, relationshipSnapshot);

  const [transferComplaints, playerRequests] = await Promise.all([
    db.select<{ severity: number }[]>(
      `SELECT severity
       FROM player_complaints
       WHERE player_id = $1
         AND team_id = $2
         AND complaint_type = 'transfer'
         AND status = 'active'
       ORDER BY severity DESC`,
      [playerId, teamId],
    ),
    db.select<{ id: number }[]>(
      `SELECT id
       FROM transfer_offers
       WHERE player_id = $1
         AND to_team_id = $2
         AND status = 'player_request'`,
      [playerId, teamId],
    ),
  ]);

  const transferSeverity = transferComplaints[0]?.severity ?? 0;
  const hasTransferRequest = playerRequests.length > 0 || transferSeverity >= 2;

  if (hasTransferRequest) {
    return {
      stance: 'open',
      premiumMultiplier: Math.max(1.4, (strongestAtPosition ? 2.1 : 1.7) + relationshipModifier.premiumDelta * 0.4),
      salaryMultiplier: Math.max(1.08, 1.18 + relationshipModifier.salaryDelta * 0.5),
      minimumYears: 2,
      reason: '선수가 이적을 원하고 있어 협상은 가능하지만, 여전히 큰 프리미엄이 필요합니다.',
    };
  }

  if ((isBenchPlayer && expiringSoon) || (isBenchPlayer && lowMorale)) {
    return {
      stance: 'reluctant',
      premiumMultiplier:
        Math.max(2.1, (strongestAtPosition ? 3.2 : 2.8) + Math.max(0, (relationshipSnapshot?.transferImpact ?? 0) * 0.02) + relationshipModifier.premiumDelta),
      salaryMultiplier: Math.max(1.18, 1.28 + relationshipModifier.salaryDelta),
      minimumYears: 2,
      reason: '계약이 남은 선수라 기본적으로는 판매 대상이 아닙니다. 매우 큰 보상이 있어야만 대화가 가능합니다.',
    };
  }

  return {
    stance: 'closed',
    premiumMultiplier:
      Math.max(3.8, (strongestAtPosition ? 5 : 4.2) + Math.max(0, (relationshipSnapshot?.transferImpact ?? 0) * 0.03) + relationshipModifier.premiumDelta),
    salaryMultiplier: Math.max(1.3, 1.45 + relationshipModifier.salaryDelta),
    minimumYears: 3,
    reason: 'LoL 팀은 계약이 남은 핵심 선수를 거의 시장에 내놓지 않습니다. 이 선수는 사실상 협상 불가입니다.',
  };
}

async function getNegotiationThresholds(teamId: string, playerId: string): Promise<{
  stance: SellingClubStance;
  minTransferFee: number;
  minSalary: number;
  contractYears: number;
  reason: string;
}> {
  const [player, roster] = await Promise.all([
    getPlayerById(playerId),
    getPlayersByTeamId(teamId),
  ]);

  if (!player) {
    return {
      stance: 'open',
      minTransferFee: 0,
      minSalary: 0,
      contractYears: 2,
      reason: '선수 정보를 찾을 수 없습니다.',
    };
  }

  const contractContext = await getContractTransferContext(teamId, playerId);
  const marketValue = calculatePlayerValue(player);
  const fairSalary = calculateFairSalary(player);
  const samePositionCount = roster.filter((candidate) => candidate.position === player.position).length;
  const scarcityMultiplier = samePositionCount <= 1 ? 1.35 : samePositionCount === 2 ? 1.18 : 1.0;

  return {
    stance: contractContext.stance,
    minTransferFee: roundOfferAmount(marketValue * scarcityMultiplier * contractContext.premiumMultiplier),
    minSalary: roundOfferAmount(fairSalary * contractContext.salaryMultiplier),
    contractYears: Math.max(contractContext.minimumYears, 2),
    reason: contractContext.reason,
  };
}

export async function evaluateIncomingTransferOffer(offer: {
  teamId: string;
  playerId: string;
  transferFee: number;
  offeredSalary: number;
  contractYears: number;
}): Promise<TransferNegotiationEvaluation> {
  const thresholds = await getNegotiationThresholds(offer.teamId, offer.playerId);
  if (thresholds.stance === 'closed') {
    return {
      accepted: false,
      reason: thresholds.reason,
    };
  }
  const feeGap = thresholds.minTransferFee - offer.transferFee;
  const salaryGap = thresholds.minSalary - offer.offeredSalary;

  if (feeGap <= 0 && salaryGap <= 0) {
    return {
      accepted: true,
      reason: '현재 조건이면 상대 구단과 선수 측이 모두 합의할 가능성이 높습니다.',
    };
  }

  const severeLowball = feeGap > thresholds.minTransferFee * (thresholds.stance === 'reluctant' ? 0.15 : 0.3);
  const counterOffer = {
    transferFee: roundOfferAmount(Math.max(offer.transferFee, thresholds.minTransferFee)),
    offeredSalary: roundOfferAmount(Math.max(offer.offeredSalary, thresholds.minSalary)),
    contractYears: Math.max(offer.contractYears, thresholds.contractYears),
  };

  return {
    accepted: false,
    reason: severeLowball
      ? '현재 제안은 시장가보다 낮아 바로 수락하기 어렵습니다. 더 높은 이적료가 필요합니다.'
      : '조건을 조금 더 올리면 협상이 가능합니다.',
    counterOffer,
  };
}

export async function evaluateOutgoingTransferCounter(params: {
  fromTeamId: string;
  toTeamId: string;
  playerId: string;
  transferFee: number;
  offeredSalary: number;
  contractYears: number;
}): Promise<TransferNegotiationEvaluation> {
  return evaluateIncomingTransferOffer({
    teamId: params.toTeamId,
    playerId: params.playerId,
    transferFee: params.transferFee,
    offeredSalary: params.offeredSalary,
    contractYears: params.contractYears,
  });
}

export async function respondToIncomingTransferOffer(
  offer: {
    id: number;
    seasonId: number;
    fromTeamId: string;
    toTeamId: string | null;
    playerId: string;
    transferFee: number;
    offeredSalary: number;
    contractYears: number;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'player_request';
    offerDate: string;
  },
  currentSeasonId: number,
  resolvedDate: string,
  action: 'accept' | 'reject' | 'counter',
  counterOffer?: {
    transferFee: number;
    offeredSalary: number;
    contractYears: number;
  },
): Promise<TransferNegotiationEvaluation> {
  if (action === 'reject') {
    await rejectTransferOffer(offer.id, resolvedDate);
    return {
      accepted: false,
      reason: '제안을 거절했습니다.',
    };
  }

  if (action === 'accept') {
    await acceptTransferOffer(offer, currentSeasonId, resolvedDate);
    return {
      accepted: true,
      reason: '제안을 수락했습니다.',
    };
  }

  if (!offer.toTeamId || !counterOffer) {
    return {
      accepted: false,
      reason: '카운터 제안 조건이 올바르지 않습니다.',
    };
  }

  const evaluation = await evaluateIncomingTransferOffer({
    teamId: offer.toTeamId,
    playerId: offer.playerId,
    transferFee: counterOffer.transferFee,
    offeredSalary: counterOffer.offeredSalary,
    contractYears: counterOffer.contractYears,
  });

  if (!evaluation.accepted) {
    return evaluation;
  }

  await updateTransferOfferTerms(
    offer.id,
    counterOffer.transferFee,
    counterOffer.offeredSalary,
    counterOffer.contractYears,
  );

  await acceptTransferOffer(
    {
      ...offer,
      transferFee: counterOffer.transferFee,
      offeredSalary: counterOffer.offeredSalary,
      contractYears: counterOffer.contractYears,
    },
    currentSeasonId,
    resolvedDate,
  );

  return {
    accepted: true,
    reason: '카운터 조건이 받아들여졌습니다.',
  };
}

export async function validateTransferOffer(
  fromTeamId: string,
  playerId: string,
  transferFee: number,
  offeredSalary: number,
): Promise<TransferValidation> {
  const db = await getDatabase();
  const teamRows = await db.select<{ budget: number; region: string }[]>(
    'SELECT budget, region FROM teams WHERE id = $1',
    [fromTeamId],
  );

  if (!teamRows.length) {
    return { valid: false, reason: 'Team not found.' };
  }

  const teamBudget = teamRows[0].budget;
  const teamRegion = teamRows[0].region as Region;

  const agentFee = calculateAgentFee(transferFee);
  const totalCost = transferFee + agentFee;
  if (teamBudget < totalCost) {
    return {
      valid: false,
      reason: `Insufficient budget. Have ${teamBudget.toLocaleString()}, need ${totalCost.toLocaleString()}.`,
    };
  }

  const payrollSnapshot = await getTeamPayrollSnapshot(fromTeamId);
  const player = await getPlayerById(playerId);
  if (player && player.teamId && player.teamId !== fromTeamId) {
    const contractContext = await getContractTransferContext(player.teamId, player.id);
    if (contractContext.stance === 'closed') {
      return { valid: false, reason: contractContext.reason };
    }
  }
  const departingPlayerSalary = player && player.teamId === fromTeamId ? player.contract.salary : 0;
  const projectedPayroll = payrollSnapshot.totalPayroll - departingPlayerSalary + offeredSalary;
  const payrollImpact = evaluatePayrollImpact({
    totalPayroll: projectedPayroll,
    salaryCap: payrollSnapshot.salaryCap,
  });
  if (payrollImpact.pressureBand === 'hard_stop') {
    return {
      valid: false,
      reason: `Payroll would blow past the cap (${projectedPayroll.toLocaleString()} > ${payrollSnapshot.salaryCap.toLocaleString()}) and the board will not approve it.`,
    };
  }

  const existingOffers = await db.select<{ id: number }[]>(
    `SELECT id FROM transfer_offers
     WHERE from_team_id = $1 AND player_id = $2 AND status = 'pending'`,
    [fromTeamId, playerId],
  );

  if (existingOffers.length > 0) {
    return { valid: false, reason: 'A pending offer already exists for this player.' };
  }

  if (player) {
    const REGION_LOCAL: Record<Region, string[]> = {
      LCK: ['KR'],
      LPL: ['CN'],
      LEC: ['DE', 'FR', 'ES', 'PL', 'SE', 'DK', 'CZ', 'RO', 'BG', 'IT', 'PT', 'NL', 'BE', 'AT', 'GR', 'FI', 'NO', 'HU', 'SK', 'SI', 'HR', 'LT', 'LV', 'EE', 'IE', 'GB', 'EU'],
      LCS: ['US', 'CA', 'NA'],
    };
    const localNats = REGION_LOCAL[teamRegion] ?? [];
    const isForeign = !localNats.includes(player.nationality.toUpperCase());

    if (isForeign) {
      const foreignCheck = await canSignForeignPlayer(fromTeamId, teamRegion);
      if (!foreignCheck.allowed) {
        return { valid: false, reason: foreignCheck.reason ?? 'Foreign player rule violation.' };
      }
    }
  }

  return { valid: true };
}

export async function offerFreeAgent(params: {
  seasonId: number;
  fromTeamId: string;
  playerId: string;
  offeredSalary: number;
  contractYears: number;
  offerDate: string;
}): Promise<{ success: boolean; offerId?: number; reason?: string; agentMessage?: string }> {
  const validation = await validateTransferOffer(
    params.fromTeamId,
    params.playerId,
    0,
    params.offeredSalary,
  );

  if (!validation.valid) {
    return { success: false, reason: validation.reason };
  }

  const contactCost = calculateContactCost(0, params.offeredSalary);
  await recordNegotiationExpense({
    teamId: params.fromTeamId,
    seasonId: params.seasonId,
    gameDate: params.offerDate,
    amount: contactCost,
    category: 'negotiation_contact',
    description: `Initial approach cost for free agent ${params.playerId}`,
  });

  const fairSalary = calculateFairSalary(await getPlayerForAgent(params.playerId));
  const agentResult = await agentNegotiate(params.playerId, params.offeredSalary, fairSalary);

  if (!agentResult.accepted) {
    await recordNegotiationExpense({
      teamId: params.fromTeamId,
      seasonId: params.seasonId,
      gameDate: params.offerDate,
      amount: calculateFailureCost(contactCost),
      category: 'failed_negotiation',
      description: `Failed free-agent negotiation with ${params.playerId}`,
    });
    return {
      success: false,
      reason: agentResult.message,
      agentMessage: `Agent counter salary: ${agentResult.counterOffer.toLocaleString()}`,
    };
  }

  const offerId = await createTransferOffer({
    seasonId: params.seasonId,
    fromTeamId: params.fromTeamId,
    toTeamId: null,
    playerId: params.playerId,
    transferFee: 0,
    offeredSalary: params.offeredSalary,
    contractYears: params.contractYears,
    offerDate: params.offerDate,
  });

  return { success: true, offerId, agentMessage: agentResult.message };
}

export async function offerTransfer(params: {
  seasonId: number;
  fromTeamId: string;
  toTeamId: string;
  playerId: string;
  transferFee: number;
  offeredSalary: number;
  contractYears: number;
  offerDate: string;
}): Promise<{ success: boolean; offerId?: number; reason?: string; agentMessage?: string }> {
  const validation = await validateTransferOffer(
    params.fromTeamId,
    params.playerId,
    params.transferFee,
    params.offeredSalary,
  );

  if (!validation.valid) {
    return { success: false, reason: validation.reason };
  }

  const contactCost = calculateContactCost(params.transferFee, params.offeredSalary);
  await recordNegotiationExpense({
    teamId: params.fromTeamId,
    seasonId: params.seasonId,
    gameDate: params.offerDate,
    amount: contactCost,
    category: 'negotiation_contact',
    description: `Initial transfer approach cost for ${params.playerId}`,
  });

  const fairSalary = calculateFairSalary(await getPlayerForAgent(params.playerId));
  const agentResult = await agentNegotiate(params.playerId, params.offeredSalary, fairSalary);

  if (!agentResult.accepted) {
    await recordNegotiationExpense({
      teamId: params.fromTeamId,
      seasonId: params.seasonId,
      gameDate: params.offerDate,
      amount: calculateFailureCost(contactCost),
      category: 'failed_negotiation',
      description: `Failed transfer negotiation with ${params.playerId}`,
    });
    return {
      success: false,
      reason: agentResult.message,
      agentMessage: `Agent counter salary: ${agentResult.counterOffer.toLocaleString()}`,
    };
  }

  const offerId = await createTransferOffer({
    seasonId: params.seasonId,
    fromTeamId: params.fromTeamId,
    toTeamId: params.toTeamId,
    playerId: params.playerId,
    transferFee: params.transferFee,
    offeredSalary: params.offeredSalary,
    contractYears: params.contractYears,
    offerDate: params.offerDate,
  });

  return { success: true, offerId, agentMessage: agentResult.message };
}

const NATIONALITY_TO_REGION: Record<string, Region> = {
  KR: 'LCK',
  CN: 'LPL',
  EU: 'LEC',
  NA: 'LCS',
  DE: 'LEC',
  FR: 'LEC',
  ES: 'LEC',
  PL: 'LEC',
  SE: 'LEC',
  DK: 'LEC',
  NO: 'LEC',
  FI: 'LEC',
  UK: 'LEC',
  NL: 'LEC',
  US: 'LCS',
  CA: 'LCS',
  TW: 'LPL',
  HK: 'LPL',
};

const LANGUAGE_COMPATIBILITY: Record<Region, Record<Region, number>> = {
  LCK: { LCK: 1.0, LPL: 0.2, LEC: 0.3, LCS: 0.4 },
  LPL: { LCK: 0.2, LPL: 1.0, LEC: 0.2, LCS: 0.3 },
  LEC: { LCK: 0.3, LPL: 0.2, LEC: 1.0, LCS: 0.8 },
  LCS: { LCK: 0.4, LPL: 0.3, LEC: 0.8, LCS: 1.0 },
};

export interface InternationalTransferAssessment {
  visaDifficulty: number;
  visaProcessingDays: number;
  visaDenialRisk: number;
  languageBarrier: number;
  culturalAdaptationDays: number;
  adaptationPerformancePenalty: number;
  homesicknessRisk: number;
  relocationCost: number;
  canTransfer: boolean;
  blockReason?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  summary: string;
}

export function assessInternationalTransfer(
  playerNationality: string,
  playerAge: number,
  fromRegion: Region,
  toRegion: Region,
): InternationalTransferAssessment {
  const playerHomeRegion = NATIONALITY_TO_REGION[playerNationality] ?? fromRegion;
  const isInternational = playerHomeRegion !== toRegion;

  if (!isInternational) {
    return {
      visaDifficulty: 0,
      visaProcessingDays: 0,
      visaDenialRisk: 0,
      languageBarrier: 0,
      culturalAdaptationDays: 0,
      adaptationPerformancePenalty: 0,
      homesicknessRisk: 0,
      relocationCost: 0,
      canTransfer: true,
      riskLevel: 'low',
      summary: 'Domestic move with no adaptation risk.',
    };
  }

  const visaDifficultyMap: Record<Region, number> = {
    LCK: 0.4,
    LPL: 0.6,
    LEC: 0.3,
    LCS: 0.5,
  };
  const visaDifficulty = visaDifficultyMap[toRegion] ?? 0.4;
  const visaProcessingDays = Math.round(7 + visaDifficulty * 23);
  const visaDenialRisk = 0.05 + visaDifficulty * 0.1;

  const langCompat = LANGUAGE_COMPATIBILITY[playerHomeRegion]?.[toRegion] ?? 0.3;
  const languageBarrier = 1 - langCompat;
  const culturalAdaptationDays = Math.round(14 + languageBarrier * 46);
  const adaptationPerformancePenalty = Math.round(languageBarrier * 30) / 100;

  const ageFactor = playerAge <= 20 ? 0.3 : playerAge <= 23 ? 0.15 : 0.05;
  const homesicknessRisk = Math.min(1, languageBarrier * 0.4 + ageFactor);

  const distanceCostMap: Record<string, number> = {
    'LCK->LPL': 500,
    'LPL->LCK': 500,
    'LCK->LEC': 1500,
    'LEC->LCK': 1500,
    'LCK->LCS': 2000,
    'LCS->LCK': 2000,
    'LPL->LEC': 1500,
    'LEC->LPL': 1500,
    'LPL->LCS': 2000,
    'LCS->LPL': 2000,
    'LEC->LCS': 1000,
    'LCS->LEC': 1000,
  };
  const relocationCost = distanceCostMap[`${fromRegion}->${toRegion}`] ?? 1500;

  const riskScore = visaDifficulty * 0.3 + languageBarrier * 0.4 + homesicknessRisk * 0.3;
  let riskLevel: InternationalTransferAssessment['riskLevel'];
  if (riskScore >= 0.7) riskLevel = 'very_high';
  else if (riskScore >= 0.5) riskLevel = 'high';
  else if (riskScore >= 0.3) riskLevel = 'medium';
  else riskLevel = 'low';

  const riskLabels = {
    low: 'low',
    medium: 'medium',
    high: 'high',
    very_high: 'very high',
  };
  const summary = `International transfer ${fromRegion}->${toRegion}: ${riskLabels[riskLevel]} risk, ${Math.round(languageBarrier * 100)}% language barrier, ${culturalAdaptationDays} adaptation days, ${visaProcessingDays} visa days.`;

  return {
    visaDifficulty,
    visaProcessingDays,
    visaDenialRisk,
    languageBarrier,
    culturalAdaptationDays,
    adaptationPerformancePenalty,
    homesicknessRisk,
    relocationCost,
    canTransfer: true,
    riskLevel,
    summary,
  };
}

export interface CulturalAdaptationState {
  playerId: string;
  homeRegion: Region;
  currentRegion: Region;
  adaptationLevel: number;
  daysRemaining: number;
  currentPenalty: number;
  languageProficiency: number;
}

export function advanceCulturalAdaptation(
  state: CulturalAdaptationState,
  hasSameNationalityTeammate: boolean,
  hasSportsPsychologist: boolean,
): CulturalAdaptationState {
  let dailyProgress = 1.5;

  if (hasSameNationalityTeammate) dailyProgress *= 1.5;
  if (hasSportsPsychologist) dailyProgress *= 1.3;

  const newAdaptation = Math.min(100, state.adaptationLevel + dailyProgress);
  const newDaysRemaining = Math.max(0, state.daysRemaining - 1);
  const maxPenalty = state.currentPenalty > 0 ? state.currentPenalty : 0.3;
  const currentPenalty = maxPenalty * (1 - newAdaptation / 100);
  const languageProficiency = Math.min(100, state.languageProficiency + dailyProgress * 0.7);

  return {
    ...state,
    adaptationLevel: Math.round(newAdaptation * 10) / 10,
    daysRemaining: newDaysRemaining,
    currentPenalty: Math.round(currentPenalty * 1000) / 1000,
    languageProficiency: Math.round(languageProficiency * 10) / 10,
  };
}
