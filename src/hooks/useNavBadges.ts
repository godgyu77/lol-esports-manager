import { useState, useEffect } from 'react';
import { getUnreadCount } from '../engine/news/newsEngine';
import { getActiveComplaints } from '../engine/complaint/complaintEngine';
import { getPendingReports } from '../engine/scouting/scoutingEngine';
import { getTeamTransferOffers } from '../engine/economy/transferEngine';
import { getUnreadInboxCount } from '../engine/inbox/inboxEngine';
import { NOTIFICATIONS_INVALIDATED_EVENT, NEWS_BADGES_INVALIDATED_EVENT } from '../engine/news/newsEvents';

/**
 * 사이드바 네비게이션 뱃지 카운트를 비동기로 로드하는 훅
 * 반환: Record<string, number> (라우트 path -> 뱃지 수)
 */
export function useNavBadges(userTeamId: string, seasonId: number): Record<string, number> {
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!userTeamId || !seasonId) return;

    let cancelled = false;

    const load = async () => {
      try {
        const [unreadNews, unreadInbox, complaints, pendingScouts, transferOffers] = await Promise.all([
          getUnreadCount(seasonId).catch(() => 0),
          getUnreadInboxCount(userTeamId).catch(() => 0),
          getActiveComplaints(userTeamId).catch(() => []),
          getPendingReports(userTeamId).catch(() => []),
          getTeamTransferOffers(seasonId, userTeamId).catch(() => ({ sent: [], received: [] })),
        ]);

        if (cancelled) return;

        const pendingReceived = transferOffers.received.filter(
          (o) => o.status === 'pending',
        ).length;

        const completedScouts = pendingScouts.filter(
          (r) => r.daysRemaining <= 0,
        ).length;

        const newBadges: Record<string, number> = {};
        if (unreadNews > 0) newBadges['/manager/news'] = unreadNews;
        if (unreadInbox > 0) newBadges['/manager/inbox'] = unreadInbox;
        if (complaints.length > 0) newBadges['/manager/complaints'] = complaints.length;
        if (completedScouts > 0) newBadges['/manager/scouting'] = completedScouts;
        if (pendingReceived > 0) newBadges['/manager/transfer'] = pendingReceived;

        setBadges(newBadges);
      } catch {
        // 뱃지 로드 실패 시 무시
      }
    };

    void load();

    const handleInvalidate = () => {
      void load();
    };

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === 'visible') {
        void load();
      }
    };

    window.addEventListener(NEWS_BADGES_INVALIDATED_EVENT, handleInvalidate);
    window.addEventListener(NOTIFICATIONS_INVALIDATED_EVENT, handleInvalidate);
    window.addEventListener('focus', handleInvalidate);
    document.addEventListener('visibilitychange', handleVisibilityRefresh);

    // 30초마다 갱신
    const interval = setInterval(load, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener(NEWS_BADGES_INVALIDATED_EVENT, handleInvalidate);
      window.removeEventListener(NOTIFICATIONS_INVALIDATED_EVENT, handleInvalidate);
      window.removeEventListener('focus', handleInvalidate);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
    };
  }, [userTeamId, seasonId]);

  return badges;
}
