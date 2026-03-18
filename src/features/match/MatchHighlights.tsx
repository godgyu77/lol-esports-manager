/**
 * 경기 하이라이트
 * - 경기 결과(GameResult)에서 주요 이벤트 추출
 * - 타임라인 형식 (시간순) 카드 표시
 */

import type { GameResult } from '../../engine/match/matchSimulator';
import type { MatchEvent } from '../../types/match';

interface MatchHighlightsProps {
  gameResults: GameResult[];
  homeTeamName?: string;
  awayTeamName?: string;
}

interface Highlight {
  time: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

function formatTick(tick: number): string {
  const minutes = Math.floor(tick / 60);
  const seconds = tick % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function extractHighlights(
  game: GameResult,
  gameIndex: number,
  homeName: string,
  awayName: string,
): Highlight[] {
  const highlights: Highlight[] = [];
  const sideLabel = (side: 'home' | 'away') => side === 'home' ? homeName : awayName;

  // First Blood
  const firstKill = game.events.find((e) => e.type === 'kill' || e.type === 'gank');
  if (firstKill) {
    highlights.push({
      time: formatTick(firstKill.tick),
      title: 'First Blood',
      description: `${sideLabel(firstKill.side)} - ${firstKill.description}`,
      icon: '\u{1F529}',
      color: '#e74c3c',
    });
  }

  // 가장 많은 킬을 기록한 선수 (home/away 합쳐서)
  const allPlayerStats = [
    ...game.playerStatsHome.map((s) => ({ ...s, side: 'home' as const })),
    ...game.playerStatsAway.map((s) => ({ ...s, side: 'away' as const })),
  ];
  const mvp = allPlayerStats.reduce((best, cur) => (cur.kills > best.kills ? cur : best), allPlayerStats[0]);
  if (mvp && mvp.kills > 0) {
    highlights.push({
      time: '-',
      title: 'MVP 킬왕',
      description: `${sideLabel(mvp.side)} ${mvp.position.toUpperCase()} - ${mvp.kills}킬 ${mvp.deaths}데스 ${mvp.assists}어시`,
      icon: '\u{2B50}',
      color: '#ffd700',
    });
  }

  // 바론/엘더 드래곤 스틸 (패배 진영이 바론을 획득한 경우)
  const baronEvents = game.events.filter((e) => e.type === 'baron');
  for (const baron of baronEvents) {
    const isSteal = baron.side !== game.winnerSide;
    if (isSteal) {
      highlights.push({
        time: formatTick(baron.tick),
        title: '바론 스틸!',
        description: `${sideLabel(baron.side)}이(가) 바론을 스틸했습니다!`,
        icon: '\u{1F432}',
        color: '#9b59b6',
      });
    }
  }

  // 역전승 (15분 골드 뒤지고 있다가 승리)
  const winnerSide = game.winnerSide;
  const wasLosingAt15 =
    (winnerSide === 'home' && game.goldDiffAt15 < -500) ||
    (winnerSide === 'away' && game.goldDiffAt15 > 500);
  if (wasLosingAt15) {
    highlights.push({
      time: '15:00+',
      title: '역전승!',
      description: `${sideLabel(winnerSide)}이(가) ${Math.abs(game.goldDiffAt15)}골드 뒤진 상황에서 역전 승리!`,
      icon: '\u{1F525}',
      color: '#e67e22',
    });
  }

  // 최대 킬 교전
  const teamfights = game.events.filter((e) => e.type === 'teamfight');
  if (teamfights.length > 0) {
    const biggest = teamfights.reduce((max, cur) => {
      const curKills = parseInt(cur.description.match(/(\d+)킬/)?.[1] ?? '0', 10);
      const maxKills = parseInt(max.description.match(/(\d+)킬/)?.[1] ?? '0', 10);
      return curKills > maxKills ? cur : max;
    }, teamfights[0]);
    const killCount = biggest.description.match(/(\d+)킬/)?.[1] ?? '?';
    highlights.push({
      time: formatTick(biggest.tick),
      title: '최대 교전',
      description: `${sideLabel(biggest.side)} ${killCount}킬 교전`,
      icon: '\u{2694}\u{FE0F}',
      color: '#3498db',
    });
  }

  // 시간순 정렬 (- 는 맨 뒤로)
  highlights.sort((a, b) => {
    if (a.time === '-') return 1;
    if (b.time === '-') return -1;
    return 0;
  });

  return highlights;
}

export function MatchHighlights({ gameResults, homeTeamName, awayTeamName }: MatchHighlightsProps) {
  const homeName = homeTeamName ?? '블루';
  const awayName = awayTeamName ?? '레드';

  if (gameResults.length === 0) return null;

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>경기 하이라이트</h3>
      {gameResults.map((game, i) => {
        const highlights = extractHighlights(game, i, homeName, awayName);
        if (highlights.length === 0) return null;

        return (
          <div key={i} style={styles.gameSection}>
            {gameResults.length > 1 && (
              <div style={styles.gameLabel}>SET {i + 1}</div>
            )}
            <div style={styles.timeline}>
              {highlights.map((hl, j) => (
                <div key={j} style={styles.card}>
                  <div style={styles.cardLeft}>
                    <span style={{ ...styles.icon, background: `${hl.color}22`, color: hl.color }}>
                      {hl.icon}
                    </span>
                    {j < highlights.length - 1 && <div style={styles.timelineLine} />}
                  </div>
                  <div style={styles.cardContent}>
                    <div style={styles.cardHeader}>
                      <span style={{ ...styles.cardTitle, color: hl.color }}>{hl.title}</span>
                      {hl.time !== '-' && (
                        <span style={styles.cardTime}>{hl.time}</span>
                      )}
                    </div>
                    <p style={styles.cardDesc}>{hl.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: '16px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#c89b3c',
    marginBottom: '12px',
  },
  gameSection: {
    marginBottom: '16px',
  },
  gameLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#8a8a9a',
    marginBottom: '8px',
    letterSpacing: '1px',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  card: {
    display: 'flex',
    gap: '12px',
  },
  cardLeft: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '36px',
    minWidth: '36px',
  },
  icon: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
  },
  timelineLine: {
    width: '2px',
    flex: 1,
    background: '#2a2a4a',
    marginTop: '4px',
  },
  cardContent: {
    flex: 1,
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    border: '1px solid #2a2a4a',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  cardTitle: {
    fontSize: '13px',
    fontWeight: 700,
  },
  cardTime: {
    fontSize: '11px',
    color: '#6a6a7a',
    fontFamily: 'monospace',
  },
  cardDesc: {
    fontSize: '12px',
    color: '#8a8a9a',
    margin: 0,
  },
};
