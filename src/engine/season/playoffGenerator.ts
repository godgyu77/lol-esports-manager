/**
 * 플레이오프 브래킷 생성기
 * - 정규시즌 순위 상위 6팀 진출
 * - 1~2시드: 준결승 직행
 * - 3~6시드: 8강전 (3v6, 4v5)
 * - 준결승: 1시드 vs 4v5 승자, 2시드 vs 3v6 승자
 * - 결승: Bo5
 */

import type { MatchType } from '../../types/match';
import { insertMatch, getMatchById, getStandings } from '../../db/queries';
import { addDays } from './calendar';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export interface PlayoffMatch {
  id: string;
  matchType: MatchType;
  boFormat: 'Bo3' | 'Bo5';
  homeTeamId: string;
  awayTeamId: string;
  matchDate: string;
  week: number;
}

export interface PlayoffBracket {
  /** 8강 경기 (2경기) */
  quarters: PlayoffMatch[];
  /** 준결승 경기 (2경기) — 홈팀은 확정, 어웨이는 8강 승자로 결정 */
  semis: { match: PlayoffMatch; awayFrom: 'quarter1' | 'quarter2' }[];
  /** 결승 (1경기) — 양쪽 모두 준결승 승자 */
  finals: PlayoffMatch | null;
}

// ─────────────────────────────────────────
// 플레이오프 생성
// ─────────────────────────────────────────

/**
 * 정규시즌 순위 기반 플레이오프 스케줄 생성 및 DB 저장
 * @param seasonId 시즌 ID
 * @param standings 정규시즌 순위 (상위 6팀)
 * @param startDate 플레이오프 시작일
 * @returns 8강 매치 ID 목록
 */
export async function generatePlayoffSchedule(
  seasonId: number,
  standings: { teamId: string }[],
  startDate: string,
): Promise<string[]> {
  const top6 = standings.slice(0, 6);
  if (top6.length < 6) return [];

  const seed1 = top6[0].teamId;
  const seed2 = top6[1].teamId;
  const seed3 = top6[2].teamId;
  const seed4 = top6[3].teamId;
  const seed5 = top6[4].teamId;
  const seed6 = top6[5].teamId;

  const matchIds: string[] = [];

  // ── 8강 (Bo3) ──
  // 경기 1: 3시드 vs 6시드
  const q1Id = `playoff_s${seasonId}_q1`;
  const q1Date = startDate;
  await insertMatch({
    id: q1Id,
    seasonId,
    week: 99, // 플레이오프 주차
    teamHomeId: seed3,
    teamAwayId: seed6,
    matchDate: q1Date,
    matchType: 'playoff_quarters',
    boFormat: 'Bo3',
  });
  matchIds.push(q1Id);

  // 경기 2: 4시드 vs 5시드
  const q2Id = `playoff_s${seasonId}_q2`;
  const q2Date = addDays(startDate, 1);
  await insertMatch({
    id: q2Id,
    seasonId,
    week: 99,
    teamHomeId: seed4,
    teamAwayId: seed5,
    matchDate: q2Date,
    matchType: 'playoff_quarters',
    boFormat: 'Bo3',
  });
  matchIds.push(q2Id);

  // ── 준결승 (Bo5) — 8강 결과 후 생성 ──
  // 1시드 vs (4v5 승자), 2시드 vs (3v6 승자)
  // → advancePlayoff()에서 생성

  return matchIds;
}

/**
 * 플레이오프 라운드 진행
 * 8강 결과가 나오면 준결승 생성, 준결승 결과가 나오면 결승 생성
 * @param seasonId 시즌 ID
 * @param completedMatchId 방금 완료된 경기 ID
 * @param winnerTeamId 승리 팀 ID
 * @param standings 정규시즌 순위 (시드 확인용)
 * @param playoffStartDate 플레이오프 시작일
 */
export async function advancePlayoff(
  seasonId: number,
  completedMatchId: string,
  winnerTeamId: string,
  standings: { teamId: string }[],
  playoffStartDate: string,
): Promise<{ nextMatchId?: string; isPlayoffComplete: boolean }> {
  const seed1 = standings[0].teamId;
  const seed2 = standings[1].teamId;

  // 8강 1경기 완료 → 준결승 2 생성 (2시드 vs 3v6 승자)
  if (completedMatchId === `playoff_s${seasonId}_q1`) {
    const sf2Id = `playoff_s${seasonId}_sf2`;
    const sf2Date = addDays(playoffStartDate, 5);
    await insertMatch({
      id: sf2Id,
      seasonId,
      week: 100,
      teamHomeId: seed2,
      teamAwayId: winnerTeamId,
      matchDate: sf2Date,
      matchType: 'playoff_semis',
      boFormat: 'Bo5',
    });
    return { nextMatchId: sf2Id, isPlayoffComplete: false };
  }

  // 8강 2경기 완료 → 준결승 1 생성 (1시드 vs 4v5 승자)
  if (completedMatchId === `playoff_s${seasonId}_q2`) {
    const sf1Id = `playoff_s${seasonId}_sf1`;
    const sf1Date = addDays(playoffStartDate, 4);
    await insertMatch({
      id: sf1Id,
      seasonId,
      week: 100,
      teamHomeId: seed1,
      teamAwayId: winnerTeamId,
      matchDate: sf1Date,
      matchType: 'playoff_semis',
      boFormat: 'Bo5',
    });
    return { nextMatchId: sf1Id, isPlayoffComplete: false };
  }

  // 준결승 1 완료 → 결승 후보 저장 (결승은 양 쪽 모두 완료 후 생성)
  if (completedMatchId === `playoff_s${seasonId}_sf1`) {
    // sf2가 완료됐는지 확인은 외부에서 처리
    return { isPlayoffComplete: false };
  }

  // 준결승 2 완료 → 결승 후보 저장
  if (completedMatchId === `playoff_s${seasonId}_sf2`) {
    return { isPlayoffComplete: false };
  }

  // 결승 완료
  if (completedMatchId === `playoff_s${seasonId}_final`) {
    return { isPlayoffComplete: true };
  }

  return { isPlayoffComplete: false };
}

/**
 * 준결승 양쪽 모두 완료 시 결승 생성
 */
export async function generateFinals(
  seasonId: number,
  sf1WinnerTeamId: string,
  sf2WinnerTeamId: string,
  playoffStartDate: string,
): Promise<string> {
  const finalId = `playoff_s${seasonId}_final`;
  const finalDate = addDays(playoffStartDate, 9);

  await insertMatch({
    id: finalId,
    seasonId,
    week: 101,
    teamHomeId: sf1WinnerTeamId,
    teamAwayId: sf2WinnerTeamId,
    matchDate: finalDate,
    matchType: 'playoff_finals',
    boFormat: 'Bo5',
  });

  return finalId;
}

// ─────────────────────────────────────────
// 플레이오프 경기 결과 통합 처리
// ─────────────────────────────────────────

/**
 * 플레이오프 경기 결과 후 다음 라운드 자동 진행
 * dayAdvancer와 LiveMatchView 양쪽에서 호출
 *
 * @returns isPlayoffComplete — true이면 전체 플레이오프 종료
 */
export async function processPlayoffMatchResult(
  seasonId: number,
  completedMatchId: string,
  winnerTeamId: string,
): Promise<{ isPlayoffComplete: boolean; championTeamId?: string }> {
  // 정규시즌 순위 조회 (시드 확인용)
  const standings = await getStandings(seasonId);

  // 플레이오프 시작일: 8강 1경기 날짜에서 추출
  const q1Match = await getMatchById(`playoff_s${seasonId}_q1`);
  const playoffStartDate = q1Match?.matchDate ?? '';

  const result = await advancePlayoff(
    seasonId, completedMatchId, winnerTeamId, standings, playoffStartDate,
  );

  if (result.isPlayoffComplete) {
    return { isPlayoffComplete: true, championTeamId: winnerTeamId };
  }

  // 준결승 완료 체크 → 양쪽 모두 완료 시 결승 생성
  const sf1Id = `playoff_s${seasonId}_sf1`;
  const sf2Id = `playoff_s${seasonId}_sf2`;

  if (completedMatchId === sf1Id || completedMatchId === sf2Id) {
    const sf1 = await getMatchById(sf1Id);
    const sf2 = await getMatchById(sf2Id);

    // 양쪽 준결승 모두 완료 확인
    if (sf1?.isPlayed && sf2?.isPlayed) {
      const sf1Winner = sf1.scoreHome > sf1.scoreAway ? sf1.teamHomeId : sf1.teamAwayId;
      const sf2Winner = sf2.scoreHome > sf2.scoreAway ? sf2.teamHomeId : sf2.teamAwayId;
      await generateFinals(seasonId, sf1Winner, sf2Winner, playoffStartDate);
    }
  }

  return { isPlayoffComplete: false };
}
