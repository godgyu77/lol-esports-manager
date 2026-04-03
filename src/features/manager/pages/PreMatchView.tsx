import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayersByTeamId, getStandings } from '../../../db/queries';
import { generateOpponentReport } from '../../../engine/analysis/matchAnalysisEngine';
import { buildCompetitiveOperationBrief, type CompetitiveOperationBrief } from '../../../engine/manager/competitiveIdentityEngine';
import { getManagerIdentity, getManagerIdentitySummaryLine } from '../../../engine/manager/managerIdentityEngine';
import { getActiveInterventionEffects } from '../../../engine/manager/managerInterventionEngine';
import { getBudgetPressureSnapshot, getPrepRecommendationRecords } from '../../../engine/manager/systemDepthEngine';
import { getInternationalExpectationSnapshot } from '../../../engine/manager/releaseDepthEngine';
import { generateStaffRecommendations } from '../../../engine/staff/staffEngine';
import { useGameStore } from '../../../stores/gameStore';
import type { Player } from '../../../types/player';
import type { BudgetPressureSnapshot, InternationalExpectationSnapshot, PrepRecommendationRecord } from '../../../types/systemDepth';
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
  const [budgetPressure, setBudgetPressure] = useState<BudgetPressureSnapshot | null>(null);
  const [prepRecords, setPrepRecords] = useState<PrepRecommendationRecord[]>([]);
  const [opponentReportSummary, setOpponentReportSummary] = useState<string | null>(null);
  const [operationBrief, setOperationBrief] = useState<CompetitiveOperationBrief | null>(null);
  const [internationalSnapshot, setInternationalSnapshot] = useState<InternationalExpectationSnapshot | null>(null);
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
        const [oppPlayers, myPlayers, standings, identity, interventions, recommendations, pressure, recentPrep, opponentReport, intlSnapshot] = await Promise.all([
          getPlayersByTeamId(opponentTeamId),
          getPlayersByTeamId(userTeamId),
          getStandings(season.id),
          save ? getManagerIdentity(save.id).catch(() => null) : Promise.resolve(null),
          getActiveInterventionEffects(season.currentDate).catch(() => new Map()),
          generateStaffRecommendations(userTeam.id, season.id).catch(() => []),
          getBudgetPressureSnapshot(userTeam.id, season.id).catch(() => null),
          getPrepRecommendationRecords(userTeam.id, season.id, 3).catch(() => []),
          generateOpponentReport(userTeam.id, opponentTeamId, season.currentDate).catch(() => null),
          getInternationalExpectationSnapshot(userTeam.id, season.id, pendingMatch?.matchType ?? null, save?.id).catch(() => null),
        ]);

        if (cancelled) return;

        setOpponentPlayers(oppPlayers);
        setUserPlayers(myPlayers);
        setBudgetPressure(pressure);
        setPrepRecords(recentPrep);
        setOpponentReportSummary(
          opponentReport
            ? opponentReport.weakPosition
              ? `Weak lane to pressure: ${opponentReport.weakPosition}. Analysis accuracy ${opponentReport.accuracy}.`
              : `Scouting confidence ${opponentReport.accuracy}. Recommended bans: ${opponentReport.recommendedBans.slice(0, 3).join(', ') || 'none'}.`
            : null,
        );
        setInternationalSnapshot(intlSnapshot);

        const sorted = [...standings].sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          return (b.setWins - b.setLosses) - (a.setWins - a.setLosses);
        });

        const standingIndex = sorted.findIndex((standing) => standing.teamId === opponentTeamId);
        const standing = sorted[standingIndex];
        if (standing) {
          setOpponentStanding({ wins: standing.wins, losses: standing.losses, rank: standingIndex + 1 });
        }

        if (pendingMatch && opponentTeam) {
          const brief = await buildCompetitiveOperationBrief({
            seasonId: season.id,
            currentDate: season.currentDate,
            pendingMatch,
            userTeam,
            opponentTeam,
            userPlayers: myPlayers,
            opponentPlayers: oppPlayers,
            recommendedBans,
            prepRecords: recentPrep,
            staffRecommendations: recommendations,
            budgetPressure: pressure,
          }).catch(() => null);
          if (!cancelled) {
            setOperationBrief(brief);
          }
        } else {
          setOperationBrief(null);
        }

        const interventionPlayers = userTeam.roster
          .map((player) => ({ player, effect: interventions.get(player.id) }))
          .filter((entry) => entry.effect);

        const cards: MatchImpactCard[] = [
          {
            title: '밴픽 준비도',
            value: recommendedBans.length > 0 ? '준비 완료' : '재점검 필요',
            detail: recommendedBans.length > 0
              ? '추천 밴이 정리돼 있어 드래프트 진입 전 마지막 검수만 하면 됩니다.'
              : '밴 카드와 라인 우선순위를 한 번 더 점검하는 편이 좋습니다.',
            tone: recommendedBans.length > 0 ? 'positive' : 'risk',
          },
        ];

        if (interventionPlayers.length > 0) {
          cards.push({
            title: '최근 개입 효과',
            value: interventionPlayers[0].player.name,
            detail: `${interventionPlayers[0].player.name}가 직전 관리 효과를 들고 이번 경기에 들어갑니다.`,
            tone: 'positive',
          });
        }

        if (recommendations.length > 0) {
          cards.push({
            title: '스태프 리포트',
            value: recommendations[0].title,
            detail: recommendations[0].summary,
            tone: recommendations[0].urgency === 'high' ? 'risk' : 'neutral',
          });
        }

        if (identity) {
          cards.push({
            title: '감독 철학',
            value: identity.dominantTraits[0] ?? '균형형',
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
  }, [opponentTeam, opponentTeamId, pendingMatch, recommendedBans, save, season, userTeam, userTeamId]);

  if (!pendingMatch) {
    return (
      <div className="fm-animate-in" style={{ maxWidth: '960px', margin: '0 auto' }}>
        <p className="fm-text-muted fm-p-md">현재 준비 중인 유저 경기가 없습니다.</p>
        <button className="fm-btn" onClick={() => navigate('/manager/day')}>
          시즌 진행으로 돌아가기
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fm-animate-in" style={{ maxWidth: '960px', margin: '0 auto' }}>
        <p className="fm-text-muted fm-p-md">경기 준비 화면을 정리하는 중입니다...</p>
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

  const pressureTag = opponentStanding && opponentStanding.rank <= 3 ? '강한 상대' : '관리 가능한 상대';
  const latestPrepRecord = prepRecords[0] ?? null;
  const focusCards = [
    {
      title: '훈련 마무리',
      value: userAverageOvr >= opponentAverageOvr ? '디테일 정리' : '기본기 보완',
      detail: '드래프트 전 마지막으로 라인별 약점을 보완할지, 강점을 더 밀어줄지 결정하세요.',
      route: '/manager/training',
      cta: '훈련 열기',
    },
    {
      title: '전술 준비',
      value: recommendedBans.length > 0 ? '밴픽 초안 있음' : '재검토 필요',
      detail: '추천 밴과 라인 우선순위를 정리해두면 경기 당일 판단이 훨씬 빨라집니다.',
      route: '/manager/tactics',
      cta: '전술 열기',
    },
    {
      title: '로스터 컨디션',
      value: `${userAverageOvr} OVR vs ${opponentAverageOvr} OVR`,
      detail: '오늘 스타팅 전력 차이는 경기 초반 구도를 읽는 가장 빠른 지표입니다.',
      route: '/manager/roster',
      cta: '로스터 열기',
    },
    {
      title: '선수 관리',
      value: pressureTag,
      detail: '압박이 큰 경기일수록 불만과 심리 상태를 먼저 확인하는 편이 안전합니다.',
      route: '/manager/complaints',
      cta: '선수 관리 열기',
    },
  ];

  const renderStarterCard = (player: Player) => {
    const ovr = calculateOVR(player);
    return (
      <div key={player.id} className="fm-card fm-flex-col fm-items-center fm-gap-xs" style={{ flex: '1 1 120px' }}>
        <span className={POSITION_BADGE_MAP[player.position] ?? 'fm-pos-badge'}>
          {POSITION_LABELS[player.position] ?? player.position}
        </span>
        <span className="fm-text-lg fm-font-semibold fm-text-primary">{player.name}</span>
        <span className={`fm-text-sm ${getOvrClass(ovr)}`}>OVR {ovr}</span>
      </div>
    );
  };

  return (
    <div className="fm-animate-in" style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div className="fm-page-header">
        <h1 className="fm-page-title">프리매치 브리핑</h1>
      </div>

      <div
        className="fm-panel fm-card--highlight fm-mb-md"
        style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(200,155,60,0.08) 100%)' }}
      >
        <div className="fm-panel__body">
          <div className="fm-flex fm-items-center fm-justify-center fm-gap-lg fm-p-md" style={{ flexWrap: 'wrap' }}>
            <div className="fm-flex-col fm-items-center fm-gap-xs fm-flex-1">
              <span className="fm-text-2xl fm-font-bold fm-text-primary">{userTeam?.shortName ?? userTeamId}</span>
              <span className="fm-text-xs fm-text-muted">우리 팀</span>
            </div>
            <div className="fm-flex-col fm-items-center fm-gap-xs">
              <span className="fm-text-2xl fm-font-bold fm-text-accent">VS</span>
              <span className="fm-badge fm-badge--default">{pendingMatch.boFormat}</span>
            </div>
            <div className="fm-flex-col fm-items-center fm-gap-xs fm-flex-1">
              <span className="fm-text-2xl fm-font-bold fm-text-primary">{opponentTeam?.shortName ?? opponentTeamId}</span>
              {opponentStanding && (
                <span className="fm-text-xs fm-text-muted">
                  {opponentStanding.rank}위 · {opponentStanding.wins}승 {opponentStanding.losses}패
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {(opponentReportSummary || latestPrepRecord || budgetPressure || internationalSnapshot) && (
        <div className="fm-grid fm-grid--3 fm-mb-md" style={{ gap: '12px' }}>
          {opponentReportSummary && (
            <div className="fm-card fm-flex-col fm-gap-sm">
              <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                <span className="fm-text-sm fm-text-muted">상대 분석</span>
                <span className="fm-badge fm-badge--info">scouting</span>
              </div>
              <strong className="fm-text-primary">오늘의 공략 포인트</strong>
              <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>{opponentReportSummary}</p>
            </div>
          )}
          {latestPrepRecord && (
            <div className="fm-card fm-flex-col fm-gap-sm">
              <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                <span className="fm-text-sm fm-text-muted">준비 추적</span>
                <span className="fm-badge fm-badge--default">{latestPrepRecord.status}</span>
              </div>
              <strong className="fm-text-primary">{latestPrepRecord.title}</strong>
              <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>
                {latestPrepRecord.impactSummary ?? latestPrepRecord.summary}
              </p>
            </div>
          )}
          {budgetPressure && (
            <div className="fm-card fm-flex-col fm-gap-sm">
              <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                <span className="fm-text-sm fm-text-muted">보드 압박</span>
                <span className={`fm-badge ${budgetPressure.pressureLevel === 'critical' ? 'fm-badge--danger' : budgetPressure.pressureLevel === 'watch' ? 'fm-badge--warning' : 'fm-badge--success'}`}>
                  {budgetPressure.pressureLevel}
                </span>
              </div>
              <strong className="fm-text-primary">지출 여유 체크</strong>
              <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>{budgetPressure.topDrivers[0]}</p>
            </div>
          )}
          {internationalSnapshot && (
            <div className="fm-card fm-flex-col fm-gap-sm">
              <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                <span className="fm-text-sm fm-text-muted">international desk</span>
                <span className={`fm-badge ${internationalSnapshot.level === 'must_deliver' ? 'fm-badge--danger' : internationalSnapshot.level === 'contender' ? 'fm-badge--warning' : 'fm-badge--default'}`}>
                  {internationalSnapshot.level}
                </span>
              </div>
              <strong className="fm-text-primary">{internationalSnapshot.summary}</strong>
              <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>{internationalSnapshot.styleClash}</p>
            </div>
          )}
        </div>
      )}

      {operationBrief && (
        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__header">
            <span className="fm-panel__title">LoL 운영 브리프</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-card fm-flex-col fm-gap-sm fm-mb-md">
              <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                <span className="fm-text-sm fm-text-muted">Desk opener</span>
                <span className="fm-badge fm-badge--info">{operationBrief.storyPulse.tags[0]}</span>
              </div>
              <strong className="fm-text-primary">{operationBrief.deskHeadline}</strong>
              <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>{operationBrief.deskSummary}</p>
            </div>

            <div className="fm-grid fm-grid--2" style={{ gap: '12px' }}>
              <div className="fm-card fm-flex-col fm-gap-sm">
                <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                  <span className="fm-text-sm fm-text-muted">{operationBrief.patchPulse.label}</span>
                  <span className="fm-badge fm-badge--default">meta</span>
                </div>
                <strong className="fm-text-primary">패치 메타</strong>
                <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>{operationBrief.patchPulse.summary}</p>
                {operationBrief.patchPulse.shifts.length > 0 && (
                  <ul className="fm-text-sm fm-text-secondary" style={{ margin: 0, paddingLeft: '18px' }}>
                    {operationBrief.patchPulse.shifts.map((shift) => <li key={shift}>{shift}</li>)}
                  </ul>
                )}
              </div>

              <div className="fm-card fm-flex-col fm-gap-sm">
                <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                  <span className="fm-text-sm fm-text-muted">{operationBrief.scrimPulse.label}</span>
                  <span className="fm-badge fm-badge--success">scrim</span>
                </div>
                <strong className="fm-text-primary">스크림 포인트</strong>
                <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>{operationBrief.scrimPulse.summary}</p>
                <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>{operationBrief.scrimPulse.takeaway}</p>
              </div>

              <div className="fm-card fm-flex-col fm-gap-sm">
                <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                  <span className="fm-text-sm fm-text-muted">{operationBrief.draftPulse.label}</span>
                  <span className="fm-badge fm-badge--warning">draft</span>
                </div>
                <strong className="fm-text-primary">밴픽 운영</strong>
                <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>{operationBrief.draftPulse.summary}</p>
                {operationBrief.draftPulse.bans.length > 0 && (
                  <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>
                    추천 밴: {operationBrief.draftPulse.bans.join(', ')}
                  </p>
                )}
                {operationBrief.draftPulse.watchPoints.length > 0 && (
                  <ul className="fm-text-sm fm-text-secondary" style={{ margin: 0, paddingLeft: '18px' }}>
                    {operationBrief.draftPulse.watchPoints.map((watchPoint) => <li key={watchPoint}>{watchPoint}</li>)}
                  </ul>
                )}
              </div>

              <div className="fm-card fm-flex-col fm-gap-sm">
                <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                  <span className="fm-text-sm fm-text-muted">{operationBrief.coachPulse.label}</span>
                  <span className="fm-badge fm-badge--info">briefing</span>
                </div>
                <strong className="fm-text-primary">{operationBrief.storyPulse.label}</strong>
                <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>{operationBrief.coachPulse.summary}</p>
                <ul className="fm-text-sm fm-text-secondary" style={{ margin: 0, paddingLeft: '18px' }}>
                  {operationBrief.coachPulse.directives.map((directive) => <li key={directive}>{directive}</li>)}
                </ul>
                <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>{operationBrief.storyPulse.broadcastAngle}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">오늘 경기에서 특별히 봐야 할 것</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--2" style={{ gap: '12px' }}>
            {impactCards.map((card) => (
              <div key={`${card.title}-${card.value}`} className="fm-card fm-flex-col fm-gap-sm">
                <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                  <span className="fm-text-sm fm-text-muted">{card.title}</span>
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
          <span className="fm-panel__title">경기 전 마지막 체크 포인트</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--2" style={{ gap: '12px' }}>
            {focusCards.map((card) => (
              <div key={card.title} className="fm-card fm-flex-col fm-gap-sm">
                <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                  <span className="fm-text-sm fm-text-muted">{card.title}</span>
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

      <div className="fm-grid fm-grid--2 fm-gap-md">
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">상대 스타팅</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-gap-sm fm-flex-wrap">
              {oppStarters.map(renderStarterCard)}
            </div>
          </div>
        </div>

        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">우리 스타팅</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-gap-sm fm-flex-wrap">
              {userStarters.map(renderStarterCard)}
            </div>
          </div>
        </div>
      </div>

      <div className="fm-flex fm-justify-end fm-mt-lg">
        <button className="fm-btn fm-btn--primary" onClick={() => navigate('/manager/draft')}>
          드래프트로 이동
        </button>
      </div>
    </div>
  );
}
