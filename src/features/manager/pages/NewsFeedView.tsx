import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import type { NewsArticle, NewsCategory } from '../../../types/news';
import { NEWS_CATEGORY_LABELS } from '../../../types/news';
import { getRecentNews, getUnreadCount, markAsRead, markAllAsRead } from '../../../engine/news/newsEngine';

const PAGE_SIZE = 20;

/** 카테고리별 색상 및 아이콘 */
const CATEGORY_CONFIG: Record<NewsCategory, { icon: string; color: string }> = {
  match_result:      { icon: '\u2694', color: '#c89b3c' },
  transfer_rumor:    { icon: '\u{1F4E6}', color: '#a78bfa' },
  player_complaint:  { icon: '\u{1F464}', color: '#f87171' },
  team_analysis:     { icon: '\u{1F4CA}', color: '#60a5fa' },
  interview:         { icon: '\u{1F3A4}', color: '#34d399' },
  social_media:      { icon: '\u{1F4F1}', color: '#fb923c' },
};

/** 필터 탭 목록 */
const FILTER_TABS: Array<{ key: NewsCategory | 'all'; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'match_result', label: '경기' },
  { key: 'transfer_rumor', label: '이적' },
  { key: 'player_complaint', label: '선수' },
  { key: 'team_analysis', label: '팀' },
  { key: 'interview', label: '인터뷰' },
  { key: 'social_media', label: 'SNS' },
];

/** 중요도 표시 */
function ImportanceBadge({ importance }: { importance: number }) {
  if (importance <= 1) return null;
  const label = importance >= 3 ? '핵심' : '주요';
  const color = importance >= 3 ? '#ef4444' : '#f59e0b';
  return (
    <span style={{ ...styles.importanceBadge, background: `${color}20`, color }}>
      {label}
    </span>
  );
}

/** 날짜별 그룹핑 */
function groupByDate(articles: NewsArticle[]): Map<string, NewsArticle[]> {
  const grouped = new Map<string, NewsArticle[]>();
  for (const article of articles) {
    const list = grouped.get(article.articleDate) ?? [];
    list.push(article);
    grouped.set(article.articleDate, list);
  }
  return grouped;
}

export function NewsFeedView() {
  const season = useGameStore((s) => s.season);

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<NewsCategory | 'all'>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadArticles = useCallback(async (offset: number, category: NewsCategory | 'all') => {
    if (!season) return;
    setLoading(true);
    try {
      const cat = category === 'all' ? undefined : category;
      const fetched = await getRecentNews(season.id, PAGE_SIZE, offset, cat);
      if (offset === 0) {
        setArticles(fetched);
      } else {
        setArticles((prev) => [...prev, ...fetched]);
      }
      setHasMore(fetched.length >= PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, [season]);

  const loadUnreadCount = useCallback(async () => {
    if (!season) return;
    const count = await getUnreadCount(season.id);
    setUnreadCount(count);
  }, [season]);

  useEffect(() => {
    loadArticles(0, filter);
    loadUnreadCount();
  }, [loadArticles, loadUnreadCount, filter]);

  const handleFilterChange = (newFilter: NewsCategory | 'all') => {
    setFilter(newFilter);
    setExpandedId(null);
  };

  const handleLoadMore = () => {
    loadArticles(articles.length, filter);
  };

  const handleToggleArticle = async (article: NewsArticle) => {
    if (expandedId === article.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(article.id);
    if (!article.isRead) {
      await markAsRead(article.id);
      setArticles((prev) =>
        prev.map((a) => (a.id === article.id ? { ...a, isRead: true } : a)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleMarkAllRead = async () => {
    if (!season) return;
    await markAllAsRead(season.id);
    setArticles((prev) => prev.map((a) => ({ ...a, isRead: true })));
    setUnreadCount(0);
  };

  if (!season) {
    return <p style={{ color: '#6a6a7a' }}>시즌 데이터를 불러오는 중...</p>;
  }

  const grouped = groupByDate(articles);

  return (
    <div>
      {/* 헤더 */}
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>뉴스피드</h1>
          <p style={styles.subtitle}>
            {season.year} {season.split === 'spring' ? '스프링' : '서머'} 시즌 뉴스
            {unreadCount > 0 && (
              <span style={styles.unreadBadge}>{unreadCount}건 안 읽음</span>
            )}
          </p>
        </div>
        {unreadCount > 0 && (
          <button style={styles.markAllBtn} onClick={handleMarkAllRead}>
            모두 읽음 처리
          </button>
        )}
      </div>

      {/* 카테고리 필터 */}
      <div style={styles.filterRow}>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            style={{
              ...styles.filterBtn,
              ...(filter === tab.key ? styles.filterBtnActive : {}),
            }}
            onClick={() => handleFilterChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 빈 상태 */}
      {articles.length === 0 && !loading && (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>아직 뉴스가 없습니다.</p>
        </div>
      )}

      {/* 뉴스 타임라인 */}
      <div style={styles.timeline}>
        {[...grouped.entries()].map(([date, dayArticles]) => (
          <div key={date} style={styles.dateGroup}>
            {/* 날짜 헤더 */}
            <div style={styles.dateHeader}>
              <div style={styles.dateDot} />
              <span style={styles.dateText}>{date}</span>
              <span style={styles.dateCount}>{dayArticles.length}건</span>
            </div>

            {/* 뉴스 카드 목록 */}
            <div style={styles.articleList}>
              {dayArticles.map((article) => {
                const config = CATEGORY_CONFIG[article.category];
                const isExpanded = expandedId === article.id;
                return (
                  <div
                    key={article.id}
                    style={{
                      ...styles.articleCard,
                      ...(article.isRead ? {} : styles.articleCardUnread),
                      ...(isExpanded ? styles.articleCardExpanded : {}),
                    }}
                    onClick={() => handleToggleArticle(article)}
                    role="button"
                    tabIndex={0}
                    aria-label={`뉴스: ${article.title}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggleArticle(article);
                      }
                    }}
                  >
                    {/* 아이콘 */}
                    <div
                      style={{
                        ...styles.articleIcon,
                        background: `${config.color}20`,
                        color: config.color,
                      }}
                    >
                      {config.icon}
                    </div>

                    {/* 본문 */}
                    <div style={styles.articleContent}>
                      <div style={styles.articleHeader}>
                        <span
                          style={{
                            ...styles.categoryBadge,
                            background: `${config.color}20`,
                            color: config.color,
                          }}
                        >
                          {NEWS_CATEGORY_LABELS[article.category]}
                        </span>
                        <ImportanceBadge importance={article.importance} />
                        {!article.isRead && <span style={styles.unreadDot} />}
                      </div>
                      <p style={styles.articleTitle}>{article.title}</p>
                      {isExpanded && (
                        <p style={styles.articleBody}>{article.content}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 더보기 */}
      {hasMore && articles.length > 0 && (
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

      {loading && articles.length === 0 && (
        <p style={styles.loadingText}>뉴스를 불러오는 중...</p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6a6a7a',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  unreadBadge: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#ef4444',
    background: 'rgba(239,68,68,0.15)',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  markAllBtn: {
    padding: '8px 16px',
    border: '1px solid #3a3a5c',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.03)',
    color: '#8a8a9a',
    fontSize: '13px',
    cursor: 'pointer',
  },
  // 필터
  filterRow: {
    display: 'flex',
    gap: '6px',
    marginBottom: '24px',
    flexWrap: 'wrap' as const,
  },
  filterBtn: {
    padding: '6px 14px',
    border: '1px solid #2a2a4a',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.03)',
    color: '#6a6a7a',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  filterBtnActive: {
    color: '#c89b3c',
    borderColor: '#c89b3c',
    background: 'rgba(200,155,60,0.1)',
  },
  // 빈 상태
  emptyState: {
    textAlign: 'center' as const,
    padding: '48px 0',
  },
  emptyText: {
    fontSize: '14px',
    color: '#6a6a7a',
  },
  // 타임라인
  timeline: {
    display: 'flex',
    flexDirection: 'column' as const,
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
    position: 'relative' as const,
  },
  dateDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#c89b3c',
    position: 'absolute' as const,
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
  // 뉴스 카드
  articleList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  articleCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  articleCardUnread: {
    borderLeftColor: '#c89b3c',
    borderLeftWidth: '3px',
    background: 'rgba(200,155,60,0.04)',
  },
  articleCardExpanded: {
    background: 'rgba(255,255,255,0.05)',
  },
  articleIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    flexShrink: 0,
  },
  articleContent: {
    flex: 1,
    minWidth: 0,
  },
  articleHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  categoryBadge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '4px',
  },
  importanceBadge: {
    fontSize: '10px',
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: '4px',
  },
  unreadDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#c89b3c',
    flexShrink: 0,
  },
  articleTitle: {
    fontSize: '14px',
    color: '#e0e0e0',
    margin: 0,
    lineHeight: '1.4',
    fontWeight: 600,
  },
  articleBody: {
    fontSize: '13px',
    color: '#a0a0b0',
    margin: '8px 0 0 0',
    lineHeight: '1.6',
  },
  // 더보기
  loadMoreWrap: {
    textAlign: 'center' as const,
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
    textAlign: 'center' as const,
    padding: '24px 0',
  },
};
