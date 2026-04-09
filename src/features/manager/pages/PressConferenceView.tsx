import { useCallback, useMemo, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  applyConferenceEffects,
  calculateConferenceResult,
  generateQuestions,
} from '../../../engine/media/pressConferenceEngine';
import type {
  ConferenceResult,
  ConferenceType,
  PressAnswer,
  PressQuestion,
} from '../../../engine/media/pressConferenceEngine';
import { MainLoopPanel } from '../components/MainLoopPanel';

type Phase = 'select_type' | 'answering' | 'result';

const CONFERENCE_TYPE_LABELS: Record<ConferenceType, string> = {
  pre_match: '경기 전 기자회견',
  post_match: '경기 후 기자회견',
  weekly: '주간 기자회견',
  transfer: '이적시장 기자회견',
  crisis: '위기 대응 기자회견',
};

const TONE_BORDER_COLORS: Record<PressAnswer['tone'], string> = {
  confident: 'var(--warning)',
  humble: 'var(--info)',
  deflect: 'var(--text-muted)',
  aggressive: 'var(--danger)',
  honest: 'var(--success)',
  evasive: 'var(--text-muted)',
};

const TONE_LABELS: Record<PressAnswer['tone'], string> = {
  confident: '자신감',
  humble: '겸손',
  deflect: '회피',
  aggressive: '공세적',
  honest: '정면승부',
  evasive: '애매함',
};

function getConferenceNarrative(result: ConferenceResult, conferenceLabel: string): string {
  const { teamMorale, publicOpinion, boardSatisfaction, rivalryIntensity } = result.totalEffects;

  const opening = `${conferenceLabel} 이후 반응은 비교적 또렷하게 갈렸습니다. 이번 발언은 단순한 멘트 정리가 아니라 선수단 분위기, 대외 여론, 구단 내부 시선까지 함께 건드린 회견으로 받아들여졌습니다.`;
  const moraleLine =
    teamMorale > 0
      ? '선수단은 감독의 메시지를 비교적 긍정적으로 받아들인 분위기입니다. 이후 집중력과 결속을 끌어올리는 쪽으로 작용할 가능성이 있습니다.'
      : teamMorale < 0
        ? '선수단에는 다소 부담이 남는 발언이 있었습니다. 표현 강도나 결이 일부 선수들에게는 압박으로 작용할 수 있습니다.'
        : '선수단 분위기를 크게 흔들 정도의 메시지는 아니었습니다. 일단은 무난하게 지나간 회견에 가깝습니다.';
  const publicLine =
    publicOpinion > 0
      ? '대외 여론은 비교적 우호적으로 움직일 가능성이 높습니다. 기사와 미디어 모두 메시지의 방향성을 일정 부분 납득한 흐름입니다.'
      : publicOpinion < 0
        ? '대중 반응은 다소 까다롭게 남을 수 있습니다. 표현 강도나 회피성 답변은 비판 기사로 번질 가능성을 배제하기 어렵습니다.'
        : '언론과 팬 반응은 일단 관망세에 가깝습니다. 결국 다음 경기 결과가 이번 회견의 해석을 다시 규정할 가능성이 높습니다.';
  const boardLine =
    boardSatisfaction > 0
      ? '구단 내부에서는 메시지 관리가 비교적 안정적이었다고 볼 수 있습니다. 추가 압박을 부를 회견은 아니었습니다.'
      : boardSatisfaction < 0
        ? '구단 내부에서는 메시지의 방향을 조금 더 조절할 필요가 있다는 시선이 남습니다. 결과가 따라주지 않으면 부담이 빠르게 커질 수 있습니다.'
        : '구단 내부 평가는 일단 보류에 가깝습니다. 발언 자체보다 이후 경기력과 분위기 관리가 더 중요해진 상황입니다.';
  const rivalryLine =
    rivalryIntensity > 0
      ? '라이벌 구도를 자극하는 메시지가 일부 포함돼 있어, 다음 맞대결과 후속 기사에서 경쟁 구도가 더 강하게 부각될 수 있습니다.'
      : '라이벌 구도를 강하게 자극하지는 않아 이번 회견은 전체적으로 조절된 톤에 가까웠습니다.';

  return [opening, moraleLine, publicLine, boardLine, rivalryLine].join('\n\n');
}

function getConferenceFollowUp(result: ConferenceResult): string[] {
  const notes: string[] = [];

  if (result.totalEffects.teamMorale > 0) notes.push('선수단 분위기: 회견 직후 팀 내부 정렬감이 조금 올라간 흐름입니다.');
  else if (result.totalEffects.teamMorale < 0) notes.push('선수단 분위기: 말의 강도가 일부 선수에게 압박으로 남을 수 있습니다.');

  if (result.totalEffects.publicOpinion > 0) notes.push('대외 반응: 기사 톤이 비교적 우호적으로 이어질 가능성이 높습니다.');
  else if (result.totalEffects.publicOpinion < 0) notes.push('대외 반응: 자극적인 표현이 비판 기사로 번질 가능성이 있습니다.');

  if (result.totalEffects.boardSatisfaction > 0) notes.push('구단 시선: 메시지 관리 측면에서 안정감을 준 회견으로 볼 수 있습니다.');
  else if (result.totalEffects.boardSatisfaction < 0) notes.push('구단 시선: 다음 경기 결과와 후속 발언이 더 중요해졌습니다.');

  if (result.totalEffects.rivalryIntensity > 0) notes.push('후속 파장: 라이벌 구도가 더 뜨거워질 가능성이 있습니다.');

  return notes.slice(0, 3);
}

export function PressConferenceView() {
  const save = useGameStore((state) => state.save);
  const season = useGameStore((state) => state.season);

  const [phase, setPhase] = useState<Phase>('select_type');
  const [conferenceType, setConferenceType] = useState<ConferenceType>('weekly');
  const [questions, setQuestions] = useState<PressQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Array<{ questionId: string; answerId: string }>>([]);
  const [result, setResult] = useState<ConferenceResult | null>(null);

  const userTeamId = save?.userTeamId;
  const seasonId = season?.id;

  const conferenceSummary = useMemo(
    () => (result ? getConferenceNarrative(result, CONFERENCE_TYPE_LABELS[conferenceType]) : ''),
    [conferenceType, result],
  );
  const followUpNotes = useMemo(() => (result ? getConferenceFollowUp(result) : []), [result]);

  const handleStartConference = useCallback((type: ConferenceType) => {
    setConferenceType(type);
    setQuestions(generateQuestions(type, 2));
    setCurrentQuestionIndex(0);
    setSelectedAnswers([]);
    setResult(null);
    setPhase('answering');
  }, []);

  const handleSelectAnswer = useCallback(
    async (answerId: string) => {
      const question = questions[currentQuestionIndex];
      if (!question) return;

      const nextAnswers = [...selectedAnswers, { questionId: question.id, answerId }];
      setSelectedAnswers(nextAnswers);

      if (currentQuestionIndex + 1 < questions.length) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        return;
      }

      const nextResult = calculateConferenceResult(conferenceType, questions, nextAnswers);
      setResult(nextResult);
      setPhase('result');

      if (userTeamId && seasonId) {
        await applyConferenceEffects(userTeamId, seasonId, nextResult);
      }
    },
    [conferenceType, currentQuestionIndex, questions, seasonId, selectedAnswers, userTeamId],
  );

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="fm-animate-in" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="fm-page-header">
        <h1 className="fm-page-title">기자회견</h1>
      </div>

      <MainLoopPanel
        eyebrow="미디어 대응"
        title="지금 해야 할 대답과 다음 파장을 먼저 읽는 허브"
        subtitle="회견 타입을 고르고, 질문에는 톤을 먼저 보고 답한 뒤, 결과 화면에서 영향과 후속 반응을 정리합니다."
        insights={[
          {
            label: '현재 단계',
            value: phase === 'select_type' ? '회견 선택' : phase === 'answering' ? '질문 답변' : '결과 정리',
            detail: phase === 'answering' ? `${currentQuestionIndex + 1}/${questions.length} 진행 중` : '한 번에 하나의 단계만 처리합니다.',
            tone: phase === 'result' ? 'accent' : 'warning',
          },
          {
            label: '회견 타입',
            value: CONFERENCE_TYPE_LABELS[conferenceType],
            detail: phase === 'select_type' ? '회견을 시작하면 질문 세트가 바로 생성됩니다.' : '현재 선택한 회견 기준으로 여론과 내부 반응이 계산됩니다.',
            tone: 'accent',
          },
          {
            label: '다음 행동',
            value: phase === 'select_type' ? '타입 선택' : phase === 'answering' ? '답변 선택' : '결과 확인',
            detail:
              phase === 'select_type'
                ? '가장 필요한 회견을 고르면 바로 질문이 시작됩니다.'
                : phase === 'answering'
                  ? '답변 톤을 보고 한 개만 고르면 됩니다.'
                  : '영향 요약과 후속 반응을 확인하고 다음 회견으로 넘어갈 수 있습니다.',
            tone: phase === 'answering' ? 'warning' : 'neutral',
          },
        ]}
        note="기자회견 화면은 긴 설명보다 현재 질문과 답변 톤이 먼저 보이도록 정리했습니다."
      />

      {phase === 'select_type' && (
        <div className="fm-flex-col fm-gap-sm">
          {(Object.keys(CONFERENCE_TYPE_LABELS) as ConferenceType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleStartConference(type)}
              className="fm-card fm-card--clickable fm-text-left"
            >
              <span className="fm-text-md fm-font-medium fm-text-primary">{CONFERENCE_TYPE_LABELS[type]}</span>
            </button>
          ))}
        </div>
      )}

      {phase === 'answering' && currentQuestion && (
        <div className="fm-flex-col fm-gap-md">
          <div className="fm-panel">
            <div className="fm-panel__body">
              <div className="fm-text-xs fm-text-muted fm-mb-sm">기자 질문</div>
              <p className="fm-text-xl fm-text-primary">{currentQuestion.question}</p>
            </div>
          </div>

          <div className="fm-flex-col fm-gap-sm">
            {currentQuestion.answers.map((answer) => (
              <button
                key={answer.id}
                type="button"
                onClick={() => void handleSelectAnswer(answer.id)}
                className="fm-card fm-card--clickable fm-text-left"
                style={{ borderColor: TONE_BORDER_COLORS[answer.tone] }}
              >
                <div className="fm-flex fm-items-center fm-gap-sm fm-mb-sm">
                  <span className="fm-badge fm-badge--default">{TONE_LABELS[answer.tone]}</span>
                </div>
                <p className="fm-text-md fm-text-secondary">{answer.text}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'result' && result && (
        <div className="fm-flex-col fm-gap-md">
          <div className="fm-panel">
            <div className="fm-panel__header">
              <span className="fm-panel__title">영향 요약</span>
            </div>
            <div className="fm-panel__body">
              <EffectRow label="팀 사기" value={result.totalEffects.teamMorale} />
              <EffectRow label="여론" value={result.totalEffects.publicOpinion} />
              <EffectRow label="보드 만족도" value={result.totalEffects.boardSatisfaction} />
              {result.totalEffects.rivalryIntensity > 0 && (
                <EffectRow label="라이벌 구도" value={result.totalEffects.rivalryIntensity} />
              )}
            </div>
          </div>

          <div className="fm-panel">
            <div className="fm-panel__header">
              <span className="fm-panel__title">기사 총평</span>
            </div>
            <div className="fm-panel__body">
              <p className="fm-text-secondary" style={{ whiteSpace: 'pre-line' }}>
                {conferenceSummary}
              </p>
            </div>
          </div>

          {followUpNotes.length > 0 && (
            <div className="fm-panel">
              <div className="fm-panel__header">
                <span className="fm-panel__title">후속 반응</span>
              </div>
              <div className="fm-panel__body">
                {followUpNotes.map((note, index) => (
                  <p key={index} className="fm-text-sm fm-text-secondary" style={{ padding: '4px 0' }}>
                    {note}
                  </p>
                ))}
              </div>
            </div>
          )}

          {result.headlines.length > 0 && (
            <div className="fm-panel">
              <div className="fm-panel__header">
                <span className="fm-panel__title">예상 헤드라인</span>
              </div>
              <div className="fm-panel__body">
                {result.headlines.map((headline, index) => (
                  <p key={index} className="fm-text-sm fm-text-secondary" style={{ padding: '4px 0' }}>
                    "{headline}"
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="fm-primary-actions">
            <button type="button" onClick={() => setPhase('select_type')} className="fm-btn fm-btn--primary">
              다시 진행하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EffectRow({ label, value }: { label: string; value: number }) {
  const colorClass = value > 0 ? 'fm-text-success' : value < 0 ? 'fm-text-danger' : 'fm-text-muted';
  const sign = value > 0 ? '+' : '';
  return (
    <div className="fm-info-row">
      <span className="fm-info-row__label">{label}</span>
      <span className={`fm-info-row__value ${colorClass}`}>
        {sign}
        {value}
      </span>
    </div>
  );
}
