import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainMenu } from './features/main/MainMenu';
import { ModeSelect } from './features/main/ModeSelect';
import { PlayerCreate } from './features/player/pages/PlayerCreate';
import { ManagerCreate } from './features/main/ManagerCreate';
import { TeamSelect } from './features/main/TeamSelect';
import { SeasonGoalView } from './features/main/SeasonGoalView';
import { ManagerDashboard } from './features/manager/pages/ManagerDashboard';
import { ManagerHome } from './features/manager/pages/ManagerHome';
import { RosterView } from './features/manager/pages/RosterView';
import { ScheduleView } from './features/manager/pages/ScheduleView';
import { StandingsView } from './features/manager/pages/StandingsView';
import { StatsView } from './features/manager/pages/StatsView';
import { AwardsView } from './features/manager/pages/AwardsView';
import { DayView } from './features/manager/pages/DayView';
import { SeasonEndView } from './features/manager/pages/SeasonEndView';
import { FinanceView } from './features/manager/pages/FinanceView';
import { TransferView } from './features/manager/pages/TransferView';
import { ContractView } from './features/manager/pages/ContractView';
import { TournamentView } from './features/manager/pages/TournamentView';
import { NewsFeedView } from './features/manager/pages/NewsFeedView';
import { ScoutingView } from './features/manager/pages/ScoutingView';
import { AcademyView } from './features/manager/pages/AcademyView';
import { TrainingView } from './features/manager/pages/TrainingView';
import { CalendarView } from './features/manager/pages/CalendarView';
import { TacticsView } from './features/manager/pages/TacticsView';
import { StaffView } from './features/manager/pages/StaffView';
import { BoardView } from './features/manager/pages/BoardView';
import { ComplaintsView } from './features/manager/pages/ComplaintsView';
import { RecordsView } from './features/manager/pages/RecordsView';
import { FacilityView } from './features/manager/pages/FacilityView';
import { SocialFeedView } from './features/manager/pages/SocialFeedView';
import { PlayerDetailView } from './features/manager/pages/PlayerDetailView';
import { PlayerCompareView } from './features/manager/pages/PlayerCompareView';
import { InboxView } from './features/manager/pages/InboxView';
import { PromisesView } from './features/manager/pages/PromisesView';
import { DraftView } from './features/draft/DraftView';
import { LiveMatchView } from './features/match/LiveMatchView';
import { SettingsView } from './features/main/SettingsView';
import { SaveLoadView } from './features/main/SaveLoadView';
import { PlayerDashboard } from './features/player/pages/PlayerDashboard';
import { PlayerHome } from './features/player/pages/PlayerHome';
import { PlayerTraining } from './features/player/pages/PlayerTraining';
import { PlayerRelations } from './features/player/pages/PlayerRelations';
import { PlayerDayView } from './features/player/pages/PlayerDayView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useTheme } from './hooks/useTheme';

function App() {
  useTheme();

  return (
    <BrowserRouter>
      <ErrorBoundary>
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
          <Route path="roster" element={<RosterView />} />
          <Route path="schedule" element={<ScheduleView />} />
          <Route path="calendar" element={<CalendarView />} />
          <Route path="standings" element={<StandingsView />} />
          <Route path="stats" element={<StatsView />} />
          <Route path="awards" element={<AwardsView />} />
          <Route path="day" element={<DayView />} />
          <Route path="season-end" element={<SeasonEndView />} />
          <Route path="transfer" element={<TransferView />} />
          <Route path="contract" element={<ContractView />} />
          <Route path="finance" element={<FinanceView />} />
          <Route path="tournament" element={<TournamentView />} />
          <Route path="news" element={<NewsFeedView />} />
          <Route path="scouting" element={<ScoutingView />} />
          <Route path="academy" element={<AcademyView />} />
          <Route path="training" element={<TrainingView />} />
          <Route path="tactics" element={<TacticsView />} />
          <Route path="staff" element={<StaffView />} />
          <Route path="board" element={<BoardView />} />
          <Route path="complaints" element={<ComplaintsView />} />
          <Route path="records" element={<RecordsView />} />
          <Route path="facility" element={<FacilityView />} />
          <Route path="social" element={<SocialFeedView />} />
          <Route path="draft" element={<DraftView />} />
          <Route path="match" element={<ErrorBoundary inline navigateTo="/manager/day" navigateLabel="시즌 진행으로 돌아가기"><LiveMatchView /></ErrorBoundary>} />
          <Route path="compare" element={<PlayerCompareView />} />
          <Route path="inbox" element={<InboxView />} />
          <Route path="promises" element={<PromisesView />} />
          <Route path="player/:playerId" element={<PlayerDetailView />} />
        </Route>
        <Route path="/player" element={<PlayerDashboard />}>
          <Route index element={<PlayerHome />} />
          <Route path="day" element={<PlayerDayView />} />
          <Route path="training" element={<PlayerTraining />} />
          <Route path="relations" element={<PlayerRelations />} />
          <Route path="schedule" element={<ScheduleView />} />
          <Route path="draft" element={<DraftView />} />
          <Route path="match" element={<ErrorBoundary inline navigateTo="/player/day" navigateLabel="시즌 진행으로 돌아가기"><LiveMatchView /></ErrorBoundary>} />
          <Route path="season-end" element={<SeasonEndView />} />
        </Route>
      </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
