import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import type { Difficulty, Theme } from '../../stores/settingsStore';
import { checkOllamaStatus } from '../../ai/provider';

const SPEED_OPTIONS = [1, 2, 4];
const AUTO_SAVE_OPTIONS: { value: 'daily' | 'weekly' | 'manual'; label: string }[] = [
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'manual', label: '수동' },
];
const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; desc: string }[] = [
  { value: 'easy', label: '쉬움', desc: 'AI 이적 약화, 승률 보정, 예산 130%' },
  { value: 'normal', label: '보통', desc: '기본 밸런스' },
  { value: 'hard', label: '어려움', desc: 'AI 이적 강화, 승률 불리, 예산 80%' },
];

export function SettingsView() {
  const navigate = useNavigate();
  const defaultSpeed = useSettingsStore((s) => s.defaultSpeed);
  const aiEnabled = useSettingsStore((s) => s.aiEnabled);
  const autoSaveInterval = useSettingsStore((s) => s.autoSaveInterval);
  const difficulty = useSettingsStore((s) => s.difficulty);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const soundVolume = useSettingsStore((s) => s.soundVolume);
  const theme = useSettingsStore((s) => s.theme);
  const setDefaultSpeed = useSettingsStore((s) => s.setDefaultSpeed);
  const setAiEnabled = useSettingsStore((s) => s.setAiEnabled);
  const setAutoSaveInterval = useSettingsStore((s) => s.setAutoSaveInterval);
  const setDifficulty = useSettingsStore((s) => s.setDifficulty);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);
  const setSoundVolume = useSettingsStore((s) => s.setSoundVolume);
  const setTheme = useSettingsStore((s) => s.setTheme);

  const [ollamaStatus, setOllamaStatus] = useState<boolean | null>(null);

  useEffect(() => {
    checkOllamaStatus().then(setOllamaStatus);
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate('/')}>
          ← 메인 메뉴
        </button>
        <h1 style={styles.title}>설정</h1>
      </div>

      {/* 경기 속도 기본값 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>경기 속도 기본값</h2>
        <p style={styles.cardDesc}>라이브 경기 시작 시 기본 재생 속도를 설정합니다.</p>
        <div style={styles.optionRow}>
          {SPEED_OPTIONS.map((speed) => (
            <button
              key={speed}
              style={{
                ...styles.optionBtn,
                ...(defaultSpeed === speed ? styles.optionBtnActive : {}),
              }}
              onClick={() => setDefaultSpeed(speed)}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* 난이도 설정 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>난이도 설정</h2>
        <p style={styles.cardDesc}>게임 전반의 난이도를 설정합니다. 진행 중인 세이브에도 즉시 적용됩니다.</p>
        <div style={styles.optionRow}>
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              style={{
                ...styles.difficultyBtn,
                ...(difficulty === opt.value ? styles.optionBtnActive : {}),
              }}
              onClick={() => setDifficulty(opt.value)}
            >
              <span style={styles.difficultyLabel}>{opt.label}</span>
              <span style={styles.difficultyDesc}>{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* AI 사용 설정 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>AI 사용 설정</h2>
        <div style={styles.aiStatusRow}>
          <span style={styles.cardDesc}>Ollama 연결 상태</span>
          <span style={styles.aiStatusBadge}>
            <span
              style={{
                ...styles.statusDot,
                background: ollamaStatus ? '#4caf50' : '#f44336',
                boxShadow: ollamaStatus ? '0 0 6px #4caf50' : 'none',
              }}
            />
            {ollamaStatus === null
              ? '확인 중...'
              : ollamaStatus
                ? '연결됨'
                : '오프라인'}
          </span>
        </div>
        <div style={styles.toggleRow}>
          <span style={styles.toggleLabel}>AI 기능 사용</span>
          <button
            style={{
              ...styles.toggleBtn,
              background: aiEnabled ? '#c89b3c' : 'rgba(255,255,255,0.1)',
            }}
            onClick={() => setAiEnabled(!aiEnabled)}
          >
            <span
              style={{
                ...styles.toggleKnob,
                transform: aiEnabled ? 'translateX(20px)' : 'translateX(0)',
              }}
            />
          </button>
        </div>
        {!aiEnabled && (
          <p style={styles.warningText}>
            AI가 비활성화되면 템플릿 기반 모드로 동작합니다.
          </p>
        )}
      </div>

      {/* 사운드 설정 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>사운드 설정</h2>
        <p style={styles.cardDesc}>효과음 및 볼륨을 설정합니다. (현재 오디오 파일 미포함)</p>
        <div style={styles.toggleRow}>
          <span style={styles.toggleLabel}>효과음</span>
          <button
            style={{
              ...styles.toggleBtn,
              background: soundEnabled ? '#c89b3c' : 'rgba(255,255,255,0.1)',
            }}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            <span
              style={{
                ...styles.toggleKnob,
                transform: soundEnabled ? 'translateX(20px)' : 'translateX(0)',
              }}
            />
          </button>
        </div>
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', color: '#e0e0e0' }}>볼륨</span>
            <span style={{ fontSize: '13px', color: '#8a8a9a' }}>{Math.round(soundVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(soundVolume * 100)}
            onChange={(e) => setSoundVolume(Number(e.target.value) / 100)}
            disabled={!soundEnabled}
            style={{
              width: '100%',
              accentColor: '#c89b3c',
              opacity: soundEnabled ? 1 : 0.4,
            }}
            aria-label="볼륨 조절"
          />
        </div>
      </div>

      {/* 테마 설정 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>테마 설정</h2>
        <p style={styles.cardDesc}>화면 테마를 변경합니다.</p>
        <div style={styles.optionRow}>
          {([
            { value: 'dark' as Theme, label: '다크' },
            { value: 'light' as Theme, label: '라이트' },
          ]).map((opt) => (
            <button
              key={opt.value}
              style={{
                ...styles.optionBtn,
                ...(theme === opt.value ? styles.optionBtnActive : {}),
              }}
              onClick={() => setTheme(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 자동 저장 간격 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>자동 저장 간격</h2>
        <p style={styles.cardDesc}>게임 내 자동 저장 주기를 설정합니다.</p>
        <div style={styles.optionRow}>
          {AUTO_SAVE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              style={{
                ...styles.optionBtn,
                ...(autoSaveInterval === opt.value ? styles.optionBtnActive : {}),
              }}
              onClick={() => setAutoSaveInterval(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 게임 정보 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>게임 정보</h2>
        <div style={styles.infoList}>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>버전</span>
            <span style={styles.infoValue}>0.0.0 (개발 중)</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>프론트엔드</span>
            <span style={styles.infoValue}>React 19 + TypeScript 5.9 + Vite 8</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>백엔드</span>
            <span style={styles.infoValue}>Tauri 2 (Rust)</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>AI 엔진</span>
            <span style={styles.infoValue}>Ollama (로컬 LLM)</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>DB</span>
            <span style={styles.infoValue}>SQLite</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 50%, #0a0a1a 100%)',
    color: '#e0e0e0',
    padding: '40px',
    maxWidth: '640px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '32px',
  },
  backBtn: {
    padding: '8px 16px',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.05)',
    color: '#e0e0e0',
    fontSize: '14px',
    cursor: 'pointer',
  },
  title: {
    fontSize: '28px',
    fontWeight: 800,
    background: 'linear-gradient(90deg, #c89b3c, #f0e6d2)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a2a4a',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '16px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#c89b3c',
    marginBottom: '8px',
  },
  cardDesc: {
    fontSize: '13px',
    color: '#6a6a7a',
    marginBottom: '12px',
  },
  optionRow: {
    display: 'flex',
    gap: '8px',
  },
  optionBtn: {
    padding: '10px 20px',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.05)',
    color: '#e0e0e0',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  optionBtnActive: {
    background: 'rgba(200,155,60,0.2)',
    borderColor: '#c89b3c',
    color: '#c89b3c',
    fontWeight: 700,
  },
  aiStatusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  aiStatusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#8a8a9a',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: '14px',
    color: '#e0e0e0',
  },
  toggleBtn: {
    position: 'relative' as const,
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.2s',
  },
  toggleKnob: {
    position: 'absolute' as const,
    top: '2px',
    left: '2px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: '#fff',
    transition: 'transform 0.2s',
  },
  warningText: {
    fontSize: '12px',
    color: '#c89b3c',
    marginTop: '8px',
  },
  infoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  infoItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  infoLabel: {
    fontSize: '13px',
    color: '#6a6a7a',
  },
  infoValue: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#e0e0e0',
  },
  difficultyBtn: {
    flex: 1,
    padding: '12px 10px',
    border: '1px solid #3a3a5c',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.05)',
    color: '#e0e0e0',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  difficultyLabel: {
    fontSize: '14px',
    fontWeight: 700,
  },
  difficultyDesc: {
    fontSize: '11px',
    color: '#6a6a7a',
    textAlign: 'center' as const,
  },
};
