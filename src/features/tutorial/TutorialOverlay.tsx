import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../../stores/settingsStore';

// ─────────────────────────────────────────
// 튜토리얼 단계 정의
// ─────────────────────────────────────────

type TutorialCategory = '기본' | '경기' | '관리' | '경제';

interface TutorialStep {
  title: string;
  description: string;
  page: string;
  category: TutorialCategory;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  // 기본
  { title: '시즌 진행', description: '시즌 진행 페이지에서 "다음 날" 버튼으로 하루씩 진행합니다. 경기일에는 밴픽과 라이브 경기가 진행됩니다.', page: '/manager/day', category: '기본' },
  { title: '로스터 관리', description: '1군/2군 선수를 관리하고, 포지션별 주전을 배치합니다.', page: '/manager/roster', category: '기본' },
  { title: '대시보드', description: '팀의 전반적인 현황을 한눈에 확인할 수 있습니다. 알림을 통해 긴급한 사안을 파악하세요.', page: '/manager', category: '기본' },
  // 경기
  { title: '밴픽', description: '프로 리그 표준 밴픽 시스템입니다. AI 추천을 참고하여 전략적으로 챔피언을 선택하세요.', page: '/manager/draft', category: '경기' },
  { title: '라이브 경기', description: '실시간으로 경기가 진행됩니다. 속도 조절과 전술 선택이 가능합니다.', page: '/manager/match', category: '경기' },
  { title: '전술 설정', description: '초반/중반/후반 전략과 오브젝트 우선순위를 설정합니다. 전술은 경기 결과에 직접 영향을 줍니다.', page: '/manager/tactics', category: '경기' },
  // 관리
  { title: '훈련', description: '주간 훈련 스케줄과 선수별 개별 훈련을 설정합니다. 강도에 따라 성장 속도와 컨디션이 달라집니다.', page: '/manager/training', category: '관리' },
  { title: '스태프', description: '감독, 코치, 분석관, 스카우트 매니저를 고용하여 팀 효율을 높입니다.', page: '/manager/staff', category: '관리' },
  { title: '스카우팅', description: '스카우트를 배정하여 타팀 선수를 조사합니다. 정확도는 스카우트 능력에 따라 달라집니다.', page: '/manager/scouting', category: '관리' },
  { title: '아카데미', description: '유망주를 육성하고, 시즌 오프에 신인을 드래프트합니다.', page: '/manager/academy', category: '관리' },
  { title: '선수 관리', description: '선수 불만을 관리하고, 출전 시간/연봉/이적 요구에 대응합니다.', page: '/manager/complaints', category: '관리' },
  // 경제
  { title: '이적 시장', description: '자유계약 선수를 영입하거나, AI 팀의 이적 제안에 대응합니다.', page: '/manager/transfer', category: '경제' },
  { title: '재정 관리', description: '팀 예산, 연봉 상한, 스폰서십을 관리합니다. 적자를 피하세요!', page: '/manager/finance', category: '경제' },
  { title: '시설 투자', description: '게이밍 하우스, 훈련실 등을 업그레이드하여 팀 효율을 높입니다.', page: '/manager/facility', category: '경제' },
  { title: '구단 기대치', description: '구단주의 시즌 목표를 달성하세요. 만족도가 너무 낮으면 해고될 수 있습니다.', page: '/manager/board', category: '경제' },
];

const CATEGORIES: TutorialCategory[] = ['기본', '경기', '관리', '경제'];

const CATEGORY_BADGE_CLASS: Record<TutorialCategory, string> = {
  '기본': 'fm-badge--info',
  '경기': 'fm-badge--danger',
  '관리': 'fm-badge--success',
  '경제': 'fm-badge--warning',
};

export function TutorialOverlay() {
  const [step, setStep] = useState(0);
  const setTutorialComplete = useSettingsStore((s) => s.setTutorialComplete);
  const navigate = useNavigate();

  const currentStep = TUTORIAL_STEPS[step];
  const progress = ((step + 1) / TUTORIAL_STEPS.length) * 100;

  const handleNext = () => {
    if (step < TUTORIAL_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      setTutorialComplete(true);
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSkip = () => {
    setTutorialComplete(true);
  };

  const handleNavigate = () => {
    setTutorialComplete(true);
    navigate(currentStep.page);
  };

  return (
    <div className="fm-overlay">
      <div className="fm-modal fm-animate-in" style={{ minWidth: 480, maxWidth: 560 }}>
        <div className="fm-modal__header fm-justify-center">
          <span className="fm-modal__title fm-text-xl">게임 가이드</span>
        </div>

        <div className="fm-modal__body fm-flex-col fm-gap-md">
          {/* 카테고리 탭 */}
          <div className="fm-flex fm-justify-center fm-gap-sm">
            {CATEGORIES.map((cat) => {
              const isActive = currentStep.category === cat;
              return (
                <button
                  key={cat}
                  className={`fm-btn fm-btn--sm ${isActive ? CATEGORY_BADGE_CLASS[cat].replace('fm-badge', 'fm-btn') : ''}`}
                  style={isActive ? { fontWeight: 700 } : { background: 'transparent' }}
                  onClick={() => {
                    const idx = TUTORIAL_STEPS.findIndex((s) => s.category === cat);
                    if (idx >= 0) setStep(idx);
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* 진행률 바 */}
          <div>
            <div className="fm-bar">
              <div className="fm-bar__track" style={{ height: 6 }}>
                <div
                  className="fm-bar__fill fm-bar__fill--accent"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="fm-bar__value fm-text-xs fm-text-muted">
                {step + 1} / {TUTORIAL_STEPS.length}
              </span>
            </div>
          </div>

          {/* 단계 내용 */}
          <div className="fm-card fm-flex-col fm-items-center fm-justify-center fm-text-center fm-p-lg" style={{ minHeight: 100 }}>
            <div className="fm-flex fm-items-center fm-gap-sm fm-mb-md">
              <span className={`fm-badge ${CATEGORY_BADGE_CLASS[currentStep.category]}`}>
                {currentStep.category}
              </span>
              <h3 className="fm-text-xl fm-font-bold fm-text-primary" style={{ margin: 0 }}>
                {currentStep.title}
              </h3>
            </div>
            <p className="fm-text-lg fm-text-secondary" style={{ lineHeight: 1.7, margin: 0 }}>
              {currentStep.description}
            </p>
          </div>

          {/* 해당 페이지로 이동 */}
          <button
            className="fm-btn fm-btn--lg"
            style={{ width: '100%', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
            onClick={handleNavigate}
          >
            해당 페이지로 이동
          </button>
        </div>

        {/* 하단 버튼 */}
        <div className="fm-modal__footer fm-justify-between">
          <button className="fm-btn fm-btn--ghost" onClick={handleSkip}>
            건너뛰기
          </button>
          <div className="fm-flex fm-gap-sm">
            <button
              className="fm-btn"
              onClick={handlePrev}
              disabled={step === 0}
            >
              이전
            </button>
            <button className="fm-btn fm-btn--primary" onClick={handleNext}>
              {step < TUTORIAL_STEPS.length - 1 ? '다음' : '시작하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
