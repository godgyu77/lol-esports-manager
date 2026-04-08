import { useState, useEffect } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getFreeAgents } from '../../../db/queries';
import type { Player } from '../../../types/player';
import { POSITION_LABELS_SHORT as POSITION_LABELS } from '../../../utils/constants';

const STAT_KEYS = ['mechanical', 'gameSense', 'teamwork', 'consistency', 'laning', 'aggression'] as const;
const STAT_LABELS: Record<(typeof STAT_KEYS)[number], string> = {
  mechanical: '기계적 수행',
  gameSense: '게임 이해도',
  teamwork: '팀워크',
  consistency: '안정성',
  laning: '라인전',
  aggression: '공격성',
};

function calcOverall(player: Player): number {
  const stats = player.stats;
  const average =
    (stats.mechanical + stats.gameSense + stats.teamwork + stats.consistency + stats.laning + stats.aggression) / 6;
  return Math.round(average);
}

export function PlayerCompareView() {
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);
  const userTeamId = save?.userTeamId ?? '';
  const userTeam = teams.find((team) => team.id === userTeamId);

  const [freeAgents, setFreeAgents] = useState<Player[]>([]);
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');

  useEffect(() => {
    getFreeAgents().then(setFreeAgents).catch(() => setFreeAgents([]));
  }, []);

  const rosterPlayers = userTeam?.roster ?? [];
  const allPlayers = [...rosterPlayers, ...freeAgents];
  const leftPlayer = allPlayers.find((player) => player.id === leftId) ?? null;
  const rightPlayer = allPlayers.find((player) => player.id === rightId) ?? null;

  const highlightClass = (a: number | undefined, b: number | undefined): { left: string; right: string } => {
    if (a == null || b == null) return { left: 'fm-text-secondary', right: 'fm-text-secondary' };
    if (a > b) return { left: 'fm-text-accent', right: 'fm-text-secondary' };
    if (b > a) return { left: 'fm-text-secondary', right: 'fm-text-accent' };
    return { left: 'fm-text-secondary', right: 'fm-text-secondary' };
  };

  const isWinner = (a: number | undefined, b: number | undefined, side: 'left' | 'right') => {
    if (a == null || b == null) return false;
    return side === 'left' ? a > b : b > a;
  };

  const renderStatBar = (label: string, leftValue: number | undefined, rightValue: number | undefined) => {
    const classes = highlightClass(leftValue, rightValue);
    return (
      <div key={label} className="fm-flex fm-items-center fm-gap-sm fm-mb-sm">
        <div className="fm-flex fm-items-center fm-gap-sm fm-flex-1" style={{ justifyContent: 'flex-end' }}>
          <span className={`fm-text-lg fm-font-semibold fm-text-center ${classes.left}`} style={{ minWidth: 28 }}>
            {leftValue ?? '-'}
          </span>
          <div className="fm-bar__track fm-flex-1">
            <div
              className={`fm-bar__fill ${isWinner(leftValue, rightValue, 'left') ? 'fm-bar__fill--accent' : ''}`}
              style={{ width: `${leftValue ?? 0}%` }}
            />
          </div>
        </div>
        <span
          className="fm-text-xs fm-font-medium fm-text-muted fm-text-center fm-flex-shrink-0"
          style={{ width: 100 }}
        >
          {label}
        </span>
        <div className="fm-flex fm-items-center fm-gap-sm fm-flex-1">
          <div className="fm-bar__track fm-flex-1">
            <div
              className={`fm-bar__fill ${isWinner(leftValue, rightValue, 'right') ? 'fm-bar__fill--accent' : ''}`}
              style={{ width: `${rightValue ?? 0}%` }}
            />
          </div>
          <span className={`fm-text-lg fm-font-semibold fm-text-center ${classes.right}`} style={{ minWidth: 28 }}>
            {rightValue ?? '-'}
          </span>
        </div>
      </div>
    );
  };

  const renderInfoRow = (label: string, leftValue: string | number | undefined, rightValue: string | number | undefined) => (
    <div
      key={label}
      className="fm-flex fm-items-center"
      style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}
    >
      <span className="fm-flex-1 fm-text-center fm-text-lg fm-text-primary">{leftValue ?? '-'}</span>
      <span
        className="fm-text-xs fm-font-medium fm-text-muted fm-text-center fm-flex-shrink-0"
        style={{ width: 100 }}
      >
        {label}
      </span>
      <span className="fm-flex-1 fm-text-center fm-text-lg fm-text-primary">{rightValue ?? '-'}</span>
    </div>
  );

  const renderSelect = (value: string, onChange: (next: string) => void) => (
    <select className="fm-select fm-flex-1" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">선수 선택</option>
      {rosterPlayers.length > 0 ? (
        <optgroup label={userTeam?.shortName ?? '우리 팀'}>
          {rosterPlayers.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name} ({POSITION_LABELS[player.position] ?? player.position})
            </option>
          ))}
        </optgroup>
      ) : null}
      {freeAgents.length > 0 ? (
        <optgroup label="자유 계약">
          {freeAgents.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name} ({POSITION_LABELS[player.position] ?? player.position})
            </option>
          ))}
        </optgroup>
      ) : null}
    </select>
  );

  const leftOverall = leftPlayer ? calcOverall(leftPlayer) : undefined;
  const rightOverall = rightPlayer ? calcOverall(rightPlayer) : undefined;
  const overallClasses = highlightClass(leftOverall, rightOverall);

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">선수 비교</h1>
        <p className="fm-page-subtitle">우리 팀 선수와 FA를 같은 기준으로 비교해 영입 또는 기용 판단에 활용합니다.</p>
      </div>

      <div className="fm-flex fm-items-center fm-gap-md fm-mb-lg">
        {renderSelect(leftId, setLeftId)}
        <span className="fm-text-xl fm-font-bold fm-text-accent">대결</span>
        {renderSelect(rightId, setRightId)}
      </div>

      <div className="fm-card fm-card--highlight fm-flex fm-items-center fm-justify-center fm-gap-lg fm-mb-lg">
        <span className={`fm-font-bold ${overallClasses.left}`} style={{ fontSize: 36 }}>{leftOverall ?? '-'}</span>
        <span className="fm-text-lg fm-font-semibold fm-text-muted">종합</span>
        <span className={`fm-font-bold ${overallClasses.right}`} style={{ fontSize: 36 }}>{rightOverall ?? '-'}</span>
      </div>

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">기본 정보</span>
        </div>
        <div className="fm-panel__body">
          {renderInfoRow('이름', leftPlayer?.name, rightPlayer?.name)}
          {renderInfoRow(
            '포지션',
            leftPlayer ? (POSITION_LABELS[leftPlayer.position] ?? leftPlayer.position) : undefined,
            rightPlayer ? (POSITION_LABELS[rightPlayer.position] ?? rightPlayer.position) : undefined,
          )}
          {renderInfoRow('나이', leftPlayer?.age, rightPlayer?.age)}
          {renderInfoRow('국적', leftPlayer?.nationality, rightPlayer?.nationality)}
        </div>
      </div>

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">능력치 비교</span>
        </div>
        <div className="fm-panel__body">
          {STAT_KEYS.map((key) => renderStatBar(STAT_LABELS[key], leftPlayer?.stats[key], rightPlayer?.stats[key]))}
        </div>
      </div>

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">멘탈과 성장치</span>
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
