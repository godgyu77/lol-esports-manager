export type ComplaintType = 'playtime' | 'salary' | 'transfer' | 'role' | 'morale';
export type ComplaintStatus = 'active' | 'resolved' | 'ignored' | 'escalated';

export interface PlayerComplaint {
  id: number;
  playerId: string;
  teamId: string;
  seasonId: number;
  complaintType: ComplaintType;
  severity: number;       // 1-3
  message: string;
  status: ComplaintStatus;
  createdDate: string;
  resolvedDate: string | null;
  resolution: string | null;
  moraleImpact: number;
}

export const COMPLAINT_TYPE_LABELS: Record<ComplaintType, string> = {
  playtime: '출전 시간',
  salary: '연봉',
  transfer: '이적 요청',
  role: '역할 불만',
  morale: '사기 저하',
};

export const COMPLAINT_SEVERITY_LABELS: Record<number, string> = {
  1: '경미',
  2: '보통',
  3: '심각',
};
