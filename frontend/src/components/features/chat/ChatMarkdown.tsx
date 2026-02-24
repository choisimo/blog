import React, { useCallback, useMemo, useState, useRef, useEffect, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Copy, Check, Table2 } from 'lucide-react';

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
  /** Enable streaming mode for better partial markdown handling */
  isStreaming?: boolean;
}

type CodeComponentProps = React.ComponentPropsWithoutRef<'code'> & {
  inline?: boolean;
  className?: string;
};

/**
 * Sanitize incomplete markdown during streaming to prevent parse errors
 * This helps avoid flickering and layout shifts when markdown is incomplete
 */
function sanitizeStreamingMarkdown(content: string): string {
  let result = content;
  
  // Count unclosed code fences
  const codeFenceMatches = result.match(/```/g);
  if (codeFenceMatches && codeFenceMatches.length % 2 === 1) {
    result = `${result}\n\`\`\``;
  }
  
  // Handle incomplete inline code
  const inlineCodeMatches = result.match(/(?<!`)`(?!`)/g);
  if (inlineCodeMatches && inlineCodeMatches.length % 2 === 1) {
    result = `${result}\``;
  }
  
  // Handle incomplete bold/italic markers at the end
  // Only if the marker appears at the very end without closing
  if (/\*\*[^*]+$/.test(result) && !/\*\*[^*]+\*\*/.test(result.slice(-50))) {
    result = `${result}**`;
  }
  if (/(?<!\*)\*[^*]+$/.test(result) && !/(?<!\*)\*[^*]+\*(?!\*)/.test(result.slice(-30))) {
    result = `${result}*`;
  }
  
  return result;
}

const ChatMarkdown: React.FC<ChatMarkdownProps> = memo(({ content, isStreaming }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { isTerminal } = useTheme();
  const lastContentRef = useRef(content);
  const [displayContent, setDisplayContent] = useState(content);
  
  // Throttle content updates during streaming to reduce re-renders
  useEffect(() => {
    if (isStreaming) {
      // During streaming, update less frequently to avoid jank
      const timerId = setTimeout(() => {
        const sanitized = sanitizeStreamingMarkdown(content);
        setDisplayContent(sanitized);
        lastContentRef.current = content;
      }, 50); // 50ms throttle
      
      return () => clearTimeout(timerId);
    } else {
      // Not streaming - update immediately
      setDisplayContent(content);
      lastContentRef.current = content;
    }
  }, [content, isStreaming]);

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
      <p className='text-[13px] leading-relaxed break-words [overflow-wrap:anywhere]'>{children}</p>
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
      <li className={cn('leading-relaxed break-words [overflow-wrap:anywhere]', isTerminal && 'before:content-["-_"] before:text-primary')}>{children}</li>
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
      const isCopied = copiedCode === codeString;

      if (!inline && match) {
        return (
          <div className={cn(
            'relative my-3 overflow-hidden rounded-lg bg-[#0b1020] dark:bg-[#050a1a] group',
            isTerminal && 'bg-[hsl(var(--terminal-code-bg))] border border-border'
          )}>
            <div className={cn(
              'flex items-center justify-between px-3 py-1.5 border-b text-xs',
              isTerminal 
                ? 'border-border bg-[hsl(var(--terminal-code-bg))]' 
                : 'border-white/10 bg-white/5'
            )}>
              <span className={cn(
                'font-mono uppercase tracking-wide',
                isTerminal ? 'text-primary/70' : 'text-white/60'
              )}>
                {match[1]}
              </span>
              <button
                type='button'
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition',
                  'opacity-0 group-hover:opacity-100 focus:opacity-100',
                  'sm:opacity-100', // Always visible on mobile
                  isTerminal 
                    ? 'bg-primary/20 text-primary hover:bg-primary/30 font-mono' 
                    : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur'
                )}
                onClick={() => handleCopy(codeString)}
              >
                {isCopied ? (
                  <>
                    <Check className='h-3 w-3' />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className='h-3 w-3' />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <SyntaxHighlighter
              style={isTerminal ? terminalChatTheme : oneDark}
              language={match[1]}
              PreTag='div'
              className='!bg-transparent !p-4 text-[12px] !m-0 overflow-auto overscroll-contain max-h-[400px]'
              wrapLongLines={false}
            >
              {codeString}
            </SyntaxHighlighter>
          </div>
        );
      }

      // Code block without language specified
      if (!inline && !match && codeString.includes('\n')) {
        return (
          <div className={cn(
            'relative my-3 overflow-hidden rounded-lg bg-[#0b1020] dark:bg-[#050a1a] group',
            isTerminal && 'bg-[hsl(var(--terminal-code-bg))] border border-border'
          )}>
            <button
              type='button'
              className={cn(
                'absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition z-10',
                'opacity-0 group-hover:opacity-100 focus:opacity-100 sm:opacity-100',
                isTerminal 
                  ? 'bg-primary/20 text-primary hover:bg-primary/30 font-mono' 
                  : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur'
              )}
              onClick={() => handleCopy(codeString)}
            >
              {isCopied ? <Check className='h-3 w-3' /> : <Copy className='h-3 w-3' />}
            </button>
            <pre className={cn(
              'p-4 text-[12px] overflow-auto overscroll-contain max-h-[400px]',
              isTerminal ? 'text-primary/90 font-mono' : 'text-white/90'
            )}>
              {codeString}
            </pre>
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
          'text-primary underline decoration-dotted underline-offset-2 hover:text-primary/80 break-all',
          isTerminal && 'hover:decoration-solid'
        )}
      >
        {children}
      </a>
    ),
    // Enhanced table rendering
    table: ({ children }) => (
      <div className={cn(
        'my-4 overflow-hidden rounded-lg border',
        isTerminal ? 'border-border bg-[hsl(var(--terminal-code-bg))]' : 'border-border/60 bg-muted/20'
      )}>
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 border-b text-xs font-medium',
          isTerminal ? 'border-border text-primary/70' : 'border-border/60 text-muted-foreground'
        )}>
          <Table2 className='h-3.5 w-3.5' />
          <span className={isTerminal ? 'font-mono uppercase tracking-wide' : ''}>Table</span>
        </div>
        <div className='overflow-x-auto'>
          <table className={cn(
            'w-full text-left text-sm min-w-max',
            isTerminal && 'font-mono text-xs'
          )}>
            {children}
          </table>
        </div>
      </div>
    ),
    thead: ({ children }) => (
      <thead className={cn(
        isTerminal ? 'bg-[hsl(var(--terminal-code-bg))]' : 'bg-muted/50'
      )}>
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody className='divide-y divide-border/50'>
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr className={cn(
        'transition-colors',
        isTerminal ? 'hover:bg-primary/5' : 'hover:bg-muted/30'
      )}>
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className={cn(
        'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide whitespace-nowrap',
        isTerminal ? 'text-primary border-b border-border' : 'text-foreground border-b border-border/60'
      )}>
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className={cn(
        'px-4 py-2.5 text-[13px] align-top',
        isTerminal && 'text-foreground/90'
      )}>
        {children}
      </td>
    ),
    // Horizontal rule
    hr: () => (
      <hr className={cn(
        'my-4 border-t',
        isTerminal ? 'border-primary/20' : 'border-border'
      )} />
    ),
  }), [copiedCode, handleCopy, isTerminal]);

  if (!displayContent.trim()) return null;

  return (
    <div className={cn(
      'chat-markdown prose prose-sm prose-neutral max-w-none dark:prose-invert',
      'break-words [overflow-wrap:anywhere]',
      '[&>p]:mb-3 [&>p:last-child]:mb-0',
      '[&>ul]:my-2 [&>ol]:my-2',
      '[&_pre]:!overflow-auto',
      isTerminal && 'prose-headings:font-mono'
    )}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {displayContent}
      </ReactMarkdown>
    </div>
  );
});

ChatMarkdown.displayName = 'ChatMarkdown';

export default ChatMarkdown;
