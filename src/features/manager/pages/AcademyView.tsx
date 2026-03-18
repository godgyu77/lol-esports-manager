/**
 * 아카데미 페이지
 * - 탭 1: 아카데미 — 현재 아카데미 선수 목록, 훈련/승격
 * - 탭 2: 신인 드래프트 — 드래프트 풀 목록, 드래프트 버튼
 * - 탭 3: 스카우팅 발굴 — 아카데미 선수 랜덤 추가
 */

import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  getAcademyPlayers,
  trainAcademyPlayer,
  promoteToMainRoster,
  getRookieDraftPool,
  generateRookieDraftPool,
  draftRookie,
  addAcademyPlayer,
} from '../../../engine/academy/academyEngine';
import type { AcademyPlayer, RookieDraftEntry } from '../../../types/academy';

type Tab = 'academy' | 'draft' | 'scouting';

const POSITION_LABELS: Record<string, string> = {
  top: 'TOP', jungle: 'JGL', mid: 'MID', adc: 'ADC', support: 'SUP',
};

export function AcademyView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);

  const [tab, setTab] = useState<Tab>('academy');
  const [academyPlayers, setAcademyPlayers] = useState<AcademyPlayer[]>([]);
  const [draftPool, setDraftPool] = useState<RookieDraftEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const userTeamId = save?.userTeamId ?? '';
  const seasonId = season?.id ?? 0;

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const loadData = useCallback(async () => {
    if (!save || !season) return;
    setIsLoading(true);
    try {
      const [players, pool] = await Promise.all([
        getAcademyPlayers(userTeamId),
        getRookieDraftPool(seasonId),
      ]);
      setAcademyPlayers(players);
      setDraftPool(pool);
    } catch (err) {
      console.error('아카데미 데이터 로딩 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, [save, season, userTeamId, seasonId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleTrain = async (playerId: number) => {
    try {
      const result = await trainAcademyPlayer(playerId);
      if (result) {
        showMessage(`${result.name} 훈련 완료! (진행도: ${result.trainingProgress}%)`, 'success');
        await loadData();
      }
    } catch (err) {
      console.error('훈련 실패:', err);
      showMessage('훈련에 실패했습니다.', 'error');
    }
  };

  const handlePromote = async (playerId: number, playerName: string) => {
    if (!season) return;
    try {
      await promoteToMainRoster(playerId, userTeamId, seasonId);
      showMessage(`${playerName}이(가) 1군으로 승격되었습니다!`, 'success');
      await loadData();
    } catch (err) {
      console.error('승격 실패:', err);
      showMessage('승격에 실패했습니다.', 'error');
    }
  };

  const handleGenerateDraftPool = async () => {
    try {
      await generateRookieDraftPool(seasonId);
      showMessage('신인 드래프트 풀이 생성되었습니다.', 'success');
      await loadData();
    } catch (err) {
      console.error('드래프트 풀 생성 실패:', err);
      showMessage('드래프트 풀 생성에 실패했습니다.', 'error');
    }
  };

  const handleDraft = async (rookieId: number, rookieName: string) => {
    try {
      await draftRookie(rookieId, userTeamId);
      showMessage(`${rookieName}을(를) 드래프트했습니다!`, 'success');
      await loadData();
    } catch (err) {
      console.error('드래프트 실패:', err);
      showMessage('드래프트에 실패했습니다.', 'error');
    }
  };

  const handleAddAcademyPlayer = async () => {
    if (!season) return;
    try {
      const player = await addAcademyPlayer(userTeamId, null, null, null, season.currentDate);
      showMessage(`새 아카데미 선수 ${player.name}이(가) 영입되었습니다!`, 'success');
      await loadData();
    } catch (err) {
      console.error('아카데미 선수 추가 실패:', err);
      showMessage('아카데미 선수 추가에 실패했습니다.', 'error');
    }
  };

  if (!season || !save) {
    return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p style={{ color: '#6a6a7a' }}>아카데미 정보를 불러오는 중...</p>;
  }

  const availableDraft = draftPool.filter(r => !r.isDrafted);

  return (
    <div>
      <h1 style={styles.title}>아카데미</h1>

      {message && (
        <div style={{
          ...styles.message,
          borderColor: message.type === 'success' ? '#2ecc71' : '#e74c3c',
          color: message.type === 'success' ? '#2ecc71' : '#e74c3c',
        }}>
          {message.text}
        </div>
      )}

      {/* 탭 */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(tab === 'academy' ? styles.activeTab : {}) }}
          onClick={() => setTab('academy')}
        >
          아카데미 ({academyPlayers.length})
        </button>
        <button
          style={{ ...styles.tab, ...(tab === 'draft' ? styles.activeTab : {}) }}
          onClick={() => setTab('draft')}
        >
          신인 드래프트 ({availableDraft.length})
        </button>
        <button
          style={{ ...styles.tab, ...(tab === 'scouting' ? styles.activeTab : {}) }}
          onClick={() => setTab('scouting')}
        >
          스카우팅 발굴
        </button>
      </div>

      {/* 탭 1: 아카데미 */}
      {tab === 'academy' && (
        <div>
          <h2 style={styles.subTitle}>아카데미 선수 목록</h2>
          {academyPlayers.length === 0 ? (
            <p style={styles.empty}>아카데미 선수가 없습니다. 스카우팅 발굴이나 신인 드래프트를 통해 선수를 추가하세요.</p>
          ) : (
            <div style={styles.cardGrid}>
              {academyPlayers.map(player => {
                const avgStat = Math.round(
                  (player.stats.mechanical + player.stats.gameSense + player.stats.teamwork +
                   player.stats.consistency + player.stats.laning + player.stats.aggression) / 6,
                );
                return (
                  <div key={player.id} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <span style={styles.positionBadge}>
                        {POSITION_LABELS[player.position] ?? player.position}
                      </span>
                      <span style={styles.playerName}>{player.name}</span>
                      <span style={styles.playerAge}>{player.age}세</span>
                    </div>

                    <div style={styles.statsGrid}>
                      <div style={styles.statItem}>
                        <span style={styles.statLabel}>기계적</span>
                        <span style={styles.statValue}>{player.stats.mechanical}</span>
                      </div>
                      <div style={styles.statItem}>
                        <span style={styles.statLabel}>판단력</span>
                        <span style={styles.statValue}>{player.stats.gameSense}</span>
                      </div>
                      <div style={styles.statItem}>
                        <span style={styles.statLabel}>팀워크</span>
                        <span style={styles.statValue}>{player.stats.teamwork}</span>
                      </div>
                      <div style={styles.statItem}>
                        <span style={styles.statLabel}>일관성</span>
                        <span style={styles.statValue}>{player.stats.consistency}</span>
                      </div>
                      <div style={styles.statItem}>
                        <span style={styles.statLabel}>라인전</span>
                        <span style={styles.statValue}>{player.stats.laning}</span>
                      </div>
                      <div style={styles.statItem}>
                        <span style={styles.statLabel}>공격성</span>
                        <span style={styles.statValue}>{player.stats.aggression}</span>
                      </div>
                    </div>

                    <div style={styles.metaRow}>
                      <span style={styles.metaLabel}>잠재력</span>
                      <span style={{ ...styles.metaValue, color: '#c89b3c' }}>{player.potential}</span>
                    </div>
                    <div style={styles.metaRow}>
                      <span style={styles.metaLabel}>평균 스탯</span>
                      <span style={styles.metaValue}>{avgStat}</span>
                    </div>

                    {/* 훈련 진행도 바 */}
                    <div style={styles.progressContainer}>
                      <div style={styles.progressLabel}>
                        <span>훈련 진행도</span>
                        <span>{player.trainingProgress}%</span>
                      </div>
                      <div style={styles.progressBar}>
                        <div style={{
                          ...styles.progressFill,
                          width: `${player.trainingProgress}%`,
                          background: player.promotionReady ? '#2ecc71' : '#c89b3c',
                        }} />
                      </div>
                    </div>

                    <div style={styles.cardActions}>
                      <button
                        style={styles.trainBtn}
                        onClick={() => handleTrain(player.id)}
                      >
                        훈련
                      </button>
                      {player.promotionReady && (
                        <button
                          style={styles.promoteBtn}
                          onClick={() => handlePromote(player.id, player.name)}
                        >
                          1군 승격
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 탭 2: 신인 드래프트 */}
      {tab === 'draft' && (
        <div>
          <div style={styles.sectionHeader}>
            <h2 style={styles.subTitle}>신인 드래프트 풀</h2>
            {draftPool.length === 0 && (
              <button style={styles.generateBtn} onClick={handleGenerateDraftPool}>
                드래프트 풀 생성
              </button>
            )}
          </div>

          {draftPool.length === 0 ? (
            <p style={styles.empty}>드래프트 풀이 아직 생성되지 않았습니다.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>포지션</th>
                  <th style={styles.th}>이름</th>
                  <th style={styles.th}>나이</th>
                  <th style={styles.th}>예상 능력</th>
                  <th style={styles.th}>국적</th>
                  <th style={styles.th}>상태</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {draftPool.map(rookie => (
                  <tr key={rookie.id} style={styles.tr}>
                    <td style={{ ...styles.td, color: '#c89b3c', fontWeight: 600 }}>
                      {POSITION_LABELS[rookie.position] ?? rookie.position}
                    </td>
                    <td style={{ ...styles.td, fontWeight: 500, color: '#e0e0e0' }}>
                      {rookie.name}
                    </td>
                    <td style={styles.td}>{rookie.age}세</td>
                    <td style={{ ...styles.td, fontWeight: 600 }}>
                      <span style={{
                        color: rookie.estimatedAbility >= 70 ? '#c89b3c'
                             : rookie.estimatedAbility >= 50 ? '#4ecdc4'
                             : '#8a8a9a',
                      }}>
                        {rookie.estimatedAbility}
                      </span>
                    </td>
                    <td style={styles.td}>{rookie.nationality}</td>
                    <td style={styles.td}>
                      {rookie.isDrafted ? (
                        <span style={{ color: '#6a6a7a' }}>드래프트됨</span>
                      ) : (
                        <span style={{ color: '#2ecc71' }}>가능</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      {!rookie.isDrafted && (
                        <button
                          style={styles.draftBtn}
                          onClick={() => handleDraft(rookie.id, rookie.name)}
                        >
                          드래프트
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 탭 3: 스카우팅 발굴 */}
      {tab === 'scouting' && (
        <div>
          <h2 style={styles.subTitle}>스카우팅 발굴</h2>
          <p style={styles.description}>
            랜덤으로 아카데미 유망주를 발굴하여 팀의 아카데미에 추가합니다.
            발굴된 선수는 훈련을 통해 성장시킨 후 1군으로 승격할 수 있습니다.
          </p>

          <button style={styles.scoutBtn} onClick={handleAddAcademyPlayer}>
            유망주 발굴
          </button>

          {academyPlayers.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h3 style={styles.subTitle}>현재 아카데미 ({academyPlayers.length}명)</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>포지션</th>
                    <th style={styles.th}>이름</th>
                    <th style={styles.th}>나이</th>
                    <th style={styles.th}>잠재력</th>
                    <th style={styles.th}>평균 스탯</th>
                    <th style={styles.th}>진행도</th>
                    <th style={styles.th}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {academyPlayers.map(player => {
                    const avgStat = Math.round(
                      (player.stats.mechanical + player.stats.gameSense + player.stats.teamwork +
                       player.stats.consistency + player.stats.laning + player.stats.aggression) / 6,
                    );
                    return (
                      <tr key={player.id} style={styles.tr}>
                        <td style={{ ...styles.td, color: '#c89b3c', fontWeight: 600 }}>
                          {POSITION_LABELS[player.position] ?? player.position}
                        </td>
                        <td style={{ ...styles.td, fontWeight: 500, color: '#e0e0e0' }}>
                          {player.name}
                        </td>
                        <td style={styles.td}>{player.age}세</td>
                        <td style={{ ...styles.td, color: '#c89b3c' }}>{player.potential}</td>
                        <td style={styles.td}>{avgStat}</td>
                        <td style={styles.td}>{player.trainingProgress}%</td>
                        <td style={styles.td}>
                          {player.promotionReady ? (
                            <span style={{ color: '#2ecc71', fontWeight: 600 }}>승격 가능</span>
                          ) : (
                            <span style={{ color: '#8a8a9a' }}>훈련중</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { fontSize: '24px', fontWeight: 700, color: '#f0e6d2', marginBottom: '16px' },
  message: {
    padding: '10px 16px', marginBottom: '12px', border: '1px solid',
    borderRadius: '6px', fontSize: '13px', background: 'rgba(255,255,255,0.02)',
  },
  tabs: { display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid #2a2a4a' },
  tab: {
    padding: '10px 20px', background: 'none', border: 'none',
    borderBottom: '2px solid transparent', color: '#6a6a7a',
    fontSize: '13px', fontWeight: 500, cursor: 'pointer',
  },
  activeTab: { color: '#c89b3c', borderBottomColor: '#c89b3c' },
  subTitle: { fontSize: '15px', fontWeight: 600, color: '#c89b3c', marginBottom: '12px' },
  empty: { color: '#6a6a7a', fontSize: '13px' },
  description: { color: '#8a8a9a', fontSize: '13px', marginBottom: '16px', lineHeight: '1.6' },
  sectionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px',
  },
  // 카드 그리드
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' },
  card: {
    background: '#12122a', border: '1px solid #2a2a4a', borderRadius: '8px', padding: '16px',
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px',
  },
  positionBadge: {
    fontSize: '11px', fontWeight: 700, color: '#c89b3c',
    background: 'rgba(200,155,60,0.15)', padding: '2px 8px', borderRadius: '4px',
  },
  playerName: { fontSize: '15px', fontWeight: 600, color: '#e0e0e0' },
  playerAge: { fontSize: '12px', color: '#8a8a9a', marginLeft: 'auto' },
  // 스탯 그리드
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginBottom: '10px',
  },
  statItem: {
    display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8a8a9a',
    padding: '2px 4px',
  },
  statLabel: { color: '#6a6a7a' },
  statValue: { fontWeight: 600, color: '#c0c0d0' },
  metaRow: {
    display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8a8a9a',
    padding: '2px 0',
  },
  metaLabel: { color: '#6a6a7a' },
  metaValue: { fontWeight: 600, color: '#c0c0d0' },
  // 진행도 바
  progressContainer: { marginTop: '10px', marginBottom: '12px' },
  progressLabel: {
    display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8a8a9a',
    marginBottom: '4px',
  },
  progressBar: {
    height: '6px', background: '#2a2a4a', borderRadius: '3px', overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: '3px', transition: 'width 0.3s',
  },
  // 카드 액션
  cardActions: { display: 'flex', gap: '8px' },
  trainBtn: {
    padding: '6px 14px', background: 'rgba(200,155,60,0.15)', border: '1px solid #c89b3c',
    borderRadius: '4px', color: '#c89b3c', fontSize: '12px', cursor: 'pointer',
  },
  promoteBtn: {
    padding: '6px 14px', background: '#2ecc71', border: 'none',
    borderRadius: '4px', color: '#0d0d1a', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
  },
  // 테이블
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' },
  th: {
    padding: '8px 10px', textAlign: 'left' as const, borderBottom: '1px solid #3a3a5c',
    color: '#6a6a7a', fontSize: '12px', fontWeight: 500,
  },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  td: { padding: '8px 10px', color: '#c0c0d0' },
  // 버튼
  generateBtn: {
    padding: '8px 16px', background: '#c89b3c', color: '#0d0d1a', border: 'none',
    borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  draftBtn: {
    padding: '4px 12px', background: '#c89b3c', color: '#0d0d1a', border: 'none',
    borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
  },
  scoutBtn: {
    padding: '10px 24px', background: '#c89b3c', color: '#0d0d1a', border: 'none',
    borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
  },
};
