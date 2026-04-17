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
  const leadingTeam = goldDiff >= 0 ? homeTeamShortName : awayTeamShortName;
  const pulseLabel = activeFightCount >= 4 ? '교전 폭발 직전' : '운영 재정비';

  return (
    <section className="broadcast-hud">
      <div className="broadcast-hud__team broadcast-hud__team--home">
        <div className="broadcast-hud__team-head">
          <span className="broadcast-hud__badge">블루</span>
          <strong>{homeTeamShortName}</strong>
          <span className="broadcast-hud__series">{seriesScore.home}</span>
        </div>
        <div className="broadcast-hud__stats">
          <span>{Math.round(gameState.goldHome / 100) / 10}k</span>
          <span>{gameState.killsHome}킬</span>
          <span>{gameState.towersHome}타워</span>
          <span>{gameState.dragonsHome}용</span>
        </div>
        <div className="broadcast-hud__buffs">
          {gameState.baronHome ? <span className="broadcast-hud__buff">바론</span> : null}
          {gameState.dragonSoul.soulTeam === 'home' ? <span className="broadcast-hud__buff">용영혼</span> : null}
          {gameState.grubsHome > 0 ? <span className="broadcast-hud__buff">유충 {gameState.grubsHome}</span> : null}
        </div>
        <DragonPips
          count={gameState.dragonSoul.homeStacks}
          soulType={gameState.dragonSoul.soulTeam === 'home' ? gameState.dragonSoul.soulType : undefined}
        />
      </div>

      <div className="broadcast-hud__center">
        <div className="broadcast-hud__series-strip">
          <span>{currentGameNum}세트</span>
          <span>{phaseLabels[gameState.phase] ?? gameState.phase}</span>
          <span>{gameState.currentTick}:00</span>
          {replayMode ? <span className="broadcast-hud__replay-badge">리플레이 모드</span> : null}
        </div>
        <div className="broadcast-hud__scoreline">
          <span className="broadcast-hud__kills">{gameState.killsHome}</span>
          <span className="broadcast-hud__sep">:</span>
          <span className="broadcast-hud__kills">{gameState.killsAway}</span>
        </div>
        <div className="broadcast-hud__meta">
          <span>
            {leadingTeam} +{Math.abs(Math.round(goldDiff / 100)) / 10}k
          </span>
          <span>드래곤 {objectiveTimer(dragonObjective?.nextSpawnTick)}</span>
          <span>전령 {objectiveTimer(heraldObjective?.nextSpawnTick)}</span>
          <span>바론 {objectiveTimer(baronObjective?.nextSpawnTick)}</span>
        </div>
        <div className="broadcast-hud__winrate">
          <div className="broadcast-hud__winrate-bar">
            <div className="broadcast-hud__winrate-fill" style={{ width: `${winratePct}%` }} />
          </div>
          <div className="broadcast-hud__winrate-copy">
            <span>
              {homeTeamShortName} {winratePct}%
            </span>
            <span>
              {awayTeamShortName} {100 - winratePct}%
            </span>
          </div>
        </div>
        <div className="broadcast-hud__pulse">
          <span>{pulseLabel}</span>
          <span>{activeFightCount}명 교전 중</span>
          <span>{resetCount}명 귀환 중</span>
        </div>
        <div className="broadcast-hud__focus">
          {gameState.focusEvent
            ? `${gameState.focusEvent.label}: ${gameState.focusEvent.detail}`
            : '카메라가 다음 핵심 장면을 추적하고 있습니다.'}
        </div>
      </div>

      <div className="broadcast-hud__team broadcast-hud__team--away">
        <div className="broadcast-hud__team-head">
          <span className="broadcast-hud__series">{seriesScore.away}</span>
          <strong>{awayTeamShortName}</strong>
          <span className="broadcast-hud__badge">레드</span>
        </div>
        <div className="broadcast-hud__stats">
          <span>{Math.round(gameState.goldAway / 100) / 10}k</span>
          <span>{gameState.killsAway}킬</span>
          <span>{gameState.towersAway}타워</span>
          <span>{gameState.dragonsAway}용</span>
        </div>
        <div className="broadcast-hud__buffs">
          {gameState.baronAway ? <span className="broadcast-hud__buff">바론</span> : null}
          {gameState.dragonSoul.soulTeam === 'away' ? <span className="broadcast-hud__buff">용영혼</span> : null}
          {gameState.grubsAway > 0 ? <span className="broadcast-hud__buff">유충 {gameState.grubsAway}</span> : null}
        </div>
        <DragonPips
          count={gameState.dragonSoul.awayStacks}
          soulType={gameState.dragonSoul.soulTeam === 'away' ? gameState.dragonSoul.soulType : undefined}
        />
      </div>
    </section>
  );
}
