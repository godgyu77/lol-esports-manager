import { getDatabase } from '../../db/database';
import {
  createTransferOffer,
  getAllTeams,
  getPlayersByTeamId,
  getFreeAgents as dbGetFreeAgents,
  type TransferOffer,
} from '../../db/queries';
import type { Player } from '../../types/player';
import { agentNegotiate } from '../agent/agentEngine';
import { nextRandom, pickRandom, randomInt, shuffleArray } from '../../utils/random';
import {
  AI_TRANSFER_ATTEMPT_RATE,
  calculateFairSalary,
  calculatePlayerValue,
  findWeakestPosition,
  WEAK_POSITION_THRESHOLD,
} from './transferValuation';
import { evaluatePayrollImpact, getTeamPayrollSnapshot } from './payrollEngine';
import { acceptFreeAgentOffer, acceptTransferOffer } from './transferTransactions';
import { getPlayerOverall } from '../../utils/playerUtils';

export async function processAIFreeAgentSignings(
  seasonId: number,
  currentDate: string,
  userTeamId: string,
): Promise<string[]> {
  const teams = await getAllTeams();
  const freeAgents = await dbGetFreeAgents();
  const signedPlayerIds: string[] = [];

  if (freeAgents.length === 0) return signedPlayerIds;

  const aiTeams = teams.filter(t => t.id !== userTeamId);
  const shuffledTeams = shuffleArray(aiTeams);

  for (const team of shuffledTeams) {
    const roster = await getPlayersByTeamId(team.id);
    const weak = findWeakestPosition(roster);

    if (!weak || weak.currentOvr >= 65) continue;

    const candidates = freeAgents
      .filter(p => p.position === weak.position && !signedPlayerIds.includes(p.id))
      .sort((a, b) => getPlayerOverall(b) - getPlayerOverall(a));

    if (candidates.length === 0) continue;

    const topCandidates = candidates.slice(0, Math.min(3, candidates.length));
    const target = pickRandom(topCandidates);
    const fairSalary = calculateFairSalary(target);
    const payrollSnapshot = await getTeamPayrollSnapshot(team.id);
    const payrollImpact = evaluatePayrollImpact({
      totalPayroll: payrollSnapshot.totalPayroll + fairSalary,
      salaryCap: payrollSnapshot.salaryCap,
    });
    if (payrollImpact.pressureBand === 'hard_stop') continue;
    if (team.budget < fairSalary) continue;

    const agentResult = await agentNegotiate(target.id, fairSalary, fairSalary);
    if (!agentResult.accepted) continue;

    const contractYears = randomInt(1, 2);
    const offerId = await createTransferOffer({
      seasonId,
      fromTeamId: team.id,
      toTeamId: null,
      playerId: target.id,
      transferFee: 0,
      offeredSalary: fairSalary,
      contractYears,
      offerDate: currentDate,
    });

    const offer: TransferOffer = {
      id: offerId,
      seasonId,
      fromTeamId: team.id,
      toTeamId: null,
      playerId: target.id,
      transferFee: 0,
      offeredSalary: fairSalary,
      contractYears,
      status: 'pending',
      offerDate: currentDate,
    };

    await acceptFreeAgentOffer(offer, seasonId, currentDate);
    signedPlayerIds.push(target.id);
  }

  return signedPlayerIds;
}

export async function processAITransfers(
  seasonId: number,
  currentDate: string,
  userTeamId: string,
): Promise<{ fromTeam: string; toTeam: string; playerId: string; playerName: string }[]> {
  const db = await getDatabase();
  const teams = await getAllTeams();
  const completedTransfers: { fromTeam: string; toTeam: string; playerId: string; playerName: string }[] = [];

  const aiTeams = teams.filter(t => t.id !== userTeamId);
  const shuffledTeams = shuffleArray(aiTeams);

  for (const buyingTeam of shuffledTeams) {
    if (nextRandom() >= AI_TRANSFER_ATTEMPT_RATE) continue;

    const roster = await getPlayersByTeamId(buyingTeam.id);
    const weak = findWeakestPosition(roster);

    if (!weak || weak.currentOvr > WEAK_POSITION_THRESHOLD) continue;

    const benchCandidates: { player: Player; sellingTeamId: string }[] = [];

    for (const otherTeam of teams) {
      if (otherTeam.id === buyingTeam.id) continue;

      const otherRoster = await getPlayersByTeamId(otherTeam.id);
      const subs = otherRoster.filter(
        p => (p as { division?: string }).division === 'sub'
          && p.position === weak.position
          && getPlayerOverall(p) > weak.currentOvr,
      );

      for (const sub of subs) {
        benchCandidates.push({ player: sub, sellingTeamId: otherTeam.id });
      }
    }

    if (benchCandidates.length === 0) continue;

    benchCandidates.sort((a, b) => getPlayerOverall(b.player) - getPlayerOverall(a.player));
    const topCandidates = benchCandidates.slice(0, Math.min(3, benchCandidates.length));
    const selected = pickRandom(topCandidates);

    const transferFee = calculatePlayerValue(selected.player);
    const offeredSalary = Math.round(calculateFairSalary(selected.player) * 1.2);

    if (buyingTeam.budget < transferFee) continue;

    const payrollSnapshot = await getTeamPayrollSnapshot(buyingTeam.id);
    const payrollImpact = evaluatePayrollImpact({
      totalPayroll: payrollSnapshot.totalPayroll + offeredSalary,
      salaryCap: payrollSnapshot.salaryCap,
    });
    if (payrollImpact.pressureBand === 'hard_stop') continue;

    const sellingTeam = teams.find(t => t.id === selected.sellingTeamId);
    if (!sellingTeam) continue;

    const playerMarketValue = calculatePlayerValue(selected.player);
    if (transferFee < playerMarketValue * 0.8) continue;

    const sellingRoster = await getPlayersByTeamId(selected.sellingTeamId);
    const positionPlayers = sellingRoster.filter(p => p.position === weak.position);
    if (positionPlayers.length <= 1) continue;

    const contractYears = randomInt(1, 2);

    if (selected.sellingTeamId === userTeamId) {
      await createTransferOffer({
        seasonId,
        fromTeamId: buyingTeam.id,
        toTeamId: selected.sellingTeamId,
        playerId: selected.player.id,
        transferFee,
        offeredSalary,
        contractYears,
        offerDate: currentDate,
      });
      continue;
    }

    const offerId = await createTransferOffer({
      seasonId,
      fromTeamId: buyingTeam.id,
      toTeamId: selected.sellingTeamId,
      playerId: selected.player.id,
      transferFee,
      offeredSalary,
      contractYears,
      offerDate: currentDate,
    });

    const offer: TransferOffer = {
      id: offerId,
      seasonId,
      fromTeamId: buyingTeam.id,
      toTeamId: selected.sellingTeamId,
      playerId: selected.player.id,
      transferFee,
      offeredSalary,
      contractYears,
      status: 'pending',
      offerDate: currentDate,
    };

    await acceptTransferOffer(offer, seasonId, currentDate);

    const playerRows = await db.select<{ name: string }[]>(
      'SELECT name FROM players WHERE id = $1',
      [selected.player.id],
    );
    const playerName = playerRows[0]?.name ?? selected.player.id;

    completedTransfers.push({
      fromTeam: selected.sellingTeamId,
      toTeam: buyingTeam.id,
      playerId: selected.player.id,
      playerName,
    });
  }

  return completedTransfers;
}
