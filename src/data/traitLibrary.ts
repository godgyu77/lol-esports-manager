/**
 * [특성 라이브러리 (Trait Dictionary) - 최종 통합판]
 * - 등급 체계:
 * S: 슈퍼스타/전설 (게임의 판도를 뒤집는 능력)
 * A: 엘리트/고유 (특정 분야의 최상위 능력)
 * B: 일반/전략적 (준수한 능력 또는 특정 상황 특화)
 * C: 유망주/성장형 (잠재력 또는 초기 능력)
 * NEG: 부정적 (패널티 또는 위험 요소)
 */

export type TraitTier = 'S' | 'A' | 'B' | 'C' | 'NEG';

export interface Trait {
  name: string;
  tier: TraitTier;
  desc: string;
}

export const TRAIT_LIBRARY: Record<string, Trait> = {
  // ==========================================
  // [S등급: 슈퍼스타 고유 특성 (Legendary)]
  // ==========================================
  "HEAVEN_BEYOND": { name: "천외천(天外天)", tier: "S", desc: "CS 수급률 120% 고정, 골드 차이가 날수록 무력 스탯 무한 상승" },
  "UNKILLABLE": { name: "불사대마왕", tier: "S", desc: "팀이 지고 있을 때 모든 스탯 +20%, 아군 멘탈 방어" },
  "RULER_ENDING": { name: "엔딩 메이커", tier: "S", desc: "35분 이후 후반 캐리력 및 딜링 +25%" },
  "CANYON_GAP": { name: "협곡의 주인", tier: "S", desc: "적 정글보다 레벨이 높을 때 교전 능력 +20%" },
  "CLUTCH_GOD": { name: "클러치 히터", tier: "S", desc: "결승전, 5세트 등 중요한 순간 반응속도/한타 +30%" },
  "HEXAGON": { name: "육각형", tier: "S", desc: "모든 스탯이 균형 잡혀 있으며 컨디션 난조가 없음" },
  "ROMANTIC": { name: "낭만", tier: "S", desc: "불리한 교전에서 도망치지 않음, 역전 슈퍼플레이 확률 대폭 상승" },
  "PROFESSOR": { name: "롤 도사", tier: "S", desc: "상대 밴픽 및 인게임 전략을 꿰뚫어봄, 팀 운영 +20%" },
  "GOD_THUNDER": { name: "번개의 신", tier: "S", desc: "탑 라인전 승률 99%, 상대 라이너 멘탈 파괴" },
  "HYPER_MECHANIC": { name: "신계의 손놀림", tier: "S", desc: "논타겟 스킬 회피율 50% 보정, 피지컬 스탯 MAX" },
  "THE_COMMANDER": { name: "마에스트로", tier: "S", desc: "한타 시 아군 전원의 포지셔닝 및 스킬 적중률 대폭 보정" },
  "MAP_HACK": { name: "맵핵", tier: "S", desc: "상대 정글 위치 예측 성공률 95%, 갱킹 면역" },
  "DAMAGE_MACHINE": { name: "딜링 머신", tier: "S", desc: "챔피언 상성을 무시하고 항상 팀 내 딜량 1등 달성" },
  "NEXUS_DEFENDER": { name: "인간 넥서스", tier: "S", desc: "쌍둥이 타워가 밀려도 혼자서 라인 클리어 및 수비 가능" },
  "FIRST_MOVE": { name: "선공권", tier: "S", desc: "모든 교전에서 선제 공격권 및 이니시에이팅 우선권 가짐" },
  "ZONE_CONTROLLER": { name: "공간의 지배자", tier: "S", desc: "특정 구역(용/바론 둥지) 장악 시 아군 스탯 상승" },
  "MECHANIC_GOD": { name: "메카닉의 신", tier: "S", desc: "피지컬 능력이 최고 수준 (반응속도/조작)" },
  "HYPER_CARRY": { name: "하이퍼 캐리", tier: "S", desc: "후반 캐리력이 극도로 뛰어나며 팀 자원을 독식하여 승리함" },

  // ==========================================
  // [A등급: 엘리트 선수 특성 (Elite)]
  // ==========================================
  "COMMANDER": { name: "메인 오더", tier: "A", desc: "팀 전체의 운영 능력치 +10%" },
  "LANE_KINGDOM": { name: "라인전 패왕", tier: "A", desc: "초반 15분 골드 획득량 +15%" },
  "SMITE_KING": { name: "강타의 신", tier: "A", desc: "오브젝트 스틸 확률 대폭 상승" },
  "ROAMING_GOD": { name: "로밍의 신", tier: "A", desc: "타 라인 개입 성공률 +20%" },
  "BIG_GAME": { name: "빅게임 헌터", tier: "A", desc: "플레이오프/국제전에서 스탯 +15%" },
  "IRON_WILL": { name: "미움받을 용기", tier: "A", desc: "이니시에이팅 시도 시 멘탈 차감 없음, 성공률 보정" },
  "WAILING_WALL": { name: "통곡의 벽", tier: "A", desc: "타워 다이브 방어 성공률 +30%, 버티기 최상" },
  "GUERRILLA": { name: "게릴라", tier: "A", desc: "시야가 없는 곳에서의 기습 공격 성공률 상승" },
  "VARIABLE_MAKER": { name: "변수 창출", tier: "A", desc: "불리한 게임에서 의외의 킬각을 만들어냄" },
  "SWISS_KNIFE": { name: "맥가이버", tier: "A", desc: "어떤 포지션/챔피언이든 A급 이상의 성능 발휘" },
  "KILL_CATCHER": { name: "킬 캐처", tier: "A", desc: "딸피인 적을 놓치지 않음, 마무리 능력 탁월" },
  "VISIONARY": { name: "시야 장인", tier: "A", desc: "와드 설치 및 제거 효율 +20%, 맵 장악력 상승" },
  "SURVIVOR": { name: "생존왕", tier: "A", desc: "한타에서 죽지 않고 끝까지 살아남아 딜을 넣음" },
  "BARON_SLAYER": { name: "바론 사냥꾼", tier: "A", desc: "20분 햇바론 트라이 성공률 및 속도 증가" },
  "COUNTER_PUNCH": { name: "카운터 펀치", tier: "A", desc: "상대가 들어올 때 받아치는 능력이 탁월함" },
  "ULTIMATE_HUNTER": { name: "궁극의 사냥꾼", tier: "A", desc: "궁극기 쿨타임 감소 효과 및 적중률 보정" },
  "CHAMP_OCEAN": { name: "챔프 바다", tier: "A", desc: "챔피언 폭이 매우 넓어 밴픽 싸움에서 유리함" },
  "STEAL_GOD": { name: "스틸의 신", tier: "A", desc: "오브젝트 스틸 성공률이 매우 높음 (SMITE_KING 상위호환)" },
  "MECHANIC_SUPPORT": { name: "메카닉 서포터", tier: "A", desc: "피지컬이 뛰어난 서포터, 스킬샷 정확도 높음" },
  "DARK_TECHNOLOGY": { name: "암흑 기술", tier: "A", desc: "비주류 전략 및 챔피언 활용에 능함" },
  "TOP_CARRY": { name: "탑 캐리", tier: "A", desc: "탑 라인 위주로 게임을 풀어갈 때 승률 상승" },
  "NEWBIE_SENSATION": { name: "신인 센세이션", tier: "A", desc: "데뷔 시즌에 S급 퍼포먼스를 발휘할 확률 높음" },
  "RESOURCE_HEAVY": { name: "자원 독식", tier: "A", desc: "골드와 경험치를 몰아먹고 그만큼 캐리함" },
  "SMART_JUNGLE": { name: "스마트 정글러", tier: "A", desc: "동선 낭비가 없고 상대 정글 위치를 잘 파악함" },
  "CARRY_JUNGLE": { name: "캐리 정글러", tier: "A", desc: "정글링과 교전 위주로 성장하여 라이너보다 강해짐" },
  "GANKING_MACHINE": { name: "갱킹 머신", tier: "A", desc: "초반 갱킹 성공률이 매우 높음" },
  "SMART": { name: "똑똑함", tier: "A", desc: "게임 이해도가 높고 최적의 판단을 내림" },
  "ENGAGE_SUPPORT": { name: "이니시 서포터", tier: "A", desc: "과감한 이니시에이팅으로 한타를 염" },
  "ENGAGE_GOD": { name: "이니시의 신", tier: "A", desc: "이니시에이팅 타이밍과 대박 성공률이 최고 수준" },
  "TEAMFIGHT_GLADIATOR": { name: "한타 검투사", tier: "A", desc: "라인전보다 5:5 한타에서 능력치가 대폭 상승함" },
  "CONTROL": { name: "컨트롤", tier: "A", desc: "게임의 템포와 오브젝트를 완벽하게 제어함" },

  // ==========================================
  // [B등급: 일반/전략적 특성 (General)]
  // ==========================================
  "SPLIT_PUSHER": { name: "스플릿 푸셔", tier: "B", desc: "사이드 운영 시 타워 철거 속도 증가" },
  "STEEL_STAMINA": { name: "강철 체력", tier: "B", desc: "5세트/장기전에도 집중력이 떨어지지 않음" },
  "AGGRESSIVE": { name: "공격 본능", tier: "B", desc: "킬 캐치 능력 상승, 데스 확률 소폭 증가" },
  "STONE_HEAD": { name: "돌머리", tier: "B", desc: "탑 라인전 버티기 능력 상승, 갱킹 면역" },
  "VETERAN": { name: "베테랑", tier: "B", desc: "팀 멘탈 하락 방어, 경험치 획득량 소폭 증가" },
  "JOKER_PICK": { name: "사파", tier: "B", desc: "비주류 챔피언 사용 시 라인전 보정 +10%" },
  "BUSH_MASTER": { name: "부쉬 플레이", tier: "B", desc: "부쉬 매복 및 시야 플레이 숙련도 높음" },
  "LANE_FREEZER": { name: "라인 프리징", tier: "B", desc: "CS 손실 없이 라인을 당겨서 상대 성장을 방해함" },
  "WARD_CLEANER": { name: "시야 지우개", tier: "B", desc: "상대 와드를 잘 지우며 시야 점수 보너스" },
  "ASSIST_KING": { name: "도우미", tier: "B", desc: "킬 양보를 잘하며 어시스트 골드 획득량 증가" },
  "BLUE_WORKER": { name: "블루워커", tier: "B", desc: "눈에 띄지 않지만 팀을 위한 궂은일을 도맡음" },
  "COMFORT_PICK": { name: "장인", tier: "B", desc: "선호하는 챔피언을 잡았을 때 스탯 상승" },
  "FIRST_BLOOD": { name: "퍼블 본능", tier: "B", desc: "경기 시작 5분 내 킬 관여율 높음" },
  "TURRET_HUGGER": { name: "타워 허그", tier: "B", desc: "타워 근처에서 방어력 상승" },
  "CONSISTENT": { name: "국밥", tier: "B", desc: "저점이 높지만 고점도 높지 않음" },
  "POKE_MASTER": { name: "포킹 장인", tier: "B", desc: "대치 구도에서 적 체력을 잘 깎음" },
  "EXPERIENCED": { name: "경험 많은", tier: "B", desc: "베테랑의 하위 호환, 안정적인 플레이" },
  "STEADY": { name: "안정적", tier: "B", desc: "큰 기복 없이 제 몫을 해냄" },
  "RPG_JUNGLE": { name: "RPG 정글러", tier: "B", desc: "갱킹보다는 정글링과 성장에 집중함" },
  "COIN_FLIP": { name: "동전 던지기", tier: "B", desc: "캐리하거나 역캐리하거나 기복이 심함" },
  "SOLO_KILL": { name: "솔로킬", tier: "B", desc: "라인전 1:1 상황에서 킬을 낼 확률 증가" },
  "TRASH_TALKER": { name: "트래시 토커", tier: "B", desc: "경기 전/후 인터뷰로 상대 멘탈을 흔듦" },
  "MELEE_MID": { name: "근접 미드", tier: "B", desc: "사일러스, 아칼리 등 근접 챔피언 숙련도 높음" },
  "ROAMING": { name: "로밍", tier: "B", desc: "다른 라인을 돕는 플레이를 선호함" },

  // ==========================================
  // [C등급: 유망주/성장형 특성 (Prospect)]
  // ==========================================
  "SCRATCH_LOTTERY": { name: "긁지 않은 복권", tier: "C", desc: "매 경기 랜덤하게 S급 퍼포먼스 혹은 D급 트롤링 발생" },
  "SPONGE": { name: "스펀지", tier: "C", desc: "베테랑과 같은 라인일 때 경험치 흡수(성장) 속도 2배" },
  "PURE_MECH": { name: "뇌지컬 부재", tier: "C", desc: "피지컬(반응속도)은 S급이나 운영 능력 -20%" },
  "GROWTH_POTENTIAL": { name: "만개", tier: "C", desc: "훈련 성공 대성공 확률 증가" },
  "NEWBIE": { name: "햇병아리", tier: "C", desc: "아직 특성이 발현되지 않음" },
  "SOLO_RANK_WARRIOR": { name: "솔랭전사", tier: "C", desc: "개인 기량은 좋으나 팀합(소통) 스탯 -15%" },
  "COPYCAT": { name: "카피캣", tier: "C", desc: "상대방의 플레이 스타일을 모방하여 학습 속도 증가" },
  "LATE_BLOOMER": { name: "대기만성", tier: "C", desc: "초반엔 약하지만 30분 이후 스탯 소폭 상승" },
  "AUDACIOUS": { name: "패기", tier: "C", desc: "상대가 누구든 쫄지 않음 (가끔 무리함)" },
  "PRACTICE_BUG": { name: "연습벌레", tier: "C", desc: "훈련 효율 +10%, 피로도 증가 +10%" },
  "FARMING_MACHINE": { name: "CS 기계", tier: "C", desc: "교전보다 CS 수급을 우선시함" },
  "OFF_META": { name: "힙스터", tier: "C", desc: "메타에 안 맞는 챔피언을 선호함" },
  "SOLO_KILL_HUNTER": { name: "솔킬 욕심", tier: "C", desc: "무리하게 솔로킬을 시도하다 역관광 당할 수 있음" },
  "GLASS_CANNON": { name: "유리 대포", tier: "C", desc: "공격력은 높으나 생존력이 극도로 낮음" },
  "EMOTIONAL": { name: "다혈질", tier: "C", desc: "한 번 말리면 멘탈 회복이 느림" },

  // ==========================================
  // [NEG: 부정적 특성 (Penalty)]
  // ==========================================
  "DICE_ROLL": { name: "주사위 1/6", tier: "NEG", desc: "경기력의 고점과 저점 차이가 극심함 (주사위 1 뜨면 필패)" },
  "GLASS_MENTAL": { name: "유리 멘탈", tier: "NEG", desc: "1데스 혹은 오브젝트 스틸 허용 시 전 스탯 -20%" },
  "CHAMP_PUDDLE": { name: "챔프웅덩이", tier: "NEG", desc: "메타 챔피언 숙련도가 낮음, 밴픽 싸움 불리" },
  "TUNNEL_VISION": { name: "터널 시야", tier: "NEG", desc: "라인전 몰입 시 갱킹 허용 확률 높음" },
  "THROWING": { name: "발사", tier: "NEG", desc: "유리한 상황에서 무리한 진입으로 역전패 빌미 제공" },
  "HOMESICK": { name: "내수용", tier: "NEG", desc: "국제전만 나가면 스탯 -15%" },
  "KDA_PLAYER": { name: "KDA 관리자", tier: "NEG", desc: "팀을 위한 희생을 하지 않음 (생존력만 높음)" },
  "COMM_ERROR": { name: "소통 불가", tier: "NEG", desc: "팀원 콜을 무시하고 독단적으로 행동함" },
  "FACE_CHECKER": { name: "페이스 체크", tier: "NEG", desc: "시야 없는 부쉬에 몸으로 들어갔다 자주 잘림" },
  "OBJ_ALLERGY": { name: "오브젝트 알러지", tier: "NEG", desc: "용/바론 한타 때 포지셔닝 실수가 잦음" },
  "ZOMBIE": { name: "탑신병자(병)", tier: "NEG", desc: "죽어도 계속 밀다가 또 죽음 (복구 불가능)" },
  "NO_FLASH": { name: "점멸 아낌", tier: "NEG", desc: "죽을 때까지 점멸을 안 쓰다가 죽음" },
  "INVADE_VICTIM": { name: "인베 맛집", tier: "NEG", desc: "1레벨 단계에서 항상 손해를 봄" },
  "CS_ALLERGY": { name: "CS 흘림", tier: "NEG", desc: "평타 실수로 놓치는 CS가 많음" },
  "PASSIVE": { name: "수동적", tier: "NEG", desc: "스스로 변수를 만들지 못하고 묻어가려 함" },
  "TILTER": { name: "즐겜러", tier: "NEG", desc: "게임이 조금만 불리해져도 집중력을 잃음" },
  "LANE_WEAKNESS": { name: "라인 약점", tier: "NEG", desc: "라인전 수행 능력이 떨어짐" },
};
