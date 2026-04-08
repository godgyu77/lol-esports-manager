/**
 * [2026 GLOBAL ROSTER DATABASE - MASTER VERSION]
 * - 포함 리그: LCK (1/2군), LPL, LCS, LEC (1군)
 * - 2026 시즌 확정 로스터 기반 (2025-2026 오프시즌 반영)
 */

export type FinancialTier = 'S' | 'A' | 'B' | 'C';
export type Division = '1군' | '2군';
export type Role = 'TOP' | 'JGL' | 'MID' | 'ADC' | 'SPT' | 'SUB';

export interface PlayerStats {
  ovr: string;
  dpm: number;
  dmg_pct: number;
  kda_per_min: number;
  solo_kill: number;
  csd15: number;
  gd15: number;
  xpd15: number;
  fb_part: number;
  fb_victim: number;
}

export interface RosterPlayer {
  div: Division;
  role: Role;
  name: string;
  age: number;
  contract: number;
  traits: string[];
  stats: PlayerStats;
}

export interface TeamData {
  teamName: string;
  financialTier: FinancialTier;
  money: number;
  annualSupport: number;
  roster: RosterPlayer[];
}

const VACANT_STATS: PlayerStats = { ovr: "-", dpm: 0, dmg_pct: 0, kda_per_min: 0, solo_kill: 0, csd15: 0, gd15: 0, xpd15: 0, fb_part: 0, fb_victim: 0 };
const VACANT = (role: Role): RosterPlayer => ({ div: "1군", role, name: "VACANT", age: 0, contract: 0, traits: [], stats: VACANT_STATS });

// ==========================================
// [LCK - Korea] (1군 + 2군 풀 로스터)
// ==========================================

export const LCK_TEAMS: Record<string, TeamData> = {
  "T1": {
    teamName: "T1",
    financialTier: "S",
    money: 70.0,
    annualSupport: 60.0,
    roster: [
      { div: "1군", role: "TOP", name: "Doran", age: 26, contract: 2026, traits: ["DICE_ROLL", "ROMANTIC"], stats: { ovr: "A+", dpm: 600, dmg_pct: 24.5, kda_per_min: 0.35, solo_kill: 12, csd15: 5, gd15: 150, xpd15: 100, fb_part: 15, fb_victim: 20 } },
      { div: "1군", role: "JGL", name: "Oner", age: 24, contract: 2026, traits: ["SMITE_KING", "CLUTCH_GOD"], stats: { ovr: "S-", dpm: 450, dmg_pct: 18.2, kda_per_min: 0.55, solo_kill: 5, csd15: 2, gd15: 50, xpd15: 50, fb_part: 45, fb_victim: 10 } },
      { div: "1군", role: "MID", name: "Faker", age: 30, contract: 2029, traits: ["UNKILLABLE", "THE_COMMANDER"], stats: { ovr: "S", dpm: 550, dmg_pct: 22.0, kda_per_min: 0.45, solo_kill: 8, csd15: 0, gd15: 0, xpd15: 20, fb_part: 30, fb_victim: 5 } },
      { div: "1군", role: "ADC", name: "Peyz", age: 21, contract: 2028, traits: ["KILL_CATCHER", "HYPER_MECHANIC"], stats: { ovr: "S", dpm: 700, dmg_pct: 28.5, kda_per_min: 0.60, solo_kill: 15, csd15: 10, gd15: 200, xpd15: 150, fb_part: 10, fb_victim: 8 } },
      { div: "1군", role: "SPT", name: "Keria", age: 24, contract: 2026, traits: ["PROFESSOR", "JOKER_PICK"], stats: { ovr: "S+", dpm: 300, dmg_pct: 10.5, kda_per_min: 0.70, solo_kill: 2, csd15: 0, gd15: 100, xpd15: 50, fb_part: 50, fb_victim: 15 } },
      VACANT("SUB"),
      { div: "2군", role: "TOP", name: "Haetae", age: 20, contract: 2026, traits: ["PURE_MECH"], stats: { ovr: "C+", dpm: 350, dmg_pct: 22.0, kda_per_min: 0.25, solo_kill: 3, csd15: -5, gd15: -50, xpd15: -30, fb_part: 10, fb_victim: 25 } },
      { div: "2군", role: "JGL", name: "Painter", age: 20, contract: 2026, traits: ["AGGRESSIVE", "FIRST_BLOOD"], stats: { ovr: "B-", dpm: 320, dmg_pct: 17.0, kda_per_min: 0.35, solo_kill: 2, csd15: -2, gd15: -20, xpd15: -10, fb_part: 35, fb_victim: 20 } },
      { div: "2군", role: "MID", name: "Guti", age: 19, contract: 2027, traits: ["STEEL_STAMINA", "SPONGE"], stats: { ovr: "B", dpm: 400, dmg_pct: 24.0, kda_per_min: 0.30, solo_kill: 1, csd15: -3, gd15: -10, xpd15: 0, fb_part: 20, fb_victim: 15 } },
      { div: "2군", role: "ADC", name: "Cypher", age: 19, contract: 2026, traits: ["NEWBIE"], stats: { ovr: "C", dpm: 380, dmg_pct: 26.0, kda_per_min: 0.30, solo_kill: 2, csd15: -8, gd15: -40, xpd15: -20, fb_part: 10, fb_victim: 20 } },
      { div: "2군", role: "SPT", name: "Cloud", age: 21, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "C+", dpm: 150, dmg_pct: 8.0, kda_per_min: 0.40, solo_kill: 0, csd15: -5, gd15: -30, xpd15: -20, fb_part: 30, fb_victim: 20 } },
    ],
  },

  "GEN": {
    teamName: "Gen.G",
    financialTier: "S",
    money: 65.0,
    annualSupport: 55.0,
    roster: [
      { div: "1군", role: "TOP", name: "Kiin", age: 27, contract: 2026, traits: ["HEXAGON", "WAILING_WALL"], stats: { ovr: "S", dpm: 580, dmg_pct: 23.5, kda_per_min: 0.38, solo_kill: 18, csd15: 8, gd15: 180, xpd15: 120, fb_part: 20, fb_victim: 10 } },
      { div: "1군", role: "JGL", name: "Canyon", age: 25, contract: 2026, traits: ["CANYON_GAP", "GUERRILLA"], stats: { ovr: "S+", dpm: 500, dmg_pct: 20.0, kda_per_min: 0.58, solo_kill: 10, csd15: 5, gd15: 100, xpd15: 80, fb_part: 55, fb_victim: 5 } },
      { div: "1군", role: "MID", name: "Chovy", age: 25, contract: 2027, traits: ["HEAVEN_BEYOND", "LANE_KINGDOM"], stats: { ovr: "S+", dpm: 650, dmg_pct: 27.0, kda_per_min: 0.50, solo_kill: 20, csd15: 15, gd15: 300, xpd15: 200, fb_part: 25, fb_victim: 2 } },
      { div: "1군", role: "ADC", name: "Ruler", age: 28, contract: 2027, traits: ["RULER_ENDING", "HYPER_MECHANIC"], stats: { ovr: "S", dpm: 680, dmg_pct: 29.0, kda_per_min: 0.55, solo_kill: 8, csd15: 8, gd15: 150, xpd15: 100, fb_part: 15, fb_victim: 5 } },
      { div: "1군", role: "SPT", name: "Duro", age: 24, contract: 2027, traits: ["STEADY", "VISIONARY"], stats: { ovr: "B+", dpm: 200, dmg_pct: 8.0, kda_per_min: 0.60, solo_kill: 0, csd15: -2, gd15: -50, xpd15: -20, fb_part: 40, fb_victim: 25 } },
      VACANT("SUB"),
      { div: "2군", role: "TOP", name: "Ripple", age: 20, contract: 2026, traits: ["PURE_MECH", "TUNNEL_VISION"], stats: { ovr: "C+", dpm: 340, dmg_pct: 21.0, kda_per_min: 0.20, solo_kill: 4, csd15: -6, gd15: -60, xpd15: -40, fb_part: 15, fb_victim: 25 } },
      { div: "2군", role: "JGL", name: "Courage", age: 22, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "C", dpm: 300, dmg_pct: 16.0, kda_per_min: 0.30, solo_kill: 1, csd15: -5, gd15: -30, xpd15: -20, fb_part: 30, fb_victim: 15 } },
      { div: "2군", role: "MID", name: "Kemish", age: 19, contract: 2026, traits: ["CHAMP_PUDDLE", "GLASS_MENTAL"], stats: { ovr: "B-", dpm: 380, dmg_pct: 25.0, kda_per_min: 0.35, solo_kill: 2, csd15: -2, gd15: -20, xpd15: -10, fb_part: 20, fb_victim: 20 } },
      { div: "2군", role: "ADC", name: "MUDAI", age: 19, contract: 2026, traits: ["AGGRESSIVE", "NEWBIE"], stats: { ovr: "C", dpm: 360, dmg_pct: 27.0, kda_per_min: 0.30, solo_kill: 3, csd15: -8, gd15: -40, xpd15: -30, fb_part: 10, fb_victim: 25 } },
      { div: "2군", role: "SPT", name: "SIRIUSS", age: 19, contract: 2026, traits: ["NEWBIE", "VISIONARY"], stats: { ovr: "C-", dpm: 120, dmg_pct: 7.0, kda_per_min: 0.35, solo_kill: 0, csd15: -5, gd15: -50, xpd15: -30, fb_part: 25, fb_victim: 20 } },
    ],
  },

  "HLE": {
    teamName: "Hanwha Life Esports",
    financialTier: "S",
    money: 70.0,
    annualSupport: 65.0,
    roster: [
      { div: "1군", role: "TOP", name: "Zeus", age: 22, contract: 2026, traits: ["GOD_THUNDER", "HYPER_MECHANIC"], stats: { ovr: "S+", dpm: 650, dmg_pct: 27.0, kda_per_min: 0.45, solo_kill: 22, csd15: 12, gd15: 250, xpd15: 150, fb_part: 20, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "Kanavi", age: 26, contract: 2026, traits: ["VARIABLE_MAKER", "AGGRESSIVE"], stats: { ovr: "S-", dpm: 480, dmg_pct: 19.5, kda_per_min: 0.50, solo_kill: 7, csd15: 4, gd15: 80, xpd15: 60, fb_part: 50, fb_victim: 18 } },
      { div: "1군", role: "MID", name: "Zeka", age: 24, contract: 2027, traits: ["CLUTCH_GOD", "BIG_GAME"], stats: { ovr: "S", dpm: 600, dmg_pct: 26.0, kda_per_min: 0.48, solo_kill: 15, csd15: 5, gd15: 100, xpd15: 80, fb_part: 30, fb_victim: 5 } },
      { div: "1군", role: "ADC", name: "Gumayusi", age: 24, contract: 2027, traits: ["STEAL_GOD", "BIG_GAME"], stats: { ovr: "S", dpm: 620, dmg_pct: 27.5, kda_per_min: 0.52, solo_kill: 6, csd15: 6, gd15: 120, xpd15: 90, fb_part: 15, fb_victim: 2 } },
      { div: "1군", role: "SPT", name: "Delight", age: 24, contract: 2027, traits: ["IRON_WILL", "COMMANDER"], stats: { ovr: "A+", dpm: 250, dmg_pct: 9.0, kda_per_min: 0.65, solo_kill: 1, csd15: 0, gd15: 50, xpd15: 30, fb_part: 55, fb_victim: 20 } },
      VACANT("SUB"),
      { div: "2군", role: "TOP", name: "Panther", age: 20, contract: 2026, traits: ["AGGRESSIVE", "LANE_KINGDOM"], stats: { ovr: "B-", dpm: 370, dmg_pct: 23.0, kda_per_min: 0.28, solo_kill: 5, csd15: -1, gd15: -10, xpd15: -10, fb_part: 15, fb_victim: 20 } },
      { div: "2군", role: "JGL", name: "Jackal", age: 20, contract: 2027, traits: ["SPONGE", "EXPERIENCED"], stats: { ovr: "B", dpm: 330, dmg_pct: 18.0, kda_per_min: 0.35, solo_kill: 3, csd15: 0, gd15: 0, xpd15: 0, fb_part: 30, fb_victim: 15 } },
      { div: "2군", role: "MID", name: "Cracker", age: 20, contract: 2026, traits: ["SCRATCH_LOTTERY", "GROWTH_POTENTIAL"], stats: { ovr: "C+", dpm: 350, dmg_pct: 24.5, kda_per_min: 0.32, solo_kill: 2, csd15: -5, gd15: -30, xpd15: -20, fb_part: 20, fb_victim: 20 } },
      { div: "2군", role: "ADC", name: "Pyeonsik", age: 19, contract: 2026, traits: ["STEADY", "BLUE_WORKER"], stats: { ovr: "C+", dpm: 360, dmg_pct: 26.0, kda_per_min: 0.35, solo_kill: 2, csd15: -2, gd15: -20, xpd15: -10, fb_part: 15, fb_victim: 10 } },
      { div: "2군", role: "SPT", name: "Bluffing", age: 21, contract: 2026, traits: ["IRON_WILL"], stats: { ovr: "C", dpm: 140, dmg_pct: 7.0, kda_per_min: 0.40, solo_kill: 0, csd15: -5, gd15: -40, xpd15: -20, fb_part: 30, fb_victim: 20 } },
    ],
  },

  "DK": {
    teamName: "Dplus KIA",
    financialTier: "A",
    money: 40.0,
    annualSupport: 35.0,
    roster: [
      { div: "1군", role: "TOP", name: "Siwoo", age: 21, contract: 2026, traits: ["NEWBIE", "AGGRESSIVE"], stats: { ovr: "B+", dpm: 450, dmg_pct: 24.0, kda_per_min: 0.30, solo_kill: 5, csd15: 0, gd15: 0, xpd15: 0, fb_part: 20, fb_victim: 20 } },
      { div: "1군", role: "JGL", name: "Lucid", age: 21, contract: 2026, traits: ["PURE_MECH", "SCRATCH_LOTTERY"], stats: { ovr: "A-", dpm: 400, dmg_pct: 18.0, kda_per_min: 0.45, solo_kill: 3, csd15: 2, gd15: 20, xpd15: 10, fb_part: 40, fb_victim: 15 } },
      { div: "1군", role: "MID", name: "ShowMaker", age: 26, contract: 2026, traits: ["ROMANTIC", "CHAMP_OCEAN"], stats: { ovr: "A+", dpm: 580, dmg_pct: 28.0, kda_per_min: 0.50, solo_kill: 10, csd15: 5, gd15: 50, xpd15: 40, fb_part: 30, fb_victim: 10 } },
      { div: "1군", role: "ADC", name: "Smash", age: 20, contract: 2027, traits: ["SPONGE", "GROWTH_POTENTIAL"], stats: { ovr: "B+", dpm: 500, dmg_pct: 27.5, kda_per_min: 0.40, solo_kill: 4, csd15: 3, gd15: 10, xpd15: 10, fb_part: 15, fb_victim: 10 } },
      { div: "1군", role: "SPT", name: "Career", age: 21, contract: 2027, traits: ["SPONGE"], stats: { ovr: "B", dpm: 200, dmg_pct: 9.0, kda_per_min: 0.55, solo_kill: 0, csd15: 0, gd15: 0, xpd15: 0, fb_part: 45, fb_victim: 20 } },
      VACANT("SUB"),
      { div: "2군", role: "TOP", name: "Jaehyuk", age: 21, contract: 2026, traits: ["VETERAN"], stats: { ovr: "B", dpm: 380, dmg_pct: 23.0, kda_per_min: 0.30, solo_kill: 4, csd15: -2, gd15: -5, xpd15: 0, fb_part: 15, fb_victim: 15 } },
      { div: "2군", role: "JGL", name: "Sharvel", age: 21, contract: 2026, traits: ["PURE_MECH"], stats: { ovr: "C+", dpm: 310, dmg_pct: 16.0, kda_per_min: 0.35, solo_kill: 2, csd15: -5, gd15: -25, xpd15: -15, fb_part: 35, fb_victim: 20 } },
      { div: "2군", role: "MID", name: "Garden", age: 19, contract: 2026, traits: ["ROAMING_GOD"], stats: { ovr: "C+", dpm: 360, dmg_pct: 25.0, kda_per_min: 0.32, solo_kill: 3, csd15: -3, gd15: -15, xpd15: -10, fb_part: 25, fb_victim: 15 } },
      { div: "2군", role: "ADC", name: "Wayne", age: 19, contract: 2026, traits: ["SPONGE"], stats: { ovr: "B-", dpm: 390, dmg_pct: 27.0, kda_per_min: 0.38, solo_kill: 3, csd15: 0, gd15: -10, xpd15: -5, fb_part: 10, fb_victim: 10 } },
      { div: "2군", role: "SPT", name: "Loopy", age: 24, contract: 2026, traits: ["VETERAN"], stats: { ovr: "C+", dpm: 150, dmg_pct: 8.0, kda_per_min: 0.45, solo_kill: 0, csd15: -2, gd15: -20, xpd15: -10, fb_part: 40, fb_victim: 20 } },
    ],
  },

  "KT": {
    teamName: "KT Rolster",
    financialTier: "A",
    money: 45.0,
    annualSupport: 38.0,
    roster: [
      // 1군 ? 2026: Effort starts at support, Pollu is the six-man, Peter returns to CL
      { div: "1군", role: "TOP", name: "PerfecT", age: 22, contract: 2026, traits: ["STONE_HEAD"], stats: { ovr: "B+", dpm: 480, dmg_pct: 24.5, kda_per_min: 0.32, solo_kill: 6, csd15: -2, gd15: -10, xpd15: -5, fb_part: 15, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "Cuzz", age: 27, contract: 2026, traits: ["COMMANDER", "SMITE_KING"], stats: { ovr: "A", dpm: 420, dmg_pct: 19.0, kda_per_min: 0.48, solo_kill: 4, csd15: 3, gd15: 40, xpd15: 30, fb_part: 45, fb_victim: 10 } },
      { div: "1군", role: "MID", name: "Bdd", age: 27, contract: 2027, traits: ["HEXAGON", "VETERAN"], stats: { ovr: "S-", dpm: 600, dmg_pct: 27.5, kda_per_min: 0.50, solo_kill: 10, csd15: 5, gd15: 80, xpd15: 60, fb_part: 30, fb_victim: 5 } },
      { div: "1군", role: "ADC", name: "Aiming", age: 26, contract: 2027, traits: ["KILL_CATCHER", "THROWING"], stats: { ovr: "A+", dpm: 650, dmg_pct: 30.0, kda_per_min: 0.55, solo_kill: 12, csd15: 8, gd15: 100, xpd15: 80, fb_part: 15, fb_victim: 10 } },
      { div: "1군", role: "SPT", name: "Effort", age: 25, contract: 2026, traits: ["COMMANDER", "VETERAN"], stats: { ovr: "B+", dpm: 210, dmg_pct: 8.5, kda_per_min: 0.58, solo_kill: 0, csd15: 0, gd15: 5, xpd15: 5, fb_part: 48, fb_victim: 16 } },
      { div: "1군", role: "SUB", name: "Pollu", age: 20, contract: 2027, traits: ["NEWBIE"], stats: { ovr: "B-", dpm: 180, dmg_pct: 8.0, kda_per_min: 0.50, solo_kill: 0, csd15: -3, gd15: -30, xpd15: -10, fb_part: 35, fb_victim: 20 } },
      // 2군
      { div: "2군", role: "TOP", name: "Sero", age: 20, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "C+", dpm: 340, dmg_pct: 22.0, kda_per_min: 0.26, solo_kill: 2, csd15: -4, gd15: -25, xpd15: -15, fb_part: 15, fb_victim: 20 } },
      { div: "2군", role: "JGL", name: "Sylvie", age: 22, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "B-", dpm: 320, dmg_pct: 16.8, kda_per_min: 0.35, solo_kill: 2, csd15: -1, gd15: -5, xpd15: -5, fb_part: 35, fb_victim: 15 } },
      { div: "2군", role: "MID", name: "Hwichan", age: 21, contract: 2026, traits: ["LANE_KINGDOM"], stats: { ovr: "C+", dpm: 360, dmg_pct: 24.5, kda_per_min: 0.32, solo_kill: 3, csd15: -2, gd15: -15, xpd15: -10, fb_part: 22, fb_victim: 18 } },
      { div: "2군", role: "ADC", name: "FenRir", age: 20, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "C+", dpm: 390, dmg_pct: 27.0, kda_per_min: 0.36, solo_kill: 3, csd15: -1, gd15: -10, xpd15: -5, fb_part: 15, fb_victim: 15 } },
      { div: "2군", role: "SPT", name: "Peter", age: 23, contract: 2026, traits: ["STEADY"], stats: { ovr: "B", dpm: 190, dmg_pct: 8.0, kda_per_min: 0.52, solo_kill: 0, csd15: 0, gd15: 0, xpd15: 0, fb_part: 42, fb_victim: 18 } },
    ],
  },
  "SOOPers": {
    teamName: "DN SOOPers",
    financialTier: "B",
    money: 30.0,
    annualSupport: 25.0,
    roster: [
      { div: "1군", role: "TOP", name: "DuDu", age: 25, contract: 2026, traits: ["LANE_KINGDOM", "SPLIT_PUSHER"], stats: { ovr: "A-", dpm: 520, dmg_pct: 25.5, kda_per_min: 0.35, solo_kill: 10, csd15: 5, gd15: 60, xpd15: 40, fb_part: 15, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "Pyosik", age: 26, contract: 2026, traits: ["SMITE_KING", "DICE_ROLL"], stats: { ovr: "A-", dpm: 390, dmg_pct: 18.5, kda_per_min: 0.45, solo_kill: 5, csd15: 0, gd15: 20, xpd15: 10, fb_part: 50, fb_victim: 20 } },
      { div: "1군", role: "MID", name: "Clozer", age: 23, contract: 2026, traits: ["HYPER_MECHANIC", "AGGRESSIVE"], stats: { ovr: "B+", dpm: 540, dmg_pct: 26.0, kda_per_min: 0.42, solo_kill: 12, csd15: 2, gd15: 30, xpd15: 20, fb_part: 25, fb_victim: 15 } },
      { div: "1군", role: "ADC", name: "deokdam", age: 26, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "A", dpm: 600, dmg_pct: 29.0, kda_per_min: 0.48, solo_kill: 8, csd15: 5, gd15: 60, xpd15: 40, fb_part: 15, fb_victim: 10 } },
      { div: "1군", role: "SPT", name: "Life", age: 25, contract: 2026, traits: ["VETERAN", "COMMANDER"], stats: { ovr: "B-", dpm: 150, dmg_pct: 7.5, kda_per_min: 0.50, solo_kill: 0, csd15: -2, gd15: -15, xpd15: -10, fb_part: 40, fb_victim: 18 } },
      { div: "1군", role: "SUB", name: "Peter", age: 23, contract: 2026, traits: ["STEADY"], stats: { ovr: "B+", dpm: 200, dmg_pct: 8.5, kda_per_min: 0.58, solo_kill: 0, csd15: 2, gd15: 20, xpd15: 10, fb_part: 48, fb_victim: 18 } },
      { div: "2군", role: "TOP", name: "Lancer", age: 20, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "C", dpm: 330, dmg_pct: 22.0, kda_per_min: 0.25, solo_kill: 2, csd15: -5, gd15: -35, xpd15: -25, fb_part: 15, fb_victim: 25 } },
      { div: "2군", role: "JGL", name: "DDoiV", age: 20, contract: 2026, traits: ["RPG_JUNGLE"], stats: { ovr: "C+", dpm: 300, dmg_pct: 16.0, kda_per_min: 0.30, solo_kill: 1, csd15: -2, gd15: -25, xpd15: -15, fb_part: 30, fb_victim: 15 } },
      { div: "2군", role: "MID", name: "Flip", age: 19, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "C-", dpm: 340, dmg_pct: 24.0, kda_per_min: 0.28, solo_kill: 2, csd15: -6, gd15: -45, xpd15: -30, fb_part: 20, fb_victim: 20 } },
      { div: "2군", role: "ADC", name: "Enosh", age: 20, contract: 2026, traits: ["STEADY"], stats: { ovr: "C+", dpm: 360, dmg_pct: 26.0, kda_per_min: 0.35, solo_kill: 3, csd15: -2, gd15: -20, xpd15: -10, fb_part: 15, fb_victim: 10 } },
      { div: "2군", role: "SPT", name: "Quantum", age: 20, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "C+", dpm: 140, dmg_pct: 7.5, kda_per_min: 0.42, solo_kill: 0, csd15: -2, gd15: -15, xpd15: -10, fb_part: 35, fb_victim: 20 } },
    ],
  },

  "NS": {
    teamName: "Nongshim RedForce",
    financialTier: "B",
    money: 28.0,
    annualSupport: 22.0,
    roster: [
      // 1군 ? 2026: dual-mid setup with Calix as the six-man
      { div: "1군", role: "TOP", name: "Kingen", age: 26, contract: 2026, traits: ["BIG_GAME", "DICE_ROLL"], stats: { ovr: "A-", dpm: 500, dmg_pct: 24.0, kda_per_min: 0.32, solo_kill: 8, csd15: 2, gd15: 30, xpd15: 20, fb_part: 20, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "Sponge", age: 22, contract: 2027, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "B", dpm: 350, dmg_pct: 17.0, kda_per_min: 0.38, solo_kill: 3, csd15: 0, gd15: 0, xpd15: 0, fb_part: 40, fb_victim: 15 } },
      { div: "1군", role: "MID", name: "Scout", age: 28, contract: 2026, traits: ["VETERAN", "HEXAGON"], stats: { ovr: "A+", dpm: 580, dmg_pct: 27.5, kda_per_min: 0.45, solo_kill: 8, csd15: 6, gd15: 70, xpd15: 50, fb_part: 25, fb_victim: 5 } },
      { div: "1군", role: "ADC", name: "Taeyoon", age: 24, contract: 2026, traits: ["AGGRESSIVE", "STEADY"], stats: { ovr: "B+", dpm: 520, dmg_pct: 27.5, kda_per_min: 0.40, solo_kill: 5, csd15: 2, gd15: 10, xpd15: 5, fb_part: 15, fb_victim: 15 } },
      { div: "1군", role: "SPT", name: "Lehends", age: 28, contract: 2026, traits: ["JOKER_PICK", "COMMANDER"], stats: { ovr: "A", dpm: 220, dmg_pct: 9.0, kda_per_min: 0.60, solo_kill: 1, csd15: 0, gd15: 20, xpd15: 10, fb_part: 45, fb_victim: 15 } },
      { div: "1군", role: "SUB", name: "Calix", age: 20, contract: 2026, traits: ["GROWTH_POTENTIAL", "AGGRESSIVE"], stats: { ovr: "B+", dpm: 520, dmg_pct: 25.5, kda_per_min: 0.40, solo_kill: 6, csd15: 3, gd15: 25, xpd15: 20, fb_part: 25, fb_victim: 15 } },
      // 2군
      { div: "2군", role: "TOP", name: "Janus", age: 19, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "C+", dpm: 330, dmg_pct: 21.5, kda_per_min: 0.25, solo_kill: 2, csd15: -4, gd15: -30, xpd15: -20, fb_part: 14, fb_victim: 22 } },
      { div: "2군", role: "JGL", name: "Mihawk", age: 20, contract: 2027, traits: ["AGGRESSIVE"], stats: { ovr: "C+", dpm: 310, dmg_pct: 16.5, kda_per_min: 0.32, solo_kill: 2, csd15: -2, gd15: -15, xpd15: -10, fb_part: 34, fb_victim: 18 } },
      { div: "2군", role: "MID", name: "SeTab", age: 20, contract: 2026, traits: ["LANE_KINGDOM"], stats: { ovr: "C+", dpm: 350, dmg_pct: 24.0, kda_per_min: 0.31, solo_kill: 3, csd15: -1, gd15: -10, xpd15: -5, fb_part: 20, fb_victim: 16 } },
      { div: "2군", role: "ADC", name: "Lucy", age: 19, contract: 2026, traits: ["STEADY"], stats: { ovr: "C", dpm: 360, dmg_pct: 26.0, kda_per_min: 0.33, solo_kill: 3, csd15: -2, gd15: -15, xpd15: -10, fb_part: 15, fb_victim: 16 } },
      { div: "2군", role: "SPT", name: "Pleata", age: 21, contract: 2026, traits: ["ROAMING_GOD"], stats: { ovr: "C+", dpm: 140, dmg_pct: 7.0, kda_per_min: 0.42, solo_kill: 0, csd15: -3, gd15: -20, xpd15: -10, fb_part: 36, fb_victim: 20 } },
    ],
  },
  "BFX": {
    teamName: "BNK FearX",
    financialTier: "B",
    money: 28.0,
    annualSupport: 22.0,
    roster: [
      { div: "1군", role: "TOP", name: "Clear", age: 23, contract: 2026, traits: ["STONE_HEAD"], stats: { ovr: "B", dpm: 460, dmg_pct: 23.0, kda_per_min: 0.28, solo_kill: 5, csd15: -2, gd15: -10, xpd15: -5, fb_part: 15, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "Raptor", age: 22, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "B-", dpm: 380, dmg_pct: 18.0, kda_per_min: 0.35, solo_kill: 3, csd15: -3, gd15: -20, xpd15: -10, fb_part: 40, fb_victim: 20 } },
      { div: "1군", role: "MID", name: "VicLa", age: 23, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "B+", dpm: 520, dmg_pct: 26.0, kda_per_min: 0.40, solo_kill: 8, csd15: 2, gd15: 10, xpd15: 5, fb_part: 25, fb_victim: 15 } },
      { div: "1군", role: "ADC", name: "Diable", age: 21, contract: 2026, traits: ["STEADY"], stats: { ovr: "B", dpm: 500, dmg_pct: 28.0, kda_per_min: 0.38, solo_kill: 4, csd15: 0, gd15: 0, xpd15: 0, fb_part: 15, fb_victim: 10 } },
      { div: "1군", role: "SPT", name: "Kellin", age: 25, contract: 2026, traits: ["VISIONARY", "STEADY"], stats: { ovr: "B+", dpm: 200, dmg_pct: 8.0, kda_per_min: 0.55, solo_kill: 0, csd15: 2, gd15: 15, xpd15: 10, fb_part: 35, fb_victim: 15 } },
      { div: "1군", role: "SUB", name: "Daystar", age: 19, contract: 2026, traits: ["NEWBIE", "GROWTH_POTENTIAL"], stats: { ovr: "C", dpm: 340, dmg_pct: 24.0, kda_per_min: 0.28, solo_kill: 2, csd15: -4, gd15: -30, xpd15: -20, fb_part: 20, fb_victim: 20 } },
      { div: "2군", role: "TOP", name: "Kangin", age: 21, contract: 2026, traits: ["STONE_HEAD"], stats: { ovr: "C+", dpm: 330, dmg_pct: 21.0, kda_per_min: 0.25, solo_kill: 2, csd15: -4, gd15: -30, xpd15: -20, fb_part: 15, fb_victim: 20 } },
      { div: "2군", role: "JGL", name: "Zephyr", age: 20, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "C", dpm: 290, dmg_pct: 16.0, kda_per_min: 0.30, solo_kill: 2, csd15: -5, gd15: -40, xpd15: -25, fb_part: 35, fb_victim: 20 } },
      { div: "2군", role: "MID", name: "FIESTA", age: 21, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "C", dpm: 340, dmg_pct: 24.0, kda_per_min: 0.30, solo_kill: 3, csd15: -3, gd15: -35, xpd15: -20, fb_part: 20, fb_victim: 20 } },
      { div: "2군", role: "ADC", name: "Slayer", age: 22, contract: 2026, traits: ["TEAMFIGHT_GLADIATOR"], stats: { ovr: "C+", dpm: 370, dmg_pct: 27.0, kda_per_min: 0.35, solo_kill: 3, csd15: -2, gd15: -25, xpd15: -15, fb_part: 15, fb_victim: 15 } },
      { div: "2군", role: "SPT", name: "Luon", age: 21, contract: 2026, traits: ["VETERAN"], stats: { ovr: "B-", dpm: 140, dmg_pct: 7.5, kda_per_min: 0.45, solo_kill: 0, csd15: -1, gd15: -15, xpd15: -10, fb_part: 40, fb_victim: 15 } },
    ],
  },

  "BRION": {
    teamName: "HANJIN BRION",
    financialTier: "C",
    money: 15.0,
    annualSupport: 12.0,
    roster: [
      { div: "1군", role: "TOP", name: "Morgan", age: 26, contract: 2026, traits: ["SCRATCH_LOTTERY"], stats: { ovr: "C+", dpm: 420, dmg_pct: 23.5, kda_per_min: 0.25, solo_kill: 3, csd15: -5, gd15: -40, xpd15: -30, fb_part: 15, fb_victim: 20 } },
      { div: "1군", role: "JGL", name: "HamBak", age: 21, contract: 2026, traits: ["KILL_CATCHER"], stats: { ovr: "B", dpm: 360, dmg_pct: 18.0, kda_per_min: 0.40, solo_kill: 4, csd15: -2, gd15: -10, xpd15: -5, fb_part: 45, fb_victim: 15 } },
      { div: "1군", role: "MID", name: "Roamer", age: 21, contract: 2026, traits: ["TUNNEL_VISION"], stats: { ovr: "C+", dpm: 480, dmg_pct: 26.0, kda_per_min: 0.35, solo_kill: 4, csd15: -3, gd15: -30, xpd15: -20, fb_part: 20, fb_victim: 20 } },
      { div: "1군", role: "ADC", name: "Hype", age: 21, contract: 2026, traits: ["TEAMFIGHT_GLADIATOR", "GROWTH_POTENTIAL"], stats: { ovr: "A-", dpm: 600, dmg_pct: 30.0, kda_per_min: 0.45, solo_kill: 6, csd15: 2, gd15: 20, xpd15: 10, fb_part: 15, fb_victim: 10 } },
      { div: "1군", role: "SPT", name: "Pollu", age: 20, contract: 2026, traits: ["NEWBIE"], stats: { ovr: "C", dpm: 180, dmg_pct: 7.0, kda_per_min: 0.40, solo_kill: 0, csd15: -6, gd15: -50, xpd15: -30, fb_part: 35, fb_victim: 25 } },
      { div: "1군", role: "SUB", name: "Loki", age: 20, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "C+", dpm: 330, dmg_pct: 23.5, kda_per_min: 0.30, solo_kill: 2, csd15: -4, gd15: -20, xpd15: -10, fb_part: 20, fb_victim: 18 } },
      { div: "2군", role: "TOP", name: "DDahyuk", age: 20, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "D+", dpm: 300, dmg_pct: 21.0, kda_per_min: 0.20, solo_kill: 1, csd15: -8, gd15: -60, xpd15: -40, fb_part: 15, fb_victim: 30 } },
      { div: "2군", role: "JGL", name: "Dinai", age: 19, contract: 2026, traits: ["NEWBIE"], stats: { ovr: "D", dpm: 250, dmg_pct: 16.0, kda_per_min: 0.25, solo_kill: 1, csd15: -8, gd15: -70, xpd15: -50, fb_part: 30, fb_victim: 25 } },
      { div: "2군", role: "MID", name: "Tempester", age: 20, contract: 2026, traits: ["VETERAN"], stats: { ovr: "C", dpm: 320, dmg_pct: 24.0, kda_per_min: 0.28, solo_kill: 2, csd15: -4, gd15: -40, xpd15: -25, fb_part: 20, fb_victim: 20 } },
      { div: "2군", role: "ADC", name: "OddEye", age: 20, contract: 2026, traits: ["STEADY"], stats: { ovr: "C-", dpm: 340, dmg_pct: 26.0, kda_per_min: 0.30, solo_kill: 2, csd15: -5, gd15: -50, xpd15: -35, fb_part: 15, fb_victim: 20 } },
      { div: "2군", role: "SPT", name: "PlanB", age: 19, contract: 2026, traits: ["NEWBIE"], stats: { ovr: "D", dpm: 100, dmg_pct: 6.5, kda_per_min: 0.30, solo_kill: 0, csd15: -10, gd15: -60, xpd15: -40, fb_part: 30, fb_victim: 30 } },
    ],
  },

  "KRX": {
    teamName: "KRX",
    financialTier: "C",
    money: 18.0,
    annualSupport: 15.0,
    roster: [
      // 1군 ? 2026: KRX branding with Vincenzo as the six-man
      { div: "1군", role: "TOP", name: "Rich", age: 28, contract: 2026, traits: ["VETERAN", "TEAMFIGHT_GLADIATOR"], stats: { ovr: "B", dpm: 470, dmg_pct: 23.5, kda_per_min: 0.30, solo_kill: 5, csd15: -3, gd15: -20, xpd15: -10, fb_part: 20, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "Willer", age: 23, contract: 2026, traits: ["SMITE_KING"], stats: { ovr: "B+", dpm: 370, dmg_pct: 17.5, kda_per_min: 0.40, solo_kill: 3, csd15: 0, gd15: 0, xpd15: 0, fb_part: 45, fb_victim: 15 } },
      { div: "1군", role: "MID", name: "Ucal", age: 25, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "B+", dpm: 530, dmg_pct: 26.5, kda_per_min: 0.42, solo_kill: 8, csd15: 2, gd15: 10, xpd15: 5, fb_part: 30, fb_victim: 15 } },
      { div: "1군", role: "ADC", name: "Jiwoo", age: 22, contract: 2027, traits: ["HYPER_CARRY", "LANE_WEAKNESS"], stats: { ovr: "A-", dpm: 580, dmg_pct: 29.0, kda_per_min: 0.48, solo_kill: 10, csd15: -5, gd15: 30, xpd15: 20, fb_part: 15, fb_victim: 10 } },
      { div: "1군", role: "SPT", name: "Andil", age: 24, contract: 2026, traits: ["STEADY"], stats: { ovr: "B-", dpm: 190, dmg_pct: 8.5, kda_per_min: 0.50, solo_kill: 0, csd15: -2, gd15: -10, xpd15: -5, fb_part: 40, fb_victim: 20 } },
      { div: "1군", role: "SUB", name: "Vincenzo", age: 21, contract: 2026, traits: ["GROWTH_POTENTIAL", "AGGRESSIVE"], stats: { ovr: "B-", dpm: 340, dmg_pct: 17.0, kda_per_min: 0.35, solo_kill: 3, csd15: -2, gd15: -15, xpd15: -10, fb_part: 40, fb_victim: 18 } },
      // 2군
      { div: "2군", role: "TOP", name: "Frog", age: 23, contract: 2026, traits: ["STONE_HEAD"], stats: { ovr: "C", dpm: 310, dmg_pct: 21.0, kda_per_min: 0.22, solo_kill: 2, csd15: -5, gd15: -45, xpd15: -30, fb_part: 15, fb_victim: 20 } },
      { div: "2군", role: "JGL", name: "Winner", age: 20, contract: 2026, traits: ["NEWBIE"], stats: { ovr: "C+", dpm: 280, dmg_pct: 16.0, kda_per_min: 0.30, solo_kill: 1, csd15: -4, gd15: -30, xpd15: -20, fb_part: 30, fb_victim: 22 } },
      { div: "2군", role: "MID", name: "AKaJe", age: 20, contract: 2028, traits: ["PURE_MECH"], stats: { ovr: "C+", dpm: 370, dmg_pct: 25.0, kda_per_min: 0.33, solo_kill: 3, csd15: -2, gd15: -15, xpd15: -10, fb_part: 20, fb_victim: 18 } },
      { div: "2군", role: "ADC", name: "LazyFeel", age: 19, contract: 2028, traits: ["AGGRESSIVE"], stats: { ovr: "B-", dpm: 420, dmg_pct: 28.0, kda_per_min: 0.38, solo_kill: 4, csd15: 0, gd15: -5, xpd15: -5, fb_part: 15, fb_victim: 14 } },
      { div: "2군", role: "SPT", name: "Minous", age: 20, contract: 2026, traits: ["ROAMING_GOD"], stats: { ovr: "C+", dpm: 140, dmg_pct: 7.0, kda_per_min: 0.42, solo_kill: 0, csd15: -2, gd15: -15, xpd15: -10, fb_part: 35, fb_victim: 20 } },
    ],
  }
};

// ==========================================
// [LPL - China League] (14개 팀)
// 2026: BLG Xun/Viper IN, TES naiyou/fengyue IN, JDG GALA/Vampire IN,
//       IG TheShy OUT→Soboro, GALA OUT→Photic, WBG jiejie/Elk/Zika IN,
//       NIP HOYA/Guwon IN, EDG Leave IN(ADC), LNG sheer/BuLLDog/Croco/1xn/MISSING
// ==========================================

export const LPL_TEAMS: Record<string, TeamData> = {
  "BLG": {
    teamName: "Bilibili Gaming",
    financialTier: "S",
    money: 60.0,
    annualSupport: 50.0,
    roster: [
      // 2026: Beichuan OUT → Xun IN (복귀), Elk OUT → Viper IN (LCK에서)
      { div: "1군", role: "TOP", name: "Bin", age: 22, contract: 2027, traits: ["GOD_THUNDER", "SPLIT_PUSHER"], stats: { ovr: "S+", dpm: 720, dmg_pct: 28.5, kda_per_min: 0.50, solo_kill: 25, csd15: 15, gd15: 300, xpd15: 200, fb_part: 25, fb_victim: 10 } },
      { div: "1군", role: "JGL", name: "Xun", age: 23, contract: 2027, traits: ["CARRY_JUNGLE", "AGGRESSIVE"], stats: { ovr: "S", dpm: 580, dmg_pct: 21.0, kda_per_min: 0.55, solo_kill: 8, csd15: 6, gd15: 120, xpd15: 90, fb_part: 55, fb_victim: 15 } },
      { div: "1군", role: "MID", name: "Knight", age: 24, contract: 2027, traits: ["HEXAGON", "CLUTCH_GOD"], stats: { ovr: "S+", dpm: 750, dmg_pct: 30.0, kda_per_min: 0.60, solo_kill: 18, csd15: 10, gd15: 250, xpd15: 150, fb_part: 35, fb_victim: 5 } },
      { div: "1군", role: "ADC", name: "Viper", age: 24, contract: 2027, traits: ["HYPER_CARRY", "LANE_KINGDOM"], stats: { ovr: "S+", dpm: 750, dmg_pct: 31.0, kda_per_min: 0.62, solo_kill: 10, csd15: 12, gd15: 200, xpd15: 120, fb_part: 18, fb_victim: 5 } },
      { div: "1군", role: "SPT", name: "ON", age: 21, contract: 2026, traits: ["MECHANIC_SUPPORT", "DICE_ROLL"], stats: { ovr: "S", dpm: 250, dmg_pct: 8.0, kda_per_min: 0.70, solo_kill: 1, csd15: 0, gd15: 50, xpd15: 30, fb_part: 60, fb_victim: 30 } },
      VACANT("SUB"),
    ],
  },

  "TES": {
    teamName: "Top Esports",
    financialTier: "S",
    money: 55.0,
    annualSupport: 48.0,
    roster: [
      { div: "1군", role: "TOP", name: "369", age: 23, contract: 2026, traits: ["DICE_ROLL", "TEAMFIGHT_GLADIATOR"], stats: { ovr: "S", dpm: 650, dmg_pct: 25.0, kda_per_min: 0.40, solo_kill: 10, csd15: 5, gd15: 100, xpd15: 80, fb_part: 25, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "naiyou", age: 21, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "B+", dpm: 380, dmg_pct: 17.0, kda_per_min: 0.38, solo_kill: 3, csd15: 0, gd15: 10, xpd15: 5, fb_part: 45, fb_victim: 18 } },
      { div: "1군", role: "MID", name: "Creme", age: 21, contract: 2027, traits: ["KILL_CATCHER", "AGGRESSIVE"], stats: { ovr: "A+", dpm: 680, dmg_pct: 27.0, kda_per_min: 0.55, solo_kill: 15, csd15: 5, gd15: 90, xpd15: 70, fb_part: 30, fb_victim: 15 } },
      { div: "1군", role: "ADC", name: "JiaQi", age: 20, contract: 2026, traits: ["AGGRESSIVE", "THROWING"], stats: { ovr: "B+", dpm: 720, dmg_pct: 30.0, kda_per_min: 0.52, solo_kill: 9, csd15: 6, gd15: 110, xpd15: 70, fb_part: 22, fb_victim: 18 } },
      { div: "1군", role: "SPT", name: "fengyue", age: 20, contract: 2026, traits: ["NEWBIE"], stats: { ovr: "C+", dpm: 150, dmg_pct: 6.0, kda_per_min: 0.35, solo_kill: 0, csd15: -3, gd15: -20, xpd15: -10, fb_part: 35, fb_victim: 22 } },
      VACANT("SUB"),
    ],
  },

  "JDG": {
    teamName: "JD Gaming",
    financialTier: "S",
    money: 60.0,
    annualSupport: 50.0,
    roster: [
      // 2026: Peyz OUT→T1, Xun OUT→BLG, Scout OUT→NS, GALA IN(ADC from IG), Vampire IN(SPT from WE), JunJia IN(JGL from LCP), HongQ IN(MID from LCP)
      { div: "1군", role: "TOP", name: "Xiaoxu", age: 22, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "B+", dpm: 500, dmg_pct: 23.0, kda_per_min: 0.35, solo_kill: 5, csd15: 2, gd15: 30, xpd15: 20, fb_part: 20, fb_victim: 20 } },
      { div: "1군", role: "JGL", name: "JunJia", age: 23, contract: 2027, traits: ["AGGRESSIVE", "GROWTH_POTENTIAL"], stats: { ovr: "B+", dpm: 420, dmg_pct: 18.0, kda_per_min: 0.45, solo_kill: 4, csd15: 3, gd15: 50, xpd15: 40, fb_part: 45, fb_victim: 18 } },
      { div: "1군", role: "MID", name: "HongQ", age: 18, contract: 2028, traits: ["GROWTH_POTENTIAL", "HYPER_MECHANIC"], stats: { ovr: "A-", dpm: 580, dmg_pct: 27.0, kda_per_min: 0.48, solo_kill: 8, csd15: 5, gd15: 80, xpd15: 60, fb_part: 28, fb_victim: 10 } },
      { div: "1군", role: "ADC", name: "GALA", age: 23, contract: 2027, traits: ["RULER_ENDING", "HYPER_MECHANIC"], stats: { ovr: "S", dpm: 720, dmg_pct: 30.0, kda_per_min: 0.60, solo_kill: 8, csd15: 10, gd15: 180, xpd15: 120, fb_part: 15, fb_victim: 5 } },
      { div: "1군", role: "SPT", name: "Vampire", age: 22, contract: 2026, traits: ["STEADY"], stats: { ovr: "B", dpm: 160, dmg_pct: 7.5, kda_per_min: 0.48, solo_kill: 0, csd15: -1, gd15: -10, xpd15: -5, fb_part: 40, fb_victim: 20 } },
      VACANT("SUB"),
    ],
  },

  "IG": {
    teamName: "Invictus Gaming",
    financialTier: "A",
    money: 45.0,
    annualSupport: 40.0,
    roster: [
      { div: "1군", role: "TOP", name: "Soboro", age: 23, contract: 2026, traits: ["STONE_HEAD", "GROWTH_POTENTIAL"], stats: { ovr: "B", dpm: 420, dmg_pct: 22.0, kda_per_min: 0.28, solo_kill: 4, csd15: -2, gd15: -15, xpd15: -10, fb_part: 18, fb_victim: 18 } },
      { div: "1군", role: "JGL", name: "Wei", age: 22, contract: 2026, traits: ["GANKING_MACHINE", "SMART"], stats: { ovr: "S-", dpm: 400, dmg_pct: 17.0, kda_per_min: 0.55, solo_kill: 5, csd15: 4, gd15: 80, xpd15: 60, fb_part: 60, fb_victim: 10 } },
      { div: "1군", role: "MID", name: "Rookie", age: 27, contract: 2026, traits: ["LANE_KINGDOM", "VETERAN"], stats: { ovr: "A+", dpm: 680, dmg_pct: 28.0, kda_per_min: 0.50, solo_kill: 12, csd15: 10, gd15: 150, xpd15: 100, fb_part: 30, fb_victim: 10 } },
      { div: "1군", role: "ADC", name: "Photic", age: 23, contract: 2026, traits: ["AGGRESSIVE", "CONSISTENT"], stats: { ovr: "A", dpm: 650, dmg_pct: 29.0, kda_per_min: 0.52, solo_kill: 6, csd15: 5, gd15: 80, xpd15: 50, fb_part: 18, fb_victim: 12 } },
      { div: "1군", role: "SPT", name: "Jwei", age: 20, contract: 2026, traits: ["COMMANDER", "VETERAN"], stats: { ovr: "B", dpm: 180, dmg_pct: 7.5, kda_per_min: 0.52, solo_kill: 0, csd15: 0, gd15: 10, xpd15: 10, fb_part: 46, fb_victim: 16 } },
      VACANT("SUB"),
    ],
  },

  "WBG": {
    teamName: "Weibo Gaming",
    financialTier: "S",
    money: 50.0,
    annualSupport: 48.0,
    roster: [
      { div: "1군", role: "TOP", name: "Zika", age: 21, contract: 2027, traits: ["SPLIT_PUSHER", "GROWTH_POTENTIAL"], stats: { ovr: "A", dpm: 580, dmg_pct: 24.5, kda_per_min: 0.40, solo_kill: 12, csd15: 5, gd15: 50, xpd15: 40, fb_part: 20, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "jiejie", age: 24, contract: 2026, traits: ["SMITE_KING", "CARRY_JUNGLE"], stats: { ovr: "A+", dpm: 460, dmg_pct: 19.0, kda_per_min: 0.52, solo_kill: 6, csd15: 4, gd15: 80, xpd15: 60, fb_part: 52, fb_victim: 12 } },
      { div: "1군", role: "MID", name: "Xiaohu", age: 26, contract: 2026, traits: ["VETERAN", "ROAMING_GOD"], stats: { ovr: "A+", dpm: 600, dmg_pct: 26.0, kda_per_min: 0.45, solo_kill: 8, csd15: 5, gd15: 100, xpd15: 80, fb_part: 35, fb_victim: 10 } },
      { div: "1군", role: "ADC", name: "Elk", age: 23, contract: 2027, traits: ["HYPER_CARRY", "CONSISTENT"], stats: { ovr: "S", dpm: 780, dmg_pct: 32.0, kda_per_min: 0.65, solo_kill: 12, csd15: 8, gd15: 180, xpd15: 100, fb_part: 20, fb_victim: 10 } },
      { div: "1군", role: "SPT", name: "Erha", age: 20, contract: 2026, traits: ["ENGAGE_SUPPORT", "ROAMING"], stats: { ovr: "B+", dpm: 180, dmg_pct: 7.5, kda_per_min: 0.52, solo_kill: 0, csd15: 0, gd15: 10, xpd15: 10, fb_part: 48, fb_victim: 18 } },
      VACANT("SUB"),
    ],
  },

  "NIP": {
    teamName: "Ninjas in Pyjamas",
    financialTier: "A",
    money: 35.0,
    annualSupport: 28.0,
    roster: [
      { div: "1군", role: "TOP", name: "HOYA", age: 24, contract: 2026, traits: ["STEADY"], stats: { ovr: "B", dpm: 450, dmg_pct: 23.0, kda_per_min: 0.30, solo_kill: 4, csd15: 0, gd15: 0, xpd15: 0, fb_part: 20, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "Guwon", age: 22, contract: 2026, traits: ["AGGRESSIVE", "FIRST_BLOOD"], stats: { ovr: "B-", dpm: 330, dmg_pct: 17.0, kda_per_min: 0.35, solo_kill: 2, csd15: -2, gd15: -15, xpd15: -10, fb_part: 38, fb_victim: 18 } },
      { div: "1군", role: "MID", name: "Care", age: 22, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "B", dpm: 500, dmg_pct: 25.0, kda_per_min: 0.38, solo_kill: 5, csd15: 0, gd15: 10, xpd15: 5, fb_part: 25, fb_victim: 18 } },
      { div: "1군", role: "ADC", name: "Assum", age: 22, contract: 2026, traits: ["STEADY"], stats: { ovr: "B", dpm: 550, dmg_pct: 28.0, kda_per_min: 0.42, solo_kill: 4, csd15: 2, gd15: 15, xpd15: 10, fb_part: 18, fb_victim: 12 } },
      { div: "1군", role: "SPT", name: "Zhuo", age: 23, contract: 2026, traits: ["NEWBIE"], stats: { ovr: "B-", dpm: 160, dmg_pct: 7.5, kda_per_min: 0.45, solo_kill: 0, csd15: -2, gd15: -10, xpd15: -5, fb_part: 40, fb_victim: 20 } },
      VACANT("SUB"),
    ],
  },

  "EDG": {
    teamName: "EDward Gaming",
    financialTier: "A",
    money: 40.0,
    annualSupport: 35.0,
    roster: [
      // 2026: Ahn OUT → Leave IN (ADC, from NIP)
      { div: "1군", role: "TOP", name: "Zdz", age: 23, contract: 2026, traits: ["STEADY"], stats: { ovr: "B", dpm: 450, dmg_pct: 23.0, kda_per_min: 0.30, solo_kill: 4, csd15: 0, gd15: 0, xpd15: 0, fb_part: 20, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "Xiaohao", age: 22, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "B+", dpm: 400, dmg_pct: 18.5, kda_per_min: 0.42, solo_kill: 4, csd15: 2, gd15: 20, xpd15: 10, fb_part: 45, fb_victim: 20 } },
      { div: "1군", role: "MID", name: "Angel", age: 24, contract: 2026, traits: ["PASSIVE"], stats: { ovr: "B+", dpm: 520, dmg_pct: 26.0, kda_per_min: 0.38, solo_kill: 3, csd15: 2, gd15: 10, xpd15: 10, fb_part: 20, fb_victim: 5 } },
      { div: "1군", role: "ADC", name: "Leave", age: 22, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "B+", dpm: 600, dmg_pct: 29.0, kda_per_min: 0.50, solo_kill: 6, csd15: 3, gd15: 30, xpd15: 15, fb_part: 20, fb_victim: 20 } },
      { div: "1군", role: "SPT", name: "Parukia", age: 21, contract: 2026, traits: ["NEWBIE"], stats: { ovr: "C", dpm: 130, dmg_pct: 6.5, kda_per_min: 0.35, solo_kill: 0, csd15: -3, gd15: -20, xpd15: -10, fb_part: 30, fb_victim: 20 } },
      VACANT("SUB"),
    ],
  },

  "AL": {
    teamName: "Anyone's Legend",
    financialTier: "B",
    money: 28.0,
    annualSupport: 22.0,
    roster: [
      { div: "1군", role: "TOP", name: "Flandre", age: 26, contract: 2026, traits: ["VETERAN", "JOKER_PICK"], stats: { ovr: "A-", dpm: 480, dmg_pct: 22.0, kda_per_min: 0.30, solo_kill: 5, csd15: 2, gd15: 30, xpd15: 20, fb_part: 20, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "Tarzan", age: 25, contract: 2026, traits: ["RPG_JUNGLE", "SMITE_KING"], stats: { ovr: "S-", dpm: 420, dmg_pct: 18.0, kda_per_min: 0.45, solo_kill: 4, csd15: 8, gd15: 120, xpd15: 100, fb_part: 40, fb_victim: 10 } },
      { div: "1군", role: "MID", name: "Shanks", age: 23, contract: 2026, traits: ["STEADY"], stats: { ovr: "B+", dpm: 560, dmg_pct: 26.0, kda_per_min: 0.40, solo_kill: 6, csd15: 2, gd15: 20, xpd15: 10, fb_part: 25, fb_victim: 15 } },
      { div: "1군", role: "ADC", name: "Hope", age: 23, contract: 2026, traits: ["CONSISTENT"], stats: { ovr: "B+", dpm: 600, dmg_pct: 28.0, kda_per_min: 0.42, solo_kill: 5, csd15: 4, gd15: 50, xpd15: 30, fb_part: 20, fb_victim: 10 } },
      { div: "1군", role: "SPT", name: "Kael", age: 22, contract: 2026, traits: ["VISIONARY"], stats: { ovr: "B", dpm: 160, dmg_pct: 7.0, kda_per_min: 0.50, solo_kill: 0, csd15: 0, gd15: 10, xpd15: 0, fb_part: 40, fb_victim: 20 } },
      VACANT("SUB"),
    ],
  },

  "WE": {
    teamName: "Team WE",
    financialTier: "B",
    money: 25.0,
    annualSupport: 20.0,
    roster: [
      // 2026: Taeyoon OUT→NS(LCK), Vampire OUT→JDG, About IN(ADC), yaoyao IN(SPT)
      { div: "1군", role: "TOP", name: "Cube", age: 22, contract: 2026, traits: ["STEADY"], stats: { ovr: "B", dpm: 420, dmg_pct: 22.5, kda_per_min: 0.30, solo_kill: 4, csd15: 0, gd15: 0, xpd15: 0, fb_part: 20, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "Monki", age: 21, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "C+", dpm: 320, dmg_pct: 16.0, kda_per_min: 0.35, solo_kill: 2, csd15: -1, gd15: -10, xpd15: -5, fb_part: 40, fb_victim: 20 } },
      { div: "1군", role: "MID", name: "Karis", age: 22, contract: 2026, traits: ["PASSIVE"], stats: { ovr: "C+", dpm: 480, dmg_pct: 25.0, kda_per_min: 0.32, solo_kill: 3, csd15: -2, gd15: -20, xpd15: -10, fb_part: 25, fb_victim: 15 } },
      { div: "1군", role: "ADC", name: "About", age: 22, contract: 2026, traits: ["NEWBIE"], stats: { ovr: "C+", dpm: 460, dmg_pct: 27.0, kda_per_min: 0.35, solo_kill: 3, csd15: -3, gd15: -20, xpd15: -10, fb_part: 15, fb_victim: 18 } },
      { div: "1군", role: "SPT", name: "yaoyao", age: 21, contract: 2026, traits: ["NEWBIE"], stats: { ovr: "C", dpm: 140, dmg_pct: 7.0, kda_per_min: 0.38, solo_kill: 0, csd15: -4, gd15: -30, xpd15: -15, fb_part: 35, fb_victim: 22 } },
      VACANT("SUB"),
    ],
  },

  "LGD": {
    teamName: "LGD Gaming",
    financialTier: "C",
    money: 15.0,
    annualSupport: 12.0,
    roster: [
      // 2026: Tangyuan IN(MID from RNG), Heng IN(JGL from OMG)
      { div: "1군", role: "TOP", name: "sasi", age: 21, contract: 2026, traits: [], stats: { ovr: "C", dpm: 380, dmg_pct: 22.0, kda_per_min: 0.25, solo_kill: 2, csd15: -5, gd15: -40, xpd15: -30, fb_part: 15, fb_victim: 20 } },
      { div: "1군", role: "JGL", name: "Heng", age: 22, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "C+", dpm: 350, dmg_pct: 17.0, kda_per_min: 0.35, solo_kill: 3, csd15: -2, gd15: -15, xpd15: -10, fb_part: 40, fb_victim: 18 } },
      { div: "1군", role: "MID", name: "Tangyuan", age: 22, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "C+", dpm: 440, dmg_pct: 25.0, kda_per_min: 0.32, solo_kill: 3, csd15: -3, gd15: -25, xpd15: -15, fb_part: 22, fb_victim: 18 } },
      { div: "1군", role: "ADC", name: "Shaoye", age: 21, contract: 2026, traits: [], stats: { ovr: "C", dpm: 450, dmg_pct: 27.0, kda_per_min: 0.35, solo_kill: 3, csd15: -5, gd15: -40, xpd15: -25, fb_part: 15, fb_victim: 20 } },
      { div: "1군", role: "SPT", name: "Ycx", age: 21, contract: 2026, traits: [], stats: { ovr: "C", dpm: 130, dmg_pct: 7.0, kda_per_min: 0.40, solo_kill: 0, csd15: -5, gd15: -50, xpd15: -30, fb_part: 35, fb_victim: 25 } },
      VACANT("SUB"),
    ],
  },

  "UP": {
    teamName: "Ultra Prime",
    financialTier: "C",
    money: 15.0,
    annualSupport: 12.0,
    roster: [
      { div: "1군", role: "TOP", name: "Liangchen", age: 21, contract: 2026, traits: [], stats: { ovr: "C", dpm: 400, dmg_pct: 22.0, kda_per_min: 0.28, solo_kill: 3, csd15: -4, gd15: -30, xpd15: -20, fb_part: 18, fb_victim: 20 } },
      { div: "1군", role: "JGL", name: "Grizzly", age: 20, contract: 2026, traits: ["NEWBIE", "GROWTH_POTENTIAL"], stats: { ovr: "C", dpm: 310, dmg_pct: 16.0, kda_per_min: 0.30, solo_kill: 2, csd15: -5, gd15: -35, xpd15: -20, fb_part: 35, fb_victim: 22 } },
      { div: "1군", role: "MID", name: "Saber", age: 21, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "C+", dpm: 430, dmg_pct: 25.0, kda_per_min: 0.32, solo_kill: 4, csd15: -3, gd15: -20, xpd15: -10, fb_part: 25, fb_victim: 15 } },
      { div: "1군", role: "ADC", name: "Hena", age: 24, contract: 2026, traits: [], stats: { ovr: "C+", dpm: 500, dmg_pct: 27.5, kda_per_min: 0.38, solo_kill: 4, csd15: -2, gd15: -20, xpd15: -10, fb_part: 15, fb_victim: 18 } },
      { div: "1군", role: "SPT", name: "Xiaoxia", age: 22, contract: 2026, traits: [], stats: { ovr: "C", dpm: 160, dmg_pct: 7.5, kda_per_min: 0.40, solo_kill: 0, csd15: -5, gd15: -30, xpd15: -20, fb_part: 35, fb_victim: 25 } },
      VACANT("SUB"),
    ],
  },

  "TT": {
    teamName: "ThunderTalk Gaming",
    financialTier: "B",
    money: 25.0,
    annualSupport: 20.0,
    roster: [
      { div: "1군", role: "TOP", name: "Keshi", age: 22, contract: 2026, traits: ["STEADY"], stats: { ovr: "B-", dpm: 430, dmg_pct: 22.5, kda_per_min: 0.30, solo_kill: 4, csd15: -1, gd15: -5, xpd15: 0, fb_part: 18, fb_victim: 16 } },
      { div: "1군", role: "JGL", name: "JunHao", age: 21, contract: 2026, traits: [], stats: { ovr: "C+", dpm: 340, dmg_pct: 17.0, kda_per_min: 0.35, solo_kill: 2, csd15: -3, gd15: -20, xpd15: -10, fb_part: 38, fb_victim: 18 } },
      { div: "1군", role: "MID", name: "Heru", age: 21, contract: 2026, traits: ["NEWBIE"], stats: { ovr: "C+", dpm: 460, dmg_pct: 25.0, kda_per_min: 0.35, solo_kill: 3, csd15: -2, gd15: -15, xpd15: -10, fb_part: 22, fb_victim: 18 } },
      { div: "1군", role: "ADC", name: "Ryan3", age: 20, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "B-", dpm: 540, dmg_pct: 28.0, kda_per_min: 0.40, solo_kill: 5, csd15: 0, gd15: 0, xpd15: 0, fb_part: 15, fb_victim: 10 } },
      { div: "1군", role: "SPT", name: "Feather", age: 21, contract: 2026, traits: [], stats: { ovr: "C+", dpm: 170, dmg_pct: 8.0, kda_per_min: 0.50, solo_kill: 0, csd15: -1, gd15: -20, xpd15: -10, fb_part: 40, fb_victim: 20 } },
      VACANT("SUB"),
    ],
  },

  "LNG": {
    teamName: "LNG Esports",
    financialTier: "A",
    money: 40.0,
    annualSupport: 32.0,
    roster: [
      { div: "1군", role: "TOP", name: "sheer", age: 22, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "B", dpm: 450, dmg_pct: 23.0, kda_per_min: 0.32, solo_kill: 5, csd15: 0, gd15: 0, xpd15: 0, fb_part: 18, fb_victim: 18 } },
      { div: "1군", role: "JGL", name: "Croco", age: 22, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "B-", dpm: 360, dmg_pct: 17.0, kda_per_min: 0.35, solo_kill: 3, csd15: -1, gd15: -10, xpd15: -5, fb_part: 42, fb_victim: 18 } },
      { div: "1군", role: "MID", name: "BuLLDoG", age: 21, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "B+", dpm: 540, dmg_pct: 25.5, kda_per_min: 0.42, solo_kill: 6, csd15: 2, gd15: 20, xpd15: 15, fb_part: 30, fb_victim: 15 } },
      { div: "1군", role: "ADC", name: "1xn", age: 21, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "B+", dpm: 620, dmg_pct: 29.0, kda_per_min: 0.50, solo_kill: 8, csd15: 3, gd15: 30, xpd15: 20, fb_part: 20, fb_victim: 20 } },
      { div: "1군", role: "SPT", name: "MISSING", age: 25, contract: 2026, traits: ["COMMANDER", "ROAMING_GOD"], stats: { ovr: "A-", dpm: 200, dmg_pct: 8.0, kda_per_min: 0.55, solo_kill: 1, csd15: 0, gd15: 20, xpd15: 10, fb_part: 48, fb_victim: 15 } },
      VACANT("SUB"),
    ],
  },

  "OMG": {
    teamName: "Oh My God",
    financialTier: "B",
    money: 25.0,
    annualSupport: 20.0,
    roster: [
      { div: "1군", role: "TOP", name: "Hery", age: 22, contract: 2026, traits: ["STEADY"], stats: { ovr: "C+", dpm: 410, dmg_pct: 22.0, kda_per_min: 0.28, solo_kill: 3, csd15: -2, gd15: -15, xpd15: -10, fb_part: 18, fb_victim: 18 } },
      { div: "1군", role: "JGL", name: "Juhan", age: 24, contract: 2026, traits: ["NEWBIE", "GROWTH_POTENTIAL"], stats: { ovr: "B-", dpm: 360, dmg_pct: 17.0, kda_per_min: 0.35, solo_kill: 3, csd15: -1, gd15: -10, xpd15: -5, fb_part: 40, fb_victim: 18 } },
      { div: "1군", role: "MID", name: "haichao", age: 21, contract: 2026, traits: [], stats: { ovr: "C+", dpm: 470, dmg_pct: 25.0, kda_per_min: 0.34, solo_kill: 3, csd15: -2, gd15: -15, xpd15: -10, fb_part: 25, fb_victim: 18 } },
      { div: "1군", role: "ADC", name: "Starry", age: 22, contract: 2026, traits: [], stats: { ovr: "C+", dpm: 480, dmg_pct: 27.0, kda_per_min: 0.38, solo_kill: 4, csd15: -1, gd15: -10, xpd15: 0, fb_part: 15, fb_victim: 15 } },
      { div: "1군", role: "SPT", name: "Moham", age: 24, contract: 2026, traits: ["ROAMING_GOD"], stats: { ovr: "B", dpm: 200, dmg_pct: 8.5, kda_per_min: 0.50, solo_kill: 1, csd15: 0, gd15: 0, xpd15: 0, fb_part: 50, fb_victim: 20 } },
      { div: "1군", role: "SUB", name: "re0", age: 20, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "C", dpm: 330, dmg_pct: 16.5, kda_per_min: 0.32, solo_kill: 2, csd15: -3, gd15: -25, xpd15: -15, fb_part: 38, fb_victim: 22 } },
    ],
  },
};

// ==========================================
// [LCS - North America] (총 8개 팀)
// 2026: C9 APA IN(MID from TL), TL Morgan/Josedeodo/Quid IN,
//       SEN Impact/HamBak IN, FLY Gakgos/Gryffinn/Cryogen IN,
//       DIG Photon/eXyu/Palafox/FBI/IgNar
// ==========================================

export const LCS_TEAMS: Record<string, TeamData> = {
  "FLY": {
    teamName: "FlyQuest",
    financialTier: "A",
    money: 40.0,
    annualSupport: 35.0,
    roster: [
      // 2026: Bwipo/Inspired/Busio OUT, Gakgos/Gryffinn/Cryogen IN
      { div: "1군", role: "TOP", name: "Gakgos", age: 20, contract: 2026, traits: ["NEWBIE"], stats: { ovr: "B", dpm: 400, dmg_pct: 22.0, kda_per_min: 0.30, solo_kill: 3, csd15: 0, gd15: 0, xpd15: 0, fb_part: 20, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "Gryffinn", age: 19, contract: 2027, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "B+", dpm: 380, dmg_pct: 17.5, kda_per_min: 0.45, solo_kill: 4, csd15: 2, gd15: 20, xpd15: 15, fb_part: 45, fb_victim: 15 } },
      { div: "1군", role: "MID", name: "Quad", age: 22, contract: 2026, traits: ["SOLO_KILL"], stats: { ovr: "A-", dpm: 550, dmg_pct: 27.0, kda_per_min: 0.50, solo_kill: 10, csd15: 5, gd15: 50, xpd15: 40, fb_part: 25, fb_victim: 10 } },
      { div: "1군", role: "ADC", name: "Massu", age: 20, contract: 2027, traits: ["SPONGE"], stats: { ovr: "A-", dpm: 580, dmg_pct: 28.0, kda_per_min: 0.48, solo_kill: 5, csd15: 4, gd15: 40, xpd15: 20, fb_part: 15, fb_victim: 10 } },
      { div: "1군", role: "SPT", name: "Cryogen", age: 20, contract: 2026, traits: ["NEWBIE"], stats: { ovr: "C+", dpm: 150, dmg_pct: 5.5, kda_per_min: 0.35, solo_kill: 0, csd15: -2, gd15: -20, xpd15: -10, fb_part: 30, fb_victim: 20 } },
      VACANT("SUB"),
    ],
  },

  "TL": {
    teamName: "Team Liquid",
    financialTier: "A",
    money: 45.0,
    annualSupport: 38.0,
    roster: [
      // 2026: Impact OUT → Morgan IN, APA OUT → Quid IN, Josedeodo IN(JGL)
      { div: "1군", role: "TOP", name: "Morgan", age: 25, contract: 2026, traits: ["VETERAN", "STEADY"], stats: { ovr: "B", dpm: 420, dmg_pct: 22.0, kda_per_min: 0.28, solo_kill: 3, csd15: -2, gd15: -10, xpd15: -5, fb_part: 15, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "Josedeodo", age: 24, contract: 2026, traits: ["VETERAN"], stats: { ovr: "B+", dpm: 380, dmg_pct: 18.0, kda_per_min: 0.40, solo_kill: 3, csd15: 0, gd15: 10, xpd15: 5, fb_part: 40, fb_victim: 15 } },
      { div: "1군", role: "MID", name: "Quid", age: 21, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "A", dpm: 580, dmg_pct: 28.0, kda_per_min: 0.55, solo_kill: 8, csd15: 5, gd15: 50, xpd15: 40, fb_part: 30, fb_victim: 10 } },
      { div: "1군", role: "ADC", name: "Yeon", age: 22, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "A", dpm: 600, dmg_pct: 29.0, kda_per_min: 0.52, solo_kill: 6, csd15: 4, gd15: 60, xpd15: 30, fb_part: 20, fb_victim: 15 } },
      { div: "1군", role: "SPT", name: "CoreJJ", age: 30, contract: 2026, traits: ["COMMANDER", "VETERAN"], stats: { ovr: "A+", dpm: 200, dmg_pct: 7.0, kda_per_min: 0.65, solo_kill: 0, csd15: 2, gd15: 30, xpd15: 20, fb_part: 50, fb_victim: 10 } },
      VACANT("SUB"),
    ],
  },

  "C9": {
    teamName: "Cloud9",
    financialTier: "A",
    money: 42.0,
    annualSupport: 36.0,
    roster: [
      // 2026: Loki OUT → APA IN(from TL)
      { div: "1군", role: "TOP", name: "Thanatos", age: 20, contract: 2027, traits: ["TOP_CARRY"], stats: { ovr: "A", dpm: 550, dmg_pct: 25.0, kda_per_min: 0.45, solo_kill: 10, csd15: 6, gd15: 60, xpd15: 40, fb_part: 20, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "Blaber", age: 24, contract: 2026, traits: ["AGGRESSIVE", "COIN_FLIP"], stats: { ovr: "A+", dpm: 450, dmg_pct: 20.0, kda_per_min: 0.55, solo_kill: 8, csd15: 3, gd15: 50, xpd15: 30, fb_part: 55, fb_victim: 20 } },
      { div: "1군", role: "MID", name: "APA", age: 22, contract: 2026, traits: ["EMOTIONAL"], stats: { ovr: "A-", dpm: 520, dmg_pct: 26.0, kda_per_min: 0.40, solo_kill: 5, csd15: 2, gd15: 20, xpd15: 10, fb_part: 30, fb_victim: 15 } },
      { div: "1군", role: "ADC", name: "Zven", age: 27, contract: 2026, traits: ["VETERAN"], stats: { ovr: "A-", dpm: 550, dmg_pct: 27.0, kda_per_min: 0.45, solo_kill: 4, csd15: 2, gd15: 30, xpd15: 20, fb_part: 15, fb_victim: 10 } },
      { div: "1군", role: "SPT", name: "Vulcan", age: 25, contract: 2026, traits: ["ENGAGE_SUPPORT"], stats: { ovr: "A", dpm: 200, dmg_pct: 8.0, kda_per_min: 0.60, solo_kill: 1, csd15: 0, gd15: 40, xpd15: 20, fb_part: 50, fb_victim: 20 } },
      VACANT("SUB"),
    ],
  },

  "SR": {
    teamName: "Shopify Rebellion",
    financialTier: "B",
    money: 25.0,
    annualSupport: 20.0,
    roster: [
      // 2026: Zinie IN(MID)
      { div: "1군", role: "TOP", name: "Fudge", age: 22, contract: 2026, traits: ["VETERAN"], stats: { ovr: "B", dpm: 420, dmg_pct: 23.0, kda_per_min: 0.30, solo_kill: 4, csd15: 0, gd15: 0, xpd15: 0, fb_part: 15, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "Contractz", age: 25, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "B", dpm: 380, dmg_pct: 17.0, kda_per_min: 0.40, solo_kill: 3, csd15: -1, gd15: -10, xpd15: -5, fb_part: 45, fb_victim: 20 } },
      { div: "1군", role: "MID", name: "Zinie", age: 20, contract: 2026, traits: ["NEWBIE"], stats: { ovr: "C+", dpm: 450, dmg_pct: 25.0, kda_per_min: 0.35, solo_kill: 2, csd15: -2, gd15: -20, xpd15: -10, fb_part: 20, fb_victim: 20 } },
      { div: "1군", role: "ADC", name: "Bvoy", age: 26, contract: 2026, traits: ["STEADY"], stats: { ovr: "B+", dpm: 550, dmg_pct: 28.0, kda_per_min: 0.45, solo_kill: 5, csd15: 2, gd15: 20, xpd15: 10, fb_part: 15, fb_victim: 10 } },
      { div: "1군", role: "SPT", name: "Ceos", age: 22, contract: 2026, traits: [], stats: { ovr: "B", dpm: 150, dmg_pct: 7.0, kda_per_min: 0.50, solo_kill: 0, csd15: 0, gd15: 0, xpd15: 0, fb_part: 40, fb_victim: 20 } },
      VACANT("SUB"),
    ],
  },

  "LYON": {
    teamName: "Lyon Gaming",
    financialTier: "B",
    money: 25.0,
    annualSupport: 20.0,
    roster: [
      { div: "1군", role: "TOP", name: "Dhokla", age: 24, contract: 2027, traits: ["AGGRESSIVE", "STEADY"], stats: { ovr: "B+", dpm: 470, dmg_pct: 23.0, kda_per_min: 0.32, solo_kill: 5, csd15: 1, gd15: 10, xpd15: 5, fb_part: 18, fb_victim: 16 } },
      { div: "1군", role: "JGL", name: "Inspired", age: 22, contract: 2026, traits: ["SMART_JUNGLE", "CONTROL"], stats: { ovr: "A", dpm: 400, dmg_pct: 18.5, kda_per_min: 0.55, solo_kill: 5, csd15: 5, gd15: 50, xpd15: 40, fb_part: 50, fb_victim: 10 } },
      { div: "1군", role: "MID", name: "Saint", age: 22, contract: 2026, traits: [], stats: { ovr: "B-", dpm: 450, dmg_pct: 24.0, kda_per_min: 0.35, solo_kill: 3, csd15: -1, gd15: -10, xpd15: -5, fb_part: 25, fb_victim: 15 } },
      { div: "1군", role: "ADC", name: "Berserker", age: 21, contract: 2026, traits: ["HYPER_CARRY", "MECHANIC_GOD"], stats: { ovr: "A+", dpm: 650, dmg_pct: 30.0, kda_per_min: 0.60, solo_kill: 8, csd15: 8, gd15: 100, xpd15: 60, fb_part: 20, fb_victim: 10 } },
      { div: "1군", role: "SPT", name: "Isles", age: 22, contract: 2026, traits: [], stats: { ovr: "B", dpm: 160, dmg_pct: 6.5, kda_per_min: 0.50, solo_kill: 0, csd15: 0, gd15: 0, xpd15: 0, fb_part: 40, fb_victim: 20 } },
      VACANT("SUB"),
    ],
  },

  "SEN": {
    teamName: "Sentinels",
    financialTier: "C",
    money: 15.0,
    annualSupport: 12.0,
    roster: [
      // 2026: 신규 참가팀 - Impact/HamBak IN(TOP), DARKWINGS/Rahel/huhi 유지
      { div: "1군", role: "TOP", name: "Impact", age: 29, contract: 2026, traits: ["VETERAN", "WAILING_WALL"], stats: { ovr: "A-", dpm: 430, dmg_pct: 22.0, kda_per_min: 0.32, solo_kill: 4, csd15: 0, gd15: 0, xpd15: 0, fb_part: 18, fb_victim: 12 } },
      { div: "1군", role: "JGL", name: "HamBak", age: 21, contract: 2026, traits: ["JOKER_PICK"], stats: { ovr: "C+", dpm: 340, dmg_pct: 17.0, kda_per_min: 0.30, solo_kill: 2, csd15: -4, gd15: -25, xpd15: -15, fb_part: 35, fb_victim: 20 } },
      { div: "1군", role: "MID", name: "DARKWINGS", age: 20, contract: 2026, traits: ["NEWBIE"], stats: { ovr: "C", dpm: 400, dmg_pct: 24.0, kda_per_min: 0.30, solo_kill: 2, csd15: -3, gd15: -30, xpd15: -20, fb_part: 25, fb_victim: 20 } },
      { div: "1군", role: "ADC", name: "Rahel", age: 22, contract: 2026, traits: ["SPONGE"], stats: { ovr: "B-", dpm: 450, dmg_pct: 26.0, kda_per_min: 0.35, solo_kill: 3, csd15: -1, gd15: -10, xpd15: -5, fb_part: 20, fb_victim: 15 } },
      { div: "1군", role: "SPT", name: "huhi", age: 29, contract: 2026, traits: ["VETERAN"], stats: { ovr: "B", dpm: 180, dmg_pct: 7.0, kda_per_min: 0.50, solo_kill: 0, csd15: 0, gd15: 0, xpd15: 0, fb_part: 40, fb_victim: 20 } },
      VACANT("SUB"),
    ],
  },

  "DIG": {
    teamName: "Dignitas",
    financialTier: "B",
    money: 25.0,
    annualSupport: 20.0,
    roster: [
      // 2026: 리빌드 - Photon 유지, eXyu/Palafox/FBI/IgNar IN
      { div: "1군", role: "TOP", name: "Photon", age: 23, contract: 2026, traits: ["SOLO_KILL"], stats: { ovr: "B+", dpm: 480, dmg_pct: 23.0, kda_per_min: 0.35, solo_kill: 8, csd15: 3, gd15: 30, xpd15: 20, fb_part: 15, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "eXyu", age: 22, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "B", dpm: 370, dmg_pct: 17.0, kda_per_min: 0.38, solo_kill: 3, csd15: -1, gd15: -10, xpd15: -5, fb_part: 42, fb_victim: 18 } },
      { div: "1군", role: "MID", name: "Palafox", age: 24, contract: 2026, traits: ["STEADY"], stats: { ovr: "B", dpm: 480, dmg_pct: 25.0, kda_per_min: 0.38, solo_kill: 4, csd15: 0, gd15: 0, xpd15: 0, fb_part: 25, fb_victim: 15 } },
      { div: "1군", role: "ADC", name: "FBI", age: 25, contract: 2026, traits: ["AGGRESSIVE", "LANE_KINGDOM"], stats: { ovr: "A-", dpm: 600, dmg_pct: 29.0, kda_per_min: 0.50, solo_kill: 6, csd15: 5, gd15: 50, xpd15: 30, fb_part: 18, fb_victim: 12 } },
      { div: "1군", role: "SPT", name: "IgNar", age: 27, contract: 2026, traits: ["ENGAGE_SUPPORT", "VETERAN"], stats: { ovr: "B+", dpm: 190, dmg_pct: 7.5, kda_per_min: 0.55, solo_kill: 0, csd15: 0, gd15: 10, xpd15: 5, fb_part: 48, fb_victim: 18 } },
      VACANT("SUB"),
    ],
  },

  "DSG": {
    teamName: "Disguised",
    financialTier: "C",
    money: 15.0,
    annualSupport: 12.0,
    roster: [
      // 2026: Castle/KryRa/Callme 유지, Lyonz(SPT), Sajed(ADC) IN
      { div: "1군", role: "TOP", name: "Castle", age: 22, contract: 2026, traits: [], stats: { ovr: "C+", dpm: 380, dmg_pct: 22.0, kda_per_min: 0.25, solo_kill: 2, csd15: -2, gd15: -20, xpd15: -10, fb_part: 15, fb_victim: 20 } },
      { div: "1군", role: "JGL", name: "KryRa", age: 21, contract: 2026, traits: [], stats: { ovr: "C+", dpm: 350, dmg_pct: 16.0, kda_per_min: 0.30, solo_kill: 2, csd15: -2, gd15: -20, xpd15: -10, fb_part: 35, fb_victim: 20 } },
      { div: "1군", role: "MID", name: "Callme", age: 22, contract: 2026, traits: [], stats: { ovr: "C+", dpm: 420, dmg_pct: 24.5, kda_per_min: 0.30, solo_kill: 3, csd15: -1, gd15: -10, xpd15: -5, fb_part: 25, fb_victim: 15 } },
      { div: "1군", role: "ADC", name: "Sajed", age: 21, contract: 2026, traits: ["NEWBIE"], stats: { ovr: "C", dpm: 430, dmg_pct: 26.0, kda_per_min: 0.32, solo_kill: 2, csd15: -3, gd15: -25, xpd15: -15, fb_part: 15, fb_victim: 18 } },
      { div: "1군", role: "SPT", name: "Lyonz", age: 22, contract: 2026, traits: ["NEWBIE"], stats: { ovr: "C", dpm: 140, dmg_pct: 6.5, kda_per_min: 0.38, solo_kill: 0, csd15: -4, gd15: -30, xpd15: -15, fb_part: 32, fb_victim: 22 } },
      VACANT("SUB"),
    ],
  },
};

// ───────────────────────────────────────────────────
// LEC — 2026 Versus Season (10 teams)
// Team BDS → Shifters, Movistar KOI → KOI
// ───────────────────────────────────────────────────
export const LEC_TEAMS: Record<string, TeamData> = {
  "G2": {
    teamName: "G2 Esports",
    financialTier: "S",
    money: 55.0,
    annualSupport: 48.0,
    roster: [
      // 2026: 로스터 변동 없음
      { div: "1군", role: "TOP", name: "BrokenBlade", age: 24, contract: 2026, traits: ["LANE_KINGDOM", "CLUTCH"], stats: { ovr: "S-", dpm: 600, dmg_pct: 24.0, kda_per_min: 0.48, solo_kill: 10, csd15: 8, gd15: 120, xpd15: 80, fb_part: 25, fb_victim: 10 } },
      { div: "1군", role: "JGL", name: "SkewMond", age: 21, contract: 2026, traits: ["SMART", "GROWTH_POTENTIAL"], stats: { ovr: "A", dpm: 400, dmg_pct: 17.0, kda_per_min: 0.52, solo_kill: 4, csd15: 5, gd15: 80, xpd15: 60, fb_part: 50, fb_victim: 12 } },
      { div: "1군", role: "MID", name: "Caps", age: 25, contract: 2027, traits: ["CLUTCH", "HEXAGON", "BIG_GAME_PLAYER"], stats: { ovr: "S", dpm: 680, dmg_pct: 28.0, kda_per_min: 0.55, solo_kill: 12, csd15: 10, gd15: 150, xpd15: 100, fb_part: 30, fb_victim: 8 } },
      { div: "1군", role: "ADC", name: "Hans Sama", age: 25, contract: 2026, traits: ["CONSISTENT", "VETERAN"], stats: { ovr: "A+", dpm: 650, dmg_pct: 29.0, kda_per_min: 0.50, solo_kill: 6, csd15: 8, gd15: 100, xpd15: 60, fb_part: 18, fb_victim: 8 } },
      { div: "1군", role: "SPT", name: "Labrov", age: 24, contract: 2026, traits: ["AGGRESSIVE", "PLAYMAKER"], stats: { ovr: "A", dpm: 200, dmg_pct: 8.0, kda_per_min: 0.55, solo_kill: 1, csd15: 1, gd15: 30, xpd15: 20, fb_part: 48, fb_victim: 15 } },
      VACANT("SUB"),
    ],
  },

  "KC": {
    teamName: "Karmine Corp",
    financialTier: "A",
    money: 45.0,
    annualSupport: 38.0,
    roster: [
      { div: "1군", role: "TOP", name: "Canna", age: 26, contract: 2026, traits: ["VETERAN", "LANE_KINGDOM"], stats: { ovr: "A", dpm: 560, dmg_pct: 24.0, kda_per_min: 0.42, solo_kill: 8, csd15: 6, gd15: 80, xpd15: 60, fb_part: 22, fb_victim: 12 } },
      { div: "1군", role: "JGL", name: "Yike", age: 23, contract: 2026, traits: ["SMART", "CONSISTENT"], stats: { ovr: "A", dpm: 380, dmg_pct: 16.5, kda_per_min: 0.50, solo_kill: 3, csd15: 4, gd15: 60, xpd15: 50, fb_part: 48, fb_victim: 12 } },
      { div: "1군", role: "MID", name: "kyeahoo", age: 20, contract: 2027, traits: ["GROWTH_POTENTIAL", "AGGRESSIVE"], stats: { ovr: "B+", dpm: 500, dmg_pct: 25.0, kda_per_min: 0.40, solo_kill: 5, csd15: 3, gd15: 40, xpd15: 30, fb_part: 25, fb_victim: 15 } },
      { div: "1군", role: "ADC", name: "Caliste", age: 22, contract: 2026, traits: ["GROWTH_POTENTIAL", "CONSISTENT"], stats: { ovr: "A-", dpm: 600, dmg_pct: 28.0, kda_per_min: 0.45, solo_kill: 4, csd15: 5, gd15: 60, xpd15: 40, fb_part: 16, fb_victim: 10 } },
      { div: "1군", role: "SPT", name: "Busio", age: 22, contract: 2026, traits: ["PLAYMAKER"], stats: { ovr: "B+", dpm: 170, dmg_pct: 7.0, kda_per_min: 0.45, solo_kill: 0, csd15: 0, gd15: -5, xpd15: -5, fb_part: 42, fb_victim: 18 } },
      VACANT("SUB"),
    ],
  },

  "FNC": {
    teamName: "Fnatic",
    financialTier: "A",
    money: 50.0,
    annualSupport: 42.0,
    roster: [
      // 2026: Humanoid OUT→VIT, Empyros IN(TOP from LFL), Vladi IN(MID from KC), Lospa IN(SPT)
      { div: "1군", role: "TOP", name: "Empyros", age: 21, contract: 2027, traits: ["GROWTH_POTENTIAL", "AGGRESSIVE"], stats: { ovr: "B+", dpm: 480, dmg_pct: 23.0, kda_per_min: 0.38, solo_kill: 6, csd15: 3, gd15: 30, xpd15: 20, fb_part: 20, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "Razork", age: 24, contract: 2026, traits: ["GANKING_MACHINE", "VETERAN"], stats: { ovr: "A", dpm: 390, dmg_pct: 16.0, kda_per_min: 0.48, solo_kill: 3, csd15: 3, gd15: 50, xpd15: 40, fb_part: 52, fb_victim: 12 } },
      { div: "1군", role: "MID", name: "Vladi", age: 22, contract: 2027, traits: ["HYPER_MECHANIC", "GROWTH_POTENTIAL"], stats: { ovr: "A-", dpm: 560, dmg_pct: 26.0, kda_per_min: 0.45, solo_kill: 7, csd15: 5, gd15: 70, xpd15: 50, fb_part: 28, fb_victim: 12 } },
      { div: "1군", role: "ADC", name: "Upset", age: 25, contract: 2026, traits: ["CONSISTENT", "STEADY"], stats: { ovr: "A", dpm: 640, dmg_pct: 29.0, kda_per_min: 0.50, solo_kill: 5, csd15: 8, gd15: 90, xpd15: 60, fb_part: 16, fb_victim: 8 } },
      { div: "1군", role: "SPT", name: "Lospa", age: 22, contract: 2027, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "B", dpm: 150, dmg_pct: 7.0, kda_per_min: 0.42, solo_kill: 0, csd15: -1, gd15: -10, xpd15: -5, fb_part: 40, fb_victim: 18 } },
      VACANT("SUB"),
    ],
  },

  "KOI": {
    teamName: "KOI",
    financialTier: "B",
    money: 30.0,
    annualSupport: 25.0,
    roster: [
      { div: "1군", role: "TOP", name: "Myrwn", age: 22, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "B+", dpm: 480, dmg_pct: 23.5, kda_per_min: 0.38, solo_kill: 5, csd15: 2, gd15: 20, xpd15: 15, fb_part: 20, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "Elyoya", age: 24, contract: 2026, traits: ["GANKING_MACHINE", "CLUTCH"], stats: { ovr: "A", dpm: 400, dmg_pct: 17.0, kda_per_min: 0.50, solo_kill: 4, csd15: 4, gd15: 60, xpd15: 45, fb_part: 50, fb_victim: 12 } },
      { div: "1군", role: "MID", name: "Jojopyun", age: 21, contract: 2026, traits: ["AGGRESSIVE", "CLUTCH"], stats: { ovr: "A-", dpm: 540, dmg_pct: 26.0, kda_per_min: 0.42, solo_kill: 7, csd15: 4, gd15: 50, xpd15: 40, fb_part: 28, fb_victim: 14 } },
      { div: "1군", role: "ADC", name: "Supa", age: 22, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "B+", dpm: 560, dmg_pct: 27.5, kda_per_min: 0.42, solo_kill: 3, csd15: 3, gd15: 30, xpd15: 20, fb_part: 16, fb_victim: 12 } },
      { div: "1군", role: "SPT", name: "Alvaro", age: 23, contract: 2026, traits: ["STEADY"], stats: { ovr: "B+", dpm: 160, dmg_pct: 7.0, kda_per_min: 0.45, solo_kill: 0, csd15: 0, gd15: 5, xpd15: 5, fb_part: 42, fb_victim: 16 } },
      { div: "1군", role: "SUB", name: "ToniOP", age: 21, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "B-", dpm: 470, dmg_pct: 23.0, kda_per_min: 0.35, solo_kill: 4, csd15: 1, gd15: 10, xpd15: 10, fb_part: 18, fb_victim: 16 } },
    ],
  },

  "GX": {
    teamName: "GIANTX",
    financialTier: "B",
    money: 30.0,
    annualSupport: 25.0,
    roster: [
      // 2026: 로스터 변동 없음
      { div: "1군", role: "TOP", name: "Lot", age: 22, contract: 2026, traits: ["GROWTH_POTENTIAL", "AGGRESSIVE"], stats: { ovr: "B+", dpm: 500, dmg_pct: 24.0, kda_per_min: 0.38, solo_kill: 6, csd15: 3, gd15: 30, xpd15: 25, fb_part: 22, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "ISMA", age: 22, contract: 2026, traits: ["SMART", "GROWTH_POTENTIAL"], stats: { ovr: "B+", dpm: 360, dmg_pct: 16.0, kda_per_min: 0.45, solo_kill: 3, csd15: 2, gd15: 30, xpd15: 25, fb_part: 45, fb_victim: 15 } },
      { div: "1군", role: "MID", name: "Jackies", age: 22, contract: 2026, traits: ["CONSISTENT"], stats: { ovr: "B+", dpm: 520, dmg_pct: 26.0, kda_per_min: 0.42, solo_kill: 5, csd15: 3, gd15: 40, xpd15: 30, fb_part: 25, fb_victim: 14 } },
      { div: "1군", role: "ADC", name: "Noah", age: 23, contract: 2026, traits: ["CONSISTENT", "STEADY"], stats: { ovr: "A-", dpm: 620, dmg_pct: 28.5, kda_per_min: 0.48, solo_kill: 4, csd15: 6, gd15: 70, xpd15: 45, fb_part: 16, fb_victim: 10 } },
      { div: "1군", role: "SPT", name: "Jun", age: 24, contract: 2026, traits: ["PLAYMAKER"], stats: { ovr: "B+", dpm: 170, dmg_pct: 7.5, kda_per_min: 0.48, solo_kill: 0, csd15: 1, gd15: 10, xpd15: 10, fb_part: 45, fb_victim: 15 } },
      VACANT("SUB"),
    ],
  },

  "VIT": {
    teamName: "Team Vitality",
    financialTier: "A",
    money: 40.0,
    annualSupport: 32.0,
    roster: [
      // 2026: Czajek OUT, Humanoid IN(MID from FNC)
      { div: "1군", role: "TOP", name: "Naak Nako", age: 22, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "B+", dpm: 480, dmg_pct: 23.0, kda_per_min: 0.38, solo_kill: 5, csd15: 2, gd15: 25, xpd15: 20, fb_part: 20, fb_victim: 15 } },
      { div: "1군", role: "JGL", name: "Lyncas", age: 22, contract: 2026, traits: ["AGGRESSIVE", "GROWTH_POTENTIAL"], stats: { ovr: "B+", dpm: 370, dmg_pct: 16.5, kda_per_min: 0.42, solo_kill: 3, csd15: 2, gd15: 25, xpd15: 20, fb_part: 45, fb_victim: 16 } },
      { div: "1군", role: "MID", name: "Humanoid", age: 25, contract: 2027, traits: ["VETERAN", "CLUTCH", "LANE_KINGDOM"], stats: { ovr: "A+", dpm: 620, dmg_pct: 27.0, kda_per_min: 0.50, solo_kill: 10, csd15: 8, gd15: 100, xpd15: 70, fb_part: 28, fb_victim: 10 } },
      { div: "1군", role: "ADC", name: "Carzzy", age: 24, contract: 2026, traits: ["CLUTCH", "AGGRESSIVE"], stats: { ovr: "A", dpm: 620, dmg_pct: 28.5, kda_per_min: 0.48, solo_kill: 5, csd15: 5, gd15: 60, xpd15: 40, fb_part: 18, fb_victim: 12 } },
      { div: "1군", role: "SPT", name: "Fleshy", age: 22, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "B+", dpm: 160, dmg_pct: 7.0, kda_per_min: 0.42, solo_kill: 0, csd15: 0, gd15: -5, xpd15: -5, fb_part: 42, fb_victim: 16 } },
      VACANT("SUB"),
    ],
  },

  "SFT": {
    teamName: "Shifters",
    financialTier: "B",
    money: 25.0,
    annualSupport: 20.0,
    roster: [
      // 2026: Ice OUT→TH, Paduck IN(ADC from KT CL), Trymbi IN(SPT) (구 Team BDS)
      { div: "1군", role: "TOP", name: "Rooster", age: 22, contract: 2026, traits: ["STEADY"], stats: { ovr: "B", dpm: 450, dmg_pct: 23.0, kda_per_min: 0.35, solo_kill: 4, csd15: 1, gd15: 10, xpd15: 10, fb_part: 18, fb_victim: 16 } },
      { div: "1군", role: "JGL", name: "Boukada", age: 21, contract: 2026, traits: ["GROWTH_POTENTIAL", "AGGRESSIVE"], stats: { ovr: "B+", dpm: 360, dmg_pct: 16.0, kda_per_min: 0.40, solo_kill: 3, csd15: 2, gd15: 20, xpd15: 15, fb_part: 45, fb_victim: 16 } },
      { div: "1군", role: "MID", name: "nuc", age: 22, contract: 2026, traits: ["CONSISTENT"], stats: { ovr: "B+", dpm: 510, dmg_pct: 25.5, kda_per_min: 0.40, solo_kill: 5, csd15: 3, gd15: 35, xpd15: 25, fb_part: 24, fb_victim: 14 } },
      { div: "1군", role: "ADC", name: "Paduck", age: 21, contract: 2027, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "B", dpm: 520, dmg_pct: 27.0, kda_per_min: 0.38, solo_kill: 3, csd15: 2, gd15: 15, xpd15: 10, fb_part: 15, fb_victim: 14 } },
      { div: "1군", role: "SPT", name: "Trymbi", age: 24, contract: 2026, traits: ["VETERAN", "PLAYMAKER"], stats: { ovr: "A-", dpm: 180, dmg_pct: 7.5, kda_per_min: 0.48, solo_kill: 0, csd15: 1, gd15: 15, xpd15: 10, fb_part: 46, fb_victim: 14 } },
      VACANT("SUB"),
    ],
  },

  "TH": {
    teamName: "Team Heretics",
    financialTier: "B",
    money: 28.0,
    annualSupport: 22.0,
    roster: [
      { div: "1군", role: "TOP", name: "Tracyn", age: 21, contract: 2027, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "B", dpm: 440, dmg_pct: 22.5, kda_per_min: 0.35, solo_kill: 4, csd15: 1, gd15: 10, xpd15: 10, fb_part: 18, fb_victim: 16 } },
      { div: "1군", role: "JGL", name: "Sheo", age: 23, contract: 2026, traits: ["SMART"], stats: { ovr: "B+", dpm: 370, dmg_pct: 16.0, kda_per_min: 0.42, solo_kill: 3, csd15: 2, gd15: 25, xpd15: 20, fb_part: 44, fb_victim: 15 } },
      { div: "1군", role: "MID", name: "Serin", age: 21, contract: 2027, traits: ["GROWTH_POTENTIAL", "AGGRESSIVE"], stats: { ovr: "B", dpm: 480, dmg_pct: 25.0, kda_per_min: 0.38, solo_kill: 5, csd15: 2, gd15: 20, xpd15: 15, fb_part: 25, fb_victim: 16 } },
      { div: "1군", role: "ADC", name: "Ice", age: 23, contract: 2026, traits: ["CONSISTENT", "STEADY"], stats: { ovr: "A-", dpm: 590, dmg_pct: 28.0, kda_per_min: 0.45, solo_kill: 4, csd15: 5, gd15: 50, xpd15: 35, fb_part: 16, fb_victim: 10 } },
      { div: "1군", role: "SPT", name: "Way", age: 21, contract: 2026, traits: ["STEADY"], stats: { ovr: "B", dpm: 150, dmg_pct: 7.0, kda_per_min: 0.40, solo_kill: 0, csd15: -1, gd15: -10, xpd15: -5, fb_part: 40, fb_victim: 18 } },
      VACANT("SUB"),
    ],
  },

  "SK": {
    teamName: "SK Gaming",
    financialTier: "B",
    money: 30.0,
    annualSupport: 25.0,
    roster: [
      // 2026: 대규모 개편 — Wunder IN(TOP), LIDER IN(MID), Jopa IN(ADC), Mikyx IN(SPT), Skeanz 유지
      { div: "1군", role: "TOP", name: "Wunder", age: 26, contract: 2026, traits: ["VETERAN", "CLUTCH"], stats: { ovr: "A-", dpm: 520, dmg_pct: 23.5, kda_per_min: 0.42, solo_kill: 6, csd15: 4, gd15: 50, xpd15: 40, fb_part: 20, fb_victim: 12 } },
      { div: "1군", role: "JGL", name: "Skeanz", age: 24, contract: 2026, traits: ["STEADY"], stats: { ovr: "B", dpm: 340, dmg_pct: 15.5, kda_per_min: 0.38, solo_kill: 2, csd15: 1, gd15: 10, xpd15: 10, fb_part: 40, fb_victim: 18 } },
      { div: "1군", role: "MID", name: "LIDER", age: 24, contract: 2026, traits: ["AGGRESSIVE", "HYPER_MECHANIC"], stats: { ovr: "B+", dpm: 530, dmg_pct: 26.0, kda_per_min: 0.40, solo_kill: 8, csd15: 4, gd15: 45, xpd15: 35, fb_part: 26, fb_victim: 16 } },
      { div: "1군", role: "ADC", name: "Jopa", age: 21, contract: 2027, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "B", dpm: 520, dmg_pct: 27.0, kda_per_min: 0.38, solo_kill: 3, csd15: 2, gd15: 15, xpd15: 10, fb_part: 15, fb_victim: 14 } },
      { div: "1군", role: "SPT", name: "Mikyx", age: 26, contract: 2026, traits: ["VETERAN", "COMMANDER", "PLAYMAKER"], stats: { ovr: "A", dpm: 190, dmg_pct: 7.5, kda_per_min: 0.52, solo_kill: 1, csd15: 2, gd15: 30, xpd15: 20, fb_part: 48, fb_victim: 12 } },
      VACANT("SUB"),
    ],
  },

  "NAVI": {
    teamName: "Natus Vincere",
    financialTier: "C",
    money: 20.0,
    annualSupport: 16.0,
    roster: [
      { div: "1군", role: "TOP", name: "Maynter", age: 21, contract: 2026, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "B", dpm: 430, dmg_pct: 22.5, kda_per_min: 0.35, solo_kill: 4, csd15: 1, gd15: 5, xpd15: 5, fb_part: 18, fb_victim: 16 } },
      { div: "1군", role: "JGL", name: "Rhilech", age: 22, contract: 2026, traits: ["AGGRESSIVE"], stats: { ovr: "B", dpm: 350, dmg_pct: 16.0, kda_per_min: 0.38, solo_kill: 3, csd15: 1, gd15: 10, xpd15: 10, fb_part: 42, fb_victim: 18 } },
      { div: "1군", role: "MID", name: "Poby", age: 21, contract: 2027, traits: ["GROWTH_POTENTIAL"], stats: { ovr: "B", dpm: 480, dmg_pct: 25.0, kda_per_min: 0.38, solo_kill: 4, csd15: 2, gd15: 20, xpd15: 15, fb_part: 24, fb_victim: 16 } },
      { div: "1군", role: "ADC", name: "SamD", age: 22, contract: 2026, traits: ["CONSISTENT"], stats: { ovr: "B+", dpm: 560, dmg_pct: 27.5, kda_per_min: 0.42, solo_kill: 3, csd15: 4, gd15: 35, xpd15: 25, fb_part: 16, fb_victim: 12 } },
      { div: "1군", role: "SPT", name: "Parus", age: 22, contract: 2026, traits: ["STEADY"], stats: { ovr: "B", dpm: 150, dmg_pct: 7.0, kda_per_min: 0.40, solo_kill: 0, csd15: -1, gd15: -10, xpd15: -5, fb_part: 40, fb_victim: 18 } },
      { div: "1군", role: "SUB", name: "Larssen", age: 28, contract: 2026, traits: ["VETERAN"], stats: { ovr: "A-", dpm: 560, dmg_pct: 26.0, kda_per_min: 0.44, solo_kill: 5, csd15: 4, gd15: 40, xpd15: 30, fb_part: 24, fb_victim: 12 } },
    ],
  },
};
