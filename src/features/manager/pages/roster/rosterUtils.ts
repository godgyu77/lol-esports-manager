import type { Player } from '../../../../types/player';
import type { PlayStyle } from '../../../../types/team';

export type Division = 'main' | 'sub';

export interface ChemistryRow {
  player_a_id: string;
  player_b_id: string;
  player_a_name: string;
  player_b_name: string;
  player_a_division?: Division;
  player_b_division?: Division;
  chemistry_score: number;
}

export interface SatisfactionRow {
  player_id: string;
  player_name: string;
  position: string;
  overall_satisfaction: number;
  playtime_satisfaction: number;
  salary_satisfaction: number;
  team_performance_satisfaction: number;
  personal_performance_satisfaction: number;
  role_clarity: number;
  team_chemistry_satisfaction: number;
}

export const PLAY_STYLE_INFO: Record<PlayStyle, {
  name: string;
  icon: string;
  description: string;
  matchup: string;
}> = {
  aggressive: {
    name: '공격형',
    icon: '\u2694\uFE0F',
    description: '적극적인 교전과 솔로킬로 초반 주도권 확보',
    matchup: '\u25B6 스플릿에 강함 | \u25C0 운영형에 약함',
  },
  controlled: {
    name: '운영형',
    icon: '\uD83D\uDEE1\uFE0F',
    description: '안정적인 시야와 오브젝트 중심의 매크로 운영',
    matchup: '\u25B6 공격형에 강함 | \u25C0 스플릿에 약함',
  },
  split: {
    name: '스플릿',
    icon: '\uD83D\uDDE1\uFE0F',
    description: '사이드 라인 압박으로 맵 주도권 분산',
    matchup: '\u25B6 운영형에 강함 | \u25C0 공격형에 약함',
  },
};

export const POSITION_ORDER = ['top', 'jungle', 'mid', 'adc', 'support'];

export const POSITION_BADGE_MAP: Record<string, string> = {
  top: 'top',
  jungle: 'jgl',
  mid: 'mid',
  adc: 'adc',
  support: 'sup',
};

export const SATISFACTION_LABELS: Record<string, string> = {
  playtime_satisfaction: '출전 시간',
  salary_satisfaction: '연봉',
  team_performance_satisfaction: '팀 성적',
  personal_performance_satisfaction: '개인 성적',
  role_clarity: '역할 명확도',
  team_chemistry_satisfaction: '팀 케미',
};

export function sortByPosition<T extends { position: string }>(arr: T[]): T[] {
  return [...arr].sort(
    (a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position),
  );
}

export function getOvr(player: Player): number {
  const s = player.stats;
  return Math.round(
    (s.mechanical + s.gameSense + s.teamwork + s.consistency + s.laning + s.aggression) / 6,
  );
}

export function getOvrClass(ovr: number): string {
  if (ovr >= 90) return 'fm-ovr fm-ovr--elite';
  if (ovr >= 80) return 'fm-ovr fm-ovr--high';
  if (ovr >= 70) return 'fm-ovr fm-ovr--mid';
  return 'fm-ovr fm-ovr--low';
}

export function getChemistryColor(score: number): string {
  if (score >= 80) return '#50c878';
  if (score >= 50) return '#f0c040';
  if (score >= 30) return '#e8922d';
  return '#dc3c3c';
}

export function getSatisfactionColor(value: number): string {
  if (value >= 70) return '#50c878';
  if (value >= 40) return '#f0c040';
  return '#dc3c3c';
}

export function getBarFillClass(value: number): string {
  if (value >= 70) return 'fm-bar__fill fm-bar__fill--green';
  if (value >= 40) return 'fm-bar__fill fm-bar__fill--yellow';
  return 'fm-bar__fill fm-bar__fill--red';
}
