import { useEffect, useState, useCallback } from 'react';
import { getTeamFinanceSummary, getActiveSponsors, type FinanceLog, type FinanceSummary, type Sponsor } from '../../../db/queries';
import { useGameStore } from '../../../stores/gameStore';
import { getTeamWithRoster } from '../../../db/queries';
import {
  generateSponsorOffers,
  acceptSponsor,
  SPONSOR_TIER_LABELS,
  SPONSOR_TIER_COLORS,
  MAX_ACTIVE_SPONSORS,
  MAX_REROLLS_PER_SEASON,
  type SponsorOffer,
  type SponsorTier,
} from '../../../engine/economy/sponsorEngine';
import { formatAmount } from '../../../utils/formatUtils';

/** 카테고리 한국어 라벨 */
const CATEGORY_LABELS: Record<string, string> = {
  salary: '선수 급여',
  prize: '경기 상금',
  sponsorship: '스폰서십',
  transfer: '이적료',
  coaching: '코칭스태프',
  facility: '시설 운영비',
  merchandise: '굿즈 판매',
  streaming: '스트리밍',
  penalty: '벌금/위약금',
};

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function FinanceView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [budget, setBudget] = useState<number>(0);
  const [reputation, setReputation] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // 스폰서 상태
  const [activeSponsors, setActiveSponsors] = useState<Sponsor[]>([]);
  const [offers, setOffers] = useState<SponsorOffer[]>([]);
  const [isGeneratingOffers, setIsGeneratingOffers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 리롤 횟수 (시즌당 제한, localStorage로 유지)
  const rerollKey = season ? `sponsor_rerolls_${season.id}` : '';
  const [rerollsUsed, setRerollsUsed] = useState<number>(() => {
    if (!rerollKey) return 0;
    return Number(localStorage.getItem(rerollKey) ?? '0');
  });
  const rerollsRemaining = MAX_REROLLS_PER_SEASON - rerollsUsed;
  const isMaxSponsors = activeSponsors.length >= MAX_ACTIVE_SPONSORS;

  const loadData = useCallback(async () => {
    if (!season || !save) return;

    setIsLoading(true);
    setError(null);

    try {
      const [financeSummary, team, sponsors] = await Promise.all([
        getTeamFinanceSummary(save.userTeamId, season.id),
        getTeamWithRoster(save.userTeamId),
        getActiveSponsors(save.userTeamId, season.id),
      ]);

      setSummary(financeSummary);
      setBudget(team?.budget ?? 0);
      setReputation(team?.reputation ?? 0);
      setActiveSponsors(sponsors);
    } catch (err) {
      console.error('재정 데이터 로딩 실패:', err);
      setError('재정 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [season, save]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      await loadData();
    };

    if (!cancelled) load();

    return () => {
      cancelled = true;
    };
  }, [loadData]);

  /** 스폰서 제안 새로 생성 (리롤) */
  const handleGenerateOffers = () => {
    if (rerollsRemaining <= 0) return;
    setIsGeneratingOffers(true);
    const activeNames = activeSponsors.map((s) => s.name);
    const newOffers = generateSponsorOffers(reputation, activeNames);
    setOffers(newOffers);

    const newCount = rerollsUsed + 1;
    setRerollsUsed(newCount);
    if (rerollKey) localStorage.setItem(rerollKey, String(newCount));

    setIsGeneratingOffers(false);
  };

  /** 스폰서 제안 수락 */
  const handleAcceptOffer = async (offer: SponsorOffer) => {
    if (!season || !save) return;

    setError(null);
    try {
      const currentDate = season.currentDate;
      await acceptSponsor(save.userTeamId, season.id, offer, currentDate);

      // 제안 목록에서 제거 + 전체 재정 데이터 다시 로딩
      setOffers((prev) => prev.filter((o) => o.name !== offer.name));
      await loadData();
    } catch (err) {
      console.error('스폰서 수락 실패:', err);
      setError('스폰서 제안 수락 중 오류가 발생했습니다.');
    }
  };

  /** 스폰서 제안 거절 */
  const handleRejectOffer = (offer: SponsorOffer) => {
    setOffers((prev) => prev.filter((o) => o.name !== offer.name));
  };

  if (!season || !save) {
    return <p className="fm-text-muted">데이터를 불러오는 중...</p>;
  }

  if (isLoading || !summary) {
    return <p className="fm-text-muted">재정 정보를 불러오는 중...</p>;
  }

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">팀 재정</h1>
      </div>

      {/* 요약 카드 */}
      <div className="fm-grid fm-grid--4 fm-mb-lg">
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">현재 예산</span>
            <span className="fm-stat__value fm-stat__value--accent">{formatAmount(budget)}</span>
          </div>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">총 수입</span>
            <span className="fm-stat__value fm-text-success">{formatAmount(summary.totalIncome)}</span>
          </div>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">총 지출</span>
            <span className="fm-stat__value fm-text-danger">{formatAmount(summary.totalExpense)}</span>
          </div>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">시즌 수지</span>
            <span className={`fm-stat__value ${summary.balance >= 0 ? 'fm-text-success' : 'fm-text-danger'}`}>
              {summary.balance >= 0 ? '+' : ''}{formatAmount(summary.balance)}
            </span>
          </div>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="fm-alert fm-alert--danger fm-mb-md">
          <span className="fm-alert__text">{error}</span>
          <button className="fm-alert__action" onClick={() => setError(null)}>x</button>
        </div>
      )}

      {/* 스폰서 관리 */}
      <div className="fm-panel fm-mb-lg">
        <div className="fm-panel__header">
          <span className="fm-panel__title">스폰서 관리</span>
        </div>
        <div className="fm-panel__body">
          {/* 활성 스폰서 목록 */}
          <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
            <h3 className="fm-text-lg fm-font-semibold fm-text-primary">현재 스폰서 계약</h3>
            <span className="fm-badge fm-badge--default">
              {activeSponsors.length} / {MAX_ACTIVE_SPONSORS}
            </span>
          </div>
          {activeSponsors.length === 0 ? (
            <p className="fm-text-muted fm-text-md fm-mb-md">
              현재 활성 스폰서가 없습니다.
            </p>
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
                    <span className="fm-info-row__label">주간 수입</span>
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

          {/* 스폰서 제안 */}
          <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm fm-mt-md">
            <h3 className="fm-text-lg fm-font-semibold fm-text-primary">스폰서 제안</h3>
            <button
              className="fm-btn fm-btn--info fm-btn--sm"
              onClick={handleGenerateOffers}
              disabled={isGeneratingOffers || rerollsRemaining <= 0 || isMaxSponsors}
              title={
                isMaxSponsors
                  ? `최대 스폰서 수(${MAX_ACTIVE_SPONSORS}개)에 도달했습니다`
                  : rerollsRemaining <= 0
                  ? '시즌 리롤 횟수를 모두 사용했습니다'
                  : undefined
              }
            >
              {offers.length > 0 ? '새로운 제안 받기' : '스폰서 제안 확인'}
              {' '}({rerollsRemaining}/{MAX_REROLLS_PER_SEASON})
            </button>
          </div>

          {offers.length === 0 ? (
            <p className="fm-text-muted fm-text-md">
              스폰서 제안을 확인하려면 위 버튼을 클릭하세요.
            </p>
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
                    <span className="fm-text-lg fm-font-semibold fm-text-primary">{offer.name}</span>
                  </div>
                  <p className="fm-text-base fm-text-secondary" style={{ margin: 0 }}>{offer.description}</p>
                  <div className="fm-info-row">
                    <span className="fm-info-row__label">주간 수입</span>
                    <span className="fm-info-row__value fm-text-success">+{formatAmount(offer.weeklyPayout)}</span>
                  </div>
                  <div className="fm-info-row">
                    <span className="fm-info-row__label">계약 기간</span>
                    <span className="fm-info-row__value">{offer.durationWeeks}주</span>
                  </div>
                  <div className="fm-info-row">
                    <span className="fm-info-row__label">최소 명성</span>
                    <span className="fm-info-row__value">{offer.requiredMinReputation}</span>
                  </div>
                  <div className="fm-flex fm-gap-sm fm-mt-sm">
                    <button
                      className="fm-btn fm-btn--success fm-flex-1"
                      onClick={() => handleAcceptOffer(offer)}
                      disabled={isMaxSponsors}
                      title={isMaxSponsors ? `최대 ${MAX_ACTIVE_SPONSORS}개까지만 계약할 수 있습니다` : undefined}
                    >
                      {isMaxSponsors ? '슬롯 없음' : '수락'}
                    </button>
                    <button
                      className="fm-btn fm-btn--danger fm-flex-1"
                      onClick={() => handleRejectOffer(offer)}
                    >
                      거절
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 거래 내역 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">거래 내역</span>
        </div>
        <div className="fm-panel__body--flush">
          {summary.logs.length === 0 ? (
            <p className="fm-text-muted fm-text-md fm-p-md">아직 거래 내역이 없습니다.</p>
          ) : (
            <div className="fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>유형</th>
                    <th>카테고리</th>
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
                        {log.type === 'income' ? '+' : '-'}{formatAmount(log.amount)}
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
