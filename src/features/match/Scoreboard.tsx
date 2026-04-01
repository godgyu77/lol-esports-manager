import type { LiveGameState } from '../../engine/match/liveMatch';
import type { DragonType } from '../../types/match';
import './match.css';

interface ScoreboardProps {
  gameState: LiveGameState;
  homeTeamShortName: string;
  awayTeamShortName: string;
  seriesScore: { home: number; away: number };
  currentGameNum: number;
  phaseLabels: Record<string, string>;
}

const DRAGON_COLORS: Record<DragonType, string> = {
  infernal: '#e76b4a',
  ocean: '#4aa9ff',
  mountain: '#a97853',
  cloud: '#a6b6d9',
};

const DRAGON_LABELS: Record<DragonType, string> = {
  infernal: '화염',
  ocean: '바다',
  mountain: '대지',
  cloud: '바람',
};

function formatObjectiveTimer(tick?: number): string {
  if (!tick) return '확보';
  return `${tick}:00`;
}

function DragonStacks({ stacks, soulType }: { stacks: number; soulType?: DragonType }) {
  const soulColor = soulType ? DRAGON_COLORS[soulType] : 'rgba(255,255,255,0.2)';
  return (
    <div className="sb-dragon-stacks">
      <div className="sb-dragon-dots">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="sb-dragon-dot"
            style={{
              background: index < stacks ? soulColor : 'transparent',
              border: `2px solid ${index < stacks ? soulColor : 'var(--border)'}`,
              boxShadow: index < stacks && soulType ? `0 0 8px ${soulColor}` : 'none',
            }}
          />
        ))}
      </div>
      <span className="sb-dragon-soul-label" style={{ color: soulType ? soulColor : 'var(--text-muted)' }}>
        {soulType ? `${DRAGON_LABELS[soulType]} 소울` : `${stacks}/4`}
      </span>
    </div>
  );
}

export function Scoreboard({
  gameState,
  homeTeamShortName,
  awayTeamShortName,
  seriesScore,
  currentGameNum,
  phaseLabels,
}: ScoreboardProps) {
  const dragonObjective = gameState.objectiveStates.find((objective) => objective.key === 'dragon');
  const baronObjective = gameState.objectiveStates.find((objective) => objective.key === 'baron');
  const heraldObjective = gameState.objectiveStates.find((objective) => objective.key === 'herald');

  return (
    <>
      <div className="sb-series-bar">
        <span className="sb-series-team">{homeTeamShortName}</span>
        <span className="sb-series-score">{seriesScore.home} - {seriesScore.away}</span>
        <span className="sb-series-team">{awayTeamShortName}</span>
        <span className="sb-game-num">SET {currentGameNum}</span>
      </div>

      <div className="sb-board">
        <div className="sb-team-score">
          <span className="sb-team-name sb-team-name--blue">{homeTeamShortName}</span>
          <div className="sb-stat-col"><span className="sb-big-stat">{gameState.killsHome}</span><span className="sb-stat-label">킬</span></div>
          <div className="sb-stat-col"><span className="sb-big-stat">{Math.round(gameState.goldHome / 100) / 10}k</span><span className="sb-stat-label">골드</span></div>
          <div className="sb-stat-col"><span className="sb-big-stat">{gameState.towersHome}</span><span className="sb-stat-label">타워</span></div>
          <div className="sb-stat-col"><span className="sb-big-stat">{gameState.dragonsHome}</span><span className="sb-stat-label">드래곤</span></div>
          <div className="sb-stat-col"><DragonStacks stacks={gameState.dragonSoul.homeStacks} soulType={gameState.dragonSoul.soulTeam === 'home' ? gameState.dragonSoul.soulType : undefined} /><span className="sb-stat-label">소울</span></div>
          <div className="sb-stat-col"><span className="sb-grub-text">그럽 {gameState.grubsHome}</span><span className="sb-stat-label">상단 오브젝트</span></div>
        </div>

        <div className="sb-center-info">
          <span className="sb-time-display">{gameState.currentTick}:00</span>
          <span className="sb-phase-display">{phaseLabels[gameState.phase]}</span>
          <div className="sb-winrate-bar">
            <div className="sb-winrate-fill" style={{ width: `${Math.round(gameState.currentWinRate * 100)}%` }} />
          </div>
          <span className="sb-winrate-text">블루 {Math.round(gameState.currentWinRate * 100)}% | 레드 {Math.round((1 - gameState.currentWinRate) * 100)}%</span>
          <div className="sb-objective-timers">
            <span>드래곤 {formatObjectiveTimer(dragonObjective?.nextSpawnTick)}</span>
            <span>전령 {formatObjectiveTimer(heraldObjective?.nextSpawnTick)}</span>
            <span>바론 {formatObjectiveTimer(baronObjective?.nextSpawnTick)}</span>
          </div>
        </div>

        <div className="sb-team-score">
          <span className="sb-team-name sb-team-name--red">{awayTeamShortName}</span>
          <div className="sb-stat-col"><span className="sb-big-stat">{gameState.killsAway}</span><span className="sb-stat-label">킬</span></div>
          <div className="sb-stat-col"><span className="sb-big-stat">{Math.round(gameState.goldAway / 100) / 10}k</span><span className="sb-stat-label">골드</span></div>
          <div className="sb-stat-col"><span className="sb-big-stat">{gameState.towersAway}</span><span className="sb-stat-label">타워</span></div>
          <div className="sb-stat-col"><span className="sb-big-stat">{gameState.dragonsAway}</span><span className="sb-stat-label">드래곤</span></div>
          <div className="sb-stat-col"><DragonStacks stacks={gameState.dragonSoul.awayStacks} soulType={gameState.dragonSoul.soulTeam === 'away' ? gameState.dragonSoul.soulType : undefined} /><span className="sb-stat-label">소울</span></div>
          <div className="sb-stat-col"><span className="sb-grub-text">그럽 {gameState.grubsAway}</span><span className="sb-stat-label">상단 오브젝트</span></div>
        </div>
      </div>
    </>
  );
}
