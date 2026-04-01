import { useEffect, useMemo, useState } from 'react';
import { getMatchesByTeam } from '../../../db/queries';
import { useGameStore } from '../../../stores/gameStore';
import type { Match } from '../../../types/match';

const MATCH_TYPE_LABELS: Record<string, string> = {
  regular: '정규 시즌',
  playoff_quarters: '플레이오프 8강',
  playoff_semis: '플레이오프 4강',
  playoff_finals: '플레이오프 결승',
  msi_group: 'MSI 그룹',
  msi_semis: 'MSI 4강',
  msi_final: 'MSI 결승',
  worlds_swiss: '월즈 스위스',
  worlds_quarter: '월즈 8강',
  worlds_semi: '월즈 4강',
  worlds_final: '월즈 결승',
  lck_cup_regular: 'LCK 컵',
  lck_cup_playoff_quarters: 'LCK 컵 8강',
  lck_cup_playoff_semis: 'LCK 컵 4강',
  lck_cup_playoff_finals: 'LCK 컵 결승',
  fst_quarter: 'FST 8강',
  fst_semi: 'FST 4강',
  fst_final: 'FST 결승',
  ewc_quarter: 'EWC 8강',
  ewc_semi: 'EWC 4강',
  ewc_final: 'EWC 결승',
};

function getWeekLabel(week: number): string {
  if (week >= 99) {
    if (week === 99) return '플레이오프 8강 주간';
    if (week === 100) return '플레이오프 4강 주간';
    return '결승 주간';
  }
  return `${week}주차`;
}

export function ScheduleView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);

  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!season || !save) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const data = await getMatchesByTeam(season.id, save.userTeamId);
        if (!cancelled) {
          setMatches(data);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [save, season]);

  const summary = useMemo(() => {
    const totalMatches = matches.length;
    const playedMatches = matches.filter((match) => match.isPlayed).length;
    const wins = matches.filter((match) =>
      match.isPlayed && (
        (match.scoreHome > match.scoreAway && match.teamHomeId === save?.userTeamId) ||
        (match.scoreAway > match.scoreHome && match.teamAwayId === save?.userTeamId)
      ),
    ).length;

    return {
      totalMatches,
      playedMatches,
      wins,
      losses: playedMatches - wins,
      nextMatch: matches.find((match) => !match.isPlayed) ?? null,
    };
  }, [matches, save?.userTeamId]);

  if (!season || !save) {
    return <p className="fm-text-muted fm-text-md">일정 데이터를 불러오는 중입니다...</p>;
  }

  if (isLoading) {
    return <p className="fm-text-muted fm-text-md">경기 일정을 정리하는 중입니다...</p>;
  }

  const grouped = new Map<number, Match[]>();
  for (const match of matches) {
    if (!grouped.has(match.week)) grouped.set(match.week, []);
    grouped.get(match.week)?.push(match);
  }

  const currentWeek = season.currentWeek ?? 1;
  const sortedWeeks = [...grouped.keys()].sort((a, b) => a - b);
  const getTeamName = (teamId: string) => teams.find((team) => team.id === teamId)?.shortName ?? teamId;

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">일정</h1>
      </div>

      <div className="fm-grid fm-grid--4 fm-mb-lg">
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">전체 경기</span>
            <span className="fm-stat__value">{summary.totalMatches}</span>
          </div>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">진행도</span>
            <span className="fm-stat__value">{summary.playedMatches}/{summary.totalMatches}</span>
          </div>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">전적</span>
            <span className="fm-stat__value fm-text-success">{summary.wins}승</span>
            <span className="fm-text-danger">{summary.losses}패</span>
          </div>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">다음 경기</span>
            <span className="fm-stat__value">{summary.nextMatch?.matchDate ?? '예정 없음'}</span>
          </div>
        </div>
      </div>

      {summary.nextMatch && (
        <div className="fm-panel fm-mb-lg">
          <div className="fm-panel__header">
            <span className="fm-panel__title">다음 일정</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-card">
              <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm" style={{ flexWrap: 'wrap' }}>
                <div>
                  <div className="fm-text-sm fm-text-muted">가장 가까운 공식전</div>
                  <div className="fm-text-lg fm-font-semibold fm-text-primary">
                    {summary.nextMatch.teamHomeId === save.userTeamId ? 'vs' : '@'}{' '}
                    {getTeamName(summary.nextMatch.teamHomeId === save.userTeamId ? summary.nextMatch.teamAwayId : summary.nextMatch.teamHomeId)}
                  </div>
                </div>
                <div className="fm-flex fm-items-center fm-gap-sm">
                  <span className="fm-badge fm-badge--accent">{summary.nextMatch.boFormat}</span>
                  <span className="fm-badge fm-badge--default">
                    {MATCH_TYPE_LABELS[summary.nextMatch.matchType] ?? summary.nextMatch.matchType}
                  </span>
                  <span className="fm-text-secondary">{summary.nextMatch.matchDate}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {sortedWeeks.map((week) => {
        const weekMatches = grouped.get(week) ?? [];
        const isCurrentWeek = week === currentWeek;

        return (
          <div key={week} className={`fm-panel fm-mb-md ${isCurrentWeek ? 'fm-card--highlight' : ''}`}>
            <div className="fm-panel__header">
              <span className="fm-font-semibold fm-text-md">{getWeekLabel(week)}</span>
              {isCurrentWeek && <span className="fm-badge fm-badge--accent">현재 주차</span>}
            </div>
            <div className="fm-panel__body fm-flex-col fm-gap-sm">
              {weekMatches.map((match) => {
                const isHome = match.teamHomeId === save.userTeamId;
                const opponentId = isHome ? match.teamAwayId : match.teamHomeId;
                const userScore = isHome ? match.scoreHome : match.scoreAway;
                const opponentScore = isHome ? match.scoreAway : match.scoreHome;
                const isWin = match.isPlayed && userScore > opponentScore;
                const isLoss = match.isPlayed && userScore < opponentScore;

                return (
                  <div key={match.id} className="fm-card">
                    <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm" style={{ flexWrap: 'wrap' }}>
                      <div className="fm-flex fm-items-center fm-gap-sm" style={{ flexWrap: 'wrap' }}>
                        <span className="fm-text-sm fm-text-muted">{match.matchDate ?? '-'}</span>
                        <span className="fm-badge fm-badge--default">{MATCH_TYPE_LABELS[match.matchType] ?? match.matchType}</span>
                        <span className="fm-badge fm-badge--default">{match.boFormat}</span>
                        <span className="fm-text-primary fm-font-semibold">
                          {isHome ? 'vs' : '@'} {getTeamName(opponentId)}
                        </span>
                      </div>

                      {match.isPlayed ? (
                        <span className={`fm-font-bold ${isWin ? 'fm-text-success' : isLoss ? 'fm-text-danger' : 'fm-text-secondary'}`}>
                          {isWin ? '승리' : '패배'} {userScore}:{opponentScore}
                        </span>
                      ) : (
                        <span className="fm-text-muted">예정</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {matches.length === 0 && (
        <p className="fm-text-muted fm-text-md">등록된 경기가 없습니다.</p>
      )}
    </div>
  );
}
