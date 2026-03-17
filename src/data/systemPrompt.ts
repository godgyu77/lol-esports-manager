/**
 * AI 시뮬레이션 엔진용 시스템 프롬프트 & 게임 상수
 * - Ollama 로컬 LLM에 전달할 시뮬레이션 규칙
 * - 게임 밸런스 상수 (재정, 경기, 성장 등)
 */

// ───────────────────────────────────────────────────
// 재정 시스템 상수
// ───────────────────────────────────────────────────
export const FINANCIAL_CONSTANTS = {
  /** 리그 공통 선수 연봉 총합 상한 (억 원) — 전 팀 동일 적용 */
  salaryCap: 40,
  /** 재정 티어별 연간 수입 범위 (억 원) — rosterDb.annualSupport의 유효 범위 */
  tierSupport: {
    S: { min: 48, max: 70 },
    A: { min: 28, max: 48 },
    B: { min: 16, max: 28 },
    C: { min: 10, max: 16 },
  },
  /** 수입원 */
  revenue: {
    prizePool: '대회 상금',
    sponsorship: '스폰서십',
    merchandise: '굿즈 판매',
    streaming: '스트리밍 수입',
    playerSale: '선수 이적료',
  },
  /** 지출 항목 */
  expenses: {
    salary: '선수 연봉',
    coaching: '코칭스태프 급여',
    facility: '시설 운영비',
    transfer: '이적료',
    penalty: '벌금/위약금',
  },
} as const;

// ───────────────────────────────────────────────────
// 경기 시뮬레이션 상수
// ───────────────────────────────────────────────────
export const MATCH_CONSTANTS = {
  /** 경기 시간 범위 (분) */
  gameDuration: { min: 25, max: 45 },
  /** 라인전 종료 시점 (분) */
  laningPhaseEnd: 15,
  /** OVR 등급 → 수치 변환 */
  ovrToNumber: {
    'S+': 97, 'S': 95, 'S-': 92,
    'A+': 89, 'A': 86, 'A-': 83,
    'B+': 79, 'B': 75, 'B-': 71,
    'C+': 67, 'C': 63, 'C-': 59,
    'D': 50,
  } as Record<string, number>,
  /** 포지션별 경기 영향도 가중치 */
  positionWeight: {
    top: 0.18,
    jungle: 0.22,
    mid: 0.22,
    adc: 0.20,
    support: 0.18,
  },
  /** 시너지/트레이트 영향도 */
  traitImpact: {
    S: 0.08,
    A: 0.05,
    B: 0.03,
    C: 0.01,
    NEG: -0.04,
  },
} as const;

// ───────────────────────────────────────────────────
// 선수 성장/퇴화 시스템
// ───────────────────────────────────────────────────
export const GROWTH_CONSTANTS = {
  /** 포지션별 최적 나이 범위 */
  peakAge: {
    top: { start: 21, end: 26 },
    jungle: { start: 21, end: 25 },
    mid: { start: 20, end: 25 },
    adc: { start: 20, end: 25 },
    support: { start: 22, end: 28 },
  },
  /** 성장률 (시즌당) */
  growthRate: {
    beforePeak: { min: 1, max: 5 },
    atPeak: { min: -1, max: 2 },
    afterPeak: { min: -5, max: -1 },
  },
  /** 멘탈 영향 요인 */
  mentalFactors: {
    winStreak: 2,
    lossStreak: -3,
    teamConflict: -5,
    goodRelationship: 1,
    injury: -8,
  },
} as const;

// ───────────────────────────────────────────────────
// 리그 시스템
// ───────────────────────────────────────────────────
export const LEAGUE_CONSTANTS = {
  LCK: {
    name: 'League of Legends Champions Korea',
    teams: 10,
    format: 'Bo3',
    splits: 2,
    worldsSlots: 4,
  },
  LPL: {
    name: 'League of Legends Pro League',
    teams: 14,
    format: 'Bo3',
    splits: 2,
    worldsSlots: 4,
  },
  LEC: {
    name: 'League of Legends EMEA Championship',
    teams: 10,
    format: 'Bo3',
    splits: 2,
    worldsSlots: 3,
  },
  LCS: {
    name: 'League of Legends Championship Series',
    teams: 8,
    format: 'Bo3',
    splits: 2,
    worldsSlots: 3,
  },
} as const;

// ───────────────────────────────────────────────────
// AI 시뮬레이션 시스템 프롬프트
// ───────────────────────────────────────────────────
export const SIMULATION_SYSTEM_PROMPT = `당신은 LoL e스포츠 매니저 시뮬레이션 게임의 AI 엔진입니다.

## 역할
- 경기 결과를 시뮬레이션합니다
- 선수 성장/퇴화를 계산합니다
- 이적 시장을 관리합니다
- 팀 시너지와 케미를 평가합니다
- 시즌 이벤트를 생성합니다

## 경기 시뮬레이션 규칙

### 1. 라인전 (0~15분)
- 각 포지션의 1:1 대결을 시뮬레이션
- 주요 지표: CSD@15, GD@15, XPD@15, 솔로킬, 퍼스트블러드
- 정글러의 갱킹 빈도와 성공률이 라인전에 영향
- 트레이트 'LANE_KINGDOM'은 라인전 우위 확률 +15%

### 2. 중반 (15~25분)
- 팀 합류 능력과 오브젝트 컨트롤
- 주요 지표: 팀파이트 승률, 드래곤/리프트헤럴드 확보
- 트레이트 'COMMANDER'가 있는 선수의 팀은 오브젝트 컨트롤 +10%

### 3. 후반 (25분+)
- 바론/엘더 드래곤 싸움
- 집단전 역량이 중요
- 트레이트 'CLUTCH'는 50:50 상황에서 승률 +12%
- 트레이트 'THROWING'은 유리한 상황에서 던질 확률 +15%

### 4. 결과 산출
- 팀 종합 OVR, 시너지, 트레이트, 컨디션을 종합하여 승률 계산
- 업셋 확률: OVR 차이가 10 이상이면 약팀 승률 최소 15% 보장
- BO3/BO5 포맷에서는 멘탈과 체력이 후반 세트에 영향

## 이적 시장 규칙
- FA 자유계약 / 트레이드 / 바이아웃 3가지 방식
- 선수 가치 = (OVR × 나이계수 × 잠재력 × 인기도) 기반
- 연봉은 선수 가치에 비례하되 연봉 상한(${FINANCIAL_CONSTANTS.salaryCap}억) 이내
- 트레이트 'FRANCHISE_STAR'는 이적료 +30%, 팬 유입 효과

## 선수 성장 규칙
- 시즌마다 스탯 변동 (성장기/전성기/하락기)
- 훈련, 경기 경험, 멘탈 상태가 성장에 영향
- 트레이트 'GROWTH_POTENTIAL'은 성장률 +50%
- 트레이트 'GLASS_MENTAL'은 패배 시 멘탈 하락 2배

## 시너지 시스템
- 같은 국적 선수 2명 이상: 소통 시너지 +3%
- 전 팀 동료: 케미 시너지 +2%
- 라이벌 관계: 경쟁 시너지 (성과 향상 or 팀워크 하락)
- 세대 갈등: 베테랑 + 루키 혼합 시 적응 기간 필요

응답은 항상 JSON 형식으로 반환합니다.`;

// ───────────────────────────────────────────────────
// 선수 모드 AI 프롬프트
// ───────────────────────────────────────────────────
export const PLAYER_MODE_PROMPT = `당신은 LoL 프로 선수 시뮬레이션의 AI 코치/내레이터입니다.

## 역할
- 선수의 하루 일과에 따른 이벤트를 생성합니다
- 팀원/코치와의 관계 이벤트를 관리합니다
- 솔로랭크/스크림 결과를 시뮬레이션합니다
- 선수 커리어 이벤트(MVP, 올스타, 이적 제안 등)를 생성합니다

## 일과별 효과
- 솔로랭크(아침): 기계적 숙련도 +1~3, 체력 -5
- VOD 리뷰(아침): 게임 이해도 +2~4, 체력 -3
- 휴식(아침): 체력 +10, 사기 +3
- 팀 연습(오후): 팀워크 +2~4, 체력 -8
- 개인 훈련(오후): 라인전/공격성 +1~3, 체력 -5
- 스트리밍(오후): 인기도 +3~5, 스트리밍 수입 +, 체력 -3
- 팀 저녁(저녁): 팀원 친밀도 +2~5
- 개인 시간(저녁): 체력 +5, 사기 +2
- 미팅 요청(저녁): 코치/팀원과 특수 이벤트 트리거

응답은 항상 JSON 형식으로 반환합니다.`;
