/**
 * 테스트 유틸리티
 * - renderWithProviders: MemoryRouter 래핑 + Zustand 상태 주입
 * - 스토어 리셋 헬퍼
 * - @testing-library 재내보내기
 */
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { MemoryRouterProps } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useMatchStore } from '../stores/matchStore';
import { useSettingsStore } from '../stores/settingsStore';

interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  routerProps?: Omit<MemoryRouterProps, 'children'>;
  gameState?: Partial<ReturnType<typeof useGameStore.getState>>;
  matchState?: Partial<ReturnType<typeof useMatchStore.getState>>;
  settingsState?: Partial<ReturnType<typeof useSettingsStore.getState>>;
}

/**
 * MemoryRouter + Zustand 상태 주입이 포함된 렌더 유틸
 */
export function renderWithProviders(
  ui: ReactElement,
  options: ExtendedRenderOptions = {},
) {
  const { routerProps, gameState, matchState, settingsState, ...renderOptions } = options;

  if (gameState) useGameStore.setState(gameState);
  if (matchState) useMatchStore.setState(matchState);
  if (settingsState) useSettingsStore.setState(settingsState);

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter {...routerProps}>{children}</MemoryRouter>
  );

  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

/** 테스트 간 스토어 초기화 */
export function resetStores() {
  useGameStore.getState().reset();
  useMatchStore.getState().reset();
}

export { screen, within, waitFor } from '@testing-library/react';
export { userEvent };
