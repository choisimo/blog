import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import ErrorStatusPage from "@/pages/public/errors/ErrorStatusPage";
import { serverErrorPage } from "@/pages/public/errors/presets";

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
  override state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
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
    window.location.assign("/");
    this.handleReset();
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorStatusPage
          {...serverErrorPage}
          actions={[
            {
              label: "다시 시도",
              onClick: this.handleReset,
              icon: RefreshCw,
            },
            {
              label: "홈으로",
              onClick: this.handleGoHome,
              icon: Home,
              variant: "outline",
            },
          ]}
          footer={
            import.meta.env.DEV && this.state.error ? (
              <details className="w-full text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground">
                  개발자 정보 보기
                </summary>
                <div className="mt-4 rounded-2xl bg-muted/50 p-4 overflow-auto">
                  <p className="mb-2 font-mono text-sm text-destructive">
                    {this.state.error.name}: {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <pre className="font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                      {this.state.error.stack}
                    </pre>
                  )}
                </div>
              </details>
            ) : null
          }
        />
      );
    }

    return this.props.children;
  }
}

export class PageErrorBoundary extends ErrorBoundary {
  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <AlertTriangle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-medium mb-2">
            콘텐츠를 불러올 수 없습니다
          </h3>
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
