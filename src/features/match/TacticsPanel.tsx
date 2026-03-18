/**
 * 경기 중 전술 변경 패널
 * - 접이식 사이드 패널 (기본 접힌 상태)
 * - 플레이 스타일 / 오브젝트 우선순위 / 팀파이트 성향 변경
 * - 쿨다운 5틱 동안 재변경 불가
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import type {
  LiveMatchEngine,
  InGamePlayStyle,
  ObjectivePriority,
  TeamfightAggression,
} from '../../engine/match/liveMatch';

interface TacticsPanelProps {
  engine: LiveMatchEngine;
  onTacticsChanged: () => void;
}

const playStyleOptions: { value: InGamePlayStyle; label: string; desc: string }[] = [
  { value: 'aggressive', label: '공격적', desc: '킬 확률 +20%, 데스 위험 +15%' },
  { value: 'controlled', label: '안정', desc: '균형 잡힌 운영' },
  { value: 'split', label: '스플릿', desc: '사이드 라인 압박 중시' },
];

const objectiveOptions: { value: ObjectivePriority; label: string; desc: string }[] = [
  { value: 'dragon', label: '드래곤 중시', desc: '드래곤 교전 확률 +30%' },
  { value: 'baron', label: '바론 중시', desc: '바론 컨트롤 강화' },
  { value: 'balanced', label: '균형', desc: '상황에 맞게 판단' },
];

const teamfightOptions: { value: TeamfightAggression; label: string; desc: string }[] = [
  { value: 'engage', label: '적극 교전', desc: '한타 발생 확률 +25%' },
  { value: 'avoid', label: '회피', desc: '교전을 피하고 파밍' },
  { value: 'situational', label: '상황에 따라', desc: '유불리에 따라 판단' },
];

export function TacticsPanel({ engine, onTacticsChanged }: TacticsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const tactics = engine.getInGameTactics();
  const cooldown = engine.getTacticsCooldown();

  const [playStyle, setPlayStyle] = useState<InGamePlayStyle>(tactics.playStyle);
  const [objective, setObjective] = useState<ObjectivePriority>(tactics.objectivePriority);
  const [teamfight, setTeamfight] = useState<TeamfightAggression>(tactics.teamfightAggression);

  const handleApply = useCallback(() => {
    const success = engine.setInGameTactics(playStyle, objective, teamfight);
    if (success) {
      onTacticsChanged();
    }
  }, [engine, playStyle, objective, teamfight, onTacticsChanged]);

  const hasChanges =
    playStyle !== tactics.playStyle ||
    objective !== tactics.objectivePriority ||
    teamfight !== tactics.teamfightAggression;

  return (
    <div style={styles.wrapper}>
      <button
        style={styles.toggleBtn}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? '전술 패널 닫기' : '전술 패널 열기'}
      >
        {isOpen ? '전술 닫기' : '전술'}
      </button>

      {isOpen && (
        <div style={styles.panel}>
          <h4 style={styles.title}>전술 변경</h4>

          {cooldown > 0 && (
            <div style={styles.cooldownBadge}>
              쿨다운: {cooldown}분 남음
            </div>
          )}

          <div style={styles.section}>
            <span style={styles.sectionLabel}>플레이 스타일</span>
            <div style={styles.btnGroup}>
              {playStyleOptions.map((opt) => (
                <button
                  key={opt.value}
                  style={{
                    ...styles.optBtn,
                    ...(playStyle === opt.value ? styles.optBtnActive : {}),
                  }}
                  onClick={() => setPlayStyle(opt.value)}
                  title={opt.desc}
                  aria-label={`${opt.label}: ${opt.desc}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.section}>
            <span style={styles.sectionLabel}>오브젝트 우선순위</span>
            <div style={styles.btnGroup}>
              {objectiveOptions.map((opt) => (
                <button
                  key={opt.value}
                  style={{
                    ...styles.optBtn,
                    ...(objective === opt.value ? styles.optBtnActive : {}),
                  }}
                  onClick={() => setObjective(opt.value)}
                  title={opt.desc}
                  aria-label={`${opt.label}: ${opt.desc}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.section}>
            <span style={styles.sectionLabel}>팀파이트 성향</span>
            <div style={styles.btnGroup}>
              {teamfightOptions.map((opt) => (
                <button
                  key={opt.value}
                  style={{
                    ...styles.optBtn,
                    ...(teamfight === opt.value ? styles.optBtnActive : {}),
                  }}
                  onClick={() => setTeamfight(opt.value)}
                  title={opt.desc}
                  aria-label={`${opt.label}: ${opt.desc}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            style={{
              ...styles.applyBtn,
              opacity: (!hasChanges || cooldown > 0) ? 0.4 : 1,
              cursor: (!hasChanges || cooldown > 0) ? 'not-allowed' : 'pointer',
            }}
            onClick={handleApply}
            disabled={!hasChanges || cooldown > 0}
          >
            {cooldown > 0 ? `쿨다운 (${cooldown}분)` : '전술 적용'}
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  toggleBtn: {
    padding: '6px 14px',
    background: '#1a1a3a',
    border: '1px solid #3a3a5c',
    borderRadius: '6px',
    color: '#c89b3c',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  panel: {
    marginTop: '6px',
    background: '#1a1a3a',
    border: '1px solid #3a3a5c',
    borderRadius: '10px',
    padding: '16px',
    width: '220px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#c89b3c',
    margin: 0,
  },
  cooldownBadge: {
    fontSize: '11px',
    color: '#e74c3c',
    background: 'rgba(231,76,60,0.15)',
    padding: '4px 8px',
    borderRadius: '4px',
    textAlign: 'center',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  sectionLabel: {
    fontSize: '11px',
    color: '#8a8a9a',
    fontWeight: 600,
  },
  btnGroup: {
    display: 'flex',
    gap: '4px',
  },
  optBtn: {
    flex: 1,
    padding: '5px 4px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #3a3a5c',
    borderRadius: '4px',
    color: '#8a8a9a',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  optBtnActive: {
    background: 'rgba(200,155,60,0.2)',
    borderColor: '#c89b3c',
    color: '#f0e6d2',
    fontWeight: 700,
  },
  applyBtn: {
    padding: '7px 0',
    background: '#c89b3c',
    border: 'none',
    borderRadius: '6px',
    color: '#0d0d1a',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
