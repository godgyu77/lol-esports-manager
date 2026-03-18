/**
 * AI가 사용 불가능할 때 템플릿 기반 폴백 응답
 */

const MEETING_RESPONSES = [
  { dialogue: '현재 팀 상황을 고려해서 결정하겠습니다.', loyaltyChange: 0 },
  { dialogue: '좋은 의견이네요. 참고하겠습니다.', loyaltyChange: 5 },
  { dialogue: '지금은 어려울 것 같습니다. 조금 더 시간을 두고 봅시다.', loyaltyChange: -5 },
  { dialogue: '그 부분은 이미 검토 중입니다. 곧 결과를 공유하겠습니다.', loyaltyChange: 3 },
  { dialogue: '팀의 방향성과 맞는지 좀 더 논의해봐야 할 것 같습니다.', loyaltyChange: 0 },
  { dialogue: '선수들의 컨디션을 먼저 확인하고 결정하겠습니다.', loyaltyChange: 2 },
  { dialogue: '그건 어려운 요청이네요. 다른 방안을 찾아보겠습니다.', loyaltyChange: -3 },
  { dialogue: '좋은 제안입니다. 바로 실행에 옮기겠습니다.', loyaltyChange: 8 },
  { dialogue: '팀 전체의 의견을 모아서 결정하는 게 좋겠습니다.', loyaltyChange: 2 },
  { dialogue: '지금 당장은 아니지만, 다음 시즌에는 고려해보겠습니다.', loyaltyChange: -2 },
];

const PRESS_CONFERENCE_RESPONSES = [
  '이번 경기는 팀 전체가 잘 준비했습니다.',
  '선수들이 열심히 노력한 결과입니다.',
  '아쉬운 부분이 있지만 다음 경기에서 보완하겠습니다.',
  '오늘 경기에서 보여준 팀워크에 만족합니다.',
  '결과와 관계없이 선수들의 노력에 박수를 보내고 싶습니다.',
  '상대팀도 잘 했지만, 우리 선수들이 더 잘 대응했다고 생각합니다.',
  '이번 패배를 교훈 삼아 더 강해지겠습니다.',
  '팬 여러분의 응원이 큰 힘이 되었습니다. 감사합니다.',
  '지금은 한 경기 한 경기에 집중하는 것이 중요하다고 생각합니다.',
  '선수들에게 충분한 휴식을 주고 다음 경기를 준비하겠습니다.',
];

export function getFallbackMeetingResponse() {
  return MEETING_RESPONSES[Math.floor(Math.random() * MEETING_RESPONSES.length)];
}

export function getFallbackPressResponse() {
  return PRESS_CONFERENCE_RESPONSES[
    Math.floor(Math.random() * PRESS_CONFERENCE_RESPONSES.length)
  ];
}


