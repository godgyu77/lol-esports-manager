# LoL Esports Manager - Claude Rules

## 참조 문서

- `.claude/rules/global-base-rules.md`
- `.claude/rules/pipeline.md`
- `.claude/rules/code-quality-principles.md`
- `.claude/rules/language-react-typescript-rules.md`
- `.claude/rules/ai-supplementary-rules.md`
- `.claude/rules/security-guidelines.md`
- `.claude/rules/git-workflow.md`

---

## 규칙

1. 요청 범위 밖 변경 금지
2. 최소 수정 원칙 유지
3. 분석 후 바로 구현 (별도 승인 불필요, 대규모 변경 시 계획 공유 후 진행)
4. 변경 결과와 검증 결과 보고
5. 에러 메시지 원문 포함
6. 존재하지 않는 API/메서드 생성 금지 (환각 방지)
7. **라이브러리 추가 허용** — 기능 구현에 필요한 npm 패키지는 자유롭게 설치 가능
8. 보안 규칙 준수 (→ `security-guidelines.md`)
9. 작업 절차는 7단계 파이프라인 준수 (→ `pipeline.md`)

---

## 기술 스택

- **프론트엔드**: React 19 + TypeScript 5.9 + Vite 8
- **상태관리**: Zustand
- **라우팅**: React Router 7
- **백엔드**: Tauri 2 (Rust)
- **DB**: SQLite (Tauri SQL Plugin)
- **AI**: Ollama (로컬 LLM)
- **그래픽스**: Pixi.js
- **스키마 검증**: Zod

---

## 사용 가능한 스킬

- `skills/final-review` — 최종 리뷰
- `skills/build-test` — 빌드/테스트
- `skills/fix-issue` — 이슈 수정
- `skills/explain-code` — 코드 설명

## 사용 가능한 에이전트

- `agents/code-reviewer` — 코드 리뷰 (품질/보안/패턴)
- `agents/debugger` — 에러 디버깅 (root cause 분석)
