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

  const highlightClass = (a: number | undefined, b: number | undefined): { left: string; right: string } => {
    if (a == null || b == null) return { left: 'fm-text-secondary', right: 'fm-text-secondary' };
    if (a > b) return { left: 'fm-text-accent', right: 'fm-text-secondary' };
    if (b > a) return { left: 'fm-text-secondary', right: 'fm-text-accent' };
    return { left: 'fm-text-secondary', right: 'fm-text-secondary' };
  };

  const isGold = (a: number | undefined, b: number | undefined, side: 'left' | 'right'): boolean => {
    if (a == null || b == null) return false;
    if (side === 'left') return a > b;
    return b > a;
  };

  const renderStatBar = (label: string, leftVal: number | undefined, rightVal: number | undefined) => {
    const classes = highlightClass(leftVal, rightVal);
    return (
      <div key={label} className="fm-flex fm-items-center fm-gap-sm fm-mb-sm">
        <div className="fm-flex fm-items-center fm-gap-sm fm-flex-1" style={{ justifyContent: 'flex-end' }}>
          <span className={`fm-text-lg fm-font-semibold fm-text-center ${classes.left}`} style={{ minWidth: 28 }}>
            {leftVal ?? '-'}
          </span>
          <div className="fm-bar__track fm-flex-1">
            <div
              className={`fm-bar__fill ${isGold(leftVal, rightVal, 'left') ? 'fm-bar__fill--accent' : ''}`}
              style={{ width: `${leftVal ?? 0}%` }}
            />
          </div>
        </div>
        <span className="fm-text-xs fm-font-medium fm-text-muted fm-text-center fm-flex-shrink-0" style={{ width: 100 }}>
          {label}
        </span>
        <div className="fm-flex fm-items-center fm-gap-sm fm-flex-1">
          <div className="fm-bar__track fm-flex-1">
            <div
              className={`fm-bar__fill ${isGold(leftVal, rightVal, 'right') ? 'fm-bar__fill--accent' : ''}`}
              style={{ width: `${rightVal ?? 0}%` }}
            />
          </div>
          <span className={`fm-text-lg fm-font-semibold fm-text-center ${classes.right}`} style={{ minWidth: 28 }}>
            {rightVal ?? '-'}
          </span>
        </div>
      </div>
    );
  };

  const renderInfoRow = (label: string, leftVal: string | number | undefined, rightVal: string | number | undefined) => {
    return (
      <div key={label} className="fm-flex fm-items-center" style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
        <span className="fm-flex-1 fm-text-center fm-text-lg fm-text-primary">{leftVal ?? '-'}</span>
        <span className="fm-text-xs fm-font-medium fm-text-muted fm-text-center fm-flex-shrink-0" style={{ width: 100 }}>
          {label}
        </span>
        <span className="fm-flex-1 fm-text-center fm-text-lg fm-text-primary">{rightVal ?? '-'}</span>
      </div>
    );
  };

  const renderSelect = (value: string, onChange: (v: string) => void) => (
    <select className="fm-select fm-flex-1" value={value} onChange={(e) => onChange(e.target.value)}>
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
  const ovrClasses = highlightClass(leftOvr, rightOvr);

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">선수 비교</h1>
      </div>

      {/* 선수 선택 */}
      <div className="fm-flex fm-items-center fm-gap-md fm-mb-lg">
        {renderSelect(leftId, setLeftId)}
        <span className="fm-text-xl fm-font-bold fm-text-accent">VS</span>
        {renderSelect(rightId, setRightId)}
      </div>

      {/* OVR */}
      <div className="fm-card fm-card--highlight fm-flex fm-items-center fm-justify-center fm-gap-lg fm-mb-lg">
        <span className={`fm-font-bold ${ovrClasses.left}`} style={{ fontSize: 36 }}>{leftOvr ?? '-'}</span>
        <span className="fm-text-lg fm-font-semibold fm-text-muted">OVR</span>
        <span className={`fm-font-bold ${ovrClasses.right}`} style={{ fontSize: 36 }}>{rightOvr ?? '-'}</span>
      </div>

      {/* 기본 정보 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">기본 정보</span>
        </div>
        <div className="fm-panel__body">
          {renderInfoRow('이름', leftPlayer?.name, rightPlayer?.name)}
          {renderInfoRow('포지션', leftPlayer ? (POSITION_LABELS[leftPlayer.position] ?? leftPlayer.position) : undefined, rightPlayer ? (POSITION_LABELS[rightPlayer.position] ?? rightPlayer.position) : undefined)}
          {renderInfoRow('나이', leftPlayer?.age, rightPlayer?.age)}
          {renderInfoRow('국적', leftPlayer?.nationality, rightPlayer?.nationality)}
        </div>
      </div>

      {/* 스탯 비교 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">능력치</span>
        </div>
        <div className="fm-panel__body">
          {STAT_KEYS.map((key) =>
            renderStatBar(
              STAT_LABELS[key],
              leftPlayer?.stats[key],
              rightPlayer?.stats[key],
            ),
          )}
        </div>
      </div>

      {/* 멘탈/잠재력 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">멘탈 / 잠재력</span>
        </div>
        <div className="fm-panel__body">
          {renderStatBar('멘탈', leftPlayer?.mental.mental, rightPlayer?.mental.mental)}
          {renderStatBar('체력', leftPlayer?.mental.stamina, rightPlayer?.mental.stamina)}
          {renderStatBar('사기', leftPlayer?.mental.morale, rightPlayer?.mental.morale)}
          {renderStatBar('잠재력', leftPlayer?.potential, rightPlayer?.potential)}
        </div>
      </div>
    </div>
  );
}
