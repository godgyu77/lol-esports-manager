import type { Position } from './game';

export interface Champion {
  id: string;
  name: string;
  nameKo: string;
  positions: Position[];  // 주 포지션 (복수 가능)
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  tags: ChampionTag[];
  stats: ChampionStats;
}

export type ChampionTag =
  | 'assassin'
  | 'fighter'
  | 'mage'
  | 'marksman'
  | 'support'
  | 'tank'
  | 'engage'
  | 'poke'
  | 'splitpush'
  | 'teamfight';

export interface ChampionStats {
  earlyGame: number;   // 초반력 (0-100)
  lateGame: number;    // 후반력
  teamfight: number;   // 한타 기여도
  splitPush: number;   // 스플릿 능력
  difficulty: number;  // 조작 난이도
}

// 챔피언 간 상성
export interface ChampionSynergy {
  championA: string;
  championB: string;
  synergy: number; // -100(카운터) ~ +100(시너지)
}
