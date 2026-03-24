/**
 * [LoL 전체 챔피언 데이터베이스 - 170챔피언]
 * - 2026 시즌 기준 초기 메타 밸런스
 * - 시즌 중 AI 패치로 스탯/티어 변동
 * - primaryRole: 주 포지션 (성능 100%)
 * - secondaryRoles: 부 포지션 (성능 감소, 빈 배열이면 주 포지션 전용)
 * - tier: S(필밴급) ~ D(비주류)
 * - stats: earlyGame/lateGame/teamfight/splitPush/difficulty (0-100)
 */

import type { Champion, ChampionTag, BuildType, DamageProfile } from '../types/champion';
import type { Position } from '../types/game';

/**
 * 헬퍼: 챔피언 객체 생성 (빌드 타입 + 데미지 프로필 포함)
 * positions 배열의 첫 번째 = primaryRole, 나머지 = secondaryRoles
 */
const c = (
  id: string,
  name: string,
  nameKo: string,
  positions: Position[],
  tier: Champion['tier'],
  tags: ChampionTag[],
  earlyGame: number,
  lateGame: number,
  teamfight: number,
  splitPush: number,
  difficulty: number,
  primaryBuild: BuildType = 'bruiser_ad',
  secondaryBuild: BuildType | null = null,
  damageProfile: DamageProfile = 'physical',
): Champion => ({
  id, name, nameKo,
  primaryRole: positions[0],
  secondaryRoles: positions.slice(1),
  tier, tags,
  stats: { earlyGame, lateGame, teamfight, splitPush, difficulty },
  primaryBuild, secondaryBuild, damageProfile,
});

export const CHAMPION_DB: Champion[] = [
  // ═══════════════════════════════════════════
  // TOP LANE PRIMARY — buildType, secondaryBuild, damageProfile
  // ═══════════════════════════════════════════
  c('aatrox', 'Aatrox', '아트록스', ['top'], 'A', ['fighter', 'teamfight'], 70, 55, 75, 50, 55, 'bruiser_ad', null, 'physical'),
  c('ambessa', 'Ambessa', '앰베사', ['top'], 'A', ['fighter', 'assassin'], 75, 55, 60, 65, 60, 'bruiser_ad', 'ad_lethality', 'physical'),
  c('camille', 'Camille', '카밀', ['top'], 'A', ['fighter', 'splitpush'], 60, 70, 55, 85, 70, 'bruiser_ad', null, 'hybrid'),
  c('chogath', 'ChoGath', '초가스', ['top'], 'C', ['tank', 'teamfight'], 40, 65, 70, 30, 30, 'tank', 'ap_burst', 'magic'),
  c('darius', 'Darius', '다리우스', ['top'], 'B', ['fighter'], 75, 40, 55, 55, 35, 'bruiser_ad', 'tank', 'physical'),
  c('dr_mundo', 'Dr. Mundo', '문도 박사', ['top'], 'C', ['tank'], 35, 65, 50, 45, 20, 'tank', null, 'magic'),
  c('fiora', 'Fiora', '피오라', ['top'], 'A', ['fighter', 'splitpush'], 55, 80, 30, 95, 65, 'bruiser_ad', null, 'hybrid'),
  c('gangplank', 'Gangplank', '갱플랭크', ['top'], 'B', ['fighter', 'teamfight'], 30, 90, 75, 50, 80, 'ad_crit', 'bruiser_ad', 'hybrid'),
  c('garen', 'Garen', '가렌', ['top'], 'C', ['fighter', 'tank'], 55, 45, 45, 50, 15, 'bruiser_ad', 'tank', 'hybrid'),
  c('gnar', 'Gnar', '나르', ['top'], 'A', ['tank', 'teamfight', 'engage'], 60, 55, 80, 45, 65, 'tank', 'bruiser_ad', 'physical'),
  c('gragas', 'Gragas', '그라가스', ['top', 'jungle'], 'B', ['tank', 'mage', 'engage'], 55, 50, 75, 35, 50, 'bruiser_ap', 'tank', 'magic'),
  c('gwen', 'Gwen', '그웬', ['top'], 'B', ['fighter', 'splitpush'], 45, 75, 60, 70, 55, 'bruiser_ap', null, 'magic'),
  c('heimerdinger', 'Heimerdinger', '하이머딩거', ['top', 'mid'], 'D', ['mage', 'poke'], 70, 45, 50, 55, 45, 'ap_burst', null, 'magic'),
  c('illaoi', 'Illaoi', '일라오이', ['top'], 'C', ['fighter'], 50, 55, 55, 50, 40, 'bruiser_ad', null, 'physical'),
  c('irelia', 'Irelia', '이렐리아', ['top', 'mid'], 'A', ['fighter', 'splitpush'], 60, 65, 60, 75, 75, 'on_hit', 'bruiser_ad', 'physical'),
  c('jax', 'Jax', '잭스', ['top'], 'A', ['fighter', 'splitpush'], 45, 85, 55, 90, 45, 'bruiser_ad', 'on_hit', 'hybrid'),
  c('jayce', 'Jayce', '제이스', ['top', 'mid'], 'B', ['fighter', 'poke'], 75, 40, 50, 55, 65, 'ad_lethality', 'bruiser_ad', 'physical'),
  c('kennen', 'Kennen', '케넨', ['top'], 'B', ['mage', 'teamfight', 'engage'], 55, 55, 85, 40, 55, 'ap_burst', null, 'magic'),
  c('kled', 'Kled', '클레드', ['top'], 'C', ['fighter', 'engage'], 75, 40, 60, 50, 55, 'bruiser_ad', null, 'physical'),
  c('ksante', 'K\'Sante', '케산테', ['top'], 'S', ['tank', 'fighter', 'engage'], 55, 70, 75, 60, 85, 'tank', 'bruiser_ad', 'physical'),
  c('malphite', 'Malphite', '말파이트', ['top'], 'B', ['tank', 'engage', 'teamfight'], 30, 55, 90, 20, 25, 'tank', 'ap_burst', 'magic'),
  c('mordekaiser', 'Mordekaiser', '모데카이저', ['top'], 'B', ['fighter'], 50, 65, 50, 55, 35, 'bruiser_ap', null, 'magic'),
  c('nasus', 'Nasus', '나서스', ['top'], 'C', ['fighter', 'splitpush'], 20, 90, 40, 80, 25, 'tank', 'bruiser_ad', 'physical'),
  c('olaf', 'Olaf', '올라프', ['top', 'jungle'], 'C', ['fighter'], 70, 35, 50, 45, 30, 'bruiser_ad', null, 'physical'),
  c('ornn', 'Ornn', '오른', ['top'], 'A', ['tank', 'engage', 'teamfight'], 40, 70, 90, 20, 50, 'tank', null, 'magic'),
  c('pantheon', 'Pantheon', '판테온', ['top', 'mid', 'support'], 'C', ['fighter', 'assassin'], 85, 25, 50, 40, 35, 'ad_lethality', 'bruiser_ad', 'physical'),
  c('poppy', 'Poppy', '뽀삐', ['top', 'jungle'], 'C', ['tank', 'engage'], 50, 45, 65, 30, 35, 'tank', null, 'physical'),
  c('quinn', 'Quinn', '퀸', ['top'], 'D', ['marksman', 'splitpush'], 75, 35, 30, 65, 45, 'ad_lethality', 'ad_crit', 'physical'),
  c('renekton', 'Renekton', '레넥톤', ['top'], 'B', ['fighter', 'engage'], 80, 30, 60, 45, 35, 'bruiser_ad', null, 'physical'),
  c('rengar', 'Rengar', '렝가', ['top', 'jungle'], 'C', ['assassin', 'fighter'], 55, 60, 40, 55, 60, 'ad_lethality', 'bruiser_ad', 'physical'),
  c('riven', 'Riven', '리븐', ['top'], 'B', ['fighter', 'splitpush'], 60, 65, 55, 75, 80, 'bruiser_ad', 'ad_lethality', 'physical'),
  c('rumble', 'Rumble', '럼블', ['top'], 'B', ['mage', 'teamfight'], 55, 55, 85, 35, 55, 'bruiser_ap', null, 'magic'),
  c('sett', 'Sett', '세트', ['top'], 'B', ['fighter', 'engage', 'teamfight'], 65, 45, 70, 45, 30, 'bruiser_ad', 'tank', 'physical'),
  c('shen', 'Shen', '쉔', ['top'], 'B', ['tank', 'teamfight'], 45, 55, 75, 35, 45, 'tank', null, 'magic'),
  c('singed', 'Singed', '신지드', ['top'], 'D', ['tank', 'splitpush'], 35, 55, 50, 65, 50, 'bruiser_ap', 'tank', 'magic'),
  c('sion', 'Sion', '사이온', ['top'], 'C', ['tank', 'engage', 'teamfight'], 35, 60, 75, 50, 35, 'tank', 'ad_lethality', 'physical'),
  c('tahm_kench', 'Tahm Kench', '탐 켄치', ['top', 'support'], 'C', ['tank'], 55, 50, 55, 30, 40, 'tank', null, 'magic'),
  c('teemo', 'Teemo', '티모', ['top'], 'D', ['mage', 'poke'], 65, 35, 25, 55, 30, 'ap_burst', 'on_hit', 'magic'),
  c('trundle', 'Trundle', '트런들', ['top', 'jungle'], 'C', ['fighter', 'splitpush'], 55, 60, 45, 70, 25, 'bruiser_ad', 'tank', 'physical'),
  c('tryndamere', 'Tryndamere', '트린다미어', ['top'], 'C', ['fighter', 'splitpush'], 45, 75, 25, 95, 30, 'ad_crit', null, 'physical'),
  c('urgot', 'Urgot', '우르곳', ['top'], 'C', ['fighter', 'tank'], 50, 60, 55, 45, 40, 'bruiser_ad', 'tank', 'physical'),
  c('volibear', 'Volibear', '볼리베어', ['top', 'jungle'], 'C', ['fighter', 'tank', 'engage'], 65, 40, 55, 45, 30, 'tank', 'bruiser_ap', 'hybrid'),
  c('wukong', 'Wukong', '오공', ['top', 'jungle'], 'B', ['fighter', 'engage', 'teamfight'], 55, 55, 75, 45, 35, 'bruiser_ad', null, 'physical'),
  c('yasuo', 'Yasuo', '야스오', ['top', 'mid'], 'B', ['fighter', 'splitpush'], 45, 80, 65, 70, 75, 'ad_crit', null, 'physical'),
  c('yone', 'Yone', '요네', ['top', 'mid'], 'A', ['fighter', 'assassin', 'splitpush'], 50, 80, 70, 70, 65, 'ad_crit', null, 'hybrid'),
  c('yorick', 'Yorick', '요릭', ['top'], 'D', ['fighter', 'splitpush'], 40, 70, 25, 95, 35, 'bruiser_ad', 'tank', 'physical'),

  // ═══════════════════════════════════════════
  // JUNGLE PRIMARY
  // ═══════════════════════════════════════════
  c('amumu', 'Amumu', '아무무', ['jungle'], 'C', ['tank', 'engage', 'teamfight'], 40, 55, 85, 20, 25, 'tank', 'bruiser_ap', 'magic'),
  c('belveth', 'Bel\'Veth', '벨베스', ['jungle'], 'B', ['fighter'], 55, 80, 50, 65, 55, 'on_hit', 'bruiser_ad', 'hybrid'),
  c('briar', 'Briar', '브라이어', ['jungle'], 'B', ['fighter', 'assassin'], 65, 55, 50, 45, 45, 'bruiser_ad', 'ad_lethality', 'physical'),
  c('diana', 'Diana', '다이애나', ['jungle', 'mid'], 'B', ['assassin', 'mage', 'teamfight'], 50, 65, 80, 35, 45, 'ap_burst', 'bruiser_ap', 'magic'),
  c('elise', 'Elise', '엘리스', ['jungle'], 'B', ['mage', 'assassin'], 85, 30, 45, 30, 65, 'ap_burst', null, 'magic'),
  c('evelynn', 'Evelynn', '이블린', ['jungle'], 'C', ['assassin', 'mage'], 35, 75, 45, 30, 55, 'ap_burst', null, 'magic'),
  c('graves', 'Graves', '그레이브즈', ['jungle'], 'B', ['marksman', 'fighter'], 60, 60, 50, 50, 50, 'ad_lethality', 'ad_crit', 'physical'),
  c('hecarim', 'Hecarim', '헤카림', ['jungle'], 'B', ['fighter', 'engage', 'teamfight'], 55, 55, 75, 35, 40, 'bruiser_ad', 'tank', 'physical'),
  c('ivern', 'Ivern', '아이번', ['jungle'], 'C', ['support'], 40, 55, 65, 15, 55, 'enchanter', null, 'magic'),
  c('jarvan_iv', 'Jarvan IV', '자르반 4세', ['jungle'], 'B', ['fighter', 'engage', 'teamfight'], 65, 40, 75, 30, 40, 'bruiser_ad', 'tank', 'physical'),
  c('karthus', 'Karthus', '카서스', ['jungle'], 'C', ['mage', 'teamfight'], 35, 80, 70, 20, 40, 'ap_dps', null, 'magic'),
  c('kayn', 'Kayn', '케인', ['jungle'], 'B', ['assassin', 'fighter'], 40, 75, 60, 50, 50, 'ad_lethality', 'bruiser_ad', 'physical'),
  c('khazix', 'Kha\'Zix', '카직스', ['jungle'], 'B', ['assassin'], 60, 60, 45, 40, 50, 'ad_lethality', null, 'physical'),
  c('kindred', 'Kindred', '킨드레드', ['jungle'], 'B', ['marksman'], 55, 75, 55, 40, 60, 'ad_crit', 'on_hit', 'physical'),
  c('lee_sin', 'Lee Sin', '리 신', ['jungle'], 'S', ['fighter', 'assassin', 'engage'], 80, 35, 65, 40, 85, 'bruiser_ad', 'ad_lethality', 'physical'),
  c('lillia', 'Lillia', '릴리아', ['jungle'], 'B', ['mage', 'teamfight'], 45, 65, 75, 35, 50, 'ap_dps', 'bruiser_ap', 'magic'),
  c('master_yi', 'Master Yi', '마스터 이', ['jungle'], 'C', ['fighter', 'assassin'], 35, 85, 30, 65, 30, 'on_hit', 'ad_crit', 'hybrid'),
  c('maokai', 'Maokai', '마오카이', ['jungle', 'support'], 'B', ['tank', 'engage', 'teamfight'], 40, 55, 80, 20, 30, 'tank', null, 'magic'),
  c('nidalee', 'Nidalee', '니달리', ['jungle'], 'B', ['assassin', 'mage', 'poke'], 85, 25, 35, 35, 80, 'ap_burst', null, 'magic'),
  c('nocturne', 'Nocturne', '녹턴', ['jungle'], 'C', ['assassin', 'fighter'], 55, 50, 45, 50, 35, 'ad_lethality', 'bruiser_ad', 'physical'),
  c('nunu', 'Nunu & Willump', '누누와 윌럼프', ['jungle'], 'C', ['tank', 'engage'], 60, 40, 60, 25, 30, 'tank', 'ap_burst', 'magic'),
  c('reksai', 'Rek\'Sai', '렉사이', ['jungle'], 'B', ['fighter', 'engage'], 75, 35, 55, 35, 50, 'bruiser_ad', null, 'physical'),
  c('sejuani', 'Sejuani', '세주아니', ['jungle'], 'B', ['tank', 'engage', 'teamfight'], 40, 55, 85, 15, 35, 'tank', null, 'magic'),
  c('shaco', 'Shaco', '샤코', ['jungle'], 'D', ['assassin'], 70, 40, 25, 55, 60, 'ad_lethality', 'ap_burst', 'physical'),
  c('shyvana', 'Shyvana', '쉬바나', ['jungle'], 'C', ['fighter', 'tank'], 40, 65, 55, 45, 30, 'bruiser_ap', 'bruiser_ad', 'hybrid'),
  c('taliyah', 'Taliyah', '탈리야', ['jungle', 'mid'], 'B', ['mage', 'teamfight'], 55, 55, 70, 30, 60, 'ap_burst', null, 'magic'),
  c('udyr', 'Udyr', '우디르', ['jungle'], 'C', ['fighter', 'tank'], 55, 50, 55, 50, 35, 'tank', 'bruiser_ap', 'hybrid'),
  c('vi', 'Vi', '바이', ['jungle'], 'B', ['fighter', 'engage'], 65, 50, 60, 35, 35, 'bruiser_ad', 'tank', 'physical'),
  c('viego', 'Viego', '비에고', ['jungle'], 'S', ['assassin', 'fighter'], 60, 75, 65, 50, 70, 'bruiser_ad', 'ad_crit', 'physical'),
  c('warwick', 'Warwick', '워윅', ['jungle'], 'C', ['fighter', 'tank'], 65, 40, 50, 40, 25, 'tank', 'on_hit', 'hybrid'),
  c('xin_zhao', 'Xin Zhao', '신 짜오', ['jungle'], 'C', ['fighter', 'engage'], 70, 35, 55, 35, 30, 'bruiser_ad', null, 'physical'),
  c('zac', 'Zac', '자크', ['jungle'], 'B', ['tank', 'engage', 'teamfight'], 45, 55, 85, 20, 40, 'tank', null, 'magic'),

  // ═══════════════════════════════════════════
  // MID LANE PRIMARY
  // ═══════════════════════════════════════════
  c('ahri', 'Ahri', '아리', ['mid'], 'A', ['mage', 'assassin'], 55, 60, 65, 40, 45, 'ap_burst', null, 'magic'),
  c('akali', 'Akali', '아칼리', ['mid', 'top'], 'A', ['assassin', 'splitpush'], 55, 70, 55, 65, 75, 'ap_burst', 'bruiser_ap', 'magic'),
  c('akshan', 'Akshan', '아크샨', ['mid'], 'C', ['marksman', 'assassin'], 65, 50, 40, 55, 55, 'ad_crit', 'on_hit', 'physical'),
  c('anivia', 'Anivia', '애니비아', ['mid'], 'C', ['mage', 'teamfight'], 30, 80, 70, 30, 55, 'ap_dps', null, 'magic'),
  c('annie', 'Annie', '애니', ['mid'], 'C', ['mage', 'engage', 'teamfight'], 55, 55, 75, 25, 25, 'ap_burst', null, 'magic'),
  c('aurora', 'Aurora', '오로라', ['mid', 'top'], 'B', ['mage', 'assassin'], 55, 60, 65, 45, 55, 'ap_burst', 'bruiser_ap', 'magic'),
  c('aurelion_sol', 'Aurelion Sol', '아우렐리온 솔', ['mid'], 'B', ['mage', 'teamfight'], 30, 90, 70, 30, 65, 'ap_dps', null, 'magic'),
  c('azir', 'Azir', '아지르', ['mid'], 'S', ['mage', 'teamfight'], 35, 90, 85, 40, 90, 'ap_dps', null, 'magic'),
  c('cassiopeia', 'Cassiopeia', '카시오페아', ['mid'], 'B', ['mage', 'teamfight'], 45, 85, 70, 30, 70, 'ap_dps', null, 'magic'),
  c('corki', 'Corki', '코르키', ['mid'], 'A', ['marksman', 'mage', 'poke'], 40, 80, 60, 40, 50, 'hybrid', 'ad_crit', 'hybrid'),
  c('ekko', 'Ekko', '에코', ['mid', 'jungle'], 'B', ['assassin', 'mage'], 55, 65, 55, 55, 60, 'ap_burst', null, 'magic'),
  c('fizz', 'Fizz', '피즈', ['mid'], 'C', ['assassin', 'mage'], 45, 65, 50, 40, 55, 'ap_burst', null, 'magic'),
  c('galio', 'Galio', '갈리오', ['mid'], 'B', ['tank', 'mage', 'engage', 'teamfight'], 50, 50, 85, 25, 40, 'bruiser_ap', 'tank', 'magic'),
  c('hwei', 'Hwei', '흐웨이', ['mid', 'support'], 'A', ['mage', 'poke', 'teamfight'], 50, 70, 75, 30, 75, 'ap_burst', 'ap_utility', 'magic'),
  c('kassadin', 'Kassadin', '카사딘', ['mid'], 'C', ['assassin', 'mage'], 20, 95, 55, 50, 55, 'ap_burst', null, 'magic'),
  c('katarina', 'Katarina', '카타리나', ['mid'], 'C', ['assassin'], 50, 65, 60, 40, 70, 'ap_burst', 'on_hit', 'magic'),
  c('leblanc', 'LeBlanc', '르블랑', ['mid'], 'A', ['assassin', 'mage'], 75, 45, 50, 40, 75, 'ap_burst', null, 'magic'),
  c('lissandra', 'Lissandra', '리산드라', ['mid'], 'C', ['mage', 'engage', 'teamfight'], 50, 50, 80, 25, 40, 'ap_burst', null, 'magic'),
  c('lux', 'Lux', '럭스', ['mid', 'support'], 'C', ['mage', 'poke'], 50, 55, 60, 25, 35, 'ap_burst', 'enchanter', 'magic'),
  c('malzahar', 'Malzahar', '말자하', ['mid'], 'C', ['mage'], 40, 65, 60, 35, 25, 'ap_dps', null, 'magic'),
  c('mel', 'Mel', '멜', ['mid'], 'B', ['mage', 'teamfight'], 45, 70, 75, 30, 60, 'ap_burst', null, 'magic'),
  c('naafiri', 'Naafiri', '나피리', ['mid'], 'C', ['assassin'], 70, 35, 40, 45, 30, 'ad_lethality', null, 'physical'),
  c('neeko', 'Neeko', '니코', ['mid'], 'C', ['mage', 'engage', 'teamfight'], 55, 50, 75, 25, 45, 'ap_burst', null, 'magic'),
  c('orianna', 'Orianna', '오리아나', ['mid'], 'A', ['mage', 'teamfight'], 45, 75, 90, 25, 65, 'ap_burst', null, 'magic'),
  c('qiyana', 'Qiyana', '키아나', ['mid'], 'B', ['assassin', 'engage'], 65, 45, 60, 40, 70, 'ad_lethality', null, 'physical'),
  c('ryze', 'Ryze', '라이즈', ['mid'], 'B', ['mage', 'teamfight'], 35, 80, 65, 45, 70, 'ap_dps', null, 'magic'),
  c('smolder', 'Smolder', '스몰더', ['mid', 'adc'], 'A', ['mage', 'marksman'], 25, 95, 65, 35, 45, 'ap_dps', 'ad_crit', 'hybrid'),
  c('sylas', 'Sylas', '사일러스', ['mid'], 'A', ['mage', 'assassin', 'teamfight'], 55, 70, 75, 45, 65, 'bruiser_ap', 'ap_burst', 'magic'),
  c('syndra', 'Syndra', '신드라', ['mid'], 'A', ['mage', 'teamfight'], 55, 75, 70, 25, 60, 'ap_burst', null, 'magic'),
  c('talon', 'Talon', '탈론', ['mid', 'jungle'], 'C', ['assassin'], 70, 35, 35, 50, 45, 'ad_lethality', null, 'physical'),
  c('twisted_fate', 'Twisted Fate', '트위스티드 페이트', ['mid'], 'B', ['mage'], 50, 60, 60, 45, 55, 'ap_burst', null, 'magic'),
  c('veigar', 'Veigar', '베이가', ['mid'], 'C', ['mage', 'teamfight'], 25, 90, 65, 25, 35, 'ap_burst', null, 'magic'),
  c('vex', 'Vex', '벡스', ['mid'], 'B', ['mage', 'engage', 'teamfight'], 50, 55, 75, 25, 40, 'ap_burst', null, 'magic'),
  c('viktor', 'Viktor', '빅토르', ['mid'], 'A', ['mage', 'teamfight'], 40, 85, 80, 30, 60, 'ap_dps', 'ap_burst', 'magic'),
  c('xerath', 'Xerath', '제라스', ['mid', 'support'], 'C', ['mage', 'poke'], 50, 60, 55, 20, 50, 'ap_burst', null, 'magic'),
  c('zed', 'Zed', '제드', ['mid'], 'B', ['assassin', 'splitpush'], 65, 50, 40, 65, 70, 'ad_lethality', null, 'physical'),
  c('ziggs', 'Ziggs', '직스', ['mid', 'adc'], 'C', ['mage', 'poke'], 45, 60, 60, 45, 40, 'ap_burst', null, 'magic'),
  c('zoe', 'Zoe', '조이', ['mid'], 'B', ['mage', 'poke'], 60, 55, 55, 25, 75, 'ap_burst', null, 'magic'),

  // ═══════════════════════════════════════════
  // ADC / BOT LANE PRIMARY
  // ═══════════════════════════════════════════
  c('aphelios', 'Aphelios', '아펠리오스', ['adc'], 'S', ['marksman', 'teamfight'], 40, 90, 85, 35, 85, 'ad_crit', null, 'physical'),
  c('ashe', 'Ashe', '애쉬', ['adc'], 'B', ['marksman', 'poke', 'engage'], 50, 65, 70, 30, 30, 'ad_crit', 'on_hit', 'physical'),
  c('caitlyn', 'Caitlyn', '케이틀린', ['adc'], 'A', ['marksman', 'poke'], 70, 60, 55, 40, 45, 'ad_crit', null, 'physical'),
  c('draven', 'Draven', '드레이븐', ['adc'], 'B', ['marksman'], 80, 50, 50, 40, 70, 'ad_crit', 'ad_lethality', 'physical'),
  c('ezreal', 'Ezreal', '이즈리얼', ['adc'], 'A', ['marksman', 'poke'], 55, 70, 55, 40, 60, 'hybrid', 'ad_crit', 'hybrid'),
  c('jhin', 'Jhin', '진', ['adc'], 'A', ['marksman', 'poke', 'teamfight'], 55, 65, 70, 30, 50, 'ad_crit', 'ad_lethality', 'physical'),
  c('jinx', 'Jinx', '징크스', ['adc'], 'A', ['marksman', 'teamfight'], 40, 90, 75, 40, 45, 'ad_crit', null, 'physical'),
  c('kaisa', 'Kai\'Sa', '카이사', ['adc'], 'S', ['marksman', 'assassin', 'teamfight'], 50, 85, 75, 45, 60, 'ad_crit', 'hybrid', 'hybrid'),
  c('kalista', 'Kalista', '칼리스타', ['adc'], 'B', ['marksman', 'engage'], 70, 50, 60, 35, 75, 'on_hit', 'ad_crit', 'physical'),
  c('kogmaw', 'Kog\'Maw', '코그모', ['adc'], 'C', ['marksman', 'teamfight'], 25, 95, 65, 20, 40, 'on_hit', 'ad_crit', 'hybrid'),
  c('lucian', 'Lucian', '루시안', ['adc'], 'B', ['marksman'], 75, 45, 50, 45, 50, 'ad_crit', null, 'physical'),
  c('miss_fortune', 'Miss Fortune', '미스 포츈', ['adc'], 'B', ['marksman', 'teamfight'], 60, 60, 75, 25, 25, 'ad_crit', 'ad_lethality', 'physical'),
  c('nilah', 'Nilah', '닐라', ['adc'], 'C', ['fighter', 'marksman', 'teamfight'], 45, 75, 65, 35, 55, 'ad_crit', null, 'physical'),
  c('samira', 'Samira', '사미라', ['adc'], 'B', ['marksman', 'assassin', 'teamfight'], 55, 65, 70, 35, 60, 'ad_crit', null, 'physical'),
  c('sivir', 'Sivir', '시비르', ['adc'], 'B', ['marksman', 'teamfight'], 40, 70, 65, 45, 30, 'ad_crit', null, 'physical'),
  c('tristana', 'Tristana', '트리스타나', ['adc', 'mid'], 'B', ['marksman', 'splitpush'], 55, 75, 55, 60, 40, 'ad_crit', null, 'physical'),
  c('twitch', 'Twitch', '트위치', ['adc'], 'C', ['marksman', 'assassin', 'teamfight'], 35, 85, 70, 30, 40, 'ad_crit', 'on_hit', 'physical'),
  c('varus', 'Varus', '바루스', ['adc'], 'A', ['marksman', 'poke', 'teamfight'], 60, 65, 75, 25, 45, 'on_hit', 'ad_lethality', 'hybrid'),
  c('vayne', 'Vayne', '베인', ['adc', 'top'], 'B', ['marksman', 'splitpush'], 40, 90, 50, 70, 60, 'ad_crit', 'on_hit', 'hybrid'),
  c('xayah', 'Xayah', '자야', ['adc'], 'A', ['marksman', 'teamfight'], 50, 75, 70, 35, 55, 'ad_crit', null, 'physical'),
  c('zeri', 'Zeri', '제리', ['adc'], 'B', ['marksman', 'teamfight'], 45, 80, 60, 50, 60, 'ad_crit', null, 'physical'),

  // ═══════════════════════════════════════════
  // SUPPORT PRIMARY
  // ═══════════════════════════════════════════
  c('alistar', 'Alistar', '알리스타', ['support'], 'A', ['tank', 'engage', 'teamfight'], 55, 50, 85, 10, 40, 'engage_tank', null, 'magic'),
  c('bard', 'Bard', '바드', ['support'], 'B', ['support', 'engage'], 55, 60, 65, 25, 75, 'enchanter', null, 'magic'),
  c('blitzcrank', 'Blitzcrank', '블리츠크랭크', ['support'], 'C', ['tank', 'engage'], 65, 40, 55, 10, 35, 'engage_tank', null, 'magic'),
  c('braum', 'Braum', '브라움', ['support'], 'B', ['tank', 'engage', 'teamfight'], 50, 50, 80, 10, 30, 'engage_tank', null, 'physical'),
  c('janna', 'Janna', '잔나', ['support'], 'B', ['support', 'poke'], 40, 60, 70, 10, 40, 'enchanter', null, 'magic'),
  c('karma', 'Karma', '카르마', ['support', 'mid'], 'B', ['mage', 'support', 'poke'], 60, 45, 60, 15, 35, 'ap_utility', 'enchanter', 'magic'),
  c('leona', 'Leona', '레오나', ['support'], 'B', ['tank', 'engage', 'teamfight'], 60, 45, 80, 10, 30, 'engage_tank', null, 'magic'),
  c('lulu', 'Lulu', '룰루', ['support'], 'A', ['support', 'teamfight'], 45, 70, 75, 10, 40, 'enchanter', null, 'magic'),
  c('milio', 'Milio', '밀리오', ['support'], 'A', ['support', 'teamfight'], 45, 65, 80, 10, 40, 'enchanter', null, 'magic'),
  c('morgana', 'Morgana', '모르가나', ['support'], 'C', ['mage', 'support'], 50, 55, 65, 15, 35, 'ap_utility', null, 'magic'),
  c('nami', 'Nami', '나미', ['support'], 'B', ['support', 'poke', 'teamfight'], 55, 55, 70, 10, 40, 'enchanter', null, 'magic'),
  c('nautilus', 'Nautilus', '노틸러스', ['support'], 'A', ['tank', 'engage', 'teamfight'], 60, 45, 80, 10, 30, 'engage_tank', null, 'magic'),
  c('pyke', 'Pyke', '파이크', ['support'], 'B', ['assassin', 'engage'], 70, 35, 50, 15, 60, 'ad_lethality', null, 'physical'),
  c('rakan', 'Rakan', '라칸', ['support'], 'A', ['engage', 'support', 'teamfight'], 55, 50, 90, 10, 55, 'enchanter', 'engage_tank', 'magic'),
  c('rell', 'Rell', '렐', ['support'], 'B', ['tank', 'engage', 'teamfight'], 50, 50, 85, 10, 45, 'engage_tank', null, 'physical'),
  c('renata', 'Renata Glasc', '레나타 글라스크', ['support'], 'A', ['support', 'teamfight'], 45, 70, 85, 10, 55, 'enchanter', null, 'magic'),
  c('seraphine', 'Seraphine', '세라핀', ['support', 'adc'], 'B', ['mage', 'support', 'teamfight'], 40, 65, 80, 15, 35, 'enchanter', 'ap_burst', 'magic'),
  c('senna', 'Senna', '세나', ['support', 'adc'], 'B', ['marksman', 'support'], 50, 75, 60, 20, 45, 'ad_crit', 'enchanter', 'physical'),
  c('sona', 'Sona', '소나', ['support'], 'C', ['support', 'teamfight'], 30, 70, 75, 10, 25, 'enchanter', null, 'magic'),
  c('soraka', 'Soraka', '소라카', ['support'], 'C', ['support'], 35, 65, 65, 10, 30, 'enchanter', null, 'magic'),
  c('taric', 'Taric', '타릭', ['support'], 'C', ['tank', 'support', 'teamfight'], 30, 60, 80, 10, 40, 'engage_tank', null, 'magic'),
  c('thresh', 'Thresh', '쓰레쉬', ['support'], 'S', ['tank', 'engage', 'teamfight'], 55, 55, 80, 10, 70, 'engage_tank', null, 'magic'),
  c('yuumi', 'Yuumi', '유미', ['support'], 'D', ['support'], 20, 70, 55, 5, 25, 'enchanter', null, 'magic'),
  c('zilean', 'Zilean', '질리언', ['support', 'mid'], 'C', ['mage', 'support', 'teamfight'], 40, 70, 70, 15, 50, 'ap_utility', null, 'magic'),
  c('zyra', 'Zyra', '자이라', ['support'], 'C', ['mage', 'poke', 'teamfight'], 55, 50, 65, 15, 40, 'ap_burst', null, 'magic'),

  // ═══════════════════════════════════════════
  // FLEX / MULTI-ROLE & 추가 챔피언
  // ═══════════════════════════════════════════
  c('brand', 'Brand', '브랜드', ['support', 'mid'], 'C', ['mage', 'poke', 'teamfight'], 55, 60, 65, 15, 35, 'ap_dps', 'ap_burst', 'magic'),
  c('fiddlesticks', 'Fiddlesticks', '피들스틱', ['jungle'], 'C', ['mage', 'teamfight'], 35, 65, 85, 20, 45, 'ap_burst', null, 'magic'),
  c('kayle', 'Kayle', '케일', ['top'], 'C', ['fighter', 'mage'], 15, 95, 65, 60, 40, 'ap_dps', 'ad_crit', 'hybrid'),
  c('rammus', 'Rammus', '람머스', ['jungle'], 'C', ['tank', 'engage'], 45, 50, 60, 20, 25, 'tank', null, 'magic'),
  c('skarner', 'Skarner', '스카너', ['jungle'], 'B', ['tank', 'engage', 'teamfight'], 50, 50, 75, 25, 35, 'tank', 'bruiser_ad', 'hybrid'),
  c('swain', 'Swain', '스웨인', ['support', 'mid'], 'C', ['mage', 'teamfight'], 40, 70, 70, 20, 35, 'bruiser_ap', 'ap_dps', 'magic'),
  c('velkoz', 'Vel\'Koz', '벨코즈', ['support', 'mid'], 'C', ['mage', 'poke', 'teamfight'], 50, 60, 65, 15, 50, 'ap_burst', null, 'true'),
  c('vladimir', 'Vladimir', '블라디미르', ['mid', 'top'], 'B', ['mage', 'teamfight'], 30, 85, 70, 40, 50, 'ap_burst', null, 'magic'),
];

// ───────────────────────────────────────────────
// ID 기반 빠른 조회용 맵
// ───────────────────────────────────────────────
export const CHAMPION_MAP: Record<string, Champion> = {};
for (const champ of CHAMPION_DB) {
  CHAMPION_MAP[champ.id] = champ;
}

// 포지션별 필터 유틸 (주 + 부 포지션 모두)
export const getChampionsByPosition = (position: Position): Champion[] =>
  CHAMPION_DB.filter(ch => ch.primaryRole === position || ch.secondaryRoles.includes(position));

// 주 포지션만 필터
export const getChampionsByPrimaryRole = (position: Position): Champion[] =>
  CHAMPION_DB.filter(ch => ch.primaryRole === position);

// 티어별 필터 유틸
export const getChampionsByTier = (tier: Champion['tier']): Champion[] =>
  CHAMPION_DB.filter(ch => ch.tier === tier);

// ───────────────────────────────────────────────
// 챔피언 시너지 데이터 (주요 조합 & 카운터 관계)
// synergy: +50~+100 = 강한 시너지, -50~-100 = 하드 카운터
// ───────────────────────────────────────────────
import type { ChampionSynergy } from '../types/champion';

export const CHAMPION_SYNERGIES: ChampionSynergy[] = [
  // ── 봇 듀오 시너지 ──
  { championA: 'xayah', championB: 'rakan', synergy: 90 },      // 자야-라칸 고유 시너지
  { championA: 'kaisa', championB: 'nautilus', synergy: 70 },    // 카이사-노틸 올인
  { championA: 'aphelios', championB: 'thresh', synergy: 65 },   // 아펠-쓰레쉬 랜턴
  { championA: 'jinx', championB: 'lulu', synergy: 75 },         // 징크스-룰루 하이퍼캐리
  { championA: 'kogmaw', championB: 'lulu', synergy: 80 },       // 코그-룰루 유서 깊은 조합
  { championA: 'kalista', championB: 'renata', synergy: 60 },    // 칼리스타-레나타
  { championA: 'draven', championB: 'leona', synergy: 65 },      // 드레이븐-레오나 초반 킬
  { championA: 'ezreal', championB: 'karma', synergy: 55 },      // 이즈리얼-카르마 포크
  { championA: 'varus', championB: 'braum', synergy: 55 },       // 바루스-브라움

  // ── 팀 전체 시너지 (미드+정글, 탑+정글) ──
  { championA: 'yasuo', championB: 'diana', synergy: 85 },       // 야스오-다이애나 한타 궁극기
  { championA: 'yasuo', championB: 'malphite', synergy: 80 },    // 야스오-말파이트
  { championA: 'orianna', championB: 'jarvan_iv', synergy: 75 }, // 오리아나-자르반 한타
  { championA: 'orianna', championB: 'ksante', synergy: 60 },    // 오리아나-케산테
  { championA: 'azir', championB: 'sejuani', synergy: 55 },      // 아지르-세주아니 이니시에이터
  { championA: 'lee_sin', championB: 'yasuo', synergy: 60 },     // 리신킥-야스오 궁
  { championA: 'rakan', championB: 'orianna', synergy: 65 },     // 라칸 이니시-오리 궁

  // ── 라인 카운터 (음수 = A가 B에게 불리) ──
  { championA: 'yasuo', championB: 'renekton', synergy: -60 },   // 야스오 vs 레넥톤
  { championA: 'kassadin', championB: 'leblanc', synergy: -50 }, // 카사딘 초반 약세 vs 르블랑
  { championA: 'azir', championB: 'akali', synergy: -45 },       // 아지르 vs 아칼리 올인
  { championA: 'vayne', championB: 'draven', synergy: -55 },     // 베인 초반 vs 드레이븐
  { championA: 'kayle', championB: 'irelia', synergy: -70 },     // 케일 초반 vs 이렐리아
  { championA: 'gangplank', championB: 'camille', synergy: -50 },// 갱플 vs 카밀
  { championA: 'ksante', championB: 'fiora', synergy: -40 },     // 케산테 vs 피오라 스플릿
  { championA: 'gwen', championB: 'aatrox', synergy: -35 },      // 그웬 vs 아트록스
  { championA: 'akali', championB: 'galio', synergy: -55 },      // 아칼리 vs 갈리오 (MR 탱)
  { championA: 'zed', championB: 'malzahar', synergy: -60 },     // 제드 vs 말자하 (궁 카운터)
  { championA: 'fizz', championB: 'lissandra', synergy: -45 },   // 피즈 vs 리산드라
  { championA: 'master_yi', championB: 'rammus', synergy: -65 }, // 마이 vs 람머스
  { championA: 'kindred', championB: 'lee_sin', synergy: -40 },  // 킨드레드 초반 vs 리신

  // ── 미드-정글 카운터 ──
  { championA: 'nidalee', championB: 'sejuani', synergy: -50 },  // 니달리 vs 세주아니 (풀탱)
  { championA: 'evelynn', championB: 'lee_sin', synergy: -55 },  // 이블린 vs 리신 (카운터 정글)

  // ── 추가 시너지 ──
  { championA: 'renata', championB: 'jinx', synergy: 60 },       // 레나타 궁 + 징크스
  { championA: 'thresh', championB: 'kalista', synergy: 65 },     // 쓰레쉬 랜턴 + 칼리스타 궁
  { championA: 'shen', championB: 'viego', synergy: 55 },         // 쉔 궁 + 비에고 다이브
  { championA: 'galio', championB: 'camille', synergy: 70 },      // 갈리오 궁 + 카밀 이니시
];
