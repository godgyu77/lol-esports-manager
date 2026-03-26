import { useState, useEffect } from 'react';
import { getDatabase } from '../../../../db/database';
import { POSITION_LABELS_KR } from '../../../../utils/constants';

const POSITION_LABELS: Record<string, string> = POSITION_LABELS_KR;
import {
  type SatisfactionRow,
  POSITION_BADGE_MAP,
  SATISFACTION_LABELS,
  getSatisfactionColor,
  getBarFillClass,
} from './rosterUtils';

interface SatisfactionTabProps {
  teamId: string;
}

export function SatisfactionTab({ teamId }: SatisfactionTabProps) {
  const [satisfactionRows, setSatisfactionRows] = useState<SatisfactionRow[]>([]);
  const [satisfactionLoading, setSatisfactionLoading] = useState(false);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSatisfactionLoading(true);
    (async () => {
      try {
        const db = await getDatabase();
        const rows = await db.select<SatisfactionRow[]>(
          `SELECT ps.*, p.name as player_name, p.position
           FROM player_satisfaction ps
           JOIN players p ON p.id = ps.player_id
           WHERE p.team_id = $1`,
          [teamId],
        );
        if (!cancelled) setSatisfactionRows(rows);
      } catch {
        if (!cancelled) setSatisfactionRows([]);
      } finally {
        if (!cancelled) setSatisfactionLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [teamId]);

  if (satisfactionLoading) {
    return <p className="fm-text-muted fm-text-md">로딩 중...</p>;
  }
  if (satisfactionRows.length === 0) {
    return <p className="fm-text-muted fm-text-md">만족도 데이터가 없습니다.</p>;
  }

  const dangerPlayers = satisfactionRows.filter((r) => r.overall_satisfaction < 30);

  return (
    <>
      {/* 불만 위험 경고 */}
      {dangerPlayers.length > 0 && (
        <div className="fm-alert fm-alert--danger fm-mb-lg">
          <div className="fm-flex-col fm-gap-xs">
            <span className="fm-font-semibold fm-text-base">
              불만 위험 선수 ({dangerPlayers.length}명)
            </span>
            {dangerPlayers.map((r) => (
              <span key={r.player_id} className="fm-text-base fm-text-secondary">
                {r.player_name} ({POSITION_LABELS[r.position] ?? r.position}) - 만족도: <strong className="fm-text-danger">{r.overall_satisfaction}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 선수별 만족도 목록 */}
      <div className="fm-flex-col fm-gap-sm">
        {satisfactionRows.map((row) => {
          const isExpanded = expandedPlayerId === row.player_id;
          return (
            <div key={row.player_id} className={`fm-card ${isExpanded ? 'fm-card--highlight' : ''}`}>
              <button
                className="fm-flex fm-items-center fm-justify-between"
                style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', textAlign: 'left', padding: 0 }}
                onClick={() => setExpandedPlayerId(isExpanded ? null : row.player_id)}
                aria-expanded={isExpanded}
                aria-label={`${row.player_name} 만족도 상세`}
              >
                <div className="fm-flex fm-items-center fm-gap-sm fm-flex-1">
                  <span className={`fm-pos-badge fm-pos-badge--${POSITION_BADGE_MAP[row.position] ?? 'mid'}`}>
                    {POSITION_LABELS[row.position] ?? row.position}
                  </span>
                  <span className="fm-text-lg fm-font-medium fm-text-primary">
                    {row.player_name}
                  </span>
                  {row.overall_satisfaction < 30 && (
                    <span className="fm-badge fm-badge--danger">위험</span>
                  )}
                </div>
                <div className="fm-flex fm-items-center fm-gap-sm" style={{ minWidth: '200px' }}>
                  <div className="fm-bar fm-flex-1">
                    <div className="fm-bar__track">
                      <div
                        className="fm-bar__fill"
                        style={{
                          width: `${row.overall_satisfaction}%`,
                          background: getSatisfactionColor(row.overall_satisfaction),
                        }}
                      />
                    </div>
                  </div>
                  <span
                    className="fm-bar__value"
                    style={{ color: getSatisfactionColor(row.overall_satisfaction) }}
                  >
                    {row.overall_satisfaction}
                  </span>
                  <span className="fm-text-xs fm-text-muted">
                    {isExpanded ? '\u25B2' : '\u25BC'}
                  </span>
                </div>
              </button>

              {/* 상세 6요소 */}
              {isExpanded && (
                <div className="fm-flex-col fm-gap-sm fm-mt-sm" style={{ paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--border-subtle)' }}>
                  {(Object.keys(SATISFACTION_LABELS) as (keyof typeof SATISFACTION_LABELS)[]).map((key) => {
                    const value = row[key as keyof SatisfactionRow] as number;
                    return (
                      <div key={key} className="fm-flex fm-items-center fm-gap-sm">
                        <span className="fm-text-md fm-text-muted" style={{ minWidth: '80px' }}>
                          {SATISFACTION_LABELS[key]}
                        </span>
                        <div className="fm-bar fm-flex-1">
                          <div className="fm-bar__track">
                            <div
                              className={getBarFillClass(value)}
                              style={{ width: `${value}%` }}
                            />
                          </div>
                        </div>
                        <span
                          className="fm-bar__value"
                          style={{ color: getSatisfactionColor(value) }}
                        >
                          {value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
