/**
 * BGM 장면 전환 훅
 * 컴포넌트 마운트 시 해당 장면의 BGM을 자동 재생
 */
import { useEffect } from 'react';
import { bgmManager, type BgmScene } from '../audio/bgmManager';
import { useSettingsStore, type SettingsState } from '../stores/settingsStore';

export function useBgm(scene: BgmScene): void {
  const soundEnabled = useSettingsStore((s: SettingsState) => s.soundEnabled);
  const soundVolume = useSettingsStore((s: SettingsState) => s.soundVolume);

  useEffect(() => {
    bgmManager.setEnabled(soundEnabled);
    bgmManager.setVolume(soundVolume);
  }, [soundEnabled, soundVolume]);

  useEffect(() => {
    if (soundEnabled) {
      bgmManager.changeScene(scene);
    }
  }, [scene, soundEnabled]);
}
