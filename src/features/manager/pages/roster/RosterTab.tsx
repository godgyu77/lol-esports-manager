import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { updatePlayerDivision, updateTeamPlayStyle } from '../../../../db/queries';
import type { Position } from '../../../../types/game';
import type { PlayStyle } from '../../../../types/team';
import type { Team } from '../../../../types/team';
import { PlayerAvatar } from '../../../../components/PlayerAvatar';
import { POSITION_LABELS_KR as POSITION_LABELS } from '../../../../utils/constants';
import {
  type Division,
  PLAY_STYLE_INFO,
  POSITION_BADGE_MAP,
  sortByPosition,
  getOvr,
  getOvrClass,
} from './rosterUtils';

interface RosterTabProps {
  userTeam: Team;
  teams: Team[];
  setTeams: (teams: Team[]) => void;
}

export function RosterTab({ userTeam, teams, setTeams }: RosterTabProps) {
  const [swapSource, setSwapSource] = useState<{ id: string; division: Division } | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSwap = useCallback(async (
    playerId: string,
    currentDivision: Division,
  ) => {
    if (!swapSource) {
      setSwapSource({ id: playerId, division: currentDivision });
      setMessage(null);
      return;
    }

    if (swapSource.id === playerId) {
      setSwapSource(null);
      setMessage(null);
      return;
    }

    const sourcePlayer = userTeam.roster.find(p => p.id === swapSource.id);
    const targetPlayer = userTeam.roster.find(p => p.id === playerId);
    if (!sourcePlayer || !targetPlayer) return;

    const sourceDivision = swapSource.division;
    const targetDivision = currentDivision;

    if (sourceDivision === targetDivision) {
      setSwapSource({ id: playerId, division: currentDivision });
      return;
    }

    setIsSwapping(true);
    try {
      await updatePlayerDivision(swapSource.id, targetDivision);
      await updatePlayerDivision(playerId, sourceDivision);

      const updatedTeams = teams.map(team => {
        if (team.id !== userTeam.id) return team;
        return {
          ...team,
          roster: team.roster.map(p => {
            if (p.id === swapSource.id) {
              return { ...p, division: targetDivision } as typeof p;
            }
            if (p.id === playerId) {
              return { ...p, division: sourceDivision } as typeof p;
            }
            return p;
          }),
        };
      });
      setTeams(updatedTeams);
      setMessage(`${sourcePlayer.name} \u2194 ${targetPlayer.name} 교체 완료`);
    } finally {
      setSwapSource(null);
      setIsSwapping(false);
    }
  }, [swapSource, userTeam, teams, setTeams]);

  const handlePromoteDemote = useCallback(async (
    playerId: string,
    currentDivision: Division,
  ) => {
    const newDivision: Division = currentDivision === 'main' ? 'sub' : 'main';

    setIsSwapping(true);
    try {
      await updatePlayerDivision(playerId, newDivision);

      const updatedTeams = teams.map(team => {
        if (team.id !== userTeam.id) return team;
        return {
          ...team,
          roster: team.roster.map(p => {
            if (p.id === playerId) {
              return { ...p, division: newDivision } as typeof p;
            }
            return p;
          }),
        };
      });
      setTeams(updatedTeams);

      const player = userTeam.roster.find(p => p.id === playerId);
      setMessage(`${player?.name} ${newDivision === 'main' ? '1군 승격' : '2군 강등'}`);
    } finally {
      setSwapSource(null);
      setIsSwapping(false);
    }
  }, [userTeam, teams, setTeams]);

  const handlePlayStyleChange = useCallback(async (style: PlayStyle) => {
    await updateTeamPlayStyle(userTeam.id, style);
    const updatedTeams = teams.map(team => {
      if (team.id !== userTeam.id) return team;
      return { ...team, playStyle: style };
    });
    setTeams(updatedTeams);
    setMessage(`팀 전술이 "${PLAY_STYLE_INFO[style].name}"(으)로 변경되었습니다`);
  }, [userTeam, teams, setTeams]);

  const mainRoster = userTeam.roster.filter(
    (p) => (p as { division?: string }).division === 'main',
  );
  const subRoster = userTeam.roster.filter(
    (p) => (p as { division?: string }).division === 'sub',
  );

  const renderTable = (players: typeof userTeam.roster, title: string, division: Division) => (
    <div className="fm-panel fm-mb-md">
      <div className="fm-panel__header">
        <span className="fm-panel__title">{title} ({players.length}명)</span>
      </div>
      <div className="fm-panel__body--flush fm-table-wrap">
        <table className="fm-table fm-table--striped">
          <thead>
            <tr>
              <th>포지션</th>
              <th>이름</th>
              <th>나이</th>
              <th>OVR</th>
              <th>기계</th>
              <th>센스</th>
              <th>팀워크</th>
              <th>일관</th>
              <th>라인</th>
              <th>공격</th>
              <th>멘탈</th>
              <th>계약</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortByPosition(players).map((player) => {
              const avgOvr = getOvr(player);
              const isSelected = swapSource?.id === player.id;
              return (
                <tr
                  key={player.id}
                  className={isSelected ? 'fm-table__row--selected' : ''}
                >
                  <td>
                    <span className={`fm-pos-badge fm-pos-badge--${POSITION_BADGE_MAP[player.position] ?? 'mid'}`}>
                      {POSITION_LABELS[player.position] ?? player.position}
                    </span>
                  </td>
                  <td className="fm-cell--name">
                    <div className="fm-flex fm-items-center fm-gap-sm">
                      <PlayerAvatar
                        position={player.position as Position}
                        nationality={player.nationality}
                        size={28}
                        name={player.name}
                      />
                      <Link to={'/manager/player/' + player.id} className="fm-cell--name" style={{ textDecoration: 'none' }}>
                        {player.name}
                      </Link>
                    </div>
                  </td>
                  <td>{player.age}</td>
                  <td className={getOvrClass(avgOvr)}>{avgOvr}</td>
                  <td>{player.stats.mechanical}</td>
                  <td>{player.stats.gameSense}</td>
                  <td>{player.stats.teamwork}</td>
                  <td>{player.stats.consistency}</td>
                  <td>{player.stats.laning}</td>
                  <td>{player.stats.aggression}</td>
                  <td>{player.mental.mental}</td>
                  <td>{player.contract.contractEndSeason}</td>
                  <td>
                    <div className="fm-flex fm-gap-xs">
                      <button
                        className={`fm-btn fm-btn--sm ${isSelected ? 'fm-btn--primary' : ''}`}
                        onClick={() => handleSwap(player.id, division)}
                        disabled={isSwapping}
                        title="교체할 선수 선택"
                      >
                        {isSelected ? '취소' : '교체'}
                      </button>
                      <button
                        className="fm-btn fm-btn--sm fm-btn--ghost"
                        onClick={() => handlePromoteDemote(player.id, division)}
                        disabled={isSwapping}
                        title={division === 'main' ? '2군으로 강등' : '1군으로 승격'}
                      >
                        {division === 'main' ? '\u2193' : '\u2191'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      {/* 팀 전술 선택 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">팀 전술</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--3">
            {(Object.keys(PLAY_STYLE_INFO) as PlayStyle[]).map((style) => {
              const info = PLAY_STYLE_INFO[style];
              const isActive = userTeam?.playStyle === style;
              return (
                <button
                  key={style}
                  className={`fm-card fm-card--clickable fm-flex-col fm-items-center fm-gap-xs ${isActive ? 'fm-card--highlight' : ''}`}
                  onClick={() => handlePlayStyleChange(style)}
                >
                  <span className="fm-text-2xl">{info.icon}</span>
                  <span className="fm-text-lg fm-font-bold fm-text-primary">{info.name}</span>
                  <span className="fm-text-base fm-text-secondary fm-text-center" style={{ lineHeight: '1.4' }}>{info.description}</span>
                  <span className="fm-text-sm fm-text-muted fm-text-center fm-mt-sm">{info.matchup}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 안내 메시지 */}
      {swapSource && (
        <div className="fm-alert fm-alert--warning fm-mb-md">
          <span className="fm-alert__text">교체할 상대 선수를 선택하세요 (1군 \u2194 2군)</span>
        </div>
      )}

      {message && (
        <div className="fm-alert fm-alert--success fm-mb-md">
          <span className="fm-alert__text">{message}</span>
        </div>
      )}

      {renderTable(mainRoster, '1군', 'main')}
      {subRoster.length > 0 && renderTable(subRoster, '2군', 'sub')}
      {subRoster.length === 0 && (
        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__header">
            <span className="fm-panel__title">2군 (0명)</span>
          </div>
          <div className="fm-panel__body">
            <p className="fm-text-muted fm-text-md">2군 선수가 없습니다.</p>
          </div>
        </div>
      )}
    </>
  );
}
