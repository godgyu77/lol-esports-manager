/**
 * 게임 내부 금액 단위를 화면에서는 모두 "억" 기준으로 통일해서 보여준다.
 * DB와 엔진의 숫자는 1 = 1만 원 단위가 섞여 있으므로, 표시는 억 단위로 변환한다.
 */
export function formatAmount(value: number): string {
  const absValue = Math.abs(value);
  const amountInEok = value / 10000;
  const fractionDigits = absValue >= 100000 ? 1 : 2;

  return `${amountInEok.toLocaleString('ko-KR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}억`;
}
