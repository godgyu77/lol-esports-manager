import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  buildStaffCandidateView,
  calculateStaffBonuses,
  fireStaff,
  getFreeAgentStaff,
  getTeamStaff,
  hireStaffByOffer,
  TEAM_STAFF_LIMIT,
  type StaffBonuses,
} from '../../../engine/staff/staffEngine';
import { generateStaffReaction } from '../../../engine/social/socialEngine';
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
  if (staff.role === 'head_coach') return 'coach';
  return staff.role;
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
      return '수락 가능성 높음';
    case 'medium':
      return '수락 가능성 보통';
    case 'low':
      return '조건부 검토';
    default:
      return '거절 가능성 높음';
  }
}

export function StaffView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [bonuses, setBonuses] = useState<StaffBonuses | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showFAModal, setShowFAModal] = useState(false);
  const [faLoading, setFALoading] = useState(false);
  const [candidateFilter, setCandidateFilter] = useState<CandidateFilter>('all');
  const [candidateViews, setCandidateViews] = useState<StaffCandidateView[]>([]);

  const userTeamId = save?.userTeamId ?? '';

  const loadData = useCallback(async () => {
    if (!save) return;
    setIsLoading(true);
    try {
      const [staff, bonus] = await Promise.all([
        getTeamStaff(userTeamId),
        calculateStaffBonuses(userTeamId),
      ]);
      setStaffList(staff.filter((entry) => entry.role !== 'head_coach'));
      setBonuses(bonus);
    } catch (err) {
      console.error('failed to load staff page:', err);
    } finally {
      setIsLoading(false);
    }
  }, [save, userTeamId]);

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
      setMessage({ text: `${candidate.staff.name}이(가) 제안을 거절했습니다. ${candidate.reasons[0] ?? ''}`.trim(), type: 'error' });
      return;
    }

    if (candidate.decision === 'hesitate') {
      const accepted = Math.random() < candidate.score / 100;
      if (!accepted) {
        setMessage({ text: `${candidate.staff.name}이(가) 망설인 끝에 제안을 거절했습니다.`, type: 'error' });
        return;
      }
    }

    try {
      await hireStaffByOffer(candidate.staff.id, userTeamId, candidate.offeredRole, season.year + 2);
      const teamRows = await import('../../../db/database')
        .then((m) => m.getDatabase())
        .then((db) => db.select<{ name: string }[]>('SELECT name FROM teams WHERE id = $1', [userTeamId]));
      const teamName = teamRows[0]?.name ?? userTeamId;
      await generateStaffReaction(season.year, season.currentDate, candidate.staff.name, teamName, true);

      setMessage({
        text: `${candidate.staff.name}이(가) ${STAFF_ROLE_LABELS[candidate.offeredRole]} 제안을 수락했습니다.`,
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
          .then((m) => m.getDatabase())
          .then((db) => db.select<{ name: string }[]>('SELECT name FROM teams WHERE id = $1', [userTeamId]));
        const teamName = teamRows[0]?.name ?? userTeamId;
        await generateStaffReaction(season.year, season.currentDate, staff.name, teamName, false);
      }
      setMessage({ text: `${staff.name}을(를) 방출했습니다.`, type: 'success' });
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

  const totalSalary = staffList.reduce((sum, staff) => sum + staff.salary, 0);
  const currentCoaches = staffList.filter((staff) => staff.role === 'coach');
  const currentSpecialists = staffList.filter((staff) => staff.role !== 'coach');

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

      {bonuses && (
        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__body--compact">
            <div className="fm-flex fm-gap-lg fm-flex-wrap fm-text-md">
              <span className="fm-text-secondary">훈련 효율 <strong className="fm-text-success">x{bonuses.trainingEfficiency.toFixed(2)}</strong></span>
              <span className="fm-text-secondary">사기 보정 <strong className="fm-text-accent">+{bonuses.moraleBoost}</strong></span>
              <span className="fm-text-secondary">밴픽 정확도 <strong className="fm-text-info">+{bonuses.draftAccuracy}</strong></span>
              <span className="fm-text-secondary">스카우팅 정확도 <strong className="fm-text-warning">+{bonuses.scoutingAccuracyBonus}</strong></span>
              <span className="fm-text-secondary">총 연봉 <strong className="fm-text-primary">{totalSalary.toLocaleString()}만</strong></span>
              <span className="fm-text-secondary">스태프 <strong className={staffList.length >= TEAM_STAFF_LIMIT ? 'fm-text-danger' : 'fm-text-accent'}>{staffList.length}/{TEAM_STAFF_LIMIT}</strong></span>
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
            <span className="fm-panel__title">현재 코치진</span>
          </div>
          <div className="fm-panel__body">
            {currentCoaches.length === 0 ? (
              <div className="fm-alert fm-alert--warning">
                <span className="fm-alert__text">현장 코치가 없습니다. 훈련과 경기 준비 피드백이 거칠어질 수 있습니다.</span>
              </div>
            ) : (
              <div className="fm-flex-col fm-gap-sm">
                {currentCoaches.map((staff) => (
                  <div key={staff.id} className="fm-card">
                    <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
                      <div className="fm-flex fm-items-center fm-gap-sm">
                        <span className="fm-badge fm-badge--accent">{STAFF_ROLE_LABELS[staff.role]}</span>
                        <strong className="fm-text-primary">{staff.name}</strong>
                      </div>
                      <span className="fm-badge fm-badge--default">능력 {staff.ability}</span>
                    </div>
                    <div className="fm-flex-col fm-gap-xs fm-text-base fm-text-secondary fm-mb-sm">
                      <span>선호 역할: {STAFF_ROLE_LABELS[staff.preferredRole]}</span>
                      <span>역할 성향: {STAFF_ROLE_FLEXIBILITY_LABELS[staff.roleFlexibility]}</span>
                      <span>전문 분야: {staff.specialty ? STAFF_SPECIALTY_LABELS[staff.specialty] : '범용'}</span>
                    </div>
                    <div className="fm-alert fm-alert--info fm-mb-sm">
                      <span className="fm-alert__text">{STAFF_ROLE_EFFECTS[staff.role]}</span>
                    </div>
                    <button className="fm-btn fm-btn--sm" onClick={() => void handleFire(staff)}>방출</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">지원 스태프</span>
          </div>
          <div className="fm-panel__body">
            {currentSpecialists.length === 0 ? (
              <p className="fm-text-muted">아직 고용한 지원 스태프가 없습니다.</p>
            ) : (
              <div className="fm-flex-col fm-gap-sm">
                {currentSpecialists.map((staff) => (
                  <div key={staff.id} className="fm-card">
                    <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
                      <div className="fm-flex fm-items-center fm-gap-sm">
                        <span className="fm-badge fm-badge--accent">{STAFF_ROLE_LABELS[staff.role]}</span>
                        <strong className="fm-text-primary">{staff.name}</strong>
                      </div>
                      <span className="fm-badge fm-badge--default">능력 {staff.ability}</span>
                    </div>
                    <div className="fm-flex-col fm-gap-xs fm-text-base fm-text-secondary fm-mb-sm">
                      <span>선호 역할: {STAFF_ROLE_LABELS[staff.preferredRole]}</span>
                      <span>역할 성향: {STAFF_ROLE_FLEXIBILITY_LABELS[staff.roleFlexibility]}</span>
                      <span>전문 분야: {staff.specialty ? STAFF_SPECIALTY_LABELS[staff.specialty] : '범용'}</span>
                    </div>
                    <div className="fm-alert fm-alert--info fm-mb-sm">
                      <span className="fm-alert__text">{STAFF_ROLE_EFFECTS[staff.role]}</span>
                    </div>
                    <button className="fm-btn fm-btn--sm" onClick={() => void handleFire(staff)}>방출</button>
                  </div>
                ))}
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
              <button className="fm-modal__close" onClick={() => setShowFAModal(false)}>×</button>
            </div>
            <div className="fm-modal__body">
              <div className="fm-flex fm-gap-xs fm-flex-wrap fm-mb-md">
                <button className={`fm-btn fm-btn--sm ${candidateFilter === 'all' ? 'fm-btn--primary' : ''}`} onClick={() => setCandidateFilter('all')}>전체</button>
                <button className={`fm-btn fm-btn--sm ${candidateFilter === 'coach' ? 'fm-btn--primary' : ''}`} onClick={() => setCandidateFilter('coach')}>코치 선호</button>
                <button className={`fm-btn fm-btn--sm ${candidateFilter === 'former_head_coach' ? 'fm-btn--primary' : ''}`} onClick={() => setCandidateFilter('former_head_coach')}>감독 출신</button>
                <button className={`fm-btn fm-btn--sm ${candidateFilter === 'specialist' ? 'fm-btn--primary' : ''}`} onClick={() => setCandidateFilter('specialist')}>기타 스태프</button>
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
                          <span>현재 대표 역할: {STAFF_ROLE_LABELS[candidate.staff.role]}</span>
                          <span>선호 역할: {STAFF_ROLE_LABELS[candidate.staff.preferredRole]}</span>
                          <span>역할 성향: {STAFF_ROLE_FLEXIBILITY_LABELS[candidate.staff.roleFlexibility]}</span>
                          <span>전문 분야: {candidate.staff.specialty ? STAFF_SPECIALTY_LABELS[candidate.staff.specialty] : '범용'}</span>
                        </div>
                        <div className="fm-flex-col fm-gap-xs fm-text-base fm-text-secondary">
                          <span>능력: {candidate.staff.ability}</span>
                          <span>국적: {candidate.staff.nationality ?? '-'}</span>
                          <span>철학: {candidate.staff.philosophy ? COACHING_PHILOSOPHY_LABELS[candidate.staff.philosophy] : '전문 스태프'}</span>
                          <span>연봉 요구: {candidate.staff.salary.toLocaleString()}만</span>
                        </div>
                      </div>

                      <div className="fm-alert fm-alert--info fm-mb-sm">
                        <span className="fm-alert__text">{candidate.reasons.slice(0, 2).join(' ')}</span>
                      </div>

                      <div className="fm-flex fm-gap-sm fm-flex-wrap fm-items-center">
                        <button
                          className="fm-btn fm-btn--sm fm-btn--info"
                          onClick={() => void handleHireCandidate(candidate)}
                          disabled={candidate.decision === 'reject'}
                        >
                          {STAFF_ROLE_LABELS[candidate.offeredRole]} 제안
                        </button>
                        <span className="fm-text-muted">점수 {candidate.score} / 100</span>
                      </div>
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
