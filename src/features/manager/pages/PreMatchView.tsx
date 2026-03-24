/**
 * 경기 전 준비 화면
 * - 상대팀 요약 (팀명, 순위, 전적, 주요 선수)
 * - 추천 전술 / 추천 밴
 * - 우리팀 라인업 + OVR
 * - "밴픽으로" 버튼
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../../stores/gameStore';
import { getPlayersByTeamId } from '../../../db/queries';
import { getStandings } from '../../../db/queries';
import type { Player } from '../../../types/player';

const POSITION_ORDER = ['top', 'jungle', 'mid', 'adc', 'support'] as const;
const POSITION_LABELS: Record<string, string> = {
  top: 'TOP',
  jungle: 'JGL',
  mid: 'MID',
  adc: 'ADC',
  support: 'SUP',
};

const POSITION_BADGE_MAP: Record<string, string> = {
  top: 'fm-pos-badge fm-pos-badge--top',
  jungle: 'fm-pos-badge fm-pos-badge--jgl',
  mid: 'fm-pos-badge fm-pos-badge--mid',
  adc: 'fm-pos-badge fm-pos-badge--adc',
  support: 'fm-pos-badge fm-pos-badge--sup',
};

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
  const [loading, setLoading] = useState(true);

  const userTeamId = save?.userTeamId ?? '';

  const opponentTeamId = pendingMatch
    ? pendingMatch.teamHomeId === userTeamId
      ? pendingMatch.teamAwayId
      : pendingMatch.teamHomeId
    : '';

  const userTeam = teams.find((t) => t.id === userTeamId);
  const opponentTeam = teams.find((t) => t.id === opponentTeamId);

  useEffect(() => {
    if (!opponentTeamId || !userTeamId || !season) return;

    const load = async () => {
      setLoading(true);
      try {
        const [oppPlayers, myPlayers, standings] = await Promise.all([
          getPlayersByTeamId(opponentTeamId),
          getPlayersByTeamId(userTeamId),
          getStandings(season.id),
        ]);
        setOpponentPlayers(oppPlayers);
        setUserPlayers(myPlayers);

        // 순위 계산
        const sorted = [...standings].sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          return (b.setWins - b.setLosses) - (a.setWins - a.setLosses);
        });
        const oppIdx = sorted.findIndex((s) => s.teamId === opponentTeamId);
        const oppStanding = sorted[oppIdx];
        if (oppStanding) {
          setOpponentStanding({ wins: oppStanding.wins, losses: oppStanding.losses, rank: oppIdx + 1 });
        }
      } catch (e) {
        console.warn('[PreMatchView] load failed:', e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [opponentTeamId, userTeamId, season]);

  const handleGoToDraft = () => {
    navigate('/manager/draft');
  };

  if (!pendingMatch) {
    return (
      <div className="fm-animate-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <p className="fm-text-muted fm-p-md">대기 중인 경기가 없습니다.</p>
        <button className="fm-btn" onClick={() => navigate('/manager/day')}>
          돌아가기
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fm-animate-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <p className="fm-text-muted fm-p-md">경기 정보를 불러오는 중...</p>
      </div>
    );
  }

  const oppStarters = opponentPlayers
    .filter((p) => p.division === 'main')
    .sort((a, b) => POSITION_ORDER.indexOf(a.position as typeof POSITION_ORDER[number]) - POSITION_ORDER.indexOf(b.position as typeof POSITION_ORDER[number]));

  const userStarters = userPlayers
    .filter((p) => p.division === 'main')
    .sort((a, b) => POSITION_ORDER.indexOf(a.position as typeof POSITION_ORDER[number]) - POSITION_ORDER.indexOf(b.position as typeof POSITION_ORDER[number]));

  return (
    <div className="fm-animate-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="fm-page-header">
        <h1 className="fm-page-title">경기 전 준비</h1>
      </div>

      {/* 매치업 헤더 */}
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
                  {opponentStanding.rank}위 ({opponentStanding.wins}승 {opponentStanding.losses}패)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 상대팀 라인업 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">상대팀 라인업</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-flex fm-gap-sm fm-flex-wrap">
            {oppStarters.map((p) => {
              const ovr = calculateOVR(p);
              return (
                <div key={p.id} className="fm-card fm-flex-col fm-items-center fm-gap-xs" style={{ flex: '1 1 120px' }}>
                  <span className={POSITION_BADGE_MAP[p.position] ?? 'fm-pos-badge'}>{POSITION_LABELS[p.position] ?? p.position}</span>
                  <span className="fm-text-lg fm-font-semibold fm-text-primary">{p.name}</span>
                  <span className={`fm-text-sm ${getOvrClass(ovr)}`}>OVR {ovr}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 우리팀 라인업 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">우리팀 라인업</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-flex fm-gap-sm fm-flex-wrap">
            {userStarters.map((p) => {
              const ovr = calculateOVR(p);
              return (
                <div key={p.id} className="fm-card fm-card--highlight fm-flex-col fm-items-center fm-gap-xs" style={{ flex: '1 1 120px' }}>
                  <span className={POSITION_BADGE_MAP[p.position] ?? 'fm-pos-badge'}>{POSITION_LABELS[p.position] ?? p.position}</span>
                  <span className="fm-text-lg fm-font-semibold fm-text-primary">{p.name}</span>
                  <span className={`fm-text-sm ${getOvrClass(ovr)}`}>OVR {ovr}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 추천 밴 */}
      {recommendedBans.length > 0 && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">추천 밴</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-gap-sm fm-flex-wrap">
              {recommendedBans.slice(0, 5).map((champId, i) => (
                <span key={champId} className="fm-badge fm-badge--danger fm-flex fm-items-center fm-gap-xs">
                  <span className="fm-text-xs" style={{ opacity: 0.6 }}>{i + 1}</span>
                  {champId}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 밴픽으로 버튼 */}
      <div className="fm-flex fm-justify-center fm-mt-lg fm-mb-md">
        <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={handleGoToDraft}>
          밴픽으로 진행
        </button>
      </div>
    </div>
  );
}
