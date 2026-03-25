/**
 * 금액을 한국식 단위(만/억)로 포맷한다.
 * 10000 이상이면 억 단위, 미만이면 만 단위로 표시.
 */
export function formatAmount(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}억`;
  }
  return `${value.toLocaleString()}만`;
}
