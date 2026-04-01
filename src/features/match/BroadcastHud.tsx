import type { LiveGameState } from '../../engine/match/liveMatch';
import type { DragonType } from '../../types/match';
import './match.css';

interface BroadcastHudProps {
  gameState: LiveGameState;
  homeTeamShortName: string;
  awayTeamShortName: string;
  seriesScore: { home: number; away: number };
  currentGameNum: number;
  phaseLabels: Record<string, string>;
  replayMode?: boolean;
}

const DRAGON_COLORS: Record<DragonType, string> = {
  infernal: '#e76b4a',
  ocean: '#4aa9ff',
  mountain: '#a97853',
  cloud: '#a6b6d9',
};

function objectiveTimer(value?: number) {
  return value ? `${value}:00` : '--';
}

function DragonPips({ count, soulType }: { count: number; soulType?: DragonType }) {
  return (
    <div className="broadcast-hud__dragons">
      {[0, 1, 2, 3].map((index) => (
        <span
          key={index}
          className="broadcast-hud__dragon-dot"
          style={{
            background: index < count ? (soulType ? DRAGON_COLORS[soulType] : '#d7b86c') : 'transparent',
            borderColor: index < count ? (soulType ? DRAGON_COLORS[soulType] : '#d7b86c') : 'rgba(255,255,255,0.2)',
          }}
        />
      ))}
    </div>
  );
}

export function BroadcastHud({
  gameState,
  homeTeamShortName,
  awayTeamShortName,
  seriesScore,
  currentGameNum,
  phaseLabels,
  replayMode = false,
}: BroadcastHudProps) {
  const dragonObjective = gameState.objectiveStates.find((objective) => objective.key === 'dragon');
  const baronObjective = gameState.objectiveStates.find((objective) => objective.key === 'baron');
  const heraldObjective = gameState.objectiveStates.find((objective) => objective.key === 'herald');
  const goldDiff = gameState.goldHome - gameState.goldAway;
  const winratePct = Math.round(gameState.currentWinRate * 100);
  const activeFightCount = gameState.playerMapStates.filter((player) => player.activity === 'teamfight').length;
  const resetCount = gameState.playerMapStates.filter((player) => player.activity === 'reset').length;

  return (
    <section className="broadcast-hud">
      <div className="broadcast-hud__team broadcast-hud__team--home">
        <div className="broadcast-hud__team-head">
          <span className="broadcast-hud__badge">BLUE</span>
          <strong>{homeTeamShortName}</strong>
          <span className="broadcast-hud__series">{seriesScore.home}</span>
        </div>
        <div className="broadcast-hud__stats">
          <span>{Math.round(gameState.goldHome / 100) / 10}k</span>
          <span>{gameState.killsHome} K</span>
          <span>{gameState.towersHome} T</span>
          <span>{gameState.dragonsHome} D</span>
        </div>
        <div className="broadcast-hud__buffs">
          {gameState.baronHome ? <span className="broadcast-hud__buff">BARON</span> : null}
          {gameState.dragonSoul.soulTeam === 'home' ? <span className="broadcast-hud__buff">SOUL</span> : null}
          {gameState.grubsHome > 0 ? <span className="broadcast-hud__buff">GRUBS {gameState.grubsHome}</span> : null}
        </div>
        <DragonPips count={gameState.dragonSoul.homeStacks} soulType={gameState.dragonSoul.soulTeam === 'home' ? gameState.dragonSoul.soulType : undefined} />
      </div>

      <div className="broadcast-hud__center">
        <div className="broadcast-hud__series-strip">
          <span>SET {currentGameNum}</span>
          <span>{phaseLabels[gameState.phase]}</span>
          <span>{gameState.currentTick}:00</span>
          {replayMode ? <span className="broadcast-hud__replay-badge">Replay Mode</span> : null}
        </div>
        <div className="broadcast-hud__scoreline">
          <span className="broadcast-hud__kills">{gameState.killsHome}</span>
          <span className="broadcast-hud__sep">VS</span>
          <span className="broadcast-hud__kills">{gameState.killsAway}</span>
        </div>
        <div className="broadcast-hud__meta">
          <span>{goldDiff >= 0 ? homeTeamShortName : awayTeamShortName} +{Math.abs(Math.round(goldDiff / 100)) / 10}k</span>
          <span>DR {objectiveTimer(dragonObjective?.nextSpawnTick)}</span>
          <span>HD {objectiveTimer(heraldObjective?.nextSpawnTick)}</span>
          <span>BR {objectiveTimer(baronObjective?.nextSpawnTick)}</span>
        </div>
        <div className="broadcast-hud__winrate">
          <div className="broadcast-hud__winrate-bar">
            <div className="broadcast-hud__winrate-fill" style={{ width: `${winratePct}%` }} />
          </div>
          <div className="broadcast-hud__winrate-copy">
            <span>{homeTeamShortName} {winratePct}%</span>
            <span>{awayTeamShortName} {100 - winratePct}%</span>
          </div>
        </div>
        <div className="broadcast-hud__pulse">
          <span>{activeFightCount >= 4 ? 'LIVE FIGHT' : 'MAP RESET'}</span>
          <span>{activeFightCount} engaged</span>
          <span>{resetCount} basing</span>
        </div>
        <div className="broadcast-hud__focus">
          {gameState.focusEvent ? `${gameState.focusEvent.label}: ${gameState.focusEvent.detail}` : 'Camera sweeping for the next decisive setup.'}
        </div>
      </div>

      <div className="broadcast-hud__team broadcast-hud__team--away">
        <div className="broadcast-hud__team-head">
          <span className="broadcast-hud__series">{seriesScore.away}</span>
          <strong>{awayTeamShortName}</strong>
          <span className="broadcast-hud__badge">RED</span>
        </div>
        <div className="broadcast-hud__stats">
          <span>{Math.round(gameState.goldAway / 100) / 10}k</span>
          <span>{gameState.killsAway} K</span>
          <span>{gameState.towersAway} T</span>
          <span>{gameState.dragonsAway} D</span>
        </div>
        <div className="broadcast-hud__buffs">
          {gameState.baronAway ? <span className="broadcast-hud__buff">BARON</span> : null}
          {gameState.dragonSoul.soulTeam === 'away' ? <span className="broadcast-hud__buff">SOUL</span> : null}
          {gameState.grubsAway > 0 ? <span className="broadcast-hud__buff">GRUBS {gameState.grubsAway}</span> : null}
        </div>
        <DragonPips count={gameState.dragonSoul.awayStacks} soulType={gameState.dragonSoul.soulTeam === 'away' ? gameState.dragonSoul.soulType : undefined} />
      </div>
    </section>
  );
}
