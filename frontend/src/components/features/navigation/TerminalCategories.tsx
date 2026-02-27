import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Folder, FolderOpen, FileText, ChevronRight } from 'lucide-react';

type CategoryNode = {
  name: string;
  count: number;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
  children?: CategoryNode[];
};

type TerminalCategoriesProps = {
  categories: CategoryNode[];
  onSelect?: (category: string) => void;
  className?: string;
};

export default function TerminalCategories({ 
  categories, 
  onSelect, 
  className 
}: TerminalCategoriesProps) {
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [inputBuffer, setInputBuffer] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const flattenedCategories = categories.flatMap((cat, i) => {
    const items = [{ ...cat, depth: 0, index: i }];
    if (cat.children && expandedPaths.has(cat.name)) {
      cat.children.forEach((child, j) => {
        items.push({ ...child, depth: 1, index: i * 100 + j });
      });
    }
    return items;
  });

  const handleSelect = useCallback((categoryName: string) => {
    if (onSelect) {
      onSelect(categoryName);
    } else {
      navigate(`/blog?category=${encodeURIComponent(categoryName)}`);
    }
  }, [navigate, onSelect]);

  const toggleExpand = useCallback((name: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;

      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, flattenedCategories.length - 1));
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
        case 'l':
          e.preventDefault();
          const selected = flattenedCategories[selectedIndex];
          if (selected) {
            if (selected.children && selected.children.length > 0) {
              toggleExpand(selected.name);
            } else {
              handleSelect(selected.name);
            }
          }
          break;
        case 'h':
        case 'ArrowLeft':
          e.preventDefault();
          const current = flattenedCategories[selectedIndex];
          if (current && expandedPaths.has(current.name)) {
            toggleExpand(current.name);
          }
          break;
        case '/':
          e.preventDefault();
          setInputBuffer('');
          break;
        case 'Escape':
          setInputBuffer('');
          break;
        default:
          if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
            const newBuffer = inputBuffer + e.key.toLowerCase();
            setInputBuffer(newBuffer);
            const matchIndex = flattenedCategories.findIndex(c => 
              c.name.toLowerCase().startsWith(newBuffer)
            );
            if (matchIndex !== -1) {
              setSelectedIndex(matchIndex);
            }
            setTimeout(() => setInputBuffer(''), 1000);
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flattenedCategories, selectedIndex, expandedPaths, inputBuffer, handleSelect, toggleExpand]);

  const renderTreeLine = (depth: number, isLast: boolean) => {
    if (depth === 0) return '';
    return isLast ? '└── ' : '├── ';
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={cn(
        'rounded-lg border border-primary/30 bg-[hsl(var(--terminal-code-bg))] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50',
        className
      )}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-primary/20 bg-primary/5">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <div className="flex-1 text-center text-xs text-muted-foreground">
          ~/blog/categories
        </div>
      </div>
      
      <div className="px-4 py-3 border-b border-primary/10">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-primary">$</span>
          <span>ls -la ./categories</span>
          <span className="animate-pulse text-primary">▌</span>
        </div>
      </div>

      <div className="py-2">
        <div className="px-4 py-1 text-xs text-muted-foreground/60">
          total {categories.reduce((sum, c) => sum + c.count, 0)} posts
        </div>
        
        {flattenedCategories.map((cat, idx) => {
          const isSelected = idx === selectedIndex;
          const isExpanded = expandedPaths.has(cat.name);
          const hasChildren = cat.children && cat.children.length > 0;
          const isLastAtDepth = idx === flattenedCategories.length - 1 || 
            (flattenedCategories[idx + 1]?.depth ?? 0) < (cat.depth ?? 0);
          
          return (
            <button
              key={`${cat.name}-${idx}`}
              onClick={() => {
                setSelectedIndex(idx);
                if (hasChildren) {
                  toggleExpand(cat.name);
                } else {
                  handleSelect(cat.name);
                }
              }}
              className={cn(
                'w-full text-left px-4 py-1.5 flex items-center gap-2 transition-colors',
                'hover:bg-primary/10',
                isSelected && 'bg-primary/20 border-l-2 border-primary'
              )}
            >
              <span className="text-muted-foreground/50 w-16 text-xs">
                drwxr-xr-x
              </span>
              
              <span className="text-muted-foreground/50 w-8 text-right text-xs">
                {cat.count}
              </span>
              
              <span className="text-muted-foreground/40">
                {renderTreeLine(cat.depth ?? 0, isLastAtDepth)}
              </span>
              
              <span className={cn(
                'flex items-center gap-1.5',
                isSelected && 'text-primary terminal-glow'
              )}>
                {hasChildren ? (
                  isExpanded ? (
                    <FolderOpen className="h-4 w-4 text-yellow-500" />
                  ) : (
                    <Folder className="h-4 w-4 text-yellow-500/70" />
                  )
                ) : (
                  <FileText className="h-4 w-4 text-blue-400" />
                )}
                <span>{cat.name}/</span>
              </span>
              
              {hasChildren && (
                <ChevronRight className={cn(
                  'h-3 w-3 text-muted-foreground/50 transition-transform ml-auto',
                  isExpanded && 'rotate-90'
                )} />
              )}
            </button>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-primary/10 text-xs text-muted-foreground/60">
        <span className="text-primary">hint:</span> j/k to navigate, Enter to select, h/l to collapse/expand
      </div>
    </div>
  );
}
