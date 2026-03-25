/**
 * 시즌 종료 화면
 * - Phase 1: 정규시즌 종료 → 순위 표시 + 플레이오프 진출팀
 * - Phase 2: 플레이오프 진행 (DayView로 돌아감)
 * - Phase 3: 전체 시즌 종료 → 성장 결과 + 다음 스플릿
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../../stores/gameStore';
import { useBgm } from '../../../hooks/useBgm';
import {
  processRegularSeasonEnd,
  processFullSeasonEnd,
  type RegularSeasonEndResult,
  type SeasonEndResult,
} from '../../../engine/season/seasonEnd';
import { loadGameIntoStore } from '../../../db/initGame';
import { getMatchById } from '../../../db/queries';
import { generateSeasonSummary, type SeasonSummary } from '../../../ai/advancedAiService';
import type { Region } from '../../../types/game';

export function SeasonEndView() {
  useBgm('season_end');
  const navigate = useNavigate();
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);
  const mode = useGameStore((s) => s.mode);
  const dayPath = mode === 'player' ? '/player/day' : '/manager/day';

  const [regularResult, setRegularResult] = useState<RegularSeasonEndResult | null>(null);
  const [fullResult, setFullResult] = useState<SeasonEndResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [seasonSummary, setSeasonSummary] = useState<SeasonSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const userTeam = teams.find(t => t.id === save?.userTeamId);

  // Step 1: 정규시즌 종료 + 플레이오프 생성
  const handleRegularEnd = useCallback(async () => {
    if (!season || !userTeam) return;
    setIsProcessing(true);
    try {
      const result = await processRegularSeasonEnd(season, userTeam.region as Region);
      setRegularResult(result);
    } catch (err) {
      console.error('정규시즌 종료 처리 오류:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [season, userTeam]);

  // Step 2: 플레이오프 진행 (DayView로 복귀)
  const handleStartPlayoff = useCallback(() => {
    navigate(dayPath);
  }, [navigate, dayPath]);

  // Step 3: 전체 시즌 종료 처리
  const handleFullEnd = useCallback(async () => {
    if (!season) return;
    setIsProcessing(true);
    try {
      // 플레이오프 결승 매치에서 우승팀 ID 조회
      const finalMatch = await getMatchById(`playoff_s${season.id}_final`);
      let championTeamId: string | undefined;
      if (finalMatch?.isPlayed) {
        championTeamId = finalMatch.scoreHome > finalMatch.scoreAway
          ? finalMatch.teamHomeId
          : finalMatch.teamAwayId;
      }

      const result = await processFullSeasonEnd(season, championTeamId, save?.id);
      setFullResult(result);
    } catch (err) {
      console.error('시즌 종료 처리 오류:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [season, save]);

  // 시즌 요약 생성
  useEffect(() => {
    if (!fullResult || !regularResult || !userTeam) return;
    let cancelled = false;

    const loadSummary = async () => {
      setSummaryLoading(true);
      try {
        // 유저 팀 순위 찾기
        const userStanding = regularResult.standings.findIndex(
          (s) => s.teamId === userTeam.id,
        );
        const standing = userStanding >= 0 ? userStanding + 1 : 0;
        const userStats = regularResult.standings.find((s) => s.teamId === userTeam.id);

        // 성장 선수 수
        const userGrowths = fullResult.growthResults.filter((gr) =>
          userTeam.roster?.some((p) => p.id === gr.playerId),
        );
        const totalGrowthPlayers = userGrowths.filter((gr) => {
          const totalChange = Object.values(gr.changes).reduce((a, b) => a + b, 0);
          return totalChange > 0;
        }).length;

        // 플레이오프 결과
        let playoffResult: string | undefined;
        if (fullResult.championTeamId === userTeam.id) {
          playoffResult = '우승';
        } else if (regularResult.playoffTeamIds.includes(userTeam.id)) {
          playoffResult = '플레이오프 진출';
        }

        // 트로피
        const trophies: string[] = [];
        if (fullResult.championTeamId === userTeam.id) {
          trophies.push(`${season!.year}년 ${season!.split === 'spring' ? '스프링' : '서머'} 우승`);
        }

        const result = await generateSeasonSummary({
          teamName: userTeam.name,
          wins: userStats?.wins ?? 0,
          losses: userStats?.losses ?? 0,
          standing,
          playoffResult,
          trophies,
          totalGrowthPlayers,
        });

        if (!cancelled) setSeasonSummary(result);
      } catch (err) {
        console.warn('[SeasonEndView] summary generation failed:', err);
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    };

    loadSummary();
    return () => { cancelled = true; };
  }, [fullResult, regularResult, userTeam, season]);

  // 다음 스플릿 시작
  const handleNextSeason = useCallback(async () => {
    if (!save || !fullResult?.nextSeasonId) return;
    await loadGameIntoStore(save.id);
    navigate(dayPath);
  }, [save, fullResult, navigate, dayPath]);

  if (!season) {
    return <p className="fm-text-muted">데이터를 불러오는 중...</p>;
  }

  // 전체 시즌 종료 결과 표시
  if (fullResult) {
    return (
      <div>
        <h1 className="fm-page-title fm-mb-lg">
          {season.year}년 {season.split === 'spring' ? '스프링' : '서머'} 시즌 완료
        </h1>

        {fullResult.championTeamId && (
          <div className="fm-panel fm-mb-md">
            <div className="fm-panel__header">
              <span className="fm-panel__title">플레이오프 우승</span>
            </div>
            <div className="fm-panel__body">
              <p className="fm-text-xl fm-font-bold fm-text-accent">
                {teams.find(t => t.id === fullResult.championTeamId)?.name ?? fullResult.championTeamId}
              </p>
            </div>
          </div>
        )}

        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__header">
            <span className="fm-panel__title">선수 성장/하락</span>
          </div>
          <div className="fm-panel__body">
            {fullResult.growthResults
              .filter(gr => {
                const team = teams.find(t => t.roster?.some(p => p.id === gr.playerId));
                return team?.id === save?.userTeamId;
              })
              .map(gr => {
                const player = teams
                  .find(t => t.id === save?.userTeamId)
                  ?.roster?.find(p => p.id === gr.playerId);
                const totalChange = Object.values(gr.changes).reduce((a, b) => a + b, 0);
                return (
                  <div key={gr.playerId} className="fm-flex fm-items-center fm-gap-md" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span className="fm-text-lg fm-font-medium fm-text-primary" style={{ minWidth: '100px' }}>
                      {player?.name ?? gr.playerId}
                    </span>
                    <span className={`fm-badge ${gr.phase === 'growing' ? 'fm-badge--success' : gr.phase === 'peak' ? 'fm-badge--warning' : 'fm-badge--danger'}`}>
                      {gr.phase === 'growing' ? '성장기' : gr.phase === 'peak' ? '전성기' : '하락기'}
                    </span>
                    <span
                      className={`fm-text-lg fm-font-bold ${totalChange >= 0 ? 'fm-text-success' : 'fm-text-danger'}`}
                      style={{ marginLeft: 'auto' }}
                    >
                      {totalChange >= 0 ? '+' : ''}{Math.round(totalChange)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* 시즌 이야기 */}
        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__header">
            <span className="fm-panel__title">시즌 이야기</span>
          </div>
          <div className="fm-panel__body">
            {summaryLoading ? (
              <div className="fm-flex-col fm-gap-sm">
                <div style={{ height: '14px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px' }} />
                <div style={{ height: '14px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', width: '80%' }} />
                <div style={{ height: '14px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', width: '60%' }} />
              </div>
            ) : seasonSummary ? (
              <div className="fm-flex-col fm-gap-md">
                <p className="fm-text-lg fm-text-primary" style={{ lineHeight: '1.6' }}>
                  {seasonSummary.narrative}
                </p>
                {seasonSummary.highlights.length > 0 && (
                  <div>
                    <span className="fm-text-base fm-font-semibold fm-text-accent fm-mb-sm" style={{ display: 'block' }}>
                      하이라이트
                    </span>
                    {seasonSummary.highlights.map((h, i) => (
                      <div key={i} className="fm-flex fm-items-center fm-gap-sm" style={{ padding: '4px 0' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                        <span className="fm-text-md fm-text-secondary">{h}</span>
                      </div>
                    ))}
                  </div>
                )}
                {seasonSummary.keyMoments.length > 0 && (
                  <div>
                    <span className="fm-text-base fm-font-semibold fm-text-info fm-mb-sm" style={{ display: 'block' }}>
                      핵심 순간
                    </span>
                    {seasonSummary.keyMoments.map((m, i) => (
                      <div key={i} className="fm-flex fm-items-center fm-gap-sm" style={{ padding: '4px 0' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--info)', flexShrink: 0 }} />
                        <span className="fm-text-md fm-text-secondary">{m}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="fm-alert fm-alert--warning" style={{ borderLeft: '3px solid var(--accent)' }}>
                  <div className="fm-flex-col fm-gap-xs">
                    <span className="fm-text-base fm-font-semibold fm-text-muted">
                      다음 시즌 전망
                    </span>
                    <span className="fm-text-lg fm-text-primary">
                      {seasonSummary.outlook}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="fm-text-lg fm-text-muted">시즌 요약을 생성할 수 없습니다</p>
            )}
          </div>
        </div>

        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__body">
            <p className="fm-text-lg fm-text-muted fm-mb-md">
              다음 스플릿: {fullResult.nextYear}년 {fullResult.nextSplit === 'summer' ? '서머' : '스프링'}
            </p>
            <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={handleNextSeason}>다음 스플릿 시작</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="fm-page-title fm-mb-lg">
        {season.year}년 {season.split === 'spring' ? '스프링' : '서머'} 정규시즌 종료
      </h1>

      {/* Step 1: 순위 확인 */}
      {!regularResult && (
        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__body">
            <p className="fm-text-lg fm-text-muted fm-mb-md">정규시즌이 종료되었습니다. 순위를 확정하고 플레이오프를 준비합니다.</p>
            <button
              className="fm-btn fm-btn--primary fm-btn--lg"
              onClick={handleRegularEnd}
              disabled={isProcessing}
            >
              {isProcessing ? '처리 중...' : '순위 확정'}
            </button>
          </div>
        </div>
      )}

      {regularResult && (
        <>
          {/* 순위표 */}
          <div className="fm-panel fm-mb-md">
            <div className="fm-panel__header">
              <span className="fm-panel__title">정규시즌 최종 순위</span>
            </div>
            <div className="fm-panel__body--flush fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th className="text-center">순위</th>
                    <th>팀</th>
                    <th className="text-center">승</th>
                    <th className="text-center">패</th>
                    <th className="text-center">세트</th>
                    <th className="text-center">플레이오프</th>
                  </tr>
                </thead>
                <tbody>
                  {regularResult.standings.map((s, i) => {
                    const team = teams.find(t => t.id === s.teamId);
                    const isUser = s.teamId === save?.userTeamId;
                    const isPlayoff = regularResult.playoffTeamIds.includes(s.teamId);
                    return (
                      <tr key={s.teamId} className={isUser ? 'fm-table__row--selected' : ''}>
                        <td className="text-center">{i + 1}</td>
                        <td className={isUser ? 'fm-cell--name fm-font-bold' : 'fm-cell--name'}>
                          {team?.shortName ?? s.teamId}
                        </td>
                        <td className="text-center">{s.wins}</td>
                        <td className="text-center">{s.losses}</td>
                        <td className="text-center">
                          <span className={s.setWins - s.setLosses >= 0 ? 'fm-text-success' : 'fm-text-danger'}>
                            {s.setWins - s.setLosses >= 0 ? '+' : ''}{s.setWins - s.setLosses}
                          </span>
                        </td>
                        <td className="text-center">
                          {isPlayoff ? (
                            <span className="fm-text-accent fm-font-semibold">진출</span>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 플레이오프 브래킷 미리보기 */}
          <div className="fm-panel fm-mb-md">
            <div className="fm-panel__header">
              <span className="fm-panel__title">플레이오프 대진</span>
            </div>
            <div className="fm-panel__body fm-flex-col fm-gap-sm">
              <div className="fm-info-row">
                <span className="fm-info-row__label">8강 1경기</span>
                <span className="fm-info-row__value">
                  {teams.find(t => t.id === regularResult.playoffTeamIds[2])?.shortName} vs{' '}
                  {teams.find(t => t.id === regularResult.playoffTeamIds[5])?.shortName}
                  <span className="fm-badge fm-badge--default" style={{ marginLeft: '8px' }}>Bo3</span>
                </span>
              </div>
              <div className="fm-info-row">
                <span className="fm-info-row__label">8강 2경기</span>
                <span className="fm-info-row__value">
                  {teams.find(t => t.id === regularResult.playoffTeamIds[3])?.shortName} vs{' '}
                  {teams.find(t => t.id === regularResult.playoffTeamIds[4])?.shortName}
                  <span className="fm-badge fm-badge--default" style={{ marginLeft: '8px' }}>Bo3</span>
                </span>
              </div>
              <div className="fm-info-row">
                <span className="fm-info-row__label">준결승</span>
                <span className="fm-info-row__value">
                  {teams.find(t => t.id === regularResult.playoffTeamIds[0])?.shortName} / {' '}
                  {teams.find(t => t.id === regularResult.playoffTeamIds[1])?.shortName} (1~2시드 직행)
                  <span className="fm-badge fm-badge--default" style={{ marginLeft: '8px' }}>Bo5</span>
                </span>
              </div>
              <div className="fm-info-row">
                <span className="fm-info-row__label">결승</span>
                <span className="fm-info-row__value">
                  준결승 승자 대결
                  <span className="fm-badge fm-badge--default" style={{ marginLeft: '8px' }}>Bo5</span>
                </span>
              </div>
            </div>
          </div>

          {/* 플레이오프 시작 / 전체 시즌 종료 */}
          <div className="fm-panel fm-mb-md">
            <div className="fm-panel__body">
              <p className="fm-text-lg fm-text-muted fm-mb-md">
                플레이오프 시작일: {regularResult.playoffStartDate}
              </p>
              <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={handleStartPlayoff}>
                플레이오프 진행
              </button>
            </div>
          </div>

          {/* 플레이오프 완료 후 전체 시즌 종료 버튼 */}
          {!fullResult && (
            <div className="fm-panel fm-mb-md">
              <div className="fm-panel__body">
                <p className="fm-text-lg fm-text-muted fm-mb-md">
                  플레이오프가 완료되었으면 전체 시즌을 종료하고 성장 결과를 확인합니다.
                </p>
                <button
                  className="fm-btn fm-btn--primary fm-btn--lg"
                  onClick={handleFullEnd}
                  disabled={isProcessing}
                >
                  {isProcessing ? '처리 중...' : '전체 시즌 종료'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
