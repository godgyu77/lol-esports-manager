/**
 * 매니저 커리어 타임라인
 * - 커리어 요약 (총 시즌, 승/패, 트로피, 최고 순위)
 * - 시즌별 세로 타임라인
 * - 명예의 전당 자격 표시
 */

import { useEffect, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  getManagerCareer,
  checkManagerFameEligibility,
  getCareerSummary,
} from '../../../engine/manager/managerCareerEngine';
import type { ManagerCareerRecord, ManagerFameEligibility, CareerSummary } from '../../../engine/manager/managerCareerEngine';
import {
  buildCareerNarrativeReport,
  type CareerNarrativeReport,
} from '../../../engine/manager/franchiseNarrativeEngine';
import { getCareerArcEvents } from '../../../engine/manager/releaseDepthEngine';
import type { CareerArcEvent } from '../../../types/systemDepth';

export function ManagerCareerView() {
  const save = useGameStore((s) => s.save);

  const [career, setCareer] = useState<ManagerCareerRecord[]>([]);
  const [summary, setSummary] = useState<CareerSummary | null>(null);
  const [fame, setFame] = useState<ManagerFameEligibility | null>(null);
  const [narrative, setNarrative] = useState<CareerNarrativeReport | null>(null);
  const [arcEvents, setArcEvents] = useState<CareerArcEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!save) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const [careerData, summaryData, fameData, arcData] = await Promise.all([
        getManagerCareer(save.id),
        getCareerSummary(save.id),
        checkManagerFameEligibility(save.id),
        getCareerArcEvents(save.id, save.userTeamId, 6).catch(() => []),
      ]);
      if (!cancelled) {
        setCareer(careerData);
        setSummary(summaryData);
        setFame(fameData);
        setNarrative(buildCareerNarrativeReport(summaryData, careerData));
        setArcEvents(arcData);
        setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [save]);

  if (!save) {
    return <p className="fm-text-muted fm-p-md">세이브 데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p className="fm-text-muted fm-p-md">커리어 데이터를 불러오는 중...</p>;
  }

  // 타임라인은 최신 시즌 먼저 (역순)
  const timelineCareer = [...career].reverse();

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">매니저 커리어</h1>
      </div>

      {/* 명예의 전당 */}
      {fame && fame.eligible && (
        <div className="fm-panel fm-card--highlight">
          <div className="fm-panel__body">
            <div className="fm-flex fm-items-center fm-gap-md">
              <span
                className="fm-flex-shrink-0 fm-flex fm-items-center fm-justify-center fm-font-bold fm-text-xs"
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent), #e0c068)',
                  color: 'var(--bg-primary)',
                }}
              >
                HOF
              </span>
              <div className="fm-flex-col fm-gap-xs">
                <h2 className="fm-text-xl fm-font-bold fm-text-accent">명예의 전당</h2>
                <p className="fm-text-sm fm-text-accent">{fame.reason}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 커리어 요약 */}
      {narrative && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">레거시 아크</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-md">
            <div className="fm-card fm-card--highlight">
              <div className="fm-flex-col fm-gap-xs">
                <span className="fm-text-xs fm-font-semibold fm-text-accent">커리어 정체성</span>
                <strong className="fm-text-lg fm-text-primary">{narrative.identity}</strong>
                <span className="fm-text-sm fm-text-secondary">{narrative.outlook}</span>
              </div>
            </div>
            <div className="fm-grid fm-grid--3">
              {narrative.pillars.map((pillar) => (
                <div key={pillar} className="fm-card">
                  <p className="fm-text-sm fm-text-secondary">{pillar}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {arcEvents.length > 0 && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">프랜차이즈 아크 타임라인</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {arcEvents.map((event) => (
              <div key={event.id} className="fm-card">
                <div className="fm-flex fm-justify-between fm-items-center fm-mb-xs">
                  <strong className="fm-text-primary">{event.headline}</strong>
                  <span className="fm-badge fm-badge--default">{event.stage}</span>
                </div>
                <p className="fm-text-sm fm-text-secondary fm-mb-sm">{event.summary}</p>
                {event.consequences.length > 0 && (
                  <div className="fm-flex fm-gap-xs fm-flex-wrap">
                    {event.consequences.map((consequence) => (
                      <span key={`${event.id}-${consequence}`} className="fm-badge fm-badge--info">
                        {consequence}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {summary && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">커리어 요약</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-grid fm-grid--4">
              <SummaryItem label="총 시즌" value={`${summary.totalSeasons}`} />
              <SummaryItem label="통산 전적" value={`${summary.totalWins}승 ${summary.totalLosses}패`} />
              <SummaryItem label="승률" value={`${summary.winRate}%`} highlight={summary.winRate >= 55} />
              <SummaryItem label="트로피" value={`${summary.totalTrophies}개`} highlight={summary.totalTrophies > 0} />
              <SummaryItem label="최고 순위" value={summary.bestStanding > 0 ? `${summary.bestStanding}위` : '-'} />
              <SummaryItem label="플레이오프" value={`${summary.playoffAppearances}회`} />
              <SummaryItem label="명성 점수" value={`${summary.reputationScore}`} />
              <SummaryItem
                label="해고"
                value={`${summary.firingCount}회`}
                negative={summary.firingCount > 0}
              />
            </div>
          </div>
        </div>
      )}

      {/* 명예의 전당 미충족 시 진행률 */}
      {fame && !fame.eligible && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">명예의 전당 진행</span>
          </div>
          <div className="fm-panel__body">
            <p className="fm-text-sm fm-text-muted fm-mb-md">{fame.reason}</p>
            <div className="fm-bar">
              <div className="fm-bar__track">
                <div
                  className="fm-bar__fill fm-bar__fill--accent"
                  style={{
                    width: `${Math.min(
                      Math.max(
                        (fame.totalTrophies / 3) * 100,
                        (fame.totalSeasons / 10) * 100,
                      ),
                      100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 시즌별 타임라인 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">시즌별 타임라인</span>
        </div>
        <div className="fm-panel__body">
          {timelineCareer.length === 0 ? (
            <p className="fm-text-sm fm-text-muted fm-text-center fm-p-md">아직 기록된 시즌이 없습니다.</p>
          ) : (
            <div>
              {timelineCareer.map((record, idx) => {
                const isLast = idx === timelineCareer.length - 1;
                const total = record.wins + record.losses;
                const winRate = total > 0 ? Math.round((record.wins / total) * 1000) / 10 : 0;
                const hasTrophies = record.trophies.length > 0;
                const splitLabel = record.split === 'spring' ? '스프링' : '서머';

                const dotColor = record.wasFired
                  ? 'var(--danger)'
                  : hasTrophies
                    ? 'var(--accent)'
                    : 'var(--text-muted)';

                const cardBorder = record.wasFired
                  ? 'var(--danger-dim)'
                  : hasTrophies
                    ? 'var(--accent-border)'
                    : 'var(--border)';

                return (
                  <div key={record.seasonId} className="fm-flex fm-gap-md" style={{ minHeight: '100px' }}>
                    {/* 타임라인 라인 */}
                    <div className="fm-flex-col fm-items-center fm-flex-shrink-0" style={{ width: '20px' }}>
                      <div
                        className="fm-flex-shrink-0"
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: dotColor,
                          marginTop: '16px',
                          boxShadow: hasTrophies
                            ? '0 0 8px rgba(200,155,60,0.5)'
                            : record.wasFired
                              ? '0 0 8px rgba(239,83,80,0.5)'
                              : 'none',
                        }}
                      />
                      {!isLast && (
                        <div
                          className="fm-flex-1"
                          style={{ width: '2px', background: 'var(--border)', marginTop: '4px' }}
                        />
                      )}
                    </div>

                    {/* 시즌 카드 */}
                    <div
                      className="fm-card fm-flex-1 fm-mb-md"
                      style={{ borderColor: cardBorder }}
                    >
                      <div className="fm-flex fm-justify-between fm-items-center fm-mb-md">
                        <span className="fm-text-lg fm-font-bold fm-text-primary">
                          {record.year}년 {splitLabel}
                        </span>
                        <span className="fm-badge fm-badge--default">{record.teamName}</span>
                      </div>

                      <div className="fm-flex-col fm-gap-xs">
                        <div className="fm-info-row">
                          <span className="fm-info-row__label">전적</span>
                          <span className="fm-info-row__value">
                            {record.wins}승 {record.losses}패 ({winRate}%)
                          </span>
                        </div>
                        <div className="fm-info-row">
                          <span className="fm-info-row__label">순위</span>
                          <span className={`fm-info-row__value ${record.standing <= 3 ? 'fm-text-accent' : ''}`}>
                            {record.standing}위
                          </span>
                        </div>
                        {record.playoffResult && (
                          <div className="fm-info-row">
                            <span className="fm-info-row__label">플레이오프</span>
                            <span className="fm-info-row__value fm-text-accent">
                              {record.playoffResult}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 트로피 표시 */}
                      {hasTrophies && (
                        <div className="fm-flex fm-gap-xs fm-flex-wrap fm-mt-md">
                          {record.trophies.map((trophy, tIdx) => (
                            <span key={tIdx} className="fm-badge fm-badge--accent">
                              {trophy}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 해고 표시 */}
                      {record.wasFired && (
                        <div className="fm-mt-md">
                          <span className="fm-badge fm-badge--danger">해고</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 서브 컴포넌트
// ─────────────────────────────────────────

function SummaryItem({
  label,
  value,
  highlight = false,
  negative = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  negative?: boolean;
}) {
  const valueClass = negative ? 'fm-text-danger' : highlight ? 'fm-text-accent' : 'fm-text-primary';

  return (
    <div className="fm-card">
      <div className="fm-stat">
        <span className="fm-stat__label">{label}</span>
        <span className={`fm-stat__value ${valueClass}`}>{value}</span>
      </div>
    </div>
  );
}
