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
import {
  buildRelationshipNetworkReport,
  type RelationshipNetworkReport,
} from '../../../engine/manager/franchiseNarrativeEngine';
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
      return '수락 가능성 높음';
    case 'medium':
      return '조건부 수락';
    case 'low':
      return '설득 필요';
    default:
      return '거절 가능성 높음';
  }
}

function getDecisionLabel(decision: StaffCandidateView['decision']): string {
  if (decision === 'accept') return '즉시 수락';
  if (decision === 'hesitate') return '망설임';
  return '거절';
}

function buildBonusSourceLabel(staffList: Staff[], roles: StaffRole[]): string {
  const matching = staffList.filter((staff) => roles.includes(staff.role));
  if (matching.length === 0) return '현재 해당 역할을 맡은 스태프가 없습니다.';
  return matching.map((staff) => `${staff.name}(${STAFF_ROLE_LABELS[staff.role]})`).join(', ');
}

function localizeNarrative(text: string | null | undefined): string {
  if (!text) return '';

  return text
    .replace('Room chemistry is balanced', '스태프 관계 분위기는 대체로 안정적입니다.')
    .replace(
      '0 tracked links 夷?average affinity 50/100 夷?5 young players in the mix',
      '아직 강하게 묶인 관계는 없지만 평균 친화도는 무난하고 성장 자원도 충분합니다.',
    )
    .replace(
      '0 tracked links 鸚?average affinity 50/100 鸚?5 young players in the mix',
      '아직 강하게 묶인 관계는 없지만 평균 친화도는 무난하고 성장 자원도 충분합니다.',
    )
    .replace('No standout duo yet', '아직 특별히 돋보이는 핵심 조합은 없습니다.')
    .replace('No obvious fault line yet', '지금 당장 드러나는 갈등 축은 없습니다.')
    .replace(
      'Park Jinseok sets the tone, and the staff room is currently stable enough to support a long arc.',
      '현재 스태프 분위기는 비교적 안정적이며 장기 운영을 버틸 기반이 있습니다.',
    )
    .trim();
}

function localizeStaffUiNarrative(text: string | null | undefined): string {
  return localizeNarrative(text)
    .replace('Budget pressure', '재정 압박')
    .replace('Room chemistry watch', '팀 케미스트리 점검')
    .replace('Room chemistry', '팀 케미스트리')
    .replace('Regional pressure check', '지역 기대 압박 점검')
    .replace(
      'Relationship signal is still shallow, but staff trust is sitting around',
      '관계 신호는 아직 약하지만 스태프 신뢰도는 현재',
    )
    .replace(
      'The board has already tied credibility to international-level delivery.',
      '보드는 이미 국제 무대 성과를 신뢰 기준으로 보기 시작했습니다.',
    )
    .replace(
      'International pressure is forming, but the club still has room to build before it becomes a season-defining burden.',
      '국제 기대 압박이 형성되고 있지만 아직 시즌 전체를 짓누를 단계는 아닙니다.',
    )
    .trim();
}

function StaffCard({ staff, onFire }: { staff: Staff; onFire: (staff: Staff) => void }) {
  return (
    <div className="fm-card">
      <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
        <div className="fm-flex fm-items-center fm-gap-sm fm-flex-wrap">
          <span className="fm-badge fm-badge--accent">{STAFF_ROLE_LABELS[staff.role]}</span>
          <strong className="fm-text-primary">{staff.name}</strong>
          {staff.careerOrigin === 'head_coach' ? (
            <span className="fm-badge fm-badge--warning">전 감독 출신</span>
          ) : null}
        </div>
        <span className="fm-badge fm-badge--default">능력 {staff.ability}</span>
      </div>
      <div className="fm-flex-col fm-gap-xs fm-text-base fm-text-secondary fm-mb-sm">
        <span>현재 역할: {STAFF_ROLE_LABELS[staff.role]}</span>
        <span>선호 역할: {STAFF_ROLE_LABELS[staff.preferredRole]}</span>
        <span>역할 유연성: {STAFF_ROLE_FLEXIBILITY_LABELS[staff.roleFlexibility]}</span>
        <span>전문 분야: {staff.specialty ? STAFF_SPECIALTY_LABELS[staff.specialty] : '범용'}</span>
        {staff.philosophy ? <span>코칭 철학: {COACHING_PHILOSOPHY_LABELS[staff.philosophy]}</span> : null}
        <span>연봉: {staff.salary.toLocaleString()}만</span>
      </div>
      <div className="fm-alert fm-alert--info fm-mb-sm">
        <span className="fm-alert__text">{STAFF_ROLE_EFFECTS[staff.role]}</span>
      </div>
      <button className="fm-btn fm-btn--sm" onClick={() => onFire(staff)}>
        방출
      </button>
    </div>
  );
}

function PriorityCard({ label, value, summary }: { label: string; value: string; summary: string }) {
  return (
    <div className="fm-panel">
      <div className="fm-panel__header">
        <span className="fm-panel__title">{label}</span>
      </div>
      <div className="fm-panel__body">
        <strong className="fm-text-lg">{value}</strong>
        <p className="fm-text-muted fm-text-sm fm-mt-xs">{summary}</p>
      </div>
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
        setRelationshipReport(
          await buildRelationshipNetworkReport({
            roster: userTeam.roster,
            staffList: staff,
            fitSummary: fit,
          }),
        );
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
        text: `${candidate.staff.name} 영입 제안은 거절됐습니다. ${candidate.reasons[0] ?? ''}`.trim(),
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
      await generateStaffReaction(season.year, season.currentDate, candidate.staff.name, userTeam?.name ?? userTeamId, true);

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
        await generateStaffReaction(season.year, season.currentDate, staff.name, userTeam?.name ?? userTeamId, false);
      }
      setMessage({ text: `${staff.name} 방출이 완료됐습니다.`, type: 'success' });
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
  const leadCoach =
    headCoach ??
    currentCoaches.find((staff) => staff.careerOrigin === 'head_coach' || staff.preferredRole === 'head_coach') ??
    null;
  const medicalStaff = currentSpecialists.filter((staff) =>
    ['sports_psychologist', 'nutritionist', 'physiotherapist'].includes(staff.role),
  );
  const analysisStaff = currentSpecialists.filter((staff) =>
    ['analyst', 'data_analyst', 'scout_manager'].includes(staff.role),
  );
  const totalSalary = staffList.reduce((sum, staff) => sum + staff.salary, 0);

  const bonusSummaries = bonuses
    ? [
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
      ]
    : [];

  const openSlots = Math.max(TEAM_STAFF_LIMIT - staffList.length, 0);
  const biggestRiskLabel = headCoach ? (openSlots > 0 ? '지원 공백' : '안정적') : '감독 부재';
  const biggestRiskSummary = headCoach
    ? openSlots > 0
      ? `${openSlots}개의 스태프 슬롯이 비어 있어 지원 공백이 있습니다.`
      : '핵심 스태프 구조는 안정적입니다.'
    : '감독 공백으로 운영 방향과 훈련 일관성이 흔들릴 수 있습니다.';
  const nextActionTitle = headCoach ? (openSlots > 0 ? 'FA 보강' : '스태프 유지 점검') : '감독 선임';
  const nextActionSummary = headCoach
    ? openSlots > 0
      ? 'FA 시장에서 부족한 역할을 우선 보강하세요.'
      : '현재 구성의 계약 만료와 역할 중복을 점검하세요.'
    : '감독 또는 수석 코치부터 먼저 영입해 운영 축을 세우세요.';

  if (!save || !season) return <p className="fm-text-muted fm-text-md">데이터를 불러오는 중입니다...</p>;
  if (isLoading) return <p className="fm-text-muted fm-text-md">스태프 정보를 정리하는 중입니다...</p>;

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">스태프 관리</h1>
        <p className="fm-page-subtitle">현재 팀 스태프와 영입 후보를 비교하고 필요한 자리를 바로 보강할 수 있습니다.</p>
      </div>

      <div className="fm-grid fm-grid--4 fm-mb-md" data-testid="staff-priority-strip">
        <PriorityCard
          label="핵심 코치 상태"
          value={headCoach ? headCoach.name : '감독 공백'}
          summary={headCoach ? '현재 헤드 코치 체계가 운영을 주도합니다.' : '헤드 코치가 없어 시즌 운영 축이 비어 있습니다.'}
        />
        <PriorityCard
          label="남은 슬롯"
          value={`${openSlots}칸`}
          summary={`전체 ${TEAM_STAFF_LIMIT}칸 중 현재 ${staffList.length}칸이 채워져 있습니다.`}
        />
        <PriorityCard label="가장 큰 리스크" value={biggestRiskLabel} summary={biggestRiskSummary} />
        <PriorityCard label="다음 행동" value={nextActionTitle} summary={nextActionSummary} />
      </div>

      {message ? (
        <div className={`fm-alert ${message.type === 'success' ? 'fm-alert--success' : 'fm-alert--danger'} fm-mb-md`}>
          <span className="fm-alert__text">{message.text}</span>
        </div>
      ) : null}

      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">스태프 운영 현황</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--4 fm-mb-md">
            <div className="fm-card">
              <div className="fm-text-xs fm-text-muted fm-mb-xs">감독</div>
              <div className="fm-text-lg fm-font-semibold fm-text-primary">{save.managerName ?? '사용자 감독'}</div>
            </div>
            <div className="fm-card">
              <div className="fm-text-xs fm-text-muted fm-mb-xs">핵심 코치</div>
              <div className="fm-text-lg fm-font-semibold fm-text-primary">{leadCoach ? leadCoach.name : '공석'}</div>
              <div className="fm-text-xs fm-text-muted fm-mt-xs">
                {headCoach
                  ? '정식 헤드 코치 체제로 운영 중입니다.'
                  : leadCoach?.careerOrigin === 'head_coach'
                    ? '감독 부재를 기존 감독 출신 코치가 메우고 있습니다.'
                    : '코치진 중심 체제로 운영 중입니다.'}
              </div>
            </div>
            <div className="fm-card">
              <div className="fm-text-xs fm-text-muted fm-mb-xs">코칭 스태프</div>
              <div className="fm-text-lg fm-font-semibold fm-text-primary">{currentCoaches.length}명</div>
              <div className="fm-text-xs fm-text-muted fm-mt-xs">
                전체 스태프 {staffList.length} / {TEAM_STAFF_LIMIT}
              </div>
            </div>
            <div className="fm-card">
              <div className="fm-text-xs fm-text-muted fm-mb-xs">분석 / 메디컬</div>
              <div className="fm-text-lg fm-font-semibold fm-text-primary">
                {analysisStaff.length} / {medicalStaff.length}
              </div>
              <div className="fm-text-xs fm-text-muted fm-mt-xs">총 운영비 {totalSalary.toLocaleString()}만</div>
            </div>
          </div>
          <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm fm-flex-wrap">
            <div className="fm-text-sm fm-text-secondary">
              감독 체제와 코치진, 전문 스태프를 분리해서 보고 필요한 자리를 빠르게 보강할 수 있습니다.
            </div>
            <button className="fm-btn fm-btn--primary" onClick={openFAModal}>
              FA 스태프 시장 보기
            </button>
          </div>
        </div>
      </div>

      {relationshipReport ? (
        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__header">
            <span className="fm-panel__title">스태프 네트워크</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-card fm-card--highlight fm-mb-md">
              <strong className="fm-text-lg fm-text-primary">{localizeStaffUiNarrative(relationshipReport.headline)}</strong>
              <p className="fm-text-secondary fm-mt-sm" style={{ marginBottom: 0 }}>
                {localizeStaffUiNarrative(relationshipReport.summary)}
              </p>
            </div>
            <div className="fm-grid fm-grid--3">
              <div className="fm-card">
                <span className="fm-text-xs fm-font-semibold fm-text-accent">가장 좋은 연결</span>
                <p className="fm-text-sm fm-text-secondary fm-mt-sm">{localizeStaffUiNarrative(relationshipReport.strongLink)}</p>
              </div>
              <div className="fm-card">
                <span className="fm-text-xs fm-font-semibold fm-text-accent">주의할 연결</span>
                <p className="fm-text-sm fm-text-secondary fm-mt-sm">{localizeStaffUiNarrative(relationshipReport.riskLink)}</p>
              </div>
              <div className="fm-card">
                <span className="fm-text-xs fm-font-semibold fm-text-accent">스태프 분위기</span>
                <p className="fm-text-sm fm-text-secondary fm-mt-sm">{localizeStaffUiNarrative(relationshipReport.staffPulse)}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fm-grid fm-grid--2 fm-mb-md">
        {fitSummary.length > 0 ? (
          <div className="fm-panel">
            <div className="fm-panel__header">
              <span className="fm-panel__title">역할 적합도</span>
            </div>
            <div className="fm-panel__body">
              <div className="fm-grid fm-grid--2">
                {fitSummary.slice(0, 4).map((item) => (
                  <div key={`${item.staffId}-${item.role}`} className="fm-card">
                    <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
                      <strong className="fm-text-primary">{item.name}</strong>
                      <span
                        className={`fm-badge ${
                          item.fitScore >= 75 ? 'fm-badge--success' : item.fitScore >= 50 ? 'fm-badge--warning' : 'fm-badge--danger'
                        }`}
                      >
                        {item.fitScore}
                      </span>
                    </div>
                    <p className="fm-text-secondary fm-mb-sm" style={{ marginTop: 0 }}>
                      현재 역할 {STAFF_ROLE_LABELS[item.role as StaffRole]} / 선호 역할 {STAFF_ROLE_LABELS[item.preferredRole as StaffRole]}
                    </p>
                    <p className="fm-text-xs fm-text-muted" style={{ margin: 0 }}>
                      {item.summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {bonuses ? (
          <div className="fm-panel">
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
                    <p className="fm-text-secondary" style={{ margin: 0 }}>
                      {summary.source}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {headCoach ? (
        <div className="fm-panel fm-mb-lg">
          <div className="fm-panel__header">
            <span className="fm-panel__title">헤드 코치</span>
          </div>
          <div className="fm-panel__body">
            <StaffCard staff={headCoach} onFire={handleFire} />
          </div>
        </div>
      ) : null}

      <div className="fm-grid fm-grid--2 fm-mb-lg">
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">코치진</span>
          </div>
          <div className="fm-panel__body">
            {currentCoaches.length === 0 ? (
              <div className="fm-alert fm-alert--warning">
                <span className="fm-alert__text">전담 코치가 없습니다. 훈련 효율과 선수 조언 품질이 떨어질 수 있습니다.</span>
              </div>
            ) : (
              <div className="fm-flex-col fm-gap-sm">
                {currentCoaches.map((staff) => (
                  <StaffCard key={staff.id} staff={staff} onFire={handleFire} />
                ))}
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
                <span className="fm-alert__text">분석, 심리, 메디컬 등 전문 스태프가 아직 없습니다.</span>
              </div>
            ) : (
              <div className="fm-flex-col fm-gap-sm">
                {currentSpecialists.map((staff) => (
                  <StaffCard key={staff.id} staff={staff} onFire={handleFire} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showFAModal ? (
        <div className="fm-overlay" onClick={() => setShowFAModal(false)}>
          <div className="fm-modal" style={{ width: '960px', maxWidth: '96vw' }} onClick={(event) => event.stopPropagation()}>
            <div className="fm-modal__header">
              <span className="fm-modal__title">FA 스태프 시장</span>
              <button className="fm-modal__close" onClick={() => setShowFAModal(false)}>
                &times;
              </button>
            </div>
            <div className="fm-modal__body">
              <div className="fm-flex fm-gap-xs fm-flex-wrap fm-mb-md">
                <button className={`fm-btn fm-btn--sm ${candidateFilter === 'all' ? 'fm-btn--primary' : ''}`} onClick={() => setCandidateFilter('all')}>
                  전체
                </button>
                <button className={`fm-btn fm-btn--sm ${candidateFilter === 'coach' ? 'fm-btn--primary' : ''}`} onClick={() => setCandidateFilter('coach')}>
                  코치 우선
                </button>
                <button
                  className={`fm-btn fm-btn--sm ${candidateFilter === 'former_head_coach' ? 'fm-btn--primary' : ''}`}
                  onClick={() => setCandidateFilter('former_head_coach')}
                >
                  전 감독 출신
                </button>
                <button
                  className={`fm-btn fm-btn--sm ${candidateFilter === 'specialist' ? 'fm-btn--primary' : ''}`}
                  onClick={() => setCandidateFilter('specialist')}
                >
                  전문 스태프
                </button>
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
                            <span className="fm-badge fm-badge--warning">전 감독 출신</span>
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
                          <span>결정: {getDecisionLabel(candidate.decision)}</span>
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
      ) : null}
    </div>
  );
}
