import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type ActiveFiltersProps = {
  tags: string[];
  onRemove: (tag: string) => void;
  onClearAll: () => void;
};

export function ActiveFilters({ tags, onRemove, onClearAll }: ActiveFiltersProps) {
  if (!tags.length) return null;

  return (
    <div className='bg-card/50 backdrop-blur-sm border rounded-xl p-4 md:p-6 shadow-sm'>
      <div className='flex flex-col gap-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-sm font-medium text-muted-foreground mr-1'>
            Active filters
          </span>
          {tags.map(tag => (
            <Badge
              key={tag}
              variant='secondary'
              className='flex items-center gap-1 rounded-full bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground'
            >
              #{tag}
              <button
                type='button'
                onClick={() => onRemove(tag)}
                className='inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                aria-label={`Remove filter ${tag}`}
              >
                <X className='h-3 w-3' aria-hidden='true' />
              </button>
            </Badge>
          ))}
        </div>
        <div>
          <Button
            variant='ghost'
            size='sm'
            onClick={onClearAll}
            className='w-fit'
          >
            <X className='h-4 w-4 mr-2' aria-hidden='true' />
            Clear all filters
          </Button>
        </div>
      </div>
    </div>
  );
}
