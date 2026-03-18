# LoL Esports Manager - Claude Rules

## 참조 문서

- `.claude/rules/global-base-rules.md`
- `.claude/rules/code-quality-principles.md`
- `.claude/rules/language-react-typescript-rules.md`
- `.claude/rules/ai-supplementary-rules.md`

---

## 규칙

1. 요청 범위 밖 변경 금지
2. 최소 수정 원칙 유지
3. 분석 우선, 코드 수정은 허락 후
4. 변경 결과와 검증 결과 보고
5. 에러 메시지 원문 포함
6. 존재하지 않는 API/메서드 생성 금지 (환각 방지)
7. **라이브러리 추가 허용** — 기능 구현에 필요한 npm 패키지는 자유롭게 설치 가능 (global-base-rules의 "새로운 라이브러리를 임의로 도입하지 않는다" 규칙을 이 프로젝트에서는 **해제**)

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
