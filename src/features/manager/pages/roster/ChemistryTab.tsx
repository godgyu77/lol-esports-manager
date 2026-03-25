import { useState, useEffect } from 'react';
import { getDatabase } from '../../../../db/database';
import { type ChemistryRow, getChemistryColor } from './rosterUtils';

interface ChemistryTabProps {
  teamId: string;
}

export function ChemistryTab({ teamId }: ChemistryTabProps) {
  const [chemistryRows, setChemistryRows] = useState<ChemistryRow[]>([]);
  const [chemistryLoading, setChemistryLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setChemistryLoading(true);
    (async () => {
      try {
        const db = await getDatabase();
        const rows = await db.select<ChemistryRow[]>(
          `SELECT pc.*, p1.name as player_a_name, p2.name as player_b_name
           FROM player_chemistry pc
           JOIN players p1 ON p1.id = pc.player_a_id
           JOIN players p2 ON p2.id = pc.player_b_id
           WHERE p1.team_id = $1 OR p2.team_id = $1
           ORDER BY pc.chemistry_score DESC`,
          [teamId],
        );
        if (!cancelled) setChemistryRows(rows);
      } catch {
        if (!cancelled) setChemistryRows([]);
      } finally {
        if (!cancelled) setChemistryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [teamId]);

  if (chemistryLoading) {
    return <p className="fm-text-muted fm-text-md">로딩 중...</p>;
  }
  if (chemistryRows.length === 0) {
    return <p className="fm-text-muted fm-text-md">케미스트리 데이터가 없습니다.</p>;
  }

  const avgScore = Math.round(
    chemistryRows.reduce((sum, r) => sum + r.chemistry_score, 0) / chemistryRows.length,
  );
  const highPairs = chemistryRows.filter((r) => r.chemistry_score >= 80);
  const lowPairs = chemistryRows.filter((r) => r.chemistry_score < 30);

  return (
    <>
      {/* 팀 평균 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__body">
          <div className="fm-flex fm-items-center fm-justify-between">
            <span className="fm-text-lg fm-font-medium fm-text-secondary">팀 평균 케미스트리</span>
            <span className="fm-text-2xl fm-font-bold" style={{ color: getChemistryColor(avgScore) }}>
              {avgScore}
            </span>
          </div>
        </div>
      </div>

      {/* 하이라이트 */}
      {highPairs.length > 0 && (
        <div className="fm-alert fm-alert--success fm-mb-md">
          <div className="fm-flex-col fm-gap-xs">
            <span className="fm-font-semibold fm-text-base">높은 케미 (80+)</span>
            {highPairs.map((r) => (
              <span key={`${r.player_a_id}-${r.player_b_id}`} className="fm-text-base fm-text-secondary">
                {r.player_a_name} - {r.player_b_name}: <strong className="fm-text-success">{r.chemistry_score}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
      {lowPairs.length > 0 && (
        <div className="fm-alert fm-alert--danger fm-mb-md">
          <div className="fm-flex-col fm-gap-xs">
            <span className="fm-font-semibold fm-text-base">낮은 케미 (30-)</span>
            {lowPairs.map((r) => (
              <span key={`${r.player_a_id}-${r.player_b_id}`} className="fm-text-base fm-text-secondary">
                {r.player_a_name} - {r.player_b_name}: <strong className="fm-text-danger">{r.chemistry_score}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 전체 테이블 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">전체 케미스트리</span>
        </div>
        <div className="fm-panel__body--flush fm-table-wrap">
          <table className="fm-table fm-table--striped">
            <thead>
              <tr>
                <th>선수 A</th>
                <th>선수 B</th>
                <th>케미스트리</th>
                <th>시각화</th>
              </tr>
            </thead>
            <tbody>
              {chemistryRows.map((row) => (
                <tr key={`${row.player_a_id}-${row.player_b_id}`}>
                  <td className="fm-cell--name">{row.player_a_name}</td>
                  <td className="fm-cell--name">{row.player_b_name}</td>
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
