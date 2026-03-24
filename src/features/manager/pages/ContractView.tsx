/**
 * 계약 관리 페이지
 * - 만료 임박 선수 목록 (현재/다음 시즌 만료)
 * - 갱신 모달: 연봉 슬라이더 + 계약 기간(1~3년) 선택
 * - 팀 총 연봉 / 샐러리캡 표시
 */

import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getTeamTotalSalary } from '../../../db/queries';
import {
  calculateRenewalOffer,
  evaluatePlayerDemand,
  attemptRenewal,
  getTeamExpiringContracts,
} from '../../../engine/economy/contractEngine';
import { calculateFairSalary } from '../../../engine/economy/transferEngine';
import type { Player } from '../../../types/player';

const POSITION_LABELS: Record<string, string> = {
  top: 'TOP',
  jungle: 'JGL',
  mid: 'MID',
  adc: 'ADC',
  support: 'SUP',
};

function getOverall(player: Player): number {
  const s = player.stats;
  return Math.round((s.mechanical + s.gameSense + s.teamwork + s.consistency + s.laning + s.aggression) / 6);
}

function formatAmount(amount: number): string {
  if (amount >= 10000) return `${(amount / 10000).toFixed(1)}억`;
  return `${amount.toLocaleString()}만`;
}

export function ContractView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);

  const [expiringPlayers, setExpiringPlayers] = useState<(Player & { division: string })[]>([]);
  const [teamSalary, setTeamSalary] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [renewalModal, setRenewalModal] = useState<Player | null>(null);
  const [offerSalary, setOfferSalary] = useState(0);
  const [offerYears, setOfferYears] = useState(2);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const userTeam = teams.find(t => t.id === save?.userTeamId);
  const salaryCap = (userTeam?.salaryCap ?? 40) * 10000; // 억 → 만 원

  const loadData = useCallback(async () => {
    if (!season || !save) return;
    setIsLoading(true);
    setMessage(null);

    try {
      const [expiring, salary] = await Promise.all([
        getTeamExpiringContracts(save.userTeamId, season.id),
        getTeamTotalSalary(save.userTeamId),
      ]);

      setExpiringPlayers(expiring);
      setTeamSalary(salary);
    } catch (err) {
      console.error('계약 데이터 로딩 실패:', err);
      setMessage({ text: '계약 데이터를 불러오는 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [season, save]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenRenewal = (player: Player) => {
    const offer = calculateRenewalOffer(player);
    setOfferSalary(offer.suggestedSalary);
    setOfferYears(offer.suggestedYears);
    setRenewalModal(player);
    setMessage(null);
  };

  const handleSubmitRenewal = async () => {
    if (!renewalModal || !season || !save) return;

    try {
      // 팀 평균 사기를 간단히 사용 (로스터의 morale 평균)
      const roster = userTeam?.roster ?? [];
      const avgMorale = roster.length > 0
        ? roster.reduce((sum, p) => sum + p.mental.morale, 0) / roster.length
        : 50;

      const result = await attemptRenewal(
        renewalModal,
        save.userTeamId,
        offerSalary,
        offerYears,
        season.id,
        avgMorale,
      );

      if (result.success) {
        setMessage({ text: `${renewalModal.name} 계약 갱신 완료!`, type: 'success' });
        setRenewalModal(null);
        await loadData();
      } else {
        setMessage({ text: result.reason, type: 'error' });
      }
    } catch (err) {
      console.error('계약 갱신 실패:', err);
      setMessage({ text: '계약 갱신 중 오류가 발생했습니다.', type: 'error' });
    }
  };

  if (!season || !save) {
    return <p className="fm-text-muted">데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p className="fm-text-muted">계약 정보를 불러오는 중...</p>;
  }

  const salaryRemaining = salaryCap - teamSalary;

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">계약 관리</h1>
      </div>

      {/* 팀 연봉 요약 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__body--compact">
          <div className="fm-flex fm-gap-lg fm-text-md">
            <span className="fm-text-secondary">
              총 연봉: <strong className="fm-text-primary">{formatAmount(teamSalary)}</strong>
            </span>
            <span className="fm-text-secondary">
              연봉 상한: <strong className="fm-text-muted">{formatAmount(salaryCap)}</strong>
            </span>
            <span className="fm-text-secondary">
              여유: <strong className={salaryRemaining > 0 ? 'fm-text-success' : 'fm-text-danger'}>{formatAmount(salaryRemaining)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 메시지 */}
      {message && (
        <div className={`fm-alert ${message.type === 'success' ? 'fm-alert--success' : 'fm-alert--danger'} fm-mb-md`}>
          <span className="fm-alert__text">{message.text}</span>
        </div>
      )}

      {/* 만료 임박 선수 목록 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">만료 임박 선수 (현재~다음 시즌)</span>
        </div>
        <div className="fm-panel__body--flush">
          {expiringPlayers.length === 0 ? (
            <p className="fm-text-muted fm-text-md fm-p-md">
              만료 임박 선수가 없습니다.
            </p>
          ) : (
            <div className="fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th>포지션</th>
                    <th>이름</th>
                    <th>나이</th>
                    <th>OVR</th>
                    <th>잠재력</th>
                    <th>현재 연봉</th>
                    <th>요구 연봉</th>
                    <th>만료 시즌</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {expiringPlayers
                    .sort((a, b) => getOverall(b) - getOverall(a))
                    .map(player => {
                      const ovr = getOverall(player);
                      const demand = evaluatePlayerDemand(player);
                      const isExpiredThisSeason = player.contract.contractEndSeason <= season.id;
                      return (
                        <tr key={player.id}>
                          <td className="fm-cell--accent">
                            {POSITION_LABELS[player.position] ?? player.position}
                          </td>
                          <td className="fm-cell--name">
                            {player.name}
                          </td>
                          <td>{player.age}</td>
                          <td className={
                            ovr >= 80 ? 'fm-cell--gold' : ovr >= 65 ? 'fm-cell--name' : ''
                          }>
                            {ovr}
                          </td>
                          <td>{player.potential}</td>
                          <td>{formatAmount(player.contract.salary)}/년</td>
                          <td>
                            {formatAmount(demand.minSalary)}~{formatAmount(demand.maxSalary)}/년
                          </td>
                          <td className={isExpiredThisSeason ? 'fm-cell--red' : 'fm-cell--gold'}>
                            시즌 {player.contract.contractEndSeason}
                            {isExpiredThisSeason && ' (만료)'}
                          </td>
                          <td>
                            <button
                              className="fm-btn fm-btn--primary fm-btn--sm"
                              onClick={() => handleOpenRenewal(player)}
                            >
                              갱신
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 갱신 모달 */}
      {renewalModal && (
        <div className="fm-overlay" role="dialog" aria-modal="true" aria-label="계약 갱신" onClick={() => setRenewalModal(null)}>
          <div className="fm-modal" onClick={e => e.stopPropagation()}>
            <div className="fm-modal__header">
              <h2 className="fm-modal__title">계약 갱신</h2>
              <button className="fm-modal__close" onClick={() => setRenewalModal(null)}>&times;</button>
            </div>

            <div className="fm-modal__body">
              <div className="fm-flex fm-items-center fm-gap-sm fm-mb-md" style={{ padding: 12, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <span className="fm-badge fm-badge--accent">
                  {POSITION_LABELS[renewalModal.position]}
                </span>
                <span className="fm-text-lg fm-font-semibold fm-text-primary">{renewalModal.name}</span>
                <span className="fm-text-md fm-text-secondary">{renewalModal.age}세</span>
                <span className="fm-text-md fm-font-bold fm-text-accent" style={{ marginLeft: 'auto' }}>OVR {getOverall(renewalModal)}</span>
              </div>

              {/* 현재 계약 정보 */}
              <div className="fm-card fm-mb-md">
                <div className="fm-info-row">
                  <span className="fm-info-row__label">현재 연봉</span>
                  <span className="fm-info-row__value">{formatAmount(renewalModal.contract.salary)}/년</span>
                </div>
                <div className="fm-info-row">
                  <span className="fm-info-row__label">적정 연봉</span>
                  <span className="fm-info-row__value">{formatAmount(calculateFairSalary(renewalModal))}/년</span>
                </div>
              </div>

              {/* 요구 연봉 범위 */}
              {(() => {
                const demand = evaluatePlayerDemand(renewalModal);
                return (
                  <div className="fm-alert fm-alert--warning fm-mb-md">
                    <span className="fm-alert__text">
                      선수 요구: {formatAmount(demand.minSalary)} ~ {formatAmount(demand.maxSalary)}/년
                      <span className="fm-text-sm fm-text-secondary" style={{ marginLeft: 8 }}>(희망: {formatAmount(demand.idealSalary)})</span>
                    </span>
                  </div>
                );
              })()}

              <div className="fm-mb-md">
                <label className="fm-text-base fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>제안 연봉 (만 원/년)</label>
                <input
                  type="range"
                  min={Math.max(100, Math.round(evaluatePlayerDemand(renewalModal).minSalary * 0.5))}
                  max={Math.round(evaluatePlayerDemand(renewalModal).maxSalary * 1.5)}
                  step={50}
                  value={offerSalary}
                  onChange={e => setOfferSalary(Number(e.target.value))}
                  style={{ width: '100%', marginBottom: 8, accentColor: 'var(--accent)' }}
                />
                <div className="fm-flex fm-items-center fm-gap-sm">
                  <input
                    type="number"
                    className="fm-input"
                    value={offerSalary}
                    onChange={e => setOfferSalary(Number(e.target.value))}
                    min={100}
                    step={50}
                    style={{ width: 120 }}
                  />
                  <span className="fm-text-base fm-text-muted">만 원/년</span>
                </div>
              </div>

              <div className="fm-mb-md">
                <label className="fm-text-base fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>계약 기간 (년)</label>
                <div className="fm-flex fm-gap-sm">
                  {[1, 2, 3].map(y => (
                    <button
                      key={y}
                      className={`fm-btn ${offerYears === y ? 'fm-btn--primary' : ''}`}
                      onClick={() => setOfferYears(y)}
                    >
                      {y}년
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="fm-modal__footer">
              <button className="fm-btn" onClick={() => setRenewalModal(null)}>
                취소
              </button>
              <button className="fm-btn fm-btn--primary" onClick={handleSubmitRenewal}>
                갱신 제안
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
