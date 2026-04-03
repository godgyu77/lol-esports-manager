import { renderWithProviders, resetStores, screen, waitFor } from '../../../test/testUtils';
import { StaffView } from './StaffView';
import type { GameSave } from '../../../types';
import type { Season } from '../../../types/game';

const {
  mockGetTeamStaff,
  mockCalculateStaffBonuses,
  mockGetStaffFitSummary,
  mockGetFreeAgentStaff,
  mockBuildStaffCandidateView,
  mockHireStaffByOffer,
  mockFireStaff,
  mockGenerateStaffReaction,
  mockDbSelect,
} = vi.hoisted(() => ({
  mockGetTeamStaff: vi.fn(),
  mockCalculateStaffBonuses: vi.fn(),
  mockGetStaffFitSummary: vi.fn(),
  mockGetFreeAgentStaff: vi.fn(),
  mockBuildStaffCandidateView: vi.fn(),
  mockHireStaffByOffer: vi.fn(),
  mockFireStaff: vi.fn(),
  mockGenerateStaffReaction: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock('../../../engine/staff/staffEngine', () => ({
  getTeamStaff: mockGetTeamStaff,
  calculateStaffBonuses: mockCalculateStaffBonuses,
  getStaffFitSummary: mockGetStaffFitSummary,
  getFreeAgentStaff: mockGetFreeAgentStaff,
  buildStaffCandidateView: mockBuildStaffCandidateView,
  hireStaffByOffer: mockHireStaffByOffer,
  fireStaff: mockFireStaff,
  TEAM_STAFF_LIMIT: 9,
}));

vi.mock('../../../engine/social/socialEngine', () => ({
  generateStaffReaction: mockGenerateStaffReaction,
}));

vi.mock('../../../db/database', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    select: mockDbSelect,
  }),
}));

const mockSave = {
  id: 1,
  userTeamId: 'team-user',
  seasonId: 1,
  currentDate: '2025-01-15',
  managerName: 'Test Manager',
  mode: 'manager',
} as unknown as GameSave;

const mockSeason = {
  id: 1,
  year: 2025,
  split: 'spring',
  currentDate: '2025-01-15',
  currentWeek: 3,
  endDate: '2025-06-30',
} as Season;

describe('StaffView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();

    mockDbSelect.mockResolvedValue([{ name: 'T1' }]);
    mockCalculateStaffBonuses.mockResolvedValue({
      trainingEfficiency: 1.15,
      moraleBoost: 3,
      draftAccuracy: 4,
      scoutingSpeedBonus: 0,
      scoutingAccuracyBonus: 6,
      moraleRecoveryBonus: 0,
      pressureResistanceBonus: 0,
      staminaRecoveryBonus: 1,
      injuryPreventionBonus: 0,
      injuryRecoveryBonus: 0,
      reinjuryPreventionBonus: 0,
      opponentAnalysisBonus: 0,
      metaAdaptationBonus: 0,
    });
    mockGetStaffFitSummary.mockResolvedValue([]);
  });

  it('shows the manager-as-head-coach banner and current coaching staff', async () => {
    mockGetTeamStaff.mockResolvedValue([
      {
        id: 1,
        teamId: 'team-user',
        name: 'Coach Kim',
        role: 'coach',
        ability: 74,
        specialty: 'training',
        salary: 5000,
        morale: 72,
        contractEndSeason: 2027,
        hiredDate: '2025-01-01',
        isFreeAgent: false,
        philosophy: null,
        nationality: 'KR',
        preferredRole: 'coach',
        roleFlexibility: 'normal',
        careerOrigin: null,
      },
    ]);

    renderWithProviders(<StaffView />, {
      gameState: { save: mockSave, season: mockSeason },
    });

    expect(await screen.findByText('현재 감독은 당신입니다. 이 화면에서는 코치진과 지원 스태프만 영입하거나 정리할 수 있습니다.')).toBeInTheDocument();
    expect(screen.getByText('Coach Kim')).toBeInTheDocument();
    expect(screen.getByText('선호 역할: 코치')).toBeInTheDocument();
  });

  it('shows candidate reasons and hires accepted free agents', async () => {
    const freeAgent = {
      id: 2,
      teamId: null,
      name: 'Former Boss',
      role: 'coach',
      ability: 78,
      specialty: 'draft',
      salary: 6500,
      morale: 68,
      contractEndSeason: 0,
      hiredDate: '2025-01-01',
      isFreeAgent: true,
      philosophy: 'balanced',
      nationality: 'KR',
      preferredRole: 'head_coach',
      roleFlexibility: 'normal',
      careerOrigin: 'head_coach',
    } as const;

    mockGetTeamStaff.mockResolvedValue([]);
    mockGetFreeAgentStaff.mockResolvedValue([freeAgent]);
    mockBuildStaffCandidateView.mockResolvedValue({
      staff: freeAgent,
      offeredRole: 'coach',
      marketCategory: 'former_head_coach',
      decision: 'accept',
      acceptance: 'medium',
      score: 64,
      reasons: ['Head coach background makes the coaching offer realistic.', 'The club project looks competitive enough.'],
    });

    const { user } = renderWithProviders(<StaffView />, {
      gameState: { save: mockSave, season: mockSeason },
    });

    await user.click(await screen.findByRole('button', { name: 'FA 스태프 시장 보기' }));

    expect(await screen.findByText('Former Boss')).toBeInTheDocument();
    expect(screen.getAllByText('감독 출신').length).toBeGreaterThan(0);
    expect(screen.getByText(/coaching offer realistic/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '코치 제안' }));

    await waitFor(() => {
      expect(mockHireStaffByOffer).toHaveBeenCalledWith(2, 'team-user', 'coach', 2027);
      expect(mockGenerateStaffReaction).toHaveBeenCalled();
    });
  });
});
