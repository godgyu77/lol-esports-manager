import type { Region } from './game';
import type { PlayerStats } from './player';

export interface Scout {
  id: number;
  teamId: string;
  name: string;
  ability: number;        // 0-100
  experience: number;     // 리포트 제출 수
  regionSpecialty: Region | null;
  salary: number;         // 만 원/년
  hiredDate: string;
}

export interface ScoutingReport {
  id: number;
  scoutId: number;
  playerId: string;
  teamId: string;
  accuracy: number;       // 0-100
  reportedStats: Partial<PlayerStats>;
  reportedPotential: number | null;
  reportedMental: number | null;
  overallGrade: 'S' | 'A' | 'B' | 'C' | 'D';
  scoutComment: string | null;
  reportDate: string;
  isCompleted: boolean;
  daysRemaining: number;
}

export interface ScoutingWatchlistEntry {
  id: number;
  teamId: string;
  playerId: string;
  addedDate: string;
  notes: string | null;
}
