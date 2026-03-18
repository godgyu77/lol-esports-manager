export interface BoardExpectation {
  teamId: string;
  seasonId: number;
  targetStanding: number;
  targetPlayoff: boolean;
  targetInternational: boolean;
  satisfaction: number;     // 0-100
  fanHappiness: number;     // 0-100
  warningCount: number;
  isFired: boolean;
}

export interface FanReaction {
  id: number;
  teamId: string;
  reactionDate: string;
  eventType: string;
  happinessChange: number;
  message: string | null;
}
