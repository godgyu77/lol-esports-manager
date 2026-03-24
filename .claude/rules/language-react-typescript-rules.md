# Language Rules: React + TypeScript

> React와 TypeScript를 사용하는 프로젝트에 공통 적용한다.
> 보안 규칙은 `security-guidelines.md`, 커밋 규칙은 `git-workflow.md` 참조.
> 출처: lhg language-react-typescript-rules + kcy react_rules 통합

---

## React 규칙

- **함수형 컴포넌트** 사용 (클래스 컴포넌트 금지)
- 재사용 로직은 **커스텀 훅**으로 분리
- UI 표현과 도메인 로직 **책임 분리**
- 분기 복잡도 증가 시 컴포넌트 **분리**
- 공통 컴포넌트 **우선 재사용**
- 모든 요청 기능을 **완전히 구현** (TODO, placeholder 금지)
- **접근성(a11y)** 구현: `tabindex`, `aria-label`, 키보드 이벤트 포함

---

## TypeScript 규칙

- 공개 API 타입 **명시**
- `any` 사용 **최소화**
- 반환 형태와 네이밍 규약 **일관성 유지**
- 필요한 import 모두 포함
- 가능하면 `type` 정의 사용

---

## 상태 관리 경계

- **서버 상태**: TanStack React Query (서버 상태 도구로 관리)
- **클라이언트 UI 상태**: Zustand 등 별도 경계로 관리
- **파생 상태**: 저장보다 계산 우선
- 서버 상태를 글로벌 클라이언트 스토어에 **중복 저장 금지**

---

## 스타일링 규칙

- **Tailwind CSS** 클래스 기반 스타일링 (인라인 CSS / `<style>` 태그 금지)
- `class:` 구문을 삼항 연산자 대신 우선 사용

---

## 성능 우선순위

| 순위 | 항목 | 설명 |
|------|------|------|
| 1 | async 워터폴 제거 | 순차 비동기 호출을 병렬로 전환 |
| 2 | 번들/로드 비용 절감 | 코드 스플리팅, 트리 셰이킹 |
| 3 | 데이터 흐름 최적화 | 서버/클라이언트 데이터 경계 정비 |
| 4 | 리렌더 미세 최적화 | `useMemo/useCallback`은 측정 가능한 효과가 있을 때만 |

---

## 코딩 스타일

- `const` 기반 함수 선언: `const toggle = () => { ... }`
- **Early return** 패턴으로 가독성 확보
- 이벤트 핸들러는 `handle` 접두사: `handleClick`, `handleKeyDown`
- 서술적인 변수/함수명 사용

---

## 에러 처리

- **Error Boundary**: 페이지/기능 단위로 `ErrorBoundary`를 배치하여 부분 장애 격리
- **Suspense**: 비동기 로딩 시 `<Suspense fallback={...}>`으로 로딩 상태 명시
- Error Boundary + Suspense 조합으로 로딩/에러 상태를 선언적으로 관리
- 전역 에러 핸들러보다 **경계 단위 처리** 우선

---

## 테스트 규칙

### 테스트 구조

- 파일명: `{대상}.test.tsx` 또는 `{대상}.test.ts`
- `describe` → `it` 구조로 그룹핑
- **Arrange-Act-Assert** 패턴 사용

### 테스트 원칙

- 컴포넌트 테스트: **React Testing Library** (`render`, `screen`, `userEvent`)
- 훅 테스트: `renderHook` + `act`
- API 모킹: **MSW** (Mock Service Worker) — `fetch`/`axios` 직접 모킹 금지
- 사용자 관점 테스트: 구현 세부사항(`state`, `ref`) 대신 **화면에 보이는 요소** 기준
- `getByRole`, `getByLabelText` 우선 → `getByTestId`는 최후 수단

### Assertions

- Vitest `expect` 사용: `expect(element).toBeInTheDocument()`
- 비동기: `await waitFor(() => expect(...))` 또는 `findBy*` 쿼리
- 이벤트: `await userEvent.click(button)` (fireEvent보다 userEvent 우선)

### 실행

- 단일 테스트: `npx vitest run {파일경로}`
- 전체: `npx vitest run`
- 감시 모드: `npx vitest`
- 실패 시 에러 메시지와 렌더링 결과(`screen.debug()`) 분석 후 원인 파악

---

## 리뷰 품질

- 변경 의도, 영향 범위, 검증 결과를 보고한다.
- 회귀 가능성이 높은 변경은 체크 포인트를 남긴다.
