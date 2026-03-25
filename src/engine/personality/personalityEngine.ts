/**
 * 선수 성격 엔진
 * - 성격 생성/조회
 * - 성격이 게임에 미치는 효과 계산
 */

import { getDatabase } from '../../db/database';
import { getPlayersByTeamId } from '../../db/queries';
import { nextRandom, pickRandom, randomInt } from '../../utils/random';
import type { PlayerPersonality } from '../../types/personality';
import type { TalkTone } from '../../types/teamTalk';

// ─────────────────────────────────────────
// 갈등 시스템 타입 정의
// ─────────────────────────────────────────

export interface ConflictEvent {
  playerAId: string;
  playerBId: string;
  playerAName: string;
  playerBName: string;
  severity: 'minor' | 'major' | 'critical';
  description: string;
  moraleImpact: number;
}

export interface LockerRoomMood {
  teamId: string;
  mood: 'excellent' | 'good' | 'neutral' | 'tense' | 'toxic';
  conflictCount: number;
  averageCompatibility: number;
}

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

  const rand = () => randomInt(2, 8); // 2~8 기본

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
  /** 팀 토크 톤별 반응 배율 — 성격에 따라 동기부여/비판 등에 다르게 반응 */
  teamTalkResponseMultiplier: Record<TalkTone, number>;
  /** 불만 표출 빈도 배율 — 야망↑ + 충성심↓ = 불만 빈번 */
  complaintFrequencyMultiplier: number;
  /** 클러치 퍼포먼스 보너스 (%) — 플레이오프 경기 시 적용 */
  clutchPerformanceBonus: number;
  /** 훈련 규율 보너스 (%) — 프로의식 기반 훈련 효율 추가 보정 */
  trainingDisciplineBonus: number;
  /** 압박 저항력 (0~1) — 고스테이크 경기(결승/월즈)에서의 퍼포먼스 유지율 */
  pressureResistance: number;
}

export function getPersonalityEffects(p: PlayerPersonality): PersonalityEffects {
  // 팀 토크 톤별 반응 배율 계산
  const teamTalkResponseMultiplier: Record<TalkTone, number> = {
    motivate: p.determination >= 7 ? 1.5 : p.determination >= 4 ? 1.0 : 0.7,
    calm: p.temperament >= 7 ? 1.3 : 1.0,
    warn: p.temperament >= 7 ? 1.2 : p.temperament <= 3 ? 0.5 : 0.8,
    praise: p.ambition >= 7 ? 1.4 : 1.0,
    criticize: p.temperament <= 3 ? 0.3 : p.temperament <= 5 ? 0.7 : 1.2,
    neutral: 1.0,
  };

  // 불만 빈도: 야망↑ + 충성심↓ = 불만 많음
  const ambitionFactor = p.ambition / 10;
  const loyaltyFactor = (10 - p.loyalty) / 10;
  const complaintFrequencyMultiplier = 0.5 + (ambitionFactor + loyaltyFactor);

  // 클러치 퍼포먼스: 결단력 + 프로의식 기반
  const clutchBase = (p.determination + p.professionalism) / 2;
  const clutchPerformanceBonus = clutchBase >= 8 ? 8 : clutchBase >= 6 ? 4 : clutchBase >= 4 ? 0 : -4;

  // 훈련 규율: 프로의식 직접 반영
  const trainingDisciplineBonus = (p.professionalism - 5) * 3; // -12 ~ +15

  // 압박 저항력: 기질(침착) + 결단력(극복) + 프로의식(준비)
  const pressureRaw = (p.temperament * 0.4 + p.determination * 0.35 + p.professionalism * 0.25) / 10;
  const pressureResistance = Math.max(0, Math.min(1, pressureRaw));

  return {
    transferRequestMultiplier: p.ambition >= 8 ? 2.0 : p.ambition >= 6 ? 1.2 : 0.8,
    renewalAcceptBonus: p.loyalty >= 8 ? 20 : p.loyalty >= 5 ? 0 : -15,
    trainingEfficiencyBonus: p.professionalism >= 8 ? 10 : p.professionalism >= 5 ? 0 : -5,
    teamTalkSensitivity: p.temperament <= 3 ? 2.0 : p.temperament >= 8 ? 0.7 : 1.0,
    injuryRecoveryBonus: p.determination >= 8 ? -20 : p.determination >= 5 ? 0 : 10,
    teamTalkResponseMultiplier,
    complaintFrequencyMultiplier,
    clutchPerformanceBonus,
    trainingDisciplineBonus,
    pressureResistance,
  };
}

/**
 * 두 선수 간 성격 호환성 점수 계산
 * @returns -10 ~ +10 호환성 점수
 *   - 유사한 프로의식/결단력 → 호환성 증가
 *   - 기질 차이 큰 경우 → 충돌 가능성 (감소)
 *   - 충성심이 둘 다 높으면 → 팀 결속 보너스
 */
export function calculatePersonalityCompatibility(
  a: PlayerPersonality,
  b: PlayerPersonality,
): number {
  let score = 0;

  // 프로의식 유사도: 차이 적을수록 호환 (+3 max)
  const profDiff = Math.abs(a.professionalism - b.professionalism);
  score += profDiff <= 2 ? 3 : profDiff <= 4 ? 1 : -1;

  // 결단력 유사도: 차이 적을수록 호환 (+2 max)
  const detDiff = Math.abs(a.determination - b.determination);
  score += detDiff <= 2 ? 2 : detDiff <= 4 ? 0 : -1;

  // 기질 충돌: 둘 다 낮으면(폭발적) 갈등, 하나만 높으면 안정화
  if (a.temperament <= 3 && b.temperament <= 3) {
    score -= 3; // 양쪽 모두 과격 → 충돌
  } else if (a.temperament >= 7 && b.temperament >= 7) {
    score += 2; // 양쪽 모두 침착 → 안정
  } else if (Math.abs(a.temperament - b.temperament) >= 5) {
    score -= 1; // 극단적 차이 → 약간 불화
  }

  // 충성심 시너지: 둘 다 높으면 팀 결속
  if (a.loyalty >= 7 && b.loyalty >= 7) {
    score += 2;
  }

  // 야망 충돌: 둘 다 높으면 경쟁 (약간 부정적)
  if (a.ambition >= 8 && b.ambition >= 8) {
    score -= 2;
  }

  return Math.max(-10, Math.min(10, score));
}

// ─────────────────────────────────────────
// 갈등 시스템
// ─────────────────────────────────────────

const CONFLICT_DESCRIPTIONS: Record<ConflictEvent['severity'], string[]> = {
  minor: [
    '훈련 중 의견 충돌이 있었습니다.',
    '게임 내 호출 방식을 두고 언쟁이 있었습니다.',
    '팀 미팅에서 냉랭한 분위기가 감지됐습니다.',
  ],
  major: [
    '라인전 운영을 둘러싸고 격한 다툼이 벌어졌습니다.',
    '스크림 후 공개적으로 서로를 비난했습니다.',
    '팀 내 파벌이 형성될 조짐이 보입니다.',
  ],
  critical: [
    '팀 분위기가 극도로 악화되어 코칭 스태프가 중재에 나섰습니다.',
    '심각한 갈등으로 팀 연습이 중단됐습니다.',
    '선수 간 심각한 마찰로 팀 운영에 차질이 생겼습니다.',
  ],
};

function determineSeverity(compatibility: number): ConflictEvent['severity'] {
  if (compatibility <= -10) return 'critical';
  if (compatibility <= -7) return 'major';
  return 'minor';
}

function getMoraleImpact(severity: ConflictEvent['severity']): number {
  switch (severity) {
    case 'minor': return -2;
    case 'major': return -5;
    case 'critical': return -8;
  }
}

/**
 * 팀 내 성격 갈등 체크
 * - 주전 선수 쌍 중 호환성 -5 이하인 쌍에 대해 30% 확률로 갈등 이벤트 생성
 * - 갈등 발생 시 player_complaints 테이블에 기록, 사기 감소 적용
 */
export async function checkTeamConflicts(teamId: string): Promise<ConflictEvent[]> {
  const db = await getDatabase();
  const allPlayers = await getPlayersByTeamId(teamId);
  const mainPlayers = allPlayers.filter(p => p.division === 'main');

  if (mainPlayers.length < 2) return [];

  // 현재 시즌/날짜 조회
  const seasonRows = await db.select<{ id: number }[]>(
    'SELECT id FROM seasons WHERE is_active = 1 LIMIT 1',
  );
  const seasonId = seasonRows[0]?.id ?? 1;
  const currentDate = new Date().toISOString().slice(0, 10);

  // 모든 주전 선수의 성격 조회
  const personalities = await Promise.all(
    mainPlayers.map(p => getPlayerPersonality(p.id)),
  );

  const conflicts: ConflictEvent[] = [];

  // 모든 쌍 비교
  for (let i = 0; i < personalities.length; i++) {
    for (let j = i + 1; j < personalities.length; j++) {
      const compatibility = calculatePersonalityCompatibility(personalities[i], personalities[j]);

      if (compatibility > -5) continue;

      // 30% 확률로 갈등 발생
      if (nextRandom() > 0.3) continue;

      const severity = determineSeverity(compatibility);
      const moraleImpact = getMoraleImpact(severity);
      const description = pickRandom(CONFLICT_DESCRIPTIONS[severity]);

      const playerA = mainPlayers[i];
      const playerB = mainPlayers[j];

      const conflict: ConflictEvent = {
        playerAId: playerA.id,
        playerBId: playerB.id,
        playerAName: playerA.name,
        playerBName: playerB.name,
        severity,
        description,
        moraleImpact,
      };

      conflicts.push(conflict);

      // DB에 갈등 기록 (양측 모두)
      const severityNum = severity === 'minor' ? 1 : severity === 'major' ? 2 : 3;
      const message = `${playerA.name}와(과) ${playerB.name} 간 갈등: ${description}`;

      await db.execute(
        `INSERT INTO player_complaints (player_id, team_id, season_id, complaint_type, severity, message, status, created_date, morale_impact)
         VALUES ($1, $2, $3, 'conflict', $4, $5, 'active', $6, $7)`,
        [playerA.id, teamId, seasonId, severityNum, message, currentDate, moraleImpact],
      );

      await db.execute(
        `INSERT INTO player_complaints (player_id, team_id, season_id, complaint_type, severity, message, status, created_date, morale_impact)
         VALUES ($1, $2, $3, 'conflict', $4, $5, 'active', $6, $7)`,
        [playerB.id, teamId, seasonId, severityNum, message, currentDate, moraleImpact],
      );

      // 사기 감소 적용
      await db.execute(
        'UPDATE players SET morale = MAX(0, morale + $1) WHERE id = $2',
        [moraleImpact, playerA.id],
      );
      await db.execute(
        'UPDATE players SET morale = MAX(0, morale + $1) WHERE id = $2',
        [moraleImpact, playerB.id],
      );
    }
  }

  return conflicts;
}

/**
 * 갈등 해결 시도
 * - team_talk: 성공률 50%, 성공 시 양측 사기 +3
 * - mentoring: 성공률 60%, 성공 시 양측 케미 +5
 * - mediation: 성공률 70%, 성공 시 양측 사기 +2, 케미 +3
 * - 실패 시 사기 추가 -2
 */
export async function resolveConflict(
  conflictId: number,
  method: 'team_talk' | 'mentoring' | 'mediation',
): Promise<{ success: boolean; message: string }> {
  const db = await getDatabase();

  // 갈등 레코드 조회
  const rows = await db.select<{
    id: number;
    player_id: string;
    team_id: string;
    status: string;
  }[]>(
    `SELECT id, player_id, team_id, status FROM player_complaints
     WHERE id = $1 AND complaint_type = 'conflict'`,
    [conflictId],
  );

  if (rows.length === 0) {
    return { success: false, message: '해당 갈등을 찾을 수 없습니다.' };
  }

  if (rows[0].status !== 'active') {
    return { success: false, message: '이미 처리된 갈등입니다.' };
  }

  const playerId = rows[0].player_id;
  const teamId = rows[0].team_id;

  // 같은 갈등의 상대 선수 레코드 찾기 (같은 팀, conflict 타입, active, 비슷한 시기)
  const pairRows = await db.select<{ id: number; player_id: string }[]>(
    `SELECT id, player_id FROM player_complaints
     WHERE team_id = $1 AND complaint_type = 'conflict' AND status = 'active'
       AND player_id != $2 AND id != $3
     ORDER BY ABS(id - $3) ASC LIMIT 1`,
    [teamId, playerId, conflictId],
  );

  const pairedPlayerId = pairRows[0]?.player_id;
  const pairedComplaintId = pairRows[0]?.id;

  // 성공률/효과 결정
  const config = {
    team_talk: { successRate: 0.5, moraleBonus: 3, chemistryBonus: 0, label: '팀 토크' },
    mentoring: { successRate: 0.6, moraleBonus: 0, chemistryBonus: 5, label: '멘토링' },
    mediation: { successRate: 0.7, moraleBonus: 2, chemistryBonus: 3, label: '중재' },
  }[method];

  const isSuccess = nextRandom() < config.successRate;
  const resolvedDate = new Date().toISOString().slice(0, 10);

  if (isSuccess) {
    // 갈등 해결 처리
    await db.execute(
      `UPDATE player_complaints SET status = 'resolved', resolved_date = $1, resolution = $2
       WHERE id = $3`,
      [resolvedDate, `${config.label}(으)로 해결`, conflictId],
    );

    if (pairedComplaintId) {
      await db.execute(
        `UPDATE player_complaints SET status = 'resolved', resolved_date = $1, resolution = $2
         WHERE id = $3`,
        [resolvedDate, `${config.label}(으)로 해결`, pairedComplaintId],
      );
    }

    // 사기 보너스 적용
    if (config.moraleBonus > 0) {
      await db.execute(
        'UPDATE players SET morale = MIN(100, morale + $1) WHERE id = $2',
        [config.moraleBonus, playerId],
      );
      if (pairedPlayerId) {
        await db.execute(
          'UPDATE players SET morale = MIN(100, morale + $1) WHERE id = $2',
          [config.moraleBonus, pairedPlayerId],
        );
      }
    }

    // 케미스트리 보너스 적용
    if (config.chemistryBonus > 0 && pairedPlayerId) {
      const [idA, idB] = [playerId, pairedPlayerId].sort();
      await db.execute(
        `INSERT INTO player_chemistry (player_a_id, player_b_id, chemistry_score)
         VALUES ($1, $2, $3)
         ON CONFLICT(player_a_id, player_b_id) DO UPDATE SET
           chemistry_score = MIN(100, chemistry_score + $4)`,
        [idA, idB, 50 + config.chemistryBonus, config.chemistryBonus],
      );
    }

    return {
      success: true,
      message: `${config.label}(으)로 갈등이 해결되었습니다.`,
    };
  }

  // 실패: 사기 추가 감소
  await db.execute(
    'UPDATE players SET morale = MAX(0, morale - 2) WHERE id = $1',
    [playerId],
  );
  if (pairedPlayerId) {
    await db.execute(
      'UPDATE players SET morale = MAX(0, morale - 2) WHERE id = $1',
      [pairedPlayerId],
    );
  }

  return {
    success: false,
    message: `${config.label} 시도가 실패하여 갈등이 악화되었습니다.`,
  };
}

/**
 * 팀 라커룸 분위기 조회
 * - 활성 갈등 수 + 주전 선수 간 평균 호환성 기반 판정
 */
export async function getTeamLockerRoomMood(teamId: string): Promise<LockerRoomMood> {
  const db = await getDatabase();

  // 활성 갈등 수 조회 (conflict 타입, 선수별 레코드이므로 2로 나눠 쌍 단위로 계산)
  const conflictRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM player_complaints
     WHERE team_id = $1 AND complaint_type = 'conflict' AND status = 'active'`,
    [teamId],
  );
  const rawConflictCount = conflictRows[0]?.cnt ?? 0;
  const conflictCount = Math.ceil(rawConflictCount / 2); // 쌍 단위

  // 주전 선수 간 평균 호환성 계산
  const allPlayers = await getPlayersByTeamId(teamId);
  const mainPlayers = allPlayers.filter(p => p.division === 'main');

  let totalCompatibility = 0;
  let pairCount = 0;

  if (mainPlayers.length >= 2) {
    const personalities = await Promise.all(
      mainPlayers.map(p => getPlayerPersonality(p.id)),
    );

    for (let i = 0; i < personalities.length; i++) {
      for (let j = i + 1; j < personalities.length; j++) {
        totalCompatibility += calculatePersonalityCompatibility(personalities[i], personalities[j]);
        pairCount++;
      }
    }
  }

  const averageCompatibility = pairCount > 0
    ? Math.round((totalCompatibility / pairCount) * 100) / 100
    : 0;

  // 분위기 판정
  let mood: LockerRoomMood['mood'];
  if (conflictCount >= 5 || averageCompatibility <= -3) {
    mood = 'toxic';
  } else if (conflictCount >= 3) {
    mood = 'tense';
  } else if (conflictCount >= 1 && conflictCount <= 2) {
    mood = 'neutral';
  } else if (conflictCount <= 1 && averageCompatibility < 5) {
    mood = 'good';
  } else {
    mood = 'excellent';
  }

  return { teamId, mood, conflictCount, averageCompatibility };
}
