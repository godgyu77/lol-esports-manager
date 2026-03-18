/**
 * 받은 편지함 페이지
 * - 모든 알림을 카테고리별로 관리
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../../stores/gameStore';
import {
  getInboxMessages,
  getUnreadInboxCount,
  markInboxRead,
  markAllInboxRead,
} from '../../../engine/inbox/inboxEngine';
import type { InboxMessage, InboxCategory } from '../../../types/inbox';
import { INBOX_CATEGORY_LABELS } from '../../../types/inbox';

const CATEGORIES: (InboxCategory | 'all')[] = ['all', 'transfer', 'contract', 'complaint', 'board', 'injury', 'promise', 'scouting', 'news', 'general'];

const CATEGORY_COLORS: Record<string, string> = {
  transfer: '#c89b3c', contract: '#3498db', complaint: '#e74c3c',
  board: '#9b59b6', injury: '#ff6b6b', promise: '#2ecc71',
  scouting: '#f39c12', news: '#4ecdc4', general: '#8a8a9a',
};

export function InboxView() {
  const save = useGameStore((s) => s.save);
  const navigate = useNavigate();

  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<InboxCategory | 'all'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const userTeamId = save?.userTeamId ?? '';

  const loadData = useCallback(async () => {
    if (!save) return;
    setIsLoading(true);
    try {
      const [msgs, count] = await Promise.all([
        getInboxMessages(userTeamId, 100),
        getUnreadInboxCount(userTeamId),
      ]);
      setMessages(msgs);
      setUnreadCount(count);
    } catch (err) {
      console.error('편지함 로딩 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, [save, userTeamId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExpand = async (msg: InboxMessage) => {
    if (expandedId === msg.id) { setExpandedId(null); return; }
    setExpandedId(msg.id);
    if (!msg.isRead) {
      await markInboxRead(msg.id);
      await loadData();
    }
  };

  const handleMarkAllRead = async () => {
    await markAllInboxRead(userTeamId);
    await loadData();
  };

  if (!save) return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  if (isLoading) return <p style={{ color: '#6a6a7a' }}>편지함을 불러오는 중...</p>;

  const filtered = filter === 'all' ? messages : messages.filter(m => m.category === filter);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={styles.title}>편지함 ({unreadCount}건 미확인)</h1>
        <button style={styles.readAllBtn} onClick={handleMarkAllRead}>모두 읽음 처리</button>
      </div>

      <div style={styles.filterRow}>
        {CATEGORIES.map(cat => (
          <button key={cat} style={{ ...styles.filterBtn, ...(filter === cat ? styles.filterActive : {}) }}
                  onClick={() => setFilter(cat)}>
            {cat === 'all' ? '전체' : INBOX_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: '#6a6a7a', fontSize: '13px' }}>메시지가 없습니다.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filtered.map(msg => (
            <div key={msg.id} style={{
              ...styles.msgCard,
              borderLeft: `3px solid ${CATEGORY_COLORS[msg.category] ?? '#8a8a9a'}`,
              background: msg.isRead ? '#12122a' : 'rgba(200,155,60,0.05)',
            }} onClick={() => handleExpand(msg)}>
              <div style={styles.msgHeader}>
                <span style={{ ...styles.catTag, background: `${CATEGORY_COLORS[msg.category] ?? '#8a8a9a'}30`, color: CATEGORY_COLORS[msg.category] }}>
                  {INBOX_CATEGORY_LABELS[msg.category] ?? msg.category}
                </span>
                <span style={{ flex: 1, fontWeight: msg.isRead ? 400 : 600, color: msg.isRead ? '#8a8a9a' : '#e0e0e0', fontSize: '13px' }}>
                  {msg.title}
                </span>
                {msg.actionRequired && <span style={styles.actionBadge}>조치 필요</span>}
                {!msg.isRead && <span style={styles.unreadDot} />}
                <span style={{ fontSize: '11px', color: '#555' }}>{msg.createdDate}</span>
              </div>
              {expandedId === msg.id && (
                <div style={styles.msgBody}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#c0c0d0', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                  {msg.actionRoute && (
                    <button style={styles.actionBtn} onClick={(e) => { e.stopPropagation(); navigate(msg.actionRoute!); }}>
                      이동 →
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { fontSize: '24px', fontWeight: 700, color: '#f0e6d2' },
  readAllBtn: {
    padding: '6px 14px', background: 'none', border: '1px solid #3a3a5c',
    borderRadius: '6px', color: '#8a8a9a', fontSize: '12px', cursor: 'pointer',
  },
  filterRow: { display: 'flex', gap: '4px', marginBottom: '16px', flexWrap: 'wrap' },
  filterBtn: {
    padding: '5px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid #2a2a4a',
    borderRadius: '6px', color: '#8a8a9a', fontSize: '11px', cursor: 'pointer',
  },
  filterActive: { background: 'rgba(200,155,60,0.15)', borderColor: '#c89b3c', color: '#c89b3c' },
  msgCard: {
    padding: '10px 14px', borderRadius: '6px', border: '1px solid #2a2a4a',
    cursor: 'pointer', transition: 'background 0.2s',
  },
  msgHeader: { display: 'flex', alignItems: 'center', gap: '8px' },
  catTag: { fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '3px' },
  actionBadge: {
    fontSize: '10px', fontWeight: 600, color: '#e74c3c',
    background: 'rgba(231,76,60,0.15)', padding: '2px 6px', borderRadius: '3px',
  },
  unreadDot: {
    width: '8px', height: '8px', borderRadius: '50%', background: '#c89b3c',
  },
  msgBody: { marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #2a2a4a' },
  actionBtn: {
    marginTop: '8px', padding: '6px 14px', background: '#c89b3c', color: '#0d0d1a',
    border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
  },
};
