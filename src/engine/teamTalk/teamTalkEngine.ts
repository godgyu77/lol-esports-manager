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
  if (talkType === 'between_games') {
    return isWinning ? 'praise' : 'motivate';
  }
  // post_match
  return isWinning ? 'praise' : (recentFormAvg < 50 ? 'warn' : 'motivate');
}

// ─────────────────────────────────────────
// 팀톡 반복 감쇠 시스템
// ─────────────────────────────────────────

/**
 * 같은 톤을 반복 사용 시 효과가 감소
 * 최근 3회 같은 톤 → 50% 효과, 5회+ → 30% 효과
 *
 * @param recentTones 최근 팀톡 톤 이력 (최신순)
 * @param currentTone 현재 사용하려는 톤
 * @returns 0.3~1.0 사이의 감쇠 배율
 */
export function calculateToneDecay(recentTones: TalkTone[], currentTone: TalkTone): number {
  const recent5 = recentTones.slice(0, 5);
  const sameCount = recent5.filter(t => t === currentTone).length;

  if (sameCount >= 4) return 0.3;
  if (sameCount >= 3) return 0.5;
  if (sameCount >= 2) return 0.7;
  if (sameCount >= 1) return 0.9;
  return 1.0;
}

/**
 * 다양한 톤 사용 시 보너스 계산
 * 최근 5회에서 3종류 이상의 톤 → +20% 효과
 */
export function calculateToneVarietyBonus(recentTones: TalkTone[]): number {
  const recent5 = recentTones.slice(0, 5);
  const uniqueTones = new Set(recent5).size;

  if (uniqueTones >= 4) return 1.3;
  if (uniqueTones >= 3) return 1.2;
  return 1.0;
}

// ─────────────────────────────────────────
// 성격 기반 팀톡 반응 시스템
// ─────────────────────────────────────────

import type { PlayerPersonality } from '../../types/personality';

/** 개별 선수의 팀톡 반응 */
export interface PlayerTalkReaction {
  playerId: string;
  playerName: string;
  /** 반응 유형 */
  reaction: 'inspired' | 'motivated' | 'indifferent' | 'annoyed' | 'angry' | 'devastated';
  /** 사기 변화량 (성격 반영) */
  moraleChange: number;
  /** 폼 변화량 (성격 반영) */
  formChange: number;
  /** 반응 메시지 */
  reactionMessage: string;
}

const REACTION_MESSAGES: Record<PlayerTalkReaction['reaction'], string[]> = {
  inspired: ['눈빛이 달라졌다.', '의지가 불타오르는 표정이다.', '고개를 힘차게 끄덕인다.'],
  motivated: ['결의에 찬 표정이다.', '자리에서 일어나 스트레칭을 한다.', '미소를 짓는다.'],
  indifferent: ['무표정하다.', '특별한 반응이 없다.', '고개를 살짝 끄덕인다.'],
  annoyed: ['인상을 찌푸린다.', '고개를 돌린다.', '한숨을 쉰다.'],
  angry: ['주먹을 쥔다.', '눈을 감고 참는 표정이다.', '자리에서 일어나려 한다.'],
  devastated: ['고개를 숙인다.', '자신감을 잃은 표정이다.', '말없이 바닥을 응시한다.'],
};

/**
 * 개별 선수의 성격에 따른 팀톡 반응 계산
 */
export function calculatePlayerReaction(
  playerId: string,
  playerName: string,
  personality: PlayerPersonality,
  tone: TalkTone,
  baseMorale: number,
  baseForm: number,
): PlayerTalkReaction {
  // 성격별 톤 반응 배율
  const responseMultiplier = getPersonalityToneMultiplier(personality, tone);
  const moraleChange = Math.round(baseMorale * responseMultiplier);
  const formChange = Math.round(baseForm * responseMultiplier);

  // 반응 유형 결정
  const reaction = determineReaction(moraleChange, personality, tone);

  const messages = REACTION_MESSAGES[reaction];
  const reactionMessage = `${playerName}: ${messages[Math.floor(Math.random() * messages.length)]}`;

  return { playerId, playerName, reaction, moraleChange, formChange, reactionMessage };
}

/** 성격 × 톤 반응 배율 계산 */
function getPersonalityToneMultiplier(p: PlayerPersonality, tone: TalkTone): number {
  switch (tone) {
    case 'motivate':
      // 결단력 높은 선수는 동기부여에 잘 반응
      return p.determination >= 7 ? 1.5 : p.determination >= 4 ? 1.0 : 0.7;
    case 'calm':
      // 기질 높은(침착한) 선수는 안정 메시지에 잘 반응
      return p.temperament >= 7 ? 1.3 : 1.0;
    case 'warn':
      // 기질 높으면 경고를 잘 받아들임, 낮으면 역효과
      return p.temperament >= 7 ? 1.2 : p.temperament <= 3 ? 0.5 : 0.8;
    case 'praise':
      // 야망 높은 선수는 칭찬에 크게 반응
      return p.ambition >= 7 ? 1.4 : 1.0;
    case 'criticize':
      // 기질 낮으면 질책에 큰 부정적 반응, 높으면 수용
      if (p.temperament <= 3) return 0.3; // 폭발 → 사기 변화 미미하지만 부정적
      if (p.temperament >= 8 && p.professionalism >= 7) return 1.5; // 프로 → 수용하고 성장
      return p.temperament <= 5 ? 0.7 : 1.2;
    case 'neutral':
      return 1.0;
    default:
      return 1.0;
  }
}

/** 반응 유형 결정 */
function determineReaction(
  moraleChange: number,
  p: PlayerPersonality,
  tone: TalkTone,
): PlayerTalkReaction['reaction'] {
  // 질책 + 기질 낮음 → 분노/낙담
  if (tone === 'criticize' && p.temperament <= 3) {
    return p.determination >= 6 ? 'angry' : 'devastated';
  }

  // 경고 + 기질 낮음 → 짜증
  if (tone === 'warn' && p.temperament <= 4) {
    return 'annoyed';
  }

  if (moraleChange >= 8) return 'inspired';
  if (moraleChange >= 3) return 'motivated';
  if (moraleChange >= 0) return 'indifferent';
  if (moraleChange >= -3) return 'annoyed';
  if (moraleChange >= -5) return 'angry';
  return 'devastated';
}

// ─────────────────────────────────────────
// 라커룸 분위기 시스템
// ─────────────────────────────────────────

/** 라커룸 분위기 */
export type LockerRoomMood = 'excellent' | 'positive' | 'neutral' | 'tense' | 'toxic';

/** 라커룸 상태 */
export interface LockerRoomState {
  mood: LockerRoomMood;
  /** 분위기 점수 (0~100) */
  moodScore: number;
  /** 갈등 수 */
  conflictCount: number;
  /** 리더 선수 ID (있는 경우) */
  leaderId: string | null;
  /** 분위기 한국어 설명 */
  description: string;
}

const MOOD_LABELS: Record<LockerRoomMood, string> = {
  excellent: '최고의 분위기',
  positive: '긍정적',
  neutral: '보통',
  tense: '긴장됨',
  toxic: '악화됨',
};

/**
 * 라커룸 분위기 계산
 * 팀 전체 선수의 성격 + 최근 성적 + 사기 기반
 */
export function calculateLockerRoomState(
  personalities: PlayerPersonality[],
  averageMorale: number,
  recentWins: number,
  recentLosses: number,
): LockerRoomState {
  if (personalities.length === 0) {
    return { mood: 'neutral', moodScore: 50, conflictCount: 0, leaderId: null, description: '선수 데이터 없음' };
  }

  // 1. 기본 점수: 평균 사기 (0~100 → 0~40점)
  let score = (averageMorale / 100) * 40;

  // 2. 성적 보정 (0~20점)
  const totalGames = recentWins + recentLosses;
  if (totalGames > 0) {
    const winRate = recentWins / totalGames;
    score += winRate * 20;
  } else {
    score += 10;
  }

  // 3. 성격 조화 점수 (0~30점)
  let harmonyScore = 15; // 기본
  let conflictCount = 0;

  for (let i = 0; i < personalities.length; i++) {
    for (let j = i + 1; j < personalities.length; j++) {
      const a = personalities[i];
      const b = personalities[j];

      // 기질 충돌 체크
      if (a.temperament <= 3 && b.temperament <= 3) {
        conflictCount++;
        harmonyScore -= 3;
      }
      // 야망 충돌
      if (a.ambition >= 8 && b.ambition >= 8) {
        conflictCount++;
        harmonyScore -= 2;
      }
      // 프로의식 조화
      if (a.professionalism >= 7 && b.professionalism >= 7) {
        harmonyScore += 1;
      }
      // 충성심 시너지
      if (a.loyalty >= 7 && b.loyalty >= 7) {
        harmonyScore += 1;
      }
    }
  }

  score += Math.max(0, Math.min(30, harmonyScore));

  // 4. 평균 프로의식 보정 (-5 ~ +10)
  const avgProfessionalism = personalities.reduce((s, p) => s + p.professionalism, 0) / personalities.length;
  score += (avgProfessionalism - 5) * 2;

  // 클램프
  const moodScore = Math.max(0, Math.min(100, Math.round(score)));

  // 분위기 등급
  let mood: LockerRoomMood;
  if (moodScore >= 80) mood = 'excellent';
  else if (moodScore >= 60) mood = 'positive';
  else if (moodScore >= 40) mood = 'neutral';
  else if (moodScore >= 20) mood = 'tense';
  else mood = 'toxic';

  // 리더 선수 식별: 결단력 + 기질 + 프로의식이 가장 높은 선수
  let leaderId: string | null = null;
  let bestLeaderScore = 0;
  for (const p of personalities) {
    const leaderScore = p.determination * 0.4 + p.temperament * 0.3 + p.professionalism * 0.3;
    if (leaderScore > bestLeaderScore && leaderScore >= 6) {
      bestLeaderScore = leaderScore;
      leaderId = p.playerId;
    }
  }

  // 리더 보너스
  if (leaderId) {
    // 리더가 있으면 분위기 +5
    const adjusted = Math.min(100, moodScore + 5);
    return {
      mood: adjusted >= 80 ? 'excellent' : mood,
      moodScore: adjusted,
      conflictCount,
      leaderId,
      description: `${MOOD_LABELS[mood]} — 갈등 ${conflictCount}건, 리더 존재`,
    };
  }

  return {
    mood,
    moodScore,
    conflictCount,
    leaderId: null,
    description: `${MOOD_LABELS[mood]} — 갈등 ${conflictCount}건`,
  };
}

// ─────────────────────────────────────────
// 성격 기반 이벤트 생성
// ─────────────────────────────────────────

/** 성격 기반 이벤트 유형 */
export type PersonalityEventType =
  | 'conflict'         // 선수 간 갈등
  | 'leadership_emerge' // 리더십 발현
  | 'diva_demand'      // 스타 선수 요구
  | 'morale_boost'     // 분위기 메이커 활동
  | 'mentor_bond'      // 선후배 유대
  | 'ambition_clash';  // 야망 충돌

export interface PersonalityEvent {
  type: PersonalityEventType;
  involvedPlayers: string[];
  description: string;
  moraleEffect: number;  // 팀 전체 사기 변화
  chemistryEffect: number; // 관련 선수 간 케미 변화
}

/**
 * 성격 기반 이벤트 생성 (일일 체크)
 * 일정 확률로 성격 특성에 따른 이벤트 발생
 */
export function checkPersonalityEvents(
  personalities: { personality: PlayerPersonality; name: string; age: number }[],
): PersonalityEvent[] {
  const events: PersonalityEvent[] = [];
  if (personalities.length < 2) return events;

  for (let i = 0; i < personalities.length; i++) {
    for (let j = i + 1; j < personalities.length; j++) {
      const a = personalities[i];
      const b = personalities[j];

      // 기질 충돌 이벤트 (둘 다 기질 낮음, 3% 확률)
      if (a.personality.temperament <= 3 && b.personality.temperament <= 3) {
        if (Math.random() < 0.03) {
          events.push({
            type: 'conflict',
            involvedPlayers: [a.personality.playerId, b.personality.playerId],
            description: `${a.name}와(과) ${b.name} 사이에 훈련 중 언쟁이 발생했습니다.`,
            moraleEffect: -3,
            chemistryEffect: -5,
          });
        }
      }

      // 야망 충돌 (둘 다 야망 8+, 같은 포지션 경쟁 가정, 2% 확률)
      if (a.personality.ambition >= 8 && b.personality.ambition >= 8) {
        if (Math.random() < 0.02) {
          events.push({
            type: 'ambition_clash',
            involvedPlayers: [a.personality.playerId, b.personality.playerId],
            description: `${a.name}와(과) ${b.name}이(가) 주전 경쟁으로 갈등을 빚고 있습니다.`,
            moraleEffect: -2,
            chemistryEffect: -3,
          });
        }
      }

      // 선후배 유대 (나이 차이 5+ + 프로의식 7+, 2% 확률)
      if (Math.abs(a.age - b.age) >= 5 && a.personality.professionalism >= 7 && b.personality.professionalism >= 7) {
        if (Math.random() < 0.02) {
          const senior = a.age > b.age ? a : b;
          const junior = a.age > b.age ? b : a;
          events.push({
            type: 'mentor_bond',
            involvedPlayers: [senior.personality.playerId, junior.personality.playerId],
            description: `${senior.name}이(가) ${junior.name}에게 경험을 전수하며 유대가 깊어졌습니다.`,
            moraleEffect: 2,
            chemistryEffect: 5,
          });
        }
      }
    }

    // 리더십 발현 (결단력 8+ & 기질 7+ & 프로의식 7+, 1% 확률)
    const p = personalities[i];
    if (p.personality.determination >= 8 && p.personality.temperament >= 7 && p.personality.professionalism >= 7) {
      if (Math.random() < 0.01) {
        events.push({
          type: 'leadership_emerge',
          involvedPlayers: [p.personality.playerId],
          description: `${p.name}이(가) 팀 회의에서 리더십을 발휘하며 팀 분위기를 끌어올렸습니다.`,
          moraleEffect: 5,
          chemistryEffect: 0,
        });
      }
    }

    // 분위기 메이커 (기질 8+ & 충성심 7+, 2% 확률)
    if (p.personality.temperament >= 8 && p.personality.loyalty >= 7) {
      if (Math.random() < 0.02) {
        events.push({
          type: 'morale_boost',
          involvedPlayers: [p.personality.playerId],
          description: `${p.name}이(가) 팀 분위기를 밝게 만들었습니다.`,
          moraleEffect: 3,
          chemistryEffect: 2,
        });
      }
    }

    // 디바 요구 (야망 9+ & 충성심 3-, 2% 확률)
    if (p.personality.ambition >= 9 && p.personality.loyalty <= 3) {
      if (Math.random() < 0.02) {
        events.push({
          type: 'diva_demand',
          involvedPlayers: [p.personality.playerId],
          description: `${p.name}이(가) 더 나은 대우를 요구하며 불만을 표출했습니다.`,
          moraleEffect: -2,
          chemistryEffect: -2,
        });
      }
    }
  }

  return events;
}
