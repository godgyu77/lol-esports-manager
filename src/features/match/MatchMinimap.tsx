import { useRef, useEffect } from 'react';
import { Application, Graphics, Text, TextStyle } from 'pixi.js';
import type { LiveGameState } from '../../engine/match/liveMatch';
import type { MatchZone } from '../../types/match';
import './match.css';

interface MatchMinimapProps {
  gameState: LiveGameState;
  width?: number;
  height?: number;
}

const DEFAULT_SIZE = 640;
const MAP_MARGIN = 18;
const BG_COLOR = '#08110d';
const GRID_COLOR = 0x173025;
const TERRAIN_COLOR = 0x0d1b14;
const LANE_COLOR = 0xa88f56;
const RIVER_COLOR = 0x1f5367;
const HOME_COLOR = 0x4d8dff;
const AWAY_COLOR = 0xff5a5a;
const OBJECTIVE_COLOR = 0xd5be73;

const ZONE_POINTS: Record<MatchZone, { x: number; y: number }> = {
  home_base: { x: 0.12, y: 0.88 },
  away_base: { x: 0.88, y: 0.12 },
  top_lane: { x: 0.24, y: 0.14 },
  mid_lane: { x: 0.5, y: 0.5 },
  bot_lane: { x: 0.76, y: 0.86 },
  top_river: { x: 0.35, y: 0.26 },
  mid_river: { x: 0.5, y: 0.5 },
  bot_river: { x: 0.65, y: 0.74 },
  home_jungle: { x: 0.3, y: 0.7 },
  away_jungle: { x: 0.7, y: 0.3 },
  dragon_pit: { x: 0.62, y: 0.67 },
  baron_pit: { x: 0.38, y: 0.33 },
  center: { x: 0.5, y: 0.5 },
};

function toPixel(point: { x: number; y: number }, mapSize: number) {
  const usable = mapSize - MAP_MARGIN * 2;
  return {
    x: MAP_MARGIN + point.x * usable,
    y: MAP_MARGIN + point.y * usable,
  };
}

export function MatchMinimap({ gameState, width = DEFAULT_SIZE, height = DEFAULT_SIZE }: MatchMinimapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const graphicsRef = useRef<{ base: Graphics; overlays: Graphics; players: Graphics; labels: Graphics } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const app = new Application();
    let cancelled = false;

    const init = async () => {
      await app.init({ width, height, background: BG_COLOR, antialias: true });
      if (cancelled) {
        app.destroy(true);
        return;
      }

      containerRef.current?.appendChild(app.canvas);
      appRef.current = app;

      const base = new Graphics();
      const overlays = new Graphics();
      const players = new Graphics();
      const labels = new Graphics();
      app.stage.addChild(base);
      app.stage.addChild(overlays);
      app.stage.addChild(players);
      app.stage.addChild(labels);
      graphicsRef.current = { base, overlays, players, labels };
      drawBase(base, width, height);
    };

    void init();
    return () => {
      cancelled = true;
      appRef.current?.destroy(true);
      appRef.current = null;
      graphicsRef.current = null;
    };
  }, [height, width]);

  useEffect(() => {
    const graphics = graphicsRef.current;
    if (!graphics) return;
    drawOverlay(graphics.overlays, gameState, width);
    drawPlayers(graphics.players, gameState, width);
    drawLabels(graphics.labels, gameState, width, height);
  }, [gameState, height, width]);

  return <div ref={containerRef} className="minimap-container" style={{ width, height }} />;
}

function drawBase(graphics: Graphics, width: number, height: number) {
  graphics.clear();
  graphics.roundRect(0, 0, width, height, 24);
  graphics.fill(0x08110d);
  graphics.roundRect(6, 6, width - 12, height - 12, 20);
  graphics.fill(TERRAIN_COLOR);

  const lanePaths = [
    [{ x: 0.1, y: 0.9 }, { x: 0.15, y: 0.15 }, { x: 0.9, y: 0.1 }],
    [{ x: 0.14, y: 0.86 }, { x: 0.5, y: 0.5 }, { x: 0.86, y: 0.14 }],
    [{ x: 0.1, y: 0.9 }, { x: 0.85, y: 0.85 }, { x: 0.9, y: 0.1 }],
  ];

  lanePaths.forEach((path) => {
    const start = toPixel(path[0], width);
    graphics.moveTo(start.x, start.y);
    for (let index = 1; index < path.length; index += 1) {
      const point = toPixel(path[index], width);
      graphics.lineTo(point.x, point.y);
    }
    graphics.stroke({ color: 0x2c2618, width: 18, alpha: 0.65, cap: 'round', join: 'round' });
    graphics.moveTo(start.x, start.y);
    for (let index = 1; index < path.length; index += 1) {
      const point = toPixel(path[index], width);
      graphics.lineTo(point.x, point.y);
    }
    graphics.stroke({ color: LANE_COLOR, width: 8, alpha: 0.8, cap: 'round', join: 'round' });
  });

  const river = [
    { x: 0.17, y: 1.0 },
    { x: 0.31, y: 0.78 },
    { x: 0.44, y: 0.6 },
    { x: 0.5, y: 0.5 },
    { x: 0.56, y: 0.4 },
    { x: 0.69, y: 0.22 },
    { x: 0.83, y: 0.0 },
  ];
  const riverStart = toPixel(river[0], width);
  graphics.moveTo(riverStart.x, riverStart.y);
  for (let index = 1; index < river.length; index += 1) {
    const point = toPixel(river[index], width);
    graphics.lineTo(point.x, point.y);
  }
  graphics.stroke({ color: RIVER_COLOR, width: 34, alpha: 0.9, cap: 'round', join: 'round' });

  [['home_base', HOME_COLOR], ['away_base', AWAY_COLOR]].forEach(([zone, color]) => {
    const point = toPixel(ZONE_POINTS[zone as MatchZone], width);
    graphics.circle(point.x, point.y, 36);
    graphics.fill({ color: color as number, alpha: 0.22 });
    graphics.circle(point.x, point.y, 18);
    graphics.fill({ color: 0xf7f4dc, alpha: 0.18 });
  });

  Object.entries(ZONE_POINTS).forEach(([zone, point]) => {
    if (zone === 'center' || zone.includes('base')) return;
    const pixel = toPixel(point, width);
    graphics.circle(pixel.x, pixel.y, zone.includes('pit') ? 14 : 8);
    graphics.fill({ color: zone.includes('pit') ? OBJECTIVE_COLOR : GRID_COLOR, alpha: zone.includes('pit') ? 0.28 : 0.14 });
  });

  for (let value = 60; value < width; value += 60) {
    graphics.moveTo(value, 0);
    graphics.lineTo(value, height);
    graphics.stroke({ color: GRID_COLOR, width: 0.6, alpha: 0.22 });
  }
  for (let value = 60; value < height; value += 60) {
    graphics.moveTo(0, value);
    graphics.lineTo(width, value);
    graphics.stroke({ color: GRID_COLOR, width: 0.6, alpha: 0.22 });
  }
}

function drawOverlay(graphics: Graphics, gameState: LiveGameState, width: number) {
  graphics.clear();

  if (gameState.focusEvent) {
    const focusPoint = toPixel(ZONE_POINTS[gameState.focusEvent.zone], width);
    graphics.circle(focusPoint.x, focusPoint.y, 36);
    graphics.fill({ color: gameState.focusEvent.side === 'home' ? HOME_COLOR : AWAY_COLOR, alpha: 0.12 });
    graphics.stroke({ color: gameState.focusEvent.side === 'home' ? HOME_COLOR : AWAY_COLOR, width: 2, alpha: 0.55 });
  }

  const latestEvents = gameState.events.slice(-4);
  latestEvents.forEach((event, index) => {
    if (!event.position) return;
    const point = toPixel(event.position, width);
    const alpha = Math.max(0.15, 0.7 - index * 0.14);
    graphics.circle(point.x, point.y, 14 - index * 2);
    graphics.fill({ color: event.side === 'home' ? HOME_COLOR : AWAY_COLOR, alpha: alpha * 0.18 });
    graphics.stroke({ color: event.side === 'home' ? HOME_COLOR : AWAY_COLOR, width: 1.2, alpha });
  });
}

function drawPlayers(graphics: Graphics, gameState: LiveGameState, width: number) {
  graphics.clear();

  gameState.playerMapStates.forEach((player) => {
    const point = toPixel({ x: player.x, y: player.y }, width);
    const color = player.side === 'home' ? HOME_COLOR : AWAY_COLOR;
    graphics.circle(point.x, point.y, player.highlight ? 11 : 9);
    graphics.fill({ color: 0x091118, alpha: 0.9 });
    graphics.circle(point.x, point.y, player.highlight ? 8 : 6);
    graphics.fill(color);
    graphics.stroke({ color: 0xf4f2de, width: player.highlight ? 2 : 1.1, alpha: 0.88 });
  });
}

function drawLabels(graphics: Graphics, gameState: LiveGameState, width: number, height: number) {
  graphics.clear();
  while (graphics.children.length > 0) graphics.removeChildAt(0);

  const small = new TextStyle({ fontSize: 10, fill: '#c7d5cc', fontFamily: 'monospace' });
  const muted = new TextStyle({ fontSize: 9, fill: '#8da397', fontFamily: 'monospace' });

  ['top_lane', 'mid_lane', 'bot_lane', 'dragon_pit', 'baron_pit'].forEach((zone) => {
    const point = toPixel(ZONE_POINTS[zone as MatchZone], width);
    const label = new Text({ text: zone.replace('_', ' ').toUpperCase(), style: muted });
    label.x = point.x - label.width / 2;
    label.y = point.y - 24;
    graphics.addChild(label);
  });

  const home = new Text({ text: `BLUE ${gameState.killsHome}K ${gameState.goldHome / 1000}k`, style: small });
  home.x = 10;
  home.y = height - 18;
  graphics.addChild(home);

  const away = new Text({ text: `RED ${gameState.killsAway}K ${gameState.goldAway / 1000}k`, style: small });
  away.x = width - away.width - 10;
  away.y = 8;
  graphics.addChild(away);

  if (gameState.focusEvent) {
    const focus = new Text({ text: `${gameState.focusEvent.label.toUpperCase()}`, style: small });
    focus.x = width / 2 - focus.width / 2;
    focus.y = 10;
    graphics.addChild(focus);
  }
}
