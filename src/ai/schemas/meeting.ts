import { z } from 'zod';

// 면담 AI 응답 스키마
export const meetingResponseSchema = z.object({
  dialogue: z.string().describe('감독의 대사'),
  loyaltyChange: z.number().min(-30).max(30).describe('충성도 변화'),
  moraleChange: z.number().min(-20).max(20).describe('사기 변화'),
  approved: z.boolean().describe('요청 승인 여부'),
  reason: z.string().optional().describe('판단 근거'),
});

export type MeetingResponse = z.infer<typeof meetingResponseSchema>;

// 기자회견 AI 응답 스키마
export const pressConferenceSchema = z.object({
  dialogue: z.string().describe('기자회견 발언'),
  teamMoraleEffect: z.number().min(-10).max(10).describe('팀 사기 영향'),
  publicOpinionChange: z.number().min(-15).max(15).describe('여론 변화'),
});

export type PressConferenceResponse = z.infer<typeof pressConferenceSchema>;

// 연봉 협상 AI 응답 스키마
export const negotiationSchema = z.object({
  dialogue: z.string().describe('협상 대사'),
  counterOffer: z.number().optional().describe('역제안 금액'),
  accepted: z.boolean().describe('제안 수락 여부'),
  loyaltyChange: z.number().min(-20).max(20).describe('충성도 변화'),
});

export type NegotiationResponse = z.infer<typeof negotiationSchema>;
