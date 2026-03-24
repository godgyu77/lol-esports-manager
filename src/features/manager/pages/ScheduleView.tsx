/**
 * 일정 페이지 — 유저 팀의 시즌 경기 일정
 * - 전체 경기 목록 (주차별 그룹핑)
 * - 결과/예정 구분
 * - 현재 주차 하이라이트
 */

import { useEffect, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getMatchesByTeam } from '../../../db/queries';
import type { Match } from '../../../types/match';

const MATCH_TYPE_LABELS: Record<string, string> = {
  regular: '정규',
  playoff_quarters: '8강',
  playoff_semis: '준결승',
  playoff_finals: '결승',
  msi_group: 'MSI 그룹',
  msi_semis: 'MSI 준결승',
  msi_final: 'MSI 결승',
  worlds_swiss: 'Worlds 스위스',
  worlds_quarter: 'Worlds 8강',
  worlds_semi: 'Worlds 준결승',
  worlds_final: 'Worlds 결승',
  lck_cup_regular: 'LCK Cup',
  lck_cup_playoff_quarters: 'LCK Cup 8강',
  lck_cup_playoff_semis: 'LCK Cup 준결승',
  lck_cup_playoff_finals: 'LCK Cup 결승',
  fst_quarter: 'FST 8강',
  fst_semi: 'FST 준결승',
  fst_final: 'FST 결승',
  ewc_quarter: 'EWC 8강',
  ewc_semi: 'EWC 준결승',
  ewc_final: 'EWC 결승',
};

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
      const data = await getMatchesByTeam(season.id, save.userTeamId);
      if (!cancelled) {
        setMatches(data);
        setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [season, save]);

  if (!season || !save) {
    return <p className="fm-text-muted fm-text-md">데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p className="fm-text-muted fm-text-md">일정을 불러오는 중...</p>;
  }

  const getTeamName = (teamId: string) => {
    return teams.find(t => t.id === teamId)?.shortName ?? teamId;
  };

  // 주차별 그룹핑
  const grouped = new Map<number, Match[]>();
  for (const m of matches) {
    const week = m.week;
    if (!grouped.has(week)) grouped.set(week, []);
    grouped.get(week)!.push(m);
  }

  const currentWeek = season.currentWeek ?? 1;
  const sortedWeeks = [...grouped.keys()].sort((a, b) => a - b);

  const totalMatches = matches.length;
  const playedMatches = matches.filter(m => m.isPlayed).length;
  const wins = matches.filter(m =>
    m.isPlayed && (
      (m.scoreHome > m.scoreAway && m.teamHomeId === save.userTeamId) ||
      (m.scoreAway > m.scoreHome && m.teamAwayId === save.userTeamId)
    ),
  ).length;
  const losses = playedMatches - wins;

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">경기 일정</h1>
      </div>

      {/* 시즌 요약 */}
      <div className="fm-panel fm-mb-lg">
        <div className="fm-panel__body--compact">
          <div className="fm-flex fm-gap-lg fm-text-md fm-text-secondary">
            <span>
              전체: <strong className="fm-text-primary">{totalMatches}경기</strong>
            </span>
            <span>
              진행: <strong className="fm-text-primary">{playedMatches}/{totalMatches}</strong>
            </span>
            <span className="fm-text-success fm-font-bold">
              {wins}승
            </span>
            <span className="fm-text-danger fm-font-bold">
              {losses}패
            </span>
          </div>
        </div>
      </div>

      {/* 주차별 경기 */}
      {sortedWeeks.map(week => {
        const weekMatches = grouped.get(week)!;
        const isCurrentWeek = week === currentWeek;
        const isPlayoff = week >= 99;
        const weekLabel = isPlayoff
          ? (week === 99 ? '8강' : week === 100 ? '준결승' : '결승')
          : `${week}주차`;

        return (
          <div
            key={week}
            className={`fm-panel fm-mb-sm ${isCurrentWeek ? 'fm-card--highlight' : ''}`}
          >
            <div className="fm-panel__header">
              <span className={`fm-font-semibold fm-text-md ${
                isPlayoff ? 'fm-text-accent' : isCurrentWeek ? 'fm-text-primary' : 'fm-text-secondary'
              }`}>
                {weekLabel}
              </span>
              {isCurrentWeek && (
                <span className="fm-badge fm-badge--accent">현재</span>
              )}
            </div>
            <div className="fm-panel__body--flush">
              {weekMatches.map(match => {
                const isHome = match.teamHomeId === save.userTeamId;
                const opponent = isHome ? match.teamAwayId : match.teamHomeId;
                const userScore = isHome ? match.scoreHome : match.scoreAway;
                const opponentScore = isHome ? match.scoreAway : match.scoreHome;
                const isWin = match.isPlayed && userScore > opponentScore;
                const isLoss = match.isPlayed && userScore < opponentScore;

                return (
                  <div key={match.id} className="fm-match-row">
                    <span className="fm-text-base fm-text-muted" style={{ minWidth: '90px' }}>
                      {match.matchDate ?? '-'}
                    </span>
                    <span className={`fm-text-sm fm-font-semibold ${
                      match.matchType !== 'regular' ? 'fm-text-accent' : 'fm-text-muted'
                    }`} style={{ minWidth: '40px' }}>
                      {MATCH_TYPE_LABELS[match.matchType] ?? match.matchType}
                    </span>
                    <span className="fm-text-base fm-text-muted">
                      {isHome ? 'vs' : '@'}
                    </span>
                    <span className="fm-text-md fm-font-medium fm-text-primary" style={{ minWidth: '60px' }}>
                      {getTeamName(opponent)}
                    </span>
                    <span className="fm-badge fm-badge--default">
                      {match.boFormat}
                    </span>
                    {match.isPlayed ? (
                      <span className={`fm-font-bold fm-text-md ${isWin ? 'fm-text-success' : isLoss ? 'fm-text-danger' : 'fm-text-secondary'}`} style={{ marginLeft: 'auto' }}>
                        {isWin ? 'W' : 'L'} {userScore}:{opponentScore}
                      </span>
                    ) : (
                      <span className="fm-text-base fm-text-muted" style={{ marginLeft: 'auto' }}>예정</span>
                    )}
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
