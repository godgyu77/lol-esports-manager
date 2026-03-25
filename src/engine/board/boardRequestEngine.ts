/**
 * 보드 요청 엔진
 * - 감독이 구단에 시설/예산/스태프 요청
 * - 보드 만족도 기반 승인/거절
 */

import { getDatabase } from '../../db/database';
import { nextRandom } from '../../utils/random';

export type BoardRequestType = 'budget_increase' | 'facility_upgrade' | 'staff_budget' | 'transfer_budget';

export interface BoardRequest {
  id: number;
  teamId: string;
  seasonId: number;
  requestType: BoardRequestType;
  requestAmount: number | null;
  status: 'pending' | 'approved' | 'rejected';
  requestDate: string;
  resolvedDate: string | null;
  boardResponse: string | null;
}

export const BOARD_REQUEST_LABELS: Record<BoardRequestType, string> = {
  budget_increase: '운영 예산 증액',
  facility_upgrade: '시설 업그레이드',
  staff_budget: '스태프 예산 증가',
  transfer_budget: '이적 예산 추가',
};

const MAX_REQUESTS_PER_SEASON = 3;

export async function submitBoardRequest(
  teamId: string,
  seasonId: number,
  type: BoardRequestType,
  amount: number | null,
  date: string,
  boardSatisfaction: number,
): Promise<{ success: boolean; approved: boolean; message: string }> {
  const db = await getDatabase();

  // 시즌 잔여 횟수 체크
  const countRows = await db.select<{ cnt: number }[]>(
    'SELECT COUNT(*) as cnt FROM board_requests WHERE team_id = $1 AND season_id = $2',
    [teamId, seasonId],
  );
  if ((countRows[0]?.cnt ?? 0) >= MAX_REQUESTS_PER_SEASON) {
    return { success: false, approved: false, message: '이번 시즌 요청 횟수를 모두 사용했습니다. (최대 3회)' };
  }

  // 승인 확률 계산
  let approvalRate: number;
  if (boardSatisfaction >= 70) approvalRate = 0.80;
  else if (boardSatisfaction >= 50) approvalRate = 0.50;
  else if (boardSatisfaction >= 30) approvalRate = 0.25;
  else approvalRate = 0.10;

  const approved = nextRandom() < approvalRate;
  const status = approved ? 'approved' : 'rejected';
  const response = approved
    ? '구단에서 요청을 승인했습니다.'
    : '현재 상황에서는 어렵다는 답변입니다.';

  await db.execute(
    `INSERT INTO board_requests (team_id, season_id, request_type, request_amount, status, request_date, resolved_date, board_response)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [teamId, seasonId, type, amount, status, date, date, response],
  );

  // 승인 시 효과 적용
  if (approved) {
    switch (type) {
      case 'budget_increase':
        await db.execute('UPDATE teams SET budget = budget + budget * 0.15 WHERE id = $1', [teamId]);
        break;
      case 'transfer_budget':
        await db.execute('UPDATE teams SET budget = budget + $1 WHERE id = $2', [amount ?? 10000, teamId]);
        break;
    }
  }

  return { success: true, approved, message: response };
}

export async function getBoardRequests(teamId: string, seasonId: number): Promise<BoardRequest[]> {
  const db = await getDatabase();
  const rows = await db.select<Record<string, unknown>[]>(
    'SELECT * FROM board_requests WHERE team_id = $1 AND season_id = $2 ORDER BY request_date DESC',
    [teamId, seasonId],
  );
  return rows.map(r => ({
    id: r.id,
    teamId: r.team_id,
    seasonId: r.season_id,
    requestType: r.request_type,
    requestAmount: r.request_amount,
    status: r.status,
    requestDate: r.request_date,
    resolvedDate: r.resolved_date,
    boardResponse: r.board_response,
  }));
}

export async function getRemainingRequests(teamId: string, seasonId: number): Promise<number> {
  const db = await getDatabase();
  const rows = await db.select<{ cnt: number }[]>(
    'SELECT COUNT(*) as cnt FROM board_requests WHERE team_id = $1 AND season_id = $2',
    [teamId, seasonId],
  );
  return MAX_REQUESTS_PER_SEASON - (rows[0]?.cnt ?? 0);
}
