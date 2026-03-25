# 라운드 4 검토 결과 — 내러티브 + AI + 접근성

> 검토일: 2026-03-25

---

## 1. 내러티브/스토리 (Narrative Designer)

### 최우선 개선

| # | 항목 | 설명 |
|---|------|------|
| 1 | 일간 뉴스 더미 이름 | '유망주 A', '선수' 등 일반명사 → 실제 DB 선수/팀 참조 |
| 2 | 이벤트 효과 텍스트 파싱 | '사기 -5' 한국어 파싱 → 구조화된 객체로 변경 |
| 3 | 기자회견 질문 풀 극소 | 유형당 1~3개 → 최소 10개+로 확장 |
| 4 | 폴백 템플릿 실명 미전달 | '{teamName}'→'우리 팀', '{playerName}'→'선수' |

### 중기 개선

| # | 항목 |
|---|------|
| 5 | 시스템 간 서사 연결 (이벤트→뉴스→소셜→기자회견 체인) |
| 6 | 시즌 타임라인 서사 모드 (opening/regular/crunch/playoff/finale) |
| 7 | 이벤트 체인 (병역 통지→입대→전역 복귀) |
| 8 | 선수 성격 기반 면담 분기 |

### 강점
- 소셜 5개 커뮤니티(인벤/디시/에펨/레딧/트위터) 차별화 우수
- 폴백 템플릿 풍부 (이벤트당 10~15개)
- 선수 성격별 이벤트 확률 수정자

---

## 2. AI 시스템 (AI Engineer)

### Critical

| # | 항목 | 파일 |
|---|------|------|
| P1 | API 키 base64 = 평문 → Tauri Stronghold 전환 | settingsStore.ts |
| P1 | 브라우저 직접 API 호출 → Rust invoke 전환 | provider.ts |

### Major

| # | 항목 | 파일 |
|---|------|------|
| P2 | fetch 타임아웃 미설정 (무한 대기) | provider.ts |
| P2 | Zod 스키마 정의만 있고 실제 검증 미사용 | gameAiService.ts |
| P2 | RAG FTS 쿼리 OR만 사용 → 검색 정확도 | ragEngine.ts |
| P2 | 프로바이더 간 자동 폴백 미구현 | provider.ts |
| P2 | N+1 쿼리 패턴 (contextBuilder) | contextBuilder.ts |

### Minor
- pickRandom/fillTemplate 3파일 중복
- safeAugment 패턴 불일관
- 지식 베이스 버전 관리 없음
- 콘솔 로그 잔존

---

## 3. 접근성 (Accessibility Auditor)

### Critical (3건)

| # | 항목 | 설명 |
|---|------|------|
| 1 | 포커스 표시기 부재 | `outline: none`만 있고 대체 포커스 스타일 없음 |
| 2 | 클릭 가능 div 키보드 미대응 | `<div onClick>` 21개소에 role/tabIndex/onKeyDown 없음 |
| 3 | prefers-reduced-motion 완전 미대응 | 미디어 쿼리 0건 |

### Serious (5건)
- heading 계층 불규칙 (h1→h3 건너뛰기)
- 이미지/아이콘 alt 텍스트 부재
- 폼 label 미연결
- 에러 메시지 aria-live 없음
- 색상만으로 상태 구분 (색각 이상 미고려)

### Moderate (4건)
- aria-label 영어/한국어 혼용
- 테이블 scope 속성 없음
- 모달 focus trap 없음
- 긴 목록 가상화 없음

### 기존 양호한 점
- 모달 role="dialog" + aria-modal="true"
- 일부 버튼 한국어 aria-label
- 탭 컴포넌트 부분적 ARIA
