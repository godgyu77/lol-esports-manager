export type InterviewType = 'respect' | 'confident' | 'provocative';

export interface CoachRivalry {
  teamAId: string;
  teamBId: string;
  rivalryLevel: number; // -100 ~ +100
  history: string | null;
  lastMatchDate: string | null;
}

export interface PreMatchInterview {
  id: number;
  matchId: string;
  teamId: string;
  interviewType: InterviewType;
  responseText: string;
  rivalryChange: number;
  moraleChange: number;
}

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  respect: '존경 표현',
  confident: '자신감 표출',
  provocative: '도발',
};
