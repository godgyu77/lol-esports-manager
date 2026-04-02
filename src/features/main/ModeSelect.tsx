import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameMode, ModeAvailability } from '../../types/game';
import { useGameStore } from '../../stores/gameStore';
import './ModeSelect.css';

interface ModeOption {
  id: GameMode;
  icon: string;
  title: string;
  difficulty: string;
  fantasy: string;
  features: string[];
  availability: ModeAvailability;
  availabilityLabel?: string;
  disabledReason?: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    id: 'manager',
    icon: 'FRONT OFFICE',
    title: '감독 모드',
    difficulty: '추천 시작 방식',
    fantasy: '로스터, 코치진, 예산, 보드 목표를 모두 관리하며 시즌 전체를 운영합니다.',
    features: ['로스터와 주전 경쟁 관리', '코치와 전술, 훈련 운영', '보드 요구와 팀 분위기 조율', '이적시장과 시즌 목표 조정'],
    availability: 'available',
  },
  {
    id: 'player',
    icon: 'RISING STAR',
    title: '선수 모드',
    difficulty: 'EA 범위 밖',
    fantasy: '기존 세이브 로드는 유지되지만, 신규 선수 커리어 시작은 Phase 0에서 잠시 막아둡니다.',
    features: ['기존 player 세이브는 계속 불러오기 가능', '새 커리어 시작은 정식 구현 전까지 차단', '이번 EA는 감독 루프 안정화에 집중', '매니저 모드로 바로 플레이 가능'],
    availability: 'coming_soon',
    availabilityLabel: '준비 중',
    disabledReason: '선수 모드 신규 시작은 아직 준비 중입니다. 이번 EA는 감독 모드 핵심 루프에 집중합니다.',
  },
];

export function ModeSelect() {
  const navigate = useNavigate();
  const setMode = useGameStore((s) => s.setMode);
  const [message, setMessage] = useState<string | null>(null);

  const selectMode = (option: ModeOption) => {
    if (option.availability === 'coming_soon') {
      setMessage(option.disabledReason ?? '아직 준비 중인 모드입니다.');
      return;
    }

    setMessage(null);
    setMode(option.id);
    navigate(option.id === 'player' ? '/player-create' : '/manager-create');
  };

  return (
    <div className="mode-select">
      <div className="mode-select__hero">
        <span className="mode-select__eyebrow">CAREER ENTRY</span>
        <h1 className="mode-select__title">어떤 방식으로 시즌에 들어갈지 정해보세요</h1>
        <p className="mode-select__subtitle">
          이번 Phase 0에서는 EA 핵심 루프인 감독 커리어를 우선 안정화했습니다.
          선수 모드는 메뉴에서 계속 볼 수 있지만, 신규 시작은 아직 열어두지 않았습니다.
        </p>
      </div>

      {message && (
        <div className="fm-alert fm-alert--warning" style={{ marginBottom: 20 }}>
          <span className="fm-alert__text">{message} 매니저 모드로 시작하는 것을 추천합니다.</span>
        </div>
      )}

      <div className="mode-select__cards">
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.id}
            className="mode-card"
            onClick={() => selectMode(option)}
            aria-disabled={option.availability === 'coming_soon'}
          >
            <div className="mode-card__top">
              <span className="mode-card__icon">{option.icon}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="mode-card__difficulty">{option.difficulty}</span>
                {option.availabilityLabel && (
                  <span className="fm-badge fm-badge--warning">{option.availabilityLabel}</span>
                )}
              </div>
            </div>
            <h2 className="mode-card__title">{option.title}</h2>
            <p className="mode-card__desc">{option.fantasy}</p>
            <ul className="mode-card__features">
              {option.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <span className="mode-card__cta">
              {option.availability === 'available' ? '감독 커리어 시작하기' : 'EA 비대상'}
            </span>
          </button>
        ))}
      </div>

      <button className="mode-select__back" onClick={() => navigate('/')}>
        메인 메뉴로 돌아가기
      </button>
    </div>
  );
}
