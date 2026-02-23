import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Children, Fragment, isValidElement, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import SparkInline from '@/components/features/sentio/SparkInline';
import { ClickableImage } from './ImageLightbox';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { createHeadingSlug, normalizeHeadingText } from '@/utils/markdownHeadings';

// Terminal-style syntax highlighting theme
const terminalTheme: { [key: string]: React.CSSProperties } = {
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
    border: '1px solid hsl(200 30% 12%)',
  },
  comment: { color: '#4e5953' },
  keyword: { color: '#3cff96' },
  string: { color: '#3cb8ff' },
  function: { color: '#3cff96' },
  number: { color: '#ffb02e' },
  operator: { color: '#3cff96' },
  punctuation: { color: '#7f8f87' },
  variable: { color: '#e4f4e8' },
  'class-name': { color: '#3cb8ff' },
  constant: { color: '#ffb02e' },
  boolean: { color: '#ffb02e' },
};

interface MarkdownRendererProps {
  content: string;
  className?: string;
  inlineEnabled?: boolean;
  postTitle?: string;
  postPath?: string; // e.g., "2025/future-tech-six-insights" for resolving relative image paths
}

function extractTextFromNode(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractTextFromNode).join(' ');
  }

  if (!isValidElement(node)) {
    return '';
  }

  const props = (node as any).props ?? {};
  return Children.toArray(props.children)
    .map(extractTextFromNode)
    .join(' ');
}

// ============================================================================
// CodeBlock component — line numbers + collapsible
// ============================================================================
interface CodeBlockProps {
  codeString: string;
  language: string;
  isTerminalTheme: boolean;
  copiedCode: string | null;
  onCopy: (code: string) => void;
}

const COLLAPSE_THRESHOLD = 25;
const COLLAPSED_MAX_LINES = 480; // ~25 lines worth of height in px

function CodeBlock({ codeString, language, isTerminalTheme, copiedCode, onCopy }: CodeBlockProps) {
  const lineCount = codeString.split('\n').length;
  const isLong = lineCount > COLLAPSE_THRESHOLD;
  const [collapsed, setCollapsed] = useState(isLong);

  return (
    <div className='relative group my-8 max-w-4xl mx-auto'>
      {/* Terminal-style header for code blocks */}
      {isTerminalTheme && (
        <div className='flex items-center gap-2 bg-[hsl(var(--terminal-titlebar))] px-4 py-2 rounded-t-xl border border-b-0 border-border font-mono text-xs text-muted-foreground'>
          <span className='w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-close))]' />
          <span className='w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-minimize))]' />
          <span className='w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-maximize))]' />
          <span className='ml-2 text-primary'>{language}</span>
        </div>
      )}
      {/* Non-terminal language badge */}
      {!isTerminalTheme && language && (
        <div className='absolute left-4 top-3 z-10'>
          <span className='px-2 py-1 text-xs font-medium rounded bg-primary/10 text-primary border border-primary/20'>
            {language}
          </span>
        </div>
      )}

      {/* Copy button */}
      <Button
        size='icon'
        variant='ghost'
        data-testid="code-copy-btn"
        className={cn(
          'absolute right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10',
          isTerminalTheme ? 'top-12 text-primary hover:text-primary hover:bg-primary/10' : 'top-2'
        )}
        onClick={() => onCopy(codeString)}
      >
        {copiedCode === codeString ? (
          <Check className='h-4 w-4' />
        ) : (
          <Copy className='h-4 w-4' />
        )}
      </Button>

      {/* Code area with collapsible */}
      <div className='relative overflow-hidden'>
        <div
          className={cn(
            'overflow-x-auto transition-[max-height] duration-500 ease-in-out',
            collapsed ? 'overflow-y-hidden' : 'overflow-y-visible'
          )}
          style={collapsed ? { maxHeight: `${COLLAPSED_MAX_LINES}px` } : { maxHeight: 'none' }}
        >
          <SyntaxHighlighter
            style={isTerminalTheme ? terminalTheme : oneDark}
            language={language}
            PreTag='div'
            showLineNumbers={true}
            lineNumberStyle={{
              minWidth: '2.5em',
              paddingRight: '1em',
              color: isTerminalTheme ? 'rgba(100,160,120,0.4)' : 'rgba(150,150,170,0.5)',
              userSelect: 'none',
              fontSize: '0.8em',
            }}
            className={cn(
              'rounded-xl shadow-lg !overflow-x-auto',
              isTerminalTheme && 'rounded-t-none !rounded-b-xl',
              !isTerminalTheme && language && '!pt-10'
            )}
            wrapLongLines={false}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>

        {/* Fade gradient overlay when collapsed */}
        {isLong && collapsed && (
          <div
            className='absolute bottom-0 left-0 right-0 h-24 pointer-events-none'
            style={{
              background: isTerminalTheme
                ? 'linear-gradient(to bottom, transparent, hsl(200 50% 3%))'
                : 'linear-gradient(to bottom, transparent, #282c34)',
            }}
          />
        )}
      </div>

      {/* Expand/Collapse toggle button */}
      {isLong && (
        <button
          type='button'
          data-testid='code-collapse-toggle'
          onClick={() => setCollapsed(v => !v)}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2 text-xs font-medium transition-colors',
            'border-t',
            isTerminalTheme
              ? 'bg-[hsl(var(--terminal-titlebar))] border-border text-primary hover:bg-primary/10 rounded-b-xl'
              : 'bg-[#282c34] border-[#3e4451] text-gray-400 hover:text-gray-200 rounded-b-xl'
          )}
        >
          {collapsed ? (
            <>
              <ChevronDown className='h-3.5 w-3.5' />
              <span>{lineCount - COLLAPSE_THRESHOLD}줄 더 보기</span>
            </>
          ) : (
            <>
              <ChevronUp className='h-3.5 w-3.5' />
              <span>접기</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

export const MarkdownRenderer = ({
  content,
  className = '',
  inlineEnabled = false,
  postTitle = '',
  postPath = '',
}: MarkdownRendererProps) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { isTerminal } = useTheme();

  const sanitizedContent = useMemo(() => {
    if (!postTitle) return content;
    const normalizedTitle = postTitle.trim().toLowerCase();
    const lines = content.split(/\r?\n/);
    while (lines.length) {
      const first = lines[0].trim();
      const plain = first.replace(/^#+\s*/, '').trim().toLowerCase();
      if (plain && plain === normalizedTitle) {
        lines.shift();
        continue;
      }
      break;
    }
    return lines.join('\n');
  }, [content, postTitle]);

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const hasMediaNode = (node: unknown): boolean => {
    if (!isValidElement(node)) return false;

    const props = (node as any).props ?? {};
    if (typeof props.src === 'string' && props.src.length > 0) return true;

    const children = Children.toArray(props.children);
    return children.some(child => hasMediaNode(child));
  };

  const headingSlugCounts = new Map<string, number>();
  const getHeadingId = (children: ReactNode): string => {
    const raw = normalizeHeadingText(extractTextFromNode(children));
    const base = createHeadingSlug(raw);
    const count = headingSlugCounts.get(base) ?? 0;
    headingSlugCounts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };

  return (
    <div
      className={cn(
        'prose prose-neutral dark:prose-invert max-w-none prose-lg content',
        isTerminal && 'prose-headings:font-mono prose-headings:tracking-wide',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ children }) => {
            const id = getHeadingId(children);
            return (
              <h1
                id={id}
                className={cn(
                  'text-4xl font-bold mt-12 mb-6 scroll-mt-24 text-center max-w-4xl mx-auto',
                  isTerminal && 'terminal-glow'
                )}
              >
                {isTerminal && <span className='text-primary mr-2'>#</span>}
                {children}
              </h1>
            );
          },
          h2: ({ children }) => {
            const id = getHeadingId(children);
            return (
              <h2
                id={id}
                className={cn(
                  'text-3xl font-semibold mt-10 mb-5 scroll-mt-24 text-center max-w-4xl mx-auto',
                  isTerminal && 'terminal-glow'
                )}
              >
                {isTerminal && <span className='text-primary mr-2'>##</span>}
                {children}
              </h2>
            );
          },
          h3: ({ children }) => {
            const id = getHeadingId(children);
            return (
              <h3
                id={id}
                className={cn(
                  'text-2xl font-semibold mt-8 mb-4 scroll-mt-24 text-center max-w-4xl mx-auto',
                  isTerminal && 'terminal-glow'
                )}
              >
                {isTerminal && <span className='text-primary mr-2'>###</span>}
                {children}
              </h3>
            );
          },
          h4: ({ children }) => {
            const id = getHeadingId(children);
            return (
              <h4
                id={id}
                className='text-xl font-semibold mt-4 mb-2 scroll-mt-24'
              >
                {children}
              </h4>
            );
          },
          h5: ({ children }) => {
            const id = getHeadingId(children);
            return (
              <h5
                id={id}
                className='text-lg font-semibold mt-4 mb-2 scroll-mt-24'
              >
                {children}
              </h5>
            );
          },
          h6: ({ children }) => {
            const id = getHeadingId(children);
            return (
              <h6
                id={id}
                className='text-base font-semibold mt-4 mb-2 scroll-mt-24'
              >
                {children}
              </h6>
            );
          },
          p: ({ children }) => {
            if (inlineEnabled) {
              return <SparkInline postTitle={postTitle}>{children}</SparkInline>;
            }

            const childArray = Children.toArray(children);
            const containsMedia = childArray.some(child => hasMediaNode(child));

            if (containsMedia) {
              return (
                <div className='space-y-4 max-w-4xl mx-auto'>
                  {childArray.map((child, idx) => (
                    <Fragment key={idx}>{child}</Fragment>
                  ))}
                </div>
              );
            }

            return (
              <p
                className={cn(
                  'mb-6 leading-8 text-justify max-w-4xl mx-auto',
                  isTerminal && 'border-l border-border/50 pl-4'
                )}
              >
                {children}
              </p>
            );
          },
          ul: ({ children }) => (
            <ul
              className={cn(
                'list-disc pl-6 mb-6 space-y-3 max-w-4xl mx-auto',
                isTerminal && 'list-none'
              )}
            >
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className='list-decimal pl-6 mb-6 space-y-3 max-w-4xl mx-auto'>
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className={cn('leading-8 text-justify', isTerminal && 'before:content-["-_"] before:text-primary')}>
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className={cn(
                'border-l-4 border-primary pl-6 my-8 italic bg-muted/30 py-4 rounded-r-lg max-w-4xl mx-auto',
                isTerminal && 'bg-[hsl(var(--terminal-code-bg))] border-primary/60 not-italic font-mono'
              )}
            >
              {children}
            </blockquote>
          ),
          code({
            inline,
            className,
            children,
            ...props
          }: React.ComponentProps<'code'> & { inline?: boolean }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            const language = match ? match[1] : '';

            return !inline && match ? (
              <CodeBlock
                codeString={codeString}
                language={language}
                isTerminalTheme={isTerminal}
                copiedCode={copiedCode}
                onCopy={copyToClipboard}
              />
            ) : (
              <code
                className={cn(
                  'bg-muted px-1.5 py-0.5 rounded text-sm',
                  isTerminal && 'bg-[hsl(var(--terminal-code-bg))] text-primary font-mono'
                )}
                {...props}
              >
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a
              href={href}
              target='_blank'
              rel='noopener noreferrer'
              className={cn(
                'text-primary hover:underline',
                isTerminal && 'underline decoration-dotted underline-offset-4 hover:decoration-solid'
              )}
            >
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <ClickableImage src={src || ''} alt={alt} isTerminal={isTerminal} postPath={postPath} />
          ),
          cite: ({ children }) => <cite>{children}</cite>,
          table: ({ children }) => (
            <div className='overflow-x-auto my-8 max-w-4xl mx-auto'>
              <table
                className={cn(
                  'min-w-full divide-y divide-border rounded-lg shadow-sm',
                  isTerminal && 'font-mono text-sm'
                )}
              >
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th
              className={cn(
                'px-4 py-2 text-left font-semibold bg-muted',
                isTerminal && 'bg-[hsl(var(--terminal-code-bg))] text-primary uppercase text-xs tracking-wider'
              )}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className='px-4 py-2 border-t'>{children}</td>
          ),
        }}
      >
        {sanitizedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
