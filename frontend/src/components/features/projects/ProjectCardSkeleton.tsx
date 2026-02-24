import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ProjectCardSkeleton() {
  return (
    <Card className='flex h-full flex-col overflow-hidden border-border/60 bg-card/70 backdrop-blur'>
      <div className='relative aspect-[16/9] overflow-hidden border-b border-border/60'>
        <Skeleton className='h-full w-full rounded-none' />
      </div>

      <CardHeader className='space-y-2 pb-3'>
        <div className='flex items-center justify-between gap-3'>
          <Skeleton className='h-6 w-20 rounded-full' />
          <Skeleton className='h-5 w-14 rounded-full' />
        </div>
        <Skeleton className='h-6 w-3/4' />
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-5/6' />
      </CardHeader>

      <CardContent className='mt-auto space-y-4'>
        <div className='flex flex-wrap gap-1.5'>
          <Skeleton className='h-6 w-16 rounded-full' />
          <Skeleton className='h-6 w-20 rounded-full' />
          <Skeleton className='h-6 w-14 rounded-full' />
        </div>

        <div className='grid grid-cols-2 gap-2'>
          <Skeleton className='h-9 w-full' />
          <Skeleton className='h-9 w-full' />
        </div>
        <Skeleton className='h-9 w-full' />
      </CardContent>
    </Card>
  );
}
