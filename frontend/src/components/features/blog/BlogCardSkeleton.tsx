import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface BlogCardSkeletonProps {
  label?: string;
  title?: string;
}

const BLOG_SKELETON_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const BLOG_SKELETON_ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const BLOG_SKELETON_WHITESPACE_PATTERN = /\s+/g;
const DEFAULT_BLOG_SKELETON_LABEL = 'Loading blog post';

function normalizeBlogSkeletonText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;

  const normalized = String(value)
    .replace(BLOG_SKELETON_ANSI_ESCAPE_PATTERN, ' ')
    .replace(BLOG_SKELETON_CONTROL_PATTERN, ' ')
    .replace(BLOG_SKELETON_WHITESPACE_PATTERN, ' ')
    .trim();

  return normalized || fallback;
}

function normalizeOptionalBlogSkeletonText(value: unknown): string | undefined {
  return normalizeBlogSkeletonText(value) || undefined;
}

const BlogCardSkeleton = ({
  label = DEFAULT_BLOG_SKELETON_LABEL,
  title,
}: BlogCardSkeletonProps = {}) => {
  const safeLabel = normalizeBlogSkeletonText(label, DEFAULT_BLOG_SKELETON_LABEL);
  const safeTitle = normalizeOptionalBlogSkeletonText(title);

  return (
    <Card
      role='status'
      aria-busy='true'
      aria-label={safeLabel}
      title={safeTitle}
      className='h-full flex flex-col border-border/50'
    >
      <div className='aspect-video overflow-hidden bg-muted/40'>
        <Skeleton aria-hidden='true' className='w-full h-full rounded-none' />
      </div>

      <CardHeader className='pb-0 px-6 pt-6 md:px-8 md:pt-8'>
        <div className='flex justify-between items-start gap-2 mb-3'>
          <Skeleton aria-hidden='true' className='h-5 w-16' />
          <Skeleton aria-hidden='true' className='h-4 w-24' />
        </div>
        <Skeleton aria-hidden='true' className='h-6 w-full mb-2' />
        <Skeleton aria-hidden='true' className='h-6 w-3/4' />
      </CardHeader>

      <CardContent className='flex-1 pt-3 px-6 md:px-8'>
        <div className='space-y-2'>
          <Skeleton aria-hidden='true' className='h-4 w-full' />
          <Skeleton aria-hidden='true' className='h-4 w-full' />
          <Skeleton aria-hidden='true' className='h-4 w-2/3' />
        </div>
      </CardContent>

      <CardFooter className='flex flex-col gap-3 pt-3 px-6 pb-6 md:px-8'>
        <div className='flex items-center gap-4 w-full'>
          <Skeleton aria-hidden='true' className='h-3 w-20' />
          <Skeleton aria-hidden='true' className='h-3 w-16' />
        </div>
        <div className='flex gap-2 w-full'>
          <Skeleton aria-hidden='true' className='h-6 w-14' />
          <Skeleton aria-hidden='true' className='h-6 w-18' />
          <Skeleton aria-hidden='true' className='h-6 w-12' />
        </div>
        <Skeleton aria-hidden='true' className='h-9 w-full mt-2' />
      </CardFooter>
    </Card>
  );
};

export default BlogCardSkeleton;
