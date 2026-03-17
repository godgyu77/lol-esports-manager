import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainMenu } from './features/main/MainMenu';
import { ModeSelect } from './features/main/ModeSelect';
import { PlayerCreate } from './features/player/pages/PlayerCreate';
import { TeamSelect } from './features/main/TeamSelect';
import { ManagerDashboard } from './features/manager/pages/ManagerDashboard';
import { ManagerHome } from './features/manager/pages/ManagerHome';
import { RosterView } from './features/manager/pages/RosterView';
import { SchedulePlaceholder } from './features/manager/pages/SchedulePlaceholder';
import { PlayerDashboard } from './features/player/pages/PlayerDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/mode-select" element={<ModeSelect />} />
        <Route path="/player-create" element={<PlayerCreate />} />
        <Route path="/team-select" element={<TeamSelect />} />
        <Route path="/manager" element={<ManagerDashboard />}>
          <Route index element={<ManagerHome />} />
          <Route path="roster" element={<RosterView />} />
          <Route path="schedule" element={<SchedulePlaceholder />} />
        </Route>
        <Route path="/player/*" element={<PlayerDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
