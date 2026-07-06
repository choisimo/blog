import { Skeleton } from '@/components/ui/skeleton';

interface BlogSkeletonListProps {
  label?: string;
  title?: string;
}

const DEFAULT_LOADING_LABEL = 'Loading blog post preview';
const DEFAULT_LOADING_TITLE = 'Blog post preview placeholder';
const ANSI_ESCAPE_PATTERN = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/g;

const sanitizeSkeletonText = (value: string | undefined, fallback: string): string => {
  const sanitized = value?.replace(ANSI_ESCAPE_PATTERN, '').replace(CONTROL_CHARACTER_PATTERN, '').trim();

  return sanitized && sanitized.length > 0 ? sanitized : fallback;
};

const BlogSkeletonList = ({ label, title }: BlogSkeletonListProps) => {
  const statusLabel = sanitizeSkeletonText(label, DEFAULT_LOADING_LABEL);
  const statusTitle = sanitizeSkeletonText(title, DEFAULT_LOADING_TITLE);

  return (
    <div
      aria-busy='true'
      aria-label={statusLabel}
      className='flex gap-4 rounded-2xl border border-border/40 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-[hsl(var(--card-blog))]'
      role='status'
      title={statusTitle}
    >
      <Skeleton aria-hidden='true' className='h-20 w-20 flex-shrink-0 rounded-xl' />
      <div className='flex-1 space-y-1.5 min-w-0'>
        <div className='flex items-center gap-2'>
          <Skeleton aria-hidden='true' className='h-3.5 w-16' />
          <Skeleton aria-hidden='true' className='h-3.5 w-3' />
          <Skeleton aria-hidden='true' className='h-3.5 w-20' />
        </div>
        <Skeleton aria-hidden='true' className='h-5 w-full' />
        <Skeleton aria-hidden='true' className='h-5 w-4/5' />
        <div className='space-y-1'>
          <Skeleton aria-hidden='true' className='h-3.5 w-full' />
          <Skeleton aria-hidden='true' className='h-3.5 w-full' />
          <Skeleton aria-hidden='true' className='h-3.5 w-2/3' />
        </div>
      </div>
    </div>
  );
};

export default BlogSkeletonList;
