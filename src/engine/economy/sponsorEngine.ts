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
  // 종료일 계산 (현재 날짜 + durationWeeks 주)
  const start = new Date(currentDate);
  const end = new Date(start);
  end.setDate(end.getDate() + offer.durationWeeks * 7);
  const endDate = end.toISOString().split('T')[0];

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
