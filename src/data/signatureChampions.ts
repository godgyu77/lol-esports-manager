/**
 * [주요 선수 시그니처 챔피언 매핑]
 * - 선수 이름 → 대표 챔피언 ID 배열 (앞쪽일수록 숙련도 높음)
 * - 여기 없는 선수는 자동 생성 로직으로 배정
 * - championDb.ts의 ID와 매칭
 */

export const SIGNATURE_CHAMPIONS: Record<string, string[]> = {
  // ═══════════════════════════════════════════
  // T1
  // ═══════════════════════════════════════════
  'Faker': ['azir', 'leblanc', 'orianna', 'ryze', 'syndra', 'ahri', 'corki'],
  'Oner': ['lee_sin', 'viego', 'vi', 'sejuani', 'nidalee'],
  'Doran': ['ksante', 'aatrox', 'renekton', 'gnar', 'rumble'],
  'Peyz': ['kaisa', 'aphelios', 'jinx', 'ezreal', 'varus'],
  'Keria': ['thresh', 'rakan', 'renata', 'nautilus', 'lulu', 'pyke'],

  // ═══════════════════════════════════════════
  // Gen.G
  // ═══════════════════════════════════════════
  'Kiin': ['ksante', 'aatrox', 'gnar', 'jax', 'ornn', 'kennen'],
  'Canyon': ['lee_sin', 'viego', 'nidalee', 'graves', 'kindred', 'taliyah'],
  'Chovy': ['azir', 'orianna', 'syndra', 'ahri', 'viktor', 'sylas', 'corki'],
  'Peyz_geng': ['kaisa', 'aphelios', 'varus', 'xayah', 'jinx'],
  'Lehends': ['thresh', 'nautilus', 'rakan', 'lulu', 'braum', 'bard'],

  // ═══════════════════════════════════════════
  // Hanwha Life Esports
  // ═══════════════════════════════════════════
  'Zeus': ['ksante', 'jayce', 'yone', 'gwen', 'camille', 'irelia', 'aatrox'],
  'Peanut': ['lee_sin', 'sejuani', 'maokai', 'viego', 'hecarim', 'jarvan_iv'],
  'Zeka': ['akali', 'sylas', 'azir', 'leblanc', 'ahri', 'syndra'],
  'Viper': ['aphelios', 'kaisa', 'xayah', 'ezreal', 'draven', 'kalista'],
  'Delight': ['nautilus', 'thresh', 'alistar', 'rakan', 'leona'],

  // ═══════════════════════════════════════════
  // DK (Dplus KIA)
  // ═══════════════════════════════════════════
  'Kingen': ['aatrox', 'ksante', 'renekton', 'gnar', 'ornn', 'jax'],
  'Lucid': ['lee_sin', 'viego', 'nidalee', 'graves', 'khazix'],
  'ShowMaker': ['azir', 'akali', 'leblanc', 'syndra', 'orianna', 'ahri', 'zed'],
  'Aiming': ['jhin', 'jinx', 'kaisa', 'aphelios', 'varus', 'ezreal'],
  'Kellin': ['nautilus', 'thresh', 'lulu', 'renata', 'alistar'],

  // ═══════════════════════════════════════════
  // KT Rolster
  // ═══════════════════════════════════════════
  'PerfecT': ['ksante', 'aatrox', 'gnar', 'ornn', 'sett'],
  'Cuzz': ['lee_sin', 'hecarim', 'sejuani', 'viego', 'jarvan_iv'],
  'Bdd': ['azir', 'syndra', 'viktor', 'ahri', 'corki', 'ryze'],
  'Deft': ['ezreal', 'jinx', 'aphelios', 'jhin', 'kaisa', 'varus'],
  'BeryL': ['thresh', 'bard', 'rakan', 'nautilus', 'pyke', 'lulu'],

  // ═══════════════════════════════════════════
  // LPL 주요 선수
  // ═══════════════════════════════════════════
  'Bin': ['fiora', 'jax', 'camille', 'irelia', 'ksante', 'aatrox'],
  'Tian': ['lee_sin', 'viego', 'nidalee', 'elise', 'graves'],
  'Knight': ['syndra', 'azir', 'orianna', 'leblanc', 'ahri', 'viktor'],
  'Elk': ['kaisa', 'aphelios', 'jinx', 'ezreal', 'varus'],
  'Missing': ['nautilus', 'thresh', 'alistar', 'rakan', 'braum'],
  'Xiaohu': ['sylas', 'leblanc', 'ahri', 'azir', 'ryze'],
  'Wei': ['lee_sin', 'viego', 'xin_zhao', 'jarvan_iv', 'wukong'],
  'GALA': ['kaisa', 'jinx', 'xayah', 'aphelios', 'tristana'],
  'Ruler': ['aphelios', 'jinx', 'kaisa', 'varus', 'jhin', 'ezreal'],
  'Scout': ['azir', 'ahri', 'leblanc', 'viktor', 'sylas'],
  'Meiko': ['thresh', 'nautilus', 'alistar', 'rakan', 'braum', 'leona'],
  'Breathe': ['ksante', 'gnar', 'aatrox', 'renekton', 'camille'],
  'Kanavi': ['lee_sin', 'viego', 'graves', 'nidalee', 'kindred'],
  'Yagao': ['syndra', 'azir', 'orianna', 'zoe', 'ryze'],
  'JackeyLove': ['kaisa', 'draven', 'aphelios', 'ezreal', 'samira'],
  'ON': ['thresh', 'nautilus', 'rakan', 'lulu', 'braum'],
  'TheShy': ['fiora', 'jayce', 'irelia', 'camille', 'ksante', 'riven'],
  'Tarzan': ['lee_sin', 'nidalee', 'graves', 'viego', 'kindred'],
  'Rookie': ['leblanc', 'azir', 'syndra', 'orianna', 'irelia', 'ahri'],
  'Light': ['jinx', 'aphelios', 'kaisa', 'ezreal', 'varus'],
  'Hang': ['thresh', 'nautilus', 'rakan', 'alistar', 'braum'],
  'Wayward': ['ksante', 'aatrox', 'jax', 'gnar', 'camille'],
  'Jiejie': ['lee_sin', 'viego', 'vi', 'jarvan_iv', 'reksai'],

  // ═══════════════════════════════════════════
  // LEC 주요 선수
  // ═══════════════════════════════════════════
  'Caps': ['sylas', 'leblanc', 'akali', 'azir', 'orianna', 'corki'],
  'Jankos': ['lee_sin', 'sejuani', 'jarvan_iv', 'viego', 'maokai'],
  'Hans sama': ['jinx', 'aphelios', 'kaisa', 'xayah', 'ezreal'],
  'Mikyx': ['thresh', 'rakan', 'nautilus', 'braum', 'lulu'],
  'BrokenBlade': ['aatrox', 'ksante', 'gnar', 'irelia', 'jax'],
  'Inspired': ['lee_sin', 'viego', 'graves', 'nidalee', 'lillia'],
  'Humanoid': ['azir', 'ahri', 'syndra', 'leblanc', 'sylas'],
  'Upset': ['jinx', 'aphelios', 'kaisa', 'xayah', 'varus'],
  'Hylissang': ['rakan', 'thresh', 'pyke', 'nautilus', 'alistar'],
  'Odoamne': ['ornn', 'aatrox', 'gnar', 'ksante', 'sion'],
  'Elyoya': ['lee_sin', 'viego', 'maokai', 'sejuani', 'hecarim'],

  // ═══════════════════════════════════════════
  // LCS 주요 선수
  // ═══════════════════════════════════════════
  'Impact': ['ornn', 'ksante', 'aatrox', 'gnar', 'renekton', 'shen'],
  'Blaber': ['lee_sin', 'viego', 'nidalee', 'kindred', 'graves'],
  'Jojopyun': ['akali', 'leblanc', 'sylas', 'ahri', 'azir'],
  'Berserker': ['aphelios', 'jinx', 'kaisa', 'zeri', 'ezreal'],
  'Vulcan': ['nautilus', 'thresh', 'rakan', 'alistar', 'braum'],
  'Ssumday': ['aatrox', 'ksante', 'gnar', 'ornn', 'jax'],
  'Closer': ['lee_sin', 'viego', 'nidalee', 'graves', 'elise'],
  'Abbedagge': ['azir', 'ahri', 'syndra', 'viktor', 'orianna'],
  'FBI': ['jinx', 'kaisa', 'aphelios', 'xayah', 'ezreal'],
  'CoreJJ': ['thresh', 'nautilus', 'rakan', 'lulu', 'braum', 'renata'],
};
