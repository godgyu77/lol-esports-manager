import { useEffect, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getDatabase } from '../../../db/database';
import { buildTeamLegacyReport } from '../../../engine/manager/franchiseNarrativeEngine';
import { getTeamHistoryLedger } from '../../../engine/manager/releaseDepthEngine';
import type { TeamHistoryLedger } from '../../../types/systemDepth';
import { MainLoopPanel } from '../components/MainLoopPanel';

interface SeasonHistoryRecord {
  seasonId: number;
  finalStanding: number | null;
  wins: number;
  losses: number;
  playoffResult: string | null;
  champion: boolean;
}

interface AwardRecord {
  seasonId: number;
  awardType: string;
  playerId: string | null;
  teamId: string | null;
  value: number | null;
}

interface LegendPlayer {
  name: string;
  position: string;
  totalGames: number;
  totalKills: number;
}

interface SeasonRecordRow {
  season_id: number;
  final_standing: number | null;
  wins: number;
  losses: number;
  playoff_result: string | null;
  champion: number;
}

interface TeamAwardRow {
  season_id: number;
  award_type: string;
  player_id: string | null;
  team_id: string | null;
  value: number | null;
}

interface LegendRow {
  name: string;
  position: string;
  total_games: number;
  total_kills: number;
}

const POSITION_LABELS: Record<string, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: '원딜',
  support: '서포터',
};

const AWARD_LABELS: Record<string, string> = {
  mvp: '최우수 선수',
  rookie: '신인상',
  all_pro_top: '베스트 탑',
  all_pro_jungle: '베스트 정글',
  all_pro_mid: '베스트 미드',
  all_pro_adc: '베스트 원딜',
  all_pro_support: '베스트 서포터',
  champion: '우승',
};

function formatLedgerType(value: string): string {
  return value
    .split('_')
    .map((part) => {
      if (part === 'rivalry') return '라이벌';
      if (part === 'record') return '기록';
      if (part === 'legacy') return '유산';
      if (part === 'lineage') return '계보';
      if (part === 'franchise') return '프랜차이즈';
      if (part === 'icon') return '아이콘';
      return part;
    })
    .join(' ');
}

export function TeamHistoryView() {
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);
  const season = useGameStore((s) => s.season);

  const [history, setHistory] = useState<SeasonHistoryRecord[]>([]);
  const [awards, setAwards] = useState<AwardRecord[]>([]);
  const [legends, setLegends] = useState<LegendPlayer[]>([]);
  const [ledger, setLedger] = useState<TeamHistoryLedger[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userTeam = teams.find((t) => t.id === save?.userTeamId);

  useEffect(() => {
    if (!userTeam || !season) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const db = await getDatabase();

        const historyRows = await db
          .select<SeasonRecordRow[]>(
            `SELECT season_id, final_standing, wins, losses, playoff_result, champion
             FROM season_records
             WHERE team_id = $1
             ORDER BY season_id DESC`,
            [userTeam.id],
          )
          .catch((): SeasonRecordRow[] => []);

        const awardRows = await db
          .select<TeamAwardRow[]>(
            `SELECT season_id, award_type, player_id, team_id, value
             FROM awards
             WHERE team_id = $1
             ORDER BY season_id DESC`,
            [userTeam.id],
          )
          .catch((): TeamAwardRow[] => []);

        const legendRows = await db
          .select<LegendRow[]>(
            `SELECT p.name, p.position,
                    COALESCE(SUM(CASE WHEN gs.player_id IS NOT NULL THEN 1 ELSE 0 END), 0) as total_games,
                    COALESCE(SUM(gs.kills), 0) as total_kills
             FROM players p
             LEFT JOIN player_game_stats gs ON gs.player_id = p.id
             WHERE p.team_id = $1
             GROUP BY p.id, p.name, p.position
             ORDER BY total_games DESC, total_kills DESC
             LIMIT 10`,
            [userTeam.id],
          )
          .catch((): LegendRow[] => []);

        if (cancelled) return;

        setHistory(
          historyRows.map((row) => ({
            seasonId: row.season_id,
            finalStanding: row.final_standing,
            wins: row.wins,
            losses: row.losses,
            playoffResult: row.playoff_result,
            champion: row.champion === 1,
          })),
        );

        setAwards(
          awardRows.map((row) => ({
            seasonId: row.season_id,
            awardType: row.award_type,
            playerId: row.player_id,
            teamId: row.team_id,
            value: row.value,
          })),
        );

        setLegends(
          legendRows.map((row) => ({
            name: row.name,
            position: row.position,
            totalGames: row.total_games,
            totalKills: row.total_kills,
          })),
        );

        const releaseLedger = await getTeamHistoryLedger(userTeam.id, undefined, 24).catch(() => []);
        if (!cancelled) {
          setLedger(releaseLedger);
        }
      } catch (err) {
        console.warn('[TeamHistoryView] load failed:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [season, userTeam]);

  if (!userTeam || !season) {
    return <p className="fm-text-muted fm-p-md">데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p className="fm-text-muted fm-p-md">팀 히스토리를 불러오는 중...</p>;
  }

  const totalSeasons = history.length;
  const totalTrophies = history.filter((item) => item.champion).length;
  const totalWins = history.reduce((sum, item) => sum + item.wins, 0);
  const totalLosses = history.reduce((sum, item) => sum + item.losses, 0);
  const totalGames = totalWins + totalLosses;
  const winRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '0.0';
  const legacyReport = buildTeamLegacyReport({ team: userTeam, history, legends });
  const rivalryLedger = ledger.filter((entry) => entry.ledgerType === 'rivalry_record').slice(0, 4);
  const lineageLedger = ledger.filter((entry) => entry.ledgerType !== 'rivalry_record').slice(0, 6);
  const legacySummary = `${legacyReport.identity} ${legacyReport.timelineHook}`;
  const latestLedgerNote = ledger[0]?.note ?? `${ledger[0]?.subjectName ?? userTeam.name} 관련 기록이 최근 팀 히스토리에 남아 있습니다.`;

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">팀 히스토리</h1>
        <p className="fm-page-subtitle">이 팀이 어떤 기록과 이야기를 쌓아왔는지 한 화면에서 확인합니다.</p>
      </div>

      <MainLoopPanel
        eyebrow="참고 화면"
        title="구단 역사와 레거시를 먼저 읽는 히스토리 화면"
        subtitle="모든 시즌 표를 보기 전에 누적 우승, 통산 전적, 레거시 요약부터 확인할 수 있게 구성했습니다."
        insights={[
          {
            label: '총 시즌',
            value: `${totalSeasons}`,
            detail: `${userTeam.name} 기준 누적 시즌 수입니다.`,
            tone: 'accent',
          },
          {
            label: '트로피',
            value: `${totalTrophies}`,
            detail: `누적 전적 ${totalWins}승 ${totalLosses}패`,
            tone: totalTrophies > 0 ? 'success' : 'neutral',
          },
          {
            label: '누적 승률',
            value: `${winRate}%`,
            detail: legacySummary,
            tone: Number(winRate) >= 50 ? 'success' : 'warning',
          },
          {
            label: '히스토리 메모',
            value: `${ledger.length}건`,
            detail: latestLedgerNote,
            tone: 'neutral',
          },
        ]}
        note="팀 히스토리는 결과를 천천히 읽는 화면이라, 상단에서 레거시 방향만 먼저 읽고 아래 시즌 기록으로 내려가게 했습니다."
      />

      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">{userTeam.name}</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            <div className="fm-card fm-text-center">
              <div className="fm-stat" style={{ alignItems: 'center' }}>
                <span className="fm-stat__label">지역</span>
                <span className="fm-stat__value">{userTeam.region}</span>
              </div>
            </div>
            <div className="fm-card fm-text-center">
              <div className="fm-stat" style={{ alignItems: 'center' }}>
                <span className="fm-stat__label">총 시즌</span>
                <span className="fm-stat__value">{totalSeasons}</span>
              </div>
            </div>
            <div className="fm-card fm-text-center">
              <div className="fm-stat" style={{ alignItems: 'center' }}>
                <span className="fm-stat__label">트로피</span>
                <span className="fm-stat__value fm-stat__value--accent">{totalTrophies}</span>
              </div>
            </div>
            <div className="fm-card fm-text-center">
              <div className="fm-stat" style={{ alignItems: 'center' }}>
                <span className="fm-stat__label">통산 전적</span>
                <span className="fm-stat__value--sm fm-font-bold fm-text-primary">{totalWins}승 {totalLosses}패</span>
              </div>
            </div>
            <div className="fm-card fm-text-center">
              <div className="fm-stat" style={{ alignItems: 'center' }}>
                <span className="fm-stat__label">통산 승률</span>
                <span className="fm-stat__value--sm fm-font-bold fm-text-primary">{winRate}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">구단 정체성</span>
        </div>
        <div className="fm-panel__body fm-flex-col fm-gap-md">
          <div className="fm-card fm-card--highlight">
            <div className="fm-flex-col fm-gap-xs">
              <span className="fm-text-xs fm-font-semibold fm-text-accent">구단 흐름</span>
              <strong className="fm-text-lg fm-text-primary">{legacyReport.identity}</strong>
              <span className="fm-text-sm fm-text-secondary">{legacyReport.internationalPosture}</span>
            </div>
          </div>
          <div className="fm-grid fm-grid--3">
            <div className="fm-card">
              <span className="fm-text-xs fm-font-semibold fm-text-accent">서사 포인트</span>
              <p className="fm-text-sm fm-text-secondary fm-mt-sm">{legacyReport.timelineHook}</p>
            </div>
            {legacyReport.replayHooks.map((hook) => (
              <div key={hook} className="fm-card">
                <span className="fm-text-xs fm-font-semibold fm-text-accent">반복되는 가치</span>
                <p className="fm-text-sm fm-text-secondary fm-mt-sm">{hook}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {rivalryLedger.length > 0 || lineageLedger.length > 0 ? (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">역사 기록부</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-md">
            {rivalryLedger.length > 0 ? (
              <div className="fm-grid fm-grid--2">
                {rivalryLedger.map((entry) => (
                  <div key={entry.id} className="fm-card">
                    <span className="fm-text-xs fm-font-semibold fm-text-accent">지역 라이벌</span>
                    <p className="fm-text-sm fm-text-primary fm-mt-sm">{entry.subjectName}</p>
                    <p className="fm-text-sm fm-text-secondary">
                      상대 전적: {entry.statValue}승 {entry.secondaryValue}패
                    </p>
                    <p className="fm-text-xs fm-text-muted">최종 갱신 {entry.updatedAt}</p>
                    {entry.note ? <p className="fm-text-xs fm-text-muted">{entry.note}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
            {lineageLedger.length > 0 ? (
              <div className="fm-grid fm-grid--3">
                {lineageLedger.map((entry) => (
                  <div key={entry.id} className="fm-card">
                    <span className="fm-text-xs fm-font-semibold fm-text-accent">{formatLedgerType(entry.ledgerType)}</span>
                    <p className="fm-text-sm fm-text-primary fm-mt-sm">{entry.subjectName}</p>
                    {entry.note ? <p className="fm-text-sm fm-text-secondary">{entry.note}</p> : null}
                    {entry.extra.length > 0 ? (
                      <div className="fm-flex fm-gap-xs fm-flex-wrap">
                        {entry.extra.map((tag) => (
                          <span key={`${entry.id}-${tag}`} className="fm-badge fm-badge--default">{tag}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {totalTrophies > 0 ? (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">우승 기록</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-flex-wrap fm-gap-md">
              {history.filter((item) => item.champion).map((item) => (
                <div key={item.seasonId} className="fm-card fm-card--highlight fm-text-center" style={{ padding: '16px 20px' }}>
                  <span style={{ fontSize: '32px', display: 'block' }}>{'\uD83C\uDFC6'}</span>
                  <span className="fm-text-xs fm-font-semibold fm-text-accent fm-mt-sm" style={{ display: 'block' }}>
                    시즌 {item.seasonId}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">시즌별 기록</span>
        </div>
        <div className="fm-panel__body--flush">
          {history.length === 0 ? (
            <p className="fm-text-sm fm-text-muted fm-text-center fm-p-md">아직 기록된 시즌 성적이 없습니다.</p>
          ) : (
            <div className="fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th>시즌</th>
                    <th className="text-center">순위</th>
                    <th className="text-center">승</th>
                    <th className="text-center">패</th>
                    <th className="text-center">승률</th>
                    <th>플레이오프</th>
                    <th className="text-center">우승</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => {
                    const total = record.wins + record.losses;
                    const recordWinRate = total > 0 ? ((record.wins / total) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={record.seasonId}>
                        <td className="fm-cell--name">시즌 {record.seasonId}</td>
                        <td className="text-center">{record.finalStanding != null ? `${record.finalStanding}위` : '-'}</td>
                        <td className="text-center">{record.wins}</td>
                        <td className="text-center">{record.losses}</td>
                        <td className="text-center">{recordWinRate}%</td>
                        <td>{record.playoffResult ?? '-'}</td>
                        <td className={`text-center ${record.champion ? 'fm-cell--gold' : 'fm-text-muted'}`}>
                          {record.champion ? '\uD83C\uDFC6' : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {awards.length > 0 ? (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">수상 기록</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-flex-wrap fm-gap-sm">
              {awards.map((award, index) => (
                <div key={`${award.seasonId}-${award.awardType}-${index}`} className="fm-flex fm-items-center fm-gap-sm fm-badge fm-badge--accent">
                  <span className="fm-font-semibold">{AWARD_LABELS[award.awardType] ?? award.awardType}</span>
                  <span className="fm-text-xs" style={{ opacity: 0.7 }}>시즌 {award.seasonId}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">레전드 선수</span>
        </div>
        <div className="fm-panel__body--flush">
          {legends.length === 0 ? (
            <p className="fm-text-sm fm-text-muted fm-text-center fm-p-md">경기 기록이 아직 없습니다.</p>
          ) : (
            <div className="fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th className="text-center">순번</th>
                    <th>선수</th>
                    <th>포지션</th>
                    <th className="text-center">경기 수</th>
                    <th className="text-center">킬 수</th>
                  </tr>
                </thead>
                <tbody>
                  {legends.map((player, index) => (
                    <tr key={`${player.name}-${index}`}>
                      <td className={`text-center ${index < 3 ? 'fm-cell--gold' : ''}`}>{index + 1}</td>
                      <td className="fm-cell--name">{player.name}</td>
                      <td>{POSITION_LABELS[player.position] ?? player.position}</td>
                      <td className="text-center">{player.totalGames}</td>
                      <td className="text-center">{player.totalKills}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
