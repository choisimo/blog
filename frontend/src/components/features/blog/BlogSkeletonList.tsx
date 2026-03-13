import { Skeleton } from '@/components/ui/skeleton';

const BlogSkeletonList = () => {
  return (
    <div className='flex gap-4 rounded-2xl border border-border/40 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-[hsl(var(--card-blog))]'>
      <Skeleton className='h-20 w-20 flex-shrink-0 rounded-xl' />
      <div className='flex-1 space-y-1.5 min-w-0'>
        <div className='flex items-center gap-2'>
          <Skeleton className='h-3.5 w-16' />
          <Skeleton className='h-3.5 w-3' />
          <Skeleton className='h-3.5 w-20' />
        </div>
        <Skeleton className='h-5 w-full' />
        <Skeleton className='h-5 w-4/5' />
        <div className='space-y-1'>
          <Skeleton className='h-3.5 w-full' />
          <Skeleton className='h-3.5 w-full' />
          <Skeleton className='h-3.5 w-2/3' />
        </div>
      </div>
    </div>
  );
};

export default BlogSkeletonList;
