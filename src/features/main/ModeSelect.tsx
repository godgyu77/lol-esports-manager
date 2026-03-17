import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/gameStore';
import './ModeSelect.css';

export function ModeSelect() {
  const navigate = useNavigate();
  const setMode = useGameStore((s) => s.setMode);

  const selectMode = (mode: 'manager' | 'player') => {
    setMode(mode);
    if (mode === 'player') {
      navigate('/player-create');
    } else {
      navigate('/team-select');
    }
  };

  return (
    <div className="mode-select">
      <h1 className="mode-select__title">게임 모드 선택</h1>

      <div className="mode-select__cards">
        <button className="mode-card" onClick={() => selectMode('manager')}>
          <div className="mode-card__icon">🏢</div>
          <h2 className="mode-card__title">감독 모드</h2>
          <p className="mode-card__desc">
            팀 전체를 운영합니다. 로스터 편성, 밴픽 지시, 재정 관리, 전술 설정 등
            거시적 관점에서 팀을 이끌어 보세요.
          </p>
          <ul className="mode-card__features">
            <li>로스터 편성 및 이적 시장</li>
            <li>밴픽 전략 수립</li>
            <li>샐러리캡 및 재정 관리</li>
            <li>코치진 관리</li>
          </ul>
        </button>

        <button className="mode-card" onClick={() => selectMode('player')}>
          <div className="mode-card__icon">🎮</div>
          <h2 className="mode-card__title">선수 모드</h2>
          <p className="mode-card__desc">
            나만의 선수를 만들어 프로 리그에 도전합니다. 훈련, 멘탈 관리, 감독과의
            관계 등 선수의 삶을 경험하세요.
          </p>
          <ul className="mode-card__features">
            <li>커스텀 선수 생성</li>
            <li>일과 스케줄 관리</li>
            <li>감독/팀원과의 관계</li>
            <li>은퇴 후 감독 전향 가능</li>
          </ul>
        </button>
      </div>

      <button className="mode-select__back" onClick={() => navigate('/')}>
        ← 돌아가기
      </button>
    </div>
  );
}
