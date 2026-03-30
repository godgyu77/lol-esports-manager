import type { Region } from '../../types/game';

export function drawFSTBracket(
  participants: { teamId: string; region: Region }[],
): [string, string][] {
  const teams = [...participants];
  const bracket: [string, string][] = [];
  const used = new Set<number>();

  for (let i = 0; i < teams.length; i++) {
    if (used.has(i)) continue;

    let opponentIdx = -1;
    for (let j = teams.length - 1; j > i; j--) {
      if (used.has(j)) continue;
      if (teams[j].region !== teams[i].region) {
        opponentIdx = j;
        break;
      }
    }

    if (opponentIdx === -1) {
      for (let j = teams.length - 1; j > i; j--) {
        if (!used.has(j)) {
          opponentIdx = j;
          break;
        }
      }
    }

    if (opponentIdx === -1) break;

    bracket.push([teams[i].teamId, teams[opponentIdx].teamId]);
    used.add(i);
    used.add(opponentIdx);
  }

  return bracket;
}

export function buildSeededQuarterfinalPairs(teamIds: string[]): [string, string][] {
  const seedPairs: [number, number][] = [[0, 7], [1, 6], [2, 5], [3, 4]];
  return seedPairs.map(([homeIdx, awayIdx]) => [teamIds[homeIdx] ?? 'TBD', teamIds[awayIdx] ?? 'TBD']);
}
