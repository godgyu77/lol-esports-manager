import { renderWithProviders, resetStores, screen } from '../test/testUtils';
import { MobileBottomNav } from './MobileBottomNav';

describe('MobileBottomNav', () => {
  beforeEach(() => {
    resetStores();
  });

  it('renders badge counts for navigation items', () => {
    renderWithProviders(
      <MobileBottomNav
        items={[
          { to: '/manager', label: '홈', icon: 'H', badgeCount: 0 },
          { to: '/manager/tactics', label: '전술', icon: 'T', badgeCount: 3 },
          { label: '더보기', icon: '+', badgeCount: 1, onClick: vi.fn() },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: /전술/i })).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: /더보기/i })).toHaveTextContent('1');
  });
});
