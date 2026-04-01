import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { BattlefieldCameraModel, BattlefieldFrameModel } from './battlefieldModel';
import { BATTLEFIELD_ZONE_POINTS } from './battlefieldModel';
import { CHAMPION_DB } from '../../data/championDb';

const BG_TOP = 0x081320;
const BG_BOTTOM = 0x11253a;
const BLUE = 0x4d8dff;
const RED = 0xff5a5a;
const GOLD = 0xd7b86c;
const RIVER = 0x1f5367;
const TERRAIN = 0x213625;
const LANE = 0x86754b;

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function project(point: { x: number; y: number }, width: number, height: number) {
  const paddingX = width * 0.1;
  const paddingY = height * 0.12;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;
  return {
    x: paddingX + point.x * usableWidth,
    y: paddingY + point.y * usableHeight,
  };
}

function getChampionBadge(championId?: string) {
  if (!championId) return 'DR';
  const champion = CHAMPION_DB.find((entry) => entry.id === championId);
  if (champion?.name) {
    return champion.name
      .split(/[\s'-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  return championId
    .split('_')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function drawBase(graphics: Graphics, width: number, height: number) {
  graphics.clear();
  graphics.rect(0, 0, width, height);
  graphics.fill(BG_TOP);

  graphics.poly([
    width * 0.02, height * 0.18,
    width * 0.98, height * 0.05,
    width * 0.94, height * 0.98,
    width * 0.06, height * 0.88,
  ]);
  graphics.fill(BG_BOTTOM);

  const drawLane = (points: Array<{ x: number; y: number }>) => {
    const first = project(points[0], width, height);
    graphics.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i += 1) {
      const point = project(points[i], width, height);
      graphics.lineTo(point.x, point.y);
    }
    graphics.stroke({ color: 0x2a2418, width: 32, alpha: 0.7, cap: 'round', join: 'round' });
    graphics.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i += 1) {
      const point = project(points[i], width, height);
      graphics.lineTo(point.x, point.y);
    }
    graphics.stroke({ color: LANE, width: 16, alpha: 0.8, cap: 'round', join: 'round' });
  };

  drawLane([{ x: 0.08, y: 0.82 }, { x: 0.16, y: 0.16 }, { x: 0.84, y: 0.08 }]);
  drawLane([{ x: 0.12, y: 0.8 }, { x: 0.5, y: 0.5 }, { x: 0.88, y: 0.2 }]);
  drawLane([{ x: 0.16, y: 0.9 }, { x: 0.72, y: 0.84 }, { x: 0.92, y: 0.26 }]);

  const riverPath = [
    { x: 0.12, y: 0.98 },
    { x: 0.28, y: 0.76 },
    { x: 0.48, y: 0.54 },
    { x: 0.56, y: 0.46 },
    { x: 0.72, y: 0.24 },
    { x: 0.92, y: 0.0 },
  ];
  const riverStart = project(riverPath[0], width, height);
  graphics.moveTo(riverStart.x, riverStart.y);
  for (let i = 1; i < riverPath.length; i += 1) {
    const point = project(riverPath[i], width, height);
    graphics.lineTo(point.x, point.y);
  }
  graphics.stroke({ color: RIVER, width: 54, alpha: 0.6, cap: 'round', join: 'round' });

  const jungleZones = ['home_jungle', 'away_jungle', 'dragon_pit', 'baron_pit'] as const;
  jungleZones.forEach((zone) => {
    const point = project(BATTLEFIELD_ZONE_POINTS[zone], width, height);
    graphics.circle(point.x, point.y, zone.includes('pit') ? 34 : 56);
    graphics.fill({
      color: zone.includes('pit') ? GOLD : TERRAIN,
      alpha: zone.includes('pit') ? 0.12 : 0.18,
    });
  });
}

function drawObjectives(container: Container, model: BattlefieldFrameModel, width: number, height: number) {
  while (container.children.length > 0) container.removeChildAt(0);
  const labelStyle = new TextStyle({ fontSize: 11, fill: '#d7e2ea', fontWeight: '700' });

  model.objectives.forEach((objective) => {
    const point = project({ x: objective.x, y: objective.y }, width, height);
    const ring = new Graphics();
    ring.circle(point.x, point.y, objective.key === 'baron' ? 26 : 22);
    ring.fill({ color: objective.controlledBy === 'home' ? BLUE : objective.controlledBy === 'away' ? RED : GOLD, alpha: 0.14 });
    ring.stroke({ color: objective.controlledBy === 'home' ? BLUE : objective.controlledBy === 'away' ? RED : GOLD, width: 2, alpha: 0.55 });
    container.addChild(ring);

    const label = new Text({
      text: `${objective.key.toUpperCase()} ${objective.status === 'respawning' && objective.nextSpawnTick ? `${objective.nextSpawnTick}:00` : ''}`.trim(),
      style: labelStyle,
    });
    label.x = point.x - label.width / 2;
    label.y = point.y - 34;
    container.addChild(label);
  });
}

function drawEffects(container: Container, model: BattlefieldFrameModel, width: number, height: number) {
  while (container.children.length > 0) container.removeChildAt(0);
  const labelStyle = new TextStyle({ fontSize: 10, fill: '#f8f3df', fontWeight: '800' });

  model.effects.forEach((effect) => {
    const point = project({ x: effect.x, y: effect.y }, width, height);
    const teamColor = effect.side === 'home' ? BLUE : RED;
    const lifeRatio = Math.max(0.18, 1 - effect.age / effect.ttl);
    const burst = new Graphics();

    if (effect.visual === 'shockwave') {
      burst.circle(point.x, point.y, 20 + effect.age * 6);
      burst.stroke({ color: teamColor, width: 3, alpha: 0.65 * effect.intensity * lifeRatio });
      burst.circle(point.x, point.y, 10 + effect.age * 2.4);
      burst.fill({ color: teamColor, alpha: 0.12 * effect.intensity * lifeRatio });
    } else if (effect.visual === 'beam') {
      burst.roundRect(point.x - 6, point.y - 44, 12, 88, 8);
      burst.fill({ color: teamColor, alpha: 0.16 * effect.intensity * lifeRatio });
      burst.circle(point.x, point.y, 16 + effect.age * 1.8);
      burst.stroke({ color: teamColor, width: 2.4, alpha: 0.74 * effect.intensity * lifeRatio });
    } else if (effect.visual === 'objective') {
      burst.circle(point.x, point.y, 28 + effect.age * 2.8);
      burst.fill({ color: GOLD, alpha: 0.08 * effect.intensity * lifeRatio });
      burst.stroke({ color: GOLD, width: 2.8, alpha: 0.85 * effect.intensity * lifeRatio });
      burst.circle(point.x, point.y, 12 + effect.age);
      burst.fill({ color: teamColor, alpha: 0.24 * effect.intensity * lifeRatio });
    } else if (effect.visual === 'spotlight') {
      burst.star(point.x, point.y, 6, 28 + effect.age * 2, 14 + effect.age, 0);
      burst.fill({ color: GOLD, alpha: 0.14 * effect.intensity * lifeRatio });
      burst.stroke({ color: teamColor, width: 2.2, alpha: 0.8 * effect.intensity * lifeRatio });
    } else {
      burst.circle(point.x, point.y, 14 + effect.age * 2);
      burst.fill({ color: teamColor, alpha: 0.12 * effect.intensity * lifeRatio });
      burst.stroke({ color: teamColor, width: 2, alpha: 0.72 * effect.intensity * lifeRatio });
    }
    container.addChild(burst);

    const label = new Text({ text: effect.label, style: labelStyle });
    label.x = point.x - label.width / 2;
    label.y = point.y - 28;
    label.alpha = effect.intensity * lifeRatio;
    container.addChild(label);
  });
}

function drawPlayers(
  container: Container,
  model: BattlefieldFrameModel,
  width: number,
  height: number,
  previousPoints: Map<string, { x: number; y: number }>,
) {
  while (container.children.length > 0) container.removeChildAt(0);
  const levelStyle = new TextStyle({ fontSize: 10, fill: '#ffffff', fontWeight: '800' });
  const nameStyle = new TextStyle({ fontSize: 10, fill: '#e9eef2', fontWeight: '700' });
  const badgeStyle = new TextStyle({ fontSize: 8, fill: '#081320', fontWeight: '900' });
  const activityStyle = new TextStyle({ fontSize: 8, fill: '#dce6f5', fontWeight: '700' });
  const statusStyle = new TextStyle({ fontSize: 8, fill: '#f9f4de', fontWeight: '800' });

  model.players.forEach((player) => {
    const nextPoint = project({ x: player.screenX, y: player.screenY }, width, height);
    const prevPoint = previousPoints.get(player.id) ?? nextPoint;
    const point = {
      x: lerp(prevPoint.x, nextPoint.x, 0.28),
      y: lerp(prevPoint.y, nextPoint.y, 0.28),
    };
    previousPoints.set(player.id, point);
    const teamColor = player.side === 'home' ? BLUE : RED;

    const shadow = new Graphics();
    shadow.ellipse(point.x, point.y + 10, 14, 7);
    shadow.fill({ color: 0x02060c, alpha: 0.42 });
    container.addChild(shadow);

    if (player.highlight) {
      const ring = new Graphics();
      ring.circle(point.x, point.y, 18);
      ring.stroke({ color: teamColor, width: 2.5, alpha: 0.84 });
      container.addChild(ring);
    }

    if (player.powerSpike) {
      const spike = new Graphics();
      spike.star(point.x, point.y - 18, 4, 7, 3.5, 0.4);
      spike.fill({ color: GOLD, alpha: 0.95 });
      container.addChild(spike);
    }

    const token = new Graphics();
    token.circle(point.x, point.y, 15);
    token.fill({ color: 0x0c1622, alpha: 0.95 });
    token.stroke({ color: teamColor, width: 3, alpha: 0.92 });
    token.circle(point.x, point.y, 10);
    token.fill({ color: teamColor, alpha: 0.95 });
    container.addChild(token);

    const championBadge = new Text({ text: getChampionBadge(player.championId), style: badgeStyle });
    championBadge.x = point.x - championBadge.width / 2;
    championBadge.y = point.y - championBadge.height / 2 - 1;
    container.addChild(championBadge);

    const healthBg = new Graphics();
    healthBg.roundRect(point.x - 20, point.y - 26, 40, 5, 2);
    healthBg.fill({ color: 0x071017, alpha: 0.92 });
    healthBg.roundRect(point.x - 20, point.y - 26, 40 * player.healthPct, 5, 2);
    healthBg.fill({ color: 0x63d46a, alpha: 0.96 });
    container.addChild(healthBg);

    const levelBadge = new Graphics();
    levelBadge.circle(point.x + 15, point.y + 13, 7);
    levelBadge.fill({ color: GOLD, alpha: 0.95 });
    container.addChild(levelBadge);

    const levelText = new Text({ text: String(player.level), style: levelStyle });
    levelText.x = point.x + 15 - levelText.width / 2;
    levelText.y = point.y + 13 - levelText.height / 2;
    container.addChild(levelText);

    const name = new Text({ text: player.name, style: nameStyle });
    name.x = point.x - name.width / 2;
    name.y = point.y + 20;
    container.addChild(name);

    const activity = new Text({ text: player.activity.toUpperCase(), style: activityStyle });
    activity.x = point.x - activity.width / 2;
    activity.y = point.y + 32;
    activity.alpha = 0.82;
    container.addChild(activity);

    const statusBg = new Graphics();
    const statusColor =
      player.statusTag === 'recalling'
        ? 0xa78bfa
        : player.statusTag === 'objective'
          ? GOLD
          : player.statusTag === 'skirmishing'
            ? 0xff8a65
            : player.statusTag === 'rotating'
              ? 0x67c8ff
              : 0x6dd3a1;
    statusBg.roundRect(point.x - 18, point.y - 42, 36, 10, 5);
    statusBg.fill({ color: statusColor, alpha: 0.85 });
    container.addChild(statusBg);

    const status = new Text({
      text:
        player.statusTag === 'recalling'
          ? 'BASE'
          : player.statusTag === 'objective'
            ? 'OBJ'
            : player.statusTag === 'skirmishing'
              ? 'FIGHT'
              : player.statusTag === 'rotating'
                ? 'MOVE'
                : 'SET',
      style: statusStyle,
    });
    status.x = point.x - status.width / 2;
    status.y = point.y - 41;
    container.addChild(status);
  });
}

function drawCameraOverlay(graphics: Graphics, model: BattlefieldFrameModel, width: number, height: number) {
  graphics.clear();
  const point = project({ x: model.camera.x, y: model.camera.y }, width, height);
  const focusAlpha = model.camera.intensity === 'clash' ? 0.08 : model.camera.intensity === 'tracking' ? 0.05 : 0.03;
  graphics.ellipse(point.x, point.y, 170 / model.camera.zoom, 92 / model.camera.zoom);
  graphics.fill({ color: 0xffffff, alpha: focusAlpha });
  graphics.stroke({ color: model.camera.intensity === 'clash' ? GOLD : 0xffffff, width: 1.2, alpha: 0.24 });

  graphics.roundRect(18, height - 52, 220, 30, 14);
  graphics.fill({ color: 0x040a12, alpha: 0.76 });
  graphics.stroke({ color: 0xffffff, width: 1, alpha: 0.12 });

  if (model.focusEvent) {
    graphics.roundRect(width / 2 - 120, 14, 240, 28, 14);
    graphics.fill({ color: 0x050b13, alpha: 0.72 });
    graphics.stroke({ color: model.focusEvent.side === 'home' ? BLUE : RED, width: 1.4, alpha: 0.8 });
  }
}

export function useBattlefieldScene(
  model: BattlefieldFrameModel,
  width: number,
  height: number,
  cameraOverride?: BattlefieldCameraModel | null,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const baseRef = useRef<Graphics | null>(null);
  const objectivesRef = useRef<Container | null>(null);
  const effectsRef = useRef<Container | null>(null);
  const playersRef = useRef<Container | null>(null);
  const overlayRef = useRef<Graphics | null>(null);
  const previousPointsRef = useRef(new Map<string, { x: number; y: number }>());
  const latestModelRef = useRef(model);

  useEffect(() => {
    latestModelRef.current = model;
  }, [model]);

  useEffect(() => {
    if (!containerRef.current) return;

    const app = new Application();
    let cancelled = false;
    const previousPoints = previousPointsRef.current;

    const init = async () => {
      await app.init({ width, height, backgroundAlpha: 0, antialias: true });
      if (cancelled) {
        app.destroy(true);
        return;
      }

      containerRef.current?.appendChild(app.canvas);
      appRef.current = app;

      const world = new Container();
      const base = new Graphics();
      const objectives = new Container();
      const effects = new Container();
      const players = new Container();
      const overlay = new Graphics();

      world.addChild(base, objectives, effects, players);
      app.stage.addChild(world, overlay);
      worldRef.current = world;
      baseRef.current = base;
      objectivesRef.current = objectives;
      effectsRef.current = effects;
      playersRef.current = players;
      overlayRef.current = overlay;

      drawBase(base, width, height);
      drawObjectives(objectives, latestModelRef.current, width, height);
      drawEffects(effects, latestModelRef.current, width, height);
      drawPlayers(players, latestModelRef.current, width, height, previousPoints);
      drawCameraOverlay(overlay, latestModelRef.current, width, height);
    };

    void init();

    return () => {
      cancelled = true;
      appRef.current?.destroy(true);
      appRef.current = null;
      baseRef.current = null;
      objectivesRef.current = null;
      effectsRef.current = null;
      playersRef.current = null;
      overlayRef.current = null;
      worldRef.current = null;
      previousPoints.clear();
    };
  }, [height, width]);

  useEffect(() => {
    if (!appRef.current || !worldRef.current || !baseRef.current || !objectivesRef.current || !effectsRef.current || !playersRef.current || !overlayRef.current) {
      return;
    }

    drawBase(baseRef.current, width, height);
    drawObjectives(objectivesRef.current, model, width, height);
    drawEffects(effectsRef.current, model, width, height);
    drawPlayers(playersRef.current, model, width, height, previousPointsRef.current);
    const effectiveCamera = cameraOverride ?? model.camera;
    drawCameraOverlay(overlayRef.current, { ...model, camera: effectiveCamera }, width, height);

    const cameraPoint = project({ x: effectiveCamera.x, y: effectiveCamera.y }, width, height);
    worldRef.current.scale.set(effectiveCamera.zoom);
    worldRef.current.position.set(
      width / 2 - cameraPoint.x * effectiveCamera.zoom,
      height / 2 - cameraPoint.y * effectiveCamera.zoom,
    );
  }, [cameraOverride, height, model, width]);

  return containerRef;
}
