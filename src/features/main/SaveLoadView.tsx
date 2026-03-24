/**
 * 저장/불러오기 UI 페이지
 * - 자동 저장 슬롯 + 수동 저장 슬롯 10개
 * - 저장/불러오기/삭제 기능
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SaveSlot } from '../../types/game';
import { useGameStore } from '../../stores/gameStore';
import {
  getSaveSlots,
  createManualSaveFromCurrent,
  loadSave,
  deleteSave,
} from '../../engine/save/saveEngine';
import { loadGameIntoStore } from '../../db/initGame';

type ViewMode = 'save' | 'load';

export function SaveLoadView() {
  const navigate = useNavigate();
  const save = useGameStore((s) => s.save);

  const [slots, setSlots] = useState<SaveSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(save ? 'save' : 'load');
  const [message, setMessage] = useState<string | null>(null);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => { clearTimeout(messageTimerRef.current); };
  }, []);

  const isInGame = save !== null;

  const fetchSlots = async () => {
    try {
      setLoading(true);
      const result = await getSaveSlots();
      setSlots(result);
    } catch (err) {
      console.error('슬롯 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, []);

  const showMessage = (msg: string) => {
    clearTimeout(messageTimerRef.current);
    setMessage(msg);
    messageTimerRef.current = setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async (slotNumber: number) => {
    if (!isInGame || processing) return;

    const slotName = slotNumber === 0 ? '자동 저장' : `저장 슬롯 ${slotNumber}`;
    const existing = slots.find((s) => s.slotNumber === slotNumber)?.save;

    if (existing) {
      const confirmed = window.confirm(`${slotName}에 이미 저장이 있습니다. 덮어쓰시겠습니까?`);
      if (!confirmed) return;
    }

    try {
      setProcessing(true);
      const saveName = slotNumber === 0 ? '자동 저장' : `수동 저장 ${slotNumber}`;
      await createManualSaveFromCurrent(slotNumber, saveName);
      showMessage(`${slotName}에 저장되었습니다.`);
      await fetchSlots();
    } catch (err) {
      console.error('저장 실패:', err);
      showMessage('저장에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleLoad = async (saveId: number) => {
    if (processing) return;

    if (isInGame) {
      const confirmed = window.confirm('현재 진행 중인 게임이 있습니다. 불러오시겠습니까?');
      if (!confirmed) return;
    }

    try {
      setProcessing(true);
      const loadedSave = await loadSave(saveId);
      await loadGameIntoStore(loadedSave.id);

      const basePath = loadedSave.mode === 'manager' ? '/manager' : '/player';
      navigate(basePath);
    } catch (err) {
      console.error('불러오기 실패:', err);
      showMessage('불러오기에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (saveId: number, slotNumber: number) => {
    if (processing) return;

    const slotName = slotNumber === 0 ? '자동 저장' : `저장 슬롯 ${slotNumber}`;
    const confirmed = window.confirm(`${slotName}을(를) 삭제하시겠습니까?`);
    if (!confirmed) return;

    try {
      setProcessing(true);
      await deleteSave(saveId);
      showMessage(`${slotName}이(가) 삭제되었습니다.`);
      await fetchSlots();
    } catch (err) {
      console.error('삭제 실패:', err);
      showMessage('삭제에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const formatPlayTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}시간 ${mins}분`;
    return `${mins}분`;
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const renderSlot = (slot: SaveSlot) => {
    const isAutoSlot = slot.slotNumber === 0;
    const hasSave = slot.save !== null;

    return (
      <div
        key={slot.slotNumber}
        className={`fm-card fm-flex fm-items-center fm-gap-lg ${isAutoSlot ? 'fm-card--highlight fm-mb-sm' : ''}`}
      >
        <div className="fm-flex-col fm-gap-xs" style={{ minWidth: 120 }}>
          <span className="fm-text-md fm-font-semibold fm-text-accent">
            {isAutoSlot ? '자동 저장' : `슬롯 ${slot.slotNumber}`}
          </span>
          {hasSave && (
            <span className="fm-text-xs fm-text-muted">
              {formatDate(slot.save!.updatedAt)}
            </span>
          )}
        </div>

        {hasSave ? (
          <div className="fm-flex-col fm-gap-xs fm-flex-1">
            <span className="fm-text-lg fm-font-medium fm-text-primary">{slot.save!.saveName}</span>
            <div className="fm-flex fm-gap-sm fm-flex-wrap">
              {slot.save!.teamName && (
                <span className="fm-badge fm-badge--default">{slot.save!.teamName}</span>
              )}
              {slot.save!.seasonInfo && (
                <span className="fm-badge fm-badge--default">{slot.save!.seasonInfo}</span>
              )}
              <span className="fm-badge fm-badge--default">
                {slot.save!.mode === 'manager' ? '감독 모드' : '선수 모드'}
              </span>
              <span className="fm-badge fm-badge--default">
                {formatPlayTime(slot.save!.playTimeMinutes)}
              </span>
            </div>
          </div>
        ) : (
          <div className="fm-flex-1 fm-text-lg fm-text-muted" style={{ fontStyle: 'italic' }}>
            빈 슬롯
          </div>
        )}

        <div className="fm-flex fm-gap-sm fm-flex-shrink-0">
          {viewMode === 'save' && isInGame && (
            <button
              className="fm-btn fm-btn--sm"
              style={{ borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
              onClick={() => handleSave(slot.slotNumber)}
              disabled={processing}
            >
              저장
            </button>
          )}
          {hasSave && (
            <>
              <button
                className="fm-btn fm-btn--sm fm-btn--success"
                onClick={() => handleLoad(slot.save!.id)}
                disabled={processing}
              >
                불러오기
              </button>
              <button
                className="fm-btn fm-btn--sm fm-btn--danger"
                onClick={() => handleDelete(slot.save!.id, slot.slotNumber)}
                disabled={processing}
              >
                삭제
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fm-content fm-flex-col fm-items-center" style={{ minHeight: '100vh' }}>
      <div className="fm-flex fm-justify-between fm-items-center fm-mb-lg" style={{ width: '100%', maxWidth: 700 }}>
        <h1 className="fm-text-2xl fm-font-bold fm-text-accent">저장 / 불러오기</h1>
        {isInGame && (
          <div className="fm-flex fm-gap-sm">
            <button
              className={`fm-tab ${viewMode === 'save' ? 'fm-tab--active' : ''}`}
              onClick={() => setViewMode('save')}
            >
              저장
            </button>
            <button
              className={`fm-tab ${viewMode === 'load' ? 'fm-tab--active' : ''}`}
              onClick={() => setViewMode('load')}
            >
              불러오기
            </button>
          </div>
        )}
      </div>

      {message && (
        <div className="fm-alert fm-alert--warning fm-mb-md" style={{ maxWidth: 700, width: '100%' }}>
          <span className="fm-alert__text fm-text-center">{message}</span>
        </div>
      )}

      {loading ? (
        <div className="fm-p-lg fm-text-muted fm-text-lg">슬롯 정보를 불러오는 중...</div>
      ) : (
        <div className="fm-flex-col fm-gap-sm" style={{ width: '100%', maxWidth: 700 }}>
          {slots.map(renderSlot)}
        </div>
      )}

      <button className="fm-btn fm-btn--ghost fm-mt-lg" onClick={() => navigate(-1)}>
        돌아가기
      </button>
    </div>
  );
}
