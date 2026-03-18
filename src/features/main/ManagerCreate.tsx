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
const STAT_MIN = 1;
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
    // 배경 변경 시 보너스 포인트 초기화
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
    });
    navigate('/team-select');
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>감독 프로필 생성</h1>

      <div style={styles.form}>
        {/* 이름 */}
        <div style={styles.field}>
          <label style={styles.label}>이름</label>
          <input
            style={styles.input}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="감독 이름을 입력하세요"
          />
        </div>

        {/* 국적 */}
        <div style={styles.field}>
          <label style={styles.label}>국적</label>
          <select
            style={styles.select}
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
          >
            {NATIONALITIES.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </select>
        </div>

        {/* 나이 */}
        <div style={styles.field}>
          <label style={styles.label}>나이</label>
          <div style={styles.ageRow}>
            <input
              style={styles.ageInput}
              type="range"
              min={30}
              max={60}
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
            />
            <span style={styles.ageValue}>{age}세</span>
          </div>
        </div>

        {/* 배경 선택 */}
        <div style={styles.field}>
          <label style={styles.label}>배경</label>
          <div style={styles.bgGrid}>
            {BACKGROUNDS.map((bg) => (
              <button
                key={bg}
                style={{
                  ...styles.bgCard,
                  ...(background === bg ? styles.bgCardActive : {}),
                }}
                onClick={() => handleBackgroundChange(bg)}
              >
                <strong style={styles.bgCardTitle}>{MANAGER_BG_LABELS[bg]}</strong>
                <span style={styles.bgCardDesc}>{MANAGER_BG_DESC[bg]}</span>
                <span style={styles.bgCardRep}>
                  명성: {MANAGER_BG_STATS[bg].reputation}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 능력치 */}
        <div style={styles.field}>
          <label style={styles.label}>
            능력치{' '}
            <span style={styles.pointsBadge}>
              남은 포인트: {remainingPoints}/{MAX_BONUS_POINTS}
            </span>
          </label>
          <div style={styles.statsGrid}>
            {STAT_KEYS.map((key) => {
              const base = baseData.stats[key];
              const bonus = bonusPoints[key];
              const total = finalStats[key];
              return (
                <div key={key} style={styles.statRow}>
                  <span style={styles.statName}>{MANAGER_STAT_LABELS[key]}</span>
                  <div style={styles.statControls}>
                    <button
                      style={{
                        ...styles.statBtn,
                        ...(bonus <= 0 ? styles.statBtnDisabled : {}),
                      }}
                      onClick={() => handleRemovePoint(key)}
                      disabled={bonus <= 0}
                    >
                      -
                    </button>
                    <div style={styles.statBarWrapper}>
                      <div style={styles.statBarBg}>
                        <div
                          style={{
                            ...styles.statBarBase,
                            width: `${(base / STAT_MAX) * 100}%`,
                          }}
                        />
                        {bonus > 0 && (
                          <div
                            style={{
                              ...styles.statBarBonus,
                              left: `${(base / STAT_MAX) * 100}%`,
                              width: `${(bonus / STAT_MAX) * 100}%`,
                            }}
                          />
                        )}
                      </div>
                      <span style={styles.statValue}>
                        {total}
                        {bonus > 0 && (
                          <span style={styles.statBonusText}> (+{bonus})</span>
                        )}
                      </span>
                    </div>
                    <button
                      style={{
                        ...styles.statBtn,
                        ...(remainingPoints <= 0 || total >= STAT_MAX
                          ? styles.statBtnDisabled
                          : {}),
                      }}
                      onClick={() => handleAddPoint(key)}
                      disabled={remainingPoints <= 0 || total >= STAT_MAX}
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
        <button
          style={{
            ...styles.createBtn,
            ...(name.trim() ? {} : { opacity: 0.4, cursor: 'not-allowed' }),
          }}
          onClick={handleCreate}
          disabled={!name.trim()}
        >
          다음 →
        </button>
      </div>

      <button style={styles.back} onClick={() => navigate('/mode-select')}>
        ← 돌아가기
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 50%, #0a0a1a 100%)',
    color: '#e0e0e0',
    padding: '40px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '32px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    width: '520px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#a0a0b0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  input: {
    padding: '12px 16px',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.05)',
    color: '#e0e0e0',
    fontSize: '16px',
    outline: 'none',
  },
  select: {
    padding: '12px 16px',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    background: '#1a1a2e',
    color: '#e0e0e0',
    fontSize: '16px',
    outline: 'none',
    cursor: 'pointer',
  },
  ageRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  ageInput: {
    flex: 1,
    accentColor: '#c89b3c',
    cursor: 'pointer',
  },
  ageValue: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#c89b3c',
    minWidth: '40px',
    textAlign: 'right' as const,
  },
  bgGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  bgCard: {
    padding: '14px',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.03)',
    color: '#e0e0e0',
    cursor: 'pointer',
    textAlign: 'left' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    transition: 'all 0.2s',
  },
  bgCardActive: {
    borderColor: '#c89b3c',
    background: 'rgba(200,155,60,0.1)',
  },
  bgCardTitle: {
    fontSize: '14px',
    color: '#f0e6d2',
  },
  bgCardDesc: {
    fontSize: '11px',
    color: '#6a6a7a',
    lineHeight: '1.4',
  },
  bgCardRep: {
    fontSize: '11px',
    color: '#c89b3c',
    marginTop: '4px',
  },
  pointsBadge: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#c89b3c',
    background: 'rgba(200,155,60,0.15)',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  statsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  statName: {
    fontSize: '13px',
    color: '#a0a0b0',
    width: '80px',
    flexShrink: 0,
  },
  statControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
  },
  statBtn: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    border: '1px solid #3a3a5c',
    background: 'rgba(255,255,255,0.05)',
    color: '#c89b3c',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
    flexShrink: 0,
  },
  statBtnDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
  statBarWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statBarBg: {
    flex: 1,
    height: '8px',
    borderRadius: '4px',
    background: 'rgba(255,255,255,0.08)',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  statBarBase: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: '4px',
    background: 'linear-gradient(90deg, #3a5a8c, #5a8ac0)',
    transition: 'width 0.3s',
  },
  statBarBonus: {
    position: 'absolute' as const,
    top: 0,
    height: '100%',
    borderRadius: '0 4px 4px 0',
    background: 'linear-gradient(90deg, #c89b3c, #e0b94e)',
    transition: 'all 0.3s',
  },
  statValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#e0e0e0',
    minWidth: '50px',
    textAlign: 'right' as const,
  },
  statBonusText: {
    color: '#c89b3c',
    fontSize: '12px',
  },
  createBtn: {
    padding: '14px',
    border: 'none',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #c89b3c, #a67c2e)',
    color: '#0a0a1a',
    fontWeight: 700,
    fontSize: '16px',
    cursor: 'pointer',
    marginTop: '8px',
  },
  back: {
    marginTop: '32px',
    padding: '10px 20px',
    border: 'none',
    borderRadius: '6px',
    background: 'transparent',
    color: '#6a6a7a',
    fontSize: '14px',
    cursor: 'pointer',
  },
};
