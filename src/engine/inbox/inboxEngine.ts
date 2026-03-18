/**
 * 받은 편지함 엔진
 * - 모든 알림을 한 곳에서 관리
 */

import { getDatabase } from '../../db/database';
import type { InboxMessage, InboxCategory } from '../../types/inbox';

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
  const rows = await db.select<any[]>(
    `SELECT * FROM inbox_messages WHERE team_id = $1 ${where} ORDER BY created_date DESC, id DESC LIMIT $2`,
    [teamId, limit],
  );
  return rows.map(r => ({
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
  }));
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
}

export async function markAllInboxRead(teamId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('UPDATE inbox_messages SET is_read = 1 WHERE team_id = $1', [teamId]);
}
