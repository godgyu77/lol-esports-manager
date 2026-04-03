# EA Manual QA Scenarios

작성일: 2026-04-03

## Scenario 1. Core Manager Loop

1. 매니저 모드로 새 게임 시작
2. DayView에서 오늘 할 일, 다음 경기, 코치 조언 확인
3. Training/Tactics/News/Inbox/Transfer 진입 후 다시 DayView 복귀
4. 3일 진행
5. 에러 로그, 포커스 손실, 날짜 불일치 여부 확인

## Scenario 2. Match Preparation to Result

1. PreMatchView 진입
2. LoL 운영 브리프의 패치/스크림/밴픽/코치/서사 카드 확인
3. Draft 진입 후 추천 밴과 실제 선택 비교
4. Live Match 진행
5. 방송 스토리, 오브젝트 타이밍, 해설 문구, 결과 저장 반영 확인

## Scenario 3. Save / Load / Autosave

1. 수동 저장 슬롯 생성
2. Day 진행 후 자동 저장 생성 확인
3. 메인 메뉴 또는 Save/Load에서 수동 저장 로드
4. 팀, 날짜, 시즌, 보유 자금, pending match 상태 복원 확인
5. 깨진 세이브 유도 시 로드 차단 메시지 확인

## Scenario 4. Season End / Offseason / Next Season

1. 시즌 종료 직전 세이브 로드
2. SeasonEndView에서 정규 시즌 종료 처리
3. 전체 시즌 종료 처리 후 다음 시즌 정보 확인
4. 오프시즌 단계가 `이적 기간 -> 로스터 확정 -> 프리시즌`으로 이동하는지 확인
5. 다음 시즌 시작 후 새 시즌 일정과 저장 상태 확인

## Scenario 5. Accessibility Pass

1. 마우스 없이 메인 루프 순회
2. News/Inbox 필터와 기사 선택을 키보드만으로 조작
3. reduced motion 환경 켜고 Day/News/Live Match 진입
4. 포커스 링과 선택 상태가 항상 보이는지 확인

## Scenario 6. Regression Sweep

1. 계약/이적 제안 수락/거절/카운터 확인
2. 샐러리캡/보드 압박 카드 확인
3. 스태프 화면 역할/보너스 요약 확인
4. 뉴스 날짜가 게임 날짜와 일치하는지 확인
