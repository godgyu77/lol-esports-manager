/**
 * 보드 및 팬 반응 화면
 * - 시즌 목표
 * - 보드 만족도 / 팬 행복도
 * - 경고 상태
 * - 최근 반응 로그
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

const EVENT_TYPE_LABELS: Record<string, string> = {
  match_win: '경기 승리',
  match_loss: '경기 패배',
  warning: '경고',
  fired: '해고',
  playoff_qualify: '플레이오프 진출',
  international_qualify: '국제 대회 진출',
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

      // 아직 생성되지 않았다면 팀 명성 기준으로 자동 초기화합니다.
      if (!board) {
        const team = await getTeamWithRoster(userTeamId);
        const reputation = team?.reputation ?? 50;
        board = await initBoardExpectations(userTeamId, season.id, reputation);
      }

      const fanReactions = await getFanReactions(userTeamId, 20);

      setExpectations(board);
      setReactions(fanReactions);
    } catch (err) {
      console.error('보드 데이터 로딩 실패:', err);
      setError('보드 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [season, save, userTeamId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (isLoading) {
    return <div className="fm-text-muted fm-text-center fm-p-lg">로딩 중...</div>;
  }

  if (error) {
    return <div className="fm-text-danger fm-text-center fm-p-lg">{error}</div>;
  }

  if (!expectations) {
    return <div className="fm-text-muted fm-text-center fm-p-lg">보드 정보가 없습니다.</div>;
  }

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">보드 관리</h1>
      </div>

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">시즌 목표</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--3">
            <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
              <span className="fm-text-md fm-text-secondary">목표 순위</span>
              <span className="fm-text-xl fm-font-bold fm-text-primary">{expectations.targetStanding}위 이내</span>
            </div>
            <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
              <span className="fm-text-md fm-text-secondary">플레이오프 진출</span>
              <span className={`fm-text-xl fm-font-bold ${expectations.targetPlayoff ? 'fm-text-accent' : 'fm-text-muted'}`}>
                {expectations.targetPlayoff ? '필수' : '선택'}
              </span>
            </div>
            <div className="fm-card fm-flex-col fm-items-center fm-gap-sm">
              <span className="fm-text-md fm-text-secondary">국제 대회 진출</span>
              <span className={`fm-text-xl fm-font-bold ${expectations.targetInternational ? 'fm-text-accent' : 'fm-text-muted'}`}>
                {expectations.targetInternational ? '필수' : '선택'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">현황</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-flex-col fm-gap-md fm-mb-lg">
            <GaugeBar
              label="보드 만족도"
              value={expectations.satisfaction}
              color={getGaugeColor(expectations.satisfaction)}
            />
            <GaugeBar
              label="팬 행복도"
              value={expectations.fanHappiness}
              color={getGaugeColor(expectations.fanHappiness)}
            />
          </div>

          <div className="fm-flex fm-items-center fm-gap-md">
            <span className="fm-text-lg fm-text-secondary fm-flex-shrink-0" style={{ width: 120 }}>
              경고 횟수
            </span>
            <div className="fm-flex fm-gap-sm">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    border: '1px solid var(--border)',
                    background: i < expectations.warningCount ? 'var(--danger)' : 'var(--border)',
                  }}
                />
              ))}
            </div>
            {expectations.warningCount > 0 && (
              <span className="fm-text-md fm-font-semibold fm-text-danger">
                {expectations.warningCount >= 3 ? '해고 위기!' : `${expectations.warningCount}회 경고`}
              </span>
            )}
          </div>

          {expectations.isFired && (
            <div className="fm-alert fm-alert--danger fm-mt-md">
              <span className="fm-alert__text fm-font-bold fm-text-center" style={{ width: '100%' }}>
                보드 결정으로 해고되었습니다.
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">최근 팬 반응</span>
        </div>
        <div className="fm-panel__body--flush">
          {reactions.length === 0 ? (
            <p className="fm-text-lg fm-text-muted fm-p-md">아직 기록된 팬 반응이 없습니다.</p>
          ) : (
            <ul className="fm-list-none" style={{ maxHeight: 360, overflowY: 'auto' }}>
              {reactions.map((reaction) => (
                <li key={reaction.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="fm-flex fm-justify-between fm-mb-sm">
                    <span className="fm-text-md fm-font-semibold fm-text-accent">
                      {getEventLabel(reaction.eventType)}
                    </span>
                    <span className="fm-text-base fm-text-muted">{reaction.reactionDate}</span>
                  </div>
                  <div className="fm-flex fm-justify-between fm-items-center">
                    {reaction.message && (
                      <span className="fm-text-md fm-text-secondary">{reaction.message}</span>
                    )}
                    <span
                      className={`fm-text-lg fm-font-bold fm-flex-shrink-0 ${
                        reaction.happinessChange >= 0 ? 'fm-text-success' : 'fm-text-danger'
                      }`}
                    >
                      {reaction.happinessChange >= 0 ? '+' : ''}
                      {reaction.happinessChange}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function GaugeBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="fm-flex fm-items-center fm-gap-md">
      <span className="fm-text-lg fm-text-secondary fm-flex-shrink-0" style={{ width: 120 }}>
        {label}
      </span>
      <div className="fm-bar__track fm-flex-1" style={{ height: 12, border: '1px solid var(--border)' }}>
        <div className="fm-bar__fill" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="fm-text-xl fm-font-bold fm-text-right" style={{ color, width: 36 }}>
        {value}
      </span>
    </div>
  );
}

function getGaugeColor(value: number): string {
  if (value >= 70) return 'var(--success)';
  if (value >= 40) return 'var(--accent)';
  return 'var(--danger)';
}
