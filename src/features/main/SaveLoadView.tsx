import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameSave, SaveSlot } from '../../types/game';
import { useGameStore } from '../../stores/gameStore';
import {
  createManualSaveFromCurrent,
  deleteSave,
  getSaveSlots,
  loadSave,
} from '../../engine/save/saveEngine';
import { loadGameIntoStore } from '../../db/initGame';
import './introFlow.css';

type ViewMode = 'save' | 'load';

function formatPlayTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function buildSaveSummary(save: GameSave): { stage: string; focus: string } {
  return {
    stage: save.seasonInfo ?? '프리시즌',
    focus: save.teamName
      ? `${save.teamName} 운영 중`
      : (save.mode === 'manager' ? '감독 커리어 진행 중' : '선수 커리어 진행 중'),
  };
}

function getReadableErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function SaveLoadView() {
  const navigate = useNavigate();
  const save = useGameStore((state) => state.save);

  const [slots, setSlots] = useState<SaveSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(save ? 'save' : 'load');
  const [message, setMessage] = useState<string | null>(null);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(messageTimerRef.current), []);

  const isInGame = save !== null;

  const fetchSlots = async () => {
    try {
      setLoading(true);
      setSlots(await getSaveSlots());
    } catch (error) {
      console.error('failed to fetch save slots:', error);
      setMessage(getReadableErrorMessage(error, '세이브 목록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSlots();
  }, []);

  const showMessage = (nextMessage: string) => {
    clearTimeout(messageTimerRef.current);
    setMessage(nextMessage);
    messageTimerRef.current = setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async (slotNumber: number) => {
    if (!isInGame || processing) return;

    const slotName = slotNumber === 0 ? '자동 저장' : `세이브 슬롯 ${slotNumber}`;
    const existing = slots.find((slot) => slot.slotNumber === slotNumber)?.save;
    if (existing && !window.confirm(`${slotName}에 기존 커리어가 있습니다. 덮어쓰시겠습니까?`)) return;

    try {
      setProcessing(true);
      await createManualSaveFromCurrent(slotNumber, slotNumber === 0 ? '자동 저장' : `수동 저장 ${slotNumber}`);
      showMessage(`${slotName}에 저장했습니다.`);
      await fetchSlots();
    } catch (error) {
      console.error('failed to save snapshot:', error);
      showMessage(getReadableErrorMessage(error, '저장에 실패했습니다.'));
    } finally {
      setProcessing(false);
    }
  };

  const handleLoad = async (metadataId: number) => {
    if (processing) return;
    if (isInGame && !window.confirm('현재 진행 중인 커리어를 나가고 선택한 세이브를 불러오시겠습니까?')) return;

    try {
      setProcessing(true);
      const loadedSave = await loadSave(metadataId);
      await loadGameIntoStore(loadedSave.metadataId);
      navigate(loadedSave.mode === 'manager' ? '/manager' : '/player');
    } catch (error) {
      console.error('failed to load save:', error);
      showMessage(getReadableErrorMessage(error, '불러오기에 실패했습니다.'));
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (metadataId: number, slotNumber: number) => {
    if (processing) return;
    const slotName = slotNumber === 0 ? '자동 저장' : `세이브 슬롯 ${slotNumber}`;
    if (!window.confirm(`${slotName}을 삭제하시겠습니까?`)) return;

    try {
      setProcessing(true);
      await deleteSave(metadataId);
      showMessage(`${slotName}을 삭제했습니다.`);
      await fetchSlots();
    } catch (error) {
      console.error('failed to delete save:', error);
      showMessage(getReadableErrorMessage(error, '삭제에 실패했습니다.'));
    } finally {
      setProcessing(false);
    }
  };

  const renderSlot = (slot: SaveSlot) => {
    const isAutoSlot = slot.slotNumber === 0;
    const hasSave = slot.save !== null;
    const summary = slot.save ? buildSaveSummary(slot.save) : null;

    return (
      <div
        key={slot.slotNumber}
        className={`fm-card fm-flex fm-gap-lg ${isAutoSlot ? 'fm-card--highlight' : ''}`}
        style={{ alignItems: 'stretch' }}
      >
        <div className="fm-flex-col fm-gap-xs" style={{ minWidth: 118 }}>
          <span className="fm-text-md fm-font-semibold fm-text-accent">
            {isAutoSlot ? '자동 저장' : `슬롯 ${slot.slotNumber}`}
          </span>
          {hasSave && <span className="fm-text-xs fm-text-muted">{formatDate(slot.save!.updatedAt)}</span>}
        </div>

        {hasSave && summary ? (
          <div className="fm-flex-col fm-gap-xs fm-flex-1">
            <span className="fm-text-lg fm-font-medium fm-text-primary">{slot.save!.saveName}</span>
            <div className="fm-flex fm-gap-sm fm-flex-wrap">
              <span className="fm-badge fm-badge--default">{slot.save!.mode === 'manager' ? '감독 모드' : '선수 모드'}</span>
              {slot.save!.teamName && <span className="fm-badge fm-badge--default">{slot.save!.teamName}</span>}
              <span className="fm-badge fm-badge--default">{summary.stage}</span>
              <span className="fm-badge fm-badge--default">{formatPlayTime(slot.save!.playTimeMinutes)}</span>
            </div>
            <div className="fm-text-sm fm-text-muted">복귀 지점: {summary.focus}</div>
          </div>
        ) : (
          <div className="fm-flex-1 fm-text-lg fm-text-muted" style={{ fontStyle: 'italic', alignSelf: 'center' }}>
            비어 있는 슬롯
          </div>
        )}

        <div className="fm-flex fm-gap-sm fm-flex-shrink-0" style={{ alignSelf: 'center' }}>
          {viewMode === 'save' && isInGame && (
            <button
              className="fm-btn fm-btn--sm"
              style={{ borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
              onClick={() => void handleSave(slot.slotNumber)}
              disabled={processing}
            >
              저장
            </button>
          )}
          {hasSave && (
            <>
              <button className="fm-btn fm-btn--sm fm-btn--success" onClick={() => void handleLoad(slot.save!.metadataId)} disabled={processing}>
                불러오기
              </button>
              <button className="fm-btn fm-btn--sm fm-btn--danger" onClick={() => void handleDelete(slot.save!.metadataId, slot.slotNumber)} disabled={processing}>
                삭제
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fm-content fm-flex-col fm-items-center intro-page">
      <div className="intro-shell" style={{ maxWidth: 860 }}>
        <header className="fm-panel intro-hero intro-panel-soft">
          <div className="fm-panel__body" style={{ padding: 28 }}>
            <div className="fm-text-xs fm-font-semibold fm-text-accent fm-text-upper fm-mb-sm">Career Resume</div>
            <h1 className="fm-text-2xl fm-font-bold fm-text-primary" style={{ margin: 0 }}>세이브 및 복귀 관리</h1>
            <p className="fm-text-md fm-text-muted fm-mt-sm" style={{ lineHeight: 1.7 }}>
              각 슬롯은 서로 다른 DB 파일을 사용합니다. 수동 저장은 현재 커리어의 상태를 복사하고,
              불러오기는 해당 슬롯의 커리어를 그대로 복원합니다.
            </p>
          </div>
        </header>

        <div className="fm-flex fm-justify-between fm-items-center">
          <h2 className="fm-text-xl fm-font-semibold fm-text-primary" style={{ margin: 0 }}>세이브 슬롯</h2>
          {isInGame && (
            <div className="fm-flex fm-gap-sm">
              <button className={`fm-tab ${viewMode === 'save' ? 'fm-tab--active' : ''}`} onClick={() => setViewMode('save')}>
                저장
              </button>
              <button className={`fm-tab ${viewMode === 'load' ? 'fm-tab--active' : ''}`} onClick={() => setViewMode('load')}>
                불러오기
              </button>
            </div>
          )}
        </div>

        {message && (
          <div className="fm-alert fm-alert--warning">
            <span className="fm-alert__text fm-text-center">{message}</span>
          </div>
        )}

        {loading ? (
          <div className="fm-p-lg fm-text-muted fm-text-lg">세이브 목록을 불러오는 중입니다...</div>
        ) : (
          <div className="fm-flex-col fm-gap-sm">
            {slots.map(renderSlot)}
          </div>
        )}
      </div>

      <button className="fm-btn fm-btn--ghost intro-back" onClick={() => navigate(-1)}>
        돌아가기
      </button>
    </div>
  );
}
