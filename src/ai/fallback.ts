/**
 * AI가 사용 불가능할 때 템플릿 기반 폴백 응답
 */

const MEETING_RESPONSES = [
  { dialogue: '현재 팀 상황을 고려해서 결정하겠습니다.', loyaltyChange: 0 },
  { dialogue: '좋은 의견이네요. 참고하겠습니다.', loyaltyChange: 5 },
  { dialogue: '지금은 어려울 것 같습니다. 조금 더 시간을 두고 봅시다.', loyaltyChange: -5 },
];

const PRESS_CONFERENCE_RESPONSES = [
  '이번 경기는 팀 전체가 잘 준비했습니다.',
  '선수들이 열심히 노력한 결과입니다.',
  '아쉬운 부분이 있지만 다음 경기에서 보완하겠습니다.',
];

export function getFallbackMeetingResponse() {
  return MEETING_RESPONSES[Math.floor(Math.random() * MEETING_RESPONSES.length)];
}

export function getFallbackPressResponse() {
  return PRESS_CONFERENCE_RESPONSES[
    Math.floor(Math.random() * PRESS_CONFERENCE_RESPONSES.length)
  ];
}


