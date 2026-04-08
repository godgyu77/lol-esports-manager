import type { LiveGameState, LivePlayerStat } from '../../engine/match/liveMatch';
import { CHAMPION_DB } from '../../data/championDb';
import './match.css';

interface BroadcastTeamColumnProps {
  title: string;
  side: 'home' | 'away';
  playerStats: LivePlayerStat[];
  gameState: LiveGameState;
}

function getMomentum(player: LivePlayerStat, highlighted: boolean) {
  const base = player.form + player.kills * 6 - player.deaths * 5 + (highlighted ? 10 : 0);
  return Math.max(10, Math.min(100, base));
}

function getItemSlots(player: LivePlayerStat) {
  return Math.max(1, Math.min(6, Math.floor(player.goldEarned / 2500)));
}

function getChampionLabel(championId?: string) {
  if (!championId) return '드래프트 미확정';
  return CHAMPION_DB.find((champion) => champion.id === championId)?.nameKo ?? championId;
}

function getZoneLabel(zone: string) {
  const labels: Record<string, string> = {
    home_base: '블루 본진',
    away_base: '레드 본진',
    top_lane: '탑 라인',
    mid_lane: '미드 라인',
    bot_lane: '봇 라인',
    top_river: '탑 강가',
    mid_river: '중앙 강가',
    bot_river: '봇 강가',
    home_jungle: '블루 정글',
    away_jungle: '레드 정글',
    dragon_pit: '드래곤 둥지',
    baron_pit: '바론 둥지',
    center: '중앙',
  };
  return labels[zone] ?? zone.replace(/_/g, ' ');
}

function getActivityLabel(activity: string) {
  const labels: Record<string, string> = {
    laning: '라인전',
    rotating: '합류 중',
    farming: '파밍',
    objective: '오브젝트 압박',
    teamfight: '팀 교전',
    reset: '정비 중',
  };
  return labels[activity] ?? activity;
}

function getPositionLabel(position: string) {
  const labels: Record<string, string> = {
    top: '탑',
    jungle: '정글',
    mid: '미드',
    adc: '원딜',
    support: '서포터',
  };
  return labels[position] ?? position.toUpperCase();
}

export function BroadcastTeamColumn({
  title,
  side,
  playerStats,
  gameState,
}: BroadcastTeamColumnProps) {
  const teamGold = side === 'home' ? gameState.goldHome : gameState.goldAway;
  const enemyGold = side === 'home' ? gameState.goldAway : gameState.goldHome;

  return (
    <section className={`broadcast-team-column broadcast-team-column--${side}`}>
      <header className="broadcast-team-column__header">
        <div>
          <h3>{title}</h3>
          <p>팀 골드 {Math.round(teamGold / 100) / 10}k</p>
        </div>
        <span className={`broadcast-team-column__lead ${teamGold >= enemyGold ? 'is-leading' : ''}`}>
          {teamGold >= enemyGold ? `+${Math.round((teamGold - enemyGold) / 100) / 10}k` : `${Math.round((teamGold - enemyGold) / 100) / 10}k`}
        </span>
      </header>

      <div className="broadcast-team-column__players">
        {playerStats.map((player) => {
          const mapState = gameState.playerMapStates.find((entry) => entry.playerId === player.playerId);
          const highlighted = Boolean(mapState?.highlight);
          const momentum = getMomentum(player, highlighted);
          const itemSlots = getItemSlots(player);

          return (
            <article
              key={player.playerId}
              className={`broadcast-player-card ${highlighted ? 'broadcast-player-card--highlight' : ''}`}
            >
              <div className="broadcast-player-card__identity">
                <div className="broadcast-player-card__avatar">
                  <span>{player.playerName.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="broadcast-player-card__meta">
                  <div className="broadcast-player-card__topline">
                    <span className="broadcast-player-card__position">{getPositionLabel(player.position)}</span>
                    <span className="broadcast-player-card__champion">{getChampionLabel(player.championId)}</span>
                  </div>
                  <strong className="broadcast-player-card__name">{player.playerName}</strong>
                  <span className="broadcast-player-card__kda">
                    {player.kills}/{player.deaths}/{player.assists} KDA · {player.cs} CS
                  </span>
                </div>
              </div>

              <div className="broadcast-player-card__status">
                <div className="broadcast-player-card__bar">
                  <div className="broadcast-player-card__bar-fill" style={{ width: `${momentum}%` }} />
                </div>
                <span>
                  {mapState ? `${getZoneLabel(mapState.zone)} · ${getActivityLabel(mapState.activity)}` : '전장 위치 추적 중'}
                </span>
              </div>

              <div className="broadcast-player-card__footer">
                <div className="broadcast-player-card__items">
                  {Array.from({ length: 6 }, (_, index) => (
                    <span
                      key={`${player.playerId}-item-${index}`}
                      className={`broadcast-player-card__item ${index < itemSlots ? 'is-filled' : ''}`}
                    />
                  ))}
                </div>
                <span className="broadcast-player-card__gold">{Math.round(player.goldEarned / 100) / 10}k</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
