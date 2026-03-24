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

      return (
        <div className={`fm-flex fm-justify-center fm-items-center ${inline ? '' : 'fm-error-fullscreen'}`}
          style={inline ? { minHeight: 300 } : { minHeight: '100vh', background: 'var(--bg-primary)' }}
        >
          <div className="fm-panel" style={{ maxWidth: 480, textAlign: 'center' }}>
            <div className="fm-panel__body" style={{ padding: 40 }}>
              <h2 className="fm-text-xl fm-font-bold fm-text-accent fm-mb-md">
                {inline ? '이 페이지에서 오류가 발생했습니다' : '오류가 발생했습니다'}
              </h2>
              <p className="fm-text-md fm-text-secondary fm-mb-lg" style={{ lineHeight: 1.5, wordBreak: 'break-word' }}>
                {this.state.error?.message ?? '알 수 없는 오류'}
              </p>
              <div className="fm-flex fm-justify-center fm-gap-md fm-flex-wrap">
                <button className="fm-btn fm-btn--primary" onClick={this.handleRetry}>
                  다시 시도
                </button>
                {navigateTo && (
                  <button className="fm-btn" onClick={this.handleNavigate}>
                    {navigateLabel ?? '대시보드로 돌아가기'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
