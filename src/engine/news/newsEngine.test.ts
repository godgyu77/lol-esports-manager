import { describe, expect, it } from 'vitest';
import {
  MATCH_RESULT_FOLLOW_UP_ACTION_LABEL,
  MATCH_RESULT_FOLLOW_UP_BADGE_LABEL,
  MATCH_RESULT_FOLLOW_UP_MEMO_LABEL,
  MATCH_RESULT_FOLLOW_UP_STORY_TAG,
  MATCH_RESULT_FOLLOW_UP_TITLE,
  buildMatchResultEmotionParagraph,
  buildMatchResultFollowUpHeadline,
  buildMatchResultFollowUpParagraph,
  buildMatchResultInboxMemoParagraph,
} from './newsEngine';

describe('match result follow-up copy', () => {
  it('keeps the shared labels stable across callers', () => {
    expect(MATCH_RESULT_FOLLOW_UP_BADGE_LABEL).toBe('경기 결과 후속');
    expect(MATCH_RESULT_FOLLOW_UP_TITLE).toBe('방금 경기 정리');
    expect(MATCH_RESULT_FOLLOW_UP_ACTION_LABEL).toBe('바로 정리하러 가기');
    expect(MATCH_RESULT_FOLLOW_UP_STORY_TAG).toBe('팬이 기억할 한 문장');
    expect(MATCH_RESULT_FOLLOW_UP_MEMO_LABEL).toBe('관리 메모');
  });

  it('formats the shared follow-up paragraph consistently', () => {
    expect(
      buildMatchResultFollowUpParagraph({
        followUpAction: '전술 재정비',
        followUpSummary: '경기 초반 운영이 자주 흔들렸습니다.',
      }),
    ).toBe('다음 권장 행동은 전술 재정비입니다. 경기 초반 운영이 자주 흔들렸습니다.');
  });

  it('formats an inbox memo paragraph separately from the story paragraph', () => {
    expect(
      buildMatchResultInboxMemoParagraph({
        followUpAction: '전술 재정비',
        followUpSummary: '경기 초반 운영이 자주 흔들렸습니다.',
      }),
    ).toBe('관리 메모: 다음 권장 행동은 전술 재정비입니다. 경기 초반 운영이 자주 흔들렸습니다.');
  });

  it('returns null when follow-up copy is incomplete for story paragraphs', () => {
    expect(buildMatchResultFollowUpParagraph({ followUpAction: '전술 재정비' })).toBeNull();
    expect(buildMatchResultFollowUpParagraph({ followUpSummary: '경기 초반 운영이 자주 흔들렸습니다.' })).toBeNull();
  });

  it('still builds inbox memo copy when only one field is present', () => {
    expect(buildMatchResultInboxMemoParagraph({ followUpAction: '전술 재정비' })).toBe(
      '관리 메모: 다음 권장 행동은 전술 재정비입니다.',
    );
    expect(buildMatchResultInboxMemoParagraph({ followUpSummary: '경기 초반 운영이 자주 흔들렸습니다.' })).toBe(
      '관리 메모: 경기 초반 운영이 자주 흔들렸습니다.',
    );
  });

  it('formats the shared story headline consistently', () => {
    expect(
      buildMatchResultFollowUpHeadline({
        followUpSummary: '경기 초반 운영이 자주 흔들렸습니다. 다음 경기에서는 전술 재정비가 필요합니다.',
      }),
    ).toBe('팬이 기억할 한 문장: 경기 초반 운영이 자주 흔들렸습니다. 다음 경기에서는 전술 재정비가 필요합니다.');
  });

  it('builds an emotional paragraph for decisive score lines', () => {
    expect(
      buildMatchResultEmotionParagraph({
        winner: 'T1',
        loser: 'GEN',
        winScore: 2,
        loseScore: 0,
      }),
    ).toBe(
      '팬이 기억할 한 문장: T1은 시리즈 전체를 장악했다는 인상을 남겼고, GEN은 흐름을 끝내 되찾지 못했다는 아쉬움이 더 크게 남았습니다.',
    );
  });

  it('builds an emotional paragraph for close score lines', () => {
    expect(
      buildMatchResultEmotionParagraph({
        winner: 'T1',
        loser: 'GEN',
        winScore: 2,
        loseScore: 1,
      }),
    ).toBe(
      '팬이 기억할 한 문장: T1은 마지막 한 끗 집중력으로 웃었고, GEN은 거의 손에 닿았던 흐름을 놓친 아쉬움을 남겼습니다. 결과보다 체감이 더 팽팽하게 기억될 경기였습니다.',
    );
  });
});
