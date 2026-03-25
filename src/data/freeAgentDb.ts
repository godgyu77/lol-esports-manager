/**
 * 자유계약 선수 100명+ & 스태프 30명+ 데이터
 * rosterDb.ts 패턴을 따름
 */

import type { Position } from '../types';
import type { StaffRole, StaffSpecialty, CoachingPhilosophy } from '../types/staff';

// ─────────────────────────────────────────
// 자유계약 선수 인터페이스
// ─────────────────────────────────────────

export interface FreeAgentPlayerData {
  id: string;
  name: string;
  position: Position;
  age: number;
  nationality: string;
  mechanical: number;
  gameSense: number;
  teamwork: number;
  consistency: number;
  laning: number;
  aggression: number;
  mental: number;
  stamina: number;
  morale: number;
  salary: number;
  potential: number;
  peakAge: number;
  popularity: number;
}

// ─────────────────────────────────────────
// 자유계약 스태프 인터페이스
// ─────────────────────────────────────────

export interface FreeStaffData {
  id: string;
  name: string;
  role: StaffRole;
  ability: number;
  specialty: StaffSpecialty | null;
  salary: number;
  nationality: string;
  philosophy: CoachingPhilosophy | null;
}

// ─────────────────────────────────────────
// 자유계약 선수 데이터 (100명+)
// ─────────────────────────────────────────
// 상위(OVR 75-85) 20%, 중위(60-74) 50%, 하위(45-59) 30%
// 포지션별 20명+ / 나이 18-30 / salary 3000-15000 / potential 50-90

export const FREE_AGENT_PLAYERS: FreeAgentPlayerData[] = [
  // ==========================================
  // [실존 은퇴/FA 선수 — 약 30명]
  // ==========================================

  // --- Top ---
  { id: 'fa_MaRin', name: 'MaRin', position: 'top', age: 30, nationality: 'KR', mechanical: 68, gameSense: 78, teamwork: 72, consistency: 65, laning: 75, aggression: 70, mental: 72, stamina: 60, morale: 65, salary: 8000, potential: 55, peakAge: 23, popularity: 60 },
  { id: 'fa_Smeb', name: 'Smeb', position: 'top', age: 29, nationality: 'KR', mechanical: 70, gameSense: 80, teamwork: 75, consistency: 68, laning: 78, aggression: 72, mental: 75, stamina: 62, morale: 65, salary: 9000, potential: 52, peakAge: 23, popularity: 65 },
  { id: 'fa_CuVee', name: 'CuVee', position: 'top', age: 29, nationality: 'KR', mechanical: 65, gameSense: 72, teamwork: 70, consistency: 67, laning: 70, aggression: 65, mental: 70, stamina: 62, morale: 65, salary: 6500, potential: 50, peakAge: 23, popularity: 45 },
  { id: 'fa_Huni', name: 'Huni', position: 'top', age: 28, nationality: 'KR', mechanical: 72, gameSense: 70, teamwork: 62, consistency: 55, laning: 73, aggression: 80, mental: 60, stamina: 65, morale: 60, salary: 10000, potential: 52, peakAge: 22, popularity: 70 },
  { id: 'fa_Ssumday', name: 'Ssumday', position: 'top', age: 28, nationality: 'KR', mechanical: 70, gameSense: 75, teamwork: 72, consistency: 70, laning: 76, aggression: 68, mental: 72, stamina: 65, morale: 65, salary: 8500, potential: 50, peakAge: 23, popularity: 55 },
  { id: 'fa_Impact', name: 'Impact', position: 'top', age: 29, nationality: 'KR', mechanical: 67, gameSense: 76, teamwork: 78, consistency: 75, laning: 72, aggression: 60, mental: 78, stamina: 62, morale: 68, salary: 9000, potential: 50, peakAge: 23, popularity: 60 },

  // --- Jungle ---
  { id: 'fa_Bengi', name: 'Bengi', position: 'jungle', age: 30, nationality: 'KR', mechanical: 60, gameSense: 82, teamwork: 85, consistency: 72, laning: 55, aggression: 55, mental: 80, stamina: 55, morale: 65, salary: 7000, potential: 50, peakAge: 23, popularity: 70 },
  { id: 'fa_Score', name: 'Score', position: 'jungle', age: 30, nationality: 'KR', mechanical: 62, gameSense: 83, teamwork: 80, consistency: 75, laning: 60, aggression: 58, mental: 82, stamina: 55, morale: 65, salary: 7500, potential: 50, peakAge: 24, popularity: 65 },
  { id: 'fa_Ambition', name: 'Ambition', position: 'jungle', age: 30, nationality: 'KR', mechanical: 60, gameSense: 80, teamwork: 82, consistency: 70, laning: 55, aggression: 55, mental: 85, stamina: 52, morale: 65, salary: 6500, potential: 50, peakAge: 24, popularity: 60 },
  { id: 'fa_Peanut', name: 'Peanut', position: 'jungle', age: 27, nationality: 'KR', mechanical: 75, gameSense: 78, teamwork: 72, consistency: 65, laning: 68, aggression: 78, mental: 70, stamina: 70, morale: 65, salary: 10000, potential: 55, peakAge: 23, popularity: 65 },
  { id: 'fa_Spirit', name: 'Spirit', position: 'jungle', age: 29, nationality: 'KR', mechanical: 62, gameSense: 75, teamwork: 78, consistency: 68, laning: 58, aggression: 62, mental: 72, stamina: 58, morale: 65, salary: 5500, potential: 50, peakAge: 23, popularity: 45 },
  { id: 'fa_Clid', name: 'Clid', position: 'jungle', age: 26, nationality: 'KR', mechanical: 76, gameSense: 74, teamwork: 68, consistency: 62, laning: 70, aggression: 80, mental: 65, stamina: 72, morale: 60, salary: 9500, potential: 58, peakAge: 23, popularity: 55 },

  // --- Mid ---
  { id: 'fa_PawN', name: 'PawN', position: 'mid', age: 29, nationality: 'KR', mechanical: 70, gameSense: 78, teamwork: 72, consistency: 60, laning: 72, aggression: 70, mental: 62, stamina: 50, morale: 60, salary: 7000, potential: 50, peakAge: 22, popularity: 60 },
  { id: 'fa_Kuro', name: 'Kuro', position: 'mid', age: 28, nationality: 'KR', mechanical: 65, gameSense: 75, teamwork: 78, consistency: 72, laning: 68, aggression: 55, mental: 75, stamina: 62, morale: 65, salary: 6000, potential: 50, peakAge: 22, popularity: 45 },
  { id: 'fa_Fly', name: 'Fly', position: 'mid', age: 28, nationality: 'KR', mechanical: 63, gameSense: 70, teamwork: 72, consistency: 68, laning: 65, aggression: 58, mental: 70, stamina: 62, morale: 65, salary: 5000, potential: 50, peakAge: 22, popularity: 35 },
  { id: 'fa_Crown', name: 'Crown', position: 'mid', age: 29, nationality: 'KR', mechanical: 68, gameSense: 76, teamwork: 70, consistency: 65, laning: 72, aggression: 65, mental: 68, stamina: 55, morale: 60, salary: 7000, potential: 50, peakAge: 22, popularity: 55 },
  { id: 'fa_Rookie_FA', name: 'Rookie', position: 'mid', age: 28, nationality: 'KR', mechanical: 78, gameSense: 82, teamwork: 72, consistency: 68, laning: 80, aggression: 75, mental: 72, stamina: 60, morale: 60, salary: 12000, potential: 52, peakAge: 22, popularity: 70 },
  { id: 'fa_Doinb', name: 'Doinb', position: 'mid', age: 28, nationality: 'KR', mechanical: 68, gameSense: 80, teamwork: 82, consistency: 70, laning: 62, aggression: 60, mental: 78, stamina: 60, morale: 65, salary: 10000, potential: 52, peakAge: 23, popularity: 65 },

  // --- ADC ---
  { id: 'fa_PraY', name: 'PraY', position: 'adc', age: 30, nationality: 'KR', mechanical: 65, gameSense: 80, teamwork: 82, consistency: 72, laning: 70, aggression: 58, mental: 78, stamina: 55, morale: 65, salary: 7000, potential: 50, peakAge: 22, popularity: 60 },
  { id: 'fa_Bang', name: 'Bang', position: 'adc', age: 29, nationality: 'KR', mechanical: 68, gameSense: 78, teamwork: 80, consistency: 70, laning: 72, aggression: 60, mental: 72, stamina: 58, morale: 65, salary: 8000, potential: 50, peakAge: 22, popularity: 60 },
  { id: 'fa_Teddy', name: 'Teddy', position: 'adc', age: 26, nationality: 'KR', mechanical: 76, gameSense: 75, teamwork: 70, consistency: 68, laning: 78, aggression: 65, mental: 68, stamina: 70, morale: 60, salary: 9000, potential: 58, peakAge: 22, popularity: 55 },
  { id: 'fa_Uzi', name: 'Uzi', position: 'adc', age: 28, nationality: 'CN', mechanical: 82, gameSense: 78, teamwork: 65, consistency: 60, laning: 85, aggression: 80, mental: 62, stamina: 45, morale: 55, salary: 15000, potential: 50, peakAge: 21, popularity: 85 },
  { id: 'fa_Mystic', name: 'Mystic', position: 'adc', age: 28, nationality: 'KR', mechanical: 68, gameSense: 72, teamwork: 72, consistency: 68, laning: 70, aggression: 62, mental: 70, stamina: 62, morale: 65, salary: 6000, potential: 50, peakAge: 22, popularity: 40 },
  { id: 'fa_Rekkles', name: 'Rekkles', position: 'adc', age: 28, nationality: 'EU', mechanical: 72, gameSense: 78, teamwork: 75, consistency: 75, laning: 75, aggression: 55, mental: 72, stamina: 62, morale: 60, salary: 10000, potential: 50, peakAge: 22, popularity: 75 },

  // --- Support ---
  { id: 'fa_GorillA', name: 'GorillA', position: 'support', age: 30, nationality: 'KR', mechanical: 62, gameSense: 82, teamwork: 85, consistency: 72, laning: 65, aggression: 58, mental: 80, stamina: 55, morale: 65, salary: 7000, potential: 50, peakAge: 24, popularity: 60 },
  { id: 'fa_Wolf', name: 'Wolf', position: 'support', age: 29, nationality: 'KR', mechanical: 60, gameSense: 75, teamwork: 80, consistency: 65, laning: 60, aggression: 60, mental: 72, stamina: 55, morale: 65, salary: 5500, potential: 50, peakAge: 24, popularity: 50 },
  { id: 'fa_Mata', name: 'Mata', position: 'support', age: 30, nationality: 'KR', mechanical: 62, gameSense: 85, teamwork: 82, consistency: 68, laning: 68, aggression: 62, mental: 82, stamina: 52, morale: 60, salary: 8000, potential: 50, peakAge: 24, popularity: 65 },
  { id: 'fa_Lehends', name: 'Lehends', position: 'support', age: 27, nationality: 'KR', mechanical: 72, gameSense: 78, teamwork: 78, consistency: 70, laning: 70, aggression: 62, mental: 72, stamina: 68, morale: 65, salary: 8500, potential: 55, peakAge: 24, popularity: 50 },

  // ==========================================
  // [가상 선수 — Top 15명+]
  // ==========================================

  // --- Top: 상위 ---
  { id: 'fa_top_01', name: 'Ironwall', position: 'top', age: 22, nationality: 'KR', mechanical: 78, gameSense: 76, teamwork: 72, consistency: 74, laning: 80, aggression: 70, mental: 72, stamina: 78, morale: 70, salary: 10000, potential: 82, peakAge: 23, popularity: 35 },
  { id: 'fa_top_02', name: 'Wrath', position: 'top', age: 21, nationality: 'KR', mechanical: 80, gameSense: 72, teamwork: 68, consistency: 65, laning: 78, aggression: 82, mental: 65, stamina: 80, morale: 70, salary: 9500, potential: 85, peakAge: 23, popularity: 30 },
  { id: 'fa_top_03', name: 'Shield', position: 'top', age: 24, nationality: 'CN', mechanical: 76, gameSense: 78, teamwork: 75, consistency: 72, laning: 76, aggression: 65, mental: 75, stamina: 75, morale: 70, salary: 9000, potential: 70, peakAge: 23, popularity: 28 },
  // --- Top: 중위 ---
  { id: 'fa_top_04', name: 'Granite', position: 'top', age: 23, nationality: 'KR', mechanical: 68, gameSense: 70, teamwork: 70, consistency: 68, laning: 72, aggression: 65, mental: 68, stamina: 75, morale: 70, salary: 6500, potential: 72, peakAge: 23, popularity: 18 },
  { id: 'fa_top_05', name: 'Boulder', position: 'top', age: 25, nationality: 'EU', mechanical: 65, gameSense: 68, teamwork: 72, consistency: 70, laning: 68, aggression: 60, mental: 70, stamina: 72, morale: 70, salary: 5500, potential: 62, peakAge: 23, popularity: 15 },
  { id: 'fa_top_06', name: 'Titan', position: 'top', age: 22, nationality: 'CN', mechanical: 70, gameSense: 65, teamwork: 65, consistency: 62, laning: 70, aggression: 72, mental: 62, stamina: 78, morale: 70, salary: 6000, potential: 75, peakAge: 23, popularity: 12 },
  { id: 'fa_top_07', name: 'Bastion', position: 'top', age: 26, nationality: 'NA', mechanical: 62, gameSense: 68, teamwork: 70, consistency: 72, laning: 65, aggression: 55, mental: 72, stamina: 70, morale: 70, salary: 5000, potential: 58, peakAge: 23, popularity: 10 },
  { id: 'fa_top_08', name: 'Rampart', position: 'top', age: 24, nationality: 'KR', mechanical: 66, gameSense: 65, teamwork: 68, consistency: 65, laning: 68, aggression: 62, mental: 65, stamina: 72, morale: 70, salary: 5500, potential: 65, peakAge: 23, popularity: 8 },
  { id: 'fa_top_09', name: 'Bulwark', position: 'top', age: 20, nationality: 'KR', mechanical: 70, gameSense: 62, teamwork: 60, consistency: 58, laning: 68, aggression: 70, mental: 58, stamina: 82, morale: 70, salary: 5000, potential: 80, peakAge: 23, popularity: 8 },
  // --- Top: 하위 ---
  { id: 'fa_top_10', name: 'Rubble', position: 'top', age: 19, nationality: 'KR', mechanical: 55, gameSense: 50, teamwork: 52, consistency: 48, laning: 55, aggression: 58, mental: 50, stamina: 80, morale: 70, salary: 3500, potential: 82, peakAge: 23, popularity: 3 },
  { id: 'fa_top_11', name: 'Pebble', position: 'top', age: 18, nationality: 'CN', mechanical: 52, gameSense: 48, teamwork: 50, consistency: 45, laning: 52, aggression: 55, mental: 48, stamina: 82, morale: 70, salary: 3000, potential: 85, peakAge: 23, popularity: 2 },
  { id: 'fa_top_12', name: 'Crag', position: 'top', age: 27, nationality: 'EU', mechanical: 55, gameSense: 58, teamwork: 60, consistency: 58, laning: 55, aggression: 50, mental: 60, stamina: 65, morale: 70, salary: 4000, potential: 50, peakAge: 23, popularity: 5 },
  { id: 'fa_top_13', name: 'Flint', position: 'top', age: 20, nationality: 'NA', mechanical: 50, gameSense: 48, teamwork: 52, consistency: 48, laning: 50, aggression: 52, mental: 50, stamina: 78, morale: 70, salary: 3200, potential: 78, peakAge: 23, popularity: 2 },
  { id: 'fa_top_14', name: 'Slate', position: 'top', age: 28, nationality: 'KR', mechanical: 58, gameSense: 60, teamwork: 62, consistency: 60, laning: 58, aggression: 52, mental: 62, stamina: 62, morale: 65, salary: 4500, potential: 50, peakAge: 23, popularity: 8 },

  // ==========================================
  // [가상 선수 — Jungle 15명+]
  // ==========================================

  // --- Jungle: 상위 ---
  { id: 'fa_jgl_01', name: 'Predator', position: 'jungle', age: 22, nationality: 'KR', mechanical: 78, gameSense: 80, teamwork: 74, consistency: 72, laning: 68, aggression: 80, mental: 72, stamina: 78, morale: 70, salary: 10000, potential: 82, peakAge: 23, popularity: 32 },
  { id: 'fa_jgl_02', name: 'Tracker', position: 'jungle', age: 23, nationality: 'CN', mechanical: 75, gameSense: 82, teamwork: 78, consistency: 75, laning: 65, aggression: 68, mental: 78, stamina: 76, morale: 70, salary: 9500, potential: 75, peakAge: 23, popularity: 28 },
  { id: 'fa_jgl_03', name: 'Fang', position: 'jungle', age: 21, nationality: 'KR', mechanical: 80, gameSense: 74, teamwork: 68, consistency: 65, laning: 70, aggression: 82, mental: 65, stamina: 80, morale: 70, salary: 9000, potential: 85, peakAge: 23, popularity: 25 },
  // --- Jungle: 중위 ---
  { id: 'fa_jgl_04', name: 'Prowler', position: 'jungle', age: 24, nationality: 'KR', mechanical: 68, gameSense: 72, teamwork: 70, consistency: 68, laning: 62, aggression: 72, mental: 68, stamina: 74, morale: 70, salary: 6500, potential: 68, peakAge: 23, popularity: 15 },
  { id: 'fa_jgl_05', name: 'Lurker', position: 'jungle', age: 25, nationality: 'EU', mechanical: 65, gameSense: 70, teamwork: 72, consistency: 70, laning: 60, aggression: 65, mental: 70, stamina: 70, morale: 70, salary: 5500, potential: 60, peakAge: 23, popularity: 12 },
  { id: 'fa_jgl_06', name: 'Stalker', position: 'jungle', age: 22, nationality: 'CN', mechanical: 70, gameSense: 68, teamwork: 65, consistency: 62, laning: 65, aggression: 75, mental: 62, stamina: 78, morale: 70, salary: 6000, potential: 76, peakAge: 23, popularity: 10 },
  { id: 'fa_jgl_07', name: 'Hunter', position: 'jungle', age: 23, nationality: 'NA', mechanical: 62, gameSense: 68, teamwork: 72, consistency: 70, laning: 58, aggression: 65, mental: 68, stamina: 72, morale: 70, salary: 5000, potential: 65, peakAge: 23, popularity: 8 },
  { id: 'fa_jgl_08', name: 'Shade', position: 'jungle', age: 26, nationality: 'KR', mechanical: 66, gameSense: 70, teamwork: 68, consistency: 68, laning: 62, aggression: 68, mental: 68, stamina: 68, morale: 70, salary: 5800, potential: 58, peakAge: 23, popularity: 10 },
  { id: 'fa_jgl_09', name: 'Briar', position: 'jungle', age: 20, nationality: 'KR', mechanical: 72, gameSense: 62, teamwork: 60, consistency: 58, laning: 65, aggression: 75, mental: 58, stamina: 82, morale: 70, salary: 5000, potential: 82, peakAge: 23, popularity: 5 },
  // --- Jungle: 하위 ---
  { id: 'fa_jgl_10', name: 'Bramble', position: 'jungle', age: 19, nationality: 'KR', mechanical: 55, gameSense: 52, teamwork: 50, consistency: 48, laning: 50, aggression: 58, mental: 50, stamina: 80, morale: 70, salary: 3500, potential: 80, peakAge: 23, popularity: 3 },
  { id: 'fa_jgl_11', name: 'Thorn', position: 'jungle', age: 18, nationality: 'CN', mechanical: 50, gameSense: 50, teamwork: 48, consistency: 45, laning: 48, aggression: 55, mental: 48, stamina: 82, morale: 70, salary: 3000, potential: 85, peakAge: 23, popularity: 2 },
  { id: 'fa_jgl_12', name: 'Moss', position: 'jungle', age: 28, nationality: 'EU', mechanical: 55, gameSense: 60, teamwork: 62, consistency: 60, laning: 52, aggression: 52, mental: 62, stamina: 62, morale: 65, salary: 4000, potential: 50, peakAge: 23, popularity: 5 },
  { id: 'fa_jgl_13', name: 'Vine', position: 'jungle', age: 20, nationality: 'NA', mechanical: 48, gameSense: 50, teamwork: 52, consistency: 50, laning: 45, aggression: 50, mental: 52, stamina: 78, morale: 70, salary: 3200, potential: 78, peakAge: 23, popularity: 2 },
  { id: 'fa_jgl_14', name: 'Ivy', position: 'jungle', age: 27, nationality: 'KR', mechanical: 58, gameSense: 62, teamwork: 65, consistency: 62, laning: 55, aggression: 55, mental: 65, stamina: 65, morale: 65, salary: 4500, potential: 52, peakAge: 23, popularity: 6 },

  // ==========================================
  // [가상 선수 — Mid 15명+]
  // ==========================================

  // --- Mid: 상위 ---
  { id: 'fa_mid_01', name: 'Arcane', position: 'mid', age: 21, nationality: 'KR', mechanical: 82, gameSense: 78, teamwork: 68, consistency: 68, laning: 80, aggression: 78, mental: 68, stamina: 78, morale: 70, salary: 11000, potential: 85, peakAge: 22, popularity: 35 },
  { id: 'fa_mid_02', name: 'Cipher', position: 'mid', age: 23, nationality: 'CN', mechanical: 76, gameSense: 80, teamwork: 72, consistency: 74, laning: 78, aggression: 70, mental: 75, stamina: 75, morale: 70, salary: 10000, potential: 75, peakAge: 22, popularity: 30 },
  { id: 'fa_mid_03', name: 'Prism', position: 'mid', age: 22, nationality: 'EU', mechanical: 78, gameSense: 76, teamwork: 70, consistency: 70, laning: 76, aggression: 75, mental: 70, stamina: 78, morale: 70, salary: 9500, potential: 80, peakAge: 22, popularity: 28 },
  // --- Mid: 중위 ---
  { id: 'fa_mid_04', name: 'Spark', position: 'mid', age: 24, nationality: 'KR', mechanical: 70, gameSense: 72, teamwork: 68, consistency: 68, laning: 72, aggression: 70, mental: 68, stamina: 74, morale: 70, salary: 7000, potential: 68, peakAge: 22, popularity: 15 },
  { id: 'fa_mid_05', name: 'Flux', position: 'mid', age: 22, nationality: 'KR', mechanical: 72, gameSense: 68, teamwork: 65, consistency: 62, laning: 70, aggression: 72, mental: 62, stamina: 78, morale: 70, salary: 6500, potential: 76, peakAge: 22, popularity: 12 },
  { id: 'fa_mid_06', name: 'Volt', position: 'mid', age: 25, nationality: 'CN', mechanical: 68, gameSense: 70, teamwork: 70, consistency: 70, laning: 68, aggression: 65, mental: 70, stamina: 72, morale: 70, salary: 6000, potential: 62, peakAge: 22, popularity: 10 },
  { id: 'fa_mid_07', name: 'Nova', position: 'mid', age: 23, nationality: 'EU', mechanical: 65, gameSense: 68, teamwork: 70, consistency: 68, laning: 66, aggression: 62, mental: 68, stamina: 74, morale: 70, salary: 5500, potential: 65, peakAge: 22, popularity: 8 },
  { id: 'fa_mid_08', name: 'Glint', position: 'mid', age: 26, nationality: 'NA', mechanical: 62, gameSense: 68, teamwork: 72, consistency: 72, laning: 64, aggression: 58, mental: 72, stamina: 68, morale: 70, salary: 5000, potential: 55, peakAge: 22, popularity: 8 },
  { id: 'fa_mid_09', name: 'Surge', position: 'mid', age: 20, nationality: 'KR', mechanical: 72, gameSense: 62, teamwork: 58, consistency: 55, laning: 68, aggression: 75, mental: 55, stamina: 82, morale: 70, salary: 5000, potential: 85, peakAge: 22, popularity: 5 },
  // --- Mid: 하위 ---
  { id: 'fa_mid_10', name: 'Ember', position: 'mid', age: 19, nationality: 'KR', mechanical: 58, gameSense: 52, teamwork: 50, consistency: 48, laning: 56, aggression: 58, mental: 48, stamina: 80, morale: 70, salary: 3500, potential: 82, peakAge: 22, popularity: 3 },
  { id: 'fa_mid_11', name: 'Ash', position: 'mid', age: 18, nationality: 'CN', mechanical: 55, gameSense: 50, teamwork: 48, consistency: 45, laning: 52, aggression: 55, mental: 45, stamina: 82, morale: 70, salary: 3000, potential: 88, peakAge: 22, popularity: 2 },
  { id: 'fa_mid_12', name: 'Flare', position: 'mid', age: 28, nationality: 'EU', mechanical: 58, gameSense: 62, teamwork: 65, consistency: 62, laning: 58, aggression: 55, mental: 65, stamina: 60, morale: 65, salary: 4200, potential: 50, peakAge: 22, popularity: 6 },
  { id: 'fa_mid_13', name: 'Cinder', position: 'mid', age: 20, nationality: 'NA', mechanical: 52, gameSense: 50, teamwork: 52, consistency: 50, laning: 50, aggression: 52, mental: 50, stamina: 78, morale: 70, salary: 3200, potential: 78, peakAge: 22, popularity: 2 },
  { id: 'fa_mid_14', name: 'Soot', position: 'mid', age: 27, nationality: 'KR', mechanical: 56, gameSense: 60, teamwork: 62, consistency: 60, laning: 55, aggression: 52, mental: 62, stamina: 65, morale: 65, salary: 4000, potential: 52, peakAge: 22, popularity: 5 },

  // ==========================================
  // [가상 선수 — ADC 15명+]
  // ==========================================

  // --- ADC: 상위 ---
  { id: 'fa_adc_01', name: 'Trigger', position: 'adc', age: 22, nationality: 'KR', mechanical: 82, gameSense: 76, teamwork: 70, consistency: 72, laning: 82, aggression: 75, mental: 68, stamina: 78, morale: 70, salary: 11000, potential: 82, peakAge: 22, popularity: 35 },
  { id: 'fa_adc_02', name: 'Barrage', position: 'adc', age: 21, nationality: 'CN', mechanical: 80, gameSense: 74, teamwork: 68, consistency: 68, laning: 80, aggression: 78, mental: 65, stamina: 80, morale: 70, salary: 10000, potential: 85, peakAge: 22, popularity: 30 },
  { id: 'fa_adc_03', name: 'Marksman', position: 'adc', age: 23, nationality: 'EU', mechanical: 76, gameSense: 78, teamwork: 75, consistency: 75, laning: 78, aggression: 68, mental: 75, stamina: 75, morale: 70, salary: 9500, potential: 72, peakAge: 22, popularity: 28 },
  // --- ADC: 중위 ---
  { id: 'fa_adc_04', name: 'Caliber', position: 'adc', age: 24, nationality: 'KR', mechanical: 70, gameSense: 68, teamwork: 68, consistency: 68, laning: 72, aggression: 68, mental: 68, stamina: 74, morale: 70, salary: 6500, potential: 68, peakAge: 22, popularity: 15 },
  { id: 'fa_adc_05', name: 'Bolt', position: 'adc', age: 22, nationality: 'KR', mechanical: 72, gameSense: 65, teamwork: 62, consistency: 60, laning: 72, aggression: 72, mental: 60, stamina: 78, morale: 70, salary: 6000, potential: 78, peakAge: 22, popularity: 10 },
  { id: 'fa_adc_06', name: 'Volley', position: 'adc', age: 25, nationality: 'CN', mechanical: 68, gameSense: 70, teamwork: 72, consistency: 72, laning: 70, aggression: 62, mental: 72, stamina: 70, morale: 70, salary: 5800, potential: 60, peakAge: 22, popularity: 10 },
  { id: 'fa_adc_07', name: 'Salvo', position: 'adc', age: 23, nationality: 'EU', mechanical: 65, gameSense: 68, teamwork: 70, consistency: 70, laning: 66, aggression: 60, mental: 70, stamina: 72, morale: 70, salary: 5200, potential: 65, peakAge: 22, popularity: 8 },
  { id: 'fa_adc_08', name: 'Round', position: 'adc', age: 26, nationality: 'NA', mechanical: 62, gameSense: 66, teamwork: 70, consistency: 70, laning: 64, aggression: 58, mental: 70, stamina: 68, morale: 70, salary: 4800, potential: 55, peakAge: 22, popularity: 6 },
  { id: 'fa_adc_09', name: 'Pierce', position: 'adc', age: 20, nationality: 'KR', mechanical: 74, gameSense: 62, teamwork: 58, consistency: 55, laning: 72, aggression: 75, mental: 55, stamina: 82, morale: 70, salary: 5000, potential: 85, peakAge: 22, popularity: 5 },
  // --- ADC: 하위 ---
  { id: 'fa_adc_10', name: 'Pellet', position: 'adc', age: 19, nationality: 'KR', mechanical: 55, gameSense: 50, teamwork: 48, consistency: 48, laning: 55, aggression: 55, mental: 48, stamina: 80, morale: 70, salary: 3500, potential: 82, peakAge: 22, popularity: 3 },
  { id: 'fa_adc_11', name: 'Blank', position: 'adc', age: 18, nationality: 'CN', mechanical: 52, gameSense: 48, teamwork: 48, consistency: 45, laning: 52, aggression: 52, mental: 45, stamina: 82, morale: 70, salary: 3000, potential: 88, peakAge: 22, popularity: 2 },
  { id: 'fa_adc_12', name: 'Shell', position: 'adc', age: 28, nationality: 'EU', mechanical: 58, gameSense: 60, teamwork: 62, consistency: 62, laning: 58, aggression: 52, mental: 62, stamina: 60, morale: 65, salary: 4000, potential: 50, peakAge: 22, popularity: 5 },
  { id: 'fa_adc_13', name: 'Tracer', position: 'adc', age: 20, nationality: 'NA', mechanical: 50, gameSense: 48, teamwork: 50, consistency: 48, laning: 50, aggression: 50, mental: 50, stamina: 78, morale: 70, salary: 3200, potential: 78, peakAge: 22, popularity: 2 },
  { id: 'fa_adc_14', name: 'Slug', position: 'adc', age: 27, nationality: 'KR', mechanical: 56, gameSense: 58, teamwork: 60, consistency: 60, laning: 55, aggression: 50, mental: 60, stamina: 65, morale: 65, salary: 4200, potential: 52, peakAge: 22, popularity: 5 },

  // ==========================================
  // [가상 선수 — Support 15명+]
  // ==========================================

  // --- Support: 상위 ---
  { id: 'fa_spt_01', name: 'Aegis', position: 'support', age: 23, nationality: 'KR', mechanical: 72, gameSense: 82, teamwork: 80, consistency: 75, laning: 70, aggression: 62, mental: 78, stamina: 76, morale: 70, salary: 9500, potential: 75, peakAge: 24, popularity: 30 },
  { id: 'fa_spt_02', name: 'Warden', position: 'support', age: 22, nationality: 'CN', mechanical: 70, gameSense: 78, teamwork: 82, consistency: 72, laning: 68, aggression: 58, mental: 76, stamina: 78, morale: 70, salary: 8500, potential: 80, peakAge: 24, popularity: 25 },
  { id: 'fa_spt_03', name: 'Oracle', position: 'support', age: 24, nationality: 'KR', mechanical: 68, gameSense: 80, teamwork: 78, consistency: 76, laning: 72, aggression: 60, mental: 80, stamina: 74, morale: 70, salary: 9000, potential: 72, peakAge: 24, popularity: 28 },
  // --- Support: 중위 ---
  { id: 'fa_spt_04', name: 'Beacon', position: 'support', age: 25, nationality: 'EU', mechanical: 62, gameSense: 72, teamwork: 75, consistency: 72, laning: 62, aggression: 55, mental: 72, stamina: 70, morale: 70, salary: 5500, potential: 60, peakAge: 24, popularity: 12 },
  { id: 'fa_spt_05', name: 'Anchor', position: 'support', age: 23, nationality: 'KR', mechanical: 65, gameSense: 70, teamwork: 72, consistency: 70, laning: 64, aggression: 58, mental: 70, stamina: 74, morale: 70, salary: 5800, potential: 68, peakAge: 24, popularity: 10 },
  { id: 'fa_spt_06', name: 'Helm', position: 'support', age: 22, nationality: 'CN', mechanical: 68, gameSense: 68, teamwork: 68, consistency: 65, laning: 66, aggression: 62, mental: 65, stamina: 76, morale: 70, salary: 5500, potential: 72, peakAge: 24, popularity: 8 },
  { id: 'fa_spt_07', name: 'Harbor', position: 'support', age: 26, nationality: 'NA', mechanical: 60, gameSense: 68, teamwork: 72, consistency: 72, laning: 60, aggression: 52, mental: 72, stamina: 68, morale: 70, salary: 4800, potential: 55, peakAge: 24, popularity: 6 },
  { id: 'fa_spt_08', name: 'Pillar', position: 'support', age: 24, nationality: 'KR', mechanical: 64, gameSense: 68, teamwork: 70, consistency: 68, laning: 62, aggression: 55, mental: 68, stamina: 72, morale: 70, salary: 5200, potential: 62, peakAge: 24, popularity: 8 },
  { id: 'fa_spt_09', name: 'Compass', position: 'support', age: 20, nationality: 'KR', mechanical: 68, gameSense: 65, teamwork: 65, consistency: 58, laning: 62, aggression: 60, mental: 60, stamina: 80, morale: 70, salary: 4500, potential: 82, peakAge: 24, popularity: 5 },
  // --- Support: 하위 ---
  { id: 'fa_spt_10', name: 'Lantern', position: 'support', age: 19, nationality: 'KR', mechanical: 52, gameSense: 55, teamwork: 55, consistency: 50, laning: 50, aggression: 48, mental: 52, stamina: 80, morale: 70, salary: 3500, potential: 82, peakAge: 24, popularity: 3 },
  { id: 'fa_spt_11', name: 'Buoy', position: 'support', age: 18, nationality: 'CN', mechanical: 50, gameSense: 52, teamwork: 52, consistency: 48, laning: 48, aggression: 45, mental: 50, stamina: 82, morale: 70, salary: 3000, potential: 85, peakAge: 24, popularity: 2 },
  { id: 'fa_spt_12', name: 'Signal', position: 'support', age: 28, nationality: 'EU', mechanical: 55, gameSense: 60, teamwork: 65, consistency: 62, laning: 55, aggression: 48, mental: 65, stamina: 60, morale: 65, salary: 4000, potential: 50, peakAge: 24, popularity: 5 },
  { id: 'fa_spt_13', name: 'Relay', position: 'support', age: 20, nationality: 'NA', mechanical: 48, gameSense: 52, teamwork: 55, consistency: 50, laning: 48, aggression: 45, mental: 52, stamina: 78, morale: 70, salary: 3200, potential: 78, peakAge: 24, popularity: 2 },
  { id: 'fa_spt_14', name: 'Flicker', position: 'support', age: 27, nationality: 'KR', mechanical: 55, gameSense: 62, teamwork: 65, consistency: 62, laning: 55, aggression: 50, mental: 65, stamina: 65, morale: 65, salary: 4200, potential: 52, peakAge: 24, popularity: 5 },

  // --- 추가 선수 (100명 채우기) ---
  { id: 'fa_top_15', name: 'Ridge', position: 'top', age: 21, nationality: 'CN', mechanical: 65, gameSense: 62, teamwork: 60, consistency: 58, laning: 66, aggression: 68, mental: 58, stamina: 78, morale: 70, salary: 5000, potential: 78, peakAge: 23, popularity: 6 },
  { id: 'fa_jgl_15', name: 'Thicket', position: 'jungle', age: 21, nationality: 'EU', mechanical: 62, gameSense: 65, teamwork: 62, consistency: 60, laning: 58, aggression: 65, mental: 60, stamina: 78, morale: 70, salary: 4800, potential: 76, peakAge: 23, popularity: 5 },
];

// ─────────────────────────────────────────
// 자유계약 스태프 데이터 (30명+)
// ─────────────────────────────────────────

export const FREE_AGENT_STAFF: FreeStaffData[] = [
  // --- Head Coach (8명) ---
  { id: 'fa_staff_hc_01', name: 'Park JinWoo', role: 'head_coach', ability: 78, specialty: 'training', salary: 8000, nationality: 'KR', philosophy: 'aggressive' },
  { id: 'fa_staff_hc_02', name: 'Kim DongHyun', role: 'head_coach', ability: 72, specialty: 'mentoring', salary: 7000, nationality: 'KR', philosophy: 'developmental' },
  { id: 'fa_staff_hc_03', name: 'Wang Lei', role: 'head_coach', ability: 75, specialty: 'draft', salary: 7500, nationality: 'CN', philosophy: 'balanced' },
  { id: 'fa_staff_hc_04', name: 'Henrik Larsson', role: 'head_coach', ability: 68, specialty: 'training', salary: 6000, nationality: 'EU', philosophy: 'defensive' },
  { id: 'fa_staff_hc_05', name: 'Lee SangHo', role: 'head_coach', ability: 82, specialty: 'draft', salary: 10000, nationality: 'KR', philosophy: 'aggressive' },
  { id: 'fa_staff_hc_06', name: 'Zhang Wei', role: 'head_coach', ability: 60, specialty: 'conditioning', salary: 5000, nationality: 'CN', philosophy: 'balanced' },
  { id: 'fa_staff_hc_07', name: 'Mark Williams', role: 'head_coach', ability: 55, specialty: 'training', salary: 4500, nationality: 'NA', philosophy: 'developmental' },
  { id: 'fa_staff_hc_08', name: 'Choi MinSu', role: 'head_coach', ability: 65, specialty: 'mentoring', salary: 5500, nationality: 'KR', philosophy: 'defensive' },

  // --- Coach (8명) ---
  { id: 'fa_staff_co_01', name: 'Yoon JaeHyuk', role: 'coach', ability: 75, specialty: 'training', salary: 5500, nationality: 'KR', philosophy: null },
  { id: 'fa_staff_co_02', name: 'Liu Chang', role: 'coach', ability: 70, specialty: 'draft', salary: 5000, nationality: 'CN', philosophy: null },
  { id: 'fa_staff_co_03', name: 'Stefan Muller', role: 'coach', ability: 65, specialty: 'mentoring', salary: 4500, nationality: 'EU', philosophy: null },
  { id: 'fa_staff_co_04', name: 'Han SeungWoo', role: 'coach', ability: 72, specialty: 'conditioning', salary: 5200, nationality: 'KR', philosophy: null },
  { id: 'fa_staff_co_05', name: 'James Chen', role: 'coach', ability: 58, specialty: 'training', salary: 3800, nationality: 'NA', philosophy: null },
  { id: 'fa_staff_co_06', name: 'Shin TaeYoung', role: 'coach', ability: 80, specialty: 'draft', salary: 6500, nationality: 'KR', philosophy: null },
  { id: 'fa_staff_co_07', name: 'Wu Hao', role: 'coach', ability: 52, specialty: 'mentoring', salary: 3500, nationality: 'CN', philosophy: null },
  { id: 'fa_staff_co_08', name: 'Lucas Martin', role: 'coach', ability: 62, specialty: 'conditioning', salary: 4200, nationality: 'EU', philosophy: null },

  // --- Analyst (8명) ---
  { id: 'fa_staff_an_01', name: 'Jang HyunWoo', role: 'analyst', ability: 78, specialty: 'draft', salary: 5000, nationality: 'KR', philosophy: null },
  { id: 'fa_staff_an_02', name: 'Chen Xiao', role: 'analyst', ability: 72, specialty: 'draft', salary: 4500, nationality: 'CN', philosophy: null },
  { id: 'fa_staff_an_03', name: 'Tom Baker', role: 'analyst', ability: 65, specialty: 'training', salary: 4000, nationality: 'NA', philosophy: null },
  { id: 'fa_staff_an_04', name: 'Kwon DongMin', role: 'analyst', ability: 70, specialty: 'draft', salary: 4200, nationality: 'KR', philosophy: null },
  { id: 'fa_staff_an_05', name: 'Liam Fischer', role: 'analyst', ability: 60, specialty: 'conditioning', salary: 3500, nationality: 'EU', philosophy: null },
  { id: 'fa_staff_an_06', name: 'Park YoungJin', role: 'analyst', ability: 82, specialty: 'draft', salary: 6000, nationality: 'KR', philosophy: null },
  { id: 'fa_staff_an_07', name: 'Zhao Ming', role: 'analyst', ability: 55, specialty: 'training', salary: 3200, nationality: 'CN', philosophy: null },
  { id: 'fa_staff_an_08', name: 'Ryan Scott', role: 'analyst', ability: 48, specialty: 'conditioning', salary: 3000, nationality: 'NA', philosophy: null },

  // --- Scout Manager (8명) ---
  { id: 'fa_staff_sm_01', name: 'Oh SeungHwan', role: 'scout_manager', ability: 76, specialty: 'mentoring', salary: 5000, nationality: 'KR', philosophy: null },
  { id: 'fa_staff_sm_02', name: 'Li Jun', role: 'scout_manager', ability: 70, specialty: 'training', salary: 4500, nationality: 'CN', philosophy: null },
  { id: 'fa_staff_sm_03', name: 'Max Richter', role: 'scout_manager', ability: 62, specialty: 'mentoring', salary: 3800, nationality: 'EU', philosophy: null },
  { id: 'fa_staff_sm_04', name: 'Seo JiHoon', role: 'scout_manager', ability: 72, specialty: 'conditioning', salary: 4500, nationality: 'KR', philosophy: null },
  { id: 'fa_staff_sm_05', name: 'Daniel Park', role: 'scout_manager', ability: 55, specialty: 'training', salary: 3200, nationality: 'NA', philosophy: null },
  { id: 'fa_staff_sm_06', name: 'Huang Feng', role: 'scout_manager', ability: 80, specialty: 'mentoring', salary: 5500, nationality: 'CN', philosophy: null },
  { id: 'fa_staff_sm_07', name: 'Song MinKyu', role: 'scout_manager', ability: 50, specialty: 'conditioning', salary: 3000, nationality: 'KR', philosophy: null },
  { id: 'fa_staff_sm_08', name: 'Alex Thompson', role: 'scout_manager', ability: 58, specialty: 'training', salary: 3500, nationality: 'NA', philosophy: null },
];
