import { Component, ReactNode, type ErrorInfo } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import ErrorStatusPage from "@/pages/public/errors/ErrorStatusPage";
import { serverErrorPage } from "@/pages/public/errors/presets";

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;
const STACK_CONTROL_TEXT_PATTERN =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const MAX_ERROR_DETAIL_LENGTH = 4000;
const DEFAULT_RETRY_LABEL = "다시 시도";
const DEFAULT_HOME_LABEL = "홈으로";
const DEFAULT_DEVELOPER_DETAILS_LABEL = "개발자 정보 보기";
const DEFAULT_PAGE_ERROR_TITLE = "콘텐츠를 불러올 수 없습니다";
const DEFAULT_PAGE_ERROR_DESCRIPTION = "일시적인 문제가 발생했습니다.";

function sanitizeErrorSummaryText(value: unknown, fallback: string): string {
  const sanitized = String(value ?? "")
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(CONTROL_TEXT_PATTERN, "")
    .trim();
  return sanitized || fallback;
}

function sanitizeErrorStack(value: unknown): string {
  return String(value ?? "")
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(STACK_CONTROL_TEXT_PATTERN, "")
    .trim()
    .slice(0, MAX_ERROR_DETAIL_LENGTH);
}

function getSafeErrorDetails(error: Error): { summary: string; stack: string } {
  const name = sanitizeErrorSummaryText(error.name, "Error");
  const message = sanitizeErrorSummaryText(error.message, "Unknown error");

  return {
    summary: `${name}: ${message}`,
    stack: sanitizeErrorStack(error.stack),
  };
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  retryLabel?: string;
  homeLabel?: string;
  developerDetailsLabel?: string;
  pageErrorTitle?: string;
  pageErrorDescription?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
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

      const safeErrorDetails = this.state.error
        ? getSafeErrorDetails(this.state.error)
        : null;
      const retryLabel = sanitizeErrorSummaryText(
        this.props.retryLabel,
        DEFAULT_RETRY_LABEL
      );
      const homeLabel = sanitizeErrorSummaryText(
        this.props.homeLabel,
        DEFAULT_HOME_LABEL
      );
      const developerDetailsLabel = sanitizeErrorSummaryText(
        this.props.developerDetailsLabel,
        DEFAULT_DEVELOPER_DETAILS_LABEL
      );

      return (
        <ErrorStatusPage
          {...serverErrorPage}
          actions={[
            {
              label: retryLabel,
              onClick: this.handleReset,
              icon: RefreshCw,
            },
            {
              label: homeLabel,
              onClick: this.handleGoHome,
              icon: Home,
              variant: "outline",
            },
          ]}
          footer={
            import.meta.env.DEV && safeErrorDetails ? (
              <details className="w-full text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground">
                  {developerDetailsLabel}
                </summary>
                <div className="mt-4 rounded-2xl bg-muted/50 p-4 overflow-auto">
                  <p className="mb-2 font-mono text-sm text-destructive">
                    {safeErrorDetails.summary}
                  </p>
                  {safeErrorDetails.stack && (
                    <pre className="font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                      {safeErrorDetails.stack}
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
      const retryLabel = sanitizeErrorSummaryText(
        this.props.retryLabel,
        DEFAULT_RETRY_LABEL
      );
      const pageErrorTitle = sanitizeErrorSummaryText(
        this.props.pageErrorTitle,
        DEFAULT_PAGE_ERROR_TITLE
      );
      const pageErrorDescription = sanitizeErrorSummaryText(
        this.props.pageErrorDescription,
        DEFAULT_PAGE_ERROR_DESCRIPTION
      );

      return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <AlertTriangle className="h-10 w-10 text-amber-500 mb-4" aria-hidden="true" />
          <h3 className="text-lg font-medium mb-2">
            {pageErrorTitle}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {pageErrorDescription}
          </p>
          <Button size="sm" variant="outline" onClick={this.handleReset}>
            <RefreshCw className="h-3 w-3 mr-2" aria-hidden="true" />
            {retryLabel}
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
