import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGameStore } from '../../../stores/gameStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { getMatchesByTeam, getTeamTotalSalary, getTeamConditions, getRecentDailyEvents, getExpiringContracts } from '../../../db/queries';
import { TutorialOverlay } from '../../tutorial/TutorialOverlay';
import { MeetingModal } from '../components/MeetingModal';
import { getActiveComplaints } from '../../../engine/complaint/complaintEngine';
import { getBoardExpectations } from '../../../engine/board/boardEngine';
import { getCompletedReports } from '../../../engine/scouting/scoutingEngine';
import { getUnreadCount } from '../../../engine/news/newsEngine';
import type { Match } from '../../../types/match';

const SALARY_CAP = 400000;

interface DashboardAlert {
  type: 'warning' | 'info' | 'danger';
  message: string;
  link?: string;
}

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
  const navigate = useNavigate();

  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [totalSalary, setTotalSalary] = useState<number>(0);
  const [conditions, setConditions] = useState<Map<string, { stamina: number; morale: number; form: number }>>(new Map());
  const [newsEvents, setNewsEvents] = useState<NewsEvent[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
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

        // 알림 체크
        const newAlerts: DashboardAlert[] = [];

        try {
          // 계약 만료 임박 선수
          const expiring = await getExpiringContracts(season.id);
          const teamExpiring = expiring.filter(p => p.teamId === userTeam.id);
          if (teamExpiring.length > 0) {
            const firstName = teamExpiring[0].name;
            const msg = teamExpiring.length > 1
              ? `${firstName} 외 ${teamExpiring.length - 1}명의 계약이 이번 시즌 종료`
              : `${firstName}의 계약이 이번 시즌 종료`;
            newAlerts.push({ type: 'warning', message: msg, link: '/manager/roster' });
          }

          // 활성 불만 (severity 2 이상)
          const complaints = await getActiveComplaints(userTeam.id);
          const severeComplaints = complaints.filter(c => c.severity >= 2);
          if (severeComplaints.length > 0) {
            newAlerts.push({
              type: 'danger',
              message: `선수 불만 ${severeComplaints.length}건 미해결`,
              link: '/manager/roster',
            });
          }

          // 샐러리캡 경고 (90% 이상)
          const salaryRatioVal = salary / SALARY_CAP;
          if (salaryRatioVal >= 0.9) {
            newAlerts.push({
              type: 'danger',
              message: `샐러리캡 ${(salaryRatioVal * 100).toFixed(1)}% 도달`,
              link: '/manager/finance',
            });
          }

          // 읽지 않은 뉴스
          const unreadCount = await getUnreadCount(season.id);
          if (unreadCount > 0) {
            newAlerts.push({
              type: 'info',
              message: `미확인 뉴스 ${unreadCount}건`,
              link: '/manager/news',
            });
          }

          // 보드 만족도 위험 (30 이하)
          const board = await getBoardExpectations(userTeam.id, season.id);
          if (board && board.satisfaction <= 30) {
            newAlerts.push({
              type: 'danger',
              message: '구단 만족도 위험!',
              link: '/manager/board',
            });
          }

          // 스카우팅 리포트 완료
          const reports = await getCompletedReports(userTeam.id);
          if (reports.length > 0) {
            newAlerts.push({
              type: 'info',
              message: `스카우팅 리포트 ${reports.length}건 도착`,
              link: '/manager/scouting',
            });
          }
        } catch (e) {
          console.warn('[ManagerHome] alert check failed:', e);
        }

        if (!cancelled) setAlerts(newAlerts);
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
    return <p style={{ color: 'var(--text-muted)' }}>데이터를 불러오는 중...</p>;
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

      {/* 알림 배너 섹션 */}
      {alerts.length > 0 && (
        <div style={styles.alertSection}>
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              style={{
                ...styles.alertBanner,
                background: alert.type === 'danger'
                  ? 'rgba(220, 60, 60, 0.12)'
                  : alert.type === 'warning'
                  ? 'rgba(200, 155, 60, 0.12)'
                  : 'rgba(96, 165, 250, 0.12)',
                borderColor: alert.type === 'danger'
                  ? 'rgba(220, 60, 60, 0.3)'
                  : alert.type === 'warning'
                  ? 'rgba(200, 155, 60, 0.3)'
                  : 'rgba(96, 165, 250, 0.3)',
                cursor: alert.link ? 'pointer' : 'default',
              }}
              onClick={() => alert.link && navigate(alert.link)}
              role={alert.link ? 'button' : undefined}
              tabIndex={alert.link ? 0 : undefined}
              aria-label={alert.message}
              onKeyDown={(e) => {
                if (alert.link && (e.key === 'Enter' || e.key === ' ')) {
                  navigate(alert.link);
                }
              }}
            >
              <span style={styles.alertIcon}>
                {alert.type === 'danger' ? '!' : alert.type === 'warning' ? '!' : 'i'}
              </span>
              <span
                style={{
                  ...styles.alertMessage,
                  color: alert.type === 'danger'
                    ? '#dc3c3c'
                    : alert.type === 'warning'
                    ? '#c89b3c'
                    : '#60a5fa',
                }}
              >
                {alert.message}
              </span>
              {alert.link && <span style={styles.alertArrow}>&rarr;</span>}
            </div>
          ))}
        </div>
      )}

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
    color: 'var(--text-primary)',
    marginBottom: '24px',
  },
  alertSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '16px',
  },
  alertBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid',
    transition: 'opacity 0.2s',
  },
  alertIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.1)',
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    flexShrink: 0,
  },
  alertMessage: {
    flex: 1,
    fontSize: '13px',
    fontWeight: 500,
  },
  alertArrow: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    flexShrink: 0,
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '16px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--accent)',
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
    color: 'var(--text-muted)',
  },
  infoValue: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
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
    color: 'var(--accent)',
    minWidth: '48px',
  },
  rosterName: {
    flex: 1,
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  rosterAge: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
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
    color: 'var(--text-muted)',
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
    color: 'var(--text-secondary)',
    minWidth: '40px',
  },
  matchDate: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    minWidth: '80px',
  },
  matchVs: {
    flex: 1,
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  matchSide: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  matchScore: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
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
    color: 'var(--text-secondary)',
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
    color: 'var(--accent)',
    minWidth: '40px',
  },
  conditionName: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary)',
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
    color: 'var(--text-muted)',
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
    color: 'var(--text-secondary)',
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
    color: 'var(--text-muted)',
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
    color: 'var(--accent)',
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
    border: '1px solid var(--border)',
    borderRadius: '10px',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    transition: 'all 0.2s',
    position: 'relative',
  },
  actionIcon: {
    fontSize: '20px',
  },
  actionLabel: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  actionCooldown: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    marginLeft: 'auto',
  },
};
