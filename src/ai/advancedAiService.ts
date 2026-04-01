/**
 * 고급 AI 서비스
 * - 경기 중계, 드래프트 조언, 전술 제안, 뉴스 기사, 소셜 반응, 스카우팅 리포트
 * - AI 불가 시 풍부한 템플릿 폴백
 */

import { chatWithLlmJson } from './provider';
import { isAiAvailable } from './gameAiService';
import { augmentPromptWithKnowledge } from './rag/ragEngine';
import { pickRandom, pickRandomN, randomInt } from '../utils/random';
import { fillTemplate } from '../utils/stringUtils';
import { COMMENTARY_TEMPLATE_ASSETS } from './templates/commentaryTemplates';
import { FALLBACK_BAN_ADVICE_ASSETS, FALLBACK_PICK_ADVICE_ASSETS } from './templates/draftAdviceTemplates';
import { GENERATED_NEWS_TEMPLATE_ASSETS } from './templates/generatedNewsTemplates';
import { z } from 'zod';

/** RAG 안전 래퍼 -- 실패 시 원본 프롬프트 반환 */
async function safeAugment(prompt: string, query: string): Promise<string> {
  try {
    return await augmentPromptWithKnowledge(prompt, query);
  } catch {
    return prompt;
  }
}

// ─────────────────────────────────────────
// 1. AI 경기 중계 (Commentary)
// ─────────────────────────────────────────

export interface MatchCommentary {
  text: string;
  excitement: number;
  tone: 'neutral' | 'excited' | 'tense' | 'dramatic';
}

const matchCommentarySchema = z.object({
  text: z.string().min(1).max(160),
  excitement: z.number().min(1).max(10),
  tone: z.enum(['neutral', 'excited', 'tense', 'dramatic']),
});

const COMMENTARY_TEMPLATES: Record<string, readonly { text: string; excitement: number; tone: MatchCommentary['tone'] }[]> = {
  firstBlood: [
    { text: '퍼스트 블러드! 초반부터 피가 튀는 전개입니다!', excitement: 7, tone: 'excited' },
    { text: '첫 번째 킬이 터졌습니다! 공격적인 라인전이네요.', excitement: 6, tone: 'excited' },
    { text: '퍼스트 블러드가 나왔습니다. 상대의 실수를 놓치지 않았네요.', excitement: 6, tone: 'neutral' },
    { text: '이른 킬! 라인전의 주도권이 넘어갑니다!', excitement: 7, tone: 'tense' },
    { text: '퍼스트 블러드로 분위기를 잡아갑니다. 골드 격차가 벌어지기 시작합니다.', excitement: 5, tone: 'neutral' },
    { text: '초반 교전에서 첫 피! 이 킬이 게임 흐름을 바꿀 수 있습니다.', excitement: 7, tone: 'tense' },
    { text: '퍼블! 솔로킬인데요, 실력 차이가 느껴지는 킬이었습니다.', excitement: 8, tone: 'excited' },
    { text: '피가 먼저 터졌습니다. 이 맞다이에서 한 끗 차이로 갈렸네요.', excitement: 6, tone: 'neutral' },
    { text: '퍼스트 블러드! 정글 개입 없이 순수 라인전 킬입니다!', excitement: 7, tone: 'excited' },
    { text: '극초반 킬이 터졌습니다! 스노우볼이 시작될 수 있겠네요.', excitement: 8, tone: 'dramatic' },
    { text: '{playerName} 선수가 퍼스트 블러드를 따냅니다! 자신감 넘치는 플레이!', excitement: 7, tone: 'excited' },
    { text: '퍼블! 플래시까지 태우면서 잡아냈습니다. 상대 라이너 멘탈이 걱정되네요.', excitement: 7, tone: 'tense' },
    { text: '레벨 2 선취 후 바로 킬! 경험치 관리의 중요성을 보여주는 장면입니다.', excitement: 6, tone: 'neutral' },
    { text: '퍼스트 블러드! 이 킬 하나로 라인전 주도권이 완전히 넘어갔습니다.', excitement: 7, tone: 'tense' },
    { text: '와! 탑에서 솔로킬로 퍼블! {teamName} 탑라이너의 위엄입니다!', excitement: 8, tone: 'excited' },
  ],
  dragonKill: [
    { text: '드래곤을 확보합니다! 오브젝트 컨트롤이 좋습니다.', excitement: 5, tone: 'neutral' },
    { text: '드래곤 획득! 이 버프가 후반에 큰 영향을 미칠 겁니다.', excitement: 6, tone: 'neutral' },
    { text: '스틸 없이 깔끔하게 드래곤을 챙깁니다!', excitement: 5, tone: 'neutral' },
    { text: '드래곤 소울에 한 발 더 다가갑니다! 중요한 오브젝트였습니다.', excitement: 7, tone: 'tense' },
    { text: '상대를 물리치고 드래곤까지! 완벽한 오브젝트 파이트였습니다.', excitement: 8, tone: 'excited' },
    { text: '드래곤을 가져갑니다. 시야 장악이 돋보이는 플레이였네요.', excitement: 5, tone: 'neutral' },
    { text: '드래곤 확보! 상대는 반대편 탑 타워를 가져가지만, 어디가 이득일까요?', excitement: 6, tone: 'tense' },
    { text: '세 번째 드래곤! 소울 포인트에 도달했습니다!', excitement: 8, tone: 'dramatic' },
    { text: '드래곤 스틸! 정글러의 스마이트가 빛났습니다!', excitement: 9, tone: 'dramatic' },
    { text: '드래곤을 챙기면서 오브젝트 주도권을 완전히 가져왔습니다.', excitement: 6, tone: 'neutral' },
    { text: '인페르날 드래곤 확보! 전투력이 한층 올라갑니다.', excitement: 6, tone: 'neutral' },
    { text: '오션 드래곤을 챙겼습니다. 지속 전투에서 큰 이점을 얻게 되었네요.', excitement: 5, tone: 'neutral' },
    { text: '드래곤 소울 확보! 이제 게임의 주도권을 완전히 잡았습니다!', excitement: 9, tone: 'dramatic' },
    { text: '{teamName} 정글러의 스마이트 타이밍이 정확했습니다. 드래곤 확보!', excitement: 6, tone: 'neutral' },
    { text: '상대 정글러의 스틸 시도를 차단하고 드래곤을 챙깁니다!', excitement: 7, tone: 'excited' },
  ],
  baronKill: [
    { text: '바론 내셔르를 잡았습니다! 이 버프로 게임을 끝낼 수 있을까요?', excitement: 8, tone: 'dramatic' },
    { text: '바론 확보! 이제 대규모 공성전이 시작됩니다!', excitement: 8, tone: 'excited' },
    { text: '바론을 잡으면서 골드 격차를 더 벌립니다!', excitement: 7, tone: 'excited' },
    { text: '바론 버프로 중앙 라인을 밀어붙입니다. 결정적인 오브젝트였습니다.', excitement: 7, tone: 'tense' },
    { text: '바론 내셔르! 상대를 견제하면서 깔끔하게 처리했습니다.', excitement: 7, tone: 'neutral' },
    { text: '바론 스틸! 말도 안 되는 플레이가 나왔습니다!!', excitement: 10, tone: 'dramatic' },
    { text: '바론을 가져갑니다! 이것으로 게임의 흐름이 완전히 기울었습니다.', excitement: 8, tone: 'dramatic' },
    { text: '상대 전원을 처치하고 바론까지! 에이스 후 바론은 너무 크죠.', excitement: 9, tone: 'excited' },
    { text: '바론 확보했지만 상대도 킬을 챙겼습니다. 이 교환이 어디가 이득일까요?', excitement: 7, tone: 'tense' },
    { text: '바론 버프! 이제 승기를 굳히러 갈 시간입니다.', excitement: 7, tone: 'excited' },
    { text: '20분 바론! {teamName}의 과감한 콜이 성공했습니다!', excitement: 8, tone: 'excited' },
    { text: '바론을 잡으면서 슈퍼 미니언까지! 상대는 수비가 불가능한 상황입니다.', excitement: 8, tone: 'dramatic' },
    { text: '상대 견제를 뚫고 바론 확보! {teamName}의 팀 호흡이 빛나는 순간입니다.', excitement: 8, tone: 'excited' },
    { text: '바론 50 대 50 도박에서 승리했습니다! 정글러의 정신력이 대단합니다!', excitement: 9, tone: 'dramatic' },
    { text: '두 번째 바론까지! {teamName}이 경기를 완전히 지배하고 있습니다.', excitement: 8, tone: 'excited' },
  ],
  teamfight: [
    { text: '대규모 팀파이트! 양 팀 모두 사력을 다하고 있습니다!', excitement: 9, tone: 'dramatic' },
    { text: '한타가 벌어졌습니다! 이 한타의 결과가 게임을 결정지을 수 있습니다!', excitement: 9, tone: 'dramatic' },
    { text: '팀파이트에서 에이스를 따냅니다! 완벽한 이니시에이션이었습니다!', excitement: 10, tone: 'excited' },
    { text: '한타에서 3명을 잡아냈습니다! 오브젝트가 열립니다!', excitement: 8, tone: 'excited' },
    { text: '혼전 속에서 원딜이 살아남으면서 역전 한타가 나옵니다!', excitement: 9, tone: 'dramatic' },
    { text: '이니시 들어갑니다! 상대 캐리진을 완벽하게 잡아냈네요!', excitement: 8, tone: 'excited' },
    { text: '팀파이트 승리! 하지만 아깝게 상대 원딜을 놓쳤습니다.', excitement: 7, tone: 'tense' },
    { text: '양 팀 전원이 뒤엉키는 대혈전! 결국 누가 남았나... ', excitement: 9, tone: 'dramatic' },
    { text: '서포터의 궁극기가 한타를 결정지었습니다! MVP급 플레이!', excitement: 8, tone: 'excited' },
    { text: '한타에서 패배했습니다. 이니시 타이밍이 아쉬웠네요.', excitement: 6, tone: 'tense' },
    { text: '{teamName} 원딜의 포지셔닝이 완벽합니다! 상대 전원을 녹이고 있어요!', excitement: 9, tone: 'excited' },
    { text: '역전 한타! 열세에서도 포기하지 않은 {teamName}의 집념이 빛납니다!', excitement: 10, tone: 'dramatic' },
    { text: '한타 3 대 0 교환! {teamName}이 일방적으로 유리한 싸움이었습니다.', excitement: 8, tone: 'excited' },
    { text: '바론 앞 한타에서 전멸! 이 한타로 게임이 결정날 수 있습니다!', excitement: 10, tone: 'dramatic' },
    { text: '미드라이너의 궁극기가 3명을 한꺼번에 잡아냅니다! 경이로운 플레이!', excitement: 9, tone: 'excited' },
  ],
  turretDestroy: [
    { text: '타워가 무너집니다! 맵 장악력이 커지고 있습니다.', excitement: 5, tone: 'neutral' },
    { text: '이너 타워를 밀어버립니다! 베이스까지 시야가 열립니다.', excitement: 6, tone: 'neutral' },
    { text: '첫 타워 골드를 챙깁니다. 로테이션이 좋았습니다.', excitement: 4, tone: 'neutral' },
    { text: '타워가 밀리면서 방어선이 무너지기 시작합니다!', excitement: 6, tone: 'tense' },
    { text: '억제기 타워를 깨뜨립니다! 슈퍼 미니언이 곧 몰려옵니다!', excitement: 7, tone: 'excited' },
    { text: '바론 버프로 타워를 순식간에 밀어버립니다!', excitement: 6, tone: 'excited' },
    { text: '탑 라인 타워를 정리하면서 스플릿 푸시가 빛을 발합니다.', excitement: 5, tone: 'neutral' },
    { text: '미드 타워가 무너지면서 맵 주도권이 넘어갑니다.', excitement: 6, tone: 'tense' },
    { text: '넥서스 타워에 도달했습니다! 게임이 끝날 수 있는 상황입니다!', excitement: 9, tone: 'dramatic' },
    { text: '타워를 하나씩 정리하면서 차분하게 경기를 운영합니다.', excitement: 4, tone: 'neutral' },
    { text: '바론 버프와 함께 3개 라인을 동시에 밀어붙입니다!', excitement: 7, tone: 'excited' },
    { text: '{teamName}이 탑부터 봇까지 타워를 순서대로 정리합니다. 교과서적인 운영이네요.', excitement: 5, tone: 'neutral' },
    { text: '상대 억제기가 무너졌습니다! 슈퍼 미니언의 압박이 시작됩니다!', excitement: 7, tone: 'tense' },
    { text: '넥서스가 공격받고 있습니다! {teamName}의 최후의 공격!', excitement: 10, tone: 'dramatic' },
    { text: '5인 합류로 미드 타워를 순식간에 밀어버립니다. 상대는 대응할 시간조차 없었네요.', excitement: 6, tone: 'neutral' },
  ],
  inhibitor_destroy: [
    { text: '억제기가 파괴되었습니다! 슈퍼 미니언이 밀려옵니다!', excitement: 7, tone: 'excited' },
    { text: '억제기 파괴! 상대는 이제 수비에 쫓기게 됩니다!', excitement: 7, tone: 'tense' },
    { text: '두 번째 억제기까지! 상대 진영이 무너지고 있습니다!', excitement: 8, tone: 'dramatic' },
    { text: '모든 억제기가 파괴되었습니다! 넥서스가 위험합니다!', excitement: 9, tone: 'dramatic' },
    { text: '{teamName}이 억제기를 밀어버리며 최종 국면으로 향합니다!', excitement: 7, tone: 'excited' },
    { text: '슈퍼 미니언의 물량이 상대 베이스를 압박합니다. 억제기 파괴의 효과가 즉각적이네요.', excitement: 6, tone: 'neutral' },
    { text: '억제기를 깨고 빠집니다. 시간을 벌면서 슈퍼 미니언에게 맡기는 전략이네요.', excitement: 5, tone: 'neutral' },
    { text: '상대의 억제기가 리젠되기 전에 다시 밀어야 합니다! 시간 싸움입니다!', excitement: 7, tone: 'tense' },
    { text: '미드 억제기 파괴! 이제 다른 라인으로 압박을 전환합니다.', excitement: 6, tone: 'neutral' },
    { text: '봇 억제기까지 무너뜨렸습니다! {teamName}의 공성이 멈추질 않습니다!', excitement: 8, tone: 'excited' },
    { text: '억제기 파괴 후 바론까지! 이 타이밍에 게임을 끝낼 수 있을 겁니다.', excitement: 8, tone: 'dramatic' },
    { text: '상대가 필사적으로 수비하지만 억제기가 무너집니다. 전력 차이가 느껴지는 순간입니다.', excitement: 7, tone: 'tense' },
    { text: '스플릿 푸시로 억제기를 취하면서 상대의 수비를 분산시킵니다!', excitement: 6, tone: 'neutral' },
    { text: '이니시에이터가 진입하는 사이 원딜이 억제기를 밀어버립니다! 멀티태스킹 운영!', excitement: 7, tone: 'excited' },
    { text: '억제기 파괴 직후 팀파이트까지 승리! {teamName}의 완벽한 시나리오입니다!', excitement: 9, tone: 'dramatic' },
  ],
  ace: [
    { text: '에이스!! 상대 전원을 쓸어버렸습니다!!', excitement: 10, tone: 'dramatic' },
    { text: '에이스! {teamName}이 상대를 전멸시킵니다!', excitement: 10, tone: 'excited' },
    { text: '5 대 0 에이스! 말이 필요 없는 압도적인 한타였습니다!', excitement: 10, tone: 'dramatic' },
    { text: '에이스를 따냈습니다! 이 시간에 에이스는 게임 엔딩급입니다!', excitement: 10, tone: 'dramatic' },
    { text: '에이스!! 상대는 부활 타이머만 바라보고 있습니다!', excitement: 9, tone: 'excited' },
    { text: '완벽한 이니시에이션으로 에이스! 오브젝트를 모조리 챙길 수 있습니다!', excitement: 9, tone: 'excited' },
    { text: '에이스! 이제 바론과 드래곤, 타워까지 모두 열립니다!', excitement: 9, tone: 'excited' },
    { text: '후반 에이스! 이게 역전의 시발점이 될 수 있습니다!', excitement: 10, tone: 'dramatic' },
    { text: '에이스를 따내면서 {teamName}이 게임의 마침표를 찍으러 갑니다!', excitement: 10, tone: 'dramatic' },
    { text: '역전 에이스!! 불가능하다고 생각했던 게임을 뒤집습니다!', excitement: 10, tone: 'dramatic' },
    { text: '에이스! 상대의 부활 타이머가 40초 이상! 이 시간이면 넥서스까지 갈 수 있습니다!', excitement: 10, tone: 'dramatic' },
    { text: '바론 앞 에이스! {teamName}이 게임을 집어삼킵니다!', excitement: 10, tone: 'dramatic' },
    { text: '에이스!! 원딜의 트리플킬로 마무리! 경이로운 딜링이었습니다!', excitement: 10, tone: 'excited' },
    { text: '수비 싸움에서 역전 에이스가 나옵니다! 상대가 무리하게 진입한 대가입니다!', excitement: 10, tone: 'dramatic' },
    { text: '에이스! 상대의 실수를 한 치도 용서하지 않는 {teamName}입니다!', excitement: 9, tone: 'excited' },
  ],
  shutdown: [
    { text: '셧다운! 현상금 사냥 성공입니다!', excitement: 7, tone: 'excited' },
    { text: '셧다운 골드를 획득합니다! 골드 격차가 줄어듭니다!', excitement: 7, tone: 'tense' },
    { text: '셧다운! 상대 캐리의 연속 킬을 끊어냅니다!', excitement: 8, tone: 'excited' },
    { text: '셧다운! 이 킬로 골드 차이가 한순간에 줄었습니다!', excitement: 8, tone: 'tense' },
    { text: '현상금을 챙겼습니다! 게임이 다시 원점으로 돌아갈 수 있겠네요.', excitement: 7, tone: 'tense' },
    { text: '1000골드 셧다운! 이 보너스가 아이템 격차를 메워줄 수 있습니다!', excitement: 7, tone: 'excited' },
    { text: '셧다운! 상대 에이스가 쓰러집니다! 이게 가능한 건가요!', excitement: 9, tone: 'dramatic' },
    { text: '셧다운 킬! {teamName}에게 희망의 빛이 보입니다!', excitement: 8, tone: 'tense' },
    { text: '연속 킬을 이어가던 상대 원딜을 잡아냅니다! 비싼 셧다운이었습니다!', excitement: 8, tone: 'excited' },
    { text: '셧다운! 이 킬 하나로 팀 전체에 골드가 퍼집니다!', excitement: 7, tone: 'neutral' },
    { text: '뒤지고 있던 상황에서 셧다운 성공! 반격의 실마리를 잡았습니다!', excitement: 8, tone: 'tense' },
    { text: '서포터가 셧다운을 잡아냅니다! 팀을 위한 헌신적인 플레이!', excitement: 7, tone: 'excited' },
    { text: '셧다운 골드로 핵심 아이템을 완성할 수 있게 되었습니다!', excitement: 6, tone: 'neutral' },
    { text: '정글러의 기습으로 셧다운 성공! 상대 캐리의 행진을 끊어냅니다!', excitement: 8, tone: 'excited' },
    { text: '셧다운! {teamName}이 역전의 발판을 마련합니다!', excitement: 8, tone: 'tense' },
  ],
  pentakill: [
    { text: '펜타킬!!!! 말도 안 됩니다!!!!! 역사적인 순간입니다!!!!!', excitement: 10, tone: 'dramatic' },
    { text: '펜타킬!!!!! {playerName} 선수가 전설을 쓰고 있습니다!!!!!', excitement: 10, tone: 'dramatic' },
    { text: '프로 경기에서 펜타킬이 나왔습니다! 관중석이 터져나갑니다!', excitement: 10, tone: 'dramatic' },
    { text: '펜타킬! 이 경기는 LCK 역사에 길이 남을 것입니다!', excitement: 10, tone: 'dramatic' },
    { text: '소름 돋는 펜타킬!!! 해설진도 말을 잇지 못하고 있습니다!', excitement: 10, tone: 'dramatic' },
    { text: '펜타킬!!! {teamName}의 캐리가 1 대 5를 해냅니다! 이게 프로입니다!', excitement: 10, tone: 'dramatic' },
    { text: '트리플... 쿼드라... 펜타킬!!!!! 경기장이 폭발합니다!!!!!', excitement: 10, tone: 'dramatic' },
    { text: '역사적인 펜타킬이 터졌습니다! 팬들이 자리에서 벌떡 일어섭니다!', excitement: 10, tone: 'dramatic' },
    { text: '펜타킬! 이 한 장면으로 올해의 플레이 후보에 오를 것 같습니다!', excitement: 10, tone: 'dramatic' },
    { text: '펜타킬!!!! 상대 전원을 혼자서 쓸어버렸습니다! 믿기 어려운 장면입니다!', excitement: 10, tone: 'dramatic' },
    { text: '프로 무대에서의 펜타킬! 이 순간만큼은 신이 내린 손이라 할 수 있겠습니다!', excitement: 10, tone: 'dramatic' },
    { text: '펜타킬!! 커리어 하이라이트급 플레이가 나왔습니다!', excitement: 10, tone: 'dramatic' },
    { text: '펜타킬!!!! {playerName}! {playerName}!! {playerName}!!! 이름을 외치는 함성이 멈추질 않습니다!', excitement: 10, tone: 'dramatic' },
    { text: '꿈인가 생시인가! 프로 경기 펜타킬! 이 순간을 잊지 못할 겁니다!', excitement: 10, tone: 'dramatic' },
    { text: '한 사람이 다섯을 상대합니다! 펜타킬!!! 이것이 프로의 세계입니다!', excitement: 10, tone: 'dramatic' },
  ],
};

void COMMENTARY_TEMPLATES;

export async function generateMatchCommentary(context: {
  phase: 'laning' | 'mid_game' | 'late_game';
  event: string;
  details: string;
  goldDiff: number;
  gameTime: number;
  kills: { home: number; away: number };
  teamName?: string;
}): Promise<MatchCommentary> {
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      const phaseKr = { laning: '라인전', mid_game: '중반', late_game: '후반' }[context.phase];
      const prompt = `당신은 LoL e스포츠 전문 캐스터입니다. 흥미진진하게 경기를 중계하세요.

현재 상황:
- 게임 시간: ${context.gameTime}분 (${phaseKr})
- 이벤트: ${context.event}
- 상세: ${context.details}
- 골드 격차: ${context.goldDiff > 0 ? '+' : ''}${context.goldDiff}
- 킬 스코어: ${context.kills.home} vs ${context.kills.away}

한국 LoL 캐스터 스타일로 생동감 있게 중계하세요.
JSON 형식: {"text": "중계 멘트 (80자 이내)", "excitement": 1-10, "tone": "neutral|excited|tense|dramatic"}`;

      const augmented = await safeAugment(prompt, `${context.event} ${phaseKr}`);
      return await chatWithLlmJson<MatchCommentary>(augmented, { schema: matchCommentarySchema });
    } catch {
      // AI 실패 -> 폴백
    }
  }

  // 폴백: 이벤트별 템플릿
  const templates = COMMENTARY_TEMPLATE_ASSETS[context.event] ?? COMMENTARY_TEMPLATE_ASSETS.teamfight;
  const template = pickRandom(templates);
  // 플레이스홀더가 있으면 치환 (fillTemplate은 replaceAll 사용)
  const text = fillTemplate(template.text, {
    teamName: context.teamName ?? '우리 팀',
    playerName: '선수',
  });
  return { text, excitement: template.excitement, tone: template.tone };
}

// ─────────────────────────────────────────
// 2. 드래프트 조언 (Draft Advice)
// ─────────────────────────────────────────

export interface DraftAdvice {
  suggestion: string;
  reason: string;
  confidence: number;
}

const draftAdviceSchema = z.object({
  suggestion: z.string().min(1).max(120),
  reason: z.string().min(1).max(220),
  confidence: z.number().min(0).max(100),
});

const FALLBACK_BAN_ADVICE: readonly DraftAdvice[] = [
  { suggestion: '상대 핵심 챔피언을 밴하세요', reason: '상대의 시그니처 챔피언을 차단하는 것이 안전합니다.', confidence: 60 },
  { suggestion: '현 메타 OP 챔피언을 밴하세요', reason: '밴하지 않으면 상대에게 강력한 픽을 허용합니다.', confidence: 65 },
  { suggestion: '상대 정글러의 주력 챔피언을 밴하세요', reason: '정글 차이가 게임의 흐름을 좌우합니다.', confidence: 55 },
  { suggestion: '카운터 픽 가능성이 높은 챔피언을 밴하세요', reason: '우리 팀 구성에 대한 카운터를 미리 차단합니다.', confidence: 58 },
  { suggestion: '시너지가 강한 조합의 핵심 챔피언을 밴하세요', reason: '상대의 팀 조합 시너지를 방지합니다.', confidence: 55 },
  { suggestion: '상대 미드라이너의 핵심 픽을 차단하세요', reason: '미드 주도권을 빼앗으면 로밍과 오브젝트 싸움에서 유리해집니다.', confidence: 62 },
  { suggestion: '글로벌 궁극기 챔피언을 밴하세요', reason: '글로벌 궁극기는 맵 전체 교전에 영향을 미칩니다.', confidence: 55 },
  { suggestion: '상대 원딜의 시그니처 챔피언을 밴하세요', reason: '상대 원딜의 편안한 라인전을 차단하면 봇 주도권을 가져올 수 있습니다.', confidence: 58 },
  { suggestion: '후반 하이퍼 캐리 챔피언을 밴하세요', reason: '후반 스케일링이 극단적인 챔피언을 허용하면 위험합니다.', confidence: 60 },
  { suggestion: '이니시에이터 탱커를 밴하세요', reason: '강력한 이니시에이터가 없으면 상대 팀파이트 시작이 불안정해집니다.', confidence: 55 },
  { suggestion: '상대 서포터의 주력 챔피언을 밴하세요', reason: '서포터 밴은 의외로 상대 봇 라인 전체를 흔들 수 있습니다.', confidence: 52 },
  { suggestion: '스플릿 푸시 특화 챔피언을 밴하세요', reason: '스플릿 푸시를 허용하면 맵 운영이 매우 어려워집니다.', confidence: 55 },
  { suggestion: '상대가 자주 쓰는 밴 유도 챔피언을 무시하세요', reason: '밴 자원을 아끼고 진짜 위협적인 챔피언에 집중하세요.', confidence: 50 },
  { suggestion: '라인전 강자를 밴해서 안정적 라인전을 확보하세요', reason: '초반 라인전에서 밀리면 전체 게임 운영이 어려워집니다.', confidence: 58 },
  { suggestion: '플렉스 픽 가능한 챔피언을 밴하세요', reason: '상대의 드래프트 유연성을 제한하면 우리의 카운터 픽 기회가 늘어납니다.', confidence: 62 },
];

const FALLBACK_PICK_ADVICE: readonly DraftAdvice[] = [
  { suggestion: '팀 조합에 맞는 안정적인 픽을 선택하세요', reason: '밸런스 잡힌 팀 구성이 승률을 높입니다.', confidence: 60 },
  { suggestion: '현재 메타에서 강력한 챔피언을 선택하세요', reason: '메타 픽은 검증된 성능을 보장합니다.', confidence: 65 },
  { suggestion: '상대 구성에 대한 카운터 픽을 고려하세요', reason: '상대의 약점을 공략할 수 있는 챔피언이 유리합니다.', confidence: 58 },
  { suggestion: '후반 스케일링이 좋은 챔피언을 선택하세요', reason: '안정적인 후반 파워를 확보합니다.', confidence: 55 },
  { suggestion: '이니시에이터 챔피언을 추가하세요', reason: '팀파이트 시작을 주도할 수 있는 챔피언이 필요합니다.', confidence: 60 },
  { suggestion: '적 조합의 딜러를 보호할 수 있는 서포터를 뽑으세요', reason: '상대 어쌔신이나 다이버 대응이 필요합니다.', confidence: 58 },
  { suggestion: '플렉스 픽으로 상대를 혼란시키세요', reason: '여러 포지션에서 사용 가능한 챔피언으로 우위를 점하세요.', confidence: 62 },
  { suggestion: 'AP 딜을 추가해서 딜 비율을 맞추세요', reason: 'AD 일변도 조합은 방어구 하나로 무력화됩니다.', confidence: 58 },
  { suggestion: '안전한 라인전이 가능한 챔피언을 선택하세요', reason: '상대 카운터 매치업에서도 버틸 수 있어야 합니다.', confidence: 55 },
  { suggestion: '웨이브 클리어가 좋은 미드를 뽑으세요', reason: '라인 주도권과 로밍 우선순위를 확보할 수 있습니다.', confidence: 58 },
  { suggestion: '초반 강세 정글러를 선택하세요', reason: '초반 갱킹 압박으로 라인전 우위를 만들어낼 수 있습니다.', confidence: 60 },
  { suggestion: '상대 탑에 대한 카운터를 잡으세요', reason: '탑 라인전 우위는 리프트 헤럴드 확보로 이어집니다.', confidence: 55 },
  { suggestion: '팀파이트에서 범위 피해를 줄 수 있는 챔피언이 필요합니다', reason: '광역 딜이 부족하면 후반 팀파이트에서 불리합니다.', confidence: 58 },
  { suggestion: '디스인게이지 능력이 있는 챔피언을 고려하세요', reason: '상대의 무리한 진입을 차단할 수 있는 수단이 필요합니다.', confidence: 55 },
  { suggestion: '선수의 시그니처 챔피언을 선택하세요', reason: '높은 숙련도가 승률에 직접적으로 영향을 미칩니다.', confidence: 65 },
];

void FALLBACK_BAN_ADVICE;
void FALLBACK_PICK_ADVICE;

export async function generateDraftAdvice(context: {
  phase: 'ban' | 'pick';
  turn: number;
  myTeam: string;
  opponentTeam: string;
  myBans: string[];
  opponentBans: string[];
  myPicks: string[];
  opponentPicks: string[];
  recommendedBans?: string[];
}): Promise<DraftAdvice> {
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      const prompt = `당신은 LoL e스포츠 전문 드래프트 분석가입니다.

현재 드래프트 상황:
- 페이즈: ${context.phase === 'ban' ? '밴' : '픽'} (${context.turn}번째)
- 우리 팀: ${context.myTeam}
- 상대 팀: ${context.opponentTeam}
- 우리 밴: [${context.myBans.join(', ')}]
- 상대 밴: [${context.opponentBans.join(', ')}]
- 우리 픽: [${context.myPicks.join(', ')}]
- 상대 픽: [${context.opponentPicks.join(', ')}]
${context.recommendedBans ? `- 분석 기반 추천밴: [${context.recommendedBans.join(', ')}]` : ''}

전략적으로 최선의 ${context.phase === 'ban' ? '밴' : '픽'} 조언을 해주세요.
JSON 형식: {"suggestion": "구체적 조언 (30자 이내)", "reason": "이유 (50자 이내)", "confidence": 0-100}`;

      const augmented = await safeAugment(prompt, '드래프트 밴픽');
      return await chatWithLlmJson<DraftAdvice>(augmented, { schema: draftAdviceSchema });
    } catch {
      // AI 실패 -> 폴백
    }
  }

  // 폴백
  if (context.phase === 'ban' && context.recommendedBans && context.recommendedBans.length > 0) {
    const target = context.recommendedBans.find(b => !context.myBans.includes(b) && !context.opponentBans.includes(b));
    if (target) {
      return {
        suggestion: `${target}을(를) 밴하세요`,
        reason: '분석 데이터 기반 추천 밴 대상입니다.',
        confidence: 70,
      };
    }
  }

  const pool = context.phase === 'ban' ? FALLBACK_BAN_ADVICE_ASSETS : FALLBACK_PICK_ADVICE_ASSETS;
  return pickRandom(pool);
}

// ─────────────────────────────────────────
// 3. 전술 제안 (Tactical Suggestion)
// ─────────────────────────────────────────

export interface TacticalSuggestion {
  suggestion: string;
  reason: string;
  expectedEffect: string;
}

const tacticalSuggestionSchema = z.object({
  suggestion: z.string().min(1).max(120),
  reason: z.string().min(1).max(220),
  expectedEffect: z.string().min(1).max(120),
});

const FALLBACK_TACTICAL_BY_PHASE: Record<string, readonly TacticalSuggestion[]> = {
  early_game: [
    { suggestion: '초반 어그로 전략을 권장합니다', reason: '상대의 초반 라인전이 약한 것으로 파악됩니다.', expectedEffect: '라인전 승률 +15%' },
    { suggestion: '정글 침투를 통한 압박을 추천합니다', reason: '상대 정글러의 동선 예측이 가능합니다.', expectedEffect: '정글 격차 +15%' },
    { suggestion: '봇 다이브 전략을 준비하세요', reason: '봇 레인 2:2 상황에서 유리합니다.', expectedEffect: '봇 라인 킬 확률 +25%' },
    { suggestion: '레벨 1 인베이드를 고려하세요', reason: '우리 팀 레벨 1 전투력이 상대보다 강합니다.', expectedEffect: '적 버프 탈취 확률 +40%' },
    { suggestion: '탑-정글 시너지로 리프트 헤럴드를 선점하세요', reason: '헤럴드는 초반 타워 플레이팅 골드에 결정적입니다.', expectedEffect: '헤럴드 확보율 +30%' },
    { suggestion: '미드 로밍을 적극 활용하세요', reason: '미드라이너의 로밍 능력이 뛰어납니다.', expectedEffect: '사이드 레인 킬 관여율 +20%' },
    { suggestion: '라인 스왑으로 불리한 매치업을 회피하세요', reason: '특정 라인에서 카운터 매치업이 예상됩니다.', expectedEffect: '라인전 CS 격차 완화' },
    { suggestion: '초반 와드 배치로 적 정글 동선을 파악하세요', reason: '시야 장악이 갱킹 대응의 핵심입니다.', expectedEffect: '갱킹 회피율 +25%' },
  ],
  mid_game: [
    { suggestion: '오브젝트 중심 운영을 추천합니다', reason: '드래곤, 바론 등 오브젝트 확보가 승리의 열쇠입니다.', expectedEffect: '오브젝트 확보율 +20%' },
    { suggestion: '스플릿 푸시 전략을 고려해보세요', reason: '탑라이너의 1:1 능력이 뛰어납니다.', expectedEffect: '맵 압박력 +20%' },
    { suggestion: '비전 컨트롤에 더 투자하세요', reason: '시야 장악이 오브젝트 싸움의 핵심입니다.', expectedEffect: '시야 점수 +30%' },
    { suggestion: '로밍 위주 전략을 추천합니다', reason: '미드라이너의 로밍 능력이 뛰어납니다.', expectedEffect: '사이드 레인 킬 관여율 +20%' },
    { suggestion: '드래곤 소울을 위해 봇 사이드 장악에 집중하세요', reason: '소울 확보는 후반 팀파이트에서 결정적인 차이를 만듭니다.', expectedEffect: '드래곤 확보율 +25%' },
    { suggestion: '교전을 유도하는 맵 운영을 하세요', reason: '우리 팀 조합이 교전에서 유리합니다.', expectedEffect: '중반 팀파이트 승률 +20%' },
    { suggestion: '상대의 스플릿에 대응할 수 있는 매칭을 세우세요', reason: '1:1 대응이 안 되면 맵 운영이 무너집니다.', expectedEffect: '사이드 라인 관리 안정화' },
    { suggestion: '타워 다이브 타이밍을 노리세요', reason: '상대 사이드 라인이 고립된 상황에서 수적 우위를 활용하세요.', expectedEffect: '타워 다이브 성공률 +20%' },
    { suggestion: '바론 미끼 전략을 사용하세요', reason: '바론에 관심을 끌면서 상대를 유인한 뒤 반격하세요.', expectedEffect: '팀파이트 유리한 지형 확보' },
  ],
  late_game: [
    { suggestion: '후반 스케일링 전략으로 가세요', reason: '팀 구성상 후반에 유리한 조합입니다.', expectedEffect: '후반 팀파이트 승률 +25%' },
    { suggestion: '다이브 컴프 운영을 권장합니다', reason: '이니시에이터가 강력한 팀 구성입니다.', expectedEffect: '팀파이트 승률 +20%' },
    { suggestion: '교전을 피하고 파밍에 집중하세요', reason: '현재 교전 능력이 상대보다 불리합니다.', expectedEffect: '평균 CS +15' },
    { suggestion: '엘더 드래곤 확보를 최우선으로 하세요', reason: '엘더 버프는 후반 팀파이트의 승패를 가릅니다.', expectedEffect: '엘더 확보 시 승률 +40%' },
    { suggestion: '바론 이후 빠른 공성으로 게임을 끝내세요', reason: '바론 버프 시간을 최대한 활용해야 합니다.', expectedEffect: '바론 버프 활용 효율 +30%' },
    { suggestion: '넥서스까지 밀 수 있는 타이밍을 잡으세요', reason: '후반에는 한 번의 에이스로 게임이 끝날 수 있습니다.', expectedEffect: '게임 마무리 결정력 +25%' },
    { suggestion: '상대 핵심 딜러 처치를 최우선 목표로 설정하세요', reason: '후반에는 딜러 하나의 부재가 팀파이트를 결정짓습니다.', expectedEffect: '타겟 집중 효율 +20%' },
    { suggestion: '수비적으로 플레이하면서 실수를 기다리세요', reason: '후반에는 한 번의 실수가 치명적입니다. 인내심이 필요합니다.', expectedEffect: '역전 확률 +15%' },
  ],
};

const FALLBACK_TACTICAL_SUGGESTIONS: readonly TacticalSuggestion[] = [
  ...FALLBACK_TACTICAL_BY_PHASE.early_game,
  ...FALLBACK_TACTICAL_BY_PHASE.mid_game,
  ...FALLBACK_TACTICAL_BY_PHASE.late_game,
];

export async function generateTacticalSuggestion(context: {
  teamName: string;
  opponentName: string;
  recentScrimFeedback?: { laning: number; teamfight: number; objective: number };
  currentTactics?: string;
  teamStrength: string;
  opponentWeakness?: string;
}): Promise<TacticalSuggestion> {
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      const prompt = `당신은 LoL e스포츠 전략 코치입니다.

팀 정보:
- 우리 팀: ${context.teamName}
- 상대 팀: ${context.opponentName}
- 팀 강점: ${context.teamStrength}
${context.opponentWeakness ? `- 상대 약점: ${context.opponentWeakness}` : ''}
${context.currentTactics ? `- 현재 전술: ${context.currentTactics}` : ''}
${context.recentScrimFeedback ? `- 스크림 피드백: 라인전 ${context.recentScrimFeedback.laning}/100, 팀파이트 ${context.recentScrimFeedback.teamfight}/100, 오브젝트 ${context.recentScrimFeedback.objective}/100` : ''}

다음 경기를 위한 전술 제안을 하세요.
JSON 형식: {"suggestion": "전술 제안 (30자 이내)", "reason": "이유 (50자 이내)", "expectedEffect": "예상 효과 (20자 이내)"}`;

      const augmented = await safeAugment(prompt, `전략 전술 ${context.opponentName}`);
      return await chatWithLlmJson<TacticalSuggestion>(augmented, { schema: tacticalSuggestionSchema });
    } catch {
      // AI 실패 -> 폴백
    }
  }

  // 폴백: 스크림 피드백 기반
  if (context.recentScrimFeedback) {
    const { laning, teamfight, objective } = context.recentScrimFeedback;
    if (laning < 50) {
      return pickRandom([
        { suggestion: '라인전 훈련을 강화하세요', reason: '최근 스크림에서 라인전 수행이 부족했습니다.', expectedEffect: '라인전 승률 개선' },
        { suggestion: '안전한 라인전 운영에 집중하세요', reason: '무리한 교전보다 CS 관리가 우선입니다.', expectedEffect: 'CS 격차 감소' },
        { suggestion: '정글의 라인전 지원을 늘리세요', reason: '라이너의 부담을 줄여줄 정글 케어가 필요합니다.', expectedEffect: '라인전 안정화' },
      ]);
    }
    if (teamfight < 50) {
      return pickRandom([
        { suggestion: '팀파이트 연습에 집중하세요', reason: '최근 스크림에서 팀파이트 패배가 잦았습니다.', expectedEffect: '팀파이트 승률 개선' },
        { suggestion: '이니시에이션 타이밍 연습이 필요합니다', reason: '한타 진입 타이밍이 불안정했습니다.', expectedEffect: '한타 개시 성공률 향상' },
        { suggestion: '포지셔닝 훈련을 강화하세요', reason: '딜러의 팀파이트 생존율이 낮았습니다.', expectedEffect: '딜러 생존율 개선' },
      ]);
    }
    if (objective < 50) {
      return pickRandom([
        { suggestion: '오브젝트 컨트롤 훈련을 권장합니다', reason: '최근 스크림에서 오브젝트 확보율이 낮았습니다.', expectedEffect: '오브젝트 확보율 개선' },
        { suggestion: '드래곤/바론 주변 시야 관리를 강화하세요', reason: '오브젝트 싸움 전 시야 준비가 부족했습니다.', expectedEffect: '시야 점수 향상' },
        { suggestion: '스마이트 싸움 연습이 필요합니다', reason: '50 대 50 상황에서의 스마이트 정확도가 낮았습니다.', expectedEffect: '스틸 방지율 개선' },
      ]);
    }
  }

  // 팀 강점 기반 매칭
  const strength = context.teamStrength.toLowerCase();
  if (strength.includes('라인전') || strength.includes('초반')) {
    return pickRandom(FALLBACK_TACTICAL_BY_PHASE.early_game);
  }
  if (strength.includes('팀파이트') || strength.includes('한타')) {
    return pickRandom(FALLBACK_TACTICAL_BY_PHASE.late_game);
  }
  if (strength.includes('오브젝트') || strength.includes('운영')) {
    return pickRandom(FALLBACK_TACTICAL_BY_PHASE.mid_game);
  }

  return pickRandom(FALLBACK_TACTICAL_SUGGESTIONS);
}

// ─────────────────────────────────────────
// 4. 뉴스 기사 생성 (News Article)
// ─────────────────────────────────────────

export interface GeneratedNewsArticle {
  title: string;
  content: string;
  category: 'match' | 'transfer' | 'team' | 'scandal' | 'analysis';
}

const generatedNewsArticleSchema = z.object({
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(600),
  category: z.enum(['match', 'transfer', 'team', 'scandal', 'analysis']),
});

const FALLBACK_NEWS_TEMPLATES: Record<string, readonly { title: string; content: string; category: GeneratedNewsArticle['category'] }[]> = {
  match_result: [
    { title: '{team1}, {team2} 꺾고 승리', content: '{team1}이(가) {team2}를 상대로 인상적인 경기력을 보여주며 승리를 거두었다. {player}의 활약이 돋보인 경기였다.', category: 'match' },
    { title: '{team1} vs {team2}, 명승부 끝에 결판', content: '양 팀이 치열한 접전을 벌인 끝에 {team1}이(가) 마지막 팀파이트에서 승리하며 경기를 가져갔다.', category: 'match' },
    { title: '{team1}, 완벽한 경기 운영으로 승리', content: '{team1}이(가) 초반부터 후반까지 완벽한 경기 운영을 선보이며 {team2}를 압도했다.', category: 'match' },
    { title: '압도적! {team1}, {team2} 상대 대승', content: '{team1}이(가) {team2}를 상대로 전 라인에서 우위를 점하며 압도적인 승리를 거두었다. 코칭스태프의 준비가 빛났다.', category: 'match' },
    { title: '{team1}, {team2}전 진땀 승리... 아쉬움도', content: '{team1}이(가) {team2}를 꺾었지만 중반 운영에서 아쉬운 부분이 노출되었다. 다음 경기 전 보완이 필요해 보인다.', category: 'match' },
    { title: '{player} 캐리! {team1}, {team2} 격파', content: '{player}의 MVP급 활약에 힘입어 {team1}이(가) {team2}를 격파했다. 이번 시즌 최고의 경기력이라는 평가가 나온다.', category: 'match' },
    { title: '{team1}, {team2}에 충격 패배', content: '{team1}이(가) {team2}에 예상 밖 패배를 당했다. 드래프트 단계부터 불리했다는 분석이 지배적이다.', category: 'match' },
    { title: '{team1} vs {team2}, 풀세트 혈전 끝 승자는', content: '{team1}과(와) {team2}의 시리즈가 풀세트까지 갔다. 치열한 접전 끝에 결정적 한타에서 승부가 갈렸다.', category: 'match' },
  ],
  transfer: [
    { title: '{player}, {team1}으로 이적 확정', content: '{player} 선수가 {team1}과(와) 계약을 체결하며 새 시즌을 함께하게 되었다. 해당 포지션 보강이 절실했던 {team1}에게 희소식이다.', category: 'transfer' },
    { title: '{team1}, {player} 영입 발표', content: '{team1}이(가) {player} 선수의 영입을 공식 발표했다. 팬들의 기대가 높아지고 있다.', category: 'transfer' },
    { title: '이적 시장 빅딜! {player} 거취 확정', content: '이적 시장의 최대 관심사였던 {player} 선수의 행선지가 {team1}으로 최종 결정되었다.', category: 'transfer' },
    { title: '전격! {player}, {team1} 행 결정', content: '{player} 선수가 복수의 팀 중 {team1}을(를) 선택했다. 연봉보다 팀의 비전과 우승 가능성을 중시한 것으로 알려졌다.', category: 'transfer' },
    { title: '{team1}, {player} 영입으로 로스터 완성', content: '{team1}이(가) {player}를 마지막 퍼즐로 영입하며 시즌 로스터를 완성했다. 리그 판도에 영향을 미칠 전망이다.', category: 'transfer' },
    { title: '{player} 자유 계약, 어디로?', content: '{player} 선수가 자유 계약 상태가 되면서 이적 시장이 술렁이고 있다. 다수의 LCK 팀이 관심을 보이고 있다.', category: 'transfer' },
    { title: '{team1}, 이적 시장에서 공격적 영입 나서', content: '{team1}이(가) 올 오프시즌 적극적인 영입 행보를 보이고 있다. {player}를 시작으로 추가 보강도 예상된다.', category: 'transfer' },
    { title: '깜짝 이적! {player}, {team1}으로 전격 이동', content: '예상하지 못했던 {player}의 이적이 전격적으로 성사되었다. 업계 관계자들도 놀라움을 감추지 못하고 있다.', category: 'transfer' },
  ],
  injury: [
    { title: '{player}, 부상으로 결장 확정', content: '{team1}의 {player} 선수가 부상으로 인해 당분간 경기에 출전하지 못하게 되었다. 팀에 큰 타격이 예상된다.', category: 'team' },
    { title: '{team1}, {player} 부상 소식에 비상', content: '{player} 선수의 부상 소식이 전해지면서 {team1}의 로스터 운영에 빨간불이 켜졌다.', category: 'team' },
    { title: '{player} 부상 여파... {team1} 대체 선수 투입', content: '{team1}이(가) {player} 선수의 부상으로 인해 대체 선수를 긴급 투입할 예정이다.', category: 'team' },
    { title: '{player} 손목 통증 호소... {team1} 조심스러운 관리', content: '{team1}의 {player} 선수가 손목 통증을 호소해 팀이 컨디션 관리에 들어갔다. 경미한 증상이라 큰 걱정은 없다고 밝혔다.', category: 'team' },
    { title: '{player}, 건강 이유로 일시적 휴식', content: '{player} 선수가 건강 관리를 위해 단기 휴식에 들어갔다. {team1}은 복귀 시기는 미정이라고 전했다.', category: 'team' },
    { title: '{team1}, {player} 부상 복귀 청신호', content: '{player} 선수의 재활이 순조롭게 진행되고 있다. 빠르면 다음 주 팀 합류가 가능할 것으로 보인다.', category: 'team' },
    { title: '{player} 허리 부상 진단... {team1} 비상 대비', content: '{team1}의 핵심 선수 {player}가 허리 부상 진단을 받았다. 장기 결장 가능성도 있어 팀이 대비에 나섰다.', category: 'team' },
    { title: '{player} 수술 성공, 재활 돌입', content: '{player} 선수의 수술이 성공적으로 마무리되었다. {team1}은 무리 없는 복귀를 위해 충분한 재활 기간을 줄 계획이다.', category: 'team' },
  ],
  milestone: [
    { title: '{player}, 통산 {detail} 달성', content: '{team1}의 {player} 선수가 뜻깊은 기록을 달성했다. 꾸준한 활약이 만들어낸 대기록이다.', category: 'analysis' },
    { title: '대기록 달성! {player}의 역사적인 순간', content: '{player} 선수가 LCK 역사에 이름을 새기는 기록을 세웠다. 팬들과 동료 선수들의 축하가 이어지고 있다.', category: 'analysis' },
    { title: '{player}, 새 이정표를 세우다', content: '{player} 선수가 또 하나의 이정표를 달성하며 자신의 커리어를 빛냈다. {team1} 팬들이 열광하고 있다.', category: 'analysis' },
    { title: '{player}, LCK 통산 {detail}... 역대 최초', content: 'LCK 역사상 최초로 {player} 선수가 통산 {detail}을(를) 달성했다. 경기 후 팀원들이 축하 세리머니를 펼쳤다.', category: 'analysis' },
    { title: '{team1}의 {player}, 개인 통산 기록 갱신', content: '{player} 선수가 자신의 커리어 기록을 경신했다. 아직 전성기가 끝나지 않았음을 증명하는 순간이었다.', category: 'analysis' },
    { title: '{player}, 이번 시즌 {detail} 기록 돌파', content: '이번 시즌 가장 인상적인 성적을 보이고 있는 {player} 선수가 {detail} 기록을 돌파했다. MVP 후보로서의 입지를 굳혔다.', category: 'analysis' },
    { title: '레전드의 반열에! {player}, {detail} 달성', content: '{player} 선수가 레전드급 기록인 {detail}을(를) 달성했다. {team1}의 프랜차이즈 역사에 길이 남을 순간이다.', category: 'analysis' },
    { title: '{player}, 통산 {detail}... 팬들의 축하 세례', content: '기록의 사나이 {player}가 또 한 번 역사를 썼다. SNS에는 축하 메시지가 쏟아지고 있다.', category: 'analysis' },
  ],
  scandal: [
    { title: '{team1}, 논란에 휩싸이다', content: '{team1}을(를) 둘러싼 논란이 커뮤니티에서 뜨거운 감자로 떠올랐다. 팀 측은 아직 공식 입장을 내놓지 않고 있다.', category: 'scandal' },
    { title: '{player} 관련 논란... 팬들 분노', content: '{player} 선수와 관련된 논란이 불거지면서 팬들의 실망감이 커지고 있다. {team1}의 대응이 주목된다.', category: 'scandal' },
    { title: 'e스포츠 업계 논란, {team1} 해명 요구 쏟아져', content: '{team1}이(가) 최근 논란에 대해 팬들과 미디어로부터 해명 요구를 받고 있다. 팀의 공식 입장 발표가 임박한 것으로 알려졌다.', category: 'scandal' },
    { title: '{team1}, 내부 갈등설 부인', content: '{team1}이(가) 최근 불거진 팀 내부 갈등설에 대해 공식 부인했다. 하지만 커뮤니티에서는 여전히 의혹이 이어지고 있다.', category: 'scandal' },
    { title: '{player} 관련 루머 확산... {team1} 진화에 나서', content: '{player} 선수를 둘러싼 근거 없는 루머가 확산되면서 {team1}이 적극적인 진화에 나섰다. 법적 대응도 검토 중인 것으로 알려졌다.', category: 'scandal' },
    { title: '{team1} 스태프 교체 논란', content: '{team1}의 갑작스러운 코칭스태프 교체가 논란을 낳고 있다. 시즌 중 교체는 팀 안정성에 영향을 미칠 수 있다는 우려가 나온다.', category: 'scandal' },
    { title: 'SNS 발언 논란, {player}에 비난 쏟아져', content: '{player} 선수의 SNS 발언이 논란을 일으키며 비난 여론이 형성되었다. {team1}이 해당 선수와 면담을 진행한 것으로 알려졌다.', category: 'scandal' },
    { title: '{team1}, 승부 조작 의혹에 강력 부인', content: '{team1}을 둘러싼 승부 조작 의혹이 제기되었으나, 팀은 즉각 강력 부인했다. 리그 사무국도 조사에 착수할 예정이다.', category: 'scandal' },
  ],
};

void FALLBACK_NEWS_TEMPLATES;

export async function generateNewsArticle(context: {
  eventType: 'match_result' | 'transfer' | 'injury' | 'milestone' | 'scandal';
  details: string;
  teamNames: string[];
  playerNames: string[];
}): Promise<GeneratedNewsArticle> {
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      const prompt = `당신은 LoL e스포츠 전문 기자입니다. 뉴스 기사를 작성하세요.

이벤트 유형: ${context.eventType}
상세 내용: ${context.details}
관련 팀: ${context.teamNames.join(', ')}
관련 선수: ${context.playerNames.join(', ')}

한국 e스포츠 뉴스 스타일로 작성하세요.
JSON 형식: {"title": "기사 제목 (25자 이내)", "content": "기사 본문 (200자 이내)", "category": "match|transfer|team|scandal|analysis"}`;

      const augmented = await safeAugment(prompt, `${context.eventType} ${context.details}`);
      return await chatWithLlmJson<GeneratedNewsArticle>(augmented, { schema: generatedNewsArticleSchema });
    } catch {
      // AI 실패 -> 폴백
    }
  }

  // 폴백: eventType별 템플릿
  const templates = GENERATED_NEWS_TEMPLATE_ASSETS[context.eventType] ?? GENERATED_NEWS_TEMPLATE_ASSETS.match_result;
  const template = pickRandom(templates);

  const team1 = context.teamNames[0] ?? '팀';
  const team2 = context.teamNames[1] ?? '상대팀';
  const player = context.playerNames[0] ?? '선수';

  return {
    title: fillTemplate(template.title, { team1, team2, player, detail: context.details }),
    content: fillTemplate(template.content, { team1, team2, player, detail: context.details }),
    category: template.category,
  };
}

// ─────────────────────────────────────────
// 5. 소셜 미디어 반응 (Social Reaction)
// ─────────────────────────────────────────

export interface SocialReaction {
  platform: string;
  username: string;
  comment: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  likes: number;
}

const socialReactionSchema = z.object({
  platform: z.string().min(1).max(40),
  username: z.string().min(1).max(40),
  comment: z.string().min(1).max(160),
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  likes: z.number().int().min(0).max(1000000),
});

const socialReactionsSchema = z.array(socialReactionSchema).min(1).max(20);

const RANDOM_USERNAMES = [
  '페이커팬123', '롤갤러', 'T1화이팅', '겐지믿어', 'DK응원단',
  'HLE최고', '디시롤갤', 'LoL마스터', '에펨코리아', '다이아장인',
  '브론즈탈출러', '챌린저지망생', '서폿장인', '탑갱커', '미드킹',
  '원딜캐리', '정글차이', '우리팀서폿', '시즌MVP', '결승가자',
  '롤드컵가즈아', '소나기소나', '공식계정아님', '전직프로', '해설지망생',
  'LCK팬', '인벤러', '아프리카롤', '트게더', 'OP.GG분석가',
  '그냥팬', 'e스포츠기자', '오늘도롤', '심야롤', '새벽겜러',
  '클템사랑', '미드갭', '하이리스크', '티어올리자', '캐리했다',
  '바론타이밍', '존잼각ㅋ', '드래곤장인', '뉴비입니다', '만렙유저',
  '한타마스터', '포지셔닝왕', '이니시장인', '갱킹요정', '시야장인',
  '15년롤팬', '피드러아님', '라인강자', '빌드장인', '전략가K',
  '관전러777', '패치분석러', '숨은고수', '매크로왕', '하드캐리',
] as const;

const PLATFORMS = ['커뮤니티', '트위터', '디시인사이드', '에펨코리아', '인벤', '유튜브 댓글', '트게더', 'X(트위터)', '네이버 스포츠'] as const;

const SOCIAL_TEMPLATES: Record<string, readonly { comment: string; sentiment: SocialReaction['sentiment'] }[]> = {
  win: [
    { comment: '와 진짜 미쳤다 ㅋㅋㅋ 오늘 경기 레전드', sentiment: 'positive' },
    { comment: '이 팀 진짜 요즘 폼 장난 아니네', sentiment: 'positive' },
    { comment: '역시 믿고 보는 팀이야', sentiment: 'positive' },
    { comment: '오늘 원딜 캐리 ㄹㅈㄷ', sentiment: 'positive' },
    { comment: '우리팀 화이팅!!! 결승까지 가자!!!', sentiment: 'positive' },
    { comment: '솔직히 상대가 너무 못한 거 아님?', sentiment: 'neutral' },
    { comment: '이겼지만 중반 운영은 좀 아쉬웠음', sentiment: 'neutral' },
    { comment: '이 기세 이어가면 우승 가능', sentiment: 'positive' },
    { comment: '미드 격차 실화냐 ㅋㅋ', sentiment: 'positive' },
    { comment: '오늘 서폿 로밍 타이밍 진짜 좋았음', sentiment: 'positive' },
    { comment: '팀파이트 이니시 타이밍 ㄹㅈㄷ 감독 전략 짱', sentiment: 'positive' },
    { comment: 'ㄱㅇㅇ 오늘 경기 개꿀잼', sentiment: 'positive' },
    { comment: '이러다 진짜 월즈 가겠다', sentiment: 'positive' },
    { comment: '경기력 올라가는 게 눈에 보임', sentiment: 'positive' },
    { comment: '상대팀 팬인데 인정할 건 인정함 gg', sentiment: 'neutral' },
    { comment: '정글이 오늘 진짜 맵 장악 잘했다', sentiment: 'positive' },
    { comment: '드래프트 차이가 컸음 ㅋㅋ 코칭스태프 유능', sentiment: 'positive' },
    { comment: '이 조합 답 없지 않냐 밴 안 한 상대가 잘못 ㅋ', sentiment: 'neutral' },
  ],
  loss: [
    { comment: '진짜 답이 없다... 뭘 해도 안 되네', sentiment: 'negative' },
    { comment: '오늘 드래프트 누가 짠 거야? 이해불가', sentiment: 'negative' },
    { comment: '팬이라 힘들다 진짜... 다음엔 잘하겠지', sentiment: 'negative' },
    { comment: '정글 차이가 너무 심했음', sentiment: 'negative' },
    { comment: '솔직히 감독 경질해야 하는 거 아님?', sentiment: 'negative' },
    { comment: '다음 경기는 좀 보여줬으면...', sentiment: 'neutral' },
    { comment: '상대가 잘한 거지 우리가 못한 건 아님', sentiment: 'neutral' },
    { comment: '로스터 변경 시급함 진심', sentiment: 'negative' },
    { comment: '아니 왜 거기서 바론을 가요...', sentiment: 'negative' },
    { comment: '오늘 경기 보다가 TV 끌 뻔 ㅋㅋ', sentiment: 'negative' },
    { comment: '하... 또 졌네 몇 연패야 이거', sentiment: 'negative' },
    { comment: '후반 운영이 왜 매번 이 모양이지', sentiment: 'negative' },
    { comment: '한타 진입 타이밍 도대체 왜 그런 건데', sentiment: 'negative' },
    { comment: '에이 그래도 초반은 좋았잖아... 맞지?', sentiment: 'neutral' },
    { comment: '다음 시즌 기대할게요... (눈물)', sentiment: 'negative' },
    { comment: '원딜 라인 CS 격차 봤냐... 답이 없다', sentiment: 'negative' },
    { comment: '패배 인터뷰 볼 때마다 맘이 아프네', sentiment: 'negative' },
    { comment: '솔직히 이번 경기는 준비 부족이 느껴졌음', sentiment: 'neutral' },
  ],
  transfer: [
    { comment: '대박 이 선수 오는 거야? 진짜?!', sentiment: 'positive' },
    { comment: '이적료가 얼마래? 오버페이 아님?', sentiment: 'neutral' },
    { comment: '드디어 제대로 된 보강이다!!!', sentiment: 'positive' },
    { comment: '솔직히 이 이적은 좀 이해 안 됨', sentiment: 'negative' },
    { comment: '이 선수면 충분히 우승 노릴 수 있음', sentiment: 'positive' },
    { comment: '기존 선수는 어떻게 되는 거지?', sentiment: 'neutral' },
    { comment: '와 프런트 일 좀 하네 ㅋㅋ', sentiment: 'positive' },
    { comment: '이적 시장 빅딜이네 역대급', sentiment: 'neutral' },
    { comment: '환영합니다! 같이 우승하자!!!', sentiment: 'positive' },
    { comment: '음... 글쎄 이 선수가 맞을까?', sentiment: 'neutral' },
    { comment: '돈이 있긴 하구나 ㅋㅋ', sentiment: 'neutral' },
    { comment: '이 선수 데려오느라 얼마나 공들였을까', sentiment: 'positive' },
    { comment: '로스터 완성이다! 이제 진짜 시작', sentiment: 'positive' },
    { comment: '피지컬이 좋은 선수니까 기대해도 될 듯', sentiment: 'positive' },
    { comment: '적응 기간이 좀 필요하겠지만 잠재력은 확실', sentiment: 'neutral' },
  ],
  scandal: [
    { comment: '이게 실화야? 충격인데...', sentiment: 'negative' },
    { comment: '공식 해명 빨리 나와야 할 듯', sentiment: 'neutral' },
    { comment: '팬으로서 너무 실망이다', sentiment: 'negative' },
    { comment: '좀 기다려보자 아직 확인 안 된 거잖아', sentiment: 'neutral' },
    { comment: '진짜면 답 없는 거고 거짓이면 유포자 처벌해야지', sentiment: 'neutral' },
    { comment: '아... 이래서 e스포츠가 ㅋㅋ', sentiment: 'negative' },
    { comment: '이 팀 이미지 어쩌려고 이러는 건지', sentiment: 'negative' },
    { comment: '선수 보호가 먼저 아닌가?', sentiment: 'neutral' },
    { comment: '커뮤니티 폭발했네 ㅋㅋ', sentiment: 'neutral' },
    { comment: '팬 탈퇴합니다 진심으로', sentiment: 'negative' },
    { comment: '루머일 수도 있으니 좀 냉정하게 보자', sentiment: 'neutral' },
    { comment: '구단 대응이 관건이다', sentiment: 'neutral' },
    { comment: '팀 공식 입장을 기다려봐야 할 듯', sentiment: 'neutral' },
    { comment: '이런 일이 반복되면 안 되는데...', sentiment: 'negative' },
  ],
};

export async function generateSocialReactions(context: {
  eventType: string;
  teamName: string;
  details: string;
  count?: number;
}): Promise<SocialReaction[]> {
  const count = context.count ?? 3;
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      const prompt = `당신은 한국 LoL e스포츠 커뮤니티의 팬들입니다.
다양한 플랫폼(디시인사이드, 에펨코리아, 트위터, 인벤 등)에서 반응을 보여주세요.

이벤트: ${context.eventType}
팀: ${context.teamName}
상세: ${context.details}

한국 인터넷 커뮤니티 문화를 반영하여 ${count}개의 반응을 생성하세요.
반응은 긍정/부정/중립이 섞여야 합니다. ㅋㅋ, ㄹㅈㄷ 같은 인터넷 용어도 자연스럽게 사용하세요.
JSON 형식: [{"platform": "플랫폼명", "username": "닉네임", "comment": "댓글 (50자 이내)", "sentiment": "positive|negative|neutral", "likes": 숫자}]`;

      const augmented = await safeAugment(prompt, `${context.eventType} ${context.teamName}`);
      return await chatWithLlmJson<SocialReaction[]>(augmented, { schema: socialReactionsSchema });
    } catch {
      // AI 실패 -> 폴백
    }
  }

  // 폴백: 템플릿 기반
  const eventKey = context.eventType in SOCIAL_TEMPLATES ? context.eventType : 'win';
  const templates = SOCIAL_TEMPLATES[eventKey];
  const selected = pickRandomN(templates, count);

  return selected.map((t) => ({
    platform: pickRandom(PLATFORMS),
    username: pickRandom(RANDOM_USERNAMES),
    comment: t.comment,
    sentiment: t.sentiment,
    likes: randomInt(1, 500),
  }));
}

// ─────────────────────────────────────────
// 6. 스카우팅 리포트 (Scouting Report)
// ─────────────────────────────────────────

export interface ScoutingReport {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
}

const scoutingReportSchema = z.object({
  summary: z.string().min(1).max(180),
  strengths: z.array(z.string().min(1).max(80)).min(1).max(5),
  weaknesses: z.array(z.string().min(1).max(80)).min(1).max(5),
  recommendation: z.string().min(1).max(120),
});

const POSITION_KR: Record<string, string> = {
  top: '탑라이너',
  jungle: '정글러',
  mid: '미드라이너',
  adc: '원딜',
  support: '서포터',
};

function generateFallbackScoutingReport(context: {
  playerName: string;
  position: string;
  age: number;
  ovr: number;
  potential: number;
  stats: { mechanical: number; gameSense: number; teamwork: number; consistency: number; laning: number; aggression: number };
  personality?: { ambition: number; professionalism: number; temperament: number };
  recentKda?: number;
  soloRankTier?: string;
}): ScoutingReport {
  const posKr = POSITION_KR[context.position] ?? context.position;
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // 스탯 기반 강점 분석
  if (context.stats.mechanical >= 75) strengths.push('뛰어난 메카닉 실력');
  if (context.stats.gameSense >= 75) strengths.push('높은 게임 센스');
  if (context.stats.teamwork >= 75) strengths.push('좋은 팀워크');
  if (context.stats.consistency >= 75) strengths.push('안정적인 퍼포먼스');
  if (context.stats.laning >= 75) strengths.push('강력한 라인전');
  if (context.stats.aggression >= 75) strengths.push('공격적인 플레이 스타일');

  // 스탯 기반 약점 분석
  if (context.stats.mechanical < 55) weaknesses.push('메카닉 보완 필요');
  if (context.stats.gameSense < 55) weaknesses.push('게임 이해도 부족');
  if (context.stats.teamwork < 55) weaknesses.push('팀파이트 참여율 낮음');
  if (context.stats.consistency < 55) weaknesses.push('일관성 부족');
  if (context.stats.laning < 55) weaknesses.push('라인전 취약');
  if (context.stats.aggression < 40) weaknesses.push('소극적인 플레이');

  // 성격 기반 분석
  if (context.personality) {
    if (context.personality.ambition >= 75) strengths.push('높은 성장 의지');
    if (context.personality.professionalism >= 75) strengths.push('프로 의식 투철');
    if (context.personality.temperament < 40) weaknesses.push('멘탈 관리 필요');
    if (context.personality.professionalism < 40) weaknesses.push('프로 의식 부족');
  }

  // 기본값 보장
  if (strengths.length === 0) strengths.push('성장 가능성 있음');
  if (weaknesses.length === 0) weaknesses.push('특별한 약점 없음');

  // OVR 기반 등급
  let grade: string;
  if (context.ovr >= 90) grade = 'S';
  else if (context.ovr >= 80) grade = 'A';
  else if (context.ovr >= 70) grade = 'B+';
  else if (context.ovr >= 60) grade = 'B';
  else if (context.ovr >= 50) grade = 'C';
  else grade = 'D';

  // 잠재력 기반 추천
  let recText: string;
  const potentialGap = context.potential - context.ovr;
  if (grade === 'S' || grade === 'A') {
    recText = `${grade} 등급 — 즉시 전력감`;
  } else if (potentialGap >= 15 && context.age <= 21) {
    recText = `${grade} 등급 — 육성 가치 매우 높음`;
  } else if (potentialGap >= 10) {
    recText = `${grade} 등급 — 육성 가치 있음`;
  } else {
    recText = `${grade} 등급 — 현재 능력치 기준 평가`;
  }

  // 서머리 생성
  const style = context.stats.aggression >= 65 ? '공격적인' : context.stats.aggression >= 40 ? '균형 잡힌' : '안정적인';
  const potential = context.potential >= 85 ? '최상위 잠재력을 가진' : context.potential >= 70 ? '유망한' : '';
  const summary = `${style} 플레이 스타일의 ${potential ? potential + ' ' : ''}${posKr}`;

  return {
    summary: `${summary} (OVR ${context.ovr})`,
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4),
    recommendation: recText,
  };
}

export async function generateScoutingReport(context: {
  playerName: string;
  position: string;
  age: number;
  ovr: number;
  potential: number;
  stats: { mechanical: number; gameSense: number; teamwork: number; consistency: number; laning: number; aggression: number };
  personality?: { ambition: number; professionalism: number; temperament: number };
  recentKda?: number;
  soloRankTier?: string;
}): Promise<ScoutingReport> {
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      const posKr = POSITION_KR[context.position] ?? context.position;
      const prompt = `당신은 LoL e스포츠 전문 스카우터입니다. 선수 분석 리포트를 작성하세요.

선수 정보:
- 이름: ${context.playerName}
- 포지션: ${posKr}
- 나이: ${context.age}세
- OVR: ${context.ovr} / 잠재력: ${context.potential}
- 스탯: 메카닉 ${context.stats.mechanical}, 게임센스 ${context.stats.gameSense}, 팀워크 ${context.stats.teamwork}, 일관성 ${context.stats.consistency}, 라인전 ${context.stats.laning}, 공격성 ${context.stats.aggression}
${context.personality ? `- 성격: 야망 ${context.personality.ambition}, 프로의식 ${context.personality.professionalism}, 기질 ${context.personality.temperament}` : ''}
${context.recentKda ? `- 최근 KDA: ${context.recentKda}` : ''}
${context.soloRankTier ? `- 솔로랭크: ${context.soloRankTier}` : ''}

프로 스카우팅 리포트를 작성하세요.
JSON 형식: {"summary": "한 줄 요약 (40자 이내)", "strengths": ["강점1", "강점2", "강점3"], "weaknesses": ["약점1", "약점2"], "recommendation": "등급 및 추천 (30자 이내)"}`;

      const augmented = await safeAugment(prompt, `${context.position} 스카우팅`);
      return await chatWithLlmJson<ScoutingReport>(augmented, { schema: scoutingReportSchema });
    } catch {
      // AI 실패 -> 폴백
    }
  }

  // 폴백: 스탯 기반 자동 평가
  return generateFallbackScoutingReport(context);
}

// ─────────────────────────────────────────
// 7. 일간 브리핑 (Daily Briefing)
// ─────────────────────────────────────────

export interface DailyBriefing {
  briefing: string;
  alerts: string[];
  advice: string[];
}

const dailyBriefingSchema = z.object({
  briefing: z.string().min(1).max(220),
  alerts: z.array(z.string().min(1).max(160)).max(5),
  advice: z.array(z.string().min(1).max(160)).min(1).max(5),
});

function generateFallbackDailyBriefing(context: {
  teamName: string;
  currentDate: string;
  nextOpponentName?: string;
  nextMatchDate?: string;
  teamMorale: number;
  injuredPlayers: string[];
  recentForm: string;
  lowSatisfactionPlayers: string[];
  activeConflicts: number;
  budgetStatus: string;
}): DailyBriefing {
  const alerts: string[] = [];
  const advice: string[] = [];

  // 부상자 알림
  if (context.injuredPlayers.length > 0) {
    alerts.push(`부상자 ${context.injuredPlayers.length}명: ${context.injuredPlayers.join(', ')}. 대체 선수 운영을 확인하세요.`);
  }

  // 갈등 알림
  if (context.activeConflicts > 0) {
    alerts.push(`팀 내 갈등 ${context.activeConflicts}건 진행 중. 방치하면 팀 사기에 악영향을 미칩니다.`);
  }

  // 만족도 낮은 선수 알림
  if (context.lowSatisfactionPlayers.length > 0) {
    alerts.push(`만족도 낮은 선수: ${context.lowSatisfactionPlayers.join(', ')}. 면담을 통해 원인을 파악하세요.`);
  }

  // 예산 상태 알림
  if (context.budgetStatus === '부족') {
    alerts.push('팀 예산이 부족합니다. 불필요한 지출을 줄이고 스폰서 계약을 검토하세요.');
  } else if (context.budgetStatus === '위험') {
    alerts.push('예산 상태가 위험 수준입니다. 긴급 재정 점검이 필요합니다.');
  }

  // 사기 관련 조언
  if (context.teamMorale < 30) {
    advice.push('팀 사기가 매우 낮습니다. 즉시 팀 빌딩 활동이나 휴식일 지정을 추천합니다.');
  } else if (context.teamMorale < 50) {
    advice.push('팀 사기가 낮습니다. 선수 개별 면담을 통해 불만을 해소하세요.');
  } else if (context.teamMorale >= 80) {
    advice.push('팀 사기가 매우 높습니다! 이 분위기를 유지하며 고강도 훈련을 진행할 좋은 시기입니다.');
  }

  // 다음 경기 임박 조언
  if (context.nextOpponentName && context.nextMatchDate) {
    const daysUntilMatch = Math.floor(
      (new Date(context.nextMatchDate).getTime() - new Date(context.currentDate).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysUntilMatch <= 0) {
      advice.push(`오늘 ${context.nextOpponentName}전이 예정되어 있습니다! 최종 전략 점검과 선수 컨디션을 확인하세요.`);
    } else if (daysUntilMatch === 1) {
      advice.push(`내일 ${context.nextOpponentName}전입니다. 오늘은 가벼운 훈련과 멘탈 관리에 집중하세요.`);
    } else if (daysUntilMatch <= 3) {
      advice.push(`${context.nextOpponentName}전이 ${daysUntilMatch}일 후입니다. 상대 분석 자료를 점검하고 전략을 확정하세요.`);
    }
  }

  // 최근 성적 기반 조언
  if (context.recentForm.includes('0승') || context.recentForm.includes('연패')) {
    advice.push('연패가 이어지고 있습니다. 전술 변경과 함께 선수들의 자신감 회복에 집중하세요.');
  } else if (context.recentForm.includes('연승')) {
    advice.push('연승 중입니다! 자만하지 않도록 긴장감을 유지하면서 좋은 훈련 루틴을 계속하세요.');
  }

  // 부상자 + 경기 임박 복합 조언
  if (context.injuredPlayers.length > 0 && context.nextOpponentName) {
    advice.push(`부상자를 고려한 ${context.nextOpponentName}전 로스터 편성을 미리 확정하세요.`);
  }

  // 기본 조언 보장
  if (advice.length === 0) {
    advice.push('현재 팀 상태가 양호합니다. 꾸준한 훈련과 스크림 일정을 유지하세요.');
  }

  // 브리핑 생성
  const moraleDesc = context.teamMorale >= 70 ? '양호' : context.teamMorale >= 40 ? '보통' : '낮음';
  const briefingParts: string[] = [`${context.teamName} 일간 보고 (${context.currentDate}).`];
  briefingParts.push(`최근 전적: ${context.recentForm}.`);
  if (context.nextOpponentName) {
    briefingParts.push(`다음 상대: ${context.nextOpponentName}.`);
  }
  briefingParts.push(`팀 사기: ${context.teamMorale}점(${moraleDesc}).`);
  if (context.injuredPlayers.length > 0) {
    briefingParts.push(`부상자 ${context.injuredPlayers.length}명.`);
  }
  if (context.activeConflicts > 0) {
    briefingParts.push(`활성 갈등 ${context.activeConflicts}건.`);
  }

  return {
    briefing: briefingParts.join(' ').slice(0, 150),
    alerts,
    advice,
  };
}

export async function generateDailyBriefing(context: {
  teamName: string;
  currentDate: string;
  nextOpponentName?: string;
  nextMatchDate?: string;
  teamMorale: number;
  injuredPlayers: string[];
  recentForm: string;
  lowSatisfactionPlayers: string[];
  activeConflicts: number;
  budgetStatus: string;
}): Promise<DailyBriefing> {
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      const prompt = `당신은 LoL 프로팀의 참모입니다. 오늘의 브리핑을 작성하세요.

팀 상황:
- 팀명: ${context.teamName}
- 날짜: ${context.currentDate}
- 팀 사기: ${context.teamMorale}/100
- 최근 전적: ${context.recentForm}
- 부상자: ${context.injuredPlayers.length > 0 ? context.injuredPlayers.join(', ') : '없음'}
- 만족도 낮은 선수: ${context.lowSatisfactionPlayers.length > 0 ? context.lowSatisfactionPlayers.join(', ') : '없음'}
- 활성 갈등: ${context.activeConflicts}건
- 예산 상태: ${context.budgetStatus}
${context.nextOpponentName ? `- 다음 상대: ${context.nextOpponentName} (${context.nextMatchDate})` : '- 예정된 경기 없음'}

간결하고 실용적인 브리핑을 작성하세요.
JSON 형식: {"briefing": "일간 요약 (100자 이내)", "alerts": ["주의사항1", "주의사항2"], "advice": ["조언1", "조언2"]}`;

      const augmented = await safeAugment(prompt, `${context.teamName} 분석`);
      return await chatWithLlmJson<DailyBriefing>(augmented, { schema: dailyBriefingSchema });
    } catch {
      // AI 실패 -> 폴백
    }
  }

  return generateFallbackDailyBriefing(context);
}

// ─────────────────────────────────────────
// 8. 시즌 요약 (Season Summary)
// ─────────────────────────────────────────

export interface SeasonSummary {
  narrative: string;
  highlights: string[];
  keyMoments: string[];
  outlook: string;
}

const seasonSummarySchema = z.object({
  narrative: z.string().min(1).max(400),
  highlights: z.array(z.string().min(1).max(120)).min(1).max(5),
  keyMoments: z.array(z.string().min(1).max(120)).min(1).max(5),
  outlook: z.string().min(1).max(160),
});

function generateFallbackSeasonSummary(context: {
  teamName: string;
  wins: number;
  losses: number;
  standing: number;
  playoffResult?: string;
  mvpPlayerName?: string;
  biggestWin?: string;
  biggestLoss?: string;
  trophies: string[];
  rookieBreakout?: string;
  totalGrowthPlayers: number;
}): SeasonSummary {
  const totalGames = context.wins + context.losses;
  const winRate = totalGames > 0 ? Math.round((context.wins / totalGames) * 100) : 0;

  // 서사 생성
  let narrative: string;
  if (context.trophies.length > 0) {
    narrative = `${context.teamName}이(가) ${context.trophies.join(', ')}을(를) 차지하며 영광의 시즌을 보냈다. ${context.wins}승 ${context.losses}패(${winRate}%)로 정규시즌 ${context.standing}위를 기록했다.`;
  } else if (context.standing <= 3) {
    narrative = `${context.teamName}이(가) 정규시즌 ${context.standing}위로 상위권에 안착했다. ${context.wins}승 ${context.losses}패(${winRate}%)의 안정적인 성적을 거두었다.`;
  } else if (context.standing <= 6) {
    narrative = `${context.teamName}은(는) ${context.wins}승 ${context.losses}패로 정규시즌 ${context.standing}위를 기록했다. 아쉬운 부분도 있었지만 성장 가능성을 보여준 시즌이었다.`;
  } else {
    narrative = `${context.teamName}에게 쉽지 않은 시즌이었다. ${context.wins}승 ${context.losses}패로 정규시즌 ${context.standing}위에 그쳤다. 다음 시즌 재도약이 필요하다.`;
  }

  // 하이라이트
  const highlights: string[] = [];
  if (context.biggestWin) highlights.push(`최고의 승리: ${context.biggestWin}`);
  if (context.mvpPlayerName) highlights.push(`시즌 MVP: ${context.mvpPlayerName}`);
  if (context.rookieBreakout) highlights.push(context.rookieBreakout);
  if (context.trophies.length > 0) highlights.push(`트로피 획득: ${context.trophies.join(', ')}`);
  if (context.totalGrowthPlayers > 0) highlights.push(`${context.totalGrowthPlayers}명의 선수가 성장`);
  if (highlights.length === 0) highlights.push(`${context.wins}승 달성`);

  // 핵심 순간
  const keyMoments: string[] = [];
  if (context.biggestWin) keyMoments.push(context.biggestWin);
  if (context.biggestLoss) keyMoments.push(context.biggestLoss);
  if (context.playoffResult) keyMoments.push(`플레이오프: ${context.playoffResult}`);
  if (keyMoments.length === 0) keyMoments.push(`정규시즌 ${context.standing}위 확정`);

  // 전망
  let outlook: string;
  if (context.standing <= 3) {
    outlook = '강팀의 면모를 유지하며 다음 시즌도 우승을 노린다.';
  } else if (context.standing <= 6) {
    outlook = '보강과 성장을 통해 상위권 진입을 목표로 한다.';
  } else {
    outlook = '대대적인 재정비를 통해 반등을 노린다.';
  }

  return {
    narrative: narrative.slice(0, 200),
    highlights: highlights.slice(0, 5),
    keyMoments: keyMoments.slice(0, 4),
    outlook: outlook.slice(0, 50),
  };
}

export async function generateSeasonSummary(context: {
  teamName: string;
  wins: number;
  losses: number;
  standing: number;
  playoffResult?: string;
  mvpPlayerName?: string;
  biggestWin?: string;
  biggestLoss?: string;
  trophies: string[];
  rookieBreakout?: string;
  totalGrowthPlayers: number;
}): Promise<SeasonSummary> {
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      const prompt = `당신은 LoL 전문 스포츠 기자입니다. 시즌을 되돌아보는 기사를 작성하세요.

시즌 정보:
- 팀명: ${context.teamName}
- 전적: ${context.wins}승 ${context.losses}패
- 정규시즌 순위: ${context.standing}위
${context.playoffResult ? `- 플레이오프 결과: ${context.playoffResult}` : ''}
${context.mvpPlayerName ? `- 시즌 MVP: ${context.mvpPlayerName}` : ''}
${context.biggestWin ? `- 최고의 승리: ${context.biggestWin}` : ''}
${context.biggestLoss ? `- 최악의 패배: ${context.biggestLoss}` : ''}
- 트로피: ${context.trophies.length > 0 ? context.trophies.join(', ') : '없음'}
${context.rookieBreakout ? `- 신인 활약: ${context.rookieBreakout}` : ''}
- 성장 선수 수: ${context.totalGrowthPlayers}명

한국 LoL e스포츠 스타일의 시즌 리뷰 기사를 작성하세요.
JSON 형식: {"narrative": "시즌 이야기 (200자 이내)", "highlights": ["하이라이트1", "하이라이트2"], "keyMoments": ["핵심순간1", "핵심순간2"], "outlook": "다음 시즌 전망 (50자 이내)"}`;

      const augmented = await safeAugment(prompt, `시즌 리뷰 ${context.teamName}`);
      return await chatWithLlmJson<SeasonSummary>(augmented, { schema: seasonSummarySchema });
    } catch {
      // AI 실패 -> 폴백
    }
  }

  return generateFallbackSeasonSummary(context);
}

// ─────────────────────────────────────────
// 9. 에이전트 협상 대화 (Agent Negotiation)
// ─────────────────────────────────────────

export interface AgentNegotiationDialogue {
  agentMessage: string;
  tone: 'friendly' | 'firm' | 'aggressive' | 'pleading';
  counterOffer?: {
    salary?: number;
    years?: number;
    signingBonus?: number;
  };
  willingness: number;
}

const AGENT_MESSAGE_TEMPLATES: Record<string, readonly { message: string; tone: AgentNegotiationDialogue['tone'] }[]> = {
  aggressive_low: [
    { message: '이 금액은 우리 선수의 가치를 모욕하는 수준입니다. 다시 생각해보시죠.', tone: 'aggressive' },
    { message: '솔직히 이 제안은 받아들이기 어렵습니다. 시장 가치를 다시 확인해주세요.', tone: 'aggressive' },
    { message: '다른 팀에서 훨씬 좋은 조건을 제시하고 있습니다. 이 정도로는 안 됩니다.', tone: 'aggressive' },
    { message: '우리 선수의 실력을 감안하면 이 제안은 너무 낮습니다.', tone: 'aggressive' },
    { message: '이 연봉으로는 협상 테이블에 앉을 이유가 없습니다.', tone: 'aggressive' },
  ],
  firm_mid: [
    { message: '나쁘지 않은 제안이지만, 조금 더 올려주셔야 합니다.', tone: 'firm' },
    { message: '방향은 맞지만 아직 격차가 있습니다. 조율이 필요하겠네요.', tone: 'firm' },
    { message: '선수도 이 팀에 관심이 있지만, 연봉 부분에서 좀 더 배려해주셔야 합니다.', tone: 'firm' },
    { message: '괜찮은 조건이지만 계약 기간이나 보너스 부분을 논의하고 싶습니다.', tone: 'firm' },
    { message: '진전이 있네요. 하지만 우리 기대치에는 아직 못 미칩니다.', tone: 'firm' },
  ],
  friendly_high: [
    { message: '좋은 제안입니다! 선수도 긍정적으로 검토하고 있습니다.', tone: 'friendly' },
    { message: '이 정도면 서로 윈윈할 수 있을 것 같습니다.', tone: 'friendly' },
    { message: '마음에 드는 조건이네요. 세부 사항만 조율하면 될 것 같습니다.', tone: 'friendly' },
    { message: '선수가 이 팀에서 뛰고 싶어합니다. 좋은 조건이에요.', tone: 'friendly' },
    { message: '훌륭한 제안입니다. 거의 합의에 다다른 것 같습니다.', tone: 'friendly' },
  ],
  reasonable_mid: [
    { message: '합리적인 제안입니다. 약간의 조정만 있으면 될 것 같아요.', tone: 'firm' },
    { message: '좋은 출발점이네요. 구체적인 조건을 논의해봅시다.', tone: 'friendly' },
    { message: '나쁘지 않지만 선수의 잠재력을 고려하면 조금 더 올려야 합니다.', tone: 'firm' },
    { message: '기본 틀은 괜찮습니다. 연봉을 소폭 상향 조정해주시면 좋겠습니다.', tone: 'firm' },
  ],
  pushover_any: [
    { message: '선수가 이 팀에서 정말 뛰고 싶어합니다. 조건은 유연하게 조절 가능해요.', tone: 'pleading' },
    { message: '좋은 기회라고 생각합니다. 가능한 빨리 합의하고 싶습니다.', tone: 'friendly' },
    { message: '연봉보다 팀 환경이 중요하다고 생각합니다. 전향적으로 검토하겠습니다.', tone: 'pleading' },
    { message: '선수의 커리어를 위해 이 이적이 최선이라 생각합니다.', tone: 'friendly' },
  ],
};

function generateFallbackAgentNegotiation(context: {
  playerName: string;
  playerAge: number;
  playerOvr: number;
  currentSalary: number;
  offeredSalary: number;
  offeredYears: number;
  marketValue: number;
  agentPersonality: 'aggressive' | 'reasonable' | 'pushover';
  negotiationRound: number;
}): AgentNegotiationDialogue {
  const ratio = context.offeredSalary / context.marketValue;
  const roundBonus = (context.negotiationRound - 1) * 5; // 라운드가 올라갈수록 수락 의향 증가

  let templateKey: string;
  let willingness: number;
  let counterSalary: number | undefined;
  let counterYears: number | undefined;
  let counterBonus: number | undefined;

  if (context.agentPersonality === 'pushover') {
    templateKey = 'pushover_any';
    willingness = Math.min(100, 50 + ratio * 40 + roundBonus);
    if (ratio < 0.9) {
      counterSalary = Math.round(context.marketValue * 0.95);
    }
  } else if (ratio < 0.8) {
    // 시장가치 80% 미만
    templateKey = 'aggressive_low';
    willingness = Math.min(100, Math.round(ratio * 30) + roundBonus);
    counterSalary = Math.round(context.offeredSalary * 1.2);
    if (context.agentPersonality === 'aggressive') {
      counterBonus = Math.round(context.marketValue * 0.1);
    }
  } else if (ratio < 1.0) {
    // 시장가치 80~100%
    templateKey = context.agentPersonality === 'aggressive' ? 'firm_mid' : 'reasonable_mid';
    willingness = Math.min(100, Math.round(ratio * 60) + roundBonus);
    counterSalary = Math.round(context.offeredSalary * 1.1);
  } else {
    // 시장가치 100% 이상
    templateKey = 'friendly_high';
    willingness = Math.min(100, Math.round(70 + ratio * 20) + roundBonus);
  }

  const templates = AGENT_MESSAGE_TEMPLATES[templateKey] ?? AGENT_MESSAGE_TEMPLATES.firm_mid;
  const template = pickRandom(templates);

  return {
    agentMessage: template.message,
    tone: template.tone,
    counterOffer: counterSalary != null ? {
      salary: counterSalary,
      years: counterYears,
      signingBonus: counterBonus,
    } : undefined,
    willingness: Math.round(willingness),
  };
}

export async function generateAgentNegotiation(context: {
  playerName: string;
  playerAge: number;
  playerOvr: number;
  currentSalary: number;
  offeredSalary: number;
  offeredYears: number;
  marketValue: number;
  agentPersonality: 'aggressive' | 'reasonable' | 'pushover';
  negotiationRound: number;
}): Promise<AgentNegotiationDialogue> {
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      const personalityKr = {
        aggressive: '공격적이고 강경한',
        reasonable: '합리적이고 균형 잡힌',
        pushover: '유연하고 순응적인',
      }[context.agentPersonality];

      const prompt = `당신은 프로 LoL 선수의 에이전트입니다. ${personalityKr} 성격으로 협상하세요.

선수 정보:
- 이름: ${context.playerName}
- 나이: ${context.playerAge}세
- OVR: ${context.playerOvr}
- 현재 연봉: ${context.currentSalary}만 원/년
- 시장 가치: ${context.marketValue}만 원/년

제안 조건:
- 제안 연봉: ${context.offeredSalary}만 원/년
- 제안 기간: ${context.offeredYears}년
- 협상 라운드: ${context.negotiationRound}차

에이전트로서 협상 메시지를 작성하세요.
JSON 형식: {"agentMessage": "협상 발언 (60자 이내)", "tone": "friendly|firm|aggressive|pleading", "counterOffer": {"salary": 역제안연봉, "years": 역제안기간, "signingBonus": 보너스} 또는 null, "willingness": 0-100}`;

      const augmented = await safeAugment(prompt, `이적 협상 ${context.playerName}`);
      return await chatWithLlmJson<AgentNegotiationDialogue>(augmented);
    } catch {
      // AI 실패 -> 폴백
    }
  }

  return generateFallbackAgentNegotiation(context);
}

// ─────────────────────────────────────────
// 10. 코치 미팅 (Coach Meeting)
// ─────────────────────────────────────────

export interface CoachMeetingResult {
  coachName: string;
  agenda: string[];
  recommendation: string;
  tacticalAdvice: string;
  playerConcern?: string;
}

function generateFallbackCoachMeeting(context: {
  teamName: string;
  coachName: string;
  recentForm: string;
  nextOpponent?: string;
  injuredPlayers: string[];
  lowMoralePlayers: string[];
  teamStrength: string;
  teamWeakness: string;
}): CoachMeetingResult {
  const agenda: string[] = [];
  let recommendation: string;
  let tacticalAdvice: string;
  let playerConcern: string | undefined;

  // 최근 전적 분석 - 구체적으로
  if (context.recentForm.includes('0승') || context.recentForm.includes('연패')) {
    agenda.push(`최근 연패 원인 분석 (${context.recentForm})`);
  } else if (context.recentForm.includes('연승')) {
    agenda.push(`연승 기세 유지 방안 (${context.recentForm})`);
  } else {
    agenda.push(`최근 팀 성적 리뷰 (${context.recentForm})`);
  }

  // 부상자 관련 - 구체적
  if (context.injuredPlayers.length > 0) {
    agenda.push(`부상자 복귀 일정 및 대체 선수 운영 (${context.injuredPlayers.join(', ')})`);
  }

  // 다음 상대 분석 - 구체적
  if (context.nextOpponent) {
    agenda.push(`${context.nextOpponent} 상대 전략 수립 및 매치업 분석`);
  }

  // 사기 관리 - 구체적
  if (context.lowMoralePlayers.length > 0) {
    agenda.push(`선수 멘탈 관리 (${context.lowMoralePlayers.join(', ')})`);
    playerConcern = `${context.lowMoralePlayers.join(', ')} 선수의 사기가 낮습니다. 개별 면담으로 불만 원인을 파악하고, 필요하다면 출전 기회 조정이나 역할 변경을 검토해야 합니다.`;
  }

  // 전술 훈련
  agenda.push('주간 훈련 계획 및 스크림 일정 점검');

  // 기본 아젠다 보장
  if (agenda.length < 3) {
    agenda.push('팀 케미스트리 및 소통 방식 점검');
  }

  // 팀 강점/약점 기반 추천 - 더 구체적이고 다양한 분기
  const weaknessLower = context.teamWeakness.toLowerCase();

  if (weaknessLower.includes('후반') || weaknessLower.includes('운영')) {
    recommendation = '후반 운영 훈련에 집중할 것을 권장합니다. 바론 이후 맵 운영, 슈퍼 미니언 관리, 사이드 라인 배분 연습이 필요합니다.';
    tacticalAdvice = context.nextOpponent
      ? `${context.nextOpponent} 상대로는 초반 라인전 주도권을 확보한 뒤, 빠른 오브젝트 확보로 게임을 마무리하는 전략을 추천합니다.`
      : '초반 라인전 주도권을 확보한 뒤 빠른 오브젝트 확보로 게임을 마무리하는 전략을 추천합니다.';
  } else if (weaknessLower.includes('라인전') || weaknessLower.includes('초반')) {
    recommendation = '라인전 매치업 연습을 강화해야 합니다. 1:1 솔로킬 상황 시뮬레이션과 2:2 교전 타이밍 훈련이 필요합니다.';
    tacticalAdvice = context.nextOpponent
      ? `${context.nextOpponent} 상대로는 안전한 라인전 운영 후, 중반 팀파이트에서 승부를 보는 전략이 적합합니다.`
      : '안전한 라인전 운영 후 중반 팀파이트에서 승부를 보는 전략이 적합합니다.';
  } else if (weaknessLower.includes('팀파이트') || weaknessLower.includes('한타')) {
    recommendation = '팀파이트 연습이 최우선입니다. 이니시 타이밍, 포커싱 우선순위, 포지셔닝 훈련을 집중 진행하세요.';
    tacticalAdvice = context.nextOpponent
      ? `${context.nextOpponent} 상대로는 스플릿 푸시 전략으로 정면 팀파이트를 회피하는 것도 고려해볼 만합니다.`
      : '스플릿 푸시 전략으로 정면 팀파이트를 회피하는 것도 고려해볼 만합니다.';
  } else if (weaknessLower.includes('오브젝트') || weaknessLower.includes('드래곤') || weaknessLower.includes('바론')) {
    recommendation = '오브젝트 컨트롤 훈련이 필요합니다. 드래곤/바론 타이밍, 시야 세팅, 스마이트 싸움 연습을 강화하세요.';
    tacticalAdvice = context.nextOpponent
      ? `${context.nextOpponent} 상대로는 시야 장악을 통한 오브젝트 선점 전략을 중심으로 준비하세요.`
      : '시야 장악을 통한 오브젝트 선점 전략을 중심으로 준비하세요.';
  } else {
    recommendation = '현재 팀 상태가 양호합니다. 강점을 유지하면서 약점을 보완하는 균형 잡힌 훈련을 추천합니다.';
    tacticalAdvice = context.nextOpponent
      ? `${context.nextOpponent} 상대로는 팀의 ${context.teamStrength}을(를) 살리는 전략을 중심으로 준비하세요.`
      : `팀의 ${context.teamStrength}을(를) 살리는 전략을 중심으로 준비하세요.`;
  }

  // 전적 기반 추가 조언
  if (context.recentForm.includes('0승') || context.recentForm.includes('연패')) {
    recommendation = `연패를 끊기 위해 자신감 회복이 최우선입니다. 편안한 스크림 환경에서 성공 경험을 쌓게 하세요. ` + recommendation;
  }

  // 부상자 + 다음 상대가 있을 때 복합 조언
  if (context.injuredPlayers.length > 0 && context.nextOpponent) {
    tacticalAdvice += ` ${context.injuredPlayers.join(', ')} 선수 부재 시 대체 선수의 특성에 맞는 전술 조정도 함께 준비하세요.`;
  }

  return {
    coachName: context.coachName,
    agenda: agenda.slice(0, 5),
    recommendation,
    tacticalAdvice,
    playerConcern,
  };
}

export async function generateCoachMeeting(context: {
  teamName: string;
  coachName: string;
  recentForm: string;
  nextOpponent?: string;
  injuredPlayers: string[];
  lowMoralePlayers: string[];
  teamStrength: string;
  teamWeakness: string;
}): Promise<CoachMeetingResult> {
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      const prompt = `당신은 LoL 프로팀 ${context.teamName}의 코치 ${context.coachName}입니다. 주간 코칭스태프 회의를 진행하세요.

팀 상황:
- 최근 전적: ${context.recentForm}
- 팀 강점: ${context.teamStrength}
- 팀 약점: ${context.teamWeakness}
${context.nextOpponent ? `- 다음 상대: ${context.nextOpponent}` : '- 예정된 경기 없음'}
- 부상자: ${context.injuredPlayers.length > 0 ? context.injuredPlayers.join(', ') : '없음'}
- 사기 낮은 선수: ${context.lowMoralePlayers.length > 0 ? context.lowMoralePlayers.join(', ') : '없음'}

프로 코치로서 회의를 진행하세요.
JSON 형식: {"coachName": "${context.coachName}", "agenda": ["안건1", "안건2", "안건3"], "recommendation": "핵심 추천 (60자 이내)", "tacticalAdvice": "전술 조언 (60자 이내)", "playerConcern": "선수 우려사항 (50자 이내) 또는 null"}`;

      const augmented = await safeAugment(prompt, `코치 미팅 ${context.teamName} 전술`);
      return await chatWithLlmJson<CoachMeetingResult>(augmented);
    } catch {
      // AI 실패 -> 폴백
    }
  }

  return generateFallbackCoachMeeting(context);
}

// ─────────────────────────────────────────
// 11. 커뮤니티 라이브 채팅 (Live Chat)
// ─────────────────────────────────────────

export interface LiveChatMessage {
  username: string;
  message: string;
  type: 'cheer' | 'flame' | 'meme' | 'analysis' | 'neutral';
  timestamp: number;
}

const liveChatMessageSchema = z.object({
  username: z.string().min(1).max(30),
  message: z.string().min(1).max(120),
  type: z.enum(['cheer', 'flame', 'meme', 'analysis', 'neutral']),
  timestamp: z.number(),
});

const liveChatMessagesSchema = z.array(liveChatMessageSchema).min(1).max(12);

const LIVE_CHAT_USERNAMES = [
  '롤잘알', '페이커팬', 'LoL중독자', '겐지사랑', '대리장인',
  'T1화이팅', '디시롤갤', '브실골', '챌린저꿈', '서폿주세요',
  '원딜장인', '정글갭', '미드차이', '탑갱와', '풀파이트',
  'GG잘침', '솔랭중', '다이아각', '그마가즈아', '프로관전러',
  '경기분석가', '드래곤타이밍', '바론50대50', '한타장인', '오브젝트왕',
  '실시간시청중', '경기꿀잼', '롤알못', '해설지망', '팝콘각',
  '눈물닦으면서', '개꿀잼ㅋ', '페이커2세', '칼바람장인', '랭크폭주중',
  '오늘만본다', '또졌냐', '우승가즈아', '경기뇌절', '존잼각',
] as const;

const LIVE_CHAT_TEMPLATES: Record<string, readonly { message: string; type: LiveChatMessage['type'] }[]> = {
  firstBlood: [
    { message: 'ㅋㅋㅋ 퍼블!', type: 'cheer' },
    { message: '와 미쳤다 솔킬', type: 'cheer' },
    { message: '퍼블 ㄱㄱ', type: 'neutral' },
    { message: '이거 실화냐', type: 'cheer' },
    { message: '퍼블 나이스~', type: 'cheer' },
    { message: 'ㄹㅇ 라인전 차이', type: 'analysis' },
    { message: '이게 프로냐 ㅋㅋ', type: 'flame' },
    { message: '아 벌써 죽었네', type: 'flame' },
    { message: '킬각 ㄱㄱ', type: 'neutral' },
    { message: '역시 ㅋㅋㅋ', type: 'cheer' },
    { message: '상대 멘탈 나갔다', type: 'meme' },
    { message: '?', type: 'meme' },
    { message: '초반부터 피 튀기네', type: 'neutral' },
    { message: '솔킬 미쳤다', type: 'cheer' },
    { message: 'ㅎㄷㄷ', type: 'cheer' },
  ],
  dragon: [
    { message: '드래곤 나이스', type: 'cheer' },
    { message: '소울 가즈아!', type: 'cheer' },
    { message: '드래곤 컨트롤 ㄱㄱ', type: 'analysis' },
    { message: '이거 소울 각인데', type: 'analysis' },
    { message: 'ㅋㅋ 드래곤도 먹고', type: 'neutral' },
    { message: '오브젝트 장악!', type: 'cheer' },
    { message: '드래곤 스틸 가능?', type: 'neutral' },
    { message: '소울 포인트!', type: 'cheer' },
    { message: '드래곤 타이밍 굿', type: 'analysis' },
    { message: '상대 드래곤 뺏겨서 ㅋㅋ', type: 'flame' },
    { message: '드래곤 ㄱㄱ', type: 'neutral' },
    { message: '스마이트 장인', type: 'meme' },
  ],
  baron: [
    { message: '바론 ㄱㄱ!!', type: 'cheer' },
    { message: '바론 먹으면 끝이다', type: 'analysis' },
    { message: 'ㅋㅋㅋ 바론 꿀꺽', type: 'cheer' },
    { message: '바론 타이밍 완벽', type: 'analysis' },
    { message: 'GG', type: 'meme' },
    { message: '바론 스틸 ㄷㄷㄷ', type: 'cheer' },
    { message: '이거 끝났다 ㅋㅋ', type: 'cheer' },
    { message: '바론 버프로 밀자', type: 'neutral' },
    { message: '클린 바론이다', type: 'analysis' },
    { message: '바론 가는 거 맞냐?', type: 'flame' },
    { message: '바론으로 게임 끝', type: 'neutral' },
    { message: '바론 나이스!!!', type: 'cheer' },
  ],
  teamfight: [
    { message: '한타 ㅋㅋㅋㅋㅋ', type: 'cheer' },
    { message: '에이스!!!!', type: 'cheer' },
    { message: '와 미쳤다 한타', type: 'cheer' },
    { message: '한타 장인이시네', type: 'cheer' },
    { message: '이니시 타이밍 ㄹㅈㄷ', type: 'analysis' },
    { message: '한타 왜 지는 거냐', type: 'flame' },
    { message: '포지셔닝 뭐하냐', type: 'flame' },
    { message: 'ㄹㅇ 존잼', type: 'cheer' },
    { message: '한타 승리!!', type: 'cheer' },
    { message: '아 한타 왜 갔어', type: 'flame' },
    { message: '5대5 풀파이트!', type: 'neutral' },
    { message: '원딜 살았다!', type: 'cheer' },
    { message: '탱 이니시 갓', type: 'analysis' },
    { message: 'ㅋㅋㅋㅋ 진짜 미친한타', type: 'cheer' },
    { message: '한타에서 다 녹았네', type: 'flame' },
  ],
  gameEnd: [
    { message: 'GG', type: 'meme' },
    { message: 'gg wp', type: 'meme' },
    { message: '경기 꿀잼이었다', type: 'cheer' },
    { message: '다음 세트도 기대', type: 'cheer' },
    { message: '와 역대급 경기', type: 'cheer' },
    { message: '결국 졌네...', type: 'flame' },
    { message: '아 아쉽다', type: 'neutral' },
    { message: 'ㄱㄱ 다음판', type: 'neutral' },
    { message: '이겼다!!!', type: 'cheer' },
    { message: '경기력 좋았다', type: 'cheer' },
    { message: '이게 프로야?', type: 'flame' },
    { message: '역전 불가능이었다', type: 'neutral' },
    { message: 'MVP 누구?', type: 'neutral' },
    { message: '드래프트 차이', type: 'analysis' },
    { message: 'gg 잘봤습니다', type: 'neutral' },
  ],
};

function generateFallbackLiveChatMessages(context: {
  teamName: string;
  opponentName: string;
  event: string;
  isWinning: boolean;
  goldDiff: number;
  gameTime: number;
  count?: number;
}): LiveChatMessage[] {
  const count = context.count ?? 5;
  const eventKey = context.event in LIVE_CHAT_TEMPLATES ? context.event : 'teamfight';
  const templates = LIVE_CHAT_TEMPLATES[eventKey];
  const selected = pickRandomN(templates, count);

  return selected.map((t) => ({
    username: pickRandom(LIVE_CHAT_USERNAMES),
    message: t.message,
    type: t.type,
    timestamp: context.gameTime,
  }));
}

export async function generateLiveChatMessages(context: {
  teamName: string;
  opponentName: string;
  event: string;
  isWinning: boolean;
  goldDiff: number;
  gameTime: number;
  count?: number;
}): Promise<LiveChatMessage[]> {
  const count = context.count ?? 5;
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      const eventKr: Record<string, string> = {
        firstBlood: '퍼스트 블러드',
        dragon: '드래곤 처치',
        baron: '바론 처치',
        teamfight: '팀파이트',
        gameEnd: '경기 종료',
      };

      const prompt = `당신은 LoL 생방송 채팅 시뮬레이터입니다. 한국 트위치 채팅 스타일로 ${count}개 메시지를 생성하세요.

경기 상황:
- ${context.teamName} vs ${context.opponentName}
- 이벤트: ${eventKr[context.event] ?? context.event}
- 승리 중: ${context.isWinning ? '예' : '아니오'}
- 골드 격차: ${context.goldDiff > 0 ? '+' : ''}${context.goldDiff}
- 게임 시간: ${context.gameTime}분

한국 인터넷 문화를 반영하세요. ㅋㅋ, ㄹㅈㄷ, GG 같은 표현을 자연스럽게 사용하세요.
메시지 유형은 cheer(응원), flame(비판), meme(밈), analysis(분석), neutral(중립)이 섞여야 합니다.
JSON 형식: [{"username": "닉네임", "message": "메시지 (30자 이내)", "type": "cheer|flame|meme|analysis|neutral", "timestamp": ${context.gameTime}}]`;

      const augmented = await safeAugment(prompt, `${context.event} 채팅 반응`);
      return await chatWithLlmJson<LiveChatMessage[]>(augmented, { schema: liveChatMessagesSchema });
    } catch {
      // AI 실패 -> 폴백
    }
  }

  return generateFallbackLiveChatMessages(context);
}

// ─────────────────────────────────────────
// 9. AI 선수 면담 대화 (Player Conversation)
// ─────────────────────────────────────────

export interface PlayerConversation {
  playerResponse: string;
  mood: 'happy' | 'neutral' | 'frustrated' | 'angry' | 'shy';
  moraleChange: number;
  loyaltyChange: number;
  revealedInfo?: string;
}

const playerConversationSchema = z.object({
  playerResponse: z.string().min(1).max(220),
  mood: z.enum(['happy', 'neutral', 'frustrated', 'angry', 'shy']),
  moraleChange: z.number().min(-5).max(5),
  loyaltyChange: z.number().min(-3).max(3),
  revealedInfo: z.string().max(160).optional().nullable(),
}).transform((value) => ({
  ...value,
  revealedInfo: value.revealedInfo ?? undefined,
}));

type ConversationTopic = 'general' | 'performance' | 'future' | 'team' | 'personal';

const TOPIC_KR: Record<ConversationTopic, string> = {
  general: '일반 대화',
  performance: '성적/퍼포먼스',
  future: '미래/진로',
  team: '팀/동료',
  personal: '개인적인 이야기',
};

/** 성격 + 주제 조합별 폴백 템플릿 (25개+) */
const CONVERSATION_FALLBACKS: {
  condition: (ambition: number, loyalty: number, temperament: number, topic: ConversationTopic, morale: number) => boolean;
  response: string;
  mood: PlayerConversation['mood'];
  moraleChange: number;
  loyaltyChange: number;
  revealedInfo?: string;
}[] = [
  // 야망 높은 선수 + 미래
  { condition: (a, _l, _t, topic) => a >= 70 && topic === 'future', response: '솔직히 더 큰 팀에서 뛰고 싶은 마음이 있습니다. 하지만 지금 이 팀에서 증명하는 것이 먼저라고 생각해요.', mood: 'neutral', moraleChange: 0, loyaltyChange: -1, revealedInfo: '더 큰 팀으로의 이적 희망' },
  // 충성 높은 선수 + 팀
  { condition: (_a, l, _t, topic) => l >= 70 && topic === 'team', response: '이 팀에서 오래 뛰고 싶습니다. 동료들과의 케미가 정말 좋거든요.', mood: 'happy', moraleChange: 3, loyaltyChange: 1 },
  // 기질 낮은 선수 + 성적
  { condition: (_a, _l, t, topic) => t < 40 && topic === 'performance', response: '제 플레이가 마음에 안 드시면 직접 말씀하세요. 저도 답답합니다.', mood: 'frustrated', moraleChange: -2, loyaltyChange: 0 },
  // 야망 높은 + 성적
  { condition: (a, _l, _t, topic) => a >= 70 && topic === 'performance', response: '더 잘할 수 있다고 생각합니다. 제가 캐리할 기회를 더 주세요.', mood: 'neutral', moraleChange: 1, loyaltyChange: 0 },
  // 충성 높은 + 미래
  { condition: (_a, l, _t, topic) => l >= 70 && topic === 'future', response: '저는 이 팀과 함께 성장하고 싶어요. 다른 팀은 생각도 안 합니다.', mood: 'happy', moraleChange: 2, loyaltyChange: 2 },
  // 기질 높은 + 일반
  { condition: (_a, _l, t, topic) => t >= 70 && topic === 'general', response: '감독님과 이렇게 얘기하니 좋네요. 항상 응원 감사합니다!', mood: 'happy', moraleChange: 3, loyaltyChange: 1 },
  // 사기 낮은 + 성적
  { condition: (_a, _l, _t, topic, morale) => morale < 30 && topic === 'performance', response: '요즘 자신감이 많이 떨어졌어요... 좀 더 시간을 주세요.', mood: 'frustrated', moraleChange: 2, loyaltyChange: 0 },
  // 사기 낮은 + 개인
  { condition: (_a, _l, _t, topic, morale) => morale < 30 && topic === 'personal', response: '솔직히 요즘 힘들어요. 감독님이 신경 써주셔서 고맙습니다.', mood: 'shy', moraleChange: 5, loyaltyChange: 1, revealedInfo: '정신적 스트레스' },
  // 야망 높은 + 팀
  { condition: (a, _l, _t, topic) => a >= 70 && topic === 'team', response: '팀원들 실력이 더 올라가면 좋겠어요. 솔직히 아쉬운 부분이 있습니다.', mood: 'neutral', moraleChange: 0, loyaltyChange: -1 },
  // 충성 높은 + 성적
  { condition: (_a, l, _t, topic) => l >= 70 && topic === 'performance', response: '팀을 위해 더 열심히 하겠습니다. 믿어주세요!', mood: 'happy', moraleChange: 3, loyaltyChange: 1 },
  // 기질 낮은 + 팀
  { condition: (_a, _l, t, topic) => t < 40 && topic === 'team', response: '... 솔직히 팀 분위기가 별로예요. 특정 선수와 안 맞습니다.', mood: 'angry', moraleChange: -1, loyaltyChange: -1, revealedInfo: '팀 내 갈등 존재' },
  // 일반 + 사기 높은
  { condition: (_a, _l, _t, topic, morale) => morale >= 70 && topic === 'general', response: '요즘 컨디션 최고입니다! 다음 경기도 기대해주세요.', mood: 'happy', moraleChange: 2, loyaltyChange: 1 },
  // 야망 낮은 + 미래
  { condition: (a, _l, _t, topic) => a < 40 && topic === 'future', response: '저는 그냥 게임하는 것 자체가 좋아요. 큰 욕심은 없습니다.', mood: 'neutral', moraleChange: 1, loyaltyChange: 0 },
  // 기질 높은 + 성적
  { condition: (_a, _l, t, topic) => t >= 70 && topic === 'performance', response: '최선을 다하고 있습니다. 결과가 안 좋아도 포기하지 않을게요.', mood: 'neutral', moraleChange: 2, loyaltyChange: 1 },
  // 개인 + 일반
  { condition: (_a, _l, _t, topic) => topic === 'personal', response: '요즘 게임 외에는 운동도 좀 하고 있어요. 건강 관리가 중요하더라고요.', mood: 'happy', moraleChange: 1, loyaltyChange: 0 },
  // 야망 높은 + 개인
  { condition: (a, _l, _t, topic) => a >= 70 && topic === 'personal', response: '저는 월드 챔피언이 되는 게 꿈입니다. 그 목표를 위해 모든 걸 걸고 있어요.', mood: 'neutral', moraleChange: 2, loyaltyChange: 0, revealedInfo: '월드 챔피언 목표' },
  // 충성 높은 + 개인
  { condition: (_a, l, _t, topic) => l >= 70 && topic === 'personal', response: '팀원들이 가족 같아요. 여기서 은퇴해도 좋겠다는 생각이 들어요.', mood: 'happy', moraleChange: 3, loyaltyChange: 2 },
  // 기질 낮은 + 일반
  { condition: (_a, _l, t, topic) => t < 40 && topic === 'general', response: '...네, 뭐 특별한 건 없어요.', mood: 'neutral', moraleChange: 0, loyaltyChange: 0 },
  // 기질 낮은 + 미래
  { condition: (_a, _l, t, topic) => t < 40 && topic === 'future', response: '은퇴 생각도 가끔 해요. 이 업계가 너무 힘들어서요.', mood: 'frustrated', moraleChange: -1, loyaltyChange: -1, revealedInfo: '은퇴 고민 중' },
  // 사기 높은 + 팀
  { condition: (_a, _l, _t, topic, morale) => morale >= 70 && topic === 'team', response: '팀 분위기 최고예요! 이대로 가면 좋은 결과 있을 겁니다.', mood: 'happy', moraleChange: 2, loyaltyChange: 1 },
  // 사기 중간 + 일반
  { condition: (_a, _l, _t, topic) => topic === 'general', response: '감독님 덕분에 많이 배우고 있습니다. 감사해요.', mood: 'neutral', moraleChange: 2, loyaltyChange: 1 },
  // 야망 높은 + 일반
  { condition: (a, _l, _t, topic) => a >= 60 && topic === 'general', response: '연습 더 해야 할 것 같아요. 목표가 높으니까요.', mood: 'neutral', moraleChange: 1, loyaltyChange: 0 },
  // 성적 기본
  { condition: (_a, _l, _t, topic) => topic === 'performance', response: '최선을 다하고 있습니다. 부족한 부분은 더 노력하겠습니다.', mood: 'neutral', moraleChange: 1, loyaltyChange: 0 },
  // 미래 기본
  { condition: (_a, _l, _t, topic) => topic === 'future', response: '아직 구체적인 계획은 없어요. 일단 이번 시즌에 집중하고 있습니다.', mood: 'neutral', moraleChange: 0, loyaltyChange: 0 },
  // 팀 기본
  { condition: (_a, _l, _t, topic) => topic === 'team', response: '팀원들과 잘 지내고 있습니다. 걱정 안 하셔도 돼요.', mood: 'neutral', moraleChange: 1, loyaltyChange: 0 },
];

export async function generatePlayerConversation(context: {
  playerName: string;
  playerAge: number;
  playerPosition: string;
  playerMorale: number;
  playerPersonality: { ambition: number; loyalty: number; temperament: number };
  topic: ConversationTopic;
  managerMessage: string;
  conversationHistory?: string[];
}): Promise<PlayerConversation> {
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      const historyText = context.conversationHistory?.length
        ? `\n\n이전 대화:\n${context.conversationHistory.join('\n')}`
        : '';

      const prompt = `당신은 프로 LoL 선수 ${context.playerName}입니다.
나이: ${context.playerAge}세, 포지션: ${context.playerPosition}
성격: 야망 ${context.playerPersonality.ambition}/10, 충성심 ${context.playerPersonality.loyalty}/10, 기질 ${context.playerPersonality.temperament}/10
현재 사기: ${context.playerMorale}/100
주제: ${TOPIC_KR[context.topic]}
${historyText}

감독이 말합니다: "${context.managerMessage}"

캐릭터에 맞게 자연스럽게 응답하세요. 한국어로 100자 이내로 응답하세요.
JSON 형식: {"playerResponse": "응답", "mood": "happy|neutral|frustrated|angry|shy", "moraleChange": -5~5, "loyaltyChange": -3~3, "revealedInfo": "공개 정보 또는 null"}`;

      const augmented = await safeAugment(prompt, `선수 면담 ${context.topic}`);
      return await chatWithLlmJson<PlayerConversation>(augmented, { schema: playerConversationSchema });
    } catch {
      // AI 실패 -> 폴백
    }
  }

  // 폴백: 성격 + 주제 조합 매칭
  const { ambition, loyalty, temperament } = context.playerPersonality;
  const match = CONVERSATION_FALLBACKS.find(f =>
    f.condition(ambition * 10, loyalty * 10, temperament * 10, context.topic, context.playerMorale),
  );

  if (match) {
    return {
      playerResponse: match.response,
      mood: match.mood,
      moraleChange: match.moraleChange,
      loyaltyChange: match.loyaltyChange,
      revealedInfo: match.revealedInfo,
    };
  }

  return {
    playerResponse: '네, 감사합니다. 더 열심히 하겠습니다.',
    mood: 'neutral',
    moraleChange: 1,
    loyaltyChange: 0,
  };
}

// ─────────────────────────────────────────
// 10. AI 팬 레터 (Fan Letter)
// ─────────────────────────────────────────

export interface FanLetter {
  from: string;
  subject: string;
  content: string;
  type: 'support' | 'criticism' | 'advice' | 'confession' | 'meme';
  replyOptions: string[];
}

const fanLetterSchema = z.object({
  from: z.string().min(1).max(60),
  subject: z.string().min(1).max(120),
  content: z.string().min(1).max(300),
  type: z.enum(['support', 'criticism', 'advice', 'confession', 'meme']),
  replyOptions: z.array(z.string().min(1).max(120)).min(2).max(5),
});

const FAN_NICKNAMES = [
  '열혈팬01', '골드장인', '다이아지망생', 'e스포츠매니아', '새벽관전러',
  '오래된팬', '1일1응원', '챌린저가자', '롤갤주민', '인벤유저',
  '트게더러', '만년브론즈', '서폿장인', '프로게이머꿈', '경기분석가',
  '감독응원단', '신입팬', '10년팬', '전세계팬', '한국팬대표',
] as const;

const FAN_LETTER_TEMPLATES: { type: FanLetter['type']; subject: string; content: (team: string, form: string) => string; replyOptions: string[] }[] = [
  // support (6)
  { type: 'support', subject: '항상 응원합니다!', content: (team, form) => `${team} 팬입니다. ${form} 정말 좋아요! 이번 시즌 꼭 우승하세요!`, replyOptions: ['감사합니다! 팬 여러분 덕분입니다.', '더 좋은 경기 보여드리겠습니다.', '응원 감사합니다. 최선을 다하겠습니다.'] },
  { type: 'support', subject: '최고의 팀이에요', content: (team) => `${team} 경기를 보면서 많은 위안을 받습니다. 힘든 시기에도 항상 응원합니다.`, replyOptions: ['팬분들의 응원이 큰 힘이 됩니다.', '감사합니다. 더 멋진 모습 보여드릴게요.', '항상 감사드립니다.'] },
  { type: 'support', subject: '이번 시즌 기대됩니다', content: (team, form) => `${form}을 보니 이번 시즌 정말 기대됩니다! ${team} 화이팅!`, replyOptions: ['기대에 부응하겠습니다!', '감사합니다. 최선을 다하겠습니다.', '팬분들의 기대가 곧 우리의 동력입니다.'] },
  { type: 'support', subject: '선수들 건강 챙기세요', content: (team) => `${team} 선수들 건강이 최우선입니다. 무리하지 마시고 좋은 경기 보여주세요!`, replyOptions: ['선수 건강 관리에 최선을 다하고 있습니다.', '따뜻한 마음 감사합니다.', '감사합니다. 건강 관리 철저히 하겠습니다.'] },
  { type: 'support', subject: '처음 팬레터 써봐요', content: (team) => `안녕하세요, 처음으로 팬레터를 씁니다. ${team} 팬이 된 지 3년째인데 항상 행복합니다!`, replyOptions: ['첫 팬레터 감사합니다! 앞으로도 좋은 모습 보여드리겠습니다.', '3년간의 응원에 감사드립니다.', '소중한 팬레터 잘 받았습니다.'] },
  { type: 'support', subject: '결승 가자!!!', content: (team) => `${team} 이번에는 결승까지 가주세요! 전 경기 관전 중입니다!`, replyOptions: ['결승, 꼭 가겠습니다!', '팬분들과 함께 좋은 결과 만들겠습니다.', '응원 감사합니다!'] },

  // criticism (5)
  { type: 'criticism', subject: '요즘 경기력 실망입니다', content: (team, form) => `${team} 팬인데... ${form} 솔직히 실망스럽습니다. 감독님 전략 좀 바꿔보세요.`, replyOptions: ['죄송합니다. 더 나은 모습 보여드리겠습니다.', '전략 개선을 위해 노력하고 있습니다.', '쓴소리도 감사히 받겠습니다.'] },
  { type: 'criticism', subject: '드래프트가 문제예요', content: (team) => `${team} 경기 보는데 드래프트가 매번 이상해요. 좀 더 연구해주세요.`, replyOptions: ['드래프트 개선에 힘쓰겠습니다.', '다양한 전략을 시도 중입니다.', '의견 감사합니다. 참고하겠습니다.'] },
  { type: 'criticism', subject: '감독 교체 고려해보세요', content: (team) => `솔직히 ${team} 지금 감독 체제로는 한계가 있어 보입니다. 변화가 필요합니다.`, replyOptions: ['어려운 상황이지만 최선을 다하고 있습니다.', '결과로 보여드리겠습니다.', '의견 참고하겠습니다.'] },
  { type: 'criticism', subject: '로스터 변경이 시급합니다', content: (team) => `${team} 팬으로서 말하는데, 현재 로스터로는 경쟁력이 부족합니다.`, replyOptions: ['로스터 보강을 검토 중입니다.', '현 선수들의 성장을 믿고 있습니다.', '의견 감사합니다.'] },
  { type: 'criticism', subject: '후반 운영이 너무 아쉬워요', content: (team) => `${team} 초반은 잘하는데 후반 운영이 매번 아쉽습니다. 개선 부탁드려요.`, replyOptions: ['후반 운영 개선에 집중하고 있습니다.', '구체적인 훈련을 진행 중입니다.', '쓴소리 감사합니다.'] },

  // advice (4)
  { type: 'advice', subject: '포지션 전환은 어떨까요?', content: (team) => `${team}에서 2군 선수 중 미드로 전향시킬 만한 선수가 있지 않나요? 한번 시도해보시면 어떨까요.`, replyOptions: ['재미있는 의견이네요. 검토해보겠습니다.', '현재 로스터 구성에 만족하고 있습니다.', '다양한 가능성을 열어두고 있습니다.'] },
  { type: 'advice', subject: '훈련 방식 제안', content: (team) => `${team}이 VOD 리뷰를 더 많이 하면 좋겠어요. 해외 팀들은 리뷰에 많은 시간을 투자한다고 합니다.`, replyOptions: ['좋은 의견 감사합니다. 참고하겠습니다.', '이미 VOD 리뷰를 진행하고 있습니다.', '다양한 훈련 방법을 시도 중입니다.'] },
  { type: 'advice', subject: '이 선수 영입해보세요', content: (team) => `자유 계약 시장에 좋은 선수가 있다고 들었는데, ${team}에서 영입을 고려해보시면 좋을 것 같아요.`, replyOptions: ['이적 시장을 주시하고 있습니다.', '좋은 정보 감사합니다.', '현재 영입 계획을 검토 중입니다.'] },
  { type: 'advice', subject: '멘탈 관리가 중요합니다', content: (team) => `${team} 선수들 멘탈 관리를 좀 더 신경 써주세요. 중요한 경기에서 무너지는 모습이 아쉽습니다.`, replyOptions: ['멘탈 코칭에 투자하고 있습니다.', '중요한 지적 감사합니다.', '선수들의 정신 건강을 최우선으로 생각합니다.'] },

  // confession (3)
  { type: 'confession', subject: 'e스포츠 덕분에 힘을 얻었어요', content: (team) => `힘든 시기에 ${team} 경기를 보면서 많은 위안을 받았습니다. 감사합니다.`, replyOptions: ['저희가 더 감사합니다. 항상 응원해주세요.', '팬분의 이야기가 저희에게도 큰 힘이 됩니다.', '감동적인 이야기 감사합니다.'] },
  { type: 'confession', subject: '프로게이머가 꿈이에요', content: (team) => `저도 ${team} 같은 팀에서 뛰는 게 꿈입니다. 열심히 연습하고 있어요!`, replyOptions: ['꿈을 응원합니다! 열심히 하세요!', '노력하면 반드시 이룰 수 있습니다.', '멋진 꿈이네요. 화이팅!'] },
  { type: 'confession', subject: '감독님 팬입니다', content: (team) => `선수들도 좋지만 ${team} 감독님의 운영이 정말 좋아요. 항상 응원합니다!`, replyOptions: ['감사합니다! 더 좋은 운영 보여드리겠습니다.', '과찬이십니다. 선수들 덕분입니다.', '감사합니다.'] },

  // meme (4)
  { type: 'meme', subject: 'ㅋㅋㅋ 어제 경기 짤 만들었습니다', content: (team) => `${team} 어제 경기 하이라이트로 짤 만들었는데 벌써 커뮤니티에서 핫해요 ㅋㅋㅋ`, replyOptions: ['ㅋㅋ 재미있네요. 감사합니다.', '팬분들의 창작활동을 항상 응원합니다.', '다음엔 더 멋진 짤감을 만들어드리겠습니다.'] },
  { type: 'meme', subject: '감독님 표정 레전드', content: (team) => `어제 ${team} 경기 중 감독님 표정 변화가 레전드였습니다 ㅋㅋㅋ 클립 저장함`, replyOptions: ['ㅋㅋ 경기 중에는 긴장되거든요.', '다음엔 표정 관리 하겠습니다 ㅋㅋ', '경기에 몰입하다 보면 그렇게 됩니다.'] },
  { type: 'meme', subject: '팬 아트 그렸어요', content: (team) => `${team} 선수들 팬 아트 그려봤는데 보시겠어요? (붙임 파일)`, replyOptions: ['멋진 팬 아트 감사합니다!', '선수들에게 전달하겠습니다.', '팬분의 재능이 대단하네요!'] },
  { type: 'meme', subject: '우리 팀 밈 됐어요', content: (team) => `${team}이 커뮤니티에서 밈이 됐는데... 좋은 건지 나쁜 건지 모르겠어요 ㅋㅋ`, replyOptions: ['관심이 곧 인기입니다 ㅋㅋ', '밈이라도 사랑해주세요.', '좋은 경기로 인식을 바꾸겠습니다.'] },
];

export async function generateFanLetter(context: {
  teamName: string;
  recentForm: string;
  standing: number;
  isWinStreak: boolean;
  recentEvent?: string;
}): Promise<FanLetter> {
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      const prompt = `당신은 한국 LoL e스포츠 팬입니다. 좋아하는 팀의 감독에게 팬레터를 씁니다.

팀: ${context.teamName}
최근 성적: ${context.recentForm}
순위: ${context.standing}위
연승 중: ${context.isWinStreak ? '예' : '아니오'}
${context.recentEvent ? `최근 이벤트: ${context.recentEvent}` : ''}

자연스러운 한국어로 팬레터를 작성하세요. 100자 이내.
JSON 형식: {"from": "팬 닉네임", "subject": "제목 (15자 이내)", "content": "내용 (100자 이내)", "type": "support|criticism|advice|confession|meme", "replyOptions": ["답장1", "답장2", "답장3"]}`;

      const augmented = await safeAugment(prompt, `팬레터 ${context.teamName}`);
      return await chatWithLlmJson<FanLetter>(augmented, { schema: fanLetterSchema });
    } catch {
      // AI 실패 -> 폴백
    }
  }

  // 폴백: 성적 기반 타입 결정
  let typePool: FanLetter['type'][];
  if (context.isWinStreak || context.standing <= 3) {
    typePool = ['support', 'support', 'confession', 'meme', 'advice'];
  } else if (context.standing >= 8) {
    typePool = ['criticism', 'criticism', 'advice', 'support', 'meme'];
  } else {
    typePool = ['support', 'criticism', 'advice', 'meme', 'confession'];
  }

  const selectedType = pickRandom(typePool);
  const candidates = FAN_LETTER_TEMPLATES.filter(t => t.type === selectedType);
  const template = candidates.length > 0 ? pickRandom(candidates) : FAN_LETTER_TEMPLATES[0];

  return {
    from: pickRandom(FAN_NICKNAMES),
    subject: template.subject,
    content: template.content(context.teamName, context.recentForm),
    type: template.type,
    replyOptions: template.replyOptions,
  };
}
