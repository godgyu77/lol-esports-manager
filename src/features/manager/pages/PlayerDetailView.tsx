/**
 * 선수 상세 뷰
 * - 프로필, 스탯, 멘탈, 계약, 챔피언 풀, 잠재력 표시
 * - RosterView에서 선수 이름 클릭으로 진입
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../../../stores/gameStore';
import { getDatabase } from '../../../db/database';
import type { Player, PlayerStats } from '../../../types/player';
import type { PlayerGameStats } from '../../../types/match';
import { getPlayerGameStatsByPlayer } from '../../../db/queries';
import { PlayerAvatar } from '../../../components/PlayerAvatar';
import { generatePlayerConversation, type PlayerConversation } from '../../../ai/advancedAiService';
import { POSITION_LABELS_KR as POSITION_LABELS } from '../../../utils/constants';

/* ── 폼 히스토리 타입 ── */
interface FormHistoryRow {
  id: number;
  player_id: string;
  form_score: number;
}

function getFormColor(value: number): string {
  if (value >= 70) return 'var(--success)';
  if (value >= 50) return 'var(--warning)';
  if (value >= 35) return '#e8922d';
  return 'var(--danger)';
}

function getFormBarClass(value: number): string {
  if (value >= 70) return 'fm-bar__fill--green';
  if (value >= 50) return 'fm-bar__fill--yellow';
  if (value >= 35) return 'fm-bar__fill--yellow';
  return 'fm-bar__fill--red';
}

function getFormRecommendation(avg: number): { text: string; alertClass: string } {
  if (avg < 35) return { text: '컨디션 저하: 교체 권장', alertClass: 'fm-alert--danger' };
  if (avg < 45) return { text: '폼 하락 중: 주의 필요', alertClass: 'fm-alert--warning' };
  if (avg >= 70) return { text: '최상의 컨디션', alertClass: 'fm-alert--success' };
  return { text: '보통', alertClass: 'fm-alert--info' };
}

function getFormTrend(rows: FormHistoryRow[]): { label: string; symbol: string; colorClass: string } {
  if (rows.length < 6) return { label: '데이터 부족', symbol: '-', colorClass: 'fm-text-muted' };
  const recent3 = rows.slice(0, 3).reduce((s, r) => s + r.form_score, 0) / 3;
  const prev3 = rows.slice(3, 6).reduce((s, r) => s + r.form_score, 0) / 3;
  const diff = recent3 - prev3;
  if (diff > 3) return { label: '상승', symbol: '\u2191', colorClass: 'fm-text-success' };
  if (diff < -3) return { label: '하락', symbol: '\u2193', colorClass: 'fm-text-danger' };
  return { label: '안정', symbol: '\u2192', colorClass: 'fm-text-warning' };
}

const STAT_LABELS: Record<keyof PlayerStats, string> = {
  mechanical: '기계적 숙련도',
  gameSense: '게임 이해도',
  teamwork: '팀워크',
  consistency: '일관성',
  laning: '라인전',
  aggression: '공격성',
};

function getStatBarClass(value: number): string {
  if (value >= 90) return 'fm-bar__fill--accent';
  if (value >= 80) return 'fm-bar__fill--blue';
  if (value >= 70) return 'fm-bar__fill--green';
  if (value >= 50) return 'fm-bar__fill--yellow';
  return 'fm-bar__fill--red';
}

function getStatOvrClass(value: number): string {
  if (value >= 90) return 'fm-ovr--elite';
  if (value >= 80) return 'fm-ovr--high';
  if (value >= 70) return 'fm-ovr--mid';
  return 'fm-ovr--low';
}

function getGrowthStage(player: Player): { label: string; badgeClass: string } {
  if (player.age < player.peakAge - 1) return { label: '성장기', badgeClass: 'fm-badge--success' };
  if (player.age <= player.peakAge + 1) return { label: '전성기', badgeClass: 'fm-badge--warning' };
  return { label: '하락기', badgeClass: 'fm-badge--danger' };
}

function formatSalary(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}억`;
  }
  return `${value.toLocaleString()}만`;
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="fm-bar">
      <span className="fm-text-md fm-text-muted" style={{ minWidth: '100px' }}>{label}</span>
      <div className="fm-bar__track" style={{ height: '8px' }}>
        <div
          className={`fm-bar__fill ${getStatBarClass(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`fm-bar__value fm-font-semibold ${getStatOvrClass(value)}`}>{value}</span>
    </div>
  );
}

function MentalBar({ label, value }: { label: string; value: number }) {
  const barClass = value > 70 ? 'fm-bar__fill--green' : value > 40 ? 'fm-bar__fill--yellow' : 'fm-bar__fill--red';
  return (
    <div className="fm-bar">
      <span className="fm-text-md fm-text-muted" style={{ minWidth: '100px' }}>{label}</span>
      <div className="fm-bar__track" style={{ height: '8px' }}>
        <div
          className={`fm-bar__fill ${barClass}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="fm-bar__value fm-font-semibold">{value}</span>
    </div>
  );
}

type ConversationTopic = 'general' | 'performance' | 'future' | 'team' | 'personal';
const TOPIC_LABELS: Record<ConversationTopic, string> = {
  general: '일반 대화', performance: '성적/퍼포먼스', future: '미래/진로', team: '팀/동료', personal: '개인적인 이야기',
};
const MOOD_COLORS: Record<string, string> = {
  happy: 'var(--success)', neutral: 'var(--accent)', frustrated: '#e8922d', angry: 'var(--danger)', shy: '#a78bfa',
};
const MOOD_LABELS: Record<string, string> = {
  happy: '기쁨', neutral: '보통', frustrated: '답답함', angry: '화남', shy: '수줍음',
};

export function PlayerDetailView() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const teams = useGameStore((s) => s.teams);
  const [recentGames, setRecentGames] = useState<PlayerGameStats[]>([]);
  const [formHistory, setFormHistory] = useState<FormHistoryRow[]>([]);
  const [formLoading, setFormLoading] = useState(false);

  // 면담 상태
  const [showInterview, setShowInterview] = useState(false);
  const [interviewTopic, setInterviewTopic] = useState<ConversationTopic>('general');
  const [interviewMessage, setInterviewMessage] = useState('');
  const [interviewResponse, setInterviewResponse] = useState<PlayerConversation | null>(null);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewHistory, setInterviewHistory] = useState<string[]>([]);

  useEffect(() => {
    if (!playerId) return;
    getPlayerGameStatsByPlayer(playerId, 10).then(setRecentGames);
  }, [playerId]);

  // 폼 히스토리 로드
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    setFormLoading(true);
    (async () => {
      try {
        const db = await getDatabase();
        const rows = await db.select<FormHistoryRow[]>(
          `SELECT * FROM player_form_history
           WHERE player_id = $1 ORDER BY id DESC LIMIT 10`,
          [playerId],
        );
        if (!cancelled) setFormHistory(rows);
      } catch {
        if (!cancelled) setFormHistory([]);
      } finally {
        if (!cancelled) setFormLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [playerId]);

  let player: Player | undefined;
  let teamName = '';
  let division = '';

  for (const team of teams) {
    const found = team.roster.find((p) => p.id === playerId);
    if (found) {
      player = found;
      teamName = team.name;
      division = (found as { division?: string }).division === 'main' ? '1군' : '2군';
      break;
    }
  }

  const handleInterview = useCallback(async () => {
    if (!player || !interviewMessage.trim()) return;
    setInterviewLoading(true);

    try {
      // 성격 조회
      const db = await getDatabase();
      const [personality] = await db.select<{ ambition: number; loyalty: number; temperament: number }[]>(
        'SELECT COALESCE(ambition, 5) as ambition, COALESCE(loyalty, 5) as loyalty, COALESCE(temperament, 5) as temperament FROM player_personality WHERE player_id = $1',
        [player.id],
      ).catch(() => [{ ambition: 5, loyalty: 5, temperament: 5 }]);

      const result = await generatePlayerConversation({
        playerName: player.name,
        playerAge: player.age,
        playerPosition: player.position,
        playerMorale: player.mental.morale,
        playerPersonality: personality ?? { ambition: 5, loyalty: 5, temperament: 5 },
        topic: interviewTopic,
        managerMessage: interviewMessage,
        conversationHistory: interviewHistory,
      });

      setInterviewResponse(result);
      setInterviewHistory(prev => [...prev, `감독: ${interviewMessage}`, `${player.name}: ${result.playerResponse}`]);

      // 사기 변경 적용
      if (result.moraleChange !== 0) {
        await db.execute(
          'UPDATE players SET morale = MAX(0, MIN(100, morale + $1)) WHERE id = $2',
          [result.moraleChange, player.id],
        ).catch(() => {});
      }

      // 만족도 반영 (면담 = 관심 표현 → 만족도 소폭 상승)
      try {
        await db.execute(
          `UPDATE player_satisfaction SET
             overall_satisfaction = MIN(100, overall_satisfaction + 3),
             last_updated = datetime('now')
           WHERE player_id = $1`,
          [player.id],
        );
      } catch { /* player_satisfaction 미존재 시 무시 */ }

      // 면담 이력 DB 저장
      try {
        const seasonRows = await db.select<{ id: number }[]>(
          'SELECT id FROM seasons WHERE is_active = 1 LIMIT 1',
        );
        const seasonId = seasonRows[0]?.id ?? 0;
        await db.execute(
          `INSERT INTO daily_events (season_id, event_date, event_type, team_id, description)
           VALUES ($1, date('now'), 'player_interview', $2, $3)`,
          [seasonId, player.teamId, `[면담] ${player.name}: ${interviewTopic} — 사기 ${result.moraleChange >= 0 ? '+' : ''}${result.moraleChange}`],
        );
      } catch { /* 이력 저장 실패 무시 */ }
    } catch (e) {
      console.warn('면담 실패:', e);
    } finally {
      setInterviewLoading(false);
      setInterviewMessage('');
    }
  }, [player, interviewMessage, interviewTopic, interviewHistory]);

  if (!player) {
    return (
      <div>
        <p className="fm-text-muted">선수를 찾을 수 없습니다.</p>
        <button className="fm-btn fm-mb-md" onClick={() => navigate('/manager/roster')}>
          로스터로 돌아가기
        </button>
      </div>
    );
  }

  const growth = getGrowthStage(player);
  const ovr = Math.round(
    (player.stats.mechanical +
      player.stats.gameSense +
      player.stats.teamwork +
      player.stats.consistency +
      player.stats.laning +
      player.stats.aggression) /
      6,
  );

  return (
    <div>
      <button className="fm-btn fm-mb-md" onClick={() => navigate('/manager/roster')}>
        &larr; 로스터로 돌아가기
      </button>

      <div className="fm-flex fm-items-center fm-gap-md fm-mb-lg">
        <PlayerAvatar
          position={player.position}
          nationality={player.nationality}
          size={56}
          name={player.name}
        />
        <h1 className="fm-page-title" style={{ marginBottom: 0 }}>{player.name}</h1>
        <button
          className="fm-btn fm-btn--primary"
          onClick={() => setShowInterview(!showInterview)}
          style={{ marginLeft: 'auto' }}
        >
          {showInterview ? '면담 닫기' : '1:1 면담'}
        </button>
      </div>

      {/* ─── 면담 UI ─── */}
      {showInterview && (
        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__header">
            <span className="fm-panel__title">선수 면담</span>
          </div>
          <div className="fm-panel__body">
            {/* 주제 선택 */}
            <div className="fm-tabs fm-mb-md">
              {(Object.keys(TOPIC_LABELS) as ConversationTopic[]).map(topic => (
                <button
                  key={topic}
                  className={`fm-tab ${interviewTopic === topic ? 'fm-tab--active' : ''}`}
                  onClick={() => setInterviewTopic(topic)}
                >
                  {TOPIC_LABELS[topic]}
                </button>
              ))}
            </div>

            {/* 대화 히스토리 */}
            {interviewHistory.length > 0 && (
              <div
                className="fm-flex-col fm-gap-sm fm-mb-md"
                style={{ maxHeight: '200px', overflowY: 'auto', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}
              >
                {interviewHistory.map((line, i) => (
                  <div
                    key={i}
                    className="fm-card"
                    style={{
                      alignSelf: line.startsWith('감독') ? 'flex-end' : 'flex-start',
                      background: line.startsWith('감독') ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                      borderColor: line.startsWith('감독') ? 'var(--accent-border)' : 'var(--border)',
                      maxWidth: '80%',
                      padding: '8px 12px',
                    }}
                  >
                    <span className="fm-text-base fm-text-secondary">{line}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 응답 표시 */}
            {interviewResponse && (
              <div
                className="fm-card fm-mb-md"
                style={{ borderLeft: `3px solid ${MOOD_COLORS[interviewResponse.mood] ?? 'var(--accent)'}` }}
              >
                <div className="fm-flex fm-gap-sm fm-items-center fm-mb-sm">
                  <span
                    className="fm-badge"
                    style={{
                      background: `${MOOD_COLORS[interviewResponse.mood] ?? 'var(--accent)'}20`,
                      color: MOOD_COLORS[interviewResponse.mood] ?? 'var(--accent)',
                    }}
                  >
                    {MOOD_LABELS[interviewResponse.mood] ?? interviewResponse.mood}
                  </span>
                  {interviewResponse.moraleChange !== 0 && (
                    <span className={`fm-text-sm ${interviewResponse.moraleChange > 0 ? 'fm-text-success' : 'fm-text-danger'}`}>
                      사기 {interviewResponse.moraleChange > 0 ? '+' : ''}{interviewResponse.moraleChange}
                    </span>
                  )}
                  {interviewResponse.loyaltyChange !== 0 && (
                    <span className={`fm-text-sm ${interviewResponse.loyaltyChange > 0 ? 'fm-text-success' : 'fm-text-danger'}`}>
                      충성 {interviewResponse.loyaltyChange > 0 ? '+' : ''}{interviewResponse.loyaltyChange}
                    </span>
                  )}
                </div>
                {interviewResponse.revealedInfo && (
                  <div className="fm-text-sm fm-text-warning fm-mb-xs">
                    [정보 공개] {interviewResponse.revealedInfo}
                  </div>
                )}
              </div>
            )}

            {/* 입력 */}
            <div className="fm-flex fm-gap-sm">
              <input
                type="text"
                value={interviewMessage}
                onChange={(e) => setInterviewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInterview()}
                placeholder="대화 내용을 입력하세요..."
                className="fm-input fm-flex-1"
                disabled={interviewLoading}
              />
              <button
                className="fm-btn fm-btn--primary"
                onClick={handleInterview}
                disabled={interviewLoading || !interviewMessage.trim()}
              >
                {interviewLoading ? '...' : '전송'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 프로필 카드 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">프로필</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--3">
            <div className="fm-stat">
              <span className="fm-stat__label">포지션</span>
              <span className="fm-stat__value fm-stat__value--sm">
                {POSITION_LABELS[player.position] ?? player.position}
              </span>
            </div>
            <div className="fm-stat">
              <span className="fm-stat__label">나이</span>
              <span className="fm-stat__value fm-stat__value--sm">{player.age}세</span>
            </div>
            <div className="fm-stat">
              <span className="fm-stat__label">국적</span>
              <span className="fm-stat__value fm-stat__value--sm">{player.nationality}</span>
            </div>
            <div className="fm-stat">
              <span className="fm-stat__label">소속</span>
              <span className="fm-stat__value fm-stat__value--sm">{teamName}</span>
            </div>
            <div className="fm-stat">
              <span className="fm-stat__label">군</span>
              <span className="fm-stat__value fm-stat__value--sm">{division}</span>
            </div>
            <div className="fm-stat">
              <span className="fm-stat__label">OVR</span>
              <span className={`fm-stat__value fm-ovr ${getStatOvrClass(ovr)}`}>
                {ovr}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="fm-grid fm-grid--2 fm-mb-md">
        {/* 스탯 레이더 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">스탯</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {(Object.keys(STAT_LABELS) as (keyof PlayerStats)[]).map((key) => (
              <StatBar key={key} label={STAT_LABELS[key]} value={player.stats[key]} />
            ))}
          </div>
        </div>

        {/* 멘탈 정보 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">멘탈 / 컨디션</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            <MentalBar label="체력" value={player.mental.stamina} />
            <MentalBar label="사기" value={player.mental.morale} />
            <MentalBar label="멘탈" value={player.mental.mental} />
          </div>
        </div>
      </div>

      <div className="fm-grid fm-grid--2 fm-mb-md">
        {/* 계약 정보 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">계약 정보</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-info-row">
              <span className="fm-info-row__label">연봉</span>
              <span className="fm-info-row__value">{formatSalary(player.contract.salary)}</span>
            </div>
            <div className="fm-info-row">
              <span className="fm-info-row__label">계약 만료</span>
              <span className="fm-info-row__value">{player.contract.contractEndSeason} 시즌</span>
            </div>
          </div>
        </div>

        {/* 잠재력 / 피크 에이지 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">성장 정보</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-info-row">
              <span className="fm-info-row__label">잠재력</span>
              <span className={`fm-info-row__value fm-ovr ${getStatOvrClass(player.potential)}`}>
                {player.potential}
              </span>
            </div>
            <div className="fm-info-row">
              <span className="fm-info-row__label">피크 나이</span>
              <span className="fm-info-row__value">{player.peakAge}세</span>
            </div>
            <div className="fm-info-row">
              <span className="fm-info-row__label">성장 단계</span>
              <span className={`fm-badge ${growth.badgeClass}`}>
                {growth.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 챔피언 풀 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">챔피언 풀</span>
        </div>
        <div className="fm-panel__body">
          {player.championPool.length === 0 ? (
            <p className="fm-text-muted fm-text-md">등록된 챔피언이 없습니다.</p>
          ) : (
            <div className="fm-flex-col fm-gap-sm">
              {player.championPool.map((champ) => (
                <div key={champ.championId} className="fm-bar" style={{ padding: '4px 0' }}>
                  <span className="fm-text-lg fm-font-medium fm-text-primary" style={{ minWidth: '80px' }}>
                    {champ.championId}
                  </span>
                  <div className="fm-bar__track" style={{ height: '6px' }}>
                    <div
                      className={`fm-bar__fill ${getStatBarClass(champ.proficiency)}`}
                      style={{ width: `${champ.proficiency}%` }}
                    />
                  </div>
                  <span className={`fm-bar__value fm-font-semibold ${getStatOvrClass(champ.proficiency)}`}>
                    {champ.proficiency}
                  </span>
                  <span className="fm-text-sm fm-text-muted" style={{ minWidth: '48px', textAlign: 'right' }}>
                    {champ.gamesPlayed}게임
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 최근 폼 히스토리 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">최근 폼</span>
        </div>
        <div className="fm-panel__body">
          {formLoading ? (
            <p className="fm-text-muted fm-text-md">로딩 중...</p>
          ) : formHistory.length === 0 ? (
            <p className="fm-text-muted fm-text-md">폼 데이터가 없습니다.</p>
          ) : (
            (() => {
              const avgForm = Math.round(
                formHistory.reduce((s, r) => s + r.form_score, 0) / formHistory.length,
              );
              const trend = getFormTrend(formHistory);
              const recommendation = getFormRecommendation(avgForm);

              return (
                <>
                  {/* 요약 */}
                  <div className="fm-grid fm-grid--3 fm-mb-lg">
                    <div className="fm-card fm-flex-col fm-items-center fm-gap-xs">
                      <span className="fm-stat__label">평균 폼</span>
                      <span className="fm-stat__value" style={{ color: getFormColor(avgForm) }}>
                        {avgForm}
                      </span>
                    </div>
                    <div className="fm-card fm-flex-col fm-items-center fm-gap-xs">
                      <span className="fm-stat__label">추세</span>
                      <span className={`fm-stat__value ${trend.colorClass}`}>
                        {trend.symbol} {trend.label}
                      </span>
                    </div>
                    <div className="fm-card fm-flex-col fm-items-center fm-gap-xs">
                      <span className="fm-stat__label">상태</span>
                      <span className={`fm-alert ${recommendation.alertClass}`} style={{ padding: '4px 10px', margin: 0 }}>
                        <span className="fm-alert__text">{recommendation.text}</span>
                      </span>
                    </div>
                  </div>

                  {/* 바 차트 */}
                  <div style={{ position: 'relative' }}>
                    <div className="fm-text-xs fm-text-muted" style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}>
                      50 기준
                    </div>
                    <div className="fm-flex fm-gap-sm" style={{ alignItems: 'flex-end', justifyContent: 'center', paddingLeft: '50px' }}>
                      {[...formHistory].reverse().map((row, idx) => (
                        <div key={row.id} className="fm-flex-col fm-items-center fm-gap-xs" style={{ flex: 1 }}>
                          <span className="fm-text-sm fm-font-semibold" style={{ color: getFormColor(row.form_score) }}>
                            {row.form_score}
                          </span>
                          <div
                            style={{
                              position: 'relative',
                              width: '100%',
                              height: '120px',
                              background: 'rgba(255,255,255,0.04)',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'flex-end',
                            }}
                          >
                            <div
                              className={getFormBarClass(row.form_score)}
                              style={{
                                width: '100%',
                                height: `${row.form_score}%`,
                                borderRadius: '4px 4px 0 0',
                                transition: 'height 0.3s ease',
                              }}
                            />
                            {/* 50 기준선 */}
                            <div style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              bottom: '50%',
                              height: '1px',
                              borderTop: '1px dashed rgba(255,255,255,0.15)',
                            }} />
                          </div>
                          <span className="fm-text-xs fm-text-muted">
                            {idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()
          )}
        </div>
      </div>

      {/* 최근 경기 기록 */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">최근 경기 기록</span>
        </div>
        {recentGames.length === 0 ? (
          <div className="fm-panel__body">
            <p className="fm-text-muted fm-text-md">경기 기록이 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="fm-panel__body">
              {/* 시즌 평균 요약 */}
              <div className="fm-grid fm-grid--3 fm-mb-md">
                <div className="fm-card fm-flex-col fm-items-center fm-gap-xs">
                  <span className="fm-stat__label">평균 K/D/A</span>
                  <span className="fm-stat__value fm-stat__value--sm">
                    {(recentGames.reduce((s, g) => s + g.kills, 0) / recentGames.length).toFixed(1)} /
                    {' '}{(recentGames.reduce((s, g) => s + g.deaths, 0) / recentGames.length).toFixed(1)} /
                    {' '}{(recentGames.reduce((s, g) => s + g.assists, 0) / recentGames.length).toFixed(1)}
                  </span>
                </div>
                <div className="fm-card fm-flex-col fm-items-center fm-gap-xs">
                  <span className="fm-stat__label">평균 CS</span>
                  <span className="fm-stat__value fm-stat__value--sm">
                    {Math.round(recentGames.reduce((s, g) => s + g.cs, 0) / recentGames.length)}
                  </span>
                </div>
                <div className="fm-card fm-flex-col fm-items-center fm-gap-xs">
                  <span className="fm-stat__label">평균 데미지</span>
                  <span className="fm-stat__value fm-stat__value--sm">
                    {Math.round(recentGames.reduce((s, g) => s + g.damageDealt, 0) / recentGames.length).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="fm-panel__body--flush fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th>매치</th>
                    <th>K</th>
                    <th>D</th>
                    <th>A</th>
                    <th>CS</th>
                    <th>골드</th>
                    <th>데미지</th>
                  </tr>
                </thead>
                <tbody>
                  {recentGames.map((g) => (
                    <tr key={g.id}>
                      <td>{g.gameId}</td>
                      <td className="fm-cell--green">{g.kills}</td>
                      <td className="fm-cell--red">{g.deaths}</td>
                      <td>{g.assists}</td>
                      <td>{g.cs}</td>
                      <td>{g.goldEarned.toLocaleString()}</td>
                      <td>{g.damageDealt.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
