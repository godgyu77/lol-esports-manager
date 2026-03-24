import type { DraftState } from '../../engine/draft/draftEngine';
import type { Position } from '../../types/game';
import type { Champion } from '../../types/champion';
import './draft.css';

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
    <div className="draft-center-panel">
      <div className="draft-phase-indicator">
        {draft.isComplete ? (
          <span className="draft-phase-complete">
            밴픽 완료!
          </span>
        ) : (
          <>
            <span className="draft-phase-label">
              {draft.currentActionType === 'ban' ? 'BAN' : 'PICK'}
            </span>
            <span className={`draft-turn-label ${draft.currentSide === 'blue' ? 'draft-turn-label--blue' : 'draft-turn-label--red'}`}>
              {draft.currentSide === 'blue' ? '블루' : '레드'}팀
            </span>
            {isAiTurn && <span className="draft-ai-thinking">AI 선택 중...</span>}
            {currentIsUser && <span className="draft-your-turn">당신의 차례!</span>}
          </>
        )}
      </div>

      {/* 유저 턴일 때 추천 */}
      {currentIsUser && !draft.isComplete && recommendations.length > 0 && (
        <div className="draft-rec-box">
          <h4 className="draft-rec-title">추천</h4>
          {recommendations.slice(0, 3).map((r, i) => {
            const champ = championDb.find((c) => c.id === r.championId);
            return (
              <div
                key={i}
                className={`draft-rec-item ${selectedChampion === r.championId ? 'draft-rec-item--selected' : ''}`}
                onClick={() => {
                  onSelectChampion(r.championId);
                  if (r.position) onSelectPosition(r.position);
                }}
              >
                <span className="draft-rec-champ">{champ?.nameKo ?? r.championId}</span>
                <span className="draft-rec-reason">{r.reason}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 픽 시 포지션 선택 */}
      {currentIsUser && draft.currentActionType === 'pick' && !draft.isComplete && (
        <div className="draft-position-select">
          <span className="draft-pos-label">포지션:</span>
          {(['top', 'jungle', 'mid', 'adc', 'support'] as Position[]).map((pos) => (
            <button
              key={pos}
              className={`draft-pos-btn ${selectedPosition === pos ? 'draft-pos-btn--active' : ''}`}
              onClick={() => onSelectPosition(pos)}
            >
              {POSITION_LABELS[pos]}
            </button>
          ))}
        </div>
      )}

      {/* 확인 버튼 */}
      {currentIsUser && !draft.isComplete && selectedChampion && (
        <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={onConfirm}>
          {draft.currentActionType === 'ban' ? '밴 확정' : '픽 확정'}
        </button>
      )}
    </div>
  );
}
