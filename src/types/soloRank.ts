/** 솔로랭크 티어 */
export type SoloRankTier =
  | 'challenger' | 'grandmaster' | 'master'
  | 'diamond' | 'emerald' | 'platinum';

/** 선수 솔로랭크 상태 */
export interface PlayerSoloRank {
  playerId: string;
  tier: SoloRankTier;
  lp: number;           // 0-1500 (챌린저 기준)
  /** 최근 20게임 승률 */
  recentWinRate: number;
  /** 솔로랭크에서 연습 중인 챔피언 (챔피언풀 확장용) */
  practiceChampionId?: string;
  /** 오늘 플레이한 게임 수 */
  gamesPlayedToday: number;
  /** 솔로랭크 순위 (지역 내) */
  rank: number;
}

/** 솔로랭크 시뮬 결과 (일간) */
export interface SoloRankDayResult {
  playerId: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  lpChange: number;
  tierChanged: boolean;
  newTier?: SoloRankTier;
  /** 챔피언풀 확장 이벤트 */
  championPoolExpansion?: {
    championId: string;
    proficiencyGain: number;
  };
  /** 컨디션 영향 */
  staminaCost: number;
  formBonus: number;
}
