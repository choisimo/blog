import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const BlogCardSkeleton = () => {
  return (
    <Card className='h-full flex flex-col border-border/50'>
      <div className='aspect-video overflow-hidden bg-muted/40'>
        <Skeleton className='w-full h-full rounded-none' />
      </div>

      <CardHeader className='pb-0 px-6 pt-6 md:px-8 md:pt-8'>
        <div className='flex justify-between items-start gap-2 mb-3'>
          <Skeleton className='h-5 w-16' />
          <Skeleton className='h-4 w-24' />
        </div>
        <Skeleton className='h-6 w-full mb-2' />
        <Skeleton className='h-6 w-3/4' />
      </CardHeader>

      <CardContent className='flex-1 pt-3 px-6 md:px-8'>
        <div className='space-y-2'>
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-2/3' />
        </div>
      </CardContent>

      <CardFooter className='flex flex-col gap-3 pt-3 px-6 pb-6 md:px-8'>
        <div className='flex items-center gap-4 w-full'>
          <Skeleton className='h-3 w-20' />
          <Skeleton className='h-3 w-16' />
        </div>
        <div className='flex gap-2 w-full'>
          <Skeleton className='h-6 w-14' />
          <Skeleton className='h-6 w-18' />
          <Skeleton className='h-6 w-12' />
        </div>
        <Skeleton className='h-9 w-full mt-2' />
      </CardFooter>
    </Card>
  );
};

export default BlogCardSkeleton;
