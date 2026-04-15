import { buildFollowUpNewsParagraph, getPrimaryFollowUp, getFollowUpRoute } from './postMatchFollowUp';

describe('postMatchFollowUp', () => {
  it('prefers the highest-priority follow-up', () => {
    const primary = getPrimaryFollowUp([
      { action: '훈련 조정', priority: 'medium', summary: '교전 훈련을 보강하세요.' },
      { action: '전술 재검토', priority: 'high', summary: '진입 각을 다시 정리하세요.' },
    ]);

    expect(primary?.action).toBe('전술 재검토');
    expect(getFollowUpRoute(primary?.action ?? '')).toBe('/manager/tactics');
  });

  it('builds a news paragraph from the follow-up action', () => {
    expect(buildFollowUpNewsParagraph('훈련 조정', '다음 경기 전 교전 훈련을 보강하세요.')).toContain('다음 권장 행동은 훈련 조정입니다.');
  });
});
