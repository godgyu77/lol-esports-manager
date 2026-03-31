import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayersByTeamId, getStandings } from '../../../db/queries';
import { getManagerIdentity, getManagerIdentitySummaryLine } from '../../../engine/manager/managerIdentityEngine';
import { getActiveInterventionEffects } from '../../../engine/manager/managerInterventionEngine';
import { generateStaffRecommendations } from '../../../engine/staff/staffEngine';
import { useGameStore } from '../../../stores/gameStore';
import type { Player } from '../../../types/player';
import { POSITION_LABELS_SHORT as POSITION_LABELS } from '../../../utils/constants';

const POSITION_ORDER = ['top', 'jungle', 'mid', 'adc', 'support'] as const;

const POSITION_BADGE_MAP: Record<string, string> = {
  top: 'fm-pos-badge fm-pos-badge--top',
  jungle: 'fm-pos-badge fm-pos-badge--jgl',
  mid: 'fm-pos-badge fm-pos-badge--mid',
  adc: 'fm-pos-badge fm-pos-badge--adc',
  support: 'fm-pos-badge fm-pos-badge--sup',
};

interface MatchImpactCard {
  title: string;
  value: string;
  detail: string;
  tone: 'positive' | 'risk' | 'neutral';
}

function calculateOVR(player: Player): number {
  const { mechanical, gameSense, teamwork, consistency, laning } = player.stats;
  const { mental } = player.mental;
  return Math.round((mechanical + gameSense + teamwork + consistency + laning + mental) / 6);
}

function getOvrClass(ovr: number): string {
  if (ovr >= 90) return 'fm-ovr fm-ovr--elite';
  if (ovr >= 80) return 'fm-ovr fm-ovr--high';
  if (ovr >= 70) return 'fm-ovr fm-ovr--mid';
  return 'fm-ovr fm-ovr--low';
}

function getToneBadgeClass(tone: MatchImpactCard['tone']): string {
  if (tone === 'positive') return 'fm-badge fm-badge--success';
  if (tone === 'risk') return 'fm-badge fm-badge--danger';
  return 'fm-badge fm-badge--default';
}

export function PreMatchView() {
  const navigate = useNavigate();
  const pendingMatch = useGameStore((s) => s.pendingUserMatch);
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);
  const recommendedBans = useGameStore((s) => s.recommendedBans);

  const [opponentPlayers, setOpponentPlayers] = useState<(Player & { division: string })[]>([]);
  const [userPlayers, setUserPlayers] = useState<(Player & { division: string })[]>([]);
  const [opponentStanding, setOpponentStanding] = useState<{ wins: number; losses: number; rank: number } | null>(null);
  const [impactCards, setImpactCards] = useState<MatchImpactCard[]>([]);
  const [loading, setLoading] = useState(true);

  const userTeamId = save?.userTeamId ?? '';
  const opponentTeamId = pendingMatch
    ? pendingMatch.teamHomeId === userTeamId
      ? pendingMatch.teamAwayId
      : pendingMatch.teamHomeId
    : '';

  const userTeam = teams.find((team) => team.id === userTeamId);
  const opponentTeam = teams.find((team) => team.id === opponentTeamId);

  useEffect(() => {
    if (!opponentTeamId || !userTeamId || !season || !userTeam) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [oppPlayers, myPlayers, standings, identity, interventions, recommendations] = await Promise.all([
          getPlayersByTeamId(opponentTeamId),
          getPlayersByTeamId(userTeamId),
          getStandings(season.id),
          save ? getManagerIdentity(save.id).catch(() => null) : Promise.resolve(null),
          getActiveInterventionEffects(season.currentDate).catch(() => new Map()),
          generateStaffRecommendations(userTeam.id, season.id).catch(() => []),
        ]);

        if (cancelled) return;

        setOpponentPlayers(oppPlayers);
        setUserPlayers(myPlayers);

        const sorted = [...standings].sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          return (b.setWins - b.setLosses) - (a.setWins - a.setLosses);
        });
        const oppIdx = sorted.findIndex((standing) => standing.teamId === opponentTeamId);
        const oppStanding = sorted[oppIdx];
        if (oppStanding) {
          setOpponentStanding({ wins: oppStanding.wins, losses: oppStanding.losses, rank: oppIdx + 1 });
        }

        const interventionPlayers = userTeam.roster
          .map((player) => ({ player, effect: interventions.get(player.id) }))
          .filter((entry) => entry.effect);

        const cards: MatchImpactCard[] = [
          {
            title: 'Training read',
            value: recommendedBans.length > 0 ? 'Plan ready' : 'Needs review',
            detail: recommendedBans.length > 0
              ? 'Draft prep already reflects your current tactical focus.'
              : 'Check bans and prep notes before the series starts.',
            tone: recommendedBans.length > 0 ? 'positive' : 'risk',
          },
        ];

        if (interventionPlayers.length > 0) {
          const strongest = interventionPlayers[0];
          cards.push({
            title: 'Recent meeting',
            value: strongest.player.name,
            detail: `${strongest.player.name} carries a live management effect into this match.`,
            tone: 'positive',
          });
        }

        if (recommendations.length > 0) {
          cards.push({
            title: 'Staff recommendation',
            value: recommendations[0].title,
            detail: recommendations[0].summary,
            tone: recommendations[0].urgency === 'high' ? 'risk' : 'neutral',
          });
        }

        if (identity) {
          cards.push({
            title: 'Manager philosophy',
            value: identity.dominantTraits[0] ?? 'Balanced',
            detail: getManagerIdentitySummaryLine(identity),
            tone: 'neutral',
          });
        }

        setImpactCards(cards.slice(0, 4));
      } catch (error) {
        console.warn('[PreMatchView] load failed:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [opponentTeamId, save, season, userTeam, userTeamId, recommendedBans.length]);

  if (!pendingMatch) {
    return (
      <div className="fm-animate-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <p className="fm-text-muted fm-p-md">There is no pending user match.</p>
        <button className="fm-btn" onClick={() => navigate('/manager/day')}>
          Back to day view
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fm-animate-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <p className="fm-text-muted fm-p-md">Loading match preview...</p>
      </div>
    );
  }

  const oppStarters = opponentPlayers
    .filter((player) => player.division === 'main')
    .sort((a, b) => POSITION_ORDER.indexOf(a.position as typeof POSITION_ORDER[number]) - POSITION_ORDER.indexOf(b.position as typeof POSITION_ORDER[number]));

  const userStarters = userPlayers
    .filter((player) => player.division === 'main')
    .sort((a, b) => POSITION_ORDER.indexOf(a.position as typeof POSITION_ORDER[number]) - POSITION_ORDER.indexOf(b.position as typeof POSITION_ORDER[number]));

  const userAverageOvr = userStarters.length > 0
    ? Math.round(userStarters.reduce((sum, player) => sum + calculateOVR(player), 0) / userStarters.length)
    : 0;
  const opponentAverageOvr = oppStarters.length > 0
    ? Math.round(oppStarters.reduce((sum, player) => sum + calculateOVR(player), 0) / oppStarters.length)
    : 0;

  const pressureTag = opponentStanding && opponentStanding.rank <= 3 ? 'High pressure' : 'Manageable';
  const focusCards = [
    {
      title: 'Training focus',
      value: userAverageOvr >= opponentAverageOvr ? 'Sharpen execution' : 'Catch up mechanically',
      detail: 'Use training to tighten weak lanes before draft.',
      route: '/manager/training',
      cta: 'Open training',
    },
    {
      title: 'Tactics plan',
      value: recommendedBans.length > 0 ? 'Draft plan ready' : 'Needs review',
      detail: 'Review bans and lane priorities before you lock in.',
      route: '/manager/tactics',
      cta: 'Open tactics',
    },
    {
      title: 'Roster readiness',
      value: `${userAverageOvr} OVR vs ${opponentAverageOvr} OVR`,
      detail: 'Starter strength is the quickest read on today’s matchup.',
      route: '/manager/roster',
      cta: 'Open roster',
    },
    {
      title: 'Budget pressure',
      value: userTeam ? `${Math.round(userTeam.budget / 1000000)}M budget` : 'Budget unavailable',
      detail: 'Protect long-term spending if this match is not must-win.',
      route: '/manager/finance',
      cta: 'Open finance',
    },
    {
      title: 'Player care',
      value: pressureTag,
      detail: 'If confidence is shaky, check complaints and promises before the series.',
      route: '/manager/complaints',
      cta: 'Open player care',
    },
  ];

  return (
    <div className="fm-animate-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="fm-page-header">
        <h1 className="fm-page-title">Match preparation</h1>
      </div>

      <div
        className="fm-panel fm-card--highlight fm-mb-md"
        style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(200,170,110,0.06) 100%)' }}
      >
        <div className="fm-panel__body">
          <div className="fm-flex fm-items-center fm-justify-center fm-gap-lg fm-p-md">
            <div className="fm-flex-col fm-items-center fm-gap-xs fm-flex-1">
              <span className="fm-text-2xl fm-font-bold fm-text-primary">{userTeam?.shortName ?? userTeamId}</span>
              <span className="fm-text-xs fm-text-muted fm-text-upper">OUR TEAM</span>
            </div>
            <div className="fm-flex-col fm-items-center fm-gap-xs">
              <span className="fm-text-2xl fm-font-bold fm-text-accent">VS</span>
              <span className="fm-badge fm-badge--default">{pendingMatch.boFormat}</span>
            </div>
            <div className="fm-flex-col fm-items-center fm-gap-xs fm-flex-1">
              <span className="fm-text-2xl fm-font-bold fm-text-primary">{opponentTeam?.shortName ?? opponentTeamId}</span>
              {opponentStanding && (
                <span className="fm-text-xs fm-text-muted">
                  #{opponentStanding.rank} ({opponentStanding.wins}-{opponentStanding.losses})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">This match should feel different because</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--2" style={{ gap: '12px' }}>
            {impactCards.map((card) => (
              <div key={`${card.title}-${card.value}`} className="fm-card fm-flex-col fm-gap-sm">
                <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                  <span className="fm-text-sm fm-text-muted fm-text-upper">{card.title}</span>
                  <span className={getToneBadgeClass(card.tone)}>{card.value}</span>
                </div>
                <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>{card.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">Matchday decision levers</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--2" style={{ gap: '12px' }}>
            {focusCards.map((card) => (
              <div key={card.title} className="fm-card fm-flex-col fm-gap-sm">
                <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                  <span className="fm-text-sm fm-text-muted fm-text-upper">{card.title}</span>
                  <span className="fm-badge fm-badge--default">{card.value}</span>
                </div>
                <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>{card.detail}</p>
                <button className="fm-btn fm-btn--sm" onClick={() => navigate(card.route)}>
                  {card.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">Opponent starters</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-flex fm-gap-sm fm-flex-wrap">
            {oppStarters.map((player) => {
              const ovr = calculateOVR(player);
              return (
                <div key={player.id} className="fm-card fm-flex-col fm-items-center fm-gap-xs" style={{ flex: '1 1 120px' }}>
                  <span className={POSITION_BADGE_MAP[player.position] ?? 'fm-pos-badge'}>{POSITION_LABELS[player.position] ?? player.position}</span>
                  <span className="fm-text-lg fm-font-semibold fm-text-primary">{player.name}</span>
                  <span className={`fm-text-sm ${getOvrClass(ovr)}`}>OVR {ovr}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">Our starters</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-flex fm-gap-sm fm-flex-wrap">
            {userStarters.map((player) => {
              const ovr = calculateOVR(player);
              return (
                <div key={player.id} className="fm-card fm-flex-col fm-items-center fm-gap-xs" style={{ flex: '1 1 120px' }}>
                  <span className={POSITION_BADGE_MAP[player.position] ?? 'fm-pos-badge'}>{POSITION_LABELS[player.position] ?? player.position}</span>
                  <span className="fm-text-lg fm-font-semibold fm-text-primary">{player.name}</span>
                  <span className={`fm-text-sm ${getOvrClass(ovr)}`}>OVR {ovr}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="fm-flex fm-justify-end fm-mt-lg">
        <button className="fm-btn fm-btn--primary" onClick={() => navigate('/manager/draft')}>
          Go to draft
        </button>
      </div>
    </div>
  );
}
