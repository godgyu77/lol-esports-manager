# 라운드 1 검토 결과 — 코드 품질 + 아키텍처 + 보안

> 검토일: 2026-03-25

---

## 1. 코드 품질 검토 (Code Reviewer)

### Critical (3건)

| # | 항목 | 파일 | 설명 |
|---|------|------|------|
| C1 | simulateGame 반환값 필드 누락 | matchSimulator.ts:666 | goldHome/Away, towersHome/Away, goldHistory가 return에 미포함. 자동 시뮬 경기의 PostGameStats에서 undefined |
| C2 | dayAdvancer globalThis 락 — 레이스 컨디션 | dayAdvancer.ts:214-217 | while/lock 사이 비동기 끼어들기 가능. 오프시즌 조기 return 시 lock 미해제 가능 |
| C3 | API 키 base64 인코딩 — 보안 미흡 | settingsStore.ts:17-26 | base64는 암호화 아님. localStorage에 평문 동일 |

### Major (6건)

| # | 항목 | 파일 |
|---|------|------|
| M1 | getPlayerOverall 3곳 중복 정의 | contractEngine, transferEngine, agentEngine |
| M2 | advanceDay 470줄 단일 함수 | dayAdvancer.ts:204-686 |
| M3 | 빈 catch 블록 30건+ (에러 삼킴) | dayAdvancer.ts 외 다수 |
| M4 | Math.random() 직접 사용 30건+ (재현 불가) | academy, agent, champion, dayAdvancer |
| M5 | simulateMatch 파라미터 18개 | matchSimulator.ts:829-855 |
| M6 | teamRating.ts unsafe 이중 캐스팅 | teamRating.ts:314 |

### Minor (7건)

| # | 항목 | 파일 |
|---|------|------|
| m1 | any 타입 16건+ | ManagerDashboard, SoloRankView 등 |
| m2 | busy-wait 트랜잭션 잠금 | database.ts:19-21 |
| m3 | SELECT * 32건 | queries.ts 전반 |
| m4 | secondaryPosition 항상 null (부포지션 미작동) | queries.ts:117 |
| m5 | Anthropic API 브라우저 직접 호출 | provider.ts:126 |
| m6 | chatWithLlm에서 폴백 미실행 (warn 후 throw) | provider.ts:176-203 |
| m7 | pickRandom/fillTemplate 중복 정의 | fallback.ts, gameAiService.ts |

### 양호한 패턴
- 시드 기반 RNG (matchSimulator)
- 타입 안전한 DB 매핑
- AI 폴백 시스템
- SQL 파라미터 바인딩 (인젝션 위험 없음)

---

## 2. 아키텍처 검토 (Software Architect)

### 핵심 이슈

| 심각도 | 항목 | 파일 |
|--------|------|------|
| HIGH | God Object — dayAdvancer가 모든 엔진 호출 | dayAdvancer.ts |
| HIGH | queries.ts 90+ 함수 집중 (2200줄) | queries.ts |
| HIGH | busy-wait 트랜잭션 잠금 | database.ts |
| MEDIUM | gameStore 책임 과다 | gameStore.ts |
| MEDIUM | DB->Engine 역방향 의존 | initGame.ts |
| MEDIUM | contextBuilder Raw SQL 우회 | contextBuilder.ts |

---

## 3. 보안 검토 (Security Engineer)

### 발견 사항

| 심각도 | 항목 | 파일 |
|--------|------|------|
| HIGH | API 키 Base64 저장 | settingsStore.ts |
| HIGH | 클라이언트 직접 API 호출 | provider.ts |
| MEDIUM | Shell args 화이트리스트 미적용 | capabilities/default.json |
| MEDIUM | 에러 메시지 내부 정보 노출 | provider.ts |
| MEDIUM | .gitignore에 .env 미포함 | .gitignore |
| LOW | CSP 설정 개선 필요 | tauri.conf.json |
| OK | SQL 파라미터 바인딩 정상 | queries.ts |

---

## 우선 수정 권장 순서

1. **C1** — simulateGame 반환값 필드 누락 (데이터 버그)
2. **C2** — dayAdvancer 락 레이스 컨디션 (동시성 위험)
3. **M1** — getPlayerOverall 중복 정리
4. **m4** — secondaryPosition 미작동 수정
5. **M2** — advanceDay 함수 분리
