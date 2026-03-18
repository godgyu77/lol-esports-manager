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

const ROLES: StaffRole[] = ['head_coach', 'coach', 'analyst', 'scout_manager'];

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

  if (!save || !season) return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  if (isLoading) return <p style={{ color: '#6a6a7a' }}>스태프 정보를 불러오는 중...</p>;

  const totalSalary = staffList.reduce((sum, s) => sum + s.salary, 0);

  return (
    <div>
      <h1 style={styles.title}>스태프 관리</h1>

      {message && (
        <div style={{
          ...styles.message,
          borderColor: message.type === 'success' ? '#2ecc71' : '#e74c3c',
          color: message.type === 'success' ? '#2ecc71' : '#e74c3c',
        }}>
          {message.text}
        </div>
      )}

      {/* 보정 효과 요약 */}
      {bonuses && (
        <div style={styles.bonusBar}>
          <span style={styles.bonusItem}>
            훈련 효율: <strong style={{ color: '#2ecc71' }}>x{bonuses.trainingEfficiency.toFixed(2)}</strong>
          </span>
          <span style={styles.bonusItem}>
            사기 보정: <strong style={{ color: '#c89b3c' }}>+{bonuses.moraleBoost}</strong>
          </span>
          <span style={styles.bonusItem}>
            밴픽 정확도: <strong style={{ color: '#4ecdc4' }}>+{bonuses.draftAccuracy}</strong>
          </span>
          <span style={styles.bonusItem}>
            스카우팅 정확도: <strong style={{ color: '#f39c12' }}>+{bonuses.scoutingAccuracyBonus}</strong>
          </span>
          <span style={styles.bonusItem}>
            총 연봉: <strong style={{ color: '#e0e0e0' }}>{totalSalary.toLocaleString()}만</strong>
          </span>
          <span style={styles.bonusItem}>
            스태프: <strong style={{ color: staffList.length >= TEAM_STAFF_LIMIT ? '#e74c3c' : '#c89b3c' }}>
              {staffList.length}/{TEAM_STAFF_LIMIT}
            </strong>
          </span>
        </div>
      )}

      {/* 고용 버튼 */}
      <div style={styles.hireRow}>
        <button style={styles.faBtn} onClick={openFAModal}>
          FA 스태프 목록
        </button>
        {ROLES.map(role => (
          <button
            key={role}
            style={{
              ...styles.hireBtn,
              opacity: canHireRole(staffList, role) ? 1 : 0.4,
              cursor: canHireRole(staffList, role) ? 'pointer' : 'not-allowed',
            }}
            onClick={() => handleHire(role)}
            disabled={!canHireRole(staffList, role)}
          >
            + {STAFF_ROLE_LABELS[role]} 신규 고용
          </button>
        ))}
      </div>

      {/* 스태프 목록 */}
      {staffList.length === 0 ? (
        <p style={styles.empty}>고용된 스태프가 없습니다.</p>
      ) : (
        <div style={styles.staffGrid}>
          {staffList.map(staff => (
            <div key={staff.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.roleTag}>{STAFF_ROLE_LABELS[staff.role]}</span>
                <span style={styles.staffName}>{staff.name}</span>
                <span style={styles.ability}>능력 {staff.ability}</span>
              </div>
              <div style={styles.cardDetails}>
                <span>특화: {staff.specialty ? STAFF_SPECIALTY_LABELS[staff.specialty] : '없음'}</span>
                <span>연봉: {staff.salary.toLocaleString()}만</span>
                <span>계약 만료: {staff.contractEndSeason}시즌</span>
                <span>사기: {staff.morale}</span>
              </div>
              <div style={styles.cardEffect}>
                {STAFF_ROLE_EFFECTS[staff.role]}
              </div>
              <button style={styles.fireBtn} onClick={() => handleFire(staff)}>
                해고
              </button>
            </div>
          ))}
        </div>
      )}

      {/* FA 스태프 모달 */}
      {showFAModal && (
        <div style={styles.modalOverlay} onClick={() => setShowFAModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>FA 스태프 목록</h2>
              <button style={styles.modalClose} onClick={() => setShowFAModal(false)}>
                ✕
              </button>
            </div>
            {faLoading ? (
              <p style={{ color: '#6a6a7a', padding: '20px' }}>로딩 중...</p>
            ) : faStaffList.length === 0 ? (
              <p style={{ color: '#6a6a7a', padding: '20px' }}>FA 스태프가 없습니다.</p>
            ) : (
              <div style={styles.faTable}>
                <div style={styles.faTableHeader}>
                  <span style={{ flex: 1.5 }}>이름</span>
                  <span style={{ flex: 1 }}>역할</span>
                  <span style={{ flex: 0.7 }}>능력</span>
                  <span style={{ flex: 1 }}>특화</span>
                  <span style={{ flex: 0.8 }}>연봉</span>
                  <span style={{ flex: 0.7 }}></span>
                </div>
                {faStaffList.map(fa => {
                  const hirable = canHireRole(staffList, fa.role);
                  return (
                    <div key={fa.id} style={styles.faTableRow}>
                      <span style={{ flex: 1.5, color: '#e0e0e0', fontWeight: 600 }}>{fa.name}</span>
                      <span style={{ flex: 1 }}>
                        <span style={styles.faRoleTag}>{STAFF_ROLE_LABELS[fa.role]}</span>
                      </span>
                      <span style={{ flex: 0.7, color: '#c89b3c', fontWeight: 700 }}>{fa.ability}</span>
                      <span style={{ flex: 1, color: '#8a8a9a' }}>
                        {fa.specialty ? STAFF_SPECIALTY_LABELS[fa.specialty] : '-'}
                      </span>
                      <span style={{ flex: 0.8, color: '#8a8a9a' }}>{fa.salary.toLocaleString()}만</span>
                      <span style={{ flex: 0.7 }}>
                        <button
                          style={{
                            ...styles.faHireBtn,
                            opacity: hirable ? 1 : 0.4,
                            cursor: hirable ? 'pointer' : 'not-allowed',
                          }}
                          onClick={() => handleHireFA(fa)}
                          disabled={!hirable}
                        >
                          영입
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { fontSize: '24px', fontWeight: 700, color: '#f0e6d2', marginBottom: '16px' },
  message: {
    padding: '10px 16px', marginBottom: '12px', border: '1px solid',
    borderRadius: '6px', fontSize: '13px', background: 'rgba(255,255,255,0.02)',
  },
  bonusBar: {
    display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '16px',
    padding: '12px 16px', background: '#12122a', border: '1px solid #2a2a4a',
    borderRadius: '8px', fontSize: '13px',
  },
  bonusItem: { color: '#8a8a9a' },
  hireRow: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  faBtn: {
    padding: '8px 16px', background: 'rgba(78,205,196,0.15)', border: '1px solid #4ecdc4',
    borderRadius: '6px', color: '#4ecdc4', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  hireBtn: {
    padding: '8px 16px', background: 'rgba(200,155,60,0.15)', border: '1px solid #c89b3c',
    borderRadius: '6px', color: '#c89b3c', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  empty: { color: '#6a6a7a', fontSize: '13px' },
  staffGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' },
  card: {
    background: '#12122a', border: '1px solid #2a2a4a', borderRadius: '8px', padding: '16px',
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' },
  roleTag: {
    fontSize: '11px', fontWeight: 600, color: '#0d0d1a', background: '#c89b3c',
    padding: '2px 8px', borderRadius: '4px',
  },
  staffName: { fontSize: '15px', fontWeight: 600, color: '#e0e0e0' },
  ability: {
    fontSize: '13px', fontWeight: 700, color: '#c89b3c', marginLeft: 'auto',
    background: 'rgba(200,155,60,0.15)', padding: '2px 8px', borderRadius: '4px',
  },
  cardDetails: {
    display: 'flex', flexDirection: 'column', gap: '2px',
    fontSize: '12px', color: '#8a8a9a', marginBottom: '8px',
  },
  cardEffect: {
    fontSize: '12px', color: '#4ecdc4', fontStyle: 'italic',
    padding: '6px 8px', background: 'rgba(78,205,196,0.08)', borderRadius: '4px', marginBottom: '10px',
  },
  fireBtn: {
    padding: '6px 14px', background: 'none', border: '1px solid #6a6a7a',
    borderRadius: '4px', color: '#6a6a7a', fontSize: '12px', cursor: 'pointer',
  },
  // FA 모달
  modalOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: '12px',
    width: '720px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid #2a2a4a',
  },
  modalTitle: { fontSize: '18px', fontWeight: 700, color: '#f0e6d2', margin: 0 },
  modalClose: {
    background: 'none', border: 'none', color: '#6a6a7a', fontSize: '18px', cursor: 'pointer',
  },
  faTable: { overflowY: 'auto', padding: '0 20px 20px' },
  faTableHeader: {
    display: 'flex', padding: '12px 0', borderBottom: '1px solid #2a2a4a',
    fontSize: '12px', color: '#6a6a7a', fontWeight: 600,
  },
  faTableRow: {
    display: 'flex', alignItems: 'center', padding: '10px 0',
    borderBottom: '1px solid rgba(42,42,74,0.5)', fontSize: '13px', color: '#8a8a9a',
  },
  faRoleTag: {
    fontSize: '11px', fontWeight: 600, color: '#0d0d1a', background: '#c89b3c',
    padding: '2px 6px', borderRadius: '3px',
  },
  faHireBtn: {
    padding: '4px 12px', background: 'rgba(78,205,196,0.15)', border: '1px solid #4ecdc4',
    borderRadius: '4px', color: '#4ecdc4', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
  },
};
