# Git 워크플로우 가이드

> AI와 협업할 때의 Git 브랜치/커밋/PR 전략이다.
> 출처: ai-supplementary-rules Git 섹션 + language-react-typescript-rules 커밋 규칙 통합

---

## 1. 브랜치 전략

- AI 작업은 **feature 브랜치**에서 수행 (main/develop 직접 수정 금지)
- 브랜치명: `feature/{작업유형}/{간단설명}` (예: `feature/bugfix/prompt-save-error`)
- AI 작업 완료 후 반드시 **사람이 리뷰** 후 merge

---

## 2. 커밋 규칙

### 커밋 단위

- **하나의 논리적 변경 = 하나의 커밋**
- 리팩토링과 기능 변경은 **별도 커밋**으로 분리
- AI가 생성한 코드임을 커밋 메시지에 명시 (예: `Co-Authored-By: AI`)

### 커밋 메시지 형식 (Conventional Commits)

- 형식: `<type>[optional scope]: <description>`
- 타입:
  - `fix:` — 버그 수정
  - `feat:` — 새 기능
  - `chore:` — 빌드/설정 변경
  - `docs:` — 문서 수정
  - `style:` — 코드 포맷팅 (동작 변경 없음)
  - `refactor:` — 리팩토링 (동작 변경 없음)
  - `perf:` — 성능 개선
  - `test:` — 테스트 추가/수정
- 제목에 마침표 금지, 명령형 어조 사용
- 본문에는 **what/why** 설명 (how는 생략 가능)

---

## 3. PR 작성

- AI가 작성한 코드 변경 사항을 **명확히 설명**
- 영향 받는 파일과 테스트 결과를 포함
- 리뷰어가 **AI 생성 코드를 인지**할 수 있도록 표기

### PR 템플릿

```markdown
## 변경 사항
- (변경 내용 요약)

## 변경 이유
- (왜 이 변경이 필요한가)

## 영향 범위
- (영향 받는 파일/기능 목록)

## 테스트 결과
- [ ] 타입체크 통과
- [ ] 린트 통과
- [ ] 테스트 통과
- [ ] 수동 검증 완료

## AI 생성 여부
- [ ] AI가 생성/수정한 코드 포함
```

---

## 4. 금지 사항

- main/develop 브랜치 직접 push 금지
- 리팩토링 + 기능 변경을 같은 커밋에 혼합 금지
- 시크릿 파일 커밋 금지 (→ `security-guidelines.md` 참조)
- force push 사전 확인 필수
