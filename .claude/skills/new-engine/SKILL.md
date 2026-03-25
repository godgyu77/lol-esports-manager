---
name: new-engine
description: 게임 엔진 시스템 스캐폴딩. 새 시스템 모듈을 프로젝트 패턴에 맞게 생성.
---

# New Engine System Skill

> 새로운 게임 엔진 시스템을 프로젝트 패턴에 맞게 스캐폴딩하는 스킬.

---

## 언제 사용하나

- 새로운 게임 시스템(예: 팬 시스템, 방송 시스템 등)을 추가할 때
- 기존 시스템을 분리하여 독립 모듈로 만들 때

---

## 실행 순서

### 1. 기존 패턴 확인

유사한 기존 엔진 모듈을 참조하여 패턴을 파악한다.

```
src/engine/{시스템명}/
├── {시스템명}Engine.ts    # 핵심 로직 (메인 엔진)
├── {시스템명}Engine.test.ts  # 테스트 (있는 경우)
└── (보조 파일들)
```

**참조할 기존 모듈 예시**:
- 간단한 시스템: `src/engine/injury/`, `src/engine/rivalry/`
- 복잡한 시스템: `src/engine/match/`, `src/engine/player/`
- DB 연동: `src/engine/training/`, `src/engine/scouting/`

### 2. 디렉토리 및 파일 생성

`src/engine/{시스템명}/` 디렉토리를 생성하고 아래 파일을 만든다:

#### 메인 엔진 파일: `{시스템명}Engine.ts`

```typescript
// src/engine/{시스템명}/{시스템명}Engine.ts

import type { Database } from '@tauri-apps/plugin-sql'

/**
 * {시스템 설명}
 */

// --- 상수 ---

// --- 핵심 함수 ---

export const {시스템명}Engine = {
  // public API
}
```

**코딩 규칙**:
- `const` 기반 함수 선언
- DB 의존 함수는 `db: Database` 파라미터 수신
- save_id 기반 데이터 격리
- 파라미터 바인딩으로 SQL 인젝션 방지

### 3. 타입 정의

`src/types/{시스템명}.ts` 파일을 생성하고 `src/types/index.ts`에서 re-export한다.

```typescript
// src/types/{시스템명}.ts
export interface {SystemType} {
  id: number
  saveId: number
  // 필드들
}
```

### 4. DB 쿼리 (필요 시)

`src/db/{시스템명}Queries.ts` 파일을 생성한다.

```typescript
// src/db/{시스템명}Queries.ts
import type { Database } from '@tauri-apps/plugin-sql'

export const {시스템명}Queries = {
  // CRUD 함수
}
```

### 5. 마이그레이션 (필요 시)

DB 테이블이 필요하면 `db-migration` 스킬을 사용하여 마이그레이션을 생성한다.

### 6. 시즌 엔진 연동

시즌 진행과 연동이 필요하면 `src/engine/season/` 또는 관련 일간 처리 로직에 호출부를 추가한다.

---

## 체크리스트

- [ ] `src/engine/{시스템명}/` 디렉토리 생성
- [ ] 메인 엔진 파일 작성
- [ ] `src/types/{시스템명}.ts` 타입 정의 + index.ts re-export
- [ ] DB 테이블 필요 시 마이그레이션 생성
- [ ] DB 쿼리 파일 생성 (필요 시)
- [ ] 시즌 엔진 연동 (필요 시)
- [ ] `tsc --noEmit` 타입체크 통과

---

## 결과 보고 형식

```
## 엔진 시스템 생성 완료
- 시스템: {시스템명}
- 생성 파일:
  - src/engine/{시스템명}/{시스템명}Engine.ts
  - src/types/{시스템명}.ts
  - (추가 파일들)
- 연동: (시즌 엔진 연동 여부)
- 후속 작업: (UI 연동, 테스트 추가 등)
```
