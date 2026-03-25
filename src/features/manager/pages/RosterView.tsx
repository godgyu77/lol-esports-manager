/**
 * 로스터 관리 뷰
 * - 탭 네비게이션 셸
 * - 로스터 / 케미스트리 / 만족도 탭 컴포넌트 렌더링
 */

import { useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { RosterTab } from './roster/RosterTab';
import { ChemistryTab } from './roster/ChemistryTab';
import { SatisfactionTab } from './roster/SatisfactionTab';

type RosterTabKey = 'roster' | 'chemistry' | 'satisfaction';

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

  const userTeam = teams.find((t) => t.id === save?.userTeamId);

  if (!userTeam) {
    return <p className="fm-text-muted fm-text-md">데이터를 불러오는 중...</p>;
  }

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">로스터 관리</h1>
      </div>

      {/* 탭 네비게이션 */}
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

      {activeTab === 'roster' && (
        <RosterTab userTeam={userTeam} teams={teams} setTeams={setTeams} />
      )}
      {activeTab === 'chemistry' && (
        <ChemistryTab teamId={userTeam.id} />
      )}
      {activeTab === 'satisfaction' && (
        <SatisfactionTab teamId={userTeam.id} />
      )}
    </div>
  );
}
