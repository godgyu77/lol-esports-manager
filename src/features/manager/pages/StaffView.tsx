import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  buildStaffCandidateView,
  calculateStaffBonuses,
  fireStaff,
  getFreeAgentStaff,
  getStaffFitSummary,
  getTeamStaff,
  hireStaffByOffer,
  TEAM_STAFF_LIMIT,
  type StaffBonuses,
} from '../../../engine/staff/staffEngine';
import { generateStaffReaction } from '../../../engine/social/socialEngine';
import { buildRelationshipNetworkReport, type RelationshipNetworkReport } from '../../../engine/manager/franchiseNarrativeEngine';
import type { StaffFitSummary } from '../../../types/systemDepth';
import type { Staff, StaffCandidateView, StaffRole } from '../../../types/staff';
import {
  COACHING_PHILOSOPHY_LABELS,
  STAFF_ROLE_EFFECTS,
  STAFF_ROLE_FLEXIBILITY_LABELS,
  STAFF_ROLE_LABELS,
  STAFF_SPECIALTY_LABELS,
} from '../../../types/staff';

type CandidateFilter = 'all' | 'coach' | 'former_head_coach' | 'specialist';

function getOfferedRole(staff: Staff): StaffRole {
  return staff.role === 'head_coach' ? 'coach' : staff.role;
}

function getAcceptanceTone(acceptance: StaffCandidateView['acceptance']): string {
  switch (acceptance) {
    case 'high':
      return 'fm-text-success';
    case 'medium':
      return 'fm-text-accent';
    case 'low':
      return 'fm-text-warning';
    default:
      return 'fm-text-danger';
  }
}

function getAcceptanceLabel(acceptance: StaffCandidateView['acceptance']): string {
  switch (acceptance) {
    case 'high':
      return '합류 가능성 높음';
    case 'medium':
      return '조건에 따라 협상 가능';
    case 'low':
      return '설득이 필요함';
    default:
      return '거절 가능성 높음';
  }
}

function buildBonusSourceLabel(staffList: Staff[], roles: StaffRole[]): string {
  const matching = staffList.filter((staff) => roles.includes(staff.role));
  if (matching.length === 0) {
    return '현재 적용 중인 전담 스태프 없음';
  }

  return matching
    .map((staff) => `${staff.name}(${STAFF_ROLE_LABELS[staff.role]})`)
    .join(', ');
}

function StaffCard({ staff, onFire }: { staff: Staff; onFire: (staff: Staff) => void }) {
  return (
    <div className="fm-card">
      <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
        <div className="fm-flex fm-items-center fm-gap-sm fm-flex-wrap">
          <span className="fm-badge fm-badge--accent">{STAFF_ROLE_LABELS[staff.role]}</span>
          <strong className="fm-text-primary">{staff.name}</strong>
          {staff.careerOrigin === 'head_coach' ? <span className="fm-badge fm-badge--warning">감독 출신</span> : null}
        </div>
        <span className="fm-badge fm-badge--default">능력 {staff.ability}</span>
      </div>
      <div className="fm-flex-col fm-gap-xs fm-text-base fm-text-secondary fm-mb-sm">
        <span>선호 역할: {STAFF_ROLE_LABELS[staff.preferredRole]}</span>
        <span>역할 유연성: {STAFF_ROLE_FLEXIBILITY_LABELS[staff.roleFlexibility]}</span>
        <span>전문 분야: {staff.specialty ? STAFF_SPECIALTY_LABELS[staff.specialty] : '범용'}</span>
        {staff.philosophy ? <span>코칭 철학: {COACHING_PHILOSOPHY_LABELS[staff.philosophy]}</span> : null}
        <span>연봉: {staff.salary.toLocaleString()}만</span>
      </div>
      <div className="fm-alert fm-alert--info fm-mb-sm">
        <span className="fm-alert__text">{STAFF_ROLE_EFFECTS[staff.role]}</span>
      </div>
      <button className="fm-btn fm-btn--sm" onClick={() => onFire(staff)}>방출</button>
    </div>
  );
}

export function StaffView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [bonuses, setBonuses] = useState<StaffBonuses | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showFAModal, setShowFAModal] = useState(false);
  const [faLoading, setFALoading] = useState(false);
  const [candidateFilter, setCandidateFilter] = useState<CandidateFilter>('all');
  const [candidateViews, setCandidateViews] = useState<StaffCandidateView[]>([]);
  const [fitSummary, setFitSummary] = useState<StaffFitSummary[]>([]);
  const [relationshipReport, setRelationshipReport] = useState<RelationshipNetworkReport | null>(null);

  const userTeamId = save?.userTeamId ?? '';
  const userTeam = teams.find((team) => team.id === userTeamId) ?? null;

  const loadData = useCallback(async () => {
    if (!save) return;

    setIsLoading(true);
    try {
      const [staff, bonus, fit] = await Promise.all([
        getTeamStaff(userTeamId),
        calculateStaffBonuses(userTeamId),
        getStaffFitSummary(userTeamId, save.id).catch(() => []),
      ]);
      setStaffList(staff);
      setBonuses(bonus);
      setFitSummary(fit);
      if (userTeam) {
        setRelationshipReport(await buildRelationshipNetworkReport({
          roster: userTeam.roster,
          staffList: staff,
          fitSummary: fit,
        }));
      } else {
        setRelationshipReport(null);
      }
    } catch (err) {
      console.error('failed to load staff page:', err);
      setMessage({ text: '스태프 정보를 불러오는 중 문제가 발생했습니다.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [save, userTeam, userTeamId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openFAModal = async () => {
    if (!save) return;

    setShowFAModal(true);
    setFALoading(true);
    try {
      const freeAgents = await getFreeAgentStaff();
      const views = await Promise.all(
        freeAgents.map((staff) => buildStaffCandidateView(userTeamId, save.id, staff, getOfferedRole(staff))),
      );
      setCandidateViews(views.sort((left, right) => right.score - left.score || right.staff.ability - left.staff.ability));
    } catch (err) {
      console.error('failed to load free agent staff:', err);
      setCandidateViews([]);
    } finally {
      setFALoading(false);
    }
  };

  const handleHireCandidate = async (candidate: StaffCandidateView) => {
    if (!season) return;

    if (candidate.decision === 'reject') {
      setMessage({
        text: `${candidate.staff.name} 영입 제안이 거절됐습니다. ${candidate.reasons[0] ?? ''}`.trim(),
        type: 'error',
      });
      return;
    }

    if (candidate.decision === 'hesitate') {
      const accepted = Math.random() < candidate.score / 100;
      if (!accepted) {
        setMessage({ text: `${candidate.staff.name} 측이 최종적으로 제안을 거절했습니다.`, type: 'error' });
        return;
      }
    }

    try {
      await hireStaffByOffer(candidate.staff.id, userTeamId, candidate.offeredRole, season.year + 2);
      const teamRows = await import('../../../db/database')
        .then((module) => module.getDatabase())
        .then((db) => db.select<{ name: string }[]>('SELECT name FROM teams WHERE id = $1', [userTeamId]));
      const teamName = teamRows[0]?.name ?? userTeamId;
      await generateStaffReaction(season.year, season.currentDate, candidate.staff.name, teamName, true);

      setMessage({
        text: `${candidate.staff.name} 영입이 완료됐습니다. 역할: ${STAFF_ROLE_LABELS[candidate.offeredRole]}`,
        type: 'success',
      });
      setShowFAModal(false);
      await loadData();
    } catch (err) {
      console.error('failed to hire candidate:', err);
      setMessage({ text: '스태프 영입 처리 중 문제가 발생했습니다.', type: 'error' });
    }
  };

  const handleFire = async (staff: Staff) => {
    try {
      await fireStaff(staff.id);
      if (season) {
        const teamRows = await import('../../../db/database')
          .then((module) => module.getDatabase())
          .then((db) => db.select<{ name: string }[]>('SELECT name FROM teams WHERE id = $1', [userTeamId]));
        const teamName = teamRows[0]?.name ?? userTeamId;
        await generateStaffReaction(season.year, season.currentDate, staff.name, teamName, false);
      }
      setMessage({ text: `${staff.name} 방출을 완료했습니다.`, type: 'success' });
      await loadData();
    } catch (err) {
      console.error('failed to fire staff:', err);
      setMessage({ text: '스태프 방출 처리에 실패했습니다.', type: 'error' });
    }
  };

  const filteredCandidates = useMemo(() => {
    if (candidateFilter === 'all') return candidateViews;
    return candidateViews.filter((candidate) => candidate.marketCategory === candidateFilter);
  }, [candidateFilter, candidateViews]);

  const headCoach = staffList.find((staff) => staff.role === 'head_coach') ?? null;
  const currentCoaches = staffList.filter((staff) => staff.role === 'coach');
  const currentSpecialists = staffList.filter((staff) => staff.role !== 'coach' && staff.role !== 'head_coach');
  const totalSalary = staffList.reduce((sum, staff) => sum + staff.salary, 0);

  const bonusSummaries = bonuses ? [
    {
      label: '훈련 효율',
      value: `x${bonuses.trainingEfficiency.toFixed(2)}`,
      source: buildBonusSourceLabel(staffList, ['coach', 'head_coach']),
    },
    {
      label: '사기 보정',
      value: `+${bonuses.moraleBoost}`,
      source: buildBonusSourceLabel(staffList, ['sports_psychologist', 'head_coach']),
    },
    {
      label: '밴픽 정확도',
      value: `+${bonuses.draftAccuracy}`,
      source: buildBonusSourceLabel(staffList, ['analyst', 'data_analyst']),
    },
    {
      label: '스카우팅 정확도',
      value: `+${bonuses.scoutingAccuracyBonus}`,
      source: buildBonusSourceLabel(staffList, ['scout_manager', 'analyst', 'data_analyst']),
    },
  ] : [];

  if (!save || !season) return <p className="fm-text-muted fm-text-md">데이터를 불러오는 중입니다...</p>;
  if (isLoading) return <p className="fm-text-muted fm-text-md">스태프 정보를 정리하는 중입니다...</p>;

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">스태프 관리</h1>
      </div>

      {message && (
        <div className={`fm-alert ${message.type === 'success' ? 'fm-alert--success' : 'fm-alert--danger'} fm-mb-md`}>
          <span className="fm-alert__text">{message.text}</span>
        </div>
      )}

      <div className="fm-alert fm-alert--info fm-mb-md">
        <span className="fm-alert__text">현재 감독은 당신입니다. 이 화면에서는 코치진과 지원 스태프만 영입하거나 정리할 수 있습니다.</span>
      </div>

      <div className="fm-grid fm-grid--2 fm-mb-md">
        <div className="fm-card">
          <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
            <strong className="fm-text-primary">감독 역할</strong>
            <span className={`fm-badge ${headCoach ? 'fm-badge--warning' : 'fm-badge--accent'}`}>
              {headCoach ? '전담 헤드 코치 있음' : '매니저 겸임'}
            </span>
          </div>
          {headCoach ? (
            <p className="fm-text-secondary" style={{ margin: 0 }}>
              현재 팀에는 헤드 코치 {headCoach.name}이(가) 등록되어 있습니다. 코치진과 별도로 전체 방향성과 사기 관리에 영향을 줍니다.
            </p>
          ) : (
            <p className="fm-text-secondary" style={{ margin: 0 }}>
              이 세이브는 매니저가 감독 역할을 직접 수행하는 구조입니다. 그래서 유저 팀은 헤드 코치가 비어 있어도 정상이며,
              현재 보이는 코치와 전문 스태프만 실제 보너스 계산에 반영됩니다.
            </p>
          )}
        </div>
        <div className="fm-card">
          <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
            <strong className="fm-text-primary">현재 스태프 운영</strong>
            <span className={`fm-badge ${staffList.length >= TEAM_STAFF_LIMIT ? 'fm-badge--danger' : 'fm-badge--default'}`}>
              {staffList.length}/{TEAM_STAFF_LIMIT}
            </span>
          </div>
          <div className="fm-flex-col fm-gap-xs fm-text-secondary">
            <span>총 인건비: {totalSalary.toLocaleString()}만</span>
            <span>코치: {currentCoaches.length}명</span>
            <span>전문 스태프: {currentSpecialists.length}명</span>
            <span>헤드 코치: {headCoach ? '배치됨' : '매니저가 겸임 중'}</span>
          </div>
        </div>
      </div>

      {relationshipReport && (
        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__header">
            <span className="fm-panel__title">Relationship Network</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-card fm-card--highlight fm-mb-md">
              <div className="fm-flex-col fm-gap-xs">
                <strong className="fm-text-lg fm-text-primary">{relationshipReport.headline}</strong>
                <span className="fm-text-sm fm-text-secondary">{relationshipReport.summary}</span>
              </div>
            </div>
            <div className="fm-grid fm-grid--3">
              <div className="fm-card">
                <span className="fm-text-xs fm-font-semibold fm-text-accent">Strongest Link</span>
                <p className="fm-text-sm fm-text-secondary fm-mt-sm">{relationshipReport.strongLink}</p>
              </div>
              <div className="fm-card">
                <span className="fm-text-xs fm-font-semibold fm-text-accent">Watch Item</span>
                <p className="fm-text-sm fm-text-secondary fm-mt-sm">{relationshipReport.riskLink}</p>
              </div>
              <div className="fm-card">
                <span className="fm-text-xs fm-font-semibold fm-text-accent">Staff Room</span>
                <p className="fm-text-sm fm-text-secondary fm-mt-sm">{relationshipReport.staffPulse}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {fitSummary.length > 0 && (
        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__header">
            <span className="fm-panel__title">코치-감독 궁합과 역할 기대</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-grid fm-grid--2">
              {fitSummary.slice(0, 4).map((item) => (
                <div key={`${item.staffId}-${item.role}`} className="fm-card">
                  <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
                    <strong className="fm-text-primary">{item.name}</strong>
                    <span className={`fm-badge ${item.fitScore >= 75 ? 'fm-badge--success' : item.fitScore >= 50 ? 'fm-badge--warning' : 'fm-badge--danger'}`}>
                      {item.fitScore}
                    </span>
                  </div>
                  <p className="fm-text-secondary fm-mb-sm" style={{ marginTop: 0 }}>
                    현재 역할 {STAFF_ROLE_LABELS[item.role as StaffRole]} / 선호 역할 {STAFF_ROLE_LABELS[item.preferredRole as StaffRole]}
                  </p>
                  <p className="fm-text-xs fm-text-muted" style={{ margin: 0 }}>{item.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {bonuses && (
        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__header">
            <span className="fm-panel__title">스태프 보너스 요약</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-grid fm-grid--2">
              {bonusSummaries.map((summary) => (
                <div key={summary.label} className="fm-card">
                  <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
                    <strong className="fm-text-primary">{summary.label}</strong>
                    <span className="fm-badge fm-badge--accent">{summary.value}</span>
                  </div>
                  <p className="fm-text-secondary" style={{ margin: 0 }}>{summary.source}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="fm-flex fm-gap-sm fm-flex-wrap fm-mb-lg">
        <button className="fm-btn fm-btn--info" onClick={openFAModal}>FA 스태프 시장 보기</button>
      </div>

      <div className="fm-grid fm-grid--2 fm-mb-lg">
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">코치진</span>
          </div>
          <div className="fm-panel__body">
            {currentCoaches.length === 0 ? (
              <div className="fm-alert fm-alert--warning">
                <span className="fm-alert__text">전담 코치가 없습니다. 훈련 효율과 선수 성장 보정이 약해질 수 있습니다.</span>
              </div>
            ) : (
              <div className="fm-flex-col fm-gap-sm">
                {currentCoaches.map((staff) => <StaffCard key={staff.id} staff={staff} onFire={handleFire} />)}
              </div>
            )}
          </div>
        </div>

        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">전문 스태프</span>
          </div>
          <div className="fm-panel__body">
            {currentSpecialists.length === 0 ? (
              <div className="fm-alert fm-alert--info">
                <span className="fm-alert__text">분석, 심리, 피지컬, 영양 같은 보조 스태프가 아직 없습니다.</span>
              </div>
            ) : (
              <div className="fm-flex-col fm-gap-sm">
                {currentSpecialists.map((staff) => <StaffCard key={staff.id} staff={staff} onFire={handleFire} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      {showFAModal && (
        <div className="fm-overlay" onClick={() => setShowFAModal(false)}>
          <div className="fm-modal" style={{ width: '960px', maxWidth: '96vw' }} onClick={(event) => event.stopPropagation()}>
            <div className="fm-modal__header">
              <span className="fm-modal__title">FA 스태프 시장</span>
              <button className="fm-modal__close" onClick={() => setShowFAModal(false)}>&times;</button>
            </div>
            <div className="fm-modal__body">
              <div className="fm-flex fm-gap-xs fm-flex-wrap fm-mb-md">
                <button className={`fm-btn fm-btn--sm ${candidateFilter === 'all' ? 'fm-btn--primary' : ''}`} onClick={() => setCandidateFilter('all')}>전체</button>
                <button className={`fm-btn fm-btn--sm ${candidateFilter === 'coach' ? 'fm-btn--primary' : ''}`} onClick={() => setCandidateFilter('coach')}>코치 선호</button>
                <button className={`fm-btn fm-btn--sm ${candidateFilter === 'former_head_coach' ? 'fm-btn--primary' : ''}`} onClick={() => setCandidateFilter('former_head_coach')}>감독 출신</button>
                <button className={`fm-btn fm-btn--sm ${candidateFilter === 'specialist' ? 'fm-btn--primary' : ''}`} onClick={() => setCandidateFilter('specialist')}>전문 스태프</button>
              </div>

              {faLoading ? (
                <p className="fm-text-muted fm-p-md">후보를 정리하는 중입니다...</p>
              ) : filteredCandidates.length === 0 ? (
                <p className="fm-text-muted fm-p-md">조건에 맞는 후보가 없습니다.</p>
              ) : (
                <div className="fm-flex-col fm-gap-sm">
                  {filteredCandidates.map((candidate) => (
                    <div key={candidate.staff.id} className="fm-card">
                      <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
                        <div className="fm-flex fm-items-center fm-gap-sm fm-flex-wrap">
                          <strong className="fm-text-primary">{candidate.staff.name}</strong>
                          <span className="fm-badge fm-badge--accent">{STAFF_ROLE_LABELS[candidate.offeredRole]} 제안</span>
                          {candidate.staff.preferredRole === 'head_coach' || candidate.staff.careerOrigin === 'head_coach' ? (
                            <span className="fm-badge fm-badge--warning">감독 출신</span>
                          ) : null}
                        </div>
                        <span className={`fm-font-semibold ${getAcceptanceTone(candidate.acceptance)}`}>{getAcceptanceLabel(candidate.acceptance)}</span>
                      </div>

                      <div className="fm-grid fm-grid--2 fm-mb-sm">
                        <div className="fm-flex-col fm-gap-xs fm-text-base fm-text-secondary">
                          <span>현재 역할: {STAFF_ROLE_LABELS[candidate.staff.role]}</span>
                          <span>선호 역할: {STAFF_ROLE_LABELS[candidate.staff.preferredRole]}</span>
                          <span>전문 분야: {candidate.staff.specialty ? STAFF_SPECIALTY_LABELS[candidate.staff.specialty] : '범용'}</span>
                          <span>능력: {candidate.staff.ability}</span>
                        </div>
                        <div className="fm-flex-col fm-gap-xs fm-text-base fm-text-secondary">
                          <span>평가 점수: {candidate.score}</span>
                          <span>결정: {candidate.decision === 'accept' ? '즉시 수락' : candidate.decision === 'hesitate' ? '망설임' : '거절'}</span>
                          <span>제안 역할: {STAFF_ROLE_LABELS[candidate.offeredRole]}</span>
                          <span>유연성: {STAFF_ROLE_FLEXIBILITY_LABELS[candidate.staff.roleFlexibility]}</span>
                        </div>
                      </div>

                      <div className="fm-alert fm-alert--info fm-mb-sm">
                        <span className="fm-alert__text">
                          {candidate.reasons.length > 0 ? candidate.reasons.join(' / ') : STAFF_ROLE_EFFECTS[candidate.offeredRole]}
                        </span>
                      </div>

                      <button className="fm-btn fm-btn--primary fm-btn--sm" onClick={() => void handleHireCandidate(candidate)}>
                        {STAFF_ROLE_LABELS[candidate.offeredRole]} 제안
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
