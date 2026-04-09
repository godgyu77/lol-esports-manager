export type BroadcastTalentRole =
  | 'caster'
  | 'analyst'
  | 'announcer'
  | 'guest_analyst'
  | 'desk_analyst';

export type BroadcastAppearanceWindow = 'regular' | 'playoffs' | 'finals' | 'desk';

export type BroadcastEventKind =
  | 'default'
  | 'kill'
  | 'objective'
  | 'teamfight'
  | 'decision'
  | 'highlight'
  | 'lane'
  | 'jungle'
  | 'comeback'
  | 'mistake'
  | 'baron'
  | 'elder'
  | 'nexus'
  | 'game_end';

export type MatchBroadcastTier = 'regular' | 'playoffs' | 'finals';

export interface BroadcastTalent {
  id: string;
  name: string;
  role: BroadcastTalentRole;
  styleTag: string;
  specialty: string;
  excitement: number;
  analysis: number;
  composure: number;
  humor: number;
  appearances: BroadcastAppearanceWindow[];
  weight?: number;
  speechStyle: string;
  signaturePhrases: string[];
  eventStrengths: BroadcastEventKind[];
  bigMatchOnlyLines: Partial<Record<BroadcastEventKind, string[]>>;
  deskSummaryStyle: string[];
  guestWeightRegular: number;
  guestWeightPlayoffs: number;
  guestWeightFinals: number;
}

export interface BroadcastCrew {
  caster: BroadcastTalent;
  analystPrimary: BroadcastTalent;
  analystSecondary: BroadcastTalent;
  announcer: BroadcastTalent;
  guestAnalyst?: BroadcastTalent | null;
}

export const LCK_CASTERS: BroadcastTalent[] = [
  {
    id: 'jun-yongjun',
    name: '전용준',
    role: 'caster',
    styleTag: '클라이맥스를 폭발시키는 메인 캐스터',
    specialty: '대형 한타, 넥서스 직전, 시리즈 마무리 샤우팅',
    excitement: 98,
    analysis: 52,
    composure: 76,
    humor: 70,
    appearances: ['regular', 'playoffs', 'finals'],
    weight: 54,
    speechStyle: '큰 장면을 길게 끌어올리며 감탄을 증폭하는 중계',
    signaturePhrases: ['자, 교전 열립니다!', '끝내러 갑니다!', '이 장면이 시리즈를 가릅니다!'],
    eventStrengths: ['teamfight', 'baron', 'elder', 'nexus', 'game_end', 'highlight'],
    bigMatchOnlyLines: {
      highlight: ['오늘 경기의 무게가 지금 한 장면에 실립니다!', '관중석의 공기까지 바뀌는 순간입니다!'],
      game_end: ['결국 이 팀이 큰 무대의 끝을 장식합니다!', '시리즈의 마지막 문장을 직접 써 내려갑니다!'],
    },
    deskSummaryStyle: ['큰 경기일수록 먼저 흔들리지 않은 팀이 이깁니다.', '결정적 순간에 콜이 하나로 모였습니다.'],
    guestWeightRegular: 0,
    guestWeightPlayoffs: 0,
    guestWeightFinals: 0,
  },
  {
    id: 'seong-seunghun',
    name: '성승헌',
    role: 'caster',
    styleTag: '속도감 있는 진행과 재치 있는 한마디',
    specialty: '빠른 상황 정리, 전개 요약, 템포 있는 중계',
    excitement: 88,
    analysis: 58,
    composure: 81,
    humor: 92,
    appearances: ['regular', 'playoffs', 'finals'],
    weight: 46,
    speechStyle: '짧고 빠르게 상황을 요약하면서 재치를 섞는 중계',
    signaturePhrases: ['순식간입니다!', '그 한 번이 크게 터졌습니다!', '이거 분위기 묘해집니다!'],
    eventStrengths: ['kill', 'objective', 'comeback', 'mistake', 'highlight'],
    bigMatchOnlyLines: {
      highlight: ['이 한 장면이 오늘 경기의 표정을 바꿉니다!', '큰 경기에서 이런 실수 하나가 너무 아파요!'],
      game_end: ['결국 오늘의 승부처를 가장 잘 넘긴 팀이 웃습니다!'],
    },
    deskSummaryStyle: ['흐름이 기울기 시작하면 그걸 놓치지 않았습니다.', '빠른 판단 하나가 오늘 경기 전체를 정리했습니다.'],
    guestWeightRegular: 0,
    guestWeightPlayoffs: 0,
    guestWeightFinals: 0,
  },
];

export const LCK_ANALYSTS: BroadcastTalent[] = [
  {
    id: 'lee-hyeonwoo-clem',
    name: '이현우',
    role: 'analyst',
    styleTag: '밈과 비유를 섞는 메인 해설',
    specialty: '운영 흐름, 한타 각도, 큰 장면 해석',
    excitement: 85,
    analysis: 92,
    composure: 82,
    humor: 93,
    appearances: ['regular', 'playoffs', 'finals', 'desk'],
    weight: 100,
    speechStyle: '밈과 비유를 섞되 결국 왜 싸움이 열렸는지를 짚는 해설',
    signaturePhrases: ['이건 진짜 맛있게 열렸어요.', '그림이 너무 좋았거든요.', '이 장면은 준비한 팀의 호흡입니다.'],
    eventStrengths: ['teamfight', 'decision', 'highlight', 'comeback', 'game_end'],
    bigMatchOnlyLines: {
      teamfight: ['큰 경기일수록 먼저 들어가는 쪽보다 끝까지 각을 본 팀이 이겨요.', '이건 선수 개인기가 아니라 준비한 한타 도식이 그대로 나온 겁니다.'],
      game_end: ['이 정도 무대에서 이런 마무리는 팀 완성도가 높다는 뜻입니다.'],
    },
    deskSummaryStyle: ['준비한 그림을 선수들이 끝까지 믿고 밀어붙였습니다.', '한타를 여는 장면보다, 그 직전 포지션이 더 좋았습니다.'],
    guestWeightRegular: 0,
    guestWeightPlayoffs: 0,
    guestWeightFinals: 0,
  },
  {
    id: 'lim-juwan-pony',
    name: '임주완',
    role: 'analyst',
    styleTag: '차분하고 논리적인 데이터 해설',
    specialty: '라인 우선권, 수치 비교, 밴픽 구도',
    excitement: 54,
    analysis: 95,
    composure: 91,
    humor: 42,
    appearances: ['regular', 'playoffs', 'finals', 'desk'],
    weight: 60,
    speechStyle: '근거와 수치를 앞세워 차분하게 설명하는 해설',
    signaturePhrases: ['지표상으로도 이미 흐름이 기울었습니다.', '이 선택의 기회비용이 큽니다.', '라인 우선권이 바탕에 깔려 있습니다.'],
    eventStrengths: ['lane', 'objective', 'decision', 'baron', 'elder'],
    bigMatchOnlyLines: {
      highlight: ['플레이오프에서는 밴픽 한 단계의 손해가 경기 전체로 이어집니다.'],
      game_end: ['정규시즌과 달리 큰 경기에서는 한 번의 비효율이 치명적입니다.'],
    },
    deskSummaryStyle: ['오늘은 초반 우선권 설계가 그대로 중반 이득으로 이어졌습니다.', '수치로 봐도 오브젝트 구간 의사결정이 훨씬 안정적이었습니다.'],
    guestWeightRegular: 0,
    guestWeightPlayoffs: 0,
    guestWeightFinals: 0,
  },
  {
    id: 'go-soojin-kkokkogod',
    name: '고수진',
    role: 'analyst',
    styleTag: '트렌디하고 날카로운 해설',
    specialty: '최신 메타, 챌린저스 감각, 템포 판단',
    excitement: 60,
    analysis: 87,
    composure: 84,
    humor: 48,
    appearances: ['regular', 'playoffs', 'desk'],
    weight: 52,
    speechStyle: '메타 감각과 최근 트렌드를 빠르게 연결하는 해설',
    signaturePhrases: ['지금 메타에서는 이 판단이 더 무겁습니다.', '이 구도는 최근 팀들이 계속 연습하던 그림이에요.', '템포를 놓치지 않았습니다.'],
    eventStrengths: ['lane', 'jungle', 'objective', 'highlight'],
    bigMatchOnlyLines: {
      highlight: ['요즘 메타에서 이 장면을 먼저 잡으면 시리즈 주도권도 가져갑니다.'],
    },
    deskSummaryStyle: ['현재 메타 기준으로도 훨씬 정교한 선택이었습니다.', '최근 강팀들이 많이 쓰는 구조를 더 잘 구현했습니다.'],
    guestWeightRegular: 0,
    guestWeightPlayoffs: 0,
    guestWeightFinals: 0,
  },
  {
    id: 'lee-chaehwan-prince',
    name: '이채환',
    role: 'analyst',
    styleTag: '현역 감각이 남아 있는 바텀 해설',
    specialty: '바텀 교전, 딜각, 후반 캐리 각',
    excitement: 66,
    analysis: 84,
    composure: 78,
    humor: 55,
    appearances: ['regular', 'playoffs', 'desk'],
    weight: 50,
    speechStyle: '원딜과 바텀 시점에서 교전 구도를 짚는 해설',
    signaturePhrases: ['원딜 입장에서는 지금부터가 진짜 중요해요.', '사거리 계산을 아주 잘했습니다.', '바텀 라인이 먼저 분위기를 만들었어요.'],
    eventStrengths: ['kill', 'teamfight', 'highlight', 'game_end'],
    bigMatchOnlyLines: {
      game_end: ['큰 경기일수록 바텀 딜러가 마지막 한타를 버텨내는지가 정말 중요합니다.'],
    },
    deskSummaryStyle: ['딜러가 편하게 때릴 수 있는 전장을 팀이 만들어 줬습니다.', '바텀 구도에서 이긴 팀이 후반도 훨씬 편했습니다.'],
    guestWeightRegular: 0,
    guestWeightPlayoffs: 0,
    guestWeightFinals: 0,
  },
  {
    id: 'eom-seonghyeon-umti',
    name: '엄성현',
    role: 'analyst',
    styleTag: '정글 동선과 초반 설계를 읽는 해설',
    specialty: '정글 개입, 첫 템포, 시야 압박',
    excitement: 59,
    analysis: 89,
    composure: 85,
    humor: 44,
    appearances: ['regular', 'playoffs', 'desk'],
    weight: 48,
    speechStyle: '정글러 관점에서 초반 설계와 콜 타이밍을 해설',
    signaturePhrases: ['정글 동선이 이미 답을 말해 줍니다.', '첫 리콜 타이밍이 아주 중요했어요.', '시야를 먼저 뚫은 쪽이 편해졌습니다.'],
    eventStrengths: ['jungle', 'objective', 'decision', 'baron'],
    bigMatchOnlyLines: {
      objective: ['플레이오프에서는 정글러가 오브젝트 직전 한 턴을 어떻게 쓰는지가 더 크게 보입니다.'],
    },
    deskSummaryStyle: ['초반 동선 설계가 오브젝트 구간까지 자연스럽게 이어졌습니다.', '정글이 먼저 한 발 앞서면서 팀 전체가 편해졌습니다.'],
    guestWeightRegular: 0,
    guestWeightPlayoffs: 0,
    guestWeightFinals: 0,
  },
];

export const LCK_ANNOUNCERS: BroadcastTalent[] = [
  {
    id: 'yoon-subin',
    name: '윤수빈',
    role: 'announcer',
    styleTag: '정중하고 안정적인 메인 진행',
    specialty: 'POM 발표, 감독 인터뷰, 스튜디오 정리',
    excitement: 58,
    analysis: 68,
    composure: 95,
    humor: 52,
    appearances: ['regular', 'playoffs', 'finals', 'desk'],
    weight: 38,
    speechStyle: '정돈된 어조로 경기 흐름을 정리하고 질문을 부드럽게 연결하는 진행',
    signaturePhrases: ['지금부터 경기 후 인터뷰를 진행하겠습니다.', '오늘 경기 POM을 발표하겠습니다.'],
    eventStrengths: ['highlight', 'game_end'],
    bigMatchOnlyLines: {
      game_end: ['큰 경기의 끝에서 이 결과를 전해드리게 됐습니다.'],
    },
    deskSummaryStyle: ['경기 흐름을 한 번 차분히 정리해 보겠습니다.'],
    guestWeightRegular: 0,
    guestWeightPlayoffs: 0,
    guestWeightFinals: 0,
  },
  {
    id: 'bae-hyeji',
    name: '배혜지',
    role: 'announcer',
    styleTag: '밝고 명료한 진행',
    specialty: '현장 연결, 결과 정리, 후속 인터뷰',
    excitement: 64,
    analysis: 61,
    composure: 91,
    humor: 57,
    appearances: ['regular', 'playoffs', 'finals', 'desk'],
    weight: 31,
    speechStyle: '밝은 호흡으로 결과를 빠르게 정리하고 인터뷰를 자연스럽게 끌어가는 진행',
    signaturePhrases: ['분위기 뜨겁습니다.', '바로 인터뷰로 이어가 보겠습니다.'],
    eventStrengths: ['highlight', 'game_end'],
    bigMatchOnlyLines: {
      game_end: ['현장 분위기가 그대로 전해질 정도로 큰 승부였습니다.'],
    },
    deskSummaryStyle: ['방금 경기를 조금 더 생생하게 되짚어 보겠습니다.'],
    guestWeightRegular: 0,
    guestWeightPlayoffs: 0,
    guestWeightFinals: 0,
  },
  {
    id: 'lee-eunbin',
    name: '이은빈',
    role: 'announcer',
    styleTag: '차분하고 깔끔한 인터뷰 진행',
    specialty: '후속 인터뷰, 분석데스크 연결, 질문 정리',
    excitement: 52,
    analysis: 65,
    composure: 94,
    humor: 46,
    appearances: ['regular', 'playoffs', 'finals', 'desk'],
    weight: 31,
    speechStyle: '차분하게 맥락을 정리하고 선수/감독 답변을 끌어내는 진행',
    signaturePhrases: ['핵심 장면을 중심으로 질문드려 보겠습니다.', '방금 경기의 결정적 순간을 짚어 보겠습니다.'],
    eventStrengths: ['highlight', 'game_end'],
    bigMatchOnlyLines: {
      game_end: ['시리즈 전체 흐름까지 정리해야 할 만큼 의미 있는 결과입니다.'],
    },
    deskSummaryStyle: ['결정적 장면을 기준으로 경기 내용을 정리해 보겠습니다.'],
    guestWeightRegular: 0,
    guestWeightPlayoffs: 0,
    guestWeightFinals: 0,
  },
];

export const LCK_DESK_ANALYSTS: BroadcastTalent[] = [
  {
    id: 'shin-dongjin-helios',
    name: '신동진',
    role: 'desk_analyst',
    styleTag: '분석데스크 중심축',
    specialty: '경기 전체 정리와 스튜디오 총평',
    excitement: 47,
    analysis: 91,
    composure: 93,
    humor: 38,
    appearances: ['desk', 'playoffs', 'finals'],
    weight: 70,
    speechStyle: '차분하고 구조적으로 경기를 복기하는 스튜디오형 분석',
    signaturePhrases: ['핵심은 한타 자체보다 그 직전 준비였습니다.'],
    eventStrengths: ['highlight', 'game_end'],
    bigMatchOnlyLines: {
      game_end: ['큰 경기일수록 디테일 하나가 시리즈 전체를 결정합니다.'],
    },
    deskSummaryStyle: ['오늘 경기는 준비와 실행이 모두 맞아떨어진 경기였습니다.', '보이는 장면보다 보이지 않는 준비가 더 좋았습니다.'],
    guestWeightRegular: 0,
    guestWeightPlayoffs: 0,
    guestWeightFinals: 0,
  },
];

export const LCK_GUEST_ANALYSTS: BroadcastTalent[] = [
  {
    id: 'han-wangho-peanut',
    name: '한왕호',
    role: 'guest_analyst',
    styleTag: '예언형 정글 해설',
    specialty: '정글 동선, 오브젝트 직전 호흡, 선수 시점 비하인드',
    excitement: 83,
    analysis: 90,
    composure: 86,
    humor: 75,
    appearances: ['regular', 'playoffs', 'finals', 'desk'],
    weight: 100,
    speechStyle: '정글러 시점으로 콜의 원인을 짚고, 선수들 속도를 부드럽게 설명하는 해설',
    signaturePhrases: ['정글러는 지금 이 턴을 그냥 못 넘겨요.', '여기서 한 번 더 들어갈 수 있거든요.', '이건 선수들끼리 이미 말이 끝난 장면이에요.'],
    eventStrengths: ['jungle', 'objective', 'baron', 'elder', 'highlight'],
    bigMatchOnlyLines: {
      objective: ['큰 경기 오브젝트는 손보다 호흡이 먼저 맞아야 합니다.', '이런 무대에서는 정글러가 먼저 불안해지면 팀 전체가 늦어집니다.'],
      game_end: ['결국 큰 경기에서 오브젝트 호흡을 더 잘 맞춘 팀이 끝까지 갑니다.'],
    },
    deskSummaryStyle: ['정글러 입장에서는 오브젝트 직전 한 턴을 더 잘 쓴 쪽이 이겼습니다.', '콜이 먼저 끝난 팀의 움직임이 훨씬 가벼웠습니다.'],
    guestWeightRegular: 100,
    guestWeightPlayoffs: 110,
    guestWeightFinals: 120,
  },
  {
    id: 'lee-seohaeng-kuro',
    name: '이서행',
    role: 'guest_analyst',
    styleTag: '밴픽과 미드 설계를 읽는 해설',
    specialty: '미드 주도권, 밴픽 설계, 운영 분기점',
    excitement: 64,
    analysis: 92,
    composure: 90,
    humor: 66,
    appearances: ['regular', 'playoffs', 'finals', 'desk'],
    weight: 92,
    speechStyle: '차분하게 밴픽과 미드 구도를 연결해 설명하는 해설',
    signaturePhrases: ['미드가 먼저 움직일 수 있으면 그림이 달라집니다.', '밴픽에서 이미 의도가 보여요.', '이건 운영 설계가 아주 깔끔했습니다.'],
    eventStrengths: ['lane', 'decision', 'highlight', 'game_end'],
    bigMatchOnlyLines: {
      highlight: ['플레이오프 밴픽은 한 장 더 준비한 팀이 결국 말이 됩니다.', '미드 주도권이 있는 팀이 큰 경기에서 훨씬 안정적이에요.'],
      game_end: ['시리즈에서는 밴픽 한 수와 미드 주도권이 결국 누적됩니다.'],
    },
    deskSummaryStyle: ['오늘은 밴픽 의도와 실제 운영이 정확히 맞았습니다.', '미드가 먼저 움직일 수 있었던 설계가 경기 전체를 편하게 만들었습니다.'],
    guestWeightRegular: 92,
    guestWeightPlayoffs: 105,
    guestWeightFinals: 108,
  },
  {
    id: 'gang-beomhyeon-gorilla',
    name: '강범현',
    role: 'guest_analyst',
    styleTag: '바텀과 한타 설계를 읽는 해설',
    specialty: '바텀 구도, 시야 설계, 팀파이트 준비',
    excitement: 70,
    analysis: 88,
    composure: 87,
    humor: 72,
    appearances: ['regular', 'playoffs', 'finals', 'desk'],
    weight: 90,
    speechStyle: '바텀과 시야를 기준으로 팀 전체 움직임을 읽는 해설',
    signaturePhrases: ['시야를 이렇게 먹으면 교전은 따라옵니다.', '바텀 라인이 분위기를 만들었어요.', '서포터가 먼저 길을 열어 준 장면입니다.'],
    eventStrengths: ['objective', 'teamfight', 'highlight', 'game_end'],
    bigMatchOnlyLines: {
      teamfight: ['큰 경기 한타는 시야 한 칸 차이로 먼저 보이는 팀이 훨씬 편합니다.'],
      game_end: ['결국 오늘은 바텀과 시야에서 이긴 팀이 마지막 한타도 가져갔습니다.'],
    },
    deskSummaryStyle: ['시야를 먹는 속도와 바텀 호흡이 경기 전체를 바꿨습니다.', '한타는 순간이지만, 그 준비는 몇 분 전부터 시작됐습니다.'],
    guestWeightRegular: 88,
    guestWeightPlayoffs: 100,
    guestWeightFinals: 104,
  },
  {
    id: 'song-gyeongho-smeb',
    name: '송경호',
    role: 'guest_analyst',
    styleTag: '탑 라이너 감성의 텐션형 해설',
    specialty: '탑 구도, 강한 라인전, 교전 분위기',
    excitement: 86,
    analysis: 78,
    composure: 72,
    humor: 79,
    appearances: ['playoffs', 'finals', 'desk'],
    weight: 62,
    speechStyle: '탑 라이너의 심리와 기세를 살려 텐션 있게 설명하는 해설',
    signaturePhrases: ['이건 탑이 그냥 못 참죠.', '라인전에서 숨이 막히거든요.', '기세를 제대로 탔습니다.'],
    eventStrengths: ['lane', 'kill', 'teamfight', 'highlight'],
    bigMatchOnlyLines: {
      highlight: ['결승 무대에서 탑이 기세를 잡으면 팀 전체 텐션도 같이 올라갑니다.'],
      game_end: ['탑 쪽 주도권이 결국 큰 경기에서 팀의 자세를 바꿉니다.'],
    },
    deskSummaryStyle: ['탑에서 밀리지 않으니까 팀 전체가 당당하게 움직였습니다.', '라인전 기세가 한타 텐션까지 이어졌습니다.'],
    guestWeightRegular: 18,
    guestWeightPlayoffs: 72,
    guestWeightFinals: 86,
  },
  {
    id: 'kim-dongha-khan',
    name: '김동하',
    role: 'guest_analyst',
    styleTag: '하이텐션 분위기 폭발형',
    specialty: '큰 장면 반응, 탑 구도, 스튜디오 텐션',
    excitement: 95,
    analysis: 74,
    composure: 61,
    humor: 97,
    appearances: ['playoffs', 'finals', 'desk'],
    weight: 58,
    speechStyle: '하이텐션으로 분위기를 끌어올리면서도 핵심 장면을 크게 반응하는 해설',
    signaturePhrases: ['이건 진짜 못 참습니다!', '큰 경기에서 이런 장면이 나와요!', '와, 이거 터졌습니다!'],
    eventStrengths: ['kill', 'teamfight', 'highlight', 'nexus', 'game_end'],
    bigMatchOnlyLines: {
      highlight: ['결승에서 이런 장면 나오면 선수들 심장 소리까지 들릴 것 같아요!'],
      game_end: ['이건 그냥 큰 경기의 낭만이 다 들어간 마무리입니다!'],
    },
    deskSummaryStyle: ['큰 경기답게 텐션이 폭발했고, 그걸 이긴 팀이 끝까지 갔습니다.', '선수들이 무대 분위기를 제대로 타 버렸습니다.'],
    guestWeightRegular: 10,
    guestWeightPlayoffs: 60,
    guestWeightFinals: 82,
  },
  {
    id: 'hong-mingi-madlife',
    name: '홍민기',
    role: 'guest_analyst',
    styleTag: '시야와 판 짜기를 읽는 차분한 해설',
    specialty: '서포터 시점, 시야 장악, 한타 설계',
    excitement: 45,
    analysis: 93,
    composure: 95,
    humor: 35,
    appearances: ['desk', 'playoffs', 'finals'],
    weight: 50,
    speechStyle: '시야와 전투 구조를 조용하지만 깊게 해설하는 스타일',
    signaturePhrases: ['보이는 것보다 먼저 깔린 시야가 중요합니다.', '한타는 이미 배치에서 시작됐습니다.'],
    eventStrengths: ['objective', 'teamfight', 'baron', 'elder'],
    bigMatchOnlyLines: {
      teamfight: ['플레이오프 한타는 스킬샷보다 시야와 배치가 먼저 정리돼야 합니다.'],
    },
    deskSummaryStyle: ['시야 설계가 잘된 팀은 큰 경기에서도 흔들리지 않습니다.', '판을 먼저 짠 팀이 싸움을 편하게 열었습니다.'],
    guestWeightRegular: 8,
    guestWeightPlayoffs: 78,
    guestWeightFinals: 80,
  },
  {
    id: 'gang-hyeongu-cptjack',
    name: '강형우',
    role: 'guest_analyst',
    styleTag: '바텀과 딜 계산 중심의 분석형 해설',
    specialty: '원딜 관점, 바텀 교전, 딜 교환 계산',
    excitement: 54,
    analysis: 86,
    composure: 88,
    humor: 49,
    appearances: ['desk', 'regular', 'playoffs'],
    weight: 47,
    speechStyle: '바텀 교전과 데미지 계산을 침착하게 짚는 해설',
    signaturePhrases: ['딜 교환을 너무 잘했어요.', '원딜 입장에서는 여기서 이미 편해집니다.'],
    eventStrengths: ['kill', 'teamfight', 'objective'],
    bigMatchOnlyLines: {
      game_end: ['큰 경기에서는 딜러가 살아남는 위치가 승부를 가릅니다.'],
    },
    deskSummaryStyle: ['바텀 교전 손익이 후반까지 그대로 이어졌습니다.', '딜러가 편하게 프리딜할 수 있는 구도가 자주 나왔습니다.'],
    guestWeightRegular: 34,
    guestWeightPlayoffs: 70,
    guestWeightFinals: 45,
  },
  {
    id: 'lee-hojong-flame',
    name: '이호종',
    role: 'guest_analyst',
    styleTag: '탑 감성형 해설',
    specialty: '탑 심리, 라인전 기세, 분위기 전환',
    excitement: 73,
    analysis: 77,
    composure: 80,
    humor: 82,
    appearances: ['desk', 'playoffs', 'finals'],
    weight: 42,
    speechStyle: '탑 라이너의 자존심과 감정선을 살려 반응하는 해설',
    signaturePhrases: ['탑 입장에서는 이거 진짜 억울하거든요.', '라인전 기세가 완전히 달라졌어요.'],
    eventStrengths: ['lane', 'highlight', 'mistake'],
    bigMatchOnlyLines: {
      highlight: ['이런 무대에서는 탑 한 번의 실수도 계속 기억에 남습니다.'],
    },
    deskSummaryStyle: ['탑 구도에서 흔들린 순간부터 팀 전체 자세가 달라졌습니다.', '라인전 체감 압박이 생각보다 훨씬 컸습니다.'],
    guestWeightRegular: 8,
    guestWeightPlayoffs: 56,
    guestWeightFinals: 68,
  },
  {
    id: 'bae-junsik-bang',
    name: '배준식',
    role: 'guest_analyst',
    styleTag: '차분하고 묵직한 후속 총평형',
    specialty: '후반 딜러 판단, 큰 장면 복기, 스튜디오 코멘트',
    excitement: 46,
    analysis: 87,
    composure: 92,
    humor: 39,
    appearances: ['desk', 'playoffs', 'finals'],
    weight: 40,
    speechStyle: '현장 중계보다는 경기 후 복기에 강한 차분한 해설',
    signaturePhrases: ['딜러 입장에서는 이 선택이 무겁습니다.', '후반 한타는 한 번의 포지션 차이예요.'],
    eventStrengths: ['teamfight', 'game_end'],
    bigMatchOnlyLines: {
      game_end: ['큰 경기 후반은 결국 딜러가 어느 순간까지 참을 수 있었는지가 큽니다.'],
    },
    deskSummaryStyle: ['후반 딜러가 때릴 수 있는 시간이 길었던 팀이 유리했습니다.', '마지막 한타는 포지션과 인내심의 차이였습니다.'],
    guestWeightRegular: 4,
    guestWeightPlayoffs: 42,
    guestWeightFinals: 58,
  },
  {
    id: 'lee-jaewan-wolf',
    name: '이재완',
    role: 'guest_analyst',
    styleTag: '소통형 리액션 중심 해설',
    specialty: '서포터 시점, 편파 감정선, 커뮤니티 반응형 멘트',
    excitement: 82,
    analysis: 76,
    composure: 74,
    humor: 88,
    appearances: ['desk', 'playoffs', 'finals'],
    weight: 38,
    speechStyle: '현장 반응과 감정선을 살려 맛있게 얹는 해설',
    signaturePhrases: ['이 장면 팬들이 진짜 좋아할 겁니다.', '와, 이거 감정선 제대로 올라가요.'],
    eventStrengths: ['highlight', 'teamfight', 'game_end'],
    bigMatchOnlyLines: {
      game_end: ['이런 경기 끝나면 커뮤니티가 바로 불탑니다.'],
    },
    deskSummaryStyle: ['팬들이 기억할 만한 장면이 너무 선명하게 남았습니다.', '경기 내용도 좋았지만 감정선이 특히 강했습니다.'],
    guestWeightRegular: 4,
    guestWeightPlayoffs: 38,
    guestWeightFinals: 52,
  },
];

export const DEFAULT_BROADCAST_CREW: BroadcastCrew = {
  caster: LCK_CASTERS[0],
  analystPrimary: LCK_ANALYSTS[0],
  analystSecondary: LCK_ANALYSTS[1],
  announcer: LCK_ANNOUNCERS[0],
  guestAnalyst: null,
};
