import { useEffect, useMemo, useState } from 'react';
import { getTeamConditions } from '../../../db/queries';
import { isAiAvailable } from '../../../ai/gameAiService';
import { chatWithLlmJson } from '../../../ai/provider';
import { buildPlayerContext } from '../../../ai/contextBuilder';
import { useGameStore } from '../../../stores/gameStore';
import type { Player } from '../../../types/player';
import { POSITION_LABELS_KR as POSITION_LABELS } from '../../../utils/constants';

const DAY_TYPE_LABELS: Record<string, string> = {
  training: '훈련일',
  scrim: '스크림',
  match_day: '경기일',
  match: '경기일',
  rest: '휴식일',
  event: '이벤트',
};

const STAT_LABELS: Record<string, string> = {
  mechanical: '메카닉',
  gameSense: '게임 이해도',
  teamwork: '팀워크',
  consistency: '안정감',
  laning: '라인전',
  aggression: '공격성',
};

function getOvr(player: Player): number {
  const s = player.stats;
  return Math.round((s.mechanical + s.gameSense + s.teamwork + s.consistency + s.laning + s.aggression) / 6);
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

function getPosBadgeClass(pos: string) {
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

  const userTeam = teams.find((team) => team.id === save?.userTeamId);
  const myPlayer = userTeam?.roster.find((player) => player.id === save?.userPlayerId);

  useEffect(() => {
    if (!userTeam || !season) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const cond = await getTeamConditions(userTeam.id, season.currentDate);
        if (!cancelled) setConditions(cond);

        if (save?.userPlayerId) {
          try {
            const aiReady = await isAiAvailable();
            if (aiReady) {
              const playerCtx = await buildPlayerContext(save.userPlayerId);
              const result = await chatWithLlmJson<{ narrative: string }>(
                `당신은 프로 LoL 선수입니다. 오늘 하루를 1인칭 시점의 짧은 독백으로 요약하세요. 50자 이내로 써 주세요.\n\n[현재 상태]\n${playerCtx}\n\nJSON: {"narrative":"한 줄 독백"}`,
              );
              if (!cancelled) setNarrative(result.narrative);
            } else {
              const myCondition = cond.get(save.userPlayerId);
              const form = myCondition?.form ?? 50;
              const morale = myCondition?.morale ?? 50;
              if (form >= 70 && morale >= 70) {
                if (!cancelled) setNarrative('몸도 마음도 괜찮다. 오늘은 확실히 보여줄 수 있다.');
              } else if (form < 40) {
                if (!cancelled) setNarrative('몸이 무겁다. 오늘은 루틴을 단단히 잡아야 한다.');
              } else if (morale < 40) {
                if (!cancelled) setNarrative('마음이 흔들린다. 경기 전까지 집중을 끌어올려야 한다.');
              } else {
                if (!cancelled) setNarrative('평범한 하루다. 작은 차이를 만드는 데 집중하자.');
              }
            }
          } catch {
            if (!cancelled) setNarrative(null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [save?.userPlayerId, season, userTeam]);

  const myCondition = myPlayer ? conditions.get(myPlayer.id) : null;
  const stamina = myCondition?.stamina ?? myPlayer?.mental.stamina ?? 50;
  const morale = myCondition?.morale ?? myPlayer?.mental.morale ?? 50;
  const form = myCondition?.form ?? 50;

  const myDivision = (myPlayer as { division?: string } | undefined)?.division === 'main' ? '1군' : '2군';
  const ovr = myPlayer ? getOvr(myPlayer) : 0;

  const rivals = useMemo(
    () => userTeam?.roster.filter((player) => player.position === myPlayer?.position && player.id !== myPlayer?.id) ?? [],
    [myPlayer?.id, myPlayer?.position, userTeam?.roster],
  );

  if (!userTeam || !season || !myPlayer) {
    return <p className="fm-text-secondary fm-text-md">선수 데이터를 불러오는 중입니다...</p>;
  }

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">선수 홈</h1>
        <p className="fm-page-subtitle">내 상태와 오늘 해야 할 일만 먼저 보이도록 정리했습니다.</p>
      </div>

      {narrative ? (
        <div className="fm-alert fm-alert--info fm-mb-lg">
          <span className="fm-alert__text">“{narrative}”</span>
        </div>
      ) : null}

      <div className="fm-grid fm-grid--2 fm-mb-lg">
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">내 현재 상태</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-items-center fm-justify-between fm-mb-md fm-gap-md fm-flex-wrap">
              <div className="fm-flex fm-items-center fm-gap-md">
                <span className="fm-text-2xl fm-font-bold fm-text-primary">{myPlayer.name}</span>
                <span className={`fm-pos-badge ${getPosBadgeClass(myPlayer.position)}`}>
                  {POSITION_LABELS[myPlayer.position] ?? myPlayer.position}
                </span>
                <span className={`fm-ovr ${getOvrClass(ovr)} fm-text-xl`}>OVR {ovr}</span>
              </div>
              <div className="fm-flex fm-gap-md fm-flex-wrap">
                <span className="fm-text-md fm-text-muted">{myPlayer.age}세</span>
                <span className="fm-text-md fm-text-muted">{myPlayer.nationality}</span>
                <span className={`fm-badge ${myDivision === '1군' ? 'fm-badge--success' : 'fm-badge--default'}`}>{myDivision}</span>
              </div>
            </div>

            <div className="fm-grid fm-grid--3">
              {[
                { label: '체력', value: stamina },
                { label: '사기', value: morale },
                { label: '폼', value: form },
              ].map((item) => (
                <div key={item.label} className="fm-card">
                  <div className="fm-stat">
                    <span className="fm-stat__label">{item.label}</span>
                    <span className="fm-stat__value">{item.value}</span>
                  </div>
                  <div className="fm-bar fm-mt-xs">
                    <div className={`fm-bar__fill ${getBarFillClass(item.value)}`} style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">오늘 루틴</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            <div className="fm-card">
              <div className="fm-flex fm-justify-between fm-items-center fm-mb-xs">
                <span className="fm-text-primary fm-font-semibold">오늘 일정</span>
                <span className="fm-badge fm-badge--default">{season.currentWeek}주차</span>
              </div>
              <div className="fm-text-secondary">{season.currentDate}</div>
              <div className="fm-text-lg fm-font-semibold fm-text-accent fm-mt-sm">
                {dayType ? (DAY_TYPE_LABELS[dayType] ?? dayType) : '대기 중'}
              </div>
            </div>

            <div className="fm-card">
              <div className="fm-text-primary fm-font-semibold fm-mb-xs">지금 신경 쓸 것</div>
              <div className="fm-text-secondary">
                {loading
                  ? '선수 컨디션을 불러오는 중입니다.'
                  : form < 45
                  ? '폼 회복이 먼저입니다. 훈련과 휴식 루틴을 우선 챙기세요.'
                  : morale < 45
                  ? '멘탈 관리가 필요합니다. 인터뷰와 팀 분위기를 조심하세요.'
                  : '큰 경고는 없습니다. 오늘 루틴을 안정적으로 소화하면 됩니다.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <details className="fm-disclosure">
        <summary>세부 정보 보기</summary>
        <div className="fm-disclosure__body">
          <div className="fm-grid fm-grid--2">
            <div className="fm-panel">
              <div className="fm-panel__header">
                <span className="fm-panel__title">능력치 상세</span>
              </div>
              <div className="fm-panel__body fm-flex-col fm-gap-xs">
                {Object.entries(myPlayer.stats).map(([key, value]) => (
                  <div key={key} className="fm-bar">
                    <span className="fm-text-sm fm-text-muted" style={{ minWidth: '96px' }}>
                      {STAT_LABELS[key] ?? key}
                    </span>
                    <div className="fm-bar__track">
                      <div className={`fm-bar__fill ${getStatBarFillClass(value)}`} style={{ width: `${value}%` }} />
                    </div>
                    <span className="fm-bar__value">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="fm-panel">
              <div className="fm-panel__header">
                <span className="fm-panel__title">경쟁 구도</span>
              </div>
              <div className="fm-panel__body">
                <div className="fm-info-row fm-mb-md">
                  <span className="fm-info-row__label">팀</span>
                  <span className="fm-info-row__value">{userTeam.name}</span>
                </div>

                {rivals.length > 0 ? (
                  <div className="fm-flex-col fm-gap-sm">
                    {rivals.map((rival) => {
                      const rivalOvr = getOvr(rival);
                      const rivalDivision = (rival as { division?: string }).division === 'main' ? '1군' : '2군';
                      return (
                        <div key={rival.id} className="fm-card">
                          <div className="fm-flex fm-justify-between fm-items-center fm-gap-sm">
                            <span className="fm-text-primary fm-font-semibold">{rival.name}</span>
                            <span className="fm-text-sm fm-text-muted">{rivalDivision}</span>
                            <span className={`fm-ovr ${getOvrClass(rivalOvr)} fm-text-md`}>OVR {rivalOvr}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="fm-text-muted fm-text-md">같은 포지션 경쟁자가 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
