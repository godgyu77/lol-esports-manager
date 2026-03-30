import type { Player } from '../../types/player';
import { getDatabase } from '../../db/database';
import {
  getExpiringContracts,
  getFreeAgents as dbGetFreeAgents,
  getPlayerById,
  getTransferOffers,
  insertFinanceLog,
  updatePlayerContract,
  updatePlayerTeam,
  updateTransferOfferStatus,
  type TransferOffer,
} from '../../db/queries';
import { initializeTeamChemistry } from '../chemistry/chemistryEngine';
import { calculateAgentFee } from './transferValuation';

export async function acceptTransferOffer(
  offer: TransferOffer,
  currentSeasonId: number,
  resolvedDate: string,
): Promise<void> {
  const db = await getDatabase();

  await updateTransferOfferStatus(offer.id, 'accepted', resolvedDate);
  await updatePlayerTeam(offer.playerId, offer.fromTeamId);

  const contractEndSeason = currentSeasonId + (offer.contractYears * 2);
  await updatePlayerContract(offer.playerId, offer.offeredSalary, contractEndSeason);

  if (offer.transferFee > 0 && offer.toTeamId) {
    const agentFee = calculateAgentFee(offer.transferFee);

    await db.execute(
      'UPDATE teams SET budget = budget - $1 WHERE id = $2',
      [offer.transferFee + agentFee, offer.fromTeamId],
    );
    await insertFinanceLog(
      offer.fromTeamId, offer.seasonId, resolvedDate,
      'expense', 'transfer', offer.transferFee,
      `선수 이적료 지급 (${offer.playerId})`,
    );
    if (agentFee > 0) {
      await insertFinanceLog(
        offer.fromTeamId, offer.seasonId, resolvedDate,
        'expense', 'agent_fee', agentFee,
        `에이전트 수수료 (${offer.playerId})`,
      );
    }

    await db.execute(
      'UPDATE teams SET budget = budget + $1 WHERE id = $2',
      [offer.transferFee, offer.toTeamId],
    );
    await insertFinanceLog(
      offer.toTeamId, offer.seasonId, resolvedDate,
      'income', 'transfer', offer.transferFee,
      `선수 이적료 수입 (${offer.playerId})`,
    );
  }

  try {
    await initializeTeamChemistry(offer.fromTeamId);
  } catch {
    void 0;
  }

  try {
    const { generateTransferCompleteNews } = await import('../news/newsEngine');
    const playerRows = await db.select<{ name: string }[]>('SELECT name FROM players WHERE id = $1', [offer.playerId]);
    const buyerTeamRows = await db.select<{ name: string }[]>('SELECT name FROM teams WHERE id = $1', [offer.fromTeamId]);
    const sellerTeamRows = await db.select<{ name: string }[]>('SELECT name FROM teams WHERE id = $1', [offer.toTeamId ?? '']);
    const playerName = playerRows[0]?.name ?? offer.playerId;
    const buyerTeamName = buyerTeamRows[0]?.name ?? offer.fromTeamId;
    const sellerTeamName = sellerTeamRows[0]?.name ?? (offer.toTeamId ?? 'FA');

    await generateTransferCompleteNews(
      offer.seasonId,
      resolvedDate,
      playerName,
      sellerTeamName,
      buyerTeamName,
      offer.transferFee,
      offer.fromTeamId,
      offer.playerId,
    );
  } catch {
    void 0;
  }
}

export async function rejectTransferOffer(
  offerId: number,
  resolvedDate: string,
): Promise<void> {
  await updateTransferOfferStatus(offerId, 'rejected', resolvedDate);
}

export async function cancelTransferOffer(
  offerId: number,
  resolvedDate: string,
): Promise<void> {
  await updateTransferOfferStatus(offerId, 'cancelled', resolvedDate);
}

export async function acceptFreeAgentOffer(
  offer: TransferOffer,
  currentSeasonId: number,
  resolvedDate: string,
): Promise<void> {
  const db = await getDatabase();

  await updateTransferOfferStatus(offer.id, 'accepted', resolvedDate);
  await updatePlayerTeam(offer.playerId, offer.fromTeamId);

  const contractEndSeason = currentSeasonId + (offer.contractYears * 2);
  await updatePlayerContract(offer.playerId, offer.offeredSalary, contractEndSeason);

  const signingFee = Math.round(offer.offeredSalary * 0.5);
  const agentFee = calculateAgentFee(signingFee);
  const totalCost = signingFee + agentFee;

  if (totalCost > 0) {
    await db.execute(
      'UPDATE teams SET budget = budget - $1 WHERE id = $2',
      [totalCost, offer.fromTeamId],
    );
    await insertFinanceLog(
      offer.fromTeamId, offer.seasonId, resolvedDate,
      'expense', 'transfer', signingFee,
      `FA 선수 계약금 (${offer.playerId})`,
    );
    if (agentFee > 0) {
      await insertFinanceLog(
        offer.fromTeamId, offer.seasonId, resolvedDate,
        'expense', 'agent_fee', agentFee,
        `FA 에이전트 수수료 (${offer.playerId})`,
      );
    }
  }

  try {
    await initializeTeamChemistry(offer.fromTeamId);
  } catch {
    void 0;
  }
}

export async function processExpiredContracts(seasonId: number): Promise<string[]> {
  const expiring = await getExpiringContracts(seasonId);
  const freedPlayerIds: string[] = [];

  for (const player of expiring) {
    await updatePlayerTeam(player.id, null);
    freedPlayerIds.push(player.id);
  }

  return freedPlayerIds;
}

export async function getTeamTransferOffers(
  seasonId: number,
  teamId: string,
): Promise<{ sent: TransferOffer[]; received: TransferOffer[] }> {
  const allOffers = await getTransferOffers(seasonId);

  return {
    sent: allOffers.filter(o => o.fromTeamId === teamId),
    received: allOffers.filter(o => o.toTeamId === teamId),
  };
}

export async function getFreeAgents(): Promise<Player[]> {
  return dbGetFreeAgents();
}

export async function getPlayerForAgent(playerId: string): Promise<Player> {
  const player = await getPlayerById(playerId);
  if (player) return player;

  return {
    id: playerId,
    name: 'Unknown',
    teamId: null,
    position: 'mid',
    age: 22,
    nationality: 'KR',
    stats: { mechanical: 60, gameSense: 60, teamwork: 60, consistency: 60, laning: 60, aggression: 60 },
    mental: { mental: 50, stamina: 50, morale: 50 },
    contract: { salary: 1000, contractEndSeason: 1 },
    championPool: [],
    potential: 50,
    peakAge: 23,
    popularity: 30,
    secondaryPosition: null,
    playstyle: 'versatile',
    careerGames: 0,
    chemistry: {},
    formHistory: [],
  };
}
