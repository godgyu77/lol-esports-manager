/**
 * 경기 하이라이트
 * - 경기 결과(GameResult)에서 주요 이벤트 추출
 * - 세트별 탭 (Game 1, Game 2, ...)
 * - 타임라인 형식 (시간순) 카드 표시
 * - 중요도 높은 이벤트는 골드 하이라이트
 */

import { useState } from 'react';
import type { GameResult } from '../../engine/match/matchSimulator';
import './match.css';

interface MatchHighlightsProps {
  gameResults: GameResult[];
  homeTeamName?: string;
  awayTeamName?: string;
}

interface HighlightEvent {
  time: number;
  type: string;
  description: string;
  importance: number;
  icon: string;
  color: string;
  side: 'home' | 'away';
}

const EVENT_ICON_MAP: Record<string, { icon: string; color: string }> = {
  kill: { icon: '\u2694\uFE0F', color: '#e74c3c' },
  solo_kill: { icon: '\u2694\uFE0F', color: '#e74c3c' },
  gank: { icon: '\u2694\uFE0F', color: '#e74c3c' },
  dragon: { icon: '\uD83D\uDC09', color: '#9b59b6' },
  elder_dragon: { icon: '\uD83D\uDC09', color: '#e67e22' },
  baron: { icon: '\uD83D\uDC51', color: '#f1c40f' },
  tower_destroy: { icon: '\uD83D\uDDFC', color: '#3498db' },
  teamfight: { icon: '\uD83D\uDCA5', color: '#e67e22' },
  ace: { icon: '\uD83D\uDCA5', color: '#e74c3c' },
  pentakill: { icon: '\u2B50', color: '#ffd700' },
  steal: { icon: '\uD83D\uDCA5', color: '#f1c40f' },
  dive: { icon: '\u2694\uFE0F', color: '#e74c3c' },
  rift_herald: { icon: '\uD83D\uDC51', color: '#9b59b6' },
  void_grub: { icon: '\uD83D\uDC1B', color: '#8e44ad' },
  backdoor: { icon: '\uD83D\uDCA5', color: '#e74c3c' },
  base_race: { icon: '\uD83D\uDCA5', color: '#e74c3c' },
  invade: { icon: '\u2694\uFE0F', color: '#3498db' },
  lane_swap: { icon: '\uD83D\uDD04', color: '#6a6a7a' },
};

function formatTime(minutes: number): string {
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function calculateImportance(event: { type: string; goldChange: number; tick: number }): number {
  const baseScores: Record<string, number> = {
    pentakill: 5, ace: 5, steal: 5, backdoor: 5, base_race: 5,
    baron: 4, elder_dragon: 4,
    teamfight: 3, dragon: 3, tower_destroy: 3, rift_herald: 3,
    solo_kill: 2, dive: 2, invade: 2,
    kill: 1, gank: 1, void_grub: 1, lane_swap: 1,
  };
  let score = baseScores[event.type] ?? 1;

  // 후반(25분+) 이벤트 중요도 상승
  const minutes = event.tick / 60;
  if (minutes >= 30) score += 1;

  // 골드 임팩트 큰 이벤트
  if (Math.abs(event.goldChange) >= 2000) score += 1;

  return Math.min(5, score);
}

function extractHighlightsFromGame(
  game: GameResult,
  homeName: string,
  awayName: string,
): HighlightEvent[] {
  const sideLabel = (side: 'home' | 'away') => (side === 'home' ? homeName : awayName);
  const highlights: HighlightEvent[] = [];

  for (const event of game.events) {
    const importance = calculateImportance(event);
    if (importance < 2) continue; // 중요도 2 이상만 표시

    const iconInfo = EVENT_ICON_MAP[event.type] ?? { icon: '\u2139\uFE0F', color: '#6a6a7a' };

    highlights.push({
      time: event.tick / 60,
      type: event.type,
      description: `${sideLabel(event.side)} - ${event.description}`,
      importance,
      icon: iconInfo.icon,
      color: iconInfo.color,
      side: event.side,
    });
  }

  // 역전승 체크
  const winnerSide = game.winnerSide;
  const wasLosingAt15 =
    (winnerSide === 'home' && game.goldDiffAt15 < -500) ||
    (winnerSide === 'away' && game.goldDiffAt15 > 500);
  if (wasLosingAt15) {
    highlights.push({
      time: 15,
      type: 'comeback',
      description: `${sideLabel(winnerSide)}(이)가 ${Math.abs(game.goldDiffAt15)}G 뒤진 상황에서 역전 승리!`,
      importance: 4,
      icon: '\uD83D\uDD25',
      color: '#e67e22',
      side: winnerSide,
    });
  }

  // MVP (가장 많은 킬)
  const allStats = [
    ...game.playerStatsHome.map((s) => ({ ...s, side: 'home' as const })),
    ...game.playerStatsAway.map((s) => ({ ...s, side: 'away' as const })),
  ];
  const mvp = allStats.reduce((best, cur) => (cur.kills > best.kills ? cur : best), allStats[0]);
  if (mvp && mvp.kills > 0) {
    highlights.push({
      time: game.durationMinutes,
      type: 'mvp',
      description: `${sideLabel(mvp.side)} ${mvp.position.toUpperCase()} MVP - ${mvp.kills}/${mvp.deaths}/${mvp.assists}`,
      importance: 3,
      icon: '\u2B50',
      color: '#ffd700',
      side: mvp.side,
    });
  }

  // 시간순 정렬
  highlights.sort((a, b) => a.time - b.time);

  return highlights;
}

export function MatchHighlights({ gameResults, homeTeamName, awayTeamName }: MatchHighlightsProps) {
  const homeName = homeTeamName ?? '\uBE14\uB8E8';
  const awayName = awayTeamName ?? '\uB808\uB4DC';
  const [activeTab, setActiveTab] = useState(0);

  if (gameResults.length === 0) return null;

  const currentGame = gameResults[activeTab];
  const highlights = currentGame ? extractHighlightsFromGame(currentGame, homeName, awayName) : [];

  return (
    <div className="hl-container">
      <h3 className="hl-title">경기 하이라이트</h3>

      {/* 세트별 탭 */}
      {gameResults.length > 1 && (
        <div className="hl-tab-row">
          {gameResults.map((game, i) => (
            <button
              key={i}
              className={`hl-tab-btn ${activeTab === i ? 'hl-tab-btn--active' : ''}`}
              onClick={() => setActiveTab(i)}
            >
              Game {i + 1}
              <span className="hl-tab-result">
                {game.winnerSide === 'home' ? homeName : awayName} W
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 게임 요약 */}
      {currentGame && (
        <div className="hl-game-summary">
          <span className="hl-summary-item">
            {currentGame.killsHome} - {currentGame.killsAway} 킬
          </span>
          <span className="hl-summary-sep">/</span>
          <span className="hl-summary-item">
            {currentGame.durationMinutes}분
          </span>
          <span className="hl-summary-sep">/</span>
          <span className="hl-summary-item">
            15분 골드차 {currentGame.goldDiffAt15 > 0 ? '+' : ''}{currentGame.goldDiffAt15}
          </span>
        </div>
      )}

      {/* 타임라인 */}
      <div className="hl-timeline">
        {highlights.length === 0 && (
          <p className="fm-text-md fm-text-muted">주요 이벤트가 없습니다.</p>
        )}
        {highlights.map((hl, j) => {
          const isGold = hl.importance >= 4;
          return (
            <div key={j} className="hl-card">
              <div className="hl-card-left">
                <span
                  className="hl-icon"
                  style={{
                    background: isGold ? 'rgba(200,155,60,0.2)' : `${hl.color}22`,
                    color: isGold ? '#c89b3c' : hl.color,
                    boxShadow: isGold ? '0 0 8px rgba(200,155,60,0.3)' : 'none',
                  }}
                >
                  {hl.icon}
                </span>
                {j < highlights.length - 1 && <div className="hl-timeline-line" />}
              </div>
              <div className={`hl-card-content ${isGold ? 'hl-card-content--gold' : ''}`}>
                <div className="hl-card-header">
                  <span
                    className="hl-card-title"
                    style={{ color: isGold ? '#c89b3c' : hl.color }}
                  >
                    {EVENT_TYPE_LABELS[hl.type] ?? hl.type}
                  </span>
                  <span className="hl-card-time">{formatTime(hl.time)}</span>
                </div>
                <p className="hl-card-desc">{hl.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  kill: '킬',
  solo_kill: '솔로킬',
  gank: '갱킹',
  dragon: '드래곤',
  elder_dragon: '장로 드래곤',
  baron: '바론',
  tower_destroy: '타워 파괴',
  teamfight: '팀파이트',
  ace: '에이스',
  pentakill: '펜타킬',
  steal: '스틸',
  dive: '다이브',
  rift_herald: '전령',
  void_grub: '공허 유충',
  backdoor: '백도어',
  base_race: '베이스 레이스',
  invade: '침공',
  lane_swap: '라인 스왑',
  comeback: '역전',
  mvp: 'MVP',
};
