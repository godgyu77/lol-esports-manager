import type { AiProvider } from '../stores/settingsStore';

export interface AiFeaturePolicy {
  id: string;
  label: string;
  priority: 'high' | 'medium' | 'low';
  localFirst: boolean;
  cloudAllowed: boolean;
  templateFallback: boolean;
  note: string;
}

export const AI_FEATURE_POLICIES: AiFeaturePolicy[] = [
  {
    id: 'draft_advice',
    label: '드래프트 조언',
    priority: 'high',
    localFirst: true,
    cloudAllowed: true,
    templateFallback: true,
    note: '밴픽 판단은 게임 엔진과 바로 맞닿아 있어서 로컬 AI를 먼저 시도하고, 실패하면 즉시 템플릿 조언으로 전환합니다.',
  },
  {
    id: 'daily_briefing',
    label: '일일 브리핑',
    priority: 'medium',
    localFirst: true,
    cloudAllowed: true,
    templateFallback: true,
    note: '몰입감을 높이는 보조 기능이라서 품질보다 안정적인 출력과 빠른 로딩을 우선합니다.',
  },
  {
    id: 'live_commentary',
    label: '중계와 채팅',
    priority: 'low',
    localFirst: true,
    cloudAllowed: true,
    templateFallback: true,
    note: '경기 진행을 멈추지 않는 것이 더 중요하므로, AI가 불안정하면 템플릿 중계만으로도 충분히 굴러가야 합니다.',
  },
  {
    id: 'news_social',
    label: '뉴스와 팬 반응',
    priority: 'low',
    localFirst: true,
    cloudAllowed: true,
    templateFallback: true,
    note: '콘텐츠 다양성을 높이는 역할이라 템플릿 기반만으로도 재미가 유지되도록 설계합니다.',
  },
  {
    id: 'scouting_conversation',
    label: '스카우팅과 면담',
    priority: 'medium',
    localFirst: true,
    cloudAllowed: true,
    templateFallback: true,
    note: '자유로운 대화 감각은 AI가 좋지만, 실패 시에도 규칙 기반 결과와 템플릿 응답이 항상 이어져야 합니다.',
  },
];

export function describeProviderExecution(provider: AiProvider): string {
  if (provider === 'ollama') {
    return '로컬 Ollama를 먼저 사용하고, 실패하면 설정된 클라우드 AI나 템플릿 응답으로 안전하게 전환합니다.';
  }

  if (provider === 'template') {
    return '실시간 AI 호출 없이 템플릿과 규칙 엔진만으로 안정적으로 진행합니다.';
  }

  return `${provider} 클라우드 AI를 우선 사용하고, 실패하면 템플릿 응답으로 부드럽게 폴백합니다.`;
}

export function getProviderRecommendation(provider: AiProvider): string {
  if (provider === 'ollama') {
    return '고사양 PC에서 비용 없이 몰입감 있는 AI 연출을 즐기고 싶다면 가장 먼저 추천합니다.';
  }

  if (provider === 'template') {
    return '설치나 API 키 없이도 안정적으로 플레이하고 싶다면 가장 편한 선택입니다.';
  }

  return '저사양 환경이거나 더 자연스러운 문장 품질이 필요할 때 어울리는 선택입니다.';
}
