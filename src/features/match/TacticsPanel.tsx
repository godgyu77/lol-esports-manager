/**
 * 경기 중 전술 변경 패널
 * - 접이식 사이드 패널 (기본 접힌 상태)
 * - 플레이 스타일 / 오브젝트 우선순위 / 팀파이트 성향 변경
 * - 쿨다운 5틱 동안 재변경 불가
 */

import { useState, useCallback } from 'react';
import type {
  LiveMatchEngine,
  InGamePlayStyle,
  ObjectivePriority,
  TeamfightAggression,
} from '../../engine/match/liveMatch';
import './match.css';

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
    <div className="match-tactics-wrapper">
      <button
        className="match-tactics-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? '전술 패널 닫기' : '전술 패널 열기'}
      >
        {isOpen ? '전술 닫기' : '전술'}
      </button>

      {isOpen && (
        <div className="match-tactics-panel">
          <h4 className="match-tactics-title">전술 변경</h4>

          {cooldown > 0 && (
            <div className="match-tactics-cooldown">
              쿨다운: {cooldown}분 남음
            </div>
          )}

          <div className="match-tactics-section">
            <span className="match-tactics-section-label">플레이 스타일</span>
            <div className="match-tactics-btn-group">
              {playStyleOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={`match-tactics-opt-btn ${playStyle === opt.value ? 'match-tactics-opt-btn--active' : ''}`}
                  onClick={() => setPlayStyle(opt.value)}
                  title={opt.desc}
                  aria-label={`${opt.label}: ${opt.desc}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="match-tactics-section">
            <span className="match-tactics-section-label">오브젝트 우선순위</span>
            <div className="match-tactics-btn-group">
              {objectiveOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={`match-tactics-opt-btn ${objective === opt.value ? 'match-tactics-opt-btn--active' : ''}`}
                  onClick={() => setObjective(opt.value)}
                  title={opt.desc}
                  aria-label={`${opt.label}: ${opt.desc}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="match-tactics-section">
            <span className="match-tactics-section-label">팀파이트 성향</span>
            <div className="match-tactics-btn-group">
              {teamfightOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={`match-tactics-opt-btn ${teamfight === opt.value ? 'match-tactics-opt-btn--active' : ''}`}
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
            className="fm-btn fm-btn--primary"
            onClick={handleApply}
            disabled={!hasChanges || cooldown > 0}
            style={{ width: '100%' }}
          >
            {cooldown > 0 ? `쿨다운 (${cooldown}분)` : '전술 적용'}
          </button>
        </div>
      )}
    </div>
  );
}
