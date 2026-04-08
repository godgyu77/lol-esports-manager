import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/gameStore';
import { LCK_TEAMS, LCS_TEAMS, LEC_TEAMS, LPL_TEAMS } from '../../data/rosterDb';
import type { TeamData, RosterPlayer } from '../../data/rosterDb';
import type { Region } from '../../types';
import { getTeamIntroMeta } from './introMeta';
import './introFlow.css';

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

const REGIONS: { value: Region; label: string }[] = [
  { value: 'LCK', label: 'LCK' },
  { value: 'LPL', label: 'LPL' },
  { value: 'LEC', label: 'LEC' },
  { value: 'LCS', label: 'LCS' },
];

const TEAM_DATA_MAP: Record<Region, Record<string, TeamData>> = {
  LCK: LCK_TEAMS,
  LPL: LPL_TEAMS,
  LEC: LEC_TEAMS,
  LCS: LCS_TEAMS,
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
    case 'S': return '우승 경쟁';
    case 'A': return '플레이오프 진출';
    case 'B': return '중위권 안착';
    default: return '리빌딩';
  }
}

function getTeamData(team: TeamListItem): TeamData | null {
  return TEAM_DATA_MAP[team.region]?.[team.shortName] ?? null;
}

function getStarterRoster(roster: RosterPlayer[]): RosterPlayer[] {
  return roster.filter((player) => player.div === '1군' && player.name !== 'VACANT' && player.role !== 'SUB');
}

export function TeamSelect() {
  const navigate = useNavigate();
  const mode = useGameStore((s) => s.mode);
  const setPendingTeamId = useGameStore((s) => s.setPendingTeamId);

  const [selectedRegion, setSelectedRegion] = useState<Region>('LCK');
  const [selectedTeam, setSelectedTeam] = useState<TeamListItem | null>(null);

  const teamData = selectedTeam ? getTeamData(selectedTeam) : null;
  const filteredTeams = useMemo(
    () => ALL_TEAMS.filter((team) => team.region === selectedRegion),
    [selectedRegion],
  );
  const starters = useMemo(
    () => (teamData ? getStarterRoster(teamData.roster) : []),
    [teamData],
  );
  const avgOvr = useMemo(
    () => (starters.length > 0
      ? Math.round(starters.reduce((sum, player) => sum + ovrToNumber(player.stats.ovr), 0) / starters.length)
      : 0),
    [starters],
  );
  const teamMeta = selectedTeam && teamData
    ? getTeamIntroMeta({
      teamId: selectedTeam.id,
      teamName: teamData.teamName,
      financialTier: teamData.financialTier,
      region: selectedTeam.region,
      avgOvr,
    })
    : null;

  const handleStart = () => {
    if (!selectedTeam) return;
    setPendingTeamId(selectedTeam.id);
    navigate('/season-goal');
  };

  return (
    <div className="fm-content fm-flex-col fm-items-center intro-page">
      <div className="intro-shell">
        <header className="fm-panel intro-hero intro-panel-soft">
          <div className="fm-panel__body" style={{ padding: 24 }}>
            <div className="fm-text-xs fm-font-semibold fm-text-accent fm-text-upper fm-mb-sm">팀 입단 브리핑</div>
            <h1 className="fm-text-2xl fm-font-bold fm-text-primary" style={{ margin: 0 }}>첫 시즌을 맡을 팀을 선택하세요</h1>
            <p className="fm-text-md fm-text-muted fm-mt-sm" style={{ lineHeight: 1.7 }}>
              {mode === 'manager'
                ? '어떤 팀을 맡느냐에 따라 시즌 압박, 팬 기대, 보드 목표가 모두 달라집니다.'
                : '어떤 팀에서 커리어를 시작하느냐에 따라 성장 속도와 경쟁 환경이 크게 달라집니다.'}
            </p>
          </div>
        </header>

        <div className="fm-tabs">
          {REGIONS.map((region) => (
            <button
              key={region.value}
              className={`fm-tab ${selectedRegion === region.value ? 'fm-tab--active' : ''}`}
              onClick={() => setSelectedRegion(region.value)}
            >
              {region.label}
            </button>
          ))}
        </div>

        <div className="intro-two-column intro-two-column--balanced">
          <section className="fm-panel">
            <div className="fm-panel__header">
              <span className="fm-panel__title">팀 목록</span>
            </div>
            <div className="fm-panel__body">
              <div className="fm-flex-col intro-scroll-panel" style={{ gap: 10 }}>
                {filteredTeams.map((team) => (
                  <button
                    key={team.id}
                    className={`fm-card fm-card--clickable fm-flex fm-items-center fm-gap-md ${
                      selectedTeam?.id === team.id ? 'fm-card--highlight' : ''
                    }`}
                    onClick={() => setSelectedTeam(team)}
                  >
                    <span className="fm-text-xl fm-font-bold fm-text-accent" style={{ minWidth: 44 }}>
                      {team.shortName}
                    </span>
                    <div className="fm-flex-col fm-flex-1" style={{ minWidth: 0 }}>
                      <span className="fm-text-lg fm-text-primary">{team.name}</span>
                      <span className="fm-text-xs fm-text-muted">{team.region}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <aside className="fm-panel intro-sidebar">
            {selectedTeam && teamData && teamMeta ? (
              <div>
                <div className="fm-panel__header">
                  <span className="fm-panel__title">{teamData.teamName}</span>
                  <span className="fm-badge fm-badge--accent">{selectedTeam.region}</span>
                </div>

                <div className="fm-panel__body fm-flex-col fm-gap-md">
                  <div className="fm-flex fm-gap-sm" style={{ flexWrap: 'wrap' }}>
                    <span className="fm-badge fm-badge--accent">{teamMeta.playstyleTag}</span>
                    <span className="fm-badge fm-badge--default">평균 OVR {avgOvr}</span>
                  </div>

                  <div className="fm-card">
                    <div className="fm-text-xs fm-font-semibold fm-text-muted fm-text-upper fm-mb-sm">왜 이 팀인가</div>
                    <p className="fm-text-sm fm-text-primary" style={{ lineHeight: 1.7, margin: '0 0 12px' }}>
                      {teamMeta.openingFocus}
                    </p>
                    <div className="fm-info-row">
                      <span className="fm-info-row__label">시즌 난이도</span>
                      <span className="fm-info-row__value">{teamMeta.seasonDifficulty}</span>
                    </div>
                    <div className="fm-info-row">
                      <span className="fm-info-row__label">팬 기대</span>
                      <span className="fm-info-row__value">{teamMeta.fanExpectation}</span>
                    </div>
                    <div className="fm-info-row">
                      <span className="fm-info-row__label">추천 유저</span>
                      <span className="fm-info-row__value">{teamMeta.recommendedFor}</span>
                    </div>
                    <div className="fm-info-row">
                      <span className="fm-info-row__label">기본 목표</span>
                      <span className="fm-info-row__value">{getExpectation(teamData.financialTier)}</span>
                    </div>
                  </div>

                  <div className="fm-card">
                    <div className="fm-text-xs fm-font-semibold fm-text-muted fm-text-upper fm-mb-sm">주전 5인 요약</div>
                    <div className="fm-flex-col fm-gap-xs">
                      {starters.map((player) => (
                        <div
                          key={player.name}
                          className="fm-flex fm-items-center fm-gap-sm fm-p-sm"
                          style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)' }}
                        >
                          <span className="fm-text-xs fm-font-bold fm-text-accent" style={{ minWidth: 32 }}>{player.role}</span>
                          <span className="fm-text-md fm-text-primary fm-flex-1">{player.name}</span>
                          <span className="fm-text-md fm-font-bold fm-text-primary">{player.stats.ovr}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <details className="intro-detail-disclosure">
                    <summary>상세 브리핑 보기</summary>
                    <div className="fm-flex-col fm-gap-md">
                      <div className="fm-card">
                        <div className="fm-text-xs fm-font-semibold fm-text-muted fm-text-upper fm-mb-sm">보드 서사</div>
                        <p className="fm-text-sm fm-text-primary" style={{ lineHeight: 1.7, margin: 0 }}>
                          {teamMeta.boardStoryline}
                        </p>
                        <p className="fm-text-sm fm-text-muted fm-mt-sm" style={{ lineHeight: 1.7 }}>
                          라이벌 구도: {teamMeta.rivalry}
                        </p>
                      </div>

                      <div className="fm-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="fm-text-xs fm-font-semibold fm-text-muted fm-text-upper fm-mb-sm">감독 합류 규칙</div>
                        <p className="fm-text-sm fm-text-secondary" style={{ margin: 0, lineHeight: 1.6 }}>
                          선택한 팀의 기존 감독 자리는 비워지고, 사용자가 새 감독으로 부임합니다.
                          기존 코치와 분석 스태프는 팀에 남아 그대로 시즌 운영을 이어갑니다.
                        </p>
                      </div>
                    </div>
                  </details>

                  <button className="fm-btn fm-btn--primary fm-btn--lg" style={{ width: '100%' }} onClick={handleStart}>
                    이 팀으로 부임 준비
                  </button>
                </div>
              </div>
            ) : (
              <div className="fm-panel__body fm-flex fm-items-center fm-justify-center fm-text-muted fm-text-lg fm-text-center" style={{ minHeight: 300 }}>
                <p>팀을 선택하면 난이도, 팬 기대, 주전 5인 요약만 먼저 표시됩니다.</p>
              </div>
            )}
          </aside>
        </div>
      </div>

      <button className="fm-btn fm-btn--ghost intro-back" onClick={() => navigate('/manager-create')}>
        감독 생성으로 돌아가기
      </button>
    </div>
  );
}
