import React, { useCallback, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

// Terminal-style syntax highlighting theme for chat
const terminalChatTheme: { [key: string]: React.CSSProperties } = {
  ...oneDark,
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    color: '#c6f7d4',
    background: 'transparent',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: 'hsl(200 50% 3%)',
  },
  comment: { color: '#4e5953' },
  keyword: { color: '#3cff96' },
  string: { color: '#3cb8ff' },
  function: { color: '#3cff96' },
  number: { color: '#ffb02e' },
};

interface ChatMarkdownProps {
  content: string;
}

type CodeComponentProps = React.ComponentPropsWithoutRef<'code'> & {
  inline?: boolean;
  className?: string;
};

const ChatMarkdown: React.FC<ChatMarkdownProps> = ({ content }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { isTerminal } = useTheme();

  const handleCopy = useCallback((code: string) => {
    if (!navigator?.clipboard) return;
    void navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopiedCode(code);
        window.setTimeout(() => setCopiedCode(null), 2000);
      })
      .catch(() => {});
  }, []);

  const components = useMemo<Components>(() => ({
    h1: ({ children }) => (
      <h3 className={cn('mt-4 mb-2 text-base font-semibold', isTerminal && 'font-mono text-primary')}>{children}</h3>
    ),
    h2: ({ children }) => (
      <h4 className={cn('mt-3 mb-1.5 text-sm font-semibold', isTerminal && 'font-mono text-primary')}>{children}</h4>
    ),
    h3: ({ children }) => (
      <h5 className={cn('mt-2 mb-1 text-sm font-semibold', isTerminal && 'font-mono')}>{children}</h5>
    ),
    h4: ({ children }) => (
      <h6 className={cn('mt-2 mb-1 text-[13px] font-semibold', isTerminal && 'font-mono')}>{children}</h6>
    ),
    h5: ({ children }) => (
      <h6 className={cn('mt-2 mb-1 text-[13px] font-medium', isTerminal && 'font-mono')}>{children}</h6>
    ),
    h6: ({ children }) => (
      <strong className={cn('text-[13px] font-semibold', isTerminal && 'font-mono')}>{children}</strong>
    ),
    p: ({ children }) => (
      <p className='text-[13px] leading-relaxed'>{children}</p>
    ),
    ul: ({ children }) => (
      <ul className={cn('pl-4 text-[13px] leading-relaxed list-disc space-y-1', isTerminal && 'list-none')}>
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className={cn('pl-4 text-[13px] leading-relaxed list-decimal space-y-1', isTerminal && 'font-mono')}>
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className={cn('leading-relaxed', isTerminal && 'before:content-["-_"] before:text-primary')}>{children}</li>
    ),
    blockquote: ({ children }) => (
      <blockquote className={cn(
        'rounded-md border-l-4 border-primary/40 bg-muted/40 pl-3 py-1 text-[13px] italic',
        isTerminal && 'bg-[hsl(var(--terminal-code-bg))] border-primary/60 not-italic font-mono'
      )}>
        {children}
      </blockquote>
    ),
    code({ inline, className, children, ...props }: CodeComponentProps) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');

      if (!inline && match) {
        return (
          <div className={cn(
            'relative my-3 overflow-hidden rounded-lg bg-[#0b1020] dark:bg-[#050a1a]',
            isTerminal && 'bg-[hsl(var(--terminal-code-bg))] border border-border'
          )}>
            <button
              type='button'
              className={cn(
                'absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:bg-white/10',
                isTerminal && 'bg-primary/20 text-primary hover:bg-primary/30 font-mono'
              )}
              onClick={() => handleCopy(codeString)}
            >
              {copiedCode === codeString ? 'Copied' : 'Copy'}
            </button>
            <SyntaxHighlighter
              style={isTerminal ? terminalChatTheme : oneDark}
              language={match[1]}
              PreTag='div'
              className='!bg-transparent !p-4 text-[12px]'
            >
              {codeString}
            </SyntaxHighlighter>
          </div>
        );
      }

      return (
        <code
          className={cn(
            'rounded bg-muted px-1.5 py-0.5 text-[12px] font-mono',
            isTerminal && 'bg-[hsl(var(--terminal-code-bg))] text-primary'
          )}
          {...props}
        >
          {children}
        </code>
      );
    },
    a: ({ children, href }) => (
      <a
        href={href}
        target='_blank'
        rel='noopener noreferrer'
        className={cn(
          'text-primary underline decoration-dotted underline-offset-2 hover:text-primary/80',
          isTerminal && 'hover:decoration-solid'
        )}
      >
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className={cn('my-3 overflow-x-auto rounded-lg border border-border/60', isTerminal && 'border-border')}>
        <table className={cn('w-full text-left text-sm', isTerminal && 'font-mono text-xs')}>{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className={cn(
        'bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide',
        isTerminal && 'bg-[hsl(var(--terminal-code-bg))] text-primary'
      )}>
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className='border-t border-border/50 px-3 py-2 text-[13px] align-top'>
        {children}
      </td>
    ),
  }), [copiedCode, handleCopy, isTerminal]);

  if (!content.trim()) return null;

  return (
    <div className={cn(
      'chat-markdown prose prose-sm prose-neutral max-w-none dark:prose-invert [&>p]:mb-3 [&>p:last-child]:mb-0',
      isTerminal && 'prose-headings:font-mono'
    )}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default ChatMarkdown;
