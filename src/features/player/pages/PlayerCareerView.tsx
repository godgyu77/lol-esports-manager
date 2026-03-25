/**
 * 선수 모드 커리어 페이지
 * - 커리어 타임라인 (팀, 시즌, 업적)
 * - 트로피 캐비닛
 * - 개인 기록
 * - 커리어 마일스톤
 */

import { useState, useEffect } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getDatabase } from '../../../db/database';

interface CareerEntry {
  season: string;
  team: string;
  games: number;
  wins: number;
  losses: number;
  standing: number;
  playoffResult: string | null;
}

interface Trophy {
  name: string;
  year: number;
  team: string;
  type: 'champion' | 'finalist' | 'mvp' | 'individual';
}

interface PersonalRecord {
  category: string;
  value: number;
  label: string;
}

interface Milestone {
  title: string;
  description: string;
  achieved: boolean;
  progress: number;
  target: number;
}

// DB Row 타입
interface CareerStatsRow {
  player_id: string;
  team_id: string | null;
  total_games: number;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
  total_cs: number;
  total_damage: number;
}

interface SeasonStatRow {
  season_id: number;
  year: number;
  split: string;
  games: number;
  wins: number;
  team_name: string | null;
}

interface AwardRow {
  award_type: string;
  award_name: string | null;
  season_id: number;
  year: number | null;
  team_name: string | null;
}

interface MaxValueRow {
  v: number | null;
}

function getTrophyBadgeClass(type: string): string {
  switch (type) {
    case 'champion': return 'fm-badge--warning';
    case 'finalist': return 'fm-badge--default';
    case 'mvp': return 'fm-badge--accent';
    case 'individual': return 'fm-badge--info';
    default: return 'fm-badge--default';
  }
}

function getTrophyIcon(type: string): string {
  switch (type) {
    case 'champion': return '\u{1F3C6}';
    case 'finalist': return '\u{1F948}';
    case 'mvp': return '\u2B50';
    case 'individual': return '\u{1F3C5}';
    default: return '\u{1F4CB}';
  }
}

function getProgressBarClass(percent: number): string {
  if (percent >= 80) return 'fm-bar__fill--green';
  if (percent >= 50) return 'fm-bar__fill--yellow';
  return 'fm-bar__fill--blue';
}

export function PlayerCareerView() {
  const save = useGameStore((s) => s.save);
  const [career, setCareer] = useState<CareerEntry[]>([]);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'trophies' | 'records' | 'milestones'>('timeline');
  const [isLoading, setIsLoading] = useState(true);
  const [totalGames, setTotalGames] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!save) return;
      setIsLoading(true);
      try {
        const db = await getDatabase();

        // 유저 선수 조회
        const userRows = await db.select<{ id: string; name: string; team_id: string; age: number; career_games: number }[]>(
          'SELECT id, name, team_id, age, COALESCE(career_games, 0) as career_games FROM players WHERE is_user_player = 1 LIMIT 1',
        );
        if (userRows.length === 0) { setIsLoading(false); return; }
        const player = userRows[0];
        setTotalGames(player.career_games);

        // 커리어 스탯 (player_career_stats)
        const careerRows = await db.select<CareerStatsRow[]>(
          'SELECT * FROM player_career_stats WHERE player_id = $1',
          [player.id],
        );
        const careerStats = careerRows[0];

        // 시즌별 경기 기록 (매치 기반 집계)
        const seasonRows = await db.select<SeasonStatRow[]>(
          `SELECT m.season_id,
                  s.year, s.split,
                  COUNT(DISTINCT m.id) as games,
                  SUM(CASE
                    WHEN (m.team_home_id = pgs.team_id AND m.score_home > m.score_away)
                      OR (m.team_away_id = pgs.team_id AND m.score_away > m.score_home) THEN 1
                    ELSE 0 END) as wins,
                  t.name as team_name
           FROM player_game_stats pgs
           JOIN matches m ON m.id = pgs.match_id
           JOIN seasons s ON s.id = m.season_id
           JOIN players p ON p.id = pgs.player_id
           LEFT JOIN teams t ON t.id = p.team_id
           WHERE pgs.player_id = $1
           GROUP BY m.season_id
           ORDER BY m.season_id DESC`,
          [player.id],
        );

        setCareer(seasonRows.map((r) => ({
          season: `${r.year} ${r.split === 'spring' ? '\uC2A4\uD504\uB9C1' : '\uC11C\uBA38'}`,
          team: r.team_name ?? '',
          games: r.games ?? 0,
          wins: r.wins ?? 0,
          losses: (r.games ?? 0) - (r.wins ?? 0),
          standing: 0,
          playoffResult: null,
        })));

        // 수상 기록 (awards 테이블)
        const awardRows = await db.select<AwardRow[]>(
          `SELECT a.award_type, a.award_name, a.season_id, s.year, t.name as team_name
           FROM awards a
           LEFT JOIN seasons s ON s.id = a.season_id
           LEFT JOIN teams t ON t.id = a.team_id
           WHERE a.player_id = $1
           ORDER BY a.season_id DESC`,
          [player.id],
        );

        setTrophies(awardRows.map((r) => ({
          name: r.award_name ?? r.award_type,
          year: r.year ?? 0,
          team: r.team_name ?? '',
          type: r.award_type === 'champion' ? 'champion'
            : r.award_type === 'mvp' ? 'mvp'
            : r.award_type === 'all_pro' ? 'individual'
            : 'individual',
        })));

        // 개인 기록 (player_game_stats 기반)
        const maxKills = await db.select<MaxValueRow[]>(
          'SELECT MAX(kills) as v FROM player_game_stats WHERE player_id = $1', [player.id],
        );
        const maxAssists = await db.select<MaxValueRow[]>(
          'SELECT MAX(assists) as v FROM player_game_stats WHERE player_id = $1', [player.id],
        );
        const maxCs = await db.select<MaxValueRow[]>(
          'SELECT MAX(cs) as v FROM player_game_stats WHERE player_id = $1', [player.id],
        );
        const maxDamage = await db.select<MaxValueRow[]>(
          'SELECT MAX(damage_dealt) as v FROM player_game_stats WHERE player_id = $1', [player.id],
        );

        setRecords([
          { category: '\uCD5C\uB2E4 \uD0AC', value: maxKills[0]?.v ?? 0, label: '\uB2E8\uC77C \uACBD\uAE30 \uCD5C\uB2E4 \uD0AC' },
          { category: '\uCD5C\uB2E4 \uC5B4\uC2DC', value: maxAssists[0]?.v ?? 0, label: '\uB2E8\uC77C \uACBD\uAE30 \uCD5C\uB2E4 \uC5B4\uC2DC\uC2A4\uD2B8' },
          { category: '\uCD5C\uB2E4 CS', value: maxCs[0]?.v ?? 0, label: '\uB2E8\uC77C \uACBD\uAE30 \uCD5C\uB2E4 CS' },
          { category: '\uCD5C\uB2E4 \uB370\uBBF8\uC9C0', value: maxDamage[0]?.v ?? 0, label: '\uB2E8\uC77C \uACBD\uAE30 \uCD5C\uB2E4 \uB370\uBBF8\uC9C0' },
        ]);

        // 마일스톤 (커리어 스탯 기반)
        const totalK = careerStats?.total_kills ?? 0;
        const totalG = player.career_games;
        const totalA = careerStats?.total_assists ?? 0;

        setMilestones([
          { title: '\uD504\uB85C \uB370\uBDB0', description: '\uCCAB \uD504\uB85C \uACBD\uAE30 \uCD9C\uC804', achieved: totalG >= 1, progress: Math.min(totalG, 1), target: 1 },
          { title: '100\uACBD\uAE30 \uCD9C\uC804', description: '\uD1B5\uC0B0 100\uACBD\uAE30 \uB2EC\uC131', achieved: totalG >= 100, progress: totalG, target: 100 },
          { title: '300\uACBD\uAE30 \uCD9C\uC804', description: '\uD1B5\uC0B0 300\uACBD\uAE30 \uB2EC\uC131', achieved: totalG >= 300, progress: totalG, target: 300 },
          { title: '500\uD0AC \uB2EC\uC131', description: '\uD1B5\uC0B0 500\uBC88\uC9F8 \uD0AC', achieved: totalK >= 500, progress: totalK, target: 500 },
          { title: '1000\uD0AC \uB2EC\uC131', description: '\uD1B5\uC0B0 1000\uBC88\uC9F8 \uD0AC', achieved: totalK >= 1000, progress: totalK, target: 1000 },
          { title: '500\uC5B4\uC2DC \uB2EC\uC131', description: '\uD1B5\uC0B0 500\uBC88\uC9F8 \uC5B4\uC2DC\uC2A4\uD2B8', achieved: totalA >= 500, progress: totalA, target: 500 },
        ]);
      } catch (e) {
        console.warn('[PlayerCareerView] load failed:', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [save]);

  if (isLoading) return <div className="fm-text-secondary fm-text-md">커리어 로딩 중...</div>;

  const achievedCount = milestones.filter((m) => m.achieved).length;

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">커리어</h1>
      </div>

      {/* 커리어 요약 */}
      <div className="fm-grid fm-grid--4 fm-mb-md">
        <div className="fm-card fm-text-center">
          <div className="fm-stat">
            <span className="fm-stat__label">총 경기</span>
            <span className="fm-stat__value">{totalGames}</span>
          </div>
        </div>
        <div className="fm-card fm-text-center">
          <div className="fm-stat">
            <span className="fm-stat__label">시즌 수</span>
            <span className="fm-stat__value fm-text-info">{career.length}</span>
          </div>
        </div>
        <div className="fm-card fm-text-center">
          <div className="fm-stat">
            <span className="fm-stat__label">수상 경력</span>
            <span className="fm-stat__value fm-text-accent">{trophies.length}개</span>
          </div>
        </div>
        <div className="fm-card fm-text-center">
          <div className="fm-stat">
            <span className="fm-stat__label">마일스톤</span>
            <span className="fm-stat__value fm-text-success">{achievedCount}/{milestones.length}</span>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="fm-tabs" role="tablist">
        {([
          { key: 'timeline', label: '시즌 기록' },
          { key: 'trophies', label: '트로피' },
          { key: 'records', label: '개인 기록' },
          { key: 'milestones', label: '마일스톤' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`fm-tab ${activeTab === tab.key ? 'fm-tab--active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 시즌 기록 */}
      {activeTab === 'timeline' && (
        <div className="fm-panel">
          <div className="fm-panel__body--flush">
            {career.length === 0 ? (
              <div className="fm-panel__body">
                <p className="fm-text-muted fm-text-md fm-text-center">시즌 기록이 없습니다.</p>
              </div>
            ) : (
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th>시즌</th>
                    <th>팀</th>
                    <th className="text-center">경기</th>
                    <th className="text-center">승</th>
                    <th className="text-center">패</th>
                  </tr>
                </thead>
                <tbody>
                  {career.map((entry, i) => (
                    <tr key={i}>
                      <td className="fm-cell--name">{entry.season}</td>
                      <td>{entry.team}</td>
                      <td className="text-center">{entry.games}</td>
                      <td className="text-center fm-cell--green">{entry.wins}</td>
                      <td className="text-center fm-cell--red">{entry.losses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 트로피 */}
      {activeTab === 'trophies' && (
        <div className="fm-panel">
          <div className="fm-panel__body">
            {trophies.length === 0 ? (
              <div className="fm-text-center fm-p-lg">
                <p className="fm-text-secondary fm-text-xl">아직 수상 경력이 없습니다.</p>
                <p className="fm-text-muted fm-text-md fm-mt-sm">시즌 성과를 통해 트로피를 획득하세요!</p>
              </div>
            ) : (
              <div className="fm-grid fm-grid--2">
                {trophies.map((trophy, i) => (
                  <div key={i} className="fm-card">
                    <div className="fm-flex fm-items-center fm-gap-md">
                      <span className="fm-text-2xl">{getTrophyIcon(trophy.type)}</span>
                      <div className="fm-flex-1">
                        <div className="fm-flex fm-items-center fm-gap-sm">
                          <span className="fm-text-lg fm-font-medium fm-text-primary">{trophy.name}</span>
                          <span className={`fm-badge ${getTrophyBadgeClass(trophy.type)}`}>
                            {trophy.type === 'champion' ? '우승' : trophy.type === 'mvp' ? 'MVP' : '개인상'}
                          </span>
                        </div>
                        <p className="fm-text-sm fm-text-muted fm-mt-sm">{trophy.team} | {trophy.year}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 개인 기록 */}
      {activeTab === 'records' && (
        <div className="fm-panel">
          <div className="fm-panel__body">
            {records.length === 0 ? (
              <p className="fm-text-muted fm-text-md fm-text-center">기록 데이터가 없습니다.</p>
            ) : (
              <div className="fm-flex-col fm-gap-sm">
                {records.map((record, i) => (
                  <div key={i} className="fm-card">
                    <div className="fm-flex fm-items-center fm-justify-between">
                      <div className="fm-flex fm-items-center fm-gap-md">
                        <span className="fm-badge fm-badge--accent fm-text-lg fm-font-bold">
                          {record.category.charAt(0)}
                        </span>
                        <span className="fm-text-lg fm-font-medium fm-text-primary">{record.label}</span>
                      </div>
                      <span className="fm-text-xl fm-font-bold fm-text-accent">
                        {record.value.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 마일스톤 */}
      {activeTab === 'milestones' && (
        <div className="fm-panel">
          <div className="fm-panel__body">
            <div className="fm-flex-col fm-gap-sm">
              {milestones.map((milestone, i) => {
                const progressPercent = Math.min((milestone.progress / milestone.target) * 100, 100);
                return (
                  <div key={i} className={`fm-card ${milestone.achieved ? 'fm-card--highlight' : ''}`}>
                    <div className="fm-flex fm-items-center fm-gap-sm fm-mb-sm">
                      {milestone.achieved ? (
                        <span className="fm-badge fm-badge--success">&#x2713;</span>
                      ) : (
                        <span className="fm-badge fm-badge--default">{Math.round(progressPercent)}%</span>
                      )}
                      <div className="fm-flex-1">
                        <p className={`fm-text-lg fm-font-medium ${milestone.achieved ? 'fm-text-success' : 'fm-text-primary'}`}>
                          {milestone.title}
                        </p>
                        <p className="fm-text-xs fm-text-muted">{milestone.description}</p>
                      </div>
                    </div>
                    {!milestone.achieved && (
                      <div className="fm-bar" style={{ marginLeft: '36px' }}>
                        <div className="fm-bar__track">
                          <div
                            className={`fm-bar__fill ${getProgressBarClass(progressPercent)}`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <span className="fm-bar__value" style={{ minWidth: '80px' }}>
                          {milestone.progress.toLocaleString()} / {milestone.target.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
