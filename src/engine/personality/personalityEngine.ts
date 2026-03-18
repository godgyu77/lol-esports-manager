/**
 * 선수 성격 엔진
 * - 성격 생성/조회
 * - 성격이 게임에 미치는 효과 계산
 */

import { getDatabase } from '../../db/database';
import type { PlayerPersonality } from '../../types/personality';

interface PersonalityRow {
  player_id: string;
  ambition: number;
  loyalty: number;
  professionalism: number;
  temperament: number;
  determination: number;
}

function mapRow(r: PersonalityRow): PlayerPersonality {
  return {
    playerId: r.player_id,
    ambition: r.ambition,
    loyalty: r.loyalty,
    professionalism: r.professionalism,
    temperament: r.temperament,
    determination: r.determination,
  };
}

export async function getPlayerPersonality(playerId: string): Promise<PlayerPersonality> {
  const db = await getDatabase();
  const rows = await db.select<PersonalityRow[]>(
    'SELECT * FROM player_personality WHERE player_id = $1',
    [playerId],
  );
  if (rows.length > 0) return mapRow(rows[0]);
  return generatePersonality(playerId);
}

export async function generatePersonality(playerId: string): Promise<PlayerPersonality> {
  const db = await getDatabase();

  // 나이에 따른 경향
  const playerRows = await db.select<{ age: number }[]>(
    'SELECT age FROM players WHERE id = $1',
    [playerId],
  );
  const age = playerRows[0]?.age ?? 22;

  const rand = () => Math.floor(Math.random() * 7) + 2; // 2~8 기본

  let ambition = rand();
  let loyalty = rand();
  let professionalism = rand();
  let temperament = rand();
  let determination = rand();

  // 나이별 보정
  if (age <= 20) { ambition += 2; loyalty -= 1; }
  if (age >= 27) { professionalism += 2; temperament += 1; loyalty += 1; ambition -= 1; }

  const clamp = (v: number) => Math.max(1, Math.min(10, v));
  ambition = clamp(ambition);
  loyalty = clamp(loyalty);
  professionalism = clamp(professionalism);
  temperament = clamp(temperament);
  determination = clamp(determination);

  await db.execute(
    `INSERT OR REPLACE INTO player_personality (player_id, ambition, loyalty, professionalism, temperament, determination)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [playerId, ambition, loyalty, professionalism, temperament, determination],
  );

  return { playerId, ambition, loyalty, professionalism, temperament, determination };
}

export interface PersonalityEffects {
  transferRequestMultiplier: number;  // 이적 요청 확률 배율
  renewalAcceptBonus: number;         // 계약 갱신 수락 확률 보정 (%)
  trainingEfficiencyBonus: number;    // 훈련 효율 보정 (%)
  teamTalkSensitivity: number;        // 팀 토크 반응 배율
  injuryRecoveryBonus: number;        // 부상 결장 일수 보정 (%)
}

export function getPersonalityEffects(p: PlayerPersonality): PersonalityEffects {
  return {
    transferRequestMultiplier: p.ambition >= 8 ? 2.0 : p.ambition >= 6 ? 1.2 : 0.8,
    renewalAcceptBonus: p.loyalty >= 8 ? 20 : p.loyalty >= 5 ? 0 : -15,
    trainingEfficiencyBonus: p.professionalism >= 8 ? 10 : p.professionalism >= 5 ? 0 : -5,
    teamTalkSensitivity: p.temperament <= 3 ? 2.0 : p.temperament >= 8 ? 0.7 : 1.0,
    injuryRecoveryBonus: p.determination >= 8 ? -20 : p.determination >= 5 ? 0 : 10,
  };
}
