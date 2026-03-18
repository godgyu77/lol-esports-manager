/**
 * 오프시즌 특별 이벤트
 * - 팀 명성에 따라 오프시즌 이벤트 생성
 * - 올스타전, 시상식, 팬미팅, 자선 경기 등
 */

export type OffseasonEventType = 'allstar' | 'awards_ceremony' | 'fan_meeting' | 'charity_match';

export interface OffseasonEvent {
  type: OffseasonEventType;
  title: string;
  description: string;
  effects: { morale?: number; reputation?: number; fanHappiness?: number };
}

const OFFSEASON_EVENT_LABELS: Record<OffseasonEventType, string> = {
  allstar: '올스타전',
  awards_ceremony: '시상식',
  fan_meeting: '팬미팅',
  charity_match: '자선 경기',
};

/**
 * 팀 명성(reputation)에 따라 오프시즌 이벤트 목록 생성
 */
export function generateOffseasonEvents(teamReputation: number): OffseasonEvent[] {
  const events: OffseasonEvent[] = [];

  // 올스타전 참가 (reputation 70+, 50% 확률)
  if (teamReputation >= 70 && Math.random() < 0.5) {
    events.push({
      type: 'allstar',
      title: '올스타전 참가',
      description: '우리 팀 선수가 올스타전에 선발되었습니다!',
      effects: { morale: 5, reputation: 3 },
    });
  }

  // 시상식 (항상)
  events.push({
    type: 'awards_ceremony',
    title: '시즌 시상식',
    description: '시즌 시상식이 개최됩니다.',
    effects: {},
  });

  // 팬미팅 (reputation 50+)
  if (teamReputation >= 50) {
    events.push({
      type: 'fan_meeting',
      title: '팬미팅 개최',
      description: '팬들과의 만남이 진행됩니다.',
      effects: { fanHappiness: 8, morale: 3 },
    });
  }

  // 자선 경기 (reputation 80+, 30% 확률)
  if (teamReputation >= 80 && Math.random() < 0.3) {
    events.push({
      type: 'charity_match',
      title: '자선 경기 참가',
      description: '팀이 자선 경기에 초대받았습니다. 팬들의 호응이 뜨겁습니다!',
      effects: { morale: 4, reputation: 5, fanHappiness: 10 },
    });
  }

  return events;
}

export { OFFSEASON_EVENT_LABELS };
