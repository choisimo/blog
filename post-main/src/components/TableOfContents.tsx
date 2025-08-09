import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

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
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Extract headings from markdown content
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings: TocItem[] = [];
    const usedIds = new Set<string>();
    let match: RegExpExecArray | null;
    let counter = 0;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const title = match[2].trim();
      let id = title
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
      counter++;
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
      setIsOpen(false); // Close mobile sheet
    }
  };

  if (toc.length === 0) return null;

  const TocContent = () => (
    <nav className="space-y-2">
      {toc.map((item, index) => (
        <button
          key={`${item.id}-${index}`}
          onClick={() => scrollToHeading(item.id)}
          className={cn(
            "block w-full text-left text-sm py-2 px-3 rounded-lg hover:bg-primary/10 transition-all duration-200",
            "text-muted-foreground hover:text-foreground",
            activeId === item.id && "bg-primary/15 text-primary font-semibold border-l-2 border-primary",
            item.level === 1 && "ml-0 font-medium",
            item.level === 2 && "ml-4",
            item.level === 3 && "ml-8",
            item.level === 4 && "ml-12",
            item.level === 5 && "ml-16",
            item.level === 6 && "ml-20"
          )}
        >
          <span className="block truncate">{item.title}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile TOC */}
      <div className="xl:hidden fixed bottom-4 right-4 z-50">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button size="icon" className="rounded-full shadow-lg bg-primary hover:bg-primary/90">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80">
            <SheetHeader>
              <SheetTitle className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                목차
              </SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-100px)] mt-6">
              <TocContent />
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop TOC */}
      <div className="sticky top-8 w-72 hidden xl:block">
        <div className="bg-card/50 backdrop-blur-sm border rounded-2xl p-6 shadow-lg">
          <h3 className="font-bold mb-4 text-base flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            목차
          </h3>
          <ScrollArea className="h-[500px]">
            <TocContent />
          </ScrollArea>
        </div>
      </div>
    </>
  );
};