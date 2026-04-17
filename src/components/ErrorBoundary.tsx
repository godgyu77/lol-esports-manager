import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { t } from '../i18n';
import { captureException } from '../monitoring';

interface Props {
  children: ReactNode;
  inline?: boolean;
  navigateTo?: string;
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
    captureException(error, {
      boundary: this.props.inline ? 'inline' : 'fullscreen',
      componentStack: errorInfo.componentStack ? 'present' : 'missing',
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleNavigate = () => {
    if (this.props.navigateTo) {
      window.location.href = this.props.navigateTo;
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { inline, navigateTo, navigateLabel } = this.props;

      return (
        <div
          className={`fm-flex fm-justify-center fm-items-center ${inline ? '' : 'fm-error-fullscreen'}`}
          style={inline ? { minHeight: 300 } : { minHeight: '100vh', background: 'var(--bg-primary)' }}
        >
          <div className="fm-panel" style={{ maxWidth: 480, textAlign: 'center' }}>
            <div className="fm-panel__body" style={{ padding: 40 }}>
              <h2 className="fm-text-xl fm-font-bold fm-text-accent fm-mb-md">
                {inline ? t('errorBoundary.title.inline') : t('errorBoundary.title.fullscreen')}
              </h2>
              <p className="fm-text-md fm-text-secondary fm-mb-lg" style={{ lineHeight: 1.5, wordBreak: 'break-word' }}>
                {this.state.error?.message ?? t('errorBoundary.defaultMessage')}
              </p>
              <div className="fm-flex fm-justify-center fm-gap-md fm-flex-wrap">
                <button className="fm-btn fm-btn--primary" onClick={this.handleRetry}>
                  {t('errorBoundary.retry')}
                </button>
                {navigateTo && (
                  <button className="fm-btn" onClick={this.handleNavigate}>
                    {navigateLabel ?? t('errorBoundary.defaultNavigate')}
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
