/**
 * Vitest 전역 셋업 파일
 * - jest-dom 매처 확장
 * - Tauri API 모킹
 * - Audio API 모킹 (jsdom 미지원)
 * - 브라우저 API 폴리필
 */
import '@testing-library/jest-dom/vitest';

// ── Tauri plugin-sql mock ──
vi.mock('@tauri-apps/plugin-sql', () => {
  const mockDb = {
    execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
    select: vi.fn().mockResolvedValue([]),
    close: vi.fn(),
  };
  return {
    default: { load: vi.fn().mockResolvedValue(mockDb) },
  };
});

// ── Tauri core API mock ──
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation(async (command: string) => {
    if (command === 'game_database_exists') return true;
    return null;
  }),
}));

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/mock/app/data'),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn().mockReturnValue({
    setFullscreen: vi.fn(),
    isFullscreen: vi.fn().mockResolvedValue(false),
    setSize: vi.fn(),
    listen: vi.fn().mockResolvedValue(vi.fn()),
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

vi.mock('@tauri-apps/plugin-stronghold', () => ({
  Stronghold: {
    load: vi.fn().mockResolvedValue({
      loadClient: vi.fn().mockResolvedValue({
        getStore: vi.fn().mockReturnValue({
          insert: vi.fn(),
          get: vi.fn().mockResolvedValue([]),
          remove: vi.fn(),
        }),
      }),
      createClient: vi.fn().mockResolvedValue({
        getStore: vi.fn().mockReturnValue({
          insert: vi.fn(),
          get: vi.fn().mockResolvedValue([]),
          remove: vi.fn(),
        }),
      }),
      save: vi.fn(),
    }),
  },
  Client: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn().mockResolvedValue(''),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  exit: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}));

// ── Audio mocks (jsdom lacks HTMLAudioElement/AudioContext) ──
if (typeof globalThis.AudioContext === 'undefined') {
  globalThis.AudioContext = class MockAudioContext {
    createOscillator = () => ({
      connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
      frequency: { setValueAtTime: vi.fn() }, type: '',
    });
    createGain = () => ({
      connect: vi.fn(),
      gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    });
    get destination() { return {}; }
    get currentTime() { return 0; }
  } as unknown as typeof AudioContext;
}

if (typeof globalThis.Audio === 'undefined') {
  globalThis.Audio = class MockAudio {
    src = '';
    volume = 1;
    currentTime = 0;
    loop = false;
    paused = true;
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();
    load = vi.fn();
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
  } as unknown as typeof Audio;
}

// ── window.matchMedia mock ──
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ── requestAnimationFrame polyfill ──
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(cb, 16)) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) =>
    clearTimeout(id)) as typeof cancelAnimationFrame;
}

// ── IntersectionObserver mock ──
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class MockIntersectionObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
  } as unknown as typeof IntersectionObserver;
}

// ── ResizeObserver mock ──
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    constructor(_cb: ResizeObserverCallback) {}
  } as unknown as typeof ResizeObserver;
}
