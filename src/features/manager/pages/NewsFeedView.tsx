import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getRecentDailyEvents } from '../../../db/queries';

interface DailyEvent {
  id: number;
  seasonId: number;
  gameDate: string;
  eventType: string;
  targetId: string | null;
  description: string;
}

const PAGE_SIZE = 20;

/** 이벤트 타입별 표시 설정 */
const EVENT_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  match_day: { label: '경기', icon: '\u2694', color: '#c89b3c' },
  training: { label: '훈련', icon: '\u{1F3CB}', color: '#50c878' },
  scrim:    { label: '스크림', icon: '\u{1F93C}', color: '#50c878' },
  rest:     { label: '휴식', icon: '\u{1F4A4}', color: '#6a6a7a' },
  transfer: { label: '이적', icon: '\u{1F4E6}', color: '#a78bfa' },
  patch:    { label: '패치', icon: '\u{1F527}', color: '#60a5fa' },
  injury:   { label: '부상', icon: '\u{1FA79}', color: '#dc3c3c' },
  recovery: { label: '회복', icon: '\u{1F49A}', color: '#50c878' },
  meeting:  { label: '미팅', icon: '\u{1F4CB}', color: '#60a5fa' },
  event:    { label: '이벤트', icon: '\u{1F4E2}', color: '#60a5fa' },
};

const DEFAULT_CONFIG = { label: '기타', icon: '\u{1F4CC}', color: '#6a6a7a' };

/** 날짜별로 이벤트를 그룹핑 */
function groupByDate(events: DailyEvent[]): Map<string, DailyEvent[]> {
  const grouped = new Map<string, DailyEvent[]>();
  for (const event of events) {
    const list = grouped.get(event.gameDate) ?? [];
    list.push(event);
    grouped.set(event.gameDate, list);
  }
  return grouped;
}

export function NewsFeedView() {
  const season = useGameStore((s) => s.season);

  const [events, setEvents] = useState<DailyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const loadEvents = useCallback(async (offset: number) => {
    if (!season) return;
    setLoading(true);
    try {
      const fetched = await getRecentDailyEvents(season.id, PAGE_SIZE, offset);
      if (offset === 0) {
        setEvents(fetched);
      } else {
        setEvents((prev) => [...prev, ...fetched]);
      }
      setHasMore(fetched.length >= PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, [season]);

  useEffect(() => {
    loadEvents(0);
  }, [loadEvents]);

  const handleLoadMore = () => {
    loadEvents(events.length);
  };

  if (!season) {
    return <p style={{ color: '#6a6a7a' }}>시즌 데이터를 불러오는 중...</p>;
  }

  const grouped = groupByDate(events);

  return (
    <div>
      <h1 style={styles.title}>뉴스피드</h1>
      <p style={styles.subtitle}>
        {season.year} {season.split === 'spring' ? '스프링' : '서머'} 시즌 이벤트
      </p>

      {events.length === 0 && !loading && (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>아직 기록된 이벤트가 없습니다.</p>
        </div>
      )}

      {/* 타임라인 */}
      <div style={styles.timeline}>
        {[...grouped.entries()].map(([date, dayEvents]) => (
          <div key={date} style={styles.dateGroup}>
            {/* 날짜 헤더 */}
            <div style={styles.dateHeader}>
              <div style={styles.dateDot} />
              <span style={styles.dateText}>{date}</span>
              <span style={styles.dateCount}>{dayEvents.length}건</span>
            </div>

            {/* 이벤트 카드 목록 */}
            <div style={styles.eventList}>
              {dayEvents.map((event) => {
                const config = EVENT_CONFIG[event.eventType] ?? DEFAULT_CONFIG;
                return (
                  <div key={event.id} style={styles.eventCard}>
                    <div
                      style={{
                        ...styles.eventIcon,
                        background: `${config.color}20`,
                        color: config.color,
                      }}
                    >
                      {config.icon}
                    </div>
                    <div style={styles.eventContent}>
                      <div style={styles.eventHeader}>
                        <span
                          style={{
                            ...styles.eventBadge,
                            background: `${config.color}20`,
                            color: config.color,
                          }}
                        >
                          {config.label}
                        </span>
                      </div>
                      <p style={styles.eventDesc}>
                        {event.description || `${config.label} 이벤트`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 더보기 버튼 */}
      {hasMore && events.length > 0 && (
        <div style={styles.loadMoreWrap}>
          <button
            style={styles.loadMoreBtn}
            onClick={handleLoadMore}
            disabled={loading}
          >
            {loading ? '불러오는 중...' : '더보기'}
          </button>
        </div>
      )}

      {loading && events.length === 0 && (
        <p style={styles.loadingText}>이벤트를 불러오는 중...</p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6a6a7a',
    marginBottom: '24px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 0',
  },
  emptyText: {
    fontSize: '14px',
    color: '#6a6a7a',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0px',
    borderLeft: '2px solid #2a2a4a',
    marginLeft: '12px',
    paddingLeft: '24px',
  },
  dateGroup: {
    marginBottom: '24px',
  },
  dateHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
    position: 'relative',
  },
  dateDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#c89b3c',
    position: 'absolute',
    left: '-30px',
    top: '50%',
    transform: 'translateY(-50%)',
  },
  dateText: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#f0e6d2',
  },
  dateCount: {
    fontSize: '12px',
    color: '#6a6a7a',
    background: 'rgba(255,255,255,0.05)',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  eventList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  eventCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
  },
  eventIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    flexShrink: 0,
  },
  eventContent: {
    flex: 1,
    minWidth: 0,
  },
  eventHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  eventBadge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '4px',
  },
  eventDesc: {
    fontSize: '13px',
    color: '#c0c0d0',
    margin: 0,
    lineHeight: '1.4',
  },
  loadMoreWrap: {
    textAlign: 'center',
    marginTop: '16px',
  },
  loadMoreBtn: {
    padding: '10px 32px',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.03)',
    color: '#c89b3c',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  loadingText: {
    fontSize: '13px',
    color: '#6a6a7a',
    textAlign: 'center',
    padding: '24px 0',
  },
};
