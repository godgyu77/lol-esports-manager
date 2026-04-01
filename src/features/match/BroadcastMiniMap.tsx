import type { LiveGameState } from '../../engine/match/liveMatch';
import { MatchMinimap } from './MatchMinimap';
import './match.css';

interface BroadcastMiniMapProps {
  gameState: LiveGameState;
}

export function BroadcastMiniMap({ gameState }: BroadcastMiniMapProps) {
  return (
    <section className="broadcast-minimap-panel">
      <div className="broadcast-minimap-panel__header">
        <h3>Macro Map</h3>
        <span>{gameState.cameraZone.replace(/_/g, ' ')}</span>
      </div>
      <MatchMinimap gameState={gameState} width={248} height={248} />
    </section>
  );
}
