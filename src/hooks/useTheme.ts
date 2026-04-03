import { useEffect } from 'react';
import { useSettingsStore, type SettingsState } from '../stores/settingsStore';

export function useTheme() {
  const theme = useSettingsStore((s: SettingsState) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return theme;
}
