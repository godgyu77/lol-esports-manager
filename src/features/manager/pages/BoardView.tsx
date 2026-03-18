/**
 * 구단 관리 페이지
 * - 구단주 목표 (순위/플레이오프/국제대회)
 * - 만족도 & 팬 행복도 게이지
 * - 경고 횟수
 * - 최근 팬 반응 목록
 */

import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  getBoardExpectations,
  getFanReactions,
  initBoardExpectations,
} from '../../../engine/board/boardEngine';
import { getTeamWithRoster } from '../../../db/queries';
import type { BoardExpectation, FanReaction } from '../../../types/board';

/** 이벤트 타입 → 한국어 라벨 */
const EVENT_TYPE_LABELS: Record<string, string> = {
  match_win: '경기 승리',
  match_loss: '경기 패배',
  warning: '경고',
  fired: '해고',
  playoff_qualify: '플레이오프 진출',
  international_qualify: '국제대회 진출',
  season_start: '시즌 시작',
};

function getEventLabel(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] ?? eventType;
}

export function BoardView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);

  const [expectations, setExpectations] = useState<BoardExpectation | null>(null);
  const [reactions, setReactions] = useState<FanReaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userTeamId = save?.userTeamId ?? '';

  const loadData = useCallback(async () => {
    if (!season || !save) return;
    setIsLoading(true);
    setError(null);

    try {
      let board = await getBoardExpectations(userTeamId, season.id);

      // 아직 초기화되지 않았으면 자동 초기화
      if (!board) {
        const team = await getTeamWithRoster(userTeamId);
        const reputation = team?.reputation ?? 50;
        board = await initBoardExpectations(userTeamId, season.id, reputation);
      }

      const fanReactions = await getFanReactions(userTeamId, 20);

      setExpectations(board);
      setReactions(fanReactions);
    } catch (err) {
      console.error('구단 데이터 로딩 실패:', err);
      setError('구단 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [season, save, userTeamId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return <div style={styles.loading}>로딩 중...</div>;
  }

  if (error) {
    return <div style={styles.error}>{error}</div>;
  }

  if (!expectations) {
    return <div style={styles.loading}>구단 정보가 없습니다.</div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>구단 관리</h1>

      {/* 구단주 목표 */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>구단주 목표</h2>
        <div style={styles.goalsGrid}>
          <div style={styles.goalCard}>
            <span style={styles.goalLabel}>목표 순위</span>
            <span style={styles.goalValue}>{expectations.targetStanding}위 이내</span>
          </div>
          <div style={styles.goalCard}>
            <span style={styles.goalLabel}>플레이오프 진출</span>
            <span style={{
              ...styles.goalValue,
              color: expectations.targetPlayoff ? '#c89b3c' : '#6a6a7a',
            }}>
              {expectations.targetPlayoff ? '필수' : '선택'}
            </span>
          </div>
          <div style={styles.goalCard}>
            <span style={styles.goalLabel}>국제대회 진출</span>
            <span style={{
              ...styles.goalValue,
              color: expectations.targetInternational ? '#c89b3c' : '#6a6a7a',
            }}>
              {expectations.targetInternational ? '필수' : '선택'}
            </span>
          </div>
        </div>
      </section>

      {/* 만족도 & 팬 행복도 */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>현황</h2>
        <div style={styles.gaugeContainer}>
          <GaugeBar
            label="구단주 만족도"
            value={expectations.satisfaction}
            color={getGaugeColor(expectations.satisfaction)}
          />
          <GaugeBar
            label="팬 행복도"
            value={expectations.fanHappiness}
            color={getGaugeColor(expectations.fanHappiness)}
          />
        </div>

        {/* 경고 */}
        <div style={styles.warningSection}>
          <span style={styles.warningLabel}>경고 횟수</span>
          <div style={styles.warningDots}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  ...styles.warningDot,
                  background: i < expectations.warningCount ? '#e74c3c' : '#2a2a4a',
                }}
              />
            ))}
          </div>
          {expectations.warningCount > 0 && (
            <span style={styles.warningText}>
              {expectations.warningCount >= 3
                ? '해고 위기!'
                : `${expectations.warningCount}회 경고`}
            </span>
          )}
        </div>

        {expectations.isFired && (
          <div style={styles.firedBanner}>
            구단주에 의해 해고되었습니다.
          </div>
        )}
      </section>

      {/* 최근 팬 반응 */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>최근 팬 반응</h2>
        {reactions.length === 0 ? (
          <p style={styles.emptyText}>아직 기록된 팬 반응이 없습니다.</p>
        ) : (
          <ul style={styles.reactionList}>
            {reactions.map((reaction) => (
              <li key={reaction.id} style={styles.reactionItem}>
                <div style={styles.reactionHeader}>
                  <span style={styles.reactionType}>
                    {getEventLabel(reaction.eventType)}
                  </span>
                  <span style={styles.reactionDate}>{reaction.reactionDate}</span>
                </div>
                <div style={styles.reactionBody}>
                  {reaction.message && (
                    <span style={styles.reactionMessage}>{reaction.message}</span>
                  )}
                  <span style={{
                    ...styles.reactionDelta,
                    color: reaction.happinessChange >= 0 ? '#2ecc71' : '#e74c3c',
                  }}>
                    {reaction.happinessChange >= 0 ? '+' : ''}{reaction.happinessChange}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────
// 게이지 바 컴포넌트
// ─────────────────────────────────────────

function GaugeBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={styles.gaugeRow}>
      <span style={styles.gaugeLabel}>{label}</span>
      <div style={styles.gaugeTrack}>
        <div
          style={{
            ...styles.gaugeFill,
            width: `${value}%`,
            background: color,
          }}
        />
      </div>
      <span style={{ ...styles.gaugeValue, color }}>{value}</span>
    </div>
  );
}

function getGaugeColor(value: number): string {
  if (value >= 70) return '#2ecc71';
  if (value >= 40) return '#c89b3c';
  return '#e74c3c';
}

// ─────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '900px',
  },
  loading: {
    color: '#8a8a9a',
    padding: '40px',
    textAlign: 'center',
  },
  error: {
    color: '#e74c3c',
    padding: '40px',
    textAlign: 'center',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#c89b3c',
    marginBottom: '28px',
  },
  section: {
    background: '#12122a',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#e0e0e0',
    marginBottom: '16px',
  },

  // 목표
  goalsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  goalCard: {
    background: '#0d0d1a',
    border: '1px solid #2a2a4a',
    borderRadius: '6px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  goalLabel: {
    fontSize: '13px',
    color: '#8a8a9a',
  },
  goalValue: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#e0e0e0',
  },

  // 게이지
  gaugeContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '20px',
  },
  gaugeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  gaugeLabel: {
    fontSize: '14px',
    color: '#8a8a9a',
    width: '120px',
    flexShrink: 0,
  },
  gaugeTrack: {
    flex: 1,
    height: '12px',
    background: '#0d0d1a',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid #2a2a4a',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: '6px',
    transition: 'width 0.3s ease',
  },
  gaugeValue: {
    fontSize: '16px',
    fontWeight: 700,
    width: '36px',
    textAlign: 'right',
  },

  // 경고
  warningSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  warningLabel: {
    fontSize: '14px',
    color: '#8a8a9a',
    width: '120px',
    flexShrink: 0,
  },
  warningDots: {
    display: 'flex',
    gap: '8px',
  },
  warningDot: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '1px solid #3a3a5a',
  },
  warningText: {
    fontSize: '13px',
    color: '#e74c3c',
    fontWeight: 600,
  },
  firedBanner: {
    marginTop: '16px',
    padding: '12px',
    background: 'rgba(231, 76, 60, 0.15)',
    border: '1px solid #e74c3c',
    borderRadius: '6px',
    color: '#e74c3c',
    fontWeight: 700,
    textAlign: 'center',
    fontSize: '15px',
  },

  // 팬 반응
  emptyText: {
    color: '#6a6a7a',
    fontSize: '14px',
  },
  reactionList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    maxHeight: '360px',
    overflowY: 'auto',
  },
  reactionItem: {
    padding: '10px 12px',
    borderBottom: '1px solid #1a1a3a',
  },
  reactionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px',
  },
  reactionType: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#c89b3c',
  },
  reactionDate: {
    fontSize: '12px',
    color: '#6a6a7a',
  },
  reactionBody: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reactionMessage: {
    fontSize: '13px',
    color: '#8a8a9a',
  },
  reactionDelta: {
    fontSize: '14px',
    fontWeight: 700,
    flexShrink: 0,
  },
};
