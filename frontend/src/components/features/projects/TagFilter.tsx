import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TagFilterProps {
  tags: string[];
  selectedTag: string;
  onSelect: (tag: string) => void;
}

export function TagFilter({ tags, selectedTag, onSelect }: TagFilterProps) {
  const allTags = ['All', ...tags];

  return (
    <div className='flex flex-wrap gap-2'>
      {allTags.map(tag => {
        const active = selectedTag === tag;
        return (
          <Button
            key={tag}
            type='button'
            variant={active ? 'default' : 'outline'}
            size='sm'
            className={cn('rounded-full px-3', !active && 'text-foreground/80')}
            onClick={() => onSelect(tag)}
          >
            {tag}
          </Button>
        );
      })}
    </div>
  );
}
