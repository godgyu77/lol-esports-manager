import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import type { NewsArticle, NewsCategory } from '../../../types/news';
import { NEWS_CATEGORY_LABELS } from '../../../types/news';
import {
  getArticleSummary,
  getRecentNews,
  getUnreadBriefings,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from '../../../engine/news/newsEngine';
import { MainLoopPanel } from '../components/MainLoopPanel';
import { useToolbarNavigation } from '../hooks/useToolbarNavigation';
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
  coach_briefing: { icon: '\u{1F9E0}', color: '#34d399' },
};

const FILTER_TABS: Array<{ key: NewsCategory | 'all' | 'briefing' | 'alert'; label: string }> = [
  { key: 'all', label: '전체 기사' },
  { key: 'briefing', label: '미확인 브리핑' },
  { key: 'match_result', label: '경기' },
  { key: 'transfer_rumor', label: '이적' },
  { key: 'player_complaint', label: '선수' },
  { key: 'team_analysis', label: '분석' },
  { key: 'coach_briefing', label: '코치' },
  { key: 'interview', label: '인터뷰' },
  { key: 'social_media', label: 'SNS' },
];

function groupByDate(articles: NewsArticle[]): Map<string, NewsArticle[]> {
  const grouped = new Map<string, NewsArticle[]>();
  for (const article of articles) {
    const list = grouped.get(article.articleDate) ?? [];
    list.push(article);
    grouped.set(article.articleDate, list);
  }
  return grouped;
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

function inferNarrativeBadges(article: NewsArticle): string[] {
  const haystack = `${article.title} ${article.content}`.toLowerCase();
  const badges: string[] = [];
  const includesAny = (keywords: string[]) => keywords.some((keyword) => haystack.includes(keyword));

  if (includesAny(['dynasty', 'franchise arc', 'legacy', '왕조', '계보', '프랜차이즈', '레거시'])) {
    badges.push('legacy');
  }
  if (includesAny(['international', 'cross-region', 'broadcast desk', 'worlds', 'msi', '국제전', '국제', '지역 대항'])) {
    badges.push('international');
  }
  if (includesAny(['rival', 'rivalry', 'head-to-head', '라이벌', '맞대결', '숙적'])) {
    badges.push('rivalry');
  }
  if (includesAny(['rebuild', 'collapse', 'pressure', '압박', '붕괴', '재건', '위기'])) {
    badges.push('pressure');
  }

  return badges.slice(0, 2);
}

function getNarrativeBadges(article: NewsArticle): string[] {
  return (article.narrativeTags.length > 0
    ? article.narrativeTags
    : inferNarrativeBadges(article)).slice(0, 2);
}

function ImportanceBadge({ importance }: { importance: number }) {
  if (importance <= 1) return null;
  const badgeClass = importance >= 3 ? 'fm-badge--danger' : 'fm-badge--warning';
  const label = importance >= 3 ? '긴급' : '주요';
  return <span className={`fm-badge ${badgeClass}`}>{label}</span>;
}

export function NewsFeedView() {
  const season = useGameStore((s) => s.season);

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<NewsCategory | 'all' | 'briefing'>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const filterKeys = FILTER_TABS
    .map((tab) => tab.key)
    .filter((key): key is NewsCategory | 'all' | 'briefing' => key !== 'alert');
  const { getItemProps } = useToolbarNavigation({
    items: filterKeys,
    activeItem: filter,
    onSelect: setFilter,
  });

  const getPresentation = useCallback((article: NewsArticle) => {
    if (article.presentation === 'briefing') return 'briefing';
    if (['injury_report', 'player_complaint', 'scandal', 'transfer_complete'].includes(article.category)) return 'alert';
    return 'feature';
  }, []);

  const loadUnreadCount = useCallback(async () => {
    if (!season) return;
    setUnreadCount(await getUnreadCount(season.id));
  }, [season]);

  const loadArticles = useCallback(
    async (offset: number, currentFilter: NewsCategory | 'all' | 'briefing') => {
      if (!season) return;
      setLoading(true);
      try {
        const fetched = currentFilter === 'briefing'
          ? await getUnreadBriefings(season.id, PAGE_SIZE)
          : await getRecentNews(season.id, PAGE_SIZE, offset, currentFilter === 'all' ? undefined : currentFilter);

        if (offset === 0 || currentFilter === 'briefing') {
          setArticles(fetched);
          setSelectedArticleId((prev) => prev ?? fetched[0]?.id ?? null);
        } else {
          setArticles((prev) => [...prev, ...fetched]);
        }

        setHasMore(currentFilter !== 'briefing' && fetched.length >= PAGE_SIZE);
      } finally {
        setLoading(false);
      }
    },
    [season],
  );

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
      .filter((article) => article.id !== selectedArticle.id && getPresentation(article) === 'feature')
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
  }, [articles, getPresentation, selectedArticle]);

  const headlineArticles = useMemo(
    () => [...articles].sort((left, right) => right.importance - left.importance).slice(0, 3),
    [articles],
  );

  const handleOpenArticle = useCallback(async (article: NewsArticle) => {
    setSelectedArticleId(article.id);

    if (article.isRead) return;

    await markAsRead(article.id);
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setArticles((prev) => prev.map((item) => (item.id === article.id ? { ...item, isRead: true } : item)));
  }, []);

  const handleMarkAllRead = async () => {
    if (!season) return;
    await markAllAsRead(season.id);
    setUnreadCount(0);
    setArticles((prev) => prev.map((article) => ({ ...article, isRead: true })));
  };

  if (!season) {
    return <p className="fm-text-muted">시즌 데이터를 불러오는 중입니다...</p>;
  }

  const grouped = groupByDate(articles);
  const splitLabel = getSplitLabel(season.split);
  const articleParagraphs = selectedArticle ? buildArticleParagraphs(selectedArticle.content) : [];
  const selectedConfig = selectedArticle ? CATEGORY_CONFIG[selectedArticle.category] : null;
  const selectedNarrativeBadges = selectedArticle ? getNarrativeBadges(selectedArticle) : [];

  return (
    <div className="newsfeed-layout">
      <div className="newsfeed-hero fm-card">
        <div>
          <span className="newsfeed-hero-kicker">Esports Newsroom</span>
          <h1 className="fm-page-title">뉴스 피드</h1>
          <p className="fm-page-subtitle">
            {season.year}년 {splitLabel} 시즌의 기사와 코치 브리핑을 한곳에서 정리합니다.
          </p>
        </div>
        <div className="newsfeed-hero-stats">
          <div className="newsfeed-stat-card">
            <span>미확인 항목</span>
            <strong>{unreadCount}건</strong>
          </div>
          <div className="newsfeed-stat-card">
            <span>오늘의 헤드라인</span>
            <strong>{leadArticle ? getImportanceLabel(leadArticle.importance) : '대기 중'}</strong>
          </div>
          <div className="newsfeed-stat-card">
            <span>현재 섹션</span>
            <strong>{FILTER_TABS.find((tab) => tab.key === filter)?.label}</strong>
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
            <p>{getArticleSummary(article)}</p>
          </button>
        ))}
      </div>

      <MainLoopPanel
        eyebrow="Newsroom Rules"
        title="기사, 브리핑, 알림을 같은 목록 안에서 역할별로 구분합니다"
        subtitle="읽음 처리는 미확인 배지만 정리하고, 목록은 유지합니다. 코치 메모는 브리핑, 긴급 이슈는 알림, 시즌 맥락은 기사로 분리했습니다."
        insights={[
          {
            label: '오늘 해야 할 일',
            value: filter === 'briefing' ? '브리핑 확인' : '헤드라인 정리',
            detail: selectedArticle?.title ?? '선택된 항목이 없습니다.',
            tone: 'accent',
          },
          {
            label: '가장 큰 리스크',
            value: articles.find((article) => getPresentation(article) === 'alert') ? '중요 알림 도착' : '안정',
            detail: articles.find((article) => getPresentation(article) === 'alert')?.title ?? '당장 대응이 필요한 뉴스 알림은 없습니다.',
            tone: articles.find((article) => getPresentation(article) === 'alert') ? 'danger' : 'success',
          },
          {
            label: '다음 경기 준비',
            value: unreadCount > 0 ? `${unreadCount}건 미확인` : '정리 완료',
            detail: '코치 브리핑을 먼저 읽고, 경기 기사와 팀 이슈는 같은 타임라인 안에서 이어서 볼 수 있게 맞췄습니다.',
            tone: 'accent',
          },
          {
            label: '역할 분리',
            value: '기사 / 브리핑 / 알림',
            detail: '기사는 맥락을 쌓고, 브리핑은 오늘의 판단을 돕고, 알림은 즉시 대응해야 할 이슈를 먼저 드러냅니다.',
            tone: 'success',
          },
        ]}
        actions={[
          { label: '전체 읽음 처리', onClick: () => void handleMarkAllRead(), disabled: unreadCount === 0 },
        ]}
        note="같은 뉴스라도 성격이 다르면 기대 행동이 달라집니다. 이번 정리는 그 행동 차이가 바로 읽히게 만드는 데 초점을 맞췄습니다."
      />

      <div className="fm-page-header">
        <div>
          <p className="fm-page-subtitle fm-flex fm-items-center fm-gap-sm">
            읽음 처리 시 배지와 미확인 강조만 즉시 사라지고, 목록은 그대로 유지됩니다.
            {unreadCount > 0 && <span className="fm-badge fm-badge--danger">{unreadCount}건 미확인</span>}
          </p>
        </div>
        {unreadCount > 0 && (
          <button className="fm-btn" onClick={handleMarkAllRead}>
            전체 읽음 처리
          </button>
        )}
      </div>

      <div className="fm-tabs newsfeed-tabs" role="tablist" aria-label="뉴스 필터" aria-orientation="horizontal">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`fm-tab ${filter === tab.key ? 'fm-tab--active' : ''}`}
            onClick={() => setFilter(tab.key as NewsCategory | 'all' | 'briefing')}
            role="tab"
            aria-selected={filter === tab.key}
            aria-controls={`news-panel-${tab.key}`}
            id={`news-tab-${tab.key}`}
            {...getItemProps(tab.key as NewsCategory | 'all' | 'briefing')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="newsfeed-shell">
        <section className="newsfeed-list-panel" role="tabpanel" id={`news-panel-${filter}`} aria-labelledby={`news-tab-${filter}`}>
          {articles.length === 0 && !loading && (
            <div className="fm-card fm-text-center fm-p-lg">
              <p className="fm-text-lg fm-text-muted">
                {filter === 'briefing' ? '읽지 않은 브리핑이 없습니다.' : '표시할 뉴스가 아직 없습니다.'}
              </p>
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
                      <button
                        key={article.id}
                        className={`fm-card newsfeed-article ${!article.isRead ? 'fm-card--highlight newsfeed-article--unread' : ''} ${isSelected ? 'newsfeed-article--selected' : ''}`}
                        onClick={() => void handleOpenArticle(article)}
                        type="button"
                        aria-label={`뉴스 기사 열기: ${article.title}`}
                        aria-pressed={isSelected}
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
                              <span className="fm-badge fm-badge--default">
                                {article.presentation === 'briefing' ? '브리핑' : '기사'}
                              </span>
                              <ImportanceBadge importance={article.importance} />
                              {getNarrativeBadges(article).map((badge) => (
                                <span key={`list-${article.id}-${badge}`} className="fm-badge fm-badge--info">
                                  {badge}
                                </span>
                              ))}
                              {getPresentation(article) === 'alert' && <span className="fm-badge fm-badge--danger">긴급</span>}
                              {!article.isRead && <span className="newsfeed-unread-dot" title="읽지 않음" />}
                            </div>

                            <p className="fm-text-lg fm-font-semibold fm-text-primary newsfeed-article-title">
                              {article.title}
                            </p>

                            <p className="fm-text-sm fm-text-secondary newsfeed-article-copy">{getArticleSummary(article)}</p>

                            <div className="fm-flex fm-items-center fm-justify-between fm-mt-sm newsfeed-article-footer">
                              <span className="fm-text-xs fm-text-muted newsfeed-article-readmore">
                                {article.presentation === 'briefing'
                                  ? '읽으면 미확인 상태만 해제됩니다'
                                  : isSelected ? '기사 읽는 중' : '클릭해서 기사 보기'}
                              </span>
                              <span className="fm-text-xs fm-text-muted">{getImportanceLabel(article.importance)}</span>
                            </div>
                          </div>
                        </div>
                      </button>
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
                  <span className="newsfeed-reader-topline-label">{NEWS_CATEGORY_LABELS[selectedArticle.category]}</span>
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
                    {selectedArticle.presentation === 'briefing' ? '브리핑' : '아카이브 기사'}
                  </span>
                  <ImportanceBadge importance={selectedArticle.importance} />
                  {selectedNarrativeBadges.map((badge) => (
                    <span key={`reader-${selectedArticle.id}-${badge}`} className="fm-badge fm-badge--info">
                      {badge}
                    </span>
                  ))}
                </div>

                <h2 className="newsfeed-reader-title">{selectedArticle.title}</h2>
                <p className="newsfeed-reader-deck">{getArticleSummary(selectedArticle)}</p>
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
                    <h3>관련 기사</h3>
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
                        <p>{getArticleSummary(article)}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="newsfeed-related-empty">같이 읽을 만한 관련 기사가 아직 충분하지 않습니다.</p>
                )}
              </div>
            </>
          ) : (
            <div className="newsfeed-reader-empty">
              <span className="newsfeed-reader-empty-label">기사 보기</span>
              <h2>왼쪽 목록에서 기사나 브리핑을 선택하세요.</h2>
              <p>브리핑은 빠르게 확인하고, 기사형 뉴스는 자세한 본문을 읽을 수 있습니다.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
