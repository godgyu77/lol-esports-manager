# 코어 재미 / 장기 리텐션 / 시스템 깊이 / PC UX 작업 트래커 2026-04-15

운영 규칙
- 이 문서를 현재 우선순위 작업 기준표로 사용한다.
- 실제 코드 반영과 검증이 끝난 항목만 `[x]`로 체크한다.
- 진행 중인 항목은 `[~]`, 아직 시작 전인 항목은 `[ ]`로 둔다.
- 작업이 끝날 때마다 체크 상태와 검증 결과를 함께 갱신한다.

현재 상태 요약
- 완료: 11
- 진행 중: 0
- 대기: 1

## 1순위

- [x] 새 게임 시작 직후 샐캡 여유 확보
  - 내용: 실제 현재 페이롤과 스태프 비용을 기준으로 샐캡 최저선을 보장하고 안전 버퍼를 추가
  - 반영 파일: `src/engine/economy/payrollEngine.ts`
  - 검증: `src/engine/economy/payrollEngine.test.ts`, `npm run build`

- [x] 이적 시장 PC UX 보강
  - 목표: 샐캡 여유, 현재 시장 압박, 영입 가능 범위를 직관적으로 제시
  - 반영:
    - 이적 시장 컨텍스트 알림 추가
    - 재정/보드 압박을 반영한 협상 문구 정리
    - 샐캡 / 예상 페이롤 / 샐캡 여유 / 위험도 / 추천 행동 요약 추가
  - 검증: `src/features/manager/pages/TransferView.test.tsx`, `src/engine/economy/transferEngine.relationship.test.ts`, `npm run build`

- [x] `ManagerHome` 상단 카드 압축
  - 목표: 첫 화면에서 `지금 할 일 / 다음 경기 / 가장 큰 리스크`만 빠르게 보이게 정리
  - 반영:
    - 상단 3축 우선순위 스트립 추가
    - 메인 루프 상세 영역은 유지하되, 상단에 빠른 판단용 요약 추가
  - 검증: `src/features/manager/pages/ManagerHome.test.tsx`, `npm run build`

- [x] `ManagerDashboard` 허브 압축
  - 목표: 정보 나열보다 행동 우선 구조로 허브를 정리
  - 반영:
    - 상단 3카드 우선순위 스트립 추가
    - 경기 후속 / 다음 초점 / 최상위 리스크를 허브 첫 영역에서 노출
    - 테스트를 실제 우선순위 스트립 구조와 비동기 데이터 기준으로 재작성
  - 검증: `src/features/manager/pages/ManagerDashboard.test.tsx`, `npm run build`

- [x] 경기 결과 감정 보상 강화
  - 대상: `SeriesResult`, `PostGameStats`
  - 목표: 선수 / 라인 / 핵심 장면 중심의 서사 강화
  - 반영:
    - `SeriesResult`에 `시리즈의 얼굴` 카드 추가
    - `PostGameStats`에 선수/라인 중심 `시리즈의 얼굴` 카드 추가
    - 경기 후 감정 카드가 숫자 이전에 기억 포인트를 먼저 보여주도록 보강
  - 검증: `src/features/match/SeriesResult.test.tsx`, `src/features/match/PostGameStats.test.tsx`, `npm run build`

- [x] 뉴스 / 인박스 서사 역할 분리 강화
  - 목표: 관리 메모와 감정 서사를 분리하고, 뉴스와 인박스의 역할을 더 선명하게 만들기
  - 반영:
    - `newsEngine`에 뉴스용 서사 문단과 인박스용 관리 메모 문단을 분리
    - `LiveMatchView`에서 경기 결과 인박스 메모가 별도 관리 메모 helper를 사용하도록 변경
    - 뉴스 엔진 / 인박스 엔진 / 뉴스 / 인박스 화면 테스트를 현재 구조 기준으로 정리
  - 검증:
    - `npm test -- src/engine/news/newsEngine.test.ts src/engine/inbox/inboxEngine.test.ts src/features/manager/pages/InboxView.test.tsx src/features/manager/pages/NewsFeedView.test.tsx`
    - 결과: `27 passed`
    - `npm run build`
    - 결과: 통과

- [x] `FinanceView` 가독성 개선
  - 목표: 위험 요인, 지출 압박, 다음 권장 행동을 더 읽기 쉽게 정리
  - 반영:
    - 상단 `가장 큰 경고 / 지출 압박 / 다음 행동` 우선순위 스트립 추가
    - 활주로, 상한 여유, 주간 소모를 한 줄 요약으로 바로 읽게 정리
    - `FinanceView` 전용 테스트 추가로 재정 허브 요약 구조를 잠금
  - 검증:
    - `npm test -- src/features/manager/pages/FinanceView.test.tsx`
    - 결과: `1 passed`
    - `npm run build`
    - 결과: 통과

## 2순위

- [x] `systemDepthEngine` 장기 영향 강화
  - 목표: 이적 / 훈련 / 불만 / 보드 영향이 다음 주, 다음 달까지 더 길게 이어지게 만들기
  - 반영:
    - 반복되는 예산 압박 / 불만 / 관계 긴장 / 준비 실패는 consequence 유효기간을 더 길게 유지
    - 메인 루프 리스크에 `누적 운영 후폭풍` 요약을 추가해 여러 consequence가 다음 주까지 이어지는 상황을 상위 리스크로 노출
    - 누적 consequence가 없을 때와 있을 때의 우선순위 차이를 테스트로 잠금

- [x] `transferEngine` 후속 영향 추가
  - 목표: 협상 실패 / 성공이 보드 신뢰, 시장 평판, 선수 감정에 반영되게 만들기
  - 반영:
    - 협상 실패 시 보드/재정 압박과 라커룸 긴장을 반영한 후폭풍 문구 추가
    - 협상 실패가 `이적 협상 낭비`, `이적 협상 여진` consequence로 남도록 연결
    - 협상 성공 시 보드의 시장 주도권 평가와 팀 내부 반응을 reason으로 반환
    - 관련 aftermath 테스트 추가

- [x] `TrainingView` / `TacticsView` 시즌 누적 효과 강화
  - 목표: 경기 준비와 시즌 누적 변화가 더 직접적으로 체감되게 만들기
  - 반영:
    - `TrainingView`에 시즌 훈련 방향 / 최근 누적 변화량 / 준비 검증 상태 스트립 추가
    - `TacticsView`에 시즌 전술 방향 / 누적 준비 검증 / 현재 운영 보정 스트립 추가
    - 훈련/전술 조정이 “이번 경기”뿐 아니라 “시즌 누적 흐름”으로 읽히게 상단 요약 강화
    - 관련 화면 테스트를 현재 구조 기준으로 갱신

- [x] 첫 시즌 리텐션 장치 보강
  - 목표: 라이벌전, 반등, 스타 성장, 프랜차이즈 서사를 시즌 중반 이후까지 밀어주기
  - 반영:
    - `ManagerHome`에 `첫 시즌 몰입 포인트` 패널 추가
    - `ManagerDashboard`에 같은 축의 허브 배너 추가
    - 시즌 초반, 경기 후속, 보드 압박, 반등 흐름을 드라마형 CTA로 묶어 허브에서 바로 보이게 정리
  - 검증:
    - `npm test -- src/features/manager/pages/ManagerHome.test.tsx src/features/manager/pages/ManagerDashboard.test.tsx`
    - `npm run build`

## 보류

- [ ] 모바일 / APK 전환
  - 현재 blocker:
    - Android SDK 경로 없음 (`C:\Users\user\AppData\Local\Android\Sdk` 미설치)
    - `adb` 없음
    - Rust Android target 미설치
    - `src-tauri/gen/android` 미생성 (`tauri android init` 전)
  - 현재 확인:
    - `npx tauri android --help` 정상
    - `npx tauri android init`는 SDK 부재로 중단
    - `npm test -- src/components/MobileBottomNav.test.tsx src/ai/provider.test.ts src/ai/featurePolicy.test.ts` 통과
    - `MobileAiSetup.test.tsx` 추가로 모바일 AI 설정 분기 잠금
- [ ] 모바일 전용 UX 재설계

## 최근 완료 로그

- 2026-04-15
  - 새 게임 시작 직후 샐캡 여유 확보 완료
  - 이적 협상에 재정 압박 / 보드 압박 반영
  - 이적 화면 상단에 시장 컨텍스트와 샐캡 요약 보강
  - `ManagerHome` 상단 3축 우선순위 스트립 추가
  - `ManagerDashboard` 상단 3카드 우선순위 스트립 추가
  - `SeriesResult`, `PostGameStats`에 `시리즈의 얼굴` 카드 추가
  - 뉴스 / 인박스용 경기 결과 문단을 서사 / 관리 메모로 분리
  - `FinanceView` 상단 재정 우선순위 스트립 추가
  - `systemDepthEngine`에 누적 consequence 기반 장기 후폭풍 요약 추가
  - `transferEngine`에 협상 후폭풍 / 시장 주도권 후속 문구와 consequence 연결 추가
  - `TrainingView`, `TacticsView`에 시즌 누적 효과 스트립 추가

## 검증 기준선

- 최신 확인
  - `npm test -- src/features/manager/pages/TrainingView.test.tsx src/features/manager/pages/TacticsView.test.tsx`
  - 결과: `2 passed`
  - `npm run build`
  - 결과: 통과

## 2026-04-15 Android APK progress

- local Android toolchain prepared in workspace
  - `.android-sdk`
  - `platform-tools`
  - `platforms;android-35`
  - `build-tools;35.0.0`
  - `ndk;27.2.12479018`
- Rust Android targets installed
  - `aarch64-linux-android`
  - `armv7-linux-androideabi`
  - `i686-linux-android`
  - `x86_64-linux-android`
- `npx tauri android init` completed
- Android build blockers resolved in code/config
  - `reqwest` switched to `rustls-tls`
  - stronghold gated to desktop only
  - desktop-only capability file added for stronghold
  - Android placeholder sidecar added for `ollama`
  - Android Gradle build task now injects local SDK/NDK/JDK/Node paths
  - Tauri `beforeBuildCommand` now skips frontend rebuild during Android packaging
- current final blocker
  - Windows symlink privilege is missing
  - exact failure: `Creation symbolic link is not allowed for this system.`
  - required machine action: enable Windows Developer Mode or grant `SeCreateSymbolicLinkPrivilege`
