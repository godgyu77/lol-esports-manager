export type ManagerBackground = 'ex_player' | 'analyst' | 'rookie' | 'academy_coach';

export interface ManagerProfile {
  id: number;
  saveId: number | null;
  name: string;
  nationality: string;
  age: number;
  background: ManagerBackground;
  stats: ManagerStats;
  reputation: number;
  philosophy: ManagerPhilosophy;
}

export interface ManagerStats {
  tacticalKnowledge: number;
  motivation: number;
  discipline: number;
  adaptability: number;
  scoutingEye: number;
  mediaHandling: number;
}

export interface ManagerPhilosophy {
  playerCare: number;
  tacticalFocus: number;
  resultDriven: number;
  mediaFriendly: number;
}

export const MANAGER_BG_LABELS: Record<ManagerBackground, string> = {
  ex_player: '전 프로 선수',
  analyst: '분석가 출신',
  rookie: '신인 감독',
  academy_coach: '아카데미 코치 출신',
};

export const MANAGER_BG_DESC: Record<ManagerBackground, string> = {
  ex_player: '높은 경기 감각과 초반 명성이 강점입니다. 선수단 장악력이 좋습니다.',
  analyst: '전술 준비와 적응력, 스카우팅 시야가 두드러지는 유형입니다.',
  rookie: '모든 능력치는 평범하지만 장기적인 성장 가능성이 높습니다.',
  academy_coach: '동기부여와 규율 관리가 강점이며 어린 선수 육성에 잘 맞습니다.',
};

export const MANAGER_BG_STATS: Record<ManagerBackground, { stats: ManagerStats; reputation: number }> = {
  ex_player: {
    stats: { tacticalKnowledge: 15, motivation: 12, discipline: 8, adaptability: 11, scoutingEye: 10, mediaHandling: 14 },
    reputation: 55,
  },
  analyst: {
    stats: { tacticalKnowledge: 13, motivation: 10, discipline: 11, adaptability: 14, scoutingEye: 14, mediaHandling: 10 },
    reputation: 35,
  },
  rookie: {
    stats: { tacticalKnowledge: 8, motivation: 8, discipline: 8, adaptability: 8, scoutingEye: 8, mediaHandling: 8 },
    reputation: 15,
  },
  academy_coach: {
    stats: { tacticalKnowledge: 11, motivation: 15, discipline: 14, adaptability: 10, scoutingEye: 12, mediaHandling: 8 },
    reputation: 25,
  },
};

export const MANAGER_STAT_LABELS: Record<keyof ManagerStats, string> = {
  tacticalKnowledge: '전술 지식',
  motivation: '동기부여',
  discipline: '규율',
  adaptability: '적응력',
  scoutingEye: '스카우팅',
  mediaHandling: '미디어 대응',
};
