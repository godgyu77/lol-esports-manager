---
name: add-feature
description: UI 기능 추가 스캐폴딩. 새 페이지/화면을 프로젝트 패턴에 맞게 생성.
---

# Add Feature Skill

> 새로운 UI 기능(페이지/화면)을 프로젝트 패턴에 맞게 스캐폴딩하는 스킬.

---

## 언제 사용하나

- 새로운 페이지/화면을 추가할 때
- 기존 페이지에 새로운 탭/섹션을 추가할 때

---

## 실행 순서

### 1. 기존 패턴 확인

유사한 기존 feature 모듈을 참조한다.

```
src/features/{기능명}/
├── {기능명}Page.tsx       # 메인 페이지 컴포넌트
├── components/           # 하위 컴포넌트
│   ├── {Sub}Section.tsx
│   └── {Sub}Card.tsx
├── hooks/               # 기능 전용 훅 (있는 경우)
└── utils/               # 기능 전용 유틸 (있는 경우)
```

**참조할 기존 feature 예시**:
- `src/features/player/` — 선수 관리 (목록 + 상세)
- `src/features/transfer/` — 이적 시장 (탭 구조)
- `src/features/match/` — 경기 화면 (실시간 상태)

### 2. 페이지 컴포넌트 생성

`src/features/{기능명}/{기능명}Page.tsx`

```tsx
const {기능명}Page = () => {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{페이지 제목}</h1>
      {/* 컨텐츠 */}
    </div>
  )
}

export default {기능명}Page
```

**규칙**:
- 함수형 컴포넌트 (const 선언)
- Tailwind CSS 클래스 기반 스타일링
- 복잡한 로직은 커스텀 훅으로 분리
- 접근성(a11y): tabindex, aria-label 포함

### 3. 라우터 등록

`src/` 내 라우터 설정 파일에 새 페이지를 등록한다.

- 라우터 파일 확인: `Grep: createBrowserRouter|Route|path`
- lazy import로 코드 스플리팅 적용

### 4. 사이드바/네비게이션 등록

`src/components/layout/` 내 사이드바 컴포넌트에 메뉴 항목을 추가한다.

### 5. Store 연동 (필요 시)

기존 Zustand Store(`src/stores/`)를 활용하거나, 기능 전용 상태가 필요하면 새 Store를 생성한다.

**상태 관리 경계**:
- 서버 데이터(DB) → `src/db/` 쿼리로 직접 조회
- UI 상태 → Zustand Store
- 파생 상태 → 저장보다 계산 우선

### 6. 엔진 연동 (필요 시)

게임 로직이 필요하면 `src/engine/` 의 기존 엔진을 import하여 사용한다.
새 엔진이 필요하면 `new-engine` 스킬을 사용한다.

---

## 체크리스트

- [ ] `src/features/{기능명}/` 디렉토리 생성
- [ ] 메인 페이지 컴포넌트 작성
- [ ] 하위 컴포넌트 분리 (필요 시)
- [ ] 라우터 등록
- [ ] 사이드바/네비게이션 메뉴 추가
- [ ] Store 연동 (필요 시)
- [ ] 엔진 연동 (필요 시)
- [ ] `tsc --noEmit` 타입체크 통과

---

## 결과 보고 형식

```
## 기능 추가 완료
- 기능: {기능명}
- 경로: /features/{기능명}
- 생성 파일:
  - src/features/{기능명}/{기능명}Page.tsx
  - (추가 파일들)
- 라우터: {경로} 등록 완료
- 후속 작업: (데이터 연동, 스타일 보완 등)
```
