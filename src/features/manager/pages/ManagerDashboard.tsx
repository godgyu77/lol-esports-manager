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

/* ── 사이드바 네비게이션 그룹 정의 ── */
interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Home',
    items: [
      { to: '/manager', label: '대시보드', icon: 'H', end: true },
      { to: '/manager/inbox', label: '편지함', icon: '\u2709' },
      { to: '/manager/news', label: '뉴스', icon: 'N' },
    ],
  },
  {
    title: 'Squad',
    items: [
      { to: '/manager/roster', label: '로스터', icon: 'R' },
      { to: '/manager/tactics', label: '전술', icon: 'T' },
      { to: '/manager/training', label: '훈련', icon: 'TR' },
      { to: '/manager/complaints', label: '선수 관리', icon: 'PM' },
      { to: '/manager/promises', label: '약속 관리', icon: 'PR' },
    ],
  },
  {
    title: 'Matches',
    items: [
      { to: '/manager/schedule', label: '일정', icon: 'S' },
      { to: '/manager/calendar', label: '캘린더', icon: 'C' },
      { to: '/manager/standings', label: '순위표', icon: '#' },
      { to: '/manager/tournament', label: '국제대회', icon: 'W' },
      { to: '/manager/draft', label: '밴픽', icon: 'D' },
      { to: '/manager/match', label: '경기', icon: 'M' },
    ],
  },
  {
    title: 'Scouting',
    items: [
      { to: '/manager/scouting', label: '스카우팅', icon: 'SC' },
      { to: '/manager/academy', label: '아카데미', icon: 'AC' },
      { to: '/manager/compare', label: '선수 비교', icon: 'CP' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { to: '/manager/transfer', label: '이적 시장', icon: 'TF' },
      { to: '/manager/contract', label: '계약', icon: 'CT' },
      { to: '/manager/finance', label: '재정', icon: '\u20A9' },
    ],
  },
  {
    title: 'Club',
    items: [
      { to: '/manager/staff', label: '스태프', icon: 'ST' },
      { to: '/manager/facility', label: '시설', icon: 'FC' },
      { to: '/manager/board', label: '구단', icon: 'BD' },
      { to: '/manager/social', label: '커뮤니티', icon: 'CM' },
    ],
  },
  {
    title: 'Info',
    items: [
      { to: '/manager/stats', label: '통계', icon: 'G' },
      { to: '/manager/records', label: '기록실', icon: 'RC' },
      { to: '/manager/awards', label: '어워드', icon: 'AW' },
      { to: '/manager/analysis', label: '상대 분석', icon: 'AN' },
      { to: '/manager/patch-meta', label: '패치 메타', icon: 'MT' },
      { to: '/manager/career', label: '커리어', icon: 'CR' },
      { to: '/manager/achievements', label: '업적', icon: 'AC' },
      { to: '/manager/team-history', label: '팀 히스토리', icon: 'TH' },
    ],
  },
];

export function ManagerDashboard() {
  const navigate = useNavigate();
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);
  const setSeason = useGameStore((s) => s.setSeason);
  const setDayPhase = useGameStore((s) => s.setDayPhase);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<DayType | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [advanceResult, setAdvanceResult] = useState<string | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useAutoSave();
  useKeyboardShortcuts({
    onSave: () => navigate('/save-load'),
  });

  // Ctrl+K 커맨드 팔레트
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
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
        season.id, season.currentDate, save.userTeamId, save.mode,
        selectedActivity ?? undefined, save.id, useSettingsStore.getState().difficulty,
      );
      setSeason({ ...season, currentDate: result.nextDate });
      if (result.hasUserMatch && result.userMatch) {
        setShowAdvanceModal(false);
        setDayPhase('draft');
        navigate('/manager/draft');
        return;
      }
      setAdvanceResult(`${result.date} 완료 (${result.dayType})`);
    } catch (e: unknown) {
      setAdvanceResult(`오류: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsAdvancing(false);
    }
  }, [season, save, selectedActivity, isAdvancing, setSeason, setDayPhase, navigate]);

  const handleSkipToMatch = useCallback(async () => {
    if (!season || !save || isAdvancing) return;
    setIsAdvancing(true);
    setAdvanceResult(null);
    try {
      const endDate = season.endDate ?? '2026-12-31';
      const results = await skipToNextMatchDay(
        season.id, season.currentDate, save.userTeamId, save.mode,
        endDate, selectedActivity ?? undefined, useSettingsStore.getState().difficulty,
      );
      if (results.length > 0) {
        const last = results[results.length - 1];
        setSeason({ ...season, currentDate: last.nextDate });
        if (last.hasUserMatch) {
          setShowAdvanceModal(false);
          setDayPhase('draft');
          navigate('/manager/draft');
          return;
        }
      }
      setAdvanceResult(`${results.length}일 스킵 완료`);
    } catch (e: unknown) {
      setAdvanceResult(`오류: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsAdvancing(false);
    }
  }, [season, save, isAdvancing, selectedActivity, setSeason, setDayPhase, navigate]);

  const badges = useNavBadges(
    save?.userTeamId ?? '',
    season?.id ?? 0,
  );

  const userTeam = teams.find((t) => t.id === save?.userTeamId);

  const seasonLabel = season
    ? `${season.year} ${season.split === 'spring' ? 'Spring' : 'Summer'}`
    : '';
  const weekLabel = season ? `W${season.currentWeek}` : '';
  const dateLabel = season?.currentDate ?? '';

  return (
    <div className="fm-layout">
      {/* ── Sidebar backdrop (mobile) ── */}
      {sidebarOpen && (
        <div
          className="fm-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <nav className={`fm-sidebar${sidebarOpen ? ' fm-sidebar--open' : ''}`} aria-label="주 메뉴">
        {/* Team header */}
        <div className="fm-sidebar__header">
          <div className="fm-sidebar__team-logo">
            {userTeam?.shortName?.slice(0, 2) ?? 'LM'}
          </div>
          <div>
            <div className="fm-sidebar__team-name">{userTeam?.name ?? 'My Team'}</div>
            <div className="fm-sidebar__team-sub">감독 모드</div>
          </div>
        </div>

        {/* Navigation */}
        <div className="fm-sidebar__nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="fm-nav-group">
              <span className="fm-nav-group__title">{group.title}</span>
              {group.items.map((item) => {
                const badge = badges[item.to] ?? 0;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `fm-nav-item${isActive ? ' fm-nav-item--active' : ''}`
                    }
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="fm-nav-item__icon">{item.icon}</span>
                    <span className="fm-nav-item__label">{item.label}</span>
                    {badge > 0 && (
                      <span className="fm-nav-item__badge">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="fm-sidebar__footer">
          <button
            className="fm-sidebar__footer-btn fm-sidebar__footer-btn--accent"
            onClick={() => navigate('/save-load')}
          >
            저장/불러오기
          </button>
          <button
            className="fm-sidebar__footer-btn"
            onClick={() => navigate('/settings')}
          >
            설정
          </button>
          <button
            className="fm-sidebar__footer-btn"
            onClick={() => navigate('/')}
          >
            메인 메뉴
          </button>
        </div>
      </nav>

      {/* ── Main area ── */}
      <div className="fm-main">
        {/* Top bar */}
        <div className="fm-topbar">
          {/* 햄버거 버튼 (모바일) */}
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
            onClick={() => { setShowAdvanceModal(true); setAdvanceResult(null); }}
          >
            ▶ 시즌 진행
          </button>
        </div>

        {/* Content */}
        <div className="fm-content">
          <ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기">
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>

      {/* 커맨드 팔레트 */}
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />

      {/* 시즌 진행 모달 */}
      {showAdvanceModal && (
        <div className="fm-modal-overlay" onClick={() => !isAdvancing && setShowAdvanceModal(false)}>
          <div className="fm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="fm-modal__header">
              <h3 style={{ margin: 0 }}>시즌 진행</h3>
              <span style={{ color: 'var(--fm-text-muted)', fontSize: '0.85rem' }}>
                {season?.currentDate ?? ''}
              </span>
            </div>
            <div className="fm-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['training', 'rest', 'scrim'] as const).map(act => (
                  <button
                    key={act}
                    className={`fm-btn fm-btn--sm ${selectedActivity === act ? 'fm-btn--primary' : 'fm-btn--ghost'}`}
                    onClick={() => setSelectedActivity(prev => prev === act ? null : act)}
                    disabled={isAdvancing}
                  >
                    {act === 'training' ? '훈련' : act === 'rest' ? '휴식' : '스크림'}
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
                <div style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: advanceResult.startsWith('오류') ? 'var(--fm-danger-bg, #3a1a1a)' : 'var(--fm-success-bg, #1a3a1a)',
                  color: advanceResult.startsWith('오류') ? 'var(--fm-danger, #e74c3c)' : 'var(--fm-success, #2ecc71)',
                  fontSize: '0.85rem',
                }}>
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
