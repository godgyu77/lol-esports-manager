import type { DraftState } from '../../engine/draft/draftEngine';
import type { Position } from '../../types/game';
import type { Champion } from '../../types/champion';

const POSITION_LABELS: Record<Position, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: '원딜',
  support: '서포터',
};

interface Recommendation {
  championId: string;
  reason: string;
  position?: Position;
}

interface DraftCenterPanelProps {
  draft: DraftState;
  isAiTurn: boolean;
  currentIsUser: boolean;
  selectedChampion: string | null;
  selectedPosition: Position;
  recommendations: Recommendation[];
  championDb: Champion[];
  onSelectChampion: (id: string) => void;
  onSelectPosition: (pos: Position) => void;
  onConfirm: () => void;
}

export function DraftCenterPanel({
  draft,
  isAiTurn,
  currentIsUser,
  selectedChampion,
  selectedPosition,
  recommendations,
  championDb,
  onSelectChampion,
  onSelectPosition,
  onConfirm,
}: DraftCenterPanelProps) {
  return (
    <div style={styles.centerPanel}>
      <div style={styles.phaseIndicator}>
        {draft.isComplete ? (
          <span style={{ color: '#2ecc71', fontSize: '18px', fontWeight: 700 }}>
            밴픽 완료!
          </span>
        ) : (
          <>
            <span style={styles.phaseLabel}>
              {draft.currentActionType === 'ban' ? 'BAN' : 'PICK'}
            </span>
            <span style={{
              ...styles.turnLabel,
              color: draft.currentSide === 'blue' ? '#3498db' : '#e74c3c',
            }}>
              {draft.currentSide === 'blue' ? '블루' : '레드'}팀
            </span>
            {isAiTurn && <span style={styles.aiThinking}>AI 선택 중...</span>}
            {currentIsUser && <span style={styles.yourTurn}>당신의 차례!</span>}
          </>
        )}
      </div>

      {/* 유저 턴일 때 추천 */}
      {currentIsUser && !draft.isComplete && recommendations.length > 0 && (
        <div style={styles.recBox}>
          <h4 style={styles.recTitle}>추천</h4>
          {recommendations.slice(0, 3).map((r, i) => {
            const champ = championDb.find((c) => c.id === r.championId);
            return (
              <div
                key={i}
                style={{
                  ...styles.recItem,
                  background: selectedChampion === r.championId ? 'rgba(200,155,60,0.15)' : 'transparent',
                }}
                onClick={() => {
                  onSelectChampion(r.championId);
                  if (r.position) onSelectPosition(r.position);
                }}
              >
                <span style={styles.recChamp}>{champ?.nameKo ?? r.championId}</span>
                <span style={styles.recReason}>{r.reason}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 픽 시 포지션 선택 */}
      {currentIsUser && draft.currentActionType === 'pick' && !draft.isComplete && (
        <div style={styles.positionSelect}>
          <span style={styles.posLabel}>포지션:</span>
          {(['top', 'jungle', 'mid', 'adc', 'support'] as Position[]).map((pos) => (
            <button
              key={pos}
              style={{
                ...styles.posBtn,
                background: selectedPosition === pos ? '#c89b3c' : 'transparent',
                color: selectedPosition === pos ? '#0d0d1a' : '#8a8a9a',
              }}
              onClick={() => onSelectPosition(pos)}
            >
              {POSITION_LABELS[pos]}
            </button>
          ))}
        </div>
      )}

      {/* 확인 버튼 */}
      {currentIsUser && !draft.isComplete && selectedChampion && (
        <button style={styles.confirmBtn} onClick={onConfirm}>
          {draft.currentActionType === 'ban' ? '밴 확정' : '픽 확정'}
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  centerPanel: {
    minWidth: '200px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  phaseIndicator: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '16px',
  },
  phaseLabel: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#f0e6d2',
  },
  turnLabel: {
    fontSize: '14px',
    fontWeight: 600,
  },
  aiThinking: {
    fontSize: '12px',
    color: '#6a6a7a',
    fontStyle: 'italic',
  },
  yourTurn: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#c89b3c',
  },
  recBox: {
    width: '100%',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '10px',
  },
  recTitle: {
    fontSize: '12px',
    color: '#c89b3c',
    marginBottom: '8px',
  },
  recItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '6px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    marginBottom: '4px',
  },
  recChamp: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e0e0e0',
  },
  recReason: {
    fontSize: '10px',
    color: '#6a6a7a',
  },
  positionSelect: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  posLabel: {
    fontSize: '12px',
    color: '#6a6a7a',
  },
  posBtn: {
    padding: '4px 8px',
    border: '1px solid #3a3a5c',
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  confirmBtn: {
    padding: '10px 32px',
    background: '#c89b3c',
    color: '#0d0d1a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
