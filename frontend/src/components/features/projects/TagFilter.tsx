import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TagFilterProps {
  tags: string[];
  selectedTag: string;
  onSelect: (tag: string) => void;
  label?: string;
  title?: string;
  allLabel?: string;
}

const PROJECT_FILTER_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const PROJECT_FILTER_ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const PROJECT_FILTER_WHITESPACE_PATTERN = /\s+/g;
const DEFAULT_FILTER_LABEL = 'Project tags';
const DEFAULT_ALL_LABEL = 'All';

export function normalizeProjectFilterText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;

  const normalized = String(value)
    .replace(PROJECT_FILTER_ANSI_ESCAPE_PATTERN, ' ')
    .replace(PROJECT_FILTER_CONTROL_PATTERN, ' ')
    .replace(PROJECT_FILTER_WHITESPACE_PATTERN, ' ')
    .trim();

  return normalized || fallback;
}

function normalizeOptionalProjectFilterText(value: unknown): string | undefined {
  return normalizeProjectFilterText(value) || undefined;
}

export function normalizeProjectFilterTags(
  tags: string[],
  allLabel = DEFAULT_ALL_LABEL
): string[] {
  const normalizedTags = new Set<string>();
  const safeAllLabel = normalizeProjectFilterText(allLabel, DEFAULT_ALL_LABEL);
  const allMatcher = safeAllLabel.toLowerCase();

  for (const tag of tags) {
    const normalized = normalizeProjectFilterText(tag);
    const normalizedMatcher = normalized.toLowerCase();
    if (!normalized || normalizedMatcher === 'all' || normalizedMatcher === allMatcher) continue;
    normalizedTags.add(normalized);
  }

  return [safeAllLabel, ...normalizedTags];
}

export function TagFilter({
  tags,
  selectedTag,
  onSelect,
  label = DEFAULT_FILTER_LABEL,
  title,
  allLabel = DEFAULT_ALL_LABEL,
}: TagFilterProps) {
  const safeAllLabel = normalizeProjectFilterText(allLabel, DEFAULT_ALL_LABEL);
  const allTags = normalizeProjectFilterTags(tags, safeAllLabel);
  const normalizedSelectedTag = normalizeProjectFilterText(selectedTag, safeAllLabel);
  const safeLabel = normalizeProjectFilterText(label, DEFAULT_FILTER_LABEL);
  const safeTitle = normalizeOptionalProjectFilterText(title);

  return (
    <div
      role='group'
      aria-label={safeLabel}
      title={safeTitle}
      className='flex flex-wrap gap-2'
    >
      {allTags.map(tag => {
        const active = normalizedSelectedTag === tag;
        return (
          <Button
            key={tag}
            type='button'
            variant={active ? 'default' : 'outline'}
            size='sm'
            className={cn('rounded-full px-3', !active && 'text-foreground/80')}
            onClick={() => onSelect(tag)}
            aria-pressed={active}
          >
            {tag}
          </Button>
        );
      })}
    </div>
  );
}
