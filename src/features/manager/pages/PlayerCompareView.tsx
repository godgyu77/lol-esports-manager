/**
 * 선수 비교 뷰
 * - 좌/우 패널에 선수 선택 드롭다운 (팀 내 + 자유계약 선수)
 * - 6개 스탯, 멘탈, 잠재력, OVR 비교
 */

import { useState, useEffect } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getFreeAgents } from '../../../db/queries';
import type { Player } from '../../../types/player';

const STAT_KEYS = ['mechanical', 'gameSense', 'teamwork', 'consistency', 'laning', 'aggression'] as const;
const STAT_LABELS: Record<(typeof STAT_KEYS)[number], string> = {
  mechanical: '기계적 숙련도',
  gameSense: '게임 이해도',
  teamwork: '팀워크',
  consistency: '일관성',
  laning: '라인전',
  aggression: '공격성',
};

const POSITION_LABELS: Record<string, string> = {
  top: 'TOP', jungle: 'JGL', mid: 'MID', adc: 'ADC', support: 'SUP',
};

const GOLD = '#c89b3c';
const NORMAL = '#8a8a9a';

function calcOvr(player: Player): number {
  const s = player.stats;
  const avg = (s.mechanical + s.gameSense + s.teamwork + s.consistency + s.laning + s.aggression) / 6;
  return Math.round(avg);
}

export function PlayerCompareView() {
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);
  const userTeamId = save?.userTeamId ?? '';
  const userTeam = teams.find((t) => t.id === userTeamId);

  const [freeAgents, setFreeAgents] = useState<Player[]>([]);
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');

  useEffect(() => {
    getFreeAgents().then(setFreeAgents).catch(() => setFreeAgents([]));
  }, []);

  const rosterPlayers = userTeam?.roster ?? [];
  const allPlayers = [...rosterPlayers, ...freeAgents];

  const leftPlayer = allPlayers.find((p) => p.id === leftId) ?? null;
  const rightPlayer = allPlayers.find((p) => p.id === rightId) ?? null;

  const highlightColor = (a: number | undefined, b: number | undefined): { left: string; right: string } => {
    if (a == null || b == null) return { left: NORMAL, right: NORMAL };
    if (a > b) return { left: GOLD, right: NORMAL };
    if (b > a) return { left: NORMAL, right: GOLD };
    return { left: NORMAL, right: NORMAL };
  };

  const renderStatBar = (label: string, leftVal: number | undefined, rightVal: number | undefined) => {
    const colors = highlightColor(leftVal, rightVal);
    return (
      <div key={label} style={styles.statRow}>
        <div style={styles.statLeft}>
          <span style={{ ...styles.statValue, color: colors.left }}>{leftVal ?? '-'}</span>
          <div style={styles.barContainer}>
            <div style={{ ...styles.bar, width: `${leftVal ?? 0}%`, background: colors.left === GOLD ? GOLD : '#3a3a5c' }} />
          </div>
        </div>
        <span style={styles.statLabel}>{label}</span>
        <div style={styles.statRight}>
          <div style={styles.barContainer}>
            <div style={{ ...styles.bar, width: `${rightVal ?? 0}%`, background: colors.right === GOLD ? GOLD : '#3a3a5c' }} />
          </div>
          <span style={{ ...styles.statValue, color: colors.right }}>{rightVal ?? '-'}</span>
        </div>
      </div>
    );
  };

  const renderInfoRow = (label: string, leftVal: string | number | undefined, rightVal: string | number | undefined) => {
    return (
      <div key={label} style={styles.infoRow}>
        <span style={styles.infoValue}>{leftVal ?? '-'}</span>
        <span style={styles.infoLabel}>{label}</span>
        <span style={styles.infoValue}>{rightVal ?? '-'}</span>
      </div>
    );
  };

  const renderSelect = (value: string, onChange: (v: string) => void) => (
    <select style={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">선수 선택</option>
      {rosterPlayers.length > 0 && (
        <optgroup label={userTeam?.shortName ?? '팀'}>
          {rosterPlayers.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({POSITION_LABELS[p.position] ?? p.position})</option>
          ))}
        </optgroup>
      )}
      {freeAgents.length > 0 && (
        <optgroup label="자유계약">
          {freeAgents.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({POSITION_LABELS[p.position] ?? p.position})</option>
          ))}
        </optgroup>
      )}
    </select>
  );

  const leftOvr = leftPlayer ? calcOvr(leftPlayer) : undefined;
  const rightOvr = rightPlayer ? calcOvr(rightPlayer) : undefined;
  const ovrColors = highlightColor(leftOvr, rightOvr);

  return (
    <div>
      <h1 style={styles.title}>선수 비교</h1>

      {/* 선수 선택 */}
      <div style={styles.selectorRow}>
        {renderSelect(leftId, setLeftId)}
        <span style={styles.vsText}>VS</span>
        {renderSelect(rightId, setRightId)}
      </div>

      {/* OVR */}
      <div style={styles.ovrRow}>
        <span style={{ ...styles.ovrValue, color: ovrColors.left }}>{leftOvr ?? '-'}</span>
        <span style={styles.ovrLabel}>OVR</span>
        <span style={{ ...styles.ovrValue, color: ovrColors.right }}>{rightOvr ?? '-'}</span>
      </div>

      {/* 기본 정보 */}
      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>기본 정보</h3>
        {renderInfoRow('이름', leftPlayer?.name, rightPlayer?.name)}
        {renderInfoRow('포지션', leftPlayer ? (POSITION_LABELS[leftPlayer.position] ?? leftPlayer.position) : undefined, rightPlayer ? (POSITION_LABELS[rightPlayer.position] ?? rightPlayer.position) : undefined)}
        {renderInfoRow('나이', leftPlayer?.age, rightPlayer?.age)}
        {renderInfoRow('국적', leftPlayer?.nationality, rightPlayer?.nationality)}
      </div>

      {/* 스탯 비교 */}
      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>능력치</h3>
        {STAT_KEYS.map((key) =>
          renderStatBar(
            STAT_LABELS[key],
            leftPlayer?.stats[key],
            rightPlayer?.stats[key],
          ),
        )}
      </div>

      {/* 멘탈/잠재력 */}
      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>멘탈 / 잠재력</h3>
        {renderStatBar('멘탈', leftPlayer?.mental.mental, rightPlayer?.mental.mental)}
        {renderStatBar('체력', leftPlayer?.mental.stamina, rightPlayer?.mental.stamina)}
        {renderStatBar('사기', leftPlayer?.mental.morale, rightPlayer?.mental.morale)}
        {renderStatBar('잠재력', leftPlayer?.potential, rightPlayer?.potential)}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '24px',
  },
  selectorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
  },
  select: {
    flex: 1,
    padding: '10px 14px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid #2a2a4a',
    background: '#12122a',
    color: '#e0e0e0',
    outline: 'none',
    cursor: 'pointer',
  },
  vsText: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#c89b3c',
  },
  ovrRow: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '32px',
    marginBottom: '24px',
    padding: '16px',
    background: 'linear-gradient(135deg, #1a1a3a 0%, #12122a 100%)',
    border: '1px solid #c89b3c44',
    borderRadius: '12px',
  },
  ovrLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#6a6a7a',
  },
  ovrValue: {
    fontSize: '36px',
    fontWeight: 700,
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a2a4a',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#c89b3c',
    marginBottom: '14px',
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  statLeft: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  statRight: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statLabel: {
    width: '100px',
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: 500,
    color: '#8a8a9a',
    flexShrink: 0,
  },
  statValue: {
    fontSize: '14px',
    fontWeight: 600,
    minWidth: '28px',
    textAlign: 'center',
  },
  barContainer: {
    flex: 1,
    height: '6px',
    background: '#1a1a2e',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  infoLabel: {
    width: '100px',
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: 500,
    color: '#6a6a7a',
    flexShrink: 0,
  },
  infoValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: '14px',
    color: '#e0e0e0',
  },
};
