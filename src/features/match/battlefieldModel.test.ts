import { describe, expect, it } from 'vitest';
import { buildBattlefieldFrame } from './battlefieldModel';
import type { LiveGameState } from '../../engine/match/liveMatch';

const baseState: LiveGameState = {
  currentTick: 24,
  maxTick: 35,
  phase: 'mid_game',
  goldHome: 48200,
  goldAway: 45100,
  killsHome: 12,
  killsAway: 8,
  towersHome: 5,
  towersAway: 3,
  dragonsHome: 2,
  dragonsAway: 1,
  baronHome: false,
  baronAway: false,
  grubsHome: 3,
  grubsAway: 0,
  dragonSoul: { homeStacks: 2, awayStacks: 1, dragonTypes: [] },
  currentWinRate: 0.63,
  events: [],
  commentary: [],
  pendingDecision: null,
  resolvedDecisions: [],
  goldHistory: [
    { tick: 20, diff: 900 },
    { tick: 24, diff: 3100 },
  ],
  playerStatsHome: [
    {
      playerId: 'h1',
      playerName: 'Zeus',
      position: 'top',
      championId: 'aatrox',
      kills: 3,
      deaths: 1,
      assists: 5,
      cs: 201,
      goldEarned: 10800,
      form: 82,
      comfortPick: true,
      damageDealt: 22100,
    },
  ],
  playerStatsAway: [
    {
      playerId: 'a1',
      playerName: 'Kiin',
      position: 'top',
      championId: 'ornn',
      kills: 1,
      deaths: 3,
      assists: 4,
      cs: 182,
      goldEarned: 9400,
      form: 68,
      comfortPick: false,
      damageDealt: 16900,
    },
  ],
  playerMapStates: [
    {
      playerId: 'h1',
      side: 'home',
      position: 'top',
      zone: 'baron_pit',
      x: 0.36,
      y: 0.32,
      activity: 'objective',
      highlight: true,
    },
    {
      playerId: 'a1',
      side: 'away',
      position: 'top',
      zone: 'top_river',
      x: 0.44,
      y: 0.29,
      activity: 'teamfight',
      highlight: true,
    },
  ],
  objectiveStates: [
    { key: 'dragon', zone: 'dragon_pit', status: 'respawning', nextSpawnTick: 27 },
    { key: 'baron', zone: 'baron_pit', status: 'up' },
    { key: 'herald', zone: 'top_river', status: 'secured', controlledBy: 'home' },
  ],
  focusEvent: {
    eventType: 'baron',
    side: 'home',
    label: 'Baron Setup',
    detail: 'Blue side controls river vision and collapses first.',
    zone: 'baron_pit',
    tick: 24,
  },
  cameraZone: 'baron_pit',
  isFinished: false,
};

describe('buildBattlefieldFrame', () => {
  it('raises camera intensity and zoom for clash-level focus events', () => {
    const frame = buildBattlefieldFrame({
      ...baseState,
      events: [
        {
          tick: 24,
          type: 'baron',
          side: 'home',
          description: 'Blue side secures Baron Nashor.',
          goldChange: 1500,
          zone: 'baron_pit',
        },
      ],
    });

    expect(frame.camera.intensity).toBe('clash');
    expect(frame.camera.zoom).toBeGreaterThan(1.15);
    expect(frame.effects[0]?.visual).toBe('objective');
  });

  it('classifies steal events as spotlight effects and computes pressure split', () => {
    const frame = buildBattlefieldFrame({
      ...baseState,
      focusEvent: null,
      cameraZone: 'mid_lane',
      events: [
        {
          tick: 23,
          type: 'steal',
          side: 'away',
          description: 'Red side jungler steals the dragon.',
          goldChange: 900,
          zone: 'dragon_pit',
        },
      ],
    });

    expect(frame.camera.intensity).toBe('ambient');
    expect(frame.effects[0]?.visual).toBe('spotlight');
    expect(frame.homePressure).toBeGreaterThan(frame.awayPressure);
  });

  it('derives player state tags and power spikes from map activity and stats', () => {
    const frame = buildBattlefieldFrame({
      ...baseState,
      playerMapStates: [
        {
          playerId: 'h1',
          side: 'home',
          position: 'top',
          zone: 'home_base',
          x: 0.12,
          y: 0.88,
          activity: 'reset',
          highlight: false,
        },
        {
          playerId: 'a1',
          side: 'away',
          position: 'top',
          zone: 'dragon_pit',
          x: 0.62,
          y: 0.67,
          activity: 'objective',
          highlight: true,
        },
      ],
    });

    expect(frame.players[0]?.statusTag).toBe('recalling');
    expect(frame.players[0]?.powerSpike).toBe(true);
    expect(frame.players[1]?.statusTag).toBe('objective');
  });
});
