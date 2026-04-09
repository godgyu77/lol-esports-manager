import { useEffect, useMemo, useState } from 'react';
import { getDatabase } from '../../../../db/database';
import { type ChemistryRow, getChemistryColor } from './rosterUtils';
import { getDisplayPlayerName } from '../../../../utils/displayName';

interface ChemistryTabProps {
  teamId: string;
}

type ChemistryView = 'starters' | 'all';

function getPairKey(row: ChemistryRow): string {
  return `${row.player_a_id}-${row.player_b_id}`;
}

function isStarterPair(row: ChemistryRow): boolean {
  return row.player_a_division === 'main' && row.player_b_division === 'main';
}

function sortChemistryRows(rows: ChemistryRow[]): ChemistryRow[] {
  return [...rows].sort((left, right) => {
    const starterDelta = Number(isStarterPair(right)) - Number(isStarterPair(left));
    if (starterDelta !== 0) return starterDelta;
    if (left.chemistry_score !== right.chemistry_score) return left.chemistry_score - right.chemistry_score;
    return getPairKey(left).localeCompare(getPairKey(right));
  });
}

function renderPairLabel(row: ChemistryRow): string {
  return `${getDisplayPlayerName(row.player_a_name)} - ${getDisplayPlayerName(row.player_b_name)}`;
}

export function ChemistryTab({ teamId }: ChemistryTabProps) {
  const [chemistryRows, setChemistryRows] = useState<ChemistryRow[]>([]);
  const [chemistryLoading, setChemistryLoading] = useState(false);
  const [view, setView] = useState<ChemistryView>('starters');

  useEffect(() => {
    let cancelled = false;
    setChemistryLoading(true);
    (async () => {
      try {
        const db = await getDatabase();
        const rows = await db.select<ChemistryRow[]>(
          `SELECT
             pc.*,
             p1.name as player_a_name,
             p2.name as player_b_name,
             p1.division as player_a_division,
             p2.division as player_b_division
           FROM player_chemistry pc
           JOIN players p1 ON p1.id = pc.player_a_id
           JOIN players p2 ON p2.id = pc.player_b_id
           WHERE p1.team_id = $1 OR p2.team_id = $1`,
          [teamId],
        );
        if (!cancelled) setChemistryRows(sortChemistryRows(rows));
      } catch {
        if (!cancelled) setChemistryRows([]);
      } finally {
        if (!cancelled) setChemistryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const starterRows = useMemo(
    () => chemistryRows.filter((row) => isStarterPair(row)),
    [chemistryRows],
  );
  const displayRows = useMemo(() => {
    if (view === 'all' || starterRows.length === 0) return chemistryRows;
    return starterRows;
  }, [chemistryRows, starterRows, view]);

  const avgScore = useMemo(() => {
    const source = starterRows.length > 0 ? starterRows : chemistryRows;
    if (source.length === 0) return 0;
    return Math.round(source.reduce((sum, row) => sum + row.chemistry_score, 0) / source.length);
  }, [chemistryRows, starterRows]);

  const topPairs = useMemo(
    () => [...displayRows].sort((left, right) => right.chemistry_score - left.chemistry_score).slice(0, 3),
    [displayRows],
  );
  const riskPairs = useMemo(
    () => [...displayRows].sort((left, right) => left.chemistry_score - right.chemistry_score).slice(0, 3),
    [displayRows],
  );

  if (chemistryLoading) {
    return <p className="fm-text-muted fm-text-md">케미스트리를 불러오는 중입니다...</p>;
  }
  if (chemistryRows.length === 0) {
    return <p className="fm-text-muted fm-text-md">케미스트리 데이터가 아직 없습니다.</p>;
  }

  return (
    <>
      <div className="fm-grid fm-grid--4 fm-mb-md">
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">팀 평균 케미</span>
            <span className="fm-stat__value" style={{ color: getChemistryColor(avgScore) }}>
              {avgScore}
            </span>
          </div>
          <p className="fm-text-xs fm-text-secondary fm-mt-xs" style={{ marginBottom: 0 }}>
            {starterRows.length > 0 ? '기본 기준은 주전 조합입니다.' : '현재 팀 전체 조합 평균입니다.'}
          </p>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">최고 조합</span>
            <span className="fm-stat__value">{topPairs[0] ? renderPairLabel(topPairs[0]) : '-'}</span>
          </div>
          <p className="fm-text-xs fm-text-secondary fm-mt-xs" style={{ marginBottom: 0 }}>
            {topPairs[0] ? `${topPairs[0].chemistry_score}점` : '강한 조합이 아직 없습니다.'}
          </p>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">주의 조합</span>
            <span className="fm-stat__value">{riskPairs[0] ? renderPairLabel(riskPairs[0]) : '-'}</span>
          </div>
          <p className="fm-text-xs fm-text-secondary fm-mt-xs" style={{ marginBottom: 0 }}>
            {riskPairs[0] ? `${riskPairs[0].chemistry_score}점` : '즉시 확인이 필요한 조합은 없습니다.'}
          </p>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">표시 기준</span>
            <span className="fm-stat__value">{view === 'starters' && starterRows.length > 0 ? '주전 조합' : '전체 조합'}</span>
          </div>
          <div className="fm-flex fm-gap-xs fm-mt-sm">
            <button
              type="button"
              className={`fm-btn fm-btn--sm ${view === 'starters' ? 'fm-btn--primary' : ''}`}
              onClick={() => setView('starters')}
              disabled={starterRows.length === 0}
            >
              주전 조합
            </button>
            <button
              type="button"
              className={`fm-btn fm-btn--sm ${view === 'all' ? 'fm-btn--primary' : ''}`}
              onClick={() => setView('all')}
            >
              전체 조합
            </button>
          </div>
        </div>
      </div>

      <div className="fm-grid fm-grid--2 fm-mb-md">
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">최고 조합 3</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {topPairs.map((row) => (
              <div key={`top-${getPairKey(row)}`} className="fm-card">
                <div className="fm-flex fm-justify-between fm-items-center fm-gap-sm">
                  <strong className="fm-text-primary">{renderPairLabel(row)}</strong>
                  <span className="fm-badge fm-badge--success">{row.chemistry_score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">주의 조합 3</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {riskPairs.map((row) => (
              <div key={`risk-${getPairKey(row)}`} className="fm-card">
                <div className="fm-flex fm-justify-between fm-items-center fm-gap-sm">
                  <strong className="fm-text-primary">{renderPairLabel(row)}</strong>
                  <span className={`fm-badge ${row.chemistry_score < 40 ? 'fm-badge--danger' : 'fm-badge--warning'}`}>
                    {row.chemistry_score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">{view === 'starters' && starterRows.length > 0 ? '주전 조합 전체 보기' : '전체 케미스트리'}</span>
        </div>
        <div className="fm-panel__body--flush fm-table-wrap">
          <table className="fm-table fm-table--striped">
            <thead>
              <tr>
                <th>선수 A</th>
                <th>선수 B</th>
                <th>케미</th>
                <th>시각화</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => (
                <tr key={getPairKey(row)}>
                  <td className="fm-cell--name">{getDisplayPlayerName(row.player_a_name)}</td>
                  <td className="fm-cell--name">{getDisplayPlayerName(row.player_b_name)}</td>
                  <td>
                    <span className="fm-font-semibold" style={{ color: getChemistryColor(row.chemistry_score) }}>
                      {row.chemistry_score}
                    </span>
                  </td>
                  <td>
                    <div className="fm-bar">
                      <div className="fm-bar__track">
                        <div
                          className="fm-bar__fill"
                          style={{
                            width: `${row.chemistry_score}%`,
                            background: getChemistryColor(row.chemistry_score),
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
