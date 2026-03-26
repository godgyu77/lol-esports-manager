import { renderWithProviders, screen, resetStores } from '../../../test/testUtils';
import { RosterView } from './RosterView';
import type { Team } from '../../../types';
import type { GameSave } from '../../../types';

// 자식 컴포넌트 스텁 — 내부 DB 호출 격리
vi.mock('./roster/RosterTab', () => ({
  RosterTab: () => <div data-testid="roster-tab">RosterTab</div>,
}));
vi.mock('./roster/ChemistryTab', () => ({
  ChemistryTab: () => <div data-testid="chemistry-tab">ChemistryTab</div>,
}));
vi.mock('./roster/SatisfactionTab', () => ({
  SatisfactionTab: () => <div data-testid="satisfaction-tab">SatisfactionTab</div>,
}));

const mockSave = {
  id: 'save-1',
  userTeamId: 'team-1',
  seasonId: 'season-1',
  currentDate: '2025-01-15',
  managerName: '테스트 감독',
} as unknown as GameSave;

const mockTeam: Team = {
  id: 'team-1',
  name: 'T1',
  shortName: 'T1',
  region: 'LCK',
  players: [],
} as unknown as Team;

describe('RosterView', () => {
  beforeEach(() => {
    resetStores();
  });

  it('userTeam이 없으면 로딩 메시지를 표시한다', () => {
    renderWithProviders(<RosterView />);
    expect(screen.getByText('데이터를 불러오는 중...')).toBeInTheDocument();
  });

  it('기본 렌더 시 제목과 3개 탭 버튼을 표시한다', () => {
    renderWithProviders(<RosterView />, {
      gameState: { save: mockSave, teams: [mockTeam] },
    });

    expect(screen.getByText('로스터 관리')).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveTextContent('로스터');
    expect(tabs[1]).toHaveTextContent('케미스트리');
    expect(tabs[2]).toHaveTextContent('만족도');
  });

  it('기본 탭은 로스터이며 aria-selected가 올바르다', () => {
    renderWithProviders(<RosterView />, {
      gameState: { save: mockSave, teams: [mockTeam] },
    });

    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('roster-tab')).toBeInTheDocument();
  });

  it('케미스트리 탭 클릭 시 해당 컴포넌트를 렌더한다', async () => {
    const { user } = renderWithProviders(<RosterView />, {
      gameState: { save: mockSave, teams: [mockTeam] },
    });

    await user.click(screen.getByRole('tab', { name: '케미스트리' }));

    expect(screen.getByTestId('chemistry-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('roster-tab')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '케미스트리' })).toHaveAttribute('aria-selected', 'true');
  });

  it('만족도 탭 클릭 시 해당 컴포넌트를 렌더한다', async () => {
    const { user } = renderWithProviders(<RosterView />, {
      gameState: { save: mockSave, teams: [mockTeam] },
    });

    await user.click(screen.getByRole('tab', { name: '만족도' }));

    expect(screen.getByTestId('satisfaction-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('roster-tab')).not.toBeInTheDocument();
  });
});
