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
import { getPlayerById } from '../../../db/queries';
import type { PlayerComplaint } from '../../../types/complaint';
import { COMPLAINT_TYPE_LABELS, COMPLAINT_SEVERITY_LABELS } from '../../../types/complaint';

type Tab = 'active' | 'history';

const SEVERITY_COLORS: Record<number, string> = {
  1: '#f1c40f', // 노랑
  2: '#e67e22', // 주황
  3: '#e74c3c', // 빨강
};

export function ComplaintsView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);
  const currentDate = useGameStore((s) => s.currentDate);

  const [tab, setTab] = useState<Tab>('active');
  const [activeComplaints, setActiveComplaints] = useState<PlayerComplaint[]>([]);
  const [historyComplaints, setHistoryComplaints] = useState<PlayerComplaint[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userTeamId = save?.userTeamId ?? '';

  const loadData = useCallback(async () => {
    if (!season || !save) return;
    setIsLoading(true);
    setError(null);

    try {
      const [active, history] = await Promise.all([
        getActiveComplaints(userTeamId),
        getComplaintHistory(userTeamId, season.id),
      ]);

      setActiveComplaints(active);
      setHistoryComplaints(history);

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

  const handleResolve = async (complaint: PlayerComplaint) => {
    try {
      await resolveComplaint(
        complaint.id,
        'talk',
        currentDate ?? new Date().toISOString().slice(0, 10),
      );
      await loadData();
    } catch (err) {
      console.error('불만 해결 실패:', err);
    }
  };

  const handleIgnore = async (complaint: PlayerComplaint) => {
    try {
      await ignoreComplaint(complaint.id);
      await loadData();
    } catch (err) {
      console.error('불만 무시 실패:', err);
    }
  };

  const handleAllowTransfer = async (complaint: PlayerComplaint) => {
    try {
      await allowTransfer(
        complaint.id,
        currentDate ?? new Date().toISOString().slice(0, 10),
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
        currentDate ?? new Date().toISOString().slice(0, 10),
      );
      setPersuadeResult({ complaintId: complaint.id, success });
      await loadData();
      // 3초 후 결과 메시지 제거
      setTimeout(() => setPersuadeResult(null), 3000);
    } catch (err) {
      console.error('설득 실패:', err);
    }
  };

  if (isLoading) {
    return <div style={styles.loading}>로딩 중...</div>;
  }

  if (error) {
    return <div style={styles.error}>{error}</div>;
  }

  const displayComplaints = tab === 'active' ? activeComplaints : historyComplaints;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>선수 관리</h1>

      {/* 탭 */}
      <div style={styles.tabContainer}>
        <button
          style={{
            ...styles.tab,
            ...(tab === 'active' ? styles.tabActive : {}),
          }}
          onClick={() => setTab('active')}
        >
          활성 불만 ({activeComplaints.length})
        </button>
        <button
          style={{
            ...styles.tab,
            ...(tab === 'history' ? styles.tabActive : {}),
          }}
          onClick={() => setTab('history')}
        >
          불만 이력
        </button>
      </div>

      {/* 불만 목록 */}
      {displayComplaints.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>
            {tab === 'active'
              ? '현재 활성 불만이 없습니다.'
              : '이번 시즌 불만 이력이 없습니다.'}
          </p>
        </div>
      ) : (
        <div style={styles.cardList}>
          {displayComplaints.map((complaint) => (
            <ComplaintCard
              key={complaint.id}
              complaint={complaint}
              playerName={playerNames[complaint.playerId] ?? '알 수 없음'}
              onResolve={tab === 'active' ? () => handleResolve(complaint) : undefined}
              onIgnore={tab === 'active' ? () => handleIgnore(complaint) : undefined}
              onAllowTransfer={tab === 'active' && complaint.complaintType === 'transfer' ? () => handleAllowTransfer(complaint) : undefined}
              onDenyTransfer={tab === 'active' && complaint.complaintType === 'transfer' ? () => handleDenyTransfer(complaint) : undefined}
              onPersuadeTransfer={tab === 'active' && complaint.complaintType === 'transfer' ? () => handlePersuadeTransfer(complaint) : undefined}
              persuadeResult={persuadeResult?.complaintId === complaint.id ? persuadeResult : null}
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
  onResolve,
  onIgnore,
  onAllowTransfer,
  onDenyTransfer,
  onPersuadeTransfer,
  persuadeResult,
}: {
  complaint: PlayerComplaint;
  playerName: string;
  onResolve?: () => void;
  onIgnore?: () => void;
  onAllowTransfer?: () => void;
  onDenyTransfer?: () => void;
  onPersuadeTransfer?: () => void;
  persuadeResult?: { complaintId: number; success: boolean } | null;
}) {
  const severityColor = SEVERITY_COLORS[complaint.severity] ?? '#f1c40f';
  const isTransfer = complaint.complaintType === 'transfer';

  return (
    <div style={{ ...styles.card, borderLeftColor: severityColor }}>
      <div style={styles.cardHeader}>
        <div style={styles.cardPlayerInfo}>
          <span style={styles.cardPlayerName}>{playerName}</span>
          <span style={{
            ...styles.severityBadge,
            background: `${severityColor}22`,
            color: severityColor,
            borderColor: severityColor,
          }}>
            {COMPLAINT_SEVERITY_LABELS[complaint.severity] ?? '알 수 없음'}
          </span>
        </div>
        <div style={styles.cardMeta}>
          <span style={styles.complaintTypeBadge}>
            {COMPLAINT_TYPE_LABELS[complaint.complaintType] ?? complaint.complaintType}
          </span>
          <span style={styles.cardDate}>{complaint.createdDate}</span>
        </div>
      </div>

      <p style={styles.cardMessage}>{complaint.message}</p>

      {/* 설득 결과 메시지 */}
      {persuadeResult && (
        <div style={{
          padding: '8px 12px',
          marginBottom: '10px',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 600,
          background: persuadeResult.success ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
          color: persuadeResult.success ? '#2ecc71' : '#e74c3c',
        }}>
          {persuadeResult.success
            ? '설득에 성공했습니다! 선수가 이적 의사를 철회했습니다.'
            : '설득에 실패했습니다. 선수의 불만이 더욱 커졌습니다.'}
        </div>
      )}

      {/* 상태 표시 (이력 탭) */}
      {complaint.status !== 'active' && (
        <div style={styles.statusRow}>
          <span style={{
            ...styles.statusBadge,
            ...getStatusStyle(complaint.status),
          }}>
            {getStatusLabel(complaint.status)}
          </span>
          {complaint.resolution && (
            <span style={styles.resolutionText}>{getResolutionLabel(complaint.resolution)}</span>
          )}
        </div>
      )}

      {/* 액션 버튼 (활성 탭) */}
      {onResolve && onIgnore && !isTransfer && (
        <div style={styles.cardActions}>
          <button style={styles.resolveBtn} onClick={onResolve}>
            대화하기
          </button>
          <button style={styles.ignoreBtn} onClick={onIgnore}>
            무시
          </button>
        </div>
      )}

      {/* 이적 요청 전용 액션 버튼 */}
      {isTransfer && onAllowTransfer && onDenyTransfer && onPersuadeTransfer && (
        <div style={styles.cardActions}>
          <button style={styles.persuadeBtn} onClick={onPersuadeTransfer}>
            대화로 설득
          </button>
          <button style={styles.denyTransferBtn} onClick={onDenyTransfer}>
            이적 거부
          </button>
          <button style={styles.allowTransferBtn} onClick={onAllowTransfer}>
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

function getStatusStyle(status: string): React.CSSProperties {
  switch (status) {
    case 'resolved':
      return { background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71', borderColor: '#2ecc71' };
    case 'ignored':
      return { background: 'rgba(149, 165, 166, 0.15)', color: '#95a5a6', borderColor: '#95a5a6' };
    case 'escalated':
      return { background: 'rgba(231, 76, 60, 0.15)', color: '#e74c3c', borderColor: '#e74c3c' };
    default:
      return {};
  }
}

// ─────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '900px',
  },
  loading: {
    color: '#8a8a9a',
    padding: '40px',
    textAlign: 'center',
  },
  error: {
    color: '#e74c3c',
    padding: '40px',
    textAlign: 'center',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#c89b3c',
    marginBottom: '28px',
  },

  // 탭
  tabContainer: {
    display: 'flex',
    gap: '4px',
    marginBottom: '20px',
  },
  tab: {
    padding: '10px 20px',
    border: '1px solid #2a2a4a',
    borderRadius: '6px 6px 0 0',
    background: 'transparent',
    color: '#8a8a9a',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  tabActive: {
    background: '#12122a',
    color: '#c89b3c',
    borderBottomColor: '#12122a',
  },

  // 카드 목록
  cardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    background: '#12122a',
    border: '1px solid #2a2a4a',
    borderLeft: '4px solid #f1c40f',
    borderRadius: '8px',
    padding: '16px 20px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '10px',
  },
  cardPlayerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  cardPlayerName: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#e0e0e0',
  },
  severityBadge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '10px',
    border: '1px solid',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  complaintTypeBadge: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#c89b3c',
    background: 'rgba(200, 155, 60, 0.12)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  cardDate: {
    fontSize: '12px',
    color: '#6a6a7a',
  },
  cardMessage: {
    fontSize: '14px',
    color: '#a0a0b0',
    lineHeight: '1.5',
    margin: '0 0 12px 0',
  },

  // 상태 (이력)
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '4px',
  },
  statusBadge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '10px',
    border: '1px solid',
  },
  resolutionText: {
    fontSize: '13px',
    color: '#8a8a9a',
  },

  // 액션
  cardActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  resolveBtn: {
    padding: '8px 16px',
    border: '1px solid #2ecc71',
    borderRadius: '6px',
    background: 'rgba(46, 204, 113, 0.1)',
    color: '#2ecc71',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'all 0.2s',
  },
  ignoreBtn: {
    padding: '8px 16px',
    border: '1px solid #6a6a7a',
    borderRadius: '6px',
    background: 'transparent',
    color: '#6a6a7a',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'all 0.2s',
  },
  allowTransferBtn: {
    padding: '8px 16px',
    border: '1px solid #e74c3c',
    borderRadius: '6px',
    background: 'rgba(231, 76, 60, 0.1)',
    color: '#e74c3c',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'all 0.2s',
  },
  denyTransferBtn: {
    padding: '8px 16px',
    border: '1px solid #e67e22',
    borderRadius: '6px',
    background: 'rgba(230, 126, 34, 0.1)',
    color: '#e67e22',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'all 0.2s',
  },
  persuadeBtn: {
    padding: '8px 16px',
    border: '1px solid #3498db',
    borderRadius: '6px',
    background: 'rgba(52, 152, 219, 0.1)',
    color: '#3498db',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'all 0.2s',
  },

  // 빈 상태
  emptyState: {
    background: '#12122a',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '40px',
    textAlign: 'center',
  },
  emptyText: {
    color: '#6a6a7a',
    fontSize: '14px',
    margin: 0,
  },
};
