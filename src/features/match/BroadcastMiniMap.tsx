import type { LiveGameState } from '../../engine/match/liveMatch';
import { MatchMinimap } from './MatchMinimap';
import './match.css';

interface BroadcastMiniMapProps {
  gameState: LiveGameState;
}

export function BroadcastMiniMap({ gameState }: BroadcastMiniMapProps) {
  const zoneLabels: Record<string, string> = {
    home_base: '블루 본진',
    away_base: '레드 본진',
    top_lane: '탑 라인',
    mid_lane: '미드 라인',
    bot_lane: '봇 라인',
    top_river: '상단 강가',
    mid_river: '중앙 강가',
    bot_river: '하단 강가',
    home_jungle: '블루 정글',
    away_jungle: '레드 정글',
    dragon_pit: '드래곤 둥지',
    baron_pit: '바론 둥지',
    center: '중앙',
  };
  return (
    <section className="broadcast-minimap-panel">
      <div className="broadcast-minimap-panel__header">
        <h3>매크로 맵</h3>
        <span>{zoneLabels[gameState.cameraZone] ?? gameState.cameraZone.replace(/_/g, ' ')}</span>
      </div>
      <MatchMinimap gameState={gameState} width={248} height={248} />
    </section>
  );
}
