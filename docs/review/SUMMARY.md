# 전체 프로젝트 검토 통합 보고서

> 14개 에이전트 × 5라운드 검토 | 2026-03-25

---

## 검토 에이전트 목록

| 라운드 | 에이전트 | 보고서 |
|--------|---------|--------|
| R1 | Code Reviewer, Software Architect, Security Engineer | round1-code-architecture-security.md |
| R2 | Frontend Developer, Database Optimizer, Performance Benchmarker | round2-frontend-db-performance.md |
| R3 | Game Designer, UX Researcher, UI Designer | round3-game-ux-ui.md |
| R4 | Narrative Designer, AI Engineer, Accessibility Auditor | round4-narrative-ai-accessibility.md |
| R5 | Workflow Optimizer, Product Manager | round5-workflow-product.md |

---

## Critical 이슈 (즉시 수정)

| # | 항목 | 출처 | 영향 |
|---|------|------|------|
| 1 | simulateGame 반환값 필드 누락 (goldHome/towers/goldHistory) | Code Reviewer | 자동 시뮬 경기 PostGameStats undefined |
| 2 | dayAdvancer globalThis 락 레이스 컨디션 | Code Reviewer | 오프시즌 조기 return 시 데드락 |
| 3 | API 키 base64 = 평문 저장 | Security + AI | Tauri Stronghold 전환 필요 |
| 4 | 브라우저 직접 API 호출 (키 네트워크 노출) | Security + AI | Rust invoke로 전환 |
| 5 | CommandPalette.tsx:108 타입 에러 (main) | Workflow | 빌드 실패 |
| 6 | ESLint 81 에러 미해결 (main) | Workflow | 코드 품질 |
| 7 | draftEngine.test.ts 1개 실패 (main) | Workflow | swap phase 추가 영향 |
| 8 | focus 상태 전역 부재 (접근성) | Accessibility | 키보드 사용 불가 |

---

## 게임 밸런스 핵심 이슈

| # | 항목 | 현재 | 권장 |
|---|------|------|------|
| 1 | 승률 스노우볼 과잉 | 단일 게임 +0.9 가능 | 보정값 50% 하향 |
| 2 | 경제 고정 지출 부재 | 수입 >> 지출 | 시설비/코칭비 추가 |
| 3 | 난이도 상수 중복 | 2곳에서 다른 값 | 통합 |
| 4 | 선수 성장 느림 | 유망주 육성 4시즌 | 신인 폭발 성장 추가 |
| 5 | 서포트 KDA 불리 | 만족도 항상 낮음 | 포지션별 기준선 |

---

## 아키텍처/코드 핵심 이슈

| # | 항목 | 현재 | 권장 |
|---|------|------|------|
| 1 | queries.ts 2200줄 | 90+ 함수 단일 파일 | 도메인별 분리 |
| 2 | advanceDay 470줄 | God Object | 기능별 하위 함수 분리 |
| 3 | getPlayerOverall 3곳 중복 | 동일 로직 3파일 | 공통 유틸 추출 |
| 4 | POSITION_LABELS 17파일 중복 | 동일 상수 | 공통 유틸 추출 |
| 5 | any 타입 25+건 | DB 쿼리 결과 | Row 인터페이스 정의 |
| 6 | Math.random() 30+건 | 재현 불가 | 시드 기반 RNG |

---

## UX/UI 핵심 이슈

| # | 항목 | 출처 |
|---|------|------|
| 1 | 시즌 진행 진입점 이중화 (모달 vs DayView) | UX |
| 2 | ManagerHome 정보 과밀 (15+ useState) | UX |
| 3 | 비경기일 지루함 (반복 훈련/휴식) | UX |
| 4 | --text-muted 대비 3.2:1 (WCAG 미달) | UI |
| 5 | 하드코딩 색상 산재 | UI |
| 6 | 버튼 hover 효과 불일치 | UI |

---

## 내러티브/AI 핵심 이슈

| # | 항목 | 출처 |
|---|------|------|
| 1 | 뉴스에 더미 이름 사용 ('유망주 A') | Narrative |
| 2 | 이벤트 효과 한국어 텍스트 파싱 | Narrative |
| 3 | 기자회견 질문 풀 극소 (1~3개/유형) | Narrative |
| 4 | fetch 타임아웃 미설정 | AI |
| 5 | Zod 스키마 검증 미사용 | AI |
| 6 | 프로바이더 간 자동 폴백 미구현 | AI |

---

## 제품 전략 핵심 권고

### 즉시 실행 3가지
1. **스코프 절반 줄이기** — 선수모드/3D/기자회견/아카데미를 MVP에서 제외
2. **시즌 1회 완주 자동 테스트 100회** — 밸런스 검증
3. **IP 리스크 법적 확인** — 실제 팀명/선수명 사용 가능 여부

### 출시 전략
- EA 12,000원 (LCK 단일) → 정식 18,000원 (4개 리전)
- 경쟁 차별화: 실제 데이터 + FM급 깊이 + 한국 커뮤니티 반응

---

## 수정 우선순위 종합 (TOP 10)

| 순위 | 항목 | 카테고리 | 난이도 |
|------|------|---------|--------|
| 1 | Critical 빌드 에러 수정 (타입+린트+테스트) | 워크플로우 | 낮음 |
| 2 | simulateGame 반환값 누락 수정 | 코드 버그 | 낮음 |
| 3 | dayAdvancer 락 레이스 컨디션 수정 | 코드 버그 | 중간 |
| 4 | 승률 스노우볼 보정값 하향 | 게임 밸런스 | 낮음 |
| 5 | API 호출 Rust invoke 전환 | 보안 | 중간 |
| 6 | focus 상태 전역 추가 | 접근성 | 낮음 |
| 7 | queries.ts 도메인별 분리 | 아키텍처 | 중간 |
| 8 | 공통 유틸 추출 (getOvr, POSITION_LABELS) | 코드 품질 | 낮음 |
| 9 | 뉴스 실제 선수/팀 참조 | 내러티브 | 낮음 |
| 10 | CI/CD 파이프라인 구축 | 워크플로우 | 중간 |
