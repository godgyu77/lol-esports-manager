/**
 * 선수 개인 이벤트 시스템
 * - 군 입대, 스캔들, 개인사, 업적, 미디어 등 랜덤 이벤트 생성
 * - dayAdvancer에서 매일 호출
 * - 뉴스 연동, 선수 상태 변경
 */

import { getDatabase } from '../../db/database';
import { generateNewsArticle } from '../../ai/advancedAiService';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export type PlayerEventCategory =
  | 'military'
  | 'scandal'
  | 'personal'
  | 'achievement'
  | 'controversy'
  | 'growth'
  | 'media'
  | 'education';

export interface PlayerEvent {
  id: string;
  playerId: string;
  playerName: string;
  category: PlayerEventCategory;
  title: string;
  description: string;
  date: string;
  effects: {
    moraleChange?: number;
    popularityChange?: number;
    statChanges?: Record<string, number>;
    daysAbsent?: number;
    teamMoraleChange?: number;
  };
  choices?: {
    label: string;
    effect: string;
  }[];
  severity: 'minor' | 'moderate' | 'major' | 'critical';
}

// ─────────────────────────────────────────
// 이벤트 정의 (30개+)
// ─────────────────────────────────────────

interface EventTemplate {
  id: string;
  category: PlayerEventCategory;
  title: string;
  description: (name: string) => string;
  effects: PlayerEvent['effects'];
  choices?: PlayerEvent['choices'];
  severity: PlayerEvent['severity'];
  /** 발생 조건 함수. true면 발생 가능 */
  condition?: (player: PlayerRow) => boolean;
  /** 일일 발생 확률 (0-1) */
  baseProbability: number;
  /** 확률 수정자 (인기도, 야망 등에 따라) */
  probabilityModifier?: (player: PlayerRow) => number;
}

interface PlayerRow {
  id: string;
  name: string;
  age: number;
  nationality: string;
  position: string;
  popularity: number;
  morale: number;
  team_id: string;
  // personality
  ambition: number;
  loyalty: number;
  temperament: number;
  professionalism: number;
}

const EVENT_TEMPLATES: EventTemplate[] = [
  // ── 군 입대 (한국 특수) ──
  {
    id: 'military_notice',
    category: 'military',
    title: '병역 통지서 수령',
    description: (name) => `${name} 선수가 병역 통지서를 수령했습니다. 1~2시즌 내 입대가 필요합니다.`,
    effects: { moraleChange: -10, teamMoraleChange: -3 },
    severity: 'major',
    condition: (p) => p.nationality === 'KR' && p.age >= 27 && p.age <= 28,
    baseProbability: 0.005,
  },
  {
    id: 'military_enlist',
    category: 'military',
    title: '군 입대',
    description: (name) => `${name} 선수가 군에 입대합니다. 약 540일간 경기에 출전할 수 없습니다.`,
    effects: { moraleChange: -20, daysAbsent: 540, teamMoraleChange: -10, popularityChange: -5 },
    severity: 'critical',
    condition: (p) => p.nationality === 'KR' && p.age >= 28,
    baseProbability: 0.003,
  },
  {
    id: 'military_return',
    category: 'military',
    title: '전역 복귀',
    description: (name) => `${name} 선수가 전역하여 팀에 복귀합니다. 컨디션 회복이 필요합니다.`,
    effects: { moraleChange: 10, popularityChange: 5, statChanges: { consistency: -5 } },
    severity: 'major',
    condition: () => false, // 자동으로만 발생 (입대 540일 후)
    baseProbability: 0,
  },

  // ── 스캔들/논란 ──
  {
    id: 'gambling_scandal',
    category: 'scandal',
    title: '도박 논란',
    description: (name) => `${name} 선수의 도박 관련 논란이 터졌습니다. 심각한 이미지 타격이 예상됩니다.`,
    effects: { moraleChange: -15, popularityChange: -30, daysAbsent: 30, teamMoraleChange: -5 },
    choices: [
      { label: '엄중 경고 + 벌금', effect: '선수 사기 -5, 인기 추가 하락 방지' },
      { label: '출전 정지 연장 (60일)', effect: '팬 반응 호전, 팀 이미지 보호' },
      { label: '묵인', effect: '팀 사기 추가 하락' },
    ],
    severity: 'critical',
    baseProbability: 0.0005,
    probabilityModifier: (p) => p.popularity > 70 ? 1.5 : 1,
  },
  {
    id: 'drunk_incident',
    category: 'scandal',
    title: '음주 사건',
    description: (name) => `${name} 선수가 음주 관련 사건에 연루되었습니다.`,
    effects: { moraleChange: -15, popularityChange: -20, teamMoraleChange: -5 },
    choices: [
      { label: '공개 사과 요구', effect: '인기도 일부 회복' },
      { label: '내부 처리', effect: '팀 내부 갈등 가능성' },
    ],
    severity: 'major',
    baseProbability: 0.001,
    probabilityModifier: (p) => p.temperament < 40 ? 2 : 1,
  },
  {
    id: 'sns_controversy',
    category: 'controversy',
    title: 'SNS 논란',
    description: (name) => `${name} 선수의 SNS 게시글이 논란이 되고 있습니다.`,
    effects: { moraleChange: -5, popularityChange: -15 },
    choices: [
      { label: '게시글 삭제 + 사과문 게재', effect: '논란 빠르게 진화' },
      { label: '무대응', effect: '논란 장기화 가능성' },
    ],
    severity: 'moderate',
    baseProbability: 0.002,
    probabilityModifier: (p) => p.popularity > 60 ? 1.5 : 1,
  },
  {
    id: 'match_fixing_suspicion',
    category: 'scandal',
    title: '승부조작 의혹',
    description: (name) => `${name} 선수에 대한 승부조작 의혹이 제기되었습니다. 조사가 진행됩니다.`,
    effects: { moraleChange: -20, daysAbsent: 60, teamMoraleChange: -20, popularityChange: -40 },
    severity: 'critical',
    baseProbability: 0.0002,
  },
  {
    id: 'toxic_behavior',
    category: 'controversy',
    title: '팀 내 폭언',
    description: (name) => `${name} 선수가 팀 내에서 폭언을 한 것으로 알려졌습니다.`,
    effects: { teamMoraleChange: -10, moraleChange: -5 },
    choices: [
      { label: '개별 면담 진행', effect: '갈등 해소 가능' },
      { label: '벌금 부과', effect: '규율 확립, 선수 불만 가능' },
    ],
    severity: 'moderate',
    baseProbability: 0.002,
    probabilityModifier: (p) => p.temperament < 30 ? 3 : p.temperament < 50 ? 1.5 : 0.5,
  },
  {
    id: 'dating_scandal',
    category: 'personal',
    title: '열애 노출',
    description: (name) => `${name} 선수의 열애 사실이 공개되었습니다. 팬들의 반응이 갈리고 있습니다.`,
    effects: { popularityChange: -5, moraleChange: -3 },
    severity: 'minor',
    baseProbability: 0.001,
    probabilityModifier: (p) => p.popularity > 70 ? 2 : 1,
  },

  // ── 개인사 ──
  {
    id: 'family_emergency',
    category: 'personal',
    title: '가족 긴급 상황',
    description: (name) => `${name} 선수에게 가족 관련 긴급 상황이 발생했습니다.`,
    effects: { moraleChange: -15, daysAbsent: 7 },
    severity: 'moderate',
    baseProbability: 0.001,
  },
  {
    id: 'health_issue',
    category: 'personal',
    title: '건강 문제 발견',
    description: (name) => `${name} 선수가 정기 건강검진에서 이상 소견이 발견되어 추가 검사가 필요합니다.`,
    effects: { moraleChange: -10, daysAbsent: 3 },
    severity: 'moderate',
    baseProbability: 0.001,
  },
  {
    id: 'breakup',
    category: 'personal',
    title: '이별',
    description: (name) => `${name} 선수가 개인적인 이별을 겪고 있습니다. 컨디션 영향이 우려됩니다.`,
    effects: { moraleChange: -10, statChanges: { consistency: -2 } },
    severity: 'minor',
    baseProbability: 0.001,
  },
  {
    id: 'relationship_boost',
    category: 'personal',
    title: '연애 시작',
    description: (name) => `${name} 선수가 좋은 사람을 만났다고 합니다. 기분이 좋아 보입니다.`,
    effects: { moraleChange: 10 },
    severity: 'minor',
    baseProbability: 0.001,
  },

  // ── 업적/성장 ──
  {
    id: 'solorank_rank1',
    category: 'achievement',
    title: '솔로랭크 1위 달성',
    description: (name) => `${name} 선수가 솔로랭크 1위를 달성했습니다! 커뮤니티에서 화제입니다.`,
    effects: { moraleChange: 10, popularityChange: 15, statChanges: { mechanical: 1 } },
    severity: 'moderate',
    condition: (p) => p.ambition >= 70,
    baseProbability: 0.0005,
  },
  {
    id: 'streaming_viral',
    category: 'media',
    title: '스트리밍 대박',
    description: (name) => `${name} 선수의 스트리밍 방송이 실시간 검색어에 올랐습니다!`,
    effects: { popularityChange: 20, moraleChange: 5 },
    severity: 'minor',
    baseProbability: 0.001,
    probabilityModifier: (p) => p.popularity > 60 ? 2 : 1,
  },
  {
    id: 'slump_overcome',
    category: 'growth',
    title: '슬럼프 극복',
    description: (name) => `${name} 선수가 긴 슬럼프를 극복하고 다시 폼을 끌어올렸습니다.`,
    effects: { moraleChange: 15, statChanges: { consistency: 1 } },
    severity: 'moderate',
    condition: (p) => p.morale < 40,
    baseProbability: 0.003,
  },
  {
    id: 'new_champion_master',
    category: 'growth',
    title: '신챔 마스터',
    description: (name) => `${name} 선수가 새로운 챔피언을 완벽하게 습득했습니다.`,
    effects: { moraleChange: 5, statChanges: { gameSense: 1 } },
    severity: 'minor',
    baseProbability: 0.002,
  },
  {
    id: 'confidence_boost',
    category: 'growth',
    title: '자신감 상승',
    description: (name) => `${name} 선수가 최근 좋은 퍼포먼스를 보이며 자신감이 크게 올랐습니다.`,
    effects: { moraleChange: 10, statChanges: { aggression: 1 } },
    severity: 'minor',
    condition: (p) => p.morale >= 70,
    baseProbability: 0.002,
  },
  {
    id: 'mentorship_growth',
    category: 'growth',
    title: '선배 선수의 가르침',
    description: (name) => `${name} 선수가 팀 내 선배 선수에게 많은 것을 배우고 있습니다.`,
    effects: { moraleChange: 5, statChanges: { gameSense: 1, teamwork: 1 } },
    severity: 'minor',
    condition: (p) => p.age <= 20,
    baseProbability: 0.002,
  },

  // ── 미디어 ──
  {
    id: 'variety_show',
    category: 'media',
    title: '예능 출연 제의',
    description: (name) => `${name} 선수에게 예능 프로그램 출연 제의가 들어왔습니다.`,
    effects: { popularityChange: 10, moraleChange: 3 },
    choices: [
      { label: '출연 수락', effect: '인기도 +10, 체력 -5' },
      { label: '출연 거절', effect: '훈련 집중' },
    ],
    severity: 'minor',
    baseProbability: 0.001,
    probabilityModifier: (p) => p.popularity > 60 ? 2 : 0.5,
  },
  {
    id: 'interview_viral',
    category: 'media',
    title: '인터뷰 화제',
    description: (name) => `${name} 선수의 인터뷰 영상이 화제가 되고 있습니다.`,
    effects: { popularityChange: 15, moraleChange: 5 },
    severity: 'minor',
    baseProbability: 0.001,
  },
  {
    id: 'fan_meeting',
    category: 'media',
    title: '팬미팅 성황',
    description: (name) => `${name} 선수의 팬미팅이 성황리에 마무리되었습니다.`,
    effects: { popularityChange: 10, moraleChange: 8 },
    severity: 'minor',
    baseProbability: 0.001,
    probabilityModifier: (p) => p.popularity > 70 ? 2 : 0.5,
  },

  // ── 교육 ──
  {
    id: 'university_admission',
    category: 'education',
    title: '대학 진학',
    description: (name) => `${name} 선수가 사이버 대학에 입학했습니다. 학업과 게임을 병행합니다.`,
    effects: { moraleChange: 5, statChanges: { gameSense: 1 } },
    severity: 'minor',
    condition: (p) => p.age >= 20 && p.age <= 24,
    baseProbability: 0.0005,
  },
  {
    id: 'coaching_certification',
    category: 'education',
    title: '코칭 자격증 취득',
    description: (name) => `${name} 선수가 e스포츠 코칭 자격증을 취득했습니다. 은퇴 후를 준비하는 모습입니다.`,
    effects: { moraleChange: 3, statChanges: { gameSense: 1 } },
    severity: 'minor',
    condition: (p) => p.age >= 25,
    baseProbability: 0.0003,
  },

  // ── 추가 스캔들/개인사 ──
  {
    id: 'car_accident',
    category: 'personal',
    title: '교통사고',
    description: (name) => `${name} 선수가 경미한 교통사고를 당했습니다. 다행히 큰 부상은 없지만 안정이 필요합니다.`,
    effects: { moraleChange: -10, daysAbsent: 5 },
    severity: 'moderate',
    baseProbability: 0.0005,
  },
  {
    id: 'charity_event',
    category: 'achievement',
    title: '자선 활동 참여',
    description: (name) => `${name} 선수가 자선 행사에 참여하여 좋은 이미지를 쌓았습니다.`,
    effects: { popularityChange: 10, moraleChange: 5, teamMoraleChange: 2 },
    severity: 'minor',
    baseProbability: 0.001,
    probabilityModifier: (p) => p.professionalism > 70 ? 2 : 1,
  },
  {
    id: 'burnout_warning',
    category: 'personal',
    title: '번아웃 경고',
    description: (name) => `${name} 선수가 번아웃 증상을 보이고 있습니다. 충분한 휴식이 필요합니다.`,
    effects: { moraleChange: -15, statChanges: { consistency: -2 } },
    choices: [
      { label: '1주일 휴식 부여', effect: '컨디션 회복, 출전 불가 7일' },
      { label: '계속 경기 출전', effect: '폼 추가 하락 위험' },
    ],
    severity: 'moderate',
    condition: (p) => p.morale < 30,
    baseProbability: 0.005,
  },
  {
    id: 'award_nomination',
    category: 'achievement',
    title: 'LCK 어워드 후보 지명',
    description: (name) => `${name} 선수가 LCK 어워드 후보에 지명되었습니다!`,
    effects: { popularityChange: 10, moraleChange: 10 },
    severity: 'minor',
    condition: (p) => p.popularity >= 60,
    baseProbability: 0.0005,
  },
  {
    id: 'homesick',
    category: 'personal',
    title: '향수병',
    description: (name) => `${name} 선수가 고향을 그리워하며 힘들어하고 있습니다.`,
    effects: { moraleChange: -8 },
    severity: 'minor',
    condition: (p) => p.nationality !== 'KR',
    baseProbability: 0.003,
  },
];

// ─────────────────────────────────────────
// 이벤트 뉴스 카테고리 매핑
// ─────────────────────────────────────────

const NEWS_CATEGORY_MAP: Record<PlayerEventCategory, 'scandal' | 'team' | 'analysis' | null> = {
  military: 'team',
  scandal: 'scandal',
  controversy: 'scandal',
  personal: null,
  achievement: 'analysis',
  growth: null,
  media: 'analysis',
  education: null,
};

// ─────────────────────────────────────────
// 핵심 함수
// ─────────────────────────────────────────

/**
 * 매일 선수별 이벤트 확률 체크, 발생한 이벤트 반환
 */
export async function generateDailyPlayerEvents(
  teamId: string,
  currentDate: string,
): Promise<PlayerEvent[]> {
  try {
    const db = await getDatabase();

    // 팀 선수 + 성격 조회
    const players = await db.select<PlayerRow[]>(
      `SELECT p.id, p.name, p.age, p.nationality, p.position, p.popularity, p.morale, p.team_id,
              COALESCE(pp.ambition, 50) as ambition,
              COALESCE(pp.loyalty, 50) as loyalty,
              COALESCE(pp.temperament, 50) as temperament,
              COALESCE(pp.professionalism, 50) as professionalism
       FROM players p
       LEFT JOIN player_personality pp ON pp.player_id = p.id
       WHERE p.team_id = $1`,
      [teamId],
    );

    const events: PlayerEvent[] = [];

    for (const player of players) {
      // 하루에 한 선수당 최대 1개 이벤트
      let eventTriggered = false;

      for (const template of EVENT_TEMPLATES) {
        if (eventTriggered) break;

        // 조건 체크
        if (template.condition && !template.condition(player)) continue;
        if (template.baseProbability <= 0) continue;

        // 확률 계산
        let prob = template.baseProbability;
        if (template.probabilityModifier) {
          prob *= template.probabilityModifier(player);
        }

        if (Math.random() < prob) {
          const event: PlayerEvent = {
            id: `${template.id}_${player.id}_${currentDate}`,
            playerId: player.id,
            playerName: player.name,
            category: template.category,
            title: template.title,
            description: template.description(player.name),
            date: currentDate,
            effects: { ...template.effects },
            choices: template.choices ? [...template.choices] : undefined,
            severity: template.severity,
          };

          events.push(event);
          eventTriggered = true;
        }
      }
    }

    return events;
  } catch (e) {
    console.warn('[playerEventEngine] generateDailyPlayerEvents failed:', e);
    return [];
  }
}

/**
 * 이벤트 효과 적용 (DB 업데이트)
 */
export async function processPlayerEvent(
  event: PlayerEvent,
  seasonId: number,
  currentDate: string,
  teamId: string,
  choiceIndex?: number,
): Promise<void> {
  try {
    const db = await getDatabase();

    // 1. 사기 변경
    if (event.effects.moraleChange) {
      await db.execute(
        `UPDATE players SET morale = MAX(0, MIN(100, morale + $1)) WHERE id = $2`,
        [event.effects.moraleChange, event.playerId],
      );
    }

    // 2. 인기도 변경
    if (event.effects.popularityChange) {
      await db.execute(
        `UPDATE players SET popularity = MAX(0, MIN(100, popularity + $1)) WHERE id = $2`,
        [event.effects.popularityChange, event.playerId],
      );
    }

    // 3. 스탯 변경
    if (event.effects.statChanges) {
      for (const [stat, change] of Object.entries(event.effects.statChanges)) {
        const column = stat === 'gameSense' ? 'game_sense' : stat;
        try {
          await db.execute(
            `UPDATE players SET ${column} = MAX(1, MIN(99, ${column} + $1)) WHERE id = $2`,
            [change, event.playerId],
          );
        } catch { /* 존재하지 않는 컬럼 무시 */ }
      }
    }

    // 4. 결장 처리 (부상과 유사하게)
    if (event.effects.daysAbsent && event.effects.daysAbsent > 0) {
      try {
        const returnDate = new Date(currentDate);
        returnDate.setDate(returnDate.getDate() + event.effects.daysAbsent);
        const expectedReturn = returnDate.toISOString().slice(0, 10);
        await db.execute(
          `INSERT INTO player_injuries (player_id, team_id, injury_type, severity, days_remaining, is_recovered, occurred_date, expected_return)
           VALUES ($1, $2, $3, $4, $5, 0, $6, $7)`,
          [event.playerId, teamId, event.title, event.severity, event.effects.daysAbsent, currentDate, expectedReturn],
        );
      } catch (e) { console.warn('[playerEventEngine] 결장 처리 실패:', e); }
    }

    // 5. 팀 사기 변경
    if (event.effects.teamMoraleChange) {
      await db.execute(
        `UPDATE players SET morale = MAX(0, MIN(100, morale + $1)) WHERE team_id = $2 AND id != $3`,
        [event.effects.teamMoraleChange, teamId, event.playerId],
      );
    }

    // 6. 선택지 효과 (choiceIndex가 있으면)
    if (choiceIndex != null && event.choices && event.choices[choiceIndex]) {
      const choice = event.choices[choiceIndex];
      await applyChoiceEffect(db, event, choice, teamId, currentDate);
    }

    // 7. 뉴스 연동 (주요 이벤트)
    const newsCategory = NEWS_CATEGORY_MAP[event.category];
    if (newsCategory && (event.severity === 'major' || event.severity === 'critical')) {
      try {
        const teamRows = await db.select<{ name: string }[]>(
          'SELECT name FROM teams WHERE id = $1', [teamId],
        );
        const teamName = teamRows[0]?.name ?? teamId;

        const eventTypeMap: Record<string, 'scandal' | 'injury' | 'milestone' | 'transfer'> = {
          scandal: 'scandal',
          controversy: 'scandal',
          military: 'injury', // 결장과 비슷한 카테고리
          achievement: 'milestone',
        };
        const eventType = eventTypeMap[event.category] ?? 'milestone';

        const newsArticle = await generateNewsArticle({
          eventType,
          details: event.description,
          teamNames: [teamName],
          playerNames: [event.playerName],
        });

        await db.execute(
          `INSERT INTO news_articles (season_id, article_date, category, title, content, importance, related_team_id, related_player_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [seasonId, currentDate, newsCategory, newsArticle.title, newsArticle.content,
           event.severity === 'critical' ? 3 : 2, teamId, event.playerId],
        );
      } catch (e) {
        console.warn('[playerEventEngine] news generation failed:', e);
      }
    }

    // 8. 이벤트 히스토리 저장 (daily_events 테이블 활용)
    try {
      await db.execute(
        `INSERT INTO daily_events (season_id, event_date, event_type, team_id, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [seasonId, currentDate, `player_event_${event.category}`, teamId, `[${event.title}] ${event.description}`],
      );
    } catch { /* 무시 */ }

  } catch (e) {
    console.warn('[playerEventEngine] processPlayerEvent failed:', e);
  }
}

/**
 * 선수 이벤트 히스토리 조회
 */
export async function getPlayerEventHistory(
  playerId: string,
): Promise<PlayerEvent[]> {
  try {
    const db = await getDatabase();

    const rows = await db.select<{
      event_date: string;
      event_type: string;
      description: string;
    }[]>(
      `SELECT event_date, event_type, description
       FROM daily_events
       WHERE event_type LIKE 'player_event_%'
         AND description LIKE $1
       ORDER BY event_date DESC
       LIMIT 20`,
      [`%${playerId}%`],
    );

    // 간이 복원 (히스토리 조회용)
    return rows.map((r, i) => ({
      id: `history_${i}`,
      playerId,
      playerName: '',
      category: r.event_type.replace('player_event_', '') as PlayerEventCategory,
      title: r.description.match(/\[(.+?)\]/)?.[1] ?? r.event_type,
      description: r.description,
      date: r.event_date,
      effects: {},
      severity: 'minor' as const,
    }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────
// 선택지 효과 적용
// ─────────────────────────────────────────

/**
 * 이벤트 선택지의 효과를 실제로 적용한다.
 * effect 텍스트를 파싱하여 스탯/사기/출전정지 등을 처리.
 */
async function applyChoiceEffect(
  db: Awaited<ReturnType<typeof getDatabase>>,
  event: PlayerEvent,
  choice: { label: string; effect: string },
  teamId: string,
  currentDate: string,
): Promise<void> {
  const effect = choice.effect;
  const label = choice.label;

  // 사기 변동 파싱: "선수 사기 -5", "사기 +10"
  const moraleMatch = effect.match(/사기\s*([+-]?\d+)/);
  if (moraleMatch) {
    const delta = parseInt(moraleMatch[1]);
    await db.execute(
      'UPDATE players SET morale = MAX(0, MIN(100, morale + $1)) WHERE id = $2',
      [delta, event.playerId],
    );
  }

  // 인기도 변동: "인기도 +10", "인기 추가 하락 방지"
  const popMatch = effect.match(/인기도?\s*([+-]\d+)/);
  if (popMatch) {
    const delta = parseInt(popMatch[1]);
    await db.execute(
      'UPDATE players SET popularity = MAX(0, MIN(100, popularity + $1)) WHERE id = $2',
      [delta, event.playerId],
    );
  }

  // 출전 정지/결장 연장: "출전 정지 연장 (60일)", "출전 불가 7일"
  const absenceMatch = effect.match(/출전\s*(?:정지|불가)\s*(?:연장\s*)?\(?(\d+)일?\)?/);
  if (absenceMatch) {
    const days = parseInt(absenceMatch[1]);
    try {
      const returnDate = new Date(currentDate);
      returnDate.setDate(returnDate.getDate() + days);
      const expectedReturn = returnDate.toISOString().slice(0, 10);
      await db.execute(
        `INSERT INTO player_injuries (player_id, team_id, injury_type, severity, days_remaining, is_recovered, occurred_date, expected_return)
         VALUES ($1, $2, $3, $4, $5, 0, $6, $7)`,
        [event.playerId, teamId, `${event.title} — ${label}`, event.severity, days, currentDate, expectedReturn],
      );
    } catch (e) { console.warn('[playerEventEngine] 출전 정지 처리 실패:', e); }
  }

  // 체력 변동: "체력 -5"
  const staminaMatch = effect.match(/체력\s*([+-]\d+)/);
  if (staminaMatch) {
    const delta = parseInt(staminaMatch[1]);
    try {
      await db.execute(
        'UPDATE player_daily_condition SET stamina = MAX(0, MIN(100, stamina + $1)) WHERE player_id = $2',
        [delta, event.playerId],
      );
    } catch { /* player_daily_condition 미존재 시 무시 */ }
  }

  // 팀 사기 변동: "팀 사기 추가 하락", "팀 이미지 보호"
  if (effect.includes('팀 사기 추가 하락') || effect.includes('팀 내부 갈등')) {
    await db.execute(
      'UPDATE players SET morale = MAX(0, morale - 3) WHERE team_id = $1 AND id != $2',
      [teamId, event.playerId],
    );
  }
  if (effect.includes('팀 이미지 보호') || effect.includes('팬 반응 호전')) {
    await db.execute(
      'UPDATE players SET popularity = MIN(100, popularity + 2) WHERE team_id = $1',
      [teamId],
    );
  }

  // 갈등 해소: "갈등 해소 가능"
  if (effect.includes('갈등 해소')) {
    await db.execute(
      'UPDATE players SET morale = MIN(100, morale + 5) WHERE team_id = $1',
      [teamId],
    );
  }

  // 규율 확립: "규율 확립"
  if (effect.includes('규율 확립')) {
    // 팀 전체 consistency 약간 상승
    await db.execute(
      'UPDATE players SET consistency = MIN(99, consistency + 1) WHERE team_id = $1',
      [teamId],
    ).catch(() => {});
  }

  // 컨디션 회복: "컨디션 회복"
  if (effect.includes('컨디션 회복')) {
    await db.execute(
      'UPDATE players SET morale = MIN(100, morale + 10) WHERE id = $1',
      [event.playerId],
    );
  }
}
