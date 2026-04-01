import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMatchStore } from '../stores/matchStore';

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
  const requestNavigationPause = useMatchStore((s) => s.requestNavigationPause);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return;
      if (target.isContentEditable) return;

      const isDayView = location.pathname.endsWith('/day');
      const isMatchView = location.pathname.endsWith('/match');

      if (event.code === 'Space' && !event.ctrlKey && !event.altKey && !event.metaKey) {
        if (isDayView && onAdvanceDay) {
          event.preventDefault();
          onAdvanceDay();
        }
        return;
      }

      if (event.code === 'Escape') {
        if (isMatchView) {
          event.preventDefault();
          requestNavigationPause();
          return;
        }
        navigate(-1);
        return;
      }

      if (isMatchView && !event.ctrlKey && !event.altKey && !event.metaKey) {
        const speedMap: Record<string, number> = {
          Digit1: 1,
          Digit2: 1.5,
          Digit3: 2,
        };
        const speed = speedMap[event.code];
        if (speed) {
          event.preventDefault();
          setSpeed(speed);
          return;
        }
      }

      if (event.code === 'KeyS' && !event.ctrlKey && !event.altKey && !event.metaKey) {
        if (onSave) {
          event.preventDefault();
          onSave();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [location.pathname, navigate, onAdvanceDay, onSave, requestNavigationPause, setSpeed]);
}
