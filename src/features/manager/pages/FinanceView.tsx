import { useEffect, useState, useCallback } from 'react';
import { getTeamFinanceSummary, getActiveSponsors, type FinanceLog, type FinanceSummary, type Sponsor } from '../../../db/queries';
import { useGameStore } from '../../../stores/gameStore';
import { getTeamWithRoster } from '../../../db/queries';
import {
  generateSponsorOffers,
  acceptSponsor,
  SPONSOR_TIER_LABELS,
  SPONSOR_TIER_COLORS,
  type SponsorOffer,
  type SponsorTier,
} from '../../../engine/economy/sponsorEngine';

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

function formatAmount(amount: number): string {
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(1)}억`;
  }
  return `${amount.toLocaleString()}만`;
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

  /** 스폰서 제안 새로 생성 */
  const handleGenerateOffers = () => {
    setIsGeneratingOffers(true);
    const activeNames = activeSponsors.map((s) => s.name);
    const newOffers = generateSponsorOffers(reputation, activeNames);
    setOffers(newOffers);
    setIsGeneratingOffers(false);
  };

  /** 스폰서 제안 수락 */
  const handleAcceptOffer = async (offer: SponsorOffer) => {
    if (!season || !save) return;

    setError(null);
    try {
      const currentDate = season.currentDate;
      await acceptSponsor(save.userTeamId, season.id, offer, currentDate);

      // 제안 목록에서 제거 + 활성 스폰서 다시 로딩
      setOffers((prev) => prev.filter((o) => o.name !== offer.name));
      const sponsors = await getActiveSponsors(save.userTeamId, season.id);
      setActiveSponsors(sponsors);
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
    return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  }

  if (isLoading || !summary) {
    return <p style={{ color: '#6a6a7a' }}>재정 정보를 불러오는 중...</p>;
  }

  return (
    <div>
      <h1 style={styles.title}>팀 재정</h1>

      {/* 요약 카드 */}
      <div style={styles.summaryRow}>
        <div style={styles.card}>
          <span style={styles.cardLabel}>현재 예산</span>
          <span style={styles.cardValueGold}>{formatAmount(budget)}</span>
        </div>
        <div style={styles.card}>
          <span style={styles.cardLabel}>총 수입</span>
          <span style={styles.cardValueGreen}>{formatAmount(summary.totalIncome)}</span>
        </div>
        <div style={styles.card}>
          <span style={styles.cardLabel}>총 지출</span>
          <span style={styles.cardValueRed}>{formatAmount(summary.totalExpense)}</span>
        </div>
        <div style={styles.card}>
          <span style={styles.cardLabel}>시즌 수지</span>
          <span style={{
            ...styles.cardValue,
            color: summary.balance >= 0 ? '#90ee90' : '#ff6b6b',
          }}>
            {summary.balance >= 0 ? '+' : ''}{formatAmount(summary.balance)}
          </span>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div style={styles.errorMessage}>
          {error}
          <button style={styles.errorClose} onClick={() => setError(null)}>x</button>
        </div>
      )}

      {/* 스폰서 관리 */}
      <h2 style={styles.sectionTitle}>스폰서 관리</h2>

      {/* 활성 스폰서 목록 */}
      <h3 style={styles.subSectionTitle}>현재 스폰서 계약</h3>
      {activeSponsors.length === 0 ? (
        <p style={{ color: '#6a6a7a', fontSize: '13px', marginBottom: '16px' }}>
          현재 활성 스폰서가 없습니다.
        </p>
      ) : (
        <div style={styles.sponsorGrid}>
          {activeSponsors.map((sponsor) => (
            <div key={sponsor.id} style={styles.sponsorCard}>
              <div style={styles.sponsorHeader}>
                <span style={{
                  ...styles.sponsorTierBadge,
                  color: SPONSOR_TIER_COLORS[sponsor.tier as SponsorTier] ?? '#a0a0b0',
                  borderColor: SPONSOR_TIER_COLORS[sponsor.tier as SponsorTier] ?? '#a0a0b0',
                }}>
                  {SPONSOR_TIER_LABELS[sponsor.tier as SponsorTier] ?? sponsor.tier}
                </span>
                <span style={styles.sponsorName}>{sponsor.name}</span>
              </div>
              <div style={styles.sponsorInfo}>
                <span style={styles.sponsorInfoLabel}>주간 수입</span>
                <span style={styles.sponsorInfoValueGreen}>+{formatAmount(sponsor.weeklyPayout)}</span>
              </div>
              <div style={styles.sponsorInfo}>
                <span style={styles.sponsorInfoLabel}>계약 기간</span>
                <span style={styles.sponsorInfoValue}>{sponsor.startDate} ~ {sponsor.endDate}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 스폰서 제안 */}
      <div style={styles.offerSection}>
        <div style={styles.offerHeader}>
          <h3 style={styles.subSectionTitle}>스폰서 제안</h3>
          <button
            style={styles.generateBtn}
            onClick={handleGenerateOffers}
            disabled={isGeneratingOffers}
          >
            {offers.length > 0 ? '새로운 제안 받기' : '스폰서 제안 확인'}
          </button>
        </div>

        {offers.length === 0 ? (
          <p style={{ color: '#6a6a7a', fontSize: '13px' }}>
            스폰서 제안을 확인하려면 위 버튼을 클릭하세요.
          </p>
        ) : (
          <div style={styles.sponsorGrid}>
            {offers.map((offer) => (
              <div key={offer.name} style={styles.offerCard}>
                <div style={styles.sponsorHeader}>
                  <span style={{
                    ...styles.sponsorTierBadge,
                    color: SPONSOR_TIER_COLORS[offer.tier],
                    borderColor: SPONSOR_TIER_COLORS[offer.tier],
                  }}>
                    {SPONSOR_TIER_LABELS[offer.tier]}
                  </span>
                  <span style={styles.sponsorName}>{offer.name}</span>
                </div>
                <p style={styles.offerDesc}>{offer.description}</p>
                <div style={styles.sponsorInfo}>
                  <span style={styles.sponsorInfoLabel}>주간 수입</span>
                  <span style={styles.sponsorInfoValueGreen}>+{formatAmount(offer.weeklyPayout)}</span>
                </div>
                <div style={styles.sponsorInfo}>
                  <span style={styles.sponsorInfoLabel}>계약 기간</span>
                  <span style={styles.sponsorInfoValue}>{offer.durationWeeks}주</span>
                </div>
                <div style={styles.sponsorInfo}>
                  <span style={styles.sponsorInfoLabel}>최소 명성</span>
                  <span style={styles.sponsorInfoValue}>{offer.requiredMinReputation}</span>
                </div>
                <div style={styles.offerActions}>
                  <button
                    style={styles.acceptBtn}
                    onClick={() => handleAcceptOffer(offer)}
                  >
                    수락
                  </button>
                  <button
                    style={styles.rejectBtn}
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

      {/* 거래 내역 */}
      <h2 style={{ ...styles.sectionTitle, marginTop: '32px' }}>거래 내역</h2>
      {summary.logs.length === 0 ? (
        <p style={{ color: '#6a6a7a', fontSize: '13px' }}>아직 거래 내역이 없습니다.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>날짜</th>
              <th style={styles.th}>유형</th>
              <th style={styles.th}>카테고리</th>
              <th style={styles.th}>금액</th>
              <th style={styles.th}>설명</th>
            </tr>
          </thead>
          <tbody>
            {summary.logs.map((log: FinanceLog) => (
              <tr key={log.id} style={styles.tr}>
                <td style={styles.td}>{log.gameDate}</td>
                <td style={{
                  ...styles.td,
                  color: log.type === 'income' ? '#90ee90' : '#ff6b6b',
                }}>
                  {log.type === 'income' ? '수입' : '지출'}
                </td>
                <td style={styles.td}>{getCategoryLabel(log.category)}</td>
                <td style={{
                  ...styles.td,
                  color: log.type === 'income' ? '#90ee90' : '#ff6b6b',
                  fontWeight: 600,
                }}>
                  {log.type === 'income' ? '+' : '-'}{formatAmount(log.amount)}
                </td>
                <td style={styles.tdDesc}>{log.description ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '24px',
  },
  summaryRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '32px',
  },
  card: {
    flex: 1,
    background: '#12122a',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardLabel: {
    fontSize: '12px',
    color: '#6a6a7a',
    fontWeight: 500,
  },
  cardValue: {
    fontSize: '20px',
    fontWeight: 700,
  },
  cardValueGold: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#c89b3c',
  },
  cardValueGreen: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#90ee90',
  },
  cardValueRed: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#ff6b6b',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#c89b3c',
    marginBottom: '12px',
  },
  subSectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#d0d0e0',
    marginBottom: '8px',
    marginTop: 0,
  },
  // 스폰서 카드 그리드
  sponsorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '12px',
    marginBottom: '20px',
  },
  sponsorCard: {
    background: '#12122a',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  offerCard: {
    background: '#12122a',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sponsorHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sponsorTierBadge: {
    fontSize: '10px',
    fontWeight: 700,
    border: '1px solid',
    borderRadius: '4px',
    padding: '2px 6px',
    textTransform: 'uppercase' as const,
  },
  sponsorName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f0e6d2',
  },
  sponsorInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sponsorInfoLabel: {
    fontSize: '12px',
    color: '#6a6a7a',
  },
  sponsorInfoValue: {
    fontSize: '12px',
    color: '#c0c0d0',
  },
  sponsorInfoValueGreen: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#90ee90',
  },
  offerDesc: {
    fontSize: '12px',
    color: '#8a8a9a',
    margin: 0,
  },
  offerSection: {
    marginTop: '16px',
    marginBottom: '8px',
  },
  offerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  generateBtn: {
    background: '#1a3a5c',
    color: '#8ac4ff',
    border: '1px solid #2a5a8c',
    borderRadius: '6px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  offerActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '4px',
  },
  acceptBtn: {
    flex: 1,
    background: '#1a3a2a',
    color: '#90ee90',
    border: '1px solid #2a5a3a',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  rejectBtn: {
    flex: 1,
    background: '#3a1a1a',
    color: '#ff6b6b',
    border: '1px solid #5a2a2a',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  errorMessage: {
    padding: '10px 16px',
    marginBottom: '12px',
    border: '1px solid #e74c3c',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#e74c3c',
    background: 'rgba(255,255,255,0.02)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorClose: {
    background: 'none',
    border: 'none',
    color: '#e74c3c',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '0 4px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    padding: '8px 10px',
    textAlign: 'left',
    borderBottom: '1px solid #3a3a5c',
    color: '#6a6a7a',
    fontSize: '12px',
    fontWeight: 500,
  },
  tr: {
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  td: {
    padding: '8px 10px',
    color: '#c0c0d0',
  },
  tdDesc: {
    padding: '8px 10px',
    color: '#8a8a9a',
    fontSize: '12px',
  },
};
