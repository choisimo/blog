import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const BlogCardSkeleton = () => {
  return (
    <Card className='h-full transition-all duration-300 hover:shadow-lg border-l-4 border-l-primary/20'>
      <CardHeader className='space-y-3'>
        <div className='flex items-center justify-between'>
          <Skeleton className='h-4 w-16' />
          <Skeleton className='h-4 w-20' />
        </div>
        <Skeleton className='h-6 w-full' />
        <Skeleton className='h-6 w-3/4' />
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-2/3' />
        </div>
        <div className='flex flex-wrap gap-2'>
          <Skeleton className='h-6 w-16' />
          <Skeleton className='h-6 w-20' />
          <Skeleton className='h-6 w-14' />
        </div>
        <div className='flex items-center justify-between pt-4'>
          <Skeleton className='h-4 w-24' />
          <Skeleton className='h-9 w-20' />
        </div>
      </CardContent>
    </Card>
  );
};

export default BlogCardSkeleton;
