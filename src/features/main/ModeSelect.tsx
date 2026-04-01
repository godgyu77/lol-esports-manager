import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/gameStore';
import './ModeSelect.css';

const MODE_OPTIONS = [
  {
    id: 'manager' as const,
    icon: 'FRONT OFFICE',
    title: '감독 모드',
    difficulty: '추천 시작 방식',
    fantasy: '로스터 운영, 밴픽, 보드 목표를 손에 쥐고 시즌 전체를 설계합니다.',
    features: ['로스터와 주전 경쟁 관리', '코칭과 밴픽, 경기 운영', '팬 기대와 보드 압박 대응', '이적시장과 시즌 목표 조정'],
  },
  {
    id: 'player' as const,
    icon: 'RISING STAR',
    title: '선수 모드',
    difficulty: '추천 시작 난이도: 도전적',
    fantasy: '한 명의 선수 커리어를 따라가며 성장, 관계, 출전 경쟁을 직접 겪습니다.',
    features: ['커스텀 선수 성장', '폼과 멘탈 관리', '감독진과 팀원 관계 변화', '커리어 서사 중심 플레이'],
  },
];

export function ModeSelect() {
  const navigate = useNavigate();
  const setMode = useGameStore((s) => s.setMode);

  const selectMode = (mode: 'manager' | 'player') => {
    setMode(mode);
    navigate(mode === 'player' ? '/player-create' : '/manager-create');
  };

  return (
    <div className="mode-select">
      <div className="mode-select__hero">
        <span className="mode-select__eyebrow">CAREER ENTRY</span>
        <h1 className="mode-select__title">어떤 방식으로 시즌에 들어갈지 정해보세요</h1>
        <p className="mode-select__subtitle">
          시작 선택은 이후의 시선과 책임을 완전히 바꿉니다.
          감독으로 팀 전체를 이끌지, 선수로 커리어를 밀어 올릴지 먼저 정하는 단계입니다.
        </p>
      </div>

      <div className="mode-select__cards">
        {MODE_OPTIONS.map((option) => (
          <button key={option.id} className="mode-card" onClick={() => selectMode(option.id)}>
            <div className="mode-card__top">
              <span className="mode-card__icon">{option.icon}</span>
              <span className="mode-card__difficulty">{option.difficulty}</span>
            </div>
            <h2 className="mode-card__title">{option.title}</h2>
            <p className="mode-card__desc">{option.fantasy}</p>
            <ul className="mode-card__features">
              {option.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <span className="mode-card__cta">
              {option.id === 'manager' ? '감독 커리어 시작하기' : '선수 커리어 시작하기'}
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
