import { act } from 'react';
import { renderWithProviders, resetStores, screen, waitFor } from '../../../test/testUtils';
import { SeasonEndView } from './SeasonEndView';
import type { Team } from '../../../types';

const {
  mockNavigate,
  mockGetInboxMessages,
  mockProcessRegularSeasonEnd,
  mockProcessFullSeasonEnd,
  mockGetMatchById,
  mockGenerateSeasonSummary,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetInboxMessages: vi.fn(),
  mockProcessRegularSeasonEnd: vi.fn(),
  mockProcessFullSeasonEnd: vi.fn(),
  mockGetMatchById: vi.fn(),
  mockGenerateSeasonSummary: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../hooks/useBgm', () => ({
  useBgm: vi.fn(),
}));

vi.mock('../../../engine/inbox/inboxEngine', () => ({
  getInboxMessages: mockGetInboxMessages,
}));

vi.mock('../../../engine/season/seasonEnd', () => ({
  processRegularSeasonEnd: mockProcessRegularSeasonEnd,
  processFullSeasonEnd: mockProcessFullSeasonEnd,
}));

vi.mock('../../../db/initGame', () => ({
  loadGameIntoStore: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../db/queries', () => ({
  getMatchById: mockGetMatchById,
}));

vi.mock('../../../ai/advancedAiService', () => ({
  generateSeasonSummary: mockGenerateSeasonSummary,
}));

describe('SeasonEndView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    mockGetInboxMessages.mockResolvedValue([]);
    mockGetMatchById.mockResolvedValue({
      isPlayed: true,
      scoreHome: 3,
      scoreAway: 1,
      teamHomeId: 'team-1',
      teamAwayId: 'team-2',
    });
    mockProcessRegularSeasonEnd.mockResolvedValue({
      standings: [
        { teamId: 'team-1', wins: 10, losses: 8, setWins: 22, setLosses: 18 },
        { teamId: 'team-2', wins: 9, losses: 9, setWins: 20, setLosses: 20 },
        { teamId: 'team-3', wins: 8, losses: 10, setWins: 18, setLosses: 22 },
        { teamId: 'team-4', wins: 7, losses: 11, setWins: 16, setLosses: 24 },
        { teamId: 'team-5', wins: 6, losses: 12, setWins: 14, setLosses: 26 },
        { teamId: 'team-6', wins: 5, losses: 13, setWins: 12, setLosses: 28 },
      ],
      playoffTeamIds: ['team-1', 'team-2', 'team-3', 'team-4', 'team-5', 'team-6'],
      playoffStartDate: '2026-04-01',
    });
    mockProcessFullSeasonEnd.mockResolvedValue({
      championTeamId: 'team-1',
      growthResults: [],
      nextSeasonId: 2,
      nextYear: 2026,
      nextSplit: 'summer',
    });
    mockGenerateSeasonSummary.mockResolvedValue({
      narrative: '한 시즌을 잘 마무리했습니다.',
      highlights: ['플레이오프 진출'],
      keyMoments: ['결승 진출'],
      outlook: '다음 시즌은 전술 정리가 핵심입니다.',
    });
  });

  it('shows the latest match follow-up after full season end', async () => {
    mockGetInboxMessages.mockResolvedValue([
      {
        id: 1,
        teamId: 'team-1',
        type: 'general',
        title: '[경기 결과] T1 vs GEN',
        content: '다음 권장 행동은 전술 재검토입니다.',
        isRead: false,
        createdAt: '2026-03-01T10:00:00.000Z',
        actionRoute: '/manager/tactics',
        relatedId: 'match_result:match-1',
      },
    ]);

    renderWithProviders(<SeasonEndView />, {
      gameState: {
        mode: 'manager',
        save: {
          id: 1,
          metadataId: 1,
          mode: 'manager',
          userTeamId: 'team-1',
          currentSeasonId: 1,
          dbFilename: 'test.db',
          createdAt: '2026-03-01',
          updatedAt: '2026-03-01',
          slotNumber: 1,
          saveName: 'Test Save',
          playTimeMinutes: 0,
        },
        season: {
          id: 1,
          year: 2026,
          split: 'spring',
          currentDate: '2026-03-30',
          currentWeek: 10,
          startDate: '2026-01-01',
          endDate: '2026-03-30',
          isActive: true,
        },
        teams: [
          { id: 'team-1', name: 'T1', shortName: 'T1', region: 'LCK', roster: [], budget: 0, salaryCap: 0, reputation: 80, playStyle: 'balanced' },
          { id: 'team-2', name: 'GEN', shortName: 'GEN', region: 'LCK', roster: [], budget: 0, salaryCap: 0, reputation: 79, playStyle: 'balanced' },
          { id: 'team-3', name: 'HLE', shortName: 'HLE', region: 'LCK', roster: [], budget: 0, salaryCap: 0, reputation: 78, playStyle: 'balanced' },
          { id: 'team-4', name: 'DK', shortName: 'DK', region: 'LCK', roster: [], budget: 0, salaryCap: 0, reputation: 77, playStyle: 'balanced' },
          { id: 'team-5', name: 'KT', shortName: 'KT', region: 'LCK', roster: [], budget: 0, salaryCap: 0, reputation: 76, playStyle: 'balanced' },
          { id: 'team-6', name: 'FOX', shortName: 'FOX', region: 'LCK', roster: [], budget: 0, salaryCap: 0, reputation: 75, playStyle: 'balanced' },
        ] as unknown as Team[],
      },
    });

    await act(async () => {
      screen.getByRole('button', { name: '순위 확정' }).click();
    });

    await act(async () => {
      screen.getByRole('button', { name: '전체 시즌 종료' }).click();
    });

    expect(await screen.findByTestId('season-end-followup-panel')).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: '경기 후속 정리' }).click();
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/manager/tactics');
    });
  });
});
