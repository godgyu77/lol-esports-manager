import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ManagerBackground, ManagerStats } from '../../types/manager';
import {
  MANAGER_BG_LABELS,
  MANAGER_BG_DESC,
  MANAGER_BG_STATS,
  MANAGER_STAT_LABELS,
} from '../../types/manager';
import { useGameStore } from '../../stores/gameStore';
import {
  getDominantManagerTraits,
  getInitialManagerPhilosophy,
  getManagerIdentityEffects,
} from '../../engine/manager/managerIdentityEngine';
import './introFlow.css';

const NATIONALITIES = [
  { value: 'KR', label: '한국' },
  { value: 'CN', label: '중국' },
  { value: 'US', label: '미국' },
  { value: 'DE', label: '독일' },
  { value: 'FR', label: '프랑스' },
  { value: 'DK', label: '덴마크' },
  { value: 'SE', label: '스웨덴' },
  { value: 'VN', label: '베트남' },
  { value: 'TW', label: '대만' },
  { value: 'JP', label: '일본' },
];

const BACKGROUNDS: ManagerBackground[] = ['ex_player', 'analyst', 'rookie', 'academy_coach'];
const MAX_BONUS_POINTS = 5;
const STAT_MAX = 20;

const BACKGROUND_HEADLINES: Record<ManagerBackground, { press: string; style: string }> = {
  ex_player: {
    press: '유명 선수 출신 감독, 시즌 운영에서도 현장 감각을 증명할 수 있을까.',
    style: '선수 흐름을 빠르게 읽고 큰 경기에서 존재감을 만드는 운영에 잘 맞습니다.',
  },
  analyst: {
    press: '준비된 전술가라는 평가, 밴픽과 분석에서 차이를 만들 수 있을까.',
    style: '전술과 데이터 해석으로 경기 우위를 설계하는 플레이에 잘 맞습니다.',
  },
  rookie: {
    press: '바닥에서 시작하는 신예 감독, 성장형 리더 프로젝트의 주인공.',
    style: '긴 시즌 동안 정체성을 천천히 만들며 육성과 운영을 함께 끌고 가기 좋습니다.',
  },
  academy_coach: {
    press: '유망주 육성 전문가, 팀 문화와 동기부여를 이끄는 감독.',
    style: '선수 관리와 팀 분위기, 성장 곡선을 중시하는 플레이에 어울립니다.',
  },
};

const STAT_KEYS: (keyof ManagerStats)[] = [
  'tacticalKnowledge',
  'motivation',
  'discipline',
  'adaptability',
  'scoutingEye',
  'mediaHandling',
];

function buildIdentitySummary(background: ManagerBackground) {
  const philosophy = getInitialManagerPhilosophy(background);
  const traits = getDominantManagerTraits(philosophy);
  const effects = getManagerIdentityEffects(philosophy);
  const focus =
    effects.trainingFocusBonus > 0
      ? '전술 준비와 경기 플랜'
      : effects.playerMeetingBonus > 0
        ? '선수 관리와 팀 결속'
        : effects.pressEffectBonus > 0
          ? '언론 대응과 대외 이미지'
          : '균형 있는 운영';

  return {
    philosophy,
    traits,
    focus,
  };
}

export function ManagerCreate() {
  const navigate = useNavigate();
  const setPendingManager = useGameStore((s) => s.setPendingManager);

  const [name, setName] = useState('');
  const [nationality, setNationality] = useState('KR');
  const [age, setAge] = useState(35);
  const [background, setBackground] = useState<ManagerBackground>('analyst');
  const [bonusPoints, setBonusPoints] = useState<Record<keyof ManagerStats, number>>({
    tacticalKnowledge: 0,
    motivation: 0,
    discipline: 0,
    adaptability: 0,
    scoutingEye: 0,
    mediaHandling: 0,
  });

  const baseData = MANAGER_BG_STATS[background];
  const { philosophy: basePhilosophy, traits: baseTraits, focus } = useMemo(
    () => buildIdentitySummary(background),
    [background],
  );

  const usedPoints = useMemo(
    () => Object.values(bonusPoints).reduce((sum, value) => sum + value, 0),
    [bonusPoints],
  );
  const remainingPoints = MAX_BONUS_POINTS - usedPoints;

  const finalStats = useMemo(() => {
    const result = {} as ManagerStats;
    for (const key of STAT_KEYS) {
      result[key] = Math.min(STAT_MAX, baseData.stats[key] + bonusPoints[key]);
    }
    return result;
  }, [baseData, bonusPoints]);

  const handleBackgroundChange = (nextBackground: ManagerBackground) => {
    setBackground(nextBackground);
    setBonusPoints({
      tacticalKnowledge: 0,
      motivation: 0,
      discipline: 0,
      adaptability: 0,
      scoutingEye: 0,
      mediaHandling: 0,
    });
  };

  const handleAddPoint = (key: keyof ManagerStats) => {
    if (remainingPoints <= 0) return;
    if (baseData.stats[key] + bonusPoints[key] >= STAT_MAX) return;
    setBonusPoints((prev) => ({ ...prev, [key]: prev[key] + 1 }));
  };

  const handleRemovePoint = (key: keyof ManagerStats) => {
    if (bonusPoints[key] <= 0) return;
    setBonusPoints((prev) => ({ ...prev, [key]: prev[key] - 1 }));
  };

  const handleCreate = () => {
    if (!name.trim() || remainingPoints > 0) return;
    setPendingManager({
      name: name.trim(),
      nationality,
      age,
      background,
      stats: finalStats,
      reputation: baseData.reputation,
      philosophy: basePhilosophy,
    });
    navigate('/team-select');
  };

  return (
    <div className="fm-content fm-flex-col fm-items-center intro-page">
      <div className="intro-shell" style={{ maxWidth: 980 }}>
        <header className="fm-panel intro-hero intro-panel-soft" style={{ overflow: 'hidden' }}>
          <div className="fm-panel__body" style={{ padding: 28 }}>
            <div className="fm-text-xs fm-font-semibold fm-text-accent fm-text-upper fm-mb-sm">감독 정체성</div>
            <h1 className="fm-text-2xl fm-font-bold fm-text-primary" style={{ margin: 0 }}>감독 정체성을 설계하세요</h1>
            <p className="fm-text-md fm-text-muted fm-mt-sm" style={{ lineHeight: 1.7 }}>
              먼저 기본 정보와 배경을 정하고, 그다음 능력치 5포인트만 배분하면 됩니다.
            </p>
          </div>
        </header>

        <div className="intro-two-column intro-two-column--wide">
          <div className="fm-flex-col fm-gap-lg">
            <section className="fm-panel">
              <div className="fm-panel__header">
                <span className="fm-panel__title">기본 정보</span>
              </div>
              <div className="fm-panel__body fm-flex-col fm-gap-md">
                <div className="fm-flex-col fm-gap-xs">
                  <label className="fm-text-sm fm-font-semibold fm-text-secondary">감독 이름</label>
                  <input
                    className="fm-input"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="예: 김민석"
                    style={{ padding: '10px 14px', fontSize: 14 }}
                  />
                </div>

                <div className="intro-card-grid intro-card-grid--2" style={{ gap: 16 }}>
                  <div className="fm-flex-col fm-gap-xs">
                    <label className="fm-text-sm fm-font-semibold fm-text-secondary">국적</label>
                    <select
                      className="fm-select"
                      value={nationality}
                      onChange={(event) => setNationality(event.target.value)}
                      style={{ padding: '10px 32px 10px 14px', fontSize: 14 }}
                    >
                      {NATIONALITIES.map((nation) => (
                        <option key={nation.value} value={nation.value}>
                          {nation.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fm-flex-col fm-gap-xs">
                    <label className="fm-text-sm fm-font-semibold fm-text-secondary">나이</label>
                    <div className="fm-flex fm-items-center fm-gap-md">
                      <input
                        type="range"
                        min={30}
                        max={60}
                        value={age}
                        onChange={(event) => setAge(Number(event.target.value))}
                        style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                        aria-label="감독 나이 선택"
                      />
                      <span className="fm-text-xl fm-font-semibold fm-text-accent" style={{ minWidth: 52, textAlign: 'right' }}>
                        {age}세
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="fm-panel">
              <div className="fm-panel__header">
                <span className="fm-panel__title">배경 선택</span>
              </div>
              <div className="fm-panel__body">
                <div className="intro-card-grid intro-card-grid--2">
                  {BACKGROUNDS.map((option) => (
                    <button
                      key={option}
                      className={`fm-card fm-card--clickable fm-flex-col fm-gap-xs ${background === option ? 'fm-card--highlight' : ''}`}
                      onClick={() => handleBackgroundChange(option)}
                    >
                      <strong className="fm-text-lg fm-text-primary">{MANAGER_BG_LABELS[option]}</strong>
                      <span className="fm-text-xs fm-text-muted" style={{ lineHeight: 1.5 }}>
                        {MANAGER_BG_DESC[option]}
                      </span>
                      <span className="fm-text-xs fm-text-accent">초기 명성 {MANAGER_BG_STATS[option].reputation}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="fm-panel">
              <div className="fm-panel__header">
                <span className="fm-panel__title">능력치 배분</span>
                <span className="fm-badge fm-badge--accent">남은 포인트 {remainingPoints}/{MAX_BONUS_POINTS}</span>
              </div>
              <div className="fm-panel__body fm-flex-col fm-gap-sm">
                {STAT_KEYS.map((key) => {
                  const base = baseData.stats[key];
                  const bonus = bonusPoints[key];
                  const total = finalStats[key];
                  return (
                    <div key={key} className="fm-flex fm-items-center fm-gap-md">
                      <span className="fm-text-sm fm-text-secondary" style={{ width: 90, flexShrink: 0 }}>
                        {MANAGER_STAT_LABELS[key]}
                      </span>
                      <div className="fm-flex fm-items-center fm-gap-sm fm-flex-1">
                        <button
                          className="fm-btn fm-btn--sm fm-text-accent"
                          style={{ width: 28, height: 28, padding: 0 }}
                          onClick={() => handleRemovePoint(key)}
                          disabled={bonus <= 0}
                          aria-label={`${MANAGER_STAT_LABELS[key]} 감소`}
                        >
                          -
                        </button>
                        <div className="fm-bar fm-flex-1">
                          <div className="fm-bar__track" style={{ position: 'relative', height: 8 }}>
                            <div
                              className="fm-bar__fill fm-bar__fill--blue"
                              style={{ width: `${(base / STAT_MAX) * 100}%`, position: 'absolute', inset: 0, height: '100%' }}
                            />
                            {bonus > 0 && (
                              <div
                                className="fm-bar__fill fm-bar__fill--accent"
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: `${(base / STAT_MAX) * 100}%`,
                                  width: `${(bonus / STAT_MAX) * 100}%`,
                                  height: '100%',
                                  borderRadius: '0 3px 3px 0',
                                }}
                              />
                            )}
                          </div>
                        </div>
                        <span className="fm-text-lg fm-font-semibold" style={{ minWidth: 60, textAlign: 'right' }}>
                          {total}
                          {bonus > 0 && <span className="fm-text-accent fm-text-xs"> (+{bonus})</span>}
                        </span>
                        <button
                          className="fm-btn fm-btn--sm fm-text-accent"
                          style={{ width: 28, height: 28, padding: 0 }}
                          onClick={() => handleAddPoint(key)}
                          disabled={remainingPoints <= 0 || total >= STAT_MAX}
                          aria-label={`${MANAGER_STAT_LABELS[key]} 증가`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="fm-flex-col fm-gap-lg intro-sidebar">
            <section className="fm-panel">
              <div className="fm-panel__header">
                <span className="fm-panel__title">현재 감독 이미지</span>
              </div>
              <div className="fm-panel__body">
                <div className="fm-card">
                  <div className="fm-text-xs fm-font-semibold fm-text-muted fm-text-upper fm-mb-sm">요약</div>
                  <div className="fm-text-md fm-text-primary" style={{ lineHeight: 1.7 }}>
                    {BACKGROUND_HEADLINES[background].press}
                  </div>
                  <div className="fm-text-sm fm-text-muted fm-mt-sm" style={{ lineHeight: 1.7 }}>
                    {BACKGROUND_HEADLINES[background].style}
                  </div>
                  <div className="fm-flex fm-gap-sm fm-mt-md" style={{ flexWrap: 'wrap' }}>
                    {(baseTraits.length > 0 ? baseTraits : ['균형 있는 운영']).map((trait) => (
                      <span key={trait} className="fm-badge fm-badge--accent">{trait}</span>
                    ))}
                  </div>
                  <div className="fm-text-sm fm-text-muted fm-mt-sm">운영 초점: {focus}</div>
                </div>
              </div>
            </section>

            <div className="fm-panel">
              <div className="fm-panel__body fm-flex-col fm-gap-sm">
                <button
                  className="fm-btn fm-btn--primary fm-btn--lg intro-cta"
                  onClick={handleCreate}
                  disabled={!name.trim() || remainingPoints > 0}
                >
                  팀 선택으로 이동
                </button>
                <div className="intro-inline-note">
                  {remainingPoints > 0
                    ? '남은 포인트를 모두 배분해야 다음 단계로 넘어갈 수 있습니다.'
                    : '기본 정보와 능력치 배분이 끝났습니다.'}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <button className="fm-btn fm-btn--ghost intro-back" onClick={() => navigate('/mode-select')}>
        모드 선택으로 돌아가기
      </button>
    </div>
  );
}
