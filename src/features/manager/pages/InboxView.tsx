import { useEffect, useState, useCallback, useMemo } from 'react';
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

const CATEGORIES: Array<InboxCategory | 'all' | 'fan'> = [
  'all',
  'transfer',
  'contract',
  'complaint',
  'board',
  'injury',
  'promise',
  'scouting',
  'general',
  'fan',
];

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
  if (presentation === 'alert') return '조치 필요';
  if (presentation === 'briefing') return '참고';
  return '업무';
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
  const [, setUnreadCount] = useState(0);
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
      console.error('받은편지 로딩 실패:', err);
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
        const teamName = userTeam?.name ?? '우리 팀';

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

  const filtered = useMemo(() => {
    if (filter === 'fan') return [];
    if (filter === 'all') return messages;
    return messages.filter((message) => message.category === filter);
  }, [filter, messages]);

  const actionMessages = filtered.filter((message) => getInboxPresentation(message) === 'alert');
  const briefingMessages = filtered.filter((message) => getInboxPresentation(message) !== 'alert');
  const inboxRisk = actionMessages[0] ?? messages.find((message) => getInboxPresentation(message) === 'alert') ?? null;
  const newestBriefing = briefingMessages[0] ?? messages.find((message) => getInboxPresentation(message) !== 'alert') ?? null;

  if (!save) return <p className="fm-text-muted">데이터를 불러오는 중입니다...</p>;
  if (isLoading) return <p className="fm-text-muted">받은편지를 불러오는 중입니다...</p>;

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">받은편지</h1>
        <div className="fm-flex fm-gap-sm">
          <button className={`fm-btn ${showUnreadOnly ? '' : 'fm-btn--ghost'}`} onClick={() => setShowUnreadOnly((prev) => !prev)} aria-pressed={showUnreadOnly}>
            {showUnreadOnly ? '전체 메시지 보기' : '미확인 메시지만 보기'}
          </button>
          <button className="fm-btn fm-btn--ghost" onClick={handleMarkAllRead}>모두 읽음 처리</button>
        </div>
      </div>

      <MainLoopPanel
        eyebrow="받은편지 규칙"
        title="받은편지는 처리할 메시지 중심으로, 뉴스는 읽는 기사 중심으로 분리했습니다."
        subtitle="계약, 불만, 보드 압박, 부상처럼 직접 조치가 필요한 항목을 먼저 보고, 참고용 정보는 낮은 우선순위로 확인하는 구조입니다."
        insights={[
          {
            label: '오늘 처리할 일',
            value: showUnreadOnly ? '미확인만 보는 중' : '전체 메시지 검토 중',
            detail: filtered[0] ? `가장 최근 메시지: ${filtered[0].title}` : '현재 필터에 해당하는 메시지가 없습니다.',
            tone: 'accent',
          },
          {
            label: '가장 큰 리스크',
            value: inboxRisk ? getInboxPresentationLabel(inboxRisk) : '안정',
            detail: inboxRisk?.title ?? '즉시 확인이 필요한 운영 메시지가 없습니다.',
            tone: inboxRisk ? 'danger' : 'success',
          },
          {
            label: '읽는 정보',
            value: newestBriefing ? '참고 메시지 있음' : '대기 중',
            detail: newestBriefing ? `${newestBriefing.title} 같은 참고성 메시지는 빠르게 읽고 넘기면 됩니다.` : '참고용 메시지는 아직 없습니다.',
            tone: 'accent',
          },
        ]}
        actions={[
          { label: showUnreadOnly ? '전체 메시지 보기' : '미확인만 보기', onClick: () => setShowUnreadOnly((prev) => !prev), variant: 'primary' },
          { label: '모두 읽음 처리', onClick: () => void handleMarkAllRead() },
          { label: '뉴스 보기', onClick: () => navigate('/manager/news'), variant: 'info' },
        ]}
        note="기사형 정보는 뉴스 화면에서 읽고, 받은편지에서는 실제로 처리해야 하는 운영 메시지를 우선 확인합니다."
      />

      <div className="fm-tabs" role="tablist" aria-label="받은편지 필터" aria-orientation="horizontal">
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
            <p className="fm-text-muted fm-text-md">팬레터를 불러오는 중입니다...</p>
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
                    <span className="fm-text-sm fm-text-muted">보낸 사람: {letter.from}</span>
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
        <div role="tabpanel" id={`inbox-panel-${filter}`} aria-labelledby={`inbox-tab-${filter}`} className="fm-flex-col fm-gap-md">
          {filtered.length === 0 ? (
            <p className="fm-text-muted fm-text-md">
              {showUnreadOnly ? '읽지 않은 메시지가 없습니다.' : '메시지가 없습니다.'}
            </p>
          ) : (
            <>
              {actionMessages.length > 0 && (
                <div className="fm-panel">
                  <div className="fm-panel__header">
                    <span className="fm-panel__title">우선 처리</span>
                  </div>
                  <div className="fm-panel__body fm-flex-col fm-gap-xs">
                    {actionMessages.map((msg) => (
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
                            <span className="fm-badge" style={{ background: `${CATEGORY_COLORS[msg.category] ?? '#8a8a9a'}30`, color: CATEGORY_COLORS[msg.category] }}>
                              {INBOX_CATEGORY_LABELS[msg.category] ?? msg.category}
                            </span>
                            <span
                              className="fm-badge"
                              aria-label={`message type: ${getInboxPresentationLabel(msg)}`}
                              style={{ background: `${getInboxPresentationColor(msg)}22`, color: getInboxPresentationColor(msg) }}
                            >
                              {getInboxPresentationLabel(msg)}
                            </span>
                            <span className={`fm-flex-1 fm-text-md ${msg.isRead ? 'fm-text-muted' : 'fm-font-semibold fm-text-primary'}`}>
                              {msg.title}
                            </span>
                            {msg.actionRequired && <span className="fm-badge fm-badge--danger">즉시 확인</span>}
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
                                바로 이동
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {briefingMessages.length > 0 && (
                <div className="fm-panel">
                  <div className="fm-panel__header">
                    <span className="fm-panel__title">참고 메시지</span>
                  </div>
                  <div className="fm-panel__body fm-flex-col fm-gap-xs">
                    {briefingMessages.map((msg) => (
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
                            <span className="fm-badge" style={{ background: `${CATEGORY_COLORS[msg.category] ?? '#8a8a9a'}30`, color: CATEGORY_COLORS[msg.category] }}>
                              {INBOX_CATEGORY_LABELS[msg.category] ?? msg.category}
                            </span>
                            <span
                              className="fm-badge"
                              aria-label={`message type: ${getInboxPresentationLabel(msg)}`}
                              style={{ background: `${getInboxPresentationColor(msg)}22`, color: getInboxPresentationColor(msg) }}
                            >
                              {getInboxPresentationLabel(msg)}
                            </span>
                            <span className={`fm-flex-1 fm-text-md ${msg.isRead ? 'fm-text-muted' : 'fm-font-semibold fm-text-primary'}`}>
                              {msg.title}
                            </span>
                            {!msg.isRead && (
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" />
                            )}
                            <span className="fm-text-sm fm-text-muted">{msg.createdDate}</span>
                          </div>
                        </button>
                        {expandedId === msg.id && (
                          <div id={`inbox-message-${msg.id}`} className="fm-mt-sm" style={{ paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                            <p className="fm-text-md fm-text-secondary" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                            <div className="fm-flex fm-gap-sm fm-mt-sm">
                              {msg.actionRoute && (
                                <button className="fm-btn fm-btn--primary fm-btn--sm" onClick={(e) => { e.stopPropagation(); if (msg.actionRoute) void navigate(msg.actionRoute); }}>
                                  바로 이동
                                </button>
                              )}
                              {msg.category === 'news' && (
                                <button className="fm-btn fm-btn--info fm-btn--sm" onClick={(e) => { e.stopPropagation(); void navigate('/manager/news'); }}>
                                  뉴스 화면 열기
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
