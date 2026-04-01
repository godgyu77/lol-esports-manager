import { PlayerIdentityCard } from '../../components/PlayerIdentityCard';
import type { TeamDraftState } from '../../engine/draft/draftEngine';
import type { Champion } from '../../types/champion';
import type { Player } from '../../types/player';
import './draft.css';

interface PickSectionProps {
  sideLabel: string;
  picks: TeamDraftState['picks'];
  color: string;
  championDb: Champion[];
  rosterPlayers: Player[];
}

function getMoraleStatus(morale: number | undefined): { label: string; tone: 'good' | 'warning' | 'danger' | 'neutral' } {
  if (typeof morale !== 'number') return { label: '정보 없음', tone: 'neutral' };
  if (morale >= 75) return { label: '상승세', tone: 'good' };
  if (morale >= 55) return { label: '안정적', tone: 'neutral' };
  if (morale >= 40) return { label: '주의', tone: 'warning' };
  return { label: '흔들림', tone: 'danger' };
}

function buildPlayerTags(player: Player | undefined, championId: string, championDb: Champion[]): string[] {
  if (!player) return [];

  const tags: string[] = [];
  const topPool = [...player.championPool]
    .sort((left, right) => right.proficiency - left.proficiency)
    .slice(0, 3);

  if (topPool.some((entry) => entry.championId === championId)) {
    tags.push('시그니처 픽');
  }

  if (player.mental.morale >= 75) {
    tags.push('폼 좋음');
  } else if (player.mental.morale < 45) {
    tags.push('기복 주의');
  }

  const signatureChamp = championDb.find((champion) => champion.id === topPool[0]?.championId);
  if (signatureChamp) {
    tags.push(`주력 ${signatureChamp.nameKo}`);
  }

  return tags;
}

export function PickSection({ sideLabel, picks, color, championDb, rosterPlayers }: PickSectionProps) {
  return (
    <div className="draft-pick-column">
      <div className="draft-pick-column-header">
        <span>{sideLabel}</span>
      </div>
      {picks.map((pick) => {
        const champ = championDb.find((entry) => entry.id === pick.championId);
        const player = rosterPlayers.find((entry) => entry.position === pick.position);
        const morale = getMoraleStatus(player?.mental.morale);

        return (
          <div key={pick.position} className="draft-pick-slot" style={{ borderLeftColor: color }}>
            <PlayerIdentityCard
              name={player?.name ?? '선수 미정'}
              position={pick.position}
              accentColor={color}
              subtitle={champ?.nameKo ?? champ?.name ?? pick.championId}
              tags={buildPlayerTags(player, pick.championId, championDb)}
              meta="픽 단계에서는 자유 선택, 마지막 스왑에서 자리 확정"
              statusLabel={morale.label}
              statusTone={morale.tone}
              compact
            />
          </div>
        );
      })}
      {Array.from({ length: Math.max(0, 5 - picks.length) }).map((_, index) => (
        <div key={`empty-${index}`} className="draft-pick-slot--empty" style={{ borderLeftColor: `${color}33` }}>
          <span className="draft-pick-empty-text">대기 중</span>
        </div>
      ))}
    </div>
  );
}
