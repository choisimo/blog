import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    if (import.meta.env.PROD) {
      void 0;
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleGoHome = () => {
    window.location.hash = '/';
    this.handleReset();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full" />
            <AlertTriangle className="relative h-16 w-16 text-amber-500" />
          </div>
          
          <h2 className="text-2xl font-semibold mb-3 text-foreground">
            문제가 발생했습니다
          </h2>
          
          <p className="text-muted-foreground mb-2 max-w-md leading-relaxed">
            페이지를 불러오는 중 예상치 못한 오류가 발생했습니다.
          </p>
          <p className="text-muted-foreground mb-8 max-w-md text-sm">
            문제가 지속되면 잠시 후 다시 시도해주세요.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <Button onClick={this.handleReset} variant="default">
              <RefreshCw className="h-4 w-4 mr-2" />
              다시 시도
            </Button>
            <Button onClick={this.handleGoHome} variant="outline">
              <Home className="h-4 w-4 mr-2" />
              홈으로
            </Button>
          </div>

          {import.meta.env.DEV && this.state.error && (
            <details className="mt-8 text-left w-full max-w-2xl">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                개발자 정보 보기
              </summary>
              <div className="mt-4 p-4 bg-muted/50 rounded-lg overflow-auto">
                <p className="font-mono text-sm text-destructive mb-2">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                {this.state.error.stack && (
                  <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export class PageErrorBoundary extends ErrorBoundary {
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <AlertTriangle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-medium mb-2">콘텐츠를 불러올 수 없습니다</h3>
          <p className="text-sm text-muted-foreground mb-4">
            일시적인 문제가 발생했습니다.
          </p>
          <Button size="sm" variant="outline" onClick={this.handleReset}>
            <RefreshCw className="h-3 w-3 mr-2" />
            다시 시도
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
