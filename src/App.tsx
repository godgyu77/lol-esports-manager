import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Skeleton } from './components/Skeleton';
import { AiSetupWizard } from './components/AiSetupWizard';
import { MobileAiSetup } from './components/MobileAiSetup';
import { useTheme } from './hooks/useTheme';
import { useSettingsStore } from './stores/settingsStore';
import type { SettingsState } from './stores/settingsStore';
import { isMobileRuntime, isTauriRuntime } from './stores/settingsStore';
import { ToastContainer } from './components/ToastContainer';

// ─────────────────────────────────────────
// Lazy-loaded 페이지 컴포넌트 (코드 스플리팅)
// ─────────────────────────────────────────

// Main
const MainMenu = lazy(() => import('./features/main/MainMenu').then(m => ({ default: m.MainMenu })));
const ModeSelect = lazy(() => import('./features/main/ModeSelect').then(m => ({ default: m.ModeSelect })));
const ManagerCreate = lazy(() => import('./features/main/ManagerCreate').then(m => ({ default: m.ManagerCreate })));
const TeamSelect = lazy(() => import('./features/main/TeamSelect').then(m => ({ default: m.TeamSelect })));
const SeasonGoalView = lazy(() => import('./features/main/SeasonGoalView').then(m => ({ default: m.SeasonGoalView })));
const SettingsView = lazy(() => import('./features/main/SettingsView').then(m => ({ default: m.SettingsView })));
const SaveLoadView = lazy(() => import('./features/main/SaveLoadView').then(m => ({ default: m.SaveLoadView })));

// Player mode
const PlayerCreate = lazy(() => import('./features/player/pages/PlayerCreate').then(m => ({ default: m.PlayerCreate })));
const PlayerDashboard = lazy(() => import('./features/player/pages/PlayerDashboard').then(m => ({ default: m.PlayerDashboard })));
const PlayerHome = lazy(() => import('./features/player/pages/PlayerHome').then(m => ({ default: m.PlayerHome })));
const PlayerTraining = lazy(() => import('./features/player/pages/PlayerTraining').then(m => ({ default: m.PlayerTraining })));
const PlayerRelations = lazy(() => import('./features/player/pages/PlayerRelations').then(m => ({ default: m.PlayerRelations })));
const PlayerDayView = lazy(() => import('./features/player/pages/PlayerDayView').then(m => ({ default: m.PlayerDayView })));
const PlayerContractView = lazy(() => import('./features/player/pages/PlayerContractView').then(m => ({ default: m.PlayerContractView })));
const PlayerSoloRankView = lazy(() => import('./features/player/pages/PlayerSoloRankView').then(m => ({ default: m.PlayerSoloRankView })));
const PlayerStatsView = lazy(() => import('./features/player/pages/PlayerStatsView').then(m => ({ default: m.PlayerStatsView })));
const PlayerMediaView = lazy(() => import('./features/player/pages/PlayerMediaView').then(m => ({ default: m.PlayerMediaView })));
const PlayerCareerView = lazy(() => import('./features/player/pages/PlayerCareerView').then(m => ({ default: m.PlayerCareerView })));

// Manager mode
const ManagerDashboard = lazy(() => import('./features/manager/pages/ManagerDashboard').then(m => ({ default: m.ManagerDashboard })));
const ManagerHome = lazy(() => import('./features/manager/pages/ManagerHome').then(m => ({ default: m.ManagerHome })));
const RosterView = lazy(() => import('./features/manager/pages/RosterView').then(m => ({ default: m.RosterView })));
const ScheduleView = lazy(() => import('./features/manager/pages/ScheduleView').then(m => ({ default: m.ScheduleView })));
const StandingsView = lazy(() => import('./features/manager/pages/StandingsView').then(m => ({ default: m.StandingsView })));
const StatsView = lazy(() => import('./features/manager/pages/StatsView').then(m => ({ default: m.StatsView })));
const AwardsView = lazy(() => import('./features/manager/pages/AwardsView').then(m => ({ default: m.AwardsView })));
const DayView = lazy(() => import('./features/manager/pages/DayView').then(m => ({ default: m.DayView })));
const SeasonEndView = lazy(() => import('./features/manager/pages/SeasonEndView').then(m => ({ default: m.SeasonEndView })));
const FinanceView = lazy(() => import('./features/manager/pages/FinanceView').then(m => ({ default: m.FinanceView })));
const TransferView = lazy(() => import('./features/manager/pages/TransferView').then(m => ({ default: m.TransferView })));
const ContractView = lazy(() => import('./features/manager/pages/ContractView').then(m => ({ default: m.ContractView })));
const TournamentView = lazy(() => import('./features/manager/pages/TournamentView').then(m => ({ default: m.TournamentView })));
const NewsFeedView = lazy(() => import('./features/manager/pages/NewsFeedView').then(m => ({ default: m.NewsFeedView })));
const ScoutingView = lazy(() => import('./features/manager/pages/ScoutingView').then(m => ({ default: m.ScoutingView })));
const AcademyView = lazy(() => import('./features/manager/pages/AcademyView').then(m => ({ default: m.AcademyView })));
const TrainingView = lazy(() => import('./features/manager/pages/TrainingView').then(m => ({ default: m.TrainingView })));
const CalendarView = lazy(() => import('./features/manager/pages/CalendarView').then(m => ({ default: m.CalendarView })));
const TacticsView = lazy(() => import('./features/manager/pages/TacticsView').then(m => ({ default: m.TacticsView })));
const StaffView = lazy(() => import('./features/manager/pages/StaffView').then(m => ({ default: m.StaffView })));
const BoardView = lazy(() => import('./features/manager/pages/BoardView').then(m => ({ default: m.BoardView })));
const ComplaintsView = lazy(() => import('./features/manager/pages/ComplaintsView').then(m => ({ default: m.ComplaintsView })));
const RecordsView = lazy(() => import('./features/manager/pages/RecordsView').then(m => ({ default: m.RecordsView })));
const FacilityView = lazy(() => import('./features/manager/pages/FacilityView').then(m => ({ default: m.FacilityView })));
const SocialFeedView = lazy(() => import('./features/manager/pages/SocialFeedView').then(m => ({ default: m.SocialFeedView })));
const PlayerDetailView = lazy(() => import('./features/manager/pages/PlayerDetailView').then(m => ({ default: m.PlayerDetailView })));
const PlayerCompareView = lazy(() => import('./features/manager/pages/PlayerCompareView').then(m => ({ default: m.PlayerCompareView })));
const InboxView = lazy(() => import('./features/manager/pages/InboxView').then(m => ({ default: m.InboxView })));
const PromisesView = lazy(() => import('./features/manager/pages/PromisesView').then(m => ({ default: m.PromisesView })));
const SoloRankView = lazy(() => import('./features/manager/pages/SoloRankView').then(m => ({ default: m.SoloRankView })));
const PressConferenceView = lazy(() => import('./features/manager/pages/PressConferenceView').then(m => ({ default: m.PressConferenceView })));
const PreMatchView = lazy(() => import('./features/manager/pages/PreMatchView').then(m => ({ default: m.PreMatchView })));
const AnalysisView = lazy(() => import('./features/manager/pages/AnalysisView').then(m => ({ default: m.AnalysisView })));
const PatchMetaView = lazy(() => import('./features/manager/pages/PatchMetaView').then(m => ({ default: m.PatchMetaView })));
const ManagerCareerView = lazy(() => import('./features/manager/pages/ManagerCareerView').then(m => ({ default: m.ManagerCareerView })));
const AchievementView = lazy(() => import('./features/manager/pages/AchievementView').then(m => ({ default: m.AchievementView })));
const TeamHistoryView = lazy(() => import('./features/manager/pages/TeamHistoryView').then(m => ({ default: m.TeamHistoryView })));

// Shared
const DraftView = lazy(() => import('./features/draft/DraftView').then(m => ({ default: m.DraftView })));
const LiveMatchView = lazy(() => import('./features/match/LiveMatchView').then(m => ({ default: m.LiveMatchView })));

function AiSetupGate() {
  const aiSetupCompleted = useSettingsStore((s: SettingsState) => s.aiSetupCompleted);
  const aiSetupSkipped = useSettingsStore((s: SettingsState) => s.aiSetupSkipped);

  if (!aiSetupCompleted && !aiSetupSkipped) {
    return isMobileRuntime() ? <MobileAiSetup onComplete={() => undefined} /> : <AiSetupWizard onComplete={() => undefined} />;
  }

  return (
    <Suspense fallback={<Skeleton />}>
      <AppRoutes />
    </Suspense>
  );
}

function AppRoutes() {
  return (
    <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/mode-select" element={<ModeSelect />} />
        <Route path="/player-create" element={<PlayerCreate />} />
        <Route path="/manager-create" element={<ManagerCreate />} />
        <Route path="/team-select" element={<TeamSelect />} />
        <Route path="/season-goal" element={<SeasonGoalView />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="/save-load" element={<SaveLoadView />} />
        <Route path="/manager" element={<ManagerDashboard />}>
          <Route index element={<ManagerHome />} />
          <Route path="roster" element={<ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기"><RosterView /></ErrorBoundary>} />
          <Route path="schedule" element={<ScheduleView />} />
          <Route path="calendar" element={<CalendarView />} />
          <Route path="standings" element={<StandingsView />} />
          <Route path="stats" element={<ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기"><StatsView /></ErrorBoundary>} />
          <Route path="awards" element={<AwardsView />} />
          <Route path="day" element={<ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기"><DayView /></ErrorBoundary>} />
          <Route path="season-end" element={<SeasonEndView />} />
          <Route path="transfer" element={<ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기"><TransferView /></ErrorBoundary>} />
          <Route path="contract" element={<ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기"><ContractView /></ErrorBoundary>} />
          <Route path="finance" element={<ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기"><FinanceView /></ErrorBoundary>} />
          <Route path="tournament" element={<ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기"><TournamentView /></ErrorBoundary>} />
          <Route path="news" element={<NewsFeedView />} />
          <Route path="scouting" element={<ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기"><ScoutingView /></ErrorBoundary>} />
          <Route path="academy" element={<ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기"><AcademyView /></ErrorBoundary>} />
          <Route path="training" element={<ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기"><TrainingView /></ErrorBoundary>} />
          <Route path="tactics" element={<ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기"><TacticsView /></ErrorBoundary>} />
          <Route path="staff" element={<StaffView />} />
          <Route path="board" element={<BoardView />} />
          <Route path="complaints" element={<ComplaintsView />} />
          <Route path="records" element={<RecordsView />} />
          <Route path="facility" element={<FacilityView />} />
          <Route path="social" element={<SocialFeedView />} />
          <Route path="analysis" element={<ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기"><AnalysisView /></ErrorBoundary>} />
          <Route path="patch-meta" element={<ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기"><PatchMetaView /></ErrorBoundary>} />
          <Route path="career" element={<ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기"><ManagerCareerView /></ErrorBoundary>} />
          <Route path="draft" element={<ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기"><DraftView /></ErrorBoundary>} />
          <Route path="match" element={<ErrorBoundary inline navigateTo="/manager/day" navigateLabel="시즌 진행으로 돌아가기"><LiveMatchView /></ErrorBoundary>} />
          <Route path="compare" element={<PlayerCompareView />} />
          <Route path="inbox" element={<InboxView />} />
          <Route path="promises" element={<PromisesView />} />
          <Route path="solorank" element={<SoloRankView />} />
          <Route path="press" element={<PressConferenceView />} />
          <Route path="pre-match" element={<ErrorBoundary inline navigateTo="/manager/day" navigateLabel="시즌 진행으로 돌아가기"><PreMatchView /></ErrorBoundary>} />
          <Route path="achievements" element={<ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기"><AchievementView /></ErrorBoundary>} />
          <Route path="team-history" element={<ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기"><TeamHistoryView /></ErrorBoundary>} />
          <Route path="player/:playerId" element={<ErrorBoundary inline navigateTo="/manager/roster" navigateLabel="로스터로 돌아가기"><PlayerDetailView /></ErrorBoundary>} />
        </Route>
        <Route path="/player" element={<PlayerDashboard />}>
          <Route index element={<PlayerHome />} />
          <Route path="day" element={<PlayerDayView />} />
          <Route path="training" element={<PlayerTraining />} />
          <Route path="relations" element={<PlayerRelations />} />
          <Route path="contract" element={<PlayerContractView />} />
          <Route path="solorank" element={<PlayerSoloRankView />} />
          <Route path="stats" element={<PlayerStatsView />} />
          <Route path="media" element={<PlayerMediaView />} />
          <Route path="career" element={<PlayerCareerView />} />
          <Route path="schedule" element={<ScheduleView />} />
          <Route path="draft" element={<ErrorBoundary inline navigateTo="/player" navigateLabel="대시보드로 돌아가기"><DraftView /></ErrorBoundary>} />
          <Route path="match" element={<ErrorBoundary inline navigateTo="/player/day" navigateLabel="시즌 진행으로 돌아가기"><LiveMatchView /></ErrorBoundary>} />
          <Route path="season-end" element={<SeasonEndView />} />
        </Route>
      </Routes>
  );
}

function App() {
  useTheme();

  // 앱 최초 로드 시 저장된 창모드 1회 적용
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    if (!isTauriRuntime() || isMobileRuntime()) return;
    const mode = useSettingsStore.getState().windowMode;
    import('./utils/windowManager').then(({ applyWindowMode }) => applyWindowMode(mode));
  }, []);

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AiSetupGate />
      </ErrorBoundary>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
