/**
 * 스태프 관리 페이지
 * - 현재 스태프 목록 + 보정 효과
 * - FA 스태프 영입 / 신규 고용 / 해고
 * - 팀당 스태프 제한 (5명)
 */

import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  getTeamStaff,
  hireStaff,
  fireStaff,
  calculateStaffBonuses,
  getFreeAgentStaff,
  hireExistingStaff,
  canHireRole,
  TEAM_STAFF_LIMIT,
  type StaffBonuses,
} from '../../../engine/staff/staffEngine';
import { generateStaffReaction } from '../../../engine/social/socialEngine';
import type { Staff, StaffRole } from '../../../types/staff';
import { STAFF_ROLE_LABELS, STAFF_SPECIALTY_LABELS, STAFF_ROLE_EFFECTS } from '../../../types/staff';

const ROLES: StaffRole[] = ['analyst', 'scout_manager', 'sports_psychologist', 'nutritionist', 'physiotherapist', 'data_analyst'];

export function StaffView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [bonuses, setBonuses] = useState<StaffBonuses | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showFAModal, setShowFAModal] = useState(false);
  const [faStaffList, setFAStaffList] = useState<Staff[]>([]);
  const [faLoading, setFALoading] = useState(false);

  const userTeamId = save?.userTeamId ?? '';

  const loadData = useCallback(async () => {
    if (!save) return;
    setIsLoading(true);
    try {
      const [staff, bonus] = await Promise.all([
        getTeamStaff(userTeamId),
        calculateStaffBonuses(userTeamId),
      ]);
      setStaffList(staff);
      setBonuses(bonus);
    } catch (err) {
      console.error('스태프 데이터 로딩 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, [save, userTeamId]);

  useEffect(() => { loadData(); }, [loadData]);

  const openFAModal = async () => {
    setShowFAModal(true);
    setFALoading(true);
    try {
      const faList = await getFreeAgentStaff();
      setFAStaffList(faList);
    } catch (err) {
      console.error('FA 스태프 목록 로딩 실패:', err);
    } finally {
      setFALoading(false);
    }
  };

  const handleHireFA = async (faStaff: Staff) => {
    if (!season) return;
    if (!canHireRole(staffList, faStaff.role)) {
      setMessage({ text: `${STAFF_ROLE_LABELS[faStaff.role]} 자리가 없습니다.`, type: 'error' });
      return;
    }
    try {
      await hireExistingStaff(faStaff.id, userTeamId, season.year + 2);
      // 소셜 반응 생성
      const teamRows = await import('../../../db/database').then(m => m.getDatabase()).then(db =>
        db.select<{ name: string }[]>('SELECT name FROM teams WHERE id = $1', [userTeamId])
      );
      const teamName = teamRows[0]?.name ?? userTeamId;
      await generateStaffReaction(season.year, season.currentDate, faStaff.name, teamName, true);

      setMessage({ text: `${faStaff.name} 영입 완료`, type: 'success' });
      setShowFAModal(false);
      await loadData();
    } catch (err) {
      console.error('FA 스태프 영입 실패:', err);
      setMessage({ text: 'FA 스태프 영입에 실패했습니다.', type: 'error' });
    }
  };

  const handleHire = async (role: StaffRole) => {
    if (!season) return;
    if (!canHireRole(staffList, role)) {
      setMessage({ text: `${STAFF_ROLE_LABELS[role]} 자리가 없습니다.`, type: 'error' });
      return;
    }
    try {
      const newStaff = await hireStaff(userTeamId, role, season.year + 2, season.currentDate);
      // 소셜 반응 생성
      const teamRows = await import('../../../db/database').then(m => m.getDatabase()).then(db =>
        db.select<{ name: string }[]>('SELECT name FROM teams WHERE id = $1', [userTeamId])
      );
      const teamName = teamRows[0]?.name ?? userTeamId;
      await generateStaffReaction(season.year, season.currentDate, newStaff.name, teamName, true);

      setMessage({ text: `${STAFF_ROLE_LABELS[role]} 고용 완료`, type: 'success' });
      await loadData();
    } catch (err) {
      console.error('스태프 고용 실패:', err);
      setMessage({ text: '스태프 고용에 실패했습니다.', type: 'error' });
    }
  };

  const handleFire = async (staff: Staff) => {
    try {
      await fireStaff(staff.id);
      // 소셜 반응 생성
      if (season) {
        const teamRows = await import('../../../db/database').then(m => m.getDatabase()).then(db =>
          db.select<{ name: string }[]>('SELECT name FROM teams WHERE id = $1', [userTeamId])
        );
        const teamName = teamRows[0]?.name ?? userTeamId;
        await generateStaffReaction(season.year, season.currentDate, staff.name, teamName, false);
      }
      setMessage({ text: '스태프를 해고했습니다. (FA 전환)', type: 'success' });
      await loadData();
    } catch (err) {
      console.error('스태프 해고 실패:', err);
      setMessage({ text: '스태프 해고에 실패했습니다.', type: 'error' });
    }
  };

  if (!save || !season) return <p className="fm-text-muted fm-text-md">데이터를 불러오는 중...</p>;
  if (isLoading) return <p className="fm-text-muted fm-text-md">스태프 정보를 불러오는 중...</p>;

  const totalSalary = staffList.reduce((sum, s) => sum + s.salary, 0);

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

      {/* 보정 효과 요약 */}
      {bonuses && (
        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__body--compact">
            <div className="fm-flex fm-gap-lg fm-flex-wrap fm-text-md">
              <span className="fm-text-secondary">
                훈련 효율: <strong className="fm-text-success">x{bonuses.trainingEfficiency.toFixed(2)}</strong>
              </span>
              <span className="fm-text-secondary">
                사기 보정: <strong className="fm-text-accent">+{bonuses.moraleBoost}</strong>
              </span>
              <span className="fm-text-secondary">
                밴픽 정확도: <strong className="fm-text-info">+{bonuses.draftAccuracy}</strong>
              </span>
              <span className="fm-text-secondary">
                스카우팅 정확도: <strong className="fm-text-warning">+{bonuses.scoutingAccuracyBonus}</strong>
              </span>
              <span className="fm-text-secondary">
                총 연봉: <strong className="fm-text-primary">{totalSalary.toLocaleString()}만</strong>
              </span>
              <span className="fm-text-secondary">
                스태프: <strong className={staffList.length >= TEAM_STAFF_LIMIT ? 'fm-text-danger' : 'fm-text-accent'}>
                  {staffList.length}/{TEAM_STAFF_LIMIT}
                </strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 고용 버튼 */}
      <div className="fm-flex fm-gap-sm fm-flex-wrap fm-mb-lg">
        <button className="fm-btn fm-btn--info" onClick={openFAModal}>
          FA 스태프 목록
        </button>
        {ROLES.map(role => (
          <button
            key={role}
            className="fm-btn fm-btn--primary"
            onClick={() => handleHire(role)}
            disabled={!canHireRole(staffList, role)}
          >
            + {STAFF_ROLE_LABELS[role]} 신규 고용
          </button>
        ))}
      </div>

      {/* 스태프 목록 */}
      {staffList.length === 0 ? (
        <div className="fm-alert fm-alert--info">
          <span className="fm-alert__text">
            별도 고용 스태프는 아직 없지만 감독 모드에서는 사용자가 감독 겸 단장 역할을 수행합니다.
          </span>
        </div>
      ) : (
        <div className="fm-grid fm-grid--auto">
          {staffList.map(staff => (
            <div key={staff.id} className="fm-panel">
              <div className="fm-panel__header">
                <div className="fm-flex fm-items-center fm-gap-sm">
                  <span className="fm-badge fm-badge--accent">{STAFF_ROLE_LABELS[staff.role]}</span>
                  <span className="fm-text-lg fm-font-semibold fm-text-primary">{staff.name}</span>
                </div>
                <span className="fm-badge fm-badge--accent">능력 {staff.ability}</span>
              </div>
              <div className="fm-panel__body">
                <div className="fm-flex-col fm-gap-xs fm-text-base fm-text-secondary fm-mb-sm">
                  <span>특화: {staff.specialty ? STAFF_SPECIALTY_LABELS[staff.specialty] : '없음'}</span>
                  <span>연봉: {staff.salary.toLocaleString()}만</span>
                  <span>계약 만료: {staff.contractEndSeason}시즌</span>
                  <span>사기: {staff.morale}</span>
                </div>
                <div className="fm-alert fm-alert--info fm-mb-sm">
                  <span className="fm-alert__text">{STAFF_ROLE_EFFECTS[staff.role]}</span>
                </div>
                <button className="fm-btn fm-btn--sm" onClick={() => handleFire(staff)}>
                  해고
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FA 스태프 모달 */}
      {showFAModal && (
        <div className="fm-overlay" onClick={() => setShowFAModal(false)}>
          <div className="fm-modal" style={{ width: '720px' }} onClick={(e) => e.stopPropagation()}>
            <div className="fm-modal__header">
              <span className="fm-modal__title">FA 스태프 목록</span>
              <button className="fm-modal__close" onClick={() => setShowFAModal(false)}>
                ✕
              </button>
            </div>
            <div className="fm-modal__body">
              {faLoading ? (
                <p className="fm-text-muted fm-p-md">로딩 중...</p>
              ) : faStaffList.length === 0 ? (
                <p className="fm-text-muted fm-p-md">FA 스태프가 없습니다.</p>
              ) : (
                <div className="fm-table-wrap">
                  <table className="fm-table fm-table--striped">
                    <thead>
                      <tr>
                        <th>이름</th>
                        <th>역할</th>
                        <th>능력</th>
                        <th>특화</th>
                        <th>연봉</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {faStaffList.map(fa => {
                        const hirable = canHireRole(staffList, fa.role);
                        return (
                          <tr key={fa.id}>
                            <td className="fm-cell--name">{fa.name}</td>
                            <td>
                              <span className="fm-badge fm-badge--accent">{STAFF_ROLE_LABELS[fa.role]}</span>
                            </td>
                            <td className="fm-cell--accent">{fa.ability}</td>
                            <td>{fa.specialty ? STAFF_SPECIALTY_LABELS[fa.specialty] : '-'}</td>
                            <td>{fa.salary.toLocaleString()}만</td>
                            <td>
                              <button
                                className="fm-btn fm-btn--sm fm-btn--info"
                                onClick={() => handleHireFA(fa)}
                                disabled={!hirable}
                              >
                                영입
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
        </div>
      )}
    </div>
  );
}
