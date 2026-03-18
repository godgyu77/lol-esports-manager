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
}

export interface ManagerStats {
  tacticalKnowledge: number;   // 전술 지식 (1-20)
  motivation: number;          // 동기부여 (1-20)
  discipline: number;          // 규율 (1-20)
  adaptability: number;        // 적응력 (1-20)
  scoutingEye: number;         // 선구안 (1-20)
  mediaHandling: number;       // 미디어 대응 (1-20)
}

export const MANAGER_BG_LABELS: Record<ManagerBackground, string> = {
  ex_player: '전 프로 선수',
  analyst: '분석가 출신',
  rookie: '신인 감독',
  academy_coach: '아카데미 코치 출신',
};

export const MANAGER_BG_DESC: Record<ManagerBackground, string> = {
  ex_player: '높은 전술 지식과 명성. 규율은 낮은 편.',
  analyst: '균형잡힌 능력치. 스카우팅과 적응력이 강점.',
  rookie: '모든 능력치가 낮지만 성장 가능성이 높음.',
  academy_coach: '동기부여와 규율이 높음. 명성이 낮음.',
};

/** 배경별 초기 스탯 보정 */
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
  scoutingEye: '선구안',
  mediaHandling: '미디어 대응',
};
