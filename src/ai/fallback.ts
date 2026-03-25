/**
 * AI가 사용 불가능할 때 템플릿 기반 폴백 응답
 * - 면담, 기자회견 폴백
 * - 주제/상황별 풍부한 템플릿
 */
import { pickRandom } from '../utils/random';
import { fillTemplate } from '../utils/stringUtils';

// ─────────────────────────────────────────
// 면담 응답 (MEETING_RESPONSES)
// ─────────────────────────────────────────

interface MeetingFallback {
  dialogue: string;
  loyaltyChange: number;
  topic?: string;
}

const MEETING_RESPONSES_BY_TOPIC: Record<string, readonly MeetingFallback[]> = {
  general: [
    { dialogue: '현재 팀 상황을 고려해서 결정하겠습니다. 조금만 기다려주세요.', loyaltyChange: 0 },
    { dialogue: '좋은 의견이네요. 참고하겠습니다. 이런 이야기를 해줘서 고맙습니다.', loyaltyChange: 5 },
    { dialogue: '지금은 어려울 것 같습니다. 조금 더 시간을 두고 봅시다.', loyaltyChange: -5 },
    { dialogue: '그 부분은 이미 검토 중입니다. 곧 결과를 공유하겠습니다.', loyaltyChange: 3 },
    { dialogue: '팀의 방향성과 맞는지 좀 더 논의해봐야 할 것 같습니다.', loyaltyChange: 0 },
  ],
  playtime: [
    { dialogue: '출전 시간에 대한 걱정은 이해합니다. 하지만 팀의 상황도 함께 봐야 합니다.', loyaltyChange: -3 },
    { dialogue: '다음 경기에 좀 더 기회를 줄 수 있도록 검토해보겠습니다.', loyaltyChange: 5 },
    { dialogue: '솔직히 지금은 다른 선수와의 경쟁에서 좀 더 어필할 필요가 있습니다.', loyaltyChange: -8 },
    { dialogue: '당신의 성장을 지켜보고 있습니다. 기회는 반드시 올 거예요.', loyaltyChange: 3 },
    { dialogue: '컨디션이 돌아오면 당연히 선발로 나가게 될 겁니다. 훈련에 집중하세요.', loyaltyChange: 2 },
  ],
  salary: [
    { dialogue: '연봉 협상은 시즌이 끝난 후 진행하는 것이 원칙입니다.', loyaltyChange: -3 },
    { dialogue: '좋은 퍼포먼스를 보여주면 반드시 반영하겠습니다. 약속합니다.', loyaltyChange: 5 },
    { dialogue: '구단 예산 상황을 고려해야 합니다. 하지만 충분히 논의해보겠습니다.', loyaltyChange: 0 },
    { dialogue: '당신의 가치를 잘 알고 있습니다. 합리적인 제안을 준비하겠습니다.', loyaltyChange: 8 },
    { dialogue: '지금은 돈보다 실력 향상에 집중하는 게 어떨까요? 결과는 따라옵니다.', loyaltyChange: -5 },
  ],
  performance: [
    { dialogue: '최근 퍼포먼스에 대해 얘기하고 싶었습니다. 함께 개선점을 찾아봅시다.', loyaltyChange: 3 },
    { dialogue: '당신의 노력은 충분히 알고 있습니다. 결과가 안 나올 때도 있는 법이에요.', loyaltyChange: 5 },
    { dialogue: '솔직히 말하면, 좀 더 분발해야 할 부분이 있습니다. 코치진과 함께 보완합시다.', loyaltyChange: -3 },
    { dialogue: '멘탈이 흔들리고 있는 것 같아 걱정됩니다. 무리하지 말고 차근차근 갑시다.', loyaltyChange: 5 },
    { dialogue: '팀파이트에서의 역할에 대해 좀 더 명확히 하면 좋겠습니다. 오늘 리뷰 때 같이 보죠.', loyaltyChange: 2 },
  ],
  teamwork: [
    { dialogue: '팀 내 분위기에 대해 걱정하고 있다니 고마워요. 같이 해결해봅시다.', loyaltyChange: 5 },
    { dialogue: '팀원 간 소통이 중요하다는 데 동의합니다. 팀 빌딩 시간을 늘려보겠습니다.', loyaltyChange: 3 },
    { dialogue: '갈등이 있다면 숨기지 말고 솔직하게 이야기해주세요. 중재해드리겠습니다.', loyaltyChange: 5 },
    { dialogue: '모든 선수가 서로 존중하는 분위기를 만드는 것이 제 역할입니다.', loyaltyChange: 3 },
    { dialogue: '팀워크 문제는 민감하지만 빠르게 해결해야 합니다. 내일 전체 미팅을 잡겠습니다.', loyaltyChange: 0 },
  ],
};

const MEETING_RESPONSES_FLAT: readonly MeetingFallback[] = Object.values(MEETING_RESPONSES_BY_TOPIC).flat();

export function getFallbackMeetingResponse(topic?: string): MeetingFallback {
  if (topic) {
    const topicKey = topic.toLowerCase();
    for (const [key, responses] of Object.entries(MEETING_RESPONSES_BY_TOPIC)) {
      if (topicKey.includes(key) || key.includes(topicKey)) {
        return pickRandom(responses);
      }
    }
    // 한국어 키워드 매칭
    if (topicKey.includes('출전') || topicKey.includes('교체') || topicKey.includes('벤치')) {
      return pickRandom(MEETING_RESPONSES_BY_TOPIC.playtime);
    }
    if (topicKey.includes('연봉') || topicKey.includes('계약') || topicKey.includes('돈')) {
      return pickRandom(MEETING_RESPONSES_BY_TOPIC.salary);
    }
    if (topicKey.includes('성적') || topicKey.includes('경기력') || topicKey.includes('퍼포먼스') || topicKey.includes('실력')) {
      return pickRandom(MEETING_RESPONSES_BY_TOPIC.performance);
    }
    if (topicKey.includes('팀') || topicKey.includes('동료') || topicKey.includes('갈등') || topicKey.includes('분위기')) {
      return pickRandom(MEETING_RESPONSES_BY_TOPIC.teamwork);
    }
  }
  return pickRandom(MEETING_RESPONSES_FLAT);
}

// ─────────────────────────────────────────
// 기자회견 응답 (PRESS_CONFERENCE_RESPONSES)
// ─────────────────────────────────────────

interface PressFallback {
  dialogue: string;
  category: 'post_win' | 'post_loss' | 'general';
}

const PRESS_RESPONSES_BY_CATEGORY: Record<string, readonly PressFallback[]> = {
  post_win: [
    { dialogue: '선수들이 준비한 전략을 완벽하게 수행해주었습니다. 자랑스럽습니다.', category: 'post_win' },
    { dialogue: '이 승리는 팀 전체의 노력의 결과입니다. 한 명 한 명 모두 칭찬하고 싶습니다.', category: 'post_win' },
    { dialogue: '오늘 보여드린 팀워크가 우리의 진정한 강점입니다. 앞으로도 기대해주세요.', category: 'post_win' },
    { dialogue: '좋은 결과지만 겸손하게 받아들이겠습니다. 다음 경기도 최선을 다할 겁니다.', category: 'post_win' },
    { dialogue: '팬분들의 응원이 오늘 승리의 원동력이었습니다. 정말 감사합니다.', category: 'post_win' },
    { dialogue: '어려운 상대였지만 선수들이 집중력을 잃지 않았습니다. 성장하고 있다는 증거입니다.', category: 'post_win' },
    { dialogue: '드래프트부터 운영까지, 오늘은 코칭스태프 전체가 잘 준비했다고 생각합니다.', category: 'post_win' },
  ],
  post_loss: [
    { dialogue: '아쉬운 결과이지만, 선수들의 노력은 인정합니다. 다음에는 반드시 설욕하겠습니다.', category: 'post_loss' },
    { dialogue: '오늘 패배는 전적으로 제 책임입니다. 선수들은 최선을 다했습니다.', category: 'post_loss' },
    { dialogue: '분석할 부분이 많은 경기였습니다. 빠르게 보완해서 돌아오겠습니다.', category: 'post_loss' },
    { dialogue: '이런 경기에서 배우는 것이 많습니다. 팀이 더 강해지는 계기가 될 것입니다.', category: 'post_loss' },
    { dialogue: '팬분들께 죄송합니다. 기대에 못 미친 경기력에 대해 깊이 반성하고 있습니다.', category: 'post_loss' },
    { dialogue: '핵심적인 순간에 판단 실수가 있었습니다. 같은 실수를 반복하지 않겠습니다.', category: 'post_loss' },
    { dialogue: '패배를 겸허히 받아들이겠습니다. 하지만 우리 팀의 잠재력을 의심하지 않습니다.', category: 'post_loss' },
  ],
  general: [
    { dialogue: '한 경기 한 경기에 집중하는 것이 가장 중요하다고 생각합니다.', category: 'general' },
    { dialogue: '선수들의 성장이 눈에 보입니다. 이 팀의 미래가 밝다고 확신합니다.', category: 'general' },
    { dialogue: '팬 여러분의 응원이 팀에 큰 힘이 됩니다. 항상 감사드립니다.', category: 'general' },
    { dialogue: '이번 시즌 목표를 향해 한 걸음씩 나아가고 있습니다. 지켜봐주세요.', category: 'general' },
    { dialogue: '경기 결과와 관계없이, 과정에서 배우고 성장하는 팀이 되겠습니다.', category: 'general' },
    { dialogue: '선수들에게 충분한 휴식을 주면서도 날카로운 경쟁력을 유지하는 것이 관건입니다.', category: 'general' },
  ],
};

const PRESS_RESPONSES_FLAT: readonly PressFallback[] = Object.values(PRESS_RESPONSES_BY_CATEGORY).flat();

export function getFallbackPressResponse(context?: { recentResults?: string; teamName?: string }): string {
  let pool: readonly PressFallback[] = PRESS_RESPONSES_FLAT;

  if (context?.recentResults) {
    const r = context.recentResults.toLowerCase();
    if (r.includes('승리') || r.includes('이김') || r.includes('승')) {
      pool = PRESS_RESPONSES_BY_CATEGORY.post_win;
    } else if (r.includes('패배') || r.includes('짐') || r.includes('패')) {
      pool = PRESS_RESPONSES_BY_CATEGORY.post_loss;
    }
  }

  let dialogue = pickRandom(pool).dialogue;
  if (context?.teamName) {
    dialogue = fillTemplate(dialogue, { teamName: context.teamName });
  }
  return dialogue;
}
