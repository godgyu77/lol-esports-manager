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
    return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p style={{ color: '#6a6a7a' }}>계약 정보를 불러오는 중...</p>;
  }

  return (
    <div>
      <h1 style={styles.title}>계약 관리</h1>

      {/* 팀 연봉 요약 */}
      <div style={styles.budgetBar}>
        <span style={styles.budgetItem}>
          총 연봉: <strong style={{ color: '#e0e0e0' }}>{formatAmount(teamSalary)}</strong>
        </span>
        <span style={styles.budgetItem}>
          연봉 상한: <strong style={{ color: '#6a6a7a' }}>{formatAmount(salaryCap)}</strong>
        </span>
        <span style={styles.budgetItem}>
          여유: <strong style={{
            color: salaryCap - teamSalary > 0 ? '#2ecc71' : '#e74c3c',
          }}>{formatAmount(salaryCap - teamSalary)}</strong>
        </span>
      </div>

      {/* 메시지 */}
      {message && (
        <div style={{
          ...styles.message,
          borderColor: message.type === 'success' ? '#2ecc71' : '#e74c3c',
          color: message.type === 'success' ? '#2ecc71' : '#e74c3c',
        }}>
          {message.text}
        </div>
      )}

      {/* 만료 임박 선수 목록 */}
      <h2 style={styles.subTitle}>만료 임박 선수 (현재~다음 시즌)</h2>

      {expiringPlayers.length === 0 ? (
        <p style={{ color: '#6a6a7a', fontSize: '13px', marginTop: '16px' }}>
          만료 임박 선수가 없습니다.
        </p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>포지션</th>
              <th style={styles.th}>이름</th>
              <th style={styles.th}>나이</th>
              <th style={styles.th}>OVR</th>
              <th style={styles.th}>잠재력</th>
              <th style={styles.th}>현재 연봉</th>
              <th style={styles.th}>요구 연봉</th>
              <th style={styles.th}>만료 시즌</th>
              <th style={styles.th}></th>
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
                  <tr key={player.id} style={styles.tr}>
                    <td style={{ ...styles.td, color: '#c89b3c', fontWeight: 600 }}>
                      {POSITION_LABELS[player.position] ?? player.position}
                    </td>
                    <td style={{ ...styles.td, fontWeight: 500, color: '#e0e0e0' }}>
                      {player.name}
                    </td>
                    <td style={styles.td}>{player.age}</td>
                    <td style={{
                      ...styles.td,
                      fontWeight: 700,
                      color: ovr >= 80 ? '#c89b3c' : ovr >= 65 ? '#e0e0e0' : '#8a8a9a',
                    }}>
                      {ovr}
                    </td>
                    <td style={styles.td}>{player.potential}</td>
                    <td style={styles.td}>{formatAmount(player.contract.salary)}/년</td>
                    <td style={styles.td}>
                      {formatAmount(demand.minSalary)}~{formatAmount(demand.maxSalary)}/년
                    </td>
                    <td style={{
                      ...styles.td,
                      color: isExpiredThisSeason ? '#e74c3c' : '#f39c12',
                      fontWeight: 600,
                    }}>
                      시즌 {player.contract.contractEndSeason}
                      {isExpiredThisSeason && ' (만료)'}
                    </td>
                    <td style={styles.td}>
                      <button
                        style={styles.renewBtn}
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
      )}

      {/* 갱신 모달 */}
      {renewalModal && (
        <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="계약 갱신" onClick={() => setRenewalModal(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>계약 갱신</h2>

            <div style={styles.modalPlayerInfo}>
              <span style={styles.modalPos}>
                {POSITION_LABELS[renewalModal.position]}
              </span>
              <span style={styles.modalName}>{renewalModal.name}</span>
              <span style={styles.modalAge}>{renewalModal.age}세</span>
              <span style={styles.modalOvr}>OVR {getOverall(renewalModal)}</span>
            </div>

            {/* 현재 계약 정보 */}
            <div style={styles.currentContract}>
              <span style={styles.contractLabel}>현재 연봉</span>
              <span style={styles.contractValue}>
                {formatAmount(renewalModal.contract.salary)}/년
              </span>
              <span style={styles.contractLabel}>적정 연봉</span>
              <span style={styles.contractValue}>
                {formatAmount(calculateFairSalary(renewalModal))}/년
              </span>
            </div>

            {/* 요구 연봉 범위 */}
            {(() => {
              const demand = evaluatePlayerDemand(renewalModal);
              return (
                <div style={styles.demandInfo}>
                  선수 요구: {formatAmount(demand.minSalary)} ~ {formatAmount(demand.maxSalary)}/년
                  <span style={styles.demandIdeal}>(희망: {formatAmount(demand.idealSalary)})</span>
                </div>
              );
            })()}

            <div style={styles.modalField}>
              <label style={styles.modalLabel}>제안 연봉 (만 원/년)</label>
              <input
                type="range"
                min={Math.max(100, Math.round(evaluatePlayerDemand(renewalModal).minSalary * 0.5))}
                max={Math.round(evaluatePlayerDemand(renewalModal).maxSalary * 1.5)}
                step={50}
                value={offerSalary}
                onChange={e => setOfferSalary(Number(e.target.value))}
                style={styles.slider}
              />
              <div style={styles.sliderValue}>
                <input
                  type="number"
                  value={offerSalary}
                  onChange={e => setOfferSalary(Number(e.target.value))}
                  style={styles.modalInput}
                  min={100}
                  step={50}
                />
                <span style={styles.sliderUnit}>만 원/년</span>
              </div>
            </div>

            <div style={styles.modalField}>
              <label style={styles.modalLabel}>계약 기간 (년)</label>
              <div style={styles.yearBtns}>
                {[1, 2, 3].map(y => (
                  <button
                    key={y}
                    style={{
                      ...styles.yearBtn,
                      ...(offerYears === y ? styles.yearBtnActive : {}),
                    }}
                    onClick={() => setOfferYears(y)}
                  >
                    {y}년
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.modalActions}>
              <button style={styles.modalCancel} onClick={() => setRenewalModal(null)}>
                취소
              </button>
              <button style={styles.modalSubmit} onClick={handleSubmitRenewal}>
                갱신 제안
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '16px',
  },
  budgetBar: {
    display: 'flex',
    gap: '24px',
    marginBottom: '16px',
    padding: '12px 16px',
    background: '#12122a',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    fontSize: '13px',
  },
  budgetItem: {
    color: '#8a8a9a',
  },
  message: {
    padding: '10px 16px',
    marginBottom: '12px',
    border: '1px solid',
    borderRadius: '6px',
    fontSize: '13px',
    background: 'rgba(255,255,255,0.02)',
  },
  subTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#c89b3c',
    marginBottom: '12px',
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
  renewBtn: {
    padding: '4px 12px',
    background: '#c89b3c',
    color: '#0d0d1a',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  // 모달
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: '#1a1a2e',
    border: '1px solid #2a2a4a',
    borderRadius: '12px',
    padding: '24px',
    width: '460px',
    maxWidth: '90vw',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '16px',
  },
  modalPlayerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  modalPos: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#c89b3c',
    background: 'rgba(200,155,60,0.15)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  modalName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#e0e0e0',
  },
  modalAge: {
    fontSize: '13px',
    color: '#8a8a9a',
  },
  modalOvr: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#c89b3c',
    marginLeft: 'auto',
  },
  currentContract: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '6px 12px',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
    marginBottom: '12px',
    fontSize: '13px',
  },
  contractLabel: {
    color: '#6a6a7a',
  },
  contractValue: {
    color: '#e0e0e0',
    fontWeight: 500,
  },
  demandInfo: {
    padding: '8px 12px',
    background: 'rgba(243,156,18,0.08)',
    border: '1px solid rgba(243,156,18,0.2)',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#f39c12',
    marginBottom: '16px',
  },
  demandIdeal: {
    marginLeft: '8px',
    color: '#8a8a9a',
    fontSize: '11px',
  },
  modalField: {
    marginBottom: '16px',
  },
  modalLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#8a8a9a',
    marginBottom: '6px',
  },
  slider: {
    width: '100%',
    marginBottom: '8px',
    accentColor: '#c89b3c',
  },
  sliderValue: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  modalInput: {
    width: '120px',
    padding: '6px 10px',
    background: '#0d0d1a',
    border: '1px solid #2a2a4a',
    borderRadius: '6px',
    color: '#e0e0e0',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  sliderUnit: {
    fontSize: '12px',
    color: '#6a6a7a',
  },
  yearBtns: {
    display: 'flex',
    gap: '8px',
  },
  yearBtn: {
    padding: '6px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a2a4a',
    borderRadius: '6px',
    color: '#8a8a9a',
    fontSize: '13px',
    cursor: 'pointer',
  },
  yearBtnActive: {
    background: 'rgba(200,155,60,0.15)',
    borderColor: '#c89b3c',
    color: '#c89b3c',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px',
  },
  modalCancel: {
    padding: '8px 18px',
    background: 'none',
    border: '1px solid #3a3a5c',
    borderRadius: '6px',
    color: '#8a8a9a',
    fontSize: '13px',
    cursor: 'pointer',
  },
  modalSubmit: {
    padding: '8px 18px',
    background: '#c89b3c',
    border: 'none',
    borderRadius: '6px',
    color: '#0d0d1a',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
