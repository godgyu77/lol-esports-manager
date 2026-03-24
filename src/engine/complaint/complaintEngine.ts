/**
 * 선수 불만/요구 시스템 엔진
 * - 불만 자동 감지 (벤치, 사기 저하, 연봉, 연패)
 * - 불만 해결 / 무시 / 에스컬레이션
 * - 활성 불만 및 이력 조회
 */

import type { PlayerComplaint, ComplaintType, ComplaintStatus } from '../../types/complaint';
import { getDatabase } from '../../db/database';
import { generateTransferRumorNews, generateSocialMediaReaction } from '../news/newsEngine';

// ─────────────────────────────────────────
// Row 타입
// ─────────────────────────────────────────

interface ComplaintRow {
  id: number;
  player_id: string;
  team_id: string;
  season_id: number;
  complaint_type: string;
  severity: number;
  message: string;
  status: string;
  created_date: string;
  resolved_date: string | null;
  resolution: string | null;
  morale_impact: number;
  created_at: string;
}

// ─────────────────────────────────────────
// 매핑 유틸
// ─────────────────────────────────────────

function mapRowToComplaint(row: ComplaintRow): PlayerComplaint {
  return {
    id: row.id,
    playerId: row.player_id,
    teamId: row.team_id,
    seasonId: row.season_id,
    complaintType: row.complaint_type as ComplaintType,
    severity: row.severity,
    message: row.message,
    status: row.status as ComplaintStatus,
    createdDate: row.created_date,
    resolvedDate: row.resolved_date,
    resolution: row.resolution,
    moraleImpact: row.morale_impact,
  };
}

// ─────────────────────────────────────────
// 불만 메시지 템플릿
// ─────────────────────────────────────────

const COMPLAINT_MESSAGES: Record<ComplaintType, string[]> = {
  playtime: [
    '벤치에만 앉아있는 건 더 이상 참을 수 없습니다.',
    '경기에 출전할 기회를 주세요.',
    '저도 경기에 나가고 싶습니다. 기회를 달라고요.',
  ],
  salary: [
    '같은 포지션 선수들에 비해 연봉이 너무 낮습니다.',
    '제 실력에 비해 급여가 부족하다고 생각합니다.',
    '연봉 인상을 요구합니다.',
  ],
  transfer: [
    '이 팀에서 더 이상 성장할 수 없다고 느낍니다.',
    '다른 팀으로 이적하고 싶습니다.',
    '새로운 환경에서 뛰고 싶습니다.',
  ],
  role: [
    '팀 내 역할에 불만이 있습니다.',
    '제 포지션에서의 역할이 맞지 않습니다.',
    '전략적 역할 변경을 원합니다.',
  ],
  morale: [
    '팀 분위기가 너무 안 좋습니다.',
    '최근 경기 결과에 의욕이 떨어집니다.',
    '팀의 방향성에 의문이 듭니다.',
  ],
  conflict: [
    '선수 간 성격 충돌로 인한 갈등입니다.',
    '팀원과의 관계에 심각한 문제가 있습니다.',
    '팀 내 불화를 더 이상 참을 수 없습니다.',
  ],
};

function getRandomMessage(type: ComplaintType): string {
  const messages = COMPLAINT_MESSAGES[type];
  return messages[Math.floor(Math.random() * messages.length)];
}

// ─────────────────────────────────────────
// 불만 자동 감지
// ─────────────────────────────────────────

/** 팀 소속 선수들의 불만을 자동 감지하여 생성 */
export async function checkForComplaints(
  teamId: string,
  seasonId: number,
  currentDate: string,
): Promise<PlayerComplaint[]> {
  const db = await getDatabase();
  const newComplaints: PlayerComplaint[] = [];

  // 팀 로스터 조회
  const players = await db.select<{
    id: string;
    name: string;
    position: string;
    morale: number;
    salary: number;
    division: string;
  }[]>(
    'SELECT id, name, position, morale, salary, division FROM players WHERE team_id = $1',
    [teamId],
  );

  for (const player of players) {
    // 이미 활성 불만이 있는지 확인
    const existingActive = await db.select<{ cnt: number }[]>(
      `SELECT COUNT(*) as cnt FROM player_complaints
       WHERE player_id = $1 AND team_id = $2 AND status = 'active'`,
      [player.id, teamId],
    );
    if ((existingActive[0]?.cnt ?? 0) >= 2) continue; // 최대 2개까지

    // 1) 벤치 3경기 이상 → 출전 시간 불만 (30%)
    if (player.division === 'sub') {
      const benchGames = await db.select<{ cnt: number }[]>(
        `SELECT COUNT(*) as cnt FROM matches
         WHERE season_id = $1 AND is_played = 1
         AND (team_home_id = $2 OR team_away_id = $2)`,
        [seasonId, teamId],
      );
      const totalGames = benchGames[0]?.cnt ?? 0;

      // 선수가 출전한 경기 수 확인
      const playedGames = await db.select<{ cnt: number }[]>(
        `SELECT COUNT(DISTINCT pgs.match_id) as cnt FROM player_game_stats pgs
         JOIN matches m ON m.id = pgs.match_id
         WHERE pgs.player_id = $1 AND m.season_id = $2`,
        [player.id, seasonId],
      );
      const played = playedGames[0]?.cnt ?? 0;
      const benchCount = totalGames - played;

      if (benchCount >= 3 && Math.random() < 0.3) {
        const alreadyHasPlaytime = await db.select<{ cnt: number }[]>(
          `SELECT COUNT(*) as cnt FROM player_complaints
           WHERE player_id = $1 AND team_id = $2 AND complaint_type = 'playtime' AND status = 'active'`,
          [player.id, teamId],
        );
        if ((alreadyHasPlaytime[0]?.cnt ?? 0) === 0) {
          const complaint = await createComplaint(
            player.id, teamId, seasonId, 'playtime',
            benchCount >= 6 ? 2 : 1,
            getRandomMessage('playtime'), currentDate,
          );
          newComplaints.push(complaint);
        }
      }
    }

    // 2) morale 30 이하 → 사기 저하 불만
    if (player.morale <= 30) {
      const alreadyHasMorale = await db.select<{ cnt: number }[]>(
        `SELECT COUNT(*) as cnt FROM player_complaints
         WHERE player_id = $1 AND team_id = $2 AND complaint_type = 'morale' AND status = 'active'`,
        [player.id, teamId],
      );
      if ((alreadyHasMorale[0]?.cnt ?? 0) === 0) {
        const severity = player.morale <= 15 ? 3 : player.morale <= 25 ? 2 : 1;
        const complaint = await createComplaint(
          player.id, teamId, seasonId, 'morale',
          severity, getRandomMessage('morale'), currentDate,
        );
        newComplaints.push(complaint);
      }
    }

    // 3) 연봉이 같은 포지션 평균 대비 70% 미만 → 연봉 불만
    const posAvg = await db.select<{ avg_salary: number | null }[]>(
      `SELECT AVG(salary) as avg_salary FROM players
       WHERE position = $1 AND team_id IS NOT NULL AND id != $2`,
      [player.position, player.id],
    );
    const avgSalary = posAvg[0]?.avg_salary ?? 0;
    if (avgSalary > 0 && player.salary < avgSalary * 0.7) {
      const alreadyHasSalary = await db.select<{ cnt: number }[]>(
        `SELECT COUNT(*) as cnt FROM player_complaints
         WHERE player_id = $1 AND team_id = $2 AND complaint_type = 'salary' AND status = 'active'`,
        [player.id, teamId],
      );
      if ((alreadyHasSalary[0]?.cnt ?? 0) === 0) {
        const complaint = await createComplaint(
          player.id, teamId, seasonId, 'salary',
          1, getRandomMessage('salary'), currentDate,
        );
        newComplaints.push(complaint);
      }
    }
  }

  // 3.5) severity 3 + playtime 불만이 3주(21일) 이상 방치 → transfer 불만으로 에스컬레이션
  const stalePlaytimeComplaints = await db.select<ComplaintRow[]>(
    `SELECT * FROM player_complaints
     WHERE team_id = $1 AND complaint_type = 'playtime' AND status = 'active' AND severity >= 3
     AND julianday($2) - julianday(created_date) >= 21`,
    [teamId, currentDate],
  );

  for (const stale of stalePlaytimeComplaints) {
    // 기존 playtime 불만을 escalated로 전환
    await db.execute(
      `UPDATE player_complaints SET status = 'escalated' WHERE id = $1`,
      [stale.id],
    );

    // 해당 선수에 active transfer 불만이 없으면 생성
    const alreadyHasTransfer = await db.select<{ cnt: number }[]>(
      `SELECT COUNT(*) as cnt FROM player_complaints
       WHERE player_id = $1 AND team_id = $2 AND complaint_type = 'transfer' AND status = 'active'`,
      [stale.player_id, teamId],
    );
    if ((alreadyHasTransfer[0]?.cnt ?? 0) === 0) {
      // 선수 이름 조회
      const playerRow = await db.select<{ name: string }[]>(
        'SELECT name FROM players WHERE id = $1', [stale.player_id],
      );
      const playerName = playerRow[0]?.name ?? '알 수 없음';

      const complaint = await createComplaint(
        stale.player_id, teamId, seasonId, 'transfer',
        3, getRandomMessage('transfer'), currentDate,
      );
      newComplaints.push(complaint);

      // severity 3 transfer 불만이므로 자동으로 이적 요청 생성 + 뉴스 + 소셜 반응
      await processTransferRequest(stale.player_id, teamId, seasonId, currentDate);
      await generateTransferRequestNews(playerName, teamId, seasonId, currentDate, stale.player_id);
    }
  }

  // 4) 5연패 이상 → 이적 요청 (20%)
  const recentMatches = await db.select<{ winner: string | null }[]>(
    `SELECT
       CASE WHEN (team_home_id = $1 AND score_home > score_away) OR (team_away_id = $1 AND score_away > score_home)
         THEN 'win' ELSE 'loss' END as winner
     FROM matches
     WHERE season_id = $2 AND is_played = 1
     AND (team_home_id = $1 OR team_away_id = $1)
     ORDER BY match_date DESC
     LIMIT 10`,
    [teamId, seasonId],
  );

  let consecutiveLosses = 0;
  for (const m of recentMatches) {
    if (m.winner === 'loss') {
      consecutiveLosses++;
    } else {
      break;
    }
  }

  if (consecutiveLosses >= 5) {
    for (const player of players) {
      if (Math.random() < 0.2) {
        const alreadyHasTransfer = await db.select<{ cnt: number }[]>(
          `SELECT COUNT(*) as cnt FROM player_complaints
           WHERE player_id = $1 AND team_id = $2 AND complaint_type = 'transfer' AND status = 'active'`,
          [player.id, teamId],
        );
        if ((alreadyHasTransfer[0]?.cnt ?? 0) === 0) {
          const severity = consecutiveLosses >= 8 ? 3 : 2;
          const complaint = await createComplaint(
            player.id, teamId, seasonId, 'transfer',
            severity,
            getRandomMessage('transfer'), currentDate,
          );
          newComplaints.push(complaint);

          // severity 3 + transfer → 자동 이적 요청 + 뉴스 + 소셜 반응
          if (severity >= 3) {
            await processTransferRequest(player.id, teamId, seasonId, currentDate);
            await generateTransferRequestNews(player.name, teamId, seasonId, currentDate, player.id);
          }
        }
      }
    }
  }

  return newComplaints;
}

// ─────────────────────────────────────────
// 불만 생성
// ─────────────────────────────────────────

async function createComplaint(
  playerId: string,
  teamId: string,
  seasonId: number,
  complaintType: ComplaintType,
  severity: number,
  message: string,
  createdDate: string,
): Promise<PlayerComplaint> {
  const db = await getDatabase();
  const result = await db.execute(
    `INSERT INTO player_complaints (player_id, team_id, season_id, complaint_type, severity, message, status, created_date, morale_impact)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, 0)`,
    [playerId, teamId, seasonId, complaintType, severity, message, createdDate],
  );

  return {
    id: result.lastInsertId ?? 0,
    playerId,
    teamId,
    seasonId,
    complaintType,
    severity,
    message,
    status: 'active',
    createdDate,
    resolvedDate: null,
    resolution: null,
    moraleImpact: 0,
  };
}

// ─────────────────────────────────────────
// 불만 처리 액션
// ─────────────────────────────────────────

/** resolution별 사기 회복량 */
const RESOLUTION_MORALE_MAP: Record<string, number> = {
  talk: 5,           // 대화
  promise_starter: 10, // 주전 약속
  salary_raise: 8,     // 연봉 인상
  allow_transfer: 0,   // 이적 허용 (선수가 떠남)
  deny_transfer: -10,  // 이적 거부
  persuade_success: 15, // 설득 성공
  persuade_fail: -5,    // 설득 실패
};

/** 불만 해결 (resolution에 따라 사기 회복량 차등) */
export async function resolveComplaint(
  complaintId: number,
  resolution: string,
  resolvedDate: string,
): Promise<void> {
  const db = await getDatabase();

  // 불만 정보 조회
  const rows = await db.select<ComplaintRow[]>(
    'SELECT * FROM player_complaints WHERE id = $1',
    [complaintId],
  );
  if (rows.length === 0) return;

  const complaint = rows[0];

  // resolution에 따른 사기 회복량 결정 (기본 +10)
  const moraleChange = RESOLUTION_MORALE_MAP[resolution] ?? 10;

  // 상태 업데이트
  await db.execute(
    `UPDATE player_complaints
     SET status = 'resolved', resolved_date = $1, resolution = $2, morale_impact = $3
     WHERE id = $4`,
    [resolvedDate, resolution, moraleChange, complaintId],
  );

  // 선수 morale 변경
  await db.execute(
    `UPDATE players SET morale = MAX(0, MIN(100, morale + $1)) WHERE id = $2`,
    [moraleChange, complaint.player_id],
  );

  // 실질 효과 적용
  try {
    switch (resolution) {
      case 'salary_raise': {
        // 현재 연봉의 10% 인상
        await db.execute(
          `UPDATE players SET salary = ROUND(salary * 1.1) WHERE id = $1`,
          [complaint.player_id],
        );
        break;
      }
      case 'promise_starter': {
        // 주전 약속 → promise 시스템에 기록
        const { makePromise } = await import('../promise/promiseEngine');
        await makePromise(
          complaint.player_id,
          complaint.team_id,
          'starter_guarantee',
          resolvedDate,
          60, // 60일 내 이행
        ).catch(() => {});
        break;
      }
      case 'allow_transfer': {
        // 이적 허용 플래그
        await db.execute(
          'UPDATE players SET transfer_listed = 1 WHERE id = $1',
          [complaint.player_id],
        ).catch(() => {});
        break;
      }
    }
  } catch (e) {
    console.warn('[complaintEngine] 해결 효과 적용 실패:', e);
  }
}

/** 불만 무시 (morale -5, severity 상승 가능) */
export async function ignoreComplaint(complaintId: number): Promise<void> {
  const db = await getDatabase();

  const rows = await db.select<ComplaintRow[]>(
    'SELECT * FROM player_complaints WHERE id = $1',
    [complaintId],
  );
  if (rows.length === 0) return;

  const complaint = rows[0];
  const newSeverity = Math.min(3, complaint.severity + 1);

  await db.execute(
    `UPDATE player_complaints
     SET status = 'ignored', morale_impact = -5, severity = $1
     WHERE id = $2`,
    [newSeverity, complaintId],
  );

  // 선수 morale 감소
  await db.execute(
    `UPDATE players SET morale = MAX(0, morale - 5) WHERE id = $1`,
    [complaint.player_id],
  );
}

/** 불만 에스컬레이션 (뉴스에 노출, severity 3 + transfer → 이적 요청 자동 생성) */
export async function escalateComplaint(complaintId: number): Promise<void> {
  const db = await getDatabase();

  const rows = await db.select<ComplaintRow[]>(
    'SELECT * FROM player_complaints WHERE id = $1',
    [complaintId],
  );
  if (rows.length === 0) return;

  const complaint = rows[0];

  await db.execute(
    `UPDATE player_complaints SET status = 'escalated' WHERE id = $1`,
    [complaintId],
  );

  // severity 3이고 transfer 불만이면 자동으로 이적 요청 생성
  if (complaint.severity >= 3 && complaint.complaint_type === 'transfer') {
    await processTransferRequest(
      complaint.player_id,
      complaint.team_id,
      complaint.season_id,
      complaint.created_date,
    );
  }
}

/**
 * 선수 이적 요청 처리
 * - transfer_offers에 status='player_request' 레코드 생성
 * - AI 팀들이 다음 주에 해당 선수에게 자동 제안 (50% 확률) — dayAdvancer에서 처리
 */
export async function processTransferRequest(
  playerId: string,
  teamId: string,
  seasonId: number,
  date: string,
): Promise<void> {
  const db = await getDatabase();

  // 이미 이적 요청이 있는지 확인
  const existing = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM transfer_offers
     WHERE player_id = $1 AND status = 'player_request'`,
    [playerId],
  );
  if ((existing[0]?.cnt ?? 0) > 0) return;

  // 이적 요청 레코드 생성 (from_team_id = null, to_team_id = 현재 팀)
  await db.execute(
    `INSERT INTO transfer_offers (season_id, from_team_id, to_team_id, player_id, transfer_fee, offered_salary, contract_years, offer_date, status)
     VALUES ($1, NULL, $2, $3, 0, 0, 0, $4, 'player_request')`,
    [seasonId, teamId, playerId, date],
  );
}

// ─────────────────────────────────────────
// 조회
// ─────────────────────────────────────────

/** 활성 불만 조회 */
export async function getActiveComplaints(teamId: string): Promise<PlayerComplaint[]> {
  const db = await getDatabase();
  const rows = await db.select<ComplaintRow[]>(
    `SELECT * FROM player_complaints
     WHERE team_id = $1 AND status = 'active'
     ORDER BY severity DESC, created_date DESC`,
    [teamId],
  );
  return rows.map(mapRowToComplaint);
}

/** 불만 이력 조회 */
export async function getComplaintHistory(
  teamId: string,
  seasonId: number,
): Promise<PlayerComplaint[]> {
  const db = await getDatabase();
  const rows = await db.select<ComplaintRow[]>(
    `SELECT * FROM player_complaints
     WHERE team_id = $1 AND season_id = $2
     ORDER BY created_date DESC`,
    [teamId, seasonId],
  );
  return rows.map(mapRowToComplaint);
}

// ─────────────────────────────────────────
// 이적 요청 불만 전용 액션
// ─────────────────────────────────────────

/**
 * 이적 허용 — 선수를 FA로 전환 (team_id = NULL)
 */
export async function allowTransfer(
  complaintId: number,
  resolvedDate: string,
): Promise<void> {
  const db = await getDatabase();
  const rows = await db.select<ComplaintRow[]>(
    'SELECT * FROM player_complaints WHERE id = $1',
    [complaintId],
  );
  if (rows.length === 0) return;

  const complaint = rows[0];

  // 불만 해결
  await resolveComplaint(complaintId, 'allow_transfer', resolvedDate);

  // 선수를 FA로 전환
  await db.execute(
    `UPDATE players SET team_id = NULL, division = 'free' WHERE id = $1`,
    [complaint.player_id],
  );

  // 이적 요청 상태 업데이트
  await db.execute(
    `UPDATE transfer_offers SET status = 'completed'
     WHERE player_id = $1 AND status = 'player_request'`,
    [complaint.player_id],
  );
}

/**
 * 이적 거부 — morale -10, severity +1
 */
export async function denyTransfer(
  complaintId: number,
): Promise<void> {
  const db = await getDatabase();
  const rows = await db.select<ComplaintRow[]>(
    'SELECT * FROM player_complaints WHERE id = $1',
    [complaintId],
  );
  if (rows.length === 0) return;

  const complaint = rows[0];
  const newSeverity = Math.min(3, complaint.severity + 1);

  // 불만 상태 유지 (거부했으므로 resolved가 아닌 active 유지, severity 상승)
  await db.execute(
    `UPDATE player_complaints SET severity = $1, resolution = 'deny_transfer', morale_impact = -10
     WHERE id = $2`,
    [newSeverity, complaintId],
  );

  // morale -10
  await db.execute(
    `UPDATE players SET morale = MAX(0, morale - 10) WHERE id = $1`,
    [complaint.player_id],
  );
}

/**
 * 대화로 설득 — 50% 확률로 해결, 50% 확률로 에스컬레이션
 * @returns 설득 성공 여부
 */
export async function persuadeTransfer(
  complaintId: number,
  resolvedDate: string,
): Promise<boolean> {
  const success = Math.random() < 0.5;

  if (success) {
    // 설득 성공 → 불만 해결, morale +15
    await resolveComplaint(complaintId, 'persuade_success', resolvedDate);
    return true;
  }

  // 설득 실패 → 에스컬레이션
  const db = await getDatabase();
  const rows = await db.select<ComplaintRow[]>(
    'SELECT * FROM player_complaints WHERE id = $1',
    [complaintId],
  );
  if (rows.length === 0) return false;

  const complaint = rows[0];

  await db.execute(
    `UPDATE player_complaints SET status = 'escalated', resolution = 'persuade_fail', morale_impact = -5
     WHERE id = $1`,
    [complaintId],
  );

  await db.execute(
    `UPDATE players SET morale = MAX(0, morale - 5) WHERE id = $1`,
    [complaint.player_id],
  );

  return false;
}

// ─────────────────────────────────────────
// 내부: 이적 요청 뉴스 + 소셜 반응 생성
// ─────────────────────────────────────────

async function generateTransferRequestNews(
  playerName: string,
  teamId: string,
  seasonId: number,
  date: string,
  playerId: string,
): Promise<void> {
  try {
    // 팀 이름 조회
    const db = await getDatabase();
    const teamRow = await db.select<{ name: string }[]>(
      'SELECT name FROM teams WHERE id = $1', [teamId],
    );
    const teamName = teamRow[0]?.name ?? teamId;

    // 이적 요청 뉴스
    await generateTransferRumorNews(
      seasonId, date, playerName, teamName, teamId, playerId,
    );

    // 소셜 반응
    await generateSocialMediaReaction(
      seasonId, date,
      `${playerName} 선수, ${teamName}에 이적 요청... 팬들 충격`,
      teamId,
    );
  } catch (e) {
    console.warn('[complaintEngine] generateTransferRequestNews failed:', e);
  }
}
