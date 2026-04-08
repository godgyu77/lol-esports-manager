export type TraitTier = 'S' | 'A' | 'B' | 'C' | 'NEG';
export type TraitPolarity = 'positive' | 'negative' | 'mixed' | 'prospect';

export interface TraitEffectProfile {
  lane?: number;
  teamfight?: number;
  consistency?: number;
  risk?: number;
  growth?: number;
  championPool?: number;
  mental?: number;
  shotcalling?: number;
}

export interface Trait {
  name: string;
  tier: TraitTier;
  polarity: TraitPolarity;
  desc: string;
  effectProfile?: TraitEffectProfile;
}

function defineTrait(
  name: string,
  tier: TraitTier,
  polarity: TraitPolarity,
  desc: string,
  effectProfile: TraitEffectProfile = {},
): Trait {
  return { name, tier, polarity, desc, effectProfile };
}

const positive = (
  name: string,
  tier: Exclude<TraitTier, 'NEG'>,
  desc: string,
  effectProfile: TraitEffectProfile = {},
): Trait => defineTrait(name, tier, 'positive', desc, effectProfile);

const mixed = (
  name: string,
  tier: Exclude<TraitTier, 'NEG'>,
  desc: string,
  effectProfile: TraitEffectProfile = {},
): Trait => defineTrait(name, tier, 'mixed', desc, effectProfile);

const prospect = (
  name: string,
  tier: 'A' | 'B' | 'C',
  desc: string,
  effectProfile: TraitEffectProfile = {},
): Trait => defineTrait(name, tier, 'prospect', desc, effectProfile);

const negative = (
  name: string,
  desc: string,
  effectProfile: TraitEffectProfile = {},
): Trait => defineTrait(name, 'NEG', 'negative', desc, effectProfile);

export const TRAIT_LIBRARY: Record<string, Trait> = {
  HEAVEN_BEYOND: positive('천외천', 'S', '압도적인 라인 장악력과 초고점 캐리력.', { lane: 4, consistency: 2 }),
  UNKILLABLE: positive('불사신', 'S', '중요한 순간 무너지지 않는 생존력.', { teamfight: 3, mental: 2, consistency: 1 }),
  RULER_ENDING: positive('후반 해결사', 'S', '후반 교전에서 존재감이 폭발한다.', { teamfight: 4, consistency: 1 }),
  CANYON_GAP: positive('정글 격차', 'S', '맵 주도권과 정글 운영이 매우 강함.', { lane: 2, teamfight: 2, shotcalling: 1 }),
  CLUTCH_GOD: positive('클러치의 신', 'S', '승부처 집중력이 최상급.', { teamfight: 4, consistency: 2, mental: 2 }),
  HEXAGON: positive('육각형', 'S', '큰 약점 없이 모든 국면이 강하다.', { lane: 2, teamfight: 2, consistency: 2 }),
  ROMANTIC: mixed('로망', 'S', '고점은 매우 높지만 선택이 과감하다.', { teamfight: 3, risk: 2, mental: 1 }),
  PROFESSOR: positive('교수', 'S', '운영과 해석, 판단이 매우 뛰어나다.', { teamfight: 2, consistency: 2, shotcalling: 3 }),
  GOD_THUNDER: positive('번개의 신', 'S', '라인전 폭발력이 최고 수준.', { lane: 5, risk: 1 }),
  HYPER_MECHANIC: positive('하이퍼 메카닉', 'S', '순수 피지컬과 미세 조작이 매우 좋다.', { lane: 3, teamfight: 2 }),
  THE_COMMANDER: positive('대지휘관', 'S', '팀 전체의 전투 질서를 끌어올린다.', { teamfight: 2, consistency: 2, shotcalling: 4 }),
  MAP_HACK: positive('맵핵', 'S', '시야 해석과 위험 감지가 탁월하다.', { consistency: 2, risk: -2, shotcalling: 2 }),
  DAMAGE_MACHINE: positive('딜머신', 'S', '딜링 기대치가 항상 높다.', { teamfight: 4, consistency: 1 }),
  NEXUS_DEFENDER: positive('넥서스 수호자', 'S', '수세에서 버티며 역전각을 만든다.', { teamfight: 3, mental: 2 }),
  FIRST_MOVE: positive('선공권', 'S', '주도권을 잡는 속도가 빠르다.', { lane: 3, teamfight: 1, shotcalling: 1 }),
  ZONE_CONTROLLER: positive('공간 지배자', 'S', '오브젝트와 전장 지형 장악이 뛰어나다.', { teamfight: 3, shotcalling: 2 }),
  MECHANIC_GOD: positive('메카닉의 신', 'S', '피지컬 고점이 가장 높은 축에 속한다.', { lane: 3, teamfight: 3 }),
  HYPER_CARRY: positive('하이퍼 캐리', 'S', '자원을 받으면 확실히 경기 판도를 바꾼다.', { teamfight: 4, risk: 1 }),

  COMMANDER: positive('메인 리더', 'A', '콜과 팀 전투 정리에 강함.', { teamfight: 1, shotcalling: 3 }),
  LANE_KINGDOM: positive('라인 킹덤', 'A', '라인전 우위를 만들 확률이 높다.', { lane: 3 }),
  SMITE_KING: positive('강타의 왕', 'A', '오브젝트 마무리와 타이밍이 정확하다.', { consistency: 1, shotcalling: 1 }),
  ROAMING_GOD: positive('로밍의 신', 'A', '사이드 개입과 연계가 좋다.', { lane: 1, teamfight: 2, shotcalling: 1 }),
  BIG_GAME: positive('빅게임 헌터', 'A', '큰 경기에서 오히려 힘이 붙는다.', { teamfight: 2, mental: 2 }),
  IRON_WILL: positive('강철 멘탈', 'A', '실수 후에도 흔들림이 적다.', { consistency: 2, mental: 2 }),
  WAILING_WALL: positive('철벽', 'A', '압박을 버티는 능력이 좋다.', { lane: 2, consistency: 1 }),
  GUERRILLA: mixed('게릴라', 'A', '예상 밖 진입으로 변수를 만들지만 리스크도 있다.', { teamfight: 2, risk: 2 }),
  VARIABLE_MAKER: mixed('변수 창출', 'A', '불리한 게임에서도 각을 만들지만 안정감은 낮다.', { teamfight: 2, risk: 2 }),
  SWISS_KNIFE: positive('멀티툴', 'A', '여러 역할과 조합을 안정적으로 수행한다.', { consistency: 2, championPool: 2 }),
  KILL_CATCHER: positive('킬 캐처', 'A', '마무리 능력과 교전 마감이 좋다.', { teamfight: 2, consistency: 1 }),
  VISIONARY: positive('시야 장인', 'A', '시야 관리와 정보전이 뛰어나다.', { consistency: 1, risk: -1, shotcalling: 2 }),
  SURVIVOR: positive('생존자', 'A', '한타 생존률이 높고 후속 딜 기여가 좋다.', { teamfight: 2, mental: 1 }),
  BARON_SLAYER: positive('바론 사냥꾼', 'A', '오브젝트 템포를 잘 잡는다.', { consistency: 1, shotcalling: 1 }),
  COUNTER_PUNCH: positive('카운터 펀치', 'A', '상대 진입에 대한 응징이 날카롭다.', { teamfight: 2, consistency: 1 }),
  ULTIMATE_HUNTER: positive('궁극기 헌터', 'A', '핵심 스킬 타이밍 활용이 좋다.', { teamfight: 2 }),
  CHAMP_OCEAN: positive('챔프 오션', 'A', '넓은 챔프폭으로 밴픽 가치가 높다.', { championPool: 4 }),
  STEAL_GOD: positive('스틸의 신', 'A', '접전 오브젝트에서 확률을 비튼다.', { risk: 1, consistency: 1 }),
  MECHANIC_SUPPORT: positive('메카닉 서포터', 'A', '교전형 서포터 조작이 뛰어나다.', { lane: 1, teamfight: 2 }),
  DARK_TECHNOLOGY: mixed('흑마술', 'A', '비주류 카드로 변수 창출에 능하지만 편차가 있다.', { championPool: 2, risk: 2 }),
  TOP_CARRY: positive('탑 캐리', 'A', '사이드와 한타 모두에서 상체 캐리력이 좋다.', { lane: 2, teamfight: 2 }),
  NEWBIE_SENSATION: prospect('루키 센세이션', 'A', '초기부터 기대치 이상의 임팩트를 보여준다.', { growth: 4, mental: 1 }),
  RESOURCE_HEAVY: mixed('자원 집중형', 'A', '자원을 받으면 강하지만 팀 전체 분배는 경직된다.', { teamfight: 3, risk: 1 }),
  SMART_JUNGLE: positive('스마트 정글', 'A', '동선 최적화와 정보 활용이 좋다.', { consistency: 1, shotcalling: 2 }),
  CARRY_JUNGLE: positive('캐리 정글', 'A', '정글임에도 딜링 비중이 높다.', { teamfight: 2, risk: 1 }),
  GANKING_MACHINE: positive('갱킹 머신', 'A', '초반 개입 성공률이 높다.', { lane: 2, shotcalling: 1 }),
  SMART: positive('영리함', 'A', '전체 게임 이해와 선택이 좋다.', { consistency: 2, shotcalling: 1 }),
  ENGAGE_SUPPORT: positive('이니시 서포터', 'A', '개시 각을 잘 잡는다.', { teamfight: 2, risk: 1 }),
  ENGAGE_GOD: positive('이니시의 신', 'A', '한타 개시 품질이 최고급이다.', { teamfight: 3, shotcalling: 1 }),
  TEAMFIGHT_GLADIATOR: positive('한타 투사', 'A', '라인보다 교전에서 더 강하다.', { teamfight: 3 }),
  CONTROL: positive('컨트롤', 'A', '경기 속도를 제어하는 능력이 좋다.', { consistency: 2, shotcalling: 2 }),
  BIG_GAME_PLAYER: positive('큰 경기 체질', 'A', '중압감이 클수록 집중력이 오르는 유형.', { teamfight: 2, consistency: 1, mental: 2 }),
  CLUTCH: positive('클러치', 'A', '박빙 상황에서 집중력이 올라간다.', { teamfight: 2, consistency: 1, mental: 1 }),

  SPLIT_PUSHER: positive('스플릿 푸셔', 'B', '사이드 운영에서 강점을 보인다.', { lane: 1, risk: 1 }),
  STEEL_STAMINA: positive('강철 체력', 'B', '후반 집중력 유지가 좋다.', { consistency: 1, mental: 1 }),
  AGGRESSIVE: mixed('공격 본능', 'B', '적극적으로 각을 보지만 리스크도 감수한다.', { lane: 1, teamfight: 1, risk: 2 }),
  STONE_HEAD: positive('돌머리', 'B', '압박 속에서도 단단하게 버틴다.', { lane: 1, consistency: 1 }),
  VETERAN: positive('베테랑', 'B', '경험 기반의 안정감이 있다.', { consistency: 2, mental: 1 }),
  JOKER_PICK: mixed('조커 픽', 'B', '특수 카드 가치가 있지만 기복도 있다.', { championPool: 2, risk: 1 }),
  BUSH_MASTER: positive('부쉬 플레이', 'B', '시야 사각 활용과 기습이 좋다.', { risk: -1, teamfight: 1 }),
  LANE_FREEZER: positive('라인 프리징', 'B', '웨이브 관리로 상대 성장을 묶는다.', { lane: 1 }),
  WARD_CLEANER: positive('시야 청소부', 'B', '시야 제거와 정보전 이득을 만든다.', { consistency: 1, shotcalling: 1 }),
  ASSIST_KING: positive('어시스트 킹', 'B', '연계 완성도가 좋다.', { teamfight: 1, shotcalling: 1 }),
  BLUE_WORKER: positive('헌신형', 'B', '팀을 위해 손해를 감수할 수 있다.', { teamfight: 1, consistency: 1 }),
  COMFORT_PICK: positive('장인 픽', 'B', '특정 픽에서 숙련도 보정이 크게 붙는다.', { championPool: 2 }),
  FIRST_BLOOD: mixed('퍼블 본능', 'B', '초반 킬 관여가 높지만 과열될 수 있다.', { lane: 1, risk: 1 }),
  TURRET_HUGGER: positive('포탑 수호자', 'B', '받아치는 수비에 강하다.', { lane: 1, mental: 1 }),
  CONSISTENT: positive('꾸준함', 'B', '고점보다 평균이 안정적이다.', { consistency: 3 }),
  POKE_MASTER: positive('포킹 장인', 'B', '대치 구도에서 체력 우위를 만든다.', { teamfight: 1 }),
  EXPERIENCED: positive('경험 많음', 'B', '베테랑 하위 호환의 안정형.', { consistency: 1, mental: 1 }),
  STEADY: positive('안정형', 'B', '큰 기복 없이 자기 몫을 수행한다.', { consistency: 2 }),
  RPG_JUNGLE: mixed('RPG 정글', 'B', '성장 위주 동선으로 초반 개입은 줄어든다.', { teamfight: 1, risk: 1 }),
  COIN_FLIP: mixed('코인플립', 'B', '정말 잘되거나 크게 꼬인다.', { teamfight: 1, risk: 3 }),
  SOLO_KILL: positive('솔로킬러', 'B', '1대1 킬각을 잘 본다.', { lane: 2, risk: 1 }),
  TRASH_TALKER: mixed('트래시 토커', 'B', '상대를 흔들 수 있지만 본인도 과열된다.', { mental: 1, risk: 1 }),
  MELEE_MID: positive('근접 미드', 'B', '근접형 미드 숙련이 좋다.', { championPool: 1, lane: 1 }),
  ROAMING: positive('로밍', 'B', '라인 이탈 후 영향력을 만든다.', { lane: 1, shotcalling: 1 }),
  PLAYMAKER: positive('플레이메이커', 'B', '교전 각을 만들고 한타 흐름을 바꾼다.', { teamfight: 2, shotcalling: 1, risk: 1 }),

  SCRATCH_LOTTERY: prospect('복권', 'C', '고점과 저점 차이가 큰 성장형.', { growth: 2, risk: 2 }),
  SPONGE: prospect('스펀지', 'C', '배우는 속도가 빠르다.', { growth: 3 }),
  PURE_MECH: mixed('퓨어 메카닉', 'C', '피지컬은 좋지만 운영 이해는 부족하다.', { lane: 2, teamfight: 1, consistency: -1 }),
  GROWTH_POTENTIAL: prospect('성장 잠재력', 'C', '시간과 경험을 먹고 올라갈 가능성이 크다.', { growth: 4 }),
  NEWBIE: prospect('신인', 'C', '가능성은 있지만 아직 거칠다.', { growth: 2, consistency: -1 }),
  SOLO_RANK_WARRIOR: mixed('솔랭 전사', 'C', '개인기는 좋지만 팀 호흡은 아쉽다.', { lane: 1, teamfight: -1, risk: 1 }),
  COPYCAT: prospect('카피캣', 'C', '빠르게 따라 배우는 성장형.', { growth: 2, championPool: 1 }),
  LATE_BLOOMER: prospect('대기만성', 'C', '천천히 올라오지만 오래 성장한다.', { growth: 3, mental: 1 }),
  AUDACIOUS: mixed('대담함', 'C', '겁이 없어서 좋은 각도 보지만 무리수도 많다.', { teamfight: 1, risk: 2 }),
  PRACTICE_BUG: prospect('연습벌레', 'C', '연습 효율이 높다.', { growth: 3, championPool: 1 }),
  FARMING_MACHINE: mixed('CS 머신', 'C', '수급은 좋지만 개입이 느리다.', { lane: 1, teamfight: -1 }),
  OFF_META: mixed('오프메타', 'C', '비정형 카드 활용은 좋지만 편차가 있다.', { championPool: 1, risk: 1 }),
  SOLO_KILL_HUNTER: mixed('킬각 사냥꾼', 'C', '솔로킬을 노리며 무리하는 경향.', { lane: 1, risk: 2 }),
  GLASS_CANNON: mixed('유리 대포', 'C', '딜 고점은 있으나 안정성이 낮다.', { teamfight: 2, consistency: -1, risk: 2 }),
  EMOTIONAL: mixed('감정 기복', 'C', '분위기에 따라 경기력이 흔들린다.', { mental: -2, consistency: -1 }),

  DICE_ROLL: negative('주사위', '기복이 극단적으로 심하다.', { consistency: -3, risk: 2 }),
  GLASS_MENTAL: negative('유리 멘탈', '실점 후 급격히 흔들린다.', { mental: -3, consistency: -2 }),
  CHAMP_PUDDLE: negative('챔프 폭 협소', '메타 변화 대응이 어렵다.', { championPool: -4 }),
  TUNNEL_VISION: negative('터널 시야', '한 가지에 몰입해 큰 그림을 놓친다.', { shotcalling: -2, risk: 1 }),
  THROWING: negative('던짐', '유리한 상황에서도 무리해 기회를 준다.', { consistency: -2, risk: 4 }),
  HOMESICK: negative('홈시크', '장기 원정이나 낯선 환경에 약하다.', { mental: -2 }),
  KDA_PLAYER: negative('KDA 지향', '리스크를 회피해 팀 기회도 줄어든다.', { teamfight: -1, risk: -1 }),
  COMM_ERROR: negative('소통 불안', '콜과 합류 판단이 어긋난다.', { shotcalling: -3, teamfight: -1 }),
  FACE_CHECKER: negative('페이스체커', '시야 없는 구역 진입이 잦다.', { risk: 3 }),
  OBJ_ALLERGY: negative('오브젝트 알러지', '중립 오브젝트 판단이 약하다.', { shotcalling: -2, consistency: -1 }),
  ZOMBIE: negative('좀비', '죽고도 다시 물며 손실을 키우기 쉽다.', { risk: 3, mental: -1 }),
  NO_FLASH: negative('노플병', '생존 스펠 사용이 지나치게 늦다.', { risk: 2 }),
  INVADE_VICTIM: negative('인베 약점', '초반 설계에 쉽게 흔들린다.', { lane: -1, mental: -1 }),
  CS_ALLERGY: negative('CS 알러지', '기본 수급에서 손해를 보기 쉽다.', { lane: -2 }),
  PASSIVE: negative('수동적', '주도적으로 기회를 만들지 못한다.', { lane: -1, teamfight: -1, shotcalling: -1 }),
  TILTER: negative('틸터', '불리해지면 경기력이 눈에 띄게 흔들린다.', { mental: -2, consistency: -2 }),
  LANE_WEAKNESS: negative('라인 약점', '라인전 손해를 볼 확률이 높다.', { lane: -3 }),
};
