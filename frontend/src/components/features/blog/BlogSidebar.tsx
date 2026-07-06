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
  label?: string;
  title?: string;
  categoriesLabel?: string;
  tagsLabel?: string;
  recentPostsLabel?: string;
  categoryButtonLabel?: string;
  tagButtonLabel?: string;
}

const SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const ENCODED_SINGLE_LINE_CONTROL_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;
const WHITESPACE_PATTERN = /\s+/g;
const DEFAULT_SIDEBAR_LABEL = 'Blog sidebar';
const DEFAULT_CATEGORIES_LABEL = 'Categories';
const DEFAULT_TAGS_LABEL = 'Popular Tags';
const DEFAULT_RECENT_POSTS_LABEL = 'Recent Posts';
const DEFAULT_CATEGORY_BUTTON_LABEL = 'Category';
const DEFAULT_TAG_BUTTON_LABEL = 'Tag';

function normalizeSidebarText(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  if (ENCODED_SINGLE_LINE_CONTROL_PATTERN.test(String(value))) return '';

  return String(value)
    .replace(ANSI_ESCAPE_PATTERN, ' ')
    .replace(SINGLE_LINE_CONTROL_PATTERN, ' ')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();
}

function normalizeSidebarLabel(value: unknown, fallback: string): string {
  return normalizeSidebarText(value) || fallback;
}

function normalizeOptionalSidebarText(value: unknown): string | undefined {
  return normalizeSidebarText(value) || undefined;
}

function normalizeCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

function normalizeKeyPart(value: unknown, fallback: string): string {
  return encodeURIComponent(normalizeSidebarText(value) || fallback);
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
  label = DEFAULT_SIDEBAR_LABEL,
  title,
  categoriesLabel = DEFAULT_CATEGORIES_LABEL,
  tagsLabel = DEFAULT_TAGS_LABEL,
  recentPostsLabel = DEFAULT_RECENT_POSTS_LABEL,
  categoryButtonLabel = DEFAULT_CATEGORY_BUTTON_LABEL,
  tagButtonLabel = DEFAULT_TAG_BUTTON_LABEL,
}: BlogSidebarProps) {
  const { isTerminal } = useTheme();
  const safeSelectedCategory = normalizeSidebarText(selectedCategory);
  const safeSelectedTags = selectedTags.map(normalizeSidebarText).filter(Boolean);
  const safeSidebarLabel = normalizeSidebarLabel(label, DEFAULT_SIDEBAR_LABEL);
  const safeSidebarTitle = normalizeOptionalSidebarText(title);
  const safeCategoriesLabel = normalizeSidebarLabel(categoriesLabel, DEFAULT_CATEGORIES_LABEL);
  const safeTagsLabel = normalizeSidebarLabel(tagsLabel, DEFAULT_TAGS_LABEL);
  const safeRecentPostsLabel = normalizeSidebarLabel(recentPostsLabel, DEFAULT_RECENT_POSTS_LABEL);
  const safeCategoryButtonLabel = normalizeSidebarLabel(
    categoryButtonLabel,
    DEFAULT_CATEGORY_BUTTON_LABEL
  );
  const safeTagButtonLabel = normalizeSidebarLabel(tagButtonLabel, DEFAULT_TAG_BUTTON_LABEL);
  const safeCategories = categories
    .map(cat => ({
      name: normalizeSidebarText(cat.name),
      count: normalizeCount(cat.count),
    }))
    .filter(cat => cat.name);
  const safeTags = tags.map(normalizeSidebarText).filter(Boolean);

  return (
    <aside
      aria-label={safeSidebarLabel}
      title={safeSidebarTitle}
      className={cn('space-y-6', className)}
    >
      {safeCategories.length > 0 && (
        <section
          aria-label={safeCategoriesLabel}
          className={cn(
          'rounded-xl border border-border/50 bg-card p-4',
          isTerminal && 'bg-[hsl(var(--terminal-code-bg))] border-border'
        )}>
          <h3 className={cn(
            'font-semibold mb-3 text-sm',
            isTerminal && 'font-mono text-primary'
          )}>
            {isTerminal ? `$ ls ${safeCategoriesLabel.toLowerCase()}/` : safeCategoriesLabel}
          </h3>
          <ul className="space-y-1">
            {safeCategories.map(cat => {
              const active = safeSelectedCategory === cat.name;
              return (
                <li key={cat.name}>
                  <button
                    type="button"
                    aria-label={`${safeCategoryButtonLabel}: ${cat.name}`}
                    aria-pressed={active}
                    onClick={() => onCategorySelect?.(cat.name)}
                    className={cn(
                      'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors',
                      active
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      isTerminal && 'font-mono text-xs'
                    )}
                  >
                    <span>{isTerminal ? `> ${cat.name}` : cat.name}</span>
                    <span className="text-xs text-muted-foreground">({cat.count})</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {safeTags.length > 0 && (
        <section
          aria-label={safeTagsLabel}
          className={cn(
          'rounded-xl border border-border/50 bg-card p-4',
          isTerminal && 'bg-[hsl(var(--terminal-code-bg))] border-border'
        )}>
          <h3 className={cn(
            'font-semibold mb-3 text-sm',
            isTerminal && 'font-mono text-primary'
          )}>
            {isTerminal ? '$ cat tags.txt' : safeTagsLabel}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {safeTags.map(tag => {
              const active = safeSelectedTags.includes(tag);
              return (
                <Badge
                  key={tag}
                  role="button"
                  tabIndex={0}
                  aria-label={`${safeTagButtonLabel}: ${tag}`}
                  aria-pressed={active}
                  variant={active ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer text-xs px-2 py-0.5',
                    isTerminal && 'rounded font-mono border-primary/40',
                    active && isTerminal && 'bg-primary text-primary-foreground'
                  )}
                  onClick={() => onTagSelect?.(tag)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    onTagSelect?.(tag);
                  }}
                >
                  #{tag}
                </Badge>
              );
            })}
          </div>
        </section>
      )}

      {recentPosts.length > 0 && (
        <section
          aria-label={safeRecentPostsLabel}
          className={cn(
          'rounded-xl border border-border/50 bg-card p-4',
          isTerminal && 'bg-[hsl(var(--terminal-code-bg))] border-border'
        )}>
          <h3 className={cn(
            'font-semibold mb-3 text-sm',
            isTerminal && 'font-mono text-primary'
          )}>
            {isTerminal ? '$ tail -n 5 posts.log' : safeRecentPostsLabel}
          </h3>
          <ul className="space-y-1">
            {recentPosts.slice(0, 5).map(post => (
              <li key={`${normalizeKeyPart(post.year, 'year')}/${normalizeKeyPart(post.slug, 'slug')}`}>
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
