import { useState, useMemo } from 'react';
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
} from '../../engine/manager/managerIdentityEngine';

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

const STAT_KEYS: (keyof ManagerStats)[] = [
  'tacticalKnowledge',
  'motivation',
  'discipline',
  'adaptability',
  'scoutingEye',
  'mediaHandling',
];

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
  const basePhilosophy = useMemo(() => getInitialManagerPhilosophy(background), [background]);
  const baseTraits = useMemo(() => getDominantManagerTraits(basePhilosophy), [basePhilosophy]);

  const usedPoints = useMemo(
    () => Object.values(bonusPoints).reduce((sum, v) => sum + v, 0),
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

  const handleBackgroundChange = (bg: ManagerBackground) => {
    setBackground(bg);
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
    const newVal = baseData.stats[key] + bonusPoints[key] + 1;
    if (newVal > STAT_MAX) return;
    setBonusPoints((prev) => ({ ...prev, [key]: prev[key] + 1 }));
  };

  const handleRemovePoint = (key: keyof ManagerStats) => {
    if (bonusPoints[key] <= 0) return;
    setBonusPoints((prev) => ({ ...prev, [key]: prev[key] - 1 }));
  };

  const handleCreate = () => {
    if (!name.trim()) return;
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
    <div className="fm-content fm-flex-col fm-items-center" style={{ minHeight: '100vh' }}>
      <h1 className="fm-text-2xl fm-font-bold fm-text-accent fm-mb-lg">감독 프로필 생성</h1>

      <div className="fm-flex-col fm-gap-lg" style={{ width: 520 }}>
        {/* 이름 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">기본 정보</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-md">
            {/* 이름 필드 */}
            <div className="fm-flex-col fm-gap-xs">
              <label className="fm-text-sm fm-font-semibold fm-text-secondary">이름</label>
              <input
                className="fm-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="감독 이름을 입력하세요"
                style={{ padding: '10px 14px', fontSize: 14 }}
              />
            </div>

            {/* 국적 필드 */}
            <div className="fm-flex-col fm-gap-xs">
              <label className="fm-text-sm fm-font-semibold fm-text-secondary">국적</label>
              <select
                className="fm-select"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                style={{ padding: '10px 32px 10px 14px', fontSize: 14 }}
              >
                {NATIONALITIES.map((n) => (
                  <option key={n.value} value={n.value}>
                    {n.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 나이 필드 */}
            <div className="fm-flex-col fm-gap-xs">
              <label className="fm-text-sm fm-font-semibold fm-text-secondary">나이</label>
              <div className="fm-flex fm-items-center fm-gap-md">
                <input
                  type="range"
                  min={30}
                  max={60}
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                  aria-label="나이 선택"
                />
                <span className="fm-text-xl fm-font-semibold fm-text-accent" style={{ minWidth: 48, textAlign: 'right' }}>
                  {age}세
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 배경 선택 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">배경</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-grid fm-grid--2">
              {BACKGROUNDS.map((bg) => (
                <button
                  key={bg}
                  className={`fm-card fm-card--clickable fm-flex-col fm-gap-xs ${
                    background === bg ? 'fm-card--highlight' : ''
                  }`}
                  onClick={() => handleBackgroundChange(bg)}
                >
                  <strong className="fm-text-lg fm-text-primary">{MANAGER_BG_LABELS[bg]}</strong>
                  <span className="fm-text-xs fm-text-muted" style={{ lineHeight: 1.4 }}>
                    {MANAGER_BG_DESC[bg]}
                  </span>
                  <span className="fm-text-xs fm-text-accent fm-mt-sm">
                    명성: {MANAGER_BG_STATS[bg].reputation}
                  </span>
                </button>
              ))}
            </div>
            <div className="fm-card fm-mt-md">
              <div className="fm-flex fm-justify-between fm-items-center fm-gap-md">
                <span className="fm-text-sm fm-font-semibold fm-text-primary">초기 감독 성향</span>
                <span className="fm-text-xs fm-text-muted">
                  {baseTraits.length > 0 ? baseTraits.join(' / ') : '균형형'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 능력치 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">능력치</span>
            <span className="fm-badge fm-badge--accent">
              남은 포인트: {remainingPoints}/{MAX_BONUS_POINTS}
            </span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {STAT_KEYS.map((key) => {
              const base = baseData.stats[key];
              const bonus = bonusPoints[key];
              const total = finalStats[key];
              return (
                <div key={key} className="fm-flex fm-items-center fm-gap-md">
                  <span className="fm-text-sm fm-text-secondary" style={{ width: 80, flexShrink: 0 }}>
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
                          style={{ width: `${(base / STAT_MAX) * 100}%`, position: 'absolute', top: 0, left: 0, height: '100%' }}
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
                      <span className="fm-bar__value fm-text-lg" style={{ minWidth: 50, textAlign: 'right' }}>
                        {total}
                        {bonus > 0 && (
                          <span className="fm-text-accent fm-text-xs"> (+{bonus})</span>
                        )}
                      </span>
                    </div>
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
        </div>

        {/* 다음 버튼 */}
        {remainingPoints > 0 && (
          <p className="fm-text-sm fm-text-warning fm-text-center">
            보너스 포인트 {remainingPoints}점을 모두 배분해야 진행할 수 있습니다.
          </p>
        )}
        <button
          className="fm-btn fm-btn--primary fm-btn--lg"
          style={{ width: '100%' }}
          onClick={handleCreate}
          disabled={!name.trim() || remainingPoints > 0}
        >
          다음 →
        </button>
      </div>

      <button className="fm-btn fm-btn--ghost fm-mt-lg" onClick={() => navigate('/mode-select')}>
        ← 돌아가기
      </button>
    </div>
  );
}
