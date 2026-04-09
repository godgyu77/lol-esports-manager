import { DISPLAY_NAME_OVERRIDES } from '../data/displayNameMap';

const LATIN_NAME_PATTERN = /[A-Za-z]/;
const DIGIT_TO_KOREAN: Record<string, string> = {
  '0': '영',
  '1': '일',
  '2': '이',
  '3': '삼',
  '4': '사',
  '5': '오',
  '6': '육',
  '7': '칠',
  '8': '팔',
  '9': '구',
};

const LETTER_TO_KOREAN: Record<string, string> = {
  a: '에이',
  b: '비',
  c: '씨',
  d: '디',
  e: '이',
  f: '에프',
  g: '지',
  h: '에이치',
  i: '아이',
  j: '제이',
  k: '케이',
  l: '엘',
  m: '엠',
  n: '엔',
  o: '오',
  p: '피',
  q: '큐',
  r: '알',
  s: '에스',
  t: '티',
  u: '유',
  v: '브이',
  w: '더블유',
  x: '엑스',
  y: '와이',
  z: '지',
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeOverrideKey(name: string): string {
  return name.trim();
}

function spellToken(token: string): string {
  return [...token]
    .map((char) => {
      if (DIGIT_TO_KOREAN[char]) return DIGIT_TO_KOREAN[char];
      return LETTER_TO_KOREAN[char.toLowerCase()] ?? char;
    })
    .join('');
}

function transliterateFallback(name: string): string {
  return name
    .split(/(\s+|[-_/])/)
    .map((part) => {
      if (!part) return part;
      if (/^\s+$/.test(part)) return part;
      if (/^[-_/]$/.test(part)) return ' ';
      if (!LATIN_NAME_PATTERN.test(part) && !/\d/.test(part)) return part;
      return spellToken(part);
    })
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function getDisplayEntityName(name: string): string {
  const normalized = normalizeOverrideKey(name);
  if (!normalized) return normalized;
  const override = DISPLAY_NAME_OVERRIDES[normalized];
  if (override) return override;
  return transliterateFallback(normalized);
}

export const getDisplayPlayerName = getDisplayEntityName;
export const getDisplayStaffName = getDisplayEntityName;

export function localizeEntityNamesInText(text: string): string {
  if (!text || !LATIN_NAME_PATTERN.test(text)) return text;

  const entries = Object.entries(DISPLAY_NAME_OVERRIDES)
    .filter(([source]) => source && source !== 'VACANT')
    .sort((left, right) => right[0].length - left[0].length);

  let localized = text;
  for (const [source, target] of entries) {
    localized = localized.replace(new RegExp(escapeRegExp(source), 'g'), target);
  }

  return localized.replace(/[A-Za-z0-9][A-Za-z0-9\s'._-]*/g, (match) => {
    const trimmed = match.trim();
    if (!trimmed) return match;
    return getDisplayEntityName(trimmed);
  });
}
