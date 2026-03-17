/**
 * 이적 시장 페이지
 * - 탭 1: 자유계약 선수 목록 + 영입 제안
 * - 탭 2: 내 제안 내역 (보낸 제안 관리)
 */

import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  getFreeAgents,
  getTeamTotalSalary,
  type TransferOffer,
} from '../../../db/queries';
import {
  calculatePlayerValue,
  calculateFairSalary,
  offerFreeAgent,
  getTeamTransferOffers,
  cancelTransferOffer,
  acceptFreeAgentOffer,
} from '../../../engine/economy/transferEngine';
import type { Player } from '../../../types/player';

type Tab = 'freeAgents' | 'myOffers';

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

export function TransferView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);

  const [tab, setTab] = useState<Tab>('freeAgents');
  const [freeAgents, setFreeAgents] = useState<Player[]>([]);
  const [sentOffers, setSentOffers] = useState<TransferOffer[]>([]);
  const [receivedOffers, setReceivedOffers] = useState<TransferOffer[]>([]);
  const [teamBudget, setTeamBudget] = useState(0);
  const [teamSalary, setTeamSalary] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [offerModal, setOfferModal] = useState<Player | null>(null);
  const [offerSalary, setOfferSalary] = useState(0);
  const [offerYears, setOfferYears] = useState(2);
  const [posFilter, setPosFilter] = useState<string>('all');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const userTeam = teams.find(t => t.id === save?.userTeamId);

  const loadData = useCallback(async () => {
    if (!season || !save) return;
    setIsLoading(true);
    setMessage(null);

    try {
      const [agents, salary, offers] = await Promise.all([
        getFreeAgents(),
        getTeamTotalSalary(save.userTeamId),
        getTeamTransferOffers(season.id, save.userTeamId),
      ]);

      setFreeAgents(agents);
      setTeamSalary(salary);
      setSentOffers(offers.sent);
      setReceivedOffers(offers.received);
      setTeamBudget(userTeam?.budget ?? 0);
    } catch (err) {
      console.error('이적 시장 데이터 로딩 실패:', err);
      setMessage({ text: '이적 시장 데이터를 불러오는 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [season, save, userTeam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenOffer = (player: Player) => {
    setOfferSalary(calculateFairSalary(player));
    setOfferYears(2);
    setOfferModal(player);
    setMessage(null);
  };

  const handleSubmitOffer = async () => {
    if (!offerModal || !season || !save) return;

    try {
      const result = await offerFreeAgent({
        seasonId: season.id,
        fromTeamId: save.userTeamId,
        playerId: offerModal.id,
        offeredSalary: offerSalary,
        contractYears: offerYears,
        offerDate: season.currentDate,
      });

      if (result.success && result.offerId) {
        // 자유계약은 즉시 수락
        const offer: TransferOffer = {
          id: result.offerId,
          seasonId: season.id,
          fromTeamId: save.userTeamId,
          toTeamId: null,
          playerId: offerModal.id,
          transferFee: 0,
          offeredSalary: offerSalary,
          contractYears: offerYears,
          status: 'pending',
          offerDate: season.currentDate,
        };
        await acceptFreeAgentOffer(offer, season.id, season.currentDate);
        setMessage({ text: `${offerModal.name} 영입 완료!`, type: 'success' });
        setOfferModal(null);
        await loadData();
      } else {
        setMessage({ text: result.reason ?? '제안 실패', type: 'error' });
      }
    } catch (err) {
      console.error('영입 제안 실패:', err);
      setMessage({ text: '영입 제안 중 오류가 발생했습니다.', type: 'error' });
    }
  };

  const handleCancelOffer = async (offerId: number) => {
    if (!season) return;

    try {
      await cancelTransferOffer(offerId, season.currentDate);
      await loadData();
      setMessage({ text: '제안이 취소되었습니다.', type: 'success' });
    } catch (err) {
      console.error('제안 취소 실패:', err);
      setMessage({ text: '제안 취소 중 오류가 발생했습니다.', type: 'error' });
    }
  };

  if (!season || !save) {
    return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p style={{ color: '#6a6a7a' }}>이적 시장을 불러오는 중...</p>;
  }

  const filteredAgents = posFilter === 'all'
    ? freeAgents
    : freeAgents.filter(p => p.position === posFilter);

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return '자유계약';
    return teams.find(t => t.id === teamId)?.shortName ?? teamId;
  };

  const getPlayerName = (playerId: string) => {
    for (const team of teams) {
      const p = team.roster?.find(r => r.id === playerId);
      if (p) return p.name;
    }
    const fa = freeAgents.find(p => p.id === playerId);
    return fa?.name ?? playerId;
  };

  return (
    <div>
      <h1 style={styles.title}>이적 시장</h1>

      {/* 팀 재정 요약 */}
      <div style={styles.budgetBar}>
        <span style={styles.budgetItem}>
          예산: <strong style={{ color: '#c89b3c' }}>{formatAmount(teamBudget)}</strong>
        </span>
        <span style={styles.budgetItem}>
          총 연봉: <strong style={{ color: '#e0e0e0' }}>{formatAmount(teamSalary)}</strong>
        </span>
        <span style={styles.budgetItem}>
          연봉 상한: <strong style={{ color: '#6a6a7a' }}>{formatAmount(400000)}</strong>
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

      {/* 탭 */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(tab === 'freeAgents' ? styles.activeTab : {}) }}
          onClick={() => setTab('freeAgents')}
        >
          자유계약 선수
        </button>
        <button
          style={{ ...styles.tab, ...(tab === 'myOffers' ? styles.activeTab : {}) }}
          onClick={() => setTab('myOffers')}
        >
          제안 내역 ({sentOffers.filter(o => o.status === 'pending').length})
        </button>
      </div>

      {/* 탭 1: 자유계약 선수 */}
      {tab === 'freeAgents' && (
        <div>
          {/* 포지션 필터 */}
          <div style={styles.filterRow}>
            {['all', 'top', 'jungle', 'mid', 'adc', 'support'].map(pos => (
              <button
                key={pos}
                style={{ ...styles.filterBtn, ...(posFilter === pos ? styles.filterActive : {}) }}
                onClick={() => setPosFilter(pos)}
              >
                {pos === 'all' ? '전체' : POSITION_LABELS[pos]}
              </button>
            ))}
          </div>

          {filteredAgents.length === 0 ? (
            <p style={{ color: '#6a6a7a', fontSize: '13px', marginTop: '16px' }}>
              자유계약 선수가 없습니다.
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
                  <th style={styles.th}>시장 가치</th>
                  <th style={styles.th}>적정 연봉</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents
                  .sort((a, b) => getOverall(b) - getOverall(a))
                  .map(player => {
                    const ovr = getOverall(player);
                    const value = calculatePlayerValue(player);
                    const fairSalary = calculateFairSalary(player);
                    const hasPending = sentOffers.some(
                      o => o.playerId === player.id && o.status === 'pending',
                    );
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
                        <td style={styles.td}>{formatAmount(value)}</td>
                        <td style={styles.td}>{formatAmount(fairSalary)}/년</td>
                        <td style={styles.td}>
                          <button
                            style={{
                              ...styles.offerBtn,
                              opacity: hasPending ? 0.4 : 1,
                            }}
                            disabled={hasPending}
                            onClick={() => handleOpenOffer(player)}
                          >
                            {hasPending ? '제안중' : '영입'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 탭 2: 내 제안 내역 */}
      {tab === 'myOffers' && (
        <div>
          <h2 style={styles.subTitle}>보낸 제안</h2>
          {sentOffers.length === 0 ? (
            <p style={{ color: '#6a6a7a', fontSize: '13px' }}>보낸 제안이 없습니다.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>선수</th>
                  <th style={styles.th}>대상팀</th>
                  <th style={styles.th}>이적료</th>
                  <th style={styles.th}>제안 연봉</th>
                  <th style={styles.th}>계약 기간</th>
                  <th style={styles.th}>상태</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {sentOffers.map(offer => (
                  <tr key={offer.id} style={styles.tr}>
                    <td style={{ ...styles.td, fontWeight: 500, color: '#e0e0e0' }}>
                      {getPlayerName(offer.playerId)}
                    </td>
                    <td style={styles.td}>{getTeamName(offer.toTeamId)}</td>
                    <td style={styles.td}>{offer.transferFee > 0 ? formatAmount(offer.transferFee) : '-'}</td>
                    <td style={styles.td}>{formatAmount(offer.offeredSalary)}/년</td>
                    <td style={styles.td}>{offer.contractYears}년</td>
                    <td style={{
                      ...styles.td,
                      color: offer.status === 'accepted' ? '#2ecc71'
                        : offer.status === 'rejected' ? '#e74c3c'
                        : offer.status === 'cancelled' ? '#6a6a7a'
                        : '#f39c12',
                      fontWeight: 600,
                    }}>
                      {offer.status === 'pending' ? '대기중'
                        : offer.status === 'accepted' ? '수락'
                        : offer.status === 'rejected' ? '거절'
                        : '취소'}
                    </td>
                    <td style={styles.td}>
                      {offer.status === 'pending' && (
                        <button
                          style={styles.cancelBtn}
                          onClick={() => handleCancelOffer(offer.id)}
                        >
                          취소
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {receivedOffers.length > 0 && (
            <>
              <h2 style={{ ...styles.subTitle, marginTop: '24px' }}>받은 제안</h2>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>선수</th>
                    <th style={styles.th}>제안팀</th>
                    <th style={styles.th}>이적료</th>
                    <th style={styles.th}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {receivedOffers.map(offer => (
                    <tr key={offer.id} style={styles.tr}>
                      <td style={{ ...styles.td, fontWeight: 500, color: '#e0e0e0' }}>
                        {getPlayerName(offer.playerId)}
                      </td>
                      <td style={styles.td}>{getTeamName(offer.fromTeamId)}</td>
                      <td style={styles.td}>{formatAmount(offer.transferFee)}</td>
                      <td style={{
                        ...styles.td,
                        color: offer.status === 'accepted' ? '#2ecc71'
                          : offer.status === 'rejected' ? '#e74c3c'
                          : '#f39c12',
                        fontWeight: 600,
                      }}>
                        {offer.status === 'pending' ? '대기중'
                          : offer.status === 'accepted' ? '수락'
                          : offer.status === 'rejected' ? '거절'
                          : '취소'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* 영입 제안 모달 */}
      {offerModal && (
        <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="영입 제안" onClick={() => setOfferModal(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>영입 제안</h2>

            <div style={styles.modalPlayerInfo}>
              <span style={styles.modalPos}>
                {POSITION_LABELS[offerModal.position]}
              </span>
              <span style={styles.modalName}>{offerModal.name}</span>
              <span style={styles.modalAge}>{offerModal.age}세</span>
              <span style={styles.modalOvr}>OVR {getOverall(offerModal)}</span>
            </div>

            <div style={styles.modalField}>
              <label style={styles.modalLabel}>연봉 (만 원/년)</label>
              <input
                type="number"
                value={offerSalary}
                onChange={e => setOfferSalary(Number(e.target.value))}
                style={styles.modalInput}
                min={100}
                step={100}
              />
              <span style={styles.modalHint}>
                적정 연봉: {formatAmount(calculateFairSalary(offerModal))}
              </span>
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
              <button style={styles.modalCancel} onClick={() => setOfferModal(null)}>
                취소
              </button>
              <button style={styles.modalSubmit} onClick={handleSubmitOffer}>
                제안하기
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
  tabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '16px',
    borderBottom: '1px solid #2a2a4a',
  },
  tab: {
    padding: '10px 20px',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#6a6a7a',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  activeTab: {
    color: '#c89b3c',
    borderBottomColor: '#c89b3c',
  },
  filterRow: {
    display: 'flex',
    gap: '6px',
    marginBottom: '12px',
  },
  filterBtn: {
    padding: '6px 14px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a2a4a',
    borderRadius: '6px',
    color: '#8a8a9a',
    fontSize: '12px',
    cursor: 'pointer',
  },
  filterActive: {
    background: 'rgba(200,155,60,0.15)',
    borderColor: '#c89b3c',
    color: '#c89b3c',
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
  offerBtn: {
    padding: '4px 12px',
    background: '#c89b3c',
    color: '#0d0d1a',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '4px 10px',
    background: 'none',
    border: '1px solid #6a6a7a',
    borderRadius: '4px',
    color: '#6a6a7a',
    fontSize: '12px',
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
    width: '420px',
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
    marginBottom: '20px',
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
  modalField: {
    marginBottom: '16px',
  },
  modalLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#8a8a9a',
    marginBottom: '6px',
  },
  modalInput: {
    width: '100%',
    padding: '8px 12px',
    background: '#0d0d1a',
    border: '1px solid #2a2a4a',
    borderRadius: '6px',
    color: '#e0e0e0',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  modalHint: {
    display: 'block',
    fontSize: '11px',
    color: '#6a6a7a',
    marginTop: '4px',
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
