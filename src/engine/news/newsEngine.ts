/**
 * 뉴스/미디어 시스템 엔진
 * - 경기 결과, 이적 루머, 팀 분석, SNS 등 자동 뉴스 생성
 * - 날짜별/카테고리별 조회, 읽음 처리
 */

import type { NewsArticle, NewsCategory } from '../../types/news';
import { getDatabase } from '../../db/database';
import { generateNewsArticle } from '../../ai/advancedAiService';
import { nextRandom, pickRandom, randomInt } from '../../utils/random';

// ─────────────────────────────────────────
// Row 타입
// ─────────────────────────────────────────

interface NewsArticleRow {
  id: number;
  season_id: number;
  article_date: string;
  category: string;
  title: string;
  content: string;
  related_team_id: string | null;
  related_player_id: string | null;
  importance: number;
  is_read: number;
}

// ─────────────────────────────────────────
// 매핑 유틸
// ─────────────────────────────────────────

function mapRowToNewsArticle(row: NewsArticleRow): NewsArticle {
  return {
    id: row.id,
    seasonId: row.season_id,
    articleDate: row.article_date,
    category: row.category as NewsCategory,
    title: row.title,
    content: row.content,
    relatedTeamId: row.related_team_id,
    relatedPlayerId: row.related_player_id,
    importance: row.importance,
    isRead: Boolean(row.is_read),
  };
}

// ─────────────────────────────────────────
// 뉴스 삽입 공통
// ─────────────────────────────────────────

async function insertNews(
  seasonId: number,
  date: string,
  category: NewsCategory,
  title: string,
  content: string,
  importance: number = 1,
  relatedTeamId: string | null = null,
  relatedPlayerId: string | null = null,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO news_articles (season_id, article_date, category, title, content, importance, related_team_id, related_player_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [seasonId, date, category, title, content, importance, relatedTeamId, relatedPlayerId],
  );
}

// ─────────────────────────────────────────
// 뉴스 생성 함수
// ─────────────────────────────────────────

/** 경기 결과 뉴스 */
export async function generateMatchResultNews(
  seasonId: number,
  date: string,
  homeTeam: string,
  awayTeam: string,
  scoreHome: number,
  scoreAway: number,
): Promise<void> {
  const winner = scoreHome > scoreAway ? homeTeam : awayTeam;
  const loser = scoreHome > scoreAway ? awayTeam : homeTeam;
  const winScore = Math.max(scoreHome, scoreAway);
  const loseScore = Math.min(scoreHome, scoreAway);
  const importance = winScore === loseScore + 1 ? 2 : 1;

  // AI 뉴스 생성 시도
  try {
    const aiNews = await generateNewsArticle({
      eventType: 'match_result',
      details: `${homeTeam} vs ${awayTeam}: ${scoreHome}:${scoreAway}`,
      teamNames: [homeTeam, awayTeam],
      playerNames: [],
    });
    await insertNews(seasonId, date, 'match_result', aiNews.title, aiNews.content, importance);
    return;
  } catch { /* AI 실패 시 기존 템플릿 사용 */ }

  const templates = [
    `${winner}, ${loser}에 ${winScore}:${loseScore} 승리`,
    `${winner}, ${loser} 상대로 ${winScore}:${loseScore} 완승`,
    `${loser}, ${winner}에 ${loseScore}:${winScore}로 패배`,
    `${winner}, ${loser} 완파! ${winScore}:${loseScore}의 압도적 승리`,
    `클러치 매치! ${winner}, ${loser}와 접전 끝에 ${winScore}:${loseScore} 신승`,
    `${loser}, ${winner}에게 무릎... ${loseScore}:${winScore}로 고배`,
    `'${winner}' 연승 질주! ${loser}마저 ${winScore}:${loseScore}로 제압`,
    `${homeTeam} vs ${awayTeam}, ${winner}의 ${winScore}:${loseScore} 승리로 마무리`,
    `${winner}, 완벽한 경기 운영으로 ${loser} 격파 (${winScore}:${loseScore})`,
    `${loser} 팬들 한숨... ${winner}에 ${loseScore}:${winScore} 완패`,
  ];

  const contentTemplates = [
    `${date} 진행된 ${homeTeam} vs ${awayTeam} 경기에서 ${winner}가 ${winScore}:${loseScore}로 승리를 거뒀다. ${loser}는 아쉬운 패배를 당했다.`,
    `오늘 열린 ${homeTeam}과 ${awayTeam}의 맞대결에서 ${winner}가 ${winScore}:${loseScore}로 승리했다. ${winner}는 최근 좋은 폼을 유지하고 있다.`,
    `${winner}가 ${loser}를 ${winScore}:${loseScore}로 꺾으며 기세를 이어갔다. ${loser} 팬들은 경기 내용에 아쉬움을 표했다.`,
    `${winner}가 ${loser}를 ${winScore}:${loseScore}로 완파했다. 경기 내내 ${winner}의 우세가 뚜렷했으며, 전문가들은 ${winner}의 팀워크를 높이 평가했다.`,
    `숨 막히는 접전! ${winner}가 ${loser}를 ${winScore}:${loseScore}로 가까스로 꺾었다. 양 팀 모두 높은 경기력을 보여줬다는 평가다.`,
    `${loser}가 ${winner}에게 ${loseScore}:${winScore}로 무릎을 꿇었다. ${loser}는 드래프트 단계에서부터 밀리는 모습이었다.`,
    `${winner}가 ${loser}마저 ${winScore}:${loseScore}로 제압하며 연승 행진을 이어갔다. ${winner}의 기세가 무섭다.`,
    `${homeTeam}과 ${awayTeam}의 경기에서 ${winner}가 ${winScore}:${loseScore}로 승리했다. ${winner}의 중반 운영이 돋보인 경기였다.`,
    `${winner}의 완벽한 경기! ${loser}를 ${winScore}:${loseScore}로 격파하며 순위 상승에 청신호를 켰다.`,
    `${loser}가 ${winner}에게 ${loseScore}:${winScore}로 완패했다. ${loser} 팬들 사이에서는 로스터 변경을 요구하는 목소리가 커지고 있다.`,
  ];

  const idx = randomInt(0, templates.length - 1);
  await insertNews(seasonId, date, 'match_result', templates[idx], contentTemplates[idx], importance);
}

/** 이적 루머 뉴스 */
export async function generateTransferRumorNews(
  seasonId: number,
  date: string,
  playerName: string,
  teamName: string,
  teamId: string | null = null,
  playerId: string | null = null,
): Promise<void> {
  const templates = [
    { title: `${teamName}, '${playerName}' 영입 검토 중... 소식통`, importance: 2 },
    { title: `'${playerName}', ${teamName} 이적설 솔솔... 진위 여부는?`, importance: 1 },
    { title: `${teamName}, ${playerName} 영입 협상 중인 것으로 알려져`, importance: 2 },
    { title: `이적시장 급보! '${playerName}', ${teamName} 행 임박`, importance: 2 },
    { title: `${teamName}, '${playerName}' 영입 카드 만지작... 이적료 협상 중`, importance: 2 },
    { title: `'${playerName}' 측 관계자 '${teamName}과 대화 중인 건 사실'`, importance: 2 },
    { title: `소식통: ${teamName}, '${playerName}'에게 파격 조건 제시`, importance: 2 },
    { title: `'${playerName}' FA 시장의 최대어... ${teamName} 외 2~3개 팀 관심`, importance: 1 },
    { title: `'${playerName}' ${teamName} 이적? 커뮤니티 반응 뜨거워`, importance: 1 },
    { title: `${teamName}, '${playerName}' 영입으로 로스터 완성 임박`, importance: 2 },
  ];

  const contents = [
    `소식통에 따르면 ${teamName}이 ${playerName}의 영입을 적극 검토하고 있는 것으로 전해졌다. 아직 구체적인 계약 조건은 알려지지 않았다.`,
    `${playerName}의 ${teamName} 이적설이 팬들 사이에서 화제다. 양측 모두 공식 입장을 밝히지 않고 있어 귀추가 주목된다.`,
    `업계 관계자에 의하면 ${teamName}과 ${playerName} 측이 이적 조건을 논의 중인 것으로 알려졌다.`,
    `${teamName}이 ${playerName} 영입을 위해 파격적인 조건을 제시한 것으로 알려졌다. 양측의 협상이 마무리 단계에 접어든 것으로 전해진다.`,
    `${playerName} 측 관계자가 "${teamName}과 대화 중인 건 사실"이라고 밝혀 이적설에 힘이 실리고 있다.`,
    `${playerName}이 FA 시장의 최대어로 떠오른 가운데, ${teamName} 외에도 2~3개 팀이 관심을 보이고 있는 것으로 알려졌다.`,
    `커뮤니티에서 ${playerName}의 ${teamName} 이적 가능성에 대한 반응이 뜨겁다. 팬들 사이에서 기대와 우려가 교차하고 있다.`,
    `${teamName}이 ${playerName} 영입으로 로스터 완성을 앞두고 있다는 소식이다. 최종 발표가 임박한 것으로 보인다.`,
    `이적시장 소식통에 따르면 ${teamName}과 ${playerName}의 계약 협상이 급물살을 타고 있다. 이르면 이번 주 내 오피셜이 나올 수 있다.`,
    `${playerName}의 ${teamName} 합류 가능성이 높아지고 있다. 전문가들은 이 영입이 성사될 경우 ${teamName}의 전력이 크게 상승할 것으로 분석했다.`,
  ];

  const idx = randomInt(0, templates.length - 1);
  await insertNews(
    seasonId, date, 'transfer_rumor',
    templates[idx].title, contents[idx], templates[idx].importance,
    teamId, playerId,
  );
}

/** 팀 분석 기사 */
export async function generateTeamAnalysisNews(
  seasonId: number,
  date: string,
  teamName: string,
  standing: number,
  wins: number,
  losses: number,
  teamId: string | null = null,
): Promise<void> {
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
  const isStrong = winRate >= 60;
  const isWeak = winRate < 40;

  const strongTemplates = [
    { title: `[팀 분석] ${teamName}, 현재 ${standing}위... ${wins}승 ${losses}패 강세 행진`, content: `${teamName}이 ${wins}승 ${losses}패(승률 ${winRate}%)로 현재 ${standing}위를 기록하며 강한 모습을 보이고 있다. 전문가들은 ${teamName}의 팀 운영이 안정적이라고 평가했다.` },
    { title: `[팀 분석] ${teamName}, ${wins}승 ${losses}패로 상위권 질주 중`, content: `${teamName}이 승률 ${winRate}%로 리그 상위권을 달리고 있다. 탄탄한 라인전과 팀워크가 돋보인다는 평가다.` },
    { title: `[팀 분석] ${teamName}, 최근 ${wins}승 ${losses}패... 상승세 뚜렷`, content: `${teamName}이 최근 경기에서 눈에 띄는 상승세를 보이고 있다. ${wins}승 ${losses}패(승률 ${winRate}%)로 ${standing}위를 기록하며 플레이오프 진출이 유력하다.` },
    { title: `전문가 '${teamName}, 플레이오프 우승 후보' — ${standing}위 기록 중`, content: `${teamName}이 ${wins}승 ${losses}패(승률 ${winRate}%)로 ${standing}위를 달리며 우승 후보로 꼽히고 있다. 전문가들은 ${teamName}의 중반 운영이 리그 최상위라고 분석했다.` },
    { title: `[팀 분석] 데이터로 본 ${teamName}: 승률 ${winRate}%, 리그 ${standing}위`, content: `데이터 분석 결과 ${teamName}은 ${wins}승 ${losses}패로 리그 ${standing}위를 기록 중이다. 팀파이트 승률과 오브젝트 컨트롤이 리그 상위권이다.` },
  ];

  const weakTemplates = [
    { title: `[팀 분석] ${teamName}, ${standing}위 부진... 반등 가능할까`, content: `${teamName}이 ${wins}승 ${losses}패(승률 ${winRate}%)로 ${standing}위에 머무르며 부진을 면치 못하고 있다. 팬들의 우려가 커지고 있으며, 로스터 변경 가능성이 제기되고 있다.` },
    { title: `[팀 분석] ${teamName}, 위기의 ${standing}위... 팬들 '로스터 변경 필요'`, content: `${teamName}이 ${wins}승 ${losses}패(승률 ${winRate}%)로 ${standing}위에 머물며 위기를 맞고 있다. 팬들 사이에서는 로스터 변경을 요구하는 목소리가 높아지고 있다.` },
    { title: `[팀 분석] ${teamName}, 하위권 탈출 가능할까? 현재 ${standing}위`, content: `${teamName}이 부진을 면치 못하며 ${standing}위에 머무르고 있다. ${wins}승 ${losses}패(승률 ${winRate}%)로 하위권 탈출이 절실한 상황이다.` },
    { title: `전문가 '${teamName}, 근본적 변화 없이는 반등 어려워'`, content: `전문가들은 ${teamName}의 ${wins}승 ${losses}패(승률 ${winRate}%) 성적에 대해 "근본적인 변화 없이는 반등이 어렵다"고 분석했다. 특히 라인전 능력과 드래프트 전략의 개선이 필요하다는 지적이다.` },
    { title: `[팀 분석] ${teamName}, ${losses}패째... 팀 분위기 심상치 않아`, content: `${teamName}이 ${losses}패를 기록하며 ${standing}위로 추락했다. 팀 내부 분위기도 좋지 않은 것으로 알려져 향후 행보에 관심이 집중된다.` },
  ];

  const midTemplates = [
    { title: `[팀 분석] ${teamName}, ${standing}위로 중위권 유지... 승률 ${winRate}%`, content: `${teamName}이 ${wins}승 ${losses}패(승률 ${winRate}%)로 ${standing}위를 기록 중이다. 안정적인 성적을 유지하고 있으나 상위권 도약을 위해서는 추가적인 전력 보강이 필요하다는 분석이다.` },
    { title: `[팀 분석] ${teamName}, 중위권에서 기회 노린다 — ${standing}위`, content: `${teamName}이 ${wins}승 ${losses}패(승률 ${winRate}%)로 중위권을 유지하며 상위권 도약의 기회를 노리고 있다. 남은 경기에서의 성적이 플레이오프 진출 여부를 가를 전망이다.` },
    { title: `[팀 분석] ${teamName}, 로스터 변경 후 승률 변화 주목`, content: `${teamName}이 ${wins}승 ${losses}패(승률 ${winRate}%)로 ${standing}위를 기록 중이다. 최근 로스터 변경 이후 팀의 경기력 변화에 관심이 쏠리고 있다.` },
    { title: `분석: ${teamName}의 약점은 라인전, 중반 운영은 리그 상위`, content: `${teamName}(${wins}승 ${losses}패, 승률 ${winRate}%)의 경기 데이터를 분석한 결과, 라인전에서 다소 약한 모습을 보이지만 중반 운영 능력은 리그 상위권으로 평가됐다.` },
    { title: `[팀 분석] ${teamName}, 플레이오프 다크호스로 급부상`, content: `${teamName}이 ${wins}승 ${losses}패(승률 ${winRate}%)로 ${standing}위를 기록하며 플레이오프 다크호스로 떠오르고 있다. 전문가들은 ${teamName}의 성장세에 주목하고 있다.` },
  ];

  const pool = isStrong ? strongTemplates : isWeak ? weakTemplates : midTemplates;
  const chosen = pickRandom(pool);

  await insertNews(seasonId, date, 'team_analysis', chosen.title, chosen.content, 1, teamId);
}

/** SNS 반응 뉴스 */
export async function generateSocialMediaReaction(
  seasonId: number,
  date: string,
  content: string,
  teamId: string | null = null,
): Promise<void> {
  const titles = [
    `[SNS] ${content}`,
    `[SNS] '${content}' 관련 게시물 실시간 트렌드 1위`,
    `[SNS 화제] ${content}... 팬들 반응 폭발`,
    `[커뮤니티] '${content}' 뜨거운 논쟁 중`,
    `[SNS] ${content} — 실시간 댓글 수천 건 돌파`,
    `[화제] '${content}' 밈 확산... 커뮤니티 축제`,
  ];

  const bodies = [
    `팬들 사이에서 '${content}' 관련 게시물이 화제가 되고 있다. 다양한 의견이 오가며 커뮤니티가 뜨겁게 달아오르고 있다.`,
    `'${content}' 관련 SNS 게시물이 폭발적인 반응을 얻고 있다. 공유 수가 빠르게 증가하며 실시간 트렌드에 올랐다.`,
    `커뮤니티에서 '${content}'에 대한 토론이 과열되고 있다. 찬반 의견이 팽팽히 맞서며 댓글이 수백 개를 넘어섰다.`,
    `'${content}' 관련 밈이 SNS에서 빠르게 퍼지고 있다. 팬들의 창의적인 2차 창작물이 쏟아지며 분위기가 뜨겁다.`,
    `LCK 팬 커뮤니티에서 '${content}' 이슈가 최대 화제다. 전문가들의 분석 글도 올라오며 깊이 있는 토론이 이어지고 있다.`,
    `'${content}' 관련 게시물의 좋아요가 1만 건을 돌파했다. 해외 팬들까지 가세하며 글로벌 화제로 번지고 있다.`,
  ];

  const idx = randomInt(0, titles.length - 1);
  const cIdx = randomInt(0, bodies.length - 1);
  await insertNews(seasonId, date, 'social_media', titles[idx], bodies[cIdx], 1, teamId);
}

/** 인터뷰 뉴스 */
export async function generateInterviewNews(
  seasonId: number,
  date: string,
  playerName: string,
  teamName: string,
  topic: string,
  teamId: string | null = null,
  playerId: string | null = null,
): Promise<void> {
  const titles = [
    `[인터뷰] ${teamName} ${playerName}, "${topic}"`,
    `${playerName} 단독 인터뷰: "${topic}"`,
    `[독점] ${teamName} ${playerName} '${topic}'... 진솔한 속마음 공개`,
    `${playerName}, 인터뷰서 밝힌 각오 '${topic}'`,
    `[인터뷰] '${topic}' — ${teamName} ${playerName}의 솔직한 이야기`,
    `${teamName} ${playerName} '${topic}'... 팬들 뜨거운 반응`,
  ];

  const contents = [
    `${teamName} 소속 ${playerName}이 인터뷰에서 "${topic}"이라고 밝혔다. 팬들의 관심이 집중되고 있다.`,
    `${playerName}은 "${topic}"이라며 이번 시즌에 대한 강한 의지를 드러냈다. ${teamName} 팬들은 큰 기대를 보이고 있다.`,
    `${teamName}의 ${playerName}이 인터뷰에서 "${topic}"이라고 말해 화제다. 관계자는 "팀 전체가 같은 마음"이라고 전했다.`,
    `"${topic}" — ${playerName}의 이 한마디에 팬들의 반응이 폭발했다. SNS에서 관련 글이 빠르게 공유되고 있다.`,
    `${playerName}은 인터뷰에서 "${topic}"이라며 자신감을 보였다. 전문가들은 ${playerName}의 최근 경기력이 이를 뒷받침한다고 분석했다.`,
    `${teamName} ${playerName}이 팬들에게 전한 메시지: "${topic}". 진정성 있는 발언에 응원 댓글이 쏟아지고 있다.`,
  ];

  const idx = randomInt(0, titles.length - 1);
  const cIdx = randomInt(0, contents.length - 1);
  await insertNews(seasonId, date, 'interview', titles[idx], contents[cIdx], 1, teamId, playerId);
}

// ─────────────────────────────────────────
// 일간 뉴스 자동 생성
// ─────────────────────────────────────────

/** 일간 자동 뉴스 생성 (랜덤 1~3건) */
export async function generateDailyNews(
  seasonId: number,
  date: string,
  teams: Array<{ id: string; name: string; shortName: string }>,
): Promise<void> {
  const db = await getDatabase();
  const newsCount = randomInt(1, 3);

  for (let i = 0; i < newsCount; i++) {
    const type = nextRandom();
    const team = pickRandom(teams);

    if (type < 0.3) {
      // SNS 반응
      const snsTopics = [
        `${team.shortName} 드래프트 논란`,
        `${team.shortName} 팬미팅 후기`,
        `${team.shortName} 신규 유니폼 공개`,
        `${team.shortName} 선수 스트리밍 화제`,
        `이번 주 MVP 논란`,
        `LCK 순위 예측 토론`,
        `${team.shortName} 게임단 시설 공개 영상 화제`,
        `${team.shortName} 선수 듀오 랭크 명장면`,
        `LCK 역대 최고 경기 투표 결과`,
        `${team.shortName} 코치진 전략 분석 유튜브 화제`,
        `${team.shortName} 팬아트 대회 개최 소식`,
        `프로 선수 솔로랭크 티어 비교 논쟁`,
        `${team.shortName} 선수 브이로그 인기`,
        `LCK 올스타전 팬 투표 시작`,
      ];
      const topic = pickRandom(snsTopics);
      await generateSocialMediaReaction(seasonId, date, topic, team.id);
    } else if (type < 0.5) {
      // 이적 루머 (20% 확률) — 다른 팀 소속 실제 선수명 사용
      const rumorRows = await db.select<{ id: string; name: string }[]>(
        'SELECT id, name FROM players WHERE team_id != $1 AND team_id IS NOT NULL ORDER BY RANDOM() LIMIT 1',
        [team.id],
      );
      const rumorName = rumorRows.length > 0 ? rumorRows[0].name : pickRandom(['유망주 A', '베테랑 미드', '신인 정글러', '외국인 원딜']);
      const rumorPlayerId = rumorRows.length > 0 ? rumorRows[0].id : null;
      await generateTransferRumorNews(seasonId, date, rumorName, team.name, team.id, rumorPlayerId);
    } else if (type < 0.7) {
      // 인터뷰 — 해당 팀 소속 실제 선수명 사용
      const interviewRows = await db.select<{ id: string; name: string }[]>(
        'SELECT id, name FROM players WHERE team_id = $1 ORDER BY RANDOM() LIMIT 1',
        [team.id],
      );
      const playerName = interviewRows.length > 0 ? interviewRows[0].name : '선수';
      const playerId = interviewRows.length > 0 ? interviewRows[0].id : null;
      const topics = [
        '이번 시즌 목표는 우승',
        '팀 분위기가 정말 좋다',
        '매 경기 최선을 다하겠다',
        '팬들의 응원이 큰 힘이 된다',
        '개인 기량을 더 끌어올리겠다',
        '솔로랭크도 열심히 돌리고 있다',
        '스크림에서 손 맞추기가 좋아지고 있다',
        '코치님이 많이 도와주신다',
        '상대 팀 분석을 철저히 하고 있다',
        '새 패치에 적응 중인데 자신 있다',
        '올해는 국제대회 무대에 서고 싶다',
        '팬들에게 좋은 경기 보여드리겠다',
        '젊은 선수들의 성장이 눈에 띈다',
        '팀 내 경쟁이 치열해서 긴장감이 좋다',
      ];
      const topic = pickRandom(topics);
      await generateInterviewNews(seasonId, date, playerName, team.name, topic, team.id, playerId);
    } else {
      // 팀 분석 기사 (간략 버전 — 실제 순위 없이)
      const analysisPool = [
        { title: `[분석] ${team.name}, 최근 경기력 어떨까?`, content: `전문가들이 ${team.name}의 최근 경기력을 분석했다. 팀의 전략적 깊이와 개인기 조합이 주목받고 있으며, 앞으로의 행보가 기대된다.` },
        { title: `[분석] ${team.name}의 드래프트 트렌드 변화`, content: `${team.name}이 최근 경기에서 새로운 드래프트 전략을 시도하고 있다. 전문가들은 메타 변화에 대한 빠른 적응력을 높이 평가했다.` },
        { title: `[칼럼] ${team.name}, 올 시즌 진짜 실력은?`, content: `${team.name}의 올 시즌 경기력에 대해 전문가들의 의견이 분분하다. 라인전 능력과 매크로 운영 모두에서 개선점이 보인다는 분석이다.` },
        { title: `[분석] ${team.name} 팀파이트 능력 집중 분석`, content: `${team.name}의 팀파이트 데이터를 분석한 결과, 오브젝트 컨트롤과 이니시에이팅 타이밍이 핵심 강점으로 꼽혔다.` },
        { title: `전문가 칼럼: ${team.name}의 성장 포인트는?`, content: `전문가들이 ${team.name}의 성장 가능성을 진단했다. 선수 개인 역량과 팀 시너지가 시즌 중반을 향해 맞물려가는 양상이다.` },
        { title: `[분석] ${team.name}, 미드-정글 시너지 돋보여`, content: `${team.name}의 미드-정글 라인이 최근 좋은 시너지를 보여주고 있다. 전문가들은 이 조합이 팀 승률의 핵심이라고 분석했다.` },
      ];
      const chosen = pickRandom(analysisPool);
      await insertNews(seasonId, date, 'team_analysis', chosen.title, chosen.content, 1, team.id);
    }
  }
}

// ─────────────────────────────────────────
// 부상 뉴스
// ─────────────────────────────────────────

/** 부상 보도 뉴스 */
export async function generateInjuryNews(
  seasonId: number,
  date: string,
  playerName: string,
  teamName: string,
  injuryType: string,
  severity: number,
  daysRemaining: number,
  teamId: string | null = null,
  playerId: string | null = null,
): Promise<void> {
  // AI 뉴스 생성 시도
  try {
    const aiNews = await generateNewsArticle({
      eventType: 'injury',
      details: `${playerName}, ${injuryType} 부상으로 ${daysRemaining}일 결장 (심각도: ${severity}/3)`,
      teamNames: [teamName],
      playerNames: [playerName],
    });
    await insertNews(seasonId, date, 'injury_report', aiNews.title, aiNews.content, severity + 1, teamId, playerId);
    return;
  } catch { /* AI 실패 시 기존 템플릿 사용 */ }

  const severityTemplates: Record<number, { title: string[]; content: string[] }> = {
    1: {
      title: [
        `${teamName} ${playerName}, 경미한 부상으로 며칠 결장`,
        `${playerName}, ${injuryType} 증상으로 단기 이탈`,
        `${teamName}, ${playerName} 경미한 부상... ${daysRemaining}일 결장 예상`,
      ],
      content: [
        `${teamName} 소속 ${playerName}이 경미한 ${injuryType} 증상으로 약 ${daysRemaining}일간 결장할 예정이다. 팀 관계자는 "큰 문제는 아니다"라고 밝혔다.`,
        `${playerName}이 ${injuryType}으로 인해 잠시 팀 훈련에서 이탈했다. ${daysRemaining}일 후 복귀가 예상된다.`,
      ],
    },
    2: {
      title: [
        `${teamName} ${playerName}, ${injuryType}으로 2~3주 결장`,
        `${playerName}, 부상으로 장기간 이탈... ${teamName} 비상`,
        `${teamName}, ${playerName} 부상 소식에 로스터 조정 불가피`,
      ],
      content: [
        `${teamName}의 ${playerName}이 ${injuryType}으로 약 ${daysRemaining}일간 결장할 전망이다. 팀은 대체 선수 기용을 준비 중이다.`,
        `${playerName}의 부상 소식에 ${teamName} 팬들의 우려가 커지고 있다. 의료진은 약 ${daysRemaining}일 후 복귀를 목표로 재활에 들어갔다고 밝혔다.`,
      ],
    },
    3: {
      title: [
        `[속보] ${teamName} ${playerName}, 심각한 부상으로 장기 결장`,
        `${playerName}, ${injuryType} 심각... ${daysRemaining}일 이상 결장 불가피`,
        `${teamName} 최대 위기! ${playerName} 장기 부상`,
      ],
      content: [
        `${teamName}의 핵심 선수 ${playerName}이 심각한 ${injuryType}으로 최소 ${daysRemaining}일간 결장한다. 시즌에 큰 타격이 예상된다.`,
        `${playerName}의 장기 부상 소식이 전해지며 ${teamName}의 시즌 전망에 먹구름이 드리워졌다. 의료진은 완전 회복까지 상당한 시간이 필요하다고 밝혔다.`,
      ],
    },
  };

  const templates = severityTemplates[severity] ?? severityTemplates[1];
  const titleIdx = randomInt(0, templates.title.length - 1);
  const contentIdx = randomInt(0, templates.content.length - 1);

  await insertNews(seasonId, date, 'injury_report', templates.title[titleIdx], templates.content[contentIdx], severity + 1, teamId, playerId);
}

// ─────────────────────────────────────────
// 이적 확정 뉴스
// ─────────────────────────────────────────

export async function generateTransferCompleteNews(
  seasonId: number,
  date: string,
  playerName: string,
  fromTeam: string,
  toTeam: string,
  fee: number,
  teamId: string | null = null,
  playerId: string | null = null,
): Promise<void> {
  // AI 뉴스 생성 시도
  try {
    const aiNews = await generateNewsArticle({
      eventType: 'transfer',
      details: `${playerName}, ${fromTeam}에서 ${toTeam}로 이적 (이적료: ${fee.toLocaleString()}만)`,
      teamNames: [toTeam, fromTeam],
      playerNames: [playerName],
    });
    const isBigTransfer = fee > 10000;
    await insertNews(seasonId, date, 'transfer_complete', aiNews.title, aiNews.content, isBigTransfer ? 3 : 2, teamId, playerId);
    return;
  } catch { /* AI 실패 시 기존 템플릿 사용 */ }

  const isBig = fee > 10000;
  const feeStr = fee.toLocaleString();

  const titles = isBig ? [
    `[오피셜] ${toTeam}, ${playerName} 영입 확정! 이적료 ${feeStr}만`,
    `대어 낚았다! ${toTeam}, ${playerName} ${feeStr}만에 영입`,
    `${playerName}, ${fromTeam} 떠나 ${toTeam}로... 이적료 ${feeStr}만`,
    `역대급 이적! ${toTeam}, ${playerName}에 ${feeStr}만 투자`,
    `[속보] ${playerName} ${toTeam} 행 확정 — 이적료 ${feeStr}만으로 역대 TOP`,
    `${toTeam}, 지갑 열었다! ${playerName} ${feeStr}만에 전격 영입`,
  ] : [
    `${toTeam}, ${playerName} 영입 발표`,
    `${playerName}, ${fromTeam}에서 ${toTeam}로 이적`,
    `${toTeam}, ${playerName} 합류 공식 발표`,
    `[오피셜] ${playerName}, ${toTeam} 유니폼 입는다`,
    `${fromTeam} 떠난 ${playerName}, ${toTeam}에서 새 출발`,
    `${toTeam}, ${playerName} 영입으로 전력 보강 완료`,
  ];

  const contents = [
    `${toTeam}이 ${fromTeam}에서 ${playerName}을 이적료 ${feeStr}만 원에 영입했다고 공식 발표했다.`,
    `${playerName}이 ${fromTeam}을 떠나 ${toTeam}에 합류한다. 이적료는 ${feeStr}만 원으로 알려졌다.`,
    `${toTeam}의 로스터 보강이 완료되었다. ${playerName}이 ${fromTeam}에서 합류하며 전력 상승이 기대된다.`,
    `${playerName}이 ${toTeam}의 새 유니폼을 입고 팬들 앞에 섰다. "새로운 도전이 기대된다"며 소감을 밝혔다.`,
    `${toTeam} 관계자는 "${playerName} 영입으로 팀의 약점을 보완할 수 있게 됐다"며 만족감을 드러냈다.`,
    `${fromTeam}에서 핵심 역할을 했던 ${playerName}이 ${toTeam}으로 둥지를 옮겼다. 팬들의 기대가 크다.`,
  ];

  const idx = randomInt(0, titles.length - 1);
  const cIdx = randomInt(0, contents.length - 1);
  await insertNews(seasonId, date, 'transfer_complete', titles[idx], contents[cIdx], isBig ? 3 : 2, teamId, playerId);
}

// ─────────────────────────────────────────
// 스캔들/논란 뉴스
// ─────────────────────────────────────────

export type ScandalType = 'teammate_conflict' | 'social_media' | 'dating' | 'streaming_incident' | 'attitude';

export async function generateScandalNews(
  seasonId: number,
  date: string,
  teams: Array<{ id: string; name: string; shortName: string }>,
): Promise<{ teamId: string; moralePenalty: number } | null> {
  // 일일 10% 확률로 스캔들 발생
  if (nextRandom() >= 0.10) return null;

  const team = pickRandom(teams);
  const scandalTypes: { type: ScandalType; title: string; content: string; penalty: number }[] = [
    { type: 'teammate_conflict', title: `${team.shortName} 팀 내 불화설... 선수 간 갈등 심화`, content: `${team.name} 내부에서 선수 간 갈등이 심화되고 있다는 소식이 전해졌다. 팀 관계자는 "사실무근"이라고 부인했지만 커뮤니티에서는 관련 루머가 확산 중이다.`, penalty: 10 },
    { type: 'social_media', title: `${team.shortName} 선수 SNS 논란... 커뮤니티 뜨겁게 달아올라`, content: `${team.name} 소속 선수의 SNS 게시물이 논란이 되고 있다. 해당 선수는 이후 게시물을 삭제했으나 이미 캡처본이 퍼진 상태다.`, penalty: 8 },
    { type: 'dating', title: `${team.shortName} 선수 열애설... 팬들 반응 엇갈려`, content: `${team.name} 선수의 열애설이 화제다. 일부 팬들은 응원하는 반면, 경기에 집중해달라는 의견도 있다.`, penalty: 5 },
    { type: 'streaming_incident', title: `${team.shortName} 선수 방송 사고... 게임 중 욕설 논란`, content: `${team.name} 소속 선수가 개인 방송 중 상대에게 욕설을 한 장면이 클립으로 퍼지면서 논란이 되고 있다. 팀은 공식 사과문을 발표할 예정이다.`, penalty: 12 },
    { type: 'attitude', title: `${team.shortName} 선수 태도 논란... 연습 태만 의혹`, content: `${team.name} 내부에서 특정 선수의 연습 태도에 대한 불만이 제기되고 있다는 소식이다. 해당 선수는 최근 경기에서 부진한 모습을 보인 바 있다.`, penalty: 8 },
  ];

  const scandal = pickRandom(scandalTypes);

  // AI 뉴스 생성 시도
  try {
    const aiNews = await generateNewsArticle({
      eventType: 'scandal',
      details: `${team.name} ${scandal.type} 스캔들`,
      teamNames: [team.name],
      playerNames: [],
    });
    await insertNews(seasonId, date, 'scandal', aiNews.title, aiNews.content, 2, team.id);
  } catch {
    await insertNews(seasonId, date, 'scandal', scandal.title, scandal.content, 2, team.id);
  }

  return { teamId: team.id, moralePenalty: scandal.penalty };
}

// ─────────────────────────────────────────
// 팬 반응 뉴스
// ─────────────────────────────────────────

export async function generateFanReactionNews(
  seasonId: number,
  date: string,
  teamName: string,
  event: 'win_streak' | 'lose_streak' | 'big_transfer' | 'scandal' | 'championship',
  sentiment: 'positive' | 'negative' | 'neutral',
  teamId: string | null = null,
): Promise<void> {
  const templates: Record<string, Record<string, string[]>> = {
    positive: {
      win_streak: [
        `팬들 열광! ${teamName} 연승 질주에 커뮤니티 축제 분위기`,
        `${teamName} 연승 행진에 팬들 '올해는 우승이다!'`,
        `${teamName} 연승 기록 갱신! 팬들 '역대 최강 로스터'`,
        `커뮤니티 폭발! ${teamName} 연승에 승부 예측 적중한 팬 화제`,
        `${teamName} 연승에 팬 카페 가입자 급증... '우승 기운 느껴진다'`,
      ],
      big_transfer: [
        `${teamName} 대형 영입에 팬들 환호! '역대급 로스터'`,
        `팬들 반응 폭발! ${teamName} 로스터 완성에 기대감 MAX`,
        `${teamName} 영입 소식에 팬들 '드림팀 완성!' 축제 분위기`,
        `${teamName} 로스터 보강 소식에 유니폼 판매량 급증`,
      ],
      championship: [
        `${teamName} 우승에 팬들 감동의 눈물... '기다린 보람이 있었다'`,
        `${teamName} 우승! 팬들 거리 응원전에 수천 명 운집`,
        `'드디어 해냈다!' ${teamName} 팬들 SNS 축제 분위기`,
      ],
    },
    negative: {
      lose_streak: [
        `${teamName} 연패에 팬들 분노... '로스터 변경 시급'`,
        `팬들 한숨... ${teamName} 연패 늪에서 빠져나올 수 있을까`,
        `${teamName} 연패에 팬 카페 분위기 싸늘... '감독 경질 요구'`,
        `'이게 프로야?' ${teamName} 연패에 팬들 격분`,
        `${teamName} 연패 기록 갱신... 팬들 '전력 분석 다시 해야'`,
      ],
      scandal: [
        `${teamName} 스캔들에 팬들 실망... '프로답지 못하다'`,
        `${teamName} 논란에 팬들 탈퇴 잇따라... 팬카페 분위기 냉각`,
        `'실망스럽다' ${teamName} 스캔들에 팬들 뿔났다`,
      ],
    },
    neutral: {
      big_transfer: [
        `${teamName} 영입 소식에 팬들 반응 엇갈려... 기대와 우려 교차`,
        `${teamName} 로스터 변경, 팬들 찬반 팽팽... '지켜봐야'`,
      ],
    },
  };

  const pool = templates[sentiment]?.[event] ?? [`${teamName} 관련 팬 반응이 뜨겁다.`];
  const title = pickRandom(pool);

  const contentPool = [
    `${teamName} 관련 소식에 팬들의 반응이 SNS와 커뮤니티를 뜨겁게 달구고 있다.`,
    `${teamName} 관련 게시물이 실시간 트렌드에 오르며 팬들의 댓글 전쟁이 벌어지고 있다.`,
    `온라인 커뮤니티에서 ${teamName} 관련 토론이 과열되고 있다. 팬들 사이에서 다양한 의견이 충돌 중이다.`,
    `${teamName} 소식에 SNS 반응이 폭발적이다. 관련 해시태그가 트렌드 상위권에 올랐다.`,
    `팬 카페에서 ${teamName} 관련 글이 쏟아지고 있다. 찬성과 반대 의견이 팽팽히 맞서고 있다.`,
    `${teamName} 소식이 전해지자 커뮤니티가 들끓고 있다. 전문가 분석 글부터 감정적 반응까지 다양한 글이 올라오고 있다.`,
  ];
  const content = pickRandom(contentPool);

  await insertNews(seasonId, date, 'fan_reaction', title, content, 1, teamId);
}

// ─────────────────────────────────────────
// 수상 뉴스
// ─────────────────────────────────────────

export async function generateAwardNews(
  seasonId: number,
  date: string,
  playerName: string,
  awardType: string,
  teamName: string,
  teamId: string | null = null,
  playerId: string | null = null,
): Promise<void> {
  const awardLabels: Record<string, string> = {
    mvp: 'MVP', all_pro: 'All-Pro', rookie: '신인상', finals_mvp: '결승 MVP',
  };
  const label = awardLabels[awardType] ?? awardType;

  const titles = [
    `${teamName} ${playerName}, ${label} 수상!`,
    `[수상] ${playerName}, ${label} 선정... ${teamName}의 자랑`,
    `${playerName}, ${label} 영예! ${teamName} 팬들 환호`,
    `압도적 활약! ${playerName}, 만장일치로 ${label} 선정`,
    `${playerName}, ${label} 수상 '팀 덕분에 가능했다'`,
    `[시상식] ${teamName} ${playerName}, ${label} 트로피 품에 안아`,
  ];
  const contents = [
    `${teamName} 소속 ${playerName}이 이번 시즌 ${label}로 선정되었다. 뛰어난 활약이 높은 평가를 받았다.`,
    `${playerName}이 ${label}을 수상하며 최고의 시즌을 보내고 있음을 증명했다. ${teamName} 관계자는 "당연한 결과"라며 축하했다.`,
    `${playerName}은 수상 소감에서 "팀원들과 코치진 덕분"이라며 겸손한 모습을 보였다. 팬들은 SNS에서 축하 인사를 보냈다.`,
    `시상식에서 ${playerName}은 "${label}을 받게 되어 영광이다. 남은 시즌도 열심히 하겠다"고 소감을 밝혔다.`,
    `${playerName}의 ${label} 수상에 대해 해설진은 "이번 시즌 가장 임팩트 있는 선수"라고 평가했다.`,
  ];

  const idx = randomInt(0, titles.length - 1);
  const cIdx = randomInt(0, contents.length - 1);
  await insertNews(seasonId, date, 'award_news', titles[idx], contents[cIdx], 3, teamId, playerId);
}

/** 패치 노트 뉴스 */
export async function generatePatchNotesNews(
  seasonId: number,
  date: string,
  patchNumber: number,
  changeCount: number,
  patchNote: string,
): Promise<void> {
  const titles = [
    `패치 ${patchNumber} 적용 — 챔피언 ${changeCount}건 밸런스 조정`,
    `[패치 ${patchNumber}] 대규모 밸런스 패치! ${changeCount}개 챔피언 변경`,
    `패치 ${patchNumber} 라이브 적용 — 메타 변동 예고, ${changeCount}건 조정`,
    `[속보] 패치 ${patchNumber} 공개! 프로씬 메타 뒤집힐까? (${changeCount}건)`,
    `패치 ${patchNumber} 핵심 요약: ${changeCount}개 챔피언 너프/버프`,
  ];
  const title = pickRandom(titles);
  await insertNews(seasonId, date, 'patch_notes', title, patchNote, 2);
}

// ─────────────────────────────────────────
// 조회 함수
// ─────────────────────────────────────────

/** 날짜별 뉴스 조회 */
export async function getNewsByDate(seasonId: number, date: string): Promise<NewsArticle[]> {
  const db = await getDatabase();
  const rows = await db.select<NewsArticleRow[]>(
    `SELECT id, season_id, article_date, category, title, content,
            related_team_id, related_player_id, importance, is_read
     FROM news_articles
     WHERE season_id = $1 AND article_date = $2
     ORDER BY importance DESC, id DESC`,
    [seasonId, date],
  );
  return rows.map(mapRowToNewsArticle);
}

/** 최근 뉴스 조회 */
export async function getRecentNews(
  seasonId: number,
  limit: number = 30,
  offset: number = 0,
  category?: NewsCategory,
): Promise<NewsArticle[]> {
  const db = await getDatabase();

  let sql = `SELECT id, season_id, article_date, category, title, content,
                    related_team_id, related_player_id, importance, is_read
             FROM news_articles
             WHERE season_id = $1`;
  const params: unknown[] = [seasonId];

  if (category) {
    sql += ` AND category = $2`;
    params.push(category);
  }

  sql += ` ORDER BY article_date DESC, importance DESC, id DESC`;
  sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const rows = await db.select<NewsArticleRow[]>(sql, params);
  return rows.map(mapRowToNewsArticle);
}

/** 읽지 않은 뉴스 수 */
export async function getUnreadCount(seasonId: number): Promise<number> {
  const db = await getDatabase();
  const rows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM news_articles WHERE season_id = $1 AND is_read = 0`,
    [seasonId],
  );
  return rows[0]?.cnt ?? 0;
}

/** 읽음 처리 */
export async function markAsRead(newsId: number): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `UPDATE news_articles SET is_read = 1 WHERE id = $1`,
    [newsId],
  );
}

/** 전체 읽음 처리 */
export async function markAllAsRead(seasonId: number): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `UPDATE news_articles SET is_read = 1 WHERE season_id = $1 AND is_read = 0`,
    [seasonId],
  );
}
