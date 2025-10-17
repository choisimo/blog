import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { X, Clock, Map, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export type VisitedPostItem = {
  path: string; // "/blog/:year/:slug"
  title: string;
  coverImage?: string;
  year: string;
  slug: string;
};

const STORAGE_KEY = 'visited.posts';

function useVisitedPosts() {
  const [items, setItems] = useState<VisitedPostItem[]>([]);

  const read = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr: VisitedPostItem[] = raw ? JSON.parse(raw) : [];
      setItems(Array.isArray(arr) ? arr : []);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    read();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === STORAGE_KEY) read();
    };
    const onCustom = () => read();
    window.addEventListener('storage', onStorage);
    window.addEventListener('visitedposts:update', onCustom as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('visitedposts:update', onCustom as EventListener);
    };
  }, []);

  return items;
}

function FallbackAvatar({ title }: { title: string }) {
  const ch = (title || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-primary-foreground text-xs font-bold ring-2 ring-background shadow" aria-hidden>
      {ch}
    </div>
  );
}

export function VisitedPostsMinimap() {
  const items = useVisitedPosts();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const topStack = useMemo(() => items.slice(0, 4), [items]);

  const go = (p: VisitedPostItem) => {
    setOpen(false);
    navigate(p.path);
    // Scroll reset is handled by BlogPost's effect
  };

  if (!items.length) return null;

  return (
    <div className="fixed bottom-8 right-24 z-50 select-none">
      {/* Collapsed stack button */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="shadow-lg backdrop-blur-sm"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-label="Visited posts minimap"
        >
          <Map className="mr-2 h-4 w-4" />
          History
          {open ? <ChevronDown className="ml-1 h-3 w-3" /> : <ChevronUp className="ml-1 h-3 w-3" />}
        </Button>
        <div className="relative h-8 w-[80px]" aria-hidden>
          {topStack.map((p, i) => (
            <div
              key={p.path}
              className={cn(
                'absolute top-0 h-8 w-8 overflow-hidden rounded-full ring-2 ring-background shadow translate-x-0',
                `right-[${i * 18}px]` // approximate stagger
              )}
              style={{ right: i * 18 }}
              title={p.title}
            >
              {p.coverImage ? (
                <img src={p.coverImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <FallbackAvatar title={p.title} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Expanded panel */}
      {open && (
        <Card className="mt-3 w-[320px] max-h-[60vh] overflow-hidden border shadow-xl">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Map className="h-4 w-4" />
              Recently visited
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close minimap">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Separator />
          <div className="max-h-[52vh] overflow-y-auto p-2">
            <ul className="space-y-1">
              {items.map(p => (
                <li key={p.path}>
                  <button
                    onClick={() => go(p)}
                    className="group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted"
                  >
                    <div className="h-8 w-8 overflow-hidden rounded">
                      {p.coverImage ? (
                        <img src={p.coverImage} alt="" className="h-8 w-8 object-cover" />
                      ) : (
                        <FallbackAvatar title={p.title} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium group-hover:text-primary">{p.title}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {p.year}/{p.slug}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
}

export default VisitedPostsMinimap;
