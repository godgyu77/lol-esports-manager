import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  attemptRenewal,
  calculateRenewalOffer,
  evaluatePlayerDemand,
  getTeamExpiringContracts,
} from '../../../engine/economy/contractEngine';
import { calculateFairSalary } from '../../../engine/economy/transferEngine';
import { getTeamPayrollSnapshot } from '../../../engine/economy/payrollEngine';
import type { Player } from '../../../types/player';
import type { TeamPayrollSnapshot } from '../../../types/systemDepth';
import { POSITION_LABELS_SHORT as POSITION_LABELS } from '../../../utils/constants';
import { formatAmount } from '../../../utils/formatUtils';

function getOverall(player: Player): number {
  const s = player.stats;
  return Math.round((s.mechanical + s.gameSense + s.teamwork + s.consistency + s.laning + s.aggression) / 6);
}

function getPressureTone(snapshot: TeamPayrollSnapshot | null): string {
  if (!snapshot) return 'fm-text-success';
  if (snapshot.pressureBand === 'hard_stop') return 'fm-text-danger';
  if (snapshot.pressureBand === 'warning') return 'fm-text-danger';
  if (snapshot.pressureBand === 'taxed') return 'fm-text-accent';
  return 'fm-text-success';
}

export function ContractView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);

  const [expiringPlayers, setExpiringPlayers] = useState<(Player & { division: string })[]>([]);
  const [payrollSnapshot, setPayrollSnapshot] = useState<TeamPayrollSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [renewalModal, setRenewalModal] = useState<Player | null>(null);
  const [offerSalary, setOfferSalary] = useState(0);
  const [offerYears, setOfferYears] = useState(2);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const userTeam = teams.find((t) => t.id === save?.userTeamId);

  const loadData = useCallback(async () => {
    if (!season || !save) return;
    setIsLoading(true);
    setMessage(null);

    try {
      const [expiring, snapshot] = await Promise.all([
        getTeamExpiringContracts(save.userTeamId, season.id),
        getTeamPayrollSnapshot(save.userTeamId),
      ]);
      setExpiringPlayers(expiring);
      setPayrollSnapshot(snapshot);
    } catch (err) {
      console.error('contract data load failed:', err);
      setMessage({ text: '계약 데이터를 불러오는 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [save, season]);

  useEffect(() => {
    void loadData();
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
        setMessage({ text: `${renewalModal.name} 재계약이 완료되었습니다.`, type: 'success' });
        setRenewalModal(null);
        await loadData();
      } else {
        setMessage({ text: result.reason, type: 'error' });
      }
    } catch (err) {
      console.error('contract renewal failed:', err);
      setMessage({ text: '재계약 처리 중 오류가 발생했습니다.', type: 'error' });
    }
  };

  if (!season || !save) {
    return <p className="fm-text-muted">게임 데이터를 불러오는 중입니다...</p>;
  }

  if (isLoading) {
    return <p className="fm-text-muted">계약 정보를 불러오는 중입니다...</p>;
  }

  const capRoom = payrollSnapshot?.capRoom ?? 0;
  const toneClass = getPressureTone(payrollSnapshot);

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">계약 관리</h1>
      </div>

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__body--compact">
          <div className="fm-grid fm-grid--4 fm-gap-md">
            <span className="fm-text-secondary">
              선수 연봉: <strong className="fm-text-primary">{formatAmount(payrollSnapshot?.playerSalaryTotal ?? 0)}</strong>
            </span>
            <span className="fm-text-secondary">
              스태프 인건비: <strong className="fm-text-primary">{formatAmount(payrollSnapshot?.staffSalaryTotal ?? 0)}</strong>
            </span>
            <span className="fm-text-secondary">
              캡 반영 스태프 payroll: <strong className="fm-text-primary">{formatAmount(payrollSnapshot?.effectiveStaffPayroll ?? 0)}</strong>
            </span>
            <span className="fm-text-secondary">
              총 payroll / cap:{' '}
              <strong className={toneClass}>
                {formatAmount(payrollSnapshot?.totalPayroll ?? 0)} / {formatAmount(payrollSnapshot?.salaryCap ?? 0)}
              </strong>
            </span>
          </div>
          {payrollSnapshot && (
            <p className="fm-text-xs fm-text-muted fm-mt-sm" style={{ marginBottom: 0 }}>
              Soft cap 구조입니다. 선수 연봉은 전액, 스태프는 역할별 가중치로 cap에 반영됩니다. 현재 여유 {formatAmount(capRoom)}, 사치세 {formatAmount(payrollSnapshot.luxuryTax)}, 상태 {payrollSnapshot.pressureBand}
            </p>
          )}
        </div>
      </div>

      {message && (
        <div className={`fm-alert ${message.type === 'success' ? 'fm-alert--success' : 'fm-alert--danger'} fm-mb-md`}>
          <span className="fm-alert__text">{message.text}</span>
        </div>
      )}

      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">만료 임박 선수</span>
        </div>
        <div className="fm-panel__body--flush">
          {expiringPlayers.length === 0 ? (
            <p className="fm-text-muted fm-text-md fm-p-md">만료 임박 선수가 없습니다.</p>
          ) : (
            <div className="fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th>포지션</th>
                    <th>이름</th>
                    <th>나이</th>
                    <th>OVR</th>
                    <th>포텐</th>
                    <th>현재 연봉</th>
                    <th>요구 범위</th>
                    <th>만료 시즌</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {expiringPlayers
                    .sort((a, b) => getOverall(b) - getOverall(a))
                    .map((player) => {
                      const ovr = getOverall(player);
                      const demand = evaluatePlayerDemand(player);
                      const isExpiredThisSeason = player.contract.contractEndSeason <= season.id;
                      return (
                        <tr key={player.id}>
                          <td className="fm-cell--accent">{POSITION_LABELS[player.position] ?? player.position}</td>
                          <td className="fm-cell--name">{player.name}</td>
                          <td>{player.age}</td>
                          <td className={ovr >= 80 ? 'fm-cell--gold' : ovr >= 65 ? 'fm-cell--name' : ''}>{ovr}</td>
                          <td>{player.potential}</td>
                          <td>{formatAmount(player.contract.salary)}/년</td>
                          <td>{formatAmount(demand.minSalary)}~{formatAmount(demand.maxSalary)}/년</td>
                          <td className={isExpiredThisSeason ? 'fm-cell--red' : 'fm-cell--gold'}>
                            시즌 {player.contract.contractEndSeason}
                            {isExpiredThisSeason ? ' (만료)' : ''}
                          </td>
                          <td>
                            <button
                              className="fm-btn fm-btn--primary fm-btn--sm"
                              onClick={() => handleOpenRenewal(player)}
                            >
                              재계약
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

      {renewalModal && (
        <div className="fm-overlay" role="dialog" aria-modal="true" aria-label="재계약" onClick={() => setRenewalModal(null)}>
          <div className="fm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fm-modal__header">
              <h2 className="fm-modal__title">재계약</h2>
              <button className="fm-modal__close" onClick={() => setRenewalModal(null)}>&times;</button>
            </div>

            <div className="fm-modal__body">
              <div className="fm-flex fm-items-center fm-gap-sm fm-mb-md" style={{ padding: 12, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <span className="fm-badge fm-badge--accent">
                  {POSITION_LABELS[renewalModal.position] ?? renewalModal.position}
                </span>
                <span className="fm-text-lg fm-font-semibold fm-text-primary">{renewalModal.name}</span>
                <span className="fm-text-md fm-text-secondary">{renewalModal.age}세</span>
                <span className="fm-text-md fm-font-bold fm-text-accent" style={{ marginLeft: 'auto' }}>
                  OVR {getOverall(renewalModal)}
                </span>
              </div>

              <div className="fm-card fm-mb-md">
                <div className="fm-info-row">
                  <span className="fm-info-row__label">현재 연봉</span>
                  <span className="fm-info-row__value">{formatAmount(renewalModal.contract.salary)}/년</span>
                </div>
                <div className="fm-info-row">
                  <span className="fm-info-row__label">적정 연봉</span>
                  <span className="fm-info-row__value">{formatAmount(calculateFairSalary(renewalModal))}/년</span>
                </div>
                {payrollSnapshot && (
                  <>
                    <div className="fm-info-row">
                      <span className="fm-info-row__label">현재 payroll / cap</span>
                      <span className="fm-info-row__value">
                        {formatAmount(payrollSnapshot.totalPayroll)} / {formatAmount(payrollSnapshot.salaryCap)}
                      </span>
                    </div>
                    <div className="fm-info-row">
                      <span className="fm-info-row__label">캡 여유 / 사치세</span>
                      <span className={`fm-info-row__value ${toneClass}`}>
                        {formatAmount(payrollSnapshot.capRoom)} / {formatAmount(payrollSnapshot.luxuryTax)}
                      </span>
                    </div>
                    <div className="fm-info-row">
                      <span className="fm-info-row__label">스태프 cap 반영치</span>
                      <span className="fm-info-row__value">{formatAmount(payrollSnapshot.effectiveStaffPayroll)}</span>
                    </div>
                  </>
                )}
              </div>

              {(() => {
                const demand = evaluatePlayerDemand(renewalModal);
                return (
                  <div className="fm-alert fm-alert--warning fm-mb-md">
                    <span className="fm-alert__text">
                      선수 요구: {formatAmount(demand.minSalary)} ~ {formatAmount(demand.maxSalary)}/년
                      <span className="fm-text-sm fm-text-secondary" style={{ marginLeft: 8 }}>
                        (이상적 {formatAmount(demand.idealSalary)})
                      </span>
                    </span>
                  </div>
                );
              })()}

              <div className="fm-mb-md">
                <label className="fm-text-base fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>제안 연봉</label>
                <input
                  type="range"
                  min={Math.max(100, Math.round(evaluatePlayerDemand(renewalModal).minSalary * 0.5))}
                  max={Math.round(evaluatePlayerDemand(renewalModal).maxSalary * 1.5)}
                  step={50}
                  value={offerSalary}
                  onChange={(e) => setOfferSalary(Number(e.target.value))}
                  style={{ width: '100%', marginBottom: 8, accentColor: 'var(--accent)' }}
                />
                <div className="fm-flex fm-items-center fm-gap-sm">
                  <input
                    type="number"
                    className="fm-input"
                    value={offerSalary}
                    onChange={(e) => setOfferSalary(Number(e.target.value))}
                    min={100}
                    step={50}
                    style={{ width: 120 }}
                  />
                  <span className="fm-text-base fm-text-muted">만원/년</span>
                </div>
              </div>

              <div className="fm-mb-md">
                <label className="fm-text-base fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>계약 기간</label>
                <div className="fm-flex fm-gap-sm">
                  {[1, 2, 3].map((y) => (
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
                재계약 제안
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
