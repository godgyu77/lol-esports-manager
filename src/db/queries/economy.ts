/**
 * 재정, 이적, 스폰서
 */
import { getDatabase } from '../database';

// ─────────────────────────────────────────
// 재정 시스템 (Finance)
// ─────────────────────────────────────────

interface FinanceLogRow {
  id: number;
  team_id: string;
  season_id: number;
  game_date: string;
  type: string;
  category: string;
  amount: number;
  description: string | null;
  created_at: string;
}

export interface FinanceLog {
  id: number;
  teamId: string;
  seasonId: number;
  gameDate: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description?: string;
  createdAt: string;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  logs: FinanceLog[];
}

function mapRowToFinanceLog(row: FinanceLogRow): FinanceLog {
  return {
    id: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    gameDate: row.game_date,
    type: row.type as 'income' | 'expense',
    category: row.category,
    amount: row.amount,
    description: row.description ?? undefined,
    createdAt: row.created_at,
  };
}

/** 재정 로그 삽입 */
export async function insertFinanceLog(
  teamId: string,
  seasonId: number,
  gameDate: string,
  type: 'income' | 'expense',
  category: string,
  amount: number,
  description?: string,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO team_finance_log (team_id, season_id, game_date, type, category, amount, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [teamId, seasonId, gameDate, type, category, amount, description ?? null],
  );
}

/** 팀의 시즌 재정 요약 조회 */
export async function getTeamFinanceSummary(
  teamId: string,
  seasonId: number,
): Promise<FinanceSummary> {
  const db = await getDatabase();
  const rows = await db.select<FinanceLogRow[]>(
    `SELECT * FROM team_finance_log WHERE team_id = $1 AND season_id = $2 ORDER BY game_date DESC, id DESC`,
    [teamId, seasonId],
  );

  const logs = rows.map(mapRowToFinanceLog);
  let totalIncome = 0;
  let totalExpense = 0;

  for (const log of logs) {
    if (log.type === 'income') {
      totalIncome += log.amount;
    } else {
      totalExpense += log.amount;
    }
  }

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    logs,
  };
}

/** 모든 팀의 주급 처리 (월급/4 기준) */
export async function processWeeklySalaries(
  seasonId: number,
  gameDate: string,
): Promise<void> {
  const db = await getDatabase();
  const rows = await db.select<{ team_id: string; total_salary: number }[]>(
    `SELECT team_id, SUM(salary) as total_salary FROM players WHERE team_id IS NOT NULL GROUP BY team_id`,
  );

  for (const row of rows) {
    const weeklySalary = Math.round(row.total_salary / 4);
    if (weeklySalary <= 0) continue;

    await db.execute(
      `INSERT INTO team_finance_log (team_id, season_id, game_date, type, category, amount, description)
       VALUES ($1, $2, $3, 'expense', 'salary', $4, $5)`,
      [row.team_id, seasonId, gameDate, weeklySalary, '주급 지급'],
    );

    await db.execute(
      `UPDATE teams SET budget = budget - $1 WHERE id = $2`,
      [weeklySalary, row.team_id],
    );
  }
}

/** 팀 예산 업데이트 */
export async function updateTeamBudget(teamId: string, newBudget: number): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE teams SET budget = $1 WHERE id = $2',
    [newBudget, teamId],
  );
}

// ─────────────────────────────────────────
// 이적 시장 (Transfer Market)
// ─────────────────────────────────────────

export interface TransferOffer {
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
  resolvedDate?: string;
}

/** 이적 제안 생성 */
export async function createTransferOffer(offer: {
  seasonId: number;
  fromTeamId: string;
  toTeamId: string | null;
  playerId: string;
  transferFee: number;
  offeredSalary: number;
  contractYears: number;
  offerDate: string;
}): Promise<number> {
  const db = await getDatabase();
  const result = await db.execute(
    `INSERT INTO transfer_offers (season_id, from_team_id, to_team_id, player_id, transfer_fee, offered_salary, contract_years, offer_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [offer.seasonId, offer.fromTeamId, offer.toTeamId, offer.playerId,
     offer.transferFee, offer.offeredSalary, offer.contractYears, offer.offerDate],
  );
  if (!result.lastInsertId) throw new Error('이적 제안 생성 실패: lastInsertId 없음');
  return result.lastInsertId;
}

/** 이적 제안 상태 변경 */
export async function updateTransferOfferStatus(
  offerId: number,
  status: 'accepted' | 'rejected' | 'cancelled' | 'player_request',
  resolvedDate: string,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE transfer_offers SET status = $1, resolved_date = $2 WHERE id = $3',
    [status, resolvedDate, offerId],
  );
}

/** 특정 시즌의 이적 제안 조회 */
export async function getTransferOffers(
  seasonId: number,
  status?: string,
): Promise<TransferOffer[]> {
  const db = await getDatabase();
  const query = status
    ? 'SELECT * FROM transfer_offers WHERE season_id = $1 AND status = $2 ORDER BY offer_date DESC'
    : 'SELECT * FROM transfer_offers WHERE season_id = $1 ORDER BY offer_date DESC';
  const params = status ? [seasonId, status] : [seasonId];

  const rows = await db.select<{
    id: number; season_id: number; from_team_id: string; to_team_id: string | null;
    player_id: string; transfer_fee: number; offered_salary: number; contract_years: number;
    status: string; offer_date: string; resolved_date: string | null;
  }[]>(query, params);

  return rows.map(r => ({
    id: r.id,
    seasonId: r.season_id,
    fromTeamId: r.from_team_id,
    toTeamId: r.to_team_id,
    playerId: r.player_id,
    transferFee: r.transfer_fee,
    offeredSalary: r.offered_salary,
    contractYears: r.contract_years,
    status: r.status as TransferOffer['status'],
    offerDate: r.offer_date,
    resolvedDate: r.resolved_date ?? undefined,
  }));
}

/** 선수 소속팀 변경 */
export async function updatePlayerTeam(
  playerId: string,
  newTeamId: string | null,
): Promise<void> {
  const db = await getDatabase();
  await db.execute('UPDATE players SET team_id = $1 WHERE id = $2', [newTeamId, playerId]);
}

/** 선수 계약 업데이트 */
export async function updatePlayerContract(
  playerId: string,
  salary: number,
  contractEndSeason: number,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE players SET salary = $1, contract_end_season = $2 WHERE id = $3',
    [salary, contractEndSeason, playerId],
  );
}

// ─────────────────────────────────────────
// 스폰서 (Sponsors)
// ─────────────────────────────────────────

interface SponsorRow {
  id: number;
  season_id: number;
  team_id: string;
  name: string;
  tier: string;
  weekly_payout: number;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
}

export interface Sponsor {
  id: number;
  seasonId: number;
  teamId: string;
  name: string;
  tier: string;
  weeklyPayout: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'cancelled';
}

function mapRowToSponsor(row: SponsorRow): Sponsor {
  return {
    id: row.id,
    seasonId: row.season_id,
    teamId: row.team_id,
    name: row.name,
    tier: row.tier,
    weeklyPayout: row.weekly_payout,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as Sponsor['status'],
  };
}

/** 스폰서 계약 삽입 */
export async function insertSponsor(sponsor: {
  seasonId: number;
  teamId: string;
  name: string;
  tier: string;
  weeklyPayout: number;
  startDate: string;
  endDate: string;
}): Promise<number> {
  const db = await getDatabase();
  const result = await db.execute(
    `INSERT INTO sponsors (season_id, team_id, name, tier, weekly_payout, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [sponsor.seasonId, sponsor.teamId, sponsor.name, sponsor.tier,
     sponsor.weeklyPayout, sponsor.startDate, sponsor.endDate],
  );
  if (!result.lastInsertId) throw new Error('스폰서 생성 실패: lastInsertId 없음');
  return result.lastInsertId;
}

/** 팀의 활성 스폰서 조회 */
export async function getActiveSponsors(
  teamId: string,
  seasonId: number,
): Promise<Sponsor[]> {
  const db = await getDatabase();
  const rows = await db.select<SponsorRow[]>(
    `SELECT * FROM sponsors WHERE team_id = $1 AND season_id = $2 AND status = 'active' ORDER BY weekly_payout DESC`,
    [teamId, seasonId],
  );
  return rows.map(mapRowToSponsor);
}

/** 팀의 전체 스폰서 조회 (만료 포함) */
export async function getAllSponsors(
  teamId: string,
  seasonId: number,
): Promise<Sponsor[]> {
  const db = await getDatabase();
  const rows = await db.select<SponsorRow[]>(
    `SELECT * FROM sponsors WHERE team_id = $1 AND season_id = $2 ORDER BY status, weekly_payout DESC`,
    [teamId, seasonId],
  );
  return rows.map(mapRowToSponsor);
}

/** 스폰서 상태 변경 */
export async function updateSponsorStatus(
  sponsorId: number,
  status: 'active' | 'expired' | 'cancelled',
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE sponsors SET status = $1 WHERE id = $2',
    [status, sponsorId],
  );
}
