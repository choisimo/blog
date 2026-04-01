import { Skeleton } from '@/components/ui/skeleton';

const BlogSkeletonFeatured = () => {
  return (
    <div className='rounded-[28px] border border-border/40 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-[hsl(var(--card-blog))]'>
      <div className='space-y-4'>
        <Skeleton className='aspect-[16/9] w-full rounded-3xl' />
        <div className='flex items-center gap-3'>
          <Skeleton className='h-6 w-20 rounded-full' />
          <Skeleton className='h-4 w-24' />
          <Skeleton className='h-4 w-16' />
        </div>
        <div className='space-y-2'>
          <Skeleton className='h-7 w-full' />
          <Skeleton className='h-7 w-4/5' />
        </div>
        <div className='space-y-2'>
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-3/4' />
        </div>
      </div>
    </div>
  );
};

export default BlogSkeletonFeatured;
