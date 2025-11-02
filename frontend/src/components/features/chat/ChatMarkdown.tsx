import React, { useCallback, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatMarkdownProps {
  content: string;
}

type CodeComponentProps = React.ComponentPropsWithoutRef<'code'> & {
  inline?: boolean;
  className?: string;
};

const ChatMarkdown: React.FC<ChatMarkdownProps> = ({ content }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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
      <h3 className='mt-4 mb-2 text-base font-semibold'>{children}</h3>
    ),
    h2: ({ children }) => (
      <h4 className='mt-3 mb-1.5 text-sm font-semibold'>{children}</h4>
    ),
    h3: ({ children }) => (
      <h5 className='mt-2 mb-1 text-sm font-semibold'>{children}</h5>
    ),
    h4: ({ children }) => (
      <h6 className='mt-2 mb-1 text-[13px] font-semibold'>{children}</h6>
    ),
    h5: ({ children }) => (
      <h6 className='mt-2 mb-1 text-[13px] font-medium'>{children}</h6>
    ),
    h6: ({ children }) => (
      <strong className='text-[13px] font-semibold'>{children}</strong>
    ),
    p: ({ children }) => (
      <p className='text-[13px] leading-relaxed'>{children}</p>
    ),
    ul: ({ children }) => (
      <ul className='pl-4 text-[13px] leading-relaxed list-disc space-y-1'>
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className='pl-4 text-[13px] leading-relaxed list-decimal space-y-1'>
        {children}
      </ol>
    ),
    li: ({ children }) => <li className='leading-relaxed'>{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className='rounded-md border-l-4 border-primary/40 bg-muted/40 pl-3 py-1 text-[13px] italic'>
        {children}
      </blockquote>
    ),
    code({ inline, className, children, ...props }: CodeComponentProps) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');

      if (!inline && match) {
        return (
          <div className='relative my-3 overflow-hidden rounded-lg bg-[#0b1020] dark:bg-[#050a1a]'>
            <button
              type='button'
              className='absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:bg-white/10'
              onClick={() => handleCopy(codeString)}
            >
              {copiedCode === codeString ? 'Copied' : 'Copy'}
            </button>
            <SyntaxHighlighter
              style={oneDark}
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
          className='rounded bg-muted px-1.5 py-0.5 text-[12px] font-mono'
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
        className='text-primary underline decoration-dotted underline-offset-2 hover:text-primary/80'
      >
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className='my-3 overflow-x-auto rounded-lg border border-border/60'>
        <table className='w-full text-left text-sm'>{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className='bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide'>
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className='border-t border-border/50 px-3 py-2 text-[13px] align-top'>
        {children}
      </td>
    ),
  }), [copiedCode, handleCopy]);

  if (!content.trim()) return null;

  return (
    <div className='chat-markdown prose prose-sm prose-neutral max-w-none dark:prose-invert [&>p]:mb-3 [&>p:last-child]:mb-0'>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default ChatMarkdown;
