// Error boundary component for catching rendering errors
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Tile, Button } from '@carbon/react';
import { Warning } from '@carbon/icons-react';
import './ErrorBoundary.scss';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <div className="error-boundary">
          <Tile className="error-boundary__tile">
            <Warning size={48} className="error-boundary__icon" />
            <h3 className="error-boundary__title">Something went wrong</h3>
            <p className="error-boundary__message">
              {error?.message || 'An unexpected error occurred'}
            </p>
            <div className="error-boundary__actions">
              <Button kind="primary" onClick={this.handleReset}>
                Try Again
              </Button>
              <Button kind="secondary" onClick={() => window.location.reload()}>
                Reload Page
              </Button>
            </div>
          </Tile>
        </div>
      );
    }

    return children;
  }
}
