import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLatestMatchResultInboxMessage,
  isMatchResultInboxMessage,
  syncMatchResultInboxMemo,
  syncSystemInboxMemo,
} from './inboxEngine';

const {
  mockSelect,
  mockExecute,
  mockInvalidateNotifications,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockExecute: vi.fn(),
  mockInvalidateNotifications: vi.fn(),
}));

vi.mock('../../db/database', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    select: mockSelect,
    execute: mockExecute,
  }),
}));

vi.mock('../news/newsEvents', () => ({
  invalidateNotifications: mockInvalidateNotifications,
}));

describe('syncSystemInboxMemo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a new system memo when none exists for the day', async () => {
    mockSelect.mockResolvedValue([]);
    mockExecute.mockResolvedValue(undefined);

    const changed = await syncSystemInboxMemo(
      'team-a',
      '2026-03-01',
      {
        title: '준비 체인 점검',
        summary: '최근 준비 실패가 다음 경기 메모로 이어지고 있습니다.',
        tone: 'risk',
      },
      '/manager/pre-match',
    );

    expect(changed).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute.mock.calls[0]?.[1]?.[4]).toBe('/manager/pre-match');
    expect(mockInvalidateNotifications).toHaveBeenCalled();
  });

  it('updates the existing memo when the latest risk changes', async () => {
    mockSelect.mockResolvedValue([
      {
        id: 7,
        title: '[시스템] 이전 메모',
        content: '이전 내용',
        action_required: 0,
      },
    ]);
    mockExecute.mockResolvedValue(undefined);

    const changed = await syncSystemInboxMemo(
      'team-a',
      '2026-03-01',
      {
        title: '선수 불만 관리',
        summary: '주전 보장 약속 이슈가 커지고 있습니다.',
        tone: 'risk',
      },
      '/manager/complaints',
    );

    expect(changed).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute.mock.calls[0]?.[0]).toContain('UPDATE inbox_messages');
    expect(mockExecute.mock.calls[0]?.[1]?.[4]).toBe('/manager/complaints');
  });

  it('does nothing when the current memo already matches the latest risk', async () => {
    mockSelect.mockResolvedValue([
      {
        id: 9,
        title: '[시스템] 준비 체인 점검',
        content: '최근 준비 실패가 다음 경기 메모로 이어지고 있습니다.',
        action_required: 1,
      },
    ]);

    const changed = await syncSystemInboxMemo('team-a', '2026-03-01', {
      title: '준비 체인 점검',
      summary: '최근 준비 실패가 다음 경기 메모로 이어지고 있습니다.',
      tone: 'risk',
    });

    expect(changed).toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockInvalidateNotifications).not.toHaveBeenCalled();
  });
});

describe('syncMatchResultInboxMemo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a new match result memo when none exists', async () => {
    mockSelect.mockResolvedValue([]);
    mockExecute.mockResolvedValue(undefined);

    const changed = await syncMatchResultInboxMemo(
      'team-a',
      '2026-03-02',
      'match-1',
      '[경기 결과] GEN전 0:2 패배',
      '관리 메모: 다음 권장 행동은 전술 재정비입니다.',
      '/manager/tactics',
    );

    expect(changed).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute.mock.calls[0]?.[1]?.[3]).toBe('/manager/tactics');
    expect(mockInvalidateNotifications).toHaveBeenCalled();
  });

  it('updates the existing match result memo when content changes', async () => {
    mockSelect.mockResolvedValue([
      {
        id: 11,
        title: '[경기 결과] GEN전 0:2 패배',
        content: '이전 메모',
        action_route: '/manager/day',
      },
    ]);
    mockExecute.mockResolvedValue(undefined);

    const changed = await syncMatchResultInboxMemo(
      'team-a',
      '2026-03-02',
      'match-1',
      '[경기 결과] GEN전 0:2 패배',
      '관리 메모: 다음 권장 행동은 전술 재정비입니다.',
      '/manager/tactics',
    );

    expect(changed).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute.mock.calls[0]?.[0]).toContain('UPDATE inbox_messages');
    expect(mockExecute.mock.calls[0]?.[1]?.[3]).toBe('/manager/tactics');
  });

  it('does nothing when the current match result memo already matches', async () => {
    mockSelect.mockResolvedValue([
      {
        id: 11,
        title: '[경기 결과] GEN전 0:2 패배',
        content: '관리 메모: 다음 권장 행동은 전술 재정비입니다.',
        action_route: '/manager/tactics',
      },
    ]);

    const changed = await syncMatchResultInboxMemo(
      'team-a',
      '2026-03-02',
      'match-1',
      '[경기 결과] GEN전 0:2 패배',
      '관리 메모: 다음 권장 행동은 전술 재정비입니다.',
      '/manager/tactics',
    );

    expect(changed).toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockInvalidateNotifications).not.toHaveBeenCalled();
  });
});

describe('match result inbox helpers', () => {
  it('recognizes match result inbox messages by related id or title', () => {
    expect(isMatchResultInboxMessage({ relatedId: 'match_result:match-1', title: 'anything' })).toBe(true);
    expect(isMatchResultInboxMessage({ relatedId: null, title: '[경기 결과] T1 vs GEN' })).toBe(true);
    expect(isMatchResultInboxMessage({ relatedId: null, title: '일반 메모' })).toBe(false);
  });

  it('returns the latest match result inbox message from a list', () => {
    const latest = getLatestMatchResultInboxMessage([
      {
        id: 1,
        teamId: 'team-a',
        category: 'general',
        title: '일반 메모',
        content: '기타 메모',
        isRead: true,
        actionRequired: false,
        actionRoute: null,
        relatedId: null,
        createdDate: '2026-03-01',
        dismissOnRead: false,
        sticky: false,
      },
      {
        id: 2,
        teamId: 'team-a',
        category: 'general',
        title: '[경기 결과] GEN전 패배',
        content: '관리 메모',
        isRead: false,
        actionRequired: true,
        actionRoute: '/manager/tactics',
        relatedId: 'match_result:match-1',
        createdDate: '2026-03-02',
        dismissOnRead: false,
        sticky: false,
      },
    ]);

    expect(latest?.id).toBe(2);
  });
});
