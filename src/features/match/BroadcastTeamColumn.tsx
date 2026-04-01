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

function getLevel(player: LivePlayerStat) {
  return Math.max(1, Math.min(18, 1 + Math.floor(player.cs / 28) + player.kills));
}

function getItemSlots(player: LivePlayerStat) {
  return Math.max(1, Math.min(6, Math.floor(player.goldEarned / 2500)));
}

function getChampionLabel(championId?: string) {
  if (!championId) return 'Draft';
  return CHAMPION_DB.find((champion) => champion.id === championId)?.nameKo ?? championId;
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
          <p>{Math.round(teamGold / 100) / 10}k team gold</p>
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
          const level = getLevel(player);

          return (
            <article
              key={player.playerId}
              className={`broadcast-player-card ${highlighted ? 'broadcast-player-card--highlight' : ''}`}
            >
              <div className="broadcast-player-card__identity">
                <div className="broadcast-player-card__avatar">
                  <span>{player.playerName.slice(0, 2).toUpperCase()}</span>
                  <strong>{level}</strong>
                </div>
                <div className="broadcast-player-card__meta">
                  <div className="broadcast-player-card__topline">
                    <span className="broadcast-player-card__position">{player.position.toUpperCase()}</span>
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
                <span>{mapState ? `${mapState.zone.replace(/_/g, ' ')} · ${mapState.activity}` : 'Tracking lane state'}</span>
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
