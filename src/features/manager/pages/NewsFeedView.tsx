import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import type { NewsArticle, NewsCategory } from '../../../types/news';
import { NEWS_CATEGORY_LABELS } from '../../../types/news';
import { getRecentNews, getUnreadCount, markAllAsRead, markAsRead } from '../../../engine/news/newsEngine';
import { invalidateNewsBadges } from '../../../engine/news/newsEvents';
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

const NEWS_DESKS = ['LCK Daily', 'Rift Post', 'Esports Desk', 'Nexus Report'];
const REPORTERS = ['김민준', '박서윤', '이현우', '정다은'];

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

function buildPreview(content: string, maxLength = 120): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function getSplitLabel(split: string) {
  return split === 'spring' ? '스프링' : '서머';
}

function buildArticleParagraphs(content: string) {
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function getImportanceLabel(importance: number) {
  if (importance >= 3) return '헤드라인급';
  if (importance === 2) return '주요 기사';
  return '일반 기사';
}

function buildDeskNote(article: NewsArticle) {
  if (article.category === 'match_result') return '오늘 경기 흐름을 가장 빠르게 정리한 메인 기사입니다.';
  if (article.category === 'transfer_rumor' || article.category === 'transfer_complete') {
    return '로스터 변화가 팀 운영과 시즌 판도에 미칠 영향을 함께 읽어보세요.';
  }
  if (article.category === 'team_analysis') return '단순 결과보다 팀의 방향성과 전술 맥락에 초점을 맞춘 기사입니다.';
  if (article.category === 'interview') return '현장 발언과 분위기를 통해 다음 경기의 힌트를 얻을 수 있습니다.';
  return '오늘 팀 운영에 영향을 줄 수 있는 핵심 흐름을 정리한 기사입니다.';
}

function getDeskName(article: NewsArticle) {
  return NEWS_DESKS[article.id % NEWS_DESKS.length];
}

function getReporterName(article: NewsArticle) {
  return REPORTERS[article.id % REPORTERS.length];
}

export function NewsFeedView() {
  const season = useGameStore((s) => s.season);

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<NewsCategory | 'all'>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);

  const loadArticles = useCallback(
    async (offset: number, category: NewsCategory | 'all') => {
      if (!season) return;
      setLoading(true);
      try {
        const nextCategory = category === 'all' ? undefined : category;
        const fetched = await getRecentNews(season.id, PAGE_SIZE, offset, nextCategory);
        if (offset === 0) {
          setArticles(fetched);
          setSelectedArticleId((prev) => prev ?? fetched[0]?.id ?? null);
        } else {
          setArticles((prev) => [...prev, ...fetched]);
        }
        setHasMore(fetched.length >= PAGE_SIZE);
      } finally {
        setLoading(false);
      }
    },
    [season],
  );

  const loadUnreadCount = useCallback(async () => {
    if (!season) return;
    setUnreadCount(await getUnreadCount(season.id));
  }, [season]);

  useEffect(() => {
    setSelectedArticleId(null);
    void loadArticles(0, filter);
    void loadUnreadCount();
  }, [filter, loadArticles, loadUnreadCount]);

  const selectedArticle = useMemo(
    () => articles.find((article) => article.id === selectedArticleId) ?? null,
    [articles, selectedArticleId],
  );

  const leadArticle = useMemo(
    () => articles.reduce<NewsArticle | null>((best, article) => (best === null || article.importance > best.importance ? article : best), null),
    [articles],
  );

  const relatedArticles = useMemo(() => {
    if (!selectedArticle) return [];
    return articles
      .filter((article) => article.id !== selectedArticle.id)
      .sort((left, right) => {
        const leftScore =
          Number(left.category === selectedArticle.category) * 4 +
          Number(left.articleDate === selectedArticle.articleDate) * 2 +
          left.importance;
        const rightScore =
          Number(right.category === selectedArticle.category) * 4 +
          Number(right.articleDate === selectedArticle.articleDate) * 2 +
          right.importance;
        return rightScore - leftScore;
      })
      .slice(0, 4);
  }, [articles, selectedArticle]);

  const headlineArticles = useMemo(
    () => [...articles].sort((left, right) => right.importance - left.importance).slice(0, 3),
    [articles],
  );

  const handleOpenArticle = useCallback(async (article: NewsArticle) => {
    setSelectedArticleId(article.id);

    if (!article.isRead) {
      await markAsRead(article.id);
      setArticles((prev) => prev.map((item) => (item.id === article.id ? { ...item, isRead: true } : item)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      invalidateNewsBadges();
    }
  }, []);

  const handleMarkAllRead = async () => {
    if (!season) return;
    await markAllAsRead(season.id);
    setArticles((prev) => prev.map((article) => ({ ...article, isRead: true })));
    setUnreadCount(0);
    invalidateNewsBadges();
  };

  if (!season) {
    return <p className="fm-text-muted">시즌 데이터를 불러오는 중입니다...</p>;
  }

  const grouped = groupByDate(articles);
  const splitLabel = getSplitLabel(season.split);
  const articleParagraphs = selectedArticle ? buildArticleParagraphs(selectedArticle.content) : [];
  const selectedConfig = selectedArticle ? CATEGORY_CONFIG[selectedArticle.category] : null;

  return (
    <div className="newsfeed-layout">
      <div className="newsfeed-hero fm-card">
        <div>
          <span className="newsfeed-hero-kicker">Esports Newsroom</span>
          <h1 className="fm-page-title">뉴스 센터</h1>
          <p className="fm-page-subtitle">
            {season.year}년 {splitLabel} 시즌의 흐름을 기사처럼 읽고, 중요한 이슈는 한눈에 따라갈 수 있도록 정리했습니다.
          </p>
        </div>
        <div className="newsfeed-hero-stats">
          <div className="newsfeed-stat-card">
            <span>미확인 기사</span>
            <strong>{unreadCount}건</strong>
          </div>
          <div className="newsfeed-stat-card">
            <span>오늘 헤드라인</span>
            <strong>{leadArticle ? getImportanceLabel(leadArticle.importance) : '대기 중'}</strong>
          </div>
          <div className="newsfeed-stat-card">
            <span>현재 섹션</span>
            <strong>{filter === 'all' ? '전체' : FILTER_TABS.find((tab) => tab.key === filter)?.label}</strong>
          </div>
        </div>
      </div>

      <div className="newsfeed-headlines">
        {headlineArticles.map((article, index) => (
          <button
            key={article.id}
            type="button"
            className={`fm-card newsfeed-headline-card ${selectedArticleId === article.id ? 'newsfeed-headline-card--active' : ''}`}
            onClick={() => void handleOpenArticle(article)}
          >
            <span className="newsfeed-headline-rank">Top {index + 1}</span>
            <strong>{article.title}</strong>
            <p>{buildPreview(article.content, 90)}</p>
          </button>
        ))}
      </div>

      <div className="fm-page-header">
        <div>
          <p className="fm-page-subtitle fm-flex fm-items-center fm-gap-sm">
            오늘의 기사 흐름
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
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="newsfeed-shell">
        <section className="newsfeed-list-panel">
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
                    const isSelected = selectedArticleId === article.id;

                    return (
                      <div
                        key={article.id}
                        className={`fm-card fm-card--clickable newsfeed-article ${!article.isRead ? 'fm-card--highlight newsfeed-article--unread' : ''} ${isSelected ? 'newsfeed-article--selected' : ''}`}
                        onClick={() => void handleOpenArticle(article)}
                        role="button"
                        tabIndex={0}
                        aria-label={`뉴스 기사 열기: ${article.title}`}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            void handleOpenArticle(article);
                          }
                        }}
                      >
                        <div className="fm-flex fm-gap-md newsfeed-article-shell">
                          <div
                            className="fm-flex fm-items-center fm-justify-center fm-flex-shrink-0 newsfeed-article-icon"
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '12px',
                              background: `${config.color}20`,
                              color: config.color,
                              fontSize: '18px',
                            }}
                          >
                            {config.icon}
                          </div>

                          <div className="fm-flex-1 newsfeed-article-body">
                            <div className="fm-flex fm-items-center fm-gap-sm fm-mb-xs newsfeed-article-meta">
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
                              {!article.isRead && <span className="newsfeed-unread-dot" title="읽지 않음" />}
                            </div>

                            <p className="fm-text-lg fm-font-semibold fm-text-primary newsfeed-article-title">
                              {article.title}
                            </p>

                            <p className="fm-text-sm fm-text-secondary newsfeed-article-copy">{buildPreview(article.content)}</p>

                            <div className="fm-flex fm-items-center fm-justify-between fm-mt-sm newsfeed-article-footer">
                              <span className="fm-text-xs fm-text-muted newsfeed-article-readmore">
                                {isSelected ? '기사 읽는 중' : '클릭하면 기사 보기'}
                              </span>
                              <span className="fm-text-xs fm-text-muted">{getImportanceLabel(article.importance)}</span>
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
        </section>

        <aside className="fm-card newsfeed-reader">
          {selectedArticle && selectedConfig ? (
            <>
              <div className="newsfeed-reader-hero">
                <div className="newsfeed-reader-topline">
                  <span className="newsfeed-reader-topline-label">오늘의 기사</span>
                  <span className="newsfeed-reader-topline-divider" />
                  <span>{selectedArticle.articleDate}</span>
                </div>

                <div className="fm-flex fm-items-center fm-gap-sm newsfeed-reader-kicker">
                  <span
                    className="fm-badge"
                    style={{
                      background: `${selectedConfig.color}20`,
                      color: selectedConfig.color,
                    }}
                  >
                    {NEWS_CATEGORY_LABELS[selectedArticle.category]}
                  </span>
                  <ImportanceBadge importance={selectedArticle.importance} />
                </div>

                <h2 className="newsfeed-reader-title">{selectedArticle.title}</h2>
                <p className="newsfeed-reader-deck">{buildPreview(selectedArticle.content, 170)}</p>

                <div className="newsfeed-reader-byline">
                  <span>{getDeskName(selectedArticle)}</span>
                  <span className="newsfeed-reader-byline-divider" />
                  <span>{getReporterName(selectedArticle)} 기자</span>
                </div>

                <div className="newsfeed-reader-desk-note">
                  <span className="newsfeed-reader-desk-label">데스크 메모</span>
                  <p>{buildDeskNote(selectedArticle)}</p>
                </div>
              </div>

              <div className="newsfeed-reader-meta">
                <div>
                  <span className="newsfeed-reader-meta-label">섹션</span>
                  <strong>{NEWS_CATEGORY_LABELS[selectedArticle.category]}</strong>
                </div>
                <div>
                  <span className="newsfeed-reader-meta-label">상태</span>
                  <strong>{selectedArticle.isRead ? '읽음' : '새 기사'}</strong>
                </div>
                <div>
                  <span className="newsfeed-reader-meta-label">비중</span>
                  <strong>{getImportanceLabel(selectedArticle.importance)}</strong>
                </div>
              </div>

              <div className="newsfeed-reader-body">
                {articleParagraphs.map((paragraph, index) => (
                  <p key={`${selectedArticle.id}-${index}`}>{paragraph}</p>
                ))}
              </div>

              <div className="newsfeed-related">
                <div className="newsfeed-related-header">
                  <div>
                    <span className="newsfeed-related-kicker">Related Stories</span>
                    <h3>함께 읽을 기사</h3>
                  </div>
                </div>

                {relatedArticles.length > 0 ? (
                  <div className="newsfeed-related-list">
                    {relatedArticles.map((article) => (
                      <button
                        key={article.id}
                        type="button"
                        className="newsfeed-related-item"
                        onClick={() => void handleOpenArticle(article)}
                      >
                        <span className="newsfeed-related-category">{NEWS_CATEGORY_LABELS[article.category]}</span>
                        <strong>{article.title}</strong>
                        <p>{buildPreview(article.content, 88)}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="newsfeed-related-empty">연결할 기사가 아직 충분하지 않습니다.</p>
                )}
              </div>
            </>
          ) : (
            <div className="newsfeed-reader-empty">
              <span className="newsfeed-reader-empty-label">기사 보기</span>
              <h2>왼쪽 목록에서 기사를 선택하세요</h2>
              <p>피드는 훑어보고, 자세한 내용은 이 영역에서 실제 기사처럼 읽을 수 있습니다.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
