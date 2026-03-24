/** 포지션별 챔피언 픽 빈도 */
export interface PositionChampionPicks {
  position: string;
  champions: { championId: string; pickCount: number }[];
}

/** 상대팀 전략 패턴 분석 */
export interface OpponentPatterns {
  /** 포지션별 최다 픽 챔피언 */
  mostPickedByPosition: PositionChampionPicks[];
  /** 전략별 승률 (earlyAggro vs lateScale) */
  strategyWinRates: {
    earlyAggro: { wins: number; total: number; rate: number };
    lateScale: { wins: number; total: number; rate: number };
  };
  /** 평균 경기 시간 (분) */
  averageGameDuration: number;
  /** 퍼스트 블러드 획득률 */
  firstBloodRate: number;
}

/** 상대팀 약점 분석 */
export interface OpponentWeaknesses {
  /** KDA가 가장 낮은 포지션 */
  worstKdaPosition: string | null;
  /** 갱킹 사망이 가장 많은 포지션 (deaths 기준) */
  mostGankedPosition: string | null;
  /** 초반/후반 중 더 많이 지는 시점 */
  weakPhase: 'early' | 'late' | 'balanced';
  /** 포지션별 KDA 목록 */
  positionKda: { position: string; kda: number }[];
}

export interface MatchAnalysisReport {
  id: number;
  teamId: string;
  opponentTeamId: string;
  accuracy: number;
  recentWins: number;
  recentLosses: number;
  playStyle: string | null;
  keyPlayerId: string | null;
  weakPosition: string | null;
  recommendedBans: string[];
  generatedDate: string;
  /** 상대팀 패턴 분석 (정확도 65+ 시 제공) */
  opponentPatterns: OpponentPatterns | null;
  /** 상대팀 약점 분석 (정확도 75+ 시 제공) */
  opponentWeaknesses: OpponentWeaknesses | null;
}
