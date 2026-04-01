import { useCallback, useEffect, useMemo, useState } from 'react';
import { Skeleton, SkeletonTable } from '../../../components/Skeleton';
import { getFreeAgents, getPlayersByTeamId, getTeamRecentWinRate, getTeamTotalSalary, type TransferOffer } from '../../../db/queries';
import { aiPlayerRespondToOffer, calculateRenewalOffer, createNegotiation, evaluatePlayerDemand, finalizeNegotiation, generateDecisionFactors, getTeamNegotiations } from '../../../engine/economy/contractEngine';
import { acceptFreeAgentOffer, calculateFairSalary, calculatePlayerValue, cancelTransferOffer, getTeamTransferOffers, offerFreeAgent } from '../../../engine/economy/transferEngine';
import { useGameStore } from '../../../stores/gameStore';
import type { ContractNegotiation } from '../../../types/contract';
import type { Player } from '../../../types/player';
import { POSITION_LABELS_SHORT as POSITION_LABELS } from '../../../utils/constants';
import { formatAmount } from '../../../utils/formatUtils';
import { generateAgentNegotiation, type AgentNegotiationDialogue } from '../../../ai/advancedAiService';

type Tab = 'freeAgents' | 'myOffers' | 'renewal';
const POS_CLASS: Record<string, string> = { top: 'fm-pos-badge--top', jungle: 'fm-pos-badge--jgl', mid: 'fm-pos-badge--mid', adc: 'fm-pos-badge--adc', support: 'fm-pos-badge--sup' };
const POSITIONS = ['all', 'top', 'jungle', 'mid', 'adc', 'support'] as const;

const ovr = (p: Player) => Math.round((p.stats.mechanical + p.stats.gameSense + p.stats.teamwork + p.stats.consistency + p.stats.laning + p.stats.aggression) / 6);
const ovrClass = (n: number) => (n >= 85 ? 'fm-ovr fm-ovr--elite' : n >= 75 ? 'fm-ovr fm-ovr--high' : n >= 65 ? 'fm-ovr fm-ovr--mid' : 'fm-ovr fm-ovr--low');
const toneLabel = (tone: AgentNegotiationDialogue['tone']) => tone === 'aggressive' ? '강경' : tone === 'firm' ? '단호' : tone === 'pleading' ? '유연' : '우호';
const toneBadge = (tone: AgentNegotiationDialogue['tone']) => tone === 'aggressive' ? 'fm-badge--danger' : tone === 'firm' ? 'fm-badge--warning' : tone === 'pleading' ? 'fm-badge--info' : 'fm-badge--success';

export function TransferView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);
  const userTeam = teams.find((t) => t.id === save?.userTeamId);

  const [tab, setTab] = useState<Tab>('freeAgents');
  const [freeAgents, setFreeAgents] = useState<Player[]>([]);
  const [sentOffers, setSentOffers] = useState<TransferOffer[]>([]);
  const [receivedOffers, setReceivedOffers] = useState<TransferOffer[]>([]);
  const [teamBudget, setTeamBudget] = useState(0);
  const [teamSalary, setTeamSalary] = useState(0);
  const [rosterPlayers, setRosterPlayers] = useState<Player[]>([]);
  const [activeNegotiations, setActiveNegotiations] = useState<ContractNegotiation[]>([]);
  const [teamWinRate, setTeamWinRate] = useState(0.5);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [posFilter, setPosFilter] = useState<string>('all');

  const [offerModal, setOfferModal] = useState<Player | null>(null);
  const [offerSalary, setOfferSalary] = useState(0);
  const [offerYears, setOfferYears] = useState(2);
  const [offerError, setOfferError] = useState<string | null>(null);

  const [negotiationPlayer, setNegotiationPlayer] = useState<Player | null>(null);
  const [negotiationRound, setNegotiationRound] = useState(1);
  const [negotiationDialogue, setNegotiationDialogue] = useState<AgentNegotiationDialogue | null>(null);
  const [negotiationLoading, setNegotiationLoading] = useState(false);
  const [negotiationSalary, setNegotiationSalary] = useState(0);
  const [negotiationYears, setNegotiationYears] = useState(2);

  const [renewalTarget, setRenewalTarget] = useState<Player | null>(null);
  const [renewalSalary, setRenewalSalary] = useState(0);
  const [renewalYears, setRenewalYears] = useState(1);
  const [renewalBonus, setRenewalBonus] = useState(0);
  const [renewalResult, setRenewalResult] = useState<ContractNegotiation | null>(null);

  const loadData = useCallback(async () => {
    if (!season || !save) return;
    setIsLoading(true); setMessage(null);
    try {
      const [agents, salary, offers, roster, negotiations, winRate] = await Promise.all([
        getFreeAgents(), getTeamTotalSalary(save.userTeamId), getTeamTransferOffers(season.id, save.userTeamId),
        getPlayersByTeamId(save.userTeamId), getTeamNegotiations(save.userTeamId, season.id), getTeamRecentWinRate(save.userTeamId, season.id),
      ]);
      setFreeAgents(agents); setTeamSalary(salary); setSentOffers(offers.sent); setReceivedOffers(offers.received);
      setTeamBudget(userTeam?.budget ?? 0); setRosterPlayers(roster); setActiveNegotiations(negotiations); setTeamWinRate(winRate);
    } catch (error) {
      console.error('이적 시장 데이터 로딩 실패:', error);
      setMessage({ text: '이적 시장 데이터를 불러오는 중 오류가 발생했습니다.', type: 'error' });
    } finally { setIsLoading(false); }
  }, [save, season, userTeam]);

  useEffect(() => { void loadData(); }, [loadData]);

  const filteredAgents = useMemo(() => posFilter === 'all' ? freeAgents : freeAgents.filter((p) => p.position === posFilter), [freeAgents, posFilter]);
  const teamName = (teamId: string | null) => !teamId ? '자유계약' : teams.find((t) => t.id === teamId)?.shortName ?? teamId;
  const playerName = (playerId: string) => teams.flatMap((t) => t.roster ?? []).find((p) => p.id === playerId)?.name ?? freeAgents.find((p) => p.id === playerId)?.name ?? playerId;

  const startNegotiation = (player: Player) => {
    const fair = calculateFairSalary(player);
    setNegotiationPlayer(player); setNegotiationRound(1); setNegotiationDialogue(null); setNegotiationSalary(fair); setNegotiationYears(2); setMessage(null);
    void runNegotiationRound(player, fair, 2, 1);
  };

  const runNegotiationRound = async (player: Player, salary: number, years: number, round: number) => {
    setNegotiationLoading(true);
    try {
      const currentOvr = ovr(player);
      const personality: 'aggressive' | 'reasonable' | 'pushover' = currentOvr >= 80 ? 'aggressive' : currentOvr >= 60 ? 'reasonable' : 'pushover';
      const result = await generateAgentNegotiation({ playerName: player.name, playerAge: player.age, playerOvr: currentOvr, currentSalary: player.contract?.salary ?? 0, offeredSalary: salary, offeredYears: years, marketValue: calculateFairSalary(player), agentPersonality: personality, negotiationRound: round });
      setNegotiationDialogue(result);
      if (result.counterOffer?.salary) setNegotiationSalary(result.counterOffer.salary);
      if (result.counterOffer?.years) setNegotiationYears(result.counterOffer.years);
    } catch {
      setNegotiationDialogue({ agentMessage: '통신 오류로 에이전트와 연결할 수 없습니다.', tone: 'firm', willingness: 50 });
    } finally { setNegotiationLoading(false); }
  };

  const submitOffer = async () => {
    if (!offerModal || !season || !save) return;
    setOfferError(null);
    try {
      const result = await offerFreeAgent({ seasonId: season.id, fromTeamId: save.userTeamId, playerId: offerModal.id, offeredSalary: offerSalary, contractYears: offerYears, offerDate: season.currentDate });
      if (result.success && result.offerId) {
        const offer: TransferOffer = { id: result.offerId, seasonId: season.id, fromTeamId: save.userTeamId, toTeamId: null, playerId: offerModal.id, transferFee: 0, offeredSalary: offerSalary, contractYears: offerYears, status: 'pending', offerDate: season.currentDate };
        await acceptFreeAgentOffer(offer, season.id, season.currentDate);
        setMessage({ text: `${offerModal.name} 영입을 완료했습니다.`, type: 'success' }); setOfferModal(null); await loadData();
      } else setOfferError(result.reason ?? '제안에 실패했습니다.');
    } catch (error) {
      console.error('영입 제안 실패:', error); setOfferError('영입 제안 중 오류가 발생했습니다.');
    }
  };

  const submitRenewal = async () => {
    if (!renewalTarget || !season || !save || !userTeam) return;
    try {
      const negotiation = await createNegotiation({ seasonId: season.id, playerId: renewalTarget.id, teamId: save.userTeamId, initiator: 'team_to_player', teamSalary: renewalSalary, teamYears: renewalYears, teamSigningBonus: renewalBonus, factors: generateDecisionFactors(renewalTarget) });
      const avg = rosterPlayers.length > 0 ? rosterPlayers.reduce((sum, p) => sum + ovr(p), 0) / rosterPlayers.length : 60;
      const posComp = rosterPlayers.filter((p) => p.position === renewalTarget.position && p.id !== renewalTarget.id).reduce((max, p) => Math.max(max, ovr(p)), 0);
      const result = await aiPlayerRespondToOffer(negotiation, renewalTarget, { reputation: userTeam.reputation ?? 50, recentWinRate: teamWinRate, rosterStrength: avg, positionCompetitorOvr: posComp });
      setRenewalResult(result);
      if (result.status === 'accepted') {
        const finalResult = await finalizeNegotiation(result, season.id);
        setMessage({ text: finalResult.reason, type: finalResult.success ? 'success' : 'error' });
        if (finalResult.success) await loadData();
      }
    } catch (error) { console.error('재계약 제안 실패:', error); setMessage({ text: '재계약 제안 중 오류가 발생했습니다.', type: 'error' }); }
  };

  const respondRenewal = async () => {
    if (!renewalResult || !renewalTarget || !season || !save || !userTeam) return;
    try {
      const { respondToNegotiation } = await import('../../../engine/economy/contractEngine');
      const updated = await respondToNegotiation(renewalResult.id, 'counter', { salary: renewalSalary, years: renewalYears, signingBonus: renewalBonus }, `연봉 ${renewalSalary.toLocaleString()}만 원, ${renewalYears}년 조건으로 재제안합니다.`);
      const avg = rosterPlayers.length > 0 ? rosterPlayers.reduce((sum, p) => sum + ovr(p), 0) / rosterPlayers.length : 60;
      const posComp = rosterPlayers.filter((p) => p.position === renewalTarget.position && p.id !== renewalTarget.id).reduce((max, p) => Math.max(max, ovr(p)), 0);
      const result = await aiPlayerRespondToOffer(updated, renewalTarget, { reputation: userTeam.reputation ?? 50, recentWinRate: teamWinRate, rosterStrength: avg, positionCompetitorOvr: posComp });
      setRenewalResult(result);
      if (result.status === 'accepted') {
        const finalResult = await finalizeNegotiation(result, season.id);
        setMessage({ text: finalResult.reason, type: finalResult.success ? 'success' : 'error' });
        if (finalResult.success) await loadData();
      }
    } catch (error) { console.error('재계약 재제안 실패:', error); setMessage({ text: '재제안 중 오류가 발생했습니다.', type: 'error' }); }
  };

  if (!season || !save) return <p className="fm-text-muted">데이터를 불러오는 중입니다...</p>;
  if (isLoading) return <div><Skeleton width="180px" height="28px" variant="text" /><div className="fm-mt-md fm-mb-md"><Skeleton width="100%" height="48px" variant="rect" /></div><SkeletonTable rows={8} cols={7} /></div>;

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header"><h1 className="fm-page-title">이적 시장</h1></div>
      <div className="fm-panel fm-mb-md"><div className="fm-panel__body--compact fm-flex fm-gap-lg fm-flex-wrap fm-text-md">
        <span className="fm-text-secondary">예산: <strong className="fm-text-accent">{formatAmount(teamBudget)}</strong></span>
        <span className="fm-text-secondary">총 연봉: <strong className="fm-text-primary">{formatAmount(teamSalary)}</strong></span>
        <span className="fm-text-secondary">연봉 상한 참고: <strong className="fm-text-muted">{formatAmount(400000)}</strong></span>
      </div></div>
      {message && <div className={`fm-alert ${message.type === 'success' ? 'fm-alert--success' : 'fm-alert--danger'} fm-mb-md`}><span className="fm-alert__text">{message.text}</span></div>}
      <div className="fm-tabs">
        <button className={`fm-tab ${tab === 'freeAgents' ? 'fm-tab--active' : ''}`} onClick={() => setTab('freeAgents')}>자유계약 선수</button>
        <button className={`fm-tab ${tab === 'myOffers' ? 'fm-tab--active' : ''}`} onClick={() => setTab('myOffers')}>제안 이력 ({sentOffers.filter((o) => o.status === 'pending').length})</button>
        <button className={`fm-tab ${tab === 'renewal' ? 'fm-tab--active' : ''}`} onClick={() => setTab('renewal')}>재계약</button>
      </div>
      {tab === 'freeAgents' && (
        <div>
          <div className="fm-flex fm-gap-xs fm-mb-md fm-flex-wrap">
            {POSITIONS.map((position) => <button key={position} className={`fm-btn fm-btn--sm ${posFilter === position ? 'fm-btn--primary' : ''}`} onClick={() => setPosFilter(position)}>{position === 'all' ? '전체' : POSITION_LABELS[position]}</button>)}
          </div>
          {filteredAgents.length === 0 ? <p className="fm-text-muted fm-text-md">현재 영입 가능한 자유계약 선수가 없습니다.</p> : (
            <div className="fm-panel"><div className="fm-panel__body--flush fm-table-wrap"><table className="fm-table fm-table--striped"><thead><tr><th>포지션</th><th>이름</th><th>나이</th><th>OVR</th><th>포텐셜</th><th>시장 가치</th><th>적정 연봉</th><th></th></tr></thead><tbody>
              {filteredAgents.sort((a, b) => ovr(b) - ovr(a)).map((player) => {
                const hasPending = sentOffers.some((offer) => offer.playerId === player.id && offer.status === 'pending');
                return <tr key={player.id}><td><span className={`fm-pos-badge ${POS_CLASS[player.position] ?? ''}`}>{POSITION_LABELS[player.position] ?? player.position}</span></td><td className="fm-cell--name">{player.name}</td><td>{player.age}</td><td><span className={ovrClass(ovr(player))}>{ovr(player)}</span></td><td>{player.potential}</td><td>{formatAmount(calculatePlayerValue(player))}</td><td>{formatAmount(calculateFairSalary(player))}/년</td><td><div className="fm-flex fm-gap-xs"><button className="fm-btn fm-btn--primary fm-btn--sm" disabled={hasPending} onClick={() => { setOfferSalary(calculateFairSalary(player)); setOfferYears(2); setOfferModal(player); setOfferError(null); }}>{hasPending ? '제안 중' : '영입'}</button>{!hasPending && <button className="fm-btn fm-btn--sm" onClick={() => startNegotiation(player)}>협상</button>}</div></td></tr>;
              })}
            </tbody></table></div></div>
          )}
        </div>
      )}
      {tab === 'myOffers' && (
        <div className="fm-flex-col fm-gap-lg">
          <div><h2 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-md">보낸 제안</h2>{sentOffers.length === 0 ? <p className="fm-text-muted fm-text-md">보낸 제안이 없습니다.</p> : (
            <div className="fm-panel"><div className="fm-panel__body--flush fm-table-wrap"><table className="fm-table fm-table--striped"><thead><tr><th>선수</th><th>대상 팀</th><th>이적료</th><th>제안 연봉</th><th>계약 기간</th><th>상태</th><th></th></tr></thead><tbody>
              {sentOffers.map((offer) => <tr key={offer.id}><td className="fm-cell--name">{playerName(offer.playerId)}</td><td>{teamName(offer.toTeamId)}</td><td>{offer.transferFee > 0 ? formatAmount(offer.transferFee) : '-'}</td><td>{formatAmount(offer.offeredSalary)}/년</td><td>{offer.contractYears}년</td><td><span className={`fm-badge ${offer.status === 'accepted' ? 'fm-badge--success' : offer.status === 'rejected' ? 'fm-badge--danger' : offer.status === 'cancelled' ? 'fm-badge--default' : 'fm-badge--warning'}`}>{offer.status === 'pending' ? '대기 중' : offer.status === 'accepted' ? '수락' : offer.status === 'rejected' ? '거절' : '취소'}</span></td><td>{offer.status === 'pending' && <button className="fm-btn fm-btn--sm fm-btn--ghost" onClick={async () => { if (!season) return; try { await cancelTransferOffer(offer.id, season.currentDate); await loadData(); setMessage({ text: '제안을 취소했습니다.', type: 'success' }); } catch (error) { console.error('제안 취소 실패:', error); setMessage({ text: '제안 취소 중 오류가 발생했습니다.', type: 'error' }); } }}>취소</button>}</td></tr>)}
            </tbody></table></div></div>)}</div>
          {receivedOffers.length > 0 && <div><h2 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-md">받은 제안</h2><div className="fm-panel"><div className="fm-panel__body--flush fm-table-wrap"><table className="fm-table fm-table--striped"><thead><tr><th>선수</th><th>제안 팀</th><th>이적료</th><th>상태</th></tr></thead><tbody>{receivedOffers.map((offer) => <tr key={offer.id}><td className="fm-cell--name">{playerName(offer.playerId)}</td><td>{teamName(offer.fromTeamId)}</td><td>{formatAmount(offer.transferFee)}</td><td><span className={`fm-badge ${offer.status === 'accepted' ? 'fm-badge--success' : offer.status === 'rejected' ? 'fm-badge--danger' : 'fm-badge--warning'}`}>{offer.status === 'pending' ? '대기 중' : offer.status === 'accepted' ? '수락' : offer.status === 'rejected' ? '거절' : '취소'}</span></td></tr>)}</tbody></table></div></div></div>}
        </div>
      )}
      {tab === 'renewal' && (
        <div className="fm-flex-col fm-gap-lg">
          <div><h2 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-md">소속 선수 재계약</h2>{rosterPlayers.length === 0 ? <p className="fm-text-muted fm-text-md">현재 로스터에 선수가 없습니다.</p> : (
            <div className="fm-panel"><div className="fm-panel__body--flush fm-table-wrap"><table className="fm-table fm-table--striped"><thead><tr><th>포지션</th><th>이름</th><th>나이</th><th>OVR</th><th>현재 연봉</th><th>계약 만료</th><th>적정 연봉</th><th></th></tr></thead><tbody>
              {rosterPlayers.sort((a, b) => a.contract.contractEndSeason - b.contract.contractEndSeason).map((player) => {
                const isExpiring = player.contract.contractEndSeason <= season.id + 1;
                const hasActive = activeNegotiations.some((neg) => neg.playerId === player.id && (neg.status === 'in_progress' || neg.status === 'pending'));
                return <tr key={player.id} style={isExpiring ? { background: 'var(--danger-dim)' } : undefined}><td><span className={`fm-pos-badge ${POS_CLASS[player.position] ?? ''}`}>{POSITION_LABELS[player.position] ?? player.position}</span></td><td className="fm-cell--name">{player.name}{isExpiring && <span className="fm-badge fm-badge--danger" style={{ marginLeft: 6 }}>만료 임박</span>}</td><td>{player.age}</td><td><span className={ovrClass(ovr(player))}>{ovr(player)}</span></td><td>{formatAmount(player.contract.salary)}/년</td><td>시즌 {player.contract.contractEndSeason}</td><td>{formatAmount(calculateFairSalary(player))}/년</td><td><button className="fm-btn fm-btn--primary fm-btn--sm" disabled={hasActive} onClick={() => { const offer = calculateRenewalOffer(player); setRenewalTarget(player); setRenewalSalary(offer.suggestedSalary); setRenewalYears(offer.suggestedYears); setRenewalBonus(0); setRenewalResult(null); }}>{hasActive ? '협상 중' : '재계약'}</button></td></tr>;
              })}
            </tbody></table></div></div>)}</div>
          {activeNegotiations.length > 0 && <div><h2 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-md">협상 이력</h2><div className="fm-flex-col fm-gap-sm">{activeNegotiations.map((neg) => { const last = neg.messages[neg.messages.length - 1]; return <div key={neg.id} className="fm-card"><div className="fm-flex fm-justify-between fm-mb-sm"><span className="fm-font-semibold fm-text-primary">{rosterPlayers.find((p) => p.id === neg.playerId)?.name ?? neg.playerId}</span><span className={`fm-badge ${neg.status === 'accepted' ? 'fm-badge--success' : neg.status === 'rejected' ? 'fm-badge--danger' : 'fm-badge--warning'}`}>{neg.status === 'accepted' ? '합의' : neg.status === 'rejected' ? '결렬' : `${neg.currentRound}/3 라운드`}</span></div>{last && <p className="fm-text-xs fm-text-secondary" style={{ margin: 0 }}>{last.text}</p>}</div>; })}</div></div>}
        </div>
      )}
      {renewalTarget && (
        <div className="fm-overlay" role="dialog" aria-modal="true" aria-label="재계약 제안" onClick={() => { setRenewalTarget(null); setRenewalResult(null); }}>
          <div className="fm-modal" style={{ width: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="fm-modal__header"><h2 className="fm-modal__title">재계약 제안</h2><button className="fm-modal__close" onClick={() => { setRenewalTarget(null); setRenewalResult(null); }}>&times;</button></div>
            <div className="fm-modal__body">
              <div className="fm-flex fm-items-center fm-gap-sm fm-p-sm fm-mb-md" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}><span className={`fm-pos-badge ${POS_CLASS[renewalTarget.position] ?? ''}`}>{POSITION_LABELS[renewalTarget.position]}</span><span className="fm-text-lg fm-font-semibold fm-text-primary">{renewalTarget.name}</span><span className="fm-text-md fm-text-secondary">{renewalTarget.age}세</span><span className="fm-font-bold fm-text-accent" style={{ marginLeft: 'auto' }}>OVR {ovr(renewalTarget)}</span></div>
              <div className="fm-flex fm-gap-md fm-mb-md fm-text-xs fm-text-secondary fm-flex-wrap"><span>현재 연봉: <strong className="fm-text-primary">{formatAmount(renewalTarget.contract.salary)}/년</strong></span><span>만료: <strong className="fm-text-primary">시즌 {renewalTarget.contract.contractEndSeason}</strong></span><span>적정 연봉: <strong className="fm-text-accent">{formatAmount(calculateFairSalary(renewalTarget))}/년</strong></span></div>
              {(() => { const factors = generateDecisionFactors(renewalTarget); const demand = evaluatePlayerDemand(renewalTarget); const keys = [...(['money', 'winning', 'playtime', 'loyalty', 'reputation'] as const)]; const top = keys.sort((a, b) => factors[b] - factors[a])[0]; const labels: Record<string, string> = { money: '연봉', winning: '팀 성적', playtime: '출전 기회', loyalty: '충성도', reputation: '팀 명성' }; return <div className="fm-alert fm-alert--info fm-mb-md"><span className="fm-alert__text"><span className="fm-font-semibold fm-text-accent">선수 성향:</span> {labels[top]} 중심 | 희망 연봉 {formatAmount(demand.idealSalary)}/년, 최소 {formatAmount(demand.minSalary)}/년</span></div>; })()}
              {renewalResult && <div className="fm-card fm-mb-md" style={{ borderColor: renewalResult.status === 'accepted' ? 'var(--success)' : renewalResult.status === 'rejected' ? 'var(--danger)' : 'var(--warning)' }}><div className="fm-flex fm-justify-between fm-mb-sm"><span className={`fm-badge ${renewalResult.status === 'accepted' ? 'fm-badge--success' : renewalResult.status === 'rejected' ? 'fm-badge--danger' : 'fm-badge--warning'}`}>{renewalResult.status === 'accepted' ? '수락' : renewalResult.status === 'rejected' ? '거절' : `라운드 ${renewalResult.currentRound}/3`}</span></div>{renewalResult.messages.map((m, i) => <p key={`${m.from}-${i}`} className="fm-text-md" style={{ color: m.from === 'team' ? 'var(--accent)' : 'var(--text-primary)', margin: '4px 0' }}><strong>{m.from === 'team' ? '팀:' : '선수:'}</strong> {m.text}</p>)}{renewalResult.playerSalary && renewalResult.status !== 'accepted' && renewalResult.status !== 'rejected' && <div className="fm-flex fm-gap-sm fm-flex-wrap fm-mt-sm fm-p-sm fm-text-xs fm-text-accent" style={{ background: 'var(--accent-dim)', borderRadius: 'var(--radius-md)' }}><span className="fm-font-semibold">선수 역제안</span><span>연봉 {formatAmount(renewalResult.playerSalary)}/년</span>{renewalResult.playerYears && <span>{renewalResult.playerYears}년</span>}</div>}</div>}
              {(!renewalResult || (renewalResult.status !== 'accepted' && renewalResult.status !== 'rejected')) && <><div className="fm-mb-md"><label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>제안 연봉 (만 원/년)</label><input type="number" value={renewalSalary} onChange={(e) => setRenewalSalary(Number(e.target.value))} className="fm-input" style={{ width: '100%' }} min={100} step={100} /></div><div className="fm-mb-md"><label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>계약 기간</label><div className="fm-flex fm-gap-sm">{[1, 2, 3].map((y) => <button key={y} className={`fm-btn fm-btn--sm ${renewalYears === y ? 'fm-btn--primary' : ''}`} onClick={() => setRenewalYears(y)}>{y}년</button>)}</div></div><div className="fm-mb-md"><label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>계약 보너스 (만 원, 선택)</label><input type="number" value={renewalBonus} onChange={(e) => setRenewalBonus(Number(e.target.value))} className="fm-input" style={{ width: '100%' }} min={0} step={100} /></div></>}
            </div>
            <div className="fm-modal__footer"><button className="fm-btn" onClick={() => { setRenewalTarget(null); setRenewalResult(null); }}>{renewalResult?.status === 'accepted' || renewalResult?.status === 'rejected' ? '닫기' : '취소'}</button>{!renewalResult && <button className="fm-btn fm-btn--primary" onClick={() => void submitRenewal()}>제안하기</button>}{renewalResult && renewalResult.status !== 'accepted' && renewalResult.status !== 'rejected' && <button className="fm-btn fm-btn--primary" onClick={() => void respondRenewal()}>재제안</button>}</div>
          </div>
        </div>
      )}
      {offerModal && (
        <div className="fm-overlay" role="dialog" aria-modal="true" aria-label="영입 제안" onClick={() => { setOfferModal(null); setOfferError(null); }}>
          <div className="fm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fm-modal__header"><h2 className="fm-modal__title">영입 제안</h2><button className="fm-modal__close" onClick={() => { setOfferModal(null); setOfferError(null); }}>&times;</button></div>
            <div className="fm-modal__body">
              <div className="fm-flex fm-items-center fm-gap-sm fm-p-sm fm-mb-md" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}><span className={`fm-pos-badge ${POS_CLASS[offerModal.position] ?? ''}`}>{POSITION_LABELS[offerModal.position]}</span><span className="fm-text-lg fm-font-semibold fm-text-primary">{offerModal.name}</span><span className="fm-text-md fm-text-secondary">{offerModal.age}세</span><span className="fm-font-bold fm-text-accent" style={{ marginLeft: 'auto' }}>OVR {ovr(offerModal)}</span></div>
              <div className="fm-mb-md"><label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>연봉 (만 원/년)</label><input type="number" value={offerSalary} onChange={(e) => setOfferSalary(Number(e.target.value))} className="fm-input" style={{ width: '100%' }} min={100} step={100} /><span className="fm-text-xs fm-text-muted fm-mt-sm" style={{ display: 'block' }}>적정 연봉: {formatAmount(calculateFairSalary(offerModal))}</span></div>
              <div className="fm-mb-md"><label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>계약 기간</label><div className="fm-flex fm-gap-sm">{[1, 2, 3].map((y) => <button key={y} className={`fm-btn fm-btn--sm ${offerYears === y ? 'fm-btn--primary' : ''}`} onClick={() => setOfferYears(y)}>{y}년</button>)}</div></div>
            </div>
            {offerError && <div className="fm-alert fm-alert--danger fm-mx-md fm-mb-sm"><span className="fm-alert__text">{offerError}</span></div>}
            <div className="fm-modal__footer"><button className="fm-btn" onClick={() => { setOfferModal(null); setOfferError(null); }}>취소</button><button className="fm-btn fm-btn--primary" onClick={() => void submitOffer()}>제안하기</button></div>
          </div>
        </div>
      )}
      {negotiationPlayer && (
        <div className="fm-overlay" role="dialog" aria-modal="true" aria-label="에이전트 협상" onClick={() => { setNegotiationPlayer(null); setNegotiationDialogue(null); setNegotiationRound(1); }}>
          <div className="fm-modal" style={{ width: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="fm-modal__header"><h2 className="fm-modal__title">에이전트 협상</h2><button className="fm-modal__close" onClick={() => { setNegotiationPlayer(null); setNegotiationDialogue(null); setNegotiationRound(1); }}>&times;</button></div>
            <div className="fm-modal__body">
              <div className="fm-flex fm-items-center fm-gap-sm fm-p-sm fm-mb-md" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}><span className={`fm-pos-badge ${POS_CLASS[negotiationPlayer.position] ?? ''}`}>{POSITION_LABELS[negotiationPlayer.position]}</span><span className="fm-text-lg fm-font-semibold fm-text-primary">{negotiationPlayer.name}</span><span className="fm-text-md fm-text-secondary">{negotiationPlayer.age}세</span><span className="fm-font-bold fm-text-accent" style={{ marginLeft: 'auto' }}>OVR {ovr(negotiationPlayer)}</span></div>
              <div className="fm-flex fm-items-center fm-gap-sm fm-mb-md">{[1, 2, 3].map((r) => <div key={r} className="fm-flex fm-items-center fm-justify-center fm-text-xs fm-font-bold" style={{ width: 28, height: 28, borderRadius: '50%', background: r <= negotiationRound ? 'var(--accent)' : 'rgba(255,255,255,0.1)', color: '#fff' }}>{r}</div>)}<span className="fm-text-xs fm-text-muted" style={{ marginLeft: 'auto' }}>라운드 {negotiationRound}/3</span></div>
              {negotiationLoading ? <div className="fm-card fm-mb-md"><p className="fm-text-md fm-text-muted fm-text-center" style={{ margin: 0 }}>에이전트가 검토 중입니다...</p></div> : negotiationDialogue ? <div className="fm-card fm-mb-md" style={{ borderColor: negotiationDialogue.tone === 'aggressive' ? 'var(--danger)' : negotiationDialogue.tone === 'firm' ? 'var(--warning)' : negotiationDialogue.tone === 'pleading' ? '#9b59b6' : 'var(--success)' }}><div className="fm-flex fm-items-center fm-justify-between fm-mb-sm"><span className={`fm-badge ${toneBadge(negotiationDialogue.tone)}`}>{toneLabel(negotiationDialogue.tone)}</span><span className="fm-text-xs fm-font-semibold fm-text-secondary">수락 의향: {negotiationDialogue.willingness}%</span></div><p className="fm-text-lg fm-text-primary" style={{ lineHeight: 1.6, margin: 0 }}>{negotiationDialogue.agentMessage}</p>{negotiationDialogue.counterOffer && <div className="fm-flex fm-gap-sm fm-flex-wrap fm-mt-sm fm-p-sm fm-text-xs fm-text-accent" style={{ background: 'var(--accent-dim)', borderRadius: 'var(--radius-md)' }}><span className="fm-font-semibold">에이전트 역제안</span>{negotiationDialogue.counterOffer.salary && <span>연봉 {formatAmount(negotiationDialogue.counterOffer.salary)}/년</span>}{negotiationDialogue.counterOffer.years && <span>{negotiationDialogue.counterOffer.years}년</span>}{negotiationDialogue.counterOffer.signingBonus && <span>보너스 {formatAmount(negotiationDialogue.counterOffer.signingBonus)}</span>}</div>}<div className="fm-bar fm-mt-sm"><div className="fm-bar__track"><div className={`fm-bar__fill ${negotiationDialogue.willingness >= 70 ? 'fm-bar__fill--green' : negotiationDialogue.willingness >= 40 ? 'fm-bar__fill--yellow' : 'fm-bar__fill--red'}`} style={{ width: `${negotiationDialogue.willingness}%` }} /></div></div></div> : null}
              <div className="fm-mb-md"><label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>제안 연봉 (만 원/년)</label><input type="number" value={negotiationSalary} onChange={(e) => setNegotiationSalary(Number(e.target.value))} className="fm-input" style={{ width: '100%' }} min={100} step={100} /></div>
              <div className="fm-mb-md"><label className="fm-text-xs fm-text-secondary fm-mb-sm" style={{ display: 'block' }}>계약 기간</label><div className="fm-flex fm-gap-sm">{[1, 2, 3].map((y) => <button key={y} className={`fm-btn fm-btn--sm ${negotiationYears === y ? 'fm-btn--primary' : ''}`} onClick={() => setNegotiationYears(y)}>{y}년</button>)}</div></div>
            </div>
            <div className="fm-modal__footer"><button className="fm-btn" onClick={() => { setNegotiationPlayer(null); setNegotiationDialogue(null); setNegotiationRound(1); }}>협상 종료</button>{negotiationRound < 3 && <button className="fm-btn" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }} onClick={() => { const next = negotiationRound + 1; if (!negotiationPlayer) return; setNegotiationRound(next); void runNegotiationRound(negotiationPlayer, negotiationSalary, negotiationYears, next); }} disabled={negotiationLoading}>다음 라운드</button>}{negotiationDialogue && negotiationDialogue.willingness >= 50 && <button className="fm-btn fm-btn--primary" onClick={() => { if (!negotiationPlayer) return; setOfferSalary(negotiationSalary); setOfferYears(negotiationYears); setOfferModal(negotiationPlayer); setNegotiationPlayer(null); setNegotiationDialogue(null); setNegotiationRound(1); }}>이 조건으로 영입</button>}</div>
          </div>
        </div>
      )}
    </div>
  );
}
