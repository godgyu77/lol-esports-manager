/**
 * 선수 모드 대시보드
 * - 내 선수 정보 (이름, 포지션, 나이, OVR, 스탯)
 * - 오늘의 일정
 * - 현재 컨디션 (체력, 사기, 폼)
 * - 팀 내 위치 (1군/2군, 경쟁자)
 */

import { useEffect, useState } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getTeamConditions } from '../../../db/queries';
import { isAiAvailable } from '../../../ai/gameAiService';
import { chatWithLlmJson } from '../../../ai/provider';
import { buildPlayerContext } from '../../../ai/contextBuilder';
import type { Player } from '../../../types/player';

const POSITION_LABELS: Record<string, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: '원딜',
  support: '서포터',
};

const DAY_TYPE_LABELS: Record<string, string> = {
  training: '훈련일',
  scrim: '스크림일',
  match: '경기일',
  rest: '휴식일',
};

const STAT_LABELS: Record<string, string> = {
  mechanical: '기계적 숙련도',
  gameSense: '게임 이해도',
  teamwork: '팀워크',
  consistency: '일관성',
  laning: '라인전',
  aggression: '공격성',
};

function getOvr(player: Player): number {
  const s = player.stats;
  return Math.round(
    (s.mechanical + s.gameSense + s.teamwork + s.consistency + s.laning + s.aggression) / 6,
  );
}

function getOvrClass(ovr: number): string {
  if (ovr >= 90) return 'fm-ovr--elite';
  if (ovr >= 80) return 'fm-ovr--high';
  if (ovr >= 70) return 'fm-ovr--mid';
  return 'fm-ovr--low';
}

function getBarFillClass(value: number): string {
  if (value > 70) return 'fm-bar__fill--green';
  if (value > 40) return 'fm-bar__fill--yellow';
  return 'fm-bar__fill--red';
}

function getStatBarFillClass(value: number): string {
  if (value >= 80) return 'fm-bar__fill--blue';
  if (value >= 60) return 'fm-bar__fill--green';
  return 'fm-bar__fill--yellow';
}

function getPosBadgeClass(pos: string): string {
  const map: Record<string, string> = {
    top: 'fm-pos-badge--top',
    jungle: 'fm-pos-badge--jgl',
    mid: 'fm-pos-badge--mid',
    adc: 'fm-pos-badge--adc',
    support: 'fm-pos-badge--sup',
  };
  return map[pos] ?? '';
}

export function PlayerHome() {
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);
  const dayType = useGameStore((s) => s.dayType);

  const [conditions, setConditions] = useState<Map<string, { stamina: number; morale: number; form: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [narrative, setNarrative] = useState<string | null>(null);

  const userTeam = teams.find((t) => t.id === save?.userTeamId);
  const myPlayer = userTeam?.roster.find((p) => p.id === save?.userPlayerId);

  useEffect(() => {
    if (!userTeam || !season) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const cond = await getTeamConditions(userTeam.id, season.currentDate);
        if (!cancelled) setConditions(cond);

        // AI 일간 내러티브 생성
        if (save?.userPlayerId) {
          try {
            const aiReady = await isAiAvailable();
            if (aiReady) {
              const playerCtx = await buildPlayerContext(save.userPlayerId);
              const result = await chatWithLlmJson<{ narrative: string }>(
                `당신은 프로 LoL 선수입니다. 오늘 하루를 1인칭 시점으로 짧게 일기를 쓰세요 (50자 이내).\n\n[나의 상태]\n${playerCtx}\n\nJSON: {"narrative": "일기 내용"}`,
              );
              if (!cancelled) setNarrative(result.narrative);
            } else {
              // 폴백: 컨디션 기반 내러티브
              const c = cond.get(save.userPlayerId);
              const form = c?.form ?? 50;
              const morale = c?.morale ?? 50;
              if (form >= 70 && morale >= 70) {
                if (!cancelled) setNarrative('컨디션이 최고다. 오늘 경기가 있다면 자신 있다.');
              } else if (form < 40) {
                if (!cancelled) setNarrative('최근 폼이 좋지 않다. 더 집중해서 훈련해야겠다.');
              } else if (morale < 40) {
                if (!cancelled) setNarrative('마음이 무겁다. 팀원들과 이야기를 나눠야겠다.');
              } else {
                if (!cancelled) setNarrative('평범한 하루. 꾸준히 노력하자.');
              }
            }
          } catch { /* AI 실패 무시 */ }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userTeam?.id, season?.id, season?.currentDate, save?.userPlayerId]);

  if (!userTeam || !season || !myPlayer) {
    return <p className="fm-text-secondary fm-text-md">데이터를 불러오는 중...</p>;
  }

  const ovr = getOvr(myPlayer);
  const myCond = conditions.get(myPlayer.id);
  const stamina = myCond?.stamina ?? myPlayer.mental.stamina;
  const morale = myCond?.morale ?? myPlayer.mental.morale;
  const form = myCond?.form ?? 50;

  // 1군/2군 판별
  const myDivision = (myPlayer as { division?: string }).division === 'main' ? '1군' : '2군';

  // 같은 포지션 경쟁자
  const rivals = userTeam.roster.filter(
    (p) => p.position === myPlayer.position && p.id !== myPlayer.id,
  );

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">선수 대시보드</h1>
      </div>

      {/* AI 일간 내러티브 */}
      {narrative && (
        <div className="fm-alert fm-alert--warning">
          <span className="fm-alert__icon">💭</span>
          <p className="fm-alert__text" style={{ fontStyle: 'italic' }}>
            &ldquo;{narrative}&rdquo;
          </p>
        </div>
      )}

      {/* 내 선수 정보 카드 */}
      <div className="fm-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">내 선수 정보</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-flex fm-items-center fm-justify-between fm-mb-md">
            <div className="fm-flex fm-items-center fm-gap-md">
              <span className="fm-text-2xl fm-font-bold fm-text-primary">{myPlayer.name}</span>
              <span className={`fm-pos-badge ${getPosBadgeClass(myPlayer.position)}`}>
                {POSITION_LABELS[myPlayer.position] ?? myPlayer.position}
              </span>
            </div>
            <div className="fm-flex fm-items-center fm-gap-md">
              <span className="fm-text-md fm-text-muted">{myPlayer.age}세</span>
              <span className="fm-text-md fm-text-muted">{myPlayer.nationality}</span>
              <span className={`fm-ovr ${getOvrClass(ovr)} fm-text-xl`}>OVR {ovr}</span>
            </div>
          </div>

          {/* 스탯 그리드 */}
          <div className="fm-flex-col fm-gap-xs">
            {Object.entries(myPlayer.stats).map(([key, value]) => (
              <div key={key} className="fm-bar">
                <span className="fm-text-sm fm-text-muted" style={{ minWidth: '100px' }}>
                  {STAT_LABELS[key] ?? key}
                </span>
                <div className="fm-bar__track">
                  <div
                    className={`fm-bar__fill ${getStatBarFillClass(value)}`}
                    style={{ width: `${value}%` }}
                  />
                </div>
                <span className="fm-bar__value">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 위젯 그리드 */}
      <div className="fm-grid fm-grid--2">
        {/* 오늘의 일정 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">오늘의 일정</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-justify-between fm-mb-sm">
              <span className="fm-text-lg fm-text-primary fm-font-medium">{season.currentDate}</span>
              <span className="fm-text-md fm-text-muted">{season.currentWeek}주차</span>
            </div>
            <div className="fm-card fm-card--highlight fm-text-center">
              <span className="fm-text-xl fm-font-bold fm-text-primary">
                {dayType ? (DAY_TYPE_LABELS[dayType] ?? dayType) : '대기 중'}
              </span>
            </div>
          </div>
        </div>

        {/* 현재 컨디션 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">현재 컨디션</span>
          </div>
          <div className="fm-panel__body">
            {loading ? (
              <p className="fm-text-muted fm-text-md">불러오는 중...</p>
            ) : (
              <div className="fm-flex-col fm-gap-sm">
                {[
                  { label: '체력', value: stamina },
                  { label: '사기', value: morale },
                  { label: '폼', value: form },
                ].map((item) => (
                  <div key={item.label} className="fm-bar">
                    <span className="fm-text-sm fm-text-muted" style={{ minWidth: '40px' }}>
                      {item.label}
                    </span>
                    <div className="fm-bar__track">
                      <div
                        className={`fm-bar__fill ${getBarFillClass(item.value)}`}
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                    <span className="fm-bar__value">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 팀 내 위치 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">팀 내 위치</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex-col fm-gap-xs fm-mb-md">
              <div className="fm-info-row">
                <span className="fm-info-row__label">소속</span>
                <span className={`fm-badge ${myDivision === '1군' ? 'fm-badge--success' : 'fm-badge--danger'}`}>
                  {myDivision}
                </span>
              </div>
              <div className="fm-info-row">
                <span className="fm-info-row__label">팀</span>
                <span className="fm-info-row__value">{userTeam.name}</span>
              </div>
            </div>

            {/* 경쟁자 */}
            {rivals.length > 0 && (
              <div>
                <div className="fm-divider" />
                <span className="fm-text-xs fm-text-muted fm-text-upper fm-mb-sm" style={{ display: 'block' }}>
                  같은 포지션 경쟁자 ({POSITION_LABELS[myPlayer.position]})
                </span>
                {rivals.map((rival) => {
                  const rivalOvr = getOvr(rival);
                  const rivalDiv = (rival as { division?: string }).division === 'main' ? '1군' : '2군';
                  return (
                    <div key={rival.id} className="fm-match-row">
                      <span className="fm-flex-1 fm-text-md fm-font-medium fm-text-primary">{rival.name}</span>
                      <span className="fm-text-sm fm-text-muted">{rivalDiv}</span>
                      <span className={`fm-ovr ${getOvrClass(rivalOvr)} fm-text-md`}>OVR {rivalOvr}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {rivals.length === 0 && (
              <p className="fm-text-muted fm-text-md">같은 포지션 경쟁자가 없습니다.</p>
            )}
          </div>
        </div>

        {/* 멘탈 스탯 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">멘탈</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex-col fm-gap-sm">
              {[
                { label: '멘탈 강도', value: myPlayer.mental.mental },
                { label: '체력', value: myPlayer.mental.stamina },
                { label: '사기', value: myPlayer.mental.morale },
              ].map((item) => (
                <div key={item.label} className="fm-bar">
                  <span className="fm-text-sm fm-text-muted" style={{ minWidth: '60px' }}>
                    {item.label}
                  </span>
                  <div className="fm-bar__track">
                    <div
                      className={`fm-bar__fill ${getBarFillClass(item.value)}`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                  <span className="fm-bar__value">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
