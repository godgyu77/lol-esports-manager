export const MATCH_RESULT_NEWS_TEMPLATES = {
  titles: [
    '{winner}, {loser}를 {winScore}:{loseScore}으로 꺾다',
    '{winner}, 강한 운영으로 {loser} 제압',
    '{loser}, {winner}에 {loseScore}:{winScore}으로 패배',
  ],
  contents: [
    '{date}, {winner}가 {loser}를 {winScore}:{loseScore}으로 물리쳤다.',
    '{winner}가 경기 전반을 주도하며 {loser}를 {winScore}:{loseScore}으로 마무리했다.',
    '{loser}가 {winner}의 흐름을 끊지 못하며 {winScore}:{loseScore}으로 패배했다.',
  ],
};

export const TRANSFER_RUMOR_NEWS_TEMPLATES = {
  titles: [
    '{teamName}, {playerName} 영입 검토 중',
    '{playerName}, {teamName} 레이더에 포착',
    '{teamName}, {playerName} 이적 타진 예상',
  ],
  contents: [
    '{teamName}이(가) {playerName} 영입을 검토하고 있다는 소식이 전해졌다.',
    '{playerName}이(가) {teamName}의 잠재적 영입 타깃으로 떠올랐다.',
    '업계 관계자에 따르면 {teamName}과 {playerName} 사이에 초기 접촉이 있었던 것으로 알려졌다.',
  ],
};

export const TEAM_ANALYSIS_NEWS_TEMPLATES = {
  strong: [
    {
      title: '[분석] {teamName}, {standing} 위치 굳건히 유지',
      content: '{teamName}은 {wins}승 {losses}패, 승률 {winRate}%로 상위권 경쟁자로서의 면모를 이어가고 있다.',
    },
    {
      title: '[분석] {teamName}, 강세 지속',
      content: '{teamName}이 {wins}승 {losses}패 기록을 유지하며 로스터 전반에 걸쳐 균형 잡힌 폼을 이어가고 있다.',
    },
  ],
  weak: [
    {
      title: '[분석] {teamName}, 해법을 찾지 못하다',
      content: '{teamName}은 현재 {wins}승 {losses}패, 승률 {winRate}%로 개선이 시급한 상황이다.',
    },
    {
      title: '[분석] {teamName}, 반등이 필요한 시점',
      content: '{teamName}이 {standing}까지 밀려나며 불안정한 경기력을 빠르게 바로잡아야 한다.',
    },
  ],
  mid: [
    {
      title: '[분석] {teamName}, 중위권에서 기회 엿봐',
      content: '{teamName}은 {wins}승 {losses}패, 승률 {winRate}%로 상위권 도약 여지를 남겨두고 있다.',
    },
    {
      title: '[분석] {teamName}, 여전히 순위권 경쟁 중',
      content: '{teamName}이 {standing}에서 경쟁력을 유지하고 있으나 순위를 올리려면 마무리가 더 강해져야 한다.',
    },
  ],
};
