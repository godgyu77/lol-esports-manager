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
import type {
  BudgetPressureSnapshot,
  InternationalExpectationSnapshot,
  PrepRecommendationRecord,
} from '../../../types/systemDepth';
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

interface FocusCard {
  title: string;
  value: string;
  detail: string;
  route: string;
  cta: string;
}

function calculateOverall(player: Player): number {
  const { mechanical, gameSense, teamwork, consistency, laning } = player.stats;
  const { mental } = player.mental;
  return Math.round((mechanical + gameSense + teamwork + consistency + laning + mental) / 6);
}

function getOverallClass(overall: number): string {
  if (overall >= 90) return 'fm-ovr fm-ovr--elite';
  if (overall >= 80) return 'fm-ovr fm-ovr--high';
  if (overall >= 70) return 'fm-ovr fm-ovr--mid';
  return 'fm-ovr fm-ovr--low';
}

function getToneBadgeClass(tone: MatchImpactCard['tone']): string {
  if (tone === 'positive') return 'fm-badge fm-badge--success';
  if (tone === 'risk') return 'fm-badge fm-badge--danger';
  return 'fm-badge fm-badge--default';
}

function getPressureLevelLabel(level: BudgetPressureSnapshot['pressureLevel']): string {
  if (level === 'critical') return '위험';
  if (level === 'watch') return '주의';
  return '안정';
}

function getInternationalLevelLabel(level: InternationalExpectationSnapshot['level']): string {
  if (level === 'must_deliver') return '성과 필수';
  if (level === 'contender') return '우승 경쟁';
  return '관찰 단계';
}

function isMainRosterPlayer(division: string | undefined): boolean {
  return division === 'main' || division === '1군';
}

function getStarterPlayers(players: (Player & { division: string })[]): (Player & { division: string })[] {
  const starters = players.filter((player) => isMainRosterPlayer(player.division));
  return starters.length > 0 ? starters : players.slice(0, 5);
}

function sanitizeCopy(text: string | null | undefined): string | null {
  if (!text) return null;
  return text
    .replace(/DayView/gi, '시즌 진행 화면')
    .replace(/프리매치 준비/gi, '경기 준비')
    .trim();
}

function buildOpponentReportSummary(opponentReport: Awaited<ReturnType<typeof generateOpponentReport>> | null): string | null {
  if (!opponentReport) return null;
  if (opponentReport.weakPosition) {
    return `${opponentReport.weakPosition} 라인이 상대적 약점입니다. 분석 정확도는 ${opponentReport.accuracy}입니다.`;
  }

  const recommendedBans = opponentReport.recommendedBans.slice(0, 3).join(', ');
  return `상대 흐름 분석 정확도는 ${opponentReport.accuracy}입니다. 추천 밴은 ${recommendedBans || '없음'}입니다.`;
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
        const [
          oppPlayers,
          myPlayers,
          standings,
          identity,
          interventions,
          recommendations,
          pressure,
          recentPrep,
          opponentReport,
          intlSnapshot,
        ] = await Promise.all([
          getPlayersByTeamId(opponentTeamId),
          getPlayersByTeamId(userTeamId),
          getStandings(season.id),
          save ? getManagerIdentity(save.id).catch(() => null) : Promise.resolve(null),
          getActiveInterventionEffects(season.currentDate).catch(() => new Map()),
          generateStaffRecommendations(userTeam.id, season.id).catch(() => []),
          getBudgetPressureSnapshot(userTeam.id, season.id).catch(() => null),
          getPrepRecommendationRecords(userTeam.id, season.id, 3).catch(() => []),
          generateOpponentReport(userTeam.id, opponentTeamId, season.currentDate).catch(() => null),
          getInternationalExpectationSnapshot(userTeam.id, season.id, pendingMatch?.matchType ?? null, save?.id).catch(
            () => null,
          ),
        ]);

        if (cancelled) return;

        setOpponentPlayers(oppPlayers);
        setUserPlayers(myPlayers);
        setBudgetPressure(pressure);
        setPrepRecords(recentPrep);
        setOpponentReportSummary(sanitizeCopy(buildOpponentReportSummary(opponentReport)));
        setInternationalSnapshot(intlSnapshot);

        const sorted = [...standings].sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          return (b.setWins - b.setLosses) - (a.setWins - a.setLosses);
        });

        const standingIndex = sorted.findIndex((standing) => standing.teamId === opponentTeamId);
        const standing = sorted[standingIndex];
        setOpponentStanding(standing ? { wins: standing.wins, losses: standing.losses, rank: standingIndex + 1 } : null);

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
            value: recommendedBans.length > 0 ? '준비 완료' : '점검 필요',
            detail:
              recommendedBans.length > 0
                ? '추천 밴 카드가 정리되어 있어 밴픽 진입 전에 마지막 확인만 하면 됩니다.'
                : '상대 핵심 카드와 라인 우선순위를 먼저 정리해두는 편이 좋습니다.',
            tone: recommendedBans.length > 0 ? 'positive' : 'risk',
          },
        ];

        if (interventionPlayers.length > 0) {
          cards.push({
            title: '직전 개입 효과',
            value: interventionPlayers[0].player.name,
            detail: `${interventionPlayers[0].player.name} 선수가 최근 관리 효과를 받고 이번 경기 준비에 들어갑니다.`,
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
            value: identity.dominantTraits[0] ?? '균형',
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
      <div className="fm-animate-in" style={{ maxWidth: '1180px', margin: '0 auto' }}>
        <p className="fm-text-muted fm-p-md">현재 준비 중인 사용자 경기가 없습니다.</p>
        <button className="fm-btn" onClick={() => navigate('/manager/day')}>
          시즌 진행으로 돌아가기
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fm-animate-in" style={{ maxWidth: '1180px', margin: '0 auto' }}>
        <p className="fm-text-muted fm-p-md">경기 준비 화면을 정리하는 중입니다...</p>
      </div>
    );
  }

  const oppStarters = getStarterPlayers(opponentPlayers).sort(
    (a, b) => POSITION_ORDER.indexOf(a.position as (typeof POSITION_ORDER)[number]) - POSITION_ORDER.indexOf(b.position as (typeof POSITION_ORDER)[number]),
  );
  const userStarters = getStarterPlayers(userPlayers).sort(
    (a, b) => POSITION_ORDER.indexOf(a.position as (typeof POSITION_ORDER)[number]) - POSITION_ORDER.indexOf(b.position as (typeof POSITION_ORDER)[number]),
  );

  const userAverageOverall =
    userStarters.length > 0
      ? Math.round(userStarters.reduce((sum, player) => sum + calculateOverall(player), 0) / userStarters.length)
      : 0;
  const opponentAverageOverall =
    oppStarters.length > 0
      ? Math.round(oppStarters.reduce((sum, player) => sum + calculateOverall(player), 0) / oppStarters.length)
      : 0;

  const pressureTag = opponentStanding && opponentStanding.rank <= 3 ? '강한 상대' : '관리 가능한 상대';
  const latestPrepRecord = prepRecords[0] ?? null;

  const focusCards: FocusCard[] = [
    {
      title: '훈련 마무리',
      value: userAverageOverall >= opponentAverageOverall ? '상태 양호' : '기본기 보완',
      detail: '라인전 보완과 강점 유지 중 무엇을 먼저 잡을지 결정해두는 편이 좋습니다.',
      route: '/manager/training',
      cta: '훈련 확인',
    },
    {
      title: '전술 준비',
      value: recommendedBans.length > 0 ? '초안 준비됨' : '정리 필요',
      detail: '추천 밴과 라인 우선순위를 정리해두면 밴픽 판단이 빨라집니다.',
      route: '/manager/tactics',
      cta: '전술 확인',
    },
    {
      title: '주전 상태',
      value: `종합 ${userAverageOverall} : ${opponentAverageOverall}`,
      detail: '오늘 주전 전력 차이는 경기 초반 주도권에 직접 영향을 줍니다.',
      route: '/manager/roster',
      cta: '로스터 확인',
    },
    {
      title: '선수 관리',
      value: pressureTag,
      detail: '직전 이슈나 불만이 있는지 미리 확인해 경기 전 변수를 줄여야 합니다.',
      route: '/manager/complaints',
      cta: '선수 관리 확인',
    },
  ];

  const renderStarterCard = (player: Player) => {
    const overall = calculateOverall(player);
    return (
      <div key={player.id} className="fm-card fm-flex-col fm-items-center fm-gap-xs" style={{ flex: '1 1 120px' }}>
        <span className={POSITION_BADGE_MAP[player.position] ?? 'fm-pos-badge'}>
          {POSITION_LABELS[player.position] ?? player.position}
        </span>
        <span className="fm-text-lg fm-font-semibold fm-text-primary">{player.name}</span>
        <span className={`fm-text-sm ${getOverallClass(overall)}`}>종합 {overall}</span>
      </div>
    );
  };

  return (
    <div className="fm-animate-in" style={{ maxWidth: '1180px', margin: '0 auto' }}>
      <div className="fm-page-header">
        <h1 className="fm-page-title">경기 준비 브리핑</h1>
        <p className="fm-page-subtitle">밴픽 전 마지막으로 주전, 운영 포인트, 위험 요소를 한 번에 확인합니다.</p>
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
              <span className="fm-text-2xl fm-font-bold fm-text-accent">대결</span>
              <span className="fm-badge fm-badge--default">{pendingMatch.boFormat}</span>
            </div>
            <div className="fm-flex-col fm-items-center fm-gap-xs fm-flex-1">
              <span className="fm-text-2xl fm-font-bold fm-text-primary">{opponentTeam?.shortName ?? opponentTeamId}</span>
              {opponentStanding ? (
                <span className="fm-text-xs fm-text-muted">
                  {opponentStanding.rank}위 · {opponentStanding.wins}승 {opponentStanding.losses}패
                </span>
              ) : (
                <span className="fm-text-xs fm-text-muted">상대 전적 집계 중</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {(opponentReportSummary || latestPrepRecord || budgetPressure || internationalSnapshot) && (
        <div className="fm-grid fm-grid--2 fm-mb-md" style={{ gap: '12px' }}>
          {opponentReportSummary ? (
            <div className="fm-card fm-flex-col fm-gap-sm">
              <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                <span className="fm-text-sm fm-text-muted">상대 분석</span>
                <span className="fm-badge fm-badge--info">핵심 포인트</span>
              </div>
              <strong className="fm-text-primary">오늘 경기에서 먼저 볼 부분</strong>
              <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>
                {opponentReportSummary}
              </p>
            </div>
          ) : null}

          {latestPrepRecord ? (
            <div className="fm-card fm-flex-col fm-gap-sm">
              <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                <span className="fm-text-sm fm-text-muted">준비 기록</span>
                <span className="fm-badge fm-badge--default">{latestPrepRecord.status}</span>
              </div>
              <strong className="fm-text-primary">{latestPrepRecord.title}</strong>
              <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>
                {latestPrepRecord.impactSummary ?? latestPrepRecord.summary}
              </p>
            </div>
          ) : null}

          {budgetPressure ? (
            <div className="fm-card fm-flex-col fm-gap-sm">
              <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                <span className="fm-text-sm fm-text-muted">재정 압박</span>
                <span
                  className={`fm-badge ${
                    budgetPressure.pressureLevel === 'critical'
                      ? 'fm-badge--danger'
                      : budgetPressure.pressureLevel === 'watch'
                        ? 'fm-badge--warning'
                        : 'fm-badge--success'
                  }`}
                >
                  {getPressureLevelLabel(budgetPressure.pressureLevel)}
                </span>
              </div>
              <strong className="fm-text-primary">운영 리스크</strong>
              <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>
                {budgetPressure.topDrivers[0] ?? '현재 즉시 대응할 재정 리스크는 없습니다.'}
              </p>
            </div>
          ) : null}

          {internationalSnapshot ? (
            <div className="fm-card fm-flex-col fm-gap-sm">
              <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                <span className="fm-text-sm fm-text-muted">국제전 시선</span>
                <span
                  className={`fm-badge ${
                    internationalSnapshot.level === 'must_deliver'
                      ? 'fm-badge--danger'
                      : internationalSnapshot.level === 'contender'
                        ? 'fm-badge--warning'
                        : 'fm-badge--default'
                  }`}
                >
                  {getInternationalLevelLabel(internationalSnapshot.level)}
                </span>
              </div>
              <strong className="fm-text-primary">{internationalSnapshot.summary}</strong>
              <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>
                {internationalSnapshot.styleClash}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {operationBrief ? (
        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__header">
            <span className="fm-panel__title">운영 브리핑</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-card fm-flex-col fm-gap-sm fm-mb-md">
              <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                <span className="fm-text-sm fm-text-muted">메인 스토리</span>
                <span className="fm-badge fm-badge--info">{operationBrief.storyPulse.tags[0]}</span>
              </div>
              <strong className="fm-text-primary">{operationBrief.deskHeadline}</strong>
              <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>
                {operationBrief.deskSummary}
              </p>
            </div>

            <div className="fm-grid fm-grid--2" style={{ gap: '12px' }}>
              <div className="fm-card fm-flex-col fm-gap-sm">
                <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                  <span className="fm-text-sm fm-text-muted">{operationBrief.patchPulse.label}</span>
                  <span className="fm-badge fm-badge--default">메타</span>
                </div>
                <strong className="fm-text-primary">패치 흐름</strong>
                <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>
                  {operationBrief.patchPulse.summary}
                </p>
                {operationBrief.patchPulse.shifts.length > 0 ? (
                  <ul className="fm-text-sm fm-text-secondary" style={{ margin: 0, paddingLeft: '18px' }}>
                    {operationBrief.patchPulse.shifts.map((shift) => (
                      <li key={shift}>{shift}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="fm-card fm-flex-col fm-gap-sm">
                <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                  <span className="fm-text-sm fm-text-muted">{operationBrief.scrimPulse.label}</span>
                  <span className="fm-badge fm-badge--success">스크림</span>
                </div>
                <strong className="fm-text-primary">최근 연습 경기</strong>
                <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>
                  {operationBrief.scrimPulse.summary}
                </p>
                <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>
                  {operationBrief.scrimPulse.takeaway}
                </p>
              </div>

              <div className="fm-card fm-flex-col fm-gap-sm">
                <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                  <span className="fm-text-sm fm-text-muted">{operationBrief.draftPulse.label}</span>
                  <span className="fm-badge fm-badge--warning">밴픽</span>
                </div>
                <strong className="fm-text-primary">드래프트 운영</strong>
                <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>
                  {operationBrief.draftPulse.summary}
                </p>
                {operationBrief.draftPulse.bans.length > 0 ? (
                  <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>
                    추천 밴: {operationBrief.draftPulse.bans.join(', ')}
                  </p>
                ) : null}
                {operationBrief.draftPulse.watchPoints.length > 0 ? (
                  <ul className="fm-text-sm fm-text-secondary" style={{ margin: 0, paddingLeft: '18px' }}>
                    {operationBrief.draftPulse.watchPoints.map((watchPoint) => (
                      <li key={watchPoint}>{watchPoint}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="fm-card fm-flex-col fm-gap-sm">
                <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                  <span className="fm-text-sm fm-text-muted">{operationBrief.coachPulse.label}</span>
                  <span className="fm-badge fm-badge--info">브리핑</span>
                </div>
                <strong className="fm-text-primary">{operationBrief.storyPulse.label}</strong>
                <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>
                  {operationBrief.coachPulse.summary}
                </p>
                <ul className="fm-text-sm fm-text-secondary" style={{ margin: 0, paddingLeft: '18px' }}>
                  {operationBrief.coachPulse.directives.map((directive) => (
                    <li key={directive}>{directive}</li>
                  ))}
                </ul>
                <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>
                  {operationBrief.storyPulse.broadcastAngle}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">오늘 경기에서 챙겨볼 것</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--2" style={{ gap: '12px' }}>
            {impactCards.map((card) => (
              <div key={`${card.title}-${card.value}`} className="fm-card fm-flex-col fm-gap-sm">
                <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                  <span className="fm-text-sm fm-text-muted">{card.title}</span>
                  <span className={getToneBadgeClass(card.tone)}>{card.value}</span>
                </div>
                <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>
                  {card.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">경기 전 마지막 확인</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--2" style={{ gap: '12px' }}>
            {focusCards.map((card) => (
              <div key={card.title} className="fm-card fm-flex-col fm-gap-sm">
                <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                  <span className="fm-text-sm fm-text-muted">{card.title}</span>
                  <span className="fm-badge fm-badge--default">{card.value}</span>
                </div>
                <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>
                  {card.detail}
                </p>
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
            <span className="fm-panel__title">상대 주전</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-gap-sm fm-flex-wrap">{oppStarters.map(renderStarterCard)}</div>
          </div>
        </div>

        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">우리 주전</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-gap-sm fm-flex-wrap">{userStarters.map(renderStarterCard)}</div>
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
