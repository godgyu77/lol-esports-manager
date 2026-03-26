/**
 * 미니맵 시각화 컴포넌트
 * - Pixi.js v8 기반 2D 캔버스 렌더링
 * - 10명 플레이어 위치 표시 (블루 5, 레드 5)
 * - 이벤트 발생 시 플래시 애니메이션
 * - 오브젝트 카운터 (드래곤, 바론, 타워)
 */

import { useRef, useEffect } from 'react';
import { Application, Graphics, Text, TextStyle } from 'pixi.js';
import type { MatchEvent, MatchEventType } from '../../types/match';
import './match.css';

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────

interface MatchMinimapProps {
  gameState: {
    currentTick: number;
    goldHome: number;
    goldAway: number;
    killsHome: number;
    killsAway: number;
    towersHome: number;
    towersAway: number;
    dragonsHome: number;
    dragonsAway: number;
    events: MatchEvent[];
    commentary: unknown[];
    isFinished: boolean;
  };
  homePlayerIds: string[];
  awayPlayerIds: string[];
  width?: number;
  height?: number;
}

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────

const DEFAULT_SIZE = 450;
const BG_COLOR = '#0a1a0a';
const GRID_COLOR = 0x1a2a1a;
const LANE_COLOR = 0x2a3a2a;
const HOME_COLOR = 0x4488ff;
const AWAY_COLOR = 0xff4444;
const PLAYER_RADIUS = 7;
const GRID_SPACING = 50;

/** 이벤트 타입별 플래시 색상 */
const EVENT_FLASH_COLORS: Partial<Record<MatchEventType, number>> = {
  kill: 0xffdd44,
  dragon: 0xaa44ff,
  baron: 0xff44cc,
  tower_destroy: 0xff8800,
  teamfight: 0xffdd44,
  gank: 0xffdd44,
};

const FLASH_DURATION_TICKS = 3;
const FLASH_MAX_RADIUS = 18;

// ─────────────────────────────────────────
// 위치 계산 유틸
// ─────────────────────────────────────────

/** 라인별 기본 경로 (0~1 정규화 좌표) */
const LANE_PATHS = {
  top: [
    { x: 0.08, y: 0.92 },
    { x: 0.08, y: 0.08 },
    { x: 0.92, y: 0.08 },
  ],
  mid: [
    { x: 0.15, y: 0.85 },
    { x: 0.5, y: 0.5 },
    { x: 0.85, y: 0.15 },
  ],
  bot: [
    { x: 0.08, y: 0.92 },
    { x: 0.92, y: 0.92 },
    { x: 0.92, y: 0.08 },
  ],
};

/** 역할별 기본 라인 배정 (인덱스 0~4: 탑, 정글, 미드, 원딜, 서폿) */
const ROLE_LANE: Array<'top' | 'mid' | 'bot'> = ['top', 'mid', 'mid', 'bot', 'bot'];

/**
 * 틱과 플레이어 인덱스 기반으로 유사 위치를 생성한다.
 * - 홈 팀: 좌하단 → 중앙으로 이동
 * - 어웨이 팀: 우상단 → 중앙으로 이동
 */
const getPlayerPosition = (
  tick: number,
  playerIndex: number,
  side: 'home' | 'away',
  mapSize: number,
): { x: number; y: number } => {
  const lane = ROLE_LANE[playerIndex] ?? 'mid';
  const path = LANE_PATHS[lane];

  // 게임 진행도 (0~1), 최대 45분 기준
  const progress = Math.min(tick / 45, 1);

  // 라인 경로 위의 위치 보간
  const pathProgress = progress * (path.length - 1);
  const segIndex = Math.min(Math.floor(pathProgress), path.length - 2);
  const segT = pathProgress - segIndex;

  const baseX = path[segIndex].x + (path[segIndex + 1].x - path[segIndex].x) * segT;
  const baseY = path[segIndex].y + (path[segIndex + 1].y - path[segIndex].y) * segT;

  // 어웨이는 반대편에서 시작 (좌표 반전)
  const flippedX = side === 'away' ? 1 - baseX : baseX;
  const flippedY = side === 'away' ? 1 - baseY : baseY;

  // 개별 플레이어 오프셋 (겹침 방지 + 자연스러운 미세 이동)
  const seed = playerIndex * 137 + tick * 7;
  const offsetX = Math.sin(seed * 0.1) * 0.03;
  const offsetY = Math.cos(seed * 0.13) * 0.03;

  const margin = 12;
  const usable = mapSize - margin * 2;

  return {
    x: margin + Math.max(0, Math.min(1, flippedX + offsetX)) * usable,
    y: margin + Math.max(0, Math.min(1, flippedY + offsetY)) * usable,
  };
};

// ─────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────

export function MatchMinimap({
  gameState,
  homePlayerIds,
  awayPlayerIds,
  width = DEFAULT_SIZE,
  height = DEFAULT_SIZE,
}: MatchMinimapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const graphicsRef = useRef<{
    bg: Graphics;
    lanes: Graphics;
    players: Graphics;
    events: Graphics;
    overlay: Graphics;
  } | null>(null);

  // ─── Pixi 초기화 ───
  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;
    const app = new Application();

    const initApp = async () => {
      await app.init({
        width,
        height,
        background: BG_COLOR,
        antialias: true,
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      containerRef.current?.appendChild(app.canvas);
      appRef.current = app;

      // 그래픽 레이어 생성
      const bg = new Graphics();
      const lanes = new Graphics();
      const players = new Graphics();
      const events = new Graphics();
      const overlay = new Graphics();

      app.stage.addChild(bg);
      app.stage.addChild(lanes);
      app.stage.addChild(players);
      app.stage.addChild(events);
      app.stage.addChild(overlay);

      graphicsRef.current = { bg, lanes, players, events, overlay };

      // 정적 배경: 그리드
      drawBackground(bg, width, height);
      // 정적 배경: 레인 경로
      drawLanes(lanes, width, height);
    };

    initApp();

    return () => {
      destroyed = true;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
      graphicsRef.current = null;
    };
  }, [width, height]);

  // ─── 플레이어 위치 보간 (lerp) ───
  const displayPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    const g = graphicsRef.current;
    if (!g) return;

    // 목표 위치 계산
    const targets = new Map<string, { x: number; y: number }>();
    for (let i = 0; i < Math.min(homePlayerIds.length, 5); i++) {
      targets.set(`h${i}`, getPlayerPosition(gameState.currentTick, i, 'home', width));
    }
    for (let i = 0; i < Math.min(awayPlayerIds.length, 5); i++) {
      targets.set(`a${i}`, getPlayerPosition(gameState.currentTick, i, 'away', width));
    }

    // lerp 보간 애니메이션
    let animId = 0;
    const LERP_SPEED = 0.15;

    const animate = () => {
      let needsUpdate = false;
      for (const [key, target] of targets) {
        const current = displayPositions.current.get(key) ?? { ...target };
        const dx = target.x - current.x;
        const dy = target.y - current.y;
        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
          current.x += dx * LERP_SPEED;
          current.y += dy * LERP_SPEED;
          needsUpdate = true;
        } else {
          current.x = target.x;
          current.y = target.y;
        }
        displayPositions.current.set(key, current);
      }

      // 보간된 위치로 그리기
      g.players.clear();
      for (let i = 0; i < Math.min(homePlayerIds.length, 5); i++) {
        const pos = displayPositions.current.get(`h${i}`);
        if (pos) {
          g.players.circle(pos.x, pos.y, PLAYER_RADIUS);
          g.players.fill(HOME_COLOR);
        }
      }
      for (let i = 0; i < Math.min(awayPlayerIds.length, 5); i++) {
        const pos = displayPositions.current.get(`a${i}`);
        if (pos) {
          g.players.circle(pos.x, pos.y, PLAYER_RADIUS);
          g.players.fill(AWAY_COLOR);
        }
      }

      if (needsUpdate) {
        animId = requestAnimationFrame(animate);
      }
    };

    animate();
    drawEvents(g.events, gameState.currentTick, gameState.events, width, height);
    drawOverlay(g.overlay, gameState, width, height);

    return () => cancelAnimationFrame(animId);
  }, [gameState, homePlayerIds, awayPlayerIds, width, height]);

  return (
    <div
      ref={containerRef}
      className="minimap-container"
      style={{ width, height }}
    />
  );
}

// ─────────────────────────────────────────
// 드로잉 함수
// ─────────────────────────────────────────

/** 그리드 배경 */
const drawBackground = (g: Graphics, w: number, h: number) => {
  // 그리드 선
  for (let x = GRID_SPACING; x < w; x += GRID_SPACING) {
    g.moveTo(x, 0);
    g.lineTo(x, h);
    g.stroke({ color: GRID_COLOR, width: 0.5, alpha: 0.5 });
  }
  for (let y = GRID_SPACING; y < h; y += GRID_SPACING) {
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke({ color: GRID_COLOR, width: 0.5, alpha: 0.5 });
  }
};

/** 레인 경로 (탑, 미드, 봇) */
const drawLanes = (g: Graphics, w: number, _h: number) => {
  const margin = 12;
  const usable = w - margin * 2;

  const toPixel = (p: { x: number; y: number }) => ({
    x: margin + p.x * usable,
    y: margin + p.y * usable,
  });

  for (const path of Object.values(LANE_PATHS)) {
    const start = toPixel(path[0]);
    g.moveTo(start.x, start.y);
    for (let i = 1; i < path.length; i++) {
      const pt = toPixel(path[i]);
      g.lineTo(pt.x, pt.y);
    }
    g.stroke({ color: LANE_COLOR, width: 1.5, alpha: 0.6 });
  }

  // 기지 표시 (좌하단 홈, 우상단 어웨이)
  g.circle(margin + 0.05 * usable, margin + 0.95 * usable, 10);
  g.fill({ color: HOME_COLOR, alpha: 0.3 });
  g.stroke({ color: HOME_COLOR, width: 1.5, alpha: 0.6 });

  g.circle(margin + 0.95 * usable, margin + 0.05 * usable, 10);
  g.fill({ color: AWAY_COLOR, alpha: 0.3 });
  g.stroke({ color: AWAY_COLOR, width: 1.5, alpha: 0.6 });

  // 드래곤 pit (하단 중앙)
  g.circle(margin + 0.62 * usable, margin + 0.62 * usable, 12);
  g.fill({ color: 0xaa44ff, alpha: 0.1 });
  g.stroke({ color: 0xaa44ff, width: 1, alpha: 0.4 });

  // 바론 pit (상단 중앙)
  g.circle(margin + 0.38 * usable, margin + 0.38 * usable, 12);
  g.fill({ color: 0xff44cc, alpha: 0.1 });
  g.stroke({ color: 0xff44cc, width: 1, alpha: 0.4 });

  // 타워 위치 (각 라인 3개씩, 양쪽 6개 = 12개)
  const towerPositions = [
    // 홈 타워 (블루)
    { x: 0.10, y: 0.55 }, { x: 0.10, y: 0.30 }, { x: 0.15, y: 0.15 }, // 탑
    { x: 0.30, y: 0.70 }, { x: 0.40, y: 0.60 },                       // 미드
    { x: 0.55, y: 0.90 }, { x: 0.30, y: 0.90 }, { x: 0.15, y: 0.85 }, // 봇
    // 어웨이 타워 (레드)
    { x: 0.90, y: 0.45 }, { x: 0.90, y: 0.70 }, { x: 0.85, y: 0.85 }, // 탑
    { x: 0.70, y: 0.30 }, { x: 0.60, y: 0.40 },                       // 미드
    { x: 0.45, y: 0.10 }, { x: 0.70, y: 0.10 }, { x: 0.85, y: 0.15 }, // 봇
  ];
  for (let i = 0; i < towerPositions.length; i++) {
    const tp = towerPositions[i];
    const color = i < 8 ? HOME_COLOR : AWAY_COLOR;
    g.rect(margin + tp.x * usable - 3, margin + tp.y * usable - 3, 6, 6);
    g.fill({ color, alpha: 0.4 });
  }
};

/** 이벤트 플래시 마커 */
const drawEvents = (
  g: Graphics,
  currentTick: number,
  events: MatchEvent[],
  w: number,
  _h: number,
) => {
  g.clear();

  const margin = 12;
  const usable = w - margin * 2;

  for (const evt of events) {
    const age = currentTick - evt.tick;
    if (age < 0 || age > FLASH_DURATION_TICKS) continue;

    const color = EVENT_FLASH_COLORS[evt.type] ?? 0xffffff;
    const progress = age / FLASH_DURATION_TICKS; // 0 → 1
    const alpha = 1 - progress;
    const radius = FLASH_MAX_RADIUS * (0.3 + progress * 0.7);

    // 이벤트 위치 결정
    let ex: number;
    let ey: number;

    if (evt.position) {
      ex = margin + Math.max(0, Math.min(1, evt.position.x)) * usable;
      ey = margin + Math.max(0, Math.min(1, evt.position.y)) * usable;
    } else {
      // 위치 정보 없으면 이벤트 타입 + 사이드 기반으로 추정
      const baseX = evt.type === 'dragon' ? 0.7 : evt.type === 'baron' ? 0.3 : 0.5;
      const baseY = evt.type === 'dragon' ? 0.7 : evt.type === 'baron' ? 0.3 : 0.5;
      const sideOffset = evt.side === 'home' ? -0.05 : 0.05;
      ex = margin + Math.max(0, Math.min(1, baseX + sideOffset)) * usable;
      ey = margin + Math.max(0, Math.min(1, baseY + sideOffset)) * usable;
    }

    // 외곽 원 (페이드아웃)
    g.circle(ex, ey, radius);
    g.fill({ color, alpha: alpha * 0.3 });
    g.stroke({ color, width: 1.5, alpha: alpha * 0.8 });

    // 중심 점
    g.circle(ex, ey, 3);
    g.fill({ color, alpha });
  }
};

/** 오브젝트 카운터 오버레이 (드래곤, 바론, 타워) */
const drawOverlay = (
  g: Graphics,
  state: MatchMinimapProps['gameState'],
  w: number,
  h: number,
) => {
  g.clear();

  const pad = 4;
  const fontSize = 9;
  const textStyle = new TextStyle({
    fontSize,
    fontFamily: 'monospace',
    fill: '#8a8a9a',
  });

  // 기존 텍스트 제거
  while (g.children.length > 0) {
    g.removeChildAt(0);
  }

  // 좌측 하단: 홈 팀 스탯
  const homeStats = `K:${state.killsHome} T:${state.towersHome} D:${state.dragonsHome}`;
  const homeText = new Text({ text: homeStats, style: { ...textStyle, fill: '#6688cc' } });
  homeText.x = pad;
  homeText.y = h - fontSize - pad - 2;
  g.addChild(homeText);

  // 우측 상단: 어웨이 팀 스탯
  const awayStats = `K:${state.killsAway} T:${state.towersAway} D:${state.dragonsAway}`;
  const awayText = new Text({ text: awayStats, style: { ...textStyle, fill: '#cc6666' } });
  awayText.x = w - pad - awayStats.length * (fontSize * 0.6);
  awayText.y = pad;
  g.addChild(awayText);

  // 종료 표시
  if (state.isFinished) {
    const finText = new Text({
      text: 'FINISHED',
      style: new TextStyle({
        fontSize: 14,
        fontFamily: 'monospace',
        fontWeight: 'bold',
        fill: '#c89b3c',
      }),
    });
    finText.x = w / 2 - 36;
    finText.y = h / 2 - 8;
    g.addChild(finText);
  }
};
