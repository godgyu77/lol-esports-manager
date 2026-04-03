import { useEffect, useRef } from 'react';
import { useGameStore, type GameState } from '../stores/gameStore';
import { useSettingsStore, type SettingsState } from '../stores/settingsStore';
import { createAutoSaveFromCurrent } from '../engine/save/saveEngine';
import { parseDate } from '../engine/season/calendar';

export function useAutoSave(): void {
  const currentDate = useGameStore((state: GameState) => state.currentDate);
  const saveMetadataId = useGameStore((state: GameState) => state.save?.metadataId ?? null);
  const autoSaveInterval = useSettingsStore((state: SettingsState) => state.autoSaveInterval);
  const prevDateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentDate || !saveMetadataId || currentDate === prevDateRef.current) {
      prevDateRef.current = currentDate;
      return;
    }

    const prevDate = prevDateRef.current;
    prevDateRef.current = currentDate;

    if (!prevDate || autoSaveInterval === 'manual') return;

    if (autoSaveInterval === 'daily') {
      createAutoSaveFromCurrent().catch(console.error);
      return;
    }

    if (autoSaveInterval === 'weekly') {
      const dayOfWeek = parseDate(currentDate).getDay();
      if (dayOfWeek === 1) {
        createAutoSaveFromCurrent().catch(console.error);
      }
    }
  }, [currentDate, saveMetadataId, autoSaveInterval]);
}
