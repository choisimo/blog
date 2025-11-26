import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import SparkInline from '@/components/features/sentio/SparkInline';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

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
}

export const MarkdownRenderer = ({
  content,
  className = '',
  inlineEnabled = false,
  postTitle = '',
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
        components={{
          h1: ({ children }) => {
            const text = String(children);
            const id = text
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-');
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
            const text = String(children);
            const id = text
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-');
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
            const text = String(children);
            const id = text
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-');
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
            const text = String(children);
            const id = text
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-');
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
            const text = String(children);
            const id = text
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-');
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
            const text = String(children);
            const id = text
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-');
            return (
              <h6
                id={id}
                className='text-base font-semibold mt-4 mb-2 scroll-mt-24'
              >
                {children}
              </h6>
            );
          },
          p: ({ children }) =>
            inlineEnabled ? (
              <SparkInline postTitle={postTitle}>{children}</SparkInline>
            ) : (
              <p
                className={cn(
                  'mb-6 leading-8 text-justify max-w-4xl mx-auto',
                  isTerminal && 'border-l border-border/50 pl-4'
                )}
              >
                {children}
              </p>
            ),
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
              <div className='relative group my-8 max-w-4xl mx-auto'>
                {/* Terminal-style header for code blocks */}
                {isTerminal && (
                  <div className='flex items-center gap-2 bg-[hsl(var(--terminal-titlebar))] px-4 py-2 rounded-t-xl border border-b-0 border-border font-mono text-xs text-muted-foreground'>
                    <span className='w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-close))]' />
                    <span className='w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-minimize))]' />
                    <span className='w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-maximize))]' />
                    <span className='ml-2 text-primary'>{language}</span>
                  </div>
                )}
                <Button
                  size='icon'
                  variant='ghost'
                  className={cn(
                    'absolute right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10',
                    isTerminal ? 'top-12 text-primary hover:text-primary hover:bg-primary/10' : 'top-2'
                  )}
                  onClick={() => copyToClipboard(codeString)}
                >
                  {copiedCode === codeString ? (
                    <Check className='h-4 w-4' />
                  ) : (
                    <Copy className='h-4 w-4' />
                  )}
                </Button>
                <SyntaxHighlighter
                  style={isTerminal ? terminalTheme : oneDark}
                  language={language}
                  PreTag='div'
                  className={cn(
                    'rounded-xl shadow-lg',
                    isTerminal && 'rounded-t-none !rounded-b-xl'
                  )}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
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
            <div className='my-8 text-center'>
              <img
                src={src}
                alt={alt}
                className={cn(
                  'rounded-xl shadow-lg mx-auto max-w-full h-auto',
                  isTerminal && 'rounded-lg border border-border'
                )}
              />
              {alt && (
                <p
                  className={cn(
                    'text-sm text-muted-foreground mt-2 italic',
                    isTerminal && 'font-mono not-italic'
                  )}
                >
                  {isTerminal ? `// ${alt}` : alt}
                </p>
              )}
            </div>
          ),
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
