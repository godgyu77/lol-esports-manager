/**
 * 선수 모드 계약 페이지
 * - 현재 계약 세부사항 (연봉, 계약 종료 시즌)
 * - 이적 요청 버튼 (충성도가 높으면 비활성화)
 * - FA 시장 탐색 (다른 팀 제안)
 * - 재계약 협상 섹션 (수락/역제안/거절)
 * - 팀에 계약 요청 가능
 */

import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getDatabase } from '../../../db/database';
import { MainLoopPanel } from '../../manager/components/MainLoopPanel';
import type { ClauseType } from '../../../types/contract';
import { CLAUSE_TYPE_LABELS } from '../../../types/contract';
import type { ContractNegotiation } from '../../../types/contract';
import {
  getPlayerNegotiations,
  respondToNegotiation,
  finalizeNegotiation,
  playerRequestContract,
  aiTeamRespondToRequest,
  evaluatePlayerDemand,
} from '../../../engine/economy/contractEngine';
import { getPlayerById } from '../../../db/queries';

interface ContractInfo {
  playerId: string;
  teamId: string | null;
  teamName: string;
  salary: number;
  startSeason: number;
  endSeason: number;
  clauses: ContractClauseRow[];
  loyalty: number;
}

interface ContractClauseRow {
  id: number;
  clauseType: ClauseType;
  clauseValue: number;
  conditionText: string | null;
  isTriggered: boolean;
}

interface FreeAgentOffer {
  id: number;
  teamName: string;
  salary: number;
  duration: number;
  reputation: number;
  fromTeamId: string;
}

function formatSalary(amount: number): string {
  if (amount >= 10000) return `${(amount / 10000).toFixed(1)}억`;
  return `${amount.toLocaleString()}만`;
}

function getLoyaltyBarClass(loyalty: number): string {
  if (loyalty >= 70) return 'fm-bar__fill--green';
  if (loyalty >= 40) return 'fm-bar__fill--yellow';
  return 'fm-bar__fill--red';
}

function getLoyaltyLabel(loyalty: number): string {
  if (loyalty >= 80) return '매우 높음';
  if (loyalty >= 60) return '높음';
  if (loyalty >= 40) return '보통';
  if (loyalty >= 20) return '낮음';
  return '매우 낮음';
}

export function PlayerContractView() {
  const season = useGameStore((s) => s.season);

  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [offers, setOffers] = useState<FreeAgentOffer[]>([]);
  const [negotiations, setNegotiations] = useState<ContractNegotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [transferRequested, setTransferRequested] = useState(false);

  // 계약 요청 모달
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestSalary, setRequestSalary] = useState(0);
  const [requestYears, setRequestYears] = useState(1);
  const [requestResult, setRequestResult] = useState<ContractNegotiation | null>(null);

  // 역제안 모달
  const [counterNeg, setCounterNeg] = useState<ContractNegotiation | null>(null);
  const [counterSalary, setCounterSalary] = useState(0);
  const [counterYears, setCounterYears] = useState(1);

  const loadContractData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const db = await getDatabase();

      const playerRows = await db.select<{
        id: string;
        name: string;
        team_id: string | null;
        salary: number;
        contract_end_season: number;
        morale: number;
      }[]>(
        'SELECT id, name, team_id, salary, contract_end_season, morale FROM players WHERE is_user_player = 1 LIMIT 1',
      );

      if (playerRows.length === 0) {
        setError('유저 선수를 찾을 수 없습니다.');
        return;
      }

      const player = playerRows[0];

      let teamName = '무소속';
      if (player.team_id) {
        const teamRows = await db.select<{ name: string }[]>(
          'SELECT name FROM teams WHERE id = $1',
          [player.team_id],
        );
        if (teamRows.length > 0) teamName = teamRows[0].name;
      }

      const clauseRows = await db.select<{
        id: number;
        clause_type: string;
        clause_value: number;
        condition_text: string | null;
        is_triggered: number;
      }[]>(
        'SELECT id, clause_type, clause_value, condition_text, is_triggered FROM contract_clauses WHERE player_id = $1',
        [player.id],
      );

      const clauses: ContractClauseRow[] = clauseRows.map((r) => ({
        id: r.id,
        clauseType: r.clause_type as ClauseType,
        clauseValue: r.clause_value,
        conditionText: r.condition_text,
        isTriggered: r.is_triggered === 1,
      }));

      const startSeason = Math.max(2024, player.contract_end_season - 2);

      setContract({
        playerId: player.id,
        teamId: player.team_id,
        teamName,
        salary: player.salary,
        startSeason,
        endSeason: player.contract_end_season,
        clauses,
        loyalty: player.morale,
      });

      // 이적 제안 조회
      const offerRows = await db.select<{
        id: number;
        from_team_id: string;
        offered_salary: number;
        contract_years: number;
        status: string;
      }[]>(
        `SELECT id, from_team_id, offered_salary, contract_years, status
         FROM transfer_offers
         WHERE player_id = $1 AND status = 'pending'
         ORDER BY offered_salary DESC`,
        [player.id],
      );

      const offersData: FreeAgentOffer[] = [];
      for (const row of offerRows) {
        const tRows = await db.select<{ name: string; reputation: number }[]>(
          'SELECT name, reputation FROM teams WHERE id = $1',
          [row.from_team_id],
        );
        const tName = tRows.length > 0 ? tRows[0].name : '알 수 없음';
        const tRep = tRows.length > 0 ? tRows[0].reputation : 50;
        offersData.push({
          id: row.id,
          teamName: tName,
          salary: row.offered_salary,
          duration: row.contract_years ?? 1,
          reputation: tRep,
          fromTeamId: row.from_team_id,
        });
      }
      setOffers(offersData);

      // 협상 목록 조회
      if (season) {
        const negs = await getPlayerNegotiations(player.id, season.id);
        setNegotiations(negs);
      }

      // 계약 요청 기본값
      const playerObj = await getPlayerById(player.id);
      if (playerObj) {
        const demand = evaluatePlayerDemand(playerObj);
        setRequestSalary(demand.idealSalary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'DB 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [season]);

  useEffect(() => {
    loadContractData();
  }, [loadContractData]);

  const canRequestTransfer = contract ? contract.loyalty < 60 : false;
  const isExpiring = season && contract ? contract.endSeason <= (season.id + 1) : false;

  // 이적 요청
  const handleTransferRequest = useCallback(async () => {
    if (!contract?.playerId || !contract.teamId) return;
    try {
      const db = await getDatabase();
      // 이적 요청 플래그 설정
      await db.execute(
        'UPDATE players SET transfer_listed = 1 WHERE id = $1',
        [contract.playerId],
      );
      setTransferRequested(true);
      setMessage({ text: '이적 요청이 접수되었습니다.', type: 'success' });
    } catch {
      setTransferRequested(true); // UI만 업데이트
    }
  }, [contract]);

  // FA 제안 수락
  const handleAcceptOffer = useCallback(async (offer: FreeAgentOffer) => {
    if (!season || !contract) return;
    try {
      const { acceptFreeAgentOffer } = await import('../../../engine/economy/transferEngine');
      const transferOffer = {
        id: offer.id,
        seasonId: season.id,
        fromTeamId: offer.fromTeamId,
        toTeamId: null,
        playerId: contract.playerId,
        transferFee: 0,
        offeredSalary: offer.salary,
        contractYears: offer.duration,
        status: 'pending' as const,
        offerDate: season.currentDate,
      };
      await acceptFreeAgentOffer(transferOffer, season.id, season.currentDate);
      setMessage({ text: `${offer.teamName}과 계약 완료!`, type: 'success' });
      await loadContractData();
    } catch {
      setMessage({ text: '계약 수락 중 오류가 발생했습니다.', type: 'error' });
    }
  }, [season, contract, loadContractData]);

  // 재계약 수락
  const handleAcceptNegotiation = useCallback(async (neg: ContractNegotiation) => {
    if (!season) return;
    try {
      const result = await respondToNegotiation(
        neg.id, 'accept',
        { salary: neg.teamSalary, years: neg.teamYears, signingBonus: neg.teamSigningBonus },
        '좋은 조건입니다. 수락하겠습니다.',
      );
      await finalizeNegotiation(result, season.id);
      setMessage({ text: '재계약 수락 완료!', type: 'success' });
      await loadContractData();
    } catch {
      setMessage({ text: '수락 처리 중 오류가 발생했습니다.', type: 'error' });
    }
  }, [season, loadContractData]);

  // 재계약 거절
  const handleRejectNegotiation = useCallback(async (neg: ContractNegotiation) => {
    try {
      await respondToNegotiation(neg.id, 'reject', undefined, '이 조건으로는 계약할 수 없습니다.');
      setMessage({ text: '재계약을 거절했습니다.', type: 'success' });
      await loadContractData();
    } catch {
      setMessage({ text: '거절 처리 중 오류가 발생했습니다.', type: 'error' });
    }
  }, [loadContractData]);

  // 역제안 열기
  const handleOpenCounter = (neg: ContractNegotiation) => {
    setCounterNeg(neg);
    setCounterSalary(Math.round(neg.teamSalary * 1.15));
    setCounterYears(1);
  };

  // 역제안 전송
  const handleSubmitCounter = async () => {
    if (!counterNeg || !season) return;
    try {
      const updated = await respondToNegotiation(
        counterNeg.id, 'counter',
        { salary: counterSalary, years: counterYears },
        `연봉 ${counterSalary.toLocaleString()}만, ${counterYears}년을 원합니다.`,
      );

      // AI 팀 응답
      const player = await getPlayerById(counterNeg.playerId);
      if (player && updated.status === 'in_progress') {
        const result = await aiTeamRespondToRequest(updated, player);
        if (result.status === 'accepted') {
          await finalizeNegotiation(result, season.id);
          setMessage({ text: '역제안이 수락되었습니다!', type: 'success' });
        } else if (result.status === 'rejected') {
          setMessage({ text: '팀이 역제안을 거절했습니다.', type: 'error' });
        } else {
          setMessage({ text: '팀이 새로운 조건을 제시했습니다.', type: 'success' });
        }
      }

      setCounterNeg(null);
      await loadContractData();
    } catch {
      setMessage({ text: '역제안 중 오류가 발생했습니다.', type: 'error' });
    }
  };

  // 팀에 계약 요청
  const handleRequestContract = async () => {
    if (!contract?.teamId || !season || !contract.playerId) return;
    try {
      const neg = await playerRequestContract({
        seasonId: season.id,
        playerId: contract.playerId,
        teamId: contract.teamId,
        requestedSalary: requestSalary,
        requestedYears: requestYears,
      });

      // AI 팀 응답
      const player = await getPlayerById(contract.playerId);
      if (player) {
        const result = await aiTeamRespondToRequest(neg, player);
        setRequestResult(result);

        if (result.status === 'accepted') {
          await finalizeNegotiation(result, season.id);
          setMessage({ text: '계약 요청이 수락되었습니다!', type: 'success' });
        } else if (result.status === 'rejected') {
          setMessage({ text: '팀이 요청을 거절했습니다.', type: 'error' });
        } else {
          setMessage({ text: '팀이 역제안을 보냈습니다.', type: 'success' });
        }

        await loadContractData();
      }
    } catch {
      setMessage({ text: '계약 요청 중 오류가 발생했습니다.', type: 'error' });
    }
  };

  if (loading) {
    return <div className="fm-text-secondary fm-text-md">계약 정보를 불러오는 중...</div>;
  }

  if (error) {
    return (
      <div className="fm-alert fm-alert--danger">
        <span className="fm-alert__icon">!</span>
        <span className="fm-alert__text">{error}</span>
      </div>
    );
  }

  if (!contract) {
    return <p className="fm-text-muted fm-text-md">계약 정보가 없습니다.</p>;
  }

  const pendingFromTeam = negotiations.filter(
    n => n.initiator === 'team_to_player' && n.status === 'in_progress',
  );

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">계약 관리</h1>
      </div>

      {/* 메시지 */}
      {message && (
        <div className={`fm-alert ${message.type === 'success' ? 'fm-alert--success' : 'fm-alert--danger'}`}>
          <span className="fm-alert__text">{message.text}</span>
        </div>
      )}

      <MainLoopPanel
        eyebrow="선수 루프"
        title="계약 안정성과 다음 협상 선택을 먼저 읽는 계약 허브"
        subtitle="계약 상세 조항을 전부 읽기 전에, 지금 내 계약이 안정적인지와 어떤 협상 액션이 열려 있는지 먼저 파악할 수 있게 정리했습니다."
        insights={[
          {
            label: '현재 계약',
            value: `${contract.teamName} / ${formatSalary(contract.salary)}`,
            detail: `시즌 ${contract.startSeason} ~ ${contract.endSeason}`,
            tone: isExpiring ? 'warning' : 'accent',
          },
          {
            label: '계약 안정성',
            value: isExpiring ? '만료 임박' : '유지 중',
            detail: `충성도 ${contract.loyalty}% (${getLoyaltyLabel(contract.loyalty)})`,
            tone: isExpiring ? 'danger' : contract.loyalty >= 60 ? 'success' : 'warning',
          },
          {
            label: '진행 중 협상',
            value: `${pendingFromTeam.length}건`,
            detail: pendingFromTeam.length > 0 ? '팀이 보낸 제안을 우선 확인할 수 있습니다.' : '진행 중인 팀 제안은 없습니다.',
            tone: pendingFromTeam.length > 0 ? 'accent' : 'neutral',
          },
          {
            label: '받은 제안',
            value: `${offers.length}건`,
            detail: offers.length > 0 ? `${offers[0].teamName} 제안이 가장 높습니다.` : '현재 외부 팀 제안은 없습니다.',
            tone: offers.length > 0 ? 'success' : 'neutral',
          },
        ]}
        actions={[
          { label: '계약 요청', onClick: () => setShowRequestModal(true), variant: 'primary', disabled: !contract.teamId },
          { label: '이적 요청', onClick: () => void handleTransferRequest(), disabled: transferRequested || !canRequestTransfer },
        ]}
        note="상단은 계약 판단용 요약, 아래는 조항과 협상 기록을 읽는 상세 영역입니다."
      />

      {/* 현재 계약 정보 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">현재 계약</span>
          {isExpiring && (
            <span className="fm-badge fm-badge--warning">계약 만료 임박</span>
          )}
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--2">
            <div className="fm-flex-col fm-gap-xs">
              <div className="fm-info-row">
                <span className="fm-info-row__label">소속팀</span>
                <span className="fm-info-row__value">{contract.teamName}</span>
              </div>
              <div className="fm-info-row">
                <span className="fm-info-row__label">연봉</span>
                <span className="fm-info-row__value fm-text-success">{formatSalary(contract.salary)}/년</span>
              </div>
              <div className="fm-info-row">
                <span className="fm-info-row__label">계약 기간</span>
                <span className="fm-info-row__value">시즌 {contract.startSeason} ~ {contract.endSeason}</span>
              </div>
            </div>
            <div className="fm-flex-col fm-gap-xs">
              <div>
                <span className="fm-text-sm fm-text-muted">계약 조항</span>
                {contract.clauses.length > 0 ? (
                  <div className="fm-flex-col fm-gap-xs fm-mt-sm">
                    {contract.clauses.map((c) => (
                      <div key={c.id} className="fm-flex fm-items-center fm-gap-sm">
                        <span className={c.isTriggered ? 'fm-text-success fm-text-sm' : 'fm-text-md fm-text-primary'}>
                          {CLAUSE_TYPE_LABELS[c.clauseType] ?? c.clauseType}
                        </span>
                        <span className="fm-text-sm fm-text-muted">{formatSalary(c.clauseValue)}</span>
                        {c.isTriggered && <span className="fm-badge fm-badge--success">달성</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="fm-text-muted fm-text-sm fm-mt-sm">조항 없음</p>
                )}
              </div>
              <div className="fm-mt-sm">
                <span className="fm-text-sm fm-text-muted">충성도</span>
                <div className="fm-bar fm-mt-sm">
                  <div className="fm-bar__track" style={{ height: '8px' }}>
                    <div
                      className={`fm-bar__fill ${getLoyaltyBarClass(contract.loyalty)}`}
                      style={{ width: `${contract.loyalty}%` }}
                    />
                  </div>
                  <span className="fm-bar__value">
                    {contract.loyalty}% ({getLoyaltyLabel(contract.loyalty)})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 팀에 계약 요청 */}
      {contract.teamId && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">계약 요청</span>
            <div className="fm-panel__actions">
              <button
                className="fm-btn fm-btn--primary"
                onClick={() => setShowRequestModal(true)}
              >
                계약 요청하기
              </button>
            </div>
          </div>
          <div className="fm-panel__body">
            <p className="fm-text-md fm-text-secondary">팀에 재계약이나 연봉 인상을 요청할 수 있습니다.</p>
          </div>
        </div>
      )}

      {/* 팀이 보낸 재계약 제안 */}
      {pendingFromTeam.length > 0 && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">재계약 제안</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex-col fm-gap-md">
              {pendingFromTeam.map(neg => {
                const lastMsg = neg.messages[neg.messages.length - 1];
                return (
                  <div key={neg.id} className="fm-card">
                    <div className="fm-grid fm-grid--3 fm-mb-sm">
                      <div className="fm-stat">
                        <span className="fm-stat__label">제안 연봉</span>
                        <span className="fm-stat__value--sm fm-text-success">{formatSalary(neg.teamSalary)}/년</span>
                      </div>
                      <div className="fm-stat">
                        <span className="fm-stat__label">기간</span>
                        <span className="fm-stat__value--sm">{neg.teamYears}년</span>
                      </div>
                      <div className="fm-stat">
                        <span className="fm-stat__label">계약 보너스</span>
                        <span className="fm-stat__value--sm">{neg.teamSigningBonus > 0 ? formatSalary(neg.teamSigningBonus) : '-'}</span>
                      </div>
                    </div>
                    {lastMsg && (
                      <p className="fm-text-md fm-text-secondary fm-mb-sm">
                        <strong>팀:</strong> {lastMsg.text}
                      </p>
                    )}
                    <div className="fm-text-xs fm-text-muted fm-mb-sm">라운드 {neg.currentRound}/3</div>
                    <div className="fm-flex fm-gap-sm">
                      <button className="fm-btn fm-btn--success" onClick={() => handleAcceptNegotiation(neg)}>수락</button>
                      <button className="fm-btn fm-btn--primary" onClick={() => handleOpenCounter(neg)}>역제안</button>
                      <button className="fm-btn fm-btn--danger" onClick={() => handleRejectNegotiation(neg)}>거절</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 이적 요청 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">이적 요청</span>
        </div>
        <div className="fm-panel__body">
          {transferRequested ? (
            <div className="fm-alert fm-alert--info">
              <span className="fm-alert__text">이적 요청이 접수되었습니다. 구단의 응답을 기다리는 중...</span>
            </div>
          ) : (
            <div className="fm-flex fm-items-center fm-gap-md">
              <button
                className="fm-btn fm-btn--danger"
                onClick={handleTransferRequest}
                disabled={!canRequestTransfer}
                aria-label="이적 요청"
              >
                이적 요청
              </button>
              {!canRequestTransfer && (
                <span className="fm-text-md fm-text-muted">충성도가 높아 이적 요청이 불가능합니다 (60 미만 필요)</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FA 시장 (제안 목록) */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">받은 제안</span>
        </div>
        <div className="fm-panel__body--flush">
          {offers.length === 0 ? (
            <div className="fm-panel__body">
              <p className="fm-text-muted fm-text-md">현재 받은 제안이 없습니다.</p>
            </div>
          ) : (
            <table className="fm-table fm-table--striped">
              <thead>
                <tr>
                  <th>팀</th>
                  <th>명성</th>
                  <th className="text-center">연봉</th>
                  <th className="text-center">기간</th>
                  <th className="text-right">액션</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => (
                  <tr key={offer.id}>
                    <td className="fm-cell--name">{offer.teamName}</td>
                    <td className="fm-text-muted">{offer.reputation}</td>
                    <td className="text-center fm-cell--green">{formatSalary(offer.salary)}/년</td>
                    <td className="text-center">{offer.duration}년</td>
                    <td className="text-right">
                      <button
                        className="fm-btn fm-btn--primary fm-btn--sm"
                        onClick={() => handleAcceptOffer(offer)}
                      >
                        수락
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 협상 이력 */}
      {negotiations.length > 0 && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">협상 이력</span>
          </div>
          <div className="fm-panel__body--flush">
            <table className="fm-table fm-table--striped">
              <thead>
                <tr>
                  <th>유형</th>
                  <th>상태</th>
                  <th className="text-right">최종 조건</th>
                </tr>
              </thead>
              <tbody>
                {negotiations.filter(n => n.status !== 'in_progress').map(neg => (
                  <tr key={neg.id}>
                    <td className="fm-cell--name">
                      {neg.initiator === 'team_to_player' ? '팀 → 선수' : '선수 → 팀'}
                    </td>
                    <td>
                      <span className={`fm-badge ${
                        neg.status === 'accepted' ? 'fm-badge--success' : neg.status === 'rejected' ? 'fm-badge--danger' : 'fm-badge--default'
                      }`}>
                        {neg.status === 'accepted' ? '합의' : neg.status === 'rejected' ? '결렬' : neg.status}
                      </span>
                    </td>
                    <td className="text-right">
                      {neg.finalSalary ? `${formatSalary(neg.finalSalary)}/년, ${neg.finalYears}년` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 역제안 모달 */}
      {counterNeg && (
        <div className="fm-overlay" onClick={() => setCounterNeg(null)}>
          <div className="fm-modal" onClick={e => e.stopPropagation()}>
            <div className="fm-modal__header">
              <span className="fm-modal__title">역제안</span>
              <button className="fm-modal__close" onClick={() => setCounterNeg(null)}>&times;</button>
            </div>
            <div className="fm-modal__body">
              <p className="fm-text-md fm-text-secondary fm-mb-md">
                팀 제안: {formatSalary(counterNeg.teamSalary)}/년, {counterNeg.teamYears}년
              </p>

              <div className="fm-mb-md">
                <label className="fm-text-sm fm-text-muted fm-mb-sm" style={{ display: 'block' }}>희망 연봉 (만 원/년)</label>
                <input
                  type="number"
                  value={counterSalary}
                  onChange={(e) => setCounterSalary(Number(e.target.value))}
                  className="fm-input"
                  style={{ width: '100%' }}
                  min={100}
                  step={100}
                />
              </div>

              <div className="fm-mb-md">
                <label className="fm-text-sm fm-text-muted fm-mb-sm" style={{ display: 'block' }}>희망 기간</label>
                <div className="fm-flex fm-gap-sm">
                  {[1, 2, 3].map(y => (
                    <button
                      key={y}
                      className={`fm-btn ${counterYears === y ? 'fm-btn--primary' : ''}`}
                      onClick={() => setCounterYears(y)}
                    >
                      {y}년
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="fm-modal__footer">
              <button className="fm-btn" onClick={() => setCounterNeg(null)}>취소</button>
              <button className="fm-btn fm-btn--primary" onClick={handleSubmitCounter}>역제안 전송</button>
            </div>
          </div>
        </div>
      )}

      {/* 계약 요청 모달 */}
      {showRequestModal && (
        <div className="fm-overlay" onClick={() => { setShowRequestModal(false); setRequestResult(null); }}>
          <div className="fm-modal" onClick={e => e.stopPropagation()}>
            <div className="fm-modal__header">
              <span className="fm-modal__title">팀에 계약 요청</span>
              <button className="fm-modal__close" onClick={() => { setShowRequestModal(false); setRequestResult(null); }}>&times;</button>
            </div>
            <div className="fm-modal__body">
              {requestResult ? (
                <div>
                  {requestResult.messages.map((msg, i) => (
                    <p key={i} className={`fm-text-md fm-mb-sm ${msg.from === 'team' ? 'fm-text-info' : 'fm-text-warning'}`}>
                      <strong>{msg.from === 'team' ? '팀:' : '나:'}</strong> {msg.text}
                    </p>
                  ))}
                  <div className={`fm-alert ${requestResult.status === 'accepted' ? 'fm-alert--success' : 'fm-alert--danger'} fm-mt-md`}>
                    <span className="fm-alert__text">
                      {requestResult.status === 'accepted' ? '계약 체결 완료!' : '요청이 거절되었습니다.'}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="fm-mb-md">
                    <label className="fm-text-sm fm-text-muted fm-mb-sm" style={{ display: 'block' }}>희망 연봉 (만 원/년)</label>
                    <input
                      type="number"
                      value={requestSalary}
                      onChange={(e) => setRequestSalary(Number(e.target.value))}
                      className="fm-input"
                      style={{ width: '100%' }}
                      min={100}
                      step={100}
                    />
                  </div>

                  <div className="fm-mb-md">
                    <label className="fm-text-sm fm-text-muted fm-mb-sm" style={{ display: 'block' }}>희망 기간</label>
                    <div className="fm-flex fm-gap-sm">
                      {[1, 2, 3].map(y => (
                        <button
                          key={y}
                          className={`fm-btn ${requestYears === y ? 'fm-btn--primary' : ''}`}
                          onClick={() => setRequestYears(y)}
                        >
                          {y}년
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="fm-modal__footer">
              {requestResult ? (
                <button
                  className="fm-btn"
                  onClick={() => { setShowRequestModal(false); setRequestResult(null); }}
                >
                  닫기
                </button>
              ) : (
                <>
                  <button className="fm-btn" onClick={() => setShowRequestModal(false)}>취소</button>
                  <button className="fm-btn fm-btn--primary" onClick={handleRequestContract}>요청 전송</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
