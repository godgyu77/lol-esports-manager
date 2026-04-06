# Manager Staff QA Checklist

## 새 게임 시작
- 매니저 모드로 새 게임을 시작한다.
- 팀 선택 직후 유저 팀의 기존 감독이 더 이상 팀 소속으로 남아 있지 않은지 확인한다.
- 다른 NPC 팀들은 감독 1명과 코치진을 보유한 상태로 시작하는지 확인한다.

## 스태프 화면
- [`StaffView`](/C:/Users/user/Desktop/KANG/Study/project/lol-esports-manager/src/features/manager/pages/StaffView.tsx) 상단에 `현재 감독은 당신입니다` 배너가 보이는지 확인한다.
- 유저 팀 화면에 별도 감독 고용 슬롯이 없는지 확인한다.
- 현재 코치진과 지원 스태프가 분리되어 보이는지 확인한다.

## FA 시장
- FA 시장을 열었을 때 `코치 선호`, `감독 출신`, `기타 스태프` 필터가 동작하는지 확인한다.
- 감독 출신 후보에게 `코치 제안`이 가능한지 확인한다.
- 후보 카드에 `선호 역할`, `역할 성향`, `수락 가능성`, `주요 사유`가 보이는지 확인한다.

## 제안 판정
- 감독 출신 후보에게 코치 제안을 했을 때 일부 후보는 거절하는지 확인한다.
- 일반 코치 후보는 감독 출신보다 평균적으로 수락 가능성이 높게 보이는지 확인한다.
- 팀 성적이 좋은 저장과 나쁜 저장에서 동일 후보의 제안 결과가 달라지는지 확인한다.

## 진행 화면
- [`DayView`](/C:/Users/user/Desktop/KANG/Study/project/lol-esports-manager/src/features/manager/pages/DayView.tsx) 에서 `하루 진행`이 가장 먼저 보이는 주 CTA인지 확인한다.
- `다음 경기까지 자동 진행`이 보조 CTA로 읽히는지 확인한다.
- 오늘의 핵심 일정, 가장 큰 리스크, 다음 경기까지 남은 시간이 상단에서 바로 보이는지 확인한다.

## 로스터 스왑
- [`RosterTab`](/C:/Users/user/Desktop/KANG/Study/project/lol-esports-manager/src/features/manager/pages/roster/RosterTab.tsx) 에서 선수 1명을 고르면 선택 상태가 상단 안내로 고정되는지 확인한다.
- 다른 군의 선수를 눌렀을 때 예상 주전 평균 변화와 리스크가 보이는지 확인한다.
- 같은 선수를 다시 누르면 선택이 취소되는지 확인한다.

## 드래프트 스왑
- [`DraftView`](/C:/Users/user/Desktop/KANG/Study/project/lol-esports-manager/src/features/draft/DraftView.tsx) 스왑 단계에서 마지막 확인용 안내 문구가 보이는지 확인한다.
- 카드 선택 후 다른 카드를 눌렀을 때 챔피언 스왑이 정상 적용되는지 확인한다.
- 최종 확정 후 라이브 매치로 자연스럽게 넘어가는지 확인한다.

## 밸런싱 메모
- 감독 출신 후보가 코치 제안을 너무 자주 수락하면 `역할 불일치 패널티`를 더 키운다.
- 너무 자주 거절하면 `팀 명성`과 `철학 정렬 보너스`를 조금 높인다.
- 일반 코치까지 지나치게 거절하면 `normal` 유연성 패널티를 완화한다.
