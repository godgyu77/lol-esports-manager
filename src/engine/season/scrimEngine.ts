/**
 * 스크림(연습경기) 엔진
 * - 상대 선택 + Bo3 시뮬레이션
 * - 전술/챔피언 테스트 결과 피드백
 * - 스크림 결과가 팀 전략 분석에 반영
 */

import { getDatabase } from '../../db/database';
import { getPlayersByTeamId } from '../../db/queries';
import { buildLineup, evaluateMatchup } from '../match/teamRating';
import { nextRandom, pickRandom, randomInt } from '../../utils/random';

export interface ScrimResult {
  opponentTeamId: string;
  opponentName: string;
  wins: number;
  losses: number;
  mvpPlayerName: string | null;
  /** 테스트한 전술 */
  testedStrategy?: string;
  /** 테스트한 챔피언 */
  testedChampions?: string[];
  /** 전술 피드백 */
  feedback: ScrimFeedback;
}

/** 스크림 피드백 기반 훈련 추천 */
export interface TrainingRecommendation {
  trainingType: string;
  intensity: 'light' | 'normal' | 'intense';
  reason: string;
}

/** 전술별 승률 기록 */
export interface StrategyRecord {
  strategy: string;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
}

/** 스크림 피드백 요약 (평균/트렌드) */
export interface ScrimFeedbackSummary {
  averageLaning: number;
  averageTeamfight: number;
  averageObjective: number;
  trend: 'improving' | 'stable' | 'declining';
}

/** 스크림 전술 피드백 */
export interface ScrimFeedback {
  /** 라인전 성과 (양수=유리, 음수=불리) */
  laningPerformance: number;
  /** 팀파이트 성과 */
  teamfightPerformance: number;
  /** 오브젝트 컨트롤 성과 */
  objectivePerformance: number;
  /** 총평 */
  summary: string;
}

/**
 * 스크림 시뮬레이션
 * 전술 테스트 / 챔피언 테스트 기능 포함
 */
export async function simulateScrim(
  teamId: string,
  currentDate: string,
  testedStrategy?: string,
  testedChampions?: string[],
): Promise<ScrimResult | null> {
  const db = await getDatabase();

  // 같은 리전 팀 중 랜덤 상대 선택
  const teamRows = await db.select<{ id: string; region: string }[]>(
    'SELECT id, region FROM teams WHERE id = $1',
    [teamId],
  );
  if (teamRows.length === 0) return null;
  const region = teamRows[0].region;

  const opponents = await db.select<{ id: string; name: string }[]>(
    'SELECT id, name FROM teams WHERE region = $1 AND id != $2',
    [region, teamId],
  );
  if (opponents.length === 0) return null;

  const opponent = pickRandom(opponents);

  // Bo3 시뮬
  const homePlayers = await getPlayersByTeamId(teamId);
  const awayPlayers = await getPlayersByTeamId(opponent.id);
  const homeLineup = buildLineup(homePlayers);
  const awayLineup = buildLineup(awayPlayers);

  if (!homeLineup || !awayLineup) return null;

  const matchup = evaluateMatchup(homeLineup, awayLineup);

  // 전술 테스트 보정: 새 전술은 성공률이 약간 낮음
  const strategyPenalty = testedStrategy ? 0.03 : 0;
  // 챔피언 테스트 보정: 새 챔피언은 숙련도가 낮으므로 불리
  const championPenalty = testedChampions && testedChampions.length > 0 ? 0.02 * testedChampions.length : 0;

  const adjustedWinRate = Math.max(0.2, matchup.homeWinRate - strategyPenalty - championPenalty);

  let wins = 0;
  let losses = 0;

  for (let i = 0; i < 3; i++) {
    const roll = nextRandom();
    if (roll < adjustedWinRate) wins++;
    else losses++;
    if (wins >= 2 || losses >= 2) break;
  }

  // MVP = 가장 높은 OVR 선수
  let mvpName: string | null = null;
  let maxOvr = 0;
  for (const p of homePlayers) {
    const ovr = (p.stats.mechanical + p.stats.gameSense + p.stats.teamwork + p.stats.consistency + p.stats.laning + p.stats.aggression) / 6;
    if (ovr > maxOvr) { maxOvr = ovr; mvpName = p.name; }
  }

  // 전술 피드백 생성
  const laningDiff = matchup.homeRating.laningPower - matchup.awayRating.laningPower;
  const teamfightDiff = matchup.homeRating.teamfightPower - matchup.awayRating.teamfightPower;
  const feedback = generateFeedback(wins, losses, laningDiff, teamfightDiff, testedStrategy);

  // 테스트한 챔피언의 숙련도 소량 증가
  if (testedChampions && testedChampions.length > 0) {
    for (const champId of testedChampions) {
      const profGain = randomInt(2, 4); // 2-4 숙련도
      try {
        // 모든 주전 선수에게 해당 챔피언 숙련도 증가 (실제로는 해당 포지션만)
        await db.execute(
          `UPDATE champion_proficiency SET proficiency = MIN(100, proficiency + $1)
           WHERE champion_id = $2 AND player_id IN (
             SELECT id FROM players WHERE team_id = $3 AND division = 'main'
           )`,
          [profGain, champId, teamId],
        );
      } catch { /* 무시 */ }
    }
  }

  // DB 저장
  const notes = [
    `vs ${opponent.name}`,
    testedStrategy ? `전술 테스트: ${testedStrategy}` : null,
    testedChampions?.length ? `챔피언 테스트: ${testedChampions.join(', ')}` : null,
  ].filter(Boolean).join(' | ');

  await db.execute(
    `INSERT INTO scrim_results (team_id, opponent_team_id, scrim_date, wins, losses, mvp_player_id, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [teamId, opponent.id, currentDate, wins, losses, null, notes],
  );

  return {
    opponentTeamId: opponent.id,
    opponentName: opponent.name,
    wins,
    losses,
    mvpPlayerName: mvpName,
    testedStrategy,
    testedChampions,
    feedback,
  };
}

/**
 * 스크림 결과 기반 피드백 생성
 */
function generateFeedback(
  wins: number,
  losses: number,
  laningDiff: number,
  teamfightDiff: number,
  testedStrategy?: string,
): ScrimFeedback {
  const laningPerf = Math.round(laningDiff + (nextRandom() - 0.5) * 10);
  const teamfightPerf = Math.round(teamfightDiff + (nextRandom() - 0.5) * 10);
  const objectivePerf = Math.round((wins - losses) * 15 + (nextRandom() - 0.5) * 10);

  const summaryParts: string[] = [];

  if (wins > losses) {
    summaryParts.push('전반적으로 좋은 스크림이었습니다.');
  } else if (wins < losses) {
    summaryParts.push('보완할 점이 보이는 스크림이었습니다.');
  } else {
    summaryParts.push('접전이었습니다.');
  }

  if (laningPerf > 5) summaryParts.push('라인전이 강점입니다.');
  else if (laningPerf < -5) summaryParts.push('라인전 개선이 필요합니다.');

  if (teamfightPerf > 5) summaryParts.push('팀파이트 운영이 좋았습니다.');
  else if (teamfightPerf < -5) summaryParts.push('팀파이트 연습이 더 필요합니다.');

  if (testedStrategy) {
    const strategyResult = wins > losses ? '효과적' : '추가 연습 필요';
    summaryParts.push(`${testedStrategy} 전술: ${strategyResult}.`);
  }

  return {
    laningPerformance: laningPerf,
    teamfightPerformance: teamfightPerf,
    objectivePerformance: objectivePerf,
    summary: summaryParts.join(' '),
  };
}

export async function getRecentScrims(teamId: string, limit = 10): Promise<ScrimResult[]> {
  const db = await getDatabase();
  const rows = await db.select<{
    opponent_team_id: string; opponent_name: string; wins: number; losses: number; notes: string | null;
  }[]>(
    `SELECT sr.*, t.name as opponent_name FROM scrim_results sr
     JOIN teams t ON t.id = sr.opponent_team_id
     WHERE sr.team_id = $1 ORDER BY sr.scrim_date DESC LIMIT $2`,
    [teamId, limit],
  );
  return rows.map(r => ({
    opponentTeamId: r.opponent_team_id,
    opponentName: r.opponent_name,
    wins: r.wins,
    losses: r.losses,
    mvpPlayerName: null,
    feedback: {
      laningPerformance: 0,
      teamfightPerformance: 0,
      objectivePerformance: 0,
      summary: r.notes ?? '',
    },
  }));
}

// ─────────────────────────────────────────
// 스크림 → 훈련 피드백 루프
// ─────────────────────────────────────────

/**
 * 스크림 피드백 기반 훈련 추천
 * 약점 영역을 식별하여 적절한 훈련 유형과 강도를 추천한다.
 */
export function getTrainingRecommendation(feedback: ScrimFeedback): TrainingRecommendation {
  const weaknesses: { type: string; score: number }[] = [];

  if (feedback.laningPerformance < -5) {
    weaknesses.push({ type: 'laning', score: feedback.laningPerformance });
  }
  if (feedback.teamfightPerformance < -5) {
    weaknesses.push({ type: 'teamfight', score: feedback.teamfightPerformance });
  }
  if (feedback.objectivePerformance < -5) {
    weaknesses.push({ type: 'macro', score: feedback.objectivePerformance });
  }

  // 약점이 없으면 가벼운 일반 훈련
  if (weaknesses.length === 0) {
    return {
      trainingType: 'general',
      intensity: 'light',
      reason: '전체적으로 양호한 성과입니다. 기본 유지 훈련을 추천합니다.',
    };
  }

  // 가장 심각한 약점을 우선 훈련
  weaknesses.sort((a, b) => a.score - b.score);
  const worst = weaknesses[0];

  const intensity: TrainingRecommendation['intensity'] = worst.score < -15 ? 'intense' : 'normal';

  const reasonMap: Record<string, string> = {
    laning: `라인전 성과가 ${worst.score}점으로 부진합니다. 집중 라인전 훈련을 추천합니다.`,
    teamfight: `팀파이트 성과가 ${worst.score}점으로 부진합니다. 팀파이트 훈련을 추천합니다.`,
    macro: `오브젝트 컨트롤이 ${worst.score}점으로 부진합니다. 매크로 훈련을 추천합니다.`,
  };

  return {
    trainingType: worst.type,
    intensity,
    reason: reasonMap[worst.type] ?? '약점 보완 훈련을 추천합니다.',
  };
}

/**
 * 전술별 승률 기록 조회
 * notes 필드에서 '전술 테스트: {strategy}' 패턴을 파싱하여 집계한다.
 */
export async function getScrimStrategyRecord(teamId: string): Promise<StrategyRecord[]> {
  const db = await getDatabase();

  try {
    const rows = await db.select<{ notes: string; wins: number; losses: number }[]>(
      `SELECT notes, wins, losses FROM scrim_results
       WHERE team_id = $1 AND notes LIKE '%전술 테스트:%'
       ORDER BY scrim_date DESC`,
      [teamId],
    );

    const strategyMap = new Map<string, { wins: number; losses: number }>();

    for (const row of rows) {
      const match = row.notes.match(/전술 테스트:\s*([^|]+)/);
      if (!match) continue;

      const strategy = match[1].trim();
      const existing = strategyMap.get(strategy) ?? { wins: 0, losses: 0 };
      existing.wins += row.wins;
      existing.losses += row.losses;
      strategyMap.set(strategy, existing);
    }

    const records: StrategyRecord[] = [];
    for (const [strategy, data] of strategyMap) {
      const totalGames = data.wins + data.losses;
      records.push({
        strategy,
        totalGames,
        wins: data.wins,
        losses: data.losses,
        winRate: totalGames > 0 ? Math.round((data.wins / totalGames) * 100) / 100 : 0,
      });
    }

    // 승률 내림차순 정렬
    records.sort((a, b) => b.winRate - a.winRate);
    return records;
  } catch {
    return [];
  }
}

/**
 * 최근 스크림 피드백 평균 및 트렌드 산출
 * 최근 3경기 vs 이전 3경기 평균을 비교하여 트렌드를 판정한다.
 */
export async function getScrimFeedbackHistory(
  teamId: string,
  limit = 10,
): Promise<ScrimFeedbackSummary> {
  const db = await getDatabase();

  const defaultSummary: ScrimFeedbackSummary = {
    averageLaning: 0,
    averageTeamfight: 0,
    averageObjective: 0,
    trend: 'stable',
  };

  try {
    const rows = await db.select<{
      laning_feedback: number;
      teamfight_feedback: number;
      objective_feedback: number;
    }[]>(
      `SELECT laning_feedback, teamfight_feedback, objective_feedback
       FROM scrim_results
       WHERE team_id = $1
       ORDER BY scrim_date DESC
       LIMIT $2`,
      [teamId, limit],
    );

    if (rows.length === 0) return defaultSummary;

    // 전체 평균
    let totalLaning = 0;
    let totalTeamfight = 0;
    let totalObjective = 0;

    for (const row of rows) {
      totalLaning += row.laning_feedback ?? 0;
      totalTeamfight += row.teamfight_feedback ?? 0;
      totalObjective += row.objective_feedback ?? 0;
    }

    const count = rows.length;
    const averageLaning = Math.round((totalLaning / count) * 100) / 100;
    const averageTeamfight = Math.round((totalTeamfight / count) * 100) / 100;
    const averageObjective = Math.round((totalObjective / count) * 100) / 100;

    // 트렌드 판정: 최근 3경기 vs 이전 3경기
    let trend: ScrimFeedbackSummary['trend'] = 'stable';

    if (rows.length >= 6) {
      const recent3 = rows.slice(0, 3);
      const prev3 = rows.slice(3, 6);

      const recentAvg = recent3.reduce(
        (sum, r) => sum + (r.laning_feedback ?? 0) + (r.teamfight_feedback ?? 0) + (r.objective_feedback ?? 0),
        0,
      ) / (recent3.length * 3);

      const prevAvg = prev3.reduce(
        (sum, r) => sum + (r.laning_feedback ?? 0) + (r.teamfight_feedback ?? 0) + (r.objective_feedback ?? 0),
        0,
      ) / (prev3.length * 3);

      const diff = recentAvg - prevAvg;
      if (diff > 2) trend = 'improving';
      else if (diff < -2) trend = 'declining';
    }

    return { averageLaning, averageTeamfight, averageObjective, trend };
  } catch {
    return defaultSummary;
  }
}
