import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/gameStore';
import { LCK_TEAMS, LCS_TEAMS, LEC_TEAMS, LPL_TEAMS } from '../../data/rosterDb';
import type { TeamData, RosterPlayer } from '../../data/rosterDb';
import type { Region } from '../../types';
import { MANAGER_BG_LABELS } from '../../types/manager';
import { initializeNewGame, loadGameIntoStore } from '../../db/initGame';

const TEAM_DATA_MAP: Record<Region, Record<string, TeamData>> = {
  LCK: LCK_TEAMS, LPL: LPL_TEAMS, LEC: LEC_TEAMS, LCS: LCS_TEAMS,
};

function parseTeamId(teamId: string): { region: Region; shortName: string } | null {
  const parts = teamId.split('_');
  if (parts.length < 2) return null;
  const region = parts[0].toUpperCase() as Region;
  const shortName = parts.slice(1).join('_');
  return { region, shortName };
}

function getTeamData(teamId: string): TeamData | null {
  const parsed = parseTeamId(teamId);
  if (!parsed) return null;
  return TEAM_DATA_MAP[parsed.region]?.[parsed.shortName] ?? null;
}

function getTeamRegion(teamId: string): Region | null {
  const parsed = parseTeamId(teamId);
  return parsed?.region ?? null;
}

function getStarterRoster(roster: RosterPlayer[]): RosterPlayer[] {
  return roster.filter((p) => p.div === '1군' && p.name !== 'VACANT' && p.role !== 'SUB');
}

interface SeasonGoal {
  standing: number;
  playoff: boolean;
  international: boolean;
  label: string;
}

function calculateGoal(tier: string): SeasonGoal {
  switch (tier) {
    case 'S': return { standing: 2, playoff: true, international: true, label: '우승 경쟁' };
    case 'A': return { standing: 4, playoff: true, international: false, label: '플레이오프 진출' };
    case 'B': return { standing: 6, playoff: false, international: false, label: '중위권 안착' };
    default: return { standing: 8, playoff: false, international: false, label: '잔류' };
  }
}

function relaxGoal(goal: SeasonGoal): SeasonGoal {
  return {
    standing: Math.min(goal.standing + 2, 10),
    playoff: goal.standing <= 4 ? true : false,
    international: false,
    label: goal.standing <= 2 ? '플레이오프 진출' :
           goal.standing <= 4 ? '중위권 안착' :
           goal.standing <= 6 ? '잔류' : '최하위 방어',
  };
}

export function SeasonGoalView() {
  const navigate = useNavigate();
  const pendingTeamId = useGameStore((s) => s.pendingTeamId);
  const pendingManager = useGameStore((s) => s.pendingManager);
  const pendingPlayer = useGameStore((s) => s.pendingPlayer);
  const mode = useGameStore((s) => s.mode);
  const setLoading = useGameStore((s) => s.setLoading);

  const [negotiated, setNegotiated] = useState(false);
  const [isLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pendingTeamId) {
    return (
      <div style={styles.container}>
        <p style={styles.errorText}>팀이 선택되지 않았습니다.</p>
        <button style={styles.backBtn} onClick={() => navigate('/team-select')}>
          ← 팀 선택으로 돌아가기
        </button>
      </div>
    );
  }

  const teamData = getTeamData(pendingTeamId);
  const region = getTeamRegion(pendingTeamId);

  if (!teamData || !region) {
    return (
      <div style={styles.container}>
        <p style={styles.errorText}>팀 데이터를 찾을 수 없습니다.</p>
        <button style={styles.backBtn} onClick={() => navigate('/team-select')}>
          ← 팀 선택으로 돌아가기
        </button>
      </div>
    );
  }

  const starters = getStarterRoster(teamData.roster);
  const baseGoal = calculateGoal(teamData.financialTier);
  const currentGoal = negotiated ? relaxGoal(baseGoal) : baseGoal;

  const handleAccept = async () => {
    setLocalLoading(true);
    setLoading(true);
    setError(null);

    try {
      const save = await initializeNewGame(mode!, pendingTeamId, pendingPlayer, pendingManager);
      await loadGameIntoStore(save.id);

      if (mode === 'manager') {
        navigate('/manager');
      } else {
        navigate('/player');
      }
    } catch (err) {
      console.error('게임 초기화 실패:', err);
      setError(err instanceof Error ? err.message : '게임 초기화에 실패했습니다');
    } finally {
      setLocalLoading(false);
      setLoading(false);
    }
  };

  const handleNegotiate = () => {
    if (!negotiated) {
      setNegotiated(true);
    }
  };

  const isManagerMode = mode === 'manager';

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>2026 시즌 시작</h1>

      <div style={styles.card}>
        {/* 팀 정보 */}
        <div style={styles.teamHeader}>
          <h2 style={styles.teamName}>{teamData.teamName}</h2>
          <span style={styles.regionTag}>{region}</span>
        </div>

        {/* 감독 프로필 (매니저 모드) */}
        {isManagerMode && pendingManager && (
          <div style={styles.section}>
            <h3 style={styles.sectionLabel}>감독 프로필</h3>
            <div style={styles.profileGrid}>
              <div style={styles.profileRow}>
                <span style={styles.profileLabel}>이름</span>
                <span style={styles.profileValue}>{pendingManager.name}</span>
              </div>
              <div style={styles.profileRow}>
                <span style={styles.profileLabel}>배경</span>
                <span style={styles.profileValue}>{MANAGER_BG_LABELS[pendingManager.background]}</span>
              </div>
              <div style={styles.profileRow}>
                <span style={styles.profileLabel}>전술 지식</span>
                <span style={styles.profileValue}>{pendingManager.stats.tacticalKnowledge}</span>
              </div>
              <div style={styles.profileRow}>
                <span style={styles.profileLabel}>동기부여</span>
                <span style={styles.profileValue}>{pendingManager.stats.motivation}</span>
              </div>
              <div style={styles.profileRow}>
                <span style={styles.profileLabel}>규율</span>
                <span style={styles.profileValue}>{pendingManager.stats.discipline}</span>
              </div>
            </div>
          </div>
        )}

        {/* 로스터 요약 */}
        <div style={styles.section}>
          <h3 style={styles.sectionLabel}>1군 로스터</h3>
          <div style={styles.rosterList}>
            {starters.map((p) => (
              <div key={p.name} style={styles.rosterRow}>
                <span style={styles.rosterPos}>{p.role}</span>
                <span style={styles.rosterName}>{p.name}</span>
                <span style={styles.rosterOvr}>{p.stats.ovr}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 구단 기대치 (매니저 모드만) */}
        {isManagerMode && (
          <div style={styles.section}>
            <h3 style={styles.sectionLabel}>구단 기대치</h3>
            <div style={styles.goalBox}>
              <div style={styles.goalRow}>
                <span style={styles.goalLabel}>목표</span>
                <span style={styles.goalValue}>{currentGoal.label}</span>
              </div>
              <div style={styles.goalRow}>
                <span style={styles.goalLabel}>목표 순위</span>
                <span style={styles.goalValue}>{currentGoal.standing}위 이내</span>
              </div>
              <div style={styles.goalRow}>
                <span style={styles.goalLabel}>플레이오프 진출</span>
                <span style={styles.goalValue}>{currentGoal.playoff ? '필수' : '선택'}</span>
              </div>
              <div style={styles.goalRow}>
                <span style={styles.goalLabel}>국제대회 기대</span>
                <span style={styles.goalValue}>{currentGoal.international ? '있음' : '없음'}</span>
              </div>
            </div>

            {negotiated && (
              <div style={styles.warning}>
                구단 만족도 -10으로 시작합니다
              </div>
            )}
          </div>
        )}

        {error && <p style={styles.errorText}>{error}</p>}

        {/* 버튼 */}
        <div style={styles.actions}>
          {isManagerMode ? (
            <>
              <button
                style={styles.acceptBtn}
                onClick={handleAccept}
                disabled={isLoading}
              >
                {isLoading ? '초기화 중...' : '수락'}
              </button>
              {!negotiated && (
                <button
                  style={styles.negotiateBtn}
                  onClick={handleNegotiate}
                >
                  협상
                </button>
              )}
            </>
          ) : (
            <button
              style={styles.acceptBtn}
              onClick={handleAccept}
              disabled={isLoading}
            >
              {isLoading ? '초기화 중...' : '시작'}
            </button>
          )}
        </div>
      </div>

      <button style={styles.backBtn} onClick={() => navigate('/team-select')}>
        ← 팀 선택으로 돌아가기
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 50%, #0a0a1a 100%)',
    color: '#e0e0e0',
    padding: '40px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '24px',
  },
  card: {
    maxWidth: '540px',
    width: '100%',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #3a3a5c',
    borderRadius: '12px',
    padding: '32px',
  },
  teamHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
  },
  teamName: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    margin: 0,
  },
  regionTag: {
    padding: '4px 10px',
    borderRadius: '4px',
    background: 'rgba(200, 155, 60, 0.15)',
    color: '#c89b3c',
    fontSize: '12px',
    fontWeight: 600,
  },
  section: {
    marginBottom: '20px',
  },
  sectionLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#8a8a9a',
    marginBottom: '8px',
    marginTop: 0,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  profileGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  profileRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
  },
  profileLabel: {
    color: '#8a8a9a',
    fontSize: '13px',
  },
  profileValue: {
    color: '#e0e0e0',
    fontSize: '13px',
    fontWeight: 600,
  },
  rosterList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  rosterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    borderRadius: '4px',
    background: 'rgba(255,255,255,0.02)',
  },
  rosterPos: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#c89b3c',
    minWidth: '32px',
  },
  rosterName: {
    flex: 1,
    fontSize: '13px',
    color: '#e0e0e0',
  },
  rosterOvr: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#f0e6d2',
  },
  goalBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '12px',
    borderRadius: '8px',
    background: 'rgba(200, 155, 60, 0.05)',
    border: '1px solid rgba(200, 155, 60, 0.2)',
  },
  goalRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  goalLabel: {
    color: '#8a8a9a',
    fontSize: '13px',
  },
  goalValue: {
    color: '#f0e6d2',
    fontSize: '13px',
    fontWeight: 600,
  },
  warning: {
    marginTop: '8px',
    padding: '8px 12px',
    borderRadius: '6px',
    background: 'rgba(255, 107, 107, 0.1)',
    border: '1px solid rgba(255, 107, 107, 0.3)',
    color: '#ff6b6b',
    fontSize: '13px',
    textAlign: 'center',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: '14px',
    marginBottom: '12px',
    padding: '8px 16px',
    background: 'rgba(255, 107, 107, 0.1)',
    borderRadius: '6px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    marginTop: '8px',
  },
  acceptBtn: {
    flex: 1,
    padding: '14px',
    border: 'none',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #c89b3c, #a67c2e)',
    color: '#0a0a1a',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  negotiateBtn: {
    flex: 1,
    padding: '14px',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    background: 'transparent',
    color: '#8a8a9a',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  backBtn: {
    marginTop: '32px',
    padding: '10px 20px',
    border: 'none',
    borderRadius: '6px',
    background: 'transparent',
    color: '#6a6a7a',
    fontSize: '14px',
    cursor: 'pointer',
  },
};
