import { Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TagListProps {
  tags: string[];
  maxVisible?: number;
  showIcon?: boolean;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  label?: string;
  title?: string;
}

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

function sanitizeTagLabel(value: unknown): string {
  return String(value ?? '')
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();
}

function sanitizeOptionalTagText(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const sanitized = sanitizeTagLabel(value);

  return sanitized.length > 0 ? sanitized : undefined;
}

export function TagList({
  tags,
  maxVisible = 2,
  showIcon = true,
  variant = 'secondary',
  className = '',
  size = 'default',
  label,
  title,
}: TagListProps) {
  if (!tags || tags.length === 0) return null;

  const safeTags = tags.map(sanitizeTagLabel).filter(Boolean);
  if (safeTags.length === 0) return null;

  const safeMaxVisible = Math.max(0, Math.floor(maxVisible));
  const visibleTags = safeTags.slice(0, safeMaxVisible);
  const remainingCount = safeTags.length - safeMaxVisible;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 rounded-full',
    default: 'text-xs px-2.5 py-0.5 rounded-full',
    lg: 'text-sm px-3 py-1 rounded-full',
  };

  const iconSizes = {
    sm: 'h-2.5 w-2.5',
    default: 'h-3 w-3',
    lg: 'h-3.5 w-3.5',
  };

  return (
    <div
      className={`flex items-center gap-1 flex-wrap ${className}`}
      aria-label={sanitizeOptionalTagText(label)}
      title={sanitizeOptionalTagText(title)}
    >
      {showIcon && <Tag className={iconSizes[size]} aria-hidden="true" />}
      {visibleTags.map((tag, index) => (
        <Badge
          key={`${tag}-${index}`}
          variant={variant}
          className={`${sizeClasses[size]} whitespace-nowrap bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200`}
        >
          {tag}
        </Badge>
      ))}
      {remainingCount > 0 && (
        <span
          className={`${sizeClasses[size]} text-muted-foreground`}
          aria-label={`${remainingCount} more tags`}
        >
          +{remainingCount}
        </span>
      )}
    </div>
  );
}
