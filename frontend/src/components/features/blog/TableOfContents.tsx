import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTheme } from '@/contexts/ThemeContext';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
  const [isPinnedToBoundary, setIsPinnedToBoundary] = useState(false);
  const [pinnedTop, setPinnedTop] = useState<number>(0);
  const [isStuck, setIsStuck] = useState(false);
  const [animateDropIn, setAnimateDropIn] = useState(false);
  
  // Refs for scroll optimization
  const rafRef = useRef<number | null>(null);
  const lastScrollTime = useRef<number>(0);
  const THROTTLE_MS = 100; // Throttle scroll events to 100ms
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const STICKY_TOP_PX = 96; // top-24
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
      const boundaryEl = document.querySelector('[data-toc-boundary]') as HTMLElement | null;
      const tocEl = containerRef.current;
      const offsetParent = tocEl?.offsetParent as HTMLElement | null;
      if (!boundaryEl || !tocEl || !offsetParent) {
        setIsPinnedToBoundary(false);
        if (isStuckRef.current) {
          isStuckRef.current = false;
          setIsStuck(false);
        }
        return;
      }

      const boundaryBottom = boundaryEl.getBoundingClientRect().bottom + window.scrollY;
      const offsetParentTop = offsetParent.getBoundingClientRect().top + window.scrollY;
      const tocHeight = tocEl.getBoundingClientRect().height;

      const stickyTopInDocument = window.scrollY + STICKY_TOP_PX;
      const wouldOverflowBoundary = stickyTopInDocument + tocHeight > boundaryBottom;

      if (wouldOverflowBoundary) {
        const topWithinParent = boundaryBottom - offsetParentTop - tocHeight;
        setPinnedTop(Math.max(0, topWithinParent));
        setIsPinnedToBoundary(true);

        if (isStuckRef.current) {
          isStuckRef.current = false;
          setIsStuck(false);
        }
      } else {
        setIsPinnedToBoundary(false);

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

    const boundaryEl = document.querySelector(
      '[data-toc-boundary]'
    ) as HTMLElement | null;

    if (typeof ResizeObserver !== 'undefined' && boundaryEl) {
      resizeObserver = new ResizeObserver(() => {
        updateTocPosition();
      });
      resizeObserver.observe(boundaryEl);
      if (containerRef.current) resizeObserver.observe(containerRef.current);
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

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (toc.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        'w-72',
        isPinnedToBoundary ? 'absolute' : 'sticky top-24'
      )}
      style={isPinnedToBoundary ? { top: pinnedTop } : undefined}
    >
      <div
        className={cn(
          'bg-card/50 backdrop-blur-sm border rounded-2xl p-6 shadow-lg',
          animateDropIn && !isPinnedToBoundary && isStuck && 'animate-in slide-in-from-top-2 fade-in duration-200',
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
        <ScrollArea ref={scrollAreaRef} className='h-[500px]'>
          <nav className='space-y-2'>
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
