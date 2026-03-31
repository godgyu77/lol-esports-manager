import { useState } from 'react';
import type React from 'react';
import type { Player } from '../../../types/player';
import { generateMeetingResponse, generatePressConferenceResponse } from '../../../ai/gameAiService';
import { getPlayerCondition, upsertPlayerCondition } from '../../../db/queries';
import { recordPlayerMeetingEffect } from '../../../engine/manager/managerInterventionEngine';
import {
  getManagerIdentity,
  getManagerIdentityEffects,
  shiftManagerIdentity,
} from '../../../engine/manager/managerIdentityEngine';

type ModalMode = 'meeting' | 'press';

interface MeetingModalProps {
  mode: ModalMode;
  teamName: string;
  teamId?: string;
  saveId?: number;
  players: Player[];
  currentDate: string;
  recentResults: string;
  onClose: (didComplete: boolean) => void;
  cooldownDays?: number;
  playerMeetingDates?: Record<string, string>;
  onMeetingComplete?: (playerId: string) => void;
}

const MEETING_TOPICS = [
  '최근 경기 피드백',
  '훈련 방향 상의',
  '팀 내 역할 조정',
  '컨디션 관리',
  '개인 고민 상담',
];

const POSITION_LABELS: Record<string, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: '원딜',
  support: '서포터',
};

const MEETING_COOLDOWN_DAYS = 7;

function getPlayerCooldown(playerId: string, meetingDates: Record<string, string> | undefined, currentDate: string): number {
  if (!meetingDates || !meetingDates[playerId]) return 0;

  const lastMeeting = new Date(meetingDates[playerId]);
  const today = new Date(currentDate);
  const diffDays = Math.floor((today.getTime() - lastMeeting.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, MEETING_COOLDOWN_DAYS - diffDays);
}

export function MeetingModal({
  mode,
  teamName,
  teamId,
  saveId,
  players,
  currentDate,
  recentResults,
  onClose,
  cooldownDays,
  playerMeetingDates,
  onMeetingComplete,
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

  const isCooldown = mode === 'press' && (cooldownDays ?? 0) > 0;
  const title = mode === 'meeting' ? '선수 면담' : '기자회견';

  const handleMeeting = async () => {
    if (!selectedPlayer) return;

    setLoading(true);
    try {
      const condition = await getPlayerCondition(selectedPlayer.id, currentDate);
      const morale = condition?.morale ?? 50;

      const response = await generateMeetingResponse({
        teamName,
        playerName: selectedPlayer.name,
        playerPosition: POSITION_LABELS[selectedPlayer.position] ?? selectedPlayer.position,
        playerMorale: morale,
        topic: selectedTopic,
      });

      const identity = saveId ? await getManagerIdentity(saveId).catch(() => null) : null;
      const effects = identity ? getManagerIdentityEffects(identity.philosophy) : null;
      const adjustedMoraleChange = response.moraleChange + (effects?.playerMeetingBonus ?? 0);

      const newMorale = Math.max(0, Math.min(100, morale + adjustedMoraleChange));
      await upsertPlayerCondition(
        selectedPlayer.id,
        currentDate,
        condition?.stamina ?? 70,
        newMorale,
        condition?.form ?? 50,
      );

      if (teamId) {
        await recordPlayerMeetingEffect({
          playerId: selectedPlayer.id,
          teamId,
          topic: selectedTopic,
          startDate: currentDate,
          moraleBonus: Math.max(1, Math.round(adjustedMoraleChange / 2)),
          formBonus: adjustedMoraleChange > 0 ? 2 + Math.max(0, effects?.trainingFocusBonus ?? 0) : 0,
          notes: response.reason,
        });
      }

      if (saveId) {
        await shiftManagerIdentity(saveId, {
          playerCare: 4,
          tacticalFocus: selectedTopic.includes('훈련') || selectedTopic.includes('역할') ? 2 : 0,
          resultDriven: selectedTopic.includes('피드백') ? 1 : 0,
        });
      }

      setResult({
        dialogue: response.dialogue,
        moraleChange: adjustedMoraleChange,
        extra: effects?.playerMeetingBonus
          ? `${response.reason} / 감독 성향 보정 ${effects.playerMeetingBonus > 0 ? '+' : ''}${effects.playerMeetingBonus}`
          : response.reason,
      });
    } catch (error) {
      console.error('[MeetingModal] meeting failed:', error);
      setResult({
        dialogue: '면담을 원활하게 진행하지 못했습니다.',
        moraleChange: 0,
      });
    } finally {
      setLoading(false);
      setApplied(true);
      if (selectedPlayer) {
        onMeetingComplete?.(selectedPlayer.id);
      }
    }
  };

  const handlePressConference = async () => {
    setLoading(true);
    try {
      const response = await generatePressConferenceResponse({
        teamName,
        recentResults,
      });

      const identity = saveId ? await getManagerIdentity(saveId).catch(() => null) : null;
      const effects = identity ? getManagerIdentityEffects(identity.philosophy) : null;
      const adjustedTeamMoraleEffect = response.teamMoraleEffect + (effects?.pressEffectBonus ?? 0);

      for (const player of players) {
        const condition = await getPlayerCondition(player.id, currentDate);
        const morale = condition?.morale ?? 50;
        const newMorale = Math.max(0, Math.min(100, morale + adjustedTeamMoraleEffect));
        await upsertPlayerCondition(
          player.id,
          currentDate,
          condition?.stamina ?? 70,
          newMorale,
          condition?.form ?? 50,
        );
      }

      if (saveId) {
        await shiftManagerIdentity(saveId, {
          mediaFriendly: 4,
          resultDriven: adjustedTeamMoraleEffect > 0 ? 2 : 0,
        });
      }

      setResult({
        dialogue: response.dialogue,
        moraleChange: adjustedTeamMoraleEffect,
        extra: effects?.pressEffectBonus
          ? `여론 변화 ${response.publicOpinionChange > 0 ? '+' : ''}${response.publicOpinionChange} / 감독 성향 보정 ${effects.pressEffectBonus > 0 ? '+' : ''}${effects.pressEffectBonus}`
          : `여론 변화 ${response.publicOpinionChange > 0 ? '+' : ''}${response.publicOpinionChange}`,
      });
    } catch (error) {
      console.error('[MeetingModal] press conference failed:', error);
      setResult({
        dialogue: '기자회견을 무난하게 마무리했습니다.',
        moraleChange: 0,
      });
    } finally {
      setLoading(false);
      setApplied(true);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') onClose(false);
  };

  return (
    <div className="fm-overlay" role="dialog" aria-modal="true" aria-label={title} onKeyDown={handleKeyDown}>
      <div className="fm-modal">
        <div className="fm-modal__header">
          <span className="fm-modal__title">{title}</span>
          <button className="fm-modal__close" onClick={() => onClose(applied)} aria-label="닫기">
            ×
          </button>
        </div>

        {isCooldown && !result ? (
          <div className="fm-modal__body fm-text-center">
            <p className="fm-text-lg fm-text-secondary fm-mb-lg" style={{ lineHeight: 1.6 }}>
              다음 {title}까지 <span className="fm-font-bold fm-text-accent">{cooldownDays}일</span> 남았습니다.
            </p>
            <div className="fm-modal__footer" style={{ borderTop: 'none', justifyContent: 'center' }}>
              <button className="fm-btn fm-btn--primary" onClick={() => onClose(false)} autoFocus>
                닫기
              </button>
            </div>
          </div>
        ) : result ? (
          <div className="fm-modal__body fm-flex-col fm-gap-md fm-items-center">
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
                {result.moraleChange > 0 ? '+' : ''}
                {result.moraleChange}
              </span>
            </div>

            {result.extra && <p className="fm-text-xs fm-text-muted">{result.extra}</p>}

            <div className="fm-modal__footer" style={{ width: '100%', borderTop: 'none', justifyContent: 'center', padding: '8px 0 0' }}>
              <button className="fm-btn fm-btn--primary" onClick={() => onClose(true)}>
                확인
              </button>
            </div>
          </div>
        ) : mode === 'meeting' ? (
          <>
            <div className="fm-modal__body fm-flex-col fm-gap-lg">
              <div className="fm-flex-col fm-gap-sm">
                <label className="fm-text-sm fm-font-semibold fm-text-primary">면담 대상</label>
                <div className="fm-flex-col fm-gap-xs">
                  {players.map((player) => {
                    const playerCooldown = getPlayerCooldown(player.id, playerMeetingDates, currentDate);

                    return (
                      <button
                        key={player.id}
                        className={`fm-card fm-card--clickable fm-flex fm-items-center fm-gap-md ${
                          selectedPlayer?.id === player.id ? 'fm-card--highlight' : ''
                        }`}
                        style={{ padding: '10px 14px', opacity: playerCooldown > 0 ? 0.5 : 1 }}
                        onClick={() => playerCooldown === 0 && setSelectedPlayer(player)}
                        disabled={playerCooldown > 0}
                      >
                        <span className="fm-text-sm fm-font-semibold fm-text-accent" style={{ minWidth: 48 }}>
                          {POSITION_LABELS[player.position] ?? player.position}
                        </span>
                        <span className="fm-text-lg fm-font-medium fm-text-primary">{player.name}</span>
                        {playerCooldown > 0 && (
                          <span className="fm-text-xs fm-text-muted" style={{ marginLeft: 'auto' }}>
                            {playerCooldown}일 후 가능
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

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
              <button className="fm-btn" onClick={() => onClose(false)}>
                취소
              </button>
              <button className="fm-btn fm-btn--primary" disabled={!selectedPlayer || loading || applied} onClick={handleMeeting}>
                {loading ? '진행 중...' : '면담 시작'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="fm-modal__body fm-flex-col fm-gap-md">
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
                기자회견은 팀 전체 사기와 여론에 함께 영향을 줍니다.
              </p>
            </div>

            <div className="fm-modal__footer">
              <button className="fm-btn" onClick={() => onClose(false)}>
                취소
              </button>
              <button className="fm-btn fm-btn--primary" disabled={loading || applied} onClick={handlePressConference}>
                {loading ? '진행 중...' : '기자회견 시작'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
