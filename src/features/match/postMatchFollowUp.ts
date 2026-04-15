import type { MatchInsightFollowUp } from '../../engine/analysis/postMatchInsightEngine';

const FOLLOW_UP_PRIORITY_ORDER = {
  high: 3,
  medium: 2,
  low: 1,
} as const;

export function getFollowUpRoute(action: string): string {
  switch (action) {
    case '전술 재검토':
      return '/manager/tactics';
    case '훈련 조정':
      return '/manager/training';
    case '선수 컨디션 관리':
      return '/manager/roster';
    case '드래프트 우선순위 재점검':
      return '/manager/draft';
    case '로스터 변경 검토':
      return '/manager/roster';
    default:
      return '/manager/day';
  }
}

export function getPrimaryFollowUp(followUps: MatchInsightFollowUp[]): MatchInsightFollowUp | null {
  return [...followUps].sort((left, right) => FOLLOW_UP_PRIORITY_ORDER[right.priority] - FOLLOW_UP_PRIORITY_ORDER[left.priority])[0] ?? null;
}

export function buildFollowUpNewsParagraph(action: string, summary: string): string {
  return `다음 권장 행동은 ${action}입니다. ${summary}`;
}
