import { Skeleton } from '@/components/ui/skeleton';

const BlogSkeletonSpotlight = () => {
  return (
    <div className='flex gap-4 rounded-2xl border border-border/40 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-[hsl(var(--card-blog))]'>
      <Skeleton className='h-24 w-24 flex-shrink-0 rounded-xl' />
      <div className='flex-1 space-y-2 min-w-0'>
        <Skeleton className='h-5 w-20 rounded-full' />
        <Skeleton className='h-5 w-full' />
        <Skeleton className='h-5 w-5/6' />
        <div className='space-y-1.5'>
          <Skeleton className='h-3.5 w-full' />
          <Skeleton className='h-3.5 w-full' />
          <Skeleton className='h-3.5 w-3/4' />
        </div>
      </div>
    </div>
  );
};

export default BlogSkeletonSpotlight;
