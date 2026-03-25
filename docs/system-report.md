# LoL Esports Manager - 시스템 현황 보고서

> 작성일: 2026-03-25
> 버전: 1.0

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 앱 타입 | Tauri 2 데스크톱 앱 (Windows/Mac/Linux) |
| 프론트엔드 | React 19 + TypeScript 5.9 + Vite 8 |
| 상태관리 | Zustand 5 |
| 라우팅 | React Router 7 (lazy-loaded) |
| DB | SQLite (Tauri SQL Plugin) |
| AI | Ollama / OpenAI / Claude (멀티 프로바이더) |
| 그래픽스 | Pixi.js 8 (라이브 경기 미니맵) |
| 스키마 검증 | Zod 4 |

---

## 2. 아키텍처 계층

```
UI (features/ 40+ 페이지)
  |
상태 (stores/ - Zustand 5개 스토어)
  |
비즈니스 로직 (engine/ - 42개 엔진, 300+ 함수)
  |
데이터 (db/ - queries.ts 90+ 쿼리 함수)
  |
SQLite (50개 마이그레이션, ~80개 테이블)
```

---

## 3. DB 시스템

### 3.1 연결 관리

- 싱글톤 패턴 - `getDatabase()`가 하나의 연결을 재사용
- WAL 모드 + `busy_timeout=5000ms` + `foreign_keys=ON`
- 트랜잭션 - `withTransaction()` (JS 레벨 `txLock`으로 직렬화)

### 3.2 주요 파일

| 파일 | 역할 | 규모 |
|------|------|------|
| `src/db/database.ts` | DB 연결, 트랜잭션 래퍼 | 43줄 |
| `src/db/queries.ts` | 모든 CRUD 쿼리 함수 (90+) | 2,206줄 |
| `src/db/initGame.ts` | 새 게임 초기화 | 300줄 |
| `src/db/seed.ts` | 초기 데이터 시딩 (팀, 선수, 챔피언) | - |

### 3.3 마이그레이션 (50개)

| 범위 | 버전 | 주요 테이블 |
|------|------|------------|
| 기본 엔티티 | 001-005 | teams, players, seasons, matches, champions |
| 선수 시스템 | 006-007 | player_traits, team_finances |
| 대회 | 008-013 | playoffs, transfers, tournaments, sponsors, player_relations |
| 통계 | 014-015 | player_game_stats, team_play_style |
| 운영 | 016-024 | scouting, training, staff, board, tactics, academy, news, complaints |
| 세이브/기록 | 025-031 | save_slots, records, facilities, social, rivalry, manager_profile |
| 고급 시스템 | 032-044 | injuries, retirement, offseason, promises, mentoring, contracts |
| 확장 | 045-050 | career_stats, chemistry, form, achievements |

### 3.4 쿼리 함수 분류 (90+개)

| 카테고리 | 주요 함수 |
|---------|----------|
| 팀 관리 | `insertTeam`, `getAllTeams`, `getTeamsByRegion`, `getTeamWithRoster` |
| 선수 관리 | `insertPlayer`, `getPlayersByTeamId`, `updatePlayerStats`, `updatePlayerMental` |
| 시즌 | `createSeason`, `getActiveSeason`, `updateSeasonDate` |
| 세이브 | `createSave`, `getSaveById`, `getAllSaves`, `createManualSave` |
| 매치/결과 | `insertMatch`, `getMatchesByDate`, `updateMatchResult`, `getStandings` |
| 컨디션 | `batchUpsertPlayerConditions`, `getTeamConditions`, `getPlayerFormHistory` |
| 챔피언 | `insertChampion`, `getAllChampions`, `insertChampionPatch` |
| 재정 | `insertFinanceLog`, `getTeamFinanceSummary`, `updateTeamBudget` |
| 이적 | `createTransferOffer`, `updatePlayerTeam`, `getFreeAgents` |
| 통계 | `insertPlayerGameStats`, `getSeasonPlayerRankings`, `getPlayerCareerStats` |

### 3.5 게임 초기화 흐름

```
initializeNewGame()
  -> seedAllData(팀/선수/챔피언)
  -> createSeason()
  -> generateLeagueSchedule()
  -> createSave()
```

---

## 4. AI 시스템

### 4.1 프로바이더 (4종)

| 프로바이더 | 기본 모델 | 특징 |
|-----------|----------|------|
| Ollama | qwen3:0.6b | 로컬, 무료, 빠름 |
| OpenAI | gpt-4o-mini | 클라우드, 고품질 |
| Claude | claude-haiku-4-5 | 클라우드, 한글 우수 |
| Template | - | 오프라인 폴백, 100% 보장 |

### 4.2 AI 파일 구성

| 파일 | 역할 |
|------|------|
| `src/ai/advancedAiService.ts` | 경기 중계, 드래프트 조언, 뉴스, 소셜, 스카우팅 리포트 |
| `src/ai/gameAiService.ts` | 일간 이벤트, 경기 후 코멘트, 이적 협상 판단 |
| `src/ai/contextBuilder.ts` | 게임 DB에서 LLM 프롬프트용 컨텍스트 수집 (500자 제한) |
| `src/ai/provider.ts` | Ollama/OpenAI/Claude API 통합 라우터 |
| `src/ai/fallback.ts` | AI 불가 시 템플릿 기반 폴백 응답 |
| `src/ai/rag/ragEngine.ts` | SQLite FTS5 기반 전문 검색 및 프롬프트 보강 |
| `src/ai/rag/knowledgeBase.ts` | LoL 기본 지식베이스 (챔피언, 메타, 전술 등) |

### 4.3 AI가 사용되는 기능

| 기능 | 설명 |
|------|------|
| 경기 중계 | FirstBlood, Dragon, Baron 등 이벤트별 코멘트 |
| 일간 이벤트 | 매일 발생하는 팀/선수 이벤트 생성 |
| 뉴스 생성 | 경기 결과, 이적 루머, 스캔들 뉴스 |
| 드래프트 조언 | Pick/Ban 추천 (메타 + 상대 분석) |
| 기자회견 | 동적 질의응답 |
| 이적 협상 | AI 팀/선수 응답 판정 |
| 스카우팅 리포트 | 상대 팀 분석 |
| 소셜 반응 | 팬/미디어 반응 |

### 4.4 RAG 시스템

- `knowledgeBase.ts` (603줄) - LoL 지식 (챔피언, 메타, 전술)
- `ragEngine.ts` - SQLite FTS5 전문 검색으로 프롬프트에 관련 지식 주입
- 컨텍스트 빌더가 게임 상태를 500자 이내로 압축하여 LLM에 전달

### 4.5 폴백 체계

```
AI 요청 -> isAiAvailable() 체크
         |-- YES -> chatWithLlm() -> LLM 응답
         |-- NO  -> 템플릿 응답 (경기중계 15+, 이벤트 25+, 뉴스 5+, 기자회견 15+, 면담 25+)
```

- AI는 게임 로직을 변경하지 않음 (텍스트/코멘트 생성만 담당)
- AI 불가 시에도 게임이 정상 진행됨
- 모든 AI 호출이 try/catch로 안전하게 래핑

---

## 5. 게임 엔진 (42개 카테고리, 300+ 함수)

### 5.1 핵심 시뮬레이션

| 엔진 | 주요 기능 |
|------|----------|
| matchSimulator | Bo1/Bo3/Bo5 경기 시뮬, 라인전-중반-후반 이벤트 |
| dayAdvancer | 일간 진행 - 경기/훈련/휴식/스크림 처리 |
| seasonEnd | 시즌 마무리, 플레이오프, 어워드 |
| offseasonEngine | 오프시즌 (이적, 계약, 아카데미) |
| tournamentEngine | LCK Cup, MSI, Worlds, EWC 등 |

### 5.2 일간 진행 흐름 (advanceDay)

```
"다음 날" 클릭
|-- 경기일? -> 유저 팀: LiveMatch / AI 팀: 자동 시뮬
|-- 비경기일? -> 훈련/휴식/스크림
|-- 컨디션 업데이트 (전 팀 선수)
|-- 부상 체크/회복
|-- 스카우팅/아카데미/멘토링/솔로랭크 진행
|-- 뉴스/이벤트 생성
|-- 주간 처리 (금요일): 재정, 만족도, 스폰서, 스태프
|-- 업적 체크
```

### 5.3 선수 관리 시스템

| 엔진 | 기능 |
|------|------|
| playerGrowth | 선수 성장/하락 (OVR 변화) |
| injuryEngine | 부상 발생/회복 |
| personalityEngine | 성향 (리더십, 공격성, 신뢰도) |
| satisfactionEngine | 만족도 (플레이타임, 성과, 급여 등 6요소) |
| retirementEngine | 은퇴 처리 |
| promiseEngine | 약속 이행/미이행 트래킹 |

### 5.4 팀 운영 시스템

| 엔진 | 기능 |
|------|------|
| tacticsEngine | 전술 설정 (5포지션) |
| chemistryEngine | 팀 케미스트리 (듀오, 3인 조합) |
| staffEngine | 코치/스태프 고용, 사기 관리 |
| boardEngine | 이사회 기대치, 요청, 해고 위험 |
| facilityEngine | 시설 업그레이드/유지비 |
| trainingEngine | 훈련 배정/효과 |
| scoutingEngine | 스카우트 고용, 리포트 생성 |

### 5.5 경제 시스템

| 엔진 | 기능 |
|------|------|
| financeEngine | 주간 재정, 급여, 예산 |
| contractEngine | 계약 생성/갱신/협상 |
| transferEngine | 이적 제안, AI 이적, 자유계약 |
| sponsorEngine | 스폰서 계약/조건 평가 |
| clauseEngine | 방출 조항, 성과금 |

### 5.6 기타 시스템

| 엔진 | 기능 |
|------|------|
| newsEngine | 뉴스 기사 생성 (경기 결과, 이적, 스캔들) |
| socialEngine | 소셜 미디어 반응 |
| mediaEngine | 기자회견 |
| teamTalkEngine | 팀 미팅 (사기 관리) |
| mentoringEngine | 멘토링 (선수 간 성장) |
| soloRankEngine | 솔로랭크 (개인 수련) |
| complaintEngine | 불만 관리 |
| inboxEngine | 메시지 함 |
| achievementEngine | 업적 (50+) 시스템 |
| patchEngine | 챔피언 밸런스 패치/메타 |
| awardEngine | 시즌 어워드 (MVP, 올스타) |
| rivalryEngine | 라이벌리 (팀 간 경쟁) |

---

## 6. 프론트엔드 화면 구성

### 6.1 메인 메뉴 (7개)

MainMenu, ModeSelect, ManagerCreate, TeamSelect, SeasonGoal, Settings, SaveLoad

### 6.2 감독 모드 (28개 페이지)

| 그룹 | 페이지 |
|------|--------|
| 운영 | Roster, Transfer, Contract, Tactics, Analysis, PreMatch |
| 경기 | Schedule, Standings, Tournament |
| 통계 | Stats, Records, Awards, PatchMeta, TeamHistory, ManagerCareer |
| 인사 | Scouting, Academy, Training, Staff, SoloRank |
| 소통 | NewsFeed, Inbox, Promises, PressConference, Complaints |
| 기타 | Board, Facility, Calendar, DayView, Finance, PlayerDetail, Achievement |

### 6.3 선수 모드 (11개 페이지)

PlayerCreate, Dashboard, Home, DayView, Training, Relations, Contract, SoloRank, Stats, Media, Career

### 6.4 경기 시스템

- 드래프트: Ban/Pick 단계, 챔피언 그리드, AI 조언
- 라이브 매치: Pixi.js 미니맵, 스코어보드, 해설, 전술 패널, 결정 팝업

---

## 7. 상태관리 (Zustand 5개 스토어)

| Store | 역할 |
|-------|------|
| gameStore | 모드, 시즌, 현재 날짜, 게임 페이즈 |
| settingsStore | AI 설정, 난이도, 볼륨, 테마 |
| playerStore | 선수 데이터 캐시 (30초 TTL) |
| teamStore | 팀 재정/케미스트리 캐시 |
| matchStore | 경기 상태 캐시 |

---

## 8. 정적 데이터

| 데이터 | 파일 | 크기 |
|--------|------|------|
| LCK 프로 선수 | `src/data/roster/rosterDb.ts` | 76KB |
| 챔피언 DB | `src/data/champion/championDb.ts` | 31KB |
| 특성 라이브러리 | `src/data/traits/traitLibrary.ts` | 13KB |
| FM 테마 | `src/styles/fm-theme.css` | 33KB |

---

## 9. 경기 시뮬레이션 흐름

```
simulateMatch(home, away, format)
|-- 라인업 구성: buildLineup()
|-- 매치업 평가: evaluateMatchup()
|-- 세트(Game)별 반복:
|   |-- 초반전 (0-10분): 라인전 이벤트
|   |-- 중반전 (10-30분): 갱킹, 스마이트 싸움
|   |-- 후반전 (30+분): 대규모 교전
|-- 승자 판정 (확률 기반)
|-- 플레이어 스탯 생성
|-- 경기 후 처리: 만족도, 케미스트리, 뉴스
```

---

## 10. Tauri 백엔드 (Rust)

| 의존성 | 역할 |
|--------|------|
| tauri | 프레임워크 코어 |
| tauri-plugin-sql | SQLite 플러그인 |
| tauri-plugin-shell | 프로세스 관리 |
| reqwest + tokio | HTTP 클라이언트 (AI API) |
| serde + serde_json | 직렬화 |
