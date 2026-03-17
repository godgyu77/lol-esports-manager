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
  }, [season]);

  if (!season) {
    return <p style={{ color: '#6a6a7a' }}>시즌 데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p style={{ color: '#6a6a7a' }}>대회 정보를 불러오는 중...</p>;
  }

  if (tournaments.length === 0) {
    return (
      <div>
        <h1 style={styles.title}>국제 대회</h1>
        <div style={styles.emptyCard}>
          <p style={{ color: '#6a6a7a', fontSize: '14px' }}>
            아직 예정된 국제 대회가 없습니다.
          </p>
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
    <div>
      <h1 style={styles.title}>국제 대회</h1>

      {/* 대회 탭 */}
      <div style={styles.tabRow}>
        {tournaments.map((td) => (
          <button
            key={td.tournament.id}
            onClick={() => setSelectedId(td.tournament.id)}
            style={{
              ...styles.tab,
              ...(td.tournament.id === selectedId ? styles.tabActive : {}),
            }}
          >
            {getTournamentLabel(td.tournament.type)} {td.tournament.year}
          </button>
        ))}
      </div>

      {/* 대회 상태 */}
      <TournamentStatusBadge status={selected.tournament.status} />

      {/* 대회 정보 카드 */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>
            {getTournamentFullName(selected.tournament.type)}{' '}
            {selected.tournament.year}
          </h2>
          <span style={styles.dateRange}>
            {selected.tournament.startDate} ~ {selected.tournament.endDate}
          </span>
        </div>

        {/* 참가팀 */}
        <ParticipantList
          participants={selected.participants}
          getTeamName={getTeamName}
        />
      </div>

      {/* 그룹 스테이지 */}
      {selected.groupStandings.size > 0 && (
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>그룹 스테이지</h3>
          <div style={styles.groupContainer}>
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
      )}

      {/* 녹아웃 스테이지 */}
      {selected.knockoutMatches.length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>녹아웃 스테이지</h3>
          <KnockoutBracket
            matches={selected.knockoutMatches}
            tournamentType={selected.tournament.type}
            getTeamName={getTeamName}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// 서브 컴포넌트
// ─────────────────────────────────────────

function TournamentStatusBadge({ status }: { status: string }) {
  const labelMap: Record<string, { text: string; color: string }> = {
    scheduled: { text: '예정', color: '#6a6a7a' },
    group_stage: { text: '그룹 스테이지', color: '#4a9eff' },
    swiss_stage: { text: '스위스 스테이지', color: '#4a9eff' },
    knockout: { text: '녹아웃 스테이지', color: '#c89b3c' },
    completed: { text: '종료', color: '#90ee90' },
  };
  const info = labelMap[status] ?? { text: status, color: '#6a6a7a' };

  return (
    <div style={{ marginBottom: '16px' }}>
      <span
        style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 600,
          color: info.color,
          background: `${info.color}20`,
          border: `1px solid ${info.color}40`,
        }}
      >
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
    <div style={styles.participantGrid}>
      {participants.map((p) => (
        <div key={p.teamId} style={styles.participantCard}>
          <span style={styles.participantRegion}>{p.region}</span>
          <span style={styles.participantName}>{getTeamName(p.teamId)}</span>
          <span style={styles.participantSeed}>#{p.seed}</span>
          {p.groupName && (
            <span style={styles.participantGroup}>Group {p.groupName}</span>
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
    <div style={styles.groupCard}>
      <h4 style={styles.groupTitle}>Group {groupName}</h4>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>순위</th>
            <th style={styles.th}>팀</th>
            <th style={styles.th}>리전</th>
            <th style={styles.th}>승</th>
            <th style={styles.th}>패</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, idx) => {
            const isAdvancing = idx < 2;
            return (
              <tr key={s.teamId} style={styles.tr}>
                <td style={styles.td}>{idx + 1}</td>
                <td
                  style={{
                    ...styles.td,
                    ...styles.nameCell,
                    ...(isAdvancing ? { color: '#c89b3c' } : {}),
                  }}
                >
                  {getTeamName(s.teamId)}
                </td>
                <td style={{ ...styles.td, color: '#6a6a7a' }}>{s.region}</td>
                <td style={{ ...styles.td, color: '#90ee90' }}>{s.wins}</td>
                <td style={{ ...styles.td, color: '#ff6b6b' }}>{s.losses}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
    <div style={styles.bracketContainer}>
      {order.map((roundLabel) => {
        const roundMatches = rounds.get(roundLabel) ?? [];
        if (roundMatches.length === 0) return null;
        return (
          <div key={roundLabel} style={styles.bracketRound}>
            <h4 style={styles.roundTitle}>{roundLabel}</h4>
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
    <div style={styles.matchCard}>
      <div style={styles.matchDate}>{match.matchDate ?? ''} | {match.boFormat}</div>
      <div style={styles.matchTeamRow}>
        <span
          style={{
            ...styles.matchTeamName,
            ...(homeWon ? styles.matchWinner : {}),
            ...(match.isPlayed && !homeWon ? styles.matchLoser : {}),
          }}
        >
          {homeName}
        </span>
        <span style={styles.matchScore}>
          {match.isPlayed ? `${match.scoreHome} - ${match.scoreAway}` : 'vs'}
        </span>
        <span
          style={{
            ...styles.matchTeamName,
            ...(awayWon ? styles.matchWinner : {}),
            ...(match.isPlayed && !awayWon ? styles.matchLoser : {}),
          }}
        >
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

// ─────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '24px',
  },
  tabRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  tab: {
    padding: '8px 20px',
    border: '1px solid #3a3a5c',
    borderRadius: '6px',
    background: 'transparent',
    color: '#c0c0d0',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  tabActive: {
    background: 'rgba(200,155,60,0.15)',
    borderColor: '#c89b3c',
    color: '#c89b3c',
  },
  card: {
    background: '#1e1e30',
    border: '1px solid #2a2a44',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '16px',
  },
  emptyCard: {
    background: '#1e1e30',
    border: '1px solid #2a2a44',
    borderRadius: '8px',
    padding: '40px',
    textAlign: 'center' as const,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#f0e6d2',
    margin: 0,
  },
  dateRange: {
    fontSize: '12px',
    color: '#6a6a7a',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#f0e6d2',
    marginTop: 0,
    marginBottom: '16px',
  },
  participantGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '10px',
  },
  participantCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  participantRegion: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#c89b3c',
    minWidth: '30px',
  },
  participantName: {
    fontSize: '13px',
    color: '#e0e0e0',
    fontWeight: 500,
    flex: 1,
  },
  participantSeed: {
    fontSize: '11px',
    color: '#6a6a7a',
  },
  participantGroup: {
    fontSize: '11px',
    color: '#4a9eff',
  },
  groupContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '16px',
  },
  groupCard: {
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
    padding: '16px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  groupTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#c89b3c',
    marginTop: 0,
    marginBottom: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    padding: '6px 10px',
    textAlign: 'left' as const,
    borderBottom: '1px solid #3a3a5c',
    color: '#6a6a7a',
    fontSize: '11px',
    fontWeight: 500,
  },
  tr: {
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  td: {
    padding: '6px 10px',
    color: '#c0c0d0',
  },
  nameCell: {
    fontWeight: 500,
    color: '#e0e0e0',
  },
  bracketContainer: {
    display: 'flex',
    gap: '24px',
    overflowX: 'auto' as const,
  },
  bracketRound: {
    minWidth: '220px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  roundTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#c89b3c',
    textAlign: 'center' as const,
    marginTop: 0,
    marginBottom: '4px',
  },
  matchCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    padding: '10px 14px',
  },
  matchDate: {
    fontSize: '11px',
    color: '#6a6a7a',
    marginBottom: '6px',
  },
  matchTeamRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  matchTeamName: {
    fontSize: '13px',
    color: '#c0c0d0',
    fontWeight: 500,
    flex: 1,
  },
  matchScore: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#f0e6d2',
    textAlign: 'center' as const,
    minWidth: '50px',
  },
  matchWinner: {
    color: '#c89b3c',
    fontWeight: 700,
  },
  matchLoser: {
    color: '#6a6a7a',
  },
};
