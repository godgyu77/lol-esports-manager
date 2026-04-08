import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkOllamaStatus } from '../../ai/provider';
import { getSaveSlots, loadSave } from '../../engine/save/saveEngine';
import { loadGameIntoStore } from '../../db/initGame';
import { useBgm } from '../../hooks/useBgm';
import { exitApp } from '../../utils/windowManager';
import type { GameSave } from '../../types/game';
import './MainMenu.css';

function pickLatestSave(saves: GameSave[]): GameSave | null {
  if (saves.length === 0) return null;
  return [...saves].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))[0] ?? null;
}

function formatLastPlayedAt(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

function getSaveResumeSummary(save: GameSave): { headline: string; subline: string; stage: string } {
  const team = save.teamName ?? '미정 팀';
  const season = save.seasonInfo ?? '프리시즌';
  return {
    headline: `${team} 커리어 진행 중`,
    subline: `${season} 지점으로 바로 복귀합니다.`,
    stage: season,
  };
}

const EXPERIENCE_PILLARS = [
  '패치 대응 운영',
  '드래프트와 로스터 관리',
  '커리어 중심 진행',
] as const;

export function MainMenu() {
  const navigate = useNavigate();
  const [ollamaStatus, setOllamaStatus] = useState<boolean | null>(null);
  const [recentSave, setRecentSave] = useState<GameSave | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useBgm('menu');

  useEffect(() => {
    checkOllamaStatus().then(setOllamaStatus).catch(() => setOllamaStatus(false));
    getSaveSlots()
      .then((slots) => slots.flatMap((slot) => (slot.save ? [slot.save] : [])))
      .then((saves) => setRecentSave(pickLatestSave(saves)))
      .catch(() => setRecentSave(null));
  }, []);

  const saveSummary = useMemo(() => (
    recentSave ? getSaveResumeSummary(recentSave) : null
  ), [recentSave]);

  const handleContinue = async () => {
    if (!recentSave || continuing) return;
    setContinuing(true);
    try {
      setMessage(null);
      const loadedSave = await loadSave(recentSave.metadataId);
      await loadGameIntoStore(loadedSave.metadataId);
      navigate(loadedSave.mode === 'manager' ? '/manager' : '/player');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '세이브를 불러오는 중 문제가 발생했습니다.');
    } finally {
      setContinuing(false);
    }
  };

  const aiStatusLabel =
    ollamaStatus === null
      ? 'AI 상태 확인 중'
      : ollamaStatus
        ? '로컬 AI 사용 가능'
        : '오프라인 템플릿 모드로도 안정적으로 플레이 가능';

  return (
    <div className="launcher">
      <div className="launcher__bg" />
      <div className="launcher__overlay" />

      <div className="launcher__shell">
        <section className="launcher__hero">
          <div className="launcher__logo">
            <div className="launcher__logo-icon">
              <img
                src="/icons/icon.png"
                alt="LoL e스포츠 매니저"
                className="launcher__logo-img"
                onError={(event) => { (event.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div className="launcher__eyebrow">리그 프런트 오피스 시뮬레이션</div>
            <h1 className="launcher__title">LoL e스포츠 매니저</h1>
            <p className="launcher__subtitle">
              밴픽, 로스터, 코치진, 시즌 목표를 한 흐름으로 묶은
              <br />
              한국형 e스포츠 운영 시뮬레이션입니다.
            </p>
            <div className="launcher__pillar-row" aria-label="핵심 경험 요소">
              {EXPERIENCE_PILLARS.map((pillar) => (
                <span key={pillar} className="launcher__pillar-chip">{pillar}</span>
              ))}
            </div>
            <div className="launcher__hero-actions">
              <button className="launcher__secondary-cta" onClick={() => navigate('/mode-select')}>
                새 커리어
              </button>
              <button className="launcher__secondary-cta" onClick={() => navigate('/save-load')}>
                세이브 관리
              </button>
            </div>
          </div>
        </section>

        <section className="launcher__hub">
          <div className="launcher__continue-card">
            <div className="launcher__continue-head">
              <span className="launcher__continue-label">{recentSave ? '최근 커리어' : '새 시즌 시작'}</span>
              {recentSave && (
                <span className="launcher__continue-time">
                  마지막 저장 {formatLastPlayedAt(recentSave.updatedAt)}
                </span>
              )}
            </div>

            {recentSave && saveSummary ? (
                <>
                  <h2 className="launcher__continue-title">{saveSummary.headline}</h2>
                  <p className="launcher__continue-copy">{saveSummary.subline}</p>
                  {message && (
                    <div className="fm-alert fm-alert--warning" style={{ marginBottom: 16 }}>
                      <span className="fm-alert__text">{message}</span>
                    </div>
                  )}
                  <div className="launcher__continue-meta">
                  <span>{recentSave.mode === 'manager' ? '감독 모드' : '선수 모드'}</span>
                  <span>{saveSummary.stage}</span>
                  <span>{recentSave.saveName}</span>
                </div>
                <button
                  className="launcher__primary-cta"
                  onClick={() => void handleContinue()}
                  disabled={continuing}
                >
                  {continuing ? '불러오는 중...' : '계속 진행'}
                </button>
              </>
            ) : (
              <>
                <h2 className="launcher__continue-title">첫 커리어를 시작할 준비가 되어 있습니다</h2>
                <p className="launcher__continue-copy">
                  감독이나 선수로 새 시즌에 들어가 대회 전체를 관장하는 이야기를 만들어 보세요.
                </p>
                <div className="launcher__continue-meta">
                  <span>감독 모드 추천</span>
                  <span>프리시즌 시작</span>
                  <span>세이브 없음</span>
                </div>
                <button className="launcher__primary-cta" onClick={() => navigate('/mode-select')}>
                  새 커리어 시작
                </button>
              </>
            )}
          </div>

          <div className="launcher__menu-grid">
            <button className="launcher__menu-card" onClick={() => navigate('/mode-select')}>
              <span className="launcher__menu-kicker">새 시작</span>
              <strong>새 커리어</strong>
              <p>감독 또는 선수로 새 시즌에 들어가 첫 선택부터 시작합니다.</p>
            </button>
            <button className="launcher__menu-card" onClick={() => navigate('/save-load')}>
              <span className="launcher__menu-kicker">이어하기</span>
              <strong>세이브 관리</strong>
              <p>자동 저장과 수동 저장을 확인하고, 원하는 지점으로 정확히 복귀합니다.</p>
            </button>
            <button className="launcher__menu-card" onClick={() => navigate('/settings')}>
              <span className="launcher__menu-kicker">설정</span>
              <strong>환경 설정</strong>
              <p>로컬 AI, 사운드 볼륨, 자동 저장 옵션을 플레이 스타일에 맞춰 조정합니다.</p>
            </button>
            <button className="launcher__menu-card launcher__menu-card--danger" onClick={() => void exitApp()}>
              <span className="launcher__menu-kicker">종료</span>
              <strong>게임 종료</strong>
              <p>현재 설정과 세이브 상태를 유지한 채 프로그램을 종료합니다.</p>
            </button>
          </div>
        </section>
      </div>

      <footer className="launcher__footer">
        <div className="launcher__footer-pill">
          <span className={`launcher__status-dot ${ollamaStatus ? 'launcher__status-dot--on' : ''}`} />
          {aiStatusLabel}
        </div>
        <div className="launcher__footer-pill">버전 {__APP_VERSION__}</div>
      </footer>
    </div>
  );
}
