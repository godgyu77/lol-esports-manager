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
import { NOTIFICATIONS_INVALIDATED_EVENT } from '../../../engine/news/newsEvents';
import { MainLoopPanel } from '../components/MainLoopPanel';
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
  const [persuadeResult, setPersuadeResult] = useState<{ complaintId: number; success: boolean } | null>(null);
  const [conflictPanelId, setConflictPanelId] = useState<number | null>(null);
  const [conflictResult, setConflictResult] = useState<ConflictResult | null>(null);
  const [conflictLoading, setConflictLoading] = useState(false);

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
      setPlayerInsights(Object.fromEntries(insights.map((insight) => [insight.playerId, insight])));
      window.dispatchEvent(new Event(NOTIFICATIONS_INVALIDATED_EVENT));

      const allComplaints = [...active, ...history];
      const uniquePlayerIds = [...new Set(allComplaints.map((c) => c.playerId))];
      const names: Record<string, string> = {};
      for (const pid of uniquePlayerIds) {
        const player = await getPlayerById(pid);
        if (player) names[pid] = player.name;
      }
      setPlayerNames(names);
    } catch (err) {
      console.error('complaints load failed:', err);
      setError('불만 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [season, save, userTeamId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleResolve = async (complaint: PlayerComplaint) => {
    try {
      await resolveComplaint(complaint.id, 'talk', currentDate ?? '', save?.id);
      await loadData();
    } catch (err) {
      console.error('complaint resolve failed:', err);
    }
  };

  const handleIgnore = async (complaint: PlayerComplaint) => {
    try {
      await ignoreComplaint(complaint.id, save?.id);
      await loadData();
    } catch (err) {
      console.error('complaint ignore failed:', err);
    }
  };

  const handleAllowTransfer = async (complaint: PlayerComplaint) => {
    try {
      await allowTransfer(complaint.id, currentDate ?? '', save?.id);
      await loadData();
    } catch (err) {
      console.error('allow transfer failed:', err);
    }
  };

  const handleDenyTransfer = async (complaint: PlayerComplaint) => {
    try {
      await denyTransfer(complaint.id);
      await loadData();
    } catch (err) {
      console.error('deny transfer failed:', err);
    }
  };

  const handlePersuadeTransfer = async (complaint: PlayerComplaint) => {
    try {
      const success = await persuadeTransfer(complaint.id, currentDate ?? '', save?.id);
      setPersuadeResult({ complaintId: complaint.id, success });
      await loadData();
      setTimeout(() => setPersuadeResult(null), 3000);
    } catch (err) {
      console.error('persuade transfer failed:', err);
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
      console.error('conflict resolve failed:', err);
    } finally {
      setConflictLoading(false);
    }
  };

  const displayComplaints = tab === 'active' ? activeComplaints : historyComplaints;

  if (isLoading) return <div className="fm-text-muted fm-text-center fm-p-lg">불만 데이터를 불러오는 중입니다...</div>;
  if (error) return <div className="fm-text-danger fm-text-center fm-p-lg">{error}</div>;

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">선수 관리</h1>
      </div>

      <MainLoopPanel
        eyebrow="불만 관리"
        title="활성 불만과 누적 이력을 한 화면에서 보고 바로 조치할 수 있게 정리했습니다."
        subtitle="메뉴 배지와 실제 목록이 최대한 같은 타이밍에 맞춰지도록 로딩 시점을 맞췄고, 지금 처리할 항목이 먼저 보이게 구성했습니다."
        insights={[
          {
            label: '활성 불만',
            value: `${activeComplaints.length}건`,
            detail: activeComplaints[0] ? `${playerNames[activeComplaints[0].playerId] ?? '선수'}의 이슈가 가장 먼저 확인됩니다.` : '현재 활성 불만은 없습니다.',
            tone: activeComplaints.length > 0 ? 'warning' : 'success',
          },
          {
            label: '최근 기록',
            value: `${historyComplaints.length}건`,
            detail: historyComplaints.length > 0 ? '해결과 무시 기록을 함께 보며 대응 방식을 점검할 수 있습니다.' : '아직 이번 시즌 이력이 많지 않습니다.',
            tone: 'accent',
          },
          {
            label: '우선 확인',
            value: activeComplaints[0] ? COMPLAINT_TYPE_LABELS[activeComplaints[0].complaintType] : '안정',
            detail: activeComplaints[0] ? activeComplaints[0].description : '즉시 대응이 필요한 불만이 없습니다.',
            tone: activeComplaints[0] ? 'danger' : 'success',
          },
        ]}
        actions={[]}
        note="이 화면은 선수와 직접 관련된 처리 허브입니다. 뉴스는 읽는 곳, 받은편지는 운영 메시지 처리용으로 역할을 분리했습니다."
      />

      <div className="fm-tabs">
        <button className={`fm-tab ${tab === 'active' ? 'fm-tab--active' : ''}`} onClick={() => setTab('active')}>
          활성 불만 ({activeComplaints.length})
        </button>
        <button className={`fm-tab ${tab === 'history' ? 'fm-tab--active' : ''}`} onClick={() => setTab('history')}>
          불만 이력
        </button>
      </div>

      {displayComplaints.length === 0 ? (
        <div className="fm-card fm-text-center fm-p-lg">
          <p className="fm-text-muted fm-text-lg">
            {tab === 'active' ? '현재 활성 불만이 없습니다.' : '이번 시즌 불만 이력이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="fm-flex-col fm-gap-md">
          {displayComplaints.map((complaint) => (
            <ComplaintCard
              key={complaint.id}
              complaint={complaint}
              playerName={playerNames[complaint.playerId] ?? '이름 없음'}
              insight={playerInsights[complaint.playerId]}
              onResolve={tab === 'active' ? () => handleResolve(complaint) : undefined}
              onIgnore={tab === 'active' ? () => handleIgnore(complaint) : undefined}
              onAllowTransfer={tab === 'active' && complaint.complaintType === 'transfer' ? () => handleAllowTransfer(complaint) : undefined}
              onDenyTransfer={tab === 'active' && complaint.complaintType === 'transfer' ? () => handleDenyTransfer(complaint) : undefined}
              onPersuadeTransfer={tab === 'active' && complaint.complaintType === 'transfer' ? () => handlePersuadeTransfer(complaint) : undefined}
              persuadeResult={persuadeResult?.complaintId === complaint.id ? persuadeResult : null}
              isConflict={complaint.complaintType === 'conflict'}
              conflictPanelOpen={conflictPanelId === complaint.id}
              onToggleConflictPanel={tab === 'active' && complaint.complaintType === 'conflict' ? () => setConflictPanelId((prev) => (prev === complaint.id ? null : complaint.id)) : undefined}
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
  return (
    <div className="fm-card">
      <div className="fm-flex fm-justify-between fm-items-center fm-gap-sm fm-mb-sm fm-flex-wrap">
        <div className="fm-flex fm-items-center fm-gap-sm fm-flex-wrap">
          <strong className="fm-text-primary">{playerName}</strong>
          <span className={`fm-badge ${getSeverityBadgeClass(complaint.severity)}`}>{COMPLAINT_SEVERITY_LABELS[complaint.severity]}</span>
          <span className="fm-badge fm-badge--default">{COMPLAINT_TYPE_LABELS[complaint.complaintType]}</span>
          {complaint.status !== 'active' ? <span className={`fm-badge ${getStatusBadgeClass(complaint.status)}`}>{complaint.status}</span> : null}
        </div>
        <span className="fm-text-sm fm-text-muted">{complaint.createdDate}</span>
      </div>

      <p className="fm-text-secondary fm-mb-sm" style={{ marginTop: 0 }}>{complaint.description}</p>

      {insight && (
        <div className="fm-alert fm-alert--info fm-mb-sm">
          <span className="fm-alert__text">
            만족도 {insight.overallSatisfaction} / 가장 약한 항목: {SATISFACTION_FACTOR_LABELS[insight.weakestFactor]} ({insight.weakestScore})
            {' '}· {insight.recommendation}
          </span>
        </div>
      )}

      {persuadeResult && (
        <div className={`fm-alert ${persuadeResult.success ? 'fm-alert--success' : 'fm-alert--danger'} fm-mb-sm`}>
          <span className="fm-alert__text">{persuadeResult.success ? '설득에 성공했습니다.' : '설득에 실패했습니다.'}</span>
        </div>
      )}

      {conflictResult && (
        <div className={`fm-alert ${conflictResult.success ? 'fm-alert--success' : 'fm-alert--danger'} fm-mb-sm`}>
          <span className="fm-alert__text">{conflictResult.message}</span>
        </div>
      )}

      <div className="fm-flex fm-gap-sm fm-flex-wrap">
        {onResolve ? <button className="fm-btn fm-btn--primary fm-btn--sm" onClick={onResolve}>대화로 해결</button> : null}
        {onIgnore ? <button className="fm-btn fm-btn--sm" onClick={onIgnore}>무시</button> : null}
        {onAllowTransfer ? <button className="fm-btn fm-btn--danger fm-btn--sm" onClick={onAllowTransfer}>이적 허용</button> : null}
        {onDenyTransfer ? <button className="fm-btn fm-btn--sm" onClick={onDenyTransfer}>이적 거절</button> : null}
        {onPersuadeTransfer ? <button className="fm-btn fm-btn--info fm-btn--sm" onClick={onPersuadeTransfer}>설득 시도</button> : null}
        {isConflict && onToggleConflictPanel ? <button className="fm-btn fm-btn--info fm-btn--sm" onClick={onToggleConflictPanel}>갈등 중재</button> : null}
      </div>

      {isConflict && conflictPanelOpen && onConflictResolve && (
        <div className="fm-grid fm-grid--3 fm-mt-md">
          <button className="fm-btn fm-btn--sm" disabled={conflictLoading} onClick={() => onConflictResolve('team_talk')}>팀 미팅</button>
          <button className="fm-btn fm-btn--sm" disabled={conflictLoading} onClick={() => onConflictResolve('mentoring')}>멘토링</button>
          <button className="fm-btn fm-btn--sm" disabled={conflictLoading} onClick={() => onConflictResolve('mediation')}>직접 중재</button>
        </div>
      )}
    </div>
  );
}
