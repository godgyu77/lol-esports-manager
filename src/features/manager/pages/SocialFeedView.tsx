/**
 * 커뮤니티 소셜 피드 페이지
 * - 이적/스태프/경기 이벤트에 대한 커뮤니티 반응 피드
 * - 커뮤니티 소스 필터
 * - 댓글 펼침/접힘
 */

import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  getRecentReactions,
  getReactionWithComments,
  getReactionsBySource,
} from '../../../engine/social/socialEngine';
import type { SocialReaction, SocialComment, CommunitySource, CommentSentiment } from '../../../types/social';
import { COMMUNITY_LABELS } from '../../../types/social';

const SOURCES: (CommunitySource | 'all')[] = ['all', 'inven', 'dcinside', 'fmkorea', 'reddit', 'twitter'];

const SOURCE_FILTER_LABELS: Record<CommunitySource | 'all', string> = {
  all: '전체',
  ...COMMUNITY_LABELS,
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  transfer_rumor: '이적 루머',
  transfer_official: '이적 오피셜',
  staff_hire: '스태프 영입',
  staff_fire: '스태프 해고',
  match_result: '경기 결과',
  draft_pick: '드래프트',
};

const SENTIMENT_COLORS: Record<CommentSentiment, string> = {
  positive: '#2ecc71',
  neutral: '#8a8a9a',
  negative: '#e74c3c',
  hype: '#c89b3c',
  angry: '#e67e22',
};

export function SocialFeedView() {
  const season = useGameStore((s) => s.season);

  const [reactions, setReactions] = useState<SocialReaction[]>([]);
  const [expandedComments, setExpandedComments] = useState<Record<number, SocialComment[]>>({});
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [activeFilter, setActiveFilter] = useState<CommunitySource | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const loadReactions = useCallback(async () => {
    if (!season) return;
    setIsLoading(true);
    try {
      const data = activeFilter === 'all'
        ? await getRecentReactions(season.year, 50)
        : await getReactionsBySource(season.year, activeFilter, 50);
      setReactions(data);
    } catch (err) {
      console.error('소셜 피드 로딩 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, [season, activeFilter]);

  useEffect(() => { loadReactions(); }, [loadReactions]);

  const toggleComments = async (reactionId: number) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(reactionId)) {
      newExpanded.delete(reactionId);
      setExpandedIds(newExpanded);
      return;
    }

    // 댓글이 아직 로드되지 않았다면 로드
    if (!expandedComments[reactionId]) {
      try {
        const data = await getReactionWithComments(reactionId);
        setExpandedComments(prev => ({ ...prev, [reactionId]: data.comments }));
      } catch (err) {
        console.error('댓글 로딩 실패:', err);
        return;
      }
    }

    newExpanded.add(reactionId);
    setExpandedIds(newExpanded);
  };

  if (!season) return <p className="fm-text-muted fm-text-md">데이터를 불러오는 중...</p>;

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">커뮤니티</h1>
      </div>

      {/* 필터 바 */}
      <div className="fm-tabs">
        {SOURCES.map(source => (
          <button
            key={source}
            className={`fm-tab ${activeFilter === source ? 'fm-tab--active' : ''}`}
            onClick={() => setActiveFilter(source)}
          >
            {SOURCE_FILTER_LABELS[source]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="fm-text-muted fm-text-md">피드를 불러오는 중...</p>
      ) : reactions.length === 0 ? (
        <div className="fm-panel">
          <div className="fm-panel__body fm-text-center fm-p-lg">
            <p className="fm-text-muted fm-text-md fm-mb-sm">아직 커뮤니티 반응이 없습니다.</p>
            <p className="fm-text-muted fm-text-sm">이적, 스태프 변동, 경기 결과에 따라 반응이 생성됩니다.</p>
          </div>
        </div>
      ) : (
        <div className="fm-flex-col fm-gap-sm">
          {reactions.map(reaction => (
            <div key={reaction.id} className="fm-panel">
              <div className="fm-panel__body">
                {/* 카드 헤더 */}
                <div className="fm-flex fm-items-center fm-gap-sm fm-mb-md">
                  <span className="fm-badge fm-badge--info">
                    {COMMUNITY_LABELS[reaction.communitySource]}
                  </span>
                  <span className="fm-badge fm-badge--accent">
                    {EVENT_TYPE_LABELS[reaction.eventType] ?? reaction.eventType}
                  </span>
                  <span className="fm-text-sm fm-text-muted" style={{ marginLeft: 'auto' }}>
                    {reaction.eventDate}
                  </span>
                </div>

                {/* 뉴스 본문 */}
                <h3 className="fm-text-lg fm-font-bold fm-text-primary fm-mb-sm">
                  {reaction.title}
                </h3>
                <p className="fm-text-md fm-text-secondary fm-mb-md" style={{ lineHeight: '1.5' }}>
                  {reaction.content}
                </p>

                {/* 댓글 토글 */}
                <button
                  className="fm-btn fm-btn--sm"
                  onClick={() => toggleComments(reaction.id)}
                >
                  {expandedIds.has(reaction.id) ? '댓글 접기' : '댓글 보기'}
                </button>

                {/* 댓글 목록 */}
                {expandedIds.has(reaction.id) && expandedComments[reaction.id] && (
                  <div className="fm-flex-col fm-gap-sm fm-mt-md" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                    {expandedComments[reaction.id].map(comment => (
                      <div key={comment.id} className="fm-card">
                        <div className="fm-flex fm-items-center fm-gap-sm fm-mb-sm">
                          <span className="fm-text-base fm-font-semibold fm-text-muted">
                            {comment.username}
                          </span>
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: SENTIMENT_COLORS[comment.sentiment],
                            }}
                          />
                          <span className="fm-text-sm fm-text-muted" style={{ marginLeft: 'auto' }}>
                            +{comment.likes}
                          </span>
                        </div>
                        <p className="fm-text-md" style={{ color: SENTIMENT_COLORS[comment.sentiment], margin: 0, lineHeight: '1.4' }}>
                          {comment.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
