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
  transfer_rumor: { icon: '\u{1F4E6}', color: '#2563eb' },
  player_complaint: { icon: '\u{1F464}', color: '#dc2626' },
  team_analysis: { icon: '\u{1F4CA}', color: '#0891b2' },
  interview: { icon: '\u{1F3A4}', color: '#059669' },
  social_media: { icon: '\u{1F4F1}', color: '#ea580c' },
  injury_report: { icon: '\u{1F915}', color: '#dc2626' },
  transfer_complete: { icon: '\u{1F91D}', color: '#7c3aed' },
  scandal: { icon: '\u26A0', color: '#b91c1c' },
  fan_reaction: { icon: '\u{1F4AC}', color: '#f59e0b' },
  award_news: { icon: '\u{1F3C6}', color: '#ca8a04' },
  patch_notes: { icon: '\u{1F527}', color: '#0f766e' },
  coach_briefing: { icon: '\u{1F9E0}', color: '#16a34a' },
};

const FILTER_TABS: Array<{ key: NewsCategory | 'all' | 'briefing'; label: string }> = [
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

const PRESENTATION_LABELS = {
  briefing: '브리핑',
  feature: '기사',
  alert: '속보',
} as const;

const NARRATIVE_BADGE_LABELS: Record<string, string> = {
  legacy: '전통',
  international: '국제전',
  rivalry: '라이벌',
  pressure: '압박',
};

function groupByDate(articles: NewsArticle[]): Map<string, NewsArticle[]> {
  const grouped = new Map<string, NewsArticle[]>();
  for (const article of articles) {
    const existing = grouped.get(article.articleDate) ?? [];
    existing.push(article);
    grouped.set(article.articleDate, existing);
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
  if (importance >= 3) return '헤드라인';
  if (importance === 2) return '주요 기사';
  return '일반 기사';
}

function inferNarrativeBadges(article: NewsArticle): string[] {
  const haystack = `${article.title} ${article.content}`.toLowerCase();
  const badges: string[] = [];
  const includesAny = (keywords: string[]) => keywords.some((keyword) => haystack.includes(keyword));

  if (includesAny(['dynasty', 'franchise arc', 'legacy', '왕조', '계보', '프랜차이즈', '과거'])) badges.push('legacy');
  if (includesAny(['international', 'cross-region', 'worlds', 'msi', '국제전', '국제', '지역 대결'])) badges.push('international');
  if (includesAny(['rival', 'rivalry', 'head-to-head', '라이벌', '맞대결', '숙적'])) badges.push('rivalry');
  if (includesAny(['rebuild', 'collapse', 'pressure', '압박', '붕괴', '긴장', '위기'])) badges.push('pressure');

  return badges.slice(0, 2);
}

function getNarrativeBadges(article: NewsArticle): string[] {
  return (article.narrativeTags.length > 0 ? article.narrativeTags : inferNarrativeBadges(article)).slice(0, 2);
}

function ImportanceBadge({ importance }: { importance: number }) {
  if (importance <= 1) return null;
  return (
    <span className={`fm-badge ${importance >= 3 ? 'fm-badge--danger' : 'fm-badge--warning'}`}>
      {importance >= 3 ? '긴급' : '주요'}
    </span>
  );
}

export function NewsFeedView() {
  const season = useGameStore((s) => s.season);

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<NewsCategory | 'all' | 'briefing'>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);

  const { getItemProps } = useToolbarNavigation({
    items: FILTER_TABS.map((tab) => tab.key),
    activeItem: filter,
    onSelect: setFilter,
  });

  const getPresentation = useCallback((article: NewsArticle) => {
    if (article.presentation === 'briefing') return 'briefing';
    if (['injury_report', 'player_complaint', 'scandal', 'transfer_complete'].includes(article.category)) return 'alert';
    return 'feature';
  }, []);

  const loadUnread = useCallback(async () => {
    if (!season) return;
    setUnreadCount(await getUnreadCount(season.id));
  }, [season]);

  const loadArticles = useCallback(
    async (offset: number, currentFilter: NewsCategory | 'all' | 'briefing') => {
      if (!season) return;
      setLoading(true);
      try {
        const fetched =
          currentFilter === 'briefing'
            ? await getUnreadBriefings(season.id, PAGE_SIZE)
            : await getRecentNews(season.id, PAGE_SIZE, offset, currentFilter === 'all' ? undefined : currentFilter);

        if (offset === 0 || currentFilter === 'briefing') {
          setArticles(fetched);
          setSelectedArticleId(fetched[0]?.id ?? null);
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
    void loadUnread();
  }, [filter, loadArticles, loadUnread]);

  const selectedArticle = useMemo(
    () => articles.find((article) => article.id === selectedArticleId) ?? null,
    [articles, selectedArticleId],
  );

  const leadArticle = useMemo(
    () =>
      articles.reduce<NewsArticle | null>(
        (best, article) => (best === null || article.importance > best.importance ? article : best),
        null,
      ),
    [articles],
  );

  const grouped = useMemo(() => groupByDate(articles), [articles]);

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

  const articleParagraphs = selectedArticle ? buildArticleParagraphs(selectedArticle.content) : [];

  const handleOpenArticle = useCallback(async (article: NewsArticle) => {
    setSelectedArticleId(article.id);
    if (article.isRead) return;
    await markAsRead(article.id);
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setArticles((prev) => prev.map((item) => (item.id === article.id ? { ...item, isRead: true } : item)));
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (!season) return;
    await markAllAsRead(season.id);
    setUnreadCount(0);
    setArticles((prev) => prev.map((article) => ({ ...article, isRead: true })));
  }, [season]);

  if (!season) {
    return <p className="fm-text-muted">시즌 데이터를 불러오는 중입니다...</p>;
  }

  return (
    <div className="newsfeed-layout">
      <div className="newsfeed-hero fm-card">
        <div>
          <span className="newsfeed-hero-kicker">E스포츠 뉴스룸</span>
          <h1 className="fm-page-title">뉴스피드</h1>
          <p className="fm-page-subtitle">
            {season.year} {getSplitLabel(season.split)} 시즌 기사와 코치 브리핑을 한 화면에서 확인합니다.
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
            <span>현재 필터</span>
            <strong>{FILTER_TABS.find((tab) => tab.key === filter)?.label}</strong>
          </div>
        </div>
      </div>

      <MainLoopPanel
        eyebrow="뉴스 운영"
        title="기사와 브리핑을 한 번에 읽고 바로 판단할 수 있게 정리했습니다."
        subtitle="뉴스는 읽는 정보 허브로 유지하고, 처리해야 할 메시지는 받은편지에서 관리하는 구조입니다."
        insights={[
          {
            label: '메인 기사',
            value: selectedArticle?.title ?? '선택된 기사 없음',
            detail: leadArticle ? `가장 주목도가 높은 기사: ${leadArticle.title}` : '아직 표시할 대표 기사가 없습니다.',
            tone: 'accent',
          },
          {
            label: '브리핑 상태',
            value: unreadCount > 0 ? `${unreadCount}건 남음` : '정리 완료',
            detail:
              unreadCount > 0 ? '코치 브리핑과 주요 기사부터 먼저 확인해 주세요.' : '읽지 않은 기사와 브리핑이 없습니다.',
            tone: unreadCount > 0 ? 'warning' : 'success',
          },
          {
            label: '읽기 방식',
            value: filter === 'briefing' ? '브리핑 집중' : '기사 중심',
            detail: '왼쪽 목록에서 고르고, 오른쪽에서 대표 기사와 본문을 읽는 포털형 레이아웃입니다.',
            tone: 'accent',
          },
        ]}
        actions={[
          { label: '전체 읽음 처리', onClick: () => void handleMarkAllRead(), disabled: unreadCount === 0 },
        ]}
        note="계약, 불만, 부상처럼 직접 처리해야 하는 메시지는 받은편지에서 우선 관리합니다."
      />

      <div className="fm-page-header">
        <div>
          <p className="fm-page-subtitle">기사와 브리핑을 날짜별로 모아 두고, 중요도 순으로 읽기 쉽게 정리했습니다.</p>
        </div>
        {unreadCount > 0 ? (
          <button className="fm-btn" onClick={() => void handleMarkAllRead()}>
            전체 읽음 처리
          </button>
        ) : null}
      </div>

      <div className="fm-tabs newsfeed-tabs" role="tablist" aria-label="뉴스 필터" aria-orientation="horizontal">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`fm-tab ${filter === tab.key ? 'fm-tab--active' : ''}`}
            onClick={() => setFilter(tab.key)}
            role="tab"
            aria-selected={filter === tab.key}
            aria-controls={`news-panel-${tab.key}`}
            id={`news-tab-${tab.key}`}
            {...getItemProps(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="newsfeed-shell">
        <section className="newsfeed-list-panel" role="tabpanel" id={`news-panel-${filter}`} aria-labelledby={`news-tab-${filter}`}>
          {articles.length === 0 && !loading ? (
            <div className="fm-card fm-text-center fm-p-lg">
              <p className="fm-text-lg fm-text-muted">
                {filter === 'briefing' ? '읽지 않은 브리핑이 없습니다.' : '표시할 뉴스가 없습니다.'}
              </p>
            </div>
          ) : null}

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
                    const presentation = getPresentation(article);
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
                              <span className="fm-badge" style={{ background: `${config.color}20`, color: config.color }}>
                                {NEWS_CATEGORY_LABELS[article.category]}
                              </span>
                              <span className="fm-badge fm-badge--default">{PRESENTATION_LABELS[presentation]}</span>
                              <ImportanceBadge importance={article.importance} />
                              {getNarrativeBadges(article).map((badge) => (
                                <span key={`${article.id}-${badge}`} className="fm-badge fm-badge--info">
                                  {NARRATIVE_BADGE_LABELS[badge] ?? badge}
                                </span>
                              ))}
                              {presentation === 'alert' ? <span className="fm-badge fm-badge--danger">속보</span> : null}
                              {!article.isRead ? <span className="newsfeed-unread-dot" title="읽지 않음" /> : null}
                            </div>

                            <p className="fm-text-lg fm-font-semibold fm-text-primary newsfeed-article-title">{article.title}</p>
                            <p className="fm-text-sm fm-text-secondary newsfeed-article-copy">{getArticleSummary(article)}</p>

                            <div className="fm-flex fm-items-center fm-justify-between fm-mt-sm newsfeed-article-footer">
                              <span className="fm-text-xs fm-text-muted newsfeed-article-readmore">
                                {article.presentation === 'briefing'
                                  ? '열면 브리핑 확인 상태가 반영됩니다.'
                                  : isSelected
                                    ? '본문을 읽는 중'
                                    : '클릭해서 기사 보기'}
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

          {hasMore && articles.length > 0 ? (
            <div className="fm-text-center fm-mt-md">
              <button className="fm-btn fm-btn--lg" onClick={() => void loadArticles(articles.length, filter)} disabled={loading}>
                {loading ? '불러오는 중...' : '더 보기'}
              </button>
            </div>
          ) : null}

          {loading && articles.length === 0 ? (
            <p className="fm-text-md fm-text-muted fm-text-center fm-p-lg">뉴스를 불러오는 중입니다...</p>
          ) : null}
        </section>

        <aside className="fm-card newsfeed-reader">
          {selectedArticle ? (
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
                      background: `${CATEGORY_CONFIG[selectedArticle.category].color}20`,
                      color: CATEGORY_CONFIG[selectedArticle.category].color,
                    }}
                  >
                    {PRESENTATION_LABELS[getPresentation(selectedArticle)]}
                  </span>
                  <ImportanceBadge importance={selectedArticle.importance} />
                  {getNarrativeBadges(selectedArticle).map((badge) => (
                    <span key={`reader-${selectedArticle.id}-${badge}`} className="fm-badge fm-badge--info">
                      {NARRATIVE_BADGE_LABELS[badge] ?? badge}
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
                    <span className="newsfeed-related-kicker">관련 기사</span>
                    <h3>같이 읽을 기사</h3>
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
                  <p className="newsfeed-related-empty">지금은 함께 읽을 만한 관련 기사가 없습니다.</p>
                )}
              </div>
            </>
          ) : (
            <div className="newsfeed-reader-empty">
              <span className="newsfeed-reader-empty-label">기사 보기</span>
              <h2>왼쪽 목록에서 기사나 브리핑을 선택해 주세요.</h2>
              <p>중요한 기사부터 먼저 보고, 오른쪽 본문에서 자세한 내용을 읽는 구조입니다.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
