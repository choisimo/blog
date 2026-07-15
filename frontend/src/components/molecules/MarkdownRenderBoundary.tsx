import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const UNSAFE_CONTROL_PATTERN =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;

interface MarkdownRenderBoundaryProps {
  children: ReactNode;
  source: string;
  variant: 'article' | 'chat';
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface MarkdownRenderBoundaryState {
  hasError: boolean;
}

function normalizeFallbackSource(source: string): string {
  return source
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(UNSAFE_CONTROL_PATTERN, '');
}

export class MarkdownRenderBoundary extends Component<
  MarkdownRenderBoundaryProps,
  MarkdownRenderBoundaryState
> {
  override state: MarkdownRenderBoundaryState = { hasError: false };

  static getDerivedStateFromError(): MarkdownRenderBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  override componentDidUpdate(previousProps: MarkdownRenderBoundaryProps) {
    if (
      this.state.hasError &&
      previousProps.source !== this.props.source
    ) {
      this.setState({ hasError: false });
    }
  }

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const fallbackSource = normalizeFallbackSource(this.props.source);
    const isArticle = this.props.variant === 'article';

    return (
      <div
        role='document'
        aria-label='Markdown source'
        data-markdown-fallback={this.props.variant}
        className={cn(
          'not-prose border border-border/70 bg-gradient-to-br from-muted/55 via-background to-muted/25 shadow-sm',
          isArticle
            ? 'article-readable article-markdown-fallback my-8 rounded-2xl px-5 py-5 sm:px-7 sm:py-6'
            : 'chat-markdown-fallback my-2 rounded-xl px-3.5 py-3'
        )}
      >
        <pre
          className={cn(
            'm-0 whitespace-pre-wrap break-words font-sans text-foreground/90 [overflow-wrap:anywhere]',
            isArticle
              ? 'text-[0.98rem] leading-8'
              : 'text-[13px] leading-relaxed'
          )}
        >
          {fallbackSource}
        </pre>
      </div>
    );
  }
}

export default MarkdownRenderBoundary;
