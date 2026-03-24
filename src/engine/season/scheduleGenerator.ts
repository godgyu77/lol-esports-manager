/**
 * 리그 경기 스케줄 생성기
 * - 더블 라운드 로빈 (각 팀이 모든 팀과 홈/어웨이 1번씩)
 * - Circle method 알고리즘 사용
 * - 주당 경기 수를 균등 배분
 */

import type { Region } from '../../types';

export interface ScheduleMatch {
  week: number;
  homeTeamId: string;
  awayTeamId: string;
}

/**
 * 라운드 로빈 스케줄 생성 (Circle method)
 * N팀 → N-1 라운드, 각 라운드에 N/2 경기
 */
function generateRoundRobin(teamIds: string[]): { home: string; away: string }[][] {
  const teams = [...teamIds];

  // 홀수 팀이면 BYE를 추가
  if (teams.length % 2 !== 0) {
    teams.push('__BYE__');
  }

  const n = teams.length;
  const rounds: { home: string; away: string }[][] = [];

  // 첫 번째 팀을 고정하고 나머지를 회전
  const fixed = teams[0];
  const rotating = teams.slice(1);

  for (let round = 0; round < n - 1; round++) {
    const matches: { home: string; away: string }[] = [];

    // 고정 팀 vs 현재 첫 번째 회전 팀
    const opponent = rotating[0];
    if (fixed !== '__BYE__' && opponent !== '__BYE__') {
      // 홈/어웨이를 라운드 번호로 교대
      if (round % 2 === 0) {
        matches.push({ home: fixed, away: opponent });
      } else {
        matches.push({ home: opponent, away: fixed });
      }
    }

    // 나머지 팀들 짝짓기
    for (let i = 1; i < n / 2; i++) {
      const home = rotating[i];
      const away = rotating[n - 2 - i];
      if (home !== '__BYE__' && away !== '__BYE__') {
        matches.push({ home, away });
      }
    }

    rounds.push(matches);

    // 회전: 마지막 요소를 앞으로
    rotating.unshift(rotating.pop()!);
  }

  return rounds;
}

/**
 * 더블 라운드 로빈 생성
 * 1차: 정방향, 2차: 홈/어웨이 반전
 */
function generateDoubleRoundRobin(
  teamIds: string[],
): { home: string; away: string }[][] {
  const firstHalf = generateRoundRobin(teamIds);
  const secondHalf = firstHalf.map(round =>
    round.map(m => ({ home: m.away, away: m.home })),
  );
  return [...firstHalf, ...secondHalf];
}

/**
 * 라운드 → 주차 배분
 * 총 경기를 주당 matchesPerWeek로 균등 분배
 */
function assignWeeks(
  rounds: { home: string; away: string }[][],
  matchesPerWeek: number,
): ScheduleMatch[] {
  // 모든 경기를 평탄화
  const allMatches: { home: string; away: string }[] = [];
  for (const round of rounds) {
    allMatches.push(...round);
  }

  const schedule: ScheduleMatch[] = [];
  let week = 1;
  let weekCount = 0;

  for (const match of allMatches) {
    schedule.push({
      week,
      homeTeamId: match.home,
      awayTeamId: match.away,
    });
    weekCount++;

    if (weekCount >= matchesPerWeek) {
      week++;
      weekCount = 0;
    }
  }

  return schedule;
}

/**
 * 특정 리그의 시즌 스케줄 생성
 * @returns 주차별 경기 목록
 */
export function generateLeagueSchedule(
  _region: Region,
  teamIds: string[],
): ScheduleMatch[] {
  const rounds = generateDoubleRoundRobin(teamIds);

  // 총 경기 수
  const totalMatches = rounds.reduce((sum, r) => sum + r.length, 0);

  // 주당 경기 수: 총 경기를 18주 기준으로 배분 (조정 가능)
  const targetWeeks = 18;
  const matchesPerWeek = Math.ceil(totalMatches / targetWeeks);

  return assignWeeks(rounds, matchesPerWeek);
}

