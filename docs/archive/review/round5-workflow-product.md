# 라운드 5 검토 결과 — 워크플로우 + 제품 전략

> 검토일: 2026-03-25

---

## 1. 개발 워크플로우 (Workflow Optimizer)

### 즉시 해결 (빨강)

| # | 항목 | 설명 |
|---|------|------|
| 1 | CommandPalette.tsx:108 타입 에러 | 유니코드 이스케이프 구문 오류가 main에 존재 |
| 2 | ESLint 81 에러 | prefer-const, exhaustive-deps 등 미해결 |
| 3 | draftEngine.test.ts 1개 실패 | swap phase 추가로 isComplete 테스트 깨짐 |

### 단기 개선

| # | 항목 |
|---|------|
| 4 | package.json에 test/typecheck/lint:fix 스크립트 추가 |
| 5 | Pre-commit hook (husky + lint-staged) |
| 6 | 최소 CI (GitHub Actions: typecheck + lint + test) |
| 7 | 버전 번호 3곳 통일 (0.0.0 vs 0.1.0) |

### 중기 개선
- UI 컴포넌트 테스트 인프라 (React Testing Library)
- 커버리지 리포트 설정
- Prettier 도입
- Vite path alias (@/)

---

## 2. 제품 전략 (Product Manager)

### 핵심 판단

> "기능의 넓이는 이미 FM 수준. 지금 필요한 것은 더 많은 기능이 아니라 핵심 루프의 품질과 밸런스"

### 타겟 유저
- **Primary (60%)**: "전략적 관전러" — LCK 시청자, "내가 감독이면" 상상하는 사람
- **Secondary (25%)**: "FM 출신 e스포츠 팬" — FM 깊이 + LoL 세계관 원하는 사람
- **Niche (15%)**: "선수 모드 롤플레이어" — 프로 선수 커리어 체험

### MVP 스코프 정리 (즉시)

**MVP에서 비활성화 권장:**
- 선수 모드 → v2 DLC
- AI LLM → 정적 폴백으로 대체 (옵션 유지)
- 3D Three.js → 2D Pixi.js만
- 기자회견/도발 → 비활성화
- 아카데미/루키 드래프트 → 비활성화

### 경쟁 차별화 3가지
1. **실제 팀/선수 데이터** — TFM에 없음
2. **FM급 경영 깊이** — Riot LoL EM에 없음
3. **한국 커뮤니티 반응** (인벤/디시/FM코리아) — 독보적

### 수익화
- Early Access: 12,000원 (LCK 단일 리전)
- 정식 출시: 18,000원 (4개 리전)
- DLC: 선수 모드, 추가 시스템

### 출시 로드맵
1. Phase 0: 스코프 정리 (2주)
2. Phase 1: Core Loop 완성 (4-6주)
3. Phase 2: 밸런스 + 폴리시 (4주)
4. Phase 3: EA 출시 준비 (2주)
5. Phase 4: EA 기간 (3-6개월)
6. Phase 5: 정식 출시

### 최대 위험
- **IP 리스크**: 실제 팀명/선수명 사용 → 법적 확인 필수
- **스코프 과잉**: 기능 42개 → 출시 지연 위험
- **밸런스 미조정**: 자동 시뮬 100회 테스트 필요
