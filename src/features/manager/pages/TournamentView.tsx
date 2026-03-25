import { useEffect, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  getTournamentsByYear,
  getTournamentParticipants,
  getTournamentStandings,
  type Tournament,
  type TournamentParticipant,
  type GroupStanding,
} from '../../../engine/tournament/tournamentEngine';
import { getMatchById } from '../../../db/queries';
import type { Match } from '../../../types/match';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

interface TournamentData {
  tournament: Tournament;
  participants: TournamentParticipant[];
  groupStandings: Map<string, GroupStanding[]>;
  knockoutMatches: Match[];
}

// ─────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────

export function TournamentView() {
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);

  const [tournaments, setTournaments] = useState<TournamentData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!season) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const tournamentList = await getTournamentsByYear(season.year);

      const dataList: TournamentData[] = [];

      for (const t of tournamentList) {
        const participants = await getTournamentParticipants(t.id);
        const groupStandings = new Map<string, GroupStanding[]>();

        // 그룹별 스탠딩 조회
        const groupNames = [...new Set(participants.map((p) => p.groupName).filter(Boolean))] as string[];

        if (groupNames.length > 0) {
          for (const g of groupNames) {
            const standings = await getTournamentStandings(t.id, g);
            groupStandings.set(g, standings);
          }
        } else {
          // MSI: 단일 그룹
          const standings = await getTournamentStandings(t.id);
          if (standings.length > 0) {
            groupStandings.set('A', standings);
          }
        }

        // 녹아웃 매치 조회
        const knockoutIds = getKnockoutMatchIds(t);
        const knockoutMatches: Match[] = [];
        for (const mid of knockoutIds) {
          const match = await getMatchById(mid);
          if (match) knockoutMatches.push(match);
        }

        dataList.push({ tournament: t, participants, groupStandings, knockoutMatches });
      }

      if (!cancelled) {
        setTournaments(dataList);
        if (dataList.length > 0 && !selectedId) {
          setSelectedId(dataList[0].tournament.id);
        }
        setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [season, selectedId]);

  if (!season) {
    return <p className="fm-text-muted fm-text-md">시즌 데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p className="fm-text-muted fm-text-md">대회 정보를 불러오는 중...</p>;
  }

  if (tournaments.length === 0) {
    return (
      <div>
        <div className="fm-page-header">
          <h1 className="fm-page-title">국제 대회</h1>
        </div>
        <div className="fm-panel">
          <div className="fm-panel__body fm-text-center">
            <p className="fm-text-muted fm-text-md">
              아직 예정된 국제 대회가 없습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const selected = tournaments.find((t) => t.tournament.id === selectedId) ?? tournaments[0];

  const getTeamName = (teamId: string) => {
    if (teamId.startsWith('TBD')) return 'TBD';
    const team = teams.find((t) => t.id === teamId);
    return team?.shortName ?? team?.name ?? teamId;
  };

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">국제 대회</h1>
      </div>

      {/* 대회 탭 */}
      <div className="fm-tabs">
        {tournaments.map((td) => (
          <button
            key={td.tournament.id}
            onClick={() => setSelectedId(td.tournament.id)}
            className={`fm-tab ${td.tournament.id === selectedId ? 'fm-tab--active' : ''}`}
          >
            {getTournamentLabel(td.tournament.type)} {td.tournament.year}
          </button>
        ))}
      </div>

      {/* 대회 상태 */}
      <TournamentStatusBadge status={selected.tournament.status} />

      {/* 대회 정보 카드 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">
            {getTournamentFullName(selected.tournament.type)}{' '}
            {selected.tournament.year}
          </span>
          <span className="fm-text-sm fm-text-muted">
            {selected.tournament.startDate} ~ {selected.tournament.endDate}
          </span>
        </div>
        <div className="fm-panel__body">
          {/* 참가팀 */}
          <ParticipantList
            participants={selected.participants}
            getTeamName={getTeamName}
          />
        </div>
      </div>

      {/* 그룹 스테이지 */}
      {selected.groupStandings.size > 0 && (
        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__header">
            <span className="fm-panel__title">그룹 스테이지</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-grid fm-grid--auto">
              {[...selected.groupStandings.entries()].map(([groupName, standings]) => (
                <GroupTable
                  key={groupName}
                  groupName={groupName}
                  standings={standings}
                  getTeamName={getTeamName}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 녹아웃 스테이지 */}
      {selected.knockoutMatches.length > 0 && (
        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__header">
            <span className="fm-panel__title">녹아웃 스테이지</span>
          </div>
          <div className="fm-panel__body">
            <KnockoutBracket
              matches={selected.knockoutMatches}
              tournamentType={selected.tournament.type}
              getTeamName={getTeamName}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// 서브 컴포넌트
// ─────────────────────────────────────────

function TournamentStatusBadge({ status }: { status: string }) {
  const badgeMap: Record<string, { text: string; cls: string }> = {
    scheduled: { text: '예정', cls: 'fm-badge--default' },
    group_stage: { text: '그룹 스테이지', cls: 'fm-badge--info' },
    swiss_stage: { text: '스위스 스테이지', cls: 'fm-badge--info' },
    knockout: { text: '녹아웃 스테이지', cls: 'fm-badge--accent' },
    completed: { text: '종료', cls: 'fm-badge--success' },
  };
  const info = badgeMap[status] ?? { text: status, cls: 'fm-badge--default' };

  return (
    <div className="fm-mb-md">
      <span className={`fm-badge ${info.cls}`}>
        {info.text}
      </span>
    </div>
  );
}

function ParticipantList({
  participants,
  getTeamName,
}: {
  participants: TournamentParticipant[];
  getTeamName: (id: string) => string;
}) {
  return (
    <div className="fm-grid fm-grid--auto">
      {participants.map((p) => (
        <div key={p.teamId} className="fm-card fm-flex fm-items-center fm-gap-sm">
          <span className="fm-text-sm fm-font-semibold fm-text-accent" style={{ minWidth: '30px' }}>
            {p.region}
          </span>
          <span className="fm-text-md fm-font-medium fm-text-primary fm-flex-1">
            {getTeamName(p.teamId)}
          </span>
          <span className="fm-text-sm fm-text-muted">#{p.seed}</span>
          {p.groupName && (
            <span className="fm-badge fm-badge--info">Group {p.groupName}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function GroupTable({
  groupName,
  standings,
  getTeamName,
}: {
  groupName: string;
  standings: GroupStanding[];
  getTeamName: (id: string) => string;
}) {
  return (
    <div className="fm-panel">
      <div className="fm-panel__header">
        <span className="fm-panel__title">Group {groupName}</span>
      </div>
      <div className="fm-panel__body--flush fm-table-wrap">
        <table className="fm-table fm-table--striped">
          <thead>
            <tr>
              <th>순위</th>
              <th>팀</th>
              <th>리전</th>
              <th>승</th>
              <th>패</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, idx) => {
              const isAdvancing = idx < 2;
              return (
                <tr key={s.teamId}>
                  <td>{idx + 1}</td>
                  <td className={isAdvancing ? 'fm-cell--accent' : 'fm-cell--name'}>
                    {getTeamName(s.teamId)}
                  </td>
                  <td className="fm-text-muted">{s.region}</td>
                  <td className="fm-cell--green">{s.wins}</td>
                  <td className="fm-cell--red">{s.losses}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KnockoutBracket({
  matches,
  tournamentType,
  getTeamName,
}: {
  matches: Match[];
  tournamentType: string;
  getTeamName: (id: string) => string;
}) {
  const getMatchLabel = (matchType: string): string => {
    const labels: Record<string, string> = {
      msi_semis: '준결승',
      msi_final: '결승',
      worlds_quarter: '8강',
      worlds_semi: '준결승',
      worlds_final: '결승',
      lck_cup_playoff_quarters: '8강',
      lck_cup_playoff_semis: '준결승',
      lck_cup_playoff_finals: '결승',
      fst_quarter: '8강',
      fst_semi: '준결승',
      fst_final: '결승',
      ewc_quarter: '8강',
      ewc_semi: '준결승',
      ewc_final: '결승',
    };
    return labels[matchType] ?? matchType;
  };

  // 라운드별 그룹핑
  const rounds = new Map<string, Match[]>();
  for (const m of matches) {
    const label = getMatchLabel(m.matchType);
    const arr = rounds.get(label) ?? [];
    arr.push(m);
    rounds.set(label, arr);
  }

  // 표시 순서
  const order = tournamentType === 'msi'
    ? ['준결승', '결승']
    : ['8강', '준결승', '결승']; // LCK Cup, FST, EWC, Worlds 모두 동일

  return (
    <div className="fm-flex fm-gap-lg" style={{ overflowX: 'auto' }}>
      {order.map((roundLabel) => {
        const roundMatches = rounds.get(roundLabel) ?? [];
        if (roundMatches.length === 0) return null;
        return (
          <div key={roundLabel} className="fm-flex-col fm-gap-sm" style={{ minWidth: '220px' }}>
            <h4 className="fm-text-md fm-font-semibold fm-text-accent fm-text-center fm-mb-sm">
              {roundLabel}
            </h4>
            {roundMatches.map((m) => (
              <MatchCard key={m.id} match={m} getTeamName={getTeamName} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function MatchCard({
  match,
  getTeamName,
}: {
  match: Match;
  getTeamName: (id: string) => string;
}) {
  const homeName = getTeamName(match.teamHomeId);
  const awayName = getTeamName(match.teamAwayId);
  const homeWon = match.isPlayed && match.scoreHome > match.scoreAway;
  const awayWon = match.isPlayed && match.scoreAway > match.scoreHome;

  return (
    <div className="fm-card">
      <div className="fm-text-sm fm-text-muted fm-mb-sm">
        {match.matchDate ?? ''} | {match.boFormat}
      </div>
      <div className="fm-flex fm-justify-between fm-items-center fm-gap-sm">
        <span className={`fm-text-md fm-font-medium fm-flex-1 ${
          homeWon ? 'fm-text-accent fm-font-bold' : match.isPlayed && !homeWon ? 'fm-text-muted' : 'fm-text-secondary'
        }`}>
          {homeName}
        </span>
        <span className="fm-text-lg fm-font-bold fm-text-primary fm-text-center" style={{ minWidth: '50px' }}>
          {match.isPlayed ? `${match.scoreHome} - ${match.scoreAway}` : 'vs'}
        </span>
        <span className={`fm-text-md fm-font-medium fm-flex-1 fm-text-right ${
          awayWon ? 'fm-text-accent fm-font-bold' : match.isPlayed && !awayWon ? 'fm-text-muted' : 'fm-text-secondary'
        }`}>
          {awayName}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

function getKnockoutMatchIds(tournament: Tournament): string[] {
  const id = tournament.id;
  switch (tournament.type) {
    case 'msi':
      return [`${id}_sf1`, `${id}_sf2`, `${id}_final`];
    case 'lck_cup':
      return [`${id}_q1`, `${id}_q2`, `${id}_sf1`, `${id}_sf2`, `${id}_final`];
    case 'fst':
    case 'ewc':
      return [
        `${id}_qf1`, `${id}_qf2`, `${id}_qf3`, `${id}_qf4`,
        `${id}_sf1`, `${id}_sf2`, `${id}_final`,
      ];
    case 'worlds':
      return [
        `${id}_qf1`, `${id}_qf2`, `${id}_qf3`, `${id}_qf4`,
        `${id}_sf1`, `${id}_sf2`, `${id}_final`,
      ];
    default:
      return [`${id}_qf1`, `${id}_qf2`, `${id}_sf1`, `${id}_sf2`, `${id}_final`];
  }
}

function getTournamentLabel(type: string): string {
  const labels: Record<string, string> = {
    msi: 'MSI',
    worlds: 'Worlds',
    lck_cup: 'LCK Cup',
    fst: 'First Stand',
    ewc: 'EWC',
  };
  return labels[type] ?? type.toUpperCase();
}

function getTournamentFullName(type: string): string {
  const names: Record<string, string> = {
    msi: 'Mid-Season Invitational',
    worlds: 'World Championship',
    lck_cup: 'LCK Cup',
    fst: 'First Stand',
    ewc: 'Esports World Cup',
  };
  return names[type] ?? type;
}
