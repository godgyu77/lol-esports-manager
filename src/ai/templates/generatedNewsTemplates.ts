export type GeneratedNewsCategory = 'match' | 'transfer' | 'team' | 'scandal' | 'analysis';
export type GeneratedNewsTemplate = {
  title: string;
  content: string;
  category: GeneratedNewsCategory;
};

export const GENERATED_NEWS_TEMPLATE_ASSETS: Record<string, readonly GeneratedNewsTemplate[]> = {
  match_result: [
    { title: '{team1}, {team2} 꺾고 승리', content: '{team1}이 {team2}를 상대로 경기 전반을 잘 운영하며 승리를 거뒀다. {player}의 활약이 특히 돋보였다.', category: 'match' },
    { title: '{team1} vs {team2}, 명승부 끝에 결판', content: '치열한 접전 끝에 {team1}이 승리했다. 마지막 한타가 경기의 분수령이 됐다.', category: 'match' },
  ],
  transfer: [
    { title: '{player}, {team1}로 이적 확정', content: '{player}가 {team1}과 계약을 마치며 새 시즌 합류를 확정했다.', category: 'transfer' },
    { title: '{team1}, {player} 영입 발표', content: '{team1}이 {player} 영입을 공식 발표했다. 팬들의 기대가 커지고 있다.', category: 'transfer' },
  ],
  injury: [
    { title: '{player}, 부상으로 결장 전망', content: '{team1}의 {player}가 부상으로 당분간 경기에 나서지 못할 전망이다.', category: 'team' },
    { title: '{team1}, {player} 부상에 비상', content: '{player}의 이탈 가능성이 제기되며 {team1}의 로스터 운용에 부담이 커졌다.', category: 'team' },
  ],
  milestone: [
    { title: '{player}, 통산 {detail} 달성', content: '{player}가 의미 있는 개인 기록을 세우며 다시 한번 존재감을 증명했다.', category: 'analysis' },
    { title: '대기록 작성한 {player}', content: '{player}가 새로운 이정표를 세우며 팬들의 박수를 받았다.', category: 'analysis' },
  ],
  scandal: [
    { title: '{team1}, 외부 논란 휩싸여', content: '{team1}를 둘러싼 논란이 커지며 커뮤니티와 미디어의 시선이 집중되고 있다.', category: 'scandal' },
    { title: '{player} 관련 루머 확산', content: '{player}를 둘러싼 각종 루머가 퍼지며 팀 분위기에도 영향을 줄 수 있다는 우려가 나온다.', category: 'scandal' },
  ],
};
