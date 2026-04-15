import { renderWithProviders, resetStores, screen } from '../../../test/testUtils';
import type { GameSave, Team } from '../../../types';
import type { Player } from '../../../types';
import { RosterView } from './RosterView';

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

function createPlayer(id: string, name: string, division: 'main' | 'sub', consistency = 72): Player {
  return {
    id,
    name,
    age: 20,
    nationality: 'KR',
    position: 'mid',
    salary: 1000,
    division,
    traits: [],
    contract: {
      salary: 1000,
      contractEndSeason: 2027,
    },
    stats: {
      mechanical: 78,
      gameSense: 76,
      teamwork: 74,
      consistency,
      laning: 75,
      aggression: 73,
    },
    mental: {
      mental: 77,
    },
  } as unknown as Player;
}

const mockTeam: Team = {
  id: 'team-1',
  name: 'T1',
  shortName: 'T1',
  region: 'LCK',
  budget: 100000,
  salaryCap: 50000,
  reputation: 90,
  playStyle: 'controlled',
  roster: [
    createPlayer('p1', 'Faker', 'main'),
    createPlayer('p2', 'Oner', 'main'),
    createPlayer('p3', 'Gumayusi', 'main'),
    createPlayer('p4', 'Keria', 'main'),
    createPlayer('p5', 'Zeus', 'main', 58),
    createPlayer('p6', 'Poby', 'sub'),
  ],
} as Team;

describe('RosterView', () => {
  beforeEach(() => {
    resetStores();
  });

  it('shows a loading message when the user team is missing', () => {
    renderWithProviders(<RosterView />);
    expect(screen.getByText('데이터를 불러오는 중...')).toBeInTheDocument();
  });

  it('renders a compact roster priority strip before the tabs', () => {
    renderWithProviders(<RosterView />, {
      gameState: { save: mockSave, teams: [mockTeam] },
    });

    expect(screen.getByText('로스터 관리')).toBeInTheDocument();
    expect(screen.getByTestId('roster-priority-strip')).toBeInTheDocument();
    expect(screen.getByText('로스터 규모')).toBeInTheDocument();
    expect(screen.getByText('6명')).toBeInTheDocument();
    expect(screen.getByText('주전 평균')).toBeInTheDocument();
    expect(screen.getByText('가장 큰 리스크')).toBeInTheDocument();
    expect(screen.getByText('불만/폼 저하')).toBeInTheDocument();
    expect(screen.getByText('다음 행동')).toBeInTheDocument();
    expect(screen.getByText('만족도 확인')).toBeInTheDocument();
  });

  it('renders three tabs and keeps roster selected by default', () => {
    renderWithProviders(<RosterView />, {
      gameState: { save: mockSave, teams: [mockTeam] },
    });

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveTextContent('로스터');
    expect(tabs[1]).toHaveTextContent('케미스트리');
    expect(tabs[2]).toHaveTextContent('만족도');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('roster-tab')).toBeInTheDocument();
  });

  it('switches to the chemistry tab when clicked', async () => {
    const { user } = renderWithProviders(<RosterView />, {
      gameState: { save: mockSave, teams: [mockTeam] },
    });

    await user.click(screen.getByRole('tab', { name: '케미스트리' }));

    expect(screen.getByTestId('chemistry-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('roster-tab')).not.toBeInTheDocument();
  });

  it('switches to the satisfaction tab when clicked', async () => {
    const { user } = renderWithProviders(<RosterView />, {
      gameState: { save: mockSave, teams: [mockTeam] },
    });

    await user.click(screen.getByRole('tab', { name: '만족도' }));

    expect(screen.getByTestId('satisfaction-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('roster-tab')).not.toBeInTheDocument();
  });
});
