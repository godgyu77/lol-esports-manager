import type { DraftState } from '../../engine/draft/draftEngine';
import type { Champion } from '../../types/champion';
import './draft.css';

interface Recommendation {
  championId: string;
  reason: string;
}

interface DraftCenterPanelProps {
  draft: DraftState;
  isAiTurn: boolean;
  currentIsUser: boolean;
  selectedChampion: string | null;
  recommendations: Recommendation[];
  championDb: Champion[];
  onSelectChampion: (id: string) => void;
  onConfirm: () => void;
}

export function DraftCenterPanel({
  draft,
  isAiTurn,
  currentIsUser,
  selectedChampion,
  recommendations,
  championDb,
  onSelectChampion,
  onConfirm,
}: DraftCenterPanelProps) {
  return (
    <div className="draft-center-panel">
      <div className="draft-phase-indicator">
        {draft.isComplete ? (
          <span className="draft-phase-complete">밴픽 완료</span>
        ) : (
          <>
            <span className="draft-phase-label">{draft.currentActionType === 'ban' ? '밴' : '픽'}</span>
            <span className={`draft-turn-label ${draft.currentSide === 'blue' ? 'draft-turn-label--blue' : 'draft-turn-label--red'}`}>
              {draft.currentSide === 'blue' ? '블루 차례' : '레드 차례'}
            </span>
            {isAiTurn && <span className="draft-ai-thinking">상대가 선택 중입니다...</span>}
            {currentIsUser && <span className="draft-your-turn">직접 선택할 차례입니다</span>}
            {draft.currentActionType === 'pick' && currentIsUser && (
              <span className="draft-center-helper">포지션은 나중에 스왑 단계에서 배치할 수 있습니다.</span>
            )}
          </>
        )}
      </div>

      {currentIsUser && !draft.isComplete && recommendations.length > 0 && (
        <div className="draft-rec-box">
          <h4 className="draft-rec-title">지금 보기 좋은 선택</h4>
          {recommendations.slice(0, 3).map((recommendation) => {
            const champ = championDb.find((c) => c.id === recommendation.championId);
            return (
              <button
                key={recommendation.championId}
                type="button"
                className={`draft-rec-item ${selectedChampion === recommendation.championId ? 'draft-rec-item--selected' : ''}`}
                onClick={() => onSelectChampion(recommendation.championId)}
              >
                <span className="draft-rec-champ">{champ?.nameKo ?? recommendation.championId}</span>
                <span className="draft-rec-reason">{recommendation.reason}</span>
              </button>
            );
          })}
        </div>
      )}

      {currentIsUser && !draft.isComplete && selectedChampion && (
        <button className="draft-primary-action" onClick={onConfirm}>
          {draft.currentActionType === 'ban' ? '이 챔피언 밴하기' : '이 챔피언 선픽하기'}
        </button>
      )}
    </div>
  );
}
