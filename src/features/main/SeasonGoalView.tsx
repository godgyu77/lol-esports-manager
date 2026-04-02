import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/gameStore';
import { LCK_TEAMS, LCS_TEAMS, LEC_TEAMS, LPL_TEAMS } from '../../data/rosterDb';
import type { TeamData, RosterPlayer } from '../../data/rosterDb';
import type { Region } from '../../types';
import { MANAGER_BG_LABELS } from '../../types/manager';
import { initializeNewGame, loadGameIntoStore } from '../../db/initGame';
import { getDominantManagerTraits } from '../../engine/manager/managerIdentityEngine';
import { getSaveSlots } from '../../engine/save/saveEngine';
import { describePressureTone, getTeamIntroMeta } from './introMeta';
import './introFlow.css';

const TEAM_DATA_MAP: Record<Region, Record<string, TeamData>> = {
  LCK: LCK_TEAMS,
  LPL: LPL_TEAMS,
  LEC: LEC_TEAMS,
  LCS: LCS_TEAMS,
};

function parseTeamId(teamId: string): { region: Region; shortName: string } | null {
  const parts = teamId.split('_');
  if (parts.length < 2) return null;
  return {
    region: parts[0].toUpperCase() as Region,
    shortName: parts.slice(1).join('_'),
  };
}

function getTeamData(teamId: string): TeamData | null {
  const parsed = parseTeamId(teamId);
  if (!parsed) return null;
  return TEAM_DATA_MAP[parsed.region]?.[parsed.shortName] ?? null;
}

function getTeamRegion(teamId: string): Region | null {
  return parseTeamId(teamId)?.region ?? null;
}

function getStarterRoster(roster: RosterPlayer[]): RosterPlayer[] {
  return roster.filter((player) => player.div === '1군' && player.name !== 'VACANT' && player.role !== 'SUB');
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
    default: return { standing: 8, playoff: false, international: false, label: '리빌딩' };
  }
}

function relaxGoal(goal: SeasonGoal): SeasonGoal {
  return {
    standing: Math.min(goal.standing + 2, 10),
    playoff: goal.standing <= 4,
    international: false,
    label:
      goal.standing <= 2 ? '플레이오프 진출' :
      goal.standing <= 4 ? '중위권 안착' :
      goal.standing <= 6 ? '리빌딩' : '잔류 우선',
  };
}

function ovrToNumber(ovr: string): number {
  const table: Record<string, number> = {
    'S+': 97, 'S': 94, 'S-': 91,
    'A+': 88, 'A': 85, 'A-': 82,
    'B+': 79, 'B': 75, 'B-': 72,
    'C+': 68, 'C': 65, 'C-': 62,
  };
  return table[ovr] ?? 0;
}

function toCareerStartErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('database is locked') || normalized.includes('code: 5')) {
    return '세이브 슬롯을 준비하는 중 잠금 충돌이 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }

  return message;
}

export function SeasonGoalView() {
  const navigate = useNavigate();
  const pendingTeamId = useGameStore((state) => state.pendingTeamId);
  const pendingManager = useGameStore((state) => state.pendingManager);
  const pendingPlayer = useGameStore((state) => state.pendingPlayer);
  const mode = useGameStore((state) => state.mode);
  const setLoading = useGameStore((state) => state.setLoading);

  const [negotiated, setNegotiated] = useState(false);
  const [isLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState(1);
  const [occupiedSlots, setOccupiedSlots] = useState<number[]>([]);

  useEffect(() => {
    getSaveSlots()
      .then((slots) => {
        const manualSlots = slots.filter((slot) => slot.slotNumber > 0);
        const occupied = manualSlots.filter((slot) => slot.save !== null).map((slot) => slot.slotNumber);
        const firstEmpty = manualSlots.find((slot) => slot.save === null)?.slotNumber ?? 1;
        setOccupiedSlots(occupied);
        setSelectedSlot(firstEmpty);
      })
      .catch((slotError) => {
        console.error('save slot lookup failed:', slotError);
      });
  }, []);

  const managerTraits = useMemo(
    () => (pendingManager ? getDominantManagerTraits(pendingManager.philosophy) : []),
    [pendingManager],
  );

  if (!pendingTeamId) {
    return (
      <div className="fm-content fm-flex-col fm-items-center fm-justify-center" style={{ minHeight: '100vh' }}>
        <p className="fm-alert fm-alert--danger fm-mb-md">선택된 팀이 없습니다.</p>
        <button className="fm-btn fm-btn--ghost" onClick={() => navigate('/team-select')}>
          팀 선택으로 돌아가기
        </button>
      </div>
    );
  }

  const teamData = getTeamData(pendingTeamId);
  const region = getTeamRegion(pendingTeamId);

  if (!teamData || !region) {
    return (
      <div className="fm-content fm-flex-col fm-items-center fm-justify-center" style={{ minHeight: '100vh' }}>
        <p className="fm-alert fm-alert--danger fm-mb-md">팀 정보를 불러올 수 없습니다.</p>
        <button className="fm-btn fm-btn--ghost" onClick={() => navigate('/team-select')}>
          팀 선택으로 돌아가기
        </button>
      </div>
    );
  }

  const starters = getStarterRoster(teamData.roster);
  const avgOvr = starters.length > 0
    ? Math.round(starters.reduce((sum, player) => sum + ovrToNumber(player.stats.ovr), 0) / starters.length)
    : 0;
  const teamMeta = getTeamIntroMeta({
    teamId: pendingTeamId,
    teamName: teamData.teamName,
    financialTier: teamData.financialTier,
    region,
    avgOvr,
  });
  const baseGoal = calculateGoal(teamData.financialTier);
  const currentGoal = negotiated ? relaxGoal(baseGoal) : baseGoal;

  const handleAccept = async () => {
    if (!mode) {
      setError('게임 모드를 확인할 수 없습니다. 처음부터 다시 시작해 주세요.');
      return;
    }
    if (mode === 'manager' && !pendingManager) {
      setError('감독 정보가 없습니다. 감독 생성부터 다시 진행해 주세요.');
      return;
    }
    if (mode === 'player' && !pendingPlayer) {
      setError('선수 정보가 없습니다. 선수 생성부터 다시 진행해 주세요.');
      return;
    }

    setLocalLoading(true);
    setLoading(true);
    setError(null);

    try {
      const save = await initializeNewGame(mode, pendingTeamId, selectedSlot, pendingPlayer, pendingManager);
      await loadGameIntoStore(save.metadataId);
      navigate(mode === 'manager' ? '/manager' : '/player');
    } catch (err) {
      console.error('failed to initialize new game:', err);
      setError(toCareerStartErrorMessage(err));
    } finally {
      setLocalLoading(false);
      setLoading(false);
    }
  };

  const pressureTone = describePressureTone(teamMeta.pressureLevel);
  const pressureColor =
    pressureTone === 'danger' ? '#ff8f6b' :
    pressureTone === 'warning' ? '#f1c15b' :
    '#7cc6ff';

  return (
    <div className="fm-content fm-flex-col fm-items-center intro-page">
      <div className="intro-shell" style={{ maxWidth: 1120 }}>
        <header className="fm-panel intro-hero intro-panel-soft">
          <div className="fm-panel__body" style={{ padding: 28 }}>
            <div className="fm-text-xs fm-font-semibold fm-text-accent fm-text-upper fm-mb-sm">Arrival Briefing</div>
            <h1 className="fm-text-2xl fm-font-bold fm-text-primary" style={{ margin: 0 }}>2026 시즌 부임 브리핑</h1>
            <p className="fm-text-md fm-text-muted fm-mt-sm" style={{ lineHeight: 1.7 }}>
              이제 팀과 시즌 목표가 정해집니다. 이 화면은 계약 확인이 아니라 어떤 압박 속에서 시즌을 시작하는지 보여주는 첫 브리핑입니다.
            </p>
          </div>
        </header>

        <div className="intro-two-column intro-two-column--wide">
          <div className="fm-flex-col fm-gap-lg">
            <section className="fm-panel">
              <div className="fm-panel__header">
                <span className="fm-panel__title">{teamData.teamName}</span>
                <span className="fm-badge fm-badge--accent">{region}</span>
              </div>
              <div className="fm-panel__body fm-flex-col fm-gap-md">
                <div className="fm-flex fm-gap-sm" style={{ flexWrap: 'wrap' }}>
                  <span className="fm-badge fm-badge--accent">{teamMeta.playstyleTag}</span>
                  <span className="fm-badge fm-badge--default">평균 OVR {avgOvr}</span>
                  <span className="fm-badge fm-badge--default">팬 기대 {teamMeta.fanExpectation}</span>
                </div>

                <div className="fm-card" style={{ borderColor: `${pressureColor}55` }}>
                  <div className="fm-text-xs fm-font-semibold fm-text-muted fm-text-upper fm-mb-sm">보드 압박</div>
                  <div className="fm-text-base fm-font-semibold" style={{ color: pressureColor }}>
                    {teamMeta.pressureLevel}
                  </div>
                  <p className="fm-text-sm fm-text-muted fm-mt-sm" style={{ lineHeight: 1.7 }}>
                    {teamMeta.boardStoryline}
                  </p>
                </div>

                <div className="intro-card-grid intro-card-grid--2">
                  <div className="fm-card">
                    <div className="fm-text-xs fm-font-semibold fm-text-muted fm-text-upper fm-mb-sm">첫 시즌 초점</div>
                    <p className="fm-text-sm fm-text-primary" style={{ lineHeight: 1.7, margin: 0 }}>
                      {teamMeta.openingFocus}
                    </p>
                  </div>
                  <div className="fm-card">
                    <div className="fm-text-xs fm-font-semibold fm-text-muted fm-text-upper fm-mb-sm">라이벌 구도</div>
                    <p className="fm-text-sm fm-text-primary" style={{ lineHeight: 1.7, margin: 0 }}>
                      {teamMeta.rivalry}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="fm-panel">
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
                    {starters.map((player) => (
                      <tr key={player.name}>
                        <td><span className="fm-text-accent fm-font-bold fm-text-xs">{player.role}</span></td>
                        <td className="fm-cell--name">{player.name}</td>
                        <td className="text-right fm-font-bold">{player.stats.ovr}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="fm-flex-col fm-gap-lg intro-sidebar">
            {mode === 'manager' && pendingManager && (
              <section className="fm-panel">
                <div className="fm-panel__header">
                  <span className="fm-panel__title">감독 프로필</span>
                </div>
                <div className="fm-panel__body fm-flex-col fm-gap-sm">
                  <div className="fm-info-row">
                    <span className="fm-info-row__label">이름</span>
                    <span className="fm-info-row__value">{pendingManager.name}</span>
                  </div>
                  <div className="fm-info-row">
                    <span className="fm-info-row__label">배경</span>
                    <span className="fm-info-row__value">{MANAGER_BG_LABELS[pendingManager.background]}</span>
                  </div>
                  <div className="fm-info-row">
                    <span className="fm-info-row__label">강점</span>
                    <span className="fm-info-row__value">
                      {managerTraits.length > 0 ? managerTraits.join(' / ') : '균형 있는 운영'}
                    </span>
                  </div>
                </div>
              </section>
            )}

            <section className="fm-panel">
              <div className="fm-panel__header">
                <span className="fm-panel__title">시즌 목표</span>
              </div>
              <div className="fm-panel__body fm-flex-col fm-gap-sm">
                <div className="fm-info-row">
                  <span className="fm-info-row__label">보드 요구</span>
                  <span className="fm-info-row__value fm-text-accent">{currentGoal.label}</span>
                </div>
                <div className="fm-info-row">
                  <span className="fm-info-row__label">순위 목표</span>
                  <span className="fm-info-row__value">{currentGoal.standing}위 이내</span>
                </div>
                <div className="fm-info-row">
                  <span className="fm-info-row__label">플레이오프</span>
                  <span className="fm-info-row__value">{currentGoal.playoff ? '사실상 필수' : '보너스 과제'}</span>
                </div>
                <div className="fm-info-row">
                  <span className="fm-info-row__label">국제전</span>
                  <span className="fm-info-row__value">{currentGoal.international ? '목표에 포함' : '장기 과제'}</span>
                </div>
                {negotiated && (
                  <div className="fm-alert fm-alert--warning fm-mt-sm">
                    <span className="fm-alert__text">목표를 한 단계 낮춘 대신 시즌 초반 보드 만족도는 줄어듭니다.</span>
                  </div>
                )}
              </div>
            </section>

            <section className="fm-panel">
              <div className="fm-panel__header">
                <span className="fm-panel__title">리스크 보상</span>
              </div>
              <div className="fm-panel__body fm-flex-col fm-gap-sm">
                <div className="fm-card">
                  <div className="fm-text-xs fm-font-semibold fm-text-muted fm-text-upper fm-mb-sm">성공 시</div>
                  <p className="fm-text-sm fm-text-primary" style={{ margin: 0, lineHeight: 1.7 }}>
                    {teamMeta.successReward}
                  </p>
                </div>
                <div className="fm-card">
                  <div className="fm-text-xs fm-font-semibold fm-text-muted fm-text-upper fm-mb-sm">실패 시</div>
                  <p className="fm-text-sm fm-text-primary" style={{ margin: 0, lineHeight: 1.7 }}>
                    {teamMeta.failureRisk}
                  </p>
                </div>
              </div>
            </section>

            <section className="fm-panel">
              <div className="fm-panel__header">
                <span className="fm-panel__title">세이브 슬롯</span>
              </div>
              <div className="fm-panel__body fm-flex-col fm-gap-sm">
                <div className="fm-text-sm fm-text-muted">
                  새 커리어를 저장할 슬롯을 선택하세요. 이미 사용 중인 슬롯을 고르면 해당 슬롯의 이전 커리어를 덮어씁니다.
                </div>
                <div className="fm-flex fm-gap-sm" style={{ flexWrap: 'wrap' }}>
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((slotNumber) => {
                    const occupied = occupiedSlots.includes(slotNumber);
                    return (
                      <button
                        key={slotNumber}
                        type="button"
                        className={`fm-btn ${selectedSlot === slotNumber ? 'fm-btn--primary' : 'fm-btn--ghost'}`}
                        onClick={() => setSelectedSlot(slotNumber)}
                      >
                        {occupied ? `슬롯 ${slotNumber} 덮어쓰기` : `슬롯 ${slotNumber}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {error && (
              <div className="fm-alert fm-alert--danger">
                <span className="fm-alert__text">{error}</span>
              </div>
            )}

            <div className="fm-flex fm-gap-md">
              {mode === 'manager' ? (
                <>
                  <button className="fm-btn fm-btn--primary fm-btn--lg fm-flex-1" onClick={handleAccept} disabled={isLoading}>
                    {isLoading ? '시즌 준비 중...' : '시즌 목표 수락'}
                  </button>
                  {!negotiated && (
                    <button className="fm-btn fm-btn--lg fm-flex-1" onClick={() => setNegotiated(true)}>
                      목표 조정
                    </button>
                  )}
                </>
              ) : (
                <button className="fm-btn fm-btn--primary fm-btn--lg fm-flex-1" onClick={handleAccept} disabled={isLoading}>
                  {isLoading ? '커리어 준비 중...' : '커리어 시작'}
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>

      <button className="fm-btn fm-btn--ghost intro-back" onClick={() => navigate('/team-select')}>
        팀 선택으로 돌아가기
      </button>
    </div>
  );
}
