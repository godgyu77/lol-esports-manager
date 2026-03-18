/**
 * 뉴스/미디어 시스템 엔진
 * - 경기 결과, 이적 루머, 팀 분석, SNS 등 자동 뉴스 생성
 * - 날짜별/카테고리별 조회, 읽음 처리
 */

import type { NewsArticle, NewsCategory } from '../../types/news';
import { getDatabase } from '../../db/database';

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

  const idx = Math.floor(Math.random() * templates.length);
  const importance = winScore === loseScore + 1 ? 2 : 1; // 접전일수록 중요

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

  const idx = Math.floor(Math.random() * templates.length);
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
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  await insertNews(seasonId, date, 'team_analysis', chosen.title, chosen.content, 1, teamId);
}

/** SNS 반응 뉴스 */
export async function generateSocialMediaReaction(
  seasonId: number,
  date: string,
  content: string,
  teamId: string | null = null,
): Promise<void> {
  const title = `[SNS] ${content}`;
  const body = `팬들 사이에서 '${content}' 관련 게시물이 화제가 되고 있다. 다양한 의견이 오가며 커뮤니티가 뜨겁게 달아오르고 있다.`;

  await insertNews(seasonId, date, 'social_media', title, body, 1, teamId);
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
  const title = `[인터뷰] ${teamName} ${playerName}, "${topic}"`;
  const content = `${teamName} 소속 ${playerName}이 인터뷰에서 "${topic}"이라고 밝혔다. 팬들의 관심이 집중되고 있다.`;

  await insertNews(seasonId, date, 'interview', title, content, 1, teamId, playerId);
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
  const newsCount = 1 + Math.floor(Math.random() * 3); // 1~3건

  for (let i = 0; i < newsCount; i++) {
    const type = Math.random();
    const team = teams[Math.floor(Math.random() * teams.length)];

    if (type < 0.3) {
      // SNS 반응
      const snsTopics = [
        `${team.shortName} 드래프트 논란`,
        `${team.shortName} 팬미팅 후기`,
        `${team.shortName} 신규 유니폼 공개`,
        `${team.shortName} 선수 스트리밍 화제`,
        `이번 주 MVP 논란`,
        `LCK 순위 예측 토론`,
      ];
      const topic = snsTopics[Math.floor(Math.random() * snsTopics.length)];
      await generateSocialMediaReaction(seasonId, date, topic, team.id);
    } else if (type < 0.5) {
      // 이적 루머 (20% 확률)
      const rumorNames = ['유망주 A', '베테랑 미드', '신인 정글러', '외국인 원딜'];
      const name = rumorNames[Math.floor(Math.random() * rumorNames.length)];
      await generateTransferRumorNews(seasonId, date, name, team.name, team.id);
    } else if (type < 0.7) {
      // 인터뷰
      const topics = [
        '이번 시즌 목표는 우승',
        '팀 분위기가 정말 좋다',
        '매 경기 최선을 다하겠다',
        '팬들의 응원이 큰 힘이 된다',
        '개인 기량을 더 끌어올리겠다',
      ];
      const topic = topics[Math.floor(Math.random() * topics.length)];
      await generateInterviewNews(seasonId, date, '선수', team.name, topic, team.id);
    } else {
      // 팀 분석 기사 (간략 버전 — 실제 순위 없이)
      const title = `[분석] ${team.name}, 최근 경기력 어떨까?`;
      const content = `전문가들이 ${team.name}의 최근 경기력을 분석했다. 팀의 전략적 깊이와 개인기 조합이 주목받고 있으며, 앞으로의 행보가 기대된다.`;
      await insertNews(seasonId, date, 'team_analysis', title, content, 1, team.id);
    }
  }
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
