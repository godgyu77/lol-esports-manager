import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getActiveSponsors,
  getTeamFinanceSummary,
  getTeamWithRoster,
  type FinanceLog,
  type FinanceSummary,
  type Sponsor,
} from '../../../db/queries';
import {
  acceptSponsor,
  generateSponsorOffers,
  MAX_ACTIVE_SPONSORS,
  MAX_REROLLS_PER_SEASON,
  SPONSOR_CONDITION_LABELS,
  SPONSOR_STYLE_LABELS,
  SPONSOR_TIER_COLORS,
  SPONSOR_TIER_LABELS,
  type ConditionalSponsorOffer,
  type SponsorTier,
} from '../../../engine/economy/sponsorEngine';
import { getManagerIdentity, getManagerIdentityEffects } from '../../../engine/manager/managerIdentityEngine';
import { useGameStore } from '../../../stores/gameStore';
import { formatAmount } from '../../../utils/formatUtils';

const CATEGORY_LABELS: Record<string, string> = {
  salary: '선수 연봉',
  prize: '상금',
  sponsorship: '스폰서 수익',
  transfer: '이적료',
  coaching: '코칭 스태프',
  facility: '시설 운영비',
  merchandise: '굿즈 수익',
  streaming: '방송 수익',
  penalty: '벌금 / 위약금',
};

const STRATEGY_CARDS = [
  {
    title: '안정형 계약',
    badge: SPONSOR_STYLE_LABELS.fixed,
    detail: '주간 현금 흐름이 일정해서 시즌 운영 계획을 세우기 편합니다.',
  },
  {
    title: '성과형 계약',
    badge: SPONSOR_STYLE_LABELS.performance,
    detail: '성적이 좋으면 수익이 크게 늘지만 목표 달성 압박도 커집니다.',
  },
  {
    title: '홍보형 계약',
    badge: SPONSOR_STYLE_LABELS.promotion,
    detail: '노출 효과와 화제성이 커지지만 추가 일정과 미디어 요구가 생길 수 있습니다.',
  },
];

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

function getOfferMeaning(style: ConditionalSponsorOffer['offerStyle']): string {
  if (style === 'promotion') return '브랜드 노출을 크게 늘릴 수 있지만 운영 부담도 함께 올라갑니다.';
  if (style === 'performance') return '목표를 달성하면 가장 많이 벌 수 있는 대신 실패 리스크가 큽니다.';
  return '변동성이 낮고 안정적으로 예산을 쌓기 좋은 계약입니다.';
}

export function FinanceView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);
  const setTeams = useGameStore((s) => s.setTeams);

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [budget, setBudget] = useState(0);
  const [reputation, setReputation] = useState(0);
  const [sponsorBonus, setSponsorBonus] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSponsors, setActiveSponsors] = useState<Sponsor[]>([]);
  const [offers, setOffers] = useState<ConditionalSponsorOffer[]>([]);
  const [isGeneratingOffers, setIsGeneratingOffers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rerollKey = season ? `sponsor_rerolls_${season.id}` : '';
  const [rerollsUsed, setRerollsUsed] = useState<number>(() => {
    if (!rerollKey) return 0;
    return Number(localStorage.getItem(rerollKey) ?? '0');
  });

  const rerollsRemaining = MAX_REROLLS_PER_SEASON - rerollsUsed;
  const isMaxSponsors = activeSponsors.length >= MAX_ACTIVE_SPONSORS;
  const effectiveReputation = reputation + sponsorBonus;

  const syncStoreTeam = useCallback((nextBudget: number, nextReputation?: number) => {
    if (!save) return;
    setTeams(
      teams.map((team) =>
        team.id === save.userTeamId
          ? { ...team, budget: nextBudget, reputation: nextReputation ?? team.reputation }
          : team,
      ),
    );
  }, [save, setTeams, teams]);

  const loadData = useCallback(async () => {
    if (!season || !save) return;

    setIsLoading(true);
    setError(null);

    try {
      const [financeSummary, team, sponsors, identity] = await Promise.all([
        getTeamFinanceSummary(save.userTeamId, season.id),
        getTeamWithRoster(save.userTeamId),
        getActiveSponsors(save.userTeamId, season.id),
        getManagerIdentity(save.id).catch(() => null),
      ]);

      const nextBudget = team?.budget ?? 0;
      const nextReputation = team?.reputation ?? 0;
      const nextSponsorBonus = identity ? getManagerIdentityEffects(identity.philosophy).sponsorReputationBonus : 0;

      setSummary(financeSummary);
      setBudget(nextBudget);
      setReputation(nextReputation);
      setSponsorBonus(nextSponsorBonus);
      setActiveSponsors(sponsors);
      syncStoreTeam(nextBudget, nextReputation);
    } catch (err) {
      console.error('finance load failed:', err);
      setSummary(null);
      setError('재정 데이터를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [save, season, syncStoreTeam]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const generateOffersNow = useCallback(() => {
    const activeNames = activeSponsors.map((sponsor) => sponsor.name);
    return generateSponsorOffers(effectiveReputation, activeNames);
  }, [activeSponsors, effectiveReputation]);

  const handleGenerateOffers = () => {
    if (rerollsRemaining <= 0 || isMaxSponsors) return;

    setIsGeneratingOffers(true);
    setOffers(generateOffersNow());

    const nextUsed = rerollsUsed + 1;
    setRerollsUsed(nextUsed);
    if (rerollKey) {
      localStorage.setItem(rerollKey, String(nextUsed));
    }
    setIsGeneratingOffers(false);
  };

  const handleAcceptOffer = async (offer: ConditionalSponsorOffer) => {
    if (!season || !save) return;

    setError(null);
    try {
      const currentDate = season.currentDate;
      await acceptSponsor(save.userTeamId, season.id, offer, currentDate);

      const optimisticBudget = budget + offer.weeklyPayout;
      setBudget(optimisticBudget);
      setActiveSponsors((prev) => [
        ...prev,
        {
          id: -Date.now(),
          seasonId: season.id,
          teamId: save.userTeamId,
          name: offer.name,
          tier: offer.tier,
          weeklyPayout: offer.weeklyPayout,
          startDate: currentDate,
          endDate: currentDate,
          status: 'active',
        },
      ]);
      setOffers((prev) => prev.filter((existing) => existing.name !== offer.name));
      syncStoreTeam(optimisticBudget);
      await loadData();
    } catch (err) {
      console.error('accept sponsor failed:', err);
      setError('스폰서 제안을 수락하지 못했습니다.');
    }
  };

  const handleRejectOffer = (offer: ConditionalSponsorOffer) => {
    setOffers((prev) => prev.filter((existing) => existing.name !== offer.name));
  };

  const negotiationSummary = useMemo(() => {
    const bonusLabel = sponsorBonus > 0 ? ` / 대외 이미지 보정 +${sponsorBonus}` : '';
    return `기본 명성 ${reputation}${bonusLabel}. 스폰서 제안 등급은 이 수치를 기준으로 계산됩니다.`;
  }, [reputation, sponsorBonus]);

  if (!season || !save) {
    return <p className="fm-text-muted">재정 데이터를 준비 중입니다...</p>;
  }

  if (isLoading) {
    return <p className="fm-text-muted">재정 요약을 불러오는 중입니다...</p>;
  }

  if (error && !summary) {
    return (
      <div className="fm-panel">
        <div className="fm-panel__body">
          <p className="fm-text-danger fm-mb-md">{error}</p>
          <button className="fm-btn fm-btn--primary" onClick={() => void loadData()}>
            다시 불러오기
          </button>
        </div>
      </div>
    );
  }

  if (!summary) {
    return <p className="fm-text-muted">표시할 재정 데이터가 아직 없습니다.</p>;
  }

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">재정</h1>
      </div>

      <div className="fm-grid fm-grid--4 fm-mb-lg">
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">현재 예산</span>
            <span className="fm-stat__value fm-stat__value--accent">{formatAmount(budget)}</span>
          </div>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">총수입</span>
            <span className="fm-stat__value fm-text-success">{formatAmount(summary.totalIncome)}</span>
          </div>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">총지출</span>
            <span className="fm-stat__value fm-text-danger">{formatAmount(summary.totalExpense)}</span>
          </div>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">시즌 손익</span>
            <span className={`fm-stat__value ${summary.balance >= 0 ? 'fm-text-success' : 'fm-text-danger'}`}>
              {summary.balance >= 0 ? '+' : ''}
              {formatAmount(summary.balance)}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="fm-alert fm-alert--danger fm-mb-md">
          <span className="fm-alert__text">{error}</span>
          <button className="fm-alert__action" onClick={() => setError(null)}>x</button>
        </div>
      )}

      <div className="fm-panel fm-mb-lg">
        <div className="fm-panel__header">
          <span className="fm-panel__title">스폰서 전략</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--3 fm-mb-md">
            {STRATEGY_CARDS.map((card) => (
              <div key={card.title} className="fm-card fm-flex-col fm-gap-sm">
                <div className="fm-flex fm-justify-between fm-items-center fm-gap-sm">
                  <span className="fm-text-primary fm-font-semibold">{card.title}</span>
                  <span className="fm-badge fm-badge--info">{card.badge}</span>
                </div>
                <p className="fm-text-secondary" style={{ margin: 0 }}>{card.detail}</p>
              </div>
            ))}
          </div>

          <div className="fm-card">
            <div className="fm-flex fm-justify-between fm-items-center fm-gap-sm">
              <span className="fm-text-primary fm-font-semibold">협상 지수</span>
              <span className="fm-badge fm-badge--default">{effectiveReputation}</span>
            </div>
            <p className="fm-text-secondary fm-mt-sm" style={{ marginBottom: 0 }}>{negotiationSummary}</p>
          </div>
        </div>
      </div>

      <div className="fm-panel fm-mb-lg">
        <div className="fm-panel__header">
          <span className="fm-panel__title">스폰서 관리</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
            <h3 className="fm-text-lg fm-font-semibold fm-text-primary">활성 계약</h3>
            <span className="fm-badge fm-badge--default">
              {activeSponsors.length} / {MAX_ACTIVE_SPONSORS}
            </span>
          </div>

          {activeSponsors.length === 0 ? (
            <p className="fm-text-muted fm-text-md fm-mb-md">진행 중인 스폰서 계약이 없습니다.</p>
          ) : (
            <div className="fm-grid fm-grid--auto fm-mb-md">
              {activeSponsors.map((sponsor) => (
                <div key={sponsor.id} className="fm-card fm-flex-col fm-gap-sm">
                  <div className="fm-flex fm-items-center fm-gap-sm">
                    <span
                      className="fm-badge"
                      style={{
                        color: SPONSOR_TIER_COLORS[sponsor.tier as SponsorTier] ?? 'var(--text-secondary)',
                        borderColor: SPONSOR_TIER_COLORS[sponsor.tier as SponsorTier] ?? 'var(--text-secondary)',
                        border: '1px solid',
                      }}
                    >
                      {SPONSOR_TIER_LABELS[sponsor.tier as SponsorTier] ?? sponsor.tier}
                    </span>
                    <span className="fm-text-lg fm-font-semibold fm-text-primary">{sponsor.name}</span>
                  </div>
                  <div className="fm-info-row">
                    <span className="fm-info-row__label">주간 지급액</span>
                    <span className="fm-info-row__value fm-text-success">+{formatAmount(sponsor.weeklyPayout)}</span>
                  </div>
                  <div className="fm-info-row">
                    <span className="fm-info-row__label">계약 기간</span>
                    <span className="fm-info-row__value">{sponsor.startDate} ~ {sponsor.endDate}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="fm-divider" />

          <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm fm-mt-md">
            <h3 className="fm-text-lg fm-font-semibold fm-text-primary">제안 보드</h3>
            <button
              className="fm-btn fm-btn--info fm-btn--sm"
              onClick={handleGenerateOffers}
              disabled={isGeneratingOffers || rerollsRemaining <= 0 || isMaxSponsors}
              title={
                isMaxSponsors
                  ? `동시에 유지할 수 있는 스폰서는 최대 ${MAX_ACTIVE_SPONSORS}개입니다`
                  : rerollsRemaining <= 0
                    ? '이번 시즌 재추첨을 모두 사용했습니다'
                    : undefined
              }
            >
              {offers.length > 0 ? '보드 새로고침' : '스폰서 제안 확인'} ({rerollsRemaining}/{MAX_REROLLS_PER_SEASON})
            </button>
          </div>

          {offers.length === 0 ? (
            <p className="fm-text-muted fm-text-md">보드를 열어 계약 성향, 기대 수익, 리스크를 비교해보세요.</p>
          ) : (
            <div className="fm-grid fm-grid--auto">
              {offers.map((offer) => (
                <div key={offer.name} className="fm-card fm-flex-col fm-gap-sm">
                  <div className="fm-flex fm-items-center fm-gap-sm">
                    <span
                      className="fm-badge"
                      style={{
                        color: SPONSOR_TIER_COLORS[offer.tier],
                        borderColor: SPONSOR_TIER_COLORS[offer.tier],
                        border: '1px solid',
                      }}
                    >
                      {SPONSOR_TIER_LABELS[offer.tier]}
                    </span>
                    <span className="fm-badge fm-badge--info">{SPONSOR_STYLE_LABELS[offer.offerStyle]}</span>
                    <span className="fm-text-lg fm-font-semibold fm-text-primary">{offer.name}</span>
                  </div>

                  <p className="fm-text-base fm-text-secondary" style={{ margin: 0 }}>{offer.description}</p>
                  <p className="fm-text-sm fm-text-muted" style={{ margin: 0, lineHeight: 1.5 }}>{offer.pitch}</p>

                  <div className="fm-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="fm-text-xs fm-text-muted fm-mb-xs">이 계약의 성격</div>
                    <div className="fm-text-secondary">{getOfferMeaning(offer.offerStyle)}</div>
                  </div>

                  <div className="fm-info-row">
                    <span className="fm-info-row__label">기본 지급액</span>
                    <span className="fm-info-row__value fm-text-success">+{formatAmount(offer.baseWeeklyPayout)}</span>
                  </div>
                  <div className="fm-info-row">
                    <span className="fm-info-row__label">최대 기대 수익</span>
                    <span className="fm-info-row__value fm-text-accent">+{formatAmount(offer.maxWeeklyPayout)}</span>
                  </div>
                  <div className="fm-info-row">
                    <span className="fm-info-row__label">계약 길이</span>
                    <span className="fm-info-row__value">{offer.durationWeeks}주</span>
                  </div>
                  <div className="fm-info-row">
                    <span className="fm-info-row__label">필요 명성</span>
                    <span className="fm-info-row__value">{offer.requiredMinReputation}</span>
                  </div>

                  {offer.conditions.length > 0 ? (
                    <div className="fm-flex-col fm-gap-xs">
                      <span className="fm-text-sm fm-font-semibold fm-text-primary">핵심 조건</span>
                      {offer.conditions.map((condition) => (
                        <div key={`${offer.name}-${condition.type}`} className="fm-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <div className="fm-flex fm-justify-between fm-items-center fm-gap-sm">
                            <span className="fm-text-sm fm-text-secondary">{SPONSOR_CONDITION_LABELS[condition.type]}</span>
                            <span className="fm-text-sm fm-text-accent">
                              +{formatAmount(condition.bonusAmount)}
                              {condition.penaltyAmount > 0 ? ` / fail -${formatAmount(condition.penaltyAmount)}` : ''}
                            </span>
                          </div>
                          <p className="fm-text-xs fm-text-muted" style={{ margin: '6px 0 0 0', lineHeight: 1.4 }}>
                            {condition.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="fm-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <span className="fm-text-sm fm-text-secondary">추가 조건이 없는 순수 주간 수익형 계약입니다.</span>
                    </div>
                  )}

                  <div className="fm-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="fm-text-xs fm-text-muted fm-mb-xs">실패 리스크</div>
                    <div className="fm-text-secondary">{offer.riskNote}</div>
                  </div>

                  <div className="fm-flex fm-gap-sm fm-mt-sm">
                    <button className="fm-btn fm-btn--success fm-flex-1" onClick={() => handleAcceptOffer(offer)} disabled={isMaxSponsors}>
                      {isMaxSponsors ? '슬롯 없음' : '수락'}
                    </button>
                    <button className="fm-btn fm-btn--danger fm-flex-1" onClick={() => handleRejectOffer(offer)}>
                      거절
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">재정 로그</span>
        </div>
        <div className="fm-panel__body--flush">
          {summary.logs.length === 0 ? (
            <p className="fm-text-muted fm-text-md fm-p-md">아직 기록된 재정 로그가 없습니다.</p>
          ) : (
            <div className="fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>구분</th>
                    <th>항목</th>
                    <th>금액</th>
                    <th>설명</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.logs.map((log: FinanceLog) => (
                    <tr key={log.id}>
                      <td>{log.gameDate}</td>
                      <td className={log.type === 'income' ? 'fm-cell--green' : 'fm-cell--red'}>
                        {log.type === 'income' ? '수입' : '지출'}
                      </td>
                      <td>{getCategoryLabel(log.category)}</td>
                      <td className={log.type === 'income' ? 'fm-cell--green' : 'fm-cell--red'}>
                        {log.type === 'income' ? '+' : '-'}
                        {formatAmount(log.amount)}
                      </td>
                      <td className="fm-text-secondary">{log.description ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
