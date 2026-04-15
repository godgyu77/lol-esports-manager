import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../../stores/settingsStore';
import type { SettingsState } from '../../stores/settingsStore';

interface TutorialMission {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  route: string;
  cta: string;
}

const TUTORIAL_MISSIONS: TutorialMission[] = [
  {
    id: 'day',
    eyebrow: '첫 일정',
    title: '오늘 해야 할 일부터 보기',
    summary: 'DayView에서 오늘 경기와 다음 행동을 먼저 보면 전체 루프가 가장 빨리 잡힙니다.',
    route: '/manager/day',
    cta: '오늘 일정 보기',
  },
  {
    id: 'roster',
    eyebrow: '주전 확인',
    title: '주전 5인 상태 확인하기',
    summary: '로스터 화면에서 주전 5인의 컨디션과 역할만 확인해도 첫 세션 이해도가 크게 올라갑니다.',
    route: '/manager/roster',
    cta: '주전 5인 보기',
  },
  {
    id: 'tactics',
    eyebrow: '경기 준비',
    title: '상대 분석과 전술 메모 보기',
    summary: '전술 화면에서 추천 밴과 운영 방향을 보고 나면 첫 경기 준비가 훨씬 자연스럽게 느껴집니다.',
    route: '/manager/tactics',
    cta: '상대 분석 보기',
  },
];

export function TutorialOverlay() {
  const navigate = useNavigate();
  const setTutorialComplete = useSettingsStore((s: SettingsState) => s.setTutorialComplete);

  const handleMissionClick = (route: string) => {
    setTutorialComplete(true);
    navigate(route);
  };

  const handleSkip = () => {
    setTutorialComplete(true);
  };

  return (
    <div className="fm-overlay">
      <div className="fm-modal fm-animate-in" style={{ minWidth: 480, maxWidth: 680 }}>
        <div className="fm-modal__header">
          <div>
            <div className="fm-text-xs fm-font-semibold fm-text-accent fm-text-upper">첫 세션 미션</div>
            <span className="fm-modal__title fm-text-xl">읽지 말고 바로 눌러서 익히세요</span>
          </div>
        </div>

        <div className="fm-modal__body fm-flex-col fm-gap-md">
          <div className="fm-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="fm-text-sm fm-text-secondary" style={{ lineHeight: 1.7 }}>
              처음에는 모든 화면을 볼 필요가 없습니다. 아래 미션 중 하나만 골라도 첫 경기 준비 루프를 바로 이해할 수 있습니다.
            </div>
          </div>

          <div className="fm-flex-col fm-gap-sm">
            {TUTORIAL_MISSIONS.map((mission, index) => (
              <div key={mission.id} className="fm-card fm-flex fm-justify-between fm-items-center fm-gap-md" style={{ flexWrap: 'wrap' }}>
                <div className="fm-flex-col fm-gap-xs" style={{ minWidth: 0, flex: '1 1 320px' }}>
                  <div className="fm-flex fm-items-center fm-gap-sm" style={{ flexWrap: 'wrap' }}>
                    <span className="fm-badge fm-badge--accent">{mission.eyebrow}</span>
                    <span className="fm-text-xs fm-text-muted">미션 {index + 1}</span>
                  </div>
                  <strong className="fm-text-primary">{mission.title}</strong>
                  <p className="fm-text-sm fm-text-secondary" style={{ margin: 0, lineHeight: 1.6 }}>
                    {mission.summary}
                  </p>
                </div>
                <button
                  type="button"
                  className={`fm-btn ${index === 0 ? 'fm-btn--primary' : 'fm-btn--sm'}`}
                  onClick={() => handleMissionClick(mission.route)}
                >
                  {mission.cta}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="fm-modal__footer fm-justify-between">
          <span className="fm-text-xs fm-text-muted">나머지 기능은 홈과 대시보드에서 천천히 다시 볼 수 있습니다.</span>
          <button className="fm-btn fm-btn--ghost" onClick={handleSkip}>
            나중에 볼게요
          </button>
        </div>
      </div>
    </div>
  );
}
