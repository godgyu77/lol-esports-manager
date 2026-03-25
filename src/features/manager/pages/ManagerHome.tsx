import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGameStore } from '../../../stores/gameStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useBgm } from '../../../hooks/useBgm';
import { getMatchesByTeam, getTeamTotalSalary, getTeamConditions, getRecentDailyEvents, getExpiringContracts } from '../../../db/queries';
import { TutorialOverlay } from '../../tutorial/TutorialOverlay';
import { MeetingModal } from '../components/MeetingModal';
import { getActiveComplaints } from '../../../engine/complaint/complaintEngine';
import { getBoardExpectations } from '../../../engine/board/boardEngine';
import { getCompletedReports } from '../../../engine/scouting/scoutingEngine';
import { getUnreadCount } from '../../../engine/news/newsEngine';
import { getInjuredPlayerIds } from '../../../engine/injury/injuryEngine';
import { getSatisfactionReport } from '../../../engine/satisfaction/playerSatisfactionEngine';
import { generateDailyBriefing, generateCoachMeeting, type DailyBriefing, type CoachMeetingResult } from '../../../ai/advancedAiService';
import { formatAmount } from '../../../utils/formatUtils';
import type { Match } from '../../../types/match';
import './ManagerHome.css';

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

/** position -> fm-pos-badge class suffix */
const positionBadgeClass: Record<string, string> = {
  top: 'top',
  jungle: 'jgl',
  mid: 'mid',
  adc: 'adc',
  support: 'sup',
};

/** OVR 값에 따른 fm-ovr class suffix */
function getOvrClass(ovr: number): string {
  if (ovr >= 85) return 'fm-ovr--elite';
  if (ovr >= 75) return 'fm-ovr--high';
  if (ovr >= 60) return 'fm-ovr--mid';
  return 'fm-ovr--low';
}

/** 바 색상 class (value 기준) */
function getBarColorClass(value: number): string {
  if (value > 70) return 'fm-bar__fill--green';
  if (value > 40) return 'fm-bar__fill--yellow';
  return 'fm-bar__fill--red';
}

export function ManagerHome() {
  useBgm('game');
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
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);

  // 코치 미팅
  const [coachMeetingResult, setCoachMeetingResult] = useState<CoachMeetingResult | null>(null);
  const [coachMeetingLoading, setCoachMeetingLoading] = useState(false);
  const [coachMeetingOpen, setCoachMeetingOpen] = useState(false);
  const [lastCoachMeetingDate, setLastCoachMeetingDate] = useState<string | null>(null);

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
  }, [userTeam, season]);

  // 일간 브리핑 로딩
  useEffect(() => {
    if (!userTeam || !season) return;
    let cancelled = false;

    const loadBriefing = async () => {
      setBriefingLoading(true);
      try {
        // 부상자 이름 조회
        const injuredIds = await getInjuredPlayerIds(userTeam.id);
        const injuredPlayers = userTeam.roster
          .filter((p) => injuredIds.has(p.id))
          .map((p) => p.name);

        // 만족도 낮은 선수 조회
        let lowSatisfactionPlayers: string[] = [];
        try {
          const satisfactions = await getSatisfactionReport(userTeam.id);
          lowSatisfactionPlayers = satisfactions
            .filter((s) => s.overallSatisfaction < 40)
            .map((s) => {
              const player = userTeam.roster.find((p) => p.id === s.playerId);
              return player?.name ?? s.playerId;
            });
        } catch {
          // 만족도 조회 실패 무시
        }

        // 갈등 수 조회
        let activeConflicts = 0;
        try {
          const complaints = await getActiveComplaints(userTeam.id);
          activeConflicts = complaints.filter((c) => c.severity >= 2).length;
        } catch {
          // 갈등 조회 실패 무시
        }

        // 다음 경기 조회
        const matches = await getMatchesByTeam(season.id, userTeam.id);
        const unplayed = matches.filter((m) => !m.isPlayed);
        const nextMatch = unplayed[0];
        let nextOpponentName: string | undefined;
        let nextMatchDate: string | undefined;
        if (nextMatch) {
          const opponentId = nextMatch.teamHomeId === userTeam.id ? nextMatch.teamAwayId : nextMatch.teamHomeId;
          nextOpponentName = teams.find((t) => t.id === opponentId)?.name ?? opponentId;
          nextMatchDate = nextMatch.matchDate ?? undefined;
        }

        // 최근 전적
        const played = matches.filter((m) => m.isPlayed).slice(-5);
        const wins = played.filter((m) => {
          const isHome = m.teamHomeId === userTeam.id;
          return isHome ? m.scoreHome > m.scoreAway : m.scoreAway > m.scoreHome;
        }).length;
        const losses = played.length - wins;
        const recentForm = played.length > 0 ? `${wins}승 ${losses}패` : '경기 기록 없음';

        // 팀 사기 평균
        const cond = await getTeamConditions(userTeam.id, season.currentDate);
        let totalMorale = 0;
        let moraleCount = 0;
        cond.forEach((c) => { totalMorale += c.morale; moraleCount++; });
        const teamMorale = moraleCount > 0 ? Math.round(totalMorale / moraleCount) : 70;

        // 예산 상태
        const budgetStatus = userTeam.budget > 10000 ? '여유' : userTeam.budget > 3000 ? '보통' : '부족';

        if (cancelled) return;

        const result = await generateDailyBriefing({
          teamName: userTeam.name,
          currentDate: season.currentDate,
          nextOpponentName,
          nextMatchDate,
          teamMorale,
          injuredPlayers,
          recentForm,
          lowSatisfactionPlayers,
          activeConflicts,
          budgetStatus,
        });

        if (!cancelled) setBriefing(result);
      } catch (err) {
        console.warn('[ManagerHome] briefing load failed:', err);
      } finally {
        if (!cancelled) setBriefingLoading(false);
      }
    };

    loadBriefing();
    return () => { cancelled = true; };
  }, [userTeam, season, teams]);

  /** 날짜 간 일수 차이 계산 (YYYY-MM-DD 형식) */
  const getDaysDiff = useCallback((from: string, to: string): number => {
    const d1 = new Date(from);
    const d2 = new Date(to);
    return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  }, []);

  if (!userTeam || !season) {
    return <p className="fm-text-md fm-text-muted">데이터를 불러오는 중...</p>;
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

  const COOLDOWN_DAYS = 7;

  const meetingCooldown = lastMeetingDate && season
    ? Math.max(0, COOLDOWN_DAYS - getDaysDiff(lastMeetingDate, season.currentDate))
    : 0;

  const pressCooldown = lastPressDate && season
    ? Math.max(0, COOLDOWN_DAYS - getDaysDiff(lastPressDate, season.currentDate))
    : 0;

  const coachMeetingCooldown = lastCoachMeetingDate && season
    ? Math.max(0, COOLDOWN_DAYS - getDaysDiff(lastCoachMeetingDate, season.currentDate))
    : 0;

  /** 코치 미팅 실행 */
  const handleCoachMeeting = async () => {
    if (!userTeam || !season || coachMeetingCooldown > 0) return;

    setCoachMeetingOpen(true);
    setCoachMeetingLoading(true);
    setCoachMeetingResult(null);

    try {
      // 부상자 이름
      const injuredIds = await getInjuredPlayerIds(userTeam.id);
      const injuredPlayers = userTeam.roster
        .filter((p) => injuredIds.has(p.id))
        .map((p) => p.name);

      // 사기 낮은 선수
      let lowMoralePlayers: string[] = [];
      try {
        const satisfactions = await getSatisfactionReport(userTeam.id);
        lowMoralePlayers = satisfactions
          .filter((s) => s.overallSatisfaction < 40)
          .map((s) => {
            const player = userTeam.roster.find((p) => p.id === s.playerId);
            return player?.name ?? s.playerId;
          });
      } catch { /* 무시 */ }

      // 다음 상대
      const matches = await getMatchesByTeam(season.id, userTeam.id);
      const unplayed = matches.filter((m) => !m.isPlayed);
      const nextMatch = unplayed[0];
      let nextOpponent: string | undefined;
      if (nextMatch) {
        const opponentId = nextMatch.teamHomeId === userTeam.id ? nextMatch.teamAwayId : nextMatch.teamHomeId;
        nextOpponent = teams.find((t) => t.id === opponentId)?.name ?? opponentId;
      }

      // 최근 전적
      const played = matches.filter((m) => m.isPlayed).slice(-5);
      const wins = played.filter((m) => {
        const isHome = m.teamHomeId === userTeam.id;
        return isHome ? m.scoreHome > m.scoreAway : m.scoreAway > m.scoreHome;
      }).length;
      const losses = played.length - wins;
      const form = played.length > 0 ? `${wins}승 ${losses}패` : '경기 기록 없음';

      // 코치 이름 (스태프에서 조회 또는 기본값)
      const coachName = '김코치'; // 기본 코치 이름

      const result = await generateCoachMeeting({
        teamName: userTeam.name,
        coachName,
        recentForm: form,
        nextOpponent,
        injuredPlayers,
        lowMoralePlayers,
        teamStrength: '라인전 강점',
        teamWeakness: '후반 운영',
      });

      setCoachMeetingResult(result);
      setLastCoachMeetingDate(season.currentDate);
    } catch (err) {
      console.warn('[ManagerHome] coach meeting failed:', err);
    } finally {
      setCoachMeetingLoading(false);
    }
  };

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

      {/* Page Header */}
      <div className="fm-page-header">
        <h1 className="fm-page-title">팀 대시보드</h1>
      </div>

      {/* 알림 배너 섹션 */}
      {alerts.length > 0 && (
        <div className="fm-flex-col fm-gap-sm fm-mb-md">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`fm-alert fm-alert--${alert.type}`}
              style={{ cursor: alert.link ? 'pointer' : 'default' }}
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
              <span className="fm-alert__icon">
                {alert.type === 'danger' ? '!' : alert.type === 'warning' ? '!' : 'i'}
              </span>
              <span className="fm-alert__text">{alert.message}</span>
              {alert.link && <span className="fm-alert__action">&rarr;</span>}
            </div>
          ))}
        </div>
      )}

      {/* 일간 브리핑 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">일간 브리핑</span>
        </div>
        <div className="fm-panel__body">
          {briefingLoading ? (
            <div className="fm-flex-col fm-gap-sm">
              <div className="mh-skeleton-line" />
              <div className="mh-skeleton-line" style={{ width: '70%' }} />
              <div className="mh-skeleton-line" style={{ width: '50%' }} />
            </div>
          ) : briefing ? (
            <div className="fm-flex-col fm-gap-md">
              <p className="fm-text-lg fm-font-medium fm-text-primary" style={{ lineHeight: '1.5', margin: 0 }}>
                {briefing.briefing}
              </p>
              {briefing.alerts.length > 0 && (
                <div className="fm-flex-col fm-gap-xs">
                  <span className="fm-text-xs fm-font-semibold fm-text-muted fm-text-upper">주의 사항</span>
                  {briefing.alerts.map((alert, i) => (
                    <div key={i} className="mh-briefing-alert-item">
                      <span className="mh-briefing-alert-dot" />
                      <span className="mh-briefing-alert-text">{alert}</span>
                    </div>
                  ))}
                </div>
              )}
              {briefing.advice.length > 0 && (
                <div className="fm-flex-col fm-gap-xs">
                  <span className="fm-text-xs fm-font-semibold fm-text-muted fm-text-upper">오늘의 조언</span>
                  {briefing.advice.map((adv, i) => (
                    <div key={i} className="mh-briefing-advice-item">
                      <span className="mh-briefing-advice-dot" />
                      <span className="mh-briefing-advice-text">{adv}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="fm-text-base fm-text-muted">브리핑을 생성할 수 없습니다</p>
          )}
        </div>
      </div>

      {/* 팀 정보 카드 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">{userTeam.name}</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--3">
            <div className="fm-stat">
              <span className="fm-stat__label">리전</span>
              <span className="fm-stat__value fm-stat__value--sm">{userTeam.region}</span>
            </div>
            <div className="fm-stat">
              <span className="fm-stat__label">예산</span>
              <span className="fm-stat__value fm-stat__value--sm">{formatAmount(userTeam.budget)}</span>
            </div>
            <div className="fm-stat">
              <span className="fm-stat__label">명성</span>
              <span className="fm-stat__value fm-stat__value--sm">{userTeam.reputation}</span>
            </div>
            <div className="fm-stat">
              <span className="fm-stat__label">시즌</span>
              <span className="fm-stat__value fm-stat__value--sm">
                {season.year} {season.split === 'spring' ? '스프링' : '서머'}
              </span>
            </div>
            <div className="fm-stat">
              <span className="fm-stat__label">주차</span>
              <span className="fm-stat__value fm-stat__value--sm">{season.currentWeek}주차</span>
            </div>
          </div>
        </div>
      </div>

      {/* 1군 로스터 요약 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">1군 로스터</span>
        </div>
        <div className="fm-panel__body--flush">
          <table className="fm-table fm-table--striped">
            <thead>
              <tr>
                <th>포지션</th>
                <th>이름</th>
                <th className="text-center">나이</th>
                <th className="text-right">OVR</th>
              </tr>
            </thead>
            <tbody>
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
                const posBadge = positionBadgeClass[player.position] ?? 'mid';
                return (
                  <tr key={player.id}>
                    <td>
                      <span className={`fm-pos-badge fm-pos-badge--${posBadge}`}>
                        {positionLabel[player.position] ?? player.position}
                      </span>
                    </td>
                    <td className="fm-cell--name">{player.name}</td>
                    <td className="text-center">{player.age}세</td>
                    <td className="text-right">
                      <span className={`fm-ovr ${getOvrClass(avgStat)}`}>{avgStat}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 빠른 메뉴 */}
      <div className="fm-grid fm-grid--3 fm-mb-md">
        <button
          className="mh-action-card"
          onClick={() => navigate('analysis')}
          aria-label="상대 분석 페이지로 이동"
        >
          <span className="mh-action-icon">🔍</span>
          <span className="mh-action-label">상대 분석</span>
        </button>
        <button
          className="mh-action-card"
          onClick={() => navigate('patch-meta')}
          aria-label="패치 메타 페이지로 이동"
        >
          <span className="mh-action-icon">📊</span>
          <span className="mh-action-label">패치 메타</span>
        </button>
        <button
          className="mh-action-card"
          onClick={() => navigate('career')}
          aria-label="커리어 페이지로 이동"
        >
          <span className="mh-action-icon">🏆</span>
          <span className="mh-action-label">커리어</span>
        </button>
      </div>

      {/* 업적 / 팀 히스토리 */}
      <div className="fm-grid fm-grid--2 fm-mb-md">
        <button
          className="mh-action-card"
          onClick={() => navigate('achievements')}
          aria-label="업적 페이지로 이동"
        >
          <span className="mh-action-icon">🎖️</span>
          <span className="mh-action-label">업적</span>
        </button>
        <button
          className="mh-action-card"
          onClick={() => navigate('team-history')}
          aria-label="팀 히스토리 페이지로 이동"
        >
          <span className="mh-action-icon">📜</span>
          <span className="mh-action-label">팀 히스토리</span>
        </button>
      </div>

      {/* 면담 / 기자회견 / 코치 미팅 버튼 */}
      <div className="fm-grid fm-grid--3 fm-mb-md">
        <button
          className="mh-action-card"
          style={{ opacity: meetingCooldown > 0 ? 0.5 : 1 }}
          onClick={() => setModalMode('meeting')}
        >
          <span className="mh-action-icon">🗣️</span>
          <span className="mh-action-label">선수 면담</span>
          {meetingCooldown > 0 && (
            <span className="mh-action-cooldown">{meetingCooldown}일 후 가능</span>
          )}
        </button>
        <button
          className="mh-action-card"
          style={{ opacity: pressCooldown > 0 ? 0.5 : 1 }}
          onClick={() => setModalMode('press')}
        >
          <span className="mh-action-icon">🎤</span>
          <span className="mh-action-label">기자회견</span>
          {pressCooldown > 0 && (
            <span className="mh-action-cooldown">{pressCooldown}일 후 가능</span>
          )}
        </button>
        <button
          className="mh-action-card"
          style={{ opacity: coachMeetingCooldown > 0 ? 0.5 : 1 }}
          onClick={handleCoachMeeting}
          disabled={coachMeetingCooldown > 0}
        >
          <span className="mh-action-icon">📋</span>
          <span className="mh-action-label">코치 미팅</span>
          {coachMeetingCooldown > 0 && (
            <span className="mh-action-cooldown">{coachMeetingCooldown}일 후 가능</span>
          )}
        </button>
      </div>

      {/* 코치 미팅 모달 */}
      {coachMeetingOpen && (
        <div
          className="fm-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="코치 미팅"
          onClick={() => !coachMeetingLoading && setCoachMeetingOpen(false)}
        >
          <div className="fm-modal" onClick={e => e.stopPropagation()}>
            <div className="fm-modal__header">
              <span className="fm-modal__title">코칭스태프 미팅</span>
              {!coachMeetingLoading && (
                <button
                  className="fm-modal__close"
                  onClick={() => setCoachMeetingOpen(false)}
                  aria-label="닫기"
                >
                  &times;
                </button>
              )}
            </div>

            <div className="fm-modal__body">
              {coachMeetingLoading ? (
                <div className="fm-text-center fm-p-lg">
                  <p className="fm-text-lg fm-text-muted">코치가 회의를 준비하고 있습니다...</p>
                </div>
              ) : coachMeetingResult ? (
                <div className="fm-flex-col fm-gap-md">
                  {/* 코치 이름 */}
                  <div className="fm-info-row">
                    <span className="fm-info-row__label">코치</span>
                    <span className="fm-info-row__value">{coachMeetingResult.coachName}</span>
                  </div>

                  {/* 회의 안건 */}
                  <div className="fm-flex-col fm-gap-sm">
                    <span className="mh-coach-section-title">회의 안건</span>
                    {coachMeetingResult.agenda.map((item, i) => (
                      <div key={i} className="fm-flex fm-items-center fm-gap-sm" style={{ padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                        <span className="mh-coach-agenda-num">{i + 1}</span>
                        <span className="fm-text-base fm-text-secondary">{item}</span>
                      </div>
                    ))}
                  </div>

                  {/* 핵심 추천 */}
                  <div className="mh-coach-box--success">
                    <span className="mh-coach-box-label fm-text-success">핵심 추천</span>
                    <p className="mh-coach-box-text fm-text-success">{coachMeetingResult.recommendation}</p>
                  </div>

                  {/* 전술 조언 */}
                  <div className="mh-coach-box--info">
                    <span className="mh-coach-box-label fm-text-info">전술 조언</span>
                    <p className="mh-coach-box-text fm-text-info">{coachMeetingResult.tacticalAdvice}</p>
                  </div>

                  {/* 선수 우려 */}
                  {coachMeetingResult.playerConcern && (
                    <div className="mh-coach-box--danger">
                      <span className="mh-coach-box-label fm-text-danger">선수 관련 우려</span>
                      <p className="mh-coach-box-text fm-text-danger">{coachMeetingResult.playerConcern}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="fm-text-base fm-text-muted">미팅을 진행할 수 없습니다.</p>
              )}
            </div>

            {coachMeetingResult && (
              <div className="fm-modal__footer">
                <button
                  className="fm-btn fm-btn--primary"
                  onClick={() => setCoachMeetingOpen(false)}
                >
                  확인
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
      <div className="fm-grid fm-grid--2">
        {/* 다가오는 경기 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">다가오는 경기</span>
          </div>
          <div className="fm-panel__body--flush">
            {loading ? (
              <div className="fm-p-md">
                <p className="fm-text-base fm-text-muted">불러오는 중...</p>
              </div>
            ) : upcomingMatches.length === 0 ? (
              <div className="fm-p-md">
                <p className="fm-text-base fm-text-muted">예정된 경기가 없습니다</p>
              </div>
            ) : (
              upcomingMatches.map((match) => (
                <div key={match.id} className="fm-match-row">
                  <span className="fm-badge fm-badge--default">{match.week}주차</span>
                  <span className="fm-text-sm fm-text-muted" style={{ minWidth: '72px' }}>
                    {match.matchDate ?? '-'}
                  </span>
                  <span className="fm-flex-1 fm-text-base fm-font-medium fm-text-primary">
                    vs {getTeamName(getOpponentId(match))}
                  </span>
                  <span className="fm-badge fm-badge--accent">
                    {match.teamHomeId === userTeam.id ? '홈' : '원정'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 최근 결과 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">최근 결과</span>
          </div>
          <div className="fm-panel__body--flush">
            {loading ? (
              <div className="fm-p-md">
                <p className="fm-text-base fm-text-muted">불러오는 중...</p>
              </div>
            ) : recentMatches.length === 0 ? (
              <div className="fm-p-md">
                <p className="fm-text-base fm-text-muted">경기 기록이 없습니다</p>
              </div>
            ) : (
              recentMatches.map((match) => {
                const result = getMatchResult(match);
                const isHome = match.teamHomeId === userTeam.id;
                const myScore = isHome ? match.scoreHome : match.scoreAway;
                const opScore = isHome ? match.scoreAway : match.scoreHome;
                return (
                  <div key={match.id} className="fm-match-row">
                    <span className={`fm-result-badge fm-result-badge--${result === 'win' ? 'win' : 'loss'}`}>
                      {result === 'win' ? '승' : '패'}
                    </span>
                    <span className="fm-flex-1 fm-text-base fm-font-medium fm-text-primary">
                      vs {getTeamName(getOpponentId(match))}
                    </span>
                    <span className="fm-text-lg fm-font-bold fm-text-primary" style={{ minWidth: '40px', textAlign: 'right' }}>
                      {myScore} : {opScore}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 재정 요약 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">재정 요약</span>
          </div>
          <div className="fm-panel__body">
            {loading ? (
              <p className="fm-text-base fm-text-muted">불러오는 중...</p>
            ) : (
              <div className="fm-flex-col fm-gap-sm">
                <div className="fm-info-row">
                  <span className="fm-info-row__label">예산</span>
                  <span className="fm-info-row__value">{formatAmount(userTeam.budget)}</span>
                </div>
                <div className="fm-info-row">
                  <span className="fm-info-row__label">총 연봉</span>
                  <span className="fm-info-row__value">{formatAmount(totalSalary)}</span>
                </div>
                <div className="fm-info-row">
                  <span className="fm-info-row__label">샐러리캡</span>
                  <span className="fm-info-row__value">{formatAmount(SALARY_CAP)}</span>
                </div>
                <div className="fm-bar fm-mt-sm">
                  <div className="fm-bar__track">
                    <div
                      className={`fm-bar__fill ${salaryRatio > 0.9 ? 'fm-bar__fill--red' : salaryRatio > 0.7 ? 'fm-bar__fill--yellow' : 'fm-bar__fill--green'}`}
                      style={{ width: `${Math.min(salaryRatio * 100, 100)}%` }}
                    />
                  </div>
                  <span className="fm-bar__value">{(salaryRatio * 100).toFixed(1)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 최근 뉴스 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">최근 뉴스</span>
            <Link to="/manager/news" className="fm-btn fm-btn--ghost fm-btn--sm">
              더보기 &rarr;
            </Link>
          </div>
          <div className="fm-panel__body">
            {loading ? (
              <p className="fm-text-base fm-text-muted">불러오는 중...</p>
            ) : newsEvents.length === 0 ? (
              <p className="fm-text-base fm-text-muted">아직 기록된 이벤트가 없습니다</p>
            ) : (
              <div className="fm-flex-col fm-gap-sm">
                {newsEvents.map((event) => {
                  const color = NEWS_EVENT_COLORS[event.eventType] ?? '#6a6a7a';
                  return (
                    <div key={event.id} className="fm-flex fm-gap-sm" style={{ alignItems: 'flex-start' }}>
                      <div
                        className="mh-news-dot"
                        style={{ background: color }}
                      />
                      <div className="fm-flex-col fm-flex-1" style={{ minWidth: 0, gap: '2px' }}>
                        <span className="fm-text-sm fm-text-muted">{event.gameDate}</span>
                        <span className="mh-news-desc">
                          {event.description || event.eventType}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 선수 컨디션 */}
        <div className="fm-panel" style={{ gridColumn: '1 / -1' }}>
          <div className="fm-panel__header">
            <span className="fm-panel__title">선수 컨디션</span>
          </div>
          <div className="fm-panel__body">
            {loading ? (
              <p className="fm-text-base fm-text-muted">불러오는 중...</p>
            ) : (
              <div className="fm-flex-col fm-gap-xs">
                {displayRoster.map((player) => {
                  const cond = conditions.get(player.id);
                  const stamina = cond?.stamina ?? 0;
                  const morale = cond?.morale ?? 0;
                  const posBadge = positionBadgeClass[player.position] ?? 'mid';
                  return (
                    <div key={player.id} className="fm-condition-row">
                      <span className={`fm-pos-badge fm-pos-badge--${posBadge}`}>
                        {positionLabel[player.position] ?? player.position}
                      </span>
                      <span className="fm-condition-name">{player.name}</span>
                      <div className="fm-condition-bars">
                        <div className="fm-bar fm-bar--sm">
                          <span className="fm-text-xs fm-text-muted" style={{ minWidth: '24px' }}>체력</span>
                          <div className="fm-bar__track">
                            <div
                              className={`fm-bar__fill ${getBarColorClass(stamina)}`}
                              style={{ width: `${stamina}%` }}
                            />
                          </div>
                          <span className="fm-bar__value">{stamina}</span>
                        </div>
                        <div className="fm-bar fm-bar--sm">
                          <span className="fm-text-xs fm-text-muted" style={{ minWidth: '24px' }}>사기</span>
                          <div className="fm-bar__track">
                            <div
                              className={`fm-bar__fill ${getBarColorClass(morale)}`}
                              style={{ width: `${morale}%` }}
                            />
                          </div>
                          <span className="fm-bar__value">{morale}</span>
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
    </div>
  );
}
