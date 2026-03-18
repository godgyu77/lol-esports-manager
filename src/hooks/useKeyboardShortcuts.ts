import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMatchStore } from '../stores/matchStore';

/**
 * 글로벌 키보드 단축키 훅
 * - Space: 다음 날 진행 (DayView에서만, onAdvanceDay 콜백으로)
 * - Escape: 뒤로 가기
 * - 1~4: 경기 속도 변경 (LiveMatchView에서만)
 * - S: 저장 (Ctrl+S 방지 겸)
 */
export function useKeyboardShortcuts({
  onAdvanceDay,
  onSave,
}: {
  onAdvanceDay?: () => void;
  onSave?: () => void;
} = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const setSpeed = useMatchStore((s) => s.setSpeed);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // input/textarea/select에 포커스 시 단축키 무시
      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        return;
      }
      if (target.isContentEditable) return;

      // Space = 다음 날 진행 (DayView에서만)
      if (e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const isDayView = location.pathname.endsWith('/day');
        if (isDayView && onAdvanceDay) {
          e.preventDefault();
          onAdvanceDay();
        }
        return;
      }

      // Escape = 뒤로 가기
      if (e.code === 'Escape') {
        navigate(-1);
        return;
      }

      // 1~4 = 경기 속도 변경 (LiveMatchView에서만)
      const isMatchView = location.pathname.endsWith('/match');
      if (isMatchView && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const speedMap: Record<string, number> = {
          Digit1: 1,
          Digit2: 2,
          Digit3: 4,
        };
        const speed = speedMap[e.code];
        if (speed) {
          e.preventDefault();
          setSpeed(speed);
          return;
        }
      }

      // S = 저장
      if (e.code === 'KeyS' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (onSave) {
          e.preventDefault();
          onSave();
        }
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, location.pathname, setSpeed, onAdvanceDay, onSave]);
}
