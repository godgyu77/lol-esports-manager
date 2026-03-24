/**
 * 어워드 뷰
 * - 현재 시즌 어워드 목록 (시즌 종료 후)
 * - MVP 후보 순위 (시즌 진행 중 예측)
 * - 포지션별 All-Pro 팀 시각화
 * - 선수 수상 이력
 */

import { useEffect, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getAwardsBySeason, getMvpCandidates } from '../../../engine/award/awardEngine';
import type { Award } from '../../../types/award';
import { AWARD_TYPE_LABELS } from '../../../types/award';
import type { Position } from '../../../types/game';

interface MvpCandidate {
  playerId: string;
  playerName: string;
  teamId: string;
  position: string;
  kda: number;
  score: number;
  games: number;
}

type TabType = 'overview' | 'allpro' | 'candidates';

const POSITION_LABELS: Record<Position, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: 'ADC',
  support: '서포터',
};

export function AwardsView() {
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);

  const [awards, setAwards] = useState<Award[]>([]);
  const [candidates, setCandidates] = useState<MvpCandidate[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!season) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const [awardsData, candidatesData] = await Promise.all([
        getAwardsBySeason(season.id),
        getMvpCandidates(season.id),
      ]);
      if (!cancelled) {
        setAwards(awardsData);
        setCandidates(candidatesData);
        setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [season]);

  if (!season) {
    return <p className="fm-text-muted">시즌 데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p className="fm-text-muted">어워드 데이터를 불러오는 중...</p>;
  }

  const getTeamName = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    return team?.shortName ?? team?.name ?? teamId;
  };

  const getPlayerName = (playerId: string) => {
    for (const team of teams) {
      const player = team.roster?.find((p) => p.id === playerId);
      if (player) return player.name;
    }
    return playerId;
  };

  // 어워드 분류
  const mvpAward = awards.find((a) => a.awardType === 'mvp');
  const rookieAward = awards.find((a) => a.awardType === 'rookie_of_year');
  const allPro1st = awards.filter((a) => a.awardType === 'all_pro_1st');
  const allPro2nd = awards.filter((a) => a.awardType === 'all_pro_2nd');
  const monthlyMvps = awards.filter((a) => a.awardType === 'monthly_mvp');
  const hasSeasonAwards = mvpAward || allPro1st.length > 0;

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">
          {season.year}년 {season.split === 'spring' ? '스프링' : '서머'} 어워드
        </h1>
      </div>

      {/* 탭 네비게이션 */}
      <div className="fm-tabs">
        {([
          ['overview', '시즌 어워드'],
          ['allpro', 'All-Pro Team'],
          ['candidates', 'MVP 레이스'],
        ] as [TabType, string][]).map(([tab, label]) => (
          <button
            key={tab}
            className={`fm-tab ${activeTab === tab ? 'fm-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 시즌 어워드 탭 */}
      {activeTab === 'overview' && (
        <div>
          {!hasSeasonAwards && (
            <div className="fm-panel">
              <div className="fm-panel__body">
                <p className="fm-text-lg fm-text-muted fm-text-center fm-p-lg">
                  시즌 어워드는 시즌 종료 후 산출됩니다. 아래 MVP 레이스 탭에서 현재 순위를 확인하세요.
                </p>
              </div>
            </div>
          )}

          {mvpAward && (
            <div className="fm-panel fm-mb-md">
              <div className="fm-panel__body">
                <div className="fm-flex fm-items-center fm-gap-md fm-mb-md">
                  <span
                    className="fm-flex fm-items-center fm-justify-center fm-font-bold fm-text-lg"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent), #e0c068)',
                      color: 'var(--bg-primary)',
                    }}
                  >
                    MVP
                  </span>
                  <h2 className="fm-text-xl fm-font-bold fm-text-primary">{AWARD_TYPE_LABELS.mvp}</h2>
                </div>
                <div className="fm-flex fm-items-center fm-gap-md" style={{ paddingLeft: 60 }}>
                  <span className="fm-text-2xl fm-font-bold fm-text-primary">
                    {mvpAward.playerId ? getPlayerName(mvpAward.playerId) : '-'}
                  </span>
                  <span className="fm-text-lg fm-text-secondary">
                    {mvpAward.teamId ? getTeamName(mvpAward.teamId) : ''}
                  </span>
                  {mvpAward.value != null && (
                    <span className="fm-text-md fm-text-muted" style={{ marginLeft: 'auto' }}>점수: {mvpAward.value}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {rookieAward && (
            <div className="fm-panel fm-mb-md">
              <div className="fm-panel__body">
                <div className="fm-flex fm-items-center fm-gap-md fm-mb-md">
                  <span
                    className="fm-flex fm-items-center fm-justify-center fm-font-bold fm-text-lg"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--success), #27ae60)',
                      color: 'var(--bg-primary)',
                    }}
                  >
                    ROY
                  </span>
                  <h2 className="fm-text-xl fm-font-bold fm-text-primary">{AWARD_TYPE_LABELS.rookie_of_year}</h2>
                </div>
                <div className="fm-flex fm-items-center fm-gap-md" style={{ paddingLeft: 60 }}>
                  <span className="fm-text-2xl fm-font-bold fm-text-primary">
                    {rookieAward.playerId ? getPlayerName(rookieAward.playerId) : '-'}
                  </span>
                  <span className="fm-text-lg fm-text-secondary">
                    {rookieAward.teamId ? getTeamName(rookieAward.teamId) : ''}
                  </span>
                </div>
              </div>
            </div>
          )}

          {monthlyMvps.length > 0 && (
            <div className="fm-panel">
              <div className="fm-panel__header">
                <span className="fm-panel__title">{AWARD_TYPE_LABELS.monthly_mvp}</span>
              </div>
              <div className="fm-panel__body--flush">
                <div className="fm-table-wrap">
                  <table className="fm-table fm-table--striped">
                    <thead>
                      <tr>
                        <th>구간</th>
                        <th>선수</th>
                        <th>팀</th>
                        <th>KDA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyMvps.map((award, idx) => (
                        <tr key={award.id}>
                          <td>W{idx * 4 + 1}~W{(idx + 1) * 4}</td>
                          <td className="fm-cell--name">
                            {award.playerId ? getPlayerName(award.playerId) : '-'}
                          </td>
                          <td>
                            {award.teamId ? getTeamName(award.teamId) : ''}
                          </td>
                          <td className="fm-cell--accent">
                            {award.value?.toFixed(2) ?? '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* All-Pro Team 탭 */}
      {activeTab === 'allpro' && (
        <div>
          {allPro1st.length === 0 && allPro2nd.length === 0 ? (
            <div className="fm-panel">
              <div className="fm-panel__body">
                <p className="fm-text-lg fm-text-muted fm-text-center fm-p-lg">
                  All-Pro Team은 시즌 종료 후 산출됩니다.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* 1st Team */}
              <div className="fm-panel fm-mb-md">
                <div className="fm-panel__header">
                  <span className="fm-panel__title">All-Pro 1st Team</span>
                </div>
                <div className="fm-panel__body">
                  <div className="fm-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                    {(['top', 'jungle', 'mid', 'adc', 'support'] as Position[]).map((pos) => {
                      const award = allPro1st.find((a) => {
                        if (!a.playerId) return false;
                        for (const team of teams) {
                          const player = team.roster?.find((p) => p.id === a.playerId);
                          if (player && player.position === pos) return true;
                        }
                        return false;
                      });
                      return (
                        <div key={pos} className="fm-card fm-card--highlight fm-flex-col fm-items-center fm-gap-sm">
                          <span className="fm-text-sm fm-text-muted fm-text-upper fm-font-semibold">{POSITION_LABELS[pos]}</span>
                          <span className="fm-text-lg fm-font-semibold fm-text-primary fm-text-center">
                            {award?.playerId ? getPlayerName(award.playerId) : '-'}
                          </span>
                          <span className="fm-text-base fm-text-secondary">
                            {award?.teamId ? getTeamName(award.teamId) : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2nd Team */}
              <div className="fm-panel fm-mb-md">
                <div className="fm-panel__header">
                  <span className="fm-panel__title">All-Pro 2nd Team</span>
                </div>
                <div className="fm-panel__body">
                  <div className="fm-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                    {(['top', 'jungle', 'mid', 'adc', 'support'] as Position[]).map((pos) => {
                      const award = allPro2nd.find((a) => {
                        if (!a.playerId) return false;
                        for (const team of teams) {
                          const player = team.roster?.find((p) => p.id === a.playerId);
                          if (player && player.position === pos) return true;
                        }
                        return false;
                      });
                      return (
                        <div key={pos} className="fm-card fm-flex-col fm-items-center fm-gap-sm">
                          <span className="fm-text-sm fm-text-muted fm-text-upper fm-font-semibold">{POSITION_LABELS[pos]}</span>
                          <span className="fm-text-lg fm-font-semibold fm-text-primary fm-text-center">
                            {award?.playerId ? getPlayerName(award.playerId) : '-'}
                          </span>
                          <span className="fm-text-base fm-text-secondary">
                            {award?.teamId ? getTeamName(award.teamId) : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* MVP 레이스 탭 */}
      {activeTab === 'candidates' && (
        <div>
          {candidates.length === 0 ? (
            <div className="fm-panel">
              <div className="fm-panel__body">
                <p className="fm-text-lg fm-text-muted fm-text-center fm-p-lg">
                  경기 데이터가 부족합니다. 시즌이 진행되면 순위가 표시됩니다.
                </p>
              </div>
            </div>
          ) : (
            <div className="fm-panel">
              <div className="fm-panel__header">
                <span className="fm-panel__title">MVP 후보 순위</span>
              </div>
              <div className="fm-panel__body--flush">
                <div className="fm-table-wrap">
                  <table className="fm-table fm-table--striped">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>선수</th>
                        <th>팀</th>
                        <th>포지션</th>
                        <th>경기</th>
                        <th>KDA</th>
                        <th>MVP 점수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.slice(0, 20).map((c, idx) => (
                        <tr key={c.playerId}>
                          <td className={idx < 3 ? 'fm-cell--gold' : ''}>
                            {idx + 1}
                          </td>
                          <td className="fm-cell--name">
                            {c.playerName}
                          </td>
                          <td>{getTeamName(c.teamId)}</td>
                          <td>{POSITION_LABELS[c.position as Position] ?? c.position}</td>
                          <td>{c.games}</td>
                          <td className="fm-cell--accent">
                            {c.kda.toFixed(2)}
                          </td>
                          <td className="fm-cell--name fm-font-bold">
                            {c.score.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
