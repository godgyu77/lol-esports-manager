import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/gameStore';
import { LCK_TEAMS, LCS_TEAMS, LEC_TEAMS, LPL_TEAMS } from '../../data/rosterDb';
import type { Region } from '../../types';
import { initializeNewGame, loadGameIntoStore } from '../../db/initGame';

// rosterDb에서 팀 목록 생성
interface TeamListItem {
  id: string;
  name: string;
  shortName: string;
  region: Region;
}

function buildTeamList(
  teams: Record<string, { teamName: string }>,
  region: Region,
): TeamListItem[] {
  return Object.entries(teams).map(([key, data]) => ({
    id: `${region.toLowerCase()}_${key}`,
    name: data.teamName,
    shortName: key,
    region,
  }));
}

const ALL_TEAMS: TeamListItem[] = [
  ...buildTeamList(LCK_TEAMS, 'LCK'),
  ...buildTeamList(LPL_TEAMS, 'LPL'),
  ...buildTeamList(LEC_TEAMS, 'LEC'),
  ...buildTeamList(LCS_TEAMS, 'LCS'),
];

const REGIONS: { value: Region | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'LCK', label: 'LCK' },
  { value: 'LPL', label: 'LPL' },
  { value: 'LEC', label: 'LEC' },
  { value: 'LCS', label: 'LCS' },
];

export function TeamSelect() {
  const navigate = useNavigate();
  const mode = useGameStore((s) => s.mode);
  const pendingPlayer = useGameStore((s) => s.pendingPlayer);
  const setLoading = useGameStore((s) => s.setLoading);
  const isLoading = useGameStore((s) => s.isLoading);

  const [selectedRegion, setSelectedRegion] = useState<Region | 'ALL'>('ALL');
  const [error, setError] = useState<string | null>(null);

  const filteredTeams =
    selectedRegion === 'ALL'
      ? ALL_TEAMS
      : ALL_TEAMS.filter((t) => t.region === selectedRegion);

  const selectTeam = async (teamId: string) => {
    setLoading(true);
    setError(null);

    try {
      const save = await initializeNewGame(mode!, teamId, pendingPlayer);
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
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>팀 선택</h1>
      <p style={styles.subtitle}>
        {mode === 'manager' ? '감독으로 이끌 팀을 선택하세요' : '소속될 팀을 선택하세요'}
      </p>

      {error && <p style={styles.error}>{error}</p>}

      {/* 리전 탭 */}
      <div style={styles.tabs}>
        {REGIONS.map((r) => (
          <button
            key={r.value}
            style={{
              ...styles.tab,
              ...(selectedRegion === r.value ? styles.tabActive : {}),
            }}
            onClick={() => setSelectedRegion(r.value)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={styles.loadingContainer}>
          <p style={styles.loadingText}>게임을 초기화하고 있습니다...</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {filteredTeams.map((team) => (
            <button
              key={team.id}
              style={styles.teamCard}
              onClick={() => selectTeam(team.id)}
            >
              <span style={styles.shortName}>{team.shortName}</span>
              <span style={styles.teamName}>{team.name}</span>
              <span style={styles.region}>{team.region}</span>
            </button>
          ))}
        </div>
      )}

      <button style={styles.back} onClick={() => navigate('/mode-select')}>
        ← 돌아가기
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
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#8a8a9a',
    marginBottom: '16px',
  },
  error: {
    color: '#ff6b6b',
    fontSize: '14px',
    marginBottom: '16px',
    padding: '8px 16px',
    background: 'rgba(255, 107, 107, 0.1)',
    borderRadius: '6px',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
  },
  tab: {
    padding: '8px 16px',
    border: '1px solid #3a3a5c',
    borderRadius: '6px',
    background: 'transparent',
    color: '#8a8a9a',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s',
  },
  tabActive: {
    borderColor: '#c89b3c',
    color: '#c89b3c',
    background: 'rgba(200, 155, 60, 0.1)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    maxWidth: '600px',
    width: '100%',
    maxHeight: '60vh',
    overflowY: 'auto',
  },
  teamCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.03)',
    color: '#e0e0e0',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left',
  },
  shortName: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#c89b3c',
    minWidth: '40px',
  },
  teamName: {
    flex: 1,
    fontSize: '14px',
  },
  region: {
    fontSize: '12px',
    color: '#6a6a7a',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
  },
  loadingText: {
    color: '#c89b3c',
    fontSize: '16px',
  },
  back: {
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
