/**
 * 선수 모드 미디어 페이지
 * - 인터뷰/미디어 상호작용
 * - 소셜 미디어 반응
 * - 관련 뉴스
 */

import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getDatabase } from '../../../db/database';
import type { NewsCategory } from '../../../types/news';
import { NEWS_CATEGORY_LABELS } from '../../../types/news';

interface NewsArticleRow {
  id: number;
  articleDate: string;
  category: NewsCategory;
  title: string;
  content: string;
  importance: number;
  isRead: boolean;
}

interface SocialReactionRow {
  id: number;
  eventType: string;
  eventDate: string;
  title: string;
  content: string;
  communitySource: string;
}

interface SocialCommentRow {
  id: number;
  reactionId: number;
  username: string;
  comment: string;
  likes: number;
  sentiment: string;
}

interface InterviewResponse {
  id: string;
  type: 'humble' | 'confident' | 'funny' | 'controversial';
  label: string;
  description: string;
  reputationEffect: number;
  fanEffect: number;
}

const INTERVIEW_RESPONSES: InterviewResponse[] = [
  { id: 'humble', type: 'humble', label: '겸손하게', description: '팀원들 덕분입니다. 더 노력하겠습니다.', reputationEffect: 8, fanEffect: 5 },
  { id: 'confident', type: 'confident', label: '자신감 있게', description: '이번 시즌 우승은 저희가 가져갑니다.', reputationEffect: 12, fanEffect: 10 },
  { id: 'funny', type: 'funny', label: '유머러스하게', description: '재미있는 에피소드로 분위기를 띄웁니다.', reputationEffect: 6, fanEffect: 15 },
  { id: 'controversial', type: 'controversial', label: '도발적으로', description: '상대팀에 대한 자극적인 발언을 합니다.', reputationEffect: -5, fanEffect: 20 },
];

function getImportanceBadgeClass(importance: number): string {
  if (importance >= 3) return 'fm-badge--danger';
  if (importance >= 2) return 'fm-badge--warning';
  return 'fm-badge--default';
}

function getImportanceLabel(importance: number): string {
  if (importance >= 3) return '핵심';
  if (importance >= 2) return '중요';
  return '일반';
}

function getSentimentClass(sentiment: string): string {
  if (sentiment === 'positive') return 'fm-text-success';
  if (sentiment === 'negative') return 'fm-text-danger';
  return 'fm-text-muted';
}

export function PlayerMediaView() {
  const save = useGameStore((s) => s.save);

  const [newsArticles, setNewsArticles] = useState<NewsArticleRow[]>([]);
  const [socialReactions, setSocialReactions] = useState<SocialReactionRow[]>([]);
  const [socialComments, setSocialComments] = useState<Map<number, SocialCommentRow[]>>(new Map());
  const [playerPopularity, setPlayerPopularity] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeInterview, setActiveInterview] = useState<number | null>(null);
  const [interviewResults, setInterviewResults] = useState<Map<number, string>>(new Map());
  const [expandedReaction, setExpandedReaction] = useState<number | null>(null);

  useEffect(() => {
    async function loadMediaData() {
      try {
        setLoading(true);
        setError(null);
        const db = await getDatabase();

        const playerRows = await db.select<{ id: string; name: string; popularity: number }[]>(
          'SELECT id, name, popularity FROM players WHERE is_user_player = 1 LIMIT 1',
        );
        if (playerRows.length === 0) {
          setError('유저 선수를 찾을 수 없습니다.');
          return;
        }
        const player = playerRows[0];
        setPlayerPopularity(player.popularity);

        const newsRows = await db.select<{
          id: number;
          article_date: string;
          category: string;
          title: string;
          content: string;
          importance: number;
          is_read: number;
        }[]>(
          `SELECT id, article_date, category, title, content, importance, is_read
           FROM news_articles
           WHERE related_player_id = $1
           ORDER BY article_date DESC LIMIT 20`,
          [player.id],
        );

        setNewsArticles(
          newsRows.map((r) => ({
            id: r.id,
            articleDate: r.article_date,
            category: r.category as NewsCategory,
            title: r.title,
            content: r.content,
            importance: r.importance,
            isRead: r.is_read === 1,
          })),
        );

        const reactionRows = await db.select<{
          id: number;
          event_type: string;
          event_date: string;
          title: string;
          content: string;
          community_source: string;
        }[]>(
          `SELECT id, event_type, event_date, title, content, community_source
           FROM social_reactions
           WHERE related_player_id = $1
           ORDER BY event_date DESC LIMIT 10`,
          [player.id],
        );

        const reactions = reactionRows.map((r) => ({
          id: r.id,
          eventType: r.event_type,
          eventDate: r.event_date,
          title: r.title,
          content: r.content,
          communitySource: r.community_source,
        }));
        setSocialReactions(reactions);

        const commentsMap = new Map<number, SocialCommentRow[]>();
        for (const reaction of reactions) {
          const commentRows = await db.select<{
            id: number;
            reaction_id: number;
            username: string;
            comment: string;
            likes: number;
            sentiment: string;
          }[]>(
            `SELECT id, reaction_id, username, comment, likes, sentiment
             FROM social_comments
             WHERE reaction_id = $1
             ORDER BY likes DESC LIMIT 5`,
            [reaction.id],
          );
          commentsMap.set(
            reaction.id,
            commentRows.map((c) => ({
              id: c.id,
              reactionId: c.reaction_id,
              username: c.username,
              comment: c.comment,
              likes: c.likes,
              sentiment: c.sentiment,
            })),
          );
        }
        setSocialComments(commentsMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'DB 조회 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    loadMediaData();
  }, [save]);

  const interviewArticles = newsArticles.filter((n) => n.category === 'interview');
  const otherArticles = newsArticles.filter((n) => n.category !== 'interview');

  const handleStartInterview = useCallback((articleId: number) => {
    setActiveInterview(articleId);
  }, []);

  const handleInterviewResponse = useCallback((articleId: number, responseType: string) => {
    setInterviewResults((prev) => new Map(prev).set(articleId, responseType));
    setActiveInterview(null);
  }, []);

  const handleToggleReaction = useCallback((reactionId: number) => {
    setExpandedReaction((prev) => (prev === reactionId ? null : reactionId));
  }, []);

  if (loading) {
    return <div className="fm-text-secondary fm-text-md">미디어 정보를 불러오는 중...</div>;
  }

  if (error) {
    return (
      <div className="fm-alert fm-alert--danger">
        <span className="fm-alert__icon">!</span>
        <span className="fm-alert__text">{error}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">미디어 & 팬</h1>
      </div>

      {/* 요약 카드 */}
      <div className="fm-grid fm-grid--4 fm-mb-md">
        <div className="fm-card fm-text-center">
          <div className="fm-stat">
            <span className="fm-stat__label">인기도</span>
            <span className="fm-stat__value">{playerPopularity}</span>
          </div>
        </div>
        <div className="fm-card fm-text-center">
          <div className="fm-stat">
            <span className="fm-stat__label">관련 기사</span>
            <span className="fm-stat__value fm-text-info">{newsArticles.length}</span>
          </div>
        </div>
        <div className="fm-card fm-text-center">
          <div className="fm-stat">
            <span className="fm-stat__label">대기 인터뷰</span>
            <span className="fm-stat__value fm-text-warning">
              {interviewArticles.length - interviewResults.size}
            </span>
          </div>
        </div>
        <div className="fm-card fm-text-center">
          <div className="fm-stat">
            <span className="fm-stat__label">소셜 반응</span>
            <span className="fm-stat__value fm-text-success">{socialReactions.length}</span>
          </div>
        </div>
      </div>

      {/* 인터뷰 요청 */}
      {interviewArticles.length > 0 && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">인터뷰 요청</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex-col fm-gap-sm">
              {interviewArticles.map((article) => {
                const completed = interviewResults.has(article.id);
                const isActive = activeInterview === article.id;

                return (
                  <div key={article.id} className="fm-card">
                    <div className="fm-flex fm-items-center fm-justify-between">
                      <div className="fm-flex fm-items-center fm-gap-sm fm-flex-1">
                        <span className={`fm-badge ${getImportanceBadgeClass(article.importance)}`}>
                          {getImportanceLabel(article.importance)}
                        </span>
                        <div>
                          <p className="fm-text-md fm-font-medium fm-text-primary">{article.title}</p>
                          <p className="fm-text-xs fm-text-muted">{article.articleDate}</p>
                        </div>
                      </div>
                      <div>
                        {completed ? (
                          <span className="fm-badge fm-badge--default">완료</span>
                        ) : (
                          <button
                            className="fm-btn fm-btn--primary fm-btn--sm"
                            onClick={() => handleStartInterview(article.id)}
                            disabled={isActive}
                          >
                            응답
                          </button>
                        )}
                      </div>
                    </div>

                    {isActive && (
                      <div className="fm-mt-md">
                        <div className="fm-divider" />
                        <p className="fm-text-md fm-text-secondary fm-mb-sm">어떤 태도로 인터뷰에 임하시겠습니까?</p>
                        <div className="fm-grid fm-grid--2">
                          {INTERVIEW_RESPONSES.map((resp) => (
                            <div
                              key={resp.id}
                              className="fm-card fm-card--clickable"
                              onClick={() => handleInterviewResponse(article.id, resp.type)}
                            >
                              <p className="fm-text-md fm-font-medium fm-text-primary">{resp.label}</p>
                              <p className="fm-text-xs fm-text-muted fm-mt-sm">{resp.description}</p>
                              <div className="fm-flex fm-gap-md fm-mt-sm">
                                <span className={`fm-text-xs ${resp.reputationEffect >= 0 ? 'fm-text-success' : 'fm-text-danger'}`}>
                                  명성 {resp.reputationEffect >= 0 ? '+' : ''}{resp.reputationEffect}
                                </span>
                                <span className="fm-text-xs fm-text-info">팬 +{resp.fanEffect}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 관련 뉴스 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">관련 뉴스</span>
        </div>
        <div className="fm-panel__body">
          {otherArticles.length === 0 ? (
            <p className="fm-text-muted fm-text-md">관련 뉴스가 없습니다.</p>
          ) : (
            <div className="fm-flex-col fm-gap-sm">
              {otherArticles.map((article) => (
                <div key={article.id} className="fm-card">
                  <div className="fm-flex fm-items-center fm-gap-sm fm-mb-sm">
                    <span className="fm-badge fm-badge--default">
                      {NEWS_CATEGORY_LABELS[article.category] ?? article.category}
                    </span>
                    <span className="fm-text-xs fm-text-muted">{article.articleDate}</span>
                    {article.importance >= 3 && (
                      <span className="fm-badge fm-badge--danger">핵심</span>
                    )}
                  </div>
                  <p className="fm-text-md fm-font-medium fm-text-primary">{article.title}</p>
                  <p className="fm-text-xs fm-text-muted fm-mt-sm" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {article.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 소셜 미디어 반응 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">소셜 미디어 반응</span>
        </div>
        <div className="fm-panel__body">
          {socialReactions.length === 0 ? (
            <p className="fm-text-muted fm-text-md">소셜 미디어 반응이 없습니다.</p>
          ) : (
            <div className="fm-flex-col fm-gap-sm">
              {socialReactions.map((reaction) => {
                const comments = socialComments.get(reaction.id) ?? [];
                const isExpanded = expandedReaction === reaction.id;

                return (
                  <div key={reaction.id} className="fm-card">
                    <button
                      className="fm-flex fm-justify-between fm-items-center"
                      onClick={() => handleToggleReaction(reaction.id)}
                      aria-expanded={isExpanded}
                      style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                    >
                      <div>
                        <div className="fm-flex fm-items-center fm-gap-sm fm-mb-sm">
                          <span className="fm-badge fm-badge--info">{reaction.communitySource}</span>
                          <span className="fm-text-xs fm-text-muted">{reaction.eventDate}</span>
                        </div>
                        <p className="fm-text-md fm-font-medium fm-text-primary">{reaction.title}</p>
                        <p className="fm-text-xs fm-text-muted fm-mt-sm">{reaction.content}</p>
                      </div>
                      {comments.length > 0 && (
                        <span className="fm-text-xs fm-text-muted fm-flex-shrink-0">{comments.length}개 댓글</span>
                      )}
                    </button>

                    {isExpanded && comments.length > 0 && (
                      <div className="fm-mt-md">
                        <div className="fm-divider" />
                        <div className="fm-flex-col fm-gap-xs">
                          {comments.map((comment) => (
                            <div key={comment.id} className="fm-flex fm-items-center fm-gap-sm">
                              <span className="fm-text-xs fm-font-medium fm-text-info" style={{ minWidth: '60px' }}>{comment.username}</span>
                              <p className={`fm-text-xs fm-flex-1 ${getSentimentClass(comment.sentiment)}`}>{comment.comment}</p>
                              <span className="fm-text-xs fm-text-muted">{comment.likes > 0 ? `+${comment.likes}` : ''}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
