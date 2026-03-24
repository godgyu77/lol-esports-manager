/**
 * 선수 데이터 캐시 Store
 * - 자주 조회되는 선수 데이터를 클라이언트에 캐싱
 * - DB 직접 쿼리 횟수를 줄이고 UI 반응성 향상
 */

import { create } from 'zustand';
import type { Player } from '../types/player';
import type { PlayerSatisfaction } from '../engine/satisfaction/playerSatisfactionEngine';

interface PlayerStoreState {
  /** 팀별 선수 목록 캐시 */
  playersByTeam: Map<string, Player[]>;

  /** 개별 선수 상세 캐시 */
  playerCache: Map<string, Player>;

  /** 팀별 만족도 캐시 */
  satisfactionByTeam: Map<string, PlayerSatisfaction[]>;

  /** 마지막 갱신 시각 */
  lastUpdated: number;

  /** 캐시 유효 시간 (ms) — 30초 */
  cacheTTL: number;

  // 액션
  setTeamPlayers: (teamId: string, players: Player[]) => void;
  setPlayer: (player: Player) => void;
  setTeamSatisfaction: (teamId: string, data: PlayerSatisfaction[]) => void;
  getTeamPlayers: (teamId: string) => Player[] | undefined;
  getPlayer: (playerId: string) => Player | undefined;
  invalidateTeam: (teamId: string) => void;
  invalidateAll: () => void;
  isCacheValid: () => boolean;
}

export const usePlayerStore = create<PlayerStoreState>((set, get) => ({
  playersByTeam: new Map(),
  playerCache: new Map(),
  satisfactionByTeam: new Map(),
  lastUpdated: 0,
  cacheTTL: 30_000,

  setTeamPlayers: (teamId, players) => {
    set(state => {
      const newMap = new Map(state.playersByTeam);
      newMap.set(teamId, players);
      const newCache = new Map(state.playerCache);
      for (const p of players) newCache.set(p.id, p);
      return { playersByTeam: newMap, playerCache: newCache, lastUpdated: Date.now() };
    });
  },

  setPlayer: (player) => {
    set(state => {
      const newCache = new Map(state.playerCache);
      newCache.set(player.id, player);
      return { playerCache: newCache, lastUpdated: Date.now() };
    });
  },

  setTeamSatisfaction: (teamId, data) => {
    set(state => {
      const newMap = new Map(state.satisfactionByTeam);
      newMap.set(teamId, data);
      return { satisfactionByTeam: newMap, lastUpdated: Date.now() };
    });
  },

  getTeamPlayers: (teamId) => get().playersByTeam.get(teamId),

  getPlayer: (playerId) => get().playerCache.get(playerId),

  invalidateTeam: (teamId) => {
    set(state => {
      const newMap = new Map(state.playersByTeam);
      newMap.delete(teamId);
      const newSat = new Map(state.satisfactionByTeam);
      newSat.delete(teamId);
      return { playersByTeam: newMap, satisfactionByTeam: newSat };
    });
  },

  invalidateAll: () => {
    set({
      playersByTeam: new Map(),
      playerCache: new Map(),
      satisfactionByTeam: new Map(),
      lastUpdated: 0,
    });
  },

  isCacheValid: () => Date.now() - get().lastUpdated < get().cacheTTL,
}));
