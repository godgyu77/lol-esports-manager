/**
 * 받은 편지함 엔진
 * - 모든 알림을 한 곳에서 관리
 */

import { getDatabase } from '../../db/database';
import type { InboxMessage, InboxCategory } from '../../types/inbox';
import type { TeamLoopRiskItem } from '../../types/systemDepth';
import { invalidateNotifications } from '../news/newsEvents';

const SYSTEM_LOOP_RISK_RELATED_ID = 'system_loop_risk';
const MATCH_RESULT_RELATED_PREFIX = 'match_result:';
const MATCH_RESULT_TITLE_PREFIX = '[경기 결과]';

function isStickyInboxCategory(category: InboxCategory): boolean {
  return ['complaint', 'injury', 'promise', 'board', 'contract'].includes(category);
}

export function isMatchResultInboxMessage(message: Pick<InboxMessage, 'relatedId' | 'title'>): boolean {
  return Boolean(message.relatedId?.startsWith(MATCH_RESULT_RELATED_PREFIX) || message.title.startsWith(MATCH_RESULT_TITLE_PREFIX));
}

export function getLatestMatchResultInboxMessage(messages: InboxMessage[]): InboxMessage | null {
  return messages.find(isMatchResultInboxMessage) ?? null;
}

export async function addInboxMessage(
  teamId: string,
  category: InboxCategory,
  title: string,
  content: string,
  date: string,
  actionRoute?: string,
  relatedId?: string,
  actionRequired = false,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO inbox_messages (team_id, category, title, content, action_required, action_route, related_id, created_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [teamId, category, title, content, actionRequired ? 1 : 0, actionRoute ?? null, relatedId ?? null, date],
  );
}

export async function getInboxMessages(
  teamId: string,
  limit = 50,
  unreadOnly = false,
): Promise<InboxMessage[]> {
  const db = await getDatabase();
  const where = unreadOnly ? 'AND is_read = 0' : '';
  const rows = await db.select<{
    id: number; team_id: string; category: InboxCategory;
    title: string; content: string; is_read: number; action_required: number;
    action_route: string | null; related_id: string | null; created_date: string;
  }[]>(
    `SELECT * FROM inbox_messages WHERE team_id = $1 ${where} ORDER BY created_date DESC, id DESC LIMIT $2`,
    [teamId, limit],
  );
  return rows
    .map((r) => ({
      id: r.id,
      teamId: r.team_id,
      category: r.category,
      title: r.title,
      content: r.content,
      isRead: r.is_read === 1,
      actionRequired: r.action_required === 1,
      actionRoute: r.action_route,
      relatedId: r.related_id,
      createdDate: r.created_date,
      dismissOnRead: false,
      sticky: r.action_required === 1 || isStickyInboxCategory(r.category),
    }))
    .sort((left, right) => {
      if (left.sticky !== right.sticky) return left.sticky ? -1 : 1;
      if (left.isRead !== right.isRead) return left.isRead ? 1 : -1;
      return right.id - left.id;
    });
}

export async function getUnreadInboxCount(teamId: string): Promise<number> {
  const db = await getDatabase();
  const rows = await db.select<{ cnt: number }[]>(
    'SELECT COUNT(*) as cnt FROM inbox_messages WHERE team_id = $1 AND is_read = 0',
    [teamId],
  );
  return rows[0]?.cnt ?? 0;
}

export async function markInboxRead(messageId: number): Promise<void> {
  const db = await getDatabase();
  await db.execute('UPDATE inbox_messages SET is_read = 1 WHERE id = $1', [messageId]);
  invalidateNotifications();
}

export async function markAllInboxRead(teamId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('UPDATE inbox_messages SET is_read = 1 WHERE team_id = $1', [teamId]);
  invalidateNotifications();
}

export async function syncSystemInboxMemo(
  teamId: string,
  date: string,
  riskItem: TeamLoopRiskItem | null,
  actionRoute = '/manager/inbox',
): Promise<boolean> {
  if (!riskItem) return false;

  const db = await getDatabase();
  const title = `[시스템] ${riskItem.title}`;
  const actionRequired = riskItem.tone === 'risk' ? 1 : 0;
  const rows = await db.select<
    Array<{
      id: number;
      title: string;
      content: string;
      action_required: number;
    }>
  >(
    `SELECT id, title, content, action_required
     FROM inbox_messages
     WHERE team_id = $1
       AND category = 'general'
       AND related_id = $2
       AND created_date = $3
     ORDER BY id DESC
     LIMIT 1`,
    [teamId, SYSTEM_LOOP_RISK_RELATED_ID, date],
  );

  const existing = rows[0];
  if (!existing) {
    await db.execute(
      `INSERT INTO inbox_messages (
        team_id, category, title, content, action_required, action_route, related_id, created_date
      ) VALUES ($1, 'general', $2, $3, $4, $5, $6, $7)`,
      [teamId, title, riskItem.summary, actionRequired, actionRoute, SYSTEM_LOOP_RISK_RELATED_ID, date],
    );
    invalidateNotifications();
    return true;
  }

  if (
    existing.title === title &&
    existing.content === riskItem.summary &&
    existing.action_required === actionRequired
  ) {
    return false;
  }

  await db.execute(
    `UPDATE inbox_messages
     SET title = $2,
         content = $3,
         action_required = $4,
         action_route = $5,
         is_read = 0
     WHERE id = $1`,
    [existing.id, title, riskItem.summary, actionRequired, actionRoute],
  );
  invalidateNotifications();
  return true;
}

export async function syncMatchResultInboxMemo(
  teamId: string,
  date: string,
  matchId: string,
  title: string,
  content: string,
  actionRoute = '/manager/inbox',
): Promise<boolean> {
  const db = await getDatabase();
  const relatedId = `${MATCH_RESULT_RELATED_PREFIX}${matchId}`;
  const rows = await db.select<
    Array<{
      id: number;
      title: string;
      content: string;
      action_route: string | null;
    }>
  >(
    `SELECT id, title, content, action_route
     FROM inbox_messages
     WHERE team_id = $1
       AND category = 'general'
       AND related_id = $2
     ORDER BY id DESC
     LIMIT 1`,
    [teamId, relatedId],
  );

  const existing = rows[0];
  if (!existing) {
    await db.execute(
      `INSERT INTO inbox_messages (
        team_id, category, title, content, action_required, action_route, related_id, created_date
      ) VALUES ($1, 'general', $2, $3, 1, $4, $5, $6)`,
      [teamId, title, content, actionRoute, relatedId, date],
    );
    invalidateNotifications();
    return true;
  }

  if (existing.title === title && existing.content === content && existing.action_route === actionRoute) {
    return false;
  }

  await db.execute(
    `UPDATE inbox_messages
     SET title = $2,
         content = $3,
         action_required = 1,
         action_route = $4,
         is_read = 0,
         created_date = $5
     WHERE id = $1`,
    [existing.id, title, content, actionRoute, date],
  );
  invalidateNotifications();
  return true;
}
