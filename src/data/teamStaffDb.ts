import type { Region } from '../types/game';
import type { CoachingPhilosophy, StaffRole, StaffSpecialty } from '../types/staff';

export interface TeamStaffSeedEntry {
  name: string;
  role: StaffRole;
  nationality?: string;
  ability?: number;
  specialty?: StaffSpecialty | null;
  salary?: number;
  philosophy?: CoachingPhilosophy | null;
}

const DEFAULT_NATIONALITY_BY_REGION: Record<Region, string> = {
  LCK: 'KR',
  LPL: 'CN',
  LEC: 'EU',
  LCS: 'NA',
};

export function getDefaultStaffNationality(region: Region, override?: string): string {
  return override ?? DEFAULT_NATIONALITY_BY_REGION[region] ?? 'KR';
}

export const TEAM_STAFF_DB: Record<string, TeamStaffSeedEntry[]> = {
  lck_T1: [
    { name: 'Tom', role: 'head_coach', ability: 84, specialty: 'draft', philosophy: 'balanced' },
    { name: 'Mata', role: 'coach', ability: 79, specialty: 'mentoring' },
  ],
  lck_GEN: [
    { name: 'Ryu', role: 'head_coach', ability: 83, specialty: 'draft', philosophy: 'balanced' },
    { name: 'Lyn', role: 'coach', ability: 77, specialty: 'training' },
    { name: 'Nova', role: 'coach', ability: 73, specialty: 'conditioning' },
  ],
  lck_HLE: [
    { name: 'Homme', role: 'head_coach', ability: 85, specialty: 'draft', philosophy: 'balanced' },
    { name: 'Mowgli', role: 'coach', ability: 74, specialty: 'training' },
    { name: 'Sin', role: 'coach', ability: 72, specialty: 'mentoring' },
  ],
  lck_DK: [
    { name: 'cvMax', role: 'head_coach', ability: 82, specialty: 'draft', philosophy: 'aggressive' },
    { name: 'PoohManDu', role: 'coach', ability: 76, specialty: 'mentoring' },
    { name: 'Hachani', role: 'coach', ability: 73, specialty: 'training' },
  ],
  lck_KT: [
    { name: 'Score', role: 'head_coach', ability: 82, specialty: 'training', philosophy: 'balanced' },
    { name: 'Museong', role: 'coach', ability: 74, specialty: 'mentoring' },
    { name: 'Sonstar', role: 'coach', ability: 75, specialty: 'draft' },
    { name: 'Highness', role: 'analyst', ability: 68, specialty: 'draft' },
  ],
  lck_SOOPers: [
    { name: 'oDin', role: 'head_coach', ability: 78, specialty: 'draft', philosophy: 'balanced' },
    { name: 'Ggoong', role: 'coach', ability: 74, specialty: 'training' },
    { name: 'Cube', role: 'coach', ability: 72, specialty: 'mentoring' },
    { name: 'Minit', role: 'coach', ability: 70, specialty: 'training' },
    { name: 'Millimas', role: 'analyst', ability: 67, specialty: 'draft' },
  ],
  lck_NS: [
    { name: 'DanDy', role: 'head_coach', ability: 79, specialty: 'training', philosophy: 'aggressive' },
    { name: 'Chelly', role: 'coach', ability: 73, specialty: 'draft' },
    { name: 'Crazy', role: 'coach', ability: 70, specialty: 'mentoring' },
  ],
  lck_BFX: [
    { name: 'Edo', role: 'head_coach', ability: 78, specialty: 'mentoring', philosophy: 'balanced' },
    { name: 'Lira', role: 'coach', ability: 75, specialty: 'training' },
    { name: 'Rather', role: 'coach', ability: 73, specialty: 'draft' },
    { name: 'Yvon', role: 'analyst', ability: 69, specialty: 'draft' },
  ],
  lck_BRION: [
    { name: 'Ssong', role: 'head_coach', ability: 78, specialty: 'training', philosophy: 'balanced' },
    { name: 'Duke', role: 'coach', ability: 72, specialty: 'conditioning' },
  ],
  lck_KRX: [
    { name: 'Joker', role: 'head_coach', ability: 74, specialty: 'draft', philosophy: 'balanced' },
    { name: 'Naehyun', role: 'coach', ability: 69, specialty: 'training' },
    { name: 'Saroo', role: 'coach', ability: 67, specialty: 'draft' },
  ],

  lpl_BLG: [
    { name: 'Daeny', role: 'head_coach', nationality: 'KR', ability: 83, specialty: 'draft', philosophy: 'aggressive' },
    { name: 'Chieh', role: 'coach', ability: 76, specialty: 'training' },
    { name: 'zyb', role: 'coach', ability: 72, specialty: 'mentoring' },
    { name: 'Ben', role: 'coach', nationality: 'KR', ability: 74, specialty: 'draft' },
  ],
  lpl_TES: [
    { name: 'Poppy', role: 'head_coach', ability: 78, specialty: 'draft', philosophy: 'balanced' },
    { name: 'BoBo', role: 'coach', ability: 73, specialty: 'training' },
  ],
  lpl_JDG: [
    { name: 'Tabe', role: 'head_coach', ability: 84, specialty: 'draft', philosophy: 'balanced' },
    { name: 'Xiaobai', role: 'coach', ability: 76, specialty: 'training' },
    { name: 'Zoom', role: 'coach', ability: 72, specialty: 'mentoring' },
    { name: 'Zizheng', role: 'analyst', ability: 68, specialty: 'draft' },
  ],
  lpl_IG: [
    { name: 'Mafa', role: 'head_coach', nationality: 'KR', ability: 79, specialty: 'draft', philosophy: 'balanced' },
    { name: 'KaKAO', role: 'coach', nationality: 'KR', ability: 74, specialty: 'mentoring' },
    { name: 'yongsoo', role: 'analyst', nationality: 'KR', ability: 69, specialty: 'draft' },
  ],
  lpl_WBG: [
    { name: 'Shine', role: 'head_coach', ability: 78, specialty: 'training', philosophy: 'balanced' },
    { name: 'Tselin', role: 'coach', ability: 70, specialty: 'conditioning' },
    { name: 'Medusa', role: 'analyst', ability: 68, specialty: 'draft' },
  ],
  lpl_NIP: [
    { name: 'Maizijian', role: 'head_coach', ability: 75, specialty: 'draft', philosophy: 'balanced' },
    { name: 'Renzhe', role: 'coach', ability: 72, specialty: 'training' },
  ],
  lpl_EDG: [
    { name: 'Clearlove', role: 'head_coach', ability: 80, specialty: 'training', philosophy: 'balanced' },
    { name: 'Maokai', role: 'coach', ability: 76, specialty: 'draft' },
    { name: 'Mni', role: 'coach', ability: 72, specialty: 'mentoring' },
    { name: 'Liet', role: 'coach', ability: 70, specialty: 'training' },
  ],
  lpl_AL: [
    { name: 'Helper', role: 'head_coach', nationality: 'KR', ability: 82, specialty: 'draft', philosophy: 'aggressive' },
    { name: 'Teacherma', role: 'coach', ability: 74, specialty: 'training' },
  ],
  lpl_WE: [
    { name: 'JinJin', role: 'head_coach', ability: 73, specialty: 'draft', philosophy: 'balanced' },
    { name: '694', role: 'coach', ability: 70, specialty: 'training' },
  ],
  lpl_LGD: [
    { name: '1874', role: 'head_coach', ability: 70, specialty: 'training', philosophy: 'developmental' },
    { name: 'Chelizi', role: 'coach', ability: 67, specialty: 'training' },
  ],
  lpl_UP: [
    { name: 'Yuzhang', role: 'head_coach', ability: 69, specialty: 'training', philosophy: 'balanced' },
    { name: 'ScreamM', role: 'coach', ability: 65, specialty: 'mentoring' },
  ],
  lpl_TT: [
    { name: 'NONAME', role: 'head_coach', ability: 69, specialty: 'draft', philosophy: 'balanced' },
    { name: 'XiaoLvBu', role: 'coach', ability: 66, specialty: 'training' },
  ],
  lpl_LNG: [
    { name: 'Edgar', role: 'head_coach', nationality: 'KR', ability: 76, specialty: 'draft', philosophy: 'balanced' },
    { name: 'Viod', role: 'coach', ability: 72, specialty: 'training' },
  ],
  lpl_OMG: [
    { name: 'chengz', role: 'head_coach', ability: 70, specialty: 'training', philosophy: 'developmental' },
    { name: 'Yondaime', role: 'coach', ability: 67, specialty: 'training' },
  ],

  lcs_FLY: [
    { name: 'Thinkcard', role: 'head_coach', ability: 79, specialty: 'draft', philosophy: 'balanced' },
    { name: 'Apollo', role: 'coach', ability: 72, specialty: 'mentoring' },
  ],
  lcs_TL: [
    { name: 'Spawn', role: 'head_coach', ability: 80, specialty: 'training', philosophy: 'balanced' },
    { name: 'Spookz', role: 'coach', ability: 77, specialty: 'draft' },
    { name: 'Haitham', role: 'analyst', ability: 69, specialty: 'draft' },
  ],
  lcs_C9: [
    { name: 'Inero', role: 'head_coach', ability: 82, specialty: 'draft', philosophy: 'aggressive' },
    { name: 'Veigar v2', role: 'coach', nationality: 'EU', ability: 74, specialty: 'draft' },
    { name: 'IWDominate', role: 'analyst', ability: 70, specialty: 'mentoring' },
  ],
  lcs_SR: [
    { name: 'Reven', role: 'head_coach', ability: 72, specialty: 'training', philosophy: 'balanced' },
    { name: 'Damonte', role: 'coach', ability: 70, specialty: 'mentoring' },
  ],
  lcs_LYON: [
    { name: 'Reignover', role: 'head_coach', nationality: 'KR', ability: 78, specialty: 'training', philosophy: 'balanced' },
    { name: 'Rigby', role: 'coach', nationality: 'KR', ability: 73, specialty: 'draft' },
  ],
  lcs_SEN: [
    { name: 'Goldenglue', role: 'head_coach', ability: 74, specialty: 'draft', philosophy: 'balanced' },
    { name: 'Dayos', role: 'coach', ability: 68, specialty: 'mentoring' },
  ],
  lcs_DIG: [
    { name: 'Swiffer', role: 'head_coach', ability: 75, specialty: 'training', philosophy: 'balanced' },
    { name: 'Emi', role: 'coach', ability: 71, specialty: 'draft' },
  ],
  lcs_DSG: [
    { name: 'ido', role: 'head_coach', ability: 72, specialty: 'training', philosophy: 'developmental' },
    { name: 'Brandini', role: 'coach', ability: 68, specialty: 'mentoring' },
  ],

  lec_G2: [
    { name: 'Dylan Falco', role: 'head_coach', ability: 84, specialty: 'draft', philosophy: 'balanced' },
    { name: 'Memento', role: 'coach', ability: 74, specialty: 'training' },
    { name: 'Rodrigo', role: 'coach', ability: 73, specialty: 'mentoring' },
  ],
  lec_KC: [
    { name: 'Reapered', role: 'head_coach', nationality: 'KR', ability: 82, specialty: 'draft', philosophy: 'balanced' },
    { name: 'Zeph', role: 'coach', ability: 74, specialty: 'training' },
  ],
  lec_FNC: [
    { name: 'GrabbZ', role: 'head_coach', ability: 79, specialty: 'training', philosophy: 'balanced' },
    { name: 'Gaax', role: 'coach', ability: 75, specialty: 'draft' },
  ],
  lec_KOI: [
    { name: 'Melzhet', role: 'head_coach', ability: 78, specialty: 'draft', philosophy: 'balanced' },
    { name: 'Alphari', role: 'coach', ability: 70, specialty: 'training' },
    { name: 'Independent', role: 'coach', ability: 72, specialty: 'training' },
    { name: 'Aagie', role: 'analyst', ability: 67, specialty: 'draft' },
  ],
  lec_GX: [
    { name: 'Guilhoto', role: 'head_coach', ability: 77, specialty: 'training', philosophy: 'balanced' },
    { name: 'Maxlore', role: 'coach', ability: 70, specialty: 'training' },
    { name: 'Rhuckz', role: 'coach', ability: 69, specialty: 'mentoring' },
  ],
  lec_VIT: [
    { name: 'Pad', role: 'head_coach', ability: 74, specialty: 'training', philosophy: 'developmental' },
    { name: 'Garih', role: 'coach', ability: 71, specialty: 'training' },
    { name: 'Lukezy', role: 'coach', ability: 69, specialty: 'mentoring' },
    { name: 'Arvindir', role: 'coach', ability: 73, specialty: 'draft' },
  ],
  lec_SFT: [
    { name: 'Striker', role: 'head_coach', ability: 75, specialty: 'training', philosophy: 'balanced' },
    { name: 'MenQ', role: 'coach', ability: 70, specialty: 'draft' },
    { name: 'Cabochard', role: 'coach', ability: 68, specialty: 'mentoring' },
  ],
  lec_TH: [
    { name: 'Hidon', role: 'head_coach', ability: 76, specialty: 'mentoring', philosophy: 'developmental' },
    { name: 'Arkhe', role: 'coach', ability: 72, specialty: 'training' },
    { name: 'Mithy', role: 'coach', ability: 74, specialty: 'draft' },
    { name: 'Deam147', role: 'analyst', ability: 68, specialty: 'draft' },
  ],
  lec_SK: [
    { name: 'OWN3R', role: 'head_coach', ability: 74, specialty: 'draft', philosophy: 'balanced' },
    { name: 'Baguette', role: 'coach', ability: 70, specialty: 'training' },
    { name: 'Duffman', role: 'coach', ability: 68, specialty: 'mentoring' },
  ],
  lec_NAVI: [
    { name: 'TheRock', role: 'head_coach', ability: 71, specialty: 'training', philosophy: 'balanced' },
    { name: 'GotoOne', role: 'coach', ability: 68, specialty: 'draft' },
    { name: 'Lopon', role: 'coach', ability: 67, specialty: 'training' },
    { name: 'Sanchi', role: 'analyst', ability: 67, specialty: 'draft' },
  ],
};
