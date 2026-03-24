/**
 * 경기 중 개별 선수 지시 팝업
 * - 선수 클릭 시 지시 옵션 표시
 * - 한 번에 최대 2명에게만 지시 가능
 * - 해당 세트 동안만 유효
 */

import { useState, useCallback } from 'react';
import type {
  LiveMatchEngine,
  LivePlayerStat,
  PlayerInstructionType,
} from '../../engine/match/liveMatch';
import {
  PLAYER_INSTRUCTION_LABELS,
  PLAYER_INSTRUCTION_DESCRIPTIONS,
} from '../../engine/match/liveMatch';
import './match.css';

interface PlayerInstructionsProps {
  engine: LiveMatchEngine;
  playerStats: LivePlayerStat[];
  side: 'home' | 'away';
  teamShortName: string;
  onInstructionChanged: () => void;
}

const INSTRUCTION_OPTIONS: { value: PlayerInstructionType; roamOnly?: boolean }[] = [
  { value: 'aggressive' },
  { value: 'safe' },
  { value: 'roam', roamOnly: true },
  { value: 'lane_focus' },
];

const positionLabels: Record<string, string> = {
  top: 'TOP',
  jungle: 'JGL',
  mid: 'MID',
  adc: 'ADC',
  support: 'SUP',
};

export function PlayerInstructions({
  engine,
  playerStats,
  side,
  teamShortName,
  onInstructionChanged,
}: PlayerInstructionsProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const instructions = engine.getPlayerInstructions();

  const handlePlayerClick = useCallback((playerId: string) => {
    setSelectedPlayerId((prev) => (prev === playerId ? null : playerId));
  }, []);

  const handleInstruction = useCallback(
    (playerId: string, instruction: PlayerInstructionType) => {
      const success = engine.setPlayerInstruction(playerId, instruction);
      if (success) {
        onInstructionChanged();
      }
      setSelectedPlayerId(null);
    },
    [engine, onInstructionChanged],
  );

  const handleClear = useCallback(
    (playerId: string) => {
      engine.clearPlayerInstruction(playerId);
      onInstructionChanged();
      setSelectedPlayerId(null);
    },
    [engine, onInstructionChanged],
  );

  return (
    <div className="match-instr-container">
      <div className="match-instr-header">
        <span className={`match-instr-team-label ${side === 'home' ? 'match-instr-team-label--home' : 'match-instr-team-label--away'}`}>
          {teamShortName}
        </span>
        <span className="match-instr-hint">선수를 클릭하여 지시</span>
      </div>
      <div className="match-instr-player-list">
        {playerStats.map((stat) => {
          const currentInstruction = instructions.get(stat.playerId);
          const isSelected = selectedPlayerId === stat.playerId;
          const canRoam = stat.position === 'jungle' || stat.position === 'support';

          const btnClass = [
            'match-instr-player-btn',
            currentInstruction ? 'match-instr-player-btn--active' : '',
            isSelected ? 'match-instr-player-btn--selected' : '',
          ].filter(Boolean).join(' ');

          return (
            <div key={stat.playerId} className="match-instr-player-row">
              <button
                className={btnClass}
                onClick={() => handlePlayerClick(stat.playerId)}
                aria-label={`${positionLabels[stat.position]} 선수 지시`}
              >
                <span className="match-instr-pos-label">{positionLabels[stat.position]}</span>
                <span className="match-instr-kda">
                  {stat.kills}/{stat.deaths}/{stat.assists}
                </span>
                {currentInstruction && (
                  <span className="match-instr-badge">
                    {PLAYER_INSTRUCTION_LABELS[currentInstruction]}
                  </span>
                )}
              </button>

              {isSelected && (
                <div className="match-instr-popup">
                  <div className="match-instr-popup-title">지시 선택</div>
                  {INSTRUCTION_OPTIONS
                    .filter((opt) => !opt.roamOnly || canRoam)
                    .map((opt) => (
                      <button
                        key={opt.value}
                        className={`match-instr-option-btn ${currentInstruction === opt.value ? 'match-instr-option-btn--active' : ''}`}
                        onClick={() => handleInstruction(stat.playerId, opt.value)}
                        aria-label={PLAYER_INSTRUCTION_LABELS[opt.value]}
                      >
                        <span className="match-instr-option-label">
                          {PLAYER_INSTRUCTION_LABELS[opt.value]}
                        </span>
                        <span className="match-instr-option-desc">
                          {PLAYER_INSTRUCTION_DESCRIPTIONS[opt.value]}
                        </span>
                      </button>
                    ))}
                  {currentInstruction && (
                    <button
                      className="match-instr-clear-btn"
                      onClick={() => handleClear(stat.playerId)}
                    >
                      지시 해제
                    </button>
                  )}
                  <div className="match-instr-limit-text">
                    지시 중: {instructions.size}/2
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
