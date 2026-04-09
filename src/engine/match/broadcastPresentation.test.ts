import type { LiveGameState } from './liveMatch';
import { DEFAULT_BROADCAST_CREW } from '../../data/broadcastTalentDb';
import { buildBroadcastHighlight, buildBroadcastLines, buildPostMatchInterviewPackage } from './broadcastPresentation';
import { createDraftState, type DraftState } from '../draft/draftEngine';

const mockState = {
  currentTick: 18,
  maxTick: 40,
  phase: 'mid_game',
  goldHome: 35800,
  goldAway: 33100,
  killsHome: 9,
  killsAway: 5,
  towersHome: 4,
  towersAway: 2,
  dragonsHome: 2,
  dragonsAway: 1,
  baronHome: false,
  baronAway: false,
  grubsHome: 3,
  grubsAway: 1,
  dragonSoul: {
    homeStacks: 2,
    awayStacks: 1,
    soulTeam: null,
    soulType: null,
  },
  currentWinRate: 0.62,
  events: [],
  commentary: [
    { tick: 12, message: 'Faker가 미드에서 선수를 끊어 냈습니다.', type: 'kill' },
    { tick: 15, message: 'T1이 드래곤 앞 시야를 먼저 장악합니다.', type: 'objective' },
    { tick: 18, message: '바론 전 한타 구도가 열립니다.', type: 'teamfight' },
  ],
  pendingDecision: null,
  playerStatsHome: [
    { playerId: '1', playerName: 'Faker', position: 'MID', kills: 4, deaths: 1, assists: 3, cs: 180, goldEarned: 12200, damageDealt: 22100, form: 75, comfortPick: true, championId: 'Ahri' },
    { playerId: '2', playerName: 'Oner', position: 'JGL', kills: 2, deaths: 1, assists: 6, cs: 132, goldEarned: 9800, damageDealt: 13200, form: 72, comfortPick: false, championId: 'Vi' },
  ],
  playerStatsAway: [
    { playerId: '3', playerName: 'Chovy', position: 'MID', kills: 2, deaths: 2, assists: 2, cs: 175, goldEarned: 11000, damageDealt: 18800, form: 74, comfortPick: true, championId: 'Sylas' },
  ],
  objectiveStates: [],
  goldHistory: [],
  playerMapStates: [],
  focusEvent: {
    eventType: 'teamfight',
    side: 'home',
    label: '바론 전 한타',
    detail: '미드 강가에서 한타를 열어 주도권을 잡습니다.',
    zone: 'center',
    tick: 18,
  },
  cameraZone: 'center',
  isFinished: true,
  winner: 'home',
} as unknown as LiveGameState;

describe('broadcastPresentation', () => {
  it('adds draft analysis lines before gameplay commentary when draft result exists', () => {
    const draft: DraftState = {
      ...createDraftState(),
      blue: {
        bans: [],
        picks: [
          { championId: 'renekton', position: 'top' },
          { championId: 'lee_sin', position: 'jungle' },
          { championId: 'ahri', position: 'mid' },
          { championId: 'kalista', position: 'adc' },
          { championId: 'rell', position: 'support' },
        ],
      },
      red: {
        bans: [],
        picks: [
          { championId: 'ksante', position: 'top' },
          { championId: 'sejuani', position: 'jungle' },
          { championId: 'azir', position: 'mid' },
          { championId: 'jinx', position: 'adc' },
          { championId: 'lulu', position: 'support' },
        ],
      },
      pickedChampions: ['renekton', 'lee_sin', 'ahri', 'kalista', 'rell', 'ksante', 'sejuani', 'azir', 'jinx', 'lulu'],
    };

    const lines = buildBroadcastLines(mockState.commentary, DEFAULT_BROADCAST_CREW, mockState, {
      matchType: 'regular',
      homeTeamId: 'lck_T1',
      awayTeamId: 'lck_GEN',
      homeTeamName: 'T1',
      awayTeamName: 'Gen.G',
      currentGameNum: 1,
      draftResult: draft,
    });

    const draftLines = lines.filter((line) => line.tickLabel === 'DRAFT');
    expect(draftLines.length).toBeGreaterThanOrEqual(3);
    expect(draftLines.some((line) => line.message.includes('밴픽'))).toBe(true);
    expect(
      draftLines.some(
        (line) =>
          line.message.includes('초반 주도권') ||
          line.message.includes('정면 한타') ||
          line.message.includes('바텀 주도권') ||
          line.message.includes('정글 첫 동선'),
      ),
    ).toBe(true);
  });

  it('uses speaker specialty for draft analysis focus', () => {
    const draft: DraftState = {
      ...createDraftState(),
      blue: {
        bans: [],
        picks: [
          { championId: 'renekton', position: 'top' },
          { championId: 'lee_sin', position: 'jungle' },
          { championId: 'ahri', position: 'mid' },
          { championId: 'kalista', position: 'adc' },
          { championId: 'rell', position: 'support' },
        ],
      },
      red: {
        bans: [],
        picks: [
          { championId: 'ksante', position: 'top' },
          { championId: 'sejuani', position: 'jungle' },
          { championId: 'azir', position: 'mid' },
          { championId: 'jinx', position: 'adc' },
          { championId: 'lulu', position: 'support' },
        ],
      },
      pickedChampions: ['renekton', 'lee_sin', 'ahri', 'kalista', 'rell', 'ksante', 'sejuani', 'azir', 'jinx', 'lulu'],
    };

    const lines = buildBroadcastLines(
      mockState.commentary,
      {
        ...DEFAULT_BROADCAST_CREW,
        analystSecondary: {
          ...DEFAULT_BROADCAST_CREW.analystSecondary,
          id: 'lee-chaehwan-prince',
          name: '이채환',
        },
      },
      mockState,
      {
      matchType: 'regular',
      homeTeamId: 'lck_T1',
      awayTeamId: 'lck_GEN',
      homeTeamName: 'T1',
      awayTeamName: 'Gen.G',
      currentGameNum: 1,
      draftResult: draft,
      },
    ).filter((line) => line.tickLabel === 'DRAFT');

    const primaryLine = lines.find((line) => line.speaker.id === DEFAULT_BROADCAST_CREW.analystPrimary.id);
    const secondaryLine = lines.find(
      (line) =>
        line.speaker.id !== DEFAULT_BROADCAST_CREW.caster.id &&
        line.speaker.id !== DEFAULT_BROADCAST_CREW.analystPrimary.id,
    );

    expect(primaryLine?.message).toMatch(/구도|한타|핵심/);
    expect(secondaryLine?.message).toMatch(/바텀|라인|용/);
  });

  it('builds role-separated broadcast lines', () => {
    const lines = buildBroadcastLines(mockState.commentary, DEFAULT_BROADCAST_CREW, mockState, {
      matchType: 'regular',
      homeTeamId: 'lck_T1',
      awayTeamId: 'lck_GEN',
      homeTeamName: 'T1',
      awayTeamName: 'Gen.G',
      currentGameNum: 1,
    });

    expect(lines.length).toBeGreaterThan(3);
    expect(lines.some((line) => line.roleLabel === '캐스터')).toBe(true);
    expect(lines.some((line) => line.roleLabel === '해설')).toBe(true);
    expect(lines[0]?.tickLabel).toBe('LIVE');
  });

  it('builds a focus highlight and post-match studio package', () => {
    const highlight = buildBroadcastHighlight(mockState);
    const pack = buildPostMatchInterviewPackage({
      crew: DEFAULT_BROADCAST_CREW,
      gameState: mockState,
      homeTeamId: 'lck_T1',
      awayTeamId: 'lck_GEN',
      homeTeamName: 'T1',
      awayTeamName: 'Gen.G',
      userTeamName: 'T1',
      opponentTeamName: 'Gen.G',
      matchType: 'regular',
      postMatchComment: {
        headline: 'T1, 한타 집중력으로 승리',
        coachComment: '준비한 교전 구도가 잘 살아난 경기였습니다.',
      },
    });

    expect(highlight.title).toContain('한타');
    expect(pack.openingHeadline).toContain('T1');
    expect(pack.pomAnnouncement).toContain(pack.pomName);
    expect(pack.pomName.length).toBeGreaterThan(0);
    expect(pack.coachToneOptions).toHaveLength(3);
    expect(pack.aftermathHeadline).toContain('T1');
  });

  it('includes guest commentary when a guest analyst is attached', () => {
    const pack = buildPostMatchInterviewPackage({
      crew: {
        ...DEFAULT_BROADCAST_CREW,
        guestAnalyst: {
          id: 'guest-kuro',
          name: '이서행',
          role: 'guest_analyst',
          styleTag: '논리적 밴픽 해설',
          specialty: '미드 시점과 밴픽 해석',
          excitement: 70,
          analysis: 92,
          composure: 88,
          humor: 60,
          appearances: ['regular', 'playoffs', 'finals'],
          speechStyle: '밴픽과 미드 주도권을 읽는 차분한 해설',
          signaturePhrases: ['미드가 먼저 움직일 수 있으면 그림이 달라집니다.'],
          eventStrengths: ['decision', 'highlight'],
          bigMatchOnlyLines: {
            highlight: ['플레이오프 밴픽은 한 장 더 준비한 팀이 결국 말이 됩니다.'],
          },
          deskSummaryStyle: ['오늘은 밴픽 의도와 실제 운영이 정확히 맞았습니다.'],
          guestWeightRegular: 90,
          guestWeightPlayoffs: 100,
          guestWeightFinals: 110,
        },
      },
      gameState: mockState,
      homeTeamId: 'lck_T1',
      awayTeamId: 'lck_GEN',
      homeTeamName: 'T1',
      awayTeamName: 'Gen.G',
      userTeamName: 'T1',
      opponentTeamName: 'Gen.G',
      matchType: 'playoff_final',
    });

    expect(pack.guestAnalystName).toBe('이서행');
    expect(pack.guestSummary).toContain('이서행');
  });

  it('changes broadcast tone by speaker identity', () => {
    const regularLines = buildBroadcastLines(mockState.commentary, DEFAULT_BROADCAST_CREW, mockState, {
      matchType: 'regular',
      homeTeamId: 'lck_T1',
      awayTeamId: 'lck_GEN',
      homeTeamName: 'T1',
      awayTeamName: 'Gen.G',
      currentGameNum: 1,
    });
    const seongCrew = {
      ...DEFAULT_BROADCAST_CREW,
      caster: {
        ...DEFAULT_BROADCAST_CREW.caster,
        id: 'seong-seunghun',
        name: '성승헌',
        signaturePhrases: ['순식간입니다!'],
      },
    };
    const seongLines = buildBroadcastLines(mockState.commentary, seongCrew, mockState, {
      matchType: 'regular',
      homeTeamId: 'lck_T1',
      awayTeamId: 'lck_GEN',
      homeTeamName: 'T1',
      awayTeamName: 'Gen.G',
      currentGameNum: 1,
    });

    const regularCasterEventLine = regularLines.find((line) => line.speaker.id === DEFAULT_BROADCAST_CREW.caster.id && line.tickLabel !== 'LIVE' && line.tickLabel !== 'DRAFT');
    const seongCasterEventLine = seongLines.find((line) => line.speaker.id === 'seong-seunghun' && line.tickLabel !== 'LIVE' && line.tickLabel !== 'DRAFT');

    expect(regularCasterEventLine?.message).not.toBe(seongCasterEventLine?.message);
  });

  it('adds variation even for the same speaker on repeated event types', () => {
    const repeatedState = {
      ...mockState,
      commentary: [
        { tick: 10, message: 'T1이 드래곤 앞 시야를 먼저 장악합니다.', type: 'objective' },
        { tick: 16, message: 'T1이 바론 앞 시야를 먼저 장악합니다.', type: 'objective' },
      ],
    } as unknown as LiveGameState;

    const lines = buildBroadcastLines(repeatedState.commentary, DEFAULT_BROADCAST_CREW, repeatedState, {
      matchType: 'regular',
      homeTeamId: 'lck_T1',
      awayTeamId: 'lck_GEN',
      homeTeamName: 'T1',
      awayTeamName: 'Gen.G',
      currentGameNum: 1,
    }).filter((line) => line.speaker.id === DEFAULT_BROADCAST_CREW.analystPrimary.id);

    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]?.message).not.toBe(lines[1]?.message);
  });

  it('injects team narrative language into opening and aftermath packages', () => {
    const lines = buildBroadcastLines(mockState.commentary, DEFAULT_BROADCAST_CREW, mockState, {
      matchType: 'regular',
      homeTeamId: 'lck_HLE',
      awayTeamId: 'lck_DK',
      homeTeamName: 'Hanwha Life Esports',
      awayTeamName: 'Dplus KIA',
      currentGameNum: 1,
    });
    const pack = buildPostMatchInterviewPackage({
      crew: DEFAULT_BROADCAST_CREW,
      gameState: mockState,
      homeTeamId: 'lck_HLE',
      awayTeamId: 'lck_DK',
      homeTeamName: 'Hanwha Life Esports',
      awayTeamName: 'Dplus KIA',
      userTeamName: 'Hanwha Life Esports',
      opponentTeamName: 'Dplus KIA',
      matchType: 'regular',
    });

    expect(lines[0]?.message).toContain('파괴전차');
    expect(pack.openingHeadline.length).toBeGreaterThan(0);
    expect(pack.guestSummary ?? '').not.toContain('undefined');
  });
});
