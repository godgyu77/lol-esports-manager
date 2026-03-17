export function SchedulePlaceholder() {
  return (
    <div>
      <h1 style={styles.title}>일정</h1>
      <p style={styles.placeholder}>일정 기능은 준비 중입니다.</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '16px',
  },
  placeholder: {
    color: '#6a6a7a',
  },
};
