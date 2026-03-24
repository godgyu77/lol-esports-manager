import { create } from 'zustand';
import type { GameMode, GameSave, Match, Position, Season } from '../types';
import type { PlayerBackground } from '../types/player';
import type { ManagerBackground, ManagerStats } from '../types/manager';
import type { Team } from '../types';
import type { DayType } from '../engine/season/calendar';
import type { DraftState } from '../engine/draft/draftEngine';

export interface PendingPlayer {
  name: string;
  age: number;
  nationality: string;
  position: Position;
  background: PlayerBackground;
  traits: string[];
}

export interface PendingManager {
  name: string;
  nationality: string;
  age: number;
  background: ManagerBackground;
  stats: ManagerStats;
  reputation: number;
}

/** 현재 진행 중인 날의 상태 */
export type DayPhase =
  | 'idle'           // 대기 (다음 날 버튼 대기)
  | 'processing'     // 하루 진행 중
  | 'banpick'        // 밴픽 진행 중
  | 'live_match'     // 라이브 경기 진행 중
  | 'result'         // 경기 결과 확인
  ;

interface GameState {
  // 게임 메타
  mode: GameMode | null;
  save: GameSave | null;
  season: Season | null;
  teams: Team[];
  isLoading: boolean;
  pendingPlayer: PendingPlayer | null;
  pendingManager: PendingManager | null;

  // 일간 진행 상태
  currentDate: string | null;      // 현재 날짜
  dayType: DayType | null;         // 오늘의 활동 유형
  dayPhase: DayPhase;              // 현재 일간 단계
  pendingUserMatch: Match | null;  // 밴픽/라이브매치 대기 중인 유저 경기
  draftResult: DraftState | null;  // 완료된 밴픽 결과
  fearlessPool: Record<'blue' | 'red', string[]>;  // 피어리스 드래프트 세트 간 누적 풀
  /** 분석 기반 추천 밴 (AnalysisView → DraftView 연동) */
  recommendedBans: string[];

  // 액션
  setMode: (mode: GameMode) => void;
  setSave: (save: GameSave) => void;
  setSeason: (season: Season) => void;
  setTeams: (teams: Team[]) => void;
  setLoading: (loading: boolean) => void;
  setPendingPlayer: (player: PendingPlayer | null) => void;
  setPendingManager: (manager: PendingManager | null) => void;
  pendingTeamId: string | null;
  setPendingTeamId: (id: string | null) => void;
  setCurrentDate: (date: string) => void;
  setDayType: (dayType: DayType) => void;
  setDayPhase: (phase: DayPhase) => void;
  setPendingUserMatch: (match: Match | null) => void;
  setDraftResult: (draft: DraftState | null) => void;
  setFearlessPool: (pool: Record<'blue' | 'red', string[]>) => void;
  setRecommendedBans: (bans: string[]) => void;
  reset: () => void;
}

const initialState: Omit<GameState,
  'setMode' | 'setSave' | 'setSeason' | 'setTeams' | 'setLoading' |
  'setPendingPlayer' | 'setPendingManager' | 'setPendingTeamId' |
  'setCurrentDate' | 'setDayType' | 'setDayPhase' | 'setPendingUserMatch' |
  'setDraftResult' | 'setFearlessPool' | 'setRecommendedBans' | 'reset'
> = {
  mode: null,
  save: null,
  season: null,
  teams: [],
  isLoading: false,
  pendingPlayer: null,
  pendingManager: null,
  pendingTeamId: null,
  currentDate: null,
  dayType: null,
  dayPhase: 'idle',
  pendingUserMatch: null,
  draftResult: null,
  fearlessPool: { blue: [], red: [] },
  recommendedBans: [],
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  setMode: (mode) => set({ mode }),
  setSave: (save) => set({ save }),
  setSeason: (season) => set({ season }),
  setTeams: (teams) => set({ teams }),
  setLoading: (loading) => set({ isLoading: loading }),
  setPendingPlayer: (player) => set({ pendingPlayer: player }),
  setPendingManager: (manager) => set({ pendingManager: manager }),
  setPendingTeamId: (id) => set({ pendingTeamId: id }),
  setCurrentDate: (date) => set({ currentDate: date }),
  setDayType: (dayType) => set({ dayType }),
  setDayPhase: (phase) => set({ dayPhase: phase }),
  setPendingUserMatch: (match) => set({ pendingUserMatch: match }),
  setDraftResult: (draft) => set({ draftResult: draft }),
  setFearlessPool: (pool) => set({ fearlessPool: pool }),
  setRecommendedBans: (bans) => set({ recommendedBans: bans }),
  reset: () => set(initialState),
}));
