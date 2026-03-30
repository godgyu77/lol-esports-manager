export type CommentaryTemplate = {
  text: string;
  excitement: number;
  tone: 'neutral' | 'excited' | 'tense' | 'dramatic';
};

export const COMMENTARY_TEMPLATE_ASSETS: Record<string, readonly CommentaryTemplate[]> = {
  firstBlood: [
    { text: '퍼스트 블러드가 터졌습니다. 초반 흐름이 크게 흔들립니다.', excitement: 7, tone: 'excited' },
    { text: '첫 킬이 나왔습니다. 라인전 주도권이 완전히 바뀝니다.', excitement: 6, tone: 'tense' },
    { text: '{playerName} 선수가 퍼스트 블러드를 올립니다!', excitement: 8, tone: 'dramatic' },
  ],
  dragonKill: [
    { text: '드래곤을 확보합니다. 오브젝트 컨트롤이 좋습니다.', excitement: 5, tone: 'neutral' },
    { text: '{teamName}가 드래곤 스택을 챙깁니다.', excitement: 6, tone: 'excited' },
    { text: '상대 시야를 뚫고 드래곤까지 가져갑니다.', excitement: 7, tone: 'tense' },
  ],
  baronKill: [
    { text: '바론을 획득합니다. 경기 흐름이 크게 기울 수 있습니다.', excitement: 8, tone: 'dramatic' },
    { text: '{teamName}가 바론 버프를 손에 넣습니다!', excitement: 9, tone: 'excited' },
    { text: '바론 스틸입니다! 엄청난 판단이 나왔습니다.', excitement: 10, tone: 'dramatic' },
  ],
  teamfight: [
    { text: '대규모 한타가 열립니다! 모두의 체력이 빠집니다.', excitement: 9, tone: 'dramatic' },
    { text: '{teamName}가 한타를 열어젖힙니다!', excitement: 8, tone: 'excited' },
    { text: '순간 판단 하나가 승부를 가를 수 있는 구도입니다.', excitement: 8, tone: 'tense' },
  ],
  turretDestroy: [
    { text: '포탑이 무너집니다. 맵 장악력이 커집니다.', excitement: 5, tone: 'neutral' },
    { text: '{teamName}가 포탑 골드를 챙깁니다.', excitement: 6, tone: 'excited' },
    { text: '미드 포탑이 열리면 시야 주도권이 확 달라집니다.', excitement: 6, tone: 'tense' },
  ],
  inhibitor_destroy: [
    { text: '억제기가 파괴됩니다. 슈퍼 미니언이 밀려옵니다.', excitement: 8, tone: 'dramatic' },
    { text: '{teamName}가 억제기까지 깨면서 압박을 이어갑니다.', excitement: 8, tone: 'excited' },
    { text: '수비 쪽에서는 상당히 부담스러운 국면입니다.', excitement: 7, tone: 'tense' },
  ],
  ace: [
    { text: '에이스! 전원이 쓰러졌습니다!', excitement: 10, tone: 'dramatic' },
    { text: '{teamName}가 완벽하게 한타를 정리합니다!', excitement: 10, tone: 'excited' },
    { text: '이건 그대로 끝낼 수도 있는 장면입니다.', excitement: 10, tone: 'dramatic' },
  ],
  shutdown: [
    { text: '셔트다운 골드를 챙깁니다. 판세가 다시 흔들립니다.', excitement: 8, tone: 'tense' },
    { text: '{teamName}가 상대 캐리를 끊어냅니다!', excitement: 8, tone: 'excited' },
    { text: '큰 현상금을 회수하면서 숨통이 트입니다.', excitement: 7, tone: 'neutral' },
  ],
  pentakill: [
    { text: '펜타킬!!! 믿기 힘든 장면이 나왔습니다!', excitement: 10, tone: 'dramatic' },
    { text: '{playerName} 선수가 전장을 지배합니다. 펜타킬입니다!', excitement: 10, tone: 'dramatic' },
    { text: '관중석이 뒤집힐 만한 플레이입니다!', excitement: 10, tone: 'excited' },
  ],
};
