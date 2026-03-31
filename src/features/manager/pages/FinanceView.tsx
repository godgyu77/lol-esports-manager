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
  salary: 'Player salary',
  prize: 'Prize money',
  sponsorship: 'Sponsorship',
  transfer: 'Transfer fee',
  coaching: 'Coaching staff',
  facility: 'Facility operations',
  merchandise: 'Merchandise',
  streaming: 'Streaming',
  penalty: 'Penalty / breach',
};

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

function getOfferMeaning(style: ConditionalSponsorOffer['offerStyle']): string {
  if (style === 'promotion') return 'Higher visibility, but it can create media and schedule pressure.';
  if (style === 'performance') return 'High upside if you hit targets, but failure hurts.';
  return 'Lower variance and safer planning for the season.';
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
          ? {
              ...team,
              budget: nextBudget,
              reputation: nextReputation ?? team.reputation,
            }
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
      setError('Failed to load finance data.');
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
      setError('Failed to accept sponsor offer.');
    }
  };

  const handleRejectOffer = (offer: ConditionalSponsorOffer) => {
    setOffers((prev) => prev.filter((existing) => existing.name !== offer.name));
  };

  const sponsorStrategyCards = useMemo(() => ([
    {
      title: 'Stable deal',
      badge: SPONSOR_STYLE_LABELS.fixed,
      detail: 'Reliable weekly cashflow with the lowest volatility.',
    },
    {
      title: 'Performance deal',
      badge: SPONSOR_STYLE_LABELS.performance,
      detail: 'Best upside when results are strong, but pressure rises with it.',
    },
    {
      title: 'Promotion deal',
      badge: SPONSOR_STYLE_LABELS.promotion,
      detail: 'Brand growth and visibility matter more, which can create extra demands.',
    },
  ]), []);

  if (!season || !save) {
    return <p className="fm-text-muted">Loading data...</p>;
  }

  if (isLoading || !summary) {
    return <p className="fm-text-muted">Loading finance summary...</p>;
  }

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">Finance</h1>
      </div>

      <div className="fm-grid fm-grid--4 fm-mb-lg">
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">Budget</span>
            <span className="fm-stat__value fm-stat__value--accent">{formatAmount(budget)}</span>
          </div>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">Total income</span>
            <span className="fm-stat__value fm-text-success">{formatAmount(summary.totalIncome)}</span>
          </div>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">Total expense</span>
            <span className="fm-stat__value fm-text-danger">{formatAmount(summary.totalExpense)}</span>
          </div>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">Season balance</span>
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
          <span className="fm-panel__title">Sponsor posture</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--3 fm-mb-md">
            {sponsorStrategyCards.map((card) => (
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
              <span className="fm-text-primary fm-font-semibold">Negotiation quality</span>
              <span className="fm-badge fm-badge--default">{effectiveReputation}</span>
            </div>
            <p className="fm-text-secondary fm-mt-sm" style={{ marginBottom: 0 }}>
              Base reputation {reputation}
              {sponsorBonus > 0 ? ` / media-friendly bonus +${sponsorBonus}` : ''}.
              Offers are generated from this effective reputation.
            </p>
          </div>
        </div>
      </div>

      <div className="fm-panel fm-mb-lg">
        <div className="fm-panel__header">
          <span className="fm-panel__title">Sponsor management</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
            <h3 className="fm-text-lg fm-font-semibold fm-text-primary">Active deals</h3>
            <span className="fm-badge fm-badge--default">
              {activeSponsors.length} / {MAX_ACTIVE_SPONSORS}
            </span>
          </div>

          {activeSponsors.length === 0 ? (
            <p className="fm-text-muted fm-text-md fm-mb-md">No active sponsor is currently signed.</p>
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
                    <span className="fm-info-row__label">Weekly payout</span>
                    <span className="fm-info-row__value fm-text-success">+{formatAmount(sponsor.weeklyPayout)}</span>
                  </div>
                  <div className="fm-info-row">
                    <span className="fm-info-row__label">Contract window</span>
                    <span className="fm-info-row__value">{sponsor.startDate} ~ {sponsor.endDate}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="fm-divider" />

          <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm fm-mt-md">
            <h3 className="fm-text-lg fm-font-semibold fm-text-primary">Offer board</h3>
            <button
              className="fm-btn fm-btn--info fm-btn--sm"
              onClick={handleGenerateOffers}
              disabled={isGeneratingOffers || rerollsRemaining <= 0 || isMaxSponsors}
              title={
                isMaxSponsors
                  ? `Only ${MAX_ACTIVE_SPONSORS} active sponsors can be held at once`
                  : rerollsRemaining <= 0
                    ? 'All rerolls have been used this season'
                    : undefined
              }
            >
              {offers.length > 0 ? 'Refresh board' : 'Check sponsor offers'} ({rerollsRemaining}/{MAX_REROLLS_PER_SEASON})
            </button>
          </div>

          {offers.length === 0 ? (
            <p className="fm-text-muted fm-text-md">Open the board to compare sponsor philosophies, upside, and risk.</p>
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
                    <div className="fm-text-xs fm-text-muted fm-mb-xs">What this deal means</div>
                    <div className="fm-text-secondary">{getOfferMeaning(offer.offerStyle)}</div>
                  </div>

                  <div className="fm-info-row">
                    <span className="fm-info-row__label">Base payout</span>
                    <span className="fm-info-row__value fm-text-success">+{formatAmount(offer.baseWeeklyPayout)}</span>
                  </div>
                  <div className="fm-info-row">
                    <span className="fm-info-row__label">Max upside</span>
                    <span className="fm-info-row__value fm-text-accent">+{formatAmount(offer.maxWeeklyPayout)}</span>
                  </div>
                  <div className="fm-info-row">
                    <span className="fm-info-row__label">Duration</span>
                    <span className="fm-info-row__value">{offer.durationWeeks} weeks</span>
                  </div>
                  <div className="fm-info-row">
                    <span className="fm-info-row__label">Required reputation</span>
                    <span className="fm-info-row__value">{offer.requiredMinReputation}</span>
                  </div>

                  {offer.conditions.length > 0 ? (
                    <div className="fm-flex-col fm-gap-xs">
                      <span className="fm-text-sm fm-font-semibold fm-text-primary">Core conditions</span>
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
                      <span className="fm-text-sm fm-text-secondary">No extra trigger is attached. This is a straightforward weekly revenue deal.</span>
                    </div>
                  )}

                  <div className="fm-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="fm-text-xs fm-text-muted fm-mb-xs">Failure risk</div>
                    <div className="fm-text-secondary">{offer.riskNote}</div>
                  </div>

                  <div className="fm-flex fm-gap-sm fm-mt-sm">
                    <button className="fm-btn fm-btn--success fm-flex-1" onClick={() => handleAcceptOffer(offer)} disabled={isMaxSponsors}>
                      {isMaxSponsors ? 'No slot' : 'Accept'}
                    </button>
                    <button className="fm-btn fm-btn--danger fm-flex-1" onClick={() => handleRejectOffer(offer)}>
                      Reject
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
          <span className="fm-panel__title">Finance log</span>
        </div>
        <div className="fm-panel__body--flush">
          {summary.logs.length === 0 ? (
            <p className="fm-text-muted fm-text-md fm-p-md">No finance log exists yet.</p>
          ) : (
            <div className="fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.logs.map((log: FinanceLog) => (
                    <tr key={log.id}>
                      <td>{log.gameDate}</td>
                      <td className={log.type === 'income' ? 'fm-cell--green' : 'fm-cell--red'}>
                        {log.type === 'income' ? 'Income' : 'Expense'}
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
