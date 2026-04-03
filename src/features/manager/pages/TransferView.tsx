import { useCallback, useEffect, useMemo, useState } from 'react';
import { Skeleton, SkeletonTable } from '../../../components/Skeleton';
import { getFreeAgents, getPlayersByTeamId, getTeamRecentWinRate, getTeamTotalSalary, type TransferOffer } from '../../../db/queries';
import { aiPlayerRespondToOffer, calculateRenewalOffer, createNegotiation, finalizeNegotiation, generateDecisionFactors, getTeamNegotiations } from '../../../engine/economy/contractEngine';
import { acceptFreeAgentOffer, acceptTransferOffer, calculateFairSalary, calculatePlayerValue, cancelTransferOffer, evaluateOutgoingTransferCounter, getTeamTransferOffers, offerFreeAgent, offerTransfer, respondToIncomingTransferOffer } from '../../../engine/economy/transferEngine';
import { useGameStore } from '../../../stores/gameStore';
import type { ContractNegotiation } from '../../../types/contract';
import type { Player } from '../../../types/player';
import { POSITION_LABELS_SHORT as POSITION_LABELS } from '../../../utils/constants';
import { formatAmount } from '../../../utils/formatUtils';

type Tab = 'freeAgents' | 'targets' | 'offers' | 'renewal';
type Mode = 'freeAgent' | 'target' | 'incomingCounter';
type MarketPlayer = Player & { sellerTeamId: string };
type DraftOffer = { transferFee: number; offeredSalary: number; contractYears: number };

const POSITIONS = ['all', 'top', 'jungle', 'mid', 'adc', 'support'] as const;
const POS_CLASS: Record<string, string> = { top: 'fm-pos-badge--top', jungle: 'fm-pos-badge--jgl', mid: 'fm-pos-badge--mid', adc: 'fm-pos-badge--adc', support: 'fm-pos-badge--sup' };
const ovr = (p: Player) => Math.round((p.stats.mechanical + p.stats.gameSense + p.stats.teamwork + p.stats.consistency + p.stats.laning + p.stats.aggression) / 6);
const ovrClass = (n: number) => n >= 85 ? 'fm-ovr fm-ovr--elite' : n >= 75 ? 'fm-ovr fm-ovr--high' : n >= 65 ? 'fm-ovr fm-ovr--mid' : 'fm-ovr fm-ovr--low';
const statusLabel = (s: TransferOffer['status']) => s === 'accepted' ? '합의' : s === 'rejected' ? '거절' : s === 'cancelled' ? '취소' : s === 'player_request' ? '선수 요청' : '대기';
const statusClass = (s: TransferOffer['status']) => s === 'accepted' ? 'fm-badge--success' : s === 'rejected' ? 'fm-badge--danger' : s === 'cancelled' ? 'fm-badge--default' : s === 'player_request' ? 'fm-badge--info' : 'fm-badge--warning';

export function TransferView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);
  const userTeam = teams.find((team) => team.id === save?.userTeamId);

  const [tab, setTab] = useState<Tab>('freeAgents');
  const [posFilter, setPosFilter] = useState<string>('all');
  const [freeAgents, setFreeAgents] = useState<Player[]>([]);
  const [rosterPlayers, setRosterPlayers] = useState<Player[]>([]);
  const [sentOffers, setSentOffers] = useState<TransferOffer[]>([]);
  const [receivedOffers, setReceivedOffers] = useState<TransferOffer[]>([]);
  const [activeNegotiations, setActiveNegotiations] = useState<ContractNegotiation[]>([]);
  const [teamSalary, setTeamSalary] = useState(0);
  const [teamWinRate, setTeamWinRate] = useState(0.5);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [modalMode, setModalMode] = useState<Mode | null>(null);
  const [modalPlayer, setModalPlayer] = useState<Player | null>(null);
  const [modalOffer, setModalOffer] = useState<TransferOffer | null>(null);
  const [draftOffer, setDraftOffer] = useState<DraftOffer>({ transferFee: 0, offeredSalary: 0, contractYears: 2 });
  const [modalError, setModalError] = useState<string | null>(null);
  const [renewalTarget, setRenewalTarget] = useState<Player | null>(null);
  const [renewalOffer, setRenewalOffer] = useState({ salary: 0, years: 1, bonus: 0 });
  const [renewalResult, setRenewalResult] = useState<ContractNegotiation | null>(null);

  const loadData = useCallback(async () => {
    if (!season || !save) return;
    setLoading(true);
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
      setSentOffers(offers.sent.sort((a, b) => b.id - a.id));
      setReceivedOffers(offers.received.sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1) || b.id - a.id));
      setRosterPlayers(roster);
      setActiveNegotiations(negotiations);
      setTeamWinRate(winRate);
    } catch (error) {
      console.error('failed to load transfer page:', error);
      setMessage({ text: '이적 화면 데이터를 불러오지 못했습니다.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [save, season]);

  useEffect(() => { void loadData(); }, [loadData]);

  const targets = useMemo<MarketPlayer[]>(() => teams.filter((team) => team.id !== save?.userTeamId).flatMap((team) => team.roster.map((player) => ({ ...player, sellerTeamId: team.id }))), [teams, save?.userTeamId]);
  const filteredFreeAgents = useMemo(() => posFilter === 'all' ? freeAgents : freeAgents.filter((p) => p.position === posFilter), [freeAgents, posFilter]);
  const filteredTargets = useMemo(() => posFilter === 'all' ? targets : targets.filter((p) => p.position === posFilter), [targets, posFilter]);
  const teamName = useCallback((teamId: string | null) => !teamId ? '자유계약' : teams.find((team) => team.id === teamId)?.shortName ?? teamId, [teams]);
  const playerName = useCallback((playerId: string) => teams.flatMap((team) => team.roster).find((player) => player.id === playerId)?.name ?? freeAgents.find((player) => player.id === playerId)?.name ?? rosterPlayers.find((player) => player.id === playerId)?.name ?? playerId, [freeAgents, rosterPlayers, teams]);

  const openPlayerModal = (mode: Mode, player: Player, offer?: TransferOffer) => {
    setModalMode(mode);
    setModalPlayer(player);
    setModalOffer(offer ?? null);
    setModalError(null);
    if (mode === 'freeAgent') setDraftOffer({ transferFee: 0, offeredSalary: calculateFairSalary(player), contractYears: 2 });
    if (mode === 'target') setDraftOffer({ transferFee: calculatePlayerValue(player), offeredSalary: calculateFairSalary(player), contractYears: 2 });
    if (mode === 'incomingCounter' && offer) setDraftOffer({ transferFee: Math.max(offer.transferFee, Math.round(offer.transferFee * 1.1)), offeredSalary: Math.max(offer.offeredSalary, calculateFairSalary(player)), contractYears: Math.max(2, offer.contractYears) });
  };

  const closePlayerModal = () => { setModalMode(null); setModalPlayer(null); setModalOffer(null); setModalError(null); };

  const submitPlayerModal = async () => {
    if (!season || !save || !modalMode || !modalPlayer) return;
    setModalError(null);
    try {
      if (modalMode === 'freeAgent') {
        const result = await offerFreeAgent({ seasonId: season.id, fromTeamId: save.userTeamId, playerId: modalPlayer.id, offeredSalary: draftOffer.offeredSalary, contractYears: draftOffer.contractYears, offerDate: season.currentDate });
        if (!result.success || !result.offerId) { setModalError(result.reason ?? '제안 생성에 실패했습니다.'); return; }
        await acceptFreeAgentOffer({ id: result.offerId, seasonId: season.id, fromTeamId: save.userTeamId, toTeamId: null, playerId: modalPlayer.id, transferFee: 0, offeredSalary: draftOffer.offeredSalary, contractYears: draftOffer.contractYears, status: 'pending', offerDate: season.currentDate }, season.id, season.currentDate);
        setMessage({ text: `${modalPlayer.name} 영입을 완료했습니다.`, type: 'success' });
      } else if (modalMode === 'target') {
        const target = modalPlayer as MarketPlayer;
        const evaluation = await evaluateOutgoingTransferCounter({ fromTeamId: save.userTeamId, toTeamId: target.sellerTeamId, playerId: target.id, transferFee: draftOffer.transferFee, offeredSalary: draftOffer.offeredSalary, contractYears: draftOffer.contractYears });
        if (!evaluation.accepted) {
          setModalError(evaluation.reason);
          if (evaluation.counterOffer) setDraftOffer(evaluation.counterOffer);
          return;
        }
        const result = await offerTransfer({ seasonId: season.id, fromTeamId: save.userTeamId, toTeamId: target.sellerTeamId, playerId: target.id, transferFee: draftOffer.transferFee, offeredSalary: draftOffer.offeredSalary, contractYears: draftOffer.contractYears, offerDate: season.currentDate });
        if (!result.success || !result.offerId) { setModalError(result.reason ?? '구단 제안 생성에 실패했습니다.'); return; }
        await acceptTransferOffer({ id: result.offerId, seasonId: season.id, fromTeamId: save.userTeamId, toTeamId: target.sellerTeamId, playerId: target.id, transferFee: draftOffer.transferFee, offeredSalary: draftOffer.offeredSalary, contractYears: draftOffer.contractYears, status: 'pending', offerDate: season.currentDate }, season.id, season.currentDate);
        setMessage({ text: `${modalPlayer.name} 이적 합의를 완료했습니다.`, type: 'success' });
      } else if (modalMode === 'incomingCounter' && modalOffer) {
        const result = await respondToIncomingTransferOffer(modalOffer, season.id, season.currentDate, 'counter', draftOffer);
        if (!result.accepted) {
          setModalError(result.reason);
          if (result.counterOffer) setDraftOffer(result.counterOffer);
          return;
        }
        setMessage({ text: result.reason, type: 'success' });
      }
      closePlayerModal();
      await loadData();
    } catch (error) {
      console.error('failed to submit transfer modal:', error);
      setModalError('이적 처리 중 문제가 발생했습니다.');
    }
  };

  const handleIncoming = async (offer: TransferOffer, action: 'accept' | 'reject') => {
    if (!season) return;
    try {
      const result = await respondToIncomingTransferOffer(offer, season.id, season.currentDate, action);
      setMessage({ text: result.reason, type: result.accepted ? 'success' : 'error' });
      await loadData();
    } catch (error) {
      console.error('failed to respond to incoming offer:', error);
      setMessage({ text: '받은 제안을 처리하지 못했습니다.', type: 'error' });
    }
  };

  const submitRenewal = async () => {
    if (!renewalTarget || !season || !save || !userTeam) return;
    try {
      const negotiation = await createNegotiation({ seasonId: season.id, playerId: renewalTarget.id, teamId: save.userTeamId, initiator: 'team_to_player', teamSalary: renewalOffer.salary, teamYears: renewalOffer.years, teamSigningBonus: renewalOffer.bonus, factors: generateDecisionFactors(renewalTarget) });
      const rosterStrength = rosterPlayers.length > 0 ? rosterPlayers.reduce((sum, player) => sum + ovr(player), 0) / rosterPlayers.length : 60;
      const positionCompetitorOvr = rosterPlayers.filter((player) => player.position === renewalTarget.position && player.id !== renewalTarget.id).reduce((max, player) => Math.max(max, ovr(player)), 0);
      const result = await aiPlayerRespondToOffer(negotiation, renewalTarget, { reputation: userTeam.reputation ?? 50, recentWinRate: teamWinRate, rosterStrength, positionCompetitorOvr });
      setRenewalResult(result);
      if (result.status === 'accepted') {
        const finalResult = await finalizeNegotiation(result, season.id);
        setMessage({ text: finalResult.reason, type: finalResult.success ? 'success' : 'error' });
        if (finalResult.success) await loadData();
      }
    } catch (error) {
      console.error('failed to submit renewal:', error);
      setMessage({ text: '재계약 제안 처리에 실패했습니다.', type: 'error' });
    }
  };

  if (!season || !save) return <p className="fm-text-muted">데이터를 불러오는 중입니다...</p>;
  if (loading) return <div><Skeleton width="180px" height="28px" variant="text" /><div className="fm-mt-md fm-mb-md"><Skeleton width="100%" height="48px" variant="rect" /></div><SkeletonTable rows={8} cols={7} /></div>;

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header"><h1 className="fm-page-title">이적 시장</h1></div>
      <div className="fm-panel fm-mb-md"><div className="fm-panel__body--compact fm-flex fm-gap-lg fm-flex-wrap fm-text-md">
        <span className="fm-text-secondary">예산: <strong className="fm-text-accent">{formatAmount(userTeam?.budget ?? 0)}</strong></span>
        <span className="fm-text-secondary">총 연봉: <strong className="fm-text-primary">{formatAmount(teamSalary)}</strong></span>
        <span className="fm-text-secondary">받은 제안: <strong className="fm-text-warning">{receivedOffers.filter((offer) => offer.status === 'pending').length}건</strong></span>
      </div></div>
      {message && <div className={`fm-alert ${message.type === 'success' ? 'fm-alert--success' : 'fm-alert--danger'} fm-mb-md`}><span className="fm-alert__text">{message.text}</span></div>}
      <div className="fm-tabs">
        <button className={`fm-tab ${tab === 'freeAgents' ? 'fm-tab--active' : ''}`} onClick={() => setTab('freeAgents')}>자유계약</button>
        <button className={`fm-tab ${tab === 'targets' ? 'fm-tab--active' : ''}`} onClick={() => setTab('targets')}>타팀 선수 제의</button>
        <button className={`fm-tab ${tab === 'offers' ? 'fm-tab--active' : ''}`} onClick={() => setTab('offers')}>보낸/받은 제안</button>
        <button className={`fm-tab ${tab === 'renewal' ? 'fm-tab--active' : ''}`} onClick={() => setTab('renewal')}>재계약</button>
      </div>
      {(tab === 'freeAgents' || tab === 'targets') && <div className="fm-flex fm-gap-xs fm-mb-md fm-flex-wrap">{POSITIONS.map((position) => <button key={position} className={`fm-btn fm-btn--sm ${posFilter === position ? 'fm-btn--primary' : ''}`} onClick={() => setPosFilter(position)}>{position === 'all' ? '전체' : POSITION_LABELS[position]}</button>)}</div>}

      {tab === 'freeAgents' && <div className="fm-panel"><div className="fm-panel__body--flush fm-table-wrap"><table className="fm-table fm-table--striped"><thead><tr><th>포지션</th><th>이름</th><th>나이</th><th>OVR</th><th>포텐셜</th><th>가치</th><th>연봉</th><th /></tr></thead><tbody>
        {filteredFreeAgents.sort((a, b) => ovr(b) - ovr(a)).map((player) => {
          const pending = sentOffers.some((offer) => offer.playerId === player.id && offer.status === 'pending');
          return <tr key={player.id}><td><span className={`fm-pos-badge ${POS_CLASS[player.position] ?? ''}`}>{POSITION_LABELS[player.position] ?? player.position}</span></td><td className="fm-cell--name">{player.name}</td><td>{player.age}</td><td><span className={ovrClass(ovr(player))}>{ovr(player)}</span></td><td>{player.potential}</td><td>{formatAmount(calculatePlayerValue(player))}</td><td>{formatAmount(calculateFairSalary(player))}/년</td><td><button className="fm-btn fm-btn--primary fm-btn--sm" disabled={pending} onClick={() => openPlayerModal('freeAgent', player)}>{pending ? '진행 중' : '영입'}</button></td></tr>;
        })}
      </tbody></table></div></div>}

      {tab === 'targets' && <div className="fm-panel"><div className="fm-panel__body--flush fm-table-wrap"><table className="fm-table fm-table--striped"><thead><tr><th>포지션</th><th>이름</th><th>현재 팀</th><th>나이</th><th>OVR</th><th>이적료</th><th>연봉</th><th /></tr></thead><tbody>
        {filteredTargets.sort((a, b) => ovr(b) - ovr(a)).map((player) => {
          const pending = sentOffers.some((offer) => offer.playerId === player.id && offer.status === 'pending');
          return <tr key={player.id}><td><span className={`fm-pos-badge ${POS_CLASS[player.position] ?? ''}`}>{POSITION_LABELS[player.position] ?? player.position}</span></td><td className="fm-cell--name">{player.name}</td><td>{teamName(player.sellerTeamId)}</td><td>{player.age}</td><td><span className={ovrClass(ovr(player))}>{ovr(player)}</span></td><td>{formatAmount(calculatePlayerValue(player))}</td><td>{formatAmount(calculateFairSalary(player))}/년</td><td><button className="fm-btn fm-btn--primary fm-btn--sm" disabled={pending} onClick={() => openPlayerModal('target', player)}>{pending ? '협상 중' : '제의'}</button></td></tr>;
        })}
      </tbody></table></div></div>}

      {tab === 'offers' && <div className="fm-flex-col fm-gap-lg">
        <div><h2 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-md">보낸 제안</h2>{sentOffers.length === 0 ? <p className="fm-text-muted fm-text-md">보낸 제안이 없습니다.</p> : <div className="fm-panel"><div className="fm-panel__body--flush fm-table-wrap"><table className="fm-table fm-table--striped"><thead><tr><th>선수</th><th>상대</th><th>이적료</th><th>연봉</th><th>계약</th><th>상태</th><th /></tr></thead><tbody>
          {sentOffers.map((offer) => <tr key={offer.id}><td className="fm-cell--name">{playerName(offer.playerId)}</td><td>{teamName(offer.toTeamId)}</td><td>{offer.transferFee > 0 ? formatAmount(offer.transferFee) : '-'}</td><td>{formatAmount(offer.offeredSalary)}/년</td><td>{offer.contractYears}년</td><td><span className={`fm-badge ${statusClass(offer.status)}`}>{statusLabel(offer.status)}</span></td><td>{offer.status === 'pending' && <button className="fm-btn fm-btn--sm fm-btn--ghost" onClick={async () => { try { await cancelTransferOffer(offer.id, season.currentDate); await loadData(); setMessage({ text: '제안을 취소했습니다.', type: 'success' }); } catch (error) { console.error('failed to cancel offer:', error); setMessage({ text: '제안 취소에 실패했습니다.', type: 'error' }); } }}>취소</button>}</td></tr>)}
        </tbody></table></div></div>}</div>
        <div><h2 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-md">받은 제안</h2>{receivedOffers.length === 0 ? <p className="fm-text-muted fm-text-md">받은 제안이 없습니다.</p> : <div className="fm-panel"><div className="fm-panel__body--flush fm-table-wrap"><table className="fm-table fm-table--striped"><thead><tr><th>선수</th><th>제안 팀</th><th>이적료</th><th>연봉</th><th>계약</th><th>상태</th><th /></tr></thead><tbody>
          {receivedOffers.map((offer) => { const player = rosterPlayers.find((item) => item.id === offer.playerId) ?? teams.flatMap((team) => team.roster).find((item) => item.id === offer.playerId); return <tr key={offer.id}><td className="fm-cell--name">{playerName(offer.playerId)}</td><td>{teamName(offer.fromTeamId)}</td><td>{formatAmount(offer.transferFee)}</td><td>{formatAmount(offer.offeredSalary)}/년</td><td>{offer.contractYears}년</td><td><span className={`fm-badge ${statusClass(offer.status)}`}>{statusLabel(offer.status)}</span></td><td>{offer.status === 'pending' && player ? <div className="fm-flex fm-gap-xs fm-flex-wrap"><button className="fm-btn fm-btn--primary fm-btn--sm" onClick={() => void handleIncoming(offer, 'accept')}>수락</button><button className="fm-btn fm-btn--sm" onClick={() => openPlayerModal('incomingCounter', player, offer)}>카운터</button><button className="fm-btn fm-btn--ghost fm-btn--sm" onClick={() => void handleIncoming(offer, 'reject')}>거절</button></div> : <span className="fm-text-muted fm-text-xs">처리 완료</span>}</td></tr>; })}
        </tbody></table></div></div>}</div>
      </div>}

      {tab === 'renewal' && <div className="fm-flex-col fm-gap-lg">
        <div><h2 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-md">재계약 대상</h2><div className="fm-panel"><div className="fm-panel__body--flush fm-table-wrap"><table className="fm-table fm-table--striped"><thead><tr><th>포지션</th><th>이름</th><th>나이</th><th>OVR</th><th>현재 연봉</th><th>만료 시즌</th><th>적정 연봉</th><th /></tr></thead><tbody>
          {rosterPlayers.sort((a, b) => a.contract.contractEndSeason - b.contract.contractEndSeason).map((player) => { const expiring = player.contract.contractEndSeason <= season.id + 1; const active = activeNegotiations.some((neg) => neg.playerId === player.id && (neg.status === 'in_progress' || neg.status === 'pending')); return <tr key={player.id} style={expiring ? { background: 'var(--danger-dim)' } : undefined}><td><span className={`fm-pos-badge ${POS_CLASS[player.position] ?? ''}`}>{POSITION_LABELS[player.position] ?? player.position}</span></td><td className="fm-cell--name">{player.name}{expiring && <span className="fm-badge fm-badge--danger" style={{ marginLeft: 6 }}>만료 임박</span>}</td><td>{player.age}</td><td><span className={ovrClass(ovr(player))}>{ovr(player)}</span></td><td>{formatAmount(player.contract.salary)}/년</td><td>시즌 {player.contract.contractEndSeason}</td><td>{formatAmount(calculateFairSalary(player))}/년</td><td><button className="fm-btn fm-btn--primary fm-btn--sm" disabled={active} onClick={() => { const offer = calculateRenewalOffer(player); setRenewalTarget(player); setRenewalOffer({ salary: offer.suggestedSalary, years: offer.suggestedYears, bonus: 0 }); setRenewalResult(null); }}>{active ? '협상 중' : '재계약'}</button></td></tr>; })}
        </tbody></table></div></div></div>
        {activeNegotiations.length > 0 && <div><h2 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-md">진행 중인 협상</h2><div className="fm-flex-col fm-gap-sm">{activeNegotiations.map((neg) => { const last = neg.messages[neg.messages.length - 1]; return <div key={neg.id} className="fm-card"><div className="fm-flex fm-justify-between fm-mb-sm"><span className="fm-font-semibold fm-text-primary">{rosterPlayers.find((player) => player.id === neg.playerId)?.name ?? neg.playerId}</span><span className={`fm-badge ${neg.status === 'accepted' ? 'fm-badge--success' : neg.status === 'rejected' ? 'fm-badge--danger' : 'fm-badge--warning'}`}>{neg.status === 'accepted' ? '합의' : neg.status === 'rejected' ? '결렬' : `${neg.currentRound}/3 라운드`}</span></div>{last && <p className="fm-text-xs fm-text-secondary" style={{ margin: 0 }}>{last.text}</p>}</div>; })}</div></div>}
      </div>}

      {modalMode && modalPlayer && <div className="fm-overlay" role="dialog" aria-modal="true" onClick={closePlayerModal}>
        <div className="fm-modal" style={{ width: '520px' }} onClick={(event) => event.stopPropagation()}>
          <div className="fm-modal__header"><h2 className="fm-modal__title">{modalMode === 'freeAgent' ? '자유계약 영입' : modalMode === 'target' ? '타팀 선수 제의' : '카운터 제안'}</h2><button className="fm-modal__close" onClick={closePlayerModal}>&times;</button></div>
          <div className="fm-modal__body">
            <div className="fm-flex fm-items-center fm-gap-sm fm-p-sm fm-mb-md" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}><span className={`fm-pos-badge ${POS_CLASS[modalPlayer.position] ?? ''}`}>{POSITION_LABELS[modalPlayer.position]}</span><span className="fm-text-lg fm-font-semibold fm-text-primary">{modalPlayer.name}</span><span className="fm-text-md fm-text-secondary">{modalMode === 'target' ? teamName((modalPlayer as MarketPlayer).sellerTeamId) : modalMode === 'incomingCounter' && modalOffer ? teamName(modalOffer.fromTeamId) : `${modalPlayer.age}세`}</span><span className="fm-font-bold fm-text-accent" style={{ marginLeft: 'auto' }}>OVR {ovr(modalPlayer)}</span></div>
            <div className="fm-mb-md"><label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>{modalMode === 'freeAgent' ? '연봉' : '이적료'}</label><input type="number" value={modalMode === 'freeAgent' ? draftOffer.offeredSalary : draftOffer.transferFee} onChange={(event) => setDraftOffer((current) => modalMode === 'freeAgent' ? { ...current, offeredSalary: Number(event.target.value) } : { ...current, transferFee: Number(event.target.value) })} className="fm-input" style={{ width: '100%' }} min={0} step={100} /></div>
            {modalMode !== 'freeAgent' && <div className="fm-mb-md"><label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>연봉</label><input type="number" value={draftOffer.offeredSalary} onChange={(event) => setDraftOffer((current) => ({ ...current, offeredSalary: Number(event.target.value) }))} className="fm-input" style={{ width: '100%' }} min={100} step={100} /></div>}
            <div className="fm-mb-md"><label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>계약 기간</label><div className="fm-flex fm-gap-sm">{[1, 2, 3].map((years) => <button key={years} className={`fm-btn fm-btn--sm ${draftOffer.contractYears === years ? 'fm-btn--primary' : ''}`} onClick={() => setDraftOffer((current) => ({ ...current, contractYears: years }))}>{years}년</button>)}</div></div>
            {modalMode === 'target' && <div className="fm-alert fm-alert--info"><span className="fm-alert__text">조건이 낮으면 상대 구단이 카운터 조건을 제시합니다. 이번 라운드에서는 1~2회 조정이 가능합니다.</span></div>}
            {modalError && <div className="fm-alert fm-alert--danger fm-mt-sm"><span className="fm-alert__text">{modalError}</span></div>}
          </div>
          <div className="fm-modal__footer"><button className="fm-btn" onClick={closePlayerModal}>취소</button><button className="fm-btn fm-btn--primary" onClick={() => void submitPlayerModal()}>{modalMode === 'incomingCounter' ? '카운터 보내기' : '확정'}</button></div>
        </div>
      </div>}

      {renewalTarget && <div className="fm-overlay" role="dialog" aria-modal="true" onClick={() => { setRenewalTarget(null); setRenewalResult(null); }}>
        <div className="fm-modal" style={{ width: '480px' }} onClick={(event) => event.stopPropagation()}>
          <div className="fm-modal__header"><h2 className="fm-modal__title">재계약 협상</h2><button className="fm-modal__close" onClick={() => { setRenewalTarget(null); setRenewalResult(null); }}>&times;</button></div>
          <div className="fm-modal__body">
            <div className="fm-flex fm-items-center fm-gap-sm fm-p-sm fm-mb-md" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}><span className={`fm-pos-badge ${POS_CLASS[renewalTarget.position] ?? ''}`}>{POSITION_LABELS[renewalTarget.position]}</span><span className="fm-text-lg fm-font-semibold fm-text-primary">{renewalTarget.name}</span><span className="fm-text-md fm-text-secondary">{renewalTarget.age}세</span><span className="fm-font-bold fm-text-accent" style={{ marginLeft: 'auto' }}>OVR {ovr(renewalTarget)}</span></div>
            <div className="fm-flex fm-gap-md fm-mb-md fm-text-xs fm-text-secondary fm-flex-wrap"><span>현재 연봉: <strong className="fm-text-primary">{formatAmount(renewalTarget.contract.salary)}/년</strong></span><span>적정 연봉: <strong className="fm-text-accent">{formatAmount(calculateFairSalary(renewalTarget))}/년</strong></span></div>
            {renewalResult && <div className="fm-card fm-mb-md" style={{ borderColor: renewalResult.status === 'accepted' ? 'var(--success)' : renewalResult.status === 'rejected' ? 'var(--danger)' : 'var(--warning)' }}><div className="fm-flex fm-justify-between fm-mb-sm"><span className={`fm-badge ${renewalResult.status === 'accepted' ? 'fm-badge--success' : renewalResult.status === 'rejected' ? 'fm-badge--danger' : 'fm-badge--warning'}`}>{renewalResult.status === 'accepted' ? '수락' : renewalResult.status === 'rejected' ? '거절' : `라운드 ${renewalResult.currentRound}/3`}</span></div>{renewalResult.messages.map((item, index) => <p key={`${item.from}-${index}`} className="fm-text-md" style={{ color: item.from === 'team' ? 'var(--accent)' : 'var(--text-primary)', margin: '4px 0' }}><strong>{item.from === 'team' ? '구단:' : '선수:'}</strong> {item.text}</p>)}</div>}
            {(!renewalResult || (renewalResult.status !== 'accepted' && renewalResult.status !== 'rejected')) && <><div className="fm-mb-md"><label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>제안 연봉</label><input type="number" value={renewalOffer.salary} onChange={(event) => setRenewalOffer((current) => ({ ...current, salary: Number(event.target.value) }))} className="fm-input" style={{ width: '100%' }} min={100} step={100} /></div><div className="fm-mb-md"><label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>계약 기간</label><div className="fm-flex fm-gap-sm">{[1, 2, 3].map((years) => <button key={years} className={`fm-btn fm-btn--sm ${renewalOffer.years === years ? 'fm-btn--primary' : ''}`} onClick={() => setRenewalOffer((current) => ({ ...current, years }))}>{years}년</button>)}</div></div><div className="fm-mb-md"><label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>사인 보너스</label><input type="number" value={renewalOffer.bonus} onChange={(event) => setRenewalOffer((current) => ({ ...current, bonus: Number(event.target.value) }))} className="fm-input" style={{ width: '100%' }} min={0} step={100} /></div></>}
          </div>
          <div className="fm-modal__footer"><button className="fm-btn" onClick={() => { setRenewalTarget(null); setRenewalResult(null); }}>닫기</button>{(!renewalResult || renewalResult.status !== 'accepted') && <button className="fm-btn fm-btn--primary" onClick={() => void submitRenewal()}>제안하기</button>}</div>
        </div>
      </div>}
    </div>
  );
}
