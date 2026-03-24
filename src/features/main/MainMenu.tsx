import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { checkOllamaStatus } from '../../ai/provider';
import { useSettingsStore } from '../../stores/settingsStore';
import { applyWindowMode, exitApp } from '../../utils/windowManager';
import { useBgm } from '../../hooks/useBgm';
import './MainMenu.css';

export function MainMenu() {
  const navigate = useNavigate();
  const [ollamaStatus, setOllamaStatus] = useState<boolean | null>(null);
  const windowMode = useSettingsStore((s) => s.windowMode);

  useBgm('menu');

  useEffect(() => {
    checkOllamaStatus()
      .then(setOllamaStatus)
      .catch(() => setOllamaStatus(false));
  }, []);

  // 시작 시 저장된 창모드 적용
  useEffect(() => {
    applyWindowMode(windowMode);
  }, []);

  const handleExit = async () => {
    await exitApp();
  };

  return (
    <div className="launcher">
      {/* 배경 파티클/오버레이 */}
      <div className="launcher__bg" />
      <div className="launcher__overlay" />

      {/* 로고 */}
      <div className="launcher__logo">
        <div className="launcher__logo-icon">
          <img
            src="/icons/icon.png"
            alt="LoL ESM"
            className="launcher__logo-img"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        <h1 className="launcher__title">LoL Esports Manager</h1>
        <p className="launcher__subtitle">e스포츠 구단 매니지먼트 시뮬레이션</p>
      </div>

      {/* 메인 버튼 */}
      <div className="launcher__buttons">
        <button
          className="launcher__btn launcher__btn--primary"
          onClick={() => navigate('/mode-select')}
        >
          <span className="launcher__btn-icon">&#9654;</span>
          새 게임
        </button>
        <button className="launcher__btn" onClick={() => navigate('/save-load')}>
          <span className="launcher__btn-icon">&#128190;</span>
          불러오기
        </button>
        <button className="launcher__btn" onClick={() => navigate('/settings')}>
          <span className="launcher__btn-icon">&#9881;</span>
          설정
        </button>
        <button className="launcher__btn launcher__btn--exit" onClick={handleExit}>
          <span className="launcher__btn-icon">&#10005;</span>
          종료
        </button>
      </div>

      {/* AI 상태 + 버전 */}
      <div className="launcher__footer">
        <div className="launcher__ai-status">
          <span className={`launcher__status-dot ${ollamaStatus ? 'launcher__status-dot--on' : ''}`} />
          {ollamaStatus === null
            ? 'AI 상태 확인 중...'
            : ollamaStatus
              ? 'AI 엔진 연결됨'
              : 'AI 오프라인 (템플릿 모드)'}
        </div>
        <span className="launcher__version">v{__APP_VERSION__}</span>
      </div>
    </div>
  );
}
