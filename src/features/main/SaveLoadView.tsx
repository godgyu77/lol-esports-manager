/**
 * 저장/불러오기 UI 페이지
 * - 자동 저장 슬롯 + 수동 저장 슬롯 10개
 * - 저장/불러오기/삭제 기능
 */
import type React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SaveSlot } from '../../types/game';
import { useGameStore } from '../../stores/gameStore';
import {
  getSaveSlots,
  createManualSaveFromCurrent,
  loadSave,
  deleteSave,
} from '../../engine/save/saveEngine';

type ViewMode = 'save' | 'load';

export function SaveLoadView() {
  const navigate = useNavigate();
  const save = useGameStore((s) => s.save);
  const setSave = useGameStore((s) => s.setSave);

  const [slots, setSlots] = useState<SaveSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(save ? 'save' : 'load');
  const [message, setMessage] = useState<string | null>(null);

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
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
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
      setSave(loadedSave);

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
        style={{
          ...styles.slot,
          ...(isAutoSlot ? styles.autoSlot : {}),
        }}
      >
        <div style={styles.slotHeader}>
          <span style={styles.slotLabel}>
            {isAutoSlot ? '자동 저장' : `슬롯 ${slot.slotNumber}`}
          </span>
          {hasSave && (
            <span style={styles.slotDate}>
              {formatDate(slot.save!.updatedAt)}
            </span>
          )}
        </div>

        {hasSave ? (
          <div style={styles.slotInfo}>
            <div style={styles.slotName}>{slot.save!.saveName}</div>
            <div style={styles.slotDetails}>
              {slot.save!.teamName && (
                <span style={styles.detailTag}>{slot.save!.teamName}</span>
              )}
              {slot.save!.seasonInfo && (
                <span style={styles.detailTag}>{slot.save!.seasonInfo}</span>
              )}
              <span style={styles.detailTag}>
                {slot.save!.mode === 'manager' ? '감독 모드' : '선수 모드'}
              </span>
              <span style={styles.detailTag}>
                {formatPlayTime(slot.save!.playTimeMinutes)}
              </span>
            </div>
          </div>
        ) : (
          <div style={styles.emptySlot}>빈 슬롯</div>
        )}

        <div style={styles.slotActions}>
          {viewMode === 'save' && isInGame && (
            <button
              style={styles.saveBtn}
              onClick={() => handleSave(slot.slotNumber)}
              disabled={processing}
            >
              저장
            </button>
          )}
          {hasSave && (
            <>
              <button
                style={styles.loadBtn}
                onClick={() => handleLoad(slot.save!.id)}
                disabled={processing}
              >
                불러오기
              </button>
              <button
                style={styles.deleteBtn}
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
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>저장 / 불러오기</h1>
        {isInGame && (
          <div style={styles.tabs}>
            <button
              style={{
                ...styles.tab,
                ...(viewMode === 'save' ? styles.tabActive : {}),
              }}
              onClick={() => setViewMode('save')}
            >
              저장
            </button>
            <button
              style={{
                ...styles.tab,
                ...(viewMode === 'load' ? styles.tabActive : {}),
              }}
              onClick={() => setViewMode('load')}
            >
              불러오기
            </button>
          </div>
        )}
      </div>

      {message && <div style={styles.message}>{message}</div>}

      {loading ? (
        <div style={styles.loading}>슬롯 정보를 불러오는 중...</div>
      ) : (
        <div style={styles.slotList}>
          {slots.map(renderSlot)}
        </div>
      )}

      <button style={styles.backBtn} onClick={() => navigate(-1)}>
        돌아가기
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#0d0d1a',
    color: '#e0e0e0',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  header: {
    width: '100%',
    maxWidth: '700px',
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#c89b3c',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
  },
  tab: {
    padding: '8px 20px',
    border: '1px solid #3a3a5c',
    borderRadius: '6px',
    background: 'transparent',
    color: '#8a8a9a',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  tabActive: {
    background: 'rgba(200,155,60,0.15)',
    color: '#c89b3c',
    borderColor: '#c89b3c',
  },
  message: {
    width: '100%',
    maxWidth: '700px',
    padding: '12px 16px',
    marginBottom: '16px',
    borderRadius: '6px',
    background: 'rgba(200,155,60,0.1)',
    border: '1px solid rgba(200,155,60,0.3)',
    color: '#c89b3c',
    fontSize: '14px',
    textAlign: 'center' as const,
  },
  loading: {
    padding: '40px',
    color: '#6a6a7a',
    fontSize: '14px',
  },
  slotList: {
    width: '100%',
    maxWidth: '700px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  slot: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 20px',
    borderRadius: '8px',
    background: '#12122a',
    border: '1px solid #2a2a4a',
    transition: 'border-color 0.2s',
  },
  autoSlot: {
    borderColor: 'rgba(200,155,60,0.3)',
    marginBottom: '8px',
  },
  slotHeader: {
    minWidth: '120px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  slotLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#c89b3c',
  },
  slotDate: {
    fontSize: '11px',
    color: '#6a6a7a',
  },
  slotInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  slotName: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#e0e0e0',
  },
  slotDetails: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  detailTag: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '4px',
    background: 'rgba(255,255,255,0.05)',
    color: '#8a8a9a',
  },
  emptySlot: {
    flex: 1,
    fontSize: '14px',
    color: '#4a4a5a',
    fontStyle: 'italic',
  },
  slotActions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  saveBtn: {
    padding: '6px 16px',
    borderRadius: '4px',
    border: '1px solid #c89b3c',
    background: 'rgba(200,155,60,0.15)',
    color: '#c89b3c',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  loadBtn: {
    padding: '6px 16px',
    borderRadius: '4px',
    border: '1px solid #3a8a5c',
    background: 'rgba(58,138,92,0.15)',
    color: '#3a8a5c',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  deleteBtn: {
    padding: '6px 16px',
    borderRadius: '4px',
    border: '1px solid #8a3a3a',
    background: 'rgba(138,58,58,0.15)',
    color: '#8a3a3a',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  backBtn: {
    marginTop: '24px',
    padding: '10px 24px',
    border: '1px solid #3a3a5c',
    borderRadius: '6px',
    background: 'transparent',
    color: '#6a6a7a',
    cursor: 'pointer',
    fontSize: '13px',
  },
};
