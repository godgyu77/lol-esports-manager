import type React from 'react';
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

const CATEGORY_COLORS: Record<TutorialCategory, string> = {
  '기본': '#4a9eff',
  '경기': '#ff6b6b',
  '관리': '#51cf66',
  '경제': '#fcc419',
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
    <div style={styles.overlay}>
      <div style={styles.card}>
        <h2 style={styles.title}>게임 가이드</h2>

        {/* 카테고리 탭 */}
        <div style={styles.categoryRow}>
          {CATEGORIES.map((cat) => {
            const isActive = currentStep.category === cat;
            return (
              <button
                key={cat}
                style={{
                  ...styles.categoryTab,
                  background: isActive ? CATEGORY_COLORS[cat] : 'rgba(255,255,255,0.05)',
                  color: isActive ? '#0d0d1a' : '#8a8a9a',
                  fontWeight: isActive ? 700 : 400,
                }}
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
        <div style={styles.progressBarBg}>
          <div
            style={{
              ...styles.progressBarFill,
              width: `${progress}%`,
            }}
          />
        </div>
        <div style={styles.progressText}>
          {step + 1} / {TUTORIAL_STEPS.length}
        </div>

        {/* 단계 내용 */}
        <div style={styles.stepContent}>
          <div style={styles.stepHeader}>
            <span
              style={{
                ...styles.categoryBadge,
                background: CATEGORY_COLORS[currentStep.category],
              }}
            >
              {currentStep.category}
            </span>
            <h3 style={styles.stepTitle}>{currentStep.title}</h3>
          </div>
          <p style={styles.stepDescription}>{currentStep.description}</p>
        </div>

        {/* 해당 페이지로 이동 */}
        <button style={styles.navigateBtn} onClick={handleNavigate}>
          해당 페이지로 이동
        </button>

        {/* 하단 버튼 */}
        <div style={styles.buttonRow}>
          <button style={styles.skipBtn} onClick={handleSkip}>
            건너뛰기
          </button>
          <div style={styles.navButtons}>
            <button
              style={{
                ...styles.prevBtn,
                opacity: step === 0 ? 0.3 : 1,
                cursor: step === 0 ? 'default' : 'pointer',
              }}
              onClick={handlePrev}
              disabled={step === 0}
            >
              이전
            </button>
            <button style={styles.nextBtn} onClick={handleNext}>
              {step < TUTORIAL_STEPS.length - 1 ? '다음' : '시작하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    background: '#1a1a3a',
    border: '2px solid #c89b3c',
    borderRadius: '16px',
    padding: '40px',
    textAlign: 'center',
    minWidth: '480px',
    maxWidth: '560px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#f0e6d2',
    marginBottom: '20px',
  },
  categoryRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  categoryTab: {
    padding: '6px 14px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  progressBarBg: {
    width: '100%',
    height: '6px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '4px',
  },
  progressBarFill: {
    height: '100%',
    background: '#c89b3c',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '12px',
    color: '#6a6a7a',
    marginBottom: '20px',
  },
  stepContent: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
    minHeight: '100px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
  },
  categoryBadge: {
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#0d0d1a',
  },
  stepTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#f0e6d2',
    margin: 0,
  },
  stepDescription: {
    fontSize: '15px',
    lineHeight: '1.7',
    color: '#d0d0e0',
    margin: 0,
    textAlign: 'center',
  },
  navigateBtn: {
    width: '100%',
    padding: '10px',
    background: 'rgba(200,155,60,0.15)',
    border: '1px solid rgba(200,155,60,0.3)',
    borderRadius: '8px',
    color: '#c89b3c',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: '20px',
    transition: 'background 0.2s',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipBtn: {
    padding: '10px 20px',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.05)',
    color: '#8a8a9a',
    fontSize: '14px',
    cursor: 'pointer',
  },
  navButtons: {
    display: 'flex',
    gap: '8px',
  },
  prevBtn: {
    padding: '10px 20px',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.05)',
    color: '#a0a0b0',
    fontSize: '14px',
    cursor: 'pointer',
  },
  nextBtn: {
    padding: '10px 28px',
    background: '#c89b3c',
    color: '#0d0d1a',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
