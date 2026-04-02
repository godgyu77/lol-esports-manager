import { useCallback, useRef } from 'react';
import type { KeyboardEvent } from 'react';

type ToolbarKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

interface ToolbarNavigationOptions<T extends string> {
  items: readonly T[];
  activeItem: T;
  onSelect: (item: T) => void;
}

export function useToolbarNavigation<T extends string>({
  items,
  activeItem,
  onSelect,
}: ToolbarNavigationOptions<T>) {
  const itemRefs = useRef(new Map<T, HTMLButtonElement | null>());

  const setItemRef = useCallback(
    (item: T) => (node: HTMLButtonElement | null) => {
      itemRefs.current.set(item, node);
    },
    [],
  );

  const focusItem = useCallback((item: T) => {
    itemRefs.current.get(item)?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const key = event.key as ToolbarKey;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) {
        return;
      }

      const currentIndex = items.indexOf(activeItem);
      if (currentIndex === -1 || items.length === 0) return;

      event.preventDefault();

      let nextIndex = currentIndex;
      if (key === 'Home') nextIndex = 0;
      if (key === 'End') nextIndex = items.length - 1;
      if (key === 'ArrowRight' || key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % items.length;
      }
      if (key === 'ArrowLeft' || key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + items.length) % items.length;
      }

      const nextItem = items[nextIndex];
      onSelect(nextItem);
      window.requestAnimationFrame(() => focusItem(nextItem));
    },
    [activeItem, focusItem, items, onSelect],
  );

  const getItemProps = useCallback(
    (item: T) => ({
      ref: setItemRef(item),
      onKeyDown: handleKeyDown,
      tabIndex: activeItem === item ? 0 : -1,
    }),
    [activeItem, handleKeyDown, setItemRef],
  );

  return { getItemProps };
}
