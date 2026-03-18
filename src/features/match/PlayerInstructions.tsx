/**
 * 경기 중 개별 선수 지시 팝업
 * - 선수 클릭 시 지시 옵션 표시
 * - 한 번에 최대 2명에게만 지시 가능
 * - 해당 세트 동안만 유효
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import type {
  LiveMatchEngine,
  LivePlayerStat,
  PlayerInstructionType,
} from '../../engine/match/liveMatch';
import {
  PLAYER_INSTRUCTION_LABELS,
  PLAYER_INSTRUCTION_DESCRIPTIONS,
} from '../../engine/match/liveMatch';

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
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={{ ...styles.teamLabel, color: side === 'home' ? '#3498db' : '#e74c3c' }}>
          {teamShortName}
        </span>
        <span style={styles.hint}>선수를 클릭하여 지시</span>
      </div>
      <div style={styles.playerList}>
        {playerStats.map((stat) => {
          const currentInstruction = instructions.get(stat.playerId);
          const isSelected = selectedPlayerId === stat.playerId;
          const canRoam = stat.position === 'jungle' || stat.position === 'support';

          return (
            <div key={stat.playerId} style={styles.playerRow}>
              <button
                style={{
                  ...styles.playerBtn,
                  ...(currentInstruction ? styles.playerBtnActive : {}),
                  ...(isSelected ? styles.playerBtnSelected : {}),
                }}
                onClick={() => handlePlayerClick(stat.playerId)}
                aria-label={`${positionLabels[stat.position]} 선수 지시`}
              >
                <span style={styles.posLabel}>{positionLabels[stat.position]}</span>
                <span style={styles.kda}>
                  {stat.kills}/{stat.deaths}/{stat.assists}
                </span>
                {currentInstruction && (
                  <span style={styles.instructionBadge}>
                    {PLAYER_INSTRUCTION_LABELS[currentInstruction]}
                  </span>
                )}
              </button>

              {isSelected && (
                <div style={styles.popup}>
                  <div style={styles.popupTitle}>지시 선택</div>
                  {INSTRUCTION_OPTIONS
                    .filter((opt) => !opt.roamOnly || canRoam)
                    .map((opt) => (
                      <button
                        key={opt.value}
                        style={{
                          ...styles.instrBtn,
                          ...(currentInstruction === opt.value ? styles.instrBtnActive : {}),
                        }}
                        onClick={() => handleInstruction(stat.playerId, opt.value)}
                        aria-label={PLAYER_INSTRUCTION_LABELS[opt.value]}
                      >
                        <span style={styles.instrLabel}>
                          {PLAYER_INSTRUCTION_LABELS[opt.value]}
                        </span>
                        <span style={styles.instrDesc}>
                          {PLAYER_INSTRUCTION_DESCRIPTIONS[opt.value]}
                        </span>
                      </button>
                    ))}
                  {currentInstruction && (
                    <button
                      style={styles.clearBtn}
                      onClick={() => handleClear(stat.playerId)}
                    >
                      지시 해제
                    </button>
                  )}
                  <div style={styles.limitText}>
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

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '10px',
    marginBottom: '8px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  teamLabel: {
    fontSize: '13px',
    fontWeight: 700,
  },
  hint: {
    fontSize: '10px',
    color: '#6a6a7a',
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  playerRow: {
    position: 'relative',
  },
  playerBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 10px',
    background: 'transparent',
    border: '1px solid #2a2a4a',
    borderRadius: '4px',
    color: '#e0e0e0',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  playerBtnActive: {
    borderColor: '#c89b3c',
    background: 'rgba(200,155,60,0.1)',
  },
  playerBtnSelected: {
    borderColor: '#3498db',
    background: 'rgba(52,152,219,0.1)',
  },
  posLabel: {
    fontWeight: 700,
    fontSize: '11px',
    color: '#c89b3c',
    width: '30px',
  },
  kda: {
    fontSize: '12px',
    color: '#8a8a9a',
    fontFamily: 'monospace',
  },
  instructionBadge: {
    marginLeft: 'auto',
    fontSize: '10px',
    color: '#2ecc71',
    background: 'rgba(46,204,113,0.15)',
    padding: '2px 6px',
    borderRadius: '3px',
  },
  popup: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 10,
    background: '#1a1a3a',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    padding: '10px',
    marginTop: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  },
  popupTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#c89b3c',
    marginBottom: '4px',
  },
  instrBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '6px 8px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a2a4a',
    borderRadius: '4px',
    color: '#e0e0e0',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  instrBtnActive: {
    background: 'rgba(200,155,60,0.2)',
    borderColor: '#c89b3c',
  },
  instrLabel: {
    fontWeight: 600,
    fontSize: '11px',
  },
  instrDesc: {
    fontSize: '10px',
    color: '#6a6a7a',
  },
  clearBtn: {
    padding: '5px 8px',
    background: 'rgba(231,76,60,0.15)',
    border: '1px solid #e74c3c44',
    borderRadius: '4px',
    color: '#e74c3c',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  limitText: {
    fontSize: '10px',
    color: '#6a6a7a',
    textAlign: 'center',
    marginTop: '4px',
  },
};
