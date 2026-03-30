import {
  createTransferOffer,
  getPlayerById,
  getTeamTotalSalary,
} from '../../db/queries';
import { getDatabase } from '../../db/database';
import { agentNegotiate } from '../agent/agentEngine';
import { canSignForeignPlayer } from '../rules/leagueRulesEngine';
import type { Region } from '../../types/game';
import {
  AI_TRANSFER_ATTEMPT_RATE,
  calculateAgentFee,
  calculateFairSalary,
  calculatePlayerValue,
  findWeakestPosition,
  getAgeFactor,
  POSITIONS,
  SALARY_CAP,
  WEAK_POSITION_THRESHOLD,
} from './transferValuation';
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
  SALARY_CAP,
  WEAK_POSITION_THRESHOLD,
};

export interface TransferValidation {
  valid: boolean;
  reason?: string;
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

  const currentTotalSalary = await getTeamTotalSalary(fromTeamId);
  const player = await getPlayerById(playerId);
  const departingPlayerSalary = player && player.teamId === fromTeamId ? player.contract.salary : 0;
  const projectedSalary = currentTotalSalary - departingPlayerSalary + offeredSalary;
  if (projectedSalary > SALARY_CAP) {
    return {
      valid: false,
      reason: `Salary cap exceeded: ${projectedSalary.toLocaleString()} > ${SALARY_CAP.toLocaleString()}.`,
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

  const fairSalary = calculateFairSalary(await getPlayerForAgent(params.playerId));
  const agentResult = await agentNegotiate(params.playerId, params.offeredSalary, fairSalary);

  if (!agentResult.accepted) {
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

  const fairSalary = calculateFairSalary(await getPlayerForAgent(params.playerId));
  const agentResult = await agentNegotiate(params.playerId, params.offeredSalary, fairSalary);

  if (!agentResult.accepted) {
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
