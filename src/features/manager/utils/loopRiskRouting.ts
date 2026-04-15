export interface RoutedLoopRiskItem {
  title: string;
  summary: string;
  route: string;
  tone?: 'risk' | 'neutral' | 'positive';
}

export function getLoopRiskRoute(title: string, summary: string): string {
  const combined = `${title} ${summary}`;

  if (combined.includes('보드') || combined.includes('재정')) {
    return '/manager/finance';
  }

  if (combined.includes('국제전') || combined.includes('준비 체인')) {
    return '/manager/pre-match';
  }

  if (combined.includes('선수 불만')) {
    return '/manager/complaints';
  }

  if (combined.includes('케미스트리')) {
    return '/manager/roster';
  }

  return '/manager/day';
}

export function getLoopRiskActionLabel(title: string): string {
  if (title.includes('보드')) {
    return '보드 신뢰 점검';
  }

  if (title.includes('국제전')) {
    return '국제전 압박 점검';
  }

  if (title.includes('준비 체인')) {
    return '경기 준비 점검';
  }

  if (title.includes('선수 불만')) {
    return '선수 불만 점검';
  }

  if (title.includes('케미스트리')) {
    return '팀 케미스트리 점검';
  }

  if (title.includes('재정')) {
    return '재정 압박 점검';
  }

  return title;
}
