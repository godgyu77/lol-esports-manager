export type PromiseType = 'starter_guarantee' | 'no_transfer' | 'salary_raise' | 'playtime' | 'new_signing';

export interface ManagerPromise {
  id: number;
  playerId: string;
  teamId: string;
  promiseType: PromiseType;
  promiseDate: string;
  deadlineDate: string;
  isFulfilled: boolean;
  isBroken: boolean;
  trustPenalty: number;
}

export const PROMISE_TYPE_LABELS: Record<PromiseType, string> = {
  starter_guarantee: '주전 보장',
  no_transfer: '이적 안 시킴',
  salary_raise: '연봉 인상',
  playtime: '출전 시간 보장',
  new_signing: '보강 영입',
};

export const PROMISE_TYPE_DESC: Record<PromiseType, string> = {
  starter_guarantee: '최근 3경기 중 2경기 이상 출전',
  no_transfer: '이적 제안을 수락하지 않음',
  salary_raise: '다음 계약 갱신 시 연봉 인상',
  playtime: '최근 5경기 중 3경기 이상 출전',
  new_signing: '해당 포지션에 신규 영입 완료',
};
