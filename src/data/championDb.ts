/**
 * [LoL 전체 챔피언 데이터베이스 - 170챔피언]
 * - 2026 시즌 기준 초기 메타 밸런스
 * - 시즌 중 AI 패치로 스탯/티어 변동
 * - primaryRole: 주 포지션 (성능 100%)
 * - secondaryRoles: 부 포지션 (성능 감소, 빈 배열이면 주 포지션 전용)
 * - tier: S(필밴급) ~ D(비주류)
 * - stats: earlyGame/lateGame/teamfight/splitPush/difficulty (0-100)
 */

import type { Champion, ChampionTag } from '../types/champion';
import type { Position } from '../types/game';

/**
 * 헬퍼: 챔피언 객체 생성
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
): Champion => ({
  id, name, nameKo,
  primaryRole: positions[0],
  secondaryRoles: positions.slice(1),
  tier, tags,
  stats: { earlyGame, lateGame, teamfight, splitPush, difficulty },
});

export const CHAMPION_DB: Champion[] = [
  // ═══════════════════════════════════════════
  // TOP LANE PRIMARY
  // ═══════════════════════════════════════════
  c('aatrox', 'Aatrox', '아트록스', ['top'], 'A', ['fighter', 'teamfight'], 70, 55, 75, 50, 55),
  c('ambessa', 'Ambessa', '앰베사', ['top'], 'A', ['fighter', 'assassin'], 75, 55, 60, 65, 60),
  c('camille', 'Camille', '카밀', ['top'], 'A', ['fighter', 'splitpush'], 60, 70, 55, 85, 70),
  c('chogath', 'ChoGath', '초가스', ['top'], 'C', ['tank', 'teamfight'], 40, 65, 70, 30, 30),
  c('darius', 'Darius', '다리우스', ['top'], 'B', ['fighter'], 75, 40, 55, 55, 35),
  c('dr_mundo', 'Dr. Mundo', '문도 박사', ['top'], 'C', ['tank'], 35, 65, 50, 45, 20),
  c('fiora', 'Fiora', '피오라', ['top'], 'A', ['fighter', 'splitpush'], 55, 80, 30, 95, 65),
  c('gangplank', 'Gangplank', '갱플랭크', ['top'], 'B', ['fighter', 'teamfight'], 30, 90, 75, 50, 80),
  c('garen', 'Garen', '가렌', ['top'], 'C', ['fighter', 'tank'], 55, 45, 45, 50, 15),
  c('gnar', 'Gnar', '나르', ['top'], 'A', ['tank', 'teamfight', 'engage'], 60, 55, 80, 45, 65),
  c('gragas', 'Gragas', '그라가스', ['top', 'jungle'], 'B', ['tank', 'mage', 'engage'], 55, 50, 75, 35, 50),
  c('gwen', 'Gwen', '그웬', ['top'], 'B', ['fighter', 'splitpush'], 45, 75, 60, 70, 55),
  c('heimerdinger', 'Heimerdinger', '하이머딩거', ['top', 'mid'], 'D', ['mage', 'poke'], 70, 45, 50, 55, 45),
  c('illaoi', 'Illaoi', '일라오이', ['top'], 'C', ['fighter'], 50, 55, 55, 50, 40),
  c('irelia', 'Irelia', '이렐리아', ['top', 'mid'], 'A', ['fighter', 'splitpush'], 60, 65, 60, 75, 75),
  c('jax', 'Jax', '잭스', ['top'], 'A', ['fighter', 'splitpush'], 45, 85, 55, 90, 45),
  c('jayce', 'Jayce', '제이스', ['top', 'mid'], 'B', ['fighter', 'poke'], 75, 40, 50, 55, 65),
  c('kennen', 'Kennen', '케넨', ['top'], 'B', ['mage', 'teamfight', 'engage'], 55, 55, 85, 40, 55),
  c('kled', 'Kled', '클레드', ['top'], 'C', ['fighter', 'engage'], 75, 40, 60, 50, 55),
  c('ksante', 'K\'Sante', '케산테', ['top'], 'S', ['tank', 'fighter', 'engage'], 55, 70, 75, 60, 85),
  c('malphite', 'Malphite', '말파이트', ['top'], 'B', ['tank', 'engage', 'teamfight'], 30, 55, 90, 20, 25),
  c('mordekaiser', 'Mordekaiser', '모데카이저', ['top'], 'B', ['fighter'], 50, 65, 50, 55, 35),
  c('nasus', 'Nasus', '나서스', ['top'], 'C', ['fighter', 'splitpush'], 20, 90, 40, 80, 25),
  c('olaf', 'Olaf', '올라프', ['top', 'jungle'], 'C', ['fighter'], 70, 35, 50, 45, 30),
  c('ornn', 'Ornn', '오른', ['top'], 'A', ['tank', 'engage', 'teamfight'], 40, 70, 90, 20, 50),
  c('pantheon', 'Pantheon', '판테온', ['top', 'mid', 'support'], 'C', ['fighter', 'assassin'], 85, 25, 50, 40, 35),
  c('poppy', 'Poppy', '뽀삐', ['top', 'jungle'], 'C', ['tank', 'engage'], 50, 45, 65, 30, 35),
  c('quinn', 'Quinn', '퀸', ['top'], 'D', ['marksman', 'splitpush'], 75, 35, 30, 65, 45),
  c('renekton', 'Renekton', '레넥톤', ['top'], 'B', ['fighter', 'engage'], 80, 30, 60, 45, 35),
  c('rengar', 'Rengar', '렝가', ['top', 'jungle'], 'C', ['assassin', 'fighter'], 55, 60, 40, 55, 60),
  c('riven', 'Riven', '리븐', ['top'], 'B', ['fighter', 'splitpush'], 60, 65, 55, 75, 80),
  c('rumble', 'Rumble', '럼블', ['top'], 'B', ['mage', 'teamfight'], 55, 55, 85, 35, 55),
  c('sett', 'Sett', '세트', ['top'], 'B', ['fighter', 'engage', 'teamfight'], 65, 45, 70, 45, 30),
  c('shen', 'Shen', '쉔', ['top'], 'B', ['tank', 'teamfight'], 45, 55, 75, 35, 45),
  c('singed', 'Singed', '신지드', ['top'], 'D', ['tank', 'splitpush'], 35, 55, 50, 65, 50),
  c('sion', 'Sion', '사이온', ['top'], 'C', ['tank', 'engage', 'teamfight'], 35, 60, 75, 50, 35),
  c('tahm_kench', 'Tahm Kench', '탐 켄치', ['top', 'support'], 'C', ['tank'], 55, 50, 55, 30, 40),
  c('teemo', 'Teemo', '티모', ['top'], 'D', ['mage', 'poke'], 65, 35, 25, 55, 30),
  c('trundle', 'Trundle', '트런들', ['top', 'jungle'], 'C', ['fighter', 'splitpush'], 55, 60, 45, 70, 25),
  c('tryndamere', 'Tryndamere', '트린다미어', ['top'], 'C', ['fighter', 'splitpush'], 45, 75, 25, 95, 30),
  c('urgot', 'Urgot', '우르곳', ['top'], 'C', ['fighter', 'tank'], 50, 60, 55, 45, 40),
  c('volibear', 'Volibear', '볼리베어', ['top', 'jungle'], 'C', ['fighter', 'tank', 'engage'], 65, 40, 55, 45, 30),
  c('wukong', 'Wukong', '오공', ['top', 'jungle'], 'B', ['fighter', 'engage', 'teamfight'], 55, 55, 75, 45, 35),
  c('yasuo', 'Yasuo', '야스오', ['top', 'mid'], 'B', ['fighter', 'splitpush'], 45, 80, 65, 70, 75),
  c('yone', 'Yone', '요네', ['top', 'mid'], 'A', ['fighter', 'assassin', 'splitpush'], 50, 80, 70, 70, 65),
  c('yorick', 'Yorick', '요릭', ['top'], 'D', ['fighter', 'splitpush'], 40, 70, 25, 95, 35),

  // ═══════════════════════════════════════════
  // JUNGLE PRIMARY
  // ═══════════════════════════════════════════
  c('amumu', 'Amumu', '아무무', ['jungle'], 'C', ['tank', 'engage', 'teamfight'], 40, 55, 85, 20, 25),
  c('belveth', 'Bel\'Veth', '벨베스', ['jungle'], 'B', ['fighter'], 55, 80, 50, 65, 55),
  c('briar', 'Briar', '브라이어', ['jungle'], 'B', ['fighter', 'assassin'], 65, 55, 50, 45, 45),
  c('diana', 'Diana', '다이애나', ['jungle', 'mid'], 'B', ['assassin', 'mage', 'teamfight'], 50, 65, 80, 35, 45),
  c('elise', 'Elise', '엘리스', ['jungle'], 'B', ['mage', 'assassin'], 85, 30, 45, 30, 65),
  c('evelynn', 'Evelynn', '이블린', ['jungle'], 'C', ['assassin', 'mage'], 35, 75, 45, 30, 55),
  c('graves', 'Graves', '그레이브즈', ['jungle'], 'B', ['marksman', 'fighter'], 60, 60, 50, 50, 50),
  c('hecarim', 'Hecarim', '헤카림', ['jungle'], 'B', ['fighter', 'engage', 'teamfight'], 55, 55, 75, 35, 40),
  c('ivern', 'Ivern', '아이번', ['jungle'], 'C', ['support'], 40, 55, 65, 15, 55),
  c('jarvan_iv', 'Jarvan IV', '자르반 4세', ['jungle'], 'B', ['fighter', 'engage', 'teamfight'], 65, 40, 75, 30, 40),
  c('karthus', 'Karthus', '카서스', ['jungle'], 'C', ['mage', 'teamfight'], 35, 80, 70, 20, 40),
  c('kayn', 'Kayn', '케인', ['jungle'], 'B', ['assassin', 'fighter'], 40, 75, 60, 50, 50),
  c('khazix', 'Kha\'Zix', '카직스', ['jungle'], 'B', ['assassin'], 60, 60, 45, 40, 50),
  c('kindred', 'Kindred', '킨드레드', ['jungle'], 'B', ['marksman'], 55, 75, 55, 40, 60),
  c('lee_sin', 'Lee Sin', '리 신', ['jungle'], 'S', ['fighter', 'assassin', 'engage'], 80, 35, 65, 40, 85),
  c('lillia', 'Lillia', '릴리아', ['jungle'], 'B', ['mage', 'teamfight'], 45, 65, 75, 35, 50),
  c('master_yi', 'Master Yi', '마스터 이', ['jungle'], 'C', ['fighter', 'assassin'], 35, 85, 30, 65, 30),
  c('maokai', 'Maokai', '마오카이', ['jungle', 'support'], 'B', ['tank', 'engage', 'teamfight'], 40, 55, 80, 20, 30),
  c('nidalee', 'Nidalee', '니달리', ['jungle'], 'B', ['assassin', 'mage', 'poke'], 85, 25, 35, 35, 80),
  c('nocturne', 'Nocturne', '녹턴', ['jungle'], 'C', ['assassin', 'fighter'], 55, 50, 45, 50, 35),
  c('nunu', 'Nunu & Willump', '누누와 윌럼프', ['jungle'], 'C', ['tank', 'engage'], 60, 40, 60, 25, 30),
  c('reksai', 'Rek\'Sai', '렉사이', ['jungle'], 'B', ['fighter', 'engage'], 75, 35, 55, 35, 50),
  c('sejuani', 'Sejuani', '세주아니', ['jungle'], 'B', ['tank', 'engage', 'teamfight'], 40, 55, 85, 15, 35),
  c('shaco', 'Shaco', '샤코', ['jungle'], 'D', ['assassin'], 70, 40, 25, 55, 60),
  c('shyvana', 'Shyvana', '쉬바나', ['jungle'], 'C', ['fighter', 'tank'], 40, 65, 55, 45, 30),
  c('taliyah', 'Taliyah', '탈리야', ['jungle', 'mid'], 'B', ['mage', 'teamfight'], 55, 55, 70, 30, 60),
  c('udyr', 'Udyr', '우디르', ['jungle'], 'C', ['fighter', 'tank'], 55, 50, 55, 50, 35),
  c('vi', 'Vi', '바이', ['jungle'], 'B', ['fighter', 'engage'], 65, 50, 60, 35, 35),
  c('viego', 'Viego', '비에고', ['jungle'], 'S', ['assassin', 'fighter'], 60, 75, 65, 50, 70),
  c('warwick', 'Warwick', '워윅', ['jungle'], 'C', ['fighter', 'tank'], 65, 40, 50, 40, 25),
  c('xin_zhao', 'Xin Zhao', '신 짜오', ['jungle'], 'C', ['fighter', 'engage'], 70, 35, 55, 35, 30),
  c('zac', 'Zac', '자크', ['jungle'], 'B', ['tank', 'engage', 'teamfight'], 45, 55, 85, 20, 40),

  // ═══════════════════════════════════════════
  // MID LANE PRIMARY
  // ═══════════════════════════════════════════
  c('ahri', 'Ahri', '아리', ['mid'], 'A', ['mage', 'assassin'], 55, 60, 65, 40, 45),
  c('akali', 'Akali', '아칼리', ['mid', 'top'], 'A', ['assassin', 'splitpush'], 55, 70, 55, 65, 75),
  c('akshan', 'Akshan', '아크샨', ['mid'], 'C', ['marksman', 'assassin'], 65, 50, 40, 55, 55),
  c('anivia', 'Anivia', '애니비아', ['mid'], 'C', ['mage', 'teamfight'], 30, 80, 70, 30, 55),
  c('annie', 'Annie', '애니', ['mid'], 'C', ['mage', 'engage', 'teamfight'], 55, 55, 75, 25, 25),
  c('aurora', 'Aurora', '오로라', ['mid', 'top'], 'B', ['mage', 'assassin'], 55, 60, 65, 45, 55),
  c('aurelion_sol', 'Aurelion Sol', '아우렐리온 솔', ['mid'], 'B', ['mage', 'teamfight'], 30, 90, 70, 30, 65),
  c('azir', 'Azir', '아지르', ['mid'], 'S', ['mage', 'teamfight'], 35, 90, 85, 40, 90),
  c('cassiopeia', 'Cassiopeia', '카시오페아', ['mid'], 'B', ['mage', 'teamfight'], 45, 85, 70, 30, 70),
  c('corki', 'Corki', '코르키', ['mid'], 'A', ['marksman', 'mage', 'poke'], 40, 80, 60, 40, 50),
  c('ekko', 'Ekko', '에코', ['mid', 'jungle'], 'B', ['assassin', 'mage'], 55, 65, 55, 55, 60),
  c('fizz', 'Fizz', '피즈', ['mid'], 'C', ['assassin', 'mage'], 45, 65, 50, 40, 55),
  c('galio', 'Galio', '갈리오', ['mid'], 'B', ['tank', 'mage', 'engage', 'teamfight'], 50, 50, 85, 25, 40),
  c('hwei', 'Hwei', '흐웨이', ['mid', 'support'], 'A', ['mage', 'poke', 'teamfight'], 50, 70, 75, 30, 75),
  c('kassadin', 'Kassadin', '카사딘', ['mid'], 'C', ['assassin', 'mage'], 20, 95, 55, 50, 55),
  c('katarina', 'Katarina', '카타리나', ['mid'], 'C', ['assassin'], 50, 65, 60, 40, 70),
  c('leblanc', 'LeBlanc', '르블랑', ['mid'], 'A', ['assassin', 'mage'], 75, 45, 50, 40, 75),
  c('lissandra', 'Lissandra', '리산드라', ['mid'], 'C', ['mage', 'engage', 'teamfight'], 50, 50, 80, 25, 40),
  c('lux', 'Lux', '럭스', ['mid', 'support'], 'C', ['mage', 'poke'], 50, 55, 60, 25, 35),
  c('malzahar', 'Malzahar', '말자하', ['mid'], 'C', ['mage'], 40, 65, 60, 35, 25),
  c('mel', 'Mel', '멜', ['mid'], 'B', ['mage', 'teamfight'], 45, 70, 75, 30, 60),
  c('naafiri', 'Naafiri', '나피리', ['mid'], 'C', ['assassin'], 70, 35, 40, 45, 30),
  c('neeko', 'Neeko', '니코', ['mid'], 'C', ['mage', 'engage', 'teamfight'], 55, 50, 75, 25, 45),
  c('orianna', 'Orianna', '오리아나', ['mid'], 'A', ['mage', 'teamfight'], 45, 75, 90, 25, 65),
  c('qiyana', 'Qiyana', '키아나', ['mid'], 'B', ['assassin', 'engage'], 65, 45, 60, 40, 70),
  c('ryze', 'Ryze', '라이즈', ['mid'], 'B', ['mage', 'teamfight'], 35, 80, 65, 45, 70),
  c('smolder', 'Smolder', '스몰더', ['mid', 'adc'], 'A', ['mage', 'marksman'], 25, 95, 65, 35, 45),
  c('sylas', 'Sylas', '사일러스', ['mid'], 'A', ['mage', 'assassin', 'teamfight'], 55, 70, 75, 45, 65),
  c('syndra', 'Syndra', '신드라', ['mid'], 'A', ['mage', 'teamfight'], 55, 75, 70, 25, 60),
  c('talon', 'Talon', '탈론', ['mid', 'jungle'], 'C', ['assassin'], 70, 35, 35, 50, 45),
  c('twisted_fate', 'Twisted Fate', '트위스티드 페이트', ['mid'], 'B', ['mage'], 50, 60, 60, 45, 55),
  c('veigar', 'Veigar', '베이가', ['mid'], 'C', ['mage', 'teamfight'], 25, 90, 65, 25, 35),
  c('vex', 'Vex', '벡스', ['mid'], 'B', ['mage', 'engage', 'teamfight'], 50, 55, 75, 25, 40),
  c('viktor', 'Viktor', '빅토르', ['mid'], 'A', ['mage', 'teamfight'], 40, 85, 80, 30, 60),
  c('xerath', 'Xerath', '제라스', ['mid', 'support'], 'C', ['mage', 'poke'], 50, 60, 55, 20, 50),
  c('zed', 'Zed', '제드', ['mid'], 'B', ['assassin', 'splitpush'], 65, 50, 40, 65, 70),
  c('ziggs', 'Ziggs', '직스', ['mid', 'adc'], 'C', ['mage', 'poke'], 45, 60, 60, 45, 40),
  c('zoe', 'Zoe', '조이', ['mid'], 'B', ['mage', 'poke'], 60, 55, 55, 25, 75),

  // ═══════════════════════════════════════════
  // ADC / BOT LANE PRIMARY
  // ═══════════════════════════════════════════
  c('aphelios', 'Aphelios', '아펠리오스', ['adc'], 'S', ['marksman', 'teamfight'], 40, 90, 85, 35, 85),
  c('ashe', 'Ashe', '애쉬', ['adc'], 'B', ['marksman', 'poke', 'engage'], 50, 65, 70, 30, 30),
  c('caitlyn', 'Caitlyn', '케이틀린', ['adc'], 'A', ['marksman', 'poke'], 70, 60, 55, 40, 45),
  c('draven', 'Draven', '드레이븐', ['adc'], 'B', ['marksman'], 80, 50, 50, 40, 70),
  c('ezreal', 'Ezreal', '이즈리얼', ['adc'], 'A', ['marksman', 'poke'], 55, 70, 55, 40, 60),
  c('jhin', 'Jhin', '진', ['adc'], 'A', ['marksman', 'poke', 'teamfight'], 55, 65, 70, 30, 50),
  c('jinx', 'Jinx', '징크스', ['adc'], 'A', ['marksman', 'teamfight'], 40, 90, 75, 40, 45),
  c('kaisa', 'Kai\'Sa', '카이사', ['adc'], 'S', ['marksman', 'assassin', 'teamfight'], 50, 85, 75, 45, 60),
  c('kalista', 'Kalista', '칼리스타', ['adc'], 'B', ['marksman', 'engage'], 70, 50, 60, 35, 75),
  c('kogmaw', 'Kog\'Maw', '코그모', ['adc'], 'C', ['marksman', 'teamfight'], 25, 95, 65, 20, 40),
  c('lucian', 'Lucian', '루시안', ['adc'], 'B', ['marksman'], 75, 45, 50, 45, 50),
  c('miss_fortune', 'Miss Fortune', '미스 포츈', ['adc'], 'B', ['marksman', 'teamfight'], 60, 60, 75, 25, 25),
  c('nilah', 'Nilah', '닐라', ['adc'], 'C', ['fighter', 'marksman', 'teamfight'], 45, 75, 65, 35, 55),
  c('samira', 'Samira', '사미라', ['adc'], 'B', ['marksman', 'assassin', 'teamfight'], 55, 65, 70, 35, 60),
  c('sivir', 'Sivir', '시비르', ['adc'], 'B', ['marksman', 'teamfight'], 40, 70, 65, 45, 30),
  c('tristana', 'Tristana', '트리스타나', ['adc', 'mid'], 'B', ['marksman', 'splitpush'], 55, 75, 55, 60, 40),
  c('twitch', 'Twitch', '트위치', ['adc'], 'C', ['marksman', 'assassin', 'teamfight'], 35, 85, 70, 30, 40),
  c('varus', 'Varus', '바루스', ['adc'], 'A', ['marksman', 'poke', 'teamfight'], 60, 65, 75, 25, 45),
  c('vayne', 'Vayne', '베인', ['adc', 'top'], 'B', ['marksman', 'splitpush'], 40, 90, 50, 70, 60),
  c('xayah', 'Xayah', '자야', ['adc'], 'A', ['marksman', 'teamfight'], 50, 75, 70, 35, 55),
  c('zeri', 'Zeri', '제리', ['adc'], 'B', ['marksman', 'teamfight'], 45, 80, 60, 50, 60),

  // ═══════════════════════════════════════════
  // SUPPORT PRIMARY
  // ═══════════════════════════════════════════
  c('alistar', 'Alistar', '알리스타', ['support'], 'A', ['tank', 'engage', 'teamfight'], 55, 50, 85, 10, 40),
  c('bard', 'Bard', '바드', ['support'], 'B', ['support', 'engage'], 55, 60, 65, 25, 75),
  c('blitzcrank', 'Blitzcrank', '블리츠크랭크', ['support'], 'C', ['tank', 'engage'], 65, 40, 55, 10, 35),
  c('braum', 'Braum', '브라움', ['support'], 'B', ['tank', 'engage', 'teamfight'], 50, 50, 80, 10, 30),
  c('janna', 'Janna', '잔나', ['support'], 'B', ['support', 'poke'], 40, 60, 70, 10, 40),
  c('karma', 'Karma', '카르마', ['support', 'mid'], 'B', ['mage', 'support', 'poke'], 60, 45, 60, 15, 35),
  c('leona', 'Leona', '레오나', ['support'], 'B', ['tank', 'engage', 'teamfight'], 60, 45, 80, 10, 30),
  c('lulu', 'Lulu', '룰루', ['support'], 'A', ['support', 'teamfight'], 45, 70, 75, 10, 40),
  c('milio', 'Milio', '밀리오', ['support'], 'A', ['support', 'teamfight'], 45, 65, 80, 10, 40),
  c('morgana', 'Morgana', '모르가나', ['support'], 'C', ['mage', 'support'], 50, 55, 65, 15, 35),
  c('nami', 'Nami', '나미', ['support'], 'B', ['support', 'poke', 'teamfight'], 55, 55, 70, 10, 40),
  c('nautilus', 'Nautilus', '노틸러스', ['support'], 'A', ['tank', 'engage', 'teamfight'], 60, 45, 80, 10, 30),
  c('pyke', 'Pyke', '파이크', ['support'], 'B', ['assassin', 'engage'], 70, 35, 50, 15, 60),
  c('rakan', 'Rakan', '라칸', ['support'], 'A', ['engage', 'support', 'teamfight'], 55, 50, 90, 10, 55),
  c('rell', 'Rell', '렐', ['support'], 'B', ['tank', 'engage', 'teamfight'], 50, 50, 85, 10, 45),
  c('renata', 'Renata Glasc', '레나타 글라스크', ['support'], 'A', ['support', 'teamfight'], 45, 70, 85, 10, 55),
  c('seraphine', 'Seraphine', '세라핀', ['support', 'adc'], 'B', ['mage', 'support', 'teamfight'], 40, 65, 80, 15, 35),
  c('senna', 'Senna', '세나', ['support', 'adc'], 'B', ['marksman', 'support'], 50, 75, 60, 20, 45),
  c('sona', 'Sona', '소나', ['support'], 'C', ['support', 'teamfight'], 30, 70, 75, 10, 25),
  c('soraka', 'Soraka', '소라카', ['support'], 'C', ['support'], 35, 65, 65, 10, 30),
  c('taric', 'Taric', '타릭', ['support'], 'C', ['tank', 'support', 'teamfight'], 30, 60, 80, 10, 40),
  c('thresh', 'Thresh', '쓰레쉬', ['support'], 'S', ['tank', 'engage', 'teamfight'], 55, 55, 80, 10, 70),
  c('yuumi', 'Yuumi', '유미', ['support'], 'D', ['support'], 20, 70, 55, 5, 25),
  c('zilean', 'Zilean', '질리언', ['support', 'mid'], 'C', ['mage', 'support', 'teamfight'], 40, 70, 70, 15, 50),
  c('zyra', 'Zyra', '자이라', ['support'], 'C', ['mage', 'poke', 'teamfight'], 55, 50, 65, 15, 40),

  // ═══════════════════════════════════════════
  // FLEX / MULTI-ROLE & 추가 챔피언
  // ═══════════════════════════════════════════
  c('brand', 'Brand', '브랜드', ['support', 'mid'], 'C', ['mage', 'poke', 'teamfight'], 55, 60, 65, 15, 35),
  c('fiddlesticks', 'Fiddlesticks', '피들스틱', ['jungle'], 'C', ['mage', 'teamfight'], 35, 65, 85, 20, 45),
  c('kayle', 'Kayle', '케일', ['top'], 'C', ['fighter', 'mage'], 15, 95, 65, 60, 40),
  c('rammus', 'Rammus', '람머스', ['jungle'], 'C', ['tank', 'engage'], 45, 50, 60, 20, 25),
  c('skarner', 'Skarner', '스카너', ['jungle'], 'B', ['tank', 'engage', 'teamfight'], 50, 50, 75, 25, 35),
  c('swain', 'Swain', '스웨인', ['support', 'mid'], 'C', ['mage', 'teamfight'], 40, 70, 70, 20, 35),
  c('velkoz', 'Vel\'Koz', '벨코즈', ['support', 'mid'], 'C', ['mage', 'poke', 'teamfight'], 50, 60, 65, 15, 50),
  c('vladimir', 'Vladimir', '블라디미르', ['mid', 'top'], 'B', ['mage', 'teamfight'], 30, 85, 70, 40, 50),
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
