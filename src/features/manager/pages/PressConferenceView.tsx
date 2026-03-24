/**
 * 기자회견 뷰
 * - 질문 표시 → 답변 선택 → 결과 확인
 */

import { useState, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  generateQuestions,
  calculateConferenceResult,
  applyConferenceEffects,
} from '../../../engine/media/pressConferenceEngine';
import type {
  ConferenceType,
  PressQuestion,
  PressAnswer,
  ConferenceResult,
} from '../../../engine/media/pressConferenceEngine';

type Phase = 'select_type' | 'answering' | 'result';

const CONFERENCE_TYPE_LABELS: Record<ConferenceType, string> = {
  pre_match: '경기 전 기자회견',
  post_match: '경기 후 기자회견',
  weekly: '주간 기자회견',
  transfer: '이적 시장 기자회견',
  crisis: '위기 기자회견',
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
  aggressive: '공격적',
  honest: '솔직',
  evasive: '애매하게',
};

export function PressConferenceView() {
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);

  const [phase, setPhase] = useState<Phase>('select_type');
  const [conferenceType, setConferenceType] = useState<ConferenceType>('weekly');
  const [questions, setQuestions] = useState<PressQuestion[]>([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ questionId: string; answerId: string }[]>([]);
  const [result, setResult] = useState<ConferenceResult | null>(null);

  const userTeamId = save?.userTeamId;
  const seasonId = season?.id;

  const handleStartConference = useCallback((type: ConferenceType) => {
    setConferenceType(type);
    const qs = generateQuestions(type, 2);
    setQuestions(qs);
    setCurrentQIdx(0);
    setSelectedAnswers([]);
    setResult(null);
    setPhase('answering');
  }, []);

  const handleSelectAnswer = useCallback(async (answerId: string) => {
    const question = questions[currentQIdx];
    if (!question) return;

    const newAnswers = [...selectedAnswers, { questionId: question.id, answerId }];
    setSelectedAnswers(newAnswers);

    if (currentQIdx + 1 < questions.length) {
      setCurrentQIdx(currentQIdx + 1);
    } else {
      // 모든 질문 완료 → 결과 계산
      const confResult = calculateConferenceResult(conferenceType, questions, newAnswers);
      setResult(confResult);
      setPhase('result');

      // 효과 적용
      if (userTeamId && seasonId) {
        await applyConferenceEffects(userTeamId, seasonId, confResult);
      }
    }
  }, [questions, currentQIdx, selectedAnswers, conferenceType, userTeamId, seasonId]);

  return (
    <div className="fm-animate-in" style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div className="fm-page-header">
        <h1 className="fm-page-title">기자회견</h1>
      </div>

      {phase === 'select_type' && (
        <div>
          <p className="fm-text-sm fm-text-muted fm-mb-md">기자회견 유형을 선택하세요.</p>
          <div className="fm-flex-col fm-gap-sm">
            {(Object.keys(CONFERENCE_TYPE_LABELS) as ConferenceType[]).map((type) => (
              <button
                key={type}
                onClick={() => handleStartConference(type)}
                className="fm-card fm-card--clickable fm-text-left"
              >
                <span className="fm-text-md fm-font-medium fm-text-primary">{CONFERENCE_TYPE_LABELS[type]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'answering' && questions[currentQIdx] && (
        <div>
          <div className="fm-text-sm fm-text-muted fm-mb-md">
            {CONFERENCE_TYPE_LABELS[conferenceType]} -- 질문 {currentQIdx + 1}/{questions.length}
          </div>

          {/* 질문 */}
          <div className="fm-panel fm-mb-md">
            <div className="fm-panel__body">
              <div className="fm-text-xs fm-text-muted fm-mb-sm">기자 질문</div>
              <p className="fm-text-xl fm-text-primary">{questions[currentQIdx].question}</p>
            </div>
          </div>

          {/* 답변 옵션 */}
          <div className="fm-flex-col fm-gap-sm">
            {questions[currentQIdx].answers.map((answer) => (
              <button
                key={answer.id}
                onClick={() => handleSelectAnswer(answer.id)}
                className="fm-card fm-card--clickable fm-text-left"
                style={{ borderColor: TONE_BORDER_COLORS[answer.tone] }}
              >
                <div className="fm-flex fm-items-center fm-gap-sm fm-mb-sm">
                  <span className="fm-badge fm-badge--default">
                    {TONE_LABELS[answer.tone]}
                  </span>
                </div>
                <p className="fm-text-md fm-text-secondary">{answer.text}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'result' && result && (
        <div>
          <div className="fm-text-sm fm-text-muted fm-mb-md">{CONFERENCE_TYPE_LABELS[conferenceType]} 결과</div>

          {/* 효과 요약 */}
          <div className="fm-panel fm-mb-md">
            <div className="fm-panel__header">
              <span className="fm-panel__title">효과</span>
            </div>
            <div className="fm-panel__body">
              <EffectRow label="팀 사기" value={result.totalEffects.teamMorale} />
              <EffectRow label="여론" value={result.totalEffects.publicOpinion} />
              <EffectRow label="구단주 만족도" value={result.totalEffects.boardSatisfaction} />
              {result.totalEffects.rivalryIntensity > 0 && (
                <EffectRow label="라이벌 관계" value={result.totalEffects.rivalryIntensity} />
              )}
            </div>
          </div>

          {/* 뉴스 헤드라인 */}
          {result.headlines.length > 0 && (
            <div className="fm-panel fm-mb-md">
              <div className="fm-panel__header">
                <span className="fm-panel__title">뉴스 헤드라인</span>
              </div>
              <div className="fm-panel__body">
                {result.headlines.map((h, i) => (
                  <p key={i} className="fm-text-sm fm-text-secondary" style={{ padding: '4px 0' }}>"{h}"</p>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setPhase('select_type')}
            className="fm-btn fm-btn--primary"
          >
            돌아가기
          </button>
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
      <span className={`fm-info-row__value ${colorClass}`}>{sign}{value}</span>
    </div>
  );
}
