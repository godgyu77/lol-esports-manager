/**
 * 아카데미 페이지
 * - 탭 1: 아카데미 -- 현재 아카데미 선수 목록, 훈련/승격
 * - 탭 2: 신인 드래프트 -- 드래프트 풀 목록, 드래프트 버튼
 * - 탭 3: 스카우팅 발굴 -- 아카데미 선수 랜덤 추가
 * - 탭 4: 멘토링 현황 -- 활성 멘토링 쌍별 진행도 표시
 */

import { useEffect, useRef, useState, useCallback } from 'react';
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
import { getMentoringProgress } from '../../../engine/mentoring/mentoringEngine';
import type { MentoringProgress } from '../../../engine/mentoring/mentoringEngine';
import type { AcademyPlayer, RookieDraftEntry } from '../../../types/academy';

import { POSITION_LABELS_SHORT as POSITION_LABELS } from '../../../utils/constants';

type Tab = 'academy' | 'draft' | 'scouting' | 'mentoring';

const POS_CLASS: Record<string, string> = {
  top: 'fm-pos-badge--top',
  jungle: 'fm-pos-badge--jgl',
  mid: 'fm-pos-badge--mid',
  adc: 'fm-pos-badge--adc',
  support: 'fm-pos-badge--sup',
};

export function AcademyView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);

  const [tab, setTab] = useState<Tab>('academy');
  const [academyPlayers, setAcademyPlayers] = useState<AcademyPlayer[]>([]);
  const [draftPool, setDraftPool] = useState<RookieDraftEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [mentoringProgress, setMentoringProgress] = useState<MentoringProgress[]>([]);

  const userTeamId = save?.userTeamId ?? '';
  const seasonId = season?.id ?? 0;
  const messageTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => { clearTimeout(messageTimerRef.current); };
  }, []);

  const showMessage = (text: string, type: 'success' | 'error') => {
    clearTimeout(messageTimerRef.current);
    setMessage({ text, type });
    messageTimerRef.current = setTimeout(() => setMessage(null), 3000);
  };

  const loadData = useCallback(async () => {
    if (!save || !season) return;
    setIsLoading(true);
    try {
      const [players, pool, progress] = await Promise.all([
        getAcademyPlayers(userTeamId),
        getRookieDraftPool(seasonId),
        getMentoringProgress(userTeamId).catch(() => [] as MentoringProgress[]),
      ]);
      setAcademyPlayers(players);
      setDraftPool(pool);
      setMentoringProgress(progress);
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
    return <p className="fm-text-muted">데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p className="fm-text-muted">아카데미 정보를 불러오는 중...</p>;
  }

  const availableDraft = draftPool.filter(r => !r.isDrafted);

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">아카데미</h1>
      </div>

      {message && (
        <div className={`fm-alert ${message.type === 'success' ? 'fm-alert--success' : 'fm-alert--danger'} fm-mb-md`}>
          <span className="fm-alert__text">{message.text}</span>
        </div>
      )}

      {/* 탭 */}
      <div className="fm-tabs">
        <button
          className={`fm-tab ${tab === 'academy' ? 'fm-tab--active' : ''}`}
          onClick={() => setTab('academy')}
        >
          아카데미 ({academyPlayers.length})
        </button>
        <button
          className={`fm-tab ${tab === 'draft' ? 'fm-tab--active' : ''}`}
          onClick={() => setTab('draft')}
        >
          신인 드래프트 ({availableDraft.length})
        </button>
        <button
          className={`fm-tab ${tab === 'scouting' ? 'fm-tab--active' : ''}`}
          onClick={() => setTab('scouting')}
        >
          스카우팅 발굴
        </button>
        <button
          className={`fm-tab ${tab === 'mentoring' ? 'fm-tab--active' : ''}`}
          onClick={() => setTab('mentoring')}
        >
          멘토링 현황 ({mentoringProgress.length})
        </button>
      </div>

      {/* 탭 1: 아카데미 */}
      {tab === 'academy' && (
        <div>
          <h2 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-md">아카데미 선수 목록</h2>
          {academyPlayers.length === 0 ? (
            <p className="fm-text-muted fm-text-md">아카데미 선수가 없습니다. 스카우팅 발굴이나 신인 드래프트를 통해 선수를 추가하세요.</p>
          ) : (
            <div className="fm-grid fm-grid--auto">
              {academyPlayers.map(player => {
                const avgStat = Math.round(
                  (player.stats.mechanical + player.stats.gameSense + player.stats.teamwork +
                   player.stats.consistency + player.stats.laning + player.stats.aggression) / 6,
                );
                return (
                  <div key={player.id} className="fm-card">
                    <div className="fm-flex fm-items-center fm-gap-sm fm-mb-md">
                      <span className={`fm-pos-badge ${POS_CLASS[player.position] ?? ''}`}>
                        {POSITION_LABELS[player.position] ?? player.position}
                      </span>
                      <span className="fm-text-lg fm-font-semibold fm-text-primary">{player.name}</span>
                      <span className="fm-text-xs fm-text-secondary" style={{ marginLeft: 'auto' }}>{player.age}세</span>
                    </div>

                    <div className="fm-grid fm-grid--3 fm-gap-xs fm-mb-sm">
                      <div className="fm-info-row">
                        <span className="fm-info-row__label">기계적</span>
                        <span className="fm-info-row__value">{player.stats.mechanical}</span>
                      </div>
                      <div className="fm-info-row">
                        <span className="fm-info-row__label">판단력</span>
                        <span className="fm-info-row__value">{player.stats.gameSense}</span>
                      </div>
                      <div className="fm-info-row">
                        <span className="fm-info-row__label">팀워크</span>
                        <span className="fm-info-row__value">{player.stats.teamwork}</span>
                      </div>
                      <div className="fm-info-row">
                        <span className="fm-info-row__label">일관성</span>
                        <span className="fm-info-row__value">{player.stats.consistency}</span>
                      </div>
                      <div className="fm-info-row">
                        <span className="fm-info-row__label">라인전</span>
                        <span className="fm-info-row__value">{player.stats.laning}</span>
                      </div>
                      <div className="fm-info-row">
                        <span className="fm-info-row__label">공격성</span>
                        <span className="fm-info-row__value">{player.stats.aggression}</span>
                      </div>
                    </div>

                    <div className="fm-info-row">
                      <span className="fm-info-row__label">잠재력</span>
                      <span className="fm-info-row__value fm-text-accent">{player.potential}</span>
                    </div>
                    <div className="fm-info-row">
                      <span className="fm-info-row__label">평균 스탯</span>
                      <span className="fm-info-row__value">{avgStat}</span>
                    </div>

                    {/* 훈련 진행도 바 */}
                    <div className="fm-mt-sm fm-mb-md">
                      <div className="fm-flex fm-justify-between fm-text-xs fm-text-secondary fm-mb-sm">
                        <span>훈련 진행도</span>
                        <span>{player.trainingProgress}%</span>
                      </div>
                      <div className="fm-bar">
                        <div className="fm-bar__track">
                          <div
                            className={`fm-bar__fill ${player.promotionReady ? 'fm-bar__fill--green' : 'fm-bar__fill--accent'}`}
                            style={{ width: `${player.trainingProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="fm-flex fm-gap-sm">
                      <button
                        className="fm-btn fm-btn--sm"
                        style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                        onClick={() => handleTrain(player.id)}
                      >
                        훈련
                      </button>
                      {player.promotionReady && (
                        <button
                          className="fm-btn fm-btn--sm fm-btn--success"
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
          <div className="fm-flex fm-justify-between fm-items-center fm-mb-md">
            <h2 className="fm-text-lg fm-font-semibold fm-text-accent">신인 드래프트 풀</h2>
            {draftPool.length === 0 && (
              <button className="fm-btn fm-btn--primary" onClick={handleGenerateDraftPool}>
                드래프트 풀 생성
              </button>
            )}
          </div>

          {draftPool.length === 0 ? (
            <p className="fm-text-muted fm-text-md">드래프트 풀이 아직 생성되지 않았습니다.</p>
          ) : (
            <div className="fm-panel">
              <div className="fm-panel__body--flush fm-table-wrap">
                <table className="fm-table fm-table--striped">
                  <thead>
                    <tr>
                      <th>포지션</th>
                      <th>이름</th>
                      <th>나이</th>
                      <th>예상 능력</th>
                      <th>국적</th>
                      <th>상태</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftPool.map(rookie => (
                      <tr key={rookie.id}>
                        <td>
                          <span className={`fm-pos-badge ${POS_CLASS[rookie.position] ?? ''}`}>
                            {POSITION_LABELS[rookie.position] ?? rookie.position}
                          </span>
                        </td>
                        <td className="fm-cell--name">{rookie.name}</td>
                        <td>{rookie.age}세</td>
                        <td>
                          <span className={
                            rookie.estimatedAbility >= 70 ? 'fm-ovr fm-ovr--elite'
                              : rookie.estimatedAbility >= 50 ? 'fm-ovr fm-ovr--high'
                              : 'fm-ovr fm-ovr--low'
                          }>
                            {rookie.estimatedAbility}
                          </span>
                        </td>
                        <td>{rookie.nationality}</td>
                        <td>
                          {rookie.isDrafted ? (
                            <span className="fm-badge fm-badge--default">드래프트됨</span>
                          ) : (
                            <span className="fm-badge fm-badge--success">가능</span>
                          )}
                        </td>
                        <td>
                          {!rookie.isDrafted && (
                            <button
                              className="fm-btn fm-btn--primary fm-btn--sm"
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
              </div>
            </div>
          )}
        </div>
      )}

      {/* 탭 3: 스카우팅 발굴 */}
      {tab === 'scouting' && (
        <div>
          <h2 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-md">스카우팅 발굴</h2>
          <p className="fm-text-md fm-text-secondary fm-mb-md" style={{ lineHeight: '1.6' }}>
            랜덤으로 아카데미 유망주를 발굴하여 팀의 아카데미에 추가합니다.
            발굴된 선수는 훈련을 통해 성장시킨 후 1군으로 승격할 수 있습니다.
          </p>

          <button className="fm-btn fm-btn--primary fm-btn--lg" onClick={handleAddAcademyPlayer}>
            유망주 발굴
          </button>

          {academyPlayers.length > 0 && (
            <div className="fm-mt-lg">
              <h3 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-md">현재 아카데미 ({academyPlayers.length}명)</h3>
              <div className="fm-panel">
                <div className="fm-panel__body--flush fm-table-wrap">
                  <table className="fm-table fm-table--striped">
                    <thead>
                      <tr>
                        <th>포지션</th>
                        <th>이름</th>
                        <th>나이</th>
                        <th>잠재력</th>
                        <th>평균 스탯</th>
                        <th>진행도</th>
                        <th>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {academyPlayers.map(player => {
                        const avgStat = Math.round(
                          (player.stats.mechanical + player.stats.gameSense + player.stats.teamwork +
                           player.stats.consistency + player.stats.laning + player.stats.aggression) / 6,
                        );
                        return (
                          <tr key={player.id}>
                            <td>
                              <span className={`fm-pos-badge ${POS_CLASS[player.position] ?? ''}`}>
                                {POSITION_LABELS[player.position] ?? player.position}
                              </span>
                            </td>
                            <td className="fm-cell--name">{player.name}</td>
                            <td>{player.age}세</td>
                            <td className="fm-cell--accent">{player.potential}</td>
                            <td>{avgStat}</td>
                            <td>{player.trainingProgress}%</td>
                            <td>
                              {player.promotionReady ? (
                                <span className="fm-badge fm-badge--success">승격 가능</span>
                              ) : (
                                <span className="fm-badge fm-badge--default">훈련중</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 탭 4: 멘토링 현황 */}
      {tab === 'mentoring' && (
        <div>
          <h2 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-md">멘토링 현황</h2>
          {mentoringProgress.length === 0 ? (
            <p className="fm-text-muted fm-text-md">활성 멘토링이 없습니다.</p>
          ) : (
            <div className="fm-grid fm-grid--auto">
              {mentoringProgress.map(pair => {
                const statusBadgeClass = pair.status === 'excellent' ? 'fm-badge--success'
                  : pair.status === 'good' ? 'fm-badge--warning'
                  : 'fm-badge--danger';
                const statusLabel = pair.status === 'excellent' ? '우수'
                  : pair.status === 'good' ? '양호'
                  : '부진';
                return (
                  <div key={`${pair.mentorId}-${pair.menteeId}`} className="fm-card">
                    {/* 멘토 -> 멘티 헤더 */}
                    <div className="fm-flex fm-items-center fm-gap-sm fm-mb-md">
                      <span className="fm-text-lg fm-font-semibold fm-text-primary">{pair.mentorName}</span>
                      <span className="fm-text-xl fm-font-bold fm-text-accent">→</span>
                      <span className="fm-text-lg fm-font-semibold fm-text-primary">{pair.menteeName}</span>
                    </div>

                    {/* 호환성 상태 뱃지 */}
                    <div className="fm-flex fm-items-center fm-gap-sm fm-mb-md">
                      <span className={`fm-badge ${statusBadgeClass}`}>{statusLabel}</span>
                      <span className="fm-text-xs fm-text-secondary">
                        호환성 {pair.compatibility > 0 ? '+' : ''}{pair.compatibility}
                      </span>
                    </div>

                    {/* 상세 정보 */}
                    <div className="fm-flex-col fm-gap-xs">
                      <div className="fm-info-row">
                        <span className="fm-info-row__label">보너스 스탯</span>
                        <span className="fm-info-row__value">{pair.bonusStat}</span>
                      </div>
                      <div className="fm-info-row">
                        <span className="fm-info-row__label">활성 일수</span>
                        <span className="fm-info-row__value">{pair.daysActive}일</span>
                      </div>
                      <div className="fm-info-row">
                        <span className="fm-info-row__label">누적 성장량</span>
                        <span className="fm-info-row__value fm-text-success fm-font-bold">
                          +{pair.totalGrowth.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
