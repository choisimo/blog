interface ProjectCardSkeletonProps {
  label?: string;
  title?: string;
  presentation?: 'card' | 'list';
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

function normalizeOptionalProjectSkeletonText(
  value: unknown
): string | undefined {
  return normalizeProjectSkeletonText(value) || undefined;
}

export function ProjectCardSkeleton({
  label = DEFAULT_PROJECT_SKELETON_LABEL,
  title,
  presentation = 'card',
}: ProjectCardSkeletonProps = {}) {
  const safeLabel = normalizeProjectSkeletonText(
    label,
    DEFAULT_PROJECT_SKELETON_LABEL
  );
  const safeTitle = normalizeOptionalProjectSkeletonText(title);

  return (
    <div
      role='status'
      aria-busy='true'
      aria-label={safeLabel}
      title={safeTitle}
      className={`ui-project-item ui-project-item--${presentation} ui-project-item--skeleton`}
    >
      <div className='ui-project-item-content' aria-hidden='true'>
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
