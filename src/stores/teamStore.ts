/**
 * 팀 데이터 캐시 Store
 * - 팀 재정, 시설, 케미스트리 등 자주 조회되는 데이터 캐싱
 * - 일간 진행(dayAdvancer) 후 invalidate하여 최신 상태 유지
 */

import { create } from 'zustand';

export interface TeamFinanceSummary {
  teamId: string;
  budget: number;
  totalSalary: number;
  weeklyIncome: number;
  weeklyExpense: number;
}

export interface TeamChemistrySummary {
  teamId: string;
  averageChemistry: number;
  hotPairsCount: number;
  coldPairsCount: number;
}

interface TeamStoreState {
  /** 팀 재정 요약 캐시 */
  financeCache: Map<string, TeamFinanceSummary>;

  /** 팀 케미스트리 요약 캐시 */
  chemistryCache: Map<string, TeamChemistrySummary>;

  /** 라커룸 분위기 캐시 */
  lockerRoomMood: Map<string, string>;

  /** 마지막 갱신 시각 */
  lastUpdated: number;

  // 액션
  setFinance: (teamId: string, data: TeamFinanceSummary) => void;
  setChemistry: (teamId: string, data: TeamChemistrySummary) => void;
  setLockerRoomMood: (teamId: string, mood: string) => void;
  getFinance: (teamId: string) => TeamFinanceSummary | undefined;
  getChemistry: (teamId: string) => TeamChemistrySummary | undefined;
  invalidateTeam: (teamId: string) => void;
  invalidateAll: () => void;
}

export const useTeamStore = create<TeamStoreState>((set, get) => ({
  financeCache: new Map(),
  chemistryCache: new Map(),
  lockerRoomMood: new Map(),
  lastUpdated: 0,

  setFinance: (teamId, data) => {
    set(state => {
      const newMap = new Map(state.financeCache);
      newMap.set(teamId, data);
      return { financeCache: newMap, lastUpdated: Date.now() };
    });
  },

  setChemistry: (teamId, data) => {
    set(state => {
      const newMap = new Map(state.chemistryCache);
      newMap.set(teamId, data);
      return { chemistryCache: newMap, lastUpdated: Date.now() };
    });
  },

  setLockerRoomMood: (teamId, mood) => {
    set(state => {
      const newMap = new Map(state.lockerRoomMood);
      newMap.set(teamId, mood);
      return { lockerRoomMood: newMap };
    });
  },

  getFinance: (teamId) => get().financeCache.get(teamId),

  getChemistry: (teamId) => get().chemistryCache.get(teamId),

  invalidateTeam: (teamId) => {
    set(state => {
      const f = new Map(state.financeCache);
      f.delete(teamId);
      const c = new Map(state.chemistryCache);
      c.delete(teamId);
      const l = new Map(state.lockerRoomMood);
      l.delete(teamId);
      return { financeCache: f, chemistryCache: c, lockerRoomMood: l };
    });
  },

  invalidateAll: () => {
    set({
      financeCache: new Map(),
      chemistryCache: new Map(),
      lockerRoomMood: new Map(),
      lastUpdated: 0,
    });
  },
}));
