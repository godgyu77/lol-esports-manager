/**
 * 로스터 관리 뷰
 * - 1군/2군 선수 목록
 * - 1군 ↔ 2군 교체 기능
 * - 선수 스탯 테이블
 * - 케미스트리 탭
 * - 만족도 탭
 */

import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGameStore } from '../../../stores/gameStore';
import { updatePlayerDivision, updateTeamPlayStyle } from '../../../db/queries';
import { getDatabase } from '../../../db/database';
import type { Player } from '../../../types/player';
import type { Position } from '../../../types/game';
import type { PlayStyle } from '../../../types/team';
import { PlayerAvatar } from '../../../components/PlayerAvatar';

type RosterTab = 'roster' | 'chemistry' | 'satisfaction';

type Division = 'main' | 'sub';

const PLAY_STYLE_INFO: Record<PlayStyle, {
  name: string;
  icon: string;
  description: string;
  matchup: string;
}> = {
  aggressive: {
    name: '공격형',
    icon: '\u2694\uFE0F',
    description: '적극적인 교전과 솔로킬로 초반 주도권 확보',
    matchup: '\u25B6 스플릿에 강함 | \u25C0 운영형에 약함',
  },
  controlled: {
    name: '운영형',
    icon: '\uD83D\uDEE1\uFE0F',
    description: '안정적인 시야와 오브젝트 중심의 매크로 운영',
    matchup: '\u25B6 공격형에 강함 | \u25C0 스플릿에 약함',
  },
  split: {
    name: '스플릿',
    icon: '\uD83D\uDDE1\uFE0F',
    description: '사이드 라인 압박으로 맵 주도권 분산',
    matchup: '\u25B6 운영형에 강함 | \u25C0 공격형에 약함',
  },
};

const POSITION_LABELS: Record<string, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: '원딜',
  support: '서포터',
};

const POSITION_ORDER = ['top', 'jungle', 'mid', 'adc', 'support'];

const POSITION_BADGE_MAP: Record<string, string> = {
  top: 'top',
  jungle: 'jgl',
  mid: 'mid',
  adc: 'adc',
  support: 'sup',
};

function sortByPosition<T extends { position: string }>(arr: T[]): T[] {
  return [...arr].sort(
    (a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position),
  );
}

function getOvr(player: Player): number {
  const s = player.stats;
  return Math.round(
    (s.mechanical + s.gameSense + s.teamwork + s.consistency + s.laning + s.aggression) / 6,
  );
}

function getOvrClass(ovr: number): string {
  if (ovr >= 90) return 'fm-ovr fm-ovr--elite';
  if (ovr >= 80) return 'fm-ovr fm-ovr--high';
  if (ovr >= 70) return 'fm-ovr fm-ovr--mid';
  return 'fm-ovr fm-ovr--low';
}

/* ── 케미스트리 탭 타입 ── */
interface ChemistryRow {
  player_a_id: string;
  player_b_id: string;
  player_a_name: string;
  player_b_name: string;
  chemistry_score: number;
}

/* ── 만족도 탭 타입 ── */
interface SatisfactionRow {
  player_id: string;
  player_name: string;
  position: string;
  overall_satisfaction: number;
  playtime_satisfaction: number;
  salary_satisfaction: number;
  team_performance_satisfaction: number;
  personal_performance_satisfaction: number;
  role_clarity: number;
  team_chemistry_satisfaction: number;
}

const SATISFACTION_LABELS: Record<string, string> = {
  playtime_satisfaction: '출전 시간',
  salary_satisfaction: '연봉',
  team_performance_satisfaction: '팀 성적',
  personal_performance_satisfaction: '개인 성적',
  role_clarity: '역할 명확도',
  team_chemistry_satisfaction: '팀 케미',
};

function getBarFillClass(value: number): string {
  if (value >= 70) return 'fm-bar__fill fm-bar__fill--green';
  if (value >= 40) return 'fm-bar__fill fm-bar__fill--yellow';
  return 'fm-bar__fill fm-bar__fill--red';
}

function getChemistryColor(score: number): string {
  if (score >= 80) return '#50c878';
  if (score >= 50) return '#f0c040';
  if (score >= 30) return '#e8922d';
  return '#dc3c3c';
}

function getSatisfactionColor(value: number): string {
  if (value >= 70) return '#50c878';
  if (value >= 40) return '#f0c040';
  return '#dc3c3c';
}

export function RosterView() {
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);
  const setTeams = useGameStore((s) => s.setTeams);

  const [activeTab, setActiveTab] = useState<RosterTab>('roster');
  const [swapSource, setSwapSource] = useState<{ id: string; division: Division } | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  /* ── 케미스트리 데이터 ── */
  const [chemistryRows, setChemistryRows] = useState<ChemistryRow[]>([]);
  const [chemistryLoading, setChemistryLoading] = useState(false);

  /* ── 만족도 데이터 ── */
  const [satisfactionRows, setSatisfactionRows] = useState<SatisfactionRow[]>([]);
  const [satisfactionLoading, setSatisfactionLoading] = useState(false);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  const userTeam = teams.find((t) => t.id === save?.userTeamId);
  const teamId = userTeam?.id;

  // 케미스트리 데이터 로드
  useEffect(() => {
    if (activeTab !== 'chemistry' || !teamId) return;
    let cancelled = false;
    setChemistryLoading(true);
    (async () => {
      try {
        const db = await getDatabase();
        const rows = await db.select<ChemistryRow[]>(
          `SELECT pc.*, p1.name as player_a_name, p2.name as player_b_name
           FROM player_chemistry pc
           JOIN players p1 ON p1.id = pc.player_a_id
           JOIN players p2 ON p2.id = pc.player_b_id
           WHERE p1.team_id = $1 OR p2.team_id = $1
           ORDER BY pc.chemistry_score DESC`,
          [teamId],
        );
        if (!cancelled) setChemistryRows(rows);
      } catch {
        if (!cancelled) setChemistryRows([]);
      } finally {
        if (!cancelled) setChemistryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, teamId]);

  // 만족도 데이터 로드
  useEffect(() => {
    if (activeTab !== 'satisfaction' || !teamId) return;
    let cancelled = false;
    setSatisfactionLoading(true);
    (async () => {
      try {
        const db = await getDatabase();
        const rows = await db.select<SatisfactionRow[]>(
          `SELECT ps.*, p.name as player_name, p.position
           FROM player_satisfaction ps
           JOIN players p ON p.id = ps.player_id
           WHERE p.team_id = $1`,
          [teamId],
        );
        if (!cancelled) setSatisfactionRows(rows);
      } catch {
        if (!cancelled) setSatisfactionRows([]);
      } finally {
        if (!cancelled) setSatisfactionLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, teamId]);

  const handleSwap = useCallback(async (
    playerId: string,
    currentDivision: Division,
  ) => {
    if (!userTeam) return;

    // 첫 번째 클릭: 교체 대상 선택
    if (!swapSource) {
      setSwapSource({ id: playerId, division: currentDivision });
      setMessage(null);
      return;
    }

    // 같은 선수 다시 클릭 → 취소
    if (swapSource.id === playerId) {
      setSwapSource(null);
      setMessage(null);
      return;
    }

    // 두 번째 클릭: 교체 실행
    const sourcePlayer = userTeam.roster.find(p => p.id === swapSource.id);
    const targetPlayer = userTeam.roster.find(p => p.id === playerId);
    if (!sourcePlayer || !targetPlayer) return;

    const sourceDivision = swapSource.division;
    const targetDivision = currentDivision;

    // 같은 디비전 내 교체는 무의미 — 선택 변경
    if (sourceDivision === targetDivision) {
      setSwapSource({ id: playerId, division: currentDivision });
      return;
    }

    setIsSwapping(true);
    try {
      // DB 업데이트
      await updatePlayerDivision(swapSource.id, targetDivision);
      await updatePlayerDivision(playerId, sourceDivision);

      // store 갱신
      const updatedTeams = teams.map(team => {
        if (team.id !== userTeam.id) return team;
        return {
          ...team,
          roster: team.roster.map(p => {
            if (p.id === swapSource.id) {
              return { ...p, division: targetDivision } as typeof p;
            }
            if (p.id === playerId) {
              return { ...p, division: sourceDivision } as typeof p;
            }
            return p;
          }),
        };
      });
      setTeams(updatedTeams);
      setMessage(`${sourcePlayer.name} \u2194 ${targetPlayer.name} 교체 완료`);
    } finally {
      setSwapSource(null);
      setIsSwapping(false);
    }
  }, [swapSource, userTeam, teams, setTeams]);

  // 단일 승격/강등 (반대 디비전에 같은 포지션 선수가 없을 때)
  const handlePromoteDemote = useCallback(async (
    playerId: string,
    currentDivision: Division,
  ) => {
    if (!userTeam) return;
    const newDivision: Division = currentDivision === 'main' ? 'sub' : 'main';

    setIsSwapping(true);
    try {
      await updatePlayerDivision(playerId, newDivision);

      const updatedTeams = teams.map(team => {
        if (team.id !== userTeam.id) return team;
        return {
          ...team,
          roster: team.roster.map(p => {
            if (p.id === playerId) {
              return { ...p, division: newDivision } as typeof p;
            }
            return p;
          }),
        };
      });
      setTeams(updatedTeams);

      const player = userTeam.roster.find(p => p.id === playerId);
      setMessage(`${player?.name} ${newDivision === 'main' ? '1군 승격' : '2군 강등'}`);
    } finally {
      setSwapSource(null);
      setIsSwapping(false);
    }
  }, [userTeam, teams, setTeams]);

  const handlePlayStyleChange = useCallback(async (style: PlayStyle) => {
    if (!userTeam) return;
    await updateTeamPlayStyle(userTeam.id, style);
    const updatedTeams = teams.map(team => {
      if (team.id !== userTeam.id) return team;
      return { ...team, playStyle: style };
    });
    setTeams(updatedTeams);
    setMessage(`팀 전술이 "${PLAY_STYLE_INFO[style].name}"(으)로 변경되었습니다`);
  }, [userTeam, teams, setTeams]);

  if (!userTeam) {
    return <p className="fm-text-muted fm-text-md">데이터를 불러오는 중...</p>;
  }

  const mainRoster = userTeam.roster.filter(
    (p) => (p as { division?: string }).division === 'main',
  );
  const subRoster = userTeam.roster.filter(
    (p) => (p as { division?: string }).division === 'sub',
  );

  const renderTable = (players: typeof userTeam.roster, title: string, division: Division) => (
    <div className="fm-panel fm-mb-md">
      <div className="fm-panel__header">
        <span className="fm-panel__title">{title} ({players.length}명)</span>
      </div>
      <div className="fm-panel__body--flush fm-table-wrap">
        <table className="fm-table fm-table--striped">
          <thead>
            <tr>
              <th>포지션</th>
              <th>이름</th>
              <th>나이</th>
              <th>OVR</th>
              <th>기계</th>
              <th>센스</th>
              <th>팀워크</th>
              <th>일관</th>
              <th>라인</th>
              <th>공격</th>
              <th>멘탈</th>
              <th>계약</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortByPosition(players).map((player) => {
              const avgOvr = getOvr(player);
              const isSelected = swapSource?.id === player.id;
              return (
                <tr
                  key={player.id}
                  className={isSelected ? 'fm-table__row--selected' : ''}
                >
                  <td>
                    <span className={`fm-pos-badge fm-pos-badge--${POSITION_BADGE_MAP[player.position] ?? 'mid'}`}>
                      {POSITION_LABELS[player.position] ?? player.position}
                    </span>
                  </td>
                  <td className="fm-cell--name">
                    <div className="fm-flex fm-items-center fm-gap-sm">
                      <PlayerAvatar
                        position={player.position as Position}
                        nationality={player.nationality}
                        size={28}
                        name={player.name}
                      />
                      <Link to={'/manager/player/' + player.id} className="fm-cell--name" style={{ textDecoration: 'none' }}>
                        {player.name}
                      </Link>
                    </div>
                  </td>
                  <td>{player.age}</td>
                  <td className={getOvrClass(avgOvr)}>{avgOvr}</td>
                  <td>{player.stats.mechanical}</td>
                  <td>{player.stats.gameSense}</td>
                  <td>{player.stats.teamwork}</td>
                  <td>{player.stats.consistency}</td>
                  <td>{player.stats.laning}</td>
                  <td>{player.stats.aggression}</td>
                  <td>{player.mental.mental}</td>
                  <td>{player.contract.contractEndSeason}</td>
                  <td>
                    <div className="fm-flex fm-gap-xs">
                      <button
                        className={`fm-btn fm-btn--sm ${isSelected ? 'fm-btn--primary' : ''}`}
                        onClick={() => handleSwap(player.id, division)}
                        disabled={isSwapping}
                        title="교체할 선수 선택"
                      >
                        {isSelected ? '취소' : '교체'}
                      </button>
                      <button
                        className="fm-btn fm-btn--sm fm-btn--ghost"
                        onClick={() => handlePromoteDemote(player.id, division)}
                        disabled={isSwapping}
                        title={division === 'main' ? '2군으로 강등' : '1군으로 승격'}
                      >
                        {division === 'main' ? '\u2193' : '\u2191'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ── 케미스트리 탭 렌더 ── */
  const renderChemistryTab = () => {
    if (chemistryLoading) {
      return <p className="fm-text-muted fm-text-md">로딩 중...</p>;
    }
    if (chemistryRows.length === 0) {
      return <p className="fm-text-muted fm-text-md">케미스트리 데이터가 없습니다.</p>;
    }

    const avgScore = Math.round(
      chemistryRows.reduce((sum, r) => sum + r.chemistry_score, 0) / chemistryRows.length,
    );
    const highPairs = chemistryRows.filter((r) => r.chemistry_score >= 80);
    const lowPairs = chemistryRows.filter((r) => r.chemistry_score < 30);

    return (
      <>
        {/* 팀 평균 */}
        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__body">
            <div className="fm-flex fm-items-center fm-justify-between">
              <span className="fm-text-lg fm-font-medium fm-text-secondary">팀 평균 케미스트리</span>
              <span className="fm-text-2xl fm-font-bold" style={{ color: getChemistryColor(avgScore) }}>
                {avgScore}
              </span>
            </div>
          </div>
        </div>

        {/* 하이라이트 */}
        {highPairs.length > 0 && (
          <div className="fm-alert fm-alert--success fm-mb-md">
            <div className="fm-flex-col fm-gap-xs">
              <span className="fm-font-semibold fm-text-base">높은 케미 (80+)</span>
              {highPairs.map((r) => (
                <span key={`${r.player_a_id}-${r.player_b_id}`} className="fm-text-base fm-text-secondary">
                  {r.player_a_name} - {r.player_b_name}: <strong className="fm-text-success">{r.chemistry_score}</strong>
                </span>
              ))}
            </div>
          </div>
        )}
        {lowPairs.length > 0 && (
          <div className="fm-alert fm-alert--danger fm-mb-md">
            <div className="fm-flex-col fm-gap-xs">
              <span className="fm-font-semibold fm-text-base">낮은 케미 (30-)</span>
              {lowPairs.map((r) => (
                <span key={`${r.player_a_id}-${r.player_b_id}`} className="fm-text-base fm-text-secondary">
                  {r.player_a_name} - {r.player_b_name}: <strong className="fm-text-danger">{r.chemistry_score}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 전체 테이블 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">전체 케미스트리</span>
          </div>
          <div className="fm-panel__body--flush fm-table-wrap">
            <table className="fm-table fm-table--striped">
              <thead>
                <tr>
                  <th>선수 A</th>
                  <th>선수 B</th>
                  <th>케미스트리</th>
                  <th>시각화</th>
                </tr>
              </thead>
              <tbody>
                {chemistryRows.map((row) => (
                  <tr key={`${row.player_a_id}-${row.player_b_id}`}>
                    <td className="fm-cell--name">{row.player_a_name}</td>
                    <td className="fm-cell--name">{row.player_b_name}</td>
                    <td>
                      <span className="fm-font-semibold" style={{ color: getChemistryColor(row.chemistry_score) }}>
                        {row.chemistry_score}
                      </span>
                    </td>
                    <td>
                      <div className="fm-bar">
                        <div className="fm-bar__track">
                          <div
                            className="fm-bar__fill"
                            style={{
                              width: `${row.chemistry_score}%`,
                              background: getChemistryColor(row.chemistry_score),
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  };

  /* ── 만족도 탭 렌더 ── */
  const renderSatisfactionTab = () => {
    if (satisfactionLoading) {
      return <p className="fm-text-muted fm-text-md">로딩 중...</p>;
    }
    if (satisfactionRows.length === 0) {
      return <p className="fm-text-muted fm-text-md">만족도 데이터가 없습니다.</p>;
    }

    const dangerPlayers = satisfactionRows.filter((r) => r.overall_satisfaction < 30);

    return (
      <>
        {/* 불만 위험 경고 */}
        {dangerPlayers.length > 0 && (
          <div className="fm-alert fm-alert--danger fm-mb-lg">
            <div className="fm-flex-col fm-gap-xs">
              <span className="fm-font-semibold fm-text-base">
                불만 위험 선수 ({dangerPlayers.length}명)
              </span>
              {dangerPlayers.map((r) => (
                <span key={r.player_id} className="fm-text-base fm-text-secondary">
                  {r.player_name} ({POSITION_LABELS[r.position] ?? r.position}) - 만족도: <strong className="fm-text-danger">{r.overall_satisfaction}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 선수별 만족도 목록 */}
        <div className="fm-flex-col fm-gap-sm">
          {satisfactionRows.map((row) => {
            const isExpanded = expandedPlayerId === row.player_id;
            return (
              <div key={row.player_id} className={`fm-card ${isExpanded ? 'fm-card--highlight' : ''}`}>
                <button
                  className="fm-flex fm-items-center fm-justify-between"
                  style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', textAlign: 'left', padding: 0 }}
                  onClick={() => setExpandedPlayerId(isExpanded ? null : row.player_id)}
                  aria-expanded={isExpanded}
                  aria-label={`${row.player_name} 만족도 상세`}
                >
                  <div className="fm-flex fm-items-center fm-gap-sm fm-flex-1">
                    <span className={`fm-pos-badge fm-pos-badge--${POSITION_BADGE_MAP[row.position] ?? 'mid'}`}>
                      {POSITION_LABELS[row.position] ?? row.position}
                    </span>
                    <span className="fm-text-lg fm-font-medium fm-text-primary">
                      {row.player_name}
                    </span>
                    {row.overall_satisfaction < 30 && (
                      <span className="fm-badge fm-badge--danger">위험</span>
                    )}
                  </div>
                  <div className="fm-flex fm-items-center fm-gap-sm" style={{ minWidth: '200px' }}>
                    <div className="fm-bar fm-flex-1">
                      <div className="fm-bar__track">
                        <div
                          className="fm-bar__fill"
                          style={{
                            width: `${row.overall_satisfaction}%`,
                            background: getSatisfactionColor(row.overall_satisfaction),
                          }}
                        />
                      </div>
                    </div>
                    <span
                      className="fm-bar__value"
                      style={{ color: getSatisfactionColor(row.overall_satisfaction) }}
                    >
                      {row.overall_satisfaction}
                    </span>
                    <span className="fm-text-xs fm-text-muted">
                      {isExpanded ? '\u25B2' : '\u25BC'}
                    </span>
                  </div>
                </button>

                {/* 상세 6요소 */}
                {isExpanded && (
                  <div className="fm-flex-col fm-gap-sm fm-mt-sm" style={{ paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--border-subtle)' }}>
                    {(Object.keys(SATISFACTION_LABELS) as (keyof typeof SATISFACTION_LABELS)[]).map((key) => {
                      const value = row[key as keyof SatisfactionRow] as number;
                      return (
                        <div key={key} className="fm-flex fm-items-center fm-gap-sm">
                          <span className="fm-text-md fm-text-muted" style={{ minWidth: '80px' }}>
                            {SATISFACTION_LABELS[key]}
                          </span>
                          <div className="fm-bar fm-flex-1">
                            <div className="fm-bar__track">
                              <div
                                className={getBarFillClass(value)}
                                style={{ width: `${value}%` }}
                              />
                            </div>
                          </div>
                          <span
                            className="fm-bar__value"
                            style={{ color: getSatisfactionColor(value) }}
                          >
                            {value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">로스터 관리</h1>
      </div>

      {/* 탭 네비게이션 */}
      <div className="fm-tabs" role="tablist">
        {([
          { key: 'roster' as RosterTab, label: '로스터' },
          { key: 'chemistry' as RosterTab, label: '케미스트리' },
          { key: 'satisfaction' as RosterTab, label: '만족도' },
        ]).map((tab) => (
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

      {/* 로스터 탭 */}
      {activeTab === 'roster' && (
        <>
          {/* 팀 전술 선택 */}
          <div className="fm-panel fm-mb-md">
            <div className="fm-panel__header">
              <span className="fm-panel__title">팀 전술</span>
            </div>
            <div className="fm-panel__body">
              <div className="fm-grid fm-grid--3">
                {(Object.keys(PLAY_STYLE_INFO) as PlayStyle[]).map((style) => {
                  const info = PLAY_STYLE_INFO[style];
                  const isActive = userTeam?.playStyle === style;
                  return (
                    <button
                      key={style}
                      className={`fm-card fm-card--clickable fm-flex-col fm-items-center fm-gap-xs ${isActive ? 'fm-card--highlight' : ''}`}
                      onClick={() => handlePlayStyleChange(style)}
                    >
                      <span className="fm-text-2xl">{info.icon}</span>
                      <span className="fm-text-lg fm-font-bold fm-text-primary">{info.name}</span>
                      <span className="fm-text-base fm-text-secondary fm-text-center" style={{ lineHeight: '1.4' }}>{info.description}</span>
                      <span className="fm-text-sm fm-text-muted fm-text-center fm-mt-sm">{info.matchup}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 안내 메시지 */}
          {swapSource && (
            <div className="fm-alert fm-alert--warning fm-mb-md">
              <span className="fm-alert__text">교체할 상대 선수를 선택하세요 (1군 \u2194 2군)</span>
            </div>
          )}

          {message && (
            <div className="fm-alert fm-alert--success fm-mb-md">
              <span className="fm-alert__text">{message}</span>
            </div>
          )}

          {renderTable(mainRoster, '1군', 'main')}
          {subRoster.length > 0 && renderTable(subRoster, '2군', 'sub')}
          {subRoster.length === 0 && (
            <div className="fm-panel fm-mb-md">
              <div className="fm-panel__header">
                <span className="fm-panel__title">2군 (0명)</span>
              </div>
              <div className="fm-panel__body">
                <p className="fm-text-muted fm-text-md">2군 선수가 없습니다.</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* 케미스트리 탭 */}
      {activeTab === 'chemistry' && (
        <div>
          {renderChemistryTab()}
        </div>
      )}

      {/* 만족도 탭 */}
      {activeTab === 'satisfaction' && (
        <div>
          {renderSatisfactionTab()}
        </div>
      )}
    </div>
  );
}
