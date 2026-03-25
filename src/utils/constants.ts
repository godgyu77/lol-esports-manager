import type { Position } from '../types/game';

/** 포지션 한글 라벨 (탑, 정글, 미드, 원딜, 서포터) */
export const POSITION_LABELS_KR: Record<Position, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: '원딜',
  support: '서포터',
};

/** 포지션 영문 약어 라벨 (TOP, JGL, MID, ADC, SUP) */
export const POSITION_LABELS_SHORT: Record<string, string> = {
  top: 'TOP',
  jungle: 'JGL',
  mid: 'MID',
  adc: 'ADC',
  support: 'SUP',
};
