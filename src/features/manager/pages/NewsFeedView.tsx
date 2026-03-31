import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import type { NewsArticle, NewsCategory } from '../../../types/news';
import { NEWS_CATEGORY_LABELS } from '../../../types/news';
import { getRecentNews, getUnreadCount, markAllAsRead, markAsRead } from '../../../engine/news/newsEngine';
import './NewsFeedView.css';

const PAGE_SIZE = 20;

const CATEGORY_CONFIG: Record<NewsCategory, { icon: string; color: string }> = {
  match_result: { icon: '\u2694', color: '#c89b3c' },
  transfer_rumor: { icon: '\u{1F4E6}', color: '#a78bfa' },
  player_complaint: { icon: '\u{1F464}', color: '#f87171' },
  team_analysis: { icon: '\u{1F4CA}', color: '#60a5fa' },
  interview: { icon: '\u{1F3A4}', color: '#34d399' },
  social_media: { icon: '\u{1F4F1}', color: '#fb923c' },
  injury_report: { icon: '\u{1F915}', color: '#f87171' },
  transfer_complete: { icon: '\u{1F91D}', color: '#a78bfa' },
  scandal: { icon: '\u26A0', color: '#ef4444' },
  fan_reaction: { icon: '\u{1F4AC}', color: '#fb923c' },
  award_news: { icon: '\u{1F3C6}', color: '#fbbf24' },
  patch_notes: { icon: '\u{1F527}', color: '#60a5fa' },
};

const FILTER_TABS: Array<{ key: NewsCategory | 'all'; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'match_result', label: '경기' },
  { key: 'transfer_rumor', label: '이적' },
  { key: 'player_complaint', label: '선수' },
  { key: 'team_analysis', label: '분석' },
  { key: 'interview', label: '인터뷰' },
  { key: 'social_media', label: 'SNS' },
];

function ImportanceBadge({ importance }: { importance: number }) {
  if (importance <= 1) return null;
  const badgeClass = importance >= 3 ? 'fm-badge--danger' : 'fm-badge--warning';
  const label = importance >= 3 ? '긴급' : '주요';
  return <span className={`fm-badge ${badgeClass}`}>{label}</span>;
}

function groupByDate(articles: NewsArticle[]): Map<string, NewsArticle[]> {
  const grouped = new Map<string, NewsArticle[]>();
  for (const article of articles) {
    const list = grouped.get(article.articleDate) ?? [];
    list.push(article);
    grouped.set(article.articleDate, list);
  }
  return grouped;
}

function buildPreview(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 120) return normalized;
  return `${normalized.slice(0, 120)}...`;
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
      const nextCategory = category === 'all' ? undefined : category;
      const fetched = await getRecentNews(season.id, PAGE_SIZE, offset, nextCategory);
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
    setUnreadCount(await getUnreadCount(season.id));
  }, [season]);

  useEffect(() => {
    void loadArticles(0, filter);
    void loadUnreadCount();
  }, [filter, loadArticles, loadUnreadCount]);

  const handleToggleArticle = async (article: NewsArticle) => {
    const isClosing = expandedId === article.id;
    setExpandedId(isClosing ? null : article.id);

    if (!isClosing && !article.isRead) {
      await markAsRead(article.id);
      setArticles((prev) => prev.map((item) => (item.id === article.id ? { ...item, isRead: true } : item)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleMarkAllRead = async () => {
    if (!season) return;
    await markAllAsRead(season.id);
    setArticles((prev) => prev.map((article) => ({ ...article, isRead: true })));
    setUnreadCount(0);
  };

  if (!season) {
    return <p className="fm-text-muted">시즌 데이터를 불러오는 중입니다...</p>;
  }

  const grouped = groupByDate(articles);
  const splitLabel = season.split === 'spring' ? '스프링' : '서머';

  return (
    <div>
      <div className="fm-page-header">
        <div>
          <h1 className="fm-page-title">뉴스 피드</h1>
          <p className="fm-page-subtitle fm-flex fm-items-center fm-gap-sm">
            {season.year}년 {splitLabel} 시즌 뉴스
            {unreadCount > 0 && <span className="fm-badge fm-badge--danger">{unreadCount}건 미확인</span>}
          </p>
        </div>
        {unreadCount > 0 && (
          <button className="fm-btn" onClick={handleMarkAllRead}>
            전체 읽음 처리
          </button>
        )}
      </div>

      <div className="fm-tabs newsfeed-tabs">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`fm-tab ${filter === tab.key ? 'fm-tab--active' : ''}`}
            onClick={() => {
              setFilter(tab.key);
              setExpandedId(null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {articles.length === 0 && !loading && (
        <div className="fm-card fm-text-center fm-p-lg">
          <p className="fm-text-lg fm-text-muted">표시할 뉴스가 아직 없습니다.</p>
        </div>
      )}

      <div className="fm-flex-col newsfeed-timeline">
        {[...grouped.entries()].map(([date, dayArticles]) => (
          <div key={date} className="fm-mb-lg newsfeed-day-group">
            <div className="fm-flex fm-items-center fm-gap-sm fm-mb-md newsfeed-day-header">
              <div className="newsfeed-day-dot" />
              <span className="fm-text-lg fm-font-bold fm-text-primary">{date}</span>
              <span className="fm-badge fm-badge--default">{dayArticles.length}건</span>
            </div>

            <div className="fm-flex-col fm-gap-sm newsfeed-article-list">
              {dayArticles.map((article) => {
                const config = CATEGORY_CONFIG[article.category];
                const isExpanded = expandedId === article.id;

                return (
                  <div
                    key={article.id}
                    className={`fm-card fm-card--clickable newsfeed-article ${!article.isRead ? 'fm-card--highlight newsfeed-article--unread' : ''}`}
                    onClick={() => void handleToggleArticle(article)}
                    role="button"
                    tabIndex={0}
                    aria-label={`뉴스: ${article.title}`}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void handleToggleArticle(article);
                      }
                    }}
                  >
                    <div className="fm-flex fm-gap-md newsfeed-article-shell">
                      <div
                        className="fm-flex fm-items-center fm-justify-center fm-flex-shrink-0 newsfeed-article-icon"
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: `${config.color}20`,
                          color: config.color,
                          fontSize: '18px',
                        }}
                      >
                        {config.icon}
                      </div>

                      <div className="fm-flex-1 newsfeed-article-body">
                        <div className="fm-flex fm-items-center fm-gap-sm fm-mb-xs" style={{ flexWrap: 'wrap' }}>
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
                            <span
                              title="읽지 않음"
                              style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }}
                            />
                          )}
                        </div>

                        <p className="fm-text-lg fm-font-semibold fm-text-primary newsfeed-article-title" style={{ margin: 0, lineHeight: 1.45 }}>
                          {article.title}
                        </p>

                        <p className="fm-text-sm fm-text-secondary newsfeed-article-copy" style={{ margin: '8px 0 0 0', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                          {isExpanded ? article.content : buildPreview(article.content)}
                        </p>

                        <div className="fm-flex fm-items-center fm-justify-between fm-mt-sm newsfeed-article-footer">
                          <span className="fm-text-xs fm-text-muted newsfeed-article-readmore">
                            {isExpanded ? '클릭하면 접기' : '클릭하면 전체 기사 보기'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {hasMore && articles.length > 0 && (
        <div className="fm-text-center fm-mt-md">
          <button className="fm-btn fm-btn--lg" onClick={() => void loadArticles(articles.length, filter)} disabled={loading}>
            {loading ? '불러오는 중...' : '더 보기'}
          </button>
        </div>
      )}

      {loading && articles.length === 0 && (
        <p className="fm-text-md fm-text-muted fm-text-center fm-p-lg">뉴스를 불러오는 중입니다...</p>
      )}
    </div>
  );
}
