/**
 * LCK 방송 스타일 경기 후 통계 화면
 * - Game Stats: KDA, 골드, 타워, 드래곤, 바론
 * - Total Damage Dealt: 선수별 가로 바 차트
 * - Gold Difference: 시간대별 골드 차이 그래프
 */

import type { GameResult, PlayerGameStatLine } from '../../engine/match/matchSimulator';
import type { DragonType } from '../../types/match';

const DRAGON_ICONS: Record<DragonType, string> = {
  infernal: '🔥', ocean: '🌊', mountain: '⛰️', cloud: '💨',
};

const POS_LABELS: Record<string, string> = {
  top: 'TOP', jungle: 'JGL', mid: 'MID', adc: 'ADC', support: 'SUP',
};

function formatGold(gold: number): string {
  return `${(gold / 1000).toFixed(1)}k`;
}

interface PostGameStatsProps {
  gameResult: GameResult;
  homeTeamName: string;
  awayTeamName: string;
  gameNumber: number;
}

export function PostGameStats({
  gameResult,
  homeTeamName,
  awayTeamName,
  gameNumber,
}: PostGameStatsProps) {
  const r = gameResult;
  const isHomeWin = r.winnerSide === 'home';

  // KDA 합산
  const sumKda = (stats: PlayerGameStatLine[]) => {
    let k = 0, d = 0, a = 0;
    for (const s of stats) { k += s.kills; d += s.deaths; a += s.assists; }
    return { k, d, a };
  };
  const homeKda = sumKda(r.playerStatsHome);
  const awayKda = sumKda(r.playerStatsAway);

  // 바론 카운트 (이벤트에서)
  const baronHome = r.events.filter(e => e.type === 'baron' && e.side === 'home').length;
  const baronAway = r.events.filter(e => e.type === 'baron' && e.side === 'away').length;

  // 헤럴드 카운트
  const heraldHome = r.events.filter(e => e.type === 'rift_herald' && e.side === 'home').length;
  const heraldAway = r.events.filter(e => e.type === 'rift_herald' && e.side === 'away').length;

  // 데미지 최대값 (바 차트 스케일)
  const allDmg = [...r.playerStatsHome, ...r.playerStatsAway].map(s => s.damageDealt);
  const maxDmg = Math.max(...allDmg, 1);

  // 골드 히스토리 SVG
  const goldHistory = r.goldHistory ?? [];
  const maxAbsDiff = Math.max(...goldHistory.map(g => Math.abs(g.diff)), 1000);

  return (
    <div className="pgs-container">
      {/* 헤더 */}
      <div className="pgs-header">
        <div className={`pgs-team-name ${isHomeWin ? '' : 'pgs-team-name--loss'}`}>
          {homeTeamName}
        </div>
        <div className="pgs-score-center">
          <span className="pgs-game-label">GAME {gameNumber}</span>
          <span className="pgs-game-time">{r.durationMinutes}:{((r.durationMinutes * 7) % 60).toString().padStart(2, '0')}</span>
          <span className={`pgs-result ${isHomeWin ? 'pgs-result--loss' : 'pgs-result--win'}`}>
            {isHomeWin ? 'LOSS' : 'WIN'}
          </span>
        </div>
        <div className={`pgs-team-name ${isHomeWin ? 'pgs-team-name--loss' : ''}`}>
          {awayTeamName}
        </div>
      </div>

      <div className="pgs-body">
        {/* 좌: Game Stats */}
        <div className="pgs-stats-panel">
          <h4 className="pgs-section-title">GAME STATS</h4>
          <div className="pgs-stat-row">
            <span className="pgs-stat-home">{homeKda.k}/{homeKda.d}/{homeKda.a}</span>
            <span className="pgs-stat-label">KDA</span>
            <span className="pgs-stat-away">{awayKda.k}/{awayKda.d}/{awayKda.a}</span>
          </div>
          <div className="pgs-stat-row">
            <span className="pgs-stat-home">{formatGold(r.goldHome ?? 0)}</span>
            <span className="pgs-stat-label">GOLD</span>
            <span className="pgs-stat-away">{formatGold(r.goldAway ?? 0)}</span>
          </div>
          <div className="pgs-stat-row">
            <span className="pgs-stat-home">{r.towersHome ?? 0}</span>
            <span className="pgs-stat-label">TOWERS</span>
            <span className="pgs-stat-away">{r.towersAway ?? 0}</span>
          </div>
          <div className="pgs-stat-row">
            <span className="pgs-stat-home">{r.grubsHome}</span>
            <span className="pgs-stat-label">GRUBS</span>
            <span className="pgs-stat-away">{r.grubsAway}</span>
          </div>
          <div className="pgs-stat-row">
            <span className="pgs-stat-home">{heraldHome}</span>
            <span className="pgs-stat-label">HERALDS</span>
            <span className="pgs-stat-away">{heraldAway}</span>
          </div>
          <div className="pgs-stat-row">
            <span className="pgs-stat-home">
              {r.dragonSoul.dragonTypes.filter(d => d.side === 'home').map(d => DRAGON_ICONS[d.type]).join('')}
            </span>
            <span className="pgs-stat-label">DRAKES</span>
            <span className="pgs-stat-away">
              {r.dragonSoul.dragonTypes.filter(d => d.side === 'away').map(d => DRAGON_ICONS[d.type]).join('')}
            </span>
          </div>
          <div className="pgs-stat-row">
            <span className="pgs-stat-home">{baronHome}</span>
            <span className="pgs-stat-label">BARONS</span>
            <span className="pgs-stat-away">{baronAway}</span>
          </div>
        </div>

        {/* 우: 데미지 차트 + 골드 그래프 */}
        <div className="pgs-charts-panel">
          <h4 className="pgs-section-title">TOTAL DAMAGE DEALT</h4>
          <div className="pgs-dmg-chart">
            {r.playerStatsHome.map((s, i) => {
              const away = r.playerStatsAway[i];
              return (
                <div key={i} className="pgs-dmg-row">
                  <div className="pgs-dmg-player pgs-dmg-player--home">
                    <span className="pgs-dmg-pos">{POS_LABELS[s.position]}</span>
                    <div className="pgs-dmg-bar-wrap pgs-dmg-bar-wrap--home">
                      <div
                        className="pgs-dmg-bar pgs-dmg-bar--home"
                        style={{ width: `${(s.damageDealt / maxDmg) * 100}%` }}
                      />
                      <span className="pgs-dmg-val">{formatGold(s.damageDealt)}</span>
                    </div>
                  </div>
                  <div className="pgs-dmg-player pgs-dmg-player--away">
                    <div className="pgs-dmg-bar-wrap pgs-dmg-bar-wrap--away">
                      <div
                        className="pgs-dmg-bar pgs-dmg-bar--away"
                        style={{ width: `${((away?.damageDealt ?? 0) / maxDmg) * 100}%` }}
                      />
                      <span className="pgs-dmg-val">{formatGold(away?.damageDealt ?? 0)}</span>
                    </div>
                    <span className="pgs-dmg-pos">{POS_LABELS[away?.position ?? '']}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 골드 차이 그래프 (SVG) */}
          {goldHistory.length > 0 && (
            <>
              <h4 className="pgs-section-title" style={{ marginTop: 12 }}>GOLD DIFFERENCE</h4>
              <div className="pgs-gold-graph">
                <svg viewBox="0 0 300 100" className="pgs-gold-svg">
                  {/* 중앙선 (0차이) */}
                  <line x1="0" y1="50" x2="300" y2="50" stroke="#333" strokeWidth="0.5" />
                  {/* 골드 차이 라인 */}
                  <polyline
                    fill="none"
                    stroke="#c89b3c"
                    strokeWidth="1.5"
                    points={goldHistory.map((g, i) => {
                      const x = (i / Math.max(goldHistory.length - 1, 1)) * 300;
                      const y = 50 - (g.diff / maxAbsDiff) * 45;
                      return `${x},${y}`;
                    }).join(' ')}
                  />
                  {/* 영역 채우기 */}
                  <polygon
                    fill="rgba(52, 152, 219, 0.15)"
                    points={`0,50 ${goldHistory.map((g, i) => {
                      const x = (i / Math.max(goldHistory.length - 1, 1)) * 300;
                      const y = 50 - (g.diff / maxAbsDiff) * 45;
                      return `${x},${y}`;
                    }).join(' ')} 300,50`}
                  />
                  {/* 시간 라벨 */}
                  {[5, 10, 15, 20, 25, 30].filter(t => t <= r.durationMinutes).map(t => {
                    const x = (t / r.durationMinutes) * 300;
                    return (
                      <text key={t} x={x} y="98" fill="#666" fontSize="7" textAnchor="middle">{t}</text>
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
