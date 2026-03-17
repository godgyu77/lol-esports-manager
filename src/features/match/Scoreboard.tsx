import type React from 'react';
import type { LiveGameState } from '../../engine/match/liveMatch';

interface ScoreboardProps {
  gameState: LiveGameState;
  homeTeamShortName: string;
  awayTeamShortName: string;
  seriesScore: { home: number; away: number };
  currentGameNum: number;
  phaseLabels: Record<string, string>;
}

export function Scoreboard({
  gameState,
  homeTeamShortName,
  awayTeamShortName,
  seriesScore,
  currentGameNum,
  phaseLabels,
}: ScoreboardProps) {
  return (
    <>
      {/* 상단: 시리즈 스코어 */}
      <div style={styles.seriesBar}>
        <span style={styles.seriesTeam}>{homeTeamShortName}</span>
        <span
          key={`${seriesScore.home}-${seriesScore.away}`}
          className="animate-pulse"
          style={styles.seriesScore}
        >
          {seriesScore.home} - {seriesScore.away}
        </span>
        <span style={styles.seriesTeam}>{awayTeamShortName}</span>
        <span style={styles.gameNum}>SET {currentGameNum}</span>
      </div>

      {/* 스코어보드 */}
      <div style={styles.scoreboard}>
        <div style={styles.teamScore}>
          <span style={{ ...styles.scoreTeamName, color: '#3498db' }}>
            {homeTeamShortName}
          </span>
          <div style={styles.statColumn}>
            <span style={styles.bigStat}>{gameState.killsHome}</span>
            <span style={styles.statLabel}>킬</span>
          </div>
          <div style={styles.statColumn}>
            <span style={styles.bigStat}>{Math.round(gameState.goldHome / 100) / 10}k</span>
            <span style={styles.statLabel}>골드</span>
          </div>
          <div style={styles.statColumn}>
            <span style={styles.bigStat}>{gameState.towersHome}</span>
            <span style={styles.statLabel}>타워</span>
          </div>
          <div style={styles.statColumn}>
            <span style={styles.bigStat}>{gameState.dragonsHome}</span>
            <span style={styles.statLabel}>드래곤</span>
          </div>
        </div>

        <div style={styles.centerInfo}>
          <span style={styles.timeDisplay}>{gameState.currentTick}:00</span>
          <span style={styles.phaseDisplay}>{phaseLabels[gameState.phase]}</span>
          <div style={styles.winRateBar}>
            <div
              style={{
                ...styles.winRateFill,
                width: `${Math.round(gameState.currentWinRate * 100)}%`,
              }}
            />
          </div>
          <span style={styles.winRateText}>
            {Math.round(gameState.currentWinRate * 100)}% — {Math.round((1 - gameState.currentWinRate) * 100)}%
          </span>
        </div>

        <div style={styles.teamScore}>
          <span style={{ ...styles.scoreTeamName, color: '#e74c3c' }}>
            {awayTeamShortName}
          </span>
          <div style={styles.statColumn}>
            <span style={styles.bigStat}>{gameState.killsAway}</span>
            <span style={styles.statLabel}>킬</span>
          </div>
          <div style={styles.statColumn}>
            <span style={styles.bigStat}>{Math.round(gameState.goldAway / 100) / 10}k</span>
            <span style={styles.statLabel}>골드</span>
          </div>
          <div style={styles.statColumn}>
            <span style={styles.bigStat}>{gameState.towersAway}</span>
            <span style={styles.statLabel}>타워</span>
          </div>
          <div style={styles.statColumn}>
            <span style={styles.bigStat}>{gameState.dragonsAway}</span>
            <span style={styles.statLabel}>드래곤</span>
          </div>
        </div>
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  seriesBar: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '20px',
    padding: '10px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  seriesTeam: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#f0e6d2',
  },
  seriesScore: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#c89b3c',
  },
  gameNum: {
    fontSize: '12px',
    color: '#6a6a7a',
    marginLeft: 'auto',
  },
  scoreboard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    background: 'linear-gradient(135deg, #1a1a3a 0%, #12122a 100%)',
    border: '1px solid #2a2a4a',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
  },
  teamScore: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  scoreTeamName: {
    fontSize: '14px',
    fontWeight: 700,
  },
  statColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
  },
  bigStat: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#f0e6d2',
  },
  statLabel: {
    fontSize: '10px',
    color: '#6a6a7a',
  },
  centerInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    flex: 1,
  },
  timeDisplay: {
    fontSize: '32px',
    fontWeight: 800,
    color: '#f0e6d2',
    fontFamily: 'monospace',
  },
  phaseDisplay: {
    fontSize: '12px',
    color: '#c89b3c',
    fontWeight: 600,
  },
  winRateBar: {
    width: '200px',
    height: '6px',
    background: '#e74c3c44',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  winRateFill: {
    height: '100%',
    background: '#3498db',
    borderRadius: '3px',
    transition: 'width 0.3s',
  },
  winRateText: {
    fontSize: '11px',
    color: '#6a6a7a',
  },
};
