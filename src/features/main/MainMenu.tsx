import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { checkOllamaStatus } from '../../ai/provider';
import './MainMenu.css';

export function MainMenu() {
  const navigate = useNavigate();
  const [ollamaStatus, setOllamaStatus] = useState<boolean | null>(null);

  useEffect(() => {
    checkOllamaStatus().then(setOllamaStatus);
  }, []);

  return (
    <div className="main-menu">
      <div className="main-menu__title">
        <h1>LoL Esports Manager</h1>
        <p className="main-menu__subtitle">e스포츠 구단 매니지먼트 시뮬레이션</p>
      </div>

      <div className="main-menu__buttons">
        <button
          className="main-menu__btn main-menu__btn--primary"
          onClick={() => navigate('/mode-select')}
        >
          새 게임
        </button>
        <button className="main-menu__btn" onClick={() => navigate('/save-load')}>
          불러오기
        </button>
        <button className="main-menu__btn" onClick={() => navigate('/settings')}>
          설정
        </button>
      </div>

      <div className="main-menu__status">
        <span
          className={`status-dot ${ollamaStatus ? 'status-dot--online' : 'status-dot--offline'}`}
        />
        {ollamaStatus === null
          ? 'AI 상태 확인 중...'
          : ollamaStatus
            ? 'AI 엔진 연결됨'
            : 'AI 엔진 오프라인 (템플릿 모드로 진행 가능)'}
      </div>
    </div>
  );
}
