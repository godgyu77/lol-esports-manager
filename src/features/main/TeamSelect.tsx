import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/gameStore';
import { LCK_TEAMS, LCS_TEAMS, LEC_TEAMS, LPL_TEAMS } from '../../data/rosterDb';
import type { TeamData, RosterPlayer } from '../../data/rosterDb';
import type { Region } from '../../types';
import { getTeamIntroMeta } from './introMeta';
import { getDisplayPlayerName } from '../../utils/displayName';
import './introFlow.css';

interface TeamListItem {
  id: string;
  name: string;
  shortName: string;
  region: Region;
}

interface StarterPath {
  key: 'contender' | 'darkhorse' | 'rebuild';
  label: string;
  title: string;
  summary: string;
  audience: string;
  team: TeamListItem;
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

function getAverageStarterOvr(team: TeamListItem): number {
  const teamData = getTeamData(team);
  if (!teamData) return 0;
  const starters = getStarterRoster(teamData.roster);
  if (starters.length === 0) return 0;
  return Math.round(starters.reduce((sum, player) => sum + ovrToNumber(player.stats.ovr), 0) / starters.length);
}

function buildStarterPaths(): StarterPath[] {
  const usedTeamIds = new Set<string>();
  const sortedByOvr = [...ALL_TEAMS].sort((left, right) => getAverageStarterOvr(right) - getAverageStarterOvr(left));
  const contender = sortedByOvr.find((team) => {
    const teamData = getTeamData(team);
    return teamData?.financialTier === 'S';
  }) ?? sortedByOvr[0];

  usedTeamIds.add(contender.id);

  const darkhorsePool = sortedByOvr.filter((team) => {
    const teamData = getTeamData(team);
    const avgOvr = getAverageStarterOvr(team);
    return !usedTeamIds.has(team.id)
      && teamData
      && (teamData.financialTier === 'A' || teamData.financialTier === 'B')
      && avgOvr >= 76
      && avgOvr <= 88;
  });
  const darkhorse = darkhorsePool[Math.floor(darkhorsePool.length / 2)] ?? sortedByOvr.find((team) => !usedTeamIds.has(team.id)) ?? contender;

  usedTeamIds.add(darkhorse.id);

  const rebuild = [...ALL_TEAMS]
    .sort((left, right) => getAverageStarterOvr(left) - getAverageStarterOvr(right))
    .find((team) => !usedTeamIds.has(team.id))
    ?? contender;

  return [
    {
      key: 'contender',
      label: '빠른 시작',
      title: `${contender.name}로 바로 출발`,
      summary: '전력이 탄탄한 팀으로 첫 10분을 압축해서 익히기 좋습니다.',
      audience: '강한 전력으로 루프를 빠르게 익히고 싶은 유저',
      team: contender,
    },
    {
      key: 'darkhorse',
      label: '균형 시작',
      title: `${darkhorse.name}로 리듬 잡기`,
      summary: '운영과 결과를 함께 보는 팀으로 시작하면 부담이 적습니다.',
      audience: '균형 있는 시즌 운영을 먼저 익히고 싶은 유저',
      team: darkhorse,
    },
    {
      key: 'rebuild',
      label: '도전 시작',
      title: `${rebuild.name}로 천천히 쌓기`,
      summary: '리빌딩 팀으로 출발하면 성장과 재건 흐름이 더 선명합니다.',
      audience: '장기 성장과 팀 재건을 즐기는 유저',
      team: rebuild,
    },
  ];
}

const STARTER_PATHS = buildStarterPaths();

export function TeamSelect() {
  const navigate = useNavigate();
  const mode = useGameStore((s) => s.mode);
  const setPendingTeamId = useGameStore((s) => s.setPendingTeamId);

  const [selectedRegion, setSelectedRegion] = useState<Region>('LCK');
  const [selectedTeam, setSelectedTeam] = useState<TeamListItem | null>(null);

  const handleStarterPath = (team: TeamListItem) => {
    setSelectedRegion(team.region);
    setSelectedTeam(team);
  };

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
          <div className="fm-panel__body">
            <div className="fm-text-xs fm-font-semibold fm-text-accent fm-text-upper fm-mb-sm">팀 입단 브리핑</div>
            <h1 className="fm-text-2xl fm-font-bold fm-text-primary" style={{ margin: 0 }}>첫 10분에 고를 팀부터 정해보세요</h1>
            <p className="fm-text-md fm-text-muted fm-mt-sm" style={{ lineHeight: 1.7 }}>
              {mode === 'manager'
                ? '위의 추천 패스를 누르면 시즌 목표와 운영 리듬이 바로 이어집니다.'
                : '어떤 팀에서 커리어를 시작하느냐에 따라 성장 속도와 경쟁 환경이 크게 달라집니다.'}
            </p>
          </div>
        </header>

        <section className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">추천 스타트 패스</span>
          </div>
          <div className="fm-panel__body">
            <div className="intro-card-grid intro-card-grid--3">
              {STARTER_PATHS.map((path) => (
                <button
                  key={path.key}
                  type="button"
                  className={`fm-card fm-card--clickable fm-flex-col fm-gap-sm ${
                    selectedTeam?.id === path.team.id ? 'fm-card--highlight' : ''
                  }`}
                  onClick={() => handleStarterPath(path.team)}
                  aria-label={`${path.label} ${path.team.name}`}
                >
                  <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm" style={{ flexWrap: 'wrap' }}>
                    <span className="fm-badge fm-badge--accent">{path.label}</span>
                    <span className="fm-text-xs fm-text-muted">{path.team.region}</span>
                  </div>
                  <div className="fm-text-lg fm-font-semibold fm-text-primary">{path.title}</div>
                  <p className="fm-text-sm fm-text-muted" style={{ margin: 0, lineHeight: 1.6 }}>
                    {path.summary}
                  </p>
                  <p className="fm-text-xs fm-text-secondary" style={{ margin: 0, lineHeight: 1.6 }}>
                    추천: {path.audience}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </section>

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

                  <div className="fm-card" data-testid="teamselect-first-session-route">
                    <div className="fm-text-xs fm-font-semibold fm-text-muted fm-text-upper fm-mb-sm">첫 10분 루트</div>
                    <div className="fm-flex-col fm-gap-xs">
                      <div className="fm-text-sm fm-text-primary">1. 이 팀으로 시작하고 시즌 목표를 빠르게 확인합니다.</div>
                      <div className="fm-text-sm fm-text-primary">2. 홈과 DayView에서 오늘 할 일과 다음 경기를 바로 봅니다.</div>
                      <div className="fm-text-sm fm-text-primary">3. 프리매치로 들어가 첫 경기 준비와 드래프트 흐름을 익힙니다.</div>
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
                          <span className="fm-text-md fm-text-primary fm-flex-1">{getDisplayPlayerName(player.name)}</span>
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
                          선택한 팀의 기존 감독은 수석 코치 성격의 핵심 코치로 남고, 사용자가 새 감독으로 부임합니다.
                          기존 코치와 분석 스태프도 함께 남아 시즌 운영과 훈련, 전술 조언을 이어갑니다.
                        </p>
                      </div>
                    </div>
                  </details>

                  <button className="fm-btn fm-btn--primary fm-btn--lg" style={{ width: '100%' }} onClick={handleStart}>
                    이 팀으로 빠르게 시작
                  </button>
                </div>
              </div>
            ) : (
              <div className="fm-panel__body">
                <div className="fm-empty-state fm-empty-state--compact">
                  <div className="fm-empty-state__title">팀을 먼저 골라주세요</div>
                  <p className="fm-empty-state__copy">
                    위 추천 패스를 눌러도 되고, 목록에서 직접 골라도 됩니다.
                  </p>
                </div>
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
