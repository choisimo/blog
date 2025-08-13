import { Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TagListProps {
  tags: string[];
  maxVisible?: number;
  showIcon?: boolean;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}

export function TagList({
  tags,
  maxVisible = 2,
  showIcon = true,
  variant = 'outline',
  className = '',
}: TagListProps) {
  if (!tags || tags.length === 0) return null;

  const visibleTags = tags.slice(0, maxVisible);
  const remainingCount = tags.length - maxVisible;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {showIcon && <Tag className="h-3 w-3" />}
      {visibleTags.map(tag => (
        <Badge key={tag} variant={variant} className="text-xs">
          {tag}
        </Badge>
      ))}
      {remainingCount > 0 && (
        <span className="text-xs text-muted-foreground">+{remainingCount}</span>
      )}
    </div>
  );
}