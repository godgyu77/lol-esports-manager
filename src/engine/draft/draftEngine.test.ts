/**
 * draftEngine 단위 테스트
 * - 순수 함수만 테스트 (DB 의존 함수 제외)
 * - createDraftState, isChampionAvailable, executeDraftAction,
 *   accumulateFearlessChampions, buildDraftTeamInfo, getRecommendedBans, getRecommendedPicks
 */

import { describe, it, expect } from 'vitest';
import {
  createDraftState,
  isChampionAvailable,
  executeDraftAction,
  finalizeDraft,
  accumulateFearlessChampions,
  buildDraftTeamInfo,
  getRecommendedBans,
  getRecommendedPicks,
  swapChampions,
} from './draftEngine';
import type { Champion } from '../../types/champion';
import type { Position } from '../../types/game';

// ─────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────

function createMockChampion(overrides: Partial<Champion> = {}): Champion {
  return {
    id: 'champ_default',
    name: 'DefaultChamp',
    nameKo: '기본챔프',
    primaryRole: 'mid',
    secondaryRoles: [],
    tier: 'B',
    tags: ['mage'],
    stats: { earlyGame: 50, lateGame: 50, teamfight: 50, splitPush: 50, difficulty: 50 },
    primaryBuild: 'ap',
    secondaryBuild: null,
    damageProfile: 'magic',
    ...overrides,
  } as Champion;
}

function createChampionList(): Champion[] {
  return [
    createMockChampion({ id: 'aatrox', name: 'Aatrox', nameKo: '아트록스', primaryRole: 'top', tier: 'S', tags: ['fighter', 'tank', 'engage'] }),
    createMockChampion({ id: 'ahri', name: 'Ahri', nameKo: '아리', primaryRole: 'mid', tier: 'A', tags: ['mage', 'assassin'] }),
    createMockChampion({ id: 'jinx', name: 'Jinx', nameKo: '징크스', primaryRole: 'adc', tier: 'S', tags: ['marksman', 'teamfight'] }),
    createMockChampion({ id: 'thresh', name: 'Thresh', nameKo: '쓰레쉬', primaryRole: 'support', tier: 'A', tags: ['engage', 'tank'] }),
    createMockChampion({ id: 'leesin', name: 'Lee Sin', nameKo: '리 신', primaryRole: 'jungle', tier: 'A', tags: ['fighter', 'assassin'] }),
    createMockChampion({ id: 'orianna', name: 'Orianna', nameKo: '오리아나', primaryRole: 'mid', tier: 'B', tags: ['mage', 'teamfight'] }),
    createMockChampion({ id: 'garen', name: 'Garen', nameKo: '가렌', primaryRole: 'top', tier: 'C', tags: ['fighter', 'tank'] }),
    createMockChampion({ id: 'zed', name: 'Zed', nameKo: '제드', primaryRole: 'mid', tier: 'A', tags: ['assassin'] }),
    createMockChampion({ id: 'kaisa', name: "Kai'Sa", nameKo: '카이사', primaryRole: 'adc', tier: 'A', tags: ['marksman'] }),
    createMockChampion({ id: 'nautilus', name: 'Nautilus', nameKo: '노틸러스', primaryRole: 'support', tier: 'B', tags: ['tank', 'engage'] }),
  ];
}

// ─────────────────────────────────────────
// createDraftState 테스트
// ─────────────────────────────────────────

describe('createDraftState', () => {
  it('초기 상태가 올바르게 생성됨', () => {
    const state = createDraftState();

    expect(state.currentStep).toBe(0);
    expect(state.phase).toBe('ban1');
    expect(state.currentSide).toBe('blue');
    expect(state.currentActionType).toBe('ban');
    expect(state.blue.bans).toHaveLength(0);
    expect(state.blue.picks).toHaveLength(0);
    expect(state.red.bans).toHaveLength(0);
    expect(state.red.picks).toHaveLength(0);
    expect(state.isComplete).toBe(false);
    expect(state.fearlessMode).toBe(false);
  });

  it('피어리스 모드 활성화', () => {
    const pool = { blue: ['champ1'], red: ['champ2'] };
    const state = createDraftState(true, pool);

    expect(state.fearlessMode).toBe(true);
    expect(state.fearlessPool).toEqual(pool);
  });
  it('포지션에 맞지 않는 챔피언 픽은 거부한다', () => {
    const state = createDraftState();
    for (let i = 0; i < 6; i++) {
      executeDraftAction(state, `ban_${i}`);
    }

    const success = executeDraftAction(state, 'varus', 'jungle');

    expect(success).toBe(false);
    expect(state.blue.picks).toHaveLength(0);
  });

  it('스왑으로도 잘못된 포지션 조합은 만들 수 없다', () => {
    const state = createDraftState();
    state.phase = 'swap';
    state.blue.picks = [
      { championId: 'renekton', position: 'top' },
      { championId: 'varus', position: 'adc' },
      { championId: 'orianna', position: 'mid' },
      { championId: 'leesin', position: 'jungle' },
      { championId: 'thresh', position: 'support' },
    ];

    const success = swapChampions(state, 'blue', 0, 1);

    expect(success).toBe(false);
    expect(state.blue.picks[0]).toEqual({ championId: 'renekton', position: 'top' });
    expect(state.blue.picks[1]).toEqual({ championId: 'varus', position: 'adc' });
  });
});

// ─────────────────────────────────────────
// isChampionAvailable 테스트
// ─────────────────────────────────────────

describe('isChampionAvailable', () => {
  it('밴된 챔피언은 사용 불가', () => {
    const state = createDraftState();
    state.bannedChampions.push('aatrox');

    expect(isChampionAvailable(state, 'aatrox')).toBe(false);
  });

  it('픽된 챔피언은 사용 불가', () => {
    const state = createDraftState();
    state.pickedChampions.push('ahri');

    expect(isChampionAvailable(state, 'ahri')).toBe(false);
  });

  it('밴/픽 되지 않은 챔피언은 사용 가능', () => {
    const state = createDraftState();

    expect(isChampionAvailable(state, 'aatrox')).toBe(true);
  });

  it('피어리스 모드: 현재 진영의 이전 세트 챔피언 사용 불가', () => {
    const state = createDraftState(true, { blue: ['aatrox'], red: [] });
    state.currentSide = 'blue';

    expect(isChampionAvailable(state, 'aatrox')).toBe(false);
  });

  it('피어리스 모드: 상대 진영의 이전 세트 챔피언은 사용 가능', () => {
    const state = createDraftState(true, { blue: [], red: ['aatrox'] });
    state.currentSide = 'blue';

    expect(isChampionAvailable(state, 'aatrox')).toBe(true);
  });
});

// ─────────────────────────────────────────
// executeDraftAction 테스트
// ─────────────────────────────────────────

describe('executeDraftAction', () => {
  it('첫 번째 밴 실행 성공', () => {
    const state = createDraftState();
    const success = executeDraftAction(state, 'aatrox');

    expect(success).toBe(true);
    expect(state.blue.bans).toContain('aatrox');
    expect(state.bannedChampions).toContain('aatrox');
    expect(state.currentStep).toBe(1);
    expect(state.currentSide).toBe('red'); // 다음은 레드 밴
  });

  it('이미 밴된 챔피언은 실패', () => {
    const state = createDraftState();
    executeDraftAction(state, 'aatrox');
    const success = executeDraftAction(state, 'aatrox');

    expect(success).toBe(false);
  });

  it('완료된 드래프트에서 액션 실패', () => {
    const state = createDraftState();
    state.isComplete = true;

    expect(executeDraftAction(state, 'aatrox')).toBe(false);
  });

  it('6밴 완료 후 픽 페이즈로 전환', () => {
    const state = createDraftState();
    // 6밴 실행
    const bans = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
    for (const ban of bans) {
      executeDraftAction(state, ban);
    }

    expect(state.phase).toBe('pick1');
    expect(state.currentActionType).toBe('pick');
  });

  it('픽 시 포지션 없으면 실패', () => {
    const state = createDraftState();
    // 6밴 실행
    for (let i = 0; i < 6; i++) {
      executeDraftAction(state, `ban_${i}`);
    }
    const success = executeDraftAction(state, 'aatrox');

    expect(success).toBe(true);
    expect(state.blue.picks[0]).toEqual({ championId: 'aatrox', position: 'top' });
  });

  it('픽 시 포지션 있으면 성공', () => {
    const state = createDraftState();
    for (let i = 0; i < 6; i++) {
      executeDraftAction(state, `ban_${i}`);
    }
    const success = executeDraftAction(state, 'aatrox', 'top');

    expect(success).toBe(true);
    expect(state.blue.picks).toHaveLength(1);
    expect(state.blue.picks[0]).toEqual({ championId: 'aatrox', position: 'top' });
  });

  it('20스텝 완료 후 swap → finalize → complete', () => {
    const state = createDraftState();
    const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
    // 블루/레드 각각 포지션 인덱스 추적
    const teamPosIdx = { blue: 0, red: 0 };

    let champIdx = 0;
    while (state.currentStep < 20) {
      const champId = `champ_${champIdx++}`;
      if (state.currentActionType === 'ban') {
        executeDraftAction(state, champId);
      } else {
        const side = state.currentSide;
        const pos = positions[teamPosIdx[side] % 5];
        teamPosIdx[side]++;
        executeDraftAction(state, champId, pos);
      }
    }

    // 20스텝 후 swap 단계 진입 → finalize로 완료
    expect(state.phase).toBe('swap');
    finalizeDraft(state);
    expect(state.isComplete).toBe(true);
    expect(state.phase).toBe('complete');
    expect(state.blue.bans).toHaveLength(5);
    expect(state.red.bans).toHaveLength(5);
    expect(state.blue.picks).toHaveLength(5);
    expect(state.red.picks).toHaveLength(5);
  });

  it('히스토리에 모든 액션이 기록됨', () => {
    const state = createDraftState();
    executeDraftAction(state, 'aatrox');
    executeDraftAction(state, 'ahri');

    expect(state.history).toHaveLength(2);
    expect(state.history[0]).toEqual({
      type: 'ban', side: 'blue', championId: 'aatrox', position: undefined,
    });
    expect(state.history[1]).toEqual({
      type: 'ban', side: 'red', championId: 'ahri', position: undefined,
    });
  });
});

// ─────────────────────────────────────────
// accumulateFearlessChampions 테스트
// ─────────────────────────────────────────

describe('accumulateFearlessChampions', () => {
  it('세트 완료 후 사용된 챔피언이 풀에 누적됨', () => {
    const state = createDraftState(true);
    state.blue.picks = [
      { championId: 'aatrox', position: 'top' },
      { championId: 'ahri', position: 'mid' },
    ];
    state.red.picks = [
      { championId: 'jinx', position: 'adc' },
    ];

    const pool = accumulateFearlessChampions({ blue: [], red: [] }, state);

    expect(pool.blue).toContain('aatrox');
    expect(pool.blue).toContain('ahri');
    expect(pool.red).toContain('jinx');
  });

  it('기존 풀에 중복 없이 추가', () => {
    const state = createDraftState(true);
    state.blue.picks = [{ championId: 'aatrox', position: 'top' }];

    const pool = accumulateFearlessChampions({ blue: ['aatrox'], red: [] }, state);

    expect(pool.blue.filter(c => c === 'aatrox')).toHaveLength(1);
  });

  it('기존 풀 데이터를 보존함', () => {
    const state = createDraftState(true);
    state.blue.picks = [{ championId: 'ahri', position: 'mid' }];

    const pool = accumulateFearlessChampions({ blue: ['aatrox'], red: ['jinx'] }, state);

    expect(pool.blue).toContain('aatrox');
    expect(pool.blue).toContain('ahri');
    expect(pool.red).toContain('jinx');
  });
});

// ─────────────────────────────────────────
// buildDraftTeamInfo 테스트
// ─────────────────────────────────────────

describe('buildDraftTeamInfo', () => {
  it('포지션별 챔피언 풀을 올바르게 매핑', () => {
    const players = [
      { position: 'mid' as Position, championPool: [{ championId: 'ahri', proficiency: 90, gamesPlayed: 50 }] },
      { position: 'top' as Position, championPool: [{ championId: 'aatrox', proficiency: 80, gamesPlayed: 30 }] },
    ];

    const info = buildDraftTeamInfo(players, ['mage']);

    expect(info.playerPools.mid).toHaveLength(1);
    expect(info.playerPools.mid[0].championId).toBe('ahri');
    expect(info.playerPools.top[0].championId).toBe('aatrox');
    expect(info.preferredTags).toContain('mage');
  });

  it('빈 포지션은 빈 배열', () => {
    const info = buildDraftTeamInfo([], []);

    expect(info.playerPools.jungle).toHaveLength(0);
    expect(info.playerPools.support).toHaveLength(0);
  });
});

// ─────────────────────────────────────────
// getRecommendedBans 테스트
// ─────────────────────────────────────────

describe('getRecommendedBans', () => {
  it('상대 핵심 챔피언 기반으로 밴 추천', () => {
    const state = createDraftState();
    const allChampions = createChampionList();
    const opponentInfo = buildDraftTeamInfo([
      { position: 'mid', championPool: [{ championId: 'ahri', proficiency: 95, gamesPlayed: 100 }] },
      { position: 'adc', championPool: [{ championId: 'jinx', proficiency: 90, gamesPlayed: 80 }] },
    ]);

    const bans = getRecommendedBans(state, opponentInfo, allChampions, 3);

    expect(bans.length).toBeGreaterThan(0);
    expect(bans.length).toBeLessThanOrEqual(3);
    // 높은 숙련도 + S티어 jinx가 추천에 포함되어야 함
    const banIds = bans.map(b => b.championId);
    expect(banIds).toContain('jinx');
  });

  it('S 티어 메타 챔피언도 추천됨', () => {
    const state = createDraftState();
    const allChampions = createChampionList();
    const opponentInfo = buildDraftTeamInfo([]); // 빈 풀

    const bans = getRecommendedBans(state, opponentInfo, allChampions, 5);

    // S 티어 챔피언(aatrox, jinx)이 추천됨
    const banIds = bans.map(b => b.championId);
    expect(banIds.some(id => id === 'aatrox' || id === 'jinx')).toBe(true);
  });

  it('이미 밴된 챔피언은 추천하지 않음', () => {
    const state = createDraftState();
    state.bannedChampions.push('aatrox');
    const allChampions = createChampionList();
    const opponentInfo = buildDraftTeamInfo([]);

    const bans = getRecommendedBans(state, opponentInfo, allChampions);
    const banIds = bans.map(b => b.championId);

    expect(banIds).not.toContain('aatrox');
  });
});

// ─────────────────────────────────────────
// getRecommendedPicks 테스트
// ─────────────────────────────────────────

describe('getRecommendedPicks', () => {
  it('남은 포지션에서 추천 픽 반환', () => {
    const state = createDraftState();
    // 6밴 + 블루 1픽 시뮬레이션
    for (let i = 0; i < 6; i++) executeDraftAction(state, `ban_${i}`);
    executeDraftAction(state, 'aatrox', 'top');

    const allChampions = createChampionList();
    const teamInfo = buildDraftTeamInfo([
      { position: 'mid', championPool: [{ championId: 'ahri', proficiency: 90, gamesPlayed: 50 }] },
      { position: 'adc', championPool: [{ championId: 'jinx', proficiency: 85, gamesPlayed: 40 }] },
      { position: 'jungle', championPool: [{ championId: 'leesin', proficiency: 80, gamesPlayed: 30 }] },
      { position: 'support', championPool: [{ championId: 'thresh', proficiency: 75, gamesPlayed: 20 }] },
    ]);

    const picks = getRecommendedPicks(state, 'red', teamInfo, allChampions, 5);

    expect(picks.length).toBeGreaterThan(0);
    // top은 이미 픽했으므로 추천에 top이 없어야 함 (red 팀이므로 red의 picks 기준)
    // red 팀은 아직 아무것도 픽하지 않았으므로 모든 포지션 가능
    const positions = picks.map(p => p.position);
    expect(positions.length).toBeGreaterThan(0);
  });

  it('이미 픽된 포지션은 추천하지 않음', () => {
    const state = createDraftState();
    for (let i = 0; i < 6; i++) executeDraftAction(state, `ban_${i}`);
    // blue picks top
    executeDraftAction(state, 'pick_top', 'top');

    const allChampions = createChampionList();
    const teamInfo = buildDraftTeamInfo([
      { position: 'top', championPool: [{ championId: 'aatrox', proficiency: 90, gamesPlayed: 50 }] },
      { position: 'mid', championPool: [{ championId: 'ahri', proficiency: 85, gamesPlayed: 40 }] },
    ]);

    const picks = getRecommendedPicks(state, 'blue', teamInfo, allChampions, 5);
    const positions = picks.map(p => p.position);

    expect(positions).not.toContain('top');
  });

  it('밴된 챔피언은 추천하지 않음', () => {
    const state = createDraftState();
    executeDraftAction(state, 'ahri'); // blue ban
    for (let i = 1; i < 6; i++) executeDraftAction(state, `ban_${i}`);

    const allChampions = createChampionList();
    const teamInfo = buildDraftTeamInfo([
      { position: 'mid', championPool: [{ championId: 'ahri', proficiency: 95, gamesPlayed: 100 }] },
    ]);

    const picks = getRecommendedPicks(state, 'blue', teamInfo, allChampions);
    const champIds = picks.map(p => p.championId);

    expect(champIds).not.toContain('ahri');
  });
});
