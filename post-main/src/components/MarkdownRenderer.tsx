import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer = ({ content, className = '' }: MarkdownRendererProps) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className={`prose prose-neutral dark:prose-invert max-w-none prose-lg ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => {
            const text = String(children);
            const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
            return (
              <h1 id={id} className="text-4xl font-bold mt-12 mb-6 scroll-mt-24 text-center max-w-4xl mx-auto">
                {children}
              </h1>
            );
          },
          h2: ({ children }) => {
            const text = String(children);
            const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
            return (
              <h2 id={id} className="text-3xl font-semibold mt-10 mb-5 scroll-mt-24 text-center max-w-4xl mx-auto">
                {children}
              </h2>
            );
          },
          h3: ({ children }) => {
            const text = String(children);
            const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
            return (
              <h3 id={id} className="text-2xl font-semibold mt-8 mb-4 scroll-mt-24 text-center max-w-4xl mx-auto">
                {children}
              </h3>
            );
          },
          h4: ({ children }) => {
            const text = String(children);
            const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
            return (
              <h4 id={id} className="text-xl font-semibold mt-4 mb-2 scroll-mt-24">
                {children}
              </h4>
            );
          },
          h5: ({ children }) => {
            const text = String(children);
            const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
            return (
              <h5 id={id} className="text-lg font-semibold mt-4 mb-2 scroll-mt-24">
                {children}
              </h5>
            );
          },
          h6: ({ children }) => {
            const text = String(children);
            const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
            return (
              <h6 id={id} className="text-base font-semibold mt-4 mb-2 scroll-mt-24">
                {children}
              </h6>
            );
          },
          p: ({ children }) => (
            <p className="mb-6 leading-8 text-justify max-w-4xl mx-auto px-2 sm:px-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-6 mb-6 space-y-3 max-w-4xl mx-auto px-2 sm:px-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 mb-6 space-y-3 max-w-4xl mx-auto px-2 sm:px-0">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-8 text-justify">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary pl-6 my-8 italic bg-muted/30 py-4 rounded-r-lg max-w-4xl mx-auto">
              {children}
            </blockquote>
          ),
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            
            return !inline && match ? (
              <div className="relative group my-8 max-w-4xl mx-auto overflow-hidden">
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-2 top-2 h-8 w-8 opacity-0 group-hover:opacity-100 md:opacity-0 opacity-100 transition-opacity z-10 bg-background/80 backdrop-blur-sm"
                  onClick={() => copyToClipboard(codeString)}
                >
                  {copiedCode === codeString ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <div className="overflow-x-auto">
                  <SyntaxHighlighter
                    {...props}
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    className="rounded-xl shadow-lg !text-sm md:!text-base"
                    customStyle={{
                      margin: 0,
                      minWidth: 'max-content',
                      fontSize: 'inherit'
                    }}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              </div>
            ) : (
              <code className="bg-muted px-1.5 py-0.5 rounded text-sm break-words" {...props}>
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <div className="my-8 text-center">
              <img
                src={src}
                alt={alt}
                className="rounded-xl shadow-lg mx-auto max-w-full h-auto"
              />
              {alt && (
                <p className="text-sm text-muted-foreground mt-2 italic">{alt}</p>
              )}
            </div>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-8 max-w-4xl mx-auto -mx-4 sm:mx-auto">
              <div className="inline-block min-w-full px-4 sm:px-0">
                <table className="min-w-full divide-y divide-border rounded-lg shadow-sm text-sm">
                  {children}
                </table>
              </div>
            </div>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left font-semibold bg-muted">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 border-t">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};