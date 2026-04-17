# LoL Esports Manager

Football Manager 스타일의 LoL e스포츠 감독 시뮬레이션 프로젝트입니다.  
현재 스택은 `React + TypeScript + Vite + Tauri + SQLite` 기반이며, 로컬 AI/Ollama와 운영 도구를 점진적으로 붙이는 방향으로 작업 중입니다.

## Stack

- Frontend: `React 19`, `TypeScript 5`, `Vite 8`
- Desktop shell: `Tauri 2`
- State: `Zustand`
- Routing: `React Router 7`
- Data: `SQLite`
- Monitoring: `Sentry`
- Testing: `Vitest`, `Playwright`
- Optional local AI: `Ollama`

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Environment

루트에 `.env.local` 파일을 만들고 필요 값을 넣습니다.

```env
VITE_SENTRY_DSN=
VITE_APP_ENV=development
```

- `VITE_SENTRY_DSN`
  Sentry를 쓸 때만 필요합니다. 없으면 앱은 그대로 실행되고 모니터링만 비활성화됩니다.
- `VITE_APP_ENV`
  보통 `development`로 두면 됩니다.

### 3. Run

웹 개발 서버:

```bash
npm run dev
```

Tauri 앱으로 실행:

```bash
npm run tauri dev
```

## Test Commands

```bash
npm run typecheck
npm test
npm run test:e2e
```

Playwright 브라우저가 처음이면 한 번 설치가 필요합니다.

```bash
npm run playwright:install
```

## Other Computer Setup

다른 컴퓨터에서 바로 이어서 작업하려면 아래 순서로 맞추면 됩니다.

### Required

1. 저장소 클론
2. `npm install`
3. `.env.local` 생성
4. 필요하면 `VITE_SENTRY_DSN` 입력
5. `npm run tauri dev` 또는 `npm run dev`

### AI / Tool Setup

이 프로젝트에서 “AI 툴”은 현재 필수와 선택으로 나뉩니다.

- 필수 아님: `Sentry`
  에러 추적용입니다. 계정과 DSN만 있으면 됩니다.
- 선택: `Ollama`
  로컬 LLM 기능을 실제로 붙여서 테스트할 때 필요합니다.
  다른 컴퓨터에서 AI 관련 기능까지 보려면:
  1. `Ollama` 설치
  2. 필요한 모델 pull
  3. Ollama 서버 실행 상태 확인
- 필수 아님: `Playwright`
  E2E 테스트 실행할 때만 필요합니다.
  브라우저 설치 명령:

```bash
npm run playwright:install
```

### Recommended Local Tools

- `Node.js 20+`
- `Rust` / `Cargo`
- `Tauri` 개발 환경
- Windows 기준 WebView2 런타임

## Sentry Setup

1. Sentry에서 React 프로젝트 생성
2. `DSN` 복사
3. `.env.local`에 입력

```env
VITE_SENTRY_DSN=your_dsn_here
VITE_APP_ENV=development
```

코드는 이미 [src/monitoring.ts](C:/Users/user/Desktop/KANG/Study/project/lol-esports-manager/src/monitoring.ts) 와 [src/components/ErrorBoundary.tsx](C:/Users/user/Desktop/KANG/Study/project/lol-esports-manager/src/components/ErrorBoundary.tsx) 에 연결되어 있습니다.

## What Was Added Recently

- `Playwright` 기본 설정 및 E2E 진입점
- `i18n` 기본 구조 추가
- `Sentry` 연동 준비 및 DSN 기반 초기화
- 이름 자동 한글 음차 제거
- 뉴스/매니저 홈/대시보드 FM형 흐름 정리
- 드래프트 화면 문구 및 교체 UX 개선
- 매치 HUD / 라이브 매치 일부 문자열 복구

## Remaining Work

아래는 아직 남아 있거나, 이번 턴에서 일부만 반영된 작업입니다.

### Match / Broadcast

- `LiveMatchView` 전반 문자열 추가 복구
- 상단 경기 HUD의 수치 source-of-truth 재점검
- 해설진별 말투/템플릿 완전 분리
  - 캐스터/분석가/객원 해설 캐릭터 차이 강화
  - 현재는 일부만 정리됐고, 엔진 전체 재작성은 아직 남음

### Draft

- 밴/픽 추천 로직 고도화
  - 조합 보완
  - 상대 카운터
  - 라인 우선권
  - 이유 문구 품질 향상
- 스왑 UX 후속 개선
  - 실패 사유 더 세분화
  - 성공/실패 시각 피드백 보강

### Manager Loop

- 뉴스 기반 `Next` 차단 규칙 강화
  - “읽지 않은 중요 뉴스가 있으면 Next가 뉴스룸으로 유도”
  - 더 강한 필수 업무 차단 로직은 추가 작업 필요
- 뉴스 허브의 액션 카드 정교화

### UI / UX

- 깨진 문자열 남은 화면 전수 정리
- FM 스타일에 더 가깝게 정보 밀도/배치 정리
- 설명성 helper copy 추가 축소

## Suggested Next Steps On Another Computer

다른 컴퓨터에서 이어서 할 때는 이 순서가 안전합니다.

1. `npm install`
2. `.env.local` 설정
3. `npm run typecheck`
4. `npm test`
5. `npm run tauri dev`
6. 아래 우선순위로 작업

추천 우선순위:

1. `src/engine/match/broadcastPresentation.ts`
   해설진별 톤 차이 완성
2. `src/features/match/LiveMatchView.tsx`
   남은 문자열/상태 문구 정리
3. `src/engine/draft/draftEngine.ts`
   추천 로직 강화
4. `src/features/manager/pages/ManagerDashboard.tsx`
   뉴스 기반 Next 차단 강화

## Notes

- 로컬 생성 캐시 폴더는 커밋하지 않도록 `.gitignore`에 추가했습니다.
- `test-results/`, `.android-sdk/`, `.gradle-android-cache/` 는 로컬 전용입니다.
