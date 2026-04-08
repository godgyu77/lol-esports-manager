import { renderWithProviders, screen, resetStores } from '../../test/testUtils';
import { ManagerCreate } from './ManagerCreate';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('ManagerCreate', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  it('updates compact manager summary when background changes', async () => {
    const { user } = renderWithProviders(<ManagerCreate />);

    expect(screen.getByText('요약')).toBeInTheDocument();
    expect(screen.getByText(/준비된 전술가라는 평가/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /전 프로 선수/ }));

    expect(screen.getByText(/유명 선수 출신 감독/)).toBeInTheDocument();
    expect(screen.getByText(/선수 흐름을 빠르게 읽고/)).toBeInTheDocument();
    expect(screen.getByText(/남은 포인트를 모두 배분해야/)).toBeInTheDocument();
  });
});
