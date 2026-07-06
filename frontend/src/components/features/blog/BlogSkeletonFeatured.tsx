import { Skeleton } from '@/components/ui/skeleton';

interface BlogSkeletonFeaturedProps {
  label?: string;
  title?: string;
}

const FEATURED_SKELETON_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const FEATURED_SKELETON_ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const FEATURED_SKELETON_WHITESPACE_PATTERN = /\s+/g;
const DEFAULT_FEATURED_SKELETON_LABEL = 'Loading featured blog post';

function normalizeFeaturedSkeletonText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;

  const normalized = String(value)
    .replace(FEATURED_SKELETON_ANSI_ESCAPE_PATTERN, ' ')
    .replace(FEATURED_SKELETON_CONTROL_PATTERN, ' ')
    .replace(FEATURED_SKELETON_WHITESPACE_PATTERN, ' ')
    .trim();

  return normalized || fallback;
}

function normalizeOptionalFeaturedSkeletonText(value: unknown): string | undefined {
  return normalizeFeaturedSkeletonText(value) || undefined;
}

const BlogSkeletonFeatured = ({
  label = DEFAULT_FEATURED_SKELETON_LABEL,
  title,
}: BlogSkeletonFeaturedProps = {}) => {
  const safeLabel = normalizeFeaturedSkeletonText(label, DEFAULT_FEATURED_SKELETON_LABEL);
  const safeTitle = normalizeOptionalFeaturedSkeletonText(title);

  return (
    <div
      role='status'
      aria-busy='true'
      aria-label={safeLabel}
      title={safeTitle}
      className='rounded-[28px] border border-border/40 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-[hsl(var(--card-blog))]'
    >
      <div className='space-y-4'>
        <Skeleton aria-hidden='true' className='aspect-[16/9] w-full rounded-3xl' />
        <div className='flex items-center gap-3'>
          <Skeleton aria-hidden='true' className='h-6 w-20 rounded-full' />
          <Skeleton aria-hidden='true' className='h-4 w-24' />
          <Skeleton aria-hidden='true' className='h-4 w-16' />
        </div>
        <div className='space-y-2'>
          <Skeleton aria-hidden='true' className='h-7 w-full' />
          <Skeleton aria-hidden='true' className='h-7 w-4/5' />
        </div>
        <div className='space-y-2'>
          <Skeleton aria-hidden='true' className='h-4 w-full' />
          <Skeleton aria-hidden='true' className='h-4 w-full' />
          <Skeleton aria-hidden='true' className='h-4 w-3/4' />
        </div>
      </div>
    </div>
  );
};

export default BlogSkeletonFeatured;
