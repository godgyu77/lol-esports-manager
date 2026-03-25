/**
 * 업적/도전과제 뷰
 * - 카테고리별 탭 (전체/매치/시즌/커리어/선수/특수)
 * - 해금된 업적: 골드 카드, 날짜 표시
 * - 미해금: 회색, 조건 표시, 프로그레스 바
 * - 상단에 해금 요약
 */

import { useEffect, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  getAchievements,
  getTotalAchievementCount,
  buildAchievementContext,
  calculateProgress,
  type Achievement,
  type AchievementCategory,
  type AchievementContext,
} from '../../../engine/achievement/achievementEngine';

type TabType = 'all' | AchievementCategory;

const TAB_LABELS: [TabType, string][] = [
  ['all', '전체'],
  ['match', '매치'],
  ['season', '시즌'],
  ['career', '커리어'],
  ['player', '선수'],
  ['special', '특수'],
];

const CATEGORY_ICONS: Record<AchievementCategory, string> = {
  match: '\u2694\uFE0F',
  season: '\uD83D\uDCC5',
  career: '\uD83C\uDFC5',
  player: '\uD83D\uDC64',
  special: '\u2B50',
};

export function AchievementView() {
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [context, setContext] = useState<AchievementContext | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!save || !season) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const [achievementData, ctx] = await Promise.all([
          getAchievements(save.id),
          buildAchievementContext(save.id, save.userTeamId, season.id),
        ]);

        if (!cancelled) {
          setAchievements(achievementData);
          setContext(ctx);
        }
      } catch (err) {
        console.warn('[AchievementView] load failed:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [save, season]);

  if (!save || !season) {
    return <p className="fm-text-muted fm-p-md">데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p className="fm-text-muted fm-p-md">업적 데이터를 불러오는 중...</p>;
  }

  const total = getTotalAchievementCount();
  const unlocked = achievements.filter((a) => a.isUnlocked).length;

  const filtered = activeTab === 'all'
    ? achievements
    : achievements.filter((a) => a.category === activeTab);

  // 해금된 것 먼저, 그 다음 미해금
  const sorted = [...filtered].sort((a, b) => {
    if (a.isUnlocked && !b.isUnlocked) return -1;
    if (!a.isUnlocked && b.isUnlocked) return 1;
    return 0;
  });

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">업적</h1>
      </div>

      {/* 요약 카드 */}
      <div className="fm-panel fm-card--highlight">
        <div className="fm-panel__body">
          <div className="fm-flex fm-items-center fm-gap-lg">
            <div className="fm-flex fm-items-center fm-gap-xs" style={{ alignItems: 'baseline' }}>
              <span className="fm-text-accent fm-font-bold" style={{ fontSize: '32px' }}>{unlocked}</span>
              <span className="fm-text-xl fm-text-muted" style={{ margin: '0 4px' }}>/</span>
              <span className="fm-text-xl fm-text-muted fm-font-semibold">{total}</span>
            </div>
            <div className="fm-flex-1 fm-flex-col fm-gap-sm">
              <span className="fm-text-lg fm-font-semibold fm-text-primary">업적 해금</span>
              <div className="fm-bar">
                <div className="fm-bar__track" style={{ height: '8px' }}>
                  <div
                    className="fm-bar__fill fm-bar__fill--accent"
                    style={{ width: `${total > 0 ? (unlocked / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="fm-tabs">
        {TAB_LABELS.map(([tab, label]) => (
          <button
            key={tab}
            className={`fm-tab ${activeTab === tab ? 'fm-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 업적 목록 */}
      <div className="fm-grid fm-grid--auto">
        {sorted.map((achievement) => (
          <AchievementCard
            key={achievement.id}
            achievement={achievement}
            context={context}
          />
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="fm-panel">
          <div className="fm-panel__body fm-text-center fm-p-lg">
            <p className="fm-text-sm fm-text-muted">해당 카테고리의 업적이 없습니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// 업적 카드 컴포넌트
// ─────────────────────────────────────────

function AchievementCard({
  achievement,
  context,
}: {
  achievement: Achievement;
  context: AchievementContext | null;
}) {
  const hasProgress = achievement.target != null && achievement.target > 0;
  const progress = context && hasProgress
    ? calculateProgress(achievement.id, context)
    : undefined;

  return (
    <div
      className={`fm-card fm-flex-col fm-gap-sm ${achievement.isUnlocked ? 'fm-card--highlight' : ''}`}
      style={achievement.isUnlocked ? { boxShadow: '0 2px 12px rgba(200, 155, 60, 0.1)' } : undefined}
    >
      <div className="fm-flex fm-items-center fm-gap-md">
        <span className="fm-flex-shrink-0 fm-text-center" style={{ fontSize: '24px', width: '36px' }}>
          {achievement.isUnlocked ? '\uD83C\uDFC6' : CATEGORY_ICONS[achievement.category]}
        </span>
        <div className="fm-flex-col fm-flex-1" style={{ minWidth: 0, gap: '2px' }}>
          <span className={`fm-text-lg fm-font-bold ${achievement.isUnlocked ? 'fm-text-accent' : 'fm-text-muted'}`}>
            {achievement.name}
          </span>
          <span className="fm-text-xs fm-text-muted fm-font-medium">
            {TAB_LABELS.find(([t]) => t === achievement.category)?.[1] ?? ''}
          </span>
        </div>
      </div>

      <p className={`fm-text-md ${achievement.isUnlocked ? 'fm-text-secondary' : 'fm-text-muted'}`} style={{ lineHeight: '1.4' }}>
        {achievement.description}
      </p>

      <div className="fm-flex fm-justify-between fm-items-center">
        {achievement.isUnlocked ? (
          <span className="fm-text-xs fm-text-accent fm-font-medium">
            {achievement.unlockedDate} 해금
          </span>
        ) : (
          <span className="fm-text-xs fm-text-muted">
            조건: {achievement.condition}
          </span>
        )}
      </div>

      {/* 프로그레스 바 (미해금 + target이 있는 경우) */}
      {!achievement.isUnlocked && hasProgress && progress != null && (
        <div className="fm-flex fm-items-center fm-gap-md fm-mt-sm">
          <div className="fm-bar fm-flex-1">
            <div className="fm-bar__track">
              <div
                className="fm-bar__fill fm-bar__fill--blue"
                style={{ width: `${(progress / (achievement.target ?? 1)) * 100}%` }}
              />
            </div>
          </div>
          <span className="fm-text-xs fm-text-muted fm-font-medium fm-text-right" style={{ minWidth: '50px' }}>
            {progress} / {achievement.target}
          </span>
        </div>
      )}
    </div>
  );
}
