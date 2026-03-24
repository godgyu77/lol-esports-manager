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
    <div className="fm-content fm-flex-col fm-items-center" style={{ minHeight: '100vh' }}>
      <h1 className="fm-text-2xl fm-font-bold fm-text-primary fm-mb-sm">팀 선택</h1>
      <p className="fm-text-md fm-text-muted fm-mb-lg">
        {mode === 'manager' ? '감독으로 이끌 팀을 선택하세요' : '소속될 팀을 선택하세요'}
      </p>

      {/* 리전 탭 */}
      <div className="fm-tabs fm-mb-lg">
        {REGIONS.map((r) => (
          <button
            key={r.value}
            className={`fm-tab ${selectedRegion === r.value ? 'fm-tab--active' : ''}`}
            onClick={() => setSelectedRegion(r.value)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="fm-flex fm-gap-lg" style={{ maxWidth: 1000, width: '100%' }}>
        {/* 좌측: 팀 그리드 */}
        <div className="fm-flex-1" style={{ minWidth: 0 }}>
          <div className="fm-grid fm-grid--2" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {filteredTeams.map((team) => (
              <button
                key={team.id}
                className={`fm-card fm-card--clickable fm-flex fm-items-center fm-gap-md ${
                  selectedTeam?.id === team.id ? 'fm-card--highlight' : ''
                }`}
                onClick={() => setSelectedTeam(team)}
              >
                <span className="fm-text-xl fm-font-bold fm-text-accent" style={{ minWidth: 40 }}>
                  {team.shortName}
                </span>
                <span className="fm-text-lg fm-text-primary fm-flex-1">{team.name}</span>
                <span className="fm-text-sm fm-text-muted">{team.region}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 우측: 미리보기 패널 */}
        <div className="fm-panel fm-flex-shrink-0" style={{ width: 340, maxHeight: '60vh', overflowY: 'auto' }}>
          {selectedTeam && teamData ? (
            <div>
              <div className="fm-panel__header">
                <span className="fm-panel__title">{teamData.teamName}</span>
              </div>

              <div className="fm-panel__body fm-flex-col fm-gap-md">
                <div className="fm-flex fm-gap-sm">
                  <span className="fm-badge fm-badge--accent">{selectedTeam.region}</span>
                  <span className="fm-badge fm-badge--default">재정 {teamData.financialTier}티어</span>
                </div>

                {/* 재정 */}
                <div>
                  <h3 className="fm-text-xs fm-font-semibold fm-text-muted fm-text-upper fm-mb-sm">재정</h3>
                  <div className="fm-info-row">
                    <span className="fm-info-row__label">예산</span>
                    <span className="fm-info-row__value">{teamData.money}억</span>
                  </div>
                  <div className="fm-info-row">
                    <span className="fm-info-row__label">연간 지원금</span>
                    <span className="fm-info-row__value">{teamData.annualSupport}억</span>
                  </div>
                </div>

                {/* 1군 로스터 */}
                <div>
                  <h3 className="fm-text-xs fm-font-semibold fm-text-muted fm-text-upper fm-mb-sm">1군 로스터</h3>
                  <div className="fm-flex-col fm-gap-xs">
                    {starters.map((p) => (
                      <div key={p.name} className="fm-flex fm-items-center fm-gap-sm fm-p-sm" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)' }}>
                        <span className="fm-text-xs fm-font-bold fm-text-accent" style={{ minWidth: 32 }}>{p.role}</span>
                        <span className="fm-text-md fm-text-primary fm-flex-1">{p.name}</span>
                        <span className="fm-text-md fm-font-bold fm-text-primary">{p.stats.ovr}</span>
                      </div>
                    ))}
                  </div>
                  <div className="fm-text-right fm-text-md fm-text-muted fm-mt-sm">
                    평균 OVR: <strong className="fm-text-primary">{avgOvr}</strong>
                  </div>
                </div>

                {/* 구단 기대치 */}
                <div>
                  <h3 className="fm-text-xs fm-font-semibold fm-text-muted fm-text-upper fm-mb-sm">구단 기대치</h3>
                  <span className="fm-text-xl fm-font-bold fm-text-accent">{getExpectation(teamData.financialTier)}</span>
                </div>

                <button className="fm-btn fm-btn--primary fm-btn--lg" style={{ width: '100%' }} onClick={handleStart}>
                  이 팀으로 시작 →
                </button>
              </div>
            </div>
          ) : (
            <div className="fm-panel__body fm-flex fm-items-center fm-justify-center fm-text-muted fm-text-lg fm-text-center" style={{ minHeight: 300 }}>
              <p>팀을 선택하면 상세 정보가 표시됩니다</p>
            </div>
          )}
        </div>
      </div>

      <button className="fm-btn fm-btn--ghost fm-mt-lg" onClick={() => navigate('/mode-select')}>
        ← 돌아가기
      </button>
    </div>
  );
}
