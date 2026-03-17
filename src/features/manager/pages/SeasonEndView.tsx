/**
 * 시즌 종료 화면
 * - Phase 1: 정규시즌 종료 → 순위 표시 + 플레이오프 진출팀
 * - Phase 2: 플레이오프 진행 (DayView로 돌아감)
 * - Phase 3: 전체 시즌 종료 → 성장 결과 + 다음 스플릿
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../../stores/gameStore';
import {
  processRegularSeasonEnd,
  processFullSeasonEnd,
  type RegularSeasonEndResult,
  type SeasonEndResult,
} from '../../../engine/season/seasonEnd';
import { loadGameIntoStore } from '../../../db/initGame';
import { getMatchById } from '../../../db/queries';
import type { Region } from '../../../types/game';

export function SeasonEndView() {
  const navigate = useNavigate();
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);

  const [regularResult, setRegularResult] = useState<RegularSeasonEndResult | null>(null);
  const [fullResult, setFullResult] = useState<SeasonEndResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
    navigate('/manager/day');
  }, [navigate]);

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

      const result = await processFullSeasonEnd(season, championTeamId);
      setFullResult(result);
    } catch (err) {
      console.error('시즌 종료 처리 오류:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [season]);

  // 다음 스플릿 시작
  const handleNextSeason = useCallback(async () => {
    if (!save || !fullResult?.nextSeasonId) return;
    await loadGameIntoStore(save.id);
    navigate('/manager/day');
  }, [save, fullResult, navigate]);

  if (!season) {
    return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  }

  // 전체 시즌 종료 결과 표시
  if (fullResult) {
    return (
      <div>
        <h1 style={styles.title}>
          {season.year}년 {season.split === 'spring' ? '스프링' : '서머'} 시즌 완료
        </h1>

        {fullResult.championTeamId && (
          <div style={styles.card}>
            <h2 style={styles.subTitle}>플레이오프 우승</h2>
            <p style={{ fontSize: '18px', fontWeight: 700, color: '#c89b3c' }}>
              {teams.find(t => t.id === fullResult.championTeamId)?.name ?? fullResult.championTeamId}
            </p>
          </div>
        )}

        <div style={styles.card}>
          <h2 style={styles.subTitle}>선수 성장/하락</h2>
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
                <div key={gr.playerId} style={styles.growthRow}>
                  <span style={styles.playerName}>{player?.name ?? gr.playerId}</span>
                  <span style={{
                    ...styles.phaseBadge,
                    color: gr.phase === 'growing' ? '#2ecc71'
                      : gr.phase === 'peak' ? '#f39c12' : '#e74c3c',
                  }}>
                    {gr.phase === 'growing' ? '성장기' : gr.phase === 'peak' ? '전성기' : '하락기'}
                  </span>
                  <span style={{
                    ...styles.changeValue,
                    color: totalChange >= 0 ? '#2ecc71' : '#e74c3c',
                  }}>
                    {totalChange >= 0 ? '+' : ''}{Math.round(totalChange)}
                  </span>
                </div>
              );
            })}
        </div>

        <div style={styles.card}>
          <p style={styles.description}>
            다음 스플릿: {fullResult.nextYear}년 {fullResult.nextSplit === 'summer' ? '서머' : '스프링'}
          </p>
          <button style={styles.btn} onClick={handleNextSeason}>다음 스플릿 시작</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={styles.title}>
        {season.year}년 {season.split === 'spring' ? '스프링' : '서머'} 정규시즌 종료
      </h1>

      {/* Step 1: 순위 확인 */}
      {!regularResult && (
        <div style={styles.card}>
          <p style={styles.description}>정규시즌이 종료되었습니다. 순위를 확정하고 플레이오프를 준비합니다.</p>
          <button
            style={{ ...styles.btn, opacity: isProcessing ? 0.5 : 1 }}
            onClick={handleRegularEnd}
            disabled={isProcessing}
          >
            {isProcessing ? '처리 중...' : '순위 확정'}
          </button>
        </div>
      )}

      {regularResult && (
        <>
          {/* 순위표 */}
          <div style={styles.card}>
            <h2 style={styles.subTitle}>정규시즌 최종 순위</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>순위</th>
                  <th style={styles.th}>팀</th>
                  <th style={styles.th}>승</th>
                  <th style={styles.th}>패</th>
                  <th style={styles.th}>세트</th>
                  <th style={styles.th}>플레이오프</th>
                </tr>
              </thead>
              <tbody>
                {regularResult.standings.map((s, i) => {
                  const team = teams.find(t => t.id === s.teamId);
                  const isUser = s.teamId === save?.userTeamId;
                  const isPlayoff = regularResult.playoffTeamIds.includes(s.teamId);
                  return (
                    <tr key={s.teamId} style={isUser ? styles.highlightRow : undefined}>
                      <td style={styles.td}>{i + 1}</td>
                      <td style={{ ...styles.td, fontWeight: isUser ? 700 : 400 }}>
                        {team?.shortName ?? s.teamId}
                      </td>
                      <td style={styles.td}>{s.wins}</td>
                      <td style={styles.td}>{s.losses}</td>
                      <td style={styles.td}>
                        <span style={{ color: s.setWins - s.setLosses >= 0 ? '#2ecc71' : '#e74c3c' }}>
                          {s.setWins - s.setLosses >= 0 ? '+' : ''}{s.setWins - s.setLosses}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {isPlayoff ? (
                          <span style={{ color: '#c89b3c', fontWeight: 600 }}>진출</span>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 플레이오프 브래킷 미리보기 */}
          <div style={styles.card}>
            <h2 style={styles.subTitle}>플레이오프 대진</h2>
            <div style={styles.bracketInfo}>
              <p style={styles.bracketRow}>
                <span style={styles.bracketLabel}>8강 1경기:</span>
                <span style={styles.bracketTeams}>
                  {teams.find(t => t.id === regularResult.playoffTeamIds[2])?.shortName} vs{' '}
                  {teams.find(t => t.id === regularResult.playoffTeamIds[5])?.shortName}
                </span>
                <span style={styles.bracketFormat}>Bo3</span>
              </p>
              <p style={styles.bracketRow}>
                <span style={styles.bracketLabel}>8강 2경기:</span>
                <span style={styles.bracketTeams}>
                  {teams.find(t => t.id === regularResult.playoffTeamIds[3])?.shortName} vs{' '}
                  {teams.find(t => t.id === regularResult.playoffTeamIds[4])?.shortName}
                </span>
                <span style={styles.bracketFormat}>Bo3</span>
              </p>
              <p style={styles.bracketRow}>
                <span style={styles.bracketLabel}>준결승:</span>
                <span style={styles.bracketTeams}>
                  {teams.find(t => t.id === regularResult.playoffTeamIds[0])?.shortName} / {' '}
                  {teams.find(t => t.id === regularResult.playoffTeamIds[1])?.shortName} (1~2시드 직행)
                </span>
                <span style={styles.bracketFormat}>Bo5</span>
              </p>
              <p style={styles.bracketRow}>
                <span style={styles.bracketLabel}>결승:</span>
                <span style={styles.bracketTeams}>준결승 승자 대결</span>
                <span style={styles.bracketFormat}>Bo5</span>
              </p>
            </div>
          </div>

          {/* 플레이오프 시작 / 전체 시즌 종료 */}
          <div style={styles.card}>
            <p style={styles.description}>
              플레이오프 시작일: {regularResult.playoffStartDate}
            </p>
            <button style={styles.btn} onClick={handleStartPlayoff}>
              플레이오프 진행
            </button>
          </div>

          {/* 플레이오프 완료 후 전체 시즌 종료 버튼 */}
          {!fullResult && (
            <div style={styles.card}>
              <p style={styles.description}>
                플레이오프가 완료되었으면 전체 시즌을 종료하고 성장 결과를 확인합니다.
              </p>
              <button
                style={{ ...styles.btn, opacity: isProcessing ? 0.5 : 1 }}
                onClick={handleFullEnd}
                disabled={isProcessing}
              >
                {isProcessing ? '처리 중...' : '전체 시즌 종료'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '24px',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a2a4a',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '16px',
  },
  subTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#c89b3c',
    marginBottom: '14px',
  },
  description: {
    fontSize: '14px',
    color: '#8a8a9a',
    marginBottom: '16px',
  },
  btn: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    background: '#c89b3c',
    color: '#0d0d1a',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  th: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#6a6a7a',
    textAlign: 'center' as const,
    padding: '8px 12px',
    borderBottom: '1px solid #2a2a4a',
  },
  td: {
    fontSize: '14px',
    color: '#e0e0e0',
    textAlign: 'center' as const,
    padding: '8px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  highlightRow: {
    background: 'rgba(200,155,60,0.08)',
  },
  growthRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  playerName: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#e0e0e0',
    minWidth: '100px',
  },
  phaseBadge: {
    fontSize: '12px',
    fontWeight: 600,
  },
  changeValue: {
    fontSize: '14px',
    fontWeight: 700,
    marginLeft: 'auto',
  },
  bracketInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  bracketRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '6px 0',
    fontSize: '14px',
    color: '#e0e0e0',
  },
  bracketLabel: {
    color: '#8a8a9a',
    minWidth: '80px',
    fontSize: '13px',
  },
  bracketTeams: {
    fontWeight: 500,
    flex: 1,
  },
  bracketFormat: {
    fontSize: '12px',
    color: '#6a6a7a',
    background: 'rgba(255,255,255,0.05)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
};
