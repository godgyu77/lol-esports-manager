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
import { MainLoopPanel } from '../components/MainLoopPanel';
import { useToolbarNavigation } from '../hooks/useToolbarNavigation';

const CATEGORIES: Array<InboxCategory | 'all' | 'fan'> = ['all', 'fan', 'transfer', 'contract', 'complaint', 'board', 'injury', 'promise', 'scouting', 'news', 'general'];

const CATEGORY_COLORS: Record<string, string> = {
  transfer: '#c89b3c',
  contract: '#3498db',
  complaint: '#e74c3c',
  board: '#9b59b6',
  injury: '#ff6b6b',
  promise: '#2ecc71',
  scouting: '#f39c12',
  news: '#4ecdc4',
  general: '#8a8a9a',
};

const FAN_LETTER_COLORS: Record<string, string> = {
  support: '#2ecc71',
  criticism: '#e74c3c',
  advice: '#3498db',
  confession: '#9b59b6',
  meme: '#f39c12',
};

const FAN_LETTER_LABELS: Record<string, string> = {
  support: '응원',
  criticism: '쓴소리',
  advice: '조언',
  confession: '고백',
  meme: '밈',
};

function getInboxPresentation(message: InboxMessage): 'alert' | 'briefing' | 'task' {
  if (message.actionRequired || ['complaint', 'injury', 'promise', 'board', 'contract'].includes(message.category)) {
    return 'alert';
  }
  if (['news', 'general', 'scouting'].includes(message.category)) {
    return 'briefing';
  }
  return 'task';
}

function getInboxPresentationLabel(message: InboxMessage): string {
  const presentation = getInboxPresentation(message);
  if (presentation === 'alert') return '알림';
  if (presentation === 'briefing') return '브리핑';
  return '작업';
}

function getInboxPresentationColor(message: InboxMessage): string {
  const presentation = getInboxPresentation(message);
  if (presentation === 'alert') return '#ef4444';
  if (presentation === 'briefing') return '#34d399';
  return '#60a5fa';
}

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
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const [fanLetters, setFanLetters] = useState<FanLetter[]>([]);
  const [fanLetterReply, setFanLetterReply] = useState<Record<number, string>>({});
  const [fanLoading, setFanLoading] = useState(false);
  const { getItemProps } = useToolbarNavigation({
    items: CATEGORIES,
    activeItem: filter,
    onSelect: setFilter,
  });

  const userTeamId = save?.userTeamId ?? '';

  const loadData = useCallback(async () => {
    if (!save) return;
    setIsLoading(true);
    try {
      const [msgs, count] = await Promise.all([
        getInboxMessages(userTeamId, 100, showUnreadOnly),
        getUnreadInboxCount(userTeamId),
      ]);
      setMessages(msgs);
      setUnreadCount(count);
    } catch (err) {
      console.error('인박스 로딩 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, [save, showUnreadOnly, userTeamId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (filter !== 'fan' || !season || !userTeamId) return;
    let cancelled = false;

    const loadFanLetters = async () => {
      setFanLoading(true);
      try {
        const userTeam = teams.find((team) => team.id === userTeamId);
        const teamName = userTeam?.name ?? '팀';

        const matches = await getMatchesByTeam(season.id, userTeamId);
        const playedMatches = matches.filter((match) => match.isPlayed).sort((a, b) => b.week - a.week);
        let wins = 0;
        let losses = 0;
        for (const match of playedMatches.slice(0, 4)) {
          const isHome = match.teamHomeId === userTeamId;
          const userScore = isHome ? match.scoreHome : match.scoreAway;
          const oppScore = isHome ? match.scoreAway : match.scoreHome;
          if (userScore > oppScore) wins += 1;
          else losses += 1;
        }
        const recentForm = `${wins}승 ${losses}패`;

        let isWinStreak = true;
        for (const match of playedMatches.slice(0, 3)) {
          const isHome = match.teamHomeId === userTeamId;
          const userScore = isHome ? match.scoreHome : match.scoreAway;
          const oppScore = isHome ? match.scoreAway : match.scoreHome;
          if (userScore <= oppScore) {
            isWinStreak = false;
            break;
          }
        }

        const standings = await getStandings(season.id);
        const myStanding = standings.findIndex((standing) => standing.teamId === userTeamId) + 1;

        const count = Math.floor(Math.random() * 2) + 2;
        const letters: FanLetter[] = [];
        for (let i = 0; i < count; i += 1) {
          const letter = await generateFanLetter({
            teamName,
            recentForm,
            standing: myStanding || 5,
            isWinStreak,
          });
          letters.push(letter);
        }
        if (!cancelled) setFanLetters(letters);
      } catch (error) {
        console.warn('팬레터 로딩 실패:', error);
      } finally {
        if (!cancelled) setFanLoading(false);
      }
    };

    void loadFanLetters();
    return () => {
      cancelled = true;
    };
  }, [filter, season, teams, userTeamId]);

  const handleExpand = async (msg: InboxMessage) => {
    if (expandedId === msg.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(msg.id);

    if (!msg.isRead) {
      await markInboxRead(msg.id);
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setMessages((prev) => prev.map((item) => (item.id === msg.id ? { ...item, isRead: true } : item)));
    }
  };

  const handleMarkAllRead = async () => {
    await markAllInboxRead(userTeamId);
    setUnreadCount(0);
    setMessages((prev) => prev.map((message) => ({ ...message, isRead: true })));
  };

  if (!save) return <p className="fm-text-muted">데이터를 불러오는 중...</p>;
  if (isLoading) return <p className="fm-text-muted">인박스를 불러오는 중...</p>;

  const filtered = filter === 'all' ? messages : messages.filter((message) => message.category === filter);
  const inboxRisk = filtered.find((message) => getInboxPresentation(message) === 'alert')
    ?? messages.find((message) => getInboxPresentation(message) === 'alert')
    ?? null;
  const newestBriefing = filtered.find((message) => getInboxPresentation(message) === 'briefing')
    ?? messages.find((message) => getInboxPresentation(message) === 'briefing')
    ?? null;

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">인박스 ({unreadCount}건 미확인)</h1>
        <div className="fm-flex fm-gap-sm">
          <button className={`fm-btn ${showUnreadOnly ? '' : 'fm-btn--ghost'}`} onClick={() => setShowUnreadOnly((prev) => !prev)} aria-pressed={showUnreadOnly}>
            {showUnreadOnly ? '전체 메시지 보기' : '읽지 않은 메시지만 보기'}
          </button>
          <button className="fm-btn fm-btn--ghost" onClick={handleMarkAllRead}>모두 읽음 처리</button>
        </div>
      </div>

      <MainLoopPanel
        eyebrow="Inbox Rules"
        title="읽음 상태는 강조만 지우고, 목록은 유지합니다"
        subtitle="알림은 우선순위를 높게 유지하고, 브리핑은 맥락을 남겨 두며, 작업형 메시지는 실행 버튼으로 바로 이어지게 정리했습니다."
        insights={[
          {
            label: '오늘 해야 할 일',
            value: showUnreadOnly ? '미확인만 검토 중' : '전체 메시지 검토',
            detail: filtered[0] ? `최신 메시지: ${filtered[0].title}` : '현재 필터에 해당하는 메시지가 없습니다.',
            tone: 'accent',
          },
          {
            label: '가장 큰 리스크',
            value: inboxRisk ? getInboxPresentationLabel(inboxRisk) : '안정',
            detail: inboxRisk?.title ?? '즉시 확인이 필요한 인박스 알림은 없습니다.',
            tone: inboxRisk ? 'danger' : 'success',
          },
          {
            label: '다음 경기 준비',
            value: newestBriefing ? '브리핑 도착' : '대기 중',
            detail: newestBriefing ? `브리핑 제목: ${newestBriefing.title}` : '새로운 팀 브리핑은 아직 없습니다.',
            tone: 'accent',
          },
          {
            label: '목록 유지 규칙',
            value: '읽음 후에도 유지',
            detail: '읽음 처리는 배지와 미확인 강조만 정리합니다. 기록은 계속 남아 흐름을 잃지 않게 했습니다.',
            tone: 'success',
          },
        ]}
        actions={[
          { label: showUnreadOnly ? '루프에서 전체 보기' : '루프에서 미확인만 보기', onClick: () => setShowUnreadOnly((prev) => !prev), variant: 'primary' },
          { label: '모두 읽음 처리', onClick: () => void handleMarkAllRead() },
          { label: '뉴스 보기', onClick: () => navigate('/manager/news'), variant: 'info' },
        ]}
        note="기사형 정보는 뉴스에서, 알림과 작업형 메시지는 인박스에서 처리하는 흐름으로 역할을 분리했습니다."
      />

      <div className="fm-tabs" role="tablist" aria-label="인박스 필터" aria-orientation="horizontal">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            className={`fm-tab ${filter === category ? 'fm-tab--active' : ''}`}
            onClick={() => setFilter(category)}
            role="tab"
            aria-selected={filter === category}
            aria-controls={`inbox-panel-${category}`}
            id={`inbox-tab-${category}`}
            {...getItemProps(category)}
          >
            {category === 'all' ? '전체' : category === 'fan' ? '팬레터' : INBOX_CATEGORY_LABELS[category as InboxCategory]}
          </button>
        ))}
      </div>

      {filter === 'fan' && (
        <div role="tabpanel" id={`inbox-panel-${filter}`} aria-labelledby={`inbox-tab-${filter}`}>
          {fanLoading ? (
            <p className="fm-text-muted fm-text-md">팬레터를 불러오는 중...</p>
          ) : fanLetters.length === 0 ? (
            <p className="fm-text-muted fm-text-md">팬레터가 없습니다.</p>
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
                    <span className="fm-flex-1 fm-font-semibold fm-text-primary fm-text-md">{letter.subject}</span>
                    <span className="fm-text-sm fm-text-muted">from: {letter.from}</span>
                  </div>
                  <div className="fm-mt-sm">
                    <p className="fm-text-md fm-text-secondary" style={{ margin: 0 }}>{letter.content}</p>
                  </div>

                  {!fanLetterReply[idx] ? (
                    <div className="fm-flex fm-gap-sm fm-flex-wrap fm-mt-sm">
                      {letter.replyOptions.map((reply, replyIndex) => (
                        <button
                          key={replyIndex}
                          className="fm-btn fm-btn--sm"
                          onClick={async () => {
                            setFanLetterReply((prev) => ({ ...prev, [idx]: reply }));
                            try {
                              const { getDatabase } = await import('../../../db/database');
                              const db = await getDatabase();
                              if (save?.userTeamId) {
                                await db.execute(
                                  'UPDATE players SET popularity = MIN(100, popularity + 2) WHERE team_id = $1',
                                  [save.userTeamId],
                                );
                              }
                              if (season) {
                                await db.execute(
                                  `INSERT INTO daily_events (season_id, event_date, event_type, team_id, description)
                                   VALUES ($1, $2, 'fan_letter_reply', $3, $4)`,
                                  [season.id, season.currentDate, save?.userTeamId, `팬레터 응답: ${reply}`],
                                );
                              }
                            } catch {
                              // Ignore bonus failures.
                            }
                          }}
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="fm-alert fm-alert--success fm-mt-sm">
                      <span className="fm-text-sm fm-font-semibold fm-text-accent">응답 완료:</span>
                      <span className="fm-alert__text fm-text-base fm-text-secondary">{fanLetterReply[idx]}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {filter !== 'fan' && (
        <div role="tabpanel" id={`inbox-panel-${filter}`} aria-labelledby={`inbox-tab-${filter}`}>
          {filtered.length === 0 ? (
            <p className="fm-text-muted fm-text-md">
              {showUnreadOnly ? '읽지 않은 메시지가 없습니다.' : '메시지가 없습니다.'}
            </p>
          ) : (
            <div className="fm-flex-col fm-gap-xs">
            {filtered.map((msg) => (
              <div
                key={msg.id}
                className={`fm-card ${!msg.isRead ? 'fm-card--highlight' : ''}`}
                style={{ borderLeft: `3px solid ${CATEGORY_COLORS[msg.category] ?? '#8a8a9a'}` }}
              >
                <button
                  type="button"
                  className="fm-btn fm-btn--ghost"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: 0, textAlign: 'left', border: 'none', minHeight: 0 }}
                  onClick={() => void handleExpand(msg)}
                  aria-expanded={expandedId === msg.id}
                  aria-controls={`inbox-message-${msg.id}`}
                >
                <div className="fm-flex fm-items-center fm-gap-sm" style={{ width: '100%' }}>
                  <span
                    className="fm-badge"
                    style={{
                      background: `${CATEGORY_COLORS[msg.category] ?? '#8a8a9a'}30`,
                      color: CATEGORY_COLORS[msg.category],
                    }}
                  >
                    {INBOX_CATEGORY_LABELS[msg.category] ?? msg.category}
                  </span>
                  <span
                    className="fm-badge"
                    aria-label={`message type: ${getInboxPresentationLabel(msg)}`}
                    style={{
                      background: `${getInboxPresentationColor(msg)}22`,
                      color: getInboxPresentationColor(msg),
                    }}
                  >
                    {getInboxPresentationLabel(msg)}
                  </span>
                  <span className={`fm-flex-1 fm-text-md ${msg.isRead ? 'fm-text-muted' : 'fm-font-semibold fm-text-primary'}`}>
                    {msg.title}
                  </span>
                  {msg.actionRequired && <span className="fm-badge fm-badge--danger">조치 필요</span>}
                  {!msg.isRead && (
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" />
                  )}
                  <span className="fm-text-sm fm-text-muted">{msg.createdDate}</span>
                </div>
                </button>
                {expandedId === msg.id && (
                  <div id={`inbox-message-${msg.id}`} className="fm-mt-sm" style={{ paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                    <p className="fm-text-md fm-text-secondary" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                    {msg.actionRoute && (
                      <button className="fm-btn fm-btn--primary fm-btn--sm fm-mt-sm" onClick={(e) => { e.stopPropagation(); if (msg.actionRoute) void navigate(msg.actionRoute); }}>
                        이동 &rarr;
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
