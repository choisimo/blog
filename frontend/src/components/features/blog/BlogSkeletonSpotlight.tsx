import { Skeleton } from '@/components/ui/skeleton';

interface BlogSkeletonSpotlightProps {
  label?: string;
  title?: string;
}

const DEFAULT_LOADING_LABEL = 'Loading spotlight blog post';
const DEFAULT_LOADING_TITLE = 'Spotlight blog post placeholder';
const ANSI_ESCAPE_PATTERN = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/g;

const sanitizeSkeletonText = (value: string | undefined, fallback: string): string => {
  const sanitized = value?.replace(ANSI_ESCAPE_PATTERN, '').replace(CONTROL_CHARACTER_PATTERN, '').trim();

  return sanitized && sanitized.length > 0 ? sanitized : fallback;
};

const BlogSkeletonSpotlight = ({ label, title }: BlogSkeletonSpotlightProps) => {
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
      <Skeleton aria-hidden='true' className='h-24 w-24 flex-shrink-0 rounded-xl' />
      <div className='flex-1 space-y-2 min-w-0'>
        <Skeleton aria-hidden='true' className='h-5 w-20 rounded-full' />
        <Skeleton aria-hidden='true' className='h-5 w-full' />
        <Skeleton aria-hidden='true' className='h-5 w-5/6' />
        <div className='space-y-1.5'>
          <Skeleton aria-hidden='true' className='h-3.5 w-full' />
          <Skeleton aria-hidden='true' className='h-3.5 w-full' />
          <Skeleton aria-hidden='true' className='h-3.5 w-3/4' />
        </div>
      </div>
    </div>
  );
};

export default BlogSkeletonSpotlight;
