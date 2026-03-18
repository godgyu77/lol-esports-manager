import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/gameStore';
import { LCK_TEAMS, LCS_TEAMS, LEC_TEAMS, LPL_TEAMS } from '../../data/rosterDb';
import type { TeamData, RosterPlayer } from '../../data/rosterDb';
import type { Region } from '../../types';

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

const TEAM_DATA_MAP: Record<Region, Record<string, TeamData>> = {
  LCK: LCK_TEAMS, LPL: LPL_TEAMS, LEC: LEC_TEAMS, LCS: LCS_TEAMS,
};

const OVR_TO_NUMBER: Record<string, number> = {
  'S+': 97, 'S': 94, 'S-': 91,
  'A+': 88, 'A': 85, 'A-': 82,
  'B+': 79, 'B': 75, 'B-': 72,
  'C+': 68, 'C': 65, 'C-': 62,
};

function ovrToNumber(ovr: string): number {
  return OVR_TO_NUMBER[ovr] ?? 0;
}

function getExpectation(tier: string): string {
  switch (tier) {
    case 'S': return '우승';
    case 'A': return '플레이오프';
    case 'B': return '중위권';
    default: return '잔류';
  }
}

function getTeamData(team: TeamListItem): TeamData | null {
  const regionTeams = TEAM_DATA_MAP[team.region];
  return regionTeams?.[team.shortName] ?? null;
}

function getStarterRoster(roster: RosterPlayer[]): RosterPlayer[] {
  return roster.filter((p) => p.div === '1군' && p.name !== 'VACANT' && p.role !== 'SUB');
}

export function TeamSelect() {
  const navigate = useNavigate();
  const mode = useGameStore((s) => s.mode);
  const setPendingTeamId = useGameStore((s) => s.setPendingTeamId);

  const [selectedRegion, setSelectedRegion] = useState<Region | 'ALL'>('ALL');
  const [selectedTeam, setSelectedTeam] = useState<TeamListItem | null>(null);

  const filteredTeams =
    selectedRegion === 'ALL'
      ? ALL_TEAMS
      : ALL_TEAMS.filter((t) => t.region === selectedRegion);

  const teamData = selectedTeam ? getTeamData(selectedTeam) : null;
  const starters = teamData ? getStarterRoster(teamData.roster) : [];
  const avgOvr = starters.length > 0
    ? Math.round(starters.reduce((sum, p) => sum + ovrToNumber(p.stats.ovr), 0) / starters.length)
    : 0;

  const handleStart = () => {
    if (!selectedTeam) return;
    setPendingTeamId(selectedTeam.id);
    navigate('/season-goal');
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>팀 선택</h1>
      <p style={styles.subtitle}>
        {mode === 'manager' ? '감독으로 이끌 팀을 선택하세요' : '소속될 팀을 선택하세요'}
      </p>

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

      <div style={styles.layout}>
        {/* 좌측: 팀 그리드 */}
        <div style={styles.gridContainer}>
          <div style={styles.grid}>
            {filteredTeams.map((team) => (
              <button
                key={team.id}
                style={{
                  ...styles.teamCard,
                  ...(selectedTeam?.id === team.id ? styles.teamCardSelected : {}),
                }}
                onClick={() => setSelectedTeam(team)}
              >
                <span style={styles.shortName}>{team.shortName}</span>
                <span style={styles.teamName}>{team.name}</span>
                <span style={styles.region}>{team.region}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 우측: 미리보기 패널 */}
        <div style={styles.previewPanel}>
          {selectedTeam && teamData ? (
            <>
              <h2 style={styles.previewTitle}>{teamData.teamName}</h2>
              <div style={styles.previewMeta}>
                <span style={styles.metaTag}>{selectedTeam.region}</span>
                <span style={styles.metaTag}>재정 {teamData.financialTier}티어</span>
              </div>

              <div style={styles.previewSection}>
                <h3 style={styles.sectionLabel}>재정</h3>
                <div style={styles.financeRow}>
                  <span style={styles.financeLabel}>예산</span>
                  <span style={styles.financeValue}>{teamData.money}억</span>
                </div>
                <div style={styles.financeRow}>
                  <span style={styles.financeLabel}>연간 지원금</span>
                  <span style={styles.financeValue}>{teamData.annualSupport}억</span>
                </div>
              </div>

              <div style={styles.previewSection}>
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
                <div style={styles.avgOvr}>
                  평균 OVR: <strong>{avgOvr}</strong>
                </div>
              </div>

              <div style={styles.previewSection}>
                <h3 style={styles.sectionLabel}>구단 기대치</h3>
                <span style={styles.expectation}>{getExpectation(teamData.financialTier)}</span>
              </div>

              <button style={styles.startBtn} onClick={handleStart}>
                이 팀으로 시작 →
              </button>
            </>
          ) : (
            <div style={styles.previewEmpty}>
              <p>팀을 선택하면 상세 정보가 표시됩니다</p>
            </div>
          )}
        </div>
      </div>

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
  layout: {
    display: 'flex',
    gap: '24px',
    maxWidth: '1000px',
    width: '100%',
  },
  gridContainer: {
    flex: 1,
    minWidth: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
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
  teamCardSelected: {
    borderColor: '#c89b3c',
    background: 'rgba(200, 155, 60, 0.1)',
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
  previewPanel: {
    width: '340px',
    flexShrink: 0,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #3a3a5c',
    borderRadius: '12px',
    padding: '24px',
    maxHeight: '60vh',
    overflowY: 'auto',
  },
  previewEmpty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '300px',
    color: '#6a6a7a',
    fontSize: '14px',
    textAlign: 'center',
  },
  previewTitle: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '8px',
    marginTop: 0,
  },
  previewMeta: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
  },
  metaTag: {
    padding: '4px 10px',
    borderRadius: '4px',
    background: 'rgba(200, 155, 60, 0.15)',
    color: '#c89b3c',
    fontSize: '12px',
    fontWeight: 600,
  },
  previewSection: {
    marginBottom: '16px',
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
  financeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
  },
  financeLabel: {
    color: '#8a8a9a',
    fontSize: '13px',
  },
  financeValue: {
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
  avgOvr: {
    marginTop: '8px',
    fontSize: '13px',
    color: '#8a8a9a',
    textAlign: 'right',
  },
  expectation: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#c89b3c',
  },
  startBtn: {
    width: '100%',
    padding: '14px',
    border: 'none',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #c89b3c, #a67c2e)',
    color: '#0a0a1a',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '12px',
    transition: 'all 0.2s',
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
