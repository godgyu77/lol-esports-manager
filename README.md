# LoL Esports Manager

Football Manager 스타일의 LoL e스포츠 팀 경영 시뮬레이션 게임

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 19 + TypeScript 5.9 + Vite 8 |
| 상태관리 | Zustand |
| 라우팅 | React Router 7 |
| 백엔드 | Tauri 2 (Rust) |
| DB | SQLite (Tauri SQL Plugin, 49개 마이그레이션) |
| AI | Ollama (로컬 LLM) |
| 그래픽스 | Pixi.js 8 |
| 스키마 검증 | Zod |
| 테스트 | Vitest |

## 프로젝트 구조

```
src/
├── ai/                 # AI 연동 (Ollama, RAG, 스키마, 템플릿)
├── audio/              # 오디오 시스템
├── components/         # UI 컴포넌트
│   ├── common/         #   공통 컴포넌트
│   ├── layout/         #   레이아웃
│   └── match/          #   경기 관련 컴포넌트
├── data/               # 정적 데이터 / 템플릿
├── db/                 # DB 쿼리 및 마이그레이션
├── engine/             # 게임 엔진 (40+ 모듈)
├── features/           # 페이지/기능 단위 모듈
├── hooks/              # 커스텀 훅
├── stores/             # Zustand 스토어
├── styles/             # 스타일
├── types/              # 타입 정의
└── utils/              # 유틸리티

src-tauri/
├── src/                # Rust 백엔드 (Tauri commands, Ollama 매니저)
└── migrations/         # SQLite 마이그레이션 (49개)
```

## 주요 시스템 (Engine 모듈)

| 카테고리 | 모듈 |
|----------|------|
| 핵심 | match, simulation, season, tournament, draft |
| 선수 관리 | player, training, soloRank, injury, retirement, personality, satisfaction |
| 팀 운영 | staff, tactics, chemistry, teamTalk, mentoring, academy |
| 경영 | economy, facility, scouting, board, manager |
| 이적 | agent, promise, playerGoal, complaint |
| 기록/분석 | stats, records, analysis, award, achievement |
| 콘텐츠 | event, news, media, social, inbox, rivalry |
| 시스템 | save, difficulty, rules, champion |

## 기능 페이지 (Features)

- **draft** — 챔피언 드래프트
- **main** — 메인 화면
- **manager** — 감독 관리
- **match** — 경기 진행
- **player** — 선수 관리
- **transfer** — 이적 시장
- **tutorial** — 튜토리얼

## 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버 (프론트엔드만)
npm run dev

# Tauri 앱 실행
npm run tauri dev

# 빌드
npm run build
npm run tauri build
```

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | Vite 개발 서버 |
| `npm run build` | TypeScript 빌드 + Vite 빌드 |
| `npm run lint` | ESLint 실행 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run tauri` | Tauri CLI |

## 현재 상태

- **총 파일**: 215개 (TS/TSX)
- **엔진 모듈**: 40개
- **DB 마이그레이션**: 49개
- **Zustand 스토어**: gameStore, matchStore, playerStore, settingsStore, teamStore
