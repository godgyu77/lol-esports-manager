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
  const [result, setResult] = useState<{
    dialogue: string;
    moraleChange: number;
    extra?: string;
  } | null>(null);
  const [applied, setApplied] = useState(false);

  const isCooldown = cooldownDays > 0;
  const title = mode === 'meeting' ? '선수 면담' : '기자회견';

  // ── 선수 면담 실행 ──
  const handleMeeting = async () => {
    if (!selectedPlayer) return;
    setLoading(true);
    try {
      const condition = await getPlayerCondition(selectedPlayer.id, currentDate);
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
    } catch {
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
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-label={title} onKeyDown={handleKeyDown}>
      <div className="animate-scaleIn" style={styles.modal}>
        <h3 style={styles.title}>{title}</h3>

        {/* 쿨다운 상태 */}
        {isCooldown && !result ? (
          <div style={styles.cooldownWrap}>
            <p style={styles.cooldownText}>
              다음 {title}까지 <span style={styles.cooldownDays}>{cooldownDays}일</span> 남았습니다.
            </p>
            <button style={styles.closeBtn} onClick={onClose} autoFocus>
              닫기
            </button>
          </div>
        ) : result ? (
          /* 결과 표시 */
          <div style={styles.resultWrap}>
            <div style={styles.dialogueBox}>
              <p style={styles.dialogueText}>"{result.dialogue}"</p>
            </div>
            <div style={styles.effectRow}>
              <span style={styles.effectLabel}>사기 변화</span>
              <span
                style={{
                  ...styles.effectValue,
                  color: result.moraleChange > 0 ? '#50c878' : result.moraleChange < 0 ? '#dc3c3c' : '#8a8a9a',
                }}
              >
                {result.moraleChange > 0 ? '+' : ''}{result.moraleChange}
              </span>
            </div>
            {result.extra && (
              <p style={styles.extraText}>{result.extra}</p>
            )}
            <button style={styles.confirmBtn} onClick={onClose}>
              확인
            </button>
          </div>
        ) : mode === 'meeting' ? (
          /* 면담: 선수 선택 + 주제 선택 */
          <div style={styles.formWrap}>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>면담 대상</label>
              <div style={styles.playerList}>
                {players.map((p) => (
                  <button
                    key={p.id}
                    style={{
                      ...styles.playerBtn,
                      borderColor: selectedPlayer?.id === p.id ? '#c89b3c' : '#3a3a5c',
                      background: selectedPlayer?.id === p.id ? 'rgba(200,155,60,0.1)' : 'rgba(255,255,255,0.03)',
                    }}
                    onClick={() => setSelectedPlayer(p)}
                  >
                    <span style={styles.playerPos}>{positionLabel[p.position] ?? p.position}</span>
                    <span style={styles.playerName}>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>면담 주제</label>
              <div style={styles.topicList}>
                {MEETING_TOPICS.map((topic) => (
                  <button
                    key={topic}
                    style={{
                      ...styles.topicBtn,
                      borderColor: selectedTopic === topic ? '#c89b3c' : '#3a3a5c',
                      background: selectedTopic === topic ? 'rgba(200,155,60,0.1)' : 'rgba(255,255,255,0.03)',
                    }}
                    onClick={() => setSelectedTopic(topic)}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
            <div style={styles.btnRow}>
              <button style={styles.cancelBtn} onClick={onClose}>
                취소
              </button>
              <button
                style={{
                  ...styles.confirmBtn,
                  opacity: !selectedPlayer || loading ? 0.5 : 1,
                  cursor: !selectedPlayer || loading ? 'not-allowed' : 'pointer',
                }}
                disabled={!selectedPlayer || loading}
                onClick={handleMeeting}
              >
                {loading ? '진행 중...' : '면담 시작'}
              </button>
            </div>
          </div>
        ) : (
          /* 기자회견 */
          <div style={styles.formWrap}>
            <div style={styles.pressInfo}>
              <p style={styles.pressLabel}>최근 경기 결과</p>
              <p style={styles.pressValue}>{recentResults || '기록 없음'}</p>
            </div>
            <p style={styles.pressDesc}>
              기자회견을 진행하면 팀 전체의 사기에 영향을 줍니다.
            </p>
            <div style={styles.btnRow}>
              <button style={styles.cancelBtn} onClick={onClose}>
                취소
              </button>
              <button
                style={{
                  ...styles.confirmBtn,
                  opacity: loading ? 0.5 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
                disabled={loading}
                onClick={handlePressConference}
              >
                {loading ? '진행 중...' : '기자회견 시작'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: '#1a1a3a',
    border: '1px solid #c89b3c',
    borderRadius: '12px',
    padding: '28px',
    maxWidth: '520px',
    width: '90%',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#c89b3c',
    marginBottom: '20px',
  },

  // 쿨다운
  cooldownWrap: {
    textAlign: 'center',
  },
  cooldownText: {
    fontSize: '14px',
    color: '#8a8a9a',
    marginBottom: '20px',
    lineHeight: 1.6,
  },
  cooldownDays: {
    fontWeight: 700,
    color: '#c89b3c',
  },

  // 폼
  formWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  fieldLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e0e0e0',
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  playerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#e0e0e0',
    textAlign: 'left',
    transition: 'all 0.15s',
  },
  playerPos: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#c89b3c',
    minWidth: '40px',
  },
  playerName: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#e0e0e0',
  },
  topicList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  topicBtn: {
    padding: '8px 14px',
    border: '1px solid #3a3a5c',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    color: '#e0e0e0',
    transition: 'all 0.15s',
  },

  // 기자회견
  pressInfo: {
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    borderLeft: '3px solid #c89b3c',
  },
  pressLabel: {
    fontSize: '12px',
    color: '#6a6a7a',
    marginBottom: '4px',
  },
  pressValue: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#e0e0e0',
  },
  pressDesc: {
    fontSize: '13px',
    color: '#8a8a9a',
    lineHeight: 1.5,
  },

  // 버튼
  btnRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '8px',
  },
  cancelBtn: {
    padding: '10px 20px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#8a8a9a',
    cursor: 'pointer',
  },
  confirmBtn: {
    padding: '10px 24px',
    background: '#c89b3c',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#0d0d1a',
    cursor: 'pointer',
  },
  closeBtn: {
    padding: '10px 24px',
    background: '#c89b3c',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#0d0d1a',
    cursor: 'pointer',
  },

  // 결과
  resultWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    alignItems: 'center',
  },
  dialogueBox: {
    width: '100%',
    padding: '16px 20px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    borderLeft: '3px solid #c89b3c',
  },
  dialogueText: {
    fontSize: '14px',
    color: '#e0e0e0',
    fontStyle: 'italic',
    lineHeight: 1.6,
  },
  effectRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  effectLabel: {
    fontSize: '13px',
    color: '#8a8a9a',
  },
  effectValue: {
    fontSize: '16px',
    fontWeight: 700,
  },
  extraText: {
    fontSize: '12px',
    color: '#6a6a7a',
  },
};
