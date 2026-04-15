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
    icon: '구단 운영',
    title: '감독 모드',
    difficulty: '빠른 시작 추천',
    fantasy: '로스터, 전술, 예산, 시즌 목표를 모두 조율하며 한 시즌 전체를 직접 운영합니다.',
    features: ['팀 선택 후 바로 시즌 목표로 이동', '전술과 훈련 방향 설정', '보드 요구와 시즌 목표 조정'],
    availability: 'available',
  },
  {
    id: 'player',
    icon: '개인 선수',
    title: '선수 모드',
    difficulty: '준비 중',
    fantasy: '선수 커리어 시작은 아직 준비 중이지만, 어떤 경험이 올지 미리 확인할 수 있습니다.',
    features: ['기존 플레이어 데이터 불러오기 가능', '신규 선수 커리어 시작은 추후 지원', '현재 EA에서는 감독 루프에 집중'],
    availability: 'coming_soon',
    availabilityLabel: '준비 중',
    disabledReason: '선수 모드는 아직 준비 중입니다. 지금은 감독 모드로 바로 시즌을 시작할 수 있습니다.',
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
        <span className="mode-select__eyebrow">커리어 시작</span>
        <h1 className="mode-select__title">가장 빠른 시작 루트를 먼저 고르세요</h1>
        <p className="mode-select__subtitle">
          감독 모드는 바로 시작 가능하고, 선수 모드는 준비 중입니다. 선택 후 다음 화면에서 팀과 목표를 이어서 고르면 됩니다.
        </p>
      </div>

      <section className="mode-select__quickstart" aria-label="빠른 시작 안내">
        <div className="mode-select__quickstart-copy">
          <span className="mode-select__quickstart-badge">빠른 시작</span>
          <strong>감독 모드 - 추천 스타트 패스 - 첫 경기 준비</strong>
          <p>설정은 나중에 더 만질 수 있습니다. 지금은 5분 안에 첫 경기 준비까지 가는 쪽이 가장 재미를 느끼기 좋습니다.</p>
        </div>
      </section>

      {message && (
        <div className="fm-alert fm-alert--warning" style={{ marginBottom: 20 }}>
          <span className="fm-alert__text">{message}</span>
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
              {option.availability === 'available' ? '감독 커리어 바로 시작' : '준비 중'}
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
