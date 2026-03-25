/**
 * 시드 기반 전역 RNG + 배열 랜덤 유틸
 * - 게임 시작/로드 시 initGlobalRng(seed)로 초기화
 * - 모든 엔진 모듈은 이 파일의 래퍼 함수를 사용
 */

import { createRng } from './rng';

// ─────────────────────────────────────────
// 전역 RNG 상태
// ─────────────────────────────────────────

let _globalRng: (() => number) | null = null;
let _baseSeed = '';

/** 전역 RNG 초기화 (게임 시작/로드/일간 진행 시 호출) */
export function initGlobalRng(seed: string): void {
  _baseSeed = seed;
  _globalRng = createRng(seed);
}

/** 현재 base seed 반환 (저장 시 사용) */
export function getBaseSeed(): string {
  return _baseSeed;
}

/** Math.random() 대체 — 0 이상 1 미만 난수 */
export function nextRandom(): number {
  if (!_globalRng) {
    console.warn('[RNG] initGlobalRng 미호출 — Math.random() 폴백');
    return Math.random();
  }
  return _globalRng();
}

// ─────────────────────────────────────────
// 래퍼 함수
// ─────────────────────────────────────────

/** 배열에서 랜덤 1개 선택. 빈 배열이면 throw */
export function pickRandom<T>(arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pickRandom: empty array');
  return arr[Math.floor(nextRandom() * arr.length)]!;
}

/** 배열에서 랜덤 N개 선택 (중복 없이, Fisher-Yates 셔플) */
export function pickRandomN<T>(arr: readonly T[], n: number): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

/** min 이상 max 이하 랜덤 정수 */
export function randomInt(min: number, max: number): number {
  return Math.floor(nextRandom() * (max - min + 1)) + min;
}

/** 배열 셔플 (Fisher-Yates) — 원본 변경 없이 새 배열 반환 */
export function shuffleArray<T>(arr: readonly T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** min 이상 max 미만 랜덤 실수 */
export function randomFloat(min: number, max: number): number {
  return nextRandom() * (max - min) + min;
}
