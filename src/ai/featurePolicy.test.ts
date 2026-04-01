import { AI_FEATURE_POLICIES, describeProviderExecution, getProviderRecommendation } from './featurePolicy';

describe('featurePolicy', () => {
  it('모든 핵심 AI 기능이 템플릿 폴백을 지원한다', () => {
    expect(AI_FEATURE_POLICIES.length).toBeGreaterThan(0);
    expect(AI_FEATURE_POLICIES.every((policy) => policy.templateFallback)).toBe(true);
  });

  it('provider별 실행 설명을 올바르게 반환한다', () => {
    expect(describeProviderExecution('ollama')).toContain('Ollama');
    expect(describeProviderExecution('template')).toContain('템플릿');
    expect(describeProviderExecution('openai')).toContain('openai');
  });

  it('provider별 추천 사용 상황을 제공한다', () => {
    expect(getProviderRecommendation('ollama')).toContain('고사양');
    expect(getProviderRecommendation('template')).toContain('안정적');
    expect(getProviderRecommendation('claude')).toContain('저사양');
  });
});
