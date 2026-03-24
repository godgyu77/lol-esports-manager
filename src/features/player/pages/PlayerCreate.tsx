import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Position } from '../../../types';
import type { PlayerBackground } from '../../../types/player';
import { useGameStore } from '../../../stores/gameStore';
import { TRAIT_LIBRARY, type TraitTier } from '../../../data/traitLibrary';

// ─────────────────────────────────────────
// 배경 설정
// ─────────────────────────────────────────

const BACKGROUNDS: {
  value: PlayerBackground;
  label: string;
  desc: string;
  statSummary: string;
  traitRule: string;
}[] = [
  {
    value: 'solorank',
    label: '솔로랭크 챌린저',
    desc: '솔로 랭크에서 이름을 알린 실력파. 개인기는 뛰어나지만 팀 플레이 경험이 부족하다.',
    statSummary: '피지컬↑ 라인전↑ 팀워크↓',
    traitRule: '긍정 2개',
  },
  {
    value: 'trainee',
    label: '연습생 출신',
    desc: '프로팀 연습생으로 체계적 훈련을 받았다. 균형잡힌 능력치와 팀워크가 장점.',
    statSummary: '팀워크↑ 일관성↑ 피지컬↓',
    traitRule: '긍정 2개',
  },
  {
    value: 'prodigy',
    label: '천재형 신인',
    desc: '타고난 재능으로 주목받는 신예. 폭발적 잠재력이 있지만 기복이 심하다.',
    statSummary: '피지컬↑ 이해도↑ 일관성↓ 팀워크↓',
    traitRule: '높은 긍정 1개 + 랜덤 부정 1개',
  },
];

// 배경별 특성 규칙: 공평하게 총 2개, 구성만 다름
const BG_TRAIT_RULES: Record<PlayerBackground, {
  positive: { count: number; tiers: TraitTier[] };
  negative: { count: number; mode: 'pick' | 'random' | 'none' };
}> = {
  solorank: {
    positive: { count: 2, tiers: ['B', 'C'] },
    negative: { count: 0, mode: 'none' },
  },
  trainee: {
    positive: { count: 2, tiers: ['C'] },
    negative: { count: 0, mode: 'none' },
  },
  prodigy: {
    positive: { count: 1, tiers: ['A', 'B'] },
    negative: { count: 1, mode: 'random' },
  },
};

// 포지션별 추천 긍정 특성
const POS_RECOMMENDED: Record<Position, string[]> = {
  top: ['LANE_KINGDOM', 'SPLIT_PUSHER', 'STONE_HEAD', 'TOP_CARRY', 'SOLO_KILL', 'AGGRESSIVE', 'TURRET_HUGGER', 'LATE_BLOOMER', 'AUDACIOUS', 'PRACTICE_BUG'],
  jungle: ['SMITE_KING', 'SMART_JUNGLE', 'CARRY_JUNGLE', 'GANKING_MACHINE', 'RPG_JUNGLE', 'BUSH_MASTER', 'FIRST_BLOOD', 'SPONGE', 'GROWTH_POTENTIAL', 'AUDACIOUS'],
  mid: ['ROAMING_GOD', 'LANE_KINGDOM', 'MELEE_MID', 'POKE_MASTER', 'COMFORT_PICK', 'SOLO_KILL', 'AGGRESSIVE', 'PURE_MECH', 'COPYCAT', 'PRACTICE_BUG'],
  adc: ['SURVIVOR', 'LANE_KINGDOM', 'CONSISTENT', 'FARMING_MACHINE', 'LANE_FREEZER', 'POKE_MASTER', 'LATE_BLOOMER', 'GLASS_CANNON', 'GROWTH_POTENTIAL', 'SPONGE'],
  support: ['VISIONARY', 'ROAMING_GOD', 'ENGAGE_SUPPORT', 'ASSIST_KING', 'BUSH_MASTER', 'WARD_CLEANER', 'BLUE_WORKER', 'SPONGE', 'GROWTH_POTENTIAL', 'COPYCAT'],
};

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

const TIER_COLORS: Record<TraitTier, string> = {
  S: '#ff6b6b', A: '#ffd93d', B: '#6bcb77', C: '#4d96ff', NEG: '#e74c3c',
};

// ─────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────

export function PlayerCreate() {
  const navigate = useNavigate();
  const setPendingPlayer = useGameStore((s) => s.setPendingPlayer);

  const [name, setName] = useState('');
  const [age, setAge] = useState(17);
  const [nationality, setNationality] = useState('KR');
  const [position, setPosition] = useState<Position>('mid');
  const [background, setBackground] = useState<PlayerBackground>('solorank');
  const [positiveTraits, setPositiveTraits] = useState<string[]>([]);
  const [traitFilter, setTraitFilter] = useState<'recommended' | 'all'>('recommended');

  const positions: { value: Position; label: string }[] = [
    { value: 'top', label: '탑' },
    { value: 'jungle', label: '정글' },
    { value: 'mid', label: '미드' },
    { value: 'adc', label: '원딜' },
    { value: 'support', label: '서포터' },
  ];

  const rules = BG_TRAIT_RULES[background];

  const availablePositive = useMemo(() => {
    const all = Object.entries(TRAIT_LIBRARY)
      .filter(([, t]) => rules.positive.tiers.includes(t.tier));
    if (traitFilter === 'recommended') {
      const rec = new Set(POS_RECOMMENDED[position]);
      return all.filter(([id]) => rec.has(id));
    }
    return all;
  }, [rules.positive.tiers, position, traitFilter]);

  const handleTogglePositive = (id: string) => {
    setPositiveTraits(prev =>
      prev.includes(id) ? prev.filter(t => t !== id)
        : prev.length >= rules.positive.count ? prev
        : [...prev, id]
    );
  };

  const handleBackgroundChange = (bg: PlayerBackground) => {
    setBackground(bg);
    setPositiveTraits([]);
  };

  const isComplete = name.trim() && positiveTraits.length === rules.positive.count;

  const handleCreate = () => {
    if (!isComplete) return;

    let finalTraits = [...positiveTraits];

    // 천재형: 랜덤 부정 특성 1개 자동 부여
    if (rules.negative.mode === 'random' && rules.negative.count > 0) {
      const allNeg = Object.keys(TRAIT_LIBRARY).filter(id => TRAIT_LIBRARY[id].tier === 'NEG');
      const randomNeg = allNeg[Math.floor(Math.random() * allNeg.length)];
      finalTraits.push(randomNeg);
    }

    setPendingPlayer({
      name: name.trim(),
      age,
      nationality,
      position,
      background,
      traits: finalTraits,
    });
    navigate('/team-select');
  };

  const renderTraitList = (
    traits: [string, { name: string; tier: TraitTier; desc: string }][],
    selected: string[],
    onToggle: (id: string) => void,
    maxCount: number,
  ) => (
    <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {traits.map(([id, trait]) => {
        const isSelected = selected.includes(id);
        const isFull = selected.length >= maxCount && !isSelected;
        return (
          <button
            key={id}
            disabled={isFull}
            onClick={() => onToggle(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 6, textAlign: 'left', width: '100%',
              border: isSelected ? `1px solid ${TIER_COLORS[trait.tier]}` : '1px solid var(--border)',
              background: isSelected ? TIER_COLORS[trait.tier] + '15' : 'var(--bg-elevated)',
              cursor: isFull ? 'not-allowed' : 'pointer',
              opacity: isFull ? 0.4 : 1,
            }}
          >
            <span className="fm-text-xs fm-font-bold" style={{ color: TIER_COLORS[trait.tier], minWidth: 28, textAlign: 'center' }}>
              {trait.tier}
            </span>
            <div style={{ flex: 1 }}>
              <div className="fm-text-sm fm-font-semibold fm-text-primary">{trait.name}</div>
              <div className="fm-text-xs fm-text-muted" style={{ lineHeight: 1.3 }}>{trait.desc}</div>
            </div>
            {isSelected && <span style={{ color: TIER_COLORS[trait.tier], fontSize: 16 }}>✓</span>}
          </button>
        );
      })}
      {traits.length === 0 && (
        <p className="fm-text-sm fm-text-muted fm-text-center fm-p-md">
          해당 필터에 맞는 특성이 없습니다. "전체 보기"를 눌러주세요.
        </p>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: 20, overflowY: 'auto', height: '100vh' }}>
      <h1 className="fm-text-2xl fm-font-bold fm-text-accent fm-mb-lg fm-text-center">나만의 선수 만들기</h1>

      <div className="fm-flex-col fm-gap-lg">
        {/* 기본 정보 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">기본 정보</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-md">
            <div className="fm-flex-col fm-gap-xs">
              <label className="fm-text-sm fm-font-semibold fm-text-secondary">선수 이름 (닉네임)</label>
              <input
                className="fm-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: Faker, ShowMaker..."
                style={{ padding: '10px 14px', fontSize: 14 }}
              />
            </div>

            <div className="fm-flex fm-gap-md">
              <div className="fm-flex-col fm-gap-xs" style={{ flex: 1 }}>
                <label className="fm-text-sm fm-font-semibold fm-text-secondary">국적</label>
                <select
                  className="fm-select"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  style={{ padding: '10px 32px 10px 14px', fontSize: 14 }}
                >
                  {NATIONALITIES.map((n) => (
                    <option key={n.value} value={n.value}>{n.label}</option>
                  ))}
                </select>
              </div>

              <div className="fm-flex-col fm-gap-xs" style={{ flex: 1 }}>
                <label className="fm-text-sm fm-font-semibold fm-text-secondary">
                  나이 <span className="fm-text-accent">{age}세</span>
                </label>
                <input
                  type="range" min={16} max={20} value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  style={{ accentColor: 'var(--accent)', cursor: 'pointer', marginTop: 6 }}
                />
                <div className="fm-flex fm-justify-between">
                  <span className="fm-text-xs fm-text-muted">16세</span>
                  <span className="fm-text-xs fm-text-muted">20세</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 포지션 */}
        <div className="fm-panel">
          <div className="fm-panel__header"><span className="fm-panel__title">포지션</span></div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-gap-sm">
              {positions.map((p) => (
                <button
                  key={p.value}
                  className={`fm-btn fm-flex-1 ${position === p.value ? 'fm-btn--primary' : ''}`}
                  onClick={() => { setPosition(p.value); setPositiveTraits([]); }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 출신 배경 */}
        <div className="fm-panel">
          <div className="fm-panel__header"><span className="fm-panel__title">출신 배경</span></div>
          <div className="fm-panel__body">
            <div className="fm-flex-col fm-gap-sm">
              {BACKGROUNDS.map((b) => (
                <button
                  key={b.value}
                  className={`fm-card fm-card--clickable fm-flex-col fm-gap-xs ${background === b.value ? 'fm-card--highlight' : ''}`}
                  style={{ textAlign: 'left' }}
                  onClick={() => handleBackgroundChange(b.value)}
                >
                  <div className="fm-flex fm-justify-between fm-items-center">
                    <strong className="fm-text-lg fm-text-primary">{b.label}</strong>
                    <span className="fm-badge fm-badge--accent" style={{ fontSize: 10 }}>{b.traitRule}</span>
                  </div>
                  <span className="fm-text-xs fm-text-muted">{b.desc}</span>
                  <span className="fm-text-xs fm-text-secondary">{b.statSummary}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 특성 선택 */}
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">특성 선택</span>
          </div>
          <div className="fm-panel__body">
            {/* 필터 */}
            <div className="fm-flex fm-gap-xs fm-mb-md">
              <button
                className={`fm-btn fm-btn--sm ${traitFilter === 'recommended' ? 'fm-btn--primary' : ''}`}
                onClick={() => setTraitFilter('recommended')}
              >
                포지션 추천
              </button>
              <button
                className={`fm-btn fm-btn--sm ${traitFilter === 'all' ? 'fm-btn--primary' : ''}`}
                onClick={() => setTraitFilter('all')}
              >
                전체 보기
              </button>
            </div>

            {/* 긍정 특성 */}
            <div className="fm-mb-md">
              <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
                <span className="fm-text-sm fm-font-semibold fm-text-success">
                  긍정 특성
                </span>
                <span className="fm-badge fm-badge--success">
                  {positiveTraits.length}/{rules.positive.count}
                </span>
              </div>
              {renderTraitList(availablePositive, positiveTraits, handleTogglePositive, rules.positive.count)}
            </div>

            {/* 천재형: 랜덤 부정 특성 안내 */}
            {rules.negative.mode === 'random' && (
              <div className="fm-alert fm-alert--warning fm-mt-sm">
                <span className="fm-alert__icon">!</span>
                <span className="fm-alert__text">
                  천재형 신인은 게임 시작 시 <strong>랜덤 부정 특성 1개</strong>가 자동으로 부여됩니다.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 생성 버튼 */}
        {!isComplete && (
          <p className="fm-text-sm fm-text-warning fm-text-center">
            {!name.trim() ? '이름을 입력해주세요.' :
              `긍정 특성 ${rules.positive.count - positiveTraits.length}개를 더 선택하세요.`}
          </p>
        )}
        <button
          className="fm-btn fm-btn--primary fm-btn--lg"
          style={{ width: '100%' }}
          onClick={handleCreate}
          disabled={!isComplete}
        >
          선수 생성 →
        </button>
      </div>

      <div className="fm-text-center fm-mt-lg fm-mb-lg">
        <button className="fm-btn fm-btn--ghost" onClick={() => navigate('/mode-select')}>← 돌아가기</button>
      </div>
    </div>
  );
}
