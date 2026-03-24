export type TalkType = 'pre_match' | 'between_games' | 'post_match';
export type TalkTone = 'motivate' | 'calm' | 'warn' | 'praise' | 'criticize' | 'neutral';

export interface TeamTalk {
  id: number;
  matchId: string;
  teamId: string;
  talkType: TalkType;
  talkTone: TalkTone;
  targetPlayerId: string | null;
  moraleChange: number;
  formChange: number;
}

export const TALK_TONE_LABELS: Record<TalkTone, string> = {
  motivate: '동기부여', calm: '안정시키기', warn: '경고',
  praise: '칭찬', criticize: '질책', neutral: '담담하게',
};

export const TALK_TONE_DESC: Record<TalkTone, string> = {
  motivate: '사기 +5, 폼 +3 — "우리는 할 수 있다!"',
  calm: '사기 +2, 일관성 보정 — "침착하게 집중하자"',
  warn: '사기 -2, 폼 +5 — "오늘 지면 위험하다" (리스크)',
  praise: '사기 +8 — "정말 잘하고 있다" (승리 후 효과적)',
  criticize: '사기 -5, 폼 +3 — "경기력이 실망스럽다" (규율 감독 효과)',
  neutral: '변화 없음 — "평소대로 하면 된다"',
};

export const TALK_TONE_EFFECTS: Record<TalkTone, { morale: number; form: number }> = {
  motivate: { morale: 5, form: 3 },
  calm: { morale: 2, form: 0 },
  warn: { morale: -2, form: 5 },
  praise: { morale: 8, form: 0 },
  criticize: { morale: -5, form: 3 },
  neutral: { morale: 0, form: 0 },
};
