import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/gameStore';
import { LCK_TEAMS, LCS_TEAMS, LEC_TEAMS, LPL_TEAMS } from '../../data/rosterDb';
import type { TeamData, RosterPlayer } from '../../data/rosterDb';
import type { Region } from '../../types';
import { MANAGER_BG_LABELS } from '../../types/manager';
import { initializeNewGame, loadGameIntoStore } from '../../db/initGame';

const TEAM_DATA_MAP: Record<Region, Record<string, TeamData>> = {
  LCK: LCK_TEAMS, LPL: LPL_TEAMS, LEC: LEC_TEAMS, LCS: LCS_TEAMS,
};

function parseTeamId(teamId: string): { region: Region; shortName: string } | null {
  const parts = teamId.split('_');
  if (parts.length < 2) return null;
  const region = parts[0].toUpperCase() as Region;
  const shortName = parts.slice(1).join('_');
  return { region, shortName };
}

function getTeamData(teamId: string): TeamData | null {
  const parsed = parseTeamId(teamId);
  if (!parsed) return null;
  return TEAM_DATA_MAP[parsed.region]?.[parsed.shortName] ?? null;
}

function getTeamRegion(teamId: string): Region | null {
  const parsed = parseTeamId(teamId);
  return parsed?.region ?? null;
}

function getStarterRoster(roster: RosterPlayer[]): RosterPlayer[] {
  return roster.filter((p) => p.div === '1군' && p.name !== 'VACANT' && p.role !== 'SUB');
}

interface SeasonGoal {
  standing: number;
  playoff: boolean;
  international: boolean;
  label: string;
}

function calculateGoal(tier: string): SeasonGoal {
  switch (tier) {
    case 'S': return { standing: 2, playoff: true, international: true, label: '우승 경쟁' };
    case 'A': return { standing: 4, playoff: true, international: false, label: '플레이오프 진출' };
    case 'B': return { standing: 6, playoff: false, international: false, label: '중위권 안착' };
    default: return { standing: 8, playoff: false, international: false, label: '잔류' };
  }
}

function relaxGoal(goal: SeasonGoal): SeasonGoal {
  return {
    standing: Math.min(goal.standing + 2, 10),
    playoff: goal.standing <= 4 ? true : false,
    international: false,
    label: goal.standing <= 2 ? '플레이오프 진출' :
           goal.standing <= 4 ? '중위권 안착' :
           goal.standing <= 6 ? '잔류' : '최하위 방어',
  };
}

export function SeasonGoalView() {
  const navigate = useNavigate();
  const pendingTeamId = useGameStore((s) => s.pendingTeamId);
  const pendingManager = useGameStore((s) => s.pendingManager);
  const pendingPlayer = useGameStore((s) => s.pendingPlayer);
  const mode = useGameStore((s) => s.mode);
  const setLoading = useGameStore((s) => s.setLoading);

  const [negotiated, setNegotiated] = useState(false);
  const [isLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pendingTeamId) {
    return (
      <div className="fm-content fm-flex-col fm-items-center fm-justify-center" style={{ minHeight: '100vh' }}>
        <p className="fm-alert fm-alert--danger fm-mb-md">팀이 선택되지 않았습니다.</p>
        <button className="fm-btn fm-btn--ghost" onClick={() => navigate('/team-select')}>
          ← 팀 선택으로 돌아가기
        </button>
      </div>
    );
  }

  const teamData = getTeamData(pendingTeamId);
  const region = getTeamRegion(pendingTeamId);

  if (!teamData || !region) {
    return (
      <div className="fm-content fm-flex-col fm-items-center fm-justify-center" style={{ minHeight: '100vh' }}>
        <p className="fm-alert fm-alert--danger fm-mb-md">팀 데이터를 찾을 수 없습니다.</p>
        <button className="fm-btn fm-btn--ghost" onClick={() => navigate('/team-select')}>
          ← 팀 선택으로 돌아가기
        </button>
      </div>
    );
  }

  const starters = getStarterRoster(teamData.roster);
  const baseGoal = calculateGoal(teamData.financialTier);
  const currentGoal = negotiated ? relaxGoal(baseGoal) : baseGoal;

  const handleAccept = async () => {
    setLocalLoading(true);
    setLoading(true);
    setError(null);

    try {
      const save = await initializeNewGame(mode!, pendingTeamId, pendingPlayer, pendingManager);
      await loadGameIntoStore(save.id);

      if (mode === 'manager') {
        navigate('/manager');
      } else {
        navigate('/player');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
      console.error('게임 초기화 실패:', errMsg);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLocalLoading(false);
      setLoading(false);
    }
  };

  const handleNegotiate = () => {
    if (!negotiated) {
      setNegotiated(true);
    }
  };

  const isManagerMode = mode === 'manager';

  return (
    <div className="fm-content fm-flex-col fm-items-center" style={{ minHeight: '100vh' }}>
      <h1 className="fm-text-2xl fm-font-bold fm-text-primary fm-mb-lg">2026 시즌 시작</h1>

      <div className="fm-flex-col fm-gap-lg" style={{ maxWidth: 540, width: '100%' }}>
        {/* 팀 정보 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">{teamData.teamName}</span>
            <span className="fm-badge fm-badge--accent">{region}</span>
          </div>

          {/* 감독 프로필 (매니저 모드) */}
          {isManagerMode && pendingManager && (
            <div className="fm-panel__body">
              <h3 className="fm-text-xs fm-font-semibold fm-text-muted fm-text-upper fm-mb-sm">감독 프로필</h3>
              <div className="fm-flex-col">
                <div className="fm-info-row">
                  <span className="fm-info-row__label">이름</span>
                  <span className="fm-info-row__value">{pendingManager.name}</span>
                </div>
                <div className="fm-info-row">
                  <span className="fm-info-row__label">배경</span>
                  <span className="fm-info-row__value">{MANAGER_BG_LABELS[pendingManager.background]}</span>
                </div>
                <div className="fm-info-row">
                  <span className="fm-info-row__label">전술 지식</span>
                  <span className="fm-info-row__value">{pendingManager.stats.tacticalKnowledge}</span>
                </div>
                <div className="fm-info-row">
                  <span className="fm-info-row__label">동기부여</span>
                  <span className="fm-info-row__value">{pendingManager.stats.motivation}</span>
                </div>
                <div className="fm-info-row">
                  <span className="fm-info-row__label">규율</span>
                  <span className="fm-info-row__value">{pendingManager.stats.discipline}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 로스터 요약 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">1군 로스터</span>
          </div>
          <div className="fm-panel__body--flush">
            <table className="fm-table fm-table--striped">
              <thead>
                <tr>
                  <th>포지션</th>
                  <th>이름</th>
                  <th className="text-right">OVR</th>
                </tr>
              </thead>
              <tbody>
                {starters.map((p) => (
                  <tr key={p.name}>
                    <td><span className="fm-text-accent fm-font-bold fm-text-xs">{p.role}</span></td>
                    <td className="fm-cell--name">{p.name}</td>
                    <td className="text-right fm-font-bold">{p.stats.ovr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 구단 기대치 (매니저 모드만) */}
        {isManagerMode && (
          <div className="fm-panel">
            <div className="fm-panel__header">
              <span className="fm-panel__title">구단 기대치</span>
            </div>
            <div className="fm-panel__body">
              <div className="fm-flex-col">
                <div className="fm-info-row">
                  <span className="fm-info-row__label">목표</span>
                  <span className="fm-info-row__value fm-text-accent">{currentGoal.label}</span>
                </div>
                <div className="fm-info-row">
                  <span className="fm-info-row__label">목표 순위</span>
                  <span className="fm-info-row__value">{currentGoal.standing}위 이내</span>
                </div>
                <div className="fm-info-row">
                  <span className="fm-info-row__label">플레이오프 진출</span>
                  <span className="fm-info-row__value">{currentGoal.playoff ? '필수' : '선택'}</span>
                </div>
                <div className="fm-info-row">
                  <span className="fm-info-row__label">국제대회 기대</span>
                  <span className="fm-info-row__value">{currentGoal.international ? '있음' : '없음'}</span>
                </div>
              </div>

              {negotiated && (
                <div className="fm-alert fm-alert--danger fm-mt-md">
                  <span className="fm-alert__text">구단 만족도 -10으로 시작합니다</span>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="fm-alert fm-alert--danger">
            <span className="fm-alert__text">{error}</span>
          </div>
        )}

        {/* 버튼 */}
        <div className="fm-flex fm-gap-md">
          {isManagerMode ? (
            <>
              <button
                className="fm-btn fm-btn--primary fm-btn--lg fm-flex-1"
                onClick={handleAccept}
                disabled={isLoading}
              >
                {isLoading ? '초기화 중...' : '수락'}
              </button>
              {!negotiated && (
                <button
                  className="fm-btn fm-btn--lg fm-flex-1"
                  onClick={handleNegotiate}
                >
                  협상
                </button>
              )}
            </>
          ) : (
            <button
              className="fm-btn fm-btn--primary fm-btn--lg fm-flex-1"
              onClick={handleAccept}
              disabled={isLoading}
            >
              {isLoading ? '초기화 중...' : '시작'}
            </button>
          )}
        </div>
      </div>

      <button className="fm-btn fm-btn--ghost fm-mt-lg" onClick={() => navigate('/team-select')}>
        ← 팀 선택으로 돌아가기
      </button>
    </div>
  );
}
