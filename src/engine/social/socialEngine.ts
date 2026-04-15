/**
 * Community reaction generation engine.
 * - Creates social reactions for transfers, rumors, staff changes, and match results.
 * - Supports Inven, DCInside, FMKorea, Reddit, and Twitter-style community voices.
 */

import { getDatabase } from '../../db/database';
import { fillTemplate } from '../../utils/stringUtils';
import { generateSocialReactions } from '../../ai/advancedAiService';
import { pickRandom as seededPickRandom, randomInt as seededRandomInt } from '../../utils/random';
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
  comment_count?: number;
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
    commentCount: row.comment_count ?? 0,
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
  return seededPickRandom(arr);
}

function randInt(min: number, max: number): number {
  return seededRandomInt(min, max);
}

const COMMUNITIES: CommunitySource[] = ['inven', 'dcinside', 'fmkorea', 'reddit', 'twitter'];

// -----------------------------------------------------------------------------
// 유저네임 풀
// -----------------------------------------------------------------------------

const USERNAMES: Record<CommunitySource, string[]> = {
  inven: [
    'T1팬', 'LCK보는중', '밴픽메모장', '오더장인', '탑연구소', '미드차이봄',
    '정글동선러', '메타읽는중', '한타클립저장', '플옵각보임', '솔랭휴식중', '경기다시보기',
  ],
  dcinside: [
    'ㅇㅇ(223.38)', 'ㅇㅇ(121.15)', '갤주아님', '롤잘알', 'ㅇㅇ(118.235)', '고닉추',
    'ㅇㅇ(211.36)', '로갤러', 'ㅇㅇ(49.142)', '개념글후보', 'ㅇㅇ(175.223)', '벤치평론가',
  ],
  fmkorea: [
    '에펨추', '포텐각', '로스터장인', '메타헌터', '스크림체크', '운영메모',
    '라인업보는중', '코치노트', '밴픽팬', '샷콜체크', '후반캐리각', '폼추적기',
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

interface CommentTemplate {
  text: string;
  sentiment: CommentSentiment;
}

const TRANSFER_OFFICIAL_COMMENTS: Record<CommunitySource, CommentTemplate[]> = {
  inven: [
    { text: '[오피셜] {player} 영입 떴다', sentiment: 'hype' },
    { text: '{team} 프런트 이번엔 일했다', sentiment: 'positive' },
    { text: '로스터 체급이 한 단계 올라갔다', sentiment: 'positive' },
    { text: '이 정도면 상위권 각 본다', sentiment: 'hype' },
    { text: '연봉 조건이 좀 궁금하긴 하네', sentiment: 'neutral' },
    { text: '종이 전력은 확실히 세졌다', sentiment: 'neutral' },
  ],
  dcinside: [
    { text: '이건 인정이지', sentiment: 'positive' },
    { text: '오피셜 뜨니까 실감 난다', sentiment: 'hype' },
    { text: '근데 합은 좀 봐야 함', sentiment: 'neutral' },
    { text: '이거면 우승 경쟁 간다', sentiment: 'hype' },
    { text: '오버페이만 아니면 괜찮음', sentiment: 'neutral' },
    { text: '이적시장 불타네', sentiment: 'positive' },
  ],
  fmkorea: [
    { text: '와 이건 진짜 크다', sentiment: 'hype' },
    { text: '{team} 보강 제대로 했네', sentiment: 'positive' },
    { text: '폼만 올라오면 바로 주전감', sentiment: 'positive' },
    { text: '첫 스크림은 보고 판단해야지', sentiment: 'neutral' },
    { text: '오프시즌 승자 느낌인데?', sentiment: 'hype' },
    { text: '라인업 완성도가 확 올라감', sentiment: 'positive' },
  ],
  reddit: [
    { text: '{team} 입장에선 정말 큰 영입이다', sentiment: 'hype' },
    { text: '꽤 흥미로운 선택이다', sentiment: 'neutral' },
    { text: '이 선택은 아직 잘 모르겠다', sentiment: 'negative' },
    { text: '{player}면 충분히 좋은 영입이다. {team} 전력이 좋아 보인다', sentiment: 'positive' },
    { text: '이 로스터는 꽤 위협적일 수 있다', sentiment: 'positive' },
    { text: '이 소식은 진짜 예상 못 했다', sentiment: 'neutral' },
  ],
  twitter: [
    { text: '오피셜 떴다 미쳤다', sentiment: 'hype' },
    { text: '{team} 환영합니다!', sentiment: 'positive' },
    { text: '의외긴 한데 기대된다', sentiment: 'neutral' },
    { text: '{team} 이번 오프시즌 제대로 달린다', sentiment: 'positive' },
    { text: '이건 W다', sentiment: 'hype' },
    { text: '{player}라면 이 반응 받을 만하다', sentiment: 'positive' },
  ],
};

const TRANSFER_RUMOR_COMMENTS: Record<CommunitySource, CommentTemplate[]> = {
  inven: [
    { text: '아직 루머 단계지만 흥미롭다', sentiment: 'neutral' },
    { text: '이거 진짜면 꽤 큰 건데', sentiment: 'hype' },
    { text: '소스가 어디냐가 중요함', sentiment: 'neutral' },
    { text: '{player}가 {team} 가면 그림은 좋다', sentiment: 'positive' },
    { text: '오피셜 올라올 때까지 존버', sentiment: 'neutral' },
    { text: '또 가짜 루머면 허무하지', sentiment: 'negative' },
  ],
  dcinside: [
    { text: '이건 좀 가능성 있어 보이는데', sentiment: 'neutral' },
    { text: '오피셜 뜨면 타임라인 난리남', sentiment: 'hype' },
    { text: '소스 별로면 난 안 믿음', sentiment: 'negative' },
    { text: '이거면 리그 판도 바뀐다', sentiment: 'hype' },
    { text: '기존 주전 정리는 어떻게 하냐', sentiment: 'neutral' },
    { text: '루머가 좀 오래 가네', sentiment: 'neutral' },
  ],
  fmkorea: [
    { text: '루머 치고는 좀 그럴듯한데', sentiment: 'hype' },
    { text: '아직 반반이다', sentiment: 'neutral' },
    { text: '오피셜 뜨기 전까진 보류', sentiment: 'neutral' },
    { text: '{player}가 {team}이랑 잘 맞긴 함', sentiment: 'positive' },
    { text: '오프시즌 떡밥 재밌네', sentiment: 'hype' },
    { text: '이번엔 현실성 좀 있다', sentiment: 'positive' },
  ],
  reddit: [
    { text: '아직은 조심해서 봐야 할 루머다', sentiment: 'neutral' },
    { text: '사실이면 꽤 큰 소식이다', sentiment: 'hype' },
    { text: '출처가 약하면 못 믿겠다', sentiment: 'negative' },
    { text: '이 루머는 한동안 계속 돌고 있었다', sentiment: 'neutral' },
    { text: '{team} 입장에선 꽤 잘 맞는 카드 같다', sentiment: 'positive' },
    { text: '확정되면 진짜 파장이 크겠다', sentiment: 'hype' },
  ],
  twitter: [
    { text: '이거 실화냐', sentiment: 'hype' },
    { text: '루머 알림', sentiment: 'neutral' },
    { text: '오피셜 전에는 못 믿지', sentiment: 'neutral' },
    { text: '이거 뜨면 진짜 난리난다', sentiment: 'hype' },
    { text: '이 얘기 어디서 시작된 거지?', sentiment: 'neutral' },
    { text: '제발 사실이었으면', sentiment: 'hype' },
  ],
};

const STAFF_COMMENTS: Record<CommunitySource, { hire: CommentTemplate[]; fire: CommentTemplate[] }> = {
  inven: {
    hire: [
      { text: '{staff} 합류면 스태프진 업그레이드다', sentiment: 'positive' },
      { text: '보강 포인트를 잘 짚었네', sentiment: 'positive' },
      { text: '스태프 변화가 은근 중요하지', sentiment: 'neutral' },
    ],
    fire: [
      { text: '결과가 안 좋았으니 변화는 왔네', sentiment: 'neutral' },
      { text: '조금 가혹하긴 하다', sentiment: 'negative' },
      { text: '다음 인선이 더 중요하겠네', sentiment: 'neutral' },
    ],
  },
  dcinside: {
    hire: [
      { text: '스태프 보강 괜찮다', sentiment: 'positive' },
      { text: '티는 늦게 나도 중요함', sentiment: 'neutral' },
      { text: '은근 실속 있는 영입 같음', sentiment: 'positive' },
    ],
    fire: [
      { text: '결국 스태프가 먼저 책임지네', sentiment: 'neutral' },
      { text: '이건 좀 세긴 하다', sentiment: 'negative' },
      { text: '리셋 버튼 누르는 느낌', sentiment: 'neutral' },
    ],
  },
  fmkorea: {
    hire: [
      { text: '코치진까지 챙기네 좋다', sentiment: 'positive' },
      { text: '{team} 스태프 라인 탄탄해지겠다', sentiment: 'positive' },
      { text: '이런 움직임이 시즌 길게 보면 큼', sentiment: 'neutral' },
    ],
    fire: [
      { text: '변화는 필요했을 수도 있지', sentiment: 'neutral' },
      { text: '조금 아쉽긴 하다', sentiment: 'negative' },
      { text: '결국 다음 영입이 핵심이네', sentiment: 'neutral' },
    ],
  },
  reddit: {
    hire: [
      { text: '{team} 입장에선 좋은 스태프 보강이다', sentiment: 'positive' },
      { text: '흥미로운 영입이다. 실제 영향이 궁금하다', sentiment: 'neutral' },
      { text: '스태프 업그레이드는 생각보다 중요하다', sentiment: 'positive' },
    ],
    fire: [
      { text: '조금 냉정하지만 변화가 필요했을 수도 있다', sentiment: 'neutral' },
      { text: '{staff}만의 문제는 아니었던 것 같아서 아쉽다', sentiment: 'negative' },
      { text: '코칭스태프 재정비도 같이 들어가는 분위기다', sentiment: 'neutral' },
    ],
  },
  twitter: {
    hire: [
      { text: '{staff} 합류', sentiment: 'positive' },
      { text: '코칭스태프 업그레이드 경보', sentiment: 'hype' },
    ],
    fire: [
      { text: '{staff} 고생 많았습니다', sentiment: 'positive' },
      { text: '이건 좀 예상 못 했다', sentiment: 'neutral' },
    ],
  },
};

const MATCH_COMMENTS: Record<CommunitySource, { win: CommentTemplate[]; lose: CommentTemplate[] }> = {
  inven: {
    win: [
      { text: '{team} 경기력이 날카로웠다', sentiment: 'hype' },
      { text: '한타 구도가 진짜 깔끔했다', sentiment: 'positive' },
      { text: '이 정도면 강팀 느낌 난다', sentiment: 'hype' },
      { text: '드래프트랑 운영 둘 다 먹혔다', sentiment: 'positive' },
      { text: '오늘 MVP는 바로 보이네', sentiment: 'positive' },
      { text: '이 흐름이면 연승 간다', sentiment: 'hype' },
    ],
    lose: [
      { text: '오늘 경기는 많이 아쉽다', sentiment: 'negative' },
      { text: '드래프트부터 좀 꼬인 느낌', sentiment: 'negative' },
      { text: '다음 경기 반등이 중요하다', sentiment: 'neutral' },
      { text: '한타 합이 끝까지 안 맞았다', sentiment: 'negative' },
      { text: '팬들 입장에선 답답한 경기', sentiment: 'angry' },
      { text: '라인전 손해가 너무 컸다', sentiment: 'negative' },
    ],
  },
  dcinside: {
    win: [
      { text: '이건 인정이다', sentiment: 'hype' },
      { text: '오늘 경기 보는 맛 있었다', sentiment: 'positive' },
      { text: '운영 차이 제대로 났네', sentiment: 'positive' },
      { text: '상대 멘탈 나갔겠다', sentiment: 'neutral' },
      { text: '플옵각 진짜 보인다', sentiment: 'hype' },
      { text: '걍 깔끔했다', sentiment: 'positive' },
    ],
    lose: [
      { text: '오늘은 답이 없었다', sentiment: 'angry' },
      { text: '전체적으로 너무 별로였음', sentiment: 'negative' },
      { text: '라인전부터 밀리면 어렵지', sentiment: 'negative' },
      { text: '감독 인터뷰 좀 궁금하네', sentiment: 'neutral' },
      { text: '준비를 더 잘했어야 했다', sentiment: 'neutral' },
      { text: '팬들은 스트레스만 받음', sentiment: 'angry' },
    ],
  },
  fmkorea: {
    win: [
      { text: '오늘 경기 진짜 맛있었다', sentiment: 'positive' },
      { text: '{team} 폼 올라오는 중', sentiment: 'positive' },
      { text: '이 정도면 기대해도 되겠는데', sentiment: 'hype' },
      { text: '교전 설계가 좋았다', sentiment: 'positive' },
      { text: '분위기 제대로 탄다', sentiment: 'hype' },
      { text: '스크림 성과가 보이는 느낌', sentiment: 'neutral' },
    ],
    lose: [
      { text: '조금 많이 아쉽다', sentiment: 'negative' },
      { text: '다음 경기까지는 봐야지', sentiment: 'neutral' },
      { text: '팀 합이 아직 덜 맞는다', sentiment: 'negative' },
      { text: '로스터 조정 고민할 만함', sentiment: 'neutral' },
      { text: '보는 입장에서 답답했다', sentiment: 'negative' },
      { text: '반등 여지는 아직 있다', sentiment: 'neutral' },
    ],
  },
  reddit: {
    win: [
      { text: '{team} 경기력이 정말 깔끔했다', sentiment: 'positive' },
      { text: '압도적인 퍼포먼스였다', sentiment: 'hype' },
      { text: '{team}이 정말 잘 준비한 경기였다', sentiment: 'positive' },
      { text: '운영 차이가 크게 느껴졌다', sentiment: 'hype' },
      { text: '{team}이 지금 한 단계 위에 있는 느낌이다', sentiment: 'hype' },
      { text: '미드 라이너가 MVP급 활약을 했다', sentiment: 'positive' },
    ],
    lose: [
      { text: '{team} 입장에선 많이 힘든 경기였다', sentiment: 'negative' },
      { text: '드래프트 판단이 꽤 아쉬웠다', sentiment: 'negative' },
      { text: '빠르게 정리하고 방향을 잡아야 한다', sentiment: 'neutral' },
      { text: '{team} 팬이라면 보기 힘든 경기였다', sentiment: 'negative' },
      { text: '오늘은 운영 판단이 너무 좋지 않았다', sentiment: 'angry' },
      { text: '{team}의 초반 설계가 왜 무너졌는지 봐야 한다', sentiment: 'negative' },
    ],
  },
  twitter: {
    win: [
      { text: '{team} 승리! 경기 너무 좋았다', sentiment: 'hype' },
      { text: '완벽한 승리였다', sentiment: 'positive' },
      { text: '오늘 진짜 미쳤다', sentiment: 'hype' },
      { text: '{team} 오늘 경기력 장난 아니다', sentiment: 'hype' },
      { text: '이 팀 진짜다', sentiment: 'positive' },
      { text: '마스터클래스였다', sentiment: 'positive' },
    ],
    lose: [
      { text: '아프다...', sentiment: 'negative' },
      { text: '{team} 다음 경기엔 반등하자', sentiment: 'neutral' },
      { text: '오늘은 우리 날이 아니었다', sentiment: 'negative' },
      { text: '이 패배는 너무 쓰리다', sentiment: 'negative' },
      { text: '속상하네', sentiment: 'negative' },
      { text: '다음엔 더 강하게 돌아오자', sentiment: 'neutral' },
    ],
  },
};

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

/** 이적 루머 반응을 생성한다. */
export async function generateTransferRumor(
  seasonId: number,
  date: string,
  playerName: string,
  fromTeam: string,
  toTeam: string,
): Promise<void> {
  const source = pick(COMMUNITIES);
  const title = `[루머] ${playerName}, ${toTeam} 이적설`;
  const content = `${fromTeam} 소속 ${playerName} 선수가 ${toTeam}로 이적할 수 있다는 이야기가 커뮤니티를 중심으로 퍼지고 있다. 아직 공식 발표는 없지만 여러 반응이 이어지고 있다.`;
  const vars = { player: playerName, team: toTeam };

  const reactionId = await insertReaction(seasonId, 'transfer_rumor', date, title, content, source);
  const commentCount = randInt(3, 8);
  await insertComments(reactionId, TRANSFER_RUMOR_COMMENTS[source], vars, source, commentCount);
}

/** 이적 오피셜 반응을 생성한다. */
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
    : `[오피셜] ${playerName}, ${teamName} 결별`;
  const content = isJoining
    ? `${teamName}이(가) ${playerName} 영입을 공식 발표했다. ${playerName}는 다음 일정부터 팀 전력에 합류할 예정이다.`
    : `${teamName}이(가) ${playerName}와의 결별을 공식 발표했다. ${playerName}는 자유계약 시장에 나설 전망이다.`;
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

/** 스태프 영입/방출 반응을 생성한다. */
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
    ? `[오피셜] ${teamName}, ${staffName} 스태프 영입`
    : `[오피셜] ${teamName}, ${staffName} 스태프와 결별`;
  const content = isHire
    ? `${teamName}이(가) ${staffName}를 코칭 및 지원 스태프로 영입했다.`
    : `${teamName}이(가) ${staffName}와의 계약을 종료했다.`;
  const vars = { staff: staffName, team: teamName };

  const templates = STAFF_COMMENTS[source][isHire ? 'hire' : 'fire'];
  const reactionId = await insertReaction(seasonId, eventType, date, title, content, source);
  const commentCount = randInt(3, 7);
  await insertComments(reactionId, templates, vars, source, commentCount);
}

/** 경기 결과 반응을 생성한다. */
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

/** 최근 반응을 가져온다. */
export async function getRecentReactions(seasonId: number, limit: number = 20): Promise<SocialReaction[]> {
  const db = await getDatabase();
  const rows = await db.select<ReactionRow[]>(
    `SELECT sr.*,
            (SELECT COUNT(*) FROM social_comments sc WHERE sc.reaction_id = sr.id) AS comment_count
     FROM social_reactions sr
     WHERE sr.season_id = $1
     ORDER BY sr.event_date DESC, sr.id DESC
     LIMIT $2`,
    [seasonId, limit],
  );
  return rows.map(mapRowToReaction);
}

/** 특정 반응과 댓글을 함께 가져온다. */
export async function getReactionWithComments(reactionId: number): Promise<{ reaction: SocialReaction; comments: SocialComment[] }> {
  const db = await getDatabase();
  const reactionRows = await db.select<ReactionRow[]>(
    `SELECT sr.*,
            (SELECT COUNT(*) FROM social_comments sc WHERE sc.reaction_id = sr.id) AS comment_count
     FROM social_reactions sr
     WHERE sr.id = $1`,
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

/** 특정 커뮤니티 소스의 반응 목록을 가져온다. */
export async function getReactionsBySource(
  seasonId: number,
  source: CommunitySource,
  limit: number = 20,
): Promise<SocialReaction[]> {
  const db = await getDatabase();
  const rows = await db.select<ReactionRow[]>(
    `SELECT sr.*,
            (SELECT COUNT(*) FROM social_comments sc WHERE sc.reaction_id = sr.id) AS comment_count
     FROM social_reactions sr
     WHERE sr.season_id = $1 AND sr.community_source = $2
     ORDER BY sr.event_date DESC, sr.id DESC
     LIMIT $3`,
    [seasonId, source, limit],
  );
  return rows.map(mapRowToReaction);
}
