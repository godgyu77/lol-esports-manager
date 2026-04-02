export const NEWS_BADGES_INVALIDATED_EVENT = 'news-badges-invalidated';
export const NOTIFICATIONS_INVALIDATED_EVENT = 'notifications-invalidated';

function dispatchInvalidationEvent(name: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name));
}

export function invalidateNewsBadges(): void {
  dispatchInvalidationEvent(NEWS_BADGES_INVALIDATED_EVENT);
  dispatchInvalidationEvent(NOTIFICATIONS_INVALIDATED_EVENT);
}

export function invalidateNotifications(): void {
  dispatchInvalidationEvent(NOTIFICATIONS_INVALIDATED_EVENT);
}
