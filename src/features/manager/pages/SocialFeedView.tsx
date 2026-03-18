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

  if (!season) return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;

  return (
    <div>
      <h1 style={styles.title}>커뮤니티</h1>

      {/* 필터 바 */}
      <div style={styles.filterBar}>
        {SOURCES.map(source => (
          <button
            key={source}
            style={{
              ...styles.filterBtn,
              ...(activeFilter === source ? styles.filterBtnActive : {}),
            }}
            onClick={() => setActiveFilter(source)}
          >
            {SOURCE_FILTER_LABELS[source]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p style={{ color: '#6a6a7a' }}>피드를 불러오는 중...</p>
      ) : reactions.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={{ color: '#6a6a7a', fontSize: '14px' }}>아직 커뮤니티 반응이 없습니다.</p>
          <p style={{ color: '#4a4a6a', fontSize: '12px' }}>이적, 스태프 변동, 경기 결과에 따라 반응이 생성됩니다.</p>
        </div>
      ) : (
        <div style={styles.feedList}>
          {reactions.map(reaction => (
            <div key={reaction.id} style={styles.feedCard}>
              {/* 카드 헤더 */}
              <div style={styles.cardTop}>
                <span style={styles.sourceBadge}>
                  {COMMUNITY_LABELS[reaction.communitySource]}
                </span>
                <span style={styles.eventBadge}>
                  {EVENT_TYPE_LABELS[reaction.eventType] ?? reaction.eventType}
                </span>
                <span style={styles.dateText}>{reaction.eventDate}</span>
              </div>

              {/* 뉴스 본문 */}
              <h3 style={styles.newsTitle}>{reaction.title}</h3>
              <p style={styles.newsContent}>{reaction.content}</p>

              {/* 댓글 토글 */}
              <button
                style={styles.commentToggle}
                onClick={() => toggleComments(reaction.id)}
              >
                {expandedIds.has(reaction.id) ? '댓글 접기' : '댓글 보기'}
              </button>

              {/* 댓글 목록 */}
              {expandedIds.has(reaction.id) && expandedComments[reaction.id] && (
                <div style={styles.commentSection}>
                  {expandedComments[reaction.id].map(comment => (
                    <div key={comment.id} style={styles.commentRow}>
                      <div style={styles.commentHeader}>
                        <span style={styles.commentUser}>{comment.username}</span>
                        <span style={{
                          ...styles.sentimentDot,
                          background: SENTIMENT_COLORS[comment.sentiment],
                        }} />
                        <span style={styles.commentLikes}>
                          +{comment.likes}
                        </span>
                      </div>
                      <p style={{
                        ...styles.commentText,
                        color: SENTIMENT_COLORS[comment.sentiment],
                      }}>
                        {comment.comment}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { fontSize: '24px', fontWeight: 700, color: '#f0e6d2', marginBottom: '16px' },
  filterBar: {
    display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap',
  },
  filterBtn: {
    padding: '6px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid #2a2a4a',
    borderRadius: '20px', color: '#6a6a7a', fontSize: '12px', cursor: 'pointer',
    transition: 'all 0.2s',
  },
  filterBtnActive: {
    background: 'rgba(200,155,60,0.15)', borderColor: '#c89b3c', color: '#c89b3c',
  },
  emptyState: {
    textAlign: 'center', padding: '60px 20px',
    background: '#12122a', border: '1px solid #2a2a4a', borderRadius: '8px',
  },
  feedList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  feedCard: {
    background: '#12122a', border: '1px solid #2a2a4a', borderRadius: '8px',
    padding: '16px',
  },
  cardTop: {
    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px',
  },
  sourceBadge: {
    fontSize: '11px', fontWeight: 600, color: '#0d0d1a', background: '#4ecdc4',
    padding: '2px 8px', borderRadius: '4px',
  },
  eventBadge: {
    fontSize: '11px', fontWeight: 600, color: '#c89b3c',
    background: 'rgba(200,155,60,0.15)', padding: '2px 8px', borderRadius: '4px',
  },
  dateText: { fontSize: '11px', color: '#6a6a7a', marginLeft: 'auto' },
  newsTitle: {
    fontSize: '15px', fontWeight: 700, color: '#e0e0e0', margin: '0 0 6px 0',
  },
  newsContent: {
    fontSize: '13px', color: '#8a8a9a', lineHeight: '1.5', margin: '0 0 12px 0',
  },
  commentToggle: {
    background: 'none', border: '1px solid #2a2a4a', borderRadius: '4px',
    color: '#6a6a7a', fontSize: '12px', padding: '4px 12px', cursor: 'pointer',
  },
  commentSection: {
    marginTop: '12px', borderTop: '1px solid #2a2a4a', paddingTop: '12px',
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  commentRow: {
    padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px',
  },
  commentHeader: {
    display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px',
  },
  commentUser: { fontSize: '12px', fontWeight: 600, color: '#6a6a7a' },
  sentimentDot: {
    width: '6px', height: '6px', borderRadius: '50%', display: 'inline-block',
  },
  commentLikes: {
    fontSize: '11px', color: '#4a4a6a', marginLeft: 'auto',
  },
  commentText: {
    fontSize: '13px', margin: 0, lineHeight: '1.4',
  },
};
