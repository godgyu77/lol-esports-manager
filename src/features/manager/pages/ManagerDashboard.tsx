import { useState, useCallback, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useNavBadges } from '../../../hooks/useNavBadges';
import { useKeyboardShortcuts } from '../../../hooks/useKeyboardShortcuts';
import { useGameStore } from '../../../stores/gameStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { advanceDay, skipToNextMatchDay } from '../../../engine/season/dayAdvancer';
import { CommandPalette } from '../../../components/CommandPalette';
import type { DayType } from '../../../engine/season/calendar';
import { formatAmount } from '../../../utils/formatUtils';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

interface NavGroup {
  id: string;
  title: string;
  defaultExpanded: boolean;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'inbox',
    title: '편지함',
    defaultExpanded: true,
    items: [
      { to: '/manager', label: '대시보드', icon: 'H', end: true },
      { to: '/manager/inbox', label: '편지함', icon: '\u2709' },
      { to: '/manager/news', label: '뉴스', icon: 'N' },
    ],
  },
  {
    id: 'squad',
    title: '선수단',
    defaultExpanded: true,
    items: [
      { to: '/manager/roster', label: '로스터', icon: 'R' },
      { to: '/manager/tactics', label: '전술', icon: 'T' },
      { to: '/manager/training', label: '훈련', icon: 'TR' },
      { to: '/manager/complaints', label: '선수 케어', icon: 'PC' },
      { to: '/manager/promises', label: '약속 관리', icon: 'PR' },
    ],
  },
  {
    id: 'match-prep',
    title: '경기 준비',
    defaultExpanded: true,
    items: [
      { to: '/manager/schedule', label: '일정', icon: 'S' },
      { to: '/manager/calendar', label: '캘린더', icon: 'C' },
      { to: '/manager/standings', label: '순위표', icon: '#' },
      { to: '/manager/tournament', label: '국제대회', icon: 'INT' },
      { to: '/manager/draft', label: '드래프트', icon: 'D' },
      { to: '/manager/match', label: '경기', icon: 'M' },
    ],
  },
  {
    id: 'finance',
    title: '재정',
    defaultExpanded: true,
    items: [
      { to: '/manager/transfer', label: '이적 시장', icon: 'TF' },
      { to: '/manager/contract', label: '계약', icon: 'CT' },
      { to: '/manager/finance', label: '재정', icon: '\u20A9' },
    ],
  },
  {
    id: 'club',
    title: '구단',
    defaultExpanded: true,
    items: [
      { to: '/manager/staff', label: '스태프', icon: 'ST' },
      { to: '/manager/facility', label: '시설', icon: 'FC' },
      { to: '/manager/board', label: '이사회와 목표', icon: 'BD' },
      { to: '/manager/social', label: '커뮤니티', icon: 'CM' },
    ],
  },
  {
    id: 'more',
    title: '더 보기',
    defaultExpanded: false,
    items: [
      { to: '/manager/scouting', label: '스카우팅', icon: 'SC' },
      { to: '/manager/academy', label: '아카데미', icon: 'AC' },
      { to: '/manager/compare', label: '비교', icon: 'CP' },
      { to: '/manager/stats', label: '통계', icon: 'G' },
      { to: '/manager/records', label: '기록실', icon: 'RC' },
      { to: '/manager/awards', label: '어워드', icon: 'AW' },
      { to: '/manager/analysis', label: '상대 분석', icon: 'AN' },
      { to: '/manager/patch-meta', label: '패치 메타', icon: 'MT' },
      { to: '/manager/career', label: '커리어', icon: 'CR' },
      { to: '/manager/achievements', label: '업적', icon: 'ACH' },
      { to: '/manager/team-history', label: '팀 히스토리', icon: 'TH' },
    ],
  },
];

export function ManagerDashboard() {
  const navigate = useNavigate();
  const save = useGameStore((state) => state.save);
  const season = useGameStore((state) => state.season);
  const teams = useGameStore((state) => state.teams);
  const setSeason = useGameStore((state) => state.setSeason);
  const setDayPhase = useGameStore((state) => state.setDayPhase);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<DayType | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [advanceResult, setAdvanceResult] = useState<string | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map((group) => [group.id, group.defaultExpanded])),
  );

  useAutoSave();
  useKeyboardShortcuts({
    onSave: () => navigate('/save-load'),
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleAdvanceDay = useCallback(async () => {
    if (!season || !save || isAdvancing) return;

    setIsAdvancing(true);
    setAdvanceResult(null);

    try {
      const result = await advanceDay(
        season.id,
        season.currentDate,
        save.userTeamId,
        save.mode,
        selectedActivity ?? undefined,
        save.id,
        useSettingsStore.getState().difficulty,
      );

      setSeason({ ...season, currentDate: result.nextDate });

      if (result.hasUserMatch && result.userMatch) {
        setShowAdvanceModal(false);
        setDayPhase('banpick');
        navigate('/manager/draft');
        return;
      }

      setAdvanceResult(`${result.date} 진행 완료 (${result.dayType})`);
    } catch (error: unknown) {
      setAdvanceResult(`오류: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsAdvancing(false);
    }
  }, [season, save, isAdvancing, selectedActivity, setSeason, setDayPhase, navigate]);

  const handleSkipToMatch = useCallback(async () => {
    if (!season || !save || isAdvancing) return;

    setIsAdvancing(true);
    setAdvanceResult(null);

    try {
      const results = await skipToNextMatchDay(
        season.id,
        season.currentDate,
        save.userTeamId,
        save.mode,
        season.endDate ?? '2026-12-31',
        selectedActivity ?? undefined,
        useSettingsStore.getState().difficulty,
      );

      if (results.length > 0) {
        const last = results[results.length - 1];
        setSeason({ ...season, currentDate: last.nextDate });

        if (last.hasUserMatch) {
          setShowAdvanceModal(false);
          setDayPhase('banpick');
          navigate('/manager/draft');
          return;
        }
      }

      setAdvanceResult(`${results.length}일을 건너뛰었습니다.`);
    } catch (error: unknown) {
      setAdvanceResult(`오류: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsAdvancing(false);
    }
  }, [season, save, isAdvancing, selectedActivity, setSeason, setDayPhase, navigate]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const badges = useNavBadges(save?.userTeamId ?? '', season?.id ?? 0);
  const userTeam = teams.find((team) => team.id === save?.userTeamId);
  const seasonLabel = season ? `${season.year} ${season.split === 'spring' ? 'Spring' : 'Summer'}` : '';
  const weekLabel = season ? `W${season.currentWeek}` : '';
  const dateLabel = season?.currentDate ?? '';
  const thisWeekFocus = season
    ? `이번 주 핵심: ${season.currentWeek}주차 가장 중요한 경기를 앞두고 전술과 훈련을 점검하세요.`
    : '이번 주 핵심: 경기일 전까지 주간 운영 루프를 안정적으로 정리하세요.';
  const managerFocusActions = [
    { label: '다음 경기 준비', route: '/manager/pre-match' },
    { label: '훈련', route: '/manager/training' },
    { label: '전술', route: '/manager/tactics' },
    { label: '로스터 점검', route: '/manager/roster' },
    { label: '재정', route: '/manager/finance' },
  ];

  return (
    <div className="fm-layout">
      {sidebarOpen && <div className="fm-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <nav className={`fm-sidebar${sidebarOpen ? ' fm-sidebar--open' : ''}`} aria-label="주 메뉴">
        <div className="fm-sidebar__header">
          <div className="fm-sidebar__team-logo">{userTeam?.shortName?.slice(0, 2) ?? 'LM'}</div>
          <div>
            <div className="fm-sidebar__team-name">{userTeam?.name ?? '내 팀'}</div>
            <div className="fm-sidebar__team-sub">감독 모드</div>
          </div>
        </div>

        <div className="fm-sidebar__focus">
          <span className="fm-sidebar__focus-label">이번 주</span>
          <p className="fm-sidebar__focus-text">{thisWeekFocus}</p>
        </div>

        <div className="fm-sidebar__nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="fm-nav-group">
              <button
                type="button"
                className="fm-nav-group__title"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={expandedGroups[group.id] ? 'true' : 'false'}
              >
                <span>{group.title}</span>
                <span className={`fm-nav-group__chevron${expandedGroups[group.id] ? ' fm-nav-group__chevron--open' : ''}`}>
                  ▾
                </span>
              </button>

              <div className={`fm-nav-group__items${expandedGroups[group.id] ? ' fm-nav-group__items--open' : ''}`}>
                {group.items.map((item) => {
                  const badge = badges[item.to] ?? 0;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => `fm-nav-item${isActive ? ' fm-nav-item--active' : ''}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="fm-nav-item__icon">{item.icon}</span>
                      <span className="fm-nav-item__label">{item.label}</span>
                      {badge > 0 && <span className="fm-nav-item__badge">{badge > 9 ? '9+' : badge}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="fm-sidebar__footer">
          <button
            className="fm-sidebar__footer-btn fm-sidebar__footer-btn--accent"
            onClick={() => navigate('/save-load')}
          >
            저장/불러오기
          </button>
          <button className="fm-sidebar__footer-btn" onClick={() => navigate('/settings')}>
            설정
          </button>
          <button className="fm-sidebar__footer-btn" onClick={() => navigate('/')}>
            메인 메뉴
          </button>
        </div>
      </nav>

      <div className="fm-main">
        <div className="fm-topbar">
          <button
            className="fm-sidebar-toggle"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label="메뉴 열기"
          >
            ☰
          </button>
          <div className="fm-topbar__section">
            <span className="fm-topbar__label">시즌</span>
            <span className="fm-topbar__value">{seasonLabel}</span>
          </div>
          <div className="fm-topbar__divider" />
          <div className="fm-topbar__section">
            <span className="fm-topbar__label">날짜</span>
            <span className="fm-topbar__value">{dateLabel}</span>
          </div>
          <div className="fm-topbar__divider" />
          <div className="fm-topbar__section">
            <span className="fm-topbar__value--accent">{weekLabel}</span>
          </div>
          {userTeam && (
            <>
              <div className="fm-topbar__divider" />
              <div className="fm-topbar__section">
                <span className="fm-topbar__label">예산</span>
                <span className="fm-topbar__value">{formatAmount(userTeam.budget)}</span>
              </div>
              <div className="fm-topbar__divider" />
              <div className="fm-topbar__section">
                <span className="fm-topbar__label">리전</span>
                <span className="fm-topbar__value">{userTeam.region}</span>
              </div>
              <div className="fm-topbar__divider" />
              <div className="fm-topbar__section">
                <span className="fm-topbar__label">명성</span>
                <span className="fm-topbar__value--accent">{userTeam.reputation}</span>
              </div>
            </>
          )}
          <div className="fm-topbar__mobile-actions">
            <button className="fm-btn fm-btn--sm fm-btn--ghost" onClick={() => navigate('/save-load')}>
              저장
            </button>
            <button className="fm-btn fm-btn--sm fm-btn--ghost" onClick={() => navigate('/')}>
              메뉴
            </button>
          </div>
          <div className="fm-topbar__spacer" />
          <button
            className="fm-btn fm-btn--primary fm-btn--sm"
            style={{ padding: '6px 16px', fontWeight: 600, letterSpacing: 0.5 }}
            onClick={() => {
              setShowAdvanceModal(true);
              setAdvanceResult(null);
            }}
          >
            ▶ 시즌 진행
          </button>
        </div>

        <div className="fm-content">
          <div className="fm-panel fm-mb-md">
            <div className="fm-panel__header">
              <span className="fm-panel__title">감독 운영 루프</span>
            </div>
            <div className="fm-panel__body">
              <div className="fm-flex fm-gap-sm fm-flex-wrap fm-items-center fm-justify-between">
                <p className="fm-text-sm fm-text-secondary" style={{ margin: 0 }}>
                  주간 리듬: 준비하고, 경기하고, 복기하고, 조정한 뒤 다시 준비합니다.
                </p>
                <div className="fm-flex fm-gap-sm fm-flex-wrap">
                  {managerFocusActions.map((action) => (
                    <button key={action.route} className="fm-btn fm-btn--sm" onClick={() => navigate(action.route)}>
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기">
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>

      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />

      {showAdvanceModal && (
        <div className="fm-modal-overlay" onClick={() => !isAdvancing && setShowAdvanceModal(false)}>
          <div className="fm-modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="fm-modal__header">
              <h3 style={{ margin: 0 }}>시즌 진행</h3>
              <span style={{ color: 'var(--fm-text-muted)', fontSize: '0.85rem' }}>{season?.currentDate ?? ''}</span>
            </div>
            <div className="fm-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['training', 'rest', 'scrim'] as const).map((activity) => (
                  <button
                    key={activity}
                    className={`fm-btn fm-btn--sm ${selectedActivity === activity ? 'fm-btn--primary' : 'fm-btn--ghost'}`}
                    onClick={() => setSelectedActivity((prev) => (prev === activity ? null : activity))}
                    disabled={isAdvancing}
                  >
                    {activity === 'training' ? '훈련' : activity === 'rest' ? '휴식' : '스크림'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="fm-btn fm-btn--primary"
                  onClick={handleAdvanceDay}
                  disabled={isAdvancing}
                  style={{ flex: 1 }}
                >
                  {isAdvancing ? '진행 중...' : '다음 날 →'}
                </button>
                <button
                  className="fm-btn fm-btn--ghost"
                  onClick={handleSkipToMatch}
                  disabled={isAdvancing}
                  style={{ flex: 1 }}
                >
                  {isAdvancing ? '진행 중...' : '경기일까지 스킵'}
                </button>
              </div>
              {advanceResult && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: advanceResult.startsWith('오류:')
                      ? 'var(--fm-danger-bg, #3a1a1a)'
                      : 'var(--fm-success-bg, #1a3a1a)',
                    color: advanceResult.startsWith('오류:')
                      ? 'var(--fm-danger, #e74c3c)'
                      : 'var(--fm-success, #2ecc71)',
                    fontSize: '0.85rem',
                  }}
                >
                  {advanceResult}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
