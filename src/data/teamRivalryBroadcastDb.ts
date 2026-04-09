export type BroadcastRivalryTier = 'featured' | 'marquee';

export interface TeamBroadcastRivalry {
  id: string;
  teams: [string, string];
  rivalryTier: BroadcastRivalryTier;
  headline: string;
  hook: string;
  openingNarrative: string;
  closingNarrative: string;
}

const rivalry = (
  id: string,
  teams: [string, string],
  rivalryTier: BroadcastRivalryTier,
  headline: string,
  hook: string,
  openingNarrative: string,
  closingNarrative: string,
): TeamBroadcastRivalry => ({
  id,
  teams,
  rivalryTier,
  headline,
  hook,
  openingNarrative,
  closingNarrative,
});

export const TEAM_BROADCAST_RIVALRIES: TeamBroadcastRivalry[] = [
  rivalry('lck-t1-gen', ['lck_T1', 'lck_GEN'], 'marquee', '왕좌 정면 충돌', '우승 서사와 완성형 운영이 다시 맞붙습니다.', '왕좌를 향한 두 축이 다시 한 번 정면으로 충돌합니다.', '이번 맞대결은 순위 이상의 의미를 남기며 다음 만남의 긴장감까지 키웁니다.'),
  rivalry('lck-hle-dk', ['lck_HLE', 'lck_DK'], 'featured', '화력과 설계의 충돌', '폭발적인 힘과 날카로운 설계가 맞부딪힙니다.', '파괴력으로 밀어붙일지, 설계로 흐름을 틀지 보는 경기입니다.', '승패를 넘어 두 팀의 색을 누가 더 강하게 밀어붙였는지가 남습니다.'),
  rivalry('lck-kt-ns', ['lck_KT', 'lck_NS'], 'featured', '저력의 줄다리기', '버티고도 다시 물어붙는 팀들이 끝까지 맞섭니다.', '주도권보다 끈기와 집중력이 더 크게 드러나는 구도입니다.', '결국 마지막까지 버텨 낸 쪽이 이야기의 중심을 가져갑니다.'),
  rivalry('lck-soopers-bfx', ['lck_SOOPers', 'lck_BFX'], 'featured', '실전 감각의 대결', '거친 실전 감각과 날 선 반응 속도가 마주칩니다.', '정제된 운영보다 누가 먼저 흐름을 흔드느냐가 중요합니다.', '한 번 탄 흐름을 끝까지 밀어붙인 쪽이 경기의 색을 완성합니다.'),
  rivalry('lck-brion-krx', ['lck_BRION', 'lck_KRX'], 'featured', '버티기와 반격의 충돌', '버티는 팀과 되받아치는 팀이 물러서지 않습니다.', '기세와 버티기의 충돌이 경기 전체를 흔드는 매치업입니다.', '끝까지 살아남은 쪽이 결국 더 길게 이야기를 가져갑니다.'),
  rivalry('lpl-blg-tes', ['lpl_BLG', 'lpl_TES'], 'marquee', '화력과 속도의 정면전', '최상위 화력과 빠른 템포가 정면 충돌합니다.', '한 번 기세가 붙으면 순식간에 게임이 넘어갈 수 있는 조합입니다.', '화력과 속도 중 어느 완성도가 더 높은지가 분명해집니다.'),
  rivalry('lpl-jdg-ig', ['lpl_JDG', 'lpl_IG'], 'featured', '체계와 감각의 충돌', '완성된 체계와 즉흥적 감각이 부딪힙니다.', '정교함과 감각이 어떤 방식으로 맞서는지 드러나는 경기입니다.', '계산과 감각 중 오늘 더 오래 버틴 쪽의 서사가 남습니다.'),
  rivalry('lpl-wbg-edg', ['lpl_WBG', 'lpl_EDG'], 'featured', '관성과 복원의 만남', '흐름을 타는 팀과 구조를 복원하는 팀이 맞붙습니다.', '교전의 파도와 운영의 복원이 동시에 시험받는 경기입니다.', '흔들림과 복원 중 어느 쪽이 더 강했는지 선명하게 남습니다.'),
  rivalry('lpl-nip-al', ['lpl_NIP', 'lpl_AL'], 'featured', '침착함과 돌파력의 대치', '침착한 운영과 빠른 돌파가 정면으로 부딪힙니다.', '누가 먼저 틈을 만들고, 누가 먼저 목을 조르느냐가 중요합니다.', '침착함이 끝까지 버티는지, 돌파력이 흐름을 가르는지 갈립니다.'),
  rivalry('lpl-we-lgd', ['lpl_WE', 'lpl_LGD'], 'featured', '전통과 반격의 서사', '오래된 이름과 쉽게 물러서지 않는 반격이 맞섭니다.', '차분한 전통과 끈질긴 반격이 한 무대에 올라옵니다.', '전통의 무게와 반격의 고집 중 오늘 더 오래 버틴 쪽이 웃습니다.'),
  rivalry('lpl-up-tt', ['lpl_UP', 'lpl_TT'], 'featured', '실전과 체급의 접전', '현장감 있는 실전력과 끈적한 체급 싸움이 만납니다.', '예상보다 더 많은 감정선이 튀어오르는 구도입니다.', '계속 물고 늘어지는 쪽과 더 공세적인 쪽 중 승자가 갈립니다.'),
  rivalry('lpl-lng-omg', ['lpl_LNG', 'lpl_OMG'], 'featured', '제어와 반전의 충돌', '빈틈을 찾는 팀과 반전을 노리는 팀이 맞섭니다.', '천천히 조여 가는 팀과 순간 폭발력이 맞부딪히는 구도입니다.', '조여 오는 흐름과 반전의 힘 중 누가 더 선명했는지 남습니다.'),
  rivalry('lcs-fly-tl', ['lcs_FLY', 'lcs_TL'], 'marquee', '상승세와 체계의 정면전', '날아오르는 기세와 체계적인 운영이 만났습니다.', '상승세가 구조를 뚫을지, 구조가 상승세를 잠재울지 보는 경기입니다.', '기세와 체계 중 어느 쪽이 더 단단했는지 분명해집니다.'),
  rivalry('lcs-c9-sr', ['lcs_C9', 'lcs_SR'], 'featured', '템포와 반격의 대치', '빠른 템포와 완급 조절이 정면 충돌합니다.', '기세로 몰아칠지, 반격으로 버틸지가 관전 포인트입니다.', '템포를 끝까지 끌고 간 쪽과 버텨 낸 쪽 중 주인공이 갈립니다.'),
  rivalry('lcs-lyon-sen', ['lcs_LYON', 'lcs_SEN'], 'featured', '동력의 충돌', '사자의 힘과 조직적인 반응 속도가 맞붙습니다.', '주저하지 않는 힘 대 저항의 끈기가 부딪힙니다.', '단순한 한 판을 넘어 서사의 우위를 가르는 승부가 됩니다.'),
  rivalry('lcs-dig-dsg', ['lcs_DIG', 'lcs_DSG'], 'featured', '반전과 집념의 정면승부', '쉽게 꺾이지 않는 팀들이 끝까지 버팁니다.', '버티는 힘과 전환 타이밍이 동시에 시험받습니다.', '끝까지 남은 집념이 어느 쪽에 있었는지 드러납니다.'),
  rivalry('lec-g2-fnc', ['lec_G2', 'lec_FNC'], 'marquee', '유럽 전통의 충돌', '유럽의 오래된 무게감이 다시 맞붙습니다.', '아이디어와 전통이 한 무대에서 다시 충돌합니다.', '유럽 무대에서 가장 오래 남는 감정선이 다시 한번 증명됩니다.'),
  rivalry('lec-kc-koi', ['lec_KC', 'lec_KOI'], 'featured', '광기와 유연성의 충돌', '뜨거운 열기와 유연한 대처가 부딪힙니다.', '기세와 리듬 중 누가 먼저 흐름을 잡는지가 중요합니다.', '광기와 유연성 중 오늘 더 강한 쪽의 색이 남습니다.'),
  rivalry('lec-gx-vit', ['lec_GX', 'lec_VIT'], 'featured', '반격과 가속의 대치', '재정비된 반격과 속도를 올리는 팀이 마주 섭니다.', '가속과 반격이 어디서 엇갈리는지 드러나는 경기입니다.', '누가 먼저 속도를 붙이고, 누가 더 오래 반격하는지가 갈립니다.'),
  rivalry('lec-sft-th', ['lec_SFT', 'lec_TH'], 'featured', '신흥 세력의 충돌', '새로운 기세와 단단한 기반이 맞부딪힙니다.', '정면 승부와 준비된 운영이 정면으로 충돌합니다.', '신흥 세력의 흐름을 더 선명하게 만든 쪽이 주목받습니다.'),
  rivalry('lec-sk-navi', ['lec_SK', 'lec_NAVI'], 'featured', '추격과 수성의 대치', '끈질긴 추격과 버텨 내는 수성이 부딪힙니다.', '끝까지 물고 늘어질지, 끝까지 지켜낼지가 중요합니다.', '추격과 수성 사이에서 누가 더 길게 살아남았는지가 갈립니다.'),
];

export function findTeamBroadcastRivalry(teamAId?: string | null, teamBId?: string | null): TeamBroadcastRivalry | null {
  if (!teamAId || !teamBId) return null;
  return (
    TEAM_BROADCAST_RIVALRIES.find(
      (entry) =>
        (entry.teams[0] === teamAId && entry.teams[1] === teamBId) ||
        (entry.teams[0] === teamBId && entry.teams[1] === teamAId),
    ) ?? null
  );
}

export function getBroadcastRivalriesForTeam(teamId?: string | null): TeamBroadcastRivalry[] {
  if (!teamId) return [];
  return TEAM_BROADCAST_RIVALRIES.filter((entry) => entry.teams.includes(teamId));
}
