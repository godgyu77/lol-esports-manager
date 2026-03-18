/**
 * 시설/인프라 투자 페이지
 * - 6개 시설 카드 (레벨 게이지, 현재 효과, 업그레이드 비용)
 * - 업그레이드 버튼 (예산 부족 시 비활성)
 * - 총 보정 효과 요약 바
 */

import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  getTeamFacilities,
  initDefaultFacilities,
  upgradeFacility,
  calculateFacilityBonuses,
  type FacilityBonuses,
} from '../../../engine/facility/facilityEngine';
import type { TeamFacility, FacilityType } from '../../../types/facility';
import { FACILITY_TYPE_LABELS, FACILITY_EFFECTS } from '../../../types/facility';
import { getTeamWithRoster } from '../../../db/queries';

const FACILITY_ICONS: Record<FacilityType, string> = {
  gaming_house: '\u{1F3E0}',
  training_room: '\u{1F3CB}',
  analysis_lab: '\u{1F4CA}',
  gym: '\u{1F4AA}',
  media_room: '\u{1F4F9}',
  cafeteria: '\u{1F37D}',
};

const formatCost = (cost: number): string => {
  if (cost >= 10000) return `${(cost / 10000).toFixed(1)}억`;
  return `${cost.toLocaleString()}만`;
};

export function FacilityView() {
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);

  const [facilities, setFacilities] = useState<TeamFacility[]>([]);
  const [bonuses, setBonuses] = useState<FacilityBonuses | null>(null);
  const [budget, setBudget] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const userTeamId = save?.userTeamId ?? '';
  const currentDate = season?.currentDate ?? '';

  const loadData = useCallback(async () => {
    if (!userTeamId) return;
    setIsLoading(true);
    try {
      let facs = await getTeamFacilities(userTeamId);
      if (facs.length === 0) {
        await initDefaultFacilities(userTeamId);
        facs = await getTeamFacilities(userTeamId);
      }
      const team = await getTeamWithRoster(userTeamId);
      const bon = await calculateFacilityBonuses(userTeamId);
      setFacilities(facs);
      setBonuses(bon);
      setBudget(team?.budget ?? 0);
    } catch (err) {
      console.error('시설 데이터 로딩 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userTeamId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpgrade = async (facilityType: FacilityType) => {
    if (!userTeamId || !currentDate) return;
    setMessage(null);
    const result = await upgradeFacility(userTeamId, facilityType, currentDate);
    setMessage({ text: result.message, type: result.success ? 'success' : 'error' });
    if (result.success) {
      await loadData();
    }
  };

  if (isLoading) {
    return <div style={styles.loading}>시설 데이터를 불러오는 중...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>시설 관리</h1>
        <div style={styles.budgetBadge}>
          보유 예산: <span style={styles.budgetValue}>{formatCost(budget)}</span>
        </div>
      </div>

      {message && (
        <div style={{ ...styles.message, borderColor: message.type === 'success' ? '#2ecc71' : '#e74c3c' }}>
          {message.text}
        </div>
      )}

      {/* 총 보정 효과 요약 바 */}
      {bonuses && (
        <div style={styles.summaryBar}>
          <span style={styles.summaryTitle}>총 시설 보정 효과</span>
          <div style={styles.summaryItems}>
            <span style={styles.summaryItem}>훈련 효율 +{bonuses.trainingEfficiency}%</span>
            <span style={styles.summaryItem}>성장 속도 +{bonuses.statGrowthSpeed}%</span>
            <span style={styles.summaryItem}>밴픽 정확도 +{bonuses.draftAccuracy}</span>
            <span style={styles.summaryItem}>스태미나 회복 +{bonuses.staminaRecovery}</span>
            <span style={styles.summaryItem}>팬/스폰서 +{bonuses.fanSponsorBonus}%</span>
            <span style={styles.summaryItem}>사기 보정 +{bonuses.moraleBoost}</span>
          </div>
        </div>
      )}

      {/* 시설 카드 그리드 */}
      <div style={styles.grid}>
        {facilities.map((fac) => {
          const isMaxLevel = fac.level >= 5;
          const canAfford = budget >= fac.upgradeCost;
          const effectText = FACILITY_EFFECTS[fac.facilityType].replace('{value}', String(fac.effectValue));

          return (
            <div key={fac.facilityType} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.cardIcon}>{FACILITY_ICONS[fac.facilityType]}</span>
                <span style={styles.cardName}>{FACILITY_TYPE_LABELS[fac.facilityType]}</span>
              </div>

              {/* 레벨 게이지 */}
              <div style={styles.levelSection}>
                <span style={styles.levelLabel}>Lv. {fac.level}</span>
                <div style={styles.levelGauge}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <div
                      key={i}
                      style={{
                        ...styles.levelDot,
                        background: i < fac.level ? '#c89b3c' : '#2a2a4a',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* 현재 효과 */}
              <div style={styles.effectSection}>
                <span style={styles.effectLabel}>현재 효과</span>
                <span style={styles.effectValue}>{effectText}</span>
              </div>

              {/* 업그레이드 영역 */}
              <div style={styles.upgradeSection}>
                {isMaxLevel ? (
                  <div style={styles.maxLevelBadge}>MAX LEVEL</div>
                ) : (
                  <>
                    <div style={styles.costInfo}>
                      업그레이드 비용: <span style={{ color: canAfford ? '#2ecc71' : '#e74c3c' }}>{formatCost(fac.upgradeCost)}</span>
                    </div>
                    <button
                      style={{
                        ...styles.upgradeBtn,
                        ...(canAfford ? {} : styles.upgradeBtnDisabled),
                      }}
                      disabled={!canAfford}
                      onClick={() => handleUpgrade(fac.facilityType)}
                      aria-label={`${FACILITY_TYPE_LABELS[fac.facilityType]} 업그레이드`}
                    >
                      업그레이드
                    </button>
                  </>
                )}
              </div>

              {fac.lastUpgraded && (
                <div style={styles.lastUpgraded}>마지막 업그레이드: {fac.lastUpgraded}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1100px',
  },
  loading: {
    color: '#8a8a9a',
    padding: '60px',
    textAlign: 'center',
    fontSize: '15px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#c89b3c',
    margin: 0,
  },
  budgetBadge: {
    background: '#12122a',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '14px',
    color: '#8a8a9a',
  },
  budgetValue: {
    color: '#2ecc71',
    fontWeight: 700,
    marginLeft: '4px',
  },
  message: {
    padding: '12px 16px',
    borderRadius: '8px',
    background: 'rgba(18,18,42,0.8)',
    border: '1px solid',
    fontSize: '14px',
    color: '#e0e0e0',
    marginBottom: '16px',
  },
  summaryBar: {
    background: '#12122a',
    border: '1px solid #2a2a4a',
    borderRadius: '10px',
    padding: '16px 20px',
    marginBottom: '24px',
  },
  summaryTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#c89b3c',
    display: 'block',
    marginBottom: '10px',
  },
  summaryItems: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '12px',
  },
  summaryItem: {
    background: 'rgba(200,155,60,0.08)',
    border: '1px solid rgba(200,155,60,0.2)',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '12px',
    color: '#c89b3c',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
  },
  card: {
    background: '#12122a',
    border: '1px solid #2a2a4a',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  cardIcon: {
    fontSize: '24px',
  },
  cardName: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#e0e0e0',
  },
  levelSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  levelLabel: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#c89b3c',
    minWidth: '40px',
  },
  levelGauge: {
    display: 'flex',
    gap: '6px',
  },
  levelDot: {
    width: '24px',
    height: '8px',
    borderRadius: '4px',
    transition: 'background 0.3s',
  },
  effectSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  effectLabel: {
    fontSize: '11px',
    color: '#6a6a7a',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  effectValue: {
    fontSize: '14px',
    color: '#2ecc71',
    fontWeight: 600,
  },
  upgradeSection: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  costInfo: {
    fontSize: '13px',
    color: '#8a8a9a',
  },
  upgradeBtn: {
    padding: '10px 16px',
    background: 'rgba(200,155,60,0.15)',
    border: '1px solid rgba(200,155,60,0.4)',
    borderRadius: '8px',
    color: '#c89b3c',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  upgradeBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
    color: '#6a6a7a',
    borderColor: '#2a2a4a',
    background: 'rgba(42,42,74,0.3)',
  },
  maxLevelBadge: {
    textAlign: 'center' as const,
    padding: '10px',
    borderRadius: '8px',
    background: 'rgba(200,155,60,0.1)',
    border: '1px solid rgba(200,155,60,0.3)',
    color: '#c89b3c',
    fontWeight: 700,
    fontSize: '13px',
    letterSpacing: '1px',
  },
  lastUpgraded: {
    fontSize: '11px',
    color: '#5a5a6a',
    textAlign: 'right' as const,
  },
};
