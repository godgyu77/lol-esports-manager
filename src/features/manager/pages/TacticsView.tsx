/**
 * 전술 관리 페이지
 * - 초반/중반/후반 전략 선택
 * - 와드 우선도, 드래곤/바론 우선도, 공격성 레벨 슬라이더
 * - 현재 전술 보정 효과 미리보기
 */

import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import {
  getTeamTactics,
  setTeamTactics,
  initDefaultTactics,
  calculateTacticsBonus,
} from '../../../engine/tactics/tacticsEngine';
import type {
  TeamTactics,
  EarlyStrategy,
  MidStrategy,
  LateStrategy,
  WardPriority,
} from '../../../types/tactics';
import {
  EARLY_STRATEGY_LABELS,
  MID_STRATEGY_LABELS,
  LATE_STRATEGY_LABELS,
  WARD_PRIORITY_LABELS,
} from '../../../types/tactics';

const EARLY_STRATEGIES: EarlyStrategy[] = ['standard', 'lane_swap', 'invade', 'safe_farm'];
const MID_STRATEGIES: MidStrategy[] = ['balanced', 'pick_comp', 'split_push', 'objective_control'];
const LATE_STRATEGIES: LateStrategy[] = ['teamfight', 'split_push', 'siege', 'pick'];
const WARD_PRIORITIES: WardPriority[] = ['aggressive', 'balanced', 'defensive'];

export function TacticsView() {
  const save = useGameStore((s) => s.save);

  const [tactics, setTacticsState] = useState<TeamTactics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const userTeamId = save?.userTeamId ?? '';

  const loadData = useCallback(async () => {
    if (!save) return;
    setIsLoading(true);
    try {
      let data = await getTeamTactics(userTeamId);
      if (!data) {
        await initDefaultTactics(userTeamId);
        data = await getTeamTactics(userTeamId);
      }
      setTacticsState(data);
    } catch (err) {
      console.error('전술 데이터 로딩 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, [save, userTeamId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleChange = async <K extends keyof Omit<TeamTactics, 'teamId'>>(
    field: K,
    value: TeamTactics[K],
  ) => {
    if (!tactics) return;

    const updated: TeamTactics = { ...tactics, [field]: value };
    setTacticsState(updated);

    try {
      const { teamId: _, ...rest } = updated;
      await setTeamTactics(userTeamId, rest);
      setMessage({ text: '전술이 변경되었습니다.', type: 'success' });
    } catch (err) {
      console.error('전술 저장 실패:', err);
      setMessage({ text: '전술 저장에 실패했습니다.', type: 'error' });
    }
  };

  if (!save) return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  if (isLoading) return <p style={{ color: '#6a6a7a' }}>전술 정보를 불러오는 중...</p>;
  if (!tactics) return <p style={{ color: '#6a6a7a' }}>전술 데이터를 찾을 수 없습니다.</p>;

  const bonus = calculateTacticsBonus(tactics);

  return (
    <div>
      <h1 style={styles.title}>전술 관리</h1>

      {message && (
        <div style={{
          ...styles.message,
          borderColor: message.type === 'success' ? '#2ecc71' : '#e74c3c',
          color: message.type === 'success' ? '#2ecc71' : '#e74c3c',
        }}>
          {message.text}
        </div>
      )}

      {/* 전략 선택 섹션 */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>게임 페이즈별 전략</h2>

        <div style={styles.strategyGrid}>
          {/* 초반 전략 */}
          <div style={styles.strategyCard}>
            <label style={styles.label}>초반 전략</label>
            <p style={styles.hint}>라인전 ~ 1차 오브젝트</p>
            <select
              style={styles.select}
              value={tactics.earlyStrategy}
              onChange={e => handleChange('earlyStrategy', e.target.value as EarlyStrategy)}
            >
              {EARLY_STRATEGIES.map(s => (
                <option key={s} value={s}>{EARLY_STRATEGY_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* 중반 전략 */}
          <div style={styles.strategyCard}>
            <label style={styles.label}>중반 전략</label>
            <p style={styles.hint}>오브젝트 쟁탈 ~ 타워 압박</p>
            <select
              style={styles.select}
              value={tactics.midStrategy}
              onChange={e => handleChange('midStrategy', e.target.value as MidStrategy)}
            >
              {MID_STRATEGIES.map(s => (
                <option key={s} value={s}>{MID_STRATEGY_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* 후반 전략 */}
          <div style={styles.strategyCard}>
            <label style={styles.label}>후반 전략</label>
            <p style={styles.hint}>바론 이후 ~ 넥서스 공략</p>
            <select
              style={styles.select}
              value={tactics.lateStrategy}
              onChange={e => handleChange('lateStrategy', e.target.value as LateStrategy)}
            >
              {LATE_STRATEGIES.map(s => (
                <option key={s} value={s}>{LATE_STRATEGY_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* 와드 우선도 */}
          <div style={styles.strategyCard}>
            <label style={styles.label}>와드 운용</label>
            <p style={styles.hint}>시야 장악 성향</p>
            <select
              style={styles.select}
              value={tactics.wardPriority}
              onChange={e => handleChange('wardPriority', e.target.value as WardPriority)}
            >
              {WARD_PRIORITIES.map(w => (
                <option key={w} value={w}>{WARD_PRIORITY_LABELS[w]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 슬라이더 섹션 */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>세부 수치 조정</h2>

        <div style={styles.sliderGroup}>
          {/* 드래곤 우선도 */}
          <div style={styles.sliderRow}>
            <div style={styles.sliderLabelWrap}>
              <label style={styles.label}>드래곤 우선도</label>
              <span style={styles.sliderValue}>{tactics.dragonPriority}</span>
            </div>
            <div style={styles.sliderWrap}>
              <span style={styles.sliderEdge}>낮음</span>
              <input
                type="range"
                min={1}
                max={10}
                value={tactics.dragonPriority}
                onChange={e => handleChange('dragonPriority', Number(e.target.value))}
                style={styles.slider}
              />
              <span style={styles.sliderEdge}>높음</span>
            </div>
          </div>

          {/* 바론 우선도 */}
          <div style={styles.sliderRow}>
            <div style={styles.sliderLabelWrap}>
              <label style={styles.label}>바론 우선도</label>
              <span style={styles.sliderValue}>{tactics.baronPriority}</span>
            </div>
            <div style={styles.sliderWrap}>
              <span style={styles.sliderEdge}>낮음</span>
              <input
                type="range"
                min={1}
                max={10}
                value={tactics.baronPriority}
                onChange={e => handleChange('baronPriority', Number(e.target.value))}
                style={styles.slider}
              />
              <span style={styles.sliderEdge}>높음</span>
            </div>
          </div>

          {/* 공격성 레벨 */}
          <div style={styles.sliderRow}>
            <div style={styles.sliderLabelWrap}>
              <label style={styles.label}>공격성 레벨</label>
              <span style={styles.sliderValue}>{tactics.aggressionLevel}</span>
            </div>
            <div style={styles.sliderWrap}>
              <span style={styles.sliderEdge}>수비적</span>
              <input
                type="range"
                min={1}
                max={10}
                value={tactics.aggressionLevel}
                onChange={e => handleChange('aggressionLevel', Number(e.target.value))}
                style={styles.slider}
              />
              <span style={styles.sliderEdge}>공격적</span>
            </div>
          </div>
        </div>
      </div>

      {/* 전술 효과 미리보기 */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>전술 보정 효과</h2>
        <p style={styles.hint}>현재 전술 설정에 따른 경기 보정 수치입니다.</p>

        <div style={styles.bonusGrid}>
          <BonusCard label="초반 보정" value={bonus.earlyBonus} />
          <BonusCard label="중반 보정" value={bonus.midBonus} />
          <BonusCard label="후반 보정" value={bonus.lateBonus} />
          <BonusCard label="오브젝트 보정" value={bonus.objectiveBonus} />
        </div>

        <div style={styles.infoBox}>
          <h3 style={styles.infoTitle}>전술 효과 설명</h3>
          <div style={styles.infoGrid}>
            <div><strong style={{ color: '#4ecdc4' }}>초반 보정:</strong> 라인전 및 초반 교전 승률에 영향</div>
            <div><strong style={{ color: '#c89b3c' }}>중반 보정:</strong> 중반 운영 및 로밍 효율에 영향</div>
            <div><strong style={{ color: '#9b59b6' }}>후반 보정:</strong> 후반 한타 및 마무리 능력에 영향</div>
            <div><strong style={{ color: '#e67e22' }}>오브젝트 보정:</strong> 드래곤/바론 확보율에 영향</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BonusCard({ label, value }: { label: string; value: number }) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  const displayValue = isNeutral ? '0%' : `${isPositive ? '+' : ''}${(value * 100).toFixed(1)}%`;
  const color = isNeutral ? '#6a6a7a' : isPositive ? '#2ecc71' : '#e74c3c';

  return (
    <div style={styles.bonusCard}>
      <span style={styles.bonusLabel}>{label}</span>
      <span style={{ ...styles.bonusValue, color }}>{displayValue}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { fontSize: '24px', fontWeight: 700, color: '#f0e6d2', marginBottom: '16px' },
  message: {
    padding: '10px 16px', marginBottom: '12px', border: '1px solid',
    borderRadius: '6px', fontSize: '13px', background: 'rgba(255,255,255,0.02)',
  },
  section: {
    marginBottom: '28px',
  },
  sectionTitle: {
    fontSize: '16px', fontWeight: 600, color: '#c89b3c', marginBottom: '12px',
  },
  strategyGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '12px',
  },
  strategyCard: {
    padding: '16px', background: '#12122a', border: '1px solid #2a2a4a',
    borderRadius: '8px',
  },
  label: {
    fontSize: '14px', fontWeight: 600, color: '#e0e0e0', display: 'block', marginBottom: '4px',
  },
  hint: { fontSize: '12px', color: '#6a6a7a', marginBottom: '10px', marginTop: 0 },
  select: {
    width: '100%', padding: '8px 10px', background: '#0d0d1a', border: '1px solid #2a2a4a',
    borderRadius: '4px', color: '#e0e0e0', fontSize: '13px', cursor: 'pointer',
  },
  sliderGroup: {
    display: 'flex', flexDirection: 'column', gap: '20px',
  },
  sliderRow: {
    padding: '16px', background: '#12122a', border: '1px solid #2a2a4a',
    borderRadius: '8px',
  },
  sliderLabelWrap: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px',
  },
  sliderValue: {
    fontSize: '18px', fontWeight: 700, color: '#c89b3c', minWidth: '30px', textAlign: 'right' as const,
  },
  sliderWrap: {
    display: 'flex', alignItems: 'center', gap: '10px',
  },
  sliderEdge: {
    fontSize: '11px', color: '#6a6a7a', minWidth: '40px',
  },
  slider: {
    flex: 1, height: '6px', cursor: 'pointer', accentColor: '#c89b3c',
  },
  bonusGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '12px', marginBottom: '16px',
  },
  bonusCard: {
    padding: '16px', background: '#12122a', border: '1px solid #2a2a4a',
    borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
  },
  bonusLabel: {
    fontSize: '12px', color: '#8a8a9a', fontWeight: 500,
  },
  bonusValue: {
    fontSize: '20px', fontWeight: 700,
  },
  infoBox: {
    marginTop: '12px', padding: '16px', background: '#12122a',
    border: '1px solid #2a2a4a', borderRadius: '8px',
  },
  infoTitle: { fontSize: '14px', fontWeight: 600, color: '#c89b3c', marginBottom: '10px' },
  infoGrid: { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#8a8a9a' },
};
