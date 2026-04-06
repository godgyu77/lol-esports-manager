import type { GameResult, PlayerGameStatLine } from '../../engine/match/matchSimulator';
import type { PostMatchInsightReport } from '../../engine/analysis/postMatchInsightEngine';
import type { DragonType } from '../../types/match';

const DRAGON_ICONS: Record<DragonType, string> = {
  infernal: 'F',
  ocean: 'O',
  mountain: 'M',
  cloud: 'C',
};

const POSITION_LABELS: Record<string, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: '원딜',
  support: '서포터',
};

const IMPACT_LABELS: Record<string, string> = {
  high: '핵심',
  medium: '중요',
  low: '참고',
};

function formatGold(value: number): string {
  return `${(value / 1000).toFixed(1)}k`;
}

function sumKda(stats: PlayerGameStatLine[]) {
  return stats.reduce(
    (acc, player) => {
      acc.k += player.kills;
      acc.d += player.deaths;
      acc.a += player.assists;
      return acc;
    },
    { k: 0, d: 0, a: 0 },
  );
}

interface PostGameStatsProps {
  gameResult: GameResult;
  homeTeamName: string;
  awayTeamName: string;
  gameNumber: number;
  insightReport?: PostMatchInsightReport;
}

export function PostGameStats({
  gameResult,
  homeTeamName,
  awayTeamName,
  gameNumber,
  insightReport,
}: PostGameStatsProps) {
  const isHomeWin = gameResult.winnerSide === 'home';
  const homeKda = sumKda(gameResult.playerStatsHome);
  const awayKda = sumKda(gameResult.playerStatsAway);
  const baronHome = gameResult.events.filter((event) => event.type === 'baron' && event.side === 'home').length;
  const baronAway = gameResult.events.filter((event) => event.type === 'baron' && event.side === 'away').length;
  const heraldHome = gameResult.events.filter((event) => event.type === 'rift_herald' && event.side === 'home').length;
  const heraldAway = gameResult.events.filter((event) => event.type === 'rift_herald' && event.side === 'away').length;
  const allDamage = [...gameResult.playerStatsHome, ...gameResult.playerStatsAway].map((player) => player.damageDealt);
  const maxDamage = Math.max(...allDamage, 1);
  const goldHistory = gameResult.goldHistory ?? [];
  const maxAbsDiff = Math.max(...goldHistory.map((point) => Math.abs(point.diff)), 1000);

  return (
    <div className="pgs-container">
      <div className="pgs-header">
        <div className={`pgs-team-name ${isHomeWin ? '' : 'pgs-team-name--loss'}`}>{homeTeamName}</div>
        <div className="pgs-score-center">
          <span className="pgs-game-label">{gameNumber}세트</span>
          <span className="pgs-game-time">
            {gameResult.durationMinutes}:{((gameResult.durationMinutes * 7) % 60).toString().padStart(2, '0')}
          </span>
          <span className={`pgs-result ${isHomeWin ? 'pgs-result--win' : 'pgs-result--loss'}`}>
            {isHomeWin ? '블루 승리' : '레드 승리'}
          </span>
        </div>
        <div className={`pgs-team-name ${isHomeWin ? 'pgs-team-name--loss' : ''}`}>{awayTeamName}</div>
      </div>

      {insightReport && (
        <div className="pgs-insight-panel">
          <div className="pgs-insight-summary">
            <span className="pgs-section-title">{insightReport.outcomeLabel}</span>
            <h4 className="pgs-insight-headline">{insightReport.headline}</h4>
          </div>
          <div className="pgs-insight-grid">
            {insightReport.reasons.map((reason) => (
              <div
                key={`${reason.title}-${reason.nextAction}`}
                className={`pgs-insight-card pgs-insight-card--${reason.impact}`}
              >
                <div className="pgs-insight-card__top">
                  <span className="pgs-insight-impact">{IMPACT_LABELS[reason.impact] ?? '참고'}</span>
                  <span className="pgs-insight-title">{reason.title}</span>
                </div>
                <p className="pgs-insight-copy">{reason.summary}</p>
                <span className="pgs-insight-action">다음 조정 제안: {reason.nextAction}</span>
              </div>
            ))}
          </div>
          <div className="pgs-action-row">
            {insightReport.recommendedActions.map((action) => (
              <span key={action} className="pgs-action-pill">
                {action}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="pgs-body">
        <div className="pgs-stats-panel">
          <h4 className="pgs-section-title">경기 지표</h4>
          <div className="pgs-stat-row">
            <span className="pgs-stat-home">
              {homeKda.k}/{homeKda.d}/{homeKda.a}
            </span>
            <span className="pgs-stat-label">KDA</span>
            <span className="pgs-stat-away">
              {awayKda.k}/{awayKda.d}/{awayKda.a}
            </span>
          </div>
          <div className="pgs-stat-row">
            <span className="pgs-stat-home">{formatGold(gameResult.goldHome ?? 0)}</span>
            <span className="pgs-stat-label">골드</span>
            <span className="pgs-stat-away">{formatGold(gameResult.goldAway ?? 0)}</span>
          </div>
          <div className="pgs-stat-row">
            <span className="pgs-stat-home">{gameResult.towersHome ?? 0}</span>
            <span className="pgs-stat-label">타워</span>
            <span className="pgs-stat-away">{gameResult.towersAway ?? 0}</span>
          </div>
          <div className="pgs-stat-row">
            <span className="pgs-stat-home">{gameResult.grubsHome}</span>
            <span className="pgs-stat-label">유충</span>
            <span className="pgs-stat-away">{gameResult.grubsAway}</span>
          </div>
          <div className="pgs-stat-row">
            <span className="pgs-stat-home">{heraldHome}</span>
            <span className="pgs-stat-label">전령</span>
            <span className="pgs-stat-away">{heraldAway}</span>
          </div>
          <div className="pgs-stat-row">
            <span className="pgs-stat-home">
              {gameResult.dragonSoul.dragonTypes
                .filter((dragon) => dragon.side === 'home')
                .map((dragon) => DRAGON_ICONS[dragon.type])
                .join(' ')}
            </span>
            <span className="pgs-stat-label">드래곤</span>
            <span className="pgs-stat-away">
              {gameResult.dragonSoul.dragonTypes
                .filter((dragon) => dragon.side === 'away')
                .map((dragon) => DRAGON_ICONS[dragon.type])
                .join(' ')}
            </span>
          </div>
          <div className="pgs-stat-row">
            <span className="pgs-stat-home">{baronHome}</span>
            <span className="pgs-stat-label">바론</span>
            <span className="pgs-stat-away">{baronAway}</span>
          </div>
        </div>

        <div className="pgs-charts-panel">
          <h4 className="pgs-section-title">총 피해량</h4>
          <div className="pgs-dmg-chart">
            {gameResult.playerStatsHome.map((player, index) => {
              const awayPlayer = gameResult.playerStatsAway[index];

              return (
                <div key={player.playerId} className="pgs-dmg-row">
                  <div className="pgs-dmg-player pgs-dmg-player--home">
                    <span className="pgs-dmg-pos">{POSITION_LABELS[player.position] ?? '-'}</span>
                    <div className="pgs-dmg-bar-wrap pgs-dmg-bar-wrap--home">
                      <div
                        className="pgs-dmg-bar pgs-dmg-bar--home"
                        style={{ width: `${(player.damageDealt / maxDamage) * 100}%` }}
                      />
                      <span className="pgs-dmg-val">{formatGold(player.damageDealt)}</span>
                    </div>
                  </div>
                  <div className="pgs-dmg-player pgs-dmg-player--away">
                    <div className="pgs-dmg-bar-wrap pgs-dmg-bar-wrap--away">
                      <div
                        className="pgs-dmg-bar pgs-dmg-bar--away"
                        style={{ width: `${((awayPlayer?.damageDealt ?? 0) / maxDamage) * 100}%` }}
                      />
                      <span className="pgs-dmg-val">{formatGold(awayPlayer?.damageDealt ?? 0)}</span>
                    </div>
                    <span className="pgs-dmg-pos">{POSITION_LABELS[awayPlayer?.position ?? ''] ?? '-'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {goldHistory.length > 0 && (
            <>
              <h4 className="pgs-section-title" style={{ marginTop: 12 }}>
                골드 차이
              </h4>
              <div className="pgs-gold-graph">
                <svg viewBox="0 0 300 100" className="pgs-gold-svg">
                  <line x1="0" y1="50" x2="300" y2="50" stroke="#333" strokeWidth="0.5" />
                  <polyline
                    fill="none"
                    stroke="#c89b3c"
                    strokeWidth="1.5"
                    points={goldHistory
                      .map((point, index) => {
                        const x = (index / Math.max(goldHistory.length - 1, 1)) * 300;
                        const y = 50 - (point.diff / maxAbsDiff) * 45;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                  <polygon
                    fill="rgba(52, 152, 219, 0.15)"
                    points={`0,50 ${goldHistory
                      .map((point, index) => {
                        const x = (index / Math.max(goldHistory.length - 1, 1)) * 300;
                        const y = 50 - (point.diff / maxAbsDiff) * 45;
                        return `${x},${y}`;
                      })
                      .join(' ')} 300,50`}
                  />
                  {[5, 10, 15, 20, 25, 30]
                    .filter((tick) => tick <= gameResult.durationMinutes)
                    .map((tick) => {
                      const x = (tick / gameResult.durationMinutes) * 300;
                      return (
                        <text key={tick} x={x} y="98" fill="#666" fontSize="7" textAnchor="middle">
                          {tick}
                        </text>
                      );
                    })}
                </svg>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
