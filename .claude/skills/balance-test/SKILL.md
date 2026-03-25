---
name: balance-test
description: 밸런스 시뮬레이션 테스트 실행. 100시즌 자동 시뮬로 매치/성장 밸런스를 검증할 때 사용.
---

# Balance Test Skill

> 시즌 100회 자동 시뮬레이션으로 게임 밸런스를 검증하는 스킬.

---

## 언제 사용하나

- 밸런스 상수(성장률, KDA 가중치, 모멘텀 등)를 수정한 후 검증할 때
- 매치 시뮬레이터 로직을 변경한 후 영향도를 확인할 때
- 전력 차이별 승률 분포가 합리적인지 확인할 때

---

## 실행 명령어

### 밸런스 시뮬레이션 (100시즌)

```bash
npx vitest run src/engine/match/balanceSimulation.test.ts --reporter=verbose
```

10개 팀(전력 60~80) × 더블 라운드 로빈 × 100시즌을 실행하고 아래 통계를 출력한다:

- 우승팀 분포 (팀별 우승 횟수)
- 팀별 평균 승률
- 포지션별 평균 KDA
- Bo3 풀세트 비율

### 매치 시뮬레이터 단위 테스트

```bash
npx vitest run src/engine/match/matchSimulator.test.ts --reporter=verbose
```

### 팀 레이팅 단위 테스트

```bash
npx vitest run src/engine/match/teamRating.test.ts --reporter=verbose
```

### 매치 관련 전체 테스트

```bash
npx vitest run src/engine/match/ --reporter=verbose
```

---

## 실행 순서 (밸런스 수정 후)

1. `npx vitest run src/engine/match/balanceSimulation.test.ts --reporter=verbose` — 시뮬레이션 통계 확인
2. `npx vitest run src/engine/match/` — 기존 매치 테스트 회귀 확인
3. `npx vitest run src/engine/draft/draftEngine.test.ts` — 드래프트 테스트 회귀 확인
4. `tsc --noEmit` — 타입체크

---

## 검증 기준

| 항목 | 정상 범위 |
|------|----------|
| 전력 70팀 승률 | 40~60% |
| 전력 80팀 우승 비율 | 50% 이상 |
| 서포트 KDA | 2.0 이상, ADC KDA의 3배 미만 |
| Bo3 풀세트 비율 | 20~60% |
| 전력 상위팀 우승 > 하위팀 우승 | 필수 |

---

## 밸런스 상수 위치

| 항목 | 파일 | 위치 |
|------|------|------|
| 성장률 (성장기/전성기/하락기) | `src/data/systemPrompt.ts` | `GROWTH_CONSTANTS.growthRate` |
| 신인 폭발 성장 (17~19세) | `src/engine/player/playerGrowth.ts` | `rookieBurstFactor` in `calculateGrowth()` |
| 고잠재력 부스트 | `src/engine/player/playerGrowth.ts` | `getHighPotentialFactor()` |
| 킬/데스/어시스트 분배 | `src/engine/match/matchSimulator.ts` | `KILL_WEIGHT`, `DEATH_WEIGHT` |
| 시리즈 모멘텀 | `src/engine/match/matchSimulator.ts` | `calculateMomentumModifier()` |
| 메타 보정값 | `src/engine/champion/patchEngine.ts` | `generateMetaModifiers()` |
| 메타 적응 기간 | `src/engine/champion/patchEngine.ts` | `ADAPTATION_DAYS` in `calculateTeamMetaFitness()` |

---

## 결과 보고 형식

```
## 밸런스 시뮬레이션 결과
- 시뮬레이션: 100시즌 완료
- 우승 분포: (전력별 우승 횟수)
- 승률 범위: (최저~최고)
- 서포트 KDA: X.XX
- 풀세트 비율: XX.X%
- 검증: 통과/실패 (사유)
```
