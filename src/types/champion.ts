import type { Position } from './game';

/** 챔피언 빌드 타입 — 아이템 경로를 추상화 */
export type BuildType =
  | 'ap_burst'        // AP 폭딜 (루덴, 라바돈)
  | 'ap_dps'          // AP 지속딜 (리안드리, 나셔)
  | 'ap_utility'      // AP 유틸 (제국, 슈렐리아)
  | 'ad_crit'         // AD 치명타 (크라켄, IE)
  | 'ad_lethality'    // AD 관통 (이클립스, 요우무)
  | 'bruiser_ad'      // AD 브루저 (삼위, 스테락)
  | 'bruiser_ap'      // AP 브루저 (리프트, 코대)
  | 'tank'            // 풀탱크 (선파케, 가시갑옷)
  | 'enchanter'       // 인챈터 서포트 (달빛석, 구원)
  | 'engage_tank'     // 이니시에이터 탱크 (로켓벨트, 솔라리)
  | 'on_hit'          // 온힛 (구인수, 종말)
  | 'hybrid';         // 하이브리드 (건블, 내셔+AP)

/** 챔피언 데미지 타입 */
export type DamageProfile = 'physical' | 'magic' | 'hybrid' | 'true';

export interface Champion {
  id: string;
  name: string;
  nameKo: string;
  primaryRole: Position;            // 주 포지션 (성능 100%)
  secondaryRoles: Position[];       // 부 포지션 (성능 감소, 없으면 빈 배열)
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  tags: ChampionTag[];
  stats: ChampionStats;
  /** 주요 빌드 타입 */
  primaryBuild: BuildType;
  /** 대체 빌드 (유연 픽) */
  secondaryBuild: BuildType | null;
  /** 주 데미지 타입 */
  damageProfile: DamageProfile;
}

export type ChampionTag =
  | 'assassin'
  | 'fighter'
  | 'mage'
  | 'marksman'
  | 'support'
  | 'tank'
  | 'engage'
  | 'poke'
  | 'splitpush'
  | 'teamfight'
  | 'utility'
  | 'hypercarry';

export interface ChampionStats {
  earlyGame: number;   // 초반력 (0-100)
  lateGame: number;    // 후반력
  teamfight: number;   // 한타 기여도
  splitPush: number;   // 스플릿 능력
  difficulty: number;  // 조작 난이도
}

// 챔피언 간 상성
export interface ChampionSynergy {
  championA: string;
  championB: string;
  synergy: number; // -100(카운터) ~ +100(시너지)
}
