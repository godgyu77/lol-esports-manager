import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGameStore } from '../../../stores/gameStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { getMatchesByTeam, getTeamTotalSalary, getTeamConditions, getRecentDailyEvents } from '../../../db/queries';
import { TutorialOverlay } from '../../tutorial/TutorialOverlay';
import { MeetingModal } from '../components/MeetingModal';
import type { Match } from '../../../types/match';

const SALARY_CAP = 400000;

interface NewsEvent {
  id: number;
  seasonId: number;
  gameDate: string;
  eventType: string;
  targetId: string | null;
  description: string;
}

/** 이벤트 타입별 표시 색상 */
const NEWS_EVENT_COLORS: Record<string, string> = {
  match_day: '#c89b3c',
  training: '#50c878',
  scrim: '#50c878',
  rest: '#6a6a7a',
  transfer: '#a78bfa',
  patch: '#60a5fa',
  injury: '#dc3c3c',
  recovery: '#50c878',
  meeting: '#60a5fa',
  event: '#60a5fa',
};

const positionLabel: Record<string, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: '원딜',
  support: '서포터',
};

function formatAmount(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}억`;
  }
  return `${value.toLocaleString()}만`;
}

export function ManagerHome() {
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);
  const tutorialComplete = useSettingsStore((s) => s.tutorialComplete);

  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [totalSalary, setTotalSalary] = useState<number>(0);
  const [conditions, setConditions] = useState<Map<string, { stamina: number; morale: number; form: number }>>(new Map());
  const [newsEvents, setNewsEvents] = useState<NewsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<'meeting' | 'press' | null>(null);
  const [lastMeetingDate, setLastMeetingDate] = useState<string | null>(null);
  const [lastPressDate, setLastPressDate] = useState<string | null>(null);

  const userTeam = teams.find((t) => t.id === save?.userTeamId);

  useEffect(() => {
    if (!userTeam || !season) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [matches, salary, cond, news] = await Promise.all([
          getMatchesByTeam(season.id, userTeam.id),
          getTeamTotalSalary(userTeam.id),
          getTeamConditions(userTeam.id, season.currentDate),
          getRecentDailyEvents(season.id, 3, 0),
        ]);

        if (cancelled) return;

        const played = matches.filter((m) => m.isPlayed);
        const unplayed = matches.filter((m) => !m.isPlayed);

        setRecentMatches(played.slice(-3).reverse());
        setUpcomingMatches(unplayed.slice(0, 3));
        setTotalSalary(salary);
        setConditions(cond);
        setNewsEvents(news);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userTeam?.id, season?.id, season?.currentDate]);

  if (!userTeam || !season) {
    return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  }

  // 1군 로스터 (division이 있으면 main 기준, 없으면 처음 5명)
  const mainRoster = userTeam.roster.filter(
    (p) => (p as { division?: string }).division === 'main',
  );
  const displayRoster = mainRoster.length > 0 ? mainRoster.slice(0, 5) : userTeam.roster.slice(0, 5);

  const getTeamName = (teamId: string): string => {
    const team = teams.find((t) => t.id === teamId);
    return team?.name ?? teamId;
  };

  const getMatchResult = (match: Match): 'win' | 'lose' => {
    const isHome = match.teamHomeId === userTeam.id;
    if (isHome) return match.scoreHome > match.scoreAway ? 'win' : 'lose';
    return match.scoreAway > match.scoreHome ? 'win' : 'lose';
  };

  const getOpponentId = (match: Match): string => {
    return match.teamHomeId === userTeam.id ? match.teamAwayId : match.teamHomeId;
  };

  /** 날짜 간 일수 차이 계산 (YYYY-MM-DD 형식) */
  const getDaysDiff = useCallback((from: string, to: string): number => {
    const d1 = new Date(from);
    const d2 = new Date(to);
    return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  }, []);

  const COOLDOWN_DAYS = 7;

  const meetingCooldown = lastMeetingDate && season
    ? Math.max(0, COOLDOWN_DAYS - getDaysDiff(lastMeetingDate, season.currentDate))
    : 0;

  const pressCooldown = lastPressDate && season
    ? Math.max(0, COOLDOWN_DAYS - getDaysDiff(lastPressDate, season.currentDate))
    : 0;

  const handleCloseModal = () => {
    if (modalMode === 'meeting' && season) {
      setLastMeetingDate(season.currentDate);
    } else if (modalMode === 'press' && season) {
      setLastPressDate(season.currentDate);
    }
    setModalMode(null);
  };

  /** 최근 경기 결과 요약 텍스트 */
  const recentResultsText = recentMatches.length > 0
    ? (() => {
        const wins = recentMatches.filter((m) => getMatchResult(m) === 'win').length;
        const losses = recentMatches.length - wins;
        return `최근 ${recentMatches.length}경기: ${wins}승 ${losses}패`;
      })()
    : '경기 기록 없음';

  const salaryRatio = totalSalary / SALARY_CAP;

  return (
    <div>
      {!tutorialComplete && <TutorialOverlay />}
      <h1 style={styles.title}>팀 대시보드</h1>

      {/* 팀 정보 카드 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>{userTeam.name}</h2>
        <div style={styles.infoGrid}>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>리전</span>
            <span style={styles.infoValue}>{userTeam.region}</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>예산</span>
            <span style={styles.infoValue}>{formatAmount(userTeam.budget)}</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>명성</span>
            <span style={styles.infoValue}>{userTeam.reputation}</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>시즌</span>
            <span style={styles.infoValue}>
              {season.year} {season.split === 'spring' ? '스프링' : '서머'}
            </span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>주차</span>
            <span style={styles.infoValue}>{season.currentWeek}주차</span>
          </div>
        </div>
      </div>

      {/* 1군 로스터 요약 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>1군 로스터</h2>
        <div style={styles.rosterList}>
          {displayRoster.map((player) => {
            const avgStat = Math.round(
              (player.stats.mechanical +
                player.stats.gameSense +
                player.stats.teamwork +
                player.stats.consistency +
                player.stats.laning +
                player.stats.aggression) /
                6,
            );
            return (
              <div key={player.id} style={styles.rosterItem}>
                <span style={styles.rosterPos}>{positionLabel[player.position] ?? player.position}</span>
                <span style={styles.rosterName}>{player.name}</span>
                <span style={styles.rosterAge}>{player.age}세</span>
                <span style={styles.rosterOvr}>OVR {avgStat}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 면담 / 기자회견 버튼 */}
      <div style={styles.actionRow}>
        <button
          style={{
            ...styles.actionBtn,
            opacity: meetingCooldown > 0 ? 0.5 : 1,
          }}
          onClick={() => setModalMode('meeting')}
        >
          <span style={styles.actionIcon}>🗣️</span>
          <span style={styles.actionLabel}>선수 면담</span>
          {meetingCooldown > 0 && (
            <span style={styles.actionCooldown}>{meetingCooldown}일 후 가능</span>
          )}
        </button>
        <button
          style={{
            ...styles.actionBtn,
            opacity: pressCooldown > 0 ? 0.5 : 1,
          }}
          onClick={() => setModalMode('press')}
        >
          <span style={styles.actionIcon}>🎤</span>
          <span style={styles.actionLabel}>기자회견</span>
          {pressCooldown > 0 && (
            <span style={styles.actionCooldown}>{pressCooldown}일 후 가능</span>
          )}
        </button>
      </div>

      {/* 모달 */}
      {modalMode && (
        <MeetingModal
          mode={modalMode}
          teamName={userTeam.name}
          players={displayRoster}
          currentDate={season.currentDate}
          recentResults={recentResultsText}
          cooldownDays={modalMode === 'meeting' ? meetingCooldown : pressCooldown}
          onClose={handleCloseModal}
        />
      )}

      {/* 위젯 그리드 */}
      <div style={styles.widgetGrid}>
        {/* 다가오는 경기 */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>다가오는 경기</h2>
          {loading ? (
            <p style={styles.dimText}>불러오는 중...</p>
          ) : upcomingMatches.length === 0 ? (
            <p style={styles.dimText}>예정된 경기가 없습니다</p>
          ) : (
            <div style={styles.matchList}>
              {upcomingMatches.map((match) => (
                <div key={match.id} style={styles.matchItem}>
                  <span style={styles.matchWeek}>{match.week}주차</span>
                  <span style={styles.matchDate}>{match.matchDate ?? '-'}</span>
                  <span style={styles.matchVs}>
                    vs {getTeamName(getOpponentId(match))}
                  </span>
                  <span style={styles.matchSide}>
                    {match.teamHomeId === userTeam.id ? '홈' : '원정'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 최근 결과 */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>최근 결과</h2>
          {loading ? (
            <p style={styles.dimText}>불러오는 중...</p>
          ) : recentMatches.length === 0 ? (
            <p style={styles.dimText}>경기 기록이 없습니다</p>
          ) : (
            <div style={styles.matchList}>
              {recentMatches.map((match) => {
                const result = getMatchResult(match);
                const isHome = match.teamHomeId === userTeam.id;
                const myScore = isHome ? match.scoreHome : match.scoreAway;
                const opScore = isHome ? match.scoreAway : match.scoreHome;
                return (
                  <div key={match.id} style={styles.matchItem}>
                    <span
                      style={{
                        ...styles.resultBadge,
                        background: result === 'win' ? 'rgba(80,200,120,0.15)' : 'rgba(220,60,60,0.15)',
                        color: result === 'win' ? '#50c878' : '#dc3c3c',
                      }}
                    >
                      {result === 'win' ? '승' : '패'}
                    </span>
                    <span style={styles.matchVs}>
                      vs {getTeamName(getOpponentId(match))}
                    </span>
                    <span style={styles.matchScore}>
                      {myScore} : {opScore}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 재정 요약 */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>재정 요약</h2>
          {loading ? (
            <p style={styles.dimText}>불러오는 중...</p>
          ) : (
            <div style={styles.financeList}>
              <div style={styles.financeItem}>
                <span style={styles.infoLabel}>예산</span>
                <span style={styles.infoValue}>{formatAmount(userTeam.budget)}</span>
              </div>
              <div style={styles.financeItem}>
                <span style={styles.infoLabel}>총 연봉</span>
                <span style={styles.infoValue}>{formatAmount(totalSalary)}</span>
              </div>
              <div style={styles.financeItem}>
                <span style={styles.infoLabel}>샐러리캡</span>
                <span style={styles.infoValue}>{formatAmount(SALARY_CAP)}</span>
              </div>
              <div style={styles.salaryBarWrap}>
                <div style={styles.salaryBarBg}>
                  <div
                    style={{
                      ...styles.salaryBarFill,
                      width: `${Math.min(salaryRatio * 100, 100)}%`,
                      background: salaryRatio > 0.9 ? '#dc3c3c' : salaryRatio > 0.7 ? '#c89b3c' : '#50c878',
                    }}
                  />
                </div>
                <span style={styles.salaryPercent}>
                  {(salaryRatio * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 최근 뉴스 */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>최근 뉴스</h2>
          {loading ? (
            <p style={styles.dimText}>불러오는 중...</p>
          ) : newsEvents.length === 0 ? (
            <p style={styles.dimText}>아직 기록된 이벤트가 없습니다</p>
          ) : (
            <div style={styles.newsList}>
              {newsEvents.map((event) => {
                const color = NEWS_EVENT_COLORS[event.eventType] ?? '#6a6a7a';
                return (
                  <div key={event.id} style={styles.newsItem}>
                    <div
                      style={{
                        ...styles.newsDot,
                        background: color,
                      }}
                    />
                    <div style={styles.newsContent}>
                      <span style={styles.newsDate}>{event.gameDate}</span>
                      <span style={styles.newsDesc}>
                        {event.description || event.eventType}
                      </span>
                    </div>
                  </div>
                );
              })}
              <Link to="/manager/news" style={styles.newsMoreLink}>
                더보기 &rarr;
              </Link>
            </div>
          )}
        </div>

        {/* 선수 컨디션 */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>선수 컨디션</h2>
          {loading ? (
            <p style={styles.dimText}>불러오는 중...</p>
          ) : (
            <div style={styles.conditionList}>
              {displayRoster.map((player) => {
                const cond = conditions.get(player.id);
                const stamina = cond?.stamina ?? 0;
                const morale = cond?.morale ?? 0;
                return (
                  <div key={player.id} style={styles.conditionItem}>
                    <span style={styles.conditionPos}>
                      {positionLabel[player.position] ?? player.position}
                    </span>
                    <span style={styles.conditionName}>{player.name}</span>
                    <div style={styles.conditionBars}>
                      <div style={styles.conditionBarGroup}>
                        <span style={styles.conditionBarLabel}>체력</span>
                        <div style={styles.conditionBarBg}>
                          <div
                            style={{
                              ...styles.conditionBarFill,
                              width: `${stamina}%`,
                              background: stamina > 70 ? '#50c878' : stamina > 40 ? '#c89b3c' : '#dc3c3c',
                            }}
                          />
                        </div>
                        <span style={styles.conditionBarValue}>{stamina}</span>
                      </div>
                      <div style={styles.conditionBarGroup}>
                        <span style={styles.conditionBarLabel}>사기</span>
                        <div style={styles.conditionBarBg}>
                          <div
                            style={{
                              ...styles.conditionBarFill,
                              width: `${morale}%`,
                              background: morale > 70 ? '#50c878' : morale > 40 ? '#c89b3c' : '#dc3c3c',
                            }}
                          />
                        </div>
                        <span style={styles.conditionBarValue}>{morale}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '24px',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a2a4a',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '16px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#c89b3c',
    marginBottom: '16px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  infoLabel: {
    fontSize: '12px',
    color: '#6a6a7a',
  },
  infoValue: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#e0e0e0',
  },
  rosterList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  rosterItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
  },
  rosterPos: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#c89b3c',
    minWidth: '48px',
  },
  rosterName: {
    flex: 1,
    fontSize: '14px',
    fontWeight: 500,
    color: '#e0e0e0',
  },
  rosterAge: {
    fontSize: '12px',
    color: '#8a8a9a',
  },
  rosterOvr: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#a0d0ff',
    minWidth: '60px',
    textAlign: 'right',
  },
  dimText: {
    fontSize: '13px',
    color: '#6a6a7a',
  },
  widgetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  matchList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  matchItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
  },
  matchWeek: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#8a8a9a',
    minWidth: '40px',
  },
  matchDate: {
    fontSize: '12px',
    color: '#6a6a7a',
    minWidth: '80px',
  },
  matchVs: {
    flex: 1,
    fontSize: '14px',
    fontWeight: 500,
    color: '#e0e0e0',
  },
  matchSide: {
    fontSize: '12px',
    color: '#8a8a9a',
  },
  matchScore: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#e0e0e0',
    minWidth: '40px',
    textAlign: 'right',
  },
  resultBadge: {
    fontSize: '12px',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '4px',
    minWidth: '28px',
    textAlign: 'center',
  },
  financeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  financeItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  salaryBarWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '4px',
  },
  salaryBarBg: {
    flex: 1,
    height: '8px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  salaryBarFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  salaryPercent: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#8a8a9a',
    minWidth: '48px',
    textAlign: 'right',
  },
  conditionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  conditionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
  },
  conditionPos: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#c89b3c',
    minWidth: '40px',
  },
  conditionName: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#e0e0e0',
    minWidth: '80px',
  },
  conditionBars: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  conditionBarGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  conditionBarLabel: {
    fontSize: '11px',
    color: '#6a6a7a',
    minWidth: '28px',
  },
  conditionBarBg: {
    flex: 1,
    height: '6px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  conditionBarFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  conditionBarValue: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#8a8a9a',
    minWidth: '28px',
    textAlign: 'right',
  },
  newsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  newsItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
  },
  newsDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginTop: '5px',
    flexShrink: 0,
  },
  newsContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    minWidth: 0,
  },
  newsDate: {
    fontSize: '11px',
    color: '#6a6a7a',
  },
  newsDesc: {
    fontSize: '13px',
    color: '#c0c0d0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  newsMoreLink: {
    fontSize: '13px',
    color: '#c89b3c',
    textDecoration: 'none',
    textAlign: 'right',
    marginTop: '4px',
  },
  actionRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  actionBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 18px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a2a4a',
    borderRadius: '10px',
    cursor: 'pointer',
    color: '#e0e0e0',
    transition: 'all 0.2s',
    position: 'relative',
  },
  actionIcon: {
    fontSize: '20px',
  },
  actionLabel: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#f0e6d2',
  },
  actionCooldown: {
    fontSize: '11px',
    color: '#8a8a9a',
    marginLeft: 'auto',
  },
};
