import type { GameResult, PlayerGameStatLine } from '../../engine/match/matchSimulator';
import type { PostMatchInsightReport } from '../../engine/analysis/postMatchInsightEngine';
import type { DragonType } from '../../types/match';
import { useNavigate } from 'react-router-dom';
import { getFollowUpRoute } from './postMatchFollowUp';

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

const FOLLOW_UP_LABELS: Record<string, string> = {
  high: '우선',
  medium: '다음',
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

function buildEmotionalSummary(gameResult: GameResult, homeTeamName: string, awayTeamName: string) {
  const isHomeWin = gameResult.winnerSide === 'home';
  const winnerName = isHomeWin ? homeTeamName : awayTeamName;
  const loserName = isHomeWin ? awayTeamName : homeTeamName;
  const killGap = Math.abs(gameResult.killsHome - gameResult.killsAway);
  const towerGap = Math.abs((gameResult.towersHome ?? 0) - (gameResult.towersAway ?? 0));
  const goldGap = Math.abs((gameResult.goldHome ?? 0) - (gameResult.goldAway ?? 0));

  if (killGap >= 8 || towerGap >= 5) {
    return {
      label: isHomeWin ? '완승의 흐름' : '무너진 흐름',
      title: isHomeWin ? `${winnerName}이 경기 전체를 지배했습니다` : `${loserName}이 흐름을 끝내 되찾지 못했습니다`,
      summary: isHomeWin
        ? '한타와 오브젝트를 거의 놓치지 않으면서 상대가 반격할 틈을 주지 않았습니다. 숫자보다 체감이 더 크게 남는 승리입니다.'
        : '초중반 실수가 경기 내내 따라붙었고, 한 번 밀린 흐름을 끝내 되돌리지 못했습니다. 복기 가치가 큰 패배입니다.',
    };
  }

  if (goldGap <= 2500) {
    return {
      label: '끝까지 팽팽한 승부',
      title: `${winnerName}이 마지막 집중력으로 웃었습니다`,
      summary: '한 번의 교전과 마지막 판단이 승패를 갈랐습니다. 결과는 났지만 다시 붙어도 이상하지 않은 경기였습니다.',
    };
  }

  return {
    label: isHomeWin ? '주도권 유지' : '추격 실패',
    title: isHomeWin ? `${winnerName}이 우세를 결과로 바꿨습니다` : `${loserName}은 추격의 계기를 만들지 못했습니다`,
    summary: isHomeWin
      ? '앞서 만든 이득을 무리 없이 굴려내며 정리한 경기였습니다. 준비한 플랜이 비교적 선명하게 드러났습니다.'
      : '몇 차례 버틸 구간은 있었지만, 흐름을 뒤집을 만큼 큰 전환점은 만들지 못했습니다. 다음 준비의 방향이 또렷해진 경기입니다.',
  };
}

function buildSignatureMoment(gameResult: GameResult, homeTeamName: string, awayTeamName: string) {
  const baronHome = gameResult.events.filter((event) => event.type === 'baron' && event.side === 'home').length;
  const baronAway = gameResult.events.filter((event) => event.type === 'baron' && event.side === 'away').length;
  const heraldHome = gameResult.events.filter((event) => event.type === 'rift_herald' && event.side === 'home').length;
  const heraldAway = gameResult.events.filter((event) => event.type === 'rift_herald' && event.side === 'away').length;
  const homeCarry = [...gameResult.playerStatsHome].sort((a, b) => b.damageDealt - a.damageDealt)[0];
  const awayCarry = [...gameResult.playerStatsAway].sort((a, b) => b.damageDealt - a.damageDealt)[0];
  const isHomeWin = gameResult.winnerSide === 'home';

  if (baronHome + baronAway > 0) {
    const side = baronHome > baronAway ? homeTeamName : awayTeamName;
    return {
      label: '기억할 장면',
      title: `${side}의 바론 장악`,
      summary: '바론 주도권을 잡은 순간부터 경기 리듬이 한쪽으로 기울었습니다. 이번 게임의 가장 또렷한 전환점입니다.',
    };
  }

  if (heraldHome + heraldAway > 0) {
    const side = heraldHome > heraldAway ? homeTeamName : awayTeamName;
    return {
      label: '기억할 장면',
      title: `${side}의 초반 오브젝트 설계`,
      summary: '전령과 라인 압박이 맞물리면서 초반 설계가 그대로 경기 전체 흐름으로 이어졌습니다.',
    };
  }

  const carry = isHomeWin ? homeCarry : awayCarry;
  const teamName = isHomeWin ? homeTeamName : awayTeamName;
  return {
    label: '기억할 장면',
    title: `${teamName} ${carry?.position.toUpperCase() ?? '핵심 라인'}의 화력 폭발`,
    summary: '가장 많은 피해를 만든 포지션이 교전의 중심에 섰습니다. 이 한 축이 경기 체감 난이도를 크게 갈랐습니다.',
  };
}

function buildPlayerSpotlight(gameResult: GameResult, homeTeamName: string, awayTeamName: string) {
  const isHomeWin = gameResult.winnerSide === 'home';
  const winningPlayers = isHomeWin ? gameResult.playerStatsHome : gameResult.playerStatsAway;
  const losingPlayers = isHomeWin ? gameResult.playerStatsAway : gameResult.playerStatsHome;
  const winningTeamName = isHomeWin ? homeTeamName : awayTeamName;
  const losingTeamName = isHomeWin ? awayTeamName : homeTeamName;
  const standout = [...winningPlayers].sort((a, b) => b.damageDealt - a.damageDealt)[0];
  const burden = [...losingPlayers].sort((a, b) => b.deaths - a.deaths || a.damageDealt - b.damageDealt)[0];
  const standoutLabel = POSITION_LABELS[standout?.position ?? ''] ?? standout?.position?.toUpperCase() ?? '-';
  const burdenLabel = POSITION_LABELS[burden?.position ?? ''] ?? burden?.position?.toUpperCase() ?? '-';

  return {
    label: '시리즈의 얼굴',
    title: `${winningTeamName} ${standoutLabel} 라인이 가장 강하게 남았습니다`,
    summary:
      standout && burden
        ? `${winningTeamName}의 ${standoutLabel} 라인은 교전마다 흐름을 만들었고, ${losingTeamName} ${burdenLabel} 라인은 ${burden.deaths}데스로 압박을 오래 버티지 못했습니다.`
        : '이번 경기는 한 라인의 주도권과 무너진 대응이 전체 흐름을 바꾼 경기였습니다.',
  };
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
  const navigate = useNavigate();
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
  const emotionalSummary = buildEmotionalSummary(gameResult, homeTeamName, awayTeamName);
  const signatureMoment = buildSignatureMoment(gameResult, homeTeamName, awayTeamName);
  const playerSpotlight = buildPlayerSpotlight(gameResult, homeTeamName, awayTeamName);
  const normalizedEmotionalSummary = {
    ...emotionalSummary,
    label: '팬이 기억할 한 문장',
  };
  const normalizedSignatureMoment = {
    ...signatureMoment,
    label: '팬이 기억할 장면',
  };

  const normalizedPlayerSpotlight = {
    ...playerSpotlight,
    label: '시리즈의 얼굴',
  };

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
          <div className="pgs-insight-grid" style={{ marginBottom: 12 }}>
            <div className="pgs-insight-card pgs-insight-card--high" data-testid="postgame-emotion-card">
              <div className="pgs-insight-card__top">
                <span className="pgs-insight-impact">{normalizedEmotionalSummary.label}</span>
                <span className="pgs-insight-title">{normalizedEmotionalSummary.title}</span>
              </div>
              <p className="pgs-insight-copy">{normalizedEmotionalSummary.summary}</p>
            </div>
            <div className="pgs-insight-card pgs-insight-card--medium" data-testid="postgame-signature-card">
              <div className="pgs-insight-card__top">
                <span className="pgs-insight-impact">{normalizedSignatureMoment.label}</span>
                <span className="pgs-insight-title">{normalizedSignatureMoment.title}</span>
              </div>
              <p className="pgs-insight-copy">{normalizedSignatureMoment.summary}</p>
            </div>
            <div className="pgs-insight-card pgs-insight-card--medium" data-testid="postgame-player-spotlight-card">
              <div className="pgs-insight-card__top">
                <span className="pgs-insight-impact">{normalizedPlayerSpotlight.label}</span>
                <span className="pgs-insight-title">{normalizedPlayerSpotlight.title}</span>
              </div>
              <p className="pgs-insight-copy">{normalizedPlayerSpotlight.summary}</p>
            </div>
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
          {insightReport.followUps.length > 0 && (
            <div className="pgs-insight-grid" style={{ marginTop: 12 }}>
              {insightReport.followUps.map((followUp, index) => (
                <div
                  key={`${followUp.action}-${followUp.priority}`}
                  className={`pgs-insight-card pgs-insight-card--${followUp.priority}`}
                >
                  <div className="pgs-insight-card__top">
                    <span className="pgs-insight-impact">{FOLLOW_UP_LABELS[followUp.priority] ?? '참고'}</span>
                    <span className="pgs-insight-title">{followUp.action}</span>
                  </div>
                  <p className="pgs-insight-copy">{followUp.summary}</p>
                  <button
                    type="button"
                    className="pgs-action-pill"
                    data-testid={`postgame-followup-action-${index}`}
                    onClick={() => navigate(getFollowUpRoute(followUp.action))}
                  >
                    바로 이동
                  </button>
                </div>
              ))}
            </div>
          )}
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
