/**
 * 커뮤니티 소셜 반응 엔진
 * - 이적/스태프/경기 이벤트 발생 시 커뮤니티별 뉴스 + 댓글 자동 생성
 * - 인벤/디시/에펨/레딧/트위터 5개 커뮤니티
 */

import { getDatabase } from '../../db/database';
import { generateSocialReactions } from '../../ai/advancedAiService';
import type {
  CommunitySource,
  CommentSentiment,
  SocialEventType,
  SocialReaction,
  SocialComment,
} from '../../types/social';

// ─────────────────────────────────────────
// Row 매핑
// ─────────────────────────────────────────

interface ReactionRow {
  id: number;
  season_id: number;
  event_type: string;
  event_date: string;
  title: string;
  content: string;
  related_team_id: string | null;
  related_player_id: string | null;
  related_staff_id: number | null;
  community_source: string;
}

interface CommentRow {
  id: number;
  reaction_id: number;
  username: string;
  comment: string;
  likes: number;
  sentiment: string;
}

function mapRowToReaction(row: ReactionRow): SocialReaction {
  return {
    id: row.id,
    seasonId: row.season_id,
    eventType: row.event_type as SocialEventType,
    eventDate: row.event_date,
    title: row.title,
    content: row.content,
    relatedTeamId: row.related_team_id,
    relatedPlayerId: row.related_player_id,
    relatedStaffId: row.related_staff_id,
    communitySource: row.community_source as CommunitySource,
  };
}

function mapRowToComment(row: CommentRow): SocialComment {
  return {
    id: row.id,
    reactionId: row.reaction_id,
    username: row.username,
    comment: row.comment,
    likes: row.likes,
    sentiment: row.sentiment as CommentSentiment,
  };
}

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const COMMUNITIES: CommunitySource[] = ['inven', 'dcinside', 'fmkorea', 'reddit', 'twitter'];

// ─────────────────────────────────────────
// 유저네임 풀
// ─────────────────────────────────────────

const USERNAMES: Record<CommunitySource, string[]> = {
  inven: [
    'T1광팬', '롤갤주민', '젠지매니저', 'LCK올나잇', '인벤러', '탑솔장인',
    '미드핵관종', '서폿충', 'KT화이팅', '칼바람장인', '페이커팬123', '정글차이',
    'DK리빌딩', '자드장인', '실버탈출러',
  ],
  dcinside: [
    'ㅇㅇ(223.38)', 'ㅇㅇ(121.15)', '갤주', '운영자', 'ㅇㅇ(118.235)',
    '전직프로', 'ㅇㅇ(211.36)', '롤갤러', 'ㅇㅇ(49.142)', '개념글작성자',
    'ㅇㅇ(175.223)', '고닉충', 'ㅇㅇ(58.29)', '유동닉',
  ],
  fmkorea: [
    '에펨충', '핫게가자', '롤잘알', '야구민이지만', '에펨코리안',
    '일게이', '정보게이', '유머게이', '축갤러', '롤게이',
    '이것저것', '댓글장인', '정의구현',
  ],
  reddit: [
    'LCK_enjoyer', 'T1_faithful', 'GenG_fan2026', 'LPLwatcher', 'DraftAnalyst',
    'EsportsScientist', 'koreabuilds', 'MidDiffKing', 'worldschamp_hopeful',
    'SilverAnalyst99', 'ProPlayEnjoyer', 'Throwaway42069',
  ],
  twitter: [
    '@LCK_Updates', '@T1Fighting', '@esports_daily', '@lol_insider',
    '@GenG_Global', '@LoLKR_News', '@DraftKing_LOL', '@ProLeague_KR',
    '@faker_fan_acct', '@HLE_Nation', '@esport_takes',
  ],
};

// ─────────────────────────────────────────
// 댓글 템플릿
// ─────────────────────────────────────────

interface CommentTemplate {
  text: string;
  sentiment: CommentSentiment;
}

const TRANSFER_OFFICIAL_COMMENTS: Record<CommunitySource, CommentTemplate[]> = {
  inven: [
    { text: '[속보] {player} 오피셜ㄷㄷ', sentiment: 'hype' },
    { text: 'ㅋㅋ 이거 실화냐', sentiment: 'hype' },
    { text: '역대급 영입이다', sentiment: 'positive' },
    { text: '와 {team} 올해 진심이네', sentiment: 'positive' },
    { text: '{player} 폼 되돌아오면 사기인데', sentiment: 'positive' },
    { text: '이건 좀 아닌 것 같은데...', sentiment: 'negative' },
    { text: '연봉이 궁금하다', sentiment: 'neutral' },
    { text: '이 조합이면 우승 가능?', sentiment: 'neutral' },
    { text: '{team} 팬인데 환영합니다!!', sentiment: 'positive' },
    { text: '오 대박 이적이네', sentiment: 'hype' },
    { text: '뜬금없다 왜 갑자기?', sentiment: 'neutral' },
    { text: '{player} 진짜 잘하는데 기대된다', sentiment: 'positive' },
    { text: 'ㄷㄷ 이건 좀 미쳤다 진짜', sentiment: 'hype' },
    { text: '돈 쓸 때 확 쓰네 ㅋㅋㅋ', sentiment: 'neutral' },
    { text: '이 영입은 진짜 물주 등장한듯', sentiment: 'positive' },
    { text: '찐이면 우승각이다', sentiment: 'hype' },
    { text: '반대로 생각하면 기존 선수 방출 가능성?', sentiment: 'neutral' },
    { text: '이거 합류하면 라인업이 ㄹㅇ 사기', sentiment: 'hype' },
    { text: 'ㅋㅋ 댓글 반응 보소', sentiment: 'neutral' },
    { text: '시즌 살린다 이거 ㅋㅋ', sentiment: 'positive' },
    { text: '{player} 솔직히 탑급인데 환영', sentiment: 'positive' },
    { text: '오 이건 예상 못했다', sentiment: 'neutral' },
    { text: '이적료가 궁금하네 ㄹㅇ', sentiment: 'neutral' },
    { text: '{team} 이번에 제대로 가는구나', sentiment: 'positive' },
  ],
  dcinside: [
    { text: 'ㅇㅇ 이건 인정', sentiment: 'positive' },
    { text: '반대의견) 별로인데', sentiment: 'negative' },
    { text: '???:나도 갈래', sentiment: 'neutral' },
    { text: 'ㄹㅇ 개꿀영입ㅋㅋ', sentiment: 'positive' },
    { text: '근데 시너지가 될까?', sentiment: 'neutral' },
    { text: '겨울 이적 끝났다 이제', sentiment: 'neutral' },
    { text: 'ㄷㄷ {team} 미쳤냐', sentiment: 'hype' },
    { text: '기자들 다 알고있었네', sentiment: 'neutral' },
    { text: '난 차라리 다른 선수가 나았다고 봄', sentiment: 'negative' },
    { text: '{player} 갤 난리나겠다ㅋㅋ', sentiment: 'neutral' },
    { text: '이건 누가 봐도 답이지', sentiment: 'positive' },
    { text: 'ㅇㅇ 인정 이건 좋은 영입', sentiment: 'positive' },
    { text: '반대의견) 오버페이 아님?', sentiment: 'negative' },
    { text: '이딴 영입으로 우승? ㅋㅋ', sentiment: 'negative' },
    { text: '근데 케미 맞을까 궁금하네', sentiment: 'neutral' },
    { text: '이전 팀에서는 캐리 못했는데', sentiment: 'negative' },
    { text: '한 시즌 지켜봐야 알듯', sentiment: 'neutral' },
    { text: '아 씁 우리도 저런 선수 영입해라', sentiment: 'neutral' },
    { text: 'ㄹㅇ 스토브리그 우승팀 ㅋㅋ', sentiment: 'hype' },
    { text: '진짜 안 올 줄 알았는데 오네', sentiment: 'hype' },
    { text: '{team} 프론트 일 좀 하네', sentiment: 'positive' },
    { text: '이건 인정할 수밖에', sentiment: 'positive' },
    { text: '근데 포지션 겹치는 선수는?', sentiment: 'neutral' },
  ],
  fmkorea: [
    { text: '와 이건 좀 미쳤다', sentiment: 'hype' },
    { text: '근데 연봉은?', sentiment: 'neutral' },
    { text: '이적시장 끝난다 이제', sentiment: 'neutral' },
    { text: '{team} 존나 돈 쓰네', sentiment: 'neutral' },
    { text: '우승 가즈아!!', sentiment: 'hype' },
    { text: '이건 진짜 잘한 영입', sentiment: 'positive' },
    { text: '혹시 트롤?ㅋㅋ', sentiment: 'negative' },
    { text: '정보) {player} 꽤 잘함', sentiment: 'positive' },
    { text: '대박 이거 찐이야?', sentiment: 'hype' },
    { text: '실화냐 ㅋㅋㅋㅋ', sentiment: 'hype' },
    { text: '와 이건 진짜 대박이다', sentiment: 'hype' },
    { text: '연봉이 얼만지가 더 궁금함', sentiment: 'neutral' },
    { text: '이적시장 대전 시작이구만', sentiment: 'neutral' },
    { text: '이거 팩트 확인된 거임?', sentiment: 'neutral' },
    { text: 'ㅋㅋ 커뮤 반응 실시간', sentiment: 'neutral' },
    { text: '우리팀도 좀 이런 영입 해라', sentiment: 'neutral' },
    { text: '아니 이 금액에 진짜 됨?', sentiment: 'neutral' },
    { text: '이거 성사되면 리그 판도 바뀜', sentiment: 'hype' },
    { text: '{team} 올해 진짜 가는구나', sentiment: 'positive' },
    { text: '{player} 실력은 인정해야지', sentiment: 'positive' },
    { text: '오 드디어 오피셜이다', sentiment: 'hype' },
  ],
  reddit: [
    { text: 'Huge signing for {team}!', sentiment: 'hype' },
    { text: 'Interesting move', sentiment: 'neutral' },
    { text: "Don't know about this one", sentiment: 'negative' },
    { text: '{player} is a solid pickup, {team} looking strong', sentiment: 'positive' },
    { text: 'This roster is going to be scary', sentiment: 'positive' },
    { text: 'Wait what? This came out of nowhere', sentiment: 'neutral' },
    { text: 'W signing if {player} returns to form', sentiment: 'positive' },
    { text: 'Not sure how I feel about this tbh', sentiment: 'neutral' },
    { text: "Let's see how this plays out in scrims first", sentiment: 'neutral' },
    { text: 'GG {team} wins the offseason', sentiment: 'hype' },
    { text: 'This is HUGE for the team', sentiment: 'hype' },
    { text: "Can't believe they pulled this off", sentiment: 'hype' },
    { text: 'Salary must be insane tho', sentiment: 'neutral' },
    { text: 'Honestly, questionable move', sentiment: 'negative' },
    { text: 'This roster is looking scary now', sentiment: 'positive' },
    { text: "As a fan, I'm hyped but cautious", sentiment: 'neutral' },
    { text: 'The other team must be furious', sentiment: 'neutral' },
    { text: '{player} was a free agent gem', sentiment: 'positive' },
    { text: 'Now THAT is how you build a roster', sentiment: 'positive' },
    { text: 'Is this confirmed by multiple sources?', sentiment: 'neutral' },
    { text: '{team} management cooking this offseason', sentiment: 'positive' },
  ],
  twitter: [
    { text: 'LETS GOOO', sentiment: 'hype' },
    { text: 'Welcome to {team}!', sentiment: 'positive' },
    { text: "Unexpected but let's see", sentiment: 'neutral' },
    { text: '{team} really went all in this offseason', sentiment: 'positive' },
    { text: 'W MOVE', sentiment: 'hype' },
    { text: '{player} deserves this', sentiment: 'positive' },
    { text: "I'm not convinced yet", sentiment: 'negative' },
    { text: 'OFFICIAL! {player} joins {team}!!', sentiment: 'hype' },
    { text: 'This is going to be INSANE', sentiment: 'hype' },
    { text: 'NO WAY', sentiment: 'hype' },
    { text: 'Welcome to the family!', sentiment: 'positive' },
    { text: 'This changes everything for the league', sentiment: 'hype' },
    { text: 'Overrated move tbh', sentiment: 'negative' },
    { text: 'W signing for sure', sentiment: 'positive' },
    { text: 'League is doomed if this roster clicks', sentiment: 'hype' },
    { text: 'Source: trust me bro... oh wait its official', sentiment: 'neutral' },
    { text: '{team} fans eating GOOD today', sentiment: 'hype' },
    { text: 'The rivalry just got spicier', sentiment: 'neutral' },
    { text: 'Lets see how this plays out on stage', sentiment: 'neutral' },
    { text: '{player} hype train departing NOW', sentiment: 'hype' },
  ],
};

const TRANSFER_RUMOR_COMMENTS: Record<CommunitySource, CommentTemplate[]> = {
  inven: [
    { text: '아직 루머 단계인데 흥분 자제', sentiment: 'neutral' },
    { text: '이거 진짜면 대박인데', sentiment: 'hype' },
    { text: '어 근데 소스가 어디야?', sentiment: 'neutral' },
    { text: '루머는 루머일 뿐... 기대 안 한다', sentiment: 'neutral' },
    { text: '{player}가 {team} 가면 시너지 좋을듯', sentiment: 'positive' },
    { text: '이건 사실이면 미쳤다', sentiment: 'hype' },
    { text: '근데 이거 소스 확실함?', sentiment: 'neutral' },
    { text: '시즌 망한다 ㅋㅋ (혹은 살린다)', sentiment: 'neutral' },
    { text: '기대하면 안 되는 거 알지만 기대됨 ㅋ', sentiment: 'positive' },
    { text: '또 루머로 끝나는 거 아니지?', sentiment: 'neutral' },
    { text: '{team}이 진짜 {player} 데려오면 인정', sentiment: 'positive' },
    { text: '소식통이 누군지가 중요함', sentiment: 'neutral' },
    { text: '이거 성사되면 롤판 뒤집힘', sentiment: 'hype' },
    { text: '이미 기자들 사이에선 기정사실이래', sentiment: 'hype' },
    { text: '오피셜만 기다린다', sentiment: 'neutral' },
    { text: '루머 단계에서 흥분하면 안되는 거 배웠다', sentiment: 'neutral' },
    { text: '진짜면 {team} 팬으로서 감사합니다', sentiment: 'positive' },
    { text: '갈 이유가 있나? 왜 이적하려는 거임', sentiment: 'neutral' },
    { text: '어차피 내일이면 까일 루머 ㅋㅋ', sentiment: 'negative' },
    { text: '이번엔 진짜일 거 같은 느낌', sentiment: 'positive' },
  ],
  dcinside: [
    { text: '또 찌라시냐', sentiment: 'negative' },
    { text: '근거있는 루머인가', sentiment: 'neutral' },
    { text: '이거 퍼오는 사람 누구냐 맨날 틀리던데', sentiment: 'negative' },
    { text: '오 근데 이건 좀 현실성 있는데?', sentiment: 'neutral' },
    { text: '찐이면 인정', sentiment: 'positive' },
    { text: 'ㅋㅋ 매번 루머만 나오고 끝이지', sentiment: 'negative' },
    { text: '이번엔 좀 다른 느낌인데', sentiment: 'neutral' },
    { text: '이거 오피셜 나오면 갤 터진다', sentiment: 'hype' },
    { text: '진짜 가면 기존 선수는 어떻게 되는거임', sentiment: 'neutral' },
    { text: '찌라시 제조기 또 시작 ㅋ', sentiment: 'negative' },
    { text: '돈이 있으면 되지 뭐', sentiment: 'neutral' },
    { text: 'ㄹㅇ 이거 성사되면 축제임', sentiment: 'hype' },
    { text: '소스 봐야 믿음', sentiment: 'neutral' },
    { text: '{player} 가면 {team} 우승각', sentiment: 'hype' },
    { text: '오 이건 좀 신빙성 있네', sentiment: 'neutral' },
    { text: '근거 있는 루머는 다 진짜였음', sentiment: 'positive' },
    { text: '솔직히 기대된다 ㅋ', sentiment: 'positive' },
    { text: '또 루머충이냐', sentiment: 'angry' },
    { text: '이번 오프시즌 루머 최고봉', sentiment: 'neutral' },
    { text: '이건 진짜 올 수도 있겠다', sentiment: 'positive' },
  ],
  fmkorea: [
    { text: '루머) 이거 진짜?', sentiment: 'neutral' },
    { text: '에이 또 어그로', sentiment: 'negative' },
    { text: '이건 성사되면 역대급인데', sentiment: 'hype' },
    { text: '근거 없으면 삭제 좀', sentiment: 'angry' },
    { text: '오 기대된다', sentiment: 'positive' },
    { text: '이거 팩트 확인된 거임?', sentiment: 'neutral' },
    { text: '루머만 나오면 설레는 건 왜일까', sentiment: 'neutral' },
    { text: '와 이건 성사되면 대박인데', sentiment: 'hype' },
    { text: '아직 루머 단계라 참아야 한다', sentiment: 'neutral' },
    { text: '솔직히 소스가 애매함', sentiment: 'negative' },
    { text: '이적시장 대전 시작이구만', sentiment: 'neutral' },
    { text: '우리팀도 좀 이런 루머 나와라', sentiment: 'neutral' },
    { text: '이거 성사되면 리그 판도 바뀜', sentiment: 'hype' },
    { text: '매년 루머 나오다 안 되는 거 보면...', sentiment: 'negative' },
    { text: '오피셜 나올 때까지 기다려 봐야지', sentiment: 'neutral' },
    { text: '{player} 실력은 인정 {team} 가면 좋지', sentiment: 'positive' },
    { text: '와 드디어 움직이나', sentiment: 'positive' },
    { text: '소문은 소문일 뿐이다', sentiment: 'neutral' },
    { text: '이번엔 진짜 성사될 듯', sentiment: 'positive' },
    { text: '커뮤 반응 핫하네 ㅋㅋ', sentiment: 'neutral' },
  ],
  reddit: [
    { text: 'Take this with a grain of salt', sentiment: 'neutral' },
    { text: 'If true, this is massive', sentiment: 'hype' },
    { text: 'Source: trust me bro', sentiment: 'negative' },
    { text: 'Rumor has been floating around for a while now', sentiment: 'neutral' },
    { text: 'Would be a great fit for {team} tbh', sentiment: 'positive' },
    { text: 'This would be insane if confirmed', sentiment: 'hype' },
    { text: 'Multiple sources are reporting this now', sentiment: 'neutral' },
    { text: 'Not buying it until I see an official statement', sentiment: 'neutral' },
    { text: '{player} to {team} would actually make a lot of sense', sentiment: 'positive' },
    { text: 'Off-season rumors are always wild', sentiment: 'neutral' },
    { text: "I'll believe it when I see the jersey", sentiment: 'neutral' },
    { text: 'This has been rumored for weeks, might actually happen', sentiment: 'neutral' },
    { text: 'If the salary numbers are real, this is nuts', sentiment: 'hype' },
    { text: 'Hope this is real, {team} needs this', sentiment: 'positive' },
    { text: 'The leaker has been pretty reliable so far', sentiment: 'neutral' },
    { text: 'Would love to see this happen ngl', sentiment: 'positive' },
    { text: 'Already preparing my hype post for the official', sentiment: 'hype' },
    { text: 'Reminder to temper expectations until confirmed', sentiment: 'neutral' },
    { text: 'This roster on paper would be absolutely stacked', sentiment: 'hype' },
    { text: 'My sources say negotiations are ongoing', sentiment: 'neutral' },
  ],
  twitter: [
    { text: 'NO WAY this is real', sentiment: 'hype' },
    { text: 'RUMOR ALERT', sentiment: 'neutral' },
    { text: 'Need official confirmation before I believe this', sentiment: 'neutral' },
    { text: 'If this happens I will lose my mind', sentiment: 'hype' },
    { text: 'Where is this rumor coming from??', sentiment: 'neutral' },
    { text: 'PLEASE let this be true', sentiment: 'hype' },
    { text: 'Not getting my hopes up...', sentiment: 'neutral' },
    { text: 'If {player} goes to {team} its OVER for the league', sentiment: 'hype' },
    { text: 'Hearing the same from my sources', sentiment: 'neutral' },
    { text: 'This would be the signing of the year', sentiment: 'hype' },
    { text: 'Taking this with a huge grain of salt', sentiment: 'neutral' },
    { text: 'The timeline is about to explode if this is real', sentiment: 'hype' },
    { text: 'Manifesting this transfer', sentiment: 'positive' },
    { text: 'Rumors flying everywhere today', sentiment: 'neutral' },
    { text: 'This better not be cap', sentiment: 'neutral' },
    { text: '{team} fans hold your breath...', sentiment: 'neutral' },
    { text: 'Someone confirm this ASAP', sentiment: 'hype' },
    { text: 'Off-season content is unmatched', sentiment: 'neutral' },
    { text: 'My TL is going crazy over this rumor', sentiment: 'hype' },
    { text: 'Inject this rumor into my veins', sentiment: 'hype' },
  ],
};

const STAFF_COMMENTS: Record<CommunitySource, { hire: CommentTemplate[]; fire: CommentTemplate[] }> = {
  inven: {
    hire: [
      { text: '{staff} 영입이면 코칭스태프 업그레이드', sentiment: 'positive' },
      { text: '오 이 사람 괜찮은데', sentiment: 'positive' },
      { text: '코칭스태프가 중요하긴 하지', sentiment: 'neutral' },
      { text: '{team} 이번에 진심이구만', sentiment: 'positive' },
    ],
    fire: [
      { text: '왜 자르는 거야? 아까운데', sentiment: 'negative' },
      { text: '리빌딩인가...', sentiment: 'neutral' },
      { text: '코칭스태프 교체가 답인가', sentiment: 'neutral' },
      { text: '흠 이건 좀 의외다', sentiment: 'neutral' },
      { text: '그래도 수고하셨습니다', sentiment: 'positive' },
    ],
  },
  dcinside: {
    hire: [
      { text: 'ㅇㅇ 누군데?', sentiment: 'neutral' },
      { text: '코칭스태프 보강 ㄱㄱ', sentiment: 'positive' },
      { text: '이 사람 이력이 어떻게 되냐', sentiment: 'neutral' },
    ],
    fire: [
      { text: '칼이 무섭다 ㄷㄷ', sentiment: 'neutral' },
      { text: '결과가 안 나오니까...', sentiment: 'neutral' },
      { text: '이건 좀 아니지 않나', sentiment: 'angry' },
    ],
  },
  fmkorea: {
    hire: [
      { text: '코칭스태프 이적시장도 뜨겁네', sentiment: 'neutral' },
      { text: '좋은 영입이다 ㅊㅊ', sentiment: 'positive' },
      { text: '{team} 코칭 라인업 좋아지겠다', sentiment: 'positive' },
    ],
    fire: [
      { text: '에휴 결국 잘렸구나', sentiment: 'neutral' },
      { text: '흠 아쉬운데', sentiment: 'negative' },
      { text: '리빌딩 시작인가 ㄷ', sentiment: 'neutral' },
    ],
  },
  reddit: {
    hire: [
      { text: 'Good coaching staff addition for {team}', sentiment: 'positive' },
      { text: 'Interesting hire, curious to see the impact', sentiment: 'neutral' },
      { text: 'Coaching staff upgrades are underrated', sentiment: 'positive' },
    ],
    fire: [
      { text: 'Harsh but sometimes changes are needed', sentiment: 'neutral' },
      { text: "Feel bad for {staff}, didn't seem like the problem", sentiment: 'negative' },
      { text: 'Rebuilding the coaching staff too', sentiment: 'neutral' },
    ],
  },
  twitter: {
    hire: [
      { text: 'Welcome {staff} to {team}!', sentiment: 'positive' },
      { text: 'Coaching upgrade alert', sentiment: 'hype' },
    ],
    fire: [
      { text: 'Thank you {staff} for everything', sentiment: 'positive' },
      { text: "Surprised to see this change, wasn't expecting it", sentiment: 'neutral' },
    ],
  },
};

const MATCH_COMMENTS: Record<CommunitySource, { win: CommentTemplate[]; lose: CommentTemplate[] }> = {
  inven: {
    win: [
      { text: '{team} 압도적이었다 ㄷㄷ', sentiment: 'hype' },
      { text: '이 팀 진짜 강하다', sentiment: 'positive' },
      { text: '오늘 경기 완벽했음', sentiment: 'positive' },
      { text: '우승 가능하겠는데?', sentiment: 'hype' },
      { text: '오늘 한타 운영 ㄹㅇ 미쳤다', sentiment: 'hype' },
      { text: '{team} 이번 시즌 진심이구나', sentiment: 'positive' },
      { text: '상대팀 멘탈 나갔을듯 ㅋㅋ', sentiment: 'neutral' },
      { text: '드래프트부터 이겼다', sentiment: 'positive' },
      { text: '오늘 MVP 누구냐 다 잘했는데', sentiment: 'positive' },
      { text: '연승 이어가자!', sentiment: 'positive' },
      { text: '이 정도면 리그 탑3은 확정', sentiment: 'hype' },
      { text: '경기 내용도 좋고 결과도 좋고', sentiment: 'positive' },
    ],
    lose: [
      { text: '오늘 뭐했냐 진짜...', sentiment: 'angry' },
      { text: '{team} 좀 심했다 오늘', sentiment: 'negative' },
      { text: '드래프트부터 망했어', sentiment: 'negative' },
      { text: '다음 경기는 이겨라 제발', sentiment: 'neutral' },
      { text: '밴픽 누가 한거냐 진심', sentiment: 'angry' },
      { text: '멘탈이 나간 건가... 경기 내용이', sentiment: 'negative' },
      { text: '이러면 플옵 못 간다', sentiment: 'negative' },
      { text: '라인전부터 밀리니까 답이 없지', sentiment: 'negative' },
      { text: '팬들한테 미안하지도 않냐', sentiment: 'angry' },
      { text: '인터뷰에서 뭐라고 할지 궁금하다', sentiment: 'neutral' },
      { text: '하... 희망이 안 보인다', sentiment: 'negative' },
      { text: '로스터 좀 바꿔봐라', sentiment: 'angry' },
    ],
  },
  dcinside: {
    win: [
      { text: 'ㅋㅋ 상대 털었네', sentiment: 'hype' },
      { text: 'GG 깔끔', sentiment: 'positive' },
      { text: '오늘 폼 미쳤다', sentiment: 'hype' },
      { text: 'ㄹㅇ 일방적이었음', sentiment: 'hype' },
      { text: '오늘 경기 보는 맛이 있었다', sentiment: 'positive' },
      { text: '{team} 이기니까 기분 좋다', sentiment: 'positive' },
      { text: '근데 상대가 너무 못한 것도 있음', sentiment: 'neutral' },
      { text: '한타 운영 깔끔 그 자체', sentiment: 'positive' },
      { text: '오늘 에이스 터졌네 ㅋㅋ', sentiment: 'hype' },
      { text: '이 폼이면 상위권 가능', sentiment: 'positive' },
      { text: 'ㅋㅋ 상대 갤 난리나겠다', sentiment: 'neutral' },
      { text: '오늘의 승리에 건배', sentiment: 'positive' },
    ],
    lose: [
      { text: '답이 없다 진짜', sentiment: 'angry' },
      { text: '감독 경질 언제함?', sentiment: 'angry' },
      { text: 'ㅋㅋ 또 졌네', sentiment: 'negative' },
      { text: '이 수준이 프로냐', sentiment: 'angry' },
      { text: '갤 분위기 장례식장이다', sentiment: 'negative' },
      { text: '이긴 적이 있긴 하냐', sentiment: 'angry' },
      { text: '솔직히 실력 차이가 너무 남', sentiment: 'negative' },
      { text: '뭘 해도 안 되는 시즌', sentiment: 'negative' },
      { text: '하 진짜 열받네', sentiment: 'angry' },
      { text: '이러면 시즌 끝이다', sentiment: 'negative' },
      { text: '중반까지는 괜찮았는데...', sentiment: 'neutral' },
      { text: '한타 타이밍 왜 저렇게 잡냐', sentiment: 'angry' },
    ],
  },
  fmkorea: {
    win: [
      { text: '오늘 경기 재밌었다', sentiment: 'positive' },
      { text: '{team} 팬인데 기분 좋다 ㅋ', sentiment: 'positive' },
      { text: '이기니까 기분이 좋네', sentiment: 'positive' },
      { text: '오늘 경기 하이라이트 짤 좀', sentiment: 'neutral' },
      { text: '이기니까 다 잘한 거 같음 ㅋ', sentiment: 'positive' },
      { text: '깔끔한 승리 ㅊㅊ', sentiment: 'positive' },
      { text: '{team} 연승 가즈아', sentiment: 'hype' },
      { text: '오늘은 마음 편하게 봤다', sentiment: 'positive' },
      { text: '경기 내용도 좋았음 인정', sentiment: 'positive' },
      { text: '상대팀 팬들 고생했다 ㅋ', sentiment: 'neutral' },
      { text: '이 정도 경기력이면 기대해도 되겠다', sentiment: 'positive' },
      { text: '와 오늘 진짜 잘했다', sentiment: 'hype' },
    ],
    lose: [
      { text: '이건 좀...', sentiment: 'negative' },
      { text: '왜 진거야 대체', sentiment: 'angry' },
      { text: '하... 다음엔 이겨라', sentiment: 'neutral' },
      { text: '경기 보면서 한숨만 나왔다', sentiment: 'negative' },
      { text: '이번 시즌 전망이 어둡다', sentiment: 'negative' },
      { text: '솔직히 오늘은 상대가 더 잘했음', sentiment: 'neutral' },
      { text: '로스터 변경이 답인가', sentiment: 'neutral' },
      { text: '팬심이 식어간다...', sentiment: 'negative' },
      { text: '이거 연패면 분위기 최악이겠다', sentiment: 'negative' },
      { text: '경기 내용이 너무 아쉽다', sentiment: 'negative' },
      { text: '다음 경기에서 보여주자', sentiment: 'neutral' },
      { text: '이러다 시즌 망한다 ㅋㅋ', sentiment: 'negative' },
    ],
  },
  reddit: {
    win: [
      { text: '{team} looked really clean today', sentiment: 'positive' },
      { text: 'What a dominant performance!', sentiment: 'hype' },
      { text: 'GG, {team} played really well', sentiment: 'positive' },
      { text: 'That macro was insane', sentiment: 'hype' },
      { text: '{team} is on another level right now', sentiment: 'hype' },
      { text: 'MVP performance from the mid laner', sentiment: 'positive' },
      { text: 'This team is peaking at the right time', sentiment: 'positive' },
      { text: 'Draft diff was massive this game', sentiment: 'positive' },
      { text: 'Shoutout to {team} for the clean execution', sentiment: 'positive' },
      { text: 'If they keep playing like this, playoffs are theirs', sentiment: 'hype' },
      { text: 'The teamfighting was beautiful to watch', sentiment: 'positive' },
      { text: '{team} speedrunning the league', sentiment: 'hype' },
    ],
    lose: [
      { text: 'Rough game for {team}', sentiment: 'negative' },
      { text: 'That draft was questionable at best', sentiment: 'negative' },
      { text: 'They need to figure things out fast', sentiment: 'neutral' },
      { text: 'Honestly painful to watch as a {team} fan', sentiment: 'negative' },
      { text: 'The macro decisions were terrible this game', sentiment: 'angry' },
      { text: "What happened to {team}'s early game?", sentiment: 'negative' },
      { text: '{team} is in trouble if they keep losing like this', sentiment: 'negative' },
      { text: 'Coaching staff needs to step up', sentiment: 'neutral' },
      { text: 'That baron throw was painful', sentiment: 'angry' },
      { text: 'Please bench someone, this is not working', sentiment: 'angry' },
      { text: 'Disappointing performance all around', sentiment: 'negative' },
      { text: '{team} fans deserve better than this', sentiment: 'negative' },
    ],
  },
  twitter: {
    win: [
      { text: '{team} WINS!! What a game!', sentiment: 'hype' },
      { text: 'Clean victory for {team}', sentiment: 'positive' },
      { text: 'LETS GOOOO {team}!!!', sentiment: 'hype' },
      { text: 'Absolutely dominant from {team} today', sentiment: 'hype' },
      { text: '{team} is the real deal', sentiment: 'positive' },
      { text: 'That was a masterclass', sentiment: 'positive' },
      { text: '{team} haters in shambles', sentiment: 'hype' },
      { text: 'Another W for {team}!!', sentiment: 'positive' },
      { text: 'Championship caliber performance', sentiment: 'hype' },
      { text: 'GG go next (for the other team)', sentiment: 'neutral' },
      { text: 'What a time to be a {team} fan', sentiment: 'positive' },
      { text: '{team} proving the doubters wrong', sentiment: 'positive' },
    ],
    lose: [
      { text: 'Pain...', sentiment: 'negative' },
      { text: '{team} needs to bounce back', sentiment: 'neutral' },
      { text: 'Not our day...', sentiment: 'negative' },
      { text: 'This loss hurts', sentiment: 'negative' },
      { text: 'Sadge...', sentiment: 'negative' },
      { text: '{team} will come back stronger', sentiment: 'neutral' },
      { text: 'Draft kingdom strikes again (negatively)', sentiment: 'angry' },
      { text: 'We go next. Keep your heads up', sentiment: 'neutral' },
      { text: 'Tough schedule but no excuses', sentiment: 'neutral' },
      { text: 'Someone make the bad games stop', sentiment: 'negative' },
      { text: 'Rebuild when?', sentiment: 'angry' },
      { text: 'This is so frustrating to watch', sentiment: 'angry' },
    ],
  },
};

// ─────────────────────────────────────────
// 댓글 생성 헬퍼
// ─────────────────────────────────────────

function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

async function insertReaction(
  seasonId: number,
  eventType: SocialEventType,
  eventDate: string,
  title: string,
  content: string,
  communitySource: CommunitySource,
  relatedTeamId?: string,
  relatedPlayerId?: string,
  relatedStaffId?: number,
): Promise<number> {
  const db = await getDatabase();
  const result = await db.execute(
    `INSERT INTO social_reactions (season_id, event_type, event_date, title, content, related_team_id, related_player_id, related_staff_id, community_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [seasonId, eventType, eventDate, title, content, relatedTeamId ?? null, relatedPlayerId ?? null, relatedStaffId ?? null, communitySource],
  );
  return result.lastInsertId ?? 0;
}

async function insertComments(
  reactionId: number,
  templates: CommentTemplate[],
  vars: Record<string, string>,
  source: CommunitySource,
  count: number,
): Promise<void> {
  const db = await getDatabase();
  const usernames = USERNAMES[source];
  const usedUsernames = new Set<string>();

  for (let i = 0; i < count; i++) {
    const tmpl = pick(templates);
    let username: string;
    do {
      username = pick(usernames);
    } while (usedUsernames.has(username) && usedUsernames.size < usernames.length);
    usedUsernames.add(username);

    const comment = fillTemplate(tmpl.text, vars);
    const likes = randInt(0, 200);

    await db.execute(
      `INSERT INTO social_comments (reaction_id, username, comment, likes, sentiment)
       VALUES ($1, $2, $3, $4, $5)`,
      [reactionId, username, comment, likes, tmpl.sentiment],
    );
  }
}

// ─────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────

/** 이적 루머 생성 */
export async function generateTransferRumor(
  seasonId: number,
  date: string,
  playerName: string,
  fromTeam: string,
  toTeam: string,
): Promise<void> {
  const source = pick(COMMUNITIES);
  const title = `[루머] ${playerName}, ${toTeam}(으)로 이적 가능성`;
  const content = `${fromTeam} 소속 ${playerName} 선수가 ${toTeam}(으)로 이적할 수 있다는 소문이 돌고 있다. 아직 공식 발표는 없으나, 관계자에 따르면 양 팀 간 협상이 진행 중인 것으로 알려졌다.`;
  const vars = { player: playerName, team: toTeam };

  const reactionId = await insertReaction(seasonId, 'transfer_rumor', date, title, content, source);
  const commentCount = randInt(3, 8);
  await insertComments(reactionId, TRANSFER_RUMOR_COMMENTS[source], vars, source, commentCount);
}

/** 이적 오피셜 생성 */
export async function generateTransferOfficial(
  seasonId: number,
  date: string,
  playerName: string,
  teamName: string,
  isJoining: boolean,
): Promise<void> {
  const source = pick(COMMUNITIES);
  const title = isJoining
    ? `[오피셜] ${playerName}, ${teamName} 합류`
    : `[오피셜] ${playerName}, ${teamName} 방출`;
  const content = isJoining
    ? `${teamName}이(가) ${playerName} 선수의 영입을 공식 발표했다. ${playerName} 선수는 새 시즌부터 ${teamName}의 일원으로 활동할 예정이다.`
    : `${teamName}이(가) ${playerName} 선수의 방출을 공식 발표했다. ${playerName} 선수는 FA 시장에 나서게 된다.`;
  const vars = { player: playerName, team: teamName };

  const reactionId = await insertReaction(seasonId, 'transfer_official', date, title, content, source);
  const commentCount = randInt(5, 12);
  await insertComments(reactionId, TRANSFER_OFFICIAL_COMMENTS[source], vars, source, commentCount);

  // AI 소셜 반응 추가
  try {
    const aiReactions = await generateSocialReactions({
      eventType: 'transfer',
      teamName: teamName,
      details: `${playerName} ${isJoining ? '합류' : '방출'}`,
      count: 3,
    });
    const db = await getDatabase();
    for (const reaction of aiReactions) {
      await db.execute(
        `INSERT INTO social_comments (reaction_id, username, comment, likes, sentiment)
         VALUES ($1, $2, $3, $4, $5)`,
        [reactionId, reaction.username, reaction.comment, reaction.likes, reaction.sentiment],
      );
    }
  } catch { /* AI 실패 시 기존 템플릿 댓글만 유지 */ }
}

/** 스태프 영입/해고 반응 생성 */
export async function generateStaffReaction(
  seasonId: number,
  date: string,
  staffName: string,
  teamName: string,
  isHire: boolean,
): Promise<void> {
  const source = pick(COMMUNITIES);
  const eventType: SocialEventType = isHire ? 'staff_hire' : 'staff_fire';
  const title = isHire
    ? `[오피셜] ${teamName}, ${staffName} 코칭스태프 영입`
    : `[오피셜] ${teamName}, ${staffName} 코칭스태프 계약 해지`;
  const content = isHire
    ? `${teamName}이(가) ${staffName}을(를) 새로운 코칭스태프로 영입했다.`
    : `${teamName}이(가) ${staffName}과(와)의 계약을 해지했다.`;
  const vars = { staff: staffName, team: teamName };

  const templates = STAFF_COMMENTS[source][isHire ? 'hire' : 'fire'];
  const reactionId = await insertReaction(seasonId, eventType, date, title, content, source);
  const commentCount = randInt(3, 7);
  await insertComments(reactionId, templates, vars, source, commentCount);
}

/** 경기 결과 반응 생성 */
export async function generateMatchReaction(
  seasonId: number,
  date: string,
  homeTeam: string,
  awayTeam: string,
  scoreHome: number,
  scoreAway: number,
): Promise<void> {
  const source = pick(COMMUNITIES);
  const winner = scoreHome > scoreAway ? homeTeam : awayTeam;
  const loser = scoreHome > scoreAway ? awayTeam : homeTeam;
  const title = `${homeTeam} ${scoreHome} : ${scoreAway} ${awayTeam}`;
  const content = `${winner}이(가) ${loser}을(를) ${scoreHome > scoreAway ? scoreHome : scoreAway}-${scoreHome > scoreAway ? scoreAway : scoreHome}(으)로 꺾었다.`;

  const reactionId = await insertReaction(seasonId, 'match_result', date, title, content, source, undefined, undefined, undefined);

  // 승리팀 관련 댓글
  const winCount = randInt(2, 5);
  await insertComments(reactionId, MATCH_COMMENTS[source].win, { team: winner }, source, winCount);
  // 패배팀 관련 댓글
  const loseCount = randInt(1, 4);
  await insertComments(reactionId, MATCH_COMMENTS[source].lose, { team: loser }, source, loseCount);

  // AI 소셜 반응 추가 (기존 댓글에 추가)
  try {
    const aiReactions = await generateSocialReactions({
      eventType: 'match_result',
      teamName: winner,
      details: `${homeTeam} ${scoreHome}:${scoreAway} ${awayTeam}`,
      count: 3,
    });
    const db = await getDatabase();
    for (const reaction of aiReactions) {
      await db.execute(
        `INSERT INTO social_comments (reaction_id, username, comment, likes, sentiment)
         VALUES ($1, $2, $3, $4, $5)`,
        [reactionId, reaction.username, reaction.comment, reaction.likes, reaction.sentiment],
      );
    }
  } catch { /* AI 실패 시 기존 템플릿 댓글만 유지 */ }
}

/** 최근 반응 조회 */
export async function getRecentReactions(seasonId: number, limit: number = 20): Promise<SocialReaction[]> {
  const db = await getDatabase();
  const rows = await db.select<ReactionRow[]>(
    'SELECT * FROM social_reactions WHERE season_id = $1 ORDER BY event_date DESC, id DESC LIMIT $2',
    [seasonId, limit],
  );
  return rows.map(mapRowToReaction);
}

/** 반응 + 댓글 조회 */
export async function getReactionWithComments(reactionId: number): Promise<{ reaction: SocialReaction; comments: SocialComment[] }> {
  const db = await getDatabase();
  const reactionRows = await db.select<ReactionRow[]>(
    'SELECT * FROM social_reactions WHERE id = $1',
    [reactionId],
  );
  if (reactionRows.length === 0) {
    throw new Error(`Reaction not found: ${reactionId}`);
  }
  const commentRows = await db.select<CommentRow[]>(
    'SELECT * FROM social_comments WHERE reaction_id = $1 ORDER BY likes DESC',
    [reactionId],
  );
  return {
    reaction: mapRowToReaction(reactionRows[0]),
    comments: commentRows.map(mapRowToComment),
  };
}

/** 커뮤니티 소스 필터 조회 */
export async function getReactionsBySource(
  seasonId: number,
  source: CommunitySource,
  limit: number = 20,
): Promise<SocialReaction[]> {
  const db = await getDatabase();
  const rows = await db.select<ReactionRow[]>(
    'SELECT * FROM social_reactions WHERE season_id = $1 AND community_source = $2 ORDER BY event_date DESC, id DESC LIMIT $3',
    [seasonId, source, limit],
  );
  return rows.map(mapRowToReaction);
}
