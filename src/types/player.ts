import type { Position } from './game';

export interface PlayerStats {
  mechanical: number;   // 기계적 숙련도
  gameSense: number;    // 게임 이해도
  teamwork: number;     // 팀워크
  consistency: number;  // 일관성
  laning: number;       // 라인전
  aggression: number;   // 공격성
}

export interface PlayerMental {
  mental: number;    // 멘탈 강도
  stamina: number;   // 체력
  morale: number;    // 사기
}

export interface PlayerContract {
  salary: number;
  contractEndSeason: number;
}

export interface ChampionProficiency {
  championId: string;
  proficiency: number; // 0-100
  gamesPlayed: number;
}

export interface Player {
  id: string;
  name: string;
  teamId: string | null;
  position: Position;
  age: number;
  nationality: string;
  stats: PlayerStats;
  mental: PlayerMental;
  contract: PlayerContract;
  championPool: ChampionProficiency[];
  potential: number;    // 잠재력 (0-100)
  peakAge: number;      // 최적 나이
  popularity: number;   // 인기도
}

// 선수 모드 전용 — 유저가 직접 만든 캐릭터
export type PlayerBackground = 'solorank' | 'academy' | 'overseas';

export interface Personality {
  competitiveness: number;  // 승부욕
  mentalStrength: number;   // 멘탈 강도
  sociability: number;      // 사교성
}

export interface DailySchedule {
  morning: 'solorank' | 'vod_review' | 'rest';
  afternoon: 'team_practice' | 'individual_training' | 'streaming';
  evening: 'team_dinner' | 'personal_time' | 'request_meeting';
}

export interface MyPlayer extends Player {
  isUserControlled: true;
  background: PlayerBackground;
  personality: Personality;
  schedule: DailySchedule;
  relationships: Record<string, number>; // playerId/coachId → 친밀도 (-100~100)
  fanPopularity: number;
  streamingIncome: number;
  careerGoals: string[];
}
