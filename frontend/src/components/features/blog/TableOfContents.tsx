import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTheme } from '@/contexts/ThemeContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { BookOpen, X } from 'lucide-react';

interface TocItem {
  id: string;
  title: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
  onClose?: () => void;
}

export const TableOfContents = ({ content, onClose }: TableOfContentsProps) => {
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const { isTerminal } = useTheme();
  const isMobile = useIsMobile();
  const [isStuck, setIsStuck] = useState(false);
  const [animateDropIn, setAnimateDropIn] = useState(false);
  
  const rafRef = useRef<number | null>(null);
  const lastScrollTime = useRef<number>(0);
  const THROTTLE_MS = 100;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const STICKY_TOP_PX = 96;
  const isStuckRef = useRef(false);
  const dropInTimeoutRef = useRef<number | null>(null);

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
    // Skip scroll tracking on mobile for performance
    if (isMobile) return;

    let resizeObserver: ResizeObserver | null = null;

    const updateActiveHeading = () => {
      const boundaryEl = document.querySelector('[data-toc-boundary]');
      const headings = boundaryEl?.querySelectorAll(
        'h1, h2, h3, h4, h5, h6'
      );
      if (!headings || headings.length === 0) return;

      const scrollPosition = window.scrollY + 100;
      for (let i = headings.length - 1; i >= 0; i--) {
        const heading = headings[i] as HTMLElement;
        if (heading.id && heading.offsetTop <= scrollPosition) {
          setActiveId(heading.id);
          break;
        }
      }
    };

    const updateTocPosition = () => {
      const tocEl = containerRef.current;
      if (!tocEl) {
        if (isStuckRef.current) {
          isStuckRef.current = false;
          setIsStuck(false);
        }
        return;
      }

      const stuckNow = tocEl.getBoundingClientRect().top <= STICKY_TOP_PX + 1;
      if (stuckNow !== isStuckRef.current) {
        isStuckRef.current = stuckNow;
        setIsStuck(stuckNow);

        if (stuckNow) {
          setAnimateDropIn(true);
          if (dropInTimeoutRef.current) {
            window.clearTimeout(dropInTimeoutRef.current);
          }
          dropInTimeoutRef.current = window.setTimeout(() => {
            setAnimateDropIn(false);
            dropInTimeoutRef.current = null;
          }, 220);
        }
      }
    };

    const updateOnScroll = () => {
      updateActiveHeading();
      updateTocPosition();
    };
    
    const handleScroll = () => {
      const now = Date.now();
      
      // Throttle: skip if called too frequently
      if (now - lastScrollTime.current < THROTTLE_MS) {
        return;
      }
      lastScrollTime.current = now;
      
      // Cancel any pending RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      
      // Schedule update in next animation frame
      rafRef.current = requestAnimationFrame(updateOnScroll);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    updateOnScroll();
    requestAnimationFrame(updateOnScroll);

    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateTocPosition();
      });
      resizeObserver.observe(containerRef.current);
    }

    const handleResize = () => {
      updateTocPosition();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (dropInTimeoutRef.current) {
        window.clearTimeout(dropInTimeoutRef.current);
        dropInTimeoutRef.current = null;
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [isMobile]);

  useEffect(() => {
    if (isMobile || !activeId) return;

    const tocRoot = scrollAreaRef.current;
    const activeItem = itemRefs.current[activeId];
    if (!tocRoot || !activeItem) return;

    const viewport = tocRoot.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLElement | null;
    if (!viewport) return;

    const viewportRect = viewport.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const itemOffset = itemRect.top - viewportRect.top + viewport.scrollTop;
    const viewportHeight = viewportRect.height;
    const upperThreshold = viewport.scrollTop + viewportHeight * 0.2;
    const lowerThreshold = viewport.scrollTop + viewportHeight * 0.8;

    if (itemOffset < upperThreshold || itemOffset > lowerThreshold) {
      const target = itemOffset - viewportHeight * 0.35;
      viewport.scrollTo({
        top: Math.max(0, target),
        behavior: 'smooth',
      });
    }
  }, [activeId, isMobile]);

  const scrollToHeading = (id: string, closePanel?: () => void) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      closePanel?.();
      onClose?.();
    }
  };

  if (toc.length === 0) return null;

  return (
    <div
      ref={containerRef}
      data-testid="toc-panel"
      className="w-72 sticky top-24"
    >
      <div
        className={cn(
          'bg-card/50 backdrop-blur-sm border rounded-2xl p-6 shadow-lg',
          animateDropIn && isStuck && 'animate-in slide-in-from-top-2 fade-in duration-200',
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
        <ScrollArea ref={scrollAreaRef} className='max-h-[calc(100vh-12rem)]'>
          <nav className='space-y-2 pr-2'>
            {toc.map((item, index) => (
              <button
                key={`${item.id}-${index}`}
                ref={node => {
                  if (node) {
                    itemRefs.current[item.id] = node;
                  } else {
                    delete itemRefs.current[item.id];
                  }
                }}
                title={item.title}
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
                <span className='block break-words leading-snug'>
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

// Mobile TOC Drawer — floating button that opens a Sheet
export const TocDrawer = ({ content }: { content: string }) => {
  const [open, setOpen] = useState(false);
  const { isTerminal } = useTheme();

  // Extract toc to check if there are any headings
  const hasToc = /^#{1,6}\s+.+$/m.test(content);
  if (!hasToc) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          data-testid="toc-mobile-trigger"
          aria-label="목차 열기"
          className={cn(
            'fixed bottom-6 right-6 z-40 xl:hidden',
            'flex items-center justify-center',
            'h-12 w-12 rounded-full shadow-lg',
            'bg-primary text-primary-foreground',
            'hover:bg-primary/90 active:scale-95 transition-all duration-200',
            isTerminal && 'rounded-lg border border-primary/40 bg-[hsl(var(--terminal-code-bg))] text-primary'
          )}
        >
          <BookOpen className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className={cn(
          'w-80 p-0 overflow-y-auto',
          isTerminal && 'bg-[hsl(var(--terminal-code-bg))] border-primary/20'
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <SheetTitle className={cn(
            'font-bold text-base',
            isTerminal && 'font-mono text-primary'
          )}>
            {isTerminal ? '$ cat TOC' : '목차'}
          </SheetTitle>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <TableOfContents
            content={content}
            onClose={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TableOfContents;
