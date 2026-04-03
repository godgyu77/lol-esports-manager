/**
 * 선수 불만/요구 관리 페이지
 * - 활성 불만 목록 (카드)
 * - 불만 대응: [대화하기] [무시]
 * - 심각도 색상 (1:노랑, 2:주황, 3:빨강)
 * - 불만 이력 탭
 */

import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  getActiveComplaints,
  getComplaintHistory,
  resolveComplaint,
  ignoreComplaint,
  allowTransfer,
  denyTransfer,
  persuadeTransfer,
} from '../../../engine/complaint/complaintEngine';
import { resolveConflict } from '../../../engine/personality/personalityEngine';
import {
  getPlayerManagementInsights,
  SATISFACTION_FACTOR_LABELS,
  type PlayerManagementInsight,
} from '../../../engine/satisfaction/playerSatisfactionEngine';
import { getPlayerById } from '../../../db/queries';
import type { PlayerComplaint } from '../../../types/complaint';
import { COMPLAINT_TYPE_LABELS, COMPLAINT_SEVERITY_LABELS } from '../../../types/complaint';

type ConflictMethod = 'team_talk' | 'mentoring' | 'mediation';

interface ConflictResult {
  complaintId: number;
  success: boolean;
  message: string;
}

type Tab = 'active' | 'history';

function getSeverityBadgeClass(severity: number): string {
  switch (severity) {
    case 1: return 'fm-badge--warning';
    case 2: return 'fm-badge--warning';
    case 3: return 'fm-badge--danger';
    default: return 'fm-badge--default';
  }
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'resolved': return 'fm-badge--success';
    case 'ignored': return 'fm-badge--default';
    case 'escalated': return 'fm-badge--danger';
    default: return 'fm-badge--default';
  }
}

export function ComplaintsView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);
  const currentDate = useGameStore((s) => s.currentDate);

  const [tab, setTab] = useState<Tab>('active');
  const [activeComplaints, setActiveComplaints] = useState<PlayerComplaint[]>([]);
  const [historyComplaints, setHistoryComplaints] = useState<PlayerComplaint[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [playerInsights, setPlayerInsights] = useState<Record<string, PlayerManagementInsight>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userTeamId = save?.userTeamId ?? '';

  const loadData = useCallback(async () => {
    if (!season || !save) return;
    setIsLoading(true);
    setError(null);

    try {
      const [active, history, insights] = await Promise.all([
        getActiveComplaints(userTeamId),
        getComplaintHistory(userTeamId, season.id),
        getPlayerManagementInsights(userTeamId, season.id, 20).catch(() => []),
      ]);

      setActiveComplaints(active);
      setHistoryComplaints(history);
      setPlayerInsights(
        Object.fromEntries(insights.map((insight) => [insight.playerId, insight])),
      );

      // 선수 이름 로딩
      const allComplaints = [...active, ...history];
      const uniquePlayerIds = [...new Set(allComplaints.map((c) => c.playerId))];
      const names: Record<string, string> = {};
      for (const pid of uniquePlayerIds) {
        const player = await getPlayerById(pid);
        if (player) names[pid] = player.name;
      }
      setPlayerNames(names);
    } catch (err) {
      console.error('불만 데이터 로딩 실패:', err);
      setError('불만 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [season, save, userTeamId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [persuadeResult, setPersuadeResult] = useState<{ complaintId: number; success: boolean } | null>(null);
  const [conflictPanelId, setConflictPanelId] = useState<number | null>(null);
  const [conflictResult, setConflictResult] = useState<ConflictResult | null>(null);
  const [conflictLoading, setConflictLoading] = useState(false);

  const handleResolve = async (complaint: PlayerComplaint) => {
    try {
      await resolveComplaint(
        complaint.id,
        'talk',
        currentDate ?? '',
        save?.id,
      );
      await loadData();
    } catch (err) {
      console.error('불만 해결 실패:', err);
    }
  };

  const handleIgnore = async (complaint: PlayerComplaint) => {
    try {
      await ignoreComplaint(complaint.id, save?.id);
      await loadData();
    } catch (err) {
      console.error('불만 무시 실패:', err);
    }
  };

  const handleAllowTransfer = async (complaint: PlayerComplaint) => {
    try {
      await allowTransfer(
        complaint.id,
        currentDate ?? '',
        save?.id,
      );
      await loadData();
    } catch (err) {
      console.error('이적 허용 실패:', err);
    }
  };

  const handleDenyTransfer = async (complaint: PlayerComplaint) => {
    try {
      await denyTransfer(complaint.id);
      await loadData();
    } catch (err) {
      console.error('이적 거부 실패:', err);
    }
  };

  const handlePersuadeTransfer = async (complaint: PlayerComplaint) => {
    try {
      const success = await persuadeTransfer(
        complaint.id,
        currentDate ?? '',
        save?.id,
      );
      setPersuadeResult({ complaintId: complaint.id, success });
      await loadData();
      // 3초 후 결과 메시지 제거
      setTimeout(() => setPersuadeResult(null), 3000);
    } catch (err) {
      console.error('설득 실패:', err);
    }
  };

  const handleConflictResolve = async (complaintId: number, method: ConflictMethod) => {
    setConflictLoading(true);
    try {
      const result = await resolveConflict(complaintId, method);
      setConflictResult({ complaintId, success: result.success, message: result.message });
      setConflictPanelId(null);
      await loadData();
      setTimeout(() => setConflictResult(null), 4000);
    } catch (err) {
      console.error('갈등 해결 실패:', err);
    } finally {
      setConflictLoading(false);
    }
  };

  const toggleConflictPanel = (complaintId: number) => {
    setConflictPanelId((prev) => (prev === complaintId ? null : complaintId));
    setConflictResult(null);
  };

  if (isLoading) {
    return <div className="fm-text-muted fm-text-center fm-p-lg">로딩 중...</div>;
  }

  if (error) {
    return <div className="fm-text-danger fm-text-center fm-p-lg">{error}</div>;
  }

  const displayComplaints = tab === 'active' ? activeComplaints : historyComplaints;

  return (
    <div style={{ maxWidth: '900px' }}>
      <h1 className="fm-page-title fm-mb-lg">선수 관리</h1>

      {/* 탭 */}
      <div className="fm-tabs">
        <button
          className={`fm-tab ${tab === 'active' ? 'fm-tab--active' : ''}`}
          onClick={() => setTab('active')}
        >
          활성 불만 ({activeComplaints.length})
        </button>
        <button
          className={`fm-tab ${tab === 'history' ? 'fm-tab--active' : ''}`}
          onClick={() => setTab('history')}
        >
          불만 이력
        </button>
      </div>

      {/* 불만 목록 */}
      {displayComplaints.length === 0 ? (
        <div className="fm-card fm-text-center fm-p-lg">
          <p className="fm-text-muted fm-text-lg">
            {tab === 'active'
              ? '현재 활성 불만이 없습니다.'
              : '이번 시즌 불만 이력이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="fm-flex-col fm-gap-md">
          {displayComplaints.map((complaint) => (
            <ComplaintCard
              key={complaint.id}
              complaint={complaint}
              playerName={playerNames[complaint.playerId] ?? '알 수 없음'}
              insight={playerInsights[complaint.playerId]}
              onResolve={tab === 'active' ? () => handleResolve(complaint) : undefined}
              onIgnore={tab === 'active' ? () => handleIgnore(complaint) : undefined}
              onAllowTransfer={tab === 'active' && complaint.complaintType === 'transfer' ? () => handleAllowTransfer(complaint) : undefined}
              onDenyTransfer={tab === 'active' && complaint.complaintType === 'transfer' ? () => handleDenyTransfer(complaint) : undefined}
              onPersuadeTransfer={tab === 'active' && complaint.complaintType === 'transfer' ? () => handlePersuadeTransfer(complaint) : undefined}
              persuadeResult={persuadeResult?.complaintId === complaint.id ? persuadeResult : null}
              isConflict={complaint.complaintType === 'conflict'}
              conflictPanelOpen={conflictPanelId === complaint.id}
              onToggleConflictPanel={tab === 'active' && complaint.complaintType === 'conflict' ? () => toggleConflictPanel(complaint.id) : undefined}
              onConflictResolve={tab === 'active' && complaint.complaintType === 'conflict' ? (method: ConflictMethod) => handleConflictResolve(complaint.id, method) : undefined}
              conflictResult={conflictResult?.complaintId === complaint.id ? conflictResult : null}
              conflictLoading={conflictLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// 불만 카드 컴포넌트
// ─────────────────────────────────────────

function ComplaintCard({
  complaint,
  playerName,
  insight,
  onResolve,
  onIgnore,
  onAllowTransfer,
  onDenyTransfer,
  onPersuadeTransfer,
  persuadeResult,
  isConflict,
  conflictPanelOpen,
  onToggleConflictPanel,
  onConflictResolve,
  conflictResult,
  conflictLoading,
}: {
  complaint: PlayerComplaint;
  playerName: string;
  insight?: PlayerManagementInsight;
  onResolve?: () => void;
  onIgnore?: () => void;
  onAllowTransfer?: () => void;
  onDenyTransfer?: () => void;
  onPersuadeTransfer?: () => void;
  persuadeResult?: { complaintId: number; success: boolean } | null;
  isConflict?: boolean;
  conflictPanelOpen?: boolean;
  onToggleConflictPanel?: () => void;
  onConflictResolve?: (method: ConflictMethod) => void;
  conflictResult?: ConflictResult | null;
  conflictLoading?: boolean;
}) {
  const isTransfer = complaint.complaintType === 'transfer';
  const severityBorderColor = complaint.severity >= 3
    ? 'var(--danger)'
    : complaint.severity >= 2
    ? 'var(--warning)'
    : '#f1c40f';

  return (
    <div
      className="fm-card"
      style={{ borderLeft: `4px solid ${isConflict ? 'var(--danger)' : severityBorderColor}` }}
    >
      <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
        <div className="fm-flex fm-items-center fm-gap-sm">
          <span className="fm-text-lg fm-font-bold fm-text-primary">{playerName}</span>
          <span className={`fm-badge ${getSeverityBadgeClass(complaint.severity)}`}>
            {COMPLAINT_SEVERITY_LABELS[complaint.severity] ?? '알 수 없음'}
          </span>
          {isConflict && (
            <span className="fm-badge fm-badge--danger">갈등</span>
          )}
        </div>
        <div className="fm-flex fm-items-center fm-gap-sm">
          <span className="fm-badge fm-badge--accent">
            {COMPLAINT_TYPE_LABELS[complaint.complaintType] ?? complaint.complaintType}
          </span>
          <span className="fm-text-xs fm-text-muted">{complaint.createdDate}</span>
        </div>
      </div>

      <p className="fm-text-lg fm-text-secondary fm-mb-md" style={{ lineHeight: '1.5', margin: '0 0 12px 0' }}>
        {complaint.message}
      </p>

      {insight && (
        <div
          className="fm-card fm-mb-sm"
          style={{
            background: 'rgba(73, 199, 241, 0.08)',
            borderColor: 'rgba(73, 199, 241, 0.25)',
          }}
        >
          <div className="fm-flex fm-justify-between fm-items-center fm-mb-xs">
            <span className="fm-text-sm fm-font-semibold fm-text-primary">관리 포인트</span>
            <span className={`fm-badge ${insight.urgency === 'high' ? 'fm-badge--danger' : insight.urgency === 'medium' ? 'fm-badge--warning' : 'fm-badge--info'}`}>
              {insight.urgency === 'high' ? '즉시 대응' : insight.urgency === 'medium' ? '주의 필요' : '점검 권장'}
            </span>
          </div>
          <p className="fm-text-sm fm-text-secondary" style={{ margin: '0 0 6px 0', lineHeight: 1.5 }}>
            취약 요인: <span className="fm-font-semibold">{SATISFACTION_FACTOR_LABELS[insight.weakestFactor]}</span> ({insight.weakestScore})
          </p>
          <p className="fm-text-sm fm-text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
            {insight.recommendation}
          </p>
        </div>
      )}

      {/* 설득 결과 메시지 */}
      {persuadeResult && (
        <div className={`fm-alert ${persuadeResult.success ? 'fm-alert--success' : 'fm-alert--danger'} fm-mb-sm`}>
          <span className="fm-alert__text fm-font-semibold">
            {persuadeResult.success
              ? '설득에 성공했습니다! 선수가 이적 의사를 철회했습니다.'
              : '설득에 실패했습니다. 선수의 불만이 더욱 커졌습니다.'}
          </span>
        </div>
      )}

      {/* 갈등 해결 결과 메시지 */}
      {conflictResult && (
        <div className={`fm-alert ${conflictResult.success ? 'fm-alert--success' : 'fm-alert--danger'} fm-mb-sm`}>
          <span className="fm-alert__text fm-font-semibold">
            {conflictResult.message}
          </span>
        </div>
      )}

      {/* 상태 표시 (이력 탭) */}
      {complaint.status !== 'active' && (
        <div className="fm-flex fm-items-center fm-gap-sm fm-mb-sm">
          <span className={`fm-badge ${getStatusBadgeClass(complaint.status)}`}>
            {getStatusLabel(complaint.status)}
          </span>
          {complaint.resolution && (
            <span className="fm-text-md fm-text-muted">{getResolutionLabel(complaint.resolution)}</span>
          )}
        </div>
      )}

      {/* 갈등 타입: 해결 방법 선택 UI */}
      {isConflict && onToggleConflictPanel && complaint.status === 'active' && (
        <>
          <div className="fm-flex fm-gap-sm" style={{ justifyContent: 'flex-end' }}>
            <button
              className="fm-btn fm-btn--danger"
              onClick={onToggleConflictPanel}
              aria-expanded={conflictPanelOpen}
              aria-label="갈등 해결 방법 선택 패널 열기"
            >
              {conflictPanelOpen ? '닫기' : '해결 방법 선택'}
            </button>
            {onIgnore && (
              <button className="fm-btn fm-btn--ghost" onClick={onIgnore}>
                무시
              </button>
            )}
          </div>

          {conflictPanelOpen && onConflictResolve && (
            <div className="fm-card fm-mt-md">
              <p className="fm-text-lg fm-font-semibold fm-text-primary fm-mb-md" style={{ margin: '0 0 12px 0' }}>
                갈등 해결 방법
              </p>
              <div className="fm-grid fm-grid--3">
                <button
                  className="fm-card fm-card--clickable fm-flex-col fm-items-center fm-gap-sm"
                  onClick={() => onConflictResolve('team_talk')}
                  disabled={conflictLoading}
                  aria-label="팀 토크로 갈등 해결 시도"
                  style={{ borderColor: 'var(--info)' }}
                >
                  <span className="fm-text-lg fm-font-bold fm-text-primary">팀 토크</span>
                  <span className="fm-text-base fm-text-accent fm-font-semibold">성공률 50%</span>
                  <span className="fm-text-sm fm-text-muted">양측 사기 +3</span>
                </button>
                <button
                  className="fm-card fm-card--clickable fm-flex-col fm-items-center fm-gap-sm"
                  onClick={() => onConflictResolve('mentoring')}
                  disabled={conflictLoading}
                  aria-label="멘토링으로 갈등 해결 시도"
                  style={{ borderColor: '#a78bfa' }}
                >
                  <span className="fm-text-lg fm-font-bold fm-text-primary">멘토링</span>
                  <span className="fm-text-base fm-text-accent fm-font-semibold">성공률 60%</span>
                  <span className="fm-text-sm fm-text-muted">양측 케미 +5</span>
                </button>
                <button
                  className="fm-card fm-card--clickable fm-flex-col fm-items-center fm-gap-sm"
                  onClick={() => onConflictResolve('mediation')}
                  disabled={conflictLoading}
                  aria-label="중재로 갈등 해결 시도"
                  style={{ borderColor: 'var(--success)' }}
                >
                  <span className="fm-text-lg fm-font-bold fm-text-primary">중재</span>
                  <span className="fm-text-base fm-text-accent fm-font-semibold">성공률 70%</span>
                  <span className="fm-text-sm fm-text-muted">사기 +2, 케미 +3</span>
                </button>
              </div>
              {conflictLoading && (
                <p className="fm-text-md fm-text-muted fm-text-center fm-mt-sm">처리 중...</p>
              )}
            </div>
          )}
        </>
      )}

      {/* 일반 불만 액션 버튼 (활성 탭) - 갈등이 아닌 경우만 */}
      {onResolve && onIgnore && !isTransfer && !isConflict && (
        <div className="fm-flex fm-gap-sm" style={{ justifyContent: 'flex-end' }}>
          <button className="fm-btn fm-btn--success" onClick={onResolve}>
            대화하기
          </button>
          <button className="fm-btn fm-btn--ghost" onClick={onIgnore}>
            무시
          </button>
        </div>
      )}

      {/* 이적 요청 전용 액션 버튼 */}
      {isTransfer && onAllowTransfer && onDenyTransfer && onPersuadeTransfer && (
        <div className="fm-flex fm-gap-sm" style={{ justifyContent: 'flex-end' }}>
          <button className="fm-btn" style={{ borderColor: 'var(--info)', color: 'var(--info)' }} onClick={onPersuadeTransfer}>
            대화로 설득
          </button>
          <button className="fm-btn" style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }} onClick={onDenyTransfer}>
            이적 거부
          </button>
          <button className="fm-btn fm-btn--danger" onClick={onAllowTransfer}>
            이적 허용
          </button>
        </div>
      )}
    </div>
  );
}

function getResolutionLabel(resolution: string): string {
  switch (resolution) {
    case 'talk': return '대화로 해결';
    case 'promise_starter': return '주전 약속';
    case 'salary_raise': return '연봉 인상';
    case 'allow_transfer': return '이적 허용';
    case 'deny_transfer': return '이적 거부';
    case 'persuade_success': return '설득 성공';
    case 'persuade_fail': return '설득 실패';
    case 'team_talk': return '팀 토크로 해결';
    case 'mentoring': return '멘토링으로 해결';
    case 'mediation': return '중재로 해결';
    default: return resolution;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'resolved': return '해결됨';
    case 'ignored': return '무시됨';
    case 'escalated': return '확대됨';
    default: return status;
  }
}
