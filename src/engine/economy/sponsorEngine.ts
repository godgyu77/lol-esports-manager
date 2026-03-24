/**
 * 스폰서 엔진 — 개별 스폰서 계약 관리
 * - 팀 명성 기반 스폰서 제안 생성
 * - 스폰서 계약 수락/거절
 * - 주간 스폰서 수입 계산 (financeEngine과 연동)
 */

import {
  getActiveSponsors,
  insertSponsor,
  updateSponsorStatus,
  insertFinanceLog,
  type Sponsor,
} from '../../db/queries';
import { getDatabase } from '../../db/database';
import { addDays } from '../season/calendar';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

/** 스폰서 티어 */
export type SponsorTier = 'platinum' | 'gold' | 'silver' | 'bronze';

/** 스폰서 제안 (아직 DB에 저장되지 않은 상태) */
export interface SponsorOffer {
  name: string;
  tier: SponsorTier;
  weeklyPayout: number;        // 주간 수입 (만 원)
  durationWeeks: number;       // 계약 기간 (주)
  requiredMinReputation: number; // 최소 명성 요구치
  description: string;         // 스폰서 설명
}

// ─────────────────────────────────────────
// 스폰서 풀 (사전 정의)
// ─────────────────────────────────────────

/** LoL 생태계에 맞는 스폰서 풀 */
const SPONSOR_POOL: SponsorOffer[] = [
  // 플래티넘 티어 — 대기업/글로벌 브랜드
  { name: 'HyperX', tier: 'platinum', weeklyPayout: 350, durationWeeks: 24, requiredMinReputation: 75, description: '게이밍 주변기기 스폰서십' },
  { name: 'SK텔레콤', tier: 'platinum', weeklyPayout: 400, durationWeeks: 24, requiredMinReputation: 80, description: '통신사 메인 스폰서십' },
  { name: '삼성전자', tier: 'platinum', weeklyPayout: 380, durationWeeks: 24, requiredMinReputation: 80, description: '모니터 및 SSD 스폰서십' },
  { name: 'Red Bull', tier: 'platinum', weeklyPayout: 320, durationWeeks: 24, requiredMinReputation: 70, description: '에너지 드링크 스폰서십' },
  { name: 'Nike', tier: 'platinum', weeklyPayout: 360, durationWeeks: 24, requiredMinReputation: 85, description: '팀 유니폼 스폰서십' },

  // 골드 티어 — 게이밍/IT 브랜드
  { name: 'Razer', tier: 'gold', weeklyPayout: 200, durationWeeks: 20, requiredMinReputation: 55, description: '게이밍 장비 스폰서십' },
  { name: 'LG전자', tier: 'gold', weeklyPayout: 220, durationWeeks: 20, requiredMinReputation: 60, description: '게이밍 모니터 스폰서십' },
  { name: '배달의민족', tier: 'gold', weeklyPayout: 180, durationWeeks: 18, requiredMinReputation: 50, description: '팀 식사 및 광고 스폰서십' },
  { name: 'Logitech', tier: 'gold', weeklyPayout: 190, durationWeeks: 20, requiredMinReputation: 55, description: '게이밍 마우스/키보드 스폰서십' },
  { name: '쿠팡', tier: 'gold', weeklyPayout: 210, durationWeeks: 18, requiredMinReputation: 60, description: 'e커머스 파트너십' },

  // 실버 티어 — 중소 브랜드
  { name: 'SteelSeries', tier: 'silver', weeklyPayout: 120, durationWeeks: 16, requiredMinReputation: 35, description: '게이밍 헤드셋 스폰서십' },
  { name: '핫식스', tier: 'silver', weeklyPayout: 100, durationWeeks: 16, requiredMinReputation: 30, description: '에너지 드링크 스폰서십' },
  { name: 'MSI', tier: 'silver', weeklyPayout: 110, durationWeeks: 16, requiredMinReputation: 35, description: '게이밍 노트북 스폰서십' },
  { name: '컴투스', tier: 'silver', weeklyPayout: 130, durationWeeks: 14, requiredMinReputation: 40, description: '게임사 파트너십' },
  { name: 'ASUS ROG', tier: 'silver', weeklyPayout: 140, durationWeeks: 16, requiredMinReputation: 40, description: '게이밍 PC 스폰서십' },

  // 브론즈 티어 — 소규모 스폰서
  { name: 'DXRacer', tier: 'bronze', weeklyPayout: 60, durationWeeks: 12, requiredMinReputation: 15, description: '게이밍 의자 스폰서십' },
  { name: '제닉스', tier: 'bronze', weeklyPayout: 50, durationWeeks: 12, requiredMinReputation: 10, description: '게이밍 장패드 스폰서십' },
  { name: 'BenQ', tier: 'bronze', weeklyPayout: 70, durationWeeks: 12, requiredMinReputation: 20, description: '모니터 스폰서십' },
  { name: '맥심', tier: 'bronze', weeklyPayout: 45, durationWeeks: 10, requiredMinReputation: 10, description: '커피 스폰서십' },
  { name: 'Secretlab', tier: 'bronze', weeklyPayout: 55, durationWeeks: 12, requiredMinReputation: 15, description: '게이밍 의자 스폰서십' },
];

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

/** 배열에서 랜덤 N개 선택 */
function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/** 명성에 따라 제안 수 결정 (2~4개) */
function getOfferCount(reputation: number): number {
  if (reputation >= 70) return 4;
  if (reputation >= 40) return 3;
  return 2;
}

// ─────────────────────────────────────────
// 공개 함수
// ─────────────────────────────────────────

/**
 * 팀 명성 기반으로 스폰서 제안 생성
 * - 현재 활성 스폰서와 중복되지 않는 제안만 생성
 */
export function generateSponsorOffers(
  reputation: number,
  activeNames: string[] = [],
): SponsorOffer[] {
  // 명성 조건 충족 + 현재 활성 스폰서와 중복 제외
  const eligible = SPONSOR_POOL.filter(
    (s) => reputation >= s.requiredMinReputation && !activeNames.includes(s.name),
  );

  if (eligible.length === 0) return [];

  const count = getOfferCount(reputation);
  return pickRandom(eligible, Math.min(count, eligible.length));
}

/**
 * 스폰서 계약 수락
 * - sponsors 테이블에 저장
 * - 팀 budget에 즉시 영향 없음 (주간 정산 시 처리)
 */
export async function acceptSponsor(
  teamId: string,
  seasonId: number,
  offer: SponsorOffer,
  currentDate: string,
): Promise<Sponsor> {
  // [W16] 종료일 계산 — calendar.ts의 addDays를 사용하여 타임존 혼용 방지
  // new Date() + toISOString()는 UTC 기준이라 로컬 날짜와 불일치 발생
  const endDate = addDays(currentDate, offer.durationWeeks * 7);

  const id = await insertSponsor({
    seasonId,
    teamId,
    name: offer.name,
    tier: offer.tier,
    weeklyPayout: offer.weeklyPayout,
    startDate: currentDate,
    endDate,
  });

  return {
    id,
    seasonId,
    teamId,
    name: offer.name,
    tier: offer.tier,
    weeklyPayout: offer.weeklyPayout,
    startDate: currentDate,
    endDate,
    status: 'active',
  };
}

/**
 * 활성 스폰서 주간 수입 처리
 * - processWeeklyFinances에서 호출
 * - 각 활성 스폰서별로 재정 로그 기록 + 예산 증가
 */
export async function processSponsorWeeklyIncome(
  teamId: string,
  seasonId: number,
  gameDate: string,
): Promise<number> {
  const sponsors = await getActiveSponsors(teamId, seasonId);
  if (sponsors.length === 0) return 0;

  const db = await getDatabase();
  let totalIncome = 0;

  for (const sponsor of sponsors) {
    // 만료 체크
    if (gameDate > sponsor.endDate) {
      await updateSponsorStatus(sponsor.id, 'expired');
      continue;
    }

    await insertFinanceLog(
      teamId,
      seasonId,
      gameDate,
      'income',
      'sponsorship',
      sponsor.weeklyPayout,
      `${sponsor.name} 스폰서 수입`,
    );

    await db.execute(
      'UPDATE teams SET budget = budget + $1 WHERE id = $2',
      [sponsor.weeklyPayout, teamId],
    );

    totalIncome += sponsor.weeklyPayout;
  }

  return totalIncome;
}

/**
 * 만료된 스폰서 일괄 처리 (시즌 날짜 기준)
 */
export async function expireSponsors(
  teamId: string,
  seasonId: number,
  currentDate: string,
): Promise<void> {
  const sponsors = await getActiveSponsors(teamId, seasonId);
  for (const sponsor of sponsors) {
    if (currentDate > sponsor.endDate) {
      await updateSponsorStatus(sponsor.id, 'expired');
    }
  }
}

// ─────────────────────────────────────────
// 스폰서 동적 변동 (주간 체크)
// ─────────────────────────────────────────

export interface SponsorChangeResult {
  newOffers: SponsorOffer[];
  lostSponsors: string[];   // 이탈한 스폰서 이름 목록
  majorOffer: SponsorOffer | null; // 시즌 우승 시 대형 스폰서
}

/**
 * 주간 스폰서 변동 체크
 * - 팀 reputation 80+ → 새 스폰서 제안 (10% 확률/주)
 * - 팀 reputation 30- → 기존 스폰서 이탈 (15% 확률/주)
 * - 시즌 우승 → 대형 스폰서 자동 제안
 */
export async function checkSponsorChanges(
  teamId: string,
  seasonId: number,
  _currentDate: string,
): Promise<SponsorChangeResult> {
  const db = await getDatabase();
  const result: SponsorChangeResult = { newOffers: [], lostSponsors: [], majorOffer: null };

  // 팀 reputation 조회
  const teamRows = await db.select<{ reputation: number }[]>(
    'SELECT reputation FROM teams WHERE id = $1',
    [teamId],
  );
  const reputation = teamRows[0]?.reputation ?? 50;

  // 현재 활성 스폰서 조회
  const activeSponsors = await getActiveSponsors(teamId, seasonId);
  const activeNames = activeSponsors.map(s => s.name);

  // 1) reputation 80+ → 새 스폰서 제안 (10% 확률)
  if (reputation >= 80 && Math.random() < 0.1) {
    const offers = generateSponsorOffers(reputation, activeNames);
    if (offers.length > 0) {
      // 1개만 제안
      result.newOffers.push(offers[0]);
    }
  }

  // 2) reputation 30 이하 → 기존 스폰서 이탈 (15% 확률)
  if (reputation <= 30) {
    for (const sponsor of activeSponsors) {
      if (Math.random() < 0.15) {
        await updateSponsorStatus(sponsor.id, 'cancelled');
        result.lostSponsors.push(sponsor.name);
      }
    }
  }

  // 3) 시즌 우승 체크 (직전 시즌 우승 여부)
  const championCheck = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM playoff_results
     WHERE season_id = $1 AND team_id = $2 AND final_rank = 1`,
    [seasonId - 1, teamId],
  );
  const isChampion = (championCheck[0]?.cnt ?? 0) > 0;

  if (isChampion) {
    // 대형 스폰서 자동 제안 (플래티넘 중 하나)
    const platinumOffers = SPONSOR_POOL.filter(
      s => s.tier === 'platinum' && !activeNames.includes(s.name),
    );
    if (platinumOffers.length > 0) {
      const majorOffer = platinumOffers[Math.floor(Math.random() * platinumOffers.length)];
      result.majorOffer = majorOffer;
      result.newOffers.push(majorOffer);
    }
  }

  // 새 스폰서 제안이 있으면 자동 수락 (AI 팀용 - 유저 팀은 UI에서 처리)
  // 여기서는 제안만 반환, dayAdvancer에서 이벤트로 알림

  return result;
}

/** 스폰서 티어 한국어 라벨 */
export const SPONSOR_TIER_LABELS: Record<SponsorTier, string> = {
  platinum: '플래티넘',
  gold: '골드',
  silver: '실버',
  bronze: '브론즈',
};

/** 스폰서 티어 색상 */
export const SPONSOR_TIER_COLORS: Record<SponsorTier, string> = {
  platinum: '#e5e4e2',
  gold: '#c89b3c',
  silver: '#a0a0b0',
  bronze: '#cd7f32',
};

// ─────────────────────────────────────────
// 조건부 스폰서 계약 시스템
// ─────────────────────────────────────────

/** 스폰서 계약 조건 유형 */
export type SponsorConditionType =
  | 'playoff_qualify'      // 플레이오프 진출
  | 'top_4_finish'         // 상위 4위 마감
  | 'championship_win'     // 우승
  | 'international_qualify' // 국제대회 진출
  | 'player_appearance'    // 특정 선수 출연 의무
  | 'social_media_post'    // 소셜 미디어 홍보
  | 'win_streak_3'         // 3연승 달성
  | 'viewership_target';   // 시청률 목표 달성

/** 스폰서 계약 조건 */
export interface SponsorCondition {
  type: SponsorConditionType;
  /** 조건 설명 */
  description: string;
  /** 조건 달성 시 보너스 (만 원) */
  bonusAmount: number;
  /** 미달성 시 페널티 (만 원, 양수) */
  penaltyAmount: number;
  /** 달성 여부 (null이면 미확인) */
  fulfilled: boolean | null;
}

/** 조건부 스폰서 제안 (확장) */
export interface ConditionalSponsorOffer extends SponsorOffer {
  /** 추가 조건 목록 */
  conditions: SponsorCondition[];
  /** 기본 주간 수입 (조건 미달성 시) */
  baseWeeklyPayout: number;
  /** 조건 달성 시 최대 주간 수입 */
  maxWeeklyPayout: number;
  /** 선수 출연 의무 (해당 시) */
  requiredPlayerAppearances?: number;
}

/** 조건 유형별 라벨 */
export const SPONSOR_CONDITION_LABELS: Record<SponsorConditionType, string> = {
  playoff_qualify: '플레이오프 진출',
  top_4_finish: '상위 4위 마감',
  championship_win: '우승',
  international_qualify: '국제대회 진출',
  player_appearance: '선수 홍보 출연',
  social_media_post: '소셜 미디어 홍보',
  win_streak_3: '3연승 달성',
  viewership_target: '시청률 목표',
};

/**
 * 조건부 스폰서 제안 생성
 * 기존 스폰서 제안에 성적 연동 보너스/페널티 추가
 */
export function generateConditionalSponsorOffer(
  baseOffer: SponsorOffer,
  teamReputation: number,
): ConditionalSponsorOffer {
  const conditions: SponsorCondition[] = [];
  const tierConditionCount: Record<SponsorTier, number> = {
    platinum: 3,
    gold: 2,
    silver: 1,
    bronze: 0,
  };

  const count = tierConditionCount[baseOffer.tier];

  // 티어에 따른 조건 풀
  const availableConditions: SponsorCondition[] = [];

  if (teamReputation >= 70) {
    availableConditions.push({
      type: 'championship_win',
      description: '시즌 우승 시 보너스',
      bonusAmount: Math.round(baseOffer.weeklyPayout * baseOffer.durationWeeks * 0.5),
      penaltyAmount: 0,
      fulfilled: null,
    });
  }

  if (teamReputation >= 55) {
    availableConditions.push({
      type: 'playoff_qualify',
      description: '플레이오프 진출 시 보너스',
      bonusAmount: Math.round(baseOffer.weeklyPayout * baseOffer.durationWeeks * 0.2),
      penaltyAmount: Math.round(baseOffer.weeklyPayout * baseOffer.durationWeeks * 0.1),
      fulfilled: null,
    });
  }

  availableConditions.push({
    type: 'top_4_finish',
    description: '상위 4위 마감 시 보너스',
    bonusAmount: Math.round(baseOffer.weeklyPayout * baseOffer.durationWeeks * 0.15),
    penaltyAmount: 0,
    fulfilled: null,
  });

  if (baseOffer.tier === 'platinum' || baseOffer.tier === 'gold') {
    availableConditions.push({
      type: 'player_appearance',
      description: '시즌 중 선수 홍보 출연 3회',
      bonusAmount: Math.round(baseOffer.weeklyPayout * 4),
      penaltyAmount: Math.round(baseOffer.weeklyPayout * 2),
      fulfilled: null,
    });
  }

  availableConditions.push({
    type: 'win_streak_3',
    description: '시즌 중 3연승 달성 시 보너스',
    bonusAmount: Math.round(baseOffer.weeklyPayout * 2),
    penaltyAmount: 0,
    fulfilled: null,
  });

  // 랜덤으로 조건 선택
  const shuffled = availableConditions.sort(() => Math.random() - 0.5);
  conditions.push(...shuffled.slice(0, count));

  // 최대 주간 수입 계산 (모든 조건 달성 시)
  const totalBonus = conditions.reduce((s, c) => s + c.bonusAmount, 0);
  const bonusPerWeek = baseOffer.durationWeeks > 0 ? totalBonus / baseOffer.durationWeeks : 0;
  const maxWeeklyPayout = baseOffer.weeklyPayout + Math.round(bonusPerWeek);

  return {
    ...baseOffer,
    conditions,
    baseWeeklyPayout: baseOffer.weeklyPayout,
    maxWeeklyPayout,
  };
}

/**
 * 시즌 종료 시 스폰서 조건 달성 여부 확인
 */
export function evaluateSponsorConditions(
  conditions: SponsorCondition[],
  seasonResult: {
    finalStanding: number;
    madePlayoff: boolean;
    wonChampionship: boolean;
    madeInternational: boolean;
    longestWinStreak: number;
    playerAppearancesDone: number;
  },
): { conditions: SponsorCondition[]; totalBonus: number; totalPenalty: number } {
  let totalBonus = 0;
  let totalPenalty = 0;

  const evaluated = conditions.map((condition) => {
    let fulfilled = false;

    switch (condition.type) {
      case 'playoff_qualify':
        fulfilled = seasonResult.madePlayoff;
        break;
      case 'top_4_finish':
        fulfilled = seasonResult.finalStanding <= 4;
        break;
      case 'championship_win':
        fulfilled = seasonResult.wonChampionship;
        break;
      case 'international_qualify':
        fulfilled = seasonResult.madeInternational;
        break;
      case 'player_appearance':
        fulfilled = seasonResult.playerAppearancesDone >= 3;
        break;
      case 'win_streak_3':
        fulfilled = seasonResult.longestWinStreak >= 3;
        break;
      default:
        fulfilled = false;
    }

    if (fulfilled) {
      totalBonus += condition.bonusAmount;
    } else if (condition.penaltyAmount > 0) {
      totalPenalty += condition.penaltyAmount;
    }

    return { ...condition, fulfilled };
  });

  return { conditions: evaluated, totalBonus, totalPenalty };
}
