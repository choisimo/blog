import { useMemo, type ComponentProps, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import MarkdownRenderBoundary from '@/components/molecules/MarkdownRenderBoundary';
import { MarkdownTable } from '@/components/molecules/MarkdownTable';
import {
  getMarkdownLinkPresentation,
  normalizeMarkdownAccessibleText,
  normalizeMarkdownSource,
} from '@/lib/markdown/markdownPolicy';
import { cn } from '@/lib/utils';

const COMMENT_ALLOWED_ELEMENTS = [
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'ol',
  'p',
  'pre',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
] as const;

interface CommentMarkdownProps {
  content: string;
  isTerminal?: boolean;
  isStreaming?: boolean;
  className?: string;
  label?: string;
  title?: string;
}

function CommentHeading({ children }: { children?: ReactNode }) {
  return <strong className='block font-semibold'>{children}</strong>;
}

export function CommentMarkdown({
  content,
  isTerminal = false,
  isStreaming = false,
  className,
  label,
  title,
}: CommentMarkdownProps) {
  const source = normalizeMarkdownSource(content);
  const safeLabel = normalizeMarkdownAccessibleText(label);
  const safeTitle = normalizeMarkdownAccessibleText(title);

  const components = useMemo<Components>(
    () => ({
      h1: CommentHeading,
      h2: CommentHeading,
      h3: CommentHeading,
      h4: CommentHeading,
      h5: CommentHeading,
      h6: CommentHeading,
      p: ({ children }) =>
        isTerminal ? (
          <span className='inline'>{children}</span>
        ) : (
          <p className='my-2 first:mt-0 last:mb-0'>{children}</p>
        ),
      ul: ({ children }) => (
        <ul className='my-2 list-disc space-y-1 pl-5'>{children}</ul>
      ),
      ol: ({ children }) => (
        <ol className='my-2 list-decimal space-y-1 pl-5'>{children}</ol>
      ),
      blockquote: ({ children }) => (
        <blockquote className='my-2 border-l-2 border-primary/30 pl-3 text-foreground/80'>
          {children}
        </blockquote>
      ),
      code({
        inline,
        className: codeClassName,
        children,
        ...props
      }: ComponentProps<'code'> & { inline?: boolean }) {
        return (
          <code
            className={cn(
              'rounded bg-muted px-1.5 py-0.5 font-mono text-[0.92em]',
              !inline &&
                'my-2 block max-h-80 overflow-auto whitespace-pre p-3 [tab-size:2]',
              isTerminal && 'bg-[hsl(var(--terminal-code-bg))] text-primary',
              codeClassName,
            )}
            {...props}
          >
            {children}
          </code>
        );
      },
      a: ({ href, children }) => {
        const link = getMarkdownLinkPresentation(href, 'comment');
        if (!link.href || !link.interactive) return <span>{children}</span>;

        return (
          <a
            href={link.href}
            target={link.target}
            rel={link.rel}
            className='break-all text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid'
          >
            {children}
          </a>
        );
      },
      img: () => null,
      table: ({ children }) => (
        <MarkdownTable variant='chat' isTerminal={isTerminal}>
          {children}
        </MarkdownTable>
      ),
      th: ({ children }) => (
        <th className='whitespace-nowrap border-b border-border/60 px-3 py-2 text-left text-xs font-semibold'>
          {children}
        </th>
      ),
      td: ({ children }) => (
        <td className='px-3 py-2 align-top text-[13px]'>{children}</td>
      ),
    }),
    [isTerminal],
  );

  if (!source.trim()) return null;

  return (
    <div
      className={cn(
        'comment-markdown max-w-none break-words [overflow-wrap:anywhere]',
        isTerminal && 'font-mono',
        className,
      )}
      data-markdown-profile='comment'
      data-preserve-reading-position='true'
      aria-busy={isStreaming || undefined}
      aria-label={safeLabel}
      title={safeTitle}
    >
      <MarkdownRenderBoundary source={source} variant='chat'>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          unwrapDisallowed
          allowedElements={[...COMMENT_ALLOWED_ELEMENTS]}
          components={components}
        >
          {source}
        </ReactMarkdown>
      </MarkdownRenderBoundary>
    </div>
  );
}

export default CommentMarkdown;
