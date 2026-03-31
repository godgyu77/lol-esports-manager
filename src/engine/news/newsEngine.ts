import type { NewsArticle, NewsCategory } from '../../types/news';
import { getDatabase } from '../../db/database';
import { generateNewsArticle } from '../../ai/advancedAiService';
import { nextRandom, pickRandom, randomInt } from '../../utils/random';

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

function enrichNewsContent(content: string, fallback: string): string {
  const trimmed = content.trim();
  if (trimmed.length >= 140) {
    return trimmed;
  }
  return [trimmed, fallback].filter(Boolean).join('\n\n').trim();
}

function buildNarrativeAftermath(options: string[]): string {
  return pickRandom(options);
}

function buildNewsParagraphs(...paragraphs: Array<string | null | undefined>): string {
  return paragraphs
    .map((paragraph) => paragraph?.trim())
    .filter((paragraph): paragraph is string => Boolean(paragraph))
    .join('\n\n');
}

function buildQuoteParagraph(speaker: string, quote: string): string {
  return `${speaker}는 "${quote}"라고 전했다.`;
}

function buildArticle(
  lead: string,
  analysis: string,
  reaction: string,
  outlook: string,
): string {
  return buildNewsParagraphs(lead, analysis, reaction, outlook);
}

function buildAiFallbackArticle(
  lead: string,
  analysisOptions: string[],
  reactionOptions: string[],
  outlookOptions: string[],
): string {
  return buildArticle(
    lead,
    buildNarrativeAftermath(analysisOptions),
    buildNarrativeAftermath(reactionOptions),
    buildNarrativeAftermath(outlookOptions),
  );
}

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
  const lead = `${date} 열린 ${homeTeam}와 ${awayTeam}의 경기에서는 ${winner}가 ${loser}를 ${winScore}:${loseScore}로 꺾었다. 경기는 초반부터 팽팽했지만, 승부처마다 더 날카로운 선택을 보여준 쪽은 결국 ${winner}였다.`;
  const fallback = buildAiFallbackArticle(
    lead,
    [
      `${winner}는 유리한 장면을 놓치지 않는 마무리 능력과 안정적인 오브젝트 설계로 경기의 중심을 잡았다는 평가를 받는다. ${loser}는 추격 기회를 만들긴 했지만 중요한 순간마다 한 박자씩 늦었다.`,
      `${winner}는 라인전에서 만든 작은 우위를 중반 운영으로 연결하며 흐름을 놓치지 않았다. 반면 ${loser}는 교전 설계와 밴픽 후속 대응에서 아쉬움을 남겼다는 분석이 뒤따랐다.`,
      `${winner}는 흔들릴 법한 구간에서도 전체 템포를 유지했고, ${loser}는 세트 후반으로 갈수록 선택이 무거워졌다. 결국 집중력 차이가 최종 스코어로 이어졌다.`,
    ],
    [
      buildQuoteParagraph('현장 해설', `${winner}는 준비한 구도를 끝까지 유지했고 ${loser}는 반격 타이밍을 살리지 못했다`),
      buildQuoteParagraph('중계진', `${winner}는 우세할 때 더 냉정했고 ${loser}는 급해질수록 판단이 흔들렸다`),
      buildQuoteParagraph('리그 관계자', `${winner}는 좋은 흐름을 이어가고 있고 ${loser}는 빠른 정비가 필요해 보인다`),
    ],
    [
      `이번 결과로 ${winner}는 다음 일정까지 분위기를 끌어올릴 발판을 마련했고, ${loser}는 로스터 운용과 경기 준비 과정 전반을 다시 점검해야 하는 과제를 안게 됐다.`,
      `${winner}의 상승세가 어디까지 이어질지 관심이 쏠리는 가운데, ${loser}는 다음 경기에서 반등 신호를 보여줘야 한다는 압박을 받게 됐다.`,
      `순위 경쟁이 치열한 시점인 만큼 이 경기의 여파는 당분간 이어질 가능성이 크다. ${winner}는 흐름 유지, ${loser}는 반전 마련이라는 분명한 숙제를 안고 다음 일정을 맞는다.`,
    ],
  );

  try {
    const aiNews = await generateNewsArticle({
      eventType: 'match_result',
      details: `${homeTeam} vs ${awayTeam}: ${scoreHome}:${scoreAway}`,
      teamNames: [homeTeam, awayTeam],
      playerNames: [],
    });
    await insertNews(seasonId, date, 'match_result', aiNews.title, enrichNewsContent(aiNews.content, fallback), importance);
    return;
  } catch {
    // Fall back to templated copy when AI generation is unavailable.
  }

  const title = pickRandom([
    `${winner}, ${loser} 상대로 ${winScore}:${loseScore} 승리`,
    `${winner} 승전보... ${loser} 제압 (${winScore}:${loseScore})`,
    `${loser} 울린 ${winner}, ${winScore}:${loseScore}로 경기 마감`,
    `${winner}, 접전 끝 ${loser} 꺾고 기세 유지`,
  ]);
  await insertNews(seasonId, date, 'match_result', title, fallback, importance);
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
  const title = pickRandom([
    `${teamName}, '${playerName}' 영입 검토설 확산`,
    `'${playerName}'와 ${teamName} 연결 고리 재부상`,
    `${teamName}, ${playerName} 영입 가능성 주목`,
    `${playerName} 이적설 재점화... ${teamName} 행 거론`,
  ]);
  const content = buildArticle(
    `${teamName}와 ${playerName}를 연결하는 이적설이 시장 안팎에서 다시 힘을 얻고 있다. 아직 공식 발표나 세부 조건 공개는 없지만, 복수의 관계자들은 ${teamName}가 전력 보강 후보군 가운데 ${playerName}를 유심히 살피고 있다고 전했다.`,
    buildNarrativeAftermath([
      `${playerName}의 경험과 현재 시장 상황을 감안하면 단순 탐색 수준을 넘어 실제 협상 가능성까지 열려 있다는 해석이 나온다. 다만 경쟁 구단의 개입 여부와 선수 측 요구 조건에 따라 속도는 크게 달라질 수 있다.`,
      `${teamName} 입장에서는 단기 전력 보강과 시즌 중반 흐름 반전을 동시에 노릴 수 있는 카드다. 반면 ${playerName} 측은 출전 보장과 팀 방향성을 함께 살펴야 하는 만큼 협상이 짧게 끝나지는 않을 전망이다.`,
      `시장에서는 이번 루머를 두고 실제 협상 초기 단계라는 시각과, 여론 반응을 떠보기 위한 탐색전이라는 시각이 엇갈린다. 다만 소문이 반복적으로 등장하고 있다는 점 자체가 관심의 온도를 보여준다는 분석도 있다.`,
    ]),
    buildNarrativeAftermath([
      buildQuoteParagraph('이적시장 관계자', `${teamName}가 필요한 포지션 보강을 진지하게 검토하는 것은 맞지만 아직 결론이 난 단계는 아니다`),
      buildQuoteParagraph('구단 사정에 밝은 인사', `${playerName}의 이름이 실제 후보군에 올라 있는 것은 사실이지만 세부 조건은 더 봐야 한다`),
      buildQuoteParagraph('업계 관계자', `이번 건은 단순 팬심 루머라기보다 시장 반응을 확인하는 움직임이 섞여 있다고 볼 수 있다`),
    ]),
    buildNarrativeAftermath([
      `루머가 길어질수록 선수 본인의 심리적 부담과 시장 가격 변동 가능성도 커진다. 업계는 이번 건이 단발성 소문으로 끝날지, 실제 계약 협상으로 번질지 예의주시하고 있다.`,
      `${teamName}가 실제 제안 단계까지 나아간다면 이번 루머는 곧 시즌 중 가장 큰 이적 이슈 가운데 하나로 커질 수 있다. 반대로 움직임이 멈출 경우 시장의 관심은 곧 다른 이름으로 넘어갈 가능성이 있다.`,
      `지금 단계에서는 확인되지 않은 정보가 많지만, 이적시장에서 중요한 것은 늘 속도보다 방향이다. ${teamName}의 다음 행보가 루머의 무게를 결정할 전망이다.`,
    ]),
  );
  await insertNews(seasonId, date, 'transfer_rumor', title, content, 2, teamId, playerId);
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
  const title = isStrong
    ? pickRandom([
        `[팀 분석] ${teamName}, ${standing}위 질주... 승률 ${winRate}%`,
        `[팀 분석] ${teamName}, 상위권 흐름 굳히는 중`,
        `${teamName}, ${wins}승 ${losses}패로 강세 지속`,
      ])
    : isWeak
      ? pickRandom([
          `[팀 분석] ${teamName}, ${standing}위 부진... 반등 가능할까`,
          `${teamName}, 승률 ${winRate}%에 머문 이유`,
          `[팀 분석] ${teamName}, 순위표 아래쪽에서 커지는 고민`,
        ])
      : pickRandom([
          `[팀 분석] ${teamName}, ${standing}위에서 흔들리는 균형`,
          `${teamName}, 중위권에서 기회와 불안 공존`,
          `[팀 분석] ${teamName}, 승률 ${winRate}%가 말해주는 현재`,
        ]);

  const content = buildArticle(
    `${teamName}는 현재 ${wins}승 ${losses}패, 승률 ${winRate}%로 ${standing}위에 올라 있다. 단순한 순위표 한 줄로 보일 수 있지만, 최근 경기 내용과 일정 흐름을 함께 놓고 보면 ${teamName}의 현재 위치는 훨씬 더 복합적으로 읽힌다.`,
    isStrong
      ? `${teamName}는 경기마다 흔들림 없는 운영과 안정적인 마무리 능력을 보여주며 상위권 흐름을 굳히고 있다. 특히 유리한 장면을 손실 없이 마무리하는 경기 운영은 현재 리그에서도 높은 평가를 받고 있다.`
      : isWeak
        ? `${teamName}의 고민은 단순한 패배 숫자보다 경기 흐름을 끊지 못하는 패턴에 있다는 분석이 나온다. 초반 구도는 나쁘지 않아도 중반 이후 선택의 일관성이 떨어지면서 스스로 주도권을 내주는 장면이 반복된다는 지적이다.`
        : `${teamName}는 상위권 도약과 중위권 정체 가능성이 동시에 열려 있는 구간에 놓여 있다. 잘 풀릴 때는 응집력이 돋보이지만, 압박이 강해질수록 세부 선택에서 기복이 드러난다는 평가가 따라붙는다.`,
    buildNarrativeAftermath([
      buildQuoteParagraph('해설진', `${teamName}는 지금 순위보다 경기 내용이 더 중요해지는 분기점에 서 있다`),
      buildQuoteParagraph('데이터 분석가', `${teamName}의 다음 두세 경기 결과가 이번 시즌 평가를 크게 갈라놓을 수 있다`),
      buildQuoteParagraph('리그 관계자', `${teamName}는 보완할 지점이 분명하지만 흐름을 타기 시작하면 무서운 팀이 될 수 있다`),
    ]),
    buildNarrativeAftermath([
      `남은 일정에서 ${teamName}가 지금의 강점을 유지하거나 약점을 얼마나 빠르게 정리하느냐에 따라 시즌의 톤이 달라질 전망이다. 순위 경쟁이 촘촘한 구간인 만큼 작은 반등과 작은 흔들림 모두 크게 확대될 수 있다.`,
      `결국 핵심은 다음 경기에서 무엇을 보여주느냐다. ${teamName}가 현재 수치를 추세로 바꿀 수 있다면 평가도 달라지겠지만, 같은 문제를 반복한다면 외부 시선은 더 빠르게 냉각될 가능성이 있다.`,
      `현재 성적은 출발점일 뿐이다. ${teamName}가 경기 내용까지 동반한 상승세를 증명할지, 아니면 순위표의 불안 요소를 지우지 못할지는 당분간 가장 흥미로운 관전 포인트 가운데 하나다.`,
    ]),
  );

  await insertNews(seasonId, date, 'team_analysis', title, content, 1, teamId);
}

/** SNS 반응 뉴스 */
export async function generateSocialMediaReaction(
  seasonId: number,
  date: string,
  content: string,
  teamId: string | null = null,
): Promise<void> {
  const title = pickRandom([
    `[SNS 이슈] ${content}`,
    `[커뮤니티 화제] '${content}' 반응 확산`,
    `[온라인 화제] ${content}`,
    `[팬 반응] '${content}' 뜨거운 토론`,
  ]);
  const body = buildArticle(
    `'${content}'를 둘러싼 온라인 반응이 빠르게 커지고 있다. SNS와 커뮤니티를 중심으로 관련 게시물이 연이어 올라오고 있으며, 단순한 화제 수준을 넘어 다음 경기와 팀 분위기까지 연결해 해석하는 시선도 늘고 있다.`,
    buildNarrativeAftermath([
      `초기에는 가벼운 밈과 짧은 의견이 주를 이뤘지만, 시간이 지나며 경기력 분석과 구단 운영 방향에 대한 토론으로 확장되는 흐름이다. 팬층의 기대감과 불안이 동시에 섞여 있다는 점이 이번 반응의 특징으로 꼽힌다.`,
      `관심이 커질수록 메시지의 무게도 달라진다. 단순한 인기 게시물 하나가 선수 개인의 이미지, 팀 브랜드, 경기 전 분위기까지 흔들 수 있다는 점에서 구단도 민감하게 반응할 수밖에 없다.`,
      `비슷한 이슈가 반복될 경우에는 팬 반응이 더 선명하게 양분되는 경향도 나타난다. 현재로서는 관심과 피로도가 동시에 올라가는 구간으로 해석할 수 있다는 분석이 나온다.`,
    ]),
    buildNarrativeAftermath([
      buildQuoteParagraph('커뮤니티 이용자', `재미로 시작된 이야기지만 지금은 팀 분위기까지 건드리는 주제로 커졌다`),
      buildQuoteParagraph('업계 관계자', `온라인 반응은 가볍게 보이지만 실제 구단 이미지와 스폰서 노출에도 영향을 준다`),
      buildQuoteParagraph('콘텐츠 담당자', `관심이 뜨거운 만큼 공식 대응 타이밍을 잘 잡는 것이 중요하다`),
    ]),
    buildNarrativeAftermath([
      `이번 이슈가 짧은 유행으로 끝날지, 아니면 구단과 선수단이 직접 관리해야 하는 현안으로 커질지는 며칠 내 반응 추이에 따라 갈릴 전망이다.`,
      `결국 중요한 것은 경기 결과와 후속 대응이다. 성적이 받쳐주면 화제는 호재로 남겠지만, 반대의 경우에는 피로감과 비판 여론이 더 강하게 증폭될 수 있다.`,
      `온라인 여론은 한 번 방향을 타면 생각보다 오래 남는다. 구단 입장에서는 지금의 반응을 마케팅 기회로 살릴지, 조기 진화가 필요한 리스크로 볼지 판단해야 하는 시점이다.`,
    ]),
  );

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
  const title = pickRandom([
    `[인터뷰] ${teamName} ${playerName}, "${topic}"`,
    `${playerName} 단독 인터뷰... "${topic}"`,
    `[직격 인터뷰] ${teamName} ${playerName}의 메시지`,
    `${playerName}, 공개 발언으로 팀 분위기 조명`,
  ]);
  const content = buildArticle(
    `${teamName} 소속 ${playerName}는 최근 인터뷰에서 "${topic}"라는 메시지를 남겼다. 짧은 한 문장이었지만, 팀 안팎에서는 이 발언이 현재 분위기와 향후 일정에 대한 인식을 드러낸 신호로 받아들여지고 있다.`,
    buildNarrativeAftermath([
      `${playerName}의 발언은 자신감의 표현이자 동시에 팀이 처한 상황을 의식한 메시지로 읽힌다. 인터뷰 직후 팬 커뮤니티에서는 발언의 진정성과 타이밍을 두고 다양한 해석이 이어졌다.`,
      `선수 인터뷰는 늘 경기력 이상의 의미를 가진다. 특히 시즌 중반처럼 분위기 관리가 중요한 시기에는 한 문장만으로도 팀의 긴장감과 방향성이 동시에 드러나기 마련이다.`,
      `이번 발언은 단순한 각오 표명처럼 보이지만, 팀 내부 결속과 외부 기대치를 조율하는 역할도 함께 하고 있다는 평가가 나온다.`,
    ]),
    buildNarrativeAftermath([
      buildQuoteParagraph('현장 관계자', `${playerName}의 말에는 요즘 팀이 느끼는 분위기가 꽤 솔직하게 묻어났다`),
      buildQuoteParagraph('해설위원', `이런 인터뷰는 잘 풀리면 결속의 상징이 되지만 결과가 따라주지 않으면 더 큰 부담으로 돌아오기도 한다`),
      buildQuoteParagraph('팬 반응', `말보다 경기로 증명해주길 바란다는 기대와 응원이 함께 나온다`),
    ]),
    buildNarrativeAftermath([
      `결국 이번 인터뷰의 진짜 의미는 다음 경기 결과와 함께 평가될 가능성이 크다. 메시지가 팀의 자신감으로 남을지, 아니면 부담의 시작으로 기록될지는 멀지 않은 일정 속에서 드러날 전망이다.`,
      `발언 자체는 강하지 않았지만 시점은 분명했다. 구단과 선수단 모두 이 메시지가 긍정적인 동력으로 이어지길 바라고 있다는 해석이 설득력을 얻고 있다.`,
      `인터뷰는 끝났지만 여운은 남아 있다. ${playerName}가 다음 무대에서 어떤 경기력을 보여주느냐가 이번 발언의 온도를 결정할 가능성이 크다.`,
    ]),
  );
  await insertNews(seasonId, date, 'interview', title, content, 1, teamId, playerId);
}

/** 일간 자동 뉴스 생성 (최대 1~3건) */
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
      const snsTopics = [
        `${team.shortName} 최근 스크림 분위기`,
        `${team.shortName} 신입 선수 적응기`,
        `${team.shortName} 선수 브이로그 공개`,
        `${team.shortName} 코치진 메타 분석 영상`,
        `이번 주 MVP 후보 토론`,
        `리그 순위 경쟁 구도`,
        `${team.shortName} 훈련장 비하인드`,
      ];
      await generateSocialMediaReaction(seasonId, date, pickRandom(snsTopics), team.id);
    } else if (type < 0.5) {
      const rumorRows = await db.select<{ id: string; name: string }[]>(
        'SELECT id, name FROM players WHERE team_id != $1 AND team_id IS NOT NULL ORDER BY RANDOM() LIMIT 1',
        [team.id],
      );
      const rumorName = rumorRows[0]?.name ?? pickRandom(['에이스 탑', '베테랑 미드', '주목받는 원딜', '유망주 정글']);
      const rumorPlayerId = rumorRows[0]?.id ?? null;
      await generateTransferRumorNews(seasonId, date, rumorName, team.name, team.id, rumorPlayerId);
    } else if (type < 0.7) {
      const interviewRows = await db.select<{ id: string; name: string }[]>(
        'SELECT id, name FROM players WHERE team_id = $1 ORDER BY RANDOM() LIMIT 1',
        [team.id],
      );
      const playerName = interviewRows[0]?.name ?? '선수';
      const playerId = interviewRows[0]?.id ?? null;
      const topics = [
        '이번 시즌 목표는 결국 우승',
        '팀 분위기가 더 단단해지고 있다',
        '매 경기 최선을 다하겠다',
        '팬들의 응원이 큰 힘이 된다',
        '개인 기량도 더 끌어올리고 싶다',
        '스크림에서 맞춰가는 속도가 빨라졌다',
      ];
      await generateInterviewNews(seasonId, date, playerName, team.name, pickRandom(topics), team.id, playerId);
    } else {
      const standingRows = await db.select<{ wins: number; losses: number; standing: number }[]>(
        `SELECT wins, losses, standing
         FROM team_standings
         WHERE season_id = $1 AND team_id = $2
         LIMIT 1`,
        [seasonId, team.id],
      );
      const standing = standingRows[0]?.standing ?? randomInt(1, 10);
      const wins = standingRows[0]?.wins ?? randomInt(1, 10);
      const losses = standingRows[0]?.losses ?? randomInt(1, 10);
      await generateTeamAnalysisNews(seasonId, date, team.name, standing, wins, losses, team.id);
    }
  }
}

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
  const fallback = buildArticle(
    `${teamName}는 ${playerName}가 ${injuryType} 증세로 인해 최소 ${daysRemaining}일가량 실전에 나서기 어렵다고 밝혔다. 이번 부상은 선수 개인의 컨디션 문제를 넘어 팀 운영 전체에 변수로 작용할 가능성이 크다.`,
    buildNarrativeAftermath([
      `${playerName}의 이탈은 단순한 한 자리 공백이 아니라 역할 분담과 경기 준비 루틴 전체를 흔들 수 있다. 특히 비중이 큰 선수라면 대체 자원 가동과 전략 수정이 동시에 요구된다.`,
      `${teamName}는 당장 다음 경기부터 로테이션 조정 여부를 고민해야 한다. 회복 자체보다 무리한 조기 복귀를 피하는 것이 더 중요하다는 점에서 보수적인 대응이 예상된다.`,
      `부상이 길어질 경우 팀 전술의 축이 바뀔 가능성도 있다. 단기적으로는 대체 자원 준비, 중기적으로는 훈련 강도와 경기 운영 방식까지 손봐야 할 수 있다.`,
    ]),
    buildNarrativeAftermath([
      buildQuoteParagraph('메디컬 스태프', `복귀 시점보다 회복 과정이 더 중요하며 재발 방지에 초점을 맞추고 있다`),
      buildQuoteParagraph('구단 관계자', `선수 보호를 우선하되 팀 차원의 준비도 동시에 진행하고 있다`),
      buildQuoteParagraph('해설위원', `${playerName}의 공백은 경기력뿐 아니라 팀 안정감에도 영향을 줄 수 있다`),
    ]),
    buildNarrativeAftermath([
      `${teamName}가 이 공백을 얼마나 빠르게 정리하느냐에 따라 향후 일정의 난이도는 크게 달라질 수 있다. 팬들의 시선도 자연스럽게 대체 카드와 복귀 시점에 쏠릴 전망이다.`,
      `부상 관리가 길어질수록 외부 평가는 더 냉정해질 수 있다. 반대로 위기 구간을 버텨낸다면 오히려 팀 전체 응집력을 끌어올리는 계기가 될 가능성도 있다.`,
      `현재로서는 회복 경과를 지켜봐야 하지만, 최소한 당분간 ${teamName}는 기존 계획을 그대로 유지하기 어려운 상황이 됐다.`,
    ]),
  );

  try {
    const aiNews = await generateNewsArticle({
      eventType: 'injury',
      details: `${playerName}, ${injuryType} 부상으로 ${daysRemaining}일 결장 (심각도 ${severity}/3)`,
      teamNames: [teamName],
      playerNames: [playerName],
    });
    await insertNews(seasonId, date, 'injury_report', aiNews.title, enrichNewsContent(aiNews.content, fallback), severity + 1, teamId, playerId);
    return;
  } catch {
    // Fall back to templated copy when AI generation is unavailable.
  }

  const title = pickRandom([
    `[부상 속보] ${teamName} ${playerName}, ${injuryType}로 이탈`,
    `${playerName}, ${injuryType} 증세... ${teamName} 전력 운용 변수`,
    `${teamName}, ${playerName} 부상 확인... 예상 결장 ${daysRemaining}일`,
    `${playerName} 이탈한 ${teamName}, 로스터 재정비 불가피`,
  ]);
  await insertNews(seasonId, date, 'injury_report', title, fallback, severity + 1, teamId, playerId);
}

/** 이적 확정 뉴스 */
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
  const isBigTransfer = fee > 10000;
  const feeLabel = fee.toLocaleString();
  const fallback = buildArticle(
    `${toTeam}는 ${fromTeam}에서 뛰던 ${playerName} 영입을 공식 발표했다. 알려진 이적료는 ${feeLabel}만이며, 이번 계약은 ${isBigTransfer ? '시장 기준으로도 무게감이 큰 선택' : '즉시 전력감을 노린 실속형 보강'}으로 평가받고 있다.`,
    buildNarrativeAftermath([
      `${toTeam}는 이번 영입으로 약점 보완과 경기 플랜 다변화를 동시에 노리고 있다. ${playerName}가 빠르게 적응한다면 팀 전술의 선택지도 한층 넓어질 수 있다는 전망이 나온다.`,
      `${fromTeam} 입장에서는 공백을 메워야 하는 숙제가 생겼지만, 자원 재배치나 추가 영입 여지를 확보했다는 해석도 가능하다. 결국 이번 거래는 두 팀 모두에게 다음 선택을 강하게 요구하는 계약이 됐다.`,
      `이적 자체보다 중요한 것은 적응 속도와 역할 정리다. ${playerName}가 기대치에 맞는 퍼포먼스를 곧바로 보여줄 수 있느냐에 따라 이번 계약의 평가는 크게 달라질 전망이다.`,
    ]),
    buildNarrativeAftermath([
      buildQuoteParagraph('구단 관계자', `${playerName}의 합류로 팀 전력의 결을 조금 더 선명하게 만들 수 있을 것으로 본다`),
      buildQuoteParagraph('해설위원', `계약 규모보다 더 중요한 건 ${playerName}가 어떤 역할을 맡느냐`),
      buildQuoteParagraph('이적시장 관계자', `이번 영입은 ${toTeam}가 시즌 목표를 분명히 설정했다는 신호로 읽힌다`),
    ]),
    buildNarrativeAftermath([
      `팬들의 기대는 이미 커지고 있다. 다만 영입 발표의 열기와 실제 경기장 성과 사이에는 늘 시간차가 존재하는 만큼, 초반 적응 과정이 무엇보다 중요해졌다.`,
      `이번 계약이 성공 사례로 남기 위해서는 빠른 합류 효과가 필요하다. 반대로 적응이 지연될 경우, 큰 기대만큼 압박도 빠르게 커질 수 있다.`,
      `${toTeam}의 시즌 후반 운영은 이번 계약의 성공 여부와 밀접하게 연결될 가능성이 크다. ${fromTeam} 역시 남은 기간 로스터 재정비 성과를 보여줘야 한다.`,
    ]),
  );

  try {
    const aiNews = await generateNewsArticle({
      eventType: 'transfer',
      details: `${playerName}, ${fromTeam}에서 ${toTeam}로 이적 (이적료 ${feeLabel}만)`,
      teamNames: [toTeam, fromTeam],
      playerNames: [playerName],
    });
    await insertNews(seasonId, date, 'transfer_complete', aiNews.title, enrichNewsContent(aiNews.content, fallback), isBigTransfer ? 3 : 2, teamId, playerId);
    return;
  } catch {
    // Fall back to templated copy when AI generation is unavailable.
  }

  const title = pickRandom([
    `${toTeam}, ${playerName} 영입 공식 발표`,
    `${playerName}, ${fromTeam} 떠나 ${toTeam} 합류`,
    `[오피셜] ${toTeam}, ${playerName}와 계약 완료`,
    `${toTeam} 전력 보강 완료... ${playerName} 영입 확정`,
  ]);
  await insertNews(seasonId, date, 'transfer_complete', title, fallback, isBigTransfer ? 3 : 2, teamId, playerId);
}

export type ScandalType = 'teammate_conflict' | 'social_media' | 'dating' | 'streaming_incident' | 'attitude';

export async function generateScandalNews(
  seasonId: number,
  date: string,
  teams: Array<{ id: string; name: string; shortName: string }>,
): Promise<{ teamId: string; moralePenalty: number } | null> {
  if (nextRandom() >= 0.10) {
    return null;
  }

  const team = pickRandom(teams);
  const scandalTypes: { type: ScandalType; title: string; lead: string; penalty: number }[] = [
    {
      type: 'teammate_conflict',
      title: `${team.shortName} 내부 갈등설... 선수단 분위기 흔들리나`,
      lead: `${team.name} 내부에서 선수단 갈등이 있었다는 소문이 돌면서 구단 분위기에 대한 우려가 커지고 있다.`,
      penalty: 10,
    },
    {
      type: 'social_media',
      title: `${team.shortName} 선수 SNS 논란... 커뮤니티 시선 집중`,
      lead: `${team.name} 소속 선수의 SNS 활동이 예상치 못한 논란으로 번지며 구단의 위기관리 능력이 시험대에 올랐다.`,
      penalty: 8,
    },
    {
      type: 'dating',
      title: `${team.shortName} 선수 사생활 이슈... 여론 엇갈려`,
      lead: `${team.name} 소속 선수의 사생활 이슈가 온라인에서 확산되며 팀 외부 분위기에도 미묘한 파장을 남기고 있다.`,
      penalty: 5,
    },
    {
      type: 'streaming_incident',
      title: `${team.shortName} 방송 사고 여파... 선수 보호와 대응 주목`,
      lead: `${team.name} 소속 선수가 개인 방송 도중 구설수에 오르며 구단 대응 방식에 관심이 쏠리고 있다.`,
      penalty: 12,
    },
    {
      type: 'attitude',
      title: `${team.shortName} 태도 논란 재점화... 팀 기강 도마 위`,
      lead: `${team.name} 내부에서 특정 선수의 태도 문제를 둘러싼 이야기가 번지며 팀 운영 전반에 대한 시선도 날카로워지고 있다.`,
      penalty: 8,
    },
  ];

  const scandal = pickRandom(scandalTypes);
  const fallback = buildArticle(
    scandal.lead,
    buildNarrativeAftermath([
      `이번 이슈는 단순한 해프닝으로 끝날 수도 있지만, 대응이 늦어질 경우 팀 분위기와 외부 평판 모두에 부담으로 남을 수 있다. 특히 시즌이 길어질수록 사소한 균열이 경기력 문제로 번지는 경우가 적지 않다.`,
      `선수단 내부 문제는 사실 여부와 별개로 분위기에 영향을 준다. 현재 단계에서는 확인되지 않은 부분도 많지만, 구단이 얼마나 빠르게 정리된 메시지를 내놓느냐가 중요해졌다.`,
      `논란이 커질수록 구단은 경기 준비 외에도 커뮤니케이션 관리에 더 많은 에너지를 써야 한다. 그 자체가 팀 운영에 적지 않은 비용으로 작용할 수 있다는 지적도 나온다.`,
    ]),
    buildNarrativeAftermath([
      buildQuoteParagraph('업계 관계자', `이런 문제는 사실관계보다도 초반 대응이 분위기를 크게 좌우한다`),
      buildQuoteParagraph('팬 반응', `경기장 밖 이슈가 경기력까지 흔들지 않기를 바란다`),
      buildQuoteParagraph('해설진', `작은 균열도 시즌 중반에는 팀 전체에 크게 번질 수 있다`),
    ]),
    buildNarrativeAftermath([
      `결국 핵심은 다음 경기까지 얼마나 빠르게 팀을 안정화하느냐다. 후속 대응이 매끄럽다면 사건의 온도는 빠르게 식을 수 있지만, 정리가 늦어질 경우 시즌 전반의 이미지 문제로 이어질 가능성도 있다.`,
      `논란은 시간이 지나면 잊히기도 하지만, 같은 문제가 반복되면 팀 정체성에까지 상처를 남긴다. ${team.name}가 지금 어떤 방식으로 내부 분위기를 관리하느냐가 중요해졌다.`,
      `외부 시선은 이미 날카로워졌다. 지금부터는 해명보다 실제 팀 분위기와 경기 결과가 더 큰 설득력을 갖게 될 전망이다.`,
    ]),
  );

  try {
    const aiNews = await generateNewsArticle({
      eventType: 'scandal',
      details: `${team.name} ${scandal.type} 스캔들`,
      teamNames: [team.name],
      playerNames: [],
    });
    await insertNews(seasonId, date, 'scandal', aiNews.title, enrichNewsContent(aiNews.content, fallback), 2, team.id);
  } catch {
    await insertNews(seasonId, date, 'scandal', scandal.title, fallback, 2, team.id);
  }

  return { teamId: team.id, moralePenalty: scandal.penalty };
}

export async function generateFanReactionNews(
  seasonId: number,
  date: string,
  teamName: string,
  event: 'win_streak' | 'lose_streak' | 'big_transfer' | 'scandal' | 'championship',
  sentiment: 'positive' | 'negative' | 'neutral',
  teamId: string | null = null,
  contextNote?: string,
): Promise<void> {
  const templates: Record<string, Record<string, string[]>> = {
    positive: {
      win_streak: [`${teamName} 연승 행진에 팬들 환호`, `${teamName} 상승세에 커뮤니티 축제 분위기`],
      big_transfer: [`${teamName} 대형 영입에 기대감 폭발`, `${teamName} 보강 소식에 팬심 들썩`],
      championship: [`${teamName} 우승에 팬들 감격`, `${teamName} 정상 등극에 온라인 환호`],
    },
    negative: {
      lose_streak: [`${teamName} 연패에 팬심 흔들`, `${teamName} 부진에 비판 여론 확산`],
      scandal: [`${teamName} 논란에 팬 여론 냉각`, `${teamName} 악재에 실망감 커져`],
    },
    neutral: {
      big_transfer: [`${teamName} 영입 발표에 기대와 우려 교차`, `${teamName} 로스터 변화 놓고 반응 엇갈려`],
    },
  };

  const title = pickRandom(templates[sentiment]?.[event] ?? [`${teamName} 관련 팬 반응 확산`]);
  const lead = `${teamName}를 둘러싼 팬 반응이 온라인 전반으로 빠르게 번지고 있다. 승리와 패배, 영입과 악재에 따라 반응의 결은 다르지만 공통적으로 팀의 다음 선택을 향한 관심이 커지고 있다는 점은 분명하다.`;
  const analysis = sentiment === 'positive'
    ? `${teamName}를 향한 호의적인 반응은 기대감의 재확인에 가깝다. 팬들은 상승 흐름이 이어질 수 있다는 믿음을 드러내고 있고, 일부에서는 시즌 목표를 더 높게 잡아야 한다는 목소리도 나온다.`
    : sentiment === 'negative'
      ? `${teamName}를 향한 부정적 반응은 단순한 실망을 넘어 변화 요구로 이어지고 있다. 로스터 운용, 경기 내용, 팀 메시지 관리까지 여러 층위에서 비판이 이어지며 압박 수위가 올라가는 분위기다.`
      : `${teamName}를 향한 여론은 기대와 우려가 팽팽하게 맞서고 있다. 일부는 장기적 관점의 기다림을 말하지만, 다른 쪽에서는 지금 당장의 변화를 요구하며 의견이 갈리고 있다.`;
  const reaction = contextNote
    ? buildNewsParagraphs(
        contextNote,
        buildNarrativeAftermath([
          buildQuoteParagraph('팬 커뮤니티 반응', `지금은 감정적으로 흔들리기보다 다음 경기에서 어떤 답을 보여줄지가 더 중요하다`),
          buildQuoteParagraph('온라인 반응', `${teamName}의 현재 흐름은 단순한 결과 하나로 끝날 문제가 아니라는 인식이 퍼지고 있다`),
        ]),
      )
    : buildNarrativeAftermath([
        buildQuoteParagraph('팬 커뮤니티 반응', `${teamName}가 어떤 선택을 하느냐에 따라 여론은 금방 다시 움직일 수 있다`),
        buildQuoteParagraph('SNS 반응', `응원도 비판도 결국 다음 경기에서 무엇을 보여주느냐에 달려 있다`),
      ]);
  const outlook = buildNarrativeAftermath([
    `팬 여론은 결과가 이어질수록 더 큰 힘을 갖는다. ${teamName}가 다음 경기와 후속 대응에서 어떤 메시지를 내놓느냐에 따라 현재 분위기는 더 강한 지지로 바뀔 수도, 거센 압박으로 돌아설 수도 있다.`,
    `지금의 반응은 감정의 순간이지만, 반복되면 팀 이미지를 규정하는 흐름이 된다. 구단 입장에서는 성적과 커뮤니케이션 두 축을 동시에 관리해야 하는 시점이다.`,
    `결국 외부 반응을 바꾸는 가장 빠른 방법은 경기장 안에서 답을 내놓는 것이다. ${teamName}가 다음 일정에서 어떤 장면을 보여주느냐가 여론의 방향을 다시 정할 가능성이 크다.`,
  ]);

  await insertNews(seasonId, date, 'fan_reaction', title, buildArticle(lead, analysis, reaction, outlook), 1, teamId);
}

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
    mvp: 'MVP',
    all_pro: 'All-Pro',
    rookie: '신인상',
    finals_mvp: '결승 MVP',
  };
  const label = awardLabels[awardType] ?? awardType;
  const title = pickRandom([
    `${teamName} ${playerName}, ${label} 수상`,
    `[수상] ${playerName}, ${label} 영예`,
    `${playerName}, ${label} 선정으로 존재감 입증`,
    `${teamName} ${playerName}, ${label}로 시즌 조명`,
  ]);
  const content = buildArticle(
    `${teamName} 소속 ${playerName}가 ${label} 수상자로 이름을 올렸다. 이번 수상은 단순한 개인 타이틀을 넘어 시즌 내내 보여준 존재감과 영향력을 공식적으로 인정받았다는 의미를 갖는다.`,
    buildNarrativeAftermath([
      `${playerName}는 꾸준한 경기력과 결정적인 순간의 임팩트로 강한 인상을 남겼다. 팀 성적과 별개로 개인 퍼포먼스의 무게감이 충분히 평가받았다는 시선이 많다.`,
      `${label} 수상은 기록만으로 설명되지 않는다. 시즌 전체 흐름 속에서 ${playerName}가 팀에 어떤 안정감과 폭발력을 동시에 제공했는지가 높게 평가됐다는 해석이 뒤따른다.`,
      `${playerName}의 수상은 팀 내부에도 긍정적인 자극이 될 전망이다. 개인의 성과가 팀 경쟁력과 분리되지 않았다는 점에서 더 의미가 크다는 반응이 나온다.`,
    ]),
    buildNarrativeAftermath([
      buildQuoteParagraph('시상식 관계자', `${playerName}는 이번 시즌 가장 꾸준하면서도 인상적인 퍼포먼스를 보여준 선수 중 한 명이었다`),
      buildQuoteParagraph('팀 관계자', `개인의 영예이기도 하지만 결국 팀 전체가 함께 만든 결과라고 보고 있다`),
      buildQuoteParagraph('팬 반응', `수상이 놀랍지 않을 정도로 올 시즌 존재감이 뚜렷했다`),
    ]),
    buildNarrativeAftermath([
      `수상의 여운은 길게 남겠지만, 결국 선수와 팀 모두 다음 목표를 바라볼 수밖에 없다. ${playerName}가 이번 영광을 다음 경기력으로 연결할 수 있을지가 또 다른 관심사로 떠오른다.`,
      `개인 타이틀은 끝이 아니라 기준점이 되곤 한다. 지금부터는 ${playerName}가 이 평가를 어떻게 지속 가능한 경기력으로 증명하느냐가 중요해졌다.`,
      `${label} 수상은 시즌의 보상이자 동시에 더 큰 기대의 시작이기도 하다. ${playerName}를 향한 시선은 이제 자연스럽게 다음 무대로 향하게 됐다.`,
    ]),
  );
  await insertNews(seasonId, date, 'award_news', title, content, 3, teamId, playerId);
}

/** 패치 노트 뉴스 */
export async function generatePatchNotesNews(
  seasonId: number,
  date: string,
  patchNumber: number,
  changeCount: number,
  patchNote: string,
): Promise<void> {
  const title = pickRandom([
    `패치 ${patchNumber} 적용... 총 ${changeCount}건 조정`,
    `[패치 ${patchNumber}] 메타 흔드는 밸런스 변경`,
    `패치 ${patchNumber} 공개, 프로씬 영향 주목`,
    `패치 ${patchNumber} 라이브 적용... 다음 경기 변수 부상`,
  ]);
  const content = buildArticle(
    `패치 ${patchNumber}가 라이브 서버에 적용됐다. 이번 업데이트에는 총 ${changeCount}건의 조정이 포함됐으며, 단순 수치 변경을 넘어 팀들의 준비 방향과 밴픽 우선순위에 적지 않은 영향을 줄 수 있다는 전망이 나온다.`,
    buildNarrativeAftermath([
      `패치 노트의 핵심은 메타 중심축을 얼마나 이동시키느냐다. 일부 조정은 바로 체감되는 수준일 수 있지만, 실제 프로씬에서는 스크림 데이터와 팀별 해석이 쌓인 뒤에야 진짜 영향력이 드러나는 경우가 많다.`,
      `이번 패치는 특정 챔피언이나 전술의 우선순위를 재정렬할 가능성이 있다. 따라서 각 팀은 단순 적응을 넘어 자신들의 강점을 어떤 방식으로 다시 연결할지 빠르게 판단해야 한다.`,
      `패치 자체보다 더 중요한 것은 해석 속도다. 변화 폭이 큰 시즌일수록 같은 패치를 받아도 어떤 팀은 기회로, 어떤 팀은 부담으로 받아들이는 차이가 분명하게 벌어진다.`,
    ]),
    buildNarrativeAftermath([
      buildQuoteParagraph('해설진', `이번 패치는 숫자만 보면 과하지 않아 보여도 팀별 준비 차이를 더 크게 만들 수 있다`),
      buildQuoteParagraph('분석가', `스크림에서 어떤 챔피언이 먼저 살아나는지가 초기 메타를 좌우할 가능성이 크다`),
      buildQuoteParagraph('코치진 반응', `변화 폭보다도 해석 순서가 중요해졌고 적응 속도가 더 큰 경쟁력이 될 수 있다`),
    ]),
    buildNewsParagraphs(
      patchNote,
      buildNarrativeAftermath([
        `결국 이번 패치의 첫 인상은 다음 경기들에서 확인될 전망이다. 빠르게 방향을 잡는 팀은 초반 메타 주도권을 쥘 수 있지만, 준비가 늦는 팀은 짧은 기간에도 큰 체감 차이를 겪을 수 있다.`,
        `패치가 적용된 직후에는 혼선이 불가피하다. 그러나 이런 시기일수록 준비된 팀은 예상보다 빠르게 우위를 만든다는 점에서, 당분간 경기력 변화의 폭도 평소보다 크게 나타날 가능성이 있다.`,
        `메타 변화는 늘 새로운 기회를 만들지만 동시에 기존 강점의 가치를 흔들기도 한다. 이번 패치 역시 같은 질문을 리그 전체에 던지고 있다.`,
      ]),
    ),
  );
  await insertNews(seasonId, date, 'patch_notes', title, content, 2);
}

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

export async function getUnreadCount(seasonId: number): Promise<number> {
  const db = await getDatabase();
  const rows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM news_articles WHERE season_id = $1 AND is_read = 0`,
    [seasonId],
  );
  return rows[0]?.cnt ?? 0;
}

export async function markAsRead(newsId: number): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `UPDATE news_articles SET is_read = 1 WHERE id = $1`,
    [newsId],
  );
}

export async function markAllAsRead(seasonId: number): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `UPDATE news_articles SET is_read = 1 WHERE season_id = $1 AND is_read = 0`,
    [seasonId],
  );
}
