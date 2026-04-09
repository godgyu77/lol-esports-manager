# LoL Esports Manager - Notion Workspace Pack

작성일: 2026-04-09
프로젝트: `lol-esports-manager`

## 사용 방법

이 문서는 노션 메인 페이지에 그대로 붙여넣기 하기 위한 작업용 문서다.

같이 만든 CSV 파일:

- `docs/operations/notion-task-database-2026-04-09.csv`
- `docs/operations/notion-session-log-database-2026-04-09.csv`

노션에서 추천 구조:

1. 새 페이지 생성
2. 이 문서를 붙여넣기
3. CSV 두 개를 각각 Import 해서 데이터베이스 생성
4. 메인 페이지 상단에 `Task DB`, `Session Log DB` 링크드 뷰 추가

---

## 1. 운영 원칙

- 한 번에 한 축만 작업한다.
- 새 기능보다 빌드/테스트/핵심 루프 정리를 먼저 한다.
- 세션이 끝날 때마다 다음 시작점을 남긴다.
- 회사에서는 짧은 수정과 정리 작업을 한다.
- 집에서는 몰입이 필요한 구조 작업을 한다.
- 주말에는 큰 단위를 닫는다.

---

## 2. 최우선 목표

현재 최우선 목표는 아래 순서다.

1. `npm run build` 통과
2. `npm test` 전체 통과
3. `ManagerHome -> DayView -> Match Prep` 핵심 루프 정리
4. 재정, 보드, 선수 불만, 미디어 연결 강화
5. 이적/계약 AI 고도화

---

## 3. 지금 바로 시작할 작업

### 빌드 안정화

- [ ] `SocialFeedView`의 `commentCount` 타입 불일치 해결
- [ ] `TeamHistoryView`의 `legacyReport`/`ledger` 필드 불일치 해결
- [ ] `settingsStore`의 `Stronghold`/AI provider 타입 정리
- [ ] `ManagerHome.test.tsx` 팀 타입 불일치 수정
- [ ] 사용하지 않는 변수 제거
- [ ] `npm run build` 재검증

### 테스트 안정화

- [ ] `postMatchInsightEngine.test.ts` 기대 문구 최신화 또는 로직 맞춤
- [ ] `InboxView.test.tsx` empty state 문구/조건 최신화
- [ ] `npm test` 전체 재실행

### 핵심 루프 정리

- [ ] `ManagerHome` 상단 요약 카드 우선순위 정리
- [ ] `DayView`에서 오늘의 결정 흐름 점검
- [ ] `Dashboard` 메뉴 우선순위 재정리
- [ ] 플레이어가 하루 안에 무엇을 해야 하는지 더 명확하게 보이게 수정

---

## 4. 장소별 작업 가이드

### 회사에서 하기 좋은 작업

- 빌드 에러 수정
- 테스트 한 파일씩 수정
- 타입 정리
- 문구, 라벨, UI 정리
- 짧은 리팩터링
- TODO 정리

추천 파일:

- `src/features/manager/pages/SocialFeedView.tsx`
- `src/features/manager/pages/TeamHistoryView.tsx`
- `src/stores/settingsStore.ts`
- `src/features/manager/pages/InboxView.test.tsx`
- `src/features/manager/pages/ManagerHome.test.tsx`

### 집에서 하기 좋은 작업

- 핵심 루프 개편
- 엔진 간 연결 강화
- 이적/재정/보드 구조 개선
- 훈련/전술/스크림 연결 강화
- 장기 커리어 서사 강화

추천 파일:

- `src/features/manager/pages/ManagerHome.tsx`
- `src/features/manager/pages/DayView.tsx`
- `src/engine/manager/systemDepthEngine.ts`
- `src/engine/manager/releaseDepthEngine.ts`
- `src/engine/economy/transferEngine.ts`
- `src/features/manager/pages/TrainingView.tsx`
- `src/features/manager/pages/TacticsView.tsx`

### 주말에 하기 좋은 작업

- 빌드/테스트 완전 안정화
- 핵심 루프 1차 마감
- 시스템 연결 강화 1차 마감
- 이적 AI 1차 개선
- 다음 주 작업을 작은 단위로 분해

---

## 5. 주말 운영안

### 토요일

- 오전: 빌드 오류 전부 정리
- 오후: 테스트 오류 전부 정리
- 저녁: `ManagerHome` / `DayView` 핵심 루프 개편 시작

### 일요일

- 오전: 재정, 보드, 불만, 미디어 연결 강화
- 오후: 이적/계약 AI 1차 개선
- 저녁: 다음 주 평일용 작업 단위 분해 + 로그 정리

---

## 6. 추가기능 백로그

### 1순위

- 패치 메타 변화 시스템
- 선수 성격과 감독 철학 충돌
- 국제전 특수성 강화

### 2순위

- 팬덤/커뮤니티 여론 영향 강화
- 세대교체 시스템
- 사건형 콘텐츠

### 3순위

- 방송국/해설진 개성 강화
- 스폰서 요구사항 다양화
- 에이전트 성향 세분화
- 지역별 리그 문화 차이
- 선수 개인 브랜딩 강화

---

## 7. 세션 종료 기록 규칙

매 세션 종료 시 아래 6줄을 반드시 남긴다.

- 오늘 한 일
- 아직 남은 일
- 다음 시작 파일
- `typecheck` 결과
- `test` 결과
- `build` 결과

권장 형식:

```md
날짜:
작업 장소: 회사 / 집 / 주말
오늘 목표:
종료 조건:

한 일:
- 
- 

남은 일:
- 
- 

다음 시작 파일:
- 

실행 결과:
- typecheck:
- test:
- build:
```

---

## 8. 이번 주 성공 기준

이번 주가 끝날 때 아래 상태면 성공으로 본다.

- `npm run build` 통과
- `npm test` 전체 통과
- `ManagerHome`의 핵심 우선순위가 명확함
- 다음 경기 준비 흐름이 대시보드에서 자연스럽게 이어짐
- 다음 주부터 추가기능 작업에 들어갈 수 있는 안정화 상태 확보
