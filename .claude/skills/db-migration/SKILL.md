---
name: db-migration
description: DB 마이그레이션 SQL 생성. 새 테이블/컬럼 추가 시 SQL 파일 + lib.rs 등록까지 자동 처리.
---

# DB Migration Skill

> 새 DB 마이그레이션을 프로젝트 패턴에 맞게 생성하는 스킬.

---

## 언제 사용하나

- 새 테이블을 추가할 때
- 기존 테이블에 컬럼을 추가할 때
- 인덱스, 제약조건을 변경할 때

---

## 실행 순서

### 1. 다음 번호 확인

`src-tauri/migrations/` 디렉토리에서 가장 높은 번호를 확인하고 +1한다.

```bash
ls src-tauri/migrations/ | sort -r | head -1
```

### 2. SQL 파일 생성

`src-tauri/migrations/NNN_description.sql` 파일을 생성한다.

**명명 규칙**: `{3자리숫자}_{snake_case_설명}.sql`

**SQL 작성 규칙**:
- `CREATE TABLE IF NOT EXISTS` 사용 (멱등성 보장)
- `ALTER TABLE` 시 컬럼 존재 여부 체크 불가하므로 주석으로 명시
- 외래 키는 `REFERENCES` + `ON DELETE` 정책 명시
- 인덱스는 테이블 생성 직후 같은 파일에 포함

### 3. lib.rs에 마이그레이션 등록

`src-tauri/src/lib.rs`의 `migrations` 벡터 끝에 새 항목을 추가한다.

```rust
Migration {
    version: NNN,
    description: "설명 (영문)",
    sql: include_str!("../migrations/NNN_description.sql"),
    kind: MigrationKind::Up,
},
```

### 4. TypeScript 타입 안내

마이그레이션과 대응하는 TypeScript 작업을 안내한다:
- `src/types/` — 새 테이블에 대응하는 타입 인터페이스 생성/수정
- `src/db/` — CRUD 쿼리 함수 생성/수정
- `src/types/index.ts` — 새 타입 re-export 추가

---

## 참고 파일

| 파일 | 역할 |
|------|------|
| `src-tauri/migrations/*.sql` | 기존 마이그레이션 (패턴 참조) |
| `src-tauri/src/lib.rs` | 마이그레이션 등록부 |
| `src/types/` | TypeScript 타입 정의 |
| `src/db/` | DB 쿼리 함수 |

---

## SQL 템플릿

### 새 테이블

```sql
-- NNN: {설명}
CREATE TABLE IF NOT EXISTS {table_name} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    save_id INTEGER NOT NULL,
    -- 컬럼들
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (save_id) REFERENCES save_metadata(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_{table_name}_save_id ON {table_name}(save_id);
```

### 컬럼 추가

```sql
-- NNN: {설명}
ALTER TABLE {table_name} ADD COLUMN {column_name} {TYPE} {DEFAULT};
```

---

## 결과 보고 형식

```
## 마이그레이션 생성 완료
- 파일: src-tauri/migrations/NNN_description.sql
- 등록: src-tauri/src/lib.rs (version NNN)
- 후속 작업: (타입/쿼리 파일 생성 필요 여부)
```
