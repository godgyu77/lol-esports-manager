import { PlayerIdentityCard } from '../../components/PlayerIdentityCard';
import { CHAMPION_DB } from '../../data/championDb';
import type { LiveGameState, LivePlayerStat } from '../../engine/match/liveMatch';
import './match.css';

interface TeamStatusBoardProps {
  title: string;
  side: 'home' | 'away';
  gameState: LiveGameState;
  playerStats: LivePlayerStat[];
}

function getZoneLabel(zone: string) {
  const labels: Record<string, string> = {
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
  return labels[zone] ?? zone.replace('_', ' ');
}

function getActivityLabel(activity: string) {
  const labels: Record<string, string> = {
    laning: '라인전',
    rotating: '합류 중',
    farming: '파밍',
    objective: '오브젝트 압박',
    teamfight: '한타 교전',
    reset: '재정비',
  };
  return labels[activity] ?? activity;
}

function findMapMeta(gameState: LiveGameState, playerId: string) {
  return gameState.playerMapStates.find((entry) => entry.playerId === playerId);
}

function getStatus(player: LivePlayerStat, highlighted: boolean) {
  if (highlighted) return { label: '포커스', tone: 'good' as const };
  if (player.deaths >= player.kills + 2) return { label: '회복 필요', tone: 'warning' as const };
  if (player.kills >= player.deaths + 2) return { label: '탄력 받음', tone: 'good' as const };
  return { label: '운영 중', tone: 'neutral' as const };
}

function buildMatchTags(player: LivePlayerStat): string[] {
  const tags: string[] = [];
  const champion = CHAMPION_DB.find((entry) => entry.id === player.championId);

  if (champion) {
    tags.push(champion.nameKo);
  }

  tags.push(player.comfortPick ? '주력픽' : '전략픽');

  if (player.form >= 72) {
    tags.push('폼 좋음');
  } else if (player.form < 45) {
    tags.push('폼 불안');
  }

  return tags;
}

export function TeamStatusBoard({ title, side, gameState, playerStats }: TeamStatusBoardProps) {
  const sideClass = side === 'home' ? 'match-side-board--home' : 'match-side-board--away';
  const lead = side === 'home' ? gameState.goldHome - gameState.goldAway : gameState.goldAway - gameState.goldHome;
  const accentColor = side === 'home' ? '#3b82f6' : '#ef4444';

  return (
    <section className={`match-side-board ${sideClass}`}>
      <header className="match-side-board__header">
        <div>
          <h3 className="match-side-board__title">{title}</h3>
          <p className="match-side-board__sub">
            {lead >= 0 ? `+${Math.round(lead / 100) / 10}k 우세` : `${Math.round(lead / 100) / 10}k 열세`}
          </p>
        </div>
        <div className="match-side-board__teamline">
            <span>{side === 'home' ? gameState.killsHome : gameState.killsAway}킬</span>
            <span>{side === 'home' ? gameState.towersHome : gameState.towersAway}타워</span>
            <span>{side === 'home' ? gameState.dragonsHome : gameState.dragonsAway}드래곤</span>
        </div>
      </header>

      <div className="match-side-board__players">
        {playerStats.map((player) => {
          const mapMeta = findMapMeta(gameState, player.playerId);
          const status = getStatus(player, Boolean(mapMeta?.highlight));
          return (
            <div key={player.playerId} className={`match-side-player ${mapMeta?.highlight ? 'match-side-player--highlight' : ''}`}>
              <PlayerIdentityCard
                name={player.playerName}
                position={player.position}
                accentColor={accentColor}
                subtitle={`${player.kills}/${player.deaths}/${player.assists} 평점`}
                tags={buildMatchTags(player)}
                meta={mapMeta ? `${getZoneLabel(mapMeta.zone)} | ${getActivityLabel(mapMeta.activity)}` : '맵 정보 수집 중'}
                statusLabel={status.label}
                statusTone={status.tone}
                compact
                highlighted={Boolean(mapMeta?.highlight)}
              />
              <div className="match-side-player__row">
                <span>{player.cs} CS</span>
                <span>{Math.round(player.goldEarned / 100) / 10}k</span>
                <span>{Math.round(player.damageDealt / 1000)}k 피해</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
