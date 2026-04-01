import { useEffect, useState } from 'react';
import type { LiveGameState } from '../../engine/match/liveMatch';
import { buildBattlefieldFrame, buildReplayCamera } from './battlefieldModel';
import { useBattlefieldScene } from './useBattlefieldScene';
import './match.css';

interface BroadcastBattlefieldProps {
  gameState: LiveGameState;
  width?: number;
  height?: number;
}

function getBannerTheme(effectType: string) {
  if (effectType === 'pentakill' || effectType === 'ace') return 'finisher';
  if (effectType === 'steal') return 'swing';
  if (effectType === 'baron' || effectType === 'elder_dragon' || effectType === 'dragon') return 'objective';
  if (effectType === 'teamfight' || effectType === 'kill') return 'combat';
  return 'standard';
}

export function BroadcastBattlefield({
  gameState,
  width = 920,
  height = 560,
}: BroadcastBattlefieldProps) {
  const frame = buildBattlefieldFrame(gameState);
  const bannerEffect = frame.effects.find((effect) => effect.visual === 'spotlight' || effect.visual === 'objective' || effect.visual === 'shockwave') ?? frame.effects[0] ?? null;
  const tickerEffects = frame.effects.slice(0, 3);
  const flashEffect = bannerEffect && bannerEffect.age <= 2 ? bannerEffect : null;
  const activePlayers = frame.players.filter((player) => player.highlight || player.statusTag === 'skirmishing' || player.statusTag === 'objective');
  const bannerTheme = bannerEffect ? getBannerTheme(bannerEffect.type) : 'standard';
  const replayQueue = frame.effects
    .filter((effect) => ['spotlight', 'objective', 'shockwave'].includes(effect.visual))
    .slice(0, 3);
  const replayKey = replayQueue.map((effect) => effect.id).join('|');
  const [activeReplayIndex, setActiveReplayIndex] = useState(0);
  const normalizedReplayIndex = replayQueue.length > 0 ? activeReplayIndex % replayQueue.length : 0;

  useEffect(() => {
    if (replayQueue.length <= 1) return;
    const timer = setInterval(() => {
      setActiveReplayIndex((previous) => (previous + 1) % replayQueue.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [replayQueue.length, replayKey]);

  const activeReplay = replayQueue[normalizedReplayIndex] ?? null;
  const replayCamera = activeReplay ? buildReplayCamera(frame, activeReplay) : null;
  const containerRef = useBattlefieldScene(frame, width, height, replayCamera);
  const effectiveCamera = replayCamera ?? frame.camera;

  return (
    <div className="broadcast-stage-shell" style={{ width, height }}>
      <div ref={containerRef} className="broadcast-stage-canvas" style={{ width, height }} />
      {flashEffect ? (
        <div
          className={`broadcast-stage-flash broadcast-stage-flash--${flashEffect.side} broadcast-stage-flash--${flashEffect.visual}`}
        />
      ) : null}
      {bannerEffect ? (
        <div className={`broadcast-stage-banner broadcast-stage-banner--${bannerEffect.side} broadcast-stage-banner--${bannerTheme}`}>
          <span className="broadcast-stage-banner__tag">{bannerEffect.label}</span>
          <strong className="broadcast-stage-banner__headline">{bannerEffect.detail}</strong>
          <div className="broadcast-stage-banner__meta">
            <span>{frame.phase.replace(/_/g, ' ')}</span>
            <span>{frame.tick}:00</span>
            <span>{Math.round(frame.homePressure)} / {Math.round(frame.awayPressure)} pressure</span>
          </div>
        </div>
      ) : null}
      <div className="broadcast-stage-topline">
        <span className={`broadcast-stage-chip broadcast-stage-chip--${effectiveCamera.intensity}`}>
          {effectiveCamera.emphasisLabel}
        </span>
        <span className="broadcast-stage-chip">
          Zoom x{effectiveCamera.zoom.toFixed(2)}
        </span>
      </div>
      {tickerEffects.length > 0 ? (
        <div className="broadcast-stage-ticker">
          {tickerEffects.map((effect) => (
            <span key={effect.id} className={`broadcast-stage-ticker__item broadcast-stage-ticker__item--${effect.side}`}>
              {effect.label}
            </span>
          ))}
        </div>
      ) : null}
      {activePlayers.length > 0 ? (
        <div className="broadcast-stage-cutin">
          {activePlayers.slice(0, 4).map((player) => (
            <span key={player.id} className={`broadcast-stage-cutin__pill broadcast-stage-cutin__pill--${player.side}`}>
              {player.name} {player.statusTag === 'objective' ? 'on objective' : player.statusTag === 'skirmishing' ? 'in fight' : 'spotlight'}
            </span>
          ))}
        </div>
      ) : null}
      {activeReplay ? (
        <div className="broadcast-stage-replay">
          <div className="broadcast-stage-replay__header">
            <span>Replay Queue</span>
            <span>{normalizedReplayIndex + 1} / {replayQueue.length}</span>
          </div>
          <div className={`broadcast-stage-replay__hero broadcast-stage-replay__hero--${activeReplay.side}`}>
            <span className="broadcast-stage-replay__index">0{normalizedReplayIndex + 1}</span>
            <div className="broadcast-stage-replay__copy">
              <strong>{activeReplay.label}</strong>
              <span>{activeReplay.detail}</span>
            </div>
          </div>
          <div className="broadcast-stage-replay__camera">
            <span>Replay Focus</span>
            <span>{Math.round(activeReplay.x * 100)} / {Math.round(activeReplay.y * 100)}</span>
            <span>{effectiveCamera.zoom.toFixed(2)}x</span>
          </div>
          <div className="broadcast-stage-replay__dots">
            {replayQueue.map((effect, index) => (
              <button
                key={`${effect.id}-dot`}
                type="button"
                className={`broadcast-stage-replay__dot ${index === normalizedReplayIndex ? 'is-active' : ''}`}
                onClick={() => setActiveReplayIndex(index)}
                aria-label={`Show replay clip ${index + 1}`}
              />
            ))}
          </div>
          <div className="broadcast-stage-replay__list">
            {replayQueue.map((effect, index) => (
              <div
                key={effect.id}
                className={`broadcast-stage-replay__item broadcast-stage-replay__item--${effect.side} ${index === normalizedReplayIndex ? 'is-active' : ''}`}
              >
                <span className="broadcast-stage-replay__index">0{index + 1}</span>
                <div className="broadcast-stage-replay__copy">
                  <strong>{effect.label}</strong>
                  <span>{effect.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="broadcast-stage-pressure">
        <span className="broadcast-stage-pressure__label">Blue Pressure</span>
        <div className="broadcast-stage-pressure__bar">
          <div
            className="broadcast-stage-pressure__fill"
            style={{ width: `${frame.homePressure}%` }}
          />
        </div>
        <span className="broadcast-stage-pressure__value">{Math.round(frame.homePressure)}%</span>
      </div>
      {frame.focusEvent ? (
        <div className="broadcast-stage-focus">
          <span className="broadcast-stage-focus__label">{frame.focusEvent.label}</span>
          <span className="broadcast-stage-focus__detail">{frame.focusEvent.detail}</span>
        </div>
      ) : null}
    </div>
  );
}
