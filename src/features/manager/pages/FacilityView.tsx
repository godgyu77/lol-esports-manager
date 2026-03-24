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
    return <div className="fm-text-muted fm-text-center fm-p-lg">시설 데이터를 불러오는 중...</div>;
  }

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">시설 관리</h1>
        <div className="fm-badge fm-badge--default fm-text-md">
          보유 예산: <span className="fm-text-success fm-font-bold" style={{ marginLeft: 4 }}>{formatCost(budget)}</span>
        </div>
      </div>

      {message && (
        <div className={`fm-alert ${message.type === 'success' ? 'fm-alert--success' : 'fm-alert--danger'} fm-mb-md`}>
          <span className="fm-alert__text">{message.text}</span>
        </div>
      )}

      {/* 총 보정 효과 요약 바 */}
      {bonuses && (
        <div className="fm-panel fm-mb-lg">
          <div className="fm-panel__header">
            <span className="fm-panel__title">총 시설 보정 효과</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-flex-wrap fm-gap-sm">
              <span className="fm-badge fm-badge--accent">훈련 효율 +{bonuses.trainingEfficiency}%</span>
              <span className="fm-badge fm-badge--accent">성장 속도 +{bonuses.statGrowthSpeed}%</span>
              <span className="fm-badge fm-badge--accent">밴픽 정확도 +{bonuses.draftAccuracy}</span>
              <span className="fm-badge fm-badge--accent">스태미나 회복 +{bonuses.staminaRecovery}</span>
              <span className="fm-badge fm-badge--accent">팬/스폰서 +{bonuses.fanSponsorBonus}%</span>
              <span className="fm-badge fm-badge--accent">사기 보정 +{bonuses.moraleBoost}</span>
            </div>
          </div>
        </div>
      )}

      {/* 시설 카드 그리드 */}
      <div className="fm-grid fm-grid--auto">
        {facilities.map((fac) => {
          const isMaxLevel = fac.level >= 5;
          const canAfford = budget >= fac.upgradeCost;
          const effectText = FACILITY_EFFECTS[fac.facilityType].replace('{value}', String(fac.effectValue));

          return (
            <div key={fac.facilityType} className="fm-card fm-flex-col fm-gap-md">
              <div className="fm-flex fm-items-center fm-gap-sm">
                <span className="fm-text-2xl">{FACILITY_ICONS[fac.facilityType]}</span>
                <span className="fm-text-xl fm-font-bold fm-text-primary">{FACILITY_TYPE_LABELS[fac.facilityType]}</span>
              </div>

              {/* 레벨 게이지 */}
              <div className="fm-flex fm-items-center fm-gap-sm">
                <span className="fm-text-lg fm-font-bold fm-text-accent" style={{ minWidth: 40 }}>Lv. {fac.level}</span>
                <div className="fm-flex fm-gap-xs">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 24,
                        height: 8,
                        borderRadius: 4,
                        background: i < fac.level ? 'var(--accent)' : 'var(--border)',
                        transition: 'background 0.3s',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* 현재 효과 */}
              <div className="fm-stat">
                <span className="fm-stat__label">현재 효과</span>
                <span className="fm-text-lg fm-font-semibold fm-text-success">{effectText}</span>
              </div>

              {/* 업그레이드 영역 */}
              <div className="fm-flex-col fm-gap-sm" style={{ marginTop: 'auto' }}>
                {isMaxLevel ? (
                  <div className="fm-badge fm-badge--accent fm-text-center fm-font-bold" style={{ padding: '10px', letterSpacing: 1 }}>
                    MAX LEVEL
                  </div>
                ) : (
                  <>
                    <div className="fm-text-md fm-text-secondary">
                      업그레이드 비용: <span className={canAfford ? 'fm-text-success' : 'fm-text-danger'}>{formatCost(fac.upgradeCost)}</span>
                    </div>
                    <button
                      className={`fm-btn ${canAfford ? 'fm-btn--primary' : ''}`}
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
                <div className="fm-text-sm fm-text-muted fm-text-right">마지막 업그레이드: {fac.lastUpgraded}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
