import { useMemo, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import type { Player } from '../../../types';
import { ChemistryTab } from './roster/ChemistryTab';
import { RosterTab } from './roster/RosterTab';
import { SatisfactionTab } from './roster/SatisfactionTab';

type RosterTabKey = 'roster' | 'chemistry' | 'satisfaction';
type RosterPlayer = Player & { division?: 'main' | 'sub' };

const TABS: { key: RosterTabKey; label: string }[] = [
  { key: 'roster', label: '로스터' },
  { key: 'chemistry', label: '케미스트리' },
  { key: 'satisfaction', label: '만족도' },
];

export function RosterView() {
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);
  const setTeams = useGameStore((s) => s.setTeams);

  const [activeTab, setActiveTab] = useState<RosterTabKey>('roster');

  const userTeam = teams.find((team) => team.id === save?.userTeamId);

  const rosterSummary = useMemo(() => {
    if (!userTeam) return null;

    const roster = (userTeam.roster ?? []) as RosterPlayer[];
    const mainRoster = roster.filter((player) => player.division === 'main');
    const reserveCount = Math.max(roster.length - mainRoster.length, 0);
    const mainAverage =
      mainRoster.length > 0
        ? Math.round(
            mainRoster.reduce((sum, player) => sum + getPlayerOvr(player), 0) / mainRoster.length,
          )
        : 0;
    const riskCount = roster.filter((player) => player.stats.consistency <= 60).length;

    return {
      rosterCount: roster.length,
      mainCount: mainRoster.length,
      reserveCount,
      mainAverage,
      riskLabel: riskCount > 0 ? '불만/폼 저하' : '안정적',
      riskSummary:
        riskCount > 0
          ? `${riskCount}명의 컨디션/만족도 점검이 필요합니다.`
          : '현재 로스터 분위기는 안정적입니다.',
      nextActionTitle: riskCount > 0 ? '만족도 확인' : '주전 조합 점검',
      nextActionSummary:
        riskCount > 0
          ? '만족도 탭에서 불만과 컨디션 리스크를 먼저 확인하세요.'
          : mainRoster.length < 5
            ? '주전 구성을 먼저 채워 기본 5인 체계를 안정화하세요.'
            : '로스터 탭에서 주전/서브 조합과 주전 평균을 점검하세요.',
    };
  }, [userTeam]);

  if (!userTeam || !rosterSummary) {
    return <p className="fm-text-muted fm-text-md">데이터를 불러오는 중...</p>;
  }

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">로스터 관리</h1>
      </div>

      <div className="fm-grid fm-grid--4 fm-mb-md" data-testid="roster-priority-strip">
        <SummaryCard
          label="로스터 규모"
          value={`${rosterSummary.rosterCount}명`}
          summary={`주전 ${rosterSummary.mainCount}명, 후보 ${rosterSummary.reserveCount}명`}
        />
        <SummaryCard
          label="주전 평균"
          value={`${rosterSummary.mainAverage}`}
          summary="현재 주전 5인 기준 전력 체감치"
        />
        <SummaryCard
          label="가장 큰 리스크"
          value={rosterSummary.riskLabel}
          summary={rosterSummary.riskSummary}
        />
        <SummaryCard
          label="다음 행동"
          value={rosterSummary.nextActionTitle}
          summary={rosterSummary.nextActionSummary}
        />
      </div>

      <div className="fm-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`fm-tab ${activeTab === tab.key ? 'fm-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            aria-selected={activeTab === tab.key}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'roster' && <RosterTab userTeam={userTeam} teams={teams} setTeams={setTeams} />}
      {activeTab === 'chemistry' && <ChemistryTab teamId={userTeam.id} />}
      {activeTab === 'satisfaction' && <SatisfactionTab teamId={userTeam.id} />}
    </div>
  );
}

function SummaryCard({ label, value, summary }: { label: string; value: string; summary: string }) {
  return (
    <div className="fm-panel">
      <div className="fm-panel__header">
        <span className="fm-panel__title">{label}</span>
      </div>
      <div className="fm-panel__body">
        <strong className="fm-text-lg">{value}</strong>
        <p className="fm-text-muted fm-text-sm fm-mt-xs">{summary}</p>
      </div>
    </div>
  );
}

function getPlayerOvr(player: Player): number {
  const values = [
    player.stats.mechanical,
    player.stats.gameSense,
    player.stats.teamwork,
    player.stats.consistency,
    player.stats.laning,
    player.stats.aggression,
    player.mental.mental,
  ];
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
