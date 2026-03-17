import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** 페이지 단위 ErrorBoundary일 때 true로 설정 (전체 화면 대신 인라인 표시) */
  inline?: boolean;
  /** 이동할 경로 (기본: 새로고침) */
  navigateTo?: string;
  /** 이동 버튼 텍스트 (기본: '다시 시도') */
  navigateLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleNavigate = () => {
    if (this.props.navigateTo) {
      window.location.href = this.props.navigateTo;
    } else {
      this.setState({ hasError: false, error: null });
    }
  };

  render() {
    if (this.state.hasError) {
      const { inline, navigateTo, navigateLabel } = this.props;
      const containerStyle = inline ? styles.inlineContainer : styles.container;

      return (
        <div style={containerStyle}>
          <div style={styles.card}>
            <h2 style={styles.title}>
              {inline ? '이 페이지에서 오류가 발생했습니다' : '오류가 발생했습니다'}
            </h2>
            <p style={styles.message}>
              {this.state.error?.message ?? '알 수 없는 오류'}
            </p>
            <div style={styles.btnRow}>
              <button style={styles.retryBtn} onClick={this.handleRetry}>
                다시 시도
              </button>
              {navigateTo && (
                <button style={styles.navBtn} onClick={this.handleNavigate}>
                  {navigateLabel ?? '대시보드로 돌아가기'}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: '#0d0d1a',
    color: '#e0e0e0',
  },
  inlineContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '300px',
    color: '#e0e0e0',
  },
  card: {
    background: '#12122a',
    border: '1px solid #3a3a5c',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center' as const,
    maxWidth: '480px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#c89b3c',
    marginBottom: '12px',
  },
  message: {
    fontSize: '14px',
    color: '#8a8a9a',
    marginBottom: '24px',
    lineHeight: '1.5',
    wordBreak: 'break-word' as const,
  },
  btnRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    flexWrap: 'wrap' as const,
  },
  retryBtn: {
    padding: '10px 24px',
    border: '1px solid #c89b3c',
    borderRadius: '6px',
    background: 'rgba(200,155,60,0.1)',
    color: '#c89b3c',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
  },
  navBtn: {
    padding: '10px 24px',
    border: '1px solid #3a3a5c',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.05)',
    color: '#8a8a9a',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
  },
};
