import { addGameDays } from './releaseDepthEngine';

describe('releaseDepthEngine', () => {
  it('adds game days without timezone drift', () => {
    expect(addGameDays('2026-04-03', 12)).toBe('2026-04-15');
    expect(addGameDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addGameDays('2026-04-03', -2)).toBe('2026-04-01');
  });
});
