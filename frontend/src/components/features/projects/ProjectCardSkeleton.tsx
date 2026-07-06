import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ProjectCardSkeletonProps {
  label?: string;
  title?: string;
}

const PROJECT_SKELETON_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const PROJECT_SKELETON_ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const PROJECT_SKELETON_WHITESPACE_PATTERN = /\s+/g;
const DEFAULT_PROJECT_SKELETON_LABEL = 'Loading project card';

function normalizeProjectSkeletonText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;

  const normalized = String(value)
    .replace(PROJECT_SKELETON_ANSI_ESCAPE_PATTERN, ' ')
    .replace(PROJECT_SKELETON_CONTROL_PATTERN, ' ')
    .replace(PROJECT_SKELETON_WHITESPACE_PATTERN, ' ')
    .trim();

  return normalized || fallback;
}

function normalizeOptionalProjectSkeletonText(value: unknown): string | undefined {
  return normalizeProjectSkeletonText(value) || undefined;
}

export function ProjectCardSkeleton({
  label = DEFAULT_PROJECT_SKELETON_LABEL,
  title,
}: ProjectCardSkeletonProps = {}) {
  const safeLabel = normalizeProjectSkeletonText(label, DEFAULT_PROJECT_SKELETON_LABEL);
  const safeTitle = normalizeOptionalProjectSkeletonText(title);

  return (
    <Card
      role='status'
      aria-busy='true'
      aria-label={safeLabel}
      title={safeTitle}
      className='flex h-full flex-col overflow-hidden border-border/60 bg-card/70 backdrop-blur'
    >
      <div className='relative aspect-[16/9] overflow-hidden border-b border-border/60'>
        <Skeleton aria-hidden='true' className='h-full w-full rounded-none' />
      </div>

      <CardHeader className='space-y-2 pb-3'>
        <div className='flex items-center justify-between gap-3'>
          <Skeleton aria-hidden='true' className='h-6 w-20 rounded-full' />
          <Skeleton aria-hidden='true' className='h-5 w-14 rounded-full' />
        </div>
        <Skeleton aria-hidden='true' className='h-6 w-3/4' />
        <Skeleton aria-hidden='true' className='h-4 w-full' />
        <Skeleton aria-hidden='true' className='h-4 w-5/6' />
      </CardHeader>

      <CardContent className='mt-auto space-y-4'>
        <div className='flex flex-wrap gap-1.5'>
          <Skeleton aria-hidden='true' className='h-6 w-16 rounded-full' />
          <Skeleton aria-hidden='true' className='h-6 w-20 rounded-full' />
          <Skeleton aria-hidden='true' className='h-6 w-14 rounded-full' />
        </div>

        <div className='grid grid-cols-2 gap-2'>
          <Skeleton aria-hidden='true' className='h-9 w-full' />
          <Skeleton aria-hidden='true' className='h-9 w-full' />
        </div>
        <Skeleton aria-hidden='true' className='h-9 w-full' />
      </CardContent>
    </Card>
  );
}
