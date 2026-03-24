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
import { generateFanLetter, type FanLetter } from '../../../ai/advancedAiService';
import { getStandings, getMatchesByTeam } from '../../../db/queries';

const CATEGORIES: (InboxCategory | 'all' | 'fan')[] = ['all', 'fan', 'transfer', 'contract', 'complaint', 'board', 'injury', 'promise', 'scouting', 'news', 'general'];

const CATEGORY_COLORS: Record<string, string> = {
  transfer: '#c89b3c', contract: '#3498db', complaint: '#e74c3c',
  board: '#9b59b6', injury: '#ff6b6b', promise: '#2ecc71',
  scouting: '#f39c12', news: '#4ecdc4', general: '#8a8a9a',
};

const FAN_LETTER_COLORS: Record<string, string> = {
  support: '#2ecc71', criticism: '#e74c3c', advice: '#3498db',
  confession: '#9b59b6', meme: '#f39c12',
};
const FAN_LETTER_LABELS: Record<string, string> = {
  support: '응원', criticism: '쓴소리', advice: '조언',
  confession: '고백', meme: '밈',
};

export function InboxView() {
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);
  const navigate = useNavigate();

  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<InboxCategory | 'all' | 'fan'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 팬 레터 상태
  const [fanLetters, setFanLetters] = useState<FanLetter[]>([]);
  const [fanLetterReply, setFanLetterReply] = useState<Record<number, string>>({});
  const [fanLoading, setFanLoading] = useState(false);

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

  // 팬 레터 로드 (탭 전환 시)
  useEffect(() => {
    if (filter !== 'fan' || !season || !userTeamId) return;
    let cancelled = false;

    const loadFanLetters = async () => {
      setFanLoading(true);
      try {
        const userTeam = teams.find(t => t.id === userTeamId);
        const teamName = userTeam?.name ?? '팀';

        // 최근 성적
        const matches = await getMatchesByTeam(season.id, userTeamId);
        const playedMatches = matches.filter(m => m.isPlayed).sort((a, b) => b.week - a.week);
        let wins = 0; let losses = 0;
        for (const m of playedMatches.slice(0, 4)) {
          const isHome = m.teamHomeId === userTeamId;
          const userScore = isHome ? m.scoreHome : m.scoreAway;
          const oppScore = isHome ? m.scoreAway : m.scoreHome;
          if (userScore > oppScore) wins++; else losses++;
        }
        const recentForm = `${wins}승 ${losses}패`;

        // 연승 체크
        let isWinStreak = true;
        for (const m of playedMatches.slice(0, 3)) {
          const isHome = m.teamHomeId === userTeamId;
          const userScore = isHome ? m.scoreHome : m.scoreAway;
          const oppScore = isHome ? m.scoreAway : m.scoreHome;
          if (userScore <= oppScore) { isWinStreak = false; break; }
        }

        // 순위
        const standings = await getStandings(season.id);
        const myStanding = standings.findIndex(s => s.teamId === userTeamId) + 1;

        // 2~3개 팬레터 생성
        const count = Math.floor(Math.random() * 2) + 2;
        const letters: FanLetter[] = [];
        for (let i = 0; i < count; i++) {
          const letter = await generateFanLetter({
            teamName, recentForm, standing: myStanding || 5, isWinStreak,
          });
          letters.push(letter);
        }
        if (!cancelled) setFanLetters(letters);
      } catch (e) {
        console.warn('팬레터 로드 실패:', e);
      } finally {
        if (!cancelled) setFanLoading(false);
      }
    };

    loadFanLetters();
    return () => { cancelled = true; };
  }, [filter, season, userTeamId, teams]);

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

  if (!save) return <p className="fm-text-muted">데이터를 불러오는 중...</p>;
  if (isLoading) return <p className="fm-text-muted">편지함을 불러오는 중...</p>;

  const filtered = filter === 'all' ? messages : messages.filter(m => m.category === filter);

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">편지함 ({unreadCount}건 미확인)</h1>
        <button className="fm-btn fm-btn--ghost" onClick={handleMarkAllRead}>모두 읽음 처리</button>
      </div>

      <div className="fm-tabs">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`fm-tab ${filter === cat ? 'fm-tab--active' : ''}`}
            onClick={() => setFilter(cat)}
          >
            {cat === 'all' ? '전체' : cat === 'fan' ? '팬 레터' : INBOX_CATEGORY_LABELS[cat as InboxCategory]}
          </button>
        ))}
      </div>

      {/* 팬 레터 탭 */}
      {filter === 'fan' && (
        <div>
          {fanLoading ? (
            <p className="fm-text-muted fm-text-md">팬 레터를 불러오는 중...</p>
          ) : fanLetters.length === 0 ? (
            <p className="fm-text-muted fm-text-md">팬 레터가 없습니다.</p>
          ) : (
            <div className="fm-flex-col fm-gap-sm">
              {fanLetters.map((letter, idx) => (
                <div
                  key={idx}
                  className={`fm-card ${fanLetterReply[idx] ? '' : 'fm-card--highlight'}`}
                  style={{ borderLeft: `3px solid ${FAN_LETTER_COLORS[letter.type] ?? '#8a8a9a'}` }}
                >
                  <div className="fm-flex fm-items-center fm-gap-sm">
                    <span
                      className="fm-badge"
                      style={{
                        background: `${FAN_LETTER_COLORS[letter.type] ?? '#8a8a9a'}30`,
                        color: FAN_LETTER_COLORS[letter.type],
                      }}
                    >
                      {FAN_LETTER_LABELS[letter.type] ?? letter.type}
                    </span>
                    <span className="fm-flex-1 fm-font-semibold fm-text-primary fm-text-md">
                      {letter.subject}
                    </span>
                    <span className="fm-text-sm fm-text-muted">from: {letter.from}</span>
                  </div>
                  <div className="fm-mt-sm">
                    <p className="fm-text-md fm-text-secondary" style={{ margin: 0 }}>{letter.content}</p>
                  </div>

                  {/* 답장 선택지 */}
                  {!fanLetterReply[idx] ? (
                    <div className="fm-flex fm-gap-sm fm-flex-wrap fm-mt-sm">
                      {letter.replyOptions.map((reply, ri) => (
                        <button
                          key={ri}
                          className="fm-btn fm-btn--sm"
                          onClick={async () => {
                            setFanLetterReply(prev => ({ ...prev, [idx]: reply }));
                            // 답장 효과: 인기도 +2 (팬과의 소통)
                            try {
                              const { getDatabase } = await import('../../../db/database');
                              const db = await getDatabase();
                              // 팀 전체 인기도 소폭 상승
                              if (save?.userTeamId) {
                                await db.execute(
                                  'UPDATE players SET popularity = MIN(100, popularity + 2) WHERE team_id = $1',
                                  [save.userTeamId],
                                );
                              }
                              // 이벤트 로그 저장
                              if (season) {
                                await db.execute(
                                  `INSERT INTO daily_events (season_id, event_date, event_type, team_id, description)
                                   VALUES ($1, $2, 'fan_letter_reply', $3, $4)`,
                                  [season.id, season.currentDate, save?.userTeamId, `팬 레터 답장: ${reply}`],
                                );
                              }
                            } catch { /* 저장 실패 무시 */ }
                          }}
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="fm-alert fm-alert--success fm-mt-sm">
                      <span className="fm-text-sm fm-font-semibold fm-text-accent">답장 완료:</span>
                      <span className="fm-alert__text fm-text-base fm-text-secondary">{fanLetterReply[idx]}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {filter !== 'fan' && (filtered.length === 0 ? (
        <p className="fm-text-muted fm-text-md">메시지가 없습니다.</p>
      ) : (
        <div className="fm-flex-col fm-gap-xs">
          {filtered.map(msg => (
            <div
              key={msg.id}
              className={`fm-card fm-card--clickable ${!msg.isRead ? 'fm-card--highlight' : ''}`}
              style={{ borderLeft: `3px solid ${CATEGORY_COLORS[msg.category] ?? '#8a8a9a'}` }}
              onClick={() => handleExpand(msg)}
            >
              <div className="fm-flex fm-items-center fm-gap-sm">
                <span
                  className="fm-badge"
                  style={{
                    background: `${CATEGORY_COLORS[msg.category] ?? '#8a8a9a'}30`,
                    color: CATEGORY_COLORS[msg.category],
                  }}
                >
                  {INBOX_CATEGORY_LABELS[msg.category] ?? msg.category}
                </span>
                <span className={`fm-flex-1 fm-text-md ${msg.isRead ? 'fm-text-muted' : 'fm-font-semibold fm-text-primary'}`}>
                  {msg.title}
                </span>
                {msg.actionRequired && <span className="fm-badge fm-badge--danger">조치 필요</span>}
                {!msg.isRead && (
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                )}
                <span className="fm-text-sm fm-text-muted">{msg.createdDate}</span>
              </div>
              {expandedId === msg.id && (
                <div className="fm-mt-sm" style={{ paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                  <p className="fm-text-md fm-text-secondary" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                  {msg.actionRoute && (
                    <button className="fm-btn fm-btn--primary fm-btn--sm fm-mt-sm" onClick={(e) => { e.stopPropagation(); navigate(msg.actionRoute!); }}>
                      이동 &rarr;
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
