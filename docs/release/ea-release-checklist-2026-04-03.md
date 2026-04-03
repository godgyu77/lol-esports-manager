# EA Release Checklist

작성일: 2026-04-03

## Release Gate

- `npm run build` 통과
- `npm run test:ea` 통과
- 100시즌 자동 밸런스 시뮬레이션 통과
- 저장/불러오기 무결성 smoke test 통과
- 시즌 종료 -> 오프시즌 -> 다음 시즌 생성 smoke test 통과
- 오프시즌 단계 전이 smoke test 통과
- 핵심 루프 화면 회귀 테스트 통과

## Manual QA Freeze

- 새 게임 시작
- Day 진행 7일
- PreMatch 진입
- Draft -> Live Match -> 결과 반영
- 수동 저장 / 자동 저장 생성
- 저장 불러오기 후 DayView/ManagerHome 상태 확인
- 정규 시즌 종료 화면 진입
- 시즌 종료 처리
- 오프시즌 진입 및 단계 전이 확인
- 다음 시즌 시작 버튼 후 일정/세이브/팀 상태 확인

## Accessibility Checklist

- 키보드만으로 Day/News/Inbox/Training/Tactics/PreMatch 이동 가능
- focus-visible이 배경과 충분히 구분됨
- 주요 텍스트와 카드 대비가 4.5:1 이상 유지되는지 수동 점검
- hover만 있는 상태 전달이 없음
- reduced motion 환경에서 강한 애니메이션이 필수 정보 전달을 방해하지 않음
- Live Match HUD와 News 필터는 포커스 손실 없이 순회 가능

## Security Checklist

- 세이브 메타와 게임 DB 참조 무결성 확인
- 저장 파일 경로는 슬롯 파일명 규칙으로만 생성
- 외부 입력 기반 SQL 문자열 조합 없음
- 로컬 API 키/설정은 Stronghold 경로 유지
- save/load validation 실패 시 로딩 중단

## Performance Checklist

- 100시즌 자동 시뮬레이션 중 치명적 예외 없음
- 빌드 산출 확인
- Live Match 화면에서 오브젝트/이벤트 증가 시 렌더 블로킹 체감 여부 수동 체크
- Day 진행 시 반복 쿼리 경고/콘솔 에러 없는지 확인

## Launch Decision Rule

- 위 항목 중 `build`, `test:ea`, `save/load`, `season transition` 중 하나라도 실패하면 EA 차단
- 접근성/성능은 차단 이슈와 권장 이슈를 분리해 기록
