import type { Region } from '../../types';

export interface TeamIntroMeta {
  playstyleTag: string;
  pressureLevel: string;
  recommendedFor: string;
  rivalry: string;
  boardStoryline: string;
  openingFocus: string;
  successReward: string;
  failureRisk: string;
  fanExpectation: string;
  seasonDifficulty: string;
}

interface TeamMetaInput {
  teamId: string;
  teamName: string;
  financialTier: string;
  region: Region;
  avgOvr: number;
}

const SPECIAL_TEAM_META: Record<string, Partial<TeamIntroMeta>> = {
  T1: {
    playstyleTag: '스타 파워와 우승 압박이 공존하는 전통 강호',
    pressureLevel: '매 경기 결과가 바로 여론으로 이어지는 최고 압박',
    recommendedFor: '강한 운영과 높은 기대치를 즐기는 플레이어',
    rivalry: 'Gen.G와의 우승 경쟁이 시즌 전체의 분위기를 좌우합니다.',
    boardStoryline: '국내 우승에 그치지 않고 국제전까지 바라보는 프런트의 요구가 강합니다.',
  },
  GEN: {
    playstyleTag: '정교한 운영과 완성도 높은 경기력이 강점인 우승권 팀',
    pressureLevel: '우승권 기준으로 평가받는 상위권 압박',
    recommendedFor: '완성된 전력으로 더 높은 효율을 만들고 싶은 플레이어',
    rivalry: 'T1과의 정면 대결이 시즌 서사의 중심입니다.',
  },
  HLE: {
    playstyleTag: '상위권 전력을 가진 공격형 프로젝트 팀',
    pressureLevel: '투자 대비 성과를 증명해야 하는 강한 결과 압박',
  },
  DK: {
    playstyleTag: '팬 기대치가 여전히 높은 전통 강호',
    pressureLevel: '반등과 복귀를 요구받는 중상위권 압박',
  },
  KT: {
    playstyleTag: '잠재력은 높지만 변동성도 있는 경쟁 팀',
    pressureLevel: '플레이오프권을 놓치면 흔들릴 수 있는 압박',
  },
};

function buildDefaultMeta({ teamName, financialTier, region, avgOvr }: TeamMetaInput): TeamIntroMeta {
  const pressureLevel =
    financialTier === 'S' ? '우승 경쟁이 기본값인 최고 압박' :
    financialTier === 'A' ? '플레이오프는 반드시 요구되는 상위권 압박' :
    financialTier === 'B' ? '중위권 유지와 성장 증명이 필요한 현실적인 압박' :
    '재건과 생존이 우선인 장기 프로젝트 시즌';

  const seasonDifficulty =
    avgOvr >= 90 ? '매우 어려움: 결과가 좋아도 기준치는 계속 높습니다.' :
    avgOvr >= 84 ? '어려움: 강팀 사이에서 디테일한 운영이 필요합니다.' :
    avgOvr >= 78 ? '보통: 운영과 육성이 함께 중요합니다.' :
    '도전적: 장기적인 재건 감각이 필요합니다.';

  const fanExpectation =
    financialTier === 'S' ? '팬들은 우승 경쟁과 국제전 진출을 기대합니다.' :
    financialTier === 'A' ? '팬들은 상위권 유지와 플레이오프 진입을 기대합니다.' :
    financialTier === 'B' ? '팬들은 분명한 성장과 인상적인 업셋을 기대합니다.' :
    '팬들은 당장 성적보다 방향성과 희망을 기대합니다.';

  return {
    playstyleTag: `${region} 무대에서 ${teamName}의 운영 색을 직접 만들어야 하는 팀`,
    pressureLevel,
    recommendedFor:
      financialTier === 'S'
        ? '강한 압박 속에서 시즌 완성도를 끌어올리고 싶은 플레이어'
        : financialTier === 'A'
          ? '상위권 팀을 안정적으로 굴리고 싶은 플레이어'
          : '성장과 운영의 균형을 즐기는 플레이어',
    rivalry: `${region} 상위권 팀들과의 맞대결이 시즌 분위기를 가르는 핵심 경기입니다.`,
    boardStoryline: `${teamName} 프런트는 이번 시즌에 팀의 방향성과 결과를 동시에 확인하려 합니다.`,
    openingFocus: '초반 일정에서 분위기를 빠르게 잡고, 주전 조합의 안정감을 확보해야 합니다.',
    successReward: '시즌 초반 흐름을 타면 이후 운영 선택지와 프런트 신뢰가 크게 넓어집니다.',
    failureRisk: '부진이 길어지면 보드 신뢰와 시즌 분위기가 빠르게 흔들릴 수 있습니다.',
    fanExpectation,
    seasonDifficulty,
  };
}

export function getTeamIntroMeta(input: TeamMetaInput): TeamIntroMeta {
  const defaultMeta = buildDefaultMeta(input);
  const shortName = input.teamId.split('_').slice(1).join('_').toUpperCase();
  const overrides = SPECIAL_TEAM_META[shortName] ?? {};
  return { ...defaultMeta, ...overrides };
}

export function describePressureTone(pressureLevel: string): 'danger' | 'warning' | 'steady' {
  if (pressureLevel.includes('최고') || pressureLevel.includes('우승')) return 'danger';
  if (pressureLevel.includes('상위권') || pressureLevel.includes('플레이오프')) return 'warning';
  return 'steady';
}
