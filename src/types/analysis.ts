export interface MatchAnalysisReport {
  id: number;
  teamId: string;
  opponentTeamId: string;
  accuracy: number;
  recentWins: number;
  recentLosses: number;
  playStyle: string | null;
  keyPlayerId: string | null;
  weakPosition: string | null;
  recommendedBans: string[];
  generatedDate: string;
}
