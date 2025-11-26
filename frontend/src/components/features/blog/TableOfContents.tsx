import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTheme } from '@/contexts/ThemeContext';

interface TocItem {
  id: string;
  title: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
}

export const TableOfContents = ({ content }: TableOfContentsProps) => {
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const { isTerminal } = useTheme();

  useEffect(() => {
    // Extract headings from markdown content
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings: TocItem[] = [];
    const usedIds = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const title = match[2].trim();
      const id = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');

      // Ensure unique IDs
      let uniqueId = id;
      let suffix = 1;
      while (usedIds.has(uniqueId)) {
        uniqueId = `${id}-${suffix}`;
        suffix++;
      }
      usedIds.add(uniqueId);

      headings.push({ id: uniqueId, title, level });
    }

    setToc(headings);
  }, [content]);

  useEffect(() => {
    const handleScroll = () => {
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const scrollPosition = window.scrollY + 100;

      for (let i = headings.length - 1; i >= 0; i--) {
        const heading = headings[i] as HTMLElement;
        if (heading.offsetTop <= scrollPosition) {
          setActiveId(heading.id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (toc.length === 0) return null;

  return (
    <div className='sticky top-8 w-72 hidden xl:block'>
      <div
        className={cn(
          'bg-card/50 backdrop-blur-sm border rounded-2xl p-6 shadow-lg',
          isTerminal && 'bg-[hsl(var(--terminal-code-bg))] border-border rounded-lg'
        )}
      >
        {/* Terminal-style header */}
        {isTerminal && (
          <div className='flex items-center gap-1.5 mb-4 pb-3 border-b border-border'>
            <span className='w-2.5 h-2.5 rounded-full bg-[hsl(var(--terminal-window-btn-close))]' />
            <span className='w-2.5 h-2.5 rounded-full bg-[hsl(var(--terminal-window-btn-minimize))]' />
            <span className='w-2.5 h-2.5 rounded-full bg-[hsl(var(--terminal-window-btn-maximize))]' />
          </div>
        )}

        <h3
          className={cn(
            'font-bold mb-4 text-base flex items-center',
            isTerminal && 'font-mono text-primary text-sm'
          )}
        >
          {isTerminal ? (
            <>
              <span className='text-muted-foreground mr-2'>$</span>
              cat TOC
            </>
          ) : (
            <>
              <svg
                className='w-5 h-5 mr-2'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M4 6h16M4 10h16M4 14h16M4 18h16'
                />
              </svg>
              목차
            </>
          )}
        </h3>
        <ScrollArea className='h-[500px]'>
          <nav className='space-y-2'>
            {toc.map((item, index) => (
              <button
                key={`${item.id}-${index}`}
                onClick={() => scrollToHeading(item.id)}
                className={cn(
                  'block w-full text-left text-sm py-2 px-3 rounded-lg hover:bg-primary/10 transition-all duration-200',
                  'text-muted-foreground hover:text-foreground',
                  activeId === item.id &&
                    'bg-primary/15 text-primary font-semibold border-l-2 border-primary',
                  item.level === 1 && 'ml-0 font-medium',
                  item.level === 2 && 'ml-4',
                  item.level === 3 && 'ml-8',
                  item.level === 4 && 'ml-12',
                  item.level === 5 && 'ml-16',
                  item.level === 6 && 'ml-20',
                  isTerminal && 'font-mono text-xs rounded hover:bg-primary/20',
                  isTerminal && activeId === item.id && 'bg-primary/20 border-l-2 border-primary'
                )}
              >
                <span className='block truncate'>
                  {isTerminal && (
                    <span className='text-muted-foreground mr-2'>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  )}
                  {item.title}
                </span>
              </button>
            ))}
          </nav>
        </ScrollArea>
      </div>
    </div>
  );
};

export default TableOfContents;
