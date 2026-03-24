/**
 * 상대팀 분석 리포트 페이지
 * - 상대팀 선택 후 분석 리포트 생성
 * - 정확도 기반 조건부 정보 표시
 * - 히스토리 탭으로 이전 리포트 조회
 */

import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { generateOpponentReport } from '../../../engine/analysis/matchAnalysisEngine';
import { getDatabase } from '../../../db/database';
import type {
  MatchAnalysisReport,
  OpponentPatterns,
  OpponentWeaknesses,
} from '../../../types/analysis';
import { Skeleton } from '../../../components/Skeleton';

type Tab = 'generate' | 'history';

const POSITION_LABELS: Record<string, string> = {
  top: 'TOP',
  jungle: 'JGL',
  mid: 'MID',
  adc: 'ADC',
  support: 'SUP',
};

const PHASE_LABELS: Record<string, string> = {
  early: '초반',
  late: '후반',
  balanced: '균등',
};

interface OpponentTeam {
  id: string;
  name: string;
}

export function AnalysisView() {
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);
  const setRecommendedBans = useGameStore((s) => s.setRecommendedBans);
  const [tab, setTab] = useState<Tab>('generate');
  const [opponents, setOpponents] = useState<OpponentTeam[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState('');
  const [report, setReport] = useState<MatchAnalysisReport | null>(null);
  const [history, setHistory] = useState<MatchAnalysisReport[]>([]);
  const [historyDetail, setHistoryDetail] = useState<MatchAnalysisReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userTeamId = save?.userTeamId ?? '';

  const loadOpponents = useCallback(async () => {
    if (!userTeamId) return;
    setIsLoading(true);
    try {
      const db = await getDatabase();
      const rows = await db.select<{ id: string; name: string; region: string }[]>(
        `SELECT t.id, t.name, t.region FROM teams t
         WHERE t.id != $1
           AND t.region = (SELECT region FROM teams WHERE id = $1)
         ORDER BY t.name`,
        [userTeamId],
      );
      setOpponents(rows);
      if (rows.length > 0 && !selectedOpponent) {
        setSelectedOpponent(rows[0].id);
      }
    } catch (err) {
      console.error('상대팀 목록 로딩 실패:', err);
      setError('상대팀 목록을 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [userTeamId, selectedOpponent]);

  const loadHistory = useCallback(async () => {
    if (!userTeamId) return;
    try {
      const db = await getDatabase();
      const rows = await db.select<{
        id: number;
        team_id: string;
        opponent_team_id: string;
        accuracy: number;
        recent_wins: number;
        recent_losses: number;
        play_style: string | null;
        key_player_id: string | null;
        weak_position: string | null;
        recommended_bans: string;
        generated_date: string;
      }[]>(
        `SELECT * FROM match_analysis_reports
         WHERE team_id = $1
         ORDER BY generated_date DESC
         LIMIT 20`,
        [userTeamId],
      );
      setHistory(
        rows.map((r) => ({
          id: r.id,
          teamId: r.team_id,
          opponentTeamId: r.opponent_team_id,
          accuracy: r.accuracy,
          recentWins: r.recent_wins,
          recentLosses: r.recent_losses,
          playStyle: r.play_style,
          keyPlayerId: r.key_player_id,
          weakPosition: r.weak_position,
          recommendedBans: JSON.parse(r.recommended_bans || '[]') as string[],
          generatedDate: r.generated_date,
          opponentPatterns: null,
          opponentWeaknesses: null,
        })),
      );
    } catch (err) {
      console.error('히스토리 로딩 실패:', err);
    }
  }, [userTeamId]);

  useEffect(() => {
    loadOpponents();
  }, [loadOpponents]);

  useEffect(() => {
    if (tab === 'history') {
      loadHistory();
    }
  }, [tab, loadHistory]);

  const handleGenerate = async () => {
    if (!selectedOpponent || !userTeamId || !season) return;
    setIsGenerating(true);
    setError(null);
    setReport(null);
    try {
      const result = await generateOpponentReport(
        userTeamId,
        selectedOpponent,
        season.currentDate,
      );
      setReport(result);
    } catch (err) {
      console.error('리포트 생성 실패:', err);
      setError('리포트 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getOpponentName = (opponentId: string) =>
    opponents.find((o) => o.id === opponentId)?.name ?? opponentId;

  const getAccuracyBadge = (accuracy: number) => {
    if (accuracy >= 80) return 'fm-badge fm-badge--success';
    if (accuracy >= 60) return 'fm-badge fm-badge--warning';
    return 'fm-badge fm-badge--danger';
  };

  if (isLoading) {
    return (
      <div className="fm-p-md">
        <Skeleton height="32px" width="192px" />
        <Skeleton height="256px" width="100%" />
      </div>
    );
  }

  const activeReport = tab === 'generate' ? report : historyDetail;

  return (
    <div className="fm-animate-in">
      {/* 페이지 헤더 */}
      <div className="fm-page-header">
        <h1 className="fm-page-title">상대팀 분석</h1>
      </div>

      {/* 탭 */}
      <div className="fm-tabs" role="tablist" aria-label="분석 탭">
        <button
          role="tab"
          aria-selected={tab === 'generate'}
          className={`fm-tab ${tab === 'generate' ? 'fm-tab--active' : ''}`}
          onClick={() => {
            setTab('generate');
            setHistoryDetail(null);
          }}
        >
          리포트 생성
        </button>
        <button
          role="tab"
          aria-selected={tab === 'history'}
          className={`fm-tab ${tab === 'history' ? 'fm-tab--active' : ''}`}
          onClick={() => setTab('history')}
        >
          히스토리
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="fm-alert fm-alert--danger" role="alert">
          <span className="fm-alert__icon">!</span>
          <span className="fm-alert__text">{error}</span>
        </div>
      )}

      {/* 리포트 생성 탭 */}
      {tab === 'generate' && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">상대팀 선택</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-items-center fm-gap-md">
              <label htmlFor="opponent-select" className="sr-only">
                상대팀 선택
              </label>
              <select
                id="opponent-select"
                value={selectedOpponent}
                onChange={(e) => setSelectedOpponent(e.target.value)}
                className="fm-select fm-flex-1"
                style={{ maxWidth: '240px' }}
              >
                {opponents.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !selectedOpponent}
                className="fm-btn fm-btn--primary"
              >
                {isGenerating ? '분석 중...' : '리포트 생성'}
              </button>
            </div>
            {opponents.length === 0 && (
              <p className="fm-text-sm fm-text-muted fm-mt-sm">같은 리전에 다른 팀이 없습니다.</p>
            )}
          </div>
        </div>
      )}

      {/* 히스토리 탭 */}
      {tab === 'history' && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">이전 리포트</span>
          </div>
          <div className="fm-panel__body--flush">
            {history.length === 0 ? (
              <div className="fm-p-md fm-text-center">
                <p className="fm-text-sm fm-text-muted">생성된 리포트가 없습니다.</p>
              </div>
            ) : (
              <div>
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => setHistoryDetail(h)}
                    className={`fm-match-row fm-flex fm-items-center fm-justify-between ${
                      historyDetail?.id === h.id ? 'fm-table__row--selected' : ''
                    }`}
                    style={{ width: '100%', cursor: 'pointer', background: historyDetail?.id === h.id ? 'var(--accent-dim)' : 'transparent', border: 'none', textAlign: 'left' }}
                  >
                    <div className="fm-flex fm-items-center fm-gap-md">
                      <span className="fm-text-md fm-font-medium fm-text-primary">{getOpponentName(h.opponentTeamId)}</span>
                      <span className="fm-text-xs fm-text-muted">{h.generatedDate}</span>
                    </div>
                    <div className="fm-flex fm-items-center fm-gap-md">
                      <span className="fm-text-sm fm-text-muted">
                        {h.recentWins}W {h.recentLosses}L
                      </span>
                      <span className={getAccuracyBadge(h.accuracy)}>
                        정확도 {h.accuracy}%
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 리포트 상세 표시 */}
      {activeReport && <ReportDetail report={activeReport} getOpponentName={getOpponentName} onSetBans={setRecommendedBans} />}
    </div>
  );
}

/* ─────────────────────────────────────────
 * 리포트 상세 컴포넌트
 * ───────────────────────────────────────── */

function ReportDetail({
  report,
  getOpponentName,
  onSetBans,
}: {
  report: MatchAnalysisReport;
  getOpponentName: (id: string) => string;
  onSetBans: (bans: string[]) => void;
}) {
  const getAccuracyBarClass = (accuracy: number) => {
    if (accuracy >= 80) return 'fm-bar__fill--green';
    if (accuracy >= 60) return 'fm-bar__fill--yellow';
    return 'fm-bar__fill--red';
  };

  const getAccuracyTextClass = (accuracy: number) => {
    if (accuracy >= 80) return 'fm-text-success';
    if (accuracy >= 60) return 'fm-text-warning';
    return 'fm-text-danger';
  };

  return (
    <div className="fm-animate-slide">
      {/* 기본 정보 카드 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">
            {getOpponentName(report.opponentTeamId)} 분석 리포트
          </span>
          <span className="fm-text-xs fm-text-muted">{report.generatedDate}</span>
        </div>
        <div className="fm-panel__body">
          {/* 정확도 바 */}
          <div className="fm-mb-md">
            <div className="fm-flex fm-items-center fm-justify-between fm-mb-sm">
              <span className="fm-text-sm fm-text-muted">분석 정확도</span>
              <span className={`fm-font-bold ${getAccuracyTextClass(report.accuracy)}`}>
                {report.accuracy}%
              </span>
            </div>
            <div className="fm-bar">
              <div className="fm-bar__track">
                <div
                  className={`fm-bar__fill ${getAccuracyBarClass(report.accuracy)}`}
                  style={{ width: `${report.accuracy}%` }}
                />
              </div>
            </div>
          </div>

          {/* 기본 정보 그리드 */}
          <div className="fm-grid fm-grid--3">
            <InfoCard label="최근 전적" value={`${report.recentWins}승 ${report.recentLosses}패`} />
            <InfoCard label="플레이스타일" value={report.playStyle ?? '분석 불가'} />
            <InfoCard
              label="전적 승률"
              value={
                report.recentWins + report.recentLosses > 0
                  ? `${Math.round((report.recentWins / (report.recentWins + report.recentLosses)) * 100)}%`
                  : '데이터 없음'
              }
            />
          </div>
        </div>
      </div>

      {/* 추천 밴 (accuracy 70+) */}
      {report.accuracy >= 70 && report.recommendedBans.length > 0 && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title fm-text-danger">추천 밴 챔피언</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-gap-sm fm-flex-wrap fm-mb-md">
              {report.recommendedBans.map((ban, i) => (
                <div key={ban} className="fm-card fm-text-center" style={{ borderColor: 'var(--danger-dim)', minWidth: '80px' }}>
                  <span className="fm-text-xs fm-text-muted">#{i + 1}</span>
                  <p className="fm-font-medium fm-text-primary">{ban}</p>
                </div>
              ))}
            </div>
            <button
              className="fm-btn fm-btn--danger"
              onClick={() => {
                onSetBans(report.recommendedBans);
              }}
            >
              드래프트에 추천 밴 적용
            </button>
          </div>
        </div>
      )}
      {report.accuracy < 70 && (
        <LockedSection label="추천 밴" requiredAccuracy={70} currentAccuracy={report.accuracy} />
      )}

      {/* 약한 포지션 / 키 플레이어 (accuracy 60+) */}
      {report.accuracy >= 60 && (report.weakPosition || report.keyPlayerId) && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">핵심 정보</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-grid fm-grid--2">
              {report.weakPosition && (
                <InfoCard
                  label="약한 포지션"
                  value={POSITION_LABELS[report.weakPosition] ?? report.weakPosition}
                  variant="warning"
                />
              )}
              {report.keyPlayerId && (
                <InfoCard label="키 플레이어" value={report.keyPlayerId} variant="info" />
              )}
            </div>
          </div>
        </div>
      )}
      {report.accuracy < 60 && (
        <LockedSection
          label="핵심 정보 (약한 포지션/키 플레이어)"
          requiredAccuracy={60}
          currentAccuracy={report.accuracy}
        />
      )}

      {/* 패턴 분석 (accuracy 65+) */}
      {report.accuracy >= 65 && report.opponentPatterns && (
        <PatternsSection patterns={report.opponentPatterns} />
      )}
      {report.accuracy < 65 && (
        <LockedSection label="패턴 분석" requiredAccuracy={65} currentAccuracy={report.accuracy} />
      )}

      {/* 약점 분석 (accuracy 75+) */}
      {report.accuracy >= 75 && report.opponentWeaknesses && (
        <WeaknessesSection weaknesses={report.opponentWeaknesses} />
      )}
      {report.accuracy < 75 && (
        <LockedSection label="약점 분석" requiredAccuracy={75} currentAccuracy={report.accuracy} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
 * 패턴 분석 섹션
 * ───────────────────────────────────────── */

function PatternsSection({ patterns }: { patterns: OpponentPatterns }) {
  const { strategyWinRates, averageGameDuration, firstBloodRate, mostPickedByPosition } = patterns;

  return (
    <div className="fm-panel">
      <div className="fm-panel__header">
        <span className="fm-panel__title fm-text-info">패턴 분석</span>
      </div>
      <div className="fm-panel__body">
        {/* 전략 통계 */}
        <div className="fm-grid fm-grid--4 fm-mb-md">
          <InfoCard label="평균 경기 시간" value={`${averageGameDuration}분`} />
          <InfoCard label="퍼스트 블러드율" value={`${Math.round(firstBloodRate * 100)}%`} />
          <InfoCard
            label="초반 어그로 승률"
            value={
              strategyWinRates.earlyAggro.total > 0
                ? `${Math.round(strategyWinRates.earlyAggro.rate * 100)}% (${strategyWinRates.earlyAggro.wins}/${strategyWinRates.earlyAggro.total})`
                : '데이터 없음'
            }
          />
          <InfoCard
            label="후반 스케일 승률"
            value={
              strategyWinRates.lateScale.total > 0
                ? `${Math.round(strategyWinRates.lateScale.rate * 100)}% (${strategyWinRates.lateScale.wins}/${strategyWinRates.lateScale.total})`
                : '데이터 없음'
            }
          />
        </div>

        {/* 포지션별 최다 픽 */}
        {mostPickedByPosition.length > 0 && (
          <div>
            <h4 className="fm-text-sm fm-text-muted fm-font-medium fm-mb-sm">포지션별 최다 픽</h4>
            <div className="fm-grid fm-grid--3">
              {mostPickedByPosition.map((pos) => (
                <div key={pos.position} className="fm-card">
                  <span className="fm-text-xs fm-text-info fm-font-semibold">
                    {POSITION_LABELS[pos.position] ?? pos.position}
                  </span>
                  <div className="fm-flex fm-flex-wrap fm-gap-xs fm-mt-sm">
                    {pos.champions.map((c) => (
                      <span key={c.championId} className="fm-text-sm fm-text-secondary">
                        {c.championId}
                        <span className="fm-text-xs fm-text-muted" style={{ marginLeft: '2px' }}>({c.pickCount})</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
 * 약점 분석 섹션
 * ───────────────────────────────────────── */

function WeaknessesSection({ weaknesses }: { weaknesses: OpponentWeaknesses }) {
  return (
    <div className="fm-panel">
      <div className="fm-panel__header">
        <span className="fm-panel__title fm-text-warning">약점 분석</span>
      </div>
      <div className="fm-panel__body">
        <div className="fm-grid fm-grid--3 fm-mb-md">
          <InfoCard
            label="최저 KDA 포지션"
            value={
              weaknesses.worstKdaPosition
                ? POSITION_LABELS[weaknesses.worstKdaPosition] ?? weaknesses.worstKdaPosition
                : '분석 불가'
            }
            variant="warning"
          />
          <InfoCard
            label="갱킹 취약 포지션"
            value={
              weaknesses.mostGankedPosition
                ? POSITION_LABELS[weaknesses.mostGankedPosition] ?? weaknesses.mostGankedPosition
                : '분석 불가'
            }
            variant="warning"
          />
          <InfoCard
            label="약한 시점"
            value={PHASE_LABELS[weaknesses.weakPhase] ?? weaknesses.weakPhase}
          />
        </div>

        {/* 포지션별 KDA 테이블 */}
        {weaknesses.positionKda.length > 0 && (
          <div>
            <h4 className="fm-text-sm fm-text-muted fm-font-medium fm-mb-sm">포지션별 KDA</h4>
            <div className="fm-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {weaknesses.positionKda.map((pk) => {
                const isWorst = pk.position === weaknesses.worstKdaPosition;
                return (
                  <div
                    key={pk.position}
                    className={`fm-card fm-text-center ${isWorst ? 'fm-card--highlight' : ''}`}
                    style={isWorst ? { borderColor: 'var(--danger)' } : undefined}
                  >
                    <span className="fm-text-xs fm-text-muted">
                      {POSITION_LABELS[pk.position] ?? pk.position}
                    </span>
                    <span className={`fm-font-bold ${isWorst ? 'fm-text-danger' : 'fm-text-primary'}`}>
                      {pk.kda.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
 * 공통 하위 컴포넌트
 * ───────────────────────────────────────── */

function InfoCard({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: string;
  variant?: 'default' | 'warning' | 'info';
}) {
  const valueClass =
    variant === 'warning'
      ? 'fm-text-warning'
      : variant === 'info'
        ? 'fm-text-info'
        : 'fm-text-primary';

  return (
    <div className="fm-card">
      <div className="fm-stat">
        <span className="fm-stat__label">{label}</span>
        <span className={`fm-stat__value--sm fm-font-medium ${valueClass}`}>{value}</span>
      </div>
    </div>
  );
}

function LockedSection({
  label,
  requiredAccuracy,
  currentAccuracy,
}: {
  label: string;
  requiredAccuracy: number;
  currentAccuracy: number;
}) {
  return (
    <div className="fm-panel" style={{ opacity: 0.5 }}>
      <div className="fm-panel__body">
        <div className="fm-flex fm-items-center fm-justify-between">
          <span className="fm-text-md fm-text-muted fm-font-medium">{label}</span>
          <span className="fm-text-xs fm-text-muted">
            정확도 {requiredAccuracy}% 필요 (현재 {currentAccuracy}%)
          </span>
        </div>
        <p className="fm-text-sm fm-text-muted fm-mt-sm">
          분석관의 능력을 향상시켜 더 정확한 정보를 확보하세요.
        </p>
      </div>
    </div>
  );
}
