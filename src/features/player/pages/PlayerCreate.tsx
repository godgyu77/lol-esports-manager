import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Position } from '../../../types';
import type { PlayerBackground } from '../../../types/player';
import { useGameStore } from '../../../stores/gameStore';

export function PlayerCreate() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position>('mid');
  const [background, setBackground] = useState<PlayerBackground>('solorank');

  const positions: { value: Position; label: string }[] = [
    { value: 'top', label: '탑' },
    { value: 'jungle', label: '정글' },
    { value: 'mid', label: '미드' },
    { value: 'adc', label: '원딜' },
    { value: 'support', label: '서포터' },
  ];

  const backgrounds: { value: PlayerBackground; label: string; desc: string }[] = [
    {
      value: 'solorank',
      label: '솔로랭크 출신',
      desc: '높은 기본기, 낮은 팀워크',
    },
    {
      value: 'academy',
      label: '아카데미 출신',
      desc: '균형잡힌 스탯',
    },
    {
      value: 'overseas',
      label: '해외 귀국',
      desc: '높은 명성, 적응 필요',
    },
  ];

  const setPendingPlayer = useGameStore((s) => s.setPendingPlayer);

  const handleCreate = () => {
    if (!name.trim()) return;
    setPendingPlayer({ name: name.trim(), position, background });
    navigate('/team-select');
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>나만의 선수 만들기</h1>

      <div style={styles.form}>
        <div style={styles.field}>
          <label style={styles.label}>선수 이름</label>
          <input
            style={styles.input}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="닉네임을 입력하세요"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>포지션</label>
          <div style={styles.options}>
            {positions.map((p) => (
              <button
                key={p.value}
                style={{
                  ...styles.option,
                  ...(position === p.value ? styles.optionActive : {}),
                }}
                onClick={() => setPosition(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>출신 배경</label>
          <div style={styles.bgOptions}>
            {backgrounds.map((b) => (
              <button
                key={b.value}
                style={{
                  ...styles.bgOption,
                  ...(background === b.value ? styles.bgOptionActive : {}),
                }}
                onClick={() => setBackground(b.value)}
              >
                <strong>{b.label}</strong>
                <span style={styles.bgDesc}>{b.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          style={{
            ...styles.createBtn,
            ...(name.trim() ? {} : { opacity: 0.4, cursor: 'not-allowed' }),
          }}
          onClick={handleCreate}
          disabled={!name.trim()}
        >
          선수 생성 →
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
    width: '400px',
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
  options: {
    display: 'flex',
    gap: '8px',
  },
  option: {
    flex: 1,
    padding: '10px',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.03)',
    color: '#8a8a9a',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  optionActive: {
    borderColor: '#c89b3c',
    color: '#c89b3c',
    background: 'rgba(200,155,60,0.1)',
  },
  bgOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  bgOption: {
    padding: '12px 16px',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.03)',
    color: '#e0e0e0',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    transition: 'all 0.2s',
  },
  bgOptionActive: {
    borderColor: '#c89b3c',
    background: 'rgba(200,155,60,0.1)',
  },
  bgDesc: {
    fontSize: '12px',
    color: '#6a6a7a',
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
