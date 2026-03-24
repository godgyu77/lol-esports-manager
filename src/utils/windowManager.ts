/**
 * 창 모드 관리
 * Tauri 2 window API를 사용하여 전체화면/창모드/테두리없는창모드 전환
 */

import type { WindowMode } from '../stores/settingsStore';

export async function applyWindowMode(mode: WindowMode): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();

    switch (mode) {
      case 'fullscreen':
        await win.setDecorations(true);
        await win.setFullscreen(true);
        break;
      case 'borderless':
        await win.setFullscreen(false);
        await win.setDecorations(false);
        await win.maximize();
        break;
      case 'windowed':
      default:
        await win.setFullscreen(false);
        await win.setDecorations(true);
        await win.unmaximize();
        await win.setSize(new (await import('@tauri-apps/api/dpi')).LogicalSize(1280, 800));
        await win.center();
        break;
    }
  } catch (e) {
    console.warn('[windowManager] 창 모드 변경 실패:', e);
  }
}

export async function exitApp(): Promise<void> {
  try {
    const { exit } = await import('@tauri-apps/plugin-process');
    await exit(0);
  } catch {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    } catch {
      window.close();
    }
  }
}
