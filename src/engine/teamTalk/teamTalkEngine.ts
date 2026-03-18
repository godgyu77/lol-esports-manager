/**
 * 팀 토크 엔진
 * - 경기 전/하프타임/경기 후 팀 대화
 * - 톤별 사기/폼 변화
 */

import { getDatabase } from '../../db/database';
import type { TalkType, TalkTone } from '../../types/teamTalk';
import { TALK_TONE_EFFECTS } from '../../types/teamTalk';

// ─────────────────────────────────────────
// 팀 토크 대사 템플릿
// ─────────────────────────────────────────

export const TALK_MESSAGES: Record<TalkTone, string[]> = {
  motivate: [
    '오늘 우리가 보여줄 수 있는 최고의 경기를 하자!',
    '지금까지 준비한 모든 걸 보여줄 때다!',
    '상대는 강하지만, 우리도 만만치 않다!',
    '이 경기는 시즌의 분기점이 될 수 있다. 전력을 다하자!',
    '팬들이 우리를 응원하고 있다. 실망시키지 말자!',
    '우리가 연습한 시간을 믿어라. 충분히 준비됐다!',
    '이 무대에 서 있다는 것 자체가 대단한 거다. 자신감을 가져!',
    '오늘은 우리가 주인공이다. 최선을 다하자!',
    '지금 이 순간이 우리의 시간이다. 모두 각성하자!',
    '승리는 준비된 팀에게 온다. 우리가 바로 그 팀이다!',
  ],
  calm: [
    '침착하게, 우리 플레이에만 집중하자.',
    '너무 긴장하지 마. 연습한 대로 하면 된다.',
    '상대의 페이스에 휘둘리지 말고, 우리 운영을 하자.',
    '한 플레이, 한 플레이에 집중하자. 큰 그림은 내가 본다.',
    '심호흡하고, 지금 이 순간에 집중하자.',
    '실수는 괜찮다. 중요한 건 흔들리지 않는 거다.',
    '천천히 하자. 조급하면 실수가 나온다.',
    '상대가 도발해도 반응하지 마. 우리 게임을 하자.',
    '지금까지 해온 대로만 하면 충분하다.',
    '결과에 연연하지 말고, 한 타이밍 한 타이밍에 집중하자.',
  ],
  warn: [
    '이 경기 지면 플레이오프가 위험해진다.',
    '최근 경기력을 보면 솔직히 걱정이 된다. 정신 차려라.',
    '오늘 지면 팬들의 실망이 클 거다. 각오하고 뛰어라.',
    '지금 우리 상황이 어떤지 다 알고 있지? 반드시 이겨야 한다.',
    '이번 경기에서 변화된 모습을 보여주지 못하면 변화가 있을 거다.',
    '각자 자기 역할에 책임감을 가져라. 이건 팀의 생존이 걸린 문제다.',
    '이대로 가면 시즌 끝이다. 오늘 반드시 이겨야 한다.',
    '솔직히 최근 경기는 프로 수준이 아니었다. 오늘은 달라져야 한다.',
    '팬들이 지금 얼마나 실망하고 있는지 생각해봐라.',
    '이번이 마지막 기회라고 생각하고 뛰어라.',
  ],
  praise: [
    '최근 경기력이 정말 훌륭했다. 오늘도 기대한다!',
    '너희들 때문에 감독이 행복하다. 자신감을 가지고 뛰어라!',
    '이 로스터로 이런 성적을 내는 건 대단한 거다.',
    '팀워크가 최고 수준이다. 오늘도 그대로 보여주자!',
    '솔직히 이번 시즌 최고의 팀 중 하나가 우리다.',
    '너희들의 노력이 결과로 나타나고 있다. 자랑스럽다!',
    '이 팀의 성장 속도가 놀랍다. 계속 이대로 가자!',
    '상대가 우리를 두려워하고 있다. 그 이유를 보여주자!',
    '한 사람 한 사람이 제 역할을 완벽하게 해주고 있다. 고맙다!',
    '최근 폼이라면 어떤 상대가 와도 이길 수 있다!',
  ],
  criticize: [
    '솔직히 최근 경기에서 많이 실망했다.',
    '기본기가 부족하다. 훈련부터 다시 해야 할 판이다.',
    '팀의 기대에 미치지 못하고 있다는 걸 자각해라.',
    '이 수준의 경기력이면 프로 자격이 있는지 의문이다.',
    '변하지 않으면 로스터 변경을 검토할 수밖에 없다.',
    '같은 실수를 반복하고 있다. 학습 능력이 있는 거냐?',
    '상대에게 너무 쉽게 무너지고 있다. 자존심이 없나?',
    '연습과 실전이 너무 다르다. 멘탈 관리가 안 되고 있다.',
    '팬들에게 미안한 마음이 없나? 이 경기력으로는 부족하다.',
    '지금 분위기로는 아무것도 달라지지 않는다. 각성해라.',
  ],
  neutral: [
    '평소대로 하면 된다.',
    '특별한 건 없다. 준비한 대로 하자.',
    '오늘도 한 경기 한 경기 최선을 다하자.',
    '결과에 연연하지 말고, 과정에 집중하자.',
    '우리가 할 일을 하면 결과는 따라온다.',
    '상대 분석은 다 됐다. 계획대로 움직이자.',
    '부담 갖지 말고 편하게 하자.',
    '오늘도 어제처럼 하면 된다.',
    '크게 바꿀 건 없다. 기본에 충실하자.',
    '하나씩 해나가면 된다. 조급할 필요 없다.',
  ],
};

export function pickTalkMessage(tone: TalkTone): string {
  const messages = TALK_MESSAGES[tone];
  return messages[Math.floor(Math.random() * messages.length)];
}

export async function conductTeamTalk(
  matchId: string,
  teamId: string,
  talkType: TalkType,
  talkTone: TalkTone,
  targetPlayerId: string | null,
  managerDiscipline = 10,
): Promise<{ moraleChange: number; formChange: number; message: string }> {
  const db = await getDatabase();
  const base = TALK_TONE_EFFECTS[talkTone];

  let morale = base.morale;
  let form = base.form;

  // 규율 높은 감독은 criticize/warn 패널티 완화
  if (managerDiscipline >= 15) {
    if (talkTone === 'criticize') morale = Math.max(morale + 3, -2);
    if (talkTone === 'warn') morale = Math.max(morale + 1, 0);
  }

  // 개별 선수 대상 시 2배 효과
  if (targetPlayerId) {
    morale = Math.round(morale * 2);
    form = Math.round(form * 2);
  }

  // 랜덤 대사 선택
  const message = pickTalkMessage(talkTone);

  await db.execute(
    `INSERT INTO team_talks (match_id, team_id, talk_type, talk_tone, target_player_id, morale_change, form_change, created_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [matchId, teamId, talkType, talkTone, targetPlayerId, morale, form, new Date().toISOString().slice(0, 10)],
  );

  // 실제 선수 컨디션에 적용
  if (targetPlayerId) {
    await db.execute(
      'UPDATE players SET morale = MIN(100, MAX(0, morale + $1)) WHERE id = $2',
      [morale, targetPlayerId],
    );
  } else {
    await db.execute(
      'UPDATE players SET morale = MIN(100, MAX(0, morale + $1)) WHERE team_id = $2',
      [morale, teamId],
    );
  }

  return { moraleChange: morale, formChange: form, message };
}

export function getRecommendedTone(
  talkType: TalkType,
  isWinning: boolean,
  recentFormAvg: number,
): TalkTone {
  if (talkType === 'pre_match') {
    return recentFormAvg >= 70 ? 'calm' : 'motivate';
  }
  if (talkType === 'halftime') {
    return isWinning ? 'praise' : 'motivate';
  }
  // post_match
  return isWinning ? 'praise' : (recentFormAvg < 50 ? 'warn' : 'motivate');
}
