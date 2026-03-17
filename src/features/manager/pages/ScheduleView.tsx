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
    return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p style={{ color: '#6a6a7a' }}>일정을 불러오는 중...</p>;
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
    <div>
      <h1 style={styles.title}>경기 일정</h1>

      {/* 시즌 요약 */}
      <div style={styles.summary}>
        <span style={styles.summaryItem}>
          전체: <strong>{totalMatches}경기</strong>
        </span>
        <span style={styles.summaryItem}>
          진행: <strong>{playedMatches}/{totalMatches}</strong>
        </span>
        <span style={{ ...styles.summaryItem, color: '#90ee90' }}>
          {wins}승
        </span>
        <span style={{ ...styles.summaryItem, color: '#ff6b6b' }}>
          {losses}패
        </span>
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
          <div key={week} style={{
            ...styles.weekBlock,
            ...(isCurrentWeek ? styles.currentWeek : {}),
          }}>
            <div style={styles.weekHeader}>
              <span style={{
                ...styles.weekLabel,
                color: isPlayoff ? '#c89b3c' : isCurrentWeek ? '#f0e6d2' : '#8a8a9a',
              }}>
                {weekLabel}
              </span>
              {isCurrentWeek && (
                <span style={styles.currentBadge}>현재</span>
              )}
            </div>

            {weekMatches.map(match => {
              const isHome = match.teamHomeId === save.userTeamId;
              const opponent = isHome ? match.teamAwayId : match.teamHomeId;
              const userScore = isHome ? match.scoreHome : match.scoreAway;
              const opponentScore = isHome ? match.scoreAway : match.scoreHome;
              const isWin = match.isPlayed && userScore > opponentScore;
              const isLoss = match.isPlayed && userScore < opponentScore;

              return (
                <div key={match.id} style={styles.matchRow}>
                  <span style={styles.matchDate}>
                    {match.matchDate ?? '-'}
                  </span>
                  <span style={{
                    ...styles.matchType,
                    color: match.matchType !== 'regular' ? '#c89b3c' : '#6a6a7a',
                  }}>
                    {MATCH_TYPE_LABELS[match.matchType] ?? match.matchType}
                  </span>
                  <span style={styles.matchVs}>
                    {isHome ? 'vs' : '@'}
                  </span>
                  <span style={styles.matchOpponent}>
                    {getTeamName(opponent)}
                  </span>
                  <span style={styles.matchFormat}>
                    {match.boFormat}
                  </span>
                  {match.isPlayed ? (
                    <span style={{
                      ...styles.matchResult,
                      color: isWin ? '#90ee90' : isLoss ? '#ff6b6b' : '#8a8a9a',
                    }}>
                      {isWin ? 'W' : 'L'} {userScore}:{opponentScore}
                    </span>
                  ) : (
                    <span style={styles.matchPending}>예정</span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {matches.length === 0 && (
        <p style={{ color: '#6a6a7a', fontSize: '13px' }}>등록된 경기가 없습니다.</p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '16px',
  },
  summary: {
    display: 'flex',
    gap: '20px',
    marginBottom: '20px',
    padding: '12px 16px',
    background: '#12122a',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#c0c0d0',
  },
  summaryItem: {
    color: '#c0c0d0',
  },
  weekBlock: {
    marginBottom: '12px',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
  },
  currentWeek: {
    borderColor: '#c89b3c44',
    background: 'rgba(200,155,60,0.05)',
  },
  weekHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
  },
  weekLabel: {
    fontSize: '13px',
    fontWeight: 600,
  },
  currentBadge: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#c89b3c',
    background: 'rgba(200,155,60,0.15)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  matchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '6px 0',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
    fontSize: '13px',
  },
  matchDate: {
    color: '#6a6a7a',
    minWidth: '90px',
    fontSize: '12px',
  },
  matchType: {
    fontSize: '11px',
    fontWeight: 600,
    minWidth: '40px',
  },
  matchVs: {
    color: '#6a6a7a',
    fontSize: '12px',
  },
  matchOpponent: {
    color: '#e0e0e0',
    fontWeight: 500,
    minWidth: '60px',
  },
  matchFormat: {
    color: '#6a6a7a',
    fontSize: '11px',
    background: 'rgba(255,255,255,0.05)',
    padding: '1px 6px',
    borderRadius: '3px',
  },
  matchResult: {
    fontWeight: 700,
    fontSize: '13px',
    marginLeft: 'auto',
  },
  matchPending: {
    color: '#4a4a6a',
    fontSize: '12px',
    marginLeft: 'auto',
  },
};
