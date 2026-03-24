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
  getPlayersByTeamId,
  getTeamRecentWinRate,
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
import {
  calculateRenewalOffer,
  evaluatePlayerDemand,
  generateDecisionFactors,
  createNegotiation,
  aiPlayerRespondToOffer,
  finalizeNegotiation,
  getTeamNegotiations,
} from '../../../engine/economy/contractEngine';
import { generateAgentNegotiation, type AgentNegotiationDialogue } from '../../../ai/advancedAiService';
import type { Player } from '../../../types/player';
import type { ContractNegotiation } from '../../../types/contract';
import { Skeleton, SkeletonTable } from '../../../components/Skeleton';

type Tab = 'freeAgents' | 'myOffers' | 'renewal';

const POSITION_LABELS: Record<string, string> = {
  top: 'TOP',
  jungle: 'JGL',
  mid: 'MID',
  adc: 'ADC',
  support: 'SUP',
};

const POS_CLASS: Record<string, string> = {
  top: 'fm-pos-badge--top',
  jungle: 'fm-pos-badge--jgl',
  mid: 'fm-pos-badge--mid',
  adc: 'fm-pos-badge--adc',
  support: 'fm-pos-badge--sup',
};

function getOverall(player: Player): number {
  const s = player.stats;
  return Math.round((s.mechanical + s.gameSense + s.teamwork + s.consistency + s.laning + s.aggression) / 6);
}

function formatAmount(amount: number): string {
  if (amount >= 10000) return `${(amount / 10000).toFixed(1)}억`;
  return `${amount.toLocaleString()}만`;
}

function getOvrClass(ovr: number): string {
  if (ovr >= 85) return 'fm-ovr fm-ovr--elite';
  if (ovr >= 75) return 'fm-ovr fm-ovr--high';
  if (ovr >= 65) return 'fm-ovr fm-ovr--mid';
  return 'fm-ovr fm-ovr--low';
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

  // 에이전트 협상 상태
  const [negotiationPlayer, setNegotiationPlayer] = useState<Player | null>(null);
  const [negotiationRound, setNegotiationRound] = useState(1);
  const [negotiationDialogue, setNegotiationDialogue] = useState<AgentNegotiationDialogue | null>(null);
  const [negotiationLoading, setNegotiationLoading] = useState(false);
  const [negotiationSalary, setNegotiationSalary] = useState(0);
  const [negotiationYears, setNegotiationYears] = useState(2);

  // 재계약 협상 상태
  const [rosterPlayers, setRosterPlayers] = useState<Player[]>([]);
  const [renewalTarget, setRenewalTarget] = useState<Player | null>(null);
  const [renewalSalary, setRenewalSalary] = useState(0);
  const [renewalYears, setRenewalYears] = useState(1);
  const [renewalBonus, setRenewalBonus] = useState(0);
  const [activeNegotiations, setActiveNegotiations] = useState<ContractNegotiation[]>([]);
  const [renewalResult, setRenewalResult] = useState<ContractNegotiation | null>(null);
  const [teamWinRate, setTeamWinRate] = useState(0.5);

  const userTeam = teams.find(t => t.id === save?.userTeamId);

  const loadData = useCallback(async () => {
    if (!season || !save) return;
    setIsLoading(true);
    setMessage(null);

    try {
      const [agents, salary, offers, roster, negotiations, winRate] = await Promise.all([
        getFreeAgents(),
        getTeamTotalSalary(save.userTeamId),
        getTeamTransferOffers(season.id, save.userTeamId),
        getPlayersByTeamId(save.userTeamId),
        getTeamNegotiations(save.userTeamId, season.id),
        getTeamRecentWinRate(save.userTeamId, season.id),
      ]);

      setFreeAgents(agents);
      setTeamSalary(salary);
      setSentOffers(offers.sent);
      setReceivedOffers(offers.received);
      setTeamBudget(userTeam?.budget ?? 0);
      setRosterPlayers(roster);
      setActiveNegotiations(negotiations);
      setTeamWinRate(winRate);
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

  /** 에이전트 협상 시작 */
  const handleStartNegotiation = (player: Player) => {
    const fair = calculateFairSalary(player);
    setNegotiationPlayer(player);
    setNegotiationRound(1);
    setNegotiationDialogue(null);
    setNegotiationSalary(fair);
    setNegotiationYears(2);
    setMessage(null);
    // 첫 라운드 대화 생성
    runNegotiationRound(player, fair, 2, 1);
  };

  /** 협상 라운드 실행 */
  const runNegotiationRound = async (
    player: Player,
    salary: number,
    years: number,
    round: number,
  ) => {
    setNegotiationLoading(true);
    try {
      const marketValue = calculateFairSalary(player);
      const personalities: Array<'aggressive' | 'reasonable' | 'pushover'> = ['aggressive', 'reasonable', 'pushover'];
      // OVR 높을수록 aggressive 확률 높음
      const ovr = getOverall(player);
      const personality = ovr >= 80 ? personalities[0] : ovr >= 60 ? personalities[1] : personalities[2];

      const result = await generateAgentNegotiation({
        playerName: player.name,
        playerAge: player.age,
        playerOvr: ovr,
        currentSalary: player.contract?.salary ?? 0,
        offeredSalary: salary,
        offeredYears: years,
        marketValue,
        agentPersonality: personality,
        negotiationRound: round,
      });

      setNegotiationDialogue(result);

      // 역제안이 있으면 제안 금액에 반영
      if (result.counterOffer?.salary) {
        setNegotiationSalary(result.counterOffer.salary);
      }
      if (result.counterOffer?.years) {
        setNegotiationYears(result.counterOffer.years);
      }
    } catch {
      setNegotiationDialogue({
        agentMessage: '통신 오류로 에이전트와 연결할 수 없습니다.',
        tone: 'firm',
        willingness: 50,
      });
    } finally {
      setNegotiationLoading(false);
    }
  };

  /** 다음 협상 라운드 */
  const handleNextNegotiationRound = () => {
    if (!negotiationPlayer || negotiationRound >= 3) return;
    const nextRound = negotiationRound + 1;
    setNegotiationRound(nextRound);
    runNegotiationRound(negotiationPlayer, negotiationSalary, negotiationYears, nextRound);
  };

  /** 협상 수락 -> 영입 진행 */
  const handleAcceptNegotiation = () => {
    if (!negotiationPlayer) return;
    // 협상 결과로 영입 모달 열기
    setOfferSalary(negotiationSalary);
    setOfferYears(negotiationYears);
    setOfferModal(negotiationPlayer);
    // 협상 모달 닫기
    setNegotiationPlayer(null);
    setNegotiationDialogue(null);
    setNegotiationRound(1);
  };

  /** 협상 종료 */
  const handleCloseNegotiation = () => {
    setNegotiationPlayer(null);
    setNegotiationDialogue(null);
    setNegotiationRound(1);
  };

  /** 재계약 모달 열기 */
  const handleOpenRenewal = (player: Player) => {
    const offer = calculateRenewalOffer(player);
    setRenewalTarget(player);
    setRenewalSalary(offer.suggestedSalary);
    setRenewalYears(offer.suggestedYears);
    setRenewalBonus(0);
    setRenewalResult(null);
    setMessage(null);
  };

  /** 재계약 제안 전송 */
  const handleSubmitRenewal = async () => {
    if (!renewalTarget || !season || !save || !userTeam) return;

    try {
      const factors = generateDecisionFactors(renewalTarget);

      // 1. 협상 생성
      const neg = await createNegotiation({
        seasonId: season.id,
        playerId: renewalTarget.id,
        teamId: save.userTeamId,
        initiator: 'team_to_player',
        teamSalary: renewalSalary,
        teamYears: renewalYears,
        teamSigningBonus: renewalBonus,
        factors,
      });

      // 2. AI 선수 응답
      const teamAvgOvr = rosterPlayers.length > 0
        ? rosterPlayers.reduce((sum, p) => sum + getOverall(p), 0) / rosterPlayers.length
        : 60;
      const positionCompetitors = rosterPlayers.filter(
        p => p.position === renewalTarget.position && p.id !== renewalTarget.id,
      );
      const posCompOvr = positionCompetitors.length > 0
        ? Math.max(...positionCompetitors.map(p => getOverall(p)))
        : 0;

      const result = await aiPlayerRespondToOffer(neg, renewalTarget, {
        reputation: userTeam.reputation ?? 50,
        recentWinRate: teamWinRate,
        rosterStrength: teamAvgOvr,
        positionCompetitorOvr: posCompOvr,
      });

      setRenewalResult(result);

      // 수락이면 계약 체결
      if (result.status === 'accepted') {
        const finalResult = await finalizeNegotiation(result, season.id);
        setMessage({ text: finalResult.reason, type: finalResult.success ? 'success' : 'error' });
        if (finalResult.success) {
          await loadData();
        }
      }
    } catch (err) {
      console.error('재계약 제안 실패:', err);
      setMessage({ text: '재계약 제안 중 오류가 발생했습니다.', type: 'error' });
    }
  };

  /** 재계약 역제안에 재제안 */
  const handleRenewalCounterResponse = async () => {
    if (!renewalResult || !renewalTarget || !season || !save || !userTeam) return;

    try {
      // 기존 협상에 팀의 새 제안 추가
      const { respondToNegotiation: respond } = await import('../../../engine/economy/contractEngine');
      const updated = await respond(
        renewalResult.id,
        'counter',
        { salary: renewalSalary, years: renewalYears, signingBonus: renewalBonus },
        `연봉 ${renewalSalary.toLocaleString()}만, ${renewalYears}년으로 재제안합니다.`,
      );

      // AI 선수 재응답
      const teamAvgOvr = rosterPlayers.length > 0
        ? rosterPlayers.reduce((sum, p) => sum + getOverall(p), 0) / rosterPlayers.length
        : 60;
      const posCompOvr = rosterPlayers
        .filter(p => p.position === renewalTarget.position && p.id !== renewalTarget.id)
        .reduce((max, p) => Math.max(max, getOverall(p)), 0);

      const result = await aiPlayerRespondToOffer(updated, renewalTarget, {
        reputation: userTeam.reputation ?? 50,
        recentWinRate: teamWinRate,
        rosterStrength: teamAvgOvr,
        positionCompetitorOvr: posCompOvr,
      });

      setRenewalResult(result);

      if (result.status === 'accepted') {
        const finalResult = await finalizeNegotiation(result, season.id);
        setMessage({ text: finalResult.reason, type: finalResult.success ? 'success' : 'error' });
        if (finalResult.success) {
          await loadData();
        }
      }
    } catch (err) {
      console.error('재계약 재제안 실패:', err);
      setMessage({ text: '재제안 중 오류가 발생했습니다.', type: 'error' });
    }
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
    return <p className="fm-text-muted">데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return (
      <div>
        <Skeleton width="180px" height="28px" variant="text" />
        <div className="fm-mt-md fm-mb-md">
          <Skeleton width="100%" height="48px" variant="rect" />
        </div>
        <SkeletonTable rows={8} cols={7} />
      </div>
    );
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
      <div className="fm-page-header">
        <h1 className="fm-page-title">이적 시장</h1>
      </div>

      {/* 팀 재정 요약 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__body--compact fm-flex fm-gap-lg fm-text-md">
          <span className="fm-text-secondary">
            예산: <strong className="fm-text-accent">{formatAmount(teamBudget)}</strong>
          </span>
          <span className="fm-text-secondary">
            총 연봉: <strong className="fm-text-primary">{formatAmount(teamSalary)}</strong>
          </span>
          <span className="fm-text-secondary">
            연봉 상한: <strong className="fm-text-muted">{formatAmount(400000)}</strong>
          </span>
        </div>
      </div>

      {/* 메시지 */}
      {message && (
        <div className={`fm-alert ${message.type === 'success' ? 'fm-alert--success' : 'fm-alert--danger'} fm-mb-md`}>
          <span className="fm-alert__text">{message.text}</span>
        </div>
      )}

      {/* 탭 */}
      <div className="fm-tabs">
        <button
          className={`fm-tab ${tab === 'freeAgents' ? 'fm-tab--active' : ''}`}
          onClick={() => setTab('freeAgents')}
        >
          자유계약 선수
        </button>
        <button
          className={`fm-tab ${tab === 'myOffers' ? 'fm-tab--active' : ''}`}
          onClick={() => setTab('myOffers')}
        >
          제안 내역 ({sentOffers.filter(o => o.status === 'pending').length})
        </button>
        <button
          className={`fm-tab ${tab === 'renewal' ? 'fm-tab--active' : ''}`}
          onClick={() => setTab('renewal')}
        >
          재계약
        </button>
      </div>

      {/* 탭 1: 자유계약 선수 */}
      {tab === 'freeAgents' && (
        <div>
          {/* 포지션 필터 */}
          <div className="fm-flex fm-gap-xs fm-mb-md">
            {['all', 'top', 'jungle', 'mid', 'adc', 'support'].map(pos => (
              <button
                key={pos}
                className={`fm-btn fm-btn--sm ${posFilter === pos ? 'fm-btn--primary' : ''}`}
                onClick={() => setPosFilter(pos)}
              >
                {pos === 'all' ? '전체' : POSITION_LABELS[pos]}
              </button>
            ))}
          </div>

          {filteredAgents.length === 0 ? (
            <p className="fm-text-muted fm-text-md fm-mt-md">
              자유계약 선수가 없습니다.
            </p>
          ) : (
            <div className="fm-panel">
              <div className="fm-panel__body--flush fm-table-wrap">
                <table className="fm-table fm-table--striped">
                  <thead>
                    <tr>
                      <th>포지션</th>
                      <th>이름</th>
                      <th>나이</th>
                      <th>OVR</th>
                      <th>잠재력</th>
                      <th>시장 가치</th>
                      <th>적정 연봉</th>
                      <th></th>
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
                          <tr key={player.id}>
                            <td>
                              <span className={`fm-pos-badge ${POS_CLASS[player.position] ?? ''}`}>
                                {POSITION_LABELS[player.position] ?? player.position}
                              </span>
                            </td>
                            <td className="fm-cell--name">{player.name}</td>
                            <td>{player.age}</td>
                            <td><span className={getOvrClass(ovr)}>{ovr}</span></td>
                            <td>{player.potential}</td>
                            <td>{formatAmount(value)}</td>
                            <td>{formatAmount(fairSalary)}/년</td>
                            <td>
                              <div className="fm-flex fm-gap-xs">
                                <button
                                  className="fm-btn fm-btn--primary fm-btn--sm"
                                  disabled={hasPending}
                                  onClick={() => handleOpenOffer(player)}
                                >
                                  {hasPending ? '제안중' : '영입'}
                                </button>
                                {!hasPending && (
                                  <button
                                    className="fm-btn fm-btn--sm"
                                    onClick={() => handleStartNegotiation(player)}
                                  >
                                    협상
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 탭 2: 내 제안 내역 */}
      {tab === 'myOffers' && (
        <div>
          <h2 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-md">보낸 제안</h2>
          {sentOffers.length === 0 ? (
            <p className="fm-text-muted fm-text-md">보낸 제안이 없습니다.</p>
          ) : (
            <div className="fm-panel">
              <div className="fm-panel__body--flush fm-table-wrap">
                <table className="fm-table fm-table--striped">
                  <thead>
                    <tr>
                      <th>선수</th>
                      <th>대상팀</th>
                      <th>이적료</th>
                      <th>제안 연봉</th>
                      <th>계약 기간</th>
                      <th>상태</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentOffers.map(offer => (
                      <tr key={offer.id}>
                        <td className="fm-cell--name">{getPlayerName(offer.playerId)}</td>
                        <td>{getTeamName(offer.toTeamId)}</td>
                        <td>{offer.transferFee > 0 ? formatAmount(offer.transferFee) : '-'}</td>
                        <td>{formatAmount(offer.offeredSalary)}/년</td>
                        <td>{offer.contractYears}년</td>
                        <td>
                          <span className={`fm-badge ${
                            offer.status === 'accepted' ? 'fm-badge--success'
                              : offer.status === 'rejected' ? 'fm-badge--danger'
                              : offer.status === 'cancelled' ? 'fm-badge--default'
                              : 'fm-badge--warning'
                          }`}>
                            {offer.status === 'pending' ? '대기중'
                              : offer.status === 'accepted' ? '수락'
                              : offer.status === 'rejected' ? '거절'
                              : '취소'}
                          </span>
                        </td>
                        <td>
                          {offer.status === 'pending' && (
                            <button
                              className="fm-btn fm-btn--sm fm-btn--ghost"
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
              </div>
            </div>
          )}

          {receivedOffers.length > 0 && (
            <>
              <h2 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-md fm-mt-lg">받은 제안</h2>
              <div className="fm-panel">
                <div className="fm-panel__body--flush fm-table-wrap">
                  <table className="fm-table fm-table--striped">
                    <thead>
                      <tr>
                        <th>선수</th>
                        <th>제안팀</th>
                        <th>이적료</th>
                        <th>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivedOffers.map(offer => (
                        <tr key={offer.id}>
                          <td className="fm-cell--name">{getPlayerName(offer.playerId)}</td>
                          <td>{getTeamName(offer.fromTeamId)}</td>
                          <td>{formatAmount(offer.transferFee)}</td>
                          <td>
                            <span className={`fm-badge ${
                              offer.status === 'accepted' ? 'fm-badge--success'
                                : offer.status === 'rejected' ? 'fm-badge--danger'
                                : 'fm-badge--warning'
                            }`}>
                              {offer.status === 'pending' ? '대기중'
                                : offer.status === 'accepted' ? '수락'
                                : offer.status === 'rejected' ? '거절'
                                : '취소'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 탭 3: 재계약 */}
      {tab === 'renewal' && (
        <div>
          <h2 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-md">소속 선수 재계약</h2>
          {rosterPlayers.length === 0 ? (
            <p className="fm-text-muted fm-text-md">로스터에 선수가 없습니다.</p>
          ) : (
            <div className="fm-panel">
              <div className="fm-panel__body--flush fm-table-wrap">
                <table className="fm-table fm-table--striped">
                  <thead>
                    <tr>
                      <th>포지션</th>
                      <th>이름</th>
                      <th>나이</th>
                      <th>OVR</th>
                      <th>현재 연봉</th>
                      <th>계약 만료</th>
                      <th>적정 연봉</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rosterPlayers
                      .sort((a, b) => a.contract.contractEndSeason - b.contract.contractEndSeason)
                      .map(player => {
                        const ovr = getOverall(player);
                        const fairSalary = calculateFairSalary(player);
                        const isExpiring = season && player.contract.contractEndSeason <= season.id + 1;
                        const hasActiveNeg = activeNegotiations.some(
                          n => n.playerId === player.id && (n.status === 'in_progress' || n.status === 'pending'),
                        );
                        return (
                          <tr key={player.id} style={isExpiring ? { background: 'var(--danger-dim)' } : undefined}>
                            <td>
                              <span className={`fm-pos-badge ${POS_CLASS[player.position] ?? ''}`}>
                                {POSITION_LABELS[player.position] ?? player.position}
                              </span>
                            </td>
                            <td className="fm-cell--name">
                              {player.name}
                              {isExpiring && <span className="fm-badge fm-badge--danger" style={{ marginLeft: '6px' }}>만료임박</span>}
                            </td>
                            <td>{player.age}</td>
                            <td><span className={getOvrClass(ovr)}>{ovr}</span></td>
                            <td>{formatAmount(player.contract.salary)}/년</td>
                            <td>시즌 {player.contract.contractEndSeason}</td>
                            <td>{formatAmount(fairSalary)}/년</td>
                            <td>
                              <button
                                className="fm-btn fm-btn--primary fm-btn--sm"
                                disabled={hasActiveNeg}
                                onClick={() => handleOpenRenewal(player)}
                              >
                                {hasActiveNeg ? '협상중' : '재계약'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 최근 협상 내역 */}
          {activeNegotiations.length > 0 && (
            <div className="fm-mt-lg">
              <h2 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-md">협상 내역</h2>
              <div className="fm-flex-col fm-gap-sm">
                {activeNegotiations.map(neg => {
                  const player = rosterPlayers.find(p => p.id === neg.playerId);
                  const lastMsg = neg.messages[neg.messages.length - 1];
                  return (
                    <div key={neg.id} className="fm-card">
                      <div className="fm-flex fm-justify-between fm-mb-sm">
                        <span className="fm-font-semibold fm-text-primary">
                          {player?.name ?? neg.playerId}
                        </span>
                        <span className={`fm-badge ${
                          neg.status === 'accepted' ? 'fm-badge--success'
                            : neg.status === 'rejected' ? 'fm-badge--danger'
                            : 'fm-badge--warning'
                        }`}>
                          {neg.status === 'accepted' ? '합의' : neg.status === 'rejected' ? '결렬' : `${neg.currentRound}/3 라운드`}
                        </span>
                      </div>
                      {lastMsg && (
                        <p className="fm-text-xs fm-text-secondary" style={{ margin: 0 }}>
                          {lastMsg.text}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 재계약 모달 */}
      {renewalTarget && (
        <div className="fm-overlay" role="dialog" aria-modal="true" aria-label="재계약 제안" onClick={() => { setRenewalTarget(null); setRenewalResult(null); }}>
          <div className="fm-modal" style={{ width: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="fm-modal__header">
              <h2 className="fm-modal__title">재계약 제안</h2>
              <button className="fm-modal__close" onClick={() => { setRenewalTarget(null); setRenewalResult(null); }}>&times;</button>
            </div>
            <div className="fm-modal__body">
              <div className="fm-flex fm-items-center fm-gap-sm fm-p-sm fm-mb-md" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <span className={`fm-pos-badge ${POS_CLASS[renewalTarget.position] ?? ''}`}>{POSITION_LABELS[renewalTarget.position]}</span>
                <span className="fm-text-lg fm-font-semibold fm-text-primary">{renewalTarget.name}</span>
                <span className="fm-text-md fm-text-secondary">{renewalTarget.age}세</span>
                <span className="fm-font-bold fm-text-accent" style={{ marginLeft: 'auto' }}>OVR {getOverall(renewalTarget)}</span>
              </div>

              {/* 현재 계약 정보 */}
              <div className="fm-flex fm-gap-md fm-mb-md fm-text-xs fm-text-secondary">
                <span>현재 연봉: <strong className="fm-text-primary">{formatAmount(renewalTarget.contract.salary)}/년</strong></span>
                <span>만료: <strong className="fm-text-primary">시즌 {renewalTarget.contract.contractEndSeason}</strong></span>
                <span>적정 연봉: <strong className="fm-text-accent">{formatAmount(calculateFairSalary(renewalTarget))}/년</strong></span>
              </div>

              {/* 선수 성향 표시 */}
              {(() => {
                const factors = generateDecisionFactors(renewalTarget);
                const demand = evaluatePlayerDemand(renewalTarget);
                const topFactor = ([...(['money', 'winning', 'playtime', 'loyalty', 'reputation'] as const)])
                  .sort((a, b) => factors[b] - factors[a])[0];
                const factorLabel: Record<string, string> = {
                  money: '연봉', winning: '우승', playtime: '출전 기회', loyalty: '충성도', reputation: '팀 명성',
                };
                return (
                  <div className="fm-alert fm-alert--info fm-mb-md">
                    <span className="fm-alert__text">
                      <span className="fm-font-semibold fm-text-accent">선수 성향:</span>{' '}
                      {factorLabel[topFactor]} 중시 | 희망 연봉: {formatAmount(demand.idealSalary)}/년 (최소 {formatAmount(demand.minSalary)})
                    </span>
                  </div>
                );
              })()}

              {/* 협상 결과 */}
              {renewalResult && (
                <div className="fm-card fm-mb-md" style={{
                  borderColor: renewalResult.status === 'accepted' ? 'var(--success)'
                    : renewalResult.status === 'rejected' ? 'var(--danger)' : 'var(--warning)',
                }}>
                  <div className="fm-flex fm-justify-between fm-mb-sm">
                    <span className={`fm-badge ${
                      renewalResult.status === 'accepted' ? 'fm-badge--success'
                        : renewalResult.status === 'rejected' ? 'fm-badge--danger'
                        : 'fm-badge--warning'
                    }`}>
                      {renewalResult.status === 'accepted' ? '수락' : renewalResult.status === 'rejected' ? '거절' : `라운드 ${renewalResult.currentRound}/3`}
                    </span>
                  </div>
                  {renewalResult.messages.map((msg, i) => (
                    <p key={i} className="fm-text-md" style={{
                      color: msg.from === 'team' ? 'var(--accent)' : 'var(--text-primary)',
                      margin: '4px 0',
                    }}>
                      <strong>{msg.from === 'team' ? '팀:' : '선수:'}</strong> {msg.text}
                    </p>
                  ))}
                  {renewalResult.playerSalary && renewalResult.status !== 'accepted' && renewalResult.status !== 'rejected' && (
                    <div className="fm-flex fm-gap-sm fm-flex-wrap fm-mt-sm fm-p-sm fm-text-xs fm-text-accent" style={{ background: 'var(--accent-dim)', borderRadius: 'var(--radius-md)' }}>
                      <span className="fm-font-semibold">선수 역제안:</span>
                      <span>연봉 {formatAmount(renewalResult.playerSalary)}/년</span>
                      {renewalResult.playerYears && <span>{renewalResult.playerYears}년</span>}
                    </div>
                  )}
                </div>
              )}

              {/* 제안 조건 입력 */}
              {(!renewalResult || (renewalResult.status !== 'accepted' && renewalResult.status !== 'rejected')) && (
                <>
                  <div className="fm-mb-md">
                    <label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>제안 연봉 (만 원/년)</label>
                    <input
                      type="number"
                      value={renewalSalary}
                      onChange={e => setRenewalSalary(Number(e.target.value))}
                      className="fm-input"
                      style={{ width: '100%' }}
                      min={100}
                      step={100}
                    />
                  </div>

                  <div className="fm-mb-md">
                    <label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>계약 기간</label>
                    <div className="fm-flex fm-gap-sm">
                      {[1, 2, 3].map(y => (
                        <button
                          key={y}
                          className={`fm-btn fm-btn--sm ${renewalYears === y ? 'fm-btn--primary' : ''}`}
                          onClick={() => setRenewalYears(y)}
                        >
                          {y}년
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="fm-mb-md">
                    <label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>계약 보너스 (만 원, 선택)</label>
                    <input
                      type="number"
                      value={renewalBonus}
                      onChange={e => setRenewalBonus(Number(e.target.value))}
                      className="fm-input"
                      style={{ width: '100%' }}
                      min={0}
                      step={100}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="fm-modal__footer">
              <button className="fm-btn" onClick={() => { setRenewalTarget(null); setRenewalResult(null); }}>
                {renewalResult?.status === 'accepted' || renewalResult?.status === 'rejected' ? '닫기' : '취소'}
              </button>
              {!renewalResult && (
                <button className="fm-btn fm-btn--primary" onClick={handleSubmitRenewal}>
                  제안하기
                </button>
              )}
              {renewalResult && renewalResult.status !== 'accepted' && renewalResult.status !== 'rejected' && (
                <button className="fm-btn fm-btn--primary" onClick={handleRenewalCounterResponse}>
                  재제안
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 영입 제안 모달 */}
      {offerModal && (
        <div className="fm-overlay" role="dialog" aria-modal="true" aria-label="영입 제안" onClick={() => setOfferModal(null)}>
          <div className="fm-modal" onClick={e => e.stopPropagation()}>
            <div className="fm-modal__header">
              <h2 className="fm-modal__title">영입 제안</h2>
              <button className="fm-modal__close" onClick={() => setOfferModal(null)}>&times;</button>
            </div>
            <div className="fm-modal__body">
              <div className="fm-flex fm-items-center fm-gap-sm fm-p-sm fm-mb-md" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <span className={`fm-pos-badge ${POS_CLASS[offerModal.position] ?? ''}`}>{POSITION_LABELS[offerModal.position]}</span>
                <span className="fm-text-lg fm-font-semibold fm-text-primary">{offerModal.name}</span>
                <span className="fm-text-md fm-text-secondary">{offerModal.age}세</span>
                <span className="fm-font-bold fm-text-accent" style={{ marginLeft: 'auto' }}>OVR {getOverall(offerModal)}</span>
              </div>

              <div className="fm-mb-md">
                <label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>연봉 (만 원/년)</label>
                <input
                  type="number"
                  value={offerSalary}
                  onChange={e => setOfferSalary(Number(e.target.value))}
                  className="fm-input"
                  style={{ width: '100%' }}
                  min={100}
                  step={100}
                />
                <span className="fm-text-xs fm-text-muted fm-mt-sm" style={{ display: 'block' }}>
                  적정 연봉: {formatAmount(calculateFairSalary(offerModal))}
                </span>
              </div>

              <div className="fm-mb-md">
                <label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>계약 기간 (년)</label>
                <div className="fm-flex fm-gap-sm">
                  {[1, 2, 3].map(y => (
                    <button
                      key={y}
                      className={`fm-btn fm-btn--sm ${offerYears === y ? 'fm-btn--primary' : ''}`}
                      onClick={() => setOfferYears(y)}
                    >
                      {y}년
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="fm-modal__footer">
              <button className="fm-btn" onClick={() => setOfferModal(null)}>취소</button>
              <button className="fm-btn fm-btn--primary" onClick={handleSubmitOffer}>제안하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 에이전트 협상 모달 */}
      {negotiationPlayer && (
        <div className="fm-overlay" role="dialog" aria-modal="true" aria-label="에이전트 협상" onClick={handleCloseNegotiation}>
          <div className="fm-modal" style={{ width: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="fm-modal__header">
              <h2 className="fm-modal__title">에이전트 협상</h2>
              <button className="fm-modal__close" onClick={handleCloseNegotiation}>&times;</button>
            </div>
            <div className="fm-modal__body">
              <div className="fm-flex fm-items-center fm-gap-sm fm-p-sm fm-mb-md" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <span className={`fm-pos-badge ${POS_CLASS[negotiationPlayer.position] ?? ''}`}>{POSITION_LABELS[negotiationPlayer.position]}</span>
                <span className="fm-text-lg fm-font-semibold fm-text-primary">{negotiationPlayer.name}</span>
                <span className="fm-text-md fm-text-secondary">{negotiationPlayer.age}세</span>
                <span className="fm-font-bold fm-text-accent" style={{ marginLeft: 'auto' }}>OVR {getOverall(negotiationPlayer)}</span>
              </div>

              {/* 라운드 표시 */}
              <div className="fm-flex fm-items-center fm-gap-sm fm-mb-md">
                {[1, 2, 3].map(r => (
                  <div
                    key={r}
                    className="fm-flex fm-items-center fm-justify-center fm-text-xs fm-font-bold"
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: r <= negotiationRound ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                    }}
                  >
                    {r}
                  </div>
                ))}
                <span className="fm-text-xs fm-text-muted" style={{ marginLeft: 'auto' }}>라운드 {negotiationRound}/3</span>
              </div>

              {/* 에이전트 대화 */}
              {negotiationLoading ? (
                <div className="fm-card fm-mb-md">
                  <p className="fm-text-md fm-text-muted fm-text-center" style={{ margin: 0 }}>에이전트가 검토 중...</p>
                </div>
              ) : negotiationDialogue ? (
                <div className="fm-card fm-mb-md" style={{
                  borderColor: negotiationDialogue.tone === 'aggressive' ? 'var(--danger)'
                    : negotiationDialogue.tone === 'firm' ? 'var(--warning)'
                    : negotiationDialogue.tone === 'pleading' ? '#9b59b6'
                    : 'var(--success)',
                }}>
                  <div className="fm-flex fm-items-center fm-justify-between fm-mb-sm">
                    <span className={`fm-badge ${
                      negotiationDialogue.tone === 'aggressive' ? 'fm-badge--danger'
                        : negotiationDialogue.tone === 'firm' ? 'fm-badge--warning'
                        : negotiationDialogue.tone === 'pleading' ? 'fm-badge--info'
                        : 'fm-badge--success'
                    }`}>
                      {negotiationDialogue.tone === 'aggressive' ? '강경'
                        : negotiationDialogue.tone === 'firm' ? '단호'
                        : negotiationDialogue.tone === 'pleading' ? '유연'
                        : '우호'}
                    </span>
                    <span className="fm-text-xs fm-font-semibold fm-text-secondary">
                      수락 의향: {negotiationDialogue.willingness}%
                    </span>
                  </div>
                  <p className="fm-text-lg fm-text-primary" style={{ lineHeight: 1.6, margin: 0 }}>{negotiationDialogue.agentMessage}</p>
                  {negotiationDialogue.counterOffer && (
                    <div className="fm-flex fm-gap-sm fm-flex-wrap fm-mt-sm fm-p-sm fm-text-xs fm-text-accent" style={{ background: 'var(--accent-dim)', borderRadius: 'var(--radius-md)' }}>
                      <span className="fm-font-semibold">에이전트 역제안:</span>
                      {negotiationDialogue.counterOffer.salary && (
                        <span>연봉 {formatAmount(negotiationDialogue.counterOffer.salary)}/년</span>
                      )}
                      {negotiationDialogue.counterOffer.years && (
                        <span>{negotiationDialogue.counterOffer.years}년</span>
                      )}
                      {negotiationDialogue.counterOffer.signingBonus && (
                        <span>보너스 {formatAmount(negotiationDialogue.counterOffer.signingBonus)}</span>
                      )}
                    </div>
                  )}
                  {/* 수락 의향 바 */}
                  <div className="fm-bar fm-mt-sm">
                    <div className="fm-bar__track">
                      <div
                        className={`fm-bar__fill ${
                          negotiationDialogue.willingness >= 70 ? 'fm-bar__fill--green'
                            : negotiationDialogue.willingness >= 40 ? 'fm-bar__fill--yellow'
                            : 'fm-bar__fill--red'
                        }`}
                        style={{ width: `${negotiationDialogue.willingness}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {/* 제안 조정 */}
              <div className="fm-mb-md">
                <label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>제안 연봉 (만 원/년)</label>
                <input
                  type="number"
                  value={negotiationSalary}
                  onChange={e => setNegotiationSalary(Number(e.target.value))}
                  className="fm-input"
                  style={{ width: '100%' }}
                  min={100}
                  step={100}
                />
              </div>

              <div className="fm-mb-md">
                <label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>계약 기간</label>
                <div className="fm-flex fm-gap-sm">
                  {[1, 2, 3].map(y => (
                    <button
                      key={y}
                      className={`fm-btn fm-btn--sm ${negotiationYears === y ? 'fm-btn--primary' : ''}`}
                      onClick={() => setNegotiationYears(y)}
                    >
                      {y}년
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="fm-modal__footer">
              <button className="fm-btn" onClick={handleCloseNegotiation}>
                협상 종료
              </button>
              {negotiationRound < 3 && (
                <button
                  className="fm-btn"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                  onClick={handleNextNegotiationRound}
                  disabled={negotiationLoading}
                >
                  다음 라운드
                </button>
              )}
              {negotiationDialogue && negotiationDialogue.willingness >= 50 && (
                <button className="fm-btn fm-btn--primary" onClick={handleAcceptNegotiation}>
                  이 조건으로 영입
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
