import type { Player } from '../types/player';

/**
 * 선수의 종합 능력치(OVR)를 계산한다.
 * 6개 스탯(mechanical, gameSense, teamwork, consistency, laning, aggression)의 평균.
 */
export function getPlayerOverall(player: Player): number {
  const s = player.stats;
  return (s.mechanical + s.gameSense + s.teamwork + s.consistency + s.laning + s.aggression) / 6;
}
