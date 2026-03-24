/**
 * 배열 랜덤 유틸 (공통)
 * - pickRandom: 배열에서 랜덤 1개 선택
 * - pickRandomN: 배열에서 랜덤 N개 선택
 */

/** 배열에서 랜덤 1개 선택. 빈 배열이면 undefined 반환 */
export function pickRandom<T>(arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 배열에서 랜덤 N개 선택 (중복 없이) */
export function pickRandomN<T>(arr: readonly T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
