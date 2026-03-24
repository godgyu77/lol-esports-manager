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
  injury_report:     { icon: '\u{1F915}', color: '#f87171' },
  transfer_complete: { icon: '\u{1F91D}', color: '#a78bfa' },
  scandal:           { icon: '\u26A0', color: '#ef4444' },
  fan_reaction:      { icon: '\u{1F4AC}', color: '#fb923c' },
  award_news:        { icon: '\u{1F3C6}', color: '#fbbf24' },
  patch_notes:       { icon: '\u{1F527}', color: '#60a5fa' },
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
  const badgeClass = importance >= 3 ? 'fm-badge--danger' : 'fm-badge--warning';
  const label = importance >= 3 ? '핵심' : '주요';
  return (
    <span className={`fm-badge ${badgeClass}`}>
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
    return <p className="fm-text-muted">시즌 데이터를 불러오는 중...</p>;
  }

  const grouped = groupByDate(articles);

  return (
    <div>
      {/* 헤더 */}
      <div className="fm-page-header">
        <div>
          <h1 className="fm-page-title">뉴스피드</h1>
          <p className="fm-page-subtitle fm-flex fm-items-center fm-gap-sm">
            {season.year} {season.split === 'spring' ? '스프링' : '서머'} 시즌 뉴스
            {unreadCount > 0 && (
              <span className="fm-badge fm-badge--danger">{unreadCount}건 안 읽음</span>
            )}
          </p>
        </div>
        {unreadCount > 0 && (
          <button className="fm-btn" onClick={handleMarkAllRead}>
            모두 읽음 처리
          </button>
        )}
      </div>

      {/* 카테고리 필터 */}
      <div className="fm-tabs">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`fm-tab ${filter === tab.key ? 'fm-tab--active' : ''}`}
            onClick={() => handleFilterChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 빈 상태 */}
      {articles.length === 0 && !loading && (
        <div className="fm-card fm-text-center fm-p-lg">
          <p className="fm-text-lg fm-text-muted">아직 뉴스가 없습니다.</p>
        </div>
      )}

      {/* 뉴스 타임라인 */}
      <div
        className="fm-flex-col"
        style={{ borderLeft: '2px solid var(--border)', marginLeft: '12px', paddingLeft: '24px' }}
      >
        {[...grouped.entries()].map(([date, dayArticles]) => (
          <div key={date} className="fm-mb-lg">
            {/* 날짜 헤더 */}
            <div className="fm-flex fm-items-center fm-gap-sm fm-mb-md" style={{ position: 'relative' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  position: 'absolute',
                  left: '-30px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <span className="fm-text-lg fm-font-bold fm-text-primary">{date}</span>
              <span className="fm-badge fm-badge--default">{dayArticles.length}건</span>
            </div>

            {/* 뉴스 카드 목록 */}
            <div className="fm-flex-col fm-gap-sm">
              {dayArticles.map((article) => {
                const config = CATEGORY_CONFIG[article.category];
                const isExpanded = expandedId === article.id;
                return (
                  <div
                    key={article.id}
                    className={`fm-card fm-card--clickable fm-flex fm-gap-md ${!article.isRead ? 'fm-card--highlight' : ''}`}
                    style={{ alignItems: 'flex-start' }}
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
                      className="fm-flex fm-items-center fm-justify-center fm-flex-shrink-0"
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: `${config.color}20`,
                        color: config.color,
                        fontSize: '16px',
                      }}
                    >
                      {config.icon}
                    </div>

                    {/* 본문 */}
                    <div className="fm-flex-1" style={{ minWidth: 0 }}>
                      <div className="fm-flex fm-items-center fm-gap-sm fm-mb-xs">
                        <span
                          className="fm-badge"
                          style={{
                            background: `${config.color}20`,
                            color: config.color,
                          }}
                        >
                          {NEWS_CATEGORY_LABELS[article.category]}
                        </span>
                        <ImportanceBadge importance={article.importance} />
                        {!article.isRead && (
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                        )}
                      </div>
                      <p className="fm-text-lg fm-font-semibold fm-text-primary" style={{ margin: 0, lineHeight: '1.4' }}>
                        {article.title}
                      </p>
                      {isExpanded && (
                        <p className="fm-text-md fm-text-secondary fm-mt-sm" style={{ margin: '8px 0 0 0', lineHeight: '1.6' }}>
                          {article.content}
                        </p>
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
        <div className="fm-text-center fm-mt-md">
          <button
            className="fm-btn fm-btn--lg"
            onClick={handleLoadMore}
            disabled={loading}
          >
            {loading ? '불러오는 중...' : '더보기'}
          </button>
        </div>
      )}

      {loading && articles.length === 0 && (
        <p className="fm-text-md fm-text-muted fm-text-center fm-p-lg">뉴스를 불러오는 중...</p>
      )}
    </div>
  );
}
