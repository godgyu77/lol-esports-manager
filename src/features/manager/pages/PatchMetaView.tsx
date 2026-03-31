/**
 * 패치 메타 대시보드
 * - 현재 패치 정보 (패치 번호, 적용일)
 * - 메타 변동 요약 (전략별 효율)
 * - 인기 챔피언 TOP 10 (픽률/승률)
 * - 역할군별 강세 변동
 * - 팀 메타 적응도 (유저팀 주전 선수 챔피언풀 ↔ 현재 메타)
 */

import { useEffect, useState } from 'react';
import { getDatabase } from '../../../db/database';
import { useGameStore } from '../../../stores/gameStore';
import { CHAMPION_DB } from '../../../data/championDb';
import type { ChampionTag } from '../../../types/champion';
import type { Player } from '../../../types/player';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

interface PatchInfo {
  seasonId: number;
  week: number;
  championId: string;
  statKey: string;
  oldValue: string;
  newValue: string;
  reason: string | null;
  createdAt: string;
}

interface MetaModifier {
  seasonId: number;
  patchNumber: number;
  teamfightEfficiency: number;
  splitPushEfficiency: number;
  earlyAggroEfficiency: number;
  objectiveEfficiency: number;
}

interface PatchRow {
  season_id: number;
  week: number;
  champion_id: string;
  stat_key: string;
  old_value: string;
  new_value: string;
  reason: string | null;
  created_at: string;
}

interface MetaModifierRow {
  season_id: number;
  patch_number: number;
  teamfight_efficiency: number;
  split_push_efficiency: number;
  early_aggro_efficiency: number;
  objective_efficiency: number;
}

interface ChampStatRow {
  champion_id: string;
  pick_count: number;
  wins: number;
}

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────

const STRATEGY_LABELS: Record<string, string> = {
  teamfightEfficiency: '한타',
  splitPushEfficiency: '스플릿 푸시',
  earlyAggroEfficiency: '초반 어그로',
  objectiveEfficiency: '오브젝트 컨트롤',
};

const TAG_LABELS: Record<ChampionTag, string> = {
  assassin: '암살자',
  fighter: '전사',
  mage: '마법사',
  marksman: '원거리',
  tank: '탱커',
  support: '서포터',
  splitpush: '스플릿',
  teamfight: '한타',
  engage: '이니시',
  poke: '포크',
  utility: '유틸',
  hypercarry: '하이퍼캐리',
};

const ROLE_TAGS: ChampionTag[] = ['assassin', 'fighter', 'mage', 'marksman', 'tank', 'support'];

export function PatchMetaView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);

  const [latestPatch, setLatestPatch] = useState<PatchInfo[]>([]);
  const [metaModifiers, setMetaModifiers] = useState<MetaModifier | null>(null);
  const [champStats, setChampStats] = useState<ChampStatRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [teamMetaScore, setTeamMetaScore] = useState<number>(0);

  useEffect(() => {
    if (!season) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const db = await getDatabase();

      // 최신 패치 정보
      const patchRows = await db.select<PatchRow[]>(
        `SELECT season_id, week, champion_id, stat_key, old_value, new_value, reason, created_at
         FROM champion_patches
         WHERE season_id = $1
         ORDER BY week DESC, id DESC
         LIMIT 10`,
        [season.id],
      );

      // 메타 효율 보정
      const metaRows = await db.select<MetaModifierRow[]>(
        `SELECT season_id, patch_number,
                teamfight_efficiency, split_push_efficiency,
                early_aggro_efficiency, objective_efficiency
         FROM patch_meta_modifiers
         WHERE season_id = $1
         ORDER BY patch_number DESC
         LIMIT 1`,
        [season.id],
      );

      // 챔피언 픽률/승률
      let champStatRows: ChampStatRow[] = [];
      try {
        champStatRows = await db.select<ChampStatRow[]>(
          `SELECT pg.champion_id, COUNT(*) as pick_count,
           SUM(CASE WHEN pg.team_id = g.winner_team_id THEN 1 ELSE 0 END) as wins
           FROM player_game_stats pg JOIN games g ON g.id = pg.game_id
           WHERE g.season_id = $1
           GROUP BY pg.champion_id ORDER BY pick_count DESC LIMIT 20`,
          [season.id],
        );
      } catch {
        // 테이블 미존재 또는 데이터 없음
      }

      if (cancelled) return;

      const patches: PatchInfo[] = patchRows.map((r) => ({
        seasonId: r.season_id,
        week: r.week,
        championId: r.champion_id,
        statKey: r.stat_key,
        oldValue: r.old_value,
        newValue: r.new_value,
        reason: r.reason,
        createdAt: r.created_at,
      }));

      const meta: MetaModifier | null = metaRows.length > 0
        ? {
            seasonId: metaRows[0].season_id,
            patchNumber: metaRows[0].patch_number,
            teamfightEfficiency: metaRows[0].teamfight_efficiency,
            splitPushEfficiency: metaRows[0].split_push_efficiency,
            earlyAggroEfficiency: metaRows[0].early_aggro_efficiency,
            objectiveEfficiency: metaRows[0].objective_efficiency,
          }
        : null;

      setLatestPatch(patches);
      setMetaModifiers(meta);
      setChampStats(champStatRows);

      // 팀 메타 적응도 계산
      if (save?.userTeamId) {
        const userTeam = teams.find((t) => t.id === save.userTeamId);
        if (userTeam && userTeam.roster) {
          const score = calculateTeamMetaFit(userTeam.roster, meta, champStatRows);
          setTeamMetaScore(score);
        }
      }

      setIsLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [season, save, teams]);

  if (!season) {
    return <p className="fm-text-muted fm-p-md">시즌 데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p className="fm-text-muted fm-p-md">패치 메타 데이터를 불러오는 중...</p>;
  }

  const latestWeek = latestPatch.length > 0 ? latestPatch[0].week : 0;

  const getChampionNameKo = (id: string) => {
    const champ = CHAMPION_DB.find((c) => c.id === id);
    return champ?.nameKo ?? id;
  };

  const getChampionTier = (id: string) => {
    const champ = CHAMPION_DB.find((c) => c.id === id);
    return champ?.tier ?? '-';
  };

  // 역할군별 강세 집계
  const roleStrength = computeRoleStrength(champStats);

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">패치 메타</h1>
      </div>

      {/* 현재 패치 정보 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">현재 패치 정보</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-flex fm-gap-lg">
            <div className="fm-stat">
              <span className="fm-stat__label">시즌</span>
              <span className="fm-stat__value">
                {season.year}년 {season.split === 'spring' ? '스프링' : '서머'}
              </span>
            </div>
            <div className="fm-stat">
              <span className="fm-stat__label">최신 패치 주차</span>
              <span className="fm-stat__value">Week {latestWeek || '-'}</span>
            </div>
            {metaModifiers && (
              <div className="fm-stat">
                <span className="fm-stat__label">패치 번호</span>
                <span className="fm-stat__value">#{metaModifiers.patchNumber}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 메타 변동 요약 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">전략별 효율 보정</span>
        </div>
        <div className="fm-panel__body">
          {metaModifiers ? (
            <div className="fm-grid fm-grid--2">
              {(Object.entries(STRATEGY_LABELS) as [string, string][]).map(([key, label]) => {
                const value = metaModifiers[key as keyof MetaModifier] as number;
                const pct = Math.round(value * 100);
                const colorClass = pct > 0 ? 'fm-text-success' : pct < 0 ? 'fm-text-danger' : 'fm-text-muted';
                const barColor = pct > 0 ? 'fm-bar__fill--green' : pct < 0 ? 'fm-bar__fill--red' : '';
                return (
                  <div key={key} className="fm-card">
                    <span className="fm-text-sm fm-text-muted fm-font-medium">{label}</span>
                    <span className={`fm-text-2xl fm-font-bold ${colorClass}`}>
                      {pct > 0 ? `+${pct}%` : `${pct}%`}
                    </span>
                    <div className="fm-bar fm-bar--sm fm-mt-sm">
                      <div className="fm-bar__track">
                        <div
                          className={`fm-bar__fill ${barColor}`}
                          style={{ width: `${Math.min(Math.abs(pct) * 5, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="fm-text-sm fm-text-muted fm-text-center fm-p-md">아직 메타 패치가 적용되지 않았습니다.</p>
          )}
        </div>
      </div>

      {/* 인기 챔피언 TOP 10 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">인기 챔피언 TOP 10</span>
        </div>
        <div className="fm-panel__body--flush">
          {champStats.length > 0 ? (
            <div className="fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th className="text-center">#</th>
                    <th>챔피언</th>
                    <th className="text-center">티어</th>
                    <th className="text-center">픽 수</th>
                    <th className="text-center">승리</th>
                    <th className="text-center">승률</th>
                  </tr>
                </thead>
                <tbody>
                  {champStats.slice(0, 10).map((row, idx) => {
                    const winRate = row.pick_count > 0
                      ? Math.round((row.wins / row.pick_count) * 1000) / 10
                      : 0;
                    const tier = getChampionTier(row.champion_id);
                    return (
                      <tr key={row.champion_id}>
                        <td className={`text-center ${idx < 3 ? 'fm-cell--gold' : ''}`}>
                          {idx + 1}
                        </td>
                        <td className="fm-cell--name">
                          {getChampionNameKo(row.champion_id)}
                        </td>
                        <td className={`text-center ${tier === 'S' ? 'fm-cell--red' : tier === 'A' ? 'fm-cell--gold' : ''}`}>
                          {tier}
                        </td>
                        <td className="text-center">{row.pick_count}</td>
                        <td className="text-center">{row.wins}</td>
                        <td className={`text-center ${winRate >= 55 ? 'fm-cell--green' : winRate <= 45 ? 'fm-cell--red' : ''}`}>
                          {winRate}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="fm-text-sm fm-text-muted fm-text-center fm-p-md">아직 경기 데이터가 없습니다.</p>
          )}
        </div>
      </div>

      {/* 역할군별 강세 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">역할군별 강세</span>
        </div>
        <div className="fm-panel__body">
          {roleStrength.length > 0 ? (
            <div className="fm-grid fm-grid--3">
              {roleStrength.map((role) => {
                const barColor = role.winRate >= 55 ? 'fm-bar__fill--green' : role.winRate <= 45 ? 'fm-bar__fill--red' : 'fm-bar__fill--blue';
                const valueClass = role.winRate >= 55 ? 'fm-text-success' : role.winRate <= 45 ? 'fm-text-danger' : 'fm-text-secondary';
                return (
                  <div key={role.tag} className="fm-card">
                    <span className="fm-text-lg fm-font-semibold fm-text-primary">{TAG_LABELS[role.tag] ?? role.tag}</span>
                    <span className="fm-text-xs fm-text-muted">{role.picks}픽</span>
                    <span className={`fm-text-xl fm-font-bold ${valueClass}`}>
                      {role.winRate}%
                    </span>
                    <div className="fm-bar fm-bar--sm fm-mt-sm">
                      <div className="fm-bar__track">
                        <div
                          className={`fm-bar__fill ${barColor}`}
                          style={{ width: `${Math.min(role.winRate, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="fm-text-sm fm-text-muted fm-text-center fm-p-md">아직 경기 데이터가 없습니다.</p>
          )}
        </div>
      </div>

      {/* 팀 메타 적응도 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">팀 메타 적응도</span>
        </div>
        <div className="fm-panel__body fm-text-center">
          <div className="fm-flex fm-items-center fm-justify-center fm-gap-xs fm-p-md">
            <span
              className="fm-font-bold"
              style={{
                fontSize: '48px',
                color: teamMetaScore >= 70 ? 'var(--success)' : teamMetaScore >= 40 ? 'var(--accent)' : 'var(--danger)',
              }}
            >
              {teamMetaScore}
            </span>
            <span className="fm-text-xl fm-text-muted fm-font-medium">/ 100</span>
          </div>
          <p className="fm-text-sm fm-text-muted">
            {teamMetaScore >= 70
              ? '현재 메타에 잘 적응하고 있습니다. 주전 선수들의 챔피언풀이 메타와 잘 맞습니다.'
              : teamMetaScore >= 40
                ? '메타 적응이 보통입니다. 일부 포지션의 챔피언풀 보강을 고려해보세요.'
                : '현재 메타에 맞지 않습니다. 선수 훈련이나 전술 변경을 권장합니다.'}
          </p>
        </div>
      </div>

      {/* 최근 패치 변경 내역 */}
      {latestPatch.length > 0 && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">최근 패치 변경 내역</span>
          </div>
          <div className="fm-panel__body--flush">
            <div className="fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th>주차</th>
                    <th>챔피언</th>
                    <th>스탯</th>
                    <th>변경</th>
                    <th>사유</th>
                  </tr>
                </thead>
                <tbody>
                  {latestPatch.map((p, idx) => {
                    const oldNumeric = Number.parseFloat(p.oldValue);
                    const newNumeric = Number.parseFloat(p.newValue);
                    const isNum = Number.isFinite(oldNumeric) && Number.isFinite(newNumeric);
                    const delta = isNum ? newNumeric - oldNumeric : 0;
                    const changeClass = isNum
                      ? delta > 0 ? 'fm-cell--green' : delta < 0 ? 'fm-cell--red' : ''
                      : '';
                    return (
                      <tr key={idx}>
                        <td>W{p.week}</td>
                        <td className="fm-cell--name">
                          {getChampionNameKo(p.championId)}
                        </td>
                        <td>{STAT_KEY_LABELS[p.statKey] ?? p.statKey}</td>
                        <td className={changeClass}>
                          {p.oldValue} → {p.newValue}
                          {isNum && delta !== 0 && (
                            <span className="fm-text-xs fm-text-muted" style={{ marginLeft: '4px' }}>
                              ({delta > 0 ? '+' : ''}{delta})
                            </span>
                          )}
                        </td>
                        <td className="fm-text-xs fm-text-muted">
                          {p.reason ?? '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// 헬퍼 함수
// ─────────────────────────────────────────

const STAT_KEY_LABELS: Record<string, string> = {
  early_game: '초반력',
  late_game: '후반력',
  teamfight: '한타',
  split_push: '스플릿',
  tier: '티어',
};

/** 역할군(tag)별 픽수/승률 집계 */
function computeRoleStrength(champStats: ChampStatRow[]) {
  const map = new Map<ChampionTag, { picks: number; wins: number }>();

  for (const row of champStats) {
    const champ = CHAMPION_DB.find((c) => c.id === row.champion_id);
    if (!champ) continue;

    for (const tag of champ.tags) {
      if (!ROLE_TAGS.includes(tag)) continue;
      const entry = map.get(tag) ?? { picks: 0, wins: 0 };
      entry.picks += row.pick_count;
      entry.wins += row.wins;
      map.set(tag, entry);
    }
  }

  return Array.from(map.entries())
    .map(([tag, data]) => ({
      tag,
      picks: data.picks,
      winRate: data.picks > 0 ? Math.round((data.wins / data.picks) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.picks - a.picks);
}

/** 팀 메타 적응도 계산 (간단 점수 0~100) */
function calculateTeamMetaFit(
  roster: Player[],
  meta: MetaModifier | null,
  champStats: ChampStatRow[],
): number {
  if (!roster || roster.length === 0) return 50;

  // 메타 기반 점수: 현재 인기 챔피언의 역할군과 선수 포지션 매칭
  const topChampIds = new Set(champStats.slice(0, 15).map((c) => c.champion_id));
  const topChamps = CHAMPION_DB.filter((c) => topChampIds.has(c.id));

  // 주전 5인 (starter 플래그가 있으면 사용, 아니면 앞 5명)
  const starters = roster.slice(0, 5);

  let matchScore = 0;
  for (const player of starters) {
    const pos = player.position;
    const metaChampForPos = topChamps.filter(
      (c) => c.primaryRole === pos || c.secondaryRoles.includes(pos),
    );
    // 해당 포지션에 메타 챔피언이 많으면 점수 높음
    matchScore += Math.min(metaChampForPos.length * 5, 20);
  }

  // 메타 효율 보정 반영
  let metaBonus = 0;
  if (meta) {
    const avgEff =
      (meta.teamfightEfficiency + meta.splitPushEfficiency +
        meta.earlyAggroEfficiency + meta.objectiveEfficiency) / 4;
    metaBonus = Math.round(avgEff * 100);
  }

  return Math.max(0, Math.min(100, matchScore + metaBonus));
}
