import React, {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import remarkGfm from 'remark-gfm';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  WrapText,
} from 'lucide-react';

import { useTheme } from '@/contexts/ThemeContext';
import { writeTextToClipboard } from '@/lib/markdown/clipboard';
import {
  getMarkdownLinkPresentation,
  normalizeMarkdownAccessibleText,
  normalizeMarkdownHrefForProfile,
  normalizeMarkdownSource,
} from '@/lib/markdown/markdownPolicy';
import { cn } from '@/lib/utils';
import MarkdownRenderBoundary from './MarkdownRenderBoundary';
import { MarkdownTable } from './MarkdownTable';

const CHAT_LANGUAGE_LOADERS: Record<
  string,
  () => Promise<{ default: unknown }>
> = {
  bash: () => import('react-syntax-highlighter/dist/esm/languages/hljs/bash'),
  css: () => import('react-syntax-highlighter/dist/esm/languages/hljs/css'),
  go: () => import('react-syntax-highlighter/dist/esm/languages/hljs/go'),
  java: () => import('react-syntax-highlighter/dist/esm/languages/hljs/java'),
  javascript: () =>
    import('react-syntax-highlighter/dist/esm/languages/hljs/javascript'),
  json: () => import('react-syntax-highlighter/dist/esm/languages/hljs/json'),
  kotlin: () =>
    import('react-syntax-highlighter/dist/esm/languages/hljs/kotlin'),
  markdown: () =>
    import('react-syntax-highlighter/dist/esm/languages/hljs/markdown'),
  plaintext: () =>
    import('react-syntax-highlighter/dist/esm/languages/hljs/plaintext'),
  python: () =>
    import('react-syntax-highlighter/dist/esm/languages/hljs/python'),
  rust: () => import('react-syntax-highlighter/dist/esm/languages/hljs/rust'),
  sql: () => import('react-syntax-highlighter/dist/esm/languages/hljs/sql'),
  typescript: () =>
    import('react-syntax-highlighter/dist/esm/languages/hljs/typescript'),
  yaml: () => import('react-syntax-highlighter/dist/esm/languages/hljs/yaml'),
};

const CHAT_LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  text: 'plaintext',
  ts: 'typescript',
  tsx: 'typescript',
  yml: 'yaml',
};

const registeredChatLanguages = new Set<string>();

async function ensureChatLanguageRegistered(language: string): Promise<boolean> {
  const canonical = CHAT_LANGUAGE_ALIASES[language] ?? language;
  if (registeredChatLanguages.has(canonical)) return true;
  const loader = CHAT_LANGUAGE_LOADERS[canonical];
  if (!loader) return false;

  try {
    const module = await loader();
    const definition = module.default as Parameters<
      typeof SyntaxHighlighter.registerLanguage
    >[1];
    SyntaxHighlighter.registerLanguage(canonical, definition);
    registeredChatLanguages.add(canonical);
    return true;
  } catch {
    return false;
  }
}

const terminalChatTheme: { [key: string]: React.CSSProperties } = {
  ...atomOneDark,
  hljs: {
    ...atomOneDark.hljs,
    color: '#c6f7d4',
    background: 'hsl(200 50% 3%)',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  'hljs-comment': { color: '#4e5953', fontStyle: 'italic' },
  'hljs-keyword': { color: '#3cff96' },
  'hljs-string': { color: '#3cb8ff' },
  'hljs-title': { color: '#3cff96' },
  'hljs-number': { color: '#ffb02e' },
};

interface ChatMarkdownProps {
  content: string;
  /** Keep partial Markdown byte-stable while a response is still arriving. */
  isStreaming?: boolean;
  label?: string;
  title?: string;
}

type CodeComponentProps = React.ComponentPropsWithoutRef<'code'> & {
  inline?: boolean;
  className?: string;
};

type CopyState = 'idle' | 'copied' | 'failed';

export function normalizeMarkdownHref(value: unknown): string | null {
  return normalizeMarkdownHrefForProfile(value, 'chat');
}

/**
 * CommonMark already renders incomplete delimiters and fences at EOF. Adding a
 * synthetic closing token changes the answer, so streaming content stays
 * unchanged after transport-byte normalization.
 */
function preserveStreamingMarkdown(content: string): string {
  return content;
}

function useCopyFeedback(text: string) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const timerRef = useRef<number | null>(null);
  const requestRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    requestRef.current += 1;
    clearTimer();
    setCopyState('idle');
  }, [clearTimer, text]);

  useEffect(
    () => () => {
      requestRef.current += 1;
      clearTimer();
    },
    [clearTimer],
  );

  const copy = useCallback(async () => {
    const request = ++requestRef.current;
    const copied = await writeTextToClipboard(text);
    if (request !== requestRef.current) return;
    setCopyState(copied ? 'copied' : 'failed');
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setCopyState('idle');
      timerRef.current = null;
    }, 2000);
  }, [clearTimer, text]);

  return { copy, copyState };
}

interface ChatCodeBlockProps {
  language?: string;
  codeString: string;
  isTerminal: boolean;
}

const CHAT_COLLAPSE_THRESHOLD = 24;
const CHAT_COLLAPSED_HEIGHT = 400;

const ChatCodeBlock = memo(function ChatCodeBlock({
  language,
  codeString,
  isTerminal,
}: ChatCodeBlockProps) {
  const canonicalLanguage = language
    ? (CHAT_LANGUAGE_ALIASES[language] ?? language)
    : undefined;
  const lineCount = codeString.split('\n').length;
  const isLong = lineCount > CHAT_COLLAPSE_THRESHOLD;
  const [collapsed, setCollapsed] = useState(isLong);
  const [wrapped, setWrapped] = useState(false);
  const [highlightReady, setHighlightReady] = useState(false);
  const codeRegionId = useId();
  const { copy, copyState } = useCopyFeedback(codeString);

  useEffect(() => {
    if (!canonicalLanguage) {
      setHighlightReady(false);
      return;
    }

    let live = true;
    setHighlightReady(registeredChatLanguages.has(canonicalLanguage));
    void ensureChatLanguageRegistered(canonicalLanguage).then((loaded) => {
      if (live) setHighlightReady(loaded);
    });
    return () => {
      live = false;
    };
  }, [canonicalLanguage]);

  useEffect(() => {
    if (!isLong) setCollapsed(false);
  }, [isLong]);

  const copyLabel =
    copyState === 'copied'
      ? 'Code copied'
      : copyState === 'failed'
        ? 'Code copy failed'
        : 'Copy code';

  return (
    <div
      className={cn(
        'group relative my-3 overflow-hidden rounded-lg bg-[#0b1020] dark:bg-[#050a1a]',
        isTerminal &&
          'border border-border bg-[hsl(var(--terminal-code-bg))]',
      )}
      data-code-highlight-state={
        canonicalLanguage
          ? highlightReady
            ? 'ready'
            : 'plain-fallback'
          : 'plain'
      }
    >
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2 border-b px-3 py-1.5 text-xs',
          isTerminal
            ? 'border-border bg-[hsl(var(--terminal-code-bg))]'
            : 'border-white/10 bg-white/5',
        )}
      >
        <span
          className={cn(
            'font-mono uppercase tracking-wide',
            isTerminal ? 'text-primary/70' : 'text-white/60',
          )}
        >
          {language || 'text'}
        </span>
        <span className='flex items-center gap-1'>
          <button
            type='button'
            aria-pressed={wrapped}
            aria-controls={codeRegionId}
            aria-label={wrapped ? 'Disable code wrapping' : 'Enable code wrapping'}
            title={wrapped ? '줄 바꿈 끄기' : '줄 바꿈 켜기'}
            className={cn(
              'inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition',
              isTerminal
                ? 'bg-primary/20 text-primary hover:bg-primary/30 font-mono'
                : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur',
            )}
            onClick={() => setWrapped((current) => !current)}
          >
            <WrapText className='h-3 w-3' aria-hidden='true' />
            <span>{wrapped ? 'No wrap' : 'Wrap'}</span>
          </button>
          <button
            type='button'
            aria-label={copyLabel}
            title={copyLabel}
            className={cn(
              'inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition',
              isTerminal
                ? 'bg-primary/20 text-primary hover:bg-primary/30 font-mono'
                : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur',
            )}
            onClick={() => {
              void copy();
            }}
          >
            {copyState === 'copied' ? (
              <Check className='h-3 w-3' aria-hidden='true' />
            ) : (
              <Copy className='h-3 w-3' aria-hidden='true' />
            )}
            <span>{copyState === 'copied' ? 'Copied' : 'Copy'}</span>
          </button>
        </span>
      </div>

      <div
        id={codeRegionId}
        role='region'
        aria-label={`${language || 'Plain text'} code`}
        tabIndex={0}
        className={cn(
          'overflow-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
          wrapped && 'whitespace-pre-wrap [overflow-wrap:anywhere]',
        )}
        style={
          isLong && collapsed
            ? { maxHeight: `${CHAT_COLLAPSED_HEIGHT}px` }
            : undefined
        }
      >
        {canonicalLanguage && highlightReady ? (
          <SyntaxHighlighter
            style={isTerminal ? terminalChatTheme : atomOneDark}
            language={canonicalLanguage}
            PreTag='div'
            className={cn(
              '!m-0 !bg-transparent !p-4 text-[12px]',
              wrapped ? '!whitespace-pre-wrap' : '!whitespace-pre',
            )}
            customStyle={{
              margin: 0,
              overflowX: wrapped ? 'hidden' : 'auto',
              whiteSpace: wrapped ? 'pre-wrap' : 'pre',
              overflowWrap: wrapped ? 'anywhere' : 'normal',
            }}
            codeTagProps={{
              style: {
                whiteSpace: wrapped ? 'pre-wrap' : 'pre',
                overflowWrap: wrapped ? 'anywhere' : 'normal',
              },
            }}
            wrapLongLines={wrapped}
          >
            {codeString}
          </SyntaxHighlighter>
        ) : (
          <pre
            data-testid='plain-code-fallback'
            data-language={canonicalLanguage}
            className={cn(
              'm-0 p-4 text-[12px]',
              wrapped
                ? 'whitespace-pre-wrap [overflow-wrap:anywhere]'
                : 'overflow-x-auto whitespace-pre',
              isTerminal ? 'font-mono text-primary/90' : 'text-white/90',
            )}
          >
            <code>{codeString}</code>
          </pre>
        )}
      </div>

      {isLong && (
        <button
          type='button'
          aria-expanded={!collapsed}
          aria-controls={codeRegionId}
          className={cn(
            'flex min-h-9 w-full items-center justify-center gap-2 border-t px-3 py-2 text-xs font-medium',
            isTerminal
              ? 'border-border text-primary hover:bg-primary/10'
              : 'border-white/10 text-white/70 hover:bg-white/10 hover:text-white',
          )}
          onClick={() => setCollapsed((current) => !current)}
        >
          {collapsed ? (
            <>
              <ChevronDown className='h-3.5 w-3.5' aria-hidden='true' />
              <span>{lineCount - CHAT_COLLAPSE_THRESHOLD} more lines</span>
            </>
          ) : (
            <>
              <ChevronUp className='h-3.5 w-3.5' aria-hidden='true' />
              <span>Collapse</span>
            </>
          )}
        </button>
      )}

      <span className='sr-only' aria-live='polite'>
        {copyState === 'copied'
          ? 'Code copied.'
          : copyState === 'failed'
            ? 'Code could not be copied.'
            : ''}
      </span>
    </div>
  );
});

const ChatMarkdown: React.FC<ChatMarkdownProps> = memo(
  ({ content, isStreaming = false, label, title }) => {
    const { isTerminal } = useTheme();
    const normalizedContent = normalizeMarkdownSource(content);
    const displayContent = isStreaming
      ? preserveStreamingMarkdown(normalizedContent)
      : normalizedContent;
    const safeLabel = normalizeMarkdownAccessibleText(label);
    const safeTitle = normalizeMarkdownAccessibleText(title);

    const components = useMemo<Components>(
      () => ({
        h1: ({ children }) => (
          <h3
            className={cn(
              'mb-2 mt-4 text-base font-semibold',
              isTerminal && 'font-mono text-primary',
            )}
          >
            {children}
          </h3>
        ),
        h2: ({ children }) => (
          <h4
            className={cn(
              'mb-1.5 mt-3 text-sm font-semibold',
              isTerminal && 'font-mono text-primary',
            )}
          >
            {children}
          </h4>
        ),
        h3: ({ children }) => (
          <h5
            className={cn(
              'mb-1 mt-2 text-sm font-semibold',
              isTerminal && 'font-mono',
            )}
          >
            {children}
          </h5>
        ),
        h4: ({ children }) => (
          <h6
            className={cn(
              'mb-1 mt-2 text-[13px] font-semibold',
              isTerminal && 'font-mono',
            )}
          >
            {children}
          </h6>
        ),
        h5: ({ children }) => (
          <h6
            className={cn(
              'mb-1 mt-2 text-[13px] font-medium',
              isTerminal && 'font-mono',
            )}
          >
            {children}
          </h6>
        ),
        h6: ({ children }) => (
          <strong
            className={cn(
              'text-[13px] font-semibold',
              isTerminal && 'font-mono',
            )}
          >
            {children}
          </strong>
        ),
        p: ({ children }) => (
          <p className='break-words text-pretty text-[13px] leading-relaxed text-foreground/90 [overflow-wrap:anywhere]'>
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul
            className={cn(
              'list-disc space-y-1 pl-4 text-[13px] leading-relaxed',
              isTerminal && 'list-none',
            )}
          >
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol
            className={cn(
              'list-decimal space-y-1 pl-4 text-[13px] leading-relaxed',
              isTerminal && 'font-mono',
            )}
          >
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li
            className={cn(
              'break-words leading-relaxed [overflow-wrap:anywhere]',
              isTerminal &&
                'before:content-["-_"] before:text-primary',
            )}
          >
            {children}
          </li>
        ),
        blockquote: ({ children }) => (
          <blockquote
            className={cn(
              'relative overflow-hidden rounded-xl border border-border/70 bg-muted/35 px-4 py-3 text-[13px] italic shadow-sm before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary/70',
              isTerminal &&
                'border-primary/60 bg-[hsl(var(--terminal-code-bg))] font-mono not-italic',
            )}
          >
            {children}
          </blockquote>
        ),
        code({ inline, className, children, ...props }: CodeComponentProps) {
          const match = /language-([\w-]+)/.exec(className || '');
          const rawCode = String(children);
          const codeString = rawCode.replace(/\n$/, '');
          const isBlock = inline === false || rawCode.endsWith('\n');

          if (isBlock) {
            return (
              <ChatCodeBlock
                language={match?.[1]?.toLowerCase()}
                codeString={codeString}
                isTerminal={isTerminal}
              />
            );
          }

          return (
            <code
              className={cn(
                'rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]',
                isTerminal &&
                  'bg-[hsl(var(--terminal-code-bg))] text-primary',
              )}
              {...props}
            >
              {children}
            </code>
          );
        },
        a: ({ children, href }) => {
          const link = getMarkdownLinkPresentation(href, 'chat');
          if (!link.href || !link.interactive) return <span>{children}</span>;

          return (
            <a
              href={link.href}
              target={link.target}
              rel={link.rel}
              className={cn(
                'break-all text-primary underline decoration-dotted underline-offset-2 hover:text-primary/80',
                isTerminal && 'hover:decoration-solid',
              )}
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
        thead: ({ children }) => (
          <thead
            className={cn(
              isTerminal
                ? 'bg-[hsl(var(--terminal-code-bg))]'
                : 'bg-muted/50',
            )}
          >
            {children}
          </thead>
        ),
        tbody: ({ children }) => (
          <tbody className='divide-y divide-border/50'>{children}</tbody>
        ),
        tr: ({ children }) => (
          <tr
            className={cn(
              'transition-colors',
              isTerminal ? 'hover:bg-primary/5' : 'hover:bg-muted/30',
            )}
          >
            {children}
          </tr>
        ),
        th: ({ children }) => (
          <th
            className={cn(
              'whitespace-nowrap border-b px-4 py-2.5 text-xs font-semibold uppercase tracking-wide',
              isTerminal
                ? 'border-border text-primary'
                : 'border-border/60 text-foreground',
            )}
          >
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td
            className={cn(
              'px-4 py-2.5 align-top text-[13px]',
              isTerminal && 'text-foreground/90',
            )}
          >
            {children}
          </td>
        ),
        hr: () => (
          <hr
            className={cn(
              'my-4 border-t',
              isTerminal ? 'border-primary/20' : 'border-border',
            )}
          />
        ),
      }),
      [isTerminal],
    );

    if (!displayContent.trim()) return null;

    return (
      <div
        className={cn(
          'chat-markdown prose prose-sm prose-neutral max-w-none dark:prose-invert prose-headings:text-balance',
          'break-words [overflow-wrap:anywhere]',
          '[&>p]:mb-3 [&>p:last-child]:mb-0',
          '[&>ul]:my-2 [&>ol]:my-2',
          '[&_pre]:!overflow-auto',
          isTerminal && 'prose-headings:font-mono',
        )}
        aria-label={safeLabel}
        title={safeTitle}
        aria-busy={isStreaming || undefined}
        data-markdown-profile='chat'
        data-preserve-reading-position='true'
      >
        <MarkdownRenderBoundary source={displayContent} variant='chat'>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            skipHtml
            components={components}
          >
            {displayContent}
          </ReactMarkdown>
        </MarkdownRenderBoundary>
      </div>
    );
  },
);

ChatMarkdown.displayName = 'ChatMarkdown';

export default ChatMarkdown;
