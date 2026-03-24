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
  infernal: '#e74c3c',
  ocean: '#3498db',
  mountain: '#a0522d',
  cloud: '#8e8e9e',
};

const DRAGON_LABELS: Record<DragonType, string> = {
  infernal: '화염',
  ocean: '바다',
  mountain: '대지',
  cloud: '바람',
};

function DragonStacks({
  stacks,
  hasSoul,
  soulType,
}: {
  stacks: number;
  hasSoul: boolean;
  soulType?: DragonType;
}) {
  const soulColor = soulType ? DRAGON_COLORS[soulType] : '#c89b3c';

  return (
    <div className="sb-dragon-stacks">
      <div className="sb-dragon-dots">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="sb-dragon-dot"
            style={{
              background: i < stacks ? soulColor : 'transparent',
              border: `2px solid ${i < stacks ? soulColor : 'var(--border)'}`,
              boxShadow: hasSoul && i < stacks ? `0 0 6px ${soulColor}` : 'none',
            }}
          />
        ))}
      </div>
      {hasSoul && soulType && (
        <span className="sb-dragon-soul-label" style={{ color: soulColor }}>
          {DRAGON_LABELS[soulType]} 소울
        </span>
      )}
    </div>
  );
}

function GrubCounter({ count }: { count: number }) {
  return (
    <span className="sb-grub-text">
      {'\uD83D\uDC1B'} {count}/6
    </span>
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
  const { dragonSoul } = gameState;
  const homeSoul = dragonSoul.soulTeam === 'home';
  const awaySoul = dragonSoul.soulTeam === 'away';

  return (
    <>
      {/* 상단: 시리즈 스코어 */}
      <div className="sb-series-bar">
        <span className="sb-series-team">{homeTeamShortName}</span>
        <span
          key={`${seriesScore.home}-${seriesScore.away}`}
          className="sb-series-score animate-pulse"
        >
          {seriesScore.home} - {seriesScore.away}
        </span>
        <span className="sb-series-team">{awayTeamShortName}</span>
        <span className="sb-game-num">SET {currentGameNum}</span>
      </div>

      {/* 스코어보드 */}
      <div className="sb-board">
        <div className="sb-team-score">
          <span className="sb-team-name sb-team-name--blue">
            {homeTeamShortName}
          </span>
          <div className="sb-stat-col">
            <span className="sb-big-stat">{gameState.killsHome}</span>
            <span className="sb-stat-label">킬</span>
          </div>
          <div className="sb-stat-col">
            <span className="sb-big-stat">{Math.round(gameState.goldHome / 100) / 10}k</span>
            <span className="sb-stat-label">골드</span>
          </div>
          <div className="sb-stat-col">
            <span className="sb-big-stat">{gameState.towersHome}</span>
            <span className="sb-stat-label">타워</span>
          </div>
          <div className="sb-stat-col">
            <span className="sb-big-stat">{gameState.dragonsHome}</span>
            <span className="sb-stat-label">드래곤</span>
          </div>
          <div className="sb-stat-col">
            <DragonStacks
              stacks={dragonSoul.homeStacks}
              hasSoul={homeSoul}
              soulType={dragonSoul.soulType}
            />
            <span className="sb-stat-label">소울</span>
          </div>
          <div className="sb-stat-col">
            <GrubCounter count={gameState.grubsHome} />
            <span className="sb-stat-label">그럽</span>
          </div>
        </div>

        <div className="sb-center-info">
          <span className="sb-time-display">{gameState.currentTick}:00</span>
          <span className="sb-phase-display">{phaseLabels[gameState.phase]}</span>
          <div className="sb-winrate-bar">
            <div
              className="sb-winrate-fill"
              style={{ width: `${Math.round(gameState.currentWinRate * 100)}%` }}
            />
          </div>
          <span className="sb-winrate-text">
            {Math.round(gameState.currentWinRate * 100)}% — {Math.round((1 - gameState.currentWinRate) * 100)}%
          </span>
        </div>

        <div className="sb-team-score">
          <span className="sb-team-name sb-team-name--red">
            {awayTeamShortName}
          </span>
          <div className="sb-stat-col">
            <span className="sb-big-stat">{gameState.killsAway}</span>
            <span className="sb-stat-label">킬</span>
          </div>
          <div className="sb-stat-col">
            <span className="sb-big-stat">{Math.round(gameState.goldAway / 100) / 10}k</span>
            <span className="sb-stat-label">골드</span>
          </div>
          <div className="sb-stat-col">
            <span className="sb-big-stat">{gameState.towersAway}</span>
            <span className="sb-stat-label">타워</span>
          </div>
          <div className="sb-stat-col">
            <span className="sb-big-stat">{gameState.dragonsAway}</span>
            <span className="sb-stat-label">드래곤</span>
          </div>
          <div className="sb-stat-col">
            <DragonStacks
              stacks={dragonSoul.awayStacks}
              hasSoul={awaySoul}
              soulType={dragonSoul.soulType}
            />
            <span className="sb-stat-label">소울</span>
          </div>
          <div className="sb-stat-col">
            <GrubCounter count={gameState.grubsAway} />
            <span className="sb-stat-label">그럽</span>
          </div>
        </div>
      </div>
    </>
  );
}
