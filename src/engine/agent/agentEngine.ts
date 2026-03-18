/**
 * 선수 에이전트 엔진
 * - 에이전트 조회/자동 생성
 * - 에이전트 협상 (계약 갱신 시)
 * - 에이전트가 타팀 제안을 가져옴
 */

import { getDatabase } from '../../db/database';
import { calculateFairSalary, calculatePlayerValue } from '../economy/transferEngine';
import type { Player } from '../../types/player';
import type { PlayerAgent, AgentNegotiationResult, AgentBringOfferResult } from '../../types/agent';

// ─────────────────────────────────────────
// 에이전트 이름 풀
// ─────────────────────────────────────────

const AGENT_NAMES_KR = [
  '김성훈', '박재원', '이동건', '최민수', '정우진',
  '강현석', '윤태호', '한승우', '임지훈', '오세진',
];

const AGENT_NAMES_CN = [
  'Wang Lei', 'Zhang Wei', 'Li Qiang', 'Chen Ming', 'Liu Yang',
  'Zhao Jun', 'Huang Tao', 'Zhou Peng', 'Wu Gang', 'Xu Hao',
];

const AGENT_NAMES_EU = [
  'Marcus Weber', 'Thomas Müller', 'Jean-Pierre Blanc', 'Alessandro Rossi', 'Erik Lindqvist',
  'Henrik Olsen', 'Pierre Dubois', 'Luca Bianchi', 'Stefan Novak', 'Filip Johansson',
];

const AGENT_NAMES_NA = [
  'Michael Johnson', 'David Williams', 'James Anderson', 'Robert Martinez', 'William Thompson',
  'Christopher Davis', 'Daniel Wilson', 'Matthew Taylor', 'Anthony Brown', 'Joshua Garcia',
];

const ALL_AGENT_NAMES = [
  ...AGENT_NAMES_KR,
  ...AGENT_NAMES_CN,
  ...AGENT_NAMES_EU,
  ...AGENT_NAMES_NA,
];

// ─────────────────────────────────────────
// DB 매핑
// ─────────────────────────────────────────

interface AgentRow {
  id: number;
  player_id: string;
  agent_name: string;
  greed_level: number;
  loyalty_to_player: number;
}

const mapRowToAgent = (row: AgentRow): PlayerAgent => ({
  id: row.id,
  playerId: row.player_id,
  agentName: row.agent_name,
  greedLevel: row.greed_level,
  loyaltyToPlayer: row.loyalty_to_player,
});

// ─────────────────────────────────────────
// 에이전트 조회 / 자동 생성
// ─────────────────────────────────────────

/**
 * 에이전트 조회 (없으면 자동 생성)
 */
export async function getPlayerAgent(playerId: string): Promise<PlayerAgent> {
  const db = await getDatabase();

  const rows = await db.select<AgentRow[]>(
    'SELECT * FROM player_agents WHERE player_id = $1',
    [playerId],
  );

  if (rows.length > 0) {
    return mapRowToAgent(rows[0]);
  }

  // 자동 생성
  const agentName = ALL_AGENT_NAMES[Math.floor(Math.random() * ALL_AGENT_NAMES.length)];
  const greedLevel = Math.floor(Math.random() * 7) + 2; // 2~8
  const loyaltyToPlayer = Math.floor(Math.random() * 5) + 5; // 5~9

  const result = await db.execute(
    `INSERT INTO player_agents (player_id, agent_name, greed_level, loyalty_to_player)
     VALUES ($1, $2, $3, $4)`,
    [playerId, agentName, greedLevel, loyaltyToPlayer],
  );

  return {
    id: result.lastInsertId,
    playerId,
    agentName,
    greedLevel,
    loyaltyToPlayer,
  };
}

// ─────────────────────────────────────────
// 에이전트 협상
// ─────────────────────────────────────────

/**
 * 에이전트 협상 — 계약 갱신/이적 시 호출
 * - greed 높음: 요구 연봉 = 적정연봉 * 1.3~1.5
 * - greed 낮음: 요구 연봉 = 적정연봉 * 1.0~1.1
 * - 거절 확률: (요구연봉 - 제안연봉) / 요구연봉 * 100%
 */
export async function agentNegotiate(
  playerId: string,
  offeredSalary: number,
  marketValue: number,
): Promise<AgentNegotiationResult> {
  const agent = await getPlayerAgent(playerId);
  const fairSalary = Math.max(marketValue, 300); // 최소 300만

  // greed에 따른 요구 연봉 배수
  // greed 1~3: 1.0~1.1
  // greed 4~6: 1.1~1.3
  // greed 7~10: 1.3~1.5
  let multiplierMin: number;
  let multiplierMax: number;

  if (agent.greedLevel <= 3) {
    multiplierMin = 1.0;
    multiplierMax = 1.1;
  } else if (agent.greedLevel <= 6) {
    multiplierMin = 1.1;
    multiplierMax = 1.3;
  } else {
    multiplierMin = 1.3;
    multiplierMax = 1.5;
  }

  const multiplier = multiplierMin + Math.random() * (multiplierMax - multiplierMin);
  const counterOffer = Math.round(fairSalary * multiplier);

  // 거절 확률: (요구연봉 - 제안연봉) / 요구연봉
  // 제안이 요구 이상이면 무조건 수락
  if (offeredSalary >= counterOffer) {
    return {
      accepted: true,
      counterOffer,
      message: `에이전트 ${agent.agentName}: 좋은 제안입니다. 수락하겠습니다.`,
    };
  }

  const rejectRate = Math.max(0, (counterOffer - offeredSalary) / counterOffer);
  const roll = Math.random();

  if (roll >= rejectRate) {
    // 수락 (제안이 요구보다 낮지만 운 좋게 수락)
    return {
      accepted: true,
      counterOffer,
      message: `에이전트 ${agent.agentName}: 기대보다 낮지만... 선수와 협의 결과 수락하겠습니다.`,
    };
  }

  // 거절
  return {
    accepted: false,
    counterOffer,
    message: `에이전트 ${agent.agentName}: 제 의뢰인은 최소 ${counterOffer.toLocaleString()}만 원 이상의 연봉을 기대하고 있습니다.`,
  };
}

// ─────────────────────────────────────────
// 에이전트가 타팀 제안을 가져옴
// ─────────────────────────────────────────

/** 선수 OVR 계산 */
function getPlayerOverall(player: Player): number {
  const s = player.stats;
  return (s.mechanical + s.gameSense + s.teamwork + s.consistency + s.laning + s.aggression) / 6;
}

/**
 * 에이전트가 타팀 제안을 가져올 확률 체크
 * - OVR 75+ & reputation 높은 팀에서 20% 확률/시즌
 * - 시즌 중 주 1회 호출 가정 (약 18주 기준, 주당 ~1.2% 확률)
 */
export async function agentBringOffer(
  playerId: string,
  player: Player,
  currentTeamId: string,
): Promise<AgentBringOfferResult> {
  const ovr = getPlayerOverall(player);

  // OVR 75 미만이면 타팀 관심 없음
  if (ovr < 75) {
    return { hasOffer: false, message: '' };
  }

  const agent = await getPlayerAgent(playerId);
  const db = await getDatabase();

  // 주당 확률: 시즌 20% / 18주 ≈ 1.2% per week
  // loyalty가 높으면 확률 감소 (선수 잔류 우선)
  const weeklyRate = 0.012 * (1 - (agent.loyaltyToPlayer - 5) * 0.05);
  if (Math.random() >= weeklyRate) {
    return { hasOffer: false, message: '' };
  }

  // reputation 높은 팀 중 현재 팀 제외
  const teams = await db.select<{ id: string; name: string; reputation: number }[]>(
    'SELECT id, name, reputation FROM teams WHERE id != $1 ORDER BY reputation DESC LIMIT 5',
    [currentTeamId],
  );

  if (teams.length === 0) {
    return { hasOffer: false, message: '' };
  }

  // reputation 가장 높은 팀 선택
  const offeringTeam = teams[Math.floor(Math.random() * Math.min(3, teams.length))];

  // 적정연봉 * 1.2~1.5 제안
  const fairSalary = calculateFairSalary(player);
  const offerMultiplier = 1.2 + Math.random() * 0.3;
  const offeredSalary = Math.round(fairSalary * offerMultiplier);

  return {
    hasOffer: true,
    fromTeamId: offeringTeam.id,
    fromTeamName: offeringTeam.name,
    offeredSalary,
    message: `에이전트 ${agent.agentName}: ${offeringTeam.name}에서 ${player.name} 선수에게 연봉 ${offeredSalary.toLocaleString()}만 원을 제안했습니다.`,
  };
}
