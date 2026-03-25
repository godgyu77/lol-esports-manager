# LoL Esports Manager - 이슈 이력

> 발생한 이슈의 원인, 해결 방법, 영향 범위를 기록한다.
> 새로운 이슈가 발생하거나 수정될 때마다 이 문서에 추가한다.

---

## 이슈 목록

| # | 날짜 | 상태 | 제목 | 심각도 |
|---|------|------|------|--------|
| 001 | 2026-03-25 | 해결 | database is locked (code: 5) | 높음 |
| 002 | 2026-03-25 | 해결 | no such table: achievements (code: 1) | 높음 |
| 003 | 2026-03-25 | 미확인 | BGM 파일 로드 실패 | 낮음 |
| 004 | 2026-03-25 | 해결 | database is locked (code: 517) — 중첩 트랜잭션 | 높음 |
| 005 | 2026-03-25 | 해결 | 게임 시작일이 LCK Cup 이후 (1/12 → 12/1) | 중간 |
| 006 | 2026-03-25 | 해결 | 게임 시작일 하드코딩 잔존 (DayView 등 3개 파일) | 낮음 |
| 007 | 2026-03-25 | 해결 | 자유계약 선수/스태프 0명 — 이적시장 비어있음 | 중간 |
| 008 | 2026-03-25 | 해결 | 시즌 진행이 별도 페이지 — 모달로 변경 | 중간 |
| 009 | 2026-03-25 | 해결 | 밴픽 포지션 중복 선택 가능 | 중간 |
| 010 | 2026-03-25 | 해결 | 챔피언 스왑 기능 없음 | 중간 |
| 011 | 2026-03-25 | 해결 | 2D 라이브 경기 끊김 — lerp 보간 적용 | 중간 |
| 012 | 2026-03-25 | 해결 | 감독 모드에서 설정 직접 접근 불가 | 낮음 |
| 013 | 2026-03-25 | 해결 | 매치 화면 레이아웃 개선 (미니맵 확대+스탯테이블) | 중간 |
| 014 | 2026-03-25 | 해결 | 경기 중 선수별 실시간 스탯 미표시 | 중간 |
| 015 | 2026-03-25 | 해결 | 게임 데이터가 실제 LoL과 상이 — LCK 수치 반영 | 중간 |
| 016 | 2026-03-25 | 해결 | 미니맵 시각 개선 (타워/드래곤pit/바론pit 추가) | 낮음 |
| 017 | 2026-03-25 | 해결 | 타워 파괴 0~3개 (실제 5~11개) — 시간대별 자동 증가 + 최소값 보정 | 높음 |
| 018 | 2026-03-25 | 해결 | 드래곤 18/22분 고정 — 5분부터 5분 간격으로 수정 | 중간 |
| 019 | 2026-03-25 | 해결 | 넥서스 파괴 시 타워 검증 없음 — finishGame()에 최소 타워 보정 추가 | 높음 |
| 020 | 2026-03-25 | 해결 | 골드 히스토리 미추적 — 매 틱 기록 추가 | 중간 |
| 021 | 2026-03-25 | 해결 | 실시간 스탯에 KP%/GPM 미표시 — PlayerStatsTable 확장 | 낮음 |
| 022 | 2026-03-25 | 해결 | 경기 후 LCK 스타일 통계 화면 없음 — PostGameStats 구현 | 중간 |
| 023 | 2026-03-25 | 해결 | 3D 미니맵 없음 — Three.js MatchMinimap3D 구현 + 2D/3D 토글 | 중간 |
| 024 | 2026-03-25 | 해결 | 토스트 알림 시스템 없음 — toastStore + ToastContainer 구현 | 중간 |
| 025 | 2026-03-25 | 해결 | 커맨드 팔레트 없음 — Ctrl+K CommandPalette 구현 | 중간 |
| 026 | 2026-03-25 | 해결 | BGM 로드 실패 반복 출력 — 실패 캐시 + 스킵 로직 추가 | 낮음 |
| 027 | 2026-03-25 | 해결 | OP.GG 스타일 통계 대시보드 확장 — 선수랭킹/MVP보드 | 중간 |
| 028 | 2026-03-25 | 해결 | 반응형 디자인 — 모바일 사이드바 토글 + 햄버거 메뉴 | 중간 |
| 004 | 2026-03-25 | 해결 | database is locked (code: 517) — 중첩 트랜잭션 | 높음 |

---

## #001 — database is locked (code: 5)

- **날짜**: 2026-03-25
- **상태**: 해결 (→ #004에서 추가 수정)
- **심각도**: 높음

### 증상

"다음 날" 버튼 클릭 시 거의 모든 뷰에서 `database is locked` 오류 발생:
- DayView, NewsFeedView, TacticsView, TrainingView, FacilityView, BoardView, AchievementView

### 에러 원문

```
error returned from database: (code: 5) database is locked
```

### 원인

1. `advanceDay()` 함수가 50~100+개의 개별 DB execute를 **트랜잭션 없이** 수행
2. `batchUpsertPlayerConditions()`가 300+명의 선수를 for 루프로 **개별 INSERT** (300회 execute)
3. `withTransaction()`이 존재하지만 `advanceDay()`에서 사용하지 않음
4. WAL 모드 + `busy_timeout=5000ms` 설정만으로는 동시 쓰기 경합 해소 불가

### 해결 (최종 — #004 반영)

| 파일 | 변경 내용 |
|------|-----------|
| `src/engine/season/dayAdvancer.ts` | JS 레벨 직렬화 락(`__dayAdvanceLock`)으로 동시 실행 방지 |
| `src/db/queries.ts` | `batchUpsertPlayerConditions()` — 50개씩 청크 배치 INSERT (300회 → 6회) |
| `src/db/queries.ts` | `processWeeklySalaries()` — 자체 `BEGIN/COMMIT/ROLLBACK` 제거 |
| `src/db/database.ts` | `busy_timeout` 5000ms → 15000ms |

### 영향 범위

- `dayAdvancer.ts` — 일간 진행 함수
- `queries.ts` — 배치 컨디션 업데이트 + 주급 처리 함수
- `database.ts` — PRAGMA 설정

---

## #002 — no such table: achievements (code: 1)

- **날짜**: 2026-03-25
- **상태**: 해결
- **심각도**: 높음

### 증상

AchievementView 진입 시 테이블이 존재하지 않는다는 오류 발생.

### 에러 원문

```
error returned from database: (code: 1) no such table: achievements
```

### 원인

49개 마이그레이션 파일 중 어디에도 `achievements` 테이블 CREATE 문이 없음. `achievementEngine.ts`의 `ensureTable()`이 런타임에 생성을 시도하지만, DB locked 상태에서 실패.

### 해결

| 파일 | 변경 내용 |
|------|-----------|
| `src-tauri/migrations/050_achievements.sql` | achievements 테이블 CREATE 마이그레이션 신규 생성 |
| `src-tauri/src/lib.rs` | version 50 마이그레이션 등록 추가 |

### 영향 범위

- 마이그레이션 시스템 (Rust 백엔드)
- 기존 DB 파일이 있는 경우 삭제 후 재시작 필요

---

## #003 — BGM 파일 로드 실패

- **날짜**: 2026-03-25
- **상태**: 미확인
- **심각도**: 낮음

### 증상

콘솔에 BGM 트랙 로드 실패 로그 출력.

### 에러 원문

```
[BGM] 트랙 로드 실패: /audio/game_bgm_1.mp3
[BGM] 트랙 로드 실패: /audio/match_bgm.mp3
```

### 원인

해당 경로에 오디오 파일이 존재하지 않는 것으로 추정. 상세 조사 필요.

### 해결

미착수.

---

## #004 — database is locked (code: 517) — 중첩 트랜잭션

- **날짜**: 2026-03-25
- **상태**: 해결
- **심각도**: 높음
- **관련 이슈**: #001의 수정으로 인해 발생

### 증상

#001 수정 후에도 `advanceDay()` 실행 시 동일한 locked 오류 지속. 에러 코드가 5 → 517 (SQLITE_BUSY extended)로 변경됨.
- injuryEngine, chemistryEngine, soloRankEngine, updateAllTeamConditions 등에서 발생
- UI 뷰 (FacilityView, BoardView, TrainingView, TacticsView)에서도 읽기 실패

### 에러 원문

```
error returned from database: (code: 517) database is locked
```

### 원인

1. #001에서 `advanceDay()` 전체를 `withTransaction()`으로 래핑 → `BEGIN TRANSACTION` 실행
2. 내부의 `processWeeklySalaries()`가 자체적으로 `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK`을 직접 실행 → **중첩 트랜잭션 충돌**
3. `achievementEngine.ts`의 `ensureTable()`이 트랜잭션 안에서 `CREATE TABLE` DDL 실행
4. 싱글 커넥션 구조에서 long-running 트랜잭션이 UI 읽기까지 블로킹

### 해결

| 파일 | 변경 내용 |
|------|-----------|
| `src/engine/season/dayAdvancer.ts` | `withTransaction()` 래핑 제거 → JS 레벨 직렬화 락(`__dayAdvanceLock`)으로 변경 |
| `src/db/queries.ts` | `processWeeklySalaries()`의 자체 `BEGIN/COMMIT/ROLLBACK` 제거 (외부 트랜잭션에 의존) |
| `src/engine/achievement/achievementEngine.ts` | `ensureTable()`의 `CREATE TABLE` DDL 제거 (마이그레이션 050으로 대체) |
| `src/db/database.ts` | `busy_timeout` 5000ms → 15000ms로 증가 |

### 영향 범위

- `dayAdvancer.ts` — 일간 진행 함수
- `queries.ts` — 주급 처리 함수
- `achievementEngine.ts` — 업적 엔진 초기화
- `database.ts` — DB PRAGMA 설정

### 교훈

- SQLite 싱글 커넥션에서는 `withTransaction()`으로 전체 함수를 래핑하면 내부 함수의 자체 트랜잭션과 충돌
- 중첩 트랜잭션이 필요한 경우 `SAVEPOINT` 사용을 고려해야 함
- long-running 트랜잭션은 UI 읽기를 블로킹하므로, JS 레벨 직렬화가 더 적합

---

## #005 — 게임 시작일이 LCK Cup 이후

- **날짜**: 2026-03-25
- **상태**: 해결
- **심각도**: 중간

### 증상

게임 시작일이 2026-01-12인데, LCK Cup 경기가 2026-01-06부터 시작. 게임 시작 시점에 이미 경기가 6일 지난 상태.

### 원인

`004_daily_calendar.sql` 마이그레이션의 `current_date`, `start_date` 기본값이 `2026-01-12`로 설정됨.

### 해결

| 파일 | 변경 내용 |
|------|-----------|
| `src-tauri/migrations/004_daily_calendar.sql` | `current_date`, `start_date` 기본값을 `2025-12-01`로 변경 |

### 비고

- 12월 1일부터 시작하면 LCK Cup(1/6) 전까지 약 36일의 프리시즌 기간 확보
- 이적, 훈련, 팀 세팅 등을 경기 전에 준비 가능
- 기존 DB 삭제 후 재시작 필요 (마이그레이션 DEFAULT 변경)
