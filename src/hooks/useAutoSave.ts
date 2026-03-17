/**
 * 자동 저장 훅
 * - settingsStore.autoSaveInterval에 따라 게임 내 날짜 변경 시 자동 저장
 * - 'daily': 매 게임 내 날짜 변경마다 저장
 * - 'weekly': 매주 월요일(dayOfWeek === 1)에 저장
 * - 'manual': 자동 저장 비활성화
 */
import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
import { updateSaveTimestamp } from '../db/queries';
import { parseDate } from '../engine/season/calendar';

export function useAutoSave(): void {
  const currentDate = useGameStore((s) => s.currentDate);
  const saveId = useGameStore((s) => s.save?.id ?? null);
  const autoSaveInterval = useSettingsStore((s) => s.autoSaveInterval);
  const prevDateRef = useRef<string | null>(null);

  useEffect(() => {
    // 날짜가 변경되지 않았거나 초기 로드 시에는 스킵
    if (!currentDate || !saveId || currentDate === prevDateRef.current) {
      prevDateRef.current = currentDate;
      return;
    }

    const prevDate = prevDateRef.current;
    prevDateRef.current = currentDate;

    // 최초 세팅 시(이전 날짜 없음)에는 저장하지 않음
    if (!prevDate) return;

    if (autoSaveInterval === 'manual') return;

    if (autoSaveInterval === 'daily') {
      updateSaveTimestamp(saveId).catch(console.error);
      return;
    }

    if (autoSaveInterval === 'weekly') {
      const dayOfWeek = parseDate(currentDate).getDay();
      // 월요일(1)에 자동 저장
      if (dayOfWeek === 1) {
        updateSaveTimestamp(saveId).catch(console.error);
      }
    }
  }, [currentDate, saveId, autoSaveInterval]);
}
