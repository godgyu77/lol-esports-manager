/**
 * 3D 미니맵 시각화 컴포넌트
 * - Three.js 기반 3D 캔버스 렌더링
 * - 10명 플레이어 위치 표시 (블루 5, 레드 5)
 * - 이벤트 발생 시 링 이펙트 애니메이션
 * - 마우스 드래그 카메라 회전 + 휠 줌
 * - 스탯 오버레이 (HTML div)
 */

import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import type { MatchEvent, MatchEventType } from '../../types/match';

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────

interface MatchMinimap3DProps {
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
const HOME_COLOR = 0x4488ff;
const AWAY_COLOR = 0xff4444;
const LERP_SPEED = 0.15;
const FLASH_DURATION_TICKS = 3;

/** 이벤트 타입별 플래시 색상 */
const EVENT_FLASH_COLORS: Partial<Record<MatchEventType, number>> = {
  kill: 0xffdd44,
  dragon: 0xaa44ff,
  baron: 0xff44cc,
  tower_destroy: 0xff8800,
  teamfight: 0xffdd44,
  gank: 0xffdd44,
};

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

/** 타워 위치 (0~1 정규화) */
const TOWER_POSITIONS = [
  // 홈 타워 (블루) - 8개
  { x: 0.10, y: 0.55 }, { x: 0.10, y: 0.30 }, { x: 0.15, y: 0.15 }, // 탑
  { x: 0.30, y: 0.70 }, { x: 0.40, y: 0.60 },                       // 미드
  { x: 0.55, y: 0.90 }, { x: 0.30, y: 0.90 }, { x: 0.15, y: 0.85 }, // 봇
  // 어웨이 타워 (레드) - 8개
  { x: 0.90, y: 0.45 }, { x: 0.90, y: 0.70 }, { x: 0.85, y: 0.85 }, // 탑
  { x: 0.70, y: 0.30 }, { x: 0.60, y: 0.40 },                       // 미드
  { x: 0.45, y: 0.10 }, { x: 0.70, y: 0.10 }, { x: 0.85, y: 0.15 }, // 봇
];

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

/** 정규화 좌표(0~1)를 3D 월드 좌표로 변환 */
const normTo3D = (nx: number, ny: number, y = 0): THREE.Vector3 => {
  return new THREE.Vector3((nx - 0.5) * 10, y, (ny - 0.5) * 10);
};

/**
 * 틱과 플레이어 인덱스 기반으로 정규화 위치를 생성한다.
 * 기존 2D 미니맵의 getPlayerPosition 로직을 정규화 좌표(0~1)로 반환.
 */
const getPlayerNormPosition = (
  tick: number,
  playerIndex: number,
  side: 'home' | 'away',
): { x: number; y: number } => {
  const lane = ROLE_LANE[playerIndex] ?? 'mid';
  const path = LANE_PATHS[lane];

  const progress = Math.min(tick / 45, 1);
  const pathProgress = progress * (path.length - 1);
  const segIndex = Math.min(Math.floor(pathProgress), path.length - 2);
  const segT = pathProgress - segIndex;

  const baseX = path[segIndex].x + (path[segIndex + 1].x - path[segIndex].x) * segT;
  const baseY = path[segIndex].y + (path[segIndex + 1].y - path[segIndex].y) * segT;

  const flippedX = side === 'away' ? 1 - baseX : baseX;
  const flippedY = side === 'away' ? 1 - baseY : baseY;

  const seed = playerIndex * 137 + tick * 7;
  const offsetX = Math.sin(seed * 0.1) * 0.03;
  const offsetY = Math.cos(seed * 0.13) * 0.03;

  return {
    x: Math.max(0, Math.min(1, flippedX + offsetX)),
    y: Math.max(0, Math.min(1, flippedY + offsetY)),
  };
};

// ─────────────────────────────────────────
// 이벤트 이펙트 타입
// ─────────────────────────────────────────

interface EventEffect {
  mesh: THREE.Mesh;
  startTick: number;
  duration: number;
}

// ─────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────

export function MatchMinimap3D({
  gameState,
  homePlayerIds,
  awayPlayerIds,
  width = DEFAULT_SIZE,
  height = DEFAULT_SIZE,
}: MatchMinimap3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Three.js 오브젝트 refs (렌더 루프에서 사용)
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerMeshesRef = useRef<THREE.Mesh[]>([]);
  const eventEffectsRef = useRef<EventEffect[]>([]);
  const processedEventsRef = useRef<Set<string>>(new Set());

  // Lerp 보간용 목표/현재 위치
  const targetPositions = useRef<Map<string, THREE.Vector3>>(new Map());
  const currentPositions = useRef<Map<string, THREE.Vector3>>(new Map());

  // 카메라 컨트롤 상태
  const cameraState = useRef({
    theta: 0,          // 수평 각도 (라디안)
    phi: Math.PI / 2,  // 수직 각도 (탑다운 = PI/2)
    distance: 12,
    isDragging: false,
    lastX: 0,
    lastY: 0,
  });

  // 스탯 오버레이
  const [overlayStats, setOverlayStats] = useState({
    killsHome: 0, killsAway: 0,
    towersHome: 0, towersAway: 0,
    dragonsHome: 0, dragonsAway: 0,
    isFinished: false,
  });

  // ─── Three.js Scene 초기화 ───
  useEffect(() => {
    if (!containerRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera (OrthographicCamera, 탑다운 뷰)
    const aspect = width / height;
    const frustum = 6;
    const camera = new THREE.OrthographicCamera(
      -frustum * aspect, frustum * aspect,
      frustum, -frustum,
      0.1, 100,
    );
    camera.position.set(0, 12, 0);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a1a0a, 1);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ─── 조명 ───
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    // ─── 바닥 ───
    const floorGeo = new THREE.PlaneGeometry(10, 10);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0a1a0a });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // ─── 라인 경로 (탑, 미드, 봇) ───
    const laneMaterial = new THREE.LineBasicMaterial({ color: 0x2a3a2a });
    for (const path of Object.values(LANE_PATHS)) {
      const points = path.map((p) => normTo3D(p.x, p.y, 0.01));
      const laneGeo = new THREE.BufferGeometry().setFromPoints(points);
      const laneLine = new THREE.Line(laneGeo, laneMaterial);
      scene.add(laneLine);
    }

    // ─── 강 (리버) ───
    const riverPoints = [normTo3D(0.25, 0.75, 0.01), normTo3D(0.75, 0.25, 0.01)];
    const riverGeo = new THREE.BufferGeometry().setFromPoints(riverPoints);
    const riverMat = new THREE.LineBasicMaterial({ color: 0x1a3a5a });
    const riverLine = new THREE.Line(riverGeo, riverMat);
    scene.add(riverLine);

    // ─── 타워 (16개) ───
    const towerGeo = new THREE.BoxGeometry(0.15, 0.3, 0.15);
    for (let i = 0; i < TOWER_POSITIONS.length; i++) {
      const tp = TOWER_POSITIONS[i];
      const isHome = i < 8;
      const towerMat = new THREE.MeshStandardMaterial({
        color: isHome ? HOME_COLOR : AWAY_COLOR,
        emissive: isHome ? 0x112244 : 0x441111,
      });
      const tower = new THREE.Mesh(towerGeo, towerMat);
      const pos = normTo3D(tp.x, tp.y, 0.15);
      tower.position.copy(pos);
      scene.add(tower);
    }

    // ─── 드래곤 pit ───
    const dragonGeo = new THREE.CircleGeometry(0.5, 32);
    const dragonMat = new THREE.MeshStandardMaterial({
      color: 0xaa44ff,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });
    const dragonPit = new THREE.Mesh(dragonGeo, dragonMat);
    const dragonPos = normTo3D(0.62, 0.62, 0.005);
    dragonPit.position.copy(dragonPos);
    dragonPit.rotation.x = -Math.PI / 2;
    scene.add(dragonPit);

    // ─── 바론 pit ───
    const baronGeo = new THREE.CircleGeometry(0.5, 32);
    const baronMat = new THREE.MeshStandardMaterial({
      color: 0xff44cc,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });
    const baronPit = new THREE.Mesh(baronGeo, baronMat);
    const baronPos = normTo3D(0.38, 0.38, 0.005);
    baronPit.position.copy(baronPos);
    baronPit.rotation.x = -Math.PI / 2;
    scene.add(baronPit);

    // ─── 기지 (홈/어웨이) ───
    const baseGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 32);

    const homeBaseMat = new THREE.MeshStandardMaterial({
      color: HOME_COLOR,
      emissive: 0x112244,
      transparent: true,
      opacity: 0.5,
    });
    const homeBase = new THREE.Mesh(baseGeo, homeBaseMat);
    const homeBasePos = normTo3D(0.05, 0.95, 0.1);
    homeBase.position.copy(homeBasePos);
    scene.add(homeBase);

    const awayBaseMat = new THREE.MeshStandardMaterial({
      color: AWAY_COLOR,
      emissive: 0x441111,
      transparent: true,
      opacity: 0.5,
    });
    const awayBase = new THREE.Mesh(baseGeo, awayBaseMat);
    const awayBasePos = normTo3D(0.95, 0.05, 0.1);
    awayBase.position.copy(awayBasePos);
    scene.add(awayBase);

    // ─── 플레이어 (10명) ───
    const playerGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const meshes: THREE.Mesh[] = [];

    for (let i = 0; i < 10; i++) {
      const isHome = i < 5;
      const mat = new THREE.MeshStandardMaterial({
        color: isHome ? HOME_COLOR : AWAY_COLOR,
        emissive: isHome ? 0x223366 : 0x662222,
        emissiveIntensity: 0.3,
      });
      const mesh = new THREE.Mesh(playerGeo, mat);
      mesh.position.set(0, 0.15, 0);
      scene.add(mesh);
      meshes.push(mesh);
    }
    playerMeshesRef.current = meshes;

    // ─── 카메라 컨트롤 이벤트 ───
    const canvas = renderer.domElement;

    const onMouseDown = (e: MouseEvent) => {
      cameraState.current.isDragging = true;
      cameraState.current.lastX = e.clientX;
      cameraState.current.lastY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!cameraState.current.isDragging) return;
      const dx = e.clientX - cameraState.current.lastX;
      const dy = e.clientY - cameraState.current.lastY;
      cameraState.current.lastX = e.clientX;
      cameraState.current.lastY = e.clientY;
      cameraState.current.theta -= dx * 0.005;
      cameraState.current.phi = Math.max(0.2, Math.min(Math.PI / 2, cameraState.current.phi - dy * 0.005));
    };

    const onMouseUp = () => {
      cameraState.current.isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = cameraRef.current;
      if (!cam) return;
      cam.zoom = Math.max(0.5, Math.min(3, cam.zoom - e.deltaY * 0.001));
      cam.updateProjectionMatrix();
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // ─── 렌더 루프 ───
    let animId = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      // 플레이어 lerp 업데이트
      const meshArr = playerMeshesRef.current;
      for (let i = 0; i < meshArr.length; i++) {
        const key = i < 5 ? `h${i}` : `a${i - 5}`;
        const target = targetPositions.current.get(key);
        if (!target) continue;

        let curr = currentPositions.current.get(key);
        if (!curr) {
          curr = target.clone();
          currentPositions.current.set(key, curr);
        }

        curr.x += (target.x - curr.x) * LERP_SPEED;
        curr.z += (target.z - curr.z) * LERP_SPEED;

        meshArr[i].position.x = curr.x;
        meshArr[i].position.z = curr.z;
        meshArr[i].position.y = 0.15;
      }

      // 이벤트 이펙트 업데이트
      const effects = eventEffectsRef.current;
      for (let i = effects.length - 1; i >= 0; i--) {
        const eff = effects[i];
        const age = (Date.now() - eff.startTick) / 500; // 0.5초 기준 애니메이션
        if (age > 1) {
          sceneRef.current?.remove(eff.mesh);
          eff.mesh.geometry.dispose();
          (eff.mesh.material as THREE.Material).dispose();
          effects.splice(i, 1);
          continue;
        }
        const scale = 0.3 + age * 1.5;
        eff.mesh.scale.set(scale, scale, scale);
        const mat = eff.mesh.material as THREE.MeshStandardMaterial;
        mat.opacity = (1 - age) * 0.6;
      }

      // 카메라 궤도 업데이트
      const cs = cameraState.current;
      const cam = cameraRef.current;
      if (cam) {
        cam.position.x = cs.distance * Math.sin(cs.phi) * Math.sin(cs.theta);
        cam.position.y = cs.distance * Math.cos(cs.phi);
        cam.position.z = cs.distance * Math.sin(cs.phi) * Math.cos(cs.theta);
        cam.lookAt(0, 0, 0);
        cam.updateProjectionMatrix();
      }

      renderer.render(scene, camera);
    };

    animate();

    // ─── 클린업 (ref를 로컬 변수로 캡처) ───
    const capturedEventEffects = eventEffectsRef.current;
    const capturedProcessedEvents = processedEventsRef.current;
    const capturedPlayerMeshes = playerMeshesRef.current;
    const capturedContainer = containerRef.current;
    const capturedTargets = targetPositions.current;
    const capturedCurrents = currentPositions.current;

    return () => {
      cancelAnimationFrame(animId);

      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);

      // 이펙트 정리
      for (const eff of capturedEventEffects) {
        eff.mesh.geometry.dispose();
        (eff.mesh.material as THREE.Material).dispose();
      }
      eventEffectsRef.current = [];
      capturedProcessedEvents.clear();

      // 플레이어 메시 정리
      for (const mesh of capturedPlayerMeshes) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      playerMeshesRef.current = [];

      // Scene 전체 정리
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });

      renderer.dispose();
      if (capturedContainer && renderer.domElement.parentNode === capturedContainer) {
        capturedContainer.removeChild(renderer.domElement);
      }

      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      capturedTargets.clear();
      capturedCurrents.clear();
    };
  }, [width, height]);

  // ─── gameState 업데이트 ───
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // 1. 플레이어 목표 위치 업데이트
    for (let i = 0; i < Math.min(homePlayerIds.length, 5); i++) {
      const norm = getPlayerNormPosition(gameState.currentTick, i, 'home');
      const pos3d = normTo3D(norm.x, norm.y, 0.15);
      targetPositions.current.set(`h${i}`, pos3d);
    }
    for (let i = 0; i < Math.min(awayPlayerIds.length, 5); i++) {
      const norm = getPlayerNormPosition(gameState.currentTick, i, 'away');
      const pos3d = normTo3D(norm.x, norm.y, 0.15);
      targetPositions.current.set(`a${i}`, pos3d);
    }

    // 2. 새 이벤트 감지 -> 이펙트 생성
    for (const evt of gameState.events) {
      const age = gameState.currentTick - evt.tick;
      if (age < 0 || age > FLASH_DURATION_TICKS) continue;

      const evtKey = `${evt.tick}-${evt.type}-${evt.side}`;
      if (processedEventsRef.current.has(evtKey)) continue;
      processedEventsRef.current.add(evtKey);

      const color = EVENT_FLASH_COLORS[evt.type] ?? 0xffffff;

      // 이벤트 위치 결정
      let ex: number;
      let ey: number;
      if (evt.position) {
        ex = Math.max(0, Math.min(1, evt.position.x));
        ey = Math.max(0, Math.min(1, evt.position.y));
      } else {
        const baseX = evt.type === 'dragon' ? 0.7 : evt.type === 'baron' ? 0.3 : 0.5;
        const baseY = evt.type === 'dragon' ? 0.7 : evt.type === 'baron' ? 0.3 : 0.5;
        const sideOffset = evt.side === 'home' ? -0.05 : 0.05;
        ex = Math.max(0, Math.min(1, baseX + sideOffset));
        ey = Math.max(0, Math.min(1, baseY + sideOffset));
      }

      const ringGeo = new THREE.RingGeometry(0.2, 0.35, 32);
      const ringMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      const pos3d = normTo3D(ex, ey, 0.02);
      ring.position.copy(pos3d);
      ring.rotation.x = -Math.PI / 2;
      scene.add(ring);

      eventEffectsRef.current.push({
        mesh: ring,
        startTick: Date.now(),
        duration: FLASH_DURATION_TICKS,
      });
    }

    // 3. 스탯 오버레이 업데이트
    // eslint-disable-next-line react-hooks/set-state-in-effect -- gameState prop 변경 시 오버레이 동기화
    setOverlayStats({
      killsHome: gameState.killsHome,
      killsAway: gameState.killsAway,
      towersHome: gameState.towersHome,
      towersAway: gameState.towersAway,
      dragonsHome: gameState.dragonsHome,
      dragonsAway: gameState.dragonsAway,
      isFinished: gameState.isFinished,
    });
  }, [gameState, homePlayerIds, awayPlayerIds]);

  return (
    <div
      className="minimap-3d-container"
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: 'var(--radius-lg, 12px)',
        overflow: 'hidden',
        border: '1px solid var(--border, #2a2a3a)',
      }}
    >
      <div ref={containerRef} style={{ width, height }} />

      {/* 홈 팀 스탯 (좌하단) */}
      <div
        style={{
          position: 'absolute',
          bottom: 4,
          left: 6,
          fontSize: 9,
          fontFamily: 'monospace',
          color: '#6688cc',
          pointerEvents: 'none',
          textShadow: '0 0 3px rgba(0,0,0,0.8)',
        }}
      >
        K:{overlayStats.killsHome} T:{overlayStats.towersHome} D:{overlayStats.dragonsHome}
      </div>

      {/* 어웨이 팀 스탯 (우상단) */}
      <div
        style={{
          position: 'absolute',
          top: 4,
          right: 6,
          fontSize: 9,
          fontFamily: 'monospace',
          color: '#cc6666',
          pointerEvents: 'none',
          textShadow: '0 0 3px rgba(0,0,0,0.8)',
        }}
      >
        K:{overlayStats.killsAway} T:{overlayStats.towersAway} D:{overlayStats.dragonsAway}
      </div>

      {/* 종료 표시 */}
      {overlayStats.isFinished && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 14,
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#c89b3c',
            pointerEvents: 'none',
            textShadow: '0 0 6px rgba(0,0,0,0.9)',
          }}
        >
          FINISHED
        </div>
      )}
    </div>
  );
}
