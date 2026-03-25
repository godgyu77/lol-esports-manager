# 라운드 2 검토 결과 — 프론트엔드 + DB 최적화 + 성능

> 검토일: 2026-03-25

---

## 1. 프론트엔드 검토 (Frontend Developer)

### HIGH (즉시 수정)

| # | 항목 | 파일 |
|---|------|------|
| P1 | 대형 컴포넌트 — RosterView 738줄, DayView 510줄 | RosterView.tsx, DayView.tsx |
| P1 | useEffect 의존성 불완전 — AI 중계/채팅 stale 클로저 | LiveMatchView.tsx:286, 324 |
| P1 | any 타입 25+건 — DB 쿼리 결과 타입 미적용 | PlayerCareerView, PatchMetaView 등 |
| P1 | 컴포넌트 내 직접 DB 쿼리 (queries.ts 미사용) | RosterView, SoloRankView, PatchMetaView |

### MEDIUM

| # | 항목 | 파일 |
|---|------|------|
| P2 | 유틸리티 중복 — POSITION_LABELS 17파일, getOvr 9파일 | 전반 |
| P2 | gameStore 비대 (22필드+16액션) — dayProgressStore 분리 필요 | gameStore.ts |
| P2 | ManagerDashboard/DayView 일간 진행 로직 중복 | 두 파일 |
| P2 | ErrorBoundary 적용 비일관 | App.tsx 라우트 |

### 개선 권장 순서
1. 유틸리티 함수 추출 (POSITION_LABELS, getOvr, formatAmount)
2. any 타입 제거 (DB 쿼리 결과 타입 정의)
3. RosterView 탭 분리 (3개 컴포넌트)
4. useAdvanceDay() 커스텀 훅 추출

---

## 2. DB 최적화 검토 (Database Optimizer)

### 주요 이슈

| 심각도 | 항목 | 설명 |
|--------|------|------|
| HIGH | queries.ts 2200줄 단일 파일 | 도메인별 분리 필요 (player/, match/, team/ 등) |
| HIGH | SELECT * 32건 | 불필요한 컬럼 로드, 스키마 변경 시 영향 |
| MEDIUM | N+1 쿼리 패턴 | seedTeams()에서 팀→선수→특성 순차 INSERT |
| MEDIUM | 인덱스 부족 | player_daily_condition의 game_date, news_articles의 season_id+is_read |
| MEDIUM | WAL 체크포인트 미관리 | 장기 플레이 시 WAL 파일 비대화 가능 |
| LOW | 마이그레이션 50개 | 통합 정리 기회 (개발 단계이므로) |

### 개선 권장

1. queries.ts를 도메인별 분리 (src/db/queries/player.ts, match.ts 등)
2. 자주 조회되는 컬럼에 인덱스 추가
3. 주기적 WAL 체크포인트 (PRAGMA wal_checkpoint)

---

## 3. 성능 검토 (Performance Benchmarker)

### 주요 이슈

| 심각도 | 항목 | 설명 |
|--------|------|------|
| HIGH | 매 틱 전체 gameState spread | 50ms마다 전체 상태 복사 → GC 부하 |
| HIGH | Three.js 트리셰이킹 미확인 | import * as THREE → 전체 번들 포함 가능 (500KB+) |
| MEDIUM | Pixi.js lerp + Three.js 동시 로드 | 2D/3D 토글이지만 둘 다 lazy load여도 전환 시 초기화 비용 |
| MEDIUM | advanceDay DB 호출 50-100개 | 일간 진행 시 0.5~2초 소요 추정 |
| MEDIUM | events 배열 무한 누적 | 게임 끝날 때까지 events[] 계속 증가 |
| LOW | Zustand persist (localStorage) | 대형 상태 직렬화 시 UI 블로킹 가능 |

### 개선 권장

1. gameState를 useRef로 관리하고, UI 갱신은 throttle (100ms 간격)
2. Three.js를 named import로 변경 (트리셰이킹 활성화)
3. events 배열에 최대 크기 제한 (최근 100개만 유지)

---

## 우선 수정 권장

1. **queries.ts 분리** — 유지보수성 최대 개선
2. **gameState 리렌더 최적화** — 성능 즉시 개선
3. **Three.js 트리셰이킹** — 번들 크기 절감
4. **인덱스 추가** — DB 쿼리 성능 개선
