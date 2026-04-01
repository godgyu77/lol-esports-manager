export const NEWS_BADGES_INVALIDATED_EVENT = 'news-badges-invalidated';

export function invalidateNewsBadges(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NEWS_BADGES_INVALIDATED_EVENT));
}
