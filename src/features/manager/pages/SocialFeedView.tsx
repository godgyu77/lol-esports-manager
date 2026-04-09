import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  getRecentReactions,
  getReactionWithComments,
  getReactionsBySource,
} from '../../../engine/social/socialEngine';
import type { SocialReaction, SocialComment, CommunitySource, CommentSentiment } from '../../../types/social';
import { COMMUNITY_LABELS } from '../../../types/social';
import { MainLoopPanel } from '../components/MainLoopPanel';

const SOURCES: Array<CommunitySource | 'all'> = ['all', 'inven', 'dcinside', 'fmkorea', 'reddit', 'twitter'];

const SOURCE_FILTER_LABELS: Record<CommunitySource | 'all', string> = {
  all: '전체',
  ...COMMUNITY_LABELS,
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  transfer_rumor: '이적 루머',
  transfer_official: '이적 확정',
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
  const season = useGameStore((state) => state.season);

  const [reactions, setReactions] = useState<SocialReaction[]>([]);
  const [expandedComments, setExpandedComments] = useState<Record<number, SocialComment[]>>({});
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [activeFilter, setActiveFilter] = useState<CommunitySource | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const loadReactions = useCallback(async () => {
    if (!season) return;
    setIsLoading(true);
    try {
      const data =
        activeFilter === 'all'
          ? await getRecentReactions(season.year, 50)
          : await getReactionsBySource(season.year, activeFilter, 50);
      setReactions(data);
    } catch (error) {
      console.error('커뮤니티 피드 로딩 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, season]);

  useEffect(() => {
    void loadReactions();
  }, [loadReactions]);

  const toggleComments = async (reactionId: number) => {
    const nextExpanded = new Set(expandedIds);
    if (nextExpanded.has(reactionId)) {
      nextExpanded.delete(reactionId);
      setExpandedIds(nextExpanded);
      return;
    }

    if (!expandedComments[reactionId]) {
      try {
        const data = await getReactionWithComments(reactionId);
        setExpandedComments((prev) => ({ ...prev, [reactionId]: data.comments }));
      } catch (error) {
        console.error('댓글 로딩 실패:', error);
        return;
      }
    }

    nextExpanded.add(reactionId);
    setExpandedIds(nextExpanded);
  };

  if (!season) {
    return <p className="fm-text-muted fm-text-md">데이터를 불러오는 중입니다...</p>;
  }

  const leadReaction = reactions[0] ?? null;
  const hotReaction = reactions.find((reaction) => reaction.commentCount > 0) ?? leadReaction;

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">커뮤니티</h1>
      </div>

      <MainLoopPanel
        eyebrow="여론 흐름"
        title="반응을 읽고 바로 대응 우선순위를 정하는 화면"
        subtitle="최근 반응과 뜨거운 주제를 먼저 읽고, 필요한 카드만 열어서 댓글 흐름을 확인하면 됩니다."
        insights={[
          {
            label: '현재 필터',
            value: SOURCE_FILTER_LABELS[activeFilter],
            detail: activeFilter === 'all' ? '전체 커뮤니티 흐름을 함께 보고 있습니다.' : '선택한 커뮤니티만 좁혀서 보고 있습니다.',
            tone: 'accent',
          },
          {
            label: '가장 최근 반응',
            value: leadReaction?.title ?? '새 반응 대기',
            detail: leadReaction ? COMMUNITY_LABELS[leadReaction.communitySource] : '아직 생성된 커뮤니티 반응이 없습니다.',
            tone: leadReaction ? 'accent' : 'neutral',
          },
          {
            label: '뜨거운 주제',
            value: hotReaction ? `${hotReaction.commentCount} 댓글` : '대기',
            detail: hotReaction?.content ?? '댓글이 모이면 여기서 바로 확인할 수 있습니다.',
            tone: hotReaction && hotReaction.commentCount > 3 ? 'warning' : 'neutral',
          },
        ]}
        actions={[
          { label: '새로고침', onClick: () => void loadReactions(), variant: 'primary' },
        ]}
        note="상단은 여론 방향 확인용, 아래는 개별 반응과 댓글 세부 확인용으로 분리했습니다."
      />

      <div className="fm-tabs">
        {SOURCES.map((source) => (
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
        <p className="fm-text-muted fm-text-md">피드를 불러오는 중입니다...</p>
      ) : reactions.length === 0 ? (
        <div className="fm-panel">
          <div className="fm-panel__body">
            <div className="fm-empty-state fm-empty-state--compact">
              <p className="fm-empty-state__title">아직 커뮤니티 반응이 없습니다.</p>
              <p className="fm-empty-state__copy">이적, 경기 결과, 스태프 변화가 쌓이면 여론 흐름이 여기 모입니다.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="fm-flex-col fm-gap-sm">
          {reactions.map((reaction) => (
            <div key={reaction.id} className="fm-panel">
              <div className="fm-panel__body">
                <div className="fm-flex fm-items-center fm-gap-sm fm-mb-md">
                  <span className="fm-badge fm-badge--info">{COMMUNITY_LABELS[reaction.communitySource]}</span>
                  <span className="fm-badge fm-badge--accent">{EVENT_TYPE_LABELS[reaction.eventType] ?? reaction.eventType}</span>
                  <span className="fm-text-sm fm-text-muted" style={{ marginLeft: 'auto' }}>
                    {reaction.eventDate}
                  </span>
                </div>

                <h3 className="fm-text-lg fm-font-bold fm-text-primary fm-mb-sm">{reaction.title}</h3>
                <p className="fm-text-md fm-text-secondary fm-mb-md" style={{ lineHeight: 1.5 }}>
                  {reaction.content}
                </p>

                <button className="fm-btn fm-btn--sm" onClick={() => void toggleComments(reaction.id)}>
                  {expandedIds.has(reaction.id) ? '댓글 닫기' : '댓글 보기'}
                </button>

                {expandedIds.has(reaction.id) && expandedComments[reaction.id] && (
                  <div className="fm-flex-col fm-gap-sm fm-mt-md" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    {expandedComments[reaction.id].map((comment) => (
                      <div key={comment.id} className="fm-card">
                        <div className="fm-flex fm-items-center fm-gap-sm fm-mb-sm">
                          <span className="fm-text-base fm-font-semibold fm-text-muted">{comment.username}</span>
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: SENTIMENT_COLORS[comment.sentiment],
                            }}
                          />
                          <span className="fm-text-sm fm-text-muted" style={{ marginLeft: 'auto' }}>
                            +{comment.likes}
                          </span>
                        </div>
                        <p className="fm-text-md" style={{ color: SENTIMENT_COLORS[comment.sentiment], margin: 0, lineHeight: 1.4 }}>
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
