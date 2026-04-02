import { useNavigate } from 'react-router-dom';

export function PlayerCreate() {
  const navigate = useNavigate();

  return (
    <div className="fm-content fm-flex-col fm-items-center intro-page">
      <div className="intro-shell" style={{ maxWidth: 760 }}>
        <header className="fm-panel intro-hero intro-panel-soft">
          <div className="fm-panel__body" style={{ padding: 28 }}>
            <div className="fm-text-xs fm-font-semibold fm-text-accent fm-text-upper fm-mb-sm">Phase 0 Notice</div>
            <h1 className="fm-text-2xl fm-font-bold fm-text-primary" style={{ margin: 0 }}>
              선수 모드 신규 시작은 아직 열려 있지 않습니다
            </h1>
            <p className="fm-text-md fm-text-muted fm-mt-sm" style={{ lineHeight: 1.7 }}>
              이번 EA 준비 단계에서는 새 커리어 시작, 팀 선택, 초기 세팅, 시즌 진행, 경기, 저장과 불러오기로 이어지는
              감독 모드 핵심 루프 안정화에 우선 집중하고 있습니다.
            </p>
          </div>
        </header>

        <section className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">현재 정책</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            <div className="fm-badge fm-badge--warning" style={{ width: 'fit-content' }}>EA 비대상</div>
            <p className="fm-text-md fm-text-secondary" style={{ lineHeight: 1.7 }}>
              기존 player 세이브는 계속 불러올 수 있지만, 신규 선수 커리어 시작은 Phase 0 범위 밖입니다.
              지금 바로 플레이하려면 감독 모드로 시작하는 것을 권장합니다.
            </p>
            <ul className="fm-text-sm fm-text-muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              <li>감독 모드는 EA 핵심 루프로 계속 지원됩니다.</li>
              <li>선수 모드 신규 시작은 이후 Phase에서 다시 열 예정입니다.</li>
              <li>기존 저장을 통한 player 커리어 복귀는 유지됩니다.</li>
            </ul>
          </div>
        </section>

        <div className="fm-flex fm-gap-sm fm-flex-wrap fm-mt-md">
          <button className="fm-btn fm-btn--primary" onClick={() => navigate('/manager-create')}>
            감독 모드로 시작하기
          </button>
          <button className="fm-btn fm-btn--ghost" onClick={() => navigate('/mode-select')}>
            모드 선택으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
