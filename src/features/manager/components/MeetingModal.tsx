import { useState } from 'react';
import type React from 'react';
import type { Player } from '../../../types/player';
import { generateMeetingResponse, generatePressConferenceResponse } from '../../../ai/gameAiService';
import { upsertPlayerCondition, getPlayerCondition } from '../../../db/queries';

// ─────────────────────────────────────────
// 타입 & 상수
// ─────────────────────────────────────────

type ModalMode = 'meeting' | 'press';

interface MeetingModalProps {
  mode: ModalMode;
  teamName: string;
  players: Player[];
  currentDate: string;
  recentResults: string;
  onClose: () => void;
  /** 쿨다운 잔여 일수 (0이면 사용 가능) */
  cooldownDays: number;
}

const MEETING_TOPICS = [
  '최근 경기 피드백',
  '훈련 방향 논의',
  '팀 내 역할 조정',
  '컨디션 관리',
  '개인 고충 상담',
];

const positionLabel: Record<string, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: '원딜',
  support: '서포터',
};

// ─────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────

export function MeetingModal({
  mode,
  teamName,
  players,
  currentDate,
  recentResults,
  onClose,
  cooldownDays,
}: MeetingModalProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedTopic, setSelectedTopic] = useState(MEETING_TOPICS[0]);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);
  const [result, setResult] = useState<{
    dialogue: string;
    moraleChange: number;
    extra?: string;
  } | null>(null);

  const isCooldown = cooldownDays > 0;
  const title = mode === 'meeting' ? '선수 면담' : '기자회견';

  // ── 선수 면담 실행 ──
  const handleMeeting = async () => {
    if (!selectedPlayer) return;
    console.log('[MeetingModal] 면담 시작:', selectedPlayer.name, selectedTopic);
    setLoading(true);
    try {
      const condition = await getPlayerCondition(selectedPlayer.id, currentDate);
      console.log('[MeetingModal] 컨디션:', condition);
      const morale = condition?.morale ?? 50;

      const res = await generateMeetingResponse({
        teamName,
        playerName: selectedPlayer.name,
        playerPosition: positionLabel[selectedPlayer.position] ?? selectedPlayer.position,
        playerMorale: morale,
        topic: selectedTopic,
      });

      // 사기 변화 적용
      const newMorale = Math.max(0, Math.min(100, morale + res.moraleChange));
      await upsertPlayerCondition(
        selectedPlayer.id,
        currentDate,
        condition?.stamina ?? 70,
        newMorale,
        condition?.form ?? 50,
      );

      setResult({
        dialogue: res.dialogue,
        moraleChange: res.moraleChange,
        extra: res.reason,
      });
    } catch (err) {
      console.error('[MeetingModal] 면담 오류:', err);
      setResult({
        dialogue: '면담이 원활하게 진행되지 않았습니다.',
        moraleChange: 0,
      });
    } finally {
      setLoading(false);
      setApplied(true);
    }
  };

  // ── 기자회견 실행 ──
  const handlePressConference = async () => {
    setLoading(true);
    try {
      const res = await generatePressConferenceResponse({
        teamName,
        recentResults,
      });

      // 팀 전체 사기 변화 적용
      for (const player of players) {
        const condition = await getPlayerCondition(player.id, currentDate);
        const morale = condition?.morale ?? 50;
        const newMorale = Math.max(0, Math.min(100, morale + res.teamMoraleEffect));
        await upsertPlayerCondition(
          player.id,
          currentDate,
          condition?.stamina ?? 70,
          newMorale,
          condition?.form ?? 50,
        );
      }

      setResult({
        dialogue: res.dialogue,
        moraleChange: res.teamMoraleEffect,
        extra: `여론 변화: ${res.publicOpinionChange > 0 ? '+' : ''}${res.publicOpinionChange}`,
      });
    } catch {
      setResult({
        dialogue: '기자회견이 무난하게 마무리되었습니다.',
        moraleChange: 0,
      });
    } finally {
      setLoading(false);
      setApplied(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fm-overlay" role="dialog" aria-modal="true" aria-label={title} onKeyDown={handleKeyDown}>
      <div className="fm-modal">
        {/* Header */}
        <div className="fm-modal__header">
          <span className="fm-modal__title">{title}</span>
          <button className="fm-modal__close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        {/* 쿨다운 상태 */}
        {isCooldown && !result ? (
          <div className="fm-modal__body fm-text-center">
            <p className="fm-text-lg fm-text-secondary fm-mb-lg" style={{ lineHeight: 1.6 }}>
              다음 {title}까지 <span className="fm-font-bold fm-text-accent">{cooldownDays}일</span> 남았습니다.
            </p>
            <div className="fm-modal__footer" style={{ borderTop: 'none', justifyContent: 'center' }}>
              <button className="fm-btn fm-btn--primary" onClick={onClose} autoFocus>
                닫기
              </button>
            </div>
          </div>
        ) : result ? (
          /* 결과 표시 */
          <div className="fm-modal__body fm-flex-col fm-gap-md fm-items-center">
            {/* 대사 박스 */}
            <div
              className="fm-card"
              style={{
                width: '100%',
                borderLeft: '3px solid var(--accent)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <p className="fm-text-lg fm-text-primary" style={{ fontStyle: 'italic', lineHeight: 1.6 }}>
                "{result.dialogue}"
              </p>
            </div>

            {/* 사기 변화 */}
            <div className="fm-flex fm-items-center fm-gap-md">
              <span className="fm-text-sm fm-text-secondary">사기 변화</span>
              <span
                className={`fm-text-xl fm-font-bold ${
                  result.moraleChange > 0
                    ? 'fm-text-success'
                    : result.moraleChange < 0
                      ? 'fm-text-danger'
                      : 'fm-text-muted'
                }`}
              >
                {result.moraleChange > 0 ? '+' : ''}{result.moraleChange}
              </span>
            </div>

            {result.extra && (
              <p className="fm-text-xs fm-text-muted">{result.extra}</p>
            )}

            <div className="fm-modal__footer" style={{ width: '100%', borderTop: 'none', justifyContent: 'center', padding: '8px 0 0' }}>
              <button className="fm-btn fm-btn--primary" onClick={onClose}>
                확인
              </button>
            </div>
          </div>
        ) : mode === 'meeting' ? (
          /* 면담: 선수 선택 + 주제 선택 */
          <>
            <div className="fm-modal__body fm-flex-col fm-gap-lg">
              {/* 면담 대상 */}
              <div className="fm-flex-col fm-gap-sm">
                <label className="fm-text-sm fm-font-semibold fm-text-primary">면담 대상</label>
                <div className="fm-flex-col fm-gap-xs">
                  {players.map((p) => (
                    <button
                      key={p.id}
                      className={`fm-card fm-card--clickable fm-flex fm-items-center fm-gap-md ${
                        selectedPlayer?.id === p.id ? 'fm-card--highlight' : ''
                      }`}
                      style={{ padding: '10px 14px' }}
                      onClick={() => setSelectedPlayer(p)}
                    >
                      <span className="fm-text-sm fm-font-semibold fm-text-accent" style={{ minWidth: 40 }}>
                        {positionLabel[p.position] ?? p.position}
                      </span>
                      <span className="fm-text-lg fm-font-medium fm-text-primary">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 면담 주제 */}
              <div className="fm-flex-col fm-gap-sm">
                <label className="fm-text-sm fm-font-semibold fm-text-primary">면담 주제</label>
                <div className="fm-flex fm-flex-wrap fm-gap-xs">
                  {MEETING_TOPICS.map((topic) => (
                    <button
                      key={topic}
                      className={`fm-btn ${selectedTopic === topic ? 'fm-btn--primary' : ''}`}
                      onClick={() => setSelectedTopic(topic)}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="fm-modal__footer">
              <button className="fm-btn" onClick={onClose}>
                취소
              </button>
              <button
                className="fm-btn fm-btn--primary"
                disabled={!selectedPlayer || loading || applied}
                onClick={handleMeeting}
              >
                {loading ? '진행 중...' : '면담 시작'}
              </button>
            </div>
          </>
        ) : (
          /* 기자회견 */
          <>
            <div className="fm-modal__body fm-flex-col fm-gap-md">
              {/* 최근 경기 결과 */}
              <div
                className="fm-card"
                style={{
                  borderLeft: '3px solid var(--accent)',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <p className="fm-text-xs fm-text-muted fm-mb-sm">최근 경기 결과</p>
                <p className="fm-text-lg fm-font-semibold fm-text-primary">
                  {recentResults || '기록 없음'}
                </p>
              </div>

              <p className="fm-text-sm fm-text-secondary" style={{ lineHeight: 1.5 }}>
                기자회견을 진행하면 팀 전체의 사기에 영향을 줍니다.
              </p>
            </div>

            <div className="fm-modal__footer">
              <button className="fm-btn" onClick={onClose}>
                취소
              </button>
              <button
                className="fm-btn fm-btn--primary"
                disabled={loading || applied}
                onClick={handlePressConference}
              >
                {loading ? '진행 중...' : '기자회견 시작'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
