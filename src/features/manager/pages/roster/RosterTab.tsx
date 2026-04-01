import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayerAvatar } from '../../../../components/PlayerAvatar';
import { updatePlayerDivision, updateTeamPlayStyle } from '../../../../db/queries';
import type { Position } from '../../../../types/game';
import type { Team } from '../../../../types/team';
import type { PlayStyle } from '../../../../types/team';
import { POSITION_LABELS_KR as POSITION_LABELS } from '../../../../utils/constants';
import {
  type Division,
  getOvr,
  getOvrClass,
  PLAY_STYLE_INFO,
  POSITION_BADGE_MAP,
  sortByPosition,
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

  const handleSwap = useCallback(async (playerId: string, currentDivision: Division) => {
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

    const sourcePlayer = userTeam.roster.find((player) => player.id === swapSource.id);
    const targetPlayer = userTeam.roster.find((player) => player.id === playerId);
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

      const updatedTeams = teams.map((team) => {
        if (team.id !== userTeam.id) return team;
        return {
          ...team,
          roster: team.roster.map((player) => {
            if (player.id === swapSource.id) {
              return { ...player, division: targetDivision } as typeof player;
            }
            if (player.id === playerId) {
              return { ...player, division: sourceDivision } as typeof player;
            }
            return player;
          }),
        };
      });

      setTeams(updatedTeams);
      setMessage(`${sourcePlayer.name}와 ${targetPlayer.name}의 로테이션을 교체했습니다.`);
    } finally {
      setSwapSource(null);
      setIsSwapping(false);
    }
  }, [setTeams, swapSource, teams, userTeam]);

  const handlePromoteDemote = useCallback(async (playerId: string, currentDivision: Division) => {
    const newDivision: Division = currentDivision === 'main' ? 'sub' : 'main';

    setIsSwapping(true);
    try {
      await updatePlayerDivision(playerId, newDivision);

      const updatedTeams = teams.map((team) => {
        if (team.id !== userTeam.id) return team;
        return {
          ...team,
          roster: team.roster.map((player) => (
            player.id === playerId ? { ...player, division: newDivision } as typeof player : player
          )),
        };
      });

      setTeams(updatedTeams);
      const player = userTeam.roster.find((entry) => entry.id === playerId);
      setMessage(`${player?.name} 선수를 ${newDivision === 'main' ? '1군으로 승격' : '2군으로 이동'}했습니다.`);
    } finally {
      setSwapSource(null);
      setIsSwapping(false);
    }
  }, [setTeams, teams, userTeam]);

  const handlePlayStyleChange = useCallback(async (style: PlayStyle) => {
    await updateTeamPlayStyle(userTeam.id, style);
    const updatedTeams = teams.map((team) => (
      team.id === userTeam.id ? { ...team, playStyle: style } : team
    ));
    setTeams(updatedTeams);
    setMessage(`팀 운영 스타일을 "${PLAY_STYLE_INFO[style].name}"으로 변경했습니다.`);
  }, [setTeams, teams, userTeam.id]);

  const mainRoster = userTeam.roster.filter((player) => (player as { division?: string }).division === 'main');
  const subRoster = userTeam.roster.filter((player) => (player as { division?: string }).division === 'sub');

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
              <th>메카닉</th>
              <th>게임 센스</th>
              <th>팀워크</th>
              <th>안정감</th>
              <th>라인전</th>
              <th>공격성</th>
              <th>멘탈</th>
              <th>계약 종료</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {sortByPosition(players).map((player) => {
              const avgOvr = getOvr(player);
              const isSelected = swapSource?.id === player.id;

              return (
                <tr key={player.id} className={isSelected ? 'fm-table__row--selected' : ''}>
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
                      <Link to={`/manager/player/${player.id}`} className="fm-cell--name" style={{ textDecoration: 'none' }}>
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
                        title="교체 기준 선수로 선택"
                      >
                        {isSelected ? '취소' : '스왑'}
                      </button>
                      <button
                        className="fm-btn fm-btn--sm fm-btn--ghost"
                        onClick={() => handlePromoteDemote(player.id, division)}
                        disabled={isSwapping}
                        title={division === 'main' ? '2군으로 내리기' : '1군으로 올리기'}
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
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">팀 운영 스타일</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--3">
            {(Object.keys(PLAY_STYLE_INFO) as PlayStyle[]).map((style) => {
              const info = PLAY_STYLE_INFO[style];
              const isActive = userTeam.playStyle === style;

              return (
                <button
                  key={style}
                  className={`fm-card fm-card--clickable fm-flex-col fm-items-center fm-gap-xs ${isActive ? 'fm-card--highlight' : ''}`}
                  onClick={() => void handlePlayStyleChange(style)}
                >
                  <span className="fm-text-2xl">{info.icon}</span>
                  <span className="fm-text-lg fm-font-bold fm-text-primary">{info.name}</span>
                  <span className="fm-text-base fm-text-secondary fm-text-center" style={{ lineHeight: '1.4' }}>
                    {info.description}
                  </span>
                  <span className="fm-text-sm fm-text-muted fm-text-center fm-mt-sm">{info.matchup}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {swapSource && (
        <div className="fm-alert fm-alert--warning fm-mb-md">
          <span className="fm-alert__text">교체할 상대 선수를 선택해주세요. 1군과 2군 사이에서 바로 스왑할 수 있습니다.</span>
        </div>
      )}

      {message && (
        <div className="fm-alert fm-alert--success fm-mb-md">
          <span className="fm-alert__text">{message}</span>
        </div>
      )}

      {renderTable(mainRoster, '1군 로스터', 'main')}
      {subRoster.length > 0 && renderTable(subRoster, '2군 로스터', 'sub')}

      {subRoster.length === 0 && (
        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__header">
            <span className="fm-panel__title">2군 로스터 (0명)</span>
          </div>
          <div className="fm-panel__body">
            <p className="fm-text-muted fm-text-md">현재 2군에 등록된 선수가 없습니다.</p>
          </div>
        </div>
      )}
    </>
  );
}
