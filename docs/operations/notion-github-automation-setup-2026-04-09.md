# Notion + GitHub Automation Setup

작성일: 2026-04-09
프로젝트: `lol-esports-manager`

## 목적

이 문서는 GitHub Actions와 Notion API를 연결해서 아래 정보를 자동으로 기록하기 위한 설정 가이드다.

- 해야 할 작업 리스트
- 개발 로그
- 패치 노트
- 프로젝트 설명

## 이번 자동화에 포함된 파일

- `.github/workflows/notion-sync.yml`
- `scripts/notion-sync.mjs`
- `docs/operations/notion-project-description-seed-2026-04-09.md`

## 권장 Notion 데이터베이스

노션에 아래 4개의 데이터베이스를 만들어 두는 것을 권장한다.

### 1. Task DB

권장 속성:

- `Name` - Title
- `Status` - Select
- `Priority` - Select
- `Area` - Select
- `Source` - Select
- `Summary` - Text
- `Tags` - Multi-select
- `URL` - URL
- `Date` - Date

### 2. Dev Log DB

권장 속성:

- `Name` - Title
- `Type` - Select
- `Status` - Select
- `Source` - Select
- `Repository` - Text
- `Branch` - Text
- `Summary` - Text
- `Tags` - Multi-select
- `URL` - URL
- `Date` - Date

### 3. Patch Notes DB

권장 속성:

- `Name` - Title
- `Version` - Text
- `Status` - Select
- `Type` - Select
- `Repository` - Text
- `Summary` - Text
- `Tags` - Multi-select
- `URL` - URL
- `Date` - Date

### 4. Projects DB

권장 속성:

- `Name` - Title
- `Status` - Select
- `Type` - Select
- `Repository` - Text
- `Summary` - Text
- `Tags` - Multi-select
- `URL` - URL
- `Date` - Date

## Notion Integration 생성

1. Notion integration 생성
2. API secret 복사
3. 위 4개 데이터베이스에 integration을 초대
4. 각 데이터베이스의 ID 복사

공식 문서:

- https://developers.notion.com/docs/create-a-notion-integration

## GitHub Secrets 등록

GitHub 저장소의 `Settings -> Secrets and variables -> Actions`에 아래 값을 등록한다.

- `NOTION_TOKEN`
- `NOTION_TASKS_DATABASE_ID`
- `NOTION_DEVLOG_DATABASE_ID`
- `NOTION_PATCH_NOTES_DATABASE_ID`
- `NOTION_PROJECTS_DATABASE_ID`

## 자동화 동작 방식

### Push

브랜치에 푸시하면 Dev Log DB에 아래 내용이 기록된다.

- 브랜치명
- 커밋 메시지 목록
- 변경 파일 목록
- 비교 URL
- 커밋 타입 태그

### Pull Request

PR이 열리거나 업데이트되면 Dev Log DB에 기록된다.

PR이 처음 열릴 때는 Task DB에도 1개 항목이 생성된다.

### Release

GitHub Release가 publish되면 Patch Notes DB에 릴리스 기록이 생성된다.

### Workflow Dispatch

수동 실행으로 두 가지 모드를 쓸 수 있다.

- `manual_snapshot`
- `project_summary`

`project_summary`를 실행하면 `docs/operations/notion-project-description-seed-2026-04-09.md` 내용을 Projects DB에 시드 페이지로 생성한다.

## 추천 사용 순서

1. Notion DB 4개 생성
2. Integration 생성 및 DB 공유
3. GitHub secrets 등록
4. `workflow_dispatch -> project_summary` 한 번 실행
5. 이후 push / PR / release로 자동 기록 확인

## 추천 추가 규칙

자동 기록 품질을 높이려면 커밋 메시지를 아래 형식으로 통일하는 게 좋다.

- `feat: ...`
- `fix: ...`
- `refactor: ...`
- `test: ...`
- `chore: ...`

이 규칙을 쓰면 Notion에 들어가는 태그와 작업 분류가 더 깔끔해진다.

## 추가로 있으면 좋은 것

현재 요구한 3개 외에 아래 하나를 더 두는 걸 강하게 추천한다.

- `Dev Log DB`

이게 있어야 나중에

- 언제 무엇을 고쳤는지
- 어떤 브랜치에서 어떤 패치를 했는지
- 특정 릴리스 전후 작업 흐름이 어땠는지

를 복기하기 훨씬 쉽다.

## 운영 팁

- Task DB는 사람이 읽고 정리하는 공간
- Dev Log DB는 GitHub 이벤트를 자동 누적하는 공간
- Patch Notes DB는 사용자 공개용 변경 내역 정리 공간
- Projects DB는 팀/프로젝트 설명과 현재 방향을 보여주는 공간

이렇게 역할을 분리하면 노션이 훨씬 안 꼬인다.
