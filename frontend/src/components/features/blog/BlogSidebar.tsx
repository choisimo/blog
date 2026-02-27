import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { PostCard } from './PostCard';
import type { BlogPost } from '@/types/blog';

interface CategoryItem {
  name: string;
  count: number;
}

interface BlogSidebarProps {
  categories?: CategoryItem[];
  tags?: string[];
  recentPosts?: BlogPost[];
  selectedCategory?: string;
  selectedTags?: string[];
  onCategorySelect?: (category: string) => void;
  onTagSelect?: (tag: string) => void;
  className?: string;
}

export function BlogSidebar({
  categories = [],
  tags = [],
  recentPosts = [],
  selectedCategory,
  selectedTags = [],
  onCategorySelect,
  onTagSelect,
  className,
}: BlogSidebarProps) {
  const { isTerminal } = useTheme();

  return (
    <aside className={cn('space-y-6', className)}>
      {categories.length > 0 && (
        <section className={cn(
          'rounded-xl border border-border/50 bg-card p-4',
          isTerminal && 'bg-[hsl(var(--terminal-code-bg))] border-border'
        )}>
          <h3 className={cn(
            'font-semibold mb-3 text-sm',
            isTerminal && 'font-mono text-primary'
          )}>
            {isTerminal ? '$ ls categories/' : 'Categories'}
          </h3>
          <ul className="space-y-1">
            {categories.map(cat => (
              <li key={cat.name}>
                <button
                  type="button"
                  onClick={() => onCategorySelect?.(cat.name)}
                  className={cn(
                    'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors',
                    selectedCategory === cat.name
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                    isTerminal && 'font-mono text-xs'
                  )}
                >
                  <span>{isTerminal ? `> ${cat.name}` : cat.name}</span>
                  <span className="text-xs text-muted-foreground">({cat.count})</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tags.length > 0 && (
        <section className={cn(
          'rounded-xl border border-border/50 bg-card p-4',
          isTerminal && 'bg-[hsl(var(--terminal-code-bg))] border-border'
        )}>
          <h3 className={cn(
            'font-semibold mb-3 text-sm',
            isTerminal && 'font-mono text-primary'
          )}>
            {isTerminal ? '$ cat tags.txt' : 'Popular Tags'}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(tag => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer text-xs px-2 py-0.5',
                  isTerminal && 'rounded font-mono border-primary/40',
                  selectedTags.includes(tag) && isTerminal && 'bg-primary text-primary-foreground'
                )}
                onClick={() => onTagSelect?.(tag)}
              >
                #{tag}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {recentPosts.length > 0 && (
        <section className={cn(
          'rounded-xl border border-border/50 bg-card p-4',
          isTerminal && 'bg-[hsl(var(--terminal-code-bg))] border-border'
        )}>
          <h3 className={cn(
            'font-semibold mb-3 text-sm',
            isTerminal && 'font-mono text-primary'
          )}>
            {isTerminal ? '$ tail -n 5 posts.log' : 'Recent Posts'}
          </h3>
          <ul className="space-y-1">
            {recentPosts.slice(0, 5).map(post => (
              <li key={`${post.year}/${post.slug}`}>
                <PostCard post={post} variant="mini" showBookmark={false} showTilt={false} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}

export default BlogSidebar;
