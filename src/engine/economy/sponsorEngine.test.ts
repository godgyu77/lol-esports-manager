/**
 * sponsorEngine 단위 테스트
 * - 순수 함수 (generateSponsorOffers)만 테스트
 * - DB 의존 함수 (acceptSponsor, processSponsorWeeklyIncome 등)는 제외
 */

import { describe, it, expect } from 'vitest';
import { generateSponsorOffers, type SponsorTier } from './sponsorEngine';

// ─────────────────────────────────────────
// generateSponsorOffers 테스트
// ─────────────────────────────────────────

describe('generateSponsorOffers', () => {
  it('명성이 높으면(70+) 4개 제안 생성', () => {
    const offers = generateSponsorOffers(80);

    expect(offers).toHaveLength(4);
  });

  it('명성이 중간이면(40~69) 3개 제안 생성', () => {
    const offers = generateSponsorOffers(55);

    expect(offers).toHaveLength(3);
  });

  it('명성이 낮으면(40 미만) 2개 제안 생성', () => {
    const offers = generateSponsorOffers(25);

    expect(offers).toHaveLength(2);
  });

  it('명성이 매우 낮으면(10 미만) 자격 스폰서가 적어 2개 이하', () => {
    const offers = generateSponsorOffers(5);

    // requiredMinReputation이 10 이하인 스폰서만 해당
    expect(offers.length).toBeLessThanOrEqual(2);
  });

  it('명성 0이면 자격 스폰서 없어 빈 배열', () => {
    const offers = generateSponsorOffers(0);

    expect(offers).toHaveLength(0);
  });

  it('제안된 스폰서의 requiredMinReputation이 명성 이하', () => {
    const reputation = 60;
    const offers = generateSponsorOffers(reputation);

    for (const offer of offers) {
      expect(offer.requiredMinReputation).toBeLessThanOrEqual(reputation);
    }
  });

  it('높은 명성에서 플래티넘/골드 티어가 포함될 수 있음', () => {
    // 여러 번 실행해서 플래티넘 또는 골드가 한 번이라도 포함되는지 확인
    const allTiers = new Set<SponsorTier>();

    for (let i = 0; i < 50; i++) {
      const offers = generateSponsorOffers(90);
      for (const offer of offers) {
        allTiers.add(offer.tier);
      }
    }

    expect(allTiers.has('platinum') || allTiers.has('gold')).toBe(true);
  });

  it('낮은 명성(20)에서 플래티넘 티어가 나오지 않음', () => {
    // 플래티넘의 최소 명성 요구치가 70 이상이므로 절대 나올 수 없음
    for (let i = 0; i < 30; i++) {
      const offers = generateSponsorOffers(20);
      for (const offer of offers) {
        expect(offer.tier).not.toBe('platinum');
      }
    }
  });

  it('활성 스폰서와 중복되지 않는 제안 생성', () => {
    const activeNames = ['HyperX', 'Razer', 'SteelSeries'];
    const offers = generateSponsorOffers(80, activeNames);

    for (const offer of offers) {
      expect(activeNames).not.toContain(offer.name);
    }
  });

  it('모든 활성 스폰서가 자격 풀과 겹치면 빈 배열 반환 가능', () => {
    // 명성 15 기준 자격 스폰서: requiredMinReputation <= 15
    // 브론즈 중 DXRacer(15), 제닉스(10), 맥심(10), Secretlab(15) = 4개
    const allEligibleNames = ['DXRacer', '제닉스', '맥심', 'Secretlab'];
    const offers = generateSponsorOffers(15, allEligibleNames);

    expect(offers).toHaveLength(0);
  });

  it('제안의 weeklyPayout이 양수', () => {
    const offers = generateSponsorOffers(70);

    for (const offer of offers) {
      expect(offer.weeklyPayout).toBeGreaterThan(0);
    }
  });

  it('제안의 durationWeeks가 양수', () => {
    const offers = generateSponsorOffers(70);

    for (const offer of offers) {
      expect(offer.durationWeeks).toBeGreaterThan(0);
    }
  });
});
