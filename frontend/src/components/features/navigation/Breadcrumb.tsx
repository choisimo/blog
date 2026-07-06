import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  label?: string;
  title?: string;
  homeLabel?: string;
}

const SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const MALFORMED_PERCENT_PATTERN = /%(?![0-9A-Fa-f]{2})/;
const ENCODED_CONTROL_PATTERN = /%(?:0[0-9A-Fa-f]|1[0-9A-Fa-f]|7[Ff])/;
const ENCODED_SEPARATOR_PATTERN = /%(?:2[Ff]|5[Cc])/;
const WHITESPACE_PATTERN = /\s+/g;
const DEFAULT_BREADCRUMB_LABEL = 'Breadcrumb';
const DEFAULT_HOME_LABEL = 'Home';

function normalizeBreadcrumbText(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';

  return String(value)
    .replace(ANSI_ESCAPE_PATTERN, ' ')
    .replace(SINGLE_LINE_CONTROL_PATTERN, ' ')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();
}

function normalizeOptionalBreadcrumbText(value: unknown): string | undefined {
  return normalizeBreadcrumbText(value) || undefined;
}

function normalizeBreadcrumbHref(value: unknown): string | undefined {
  const href = normalizeBreadcrumbText(value);
  if (
    !href ||
    !href.startsWith('/') ||
    href.startsWith('//') ||
    href.includes('\\') ||
    MALFORMED_PERCENT_PATTERN.test(href) ||
    ENCODED_CONTROL_PATTERN.test(href) ||
    ENCODED_SEPARATOR_PATTERN.test(href)
  ) {
    return undefined;
  }
  return href;
}

export function Breadcrumb({
  items,
  className,
  label = DEFAULT_BREADCRUMB_LABEL,
  title,
  homeLabel = DEFAULT_HOME_LABEL,
}: BreadcrumbProps) {
  const safeItems = items
    .map(item => ({
      label: normalizeBreadcrumbText(item.label),
      href: normalizeBreadcrumbHref(item.href),
    }))
    .filter(item => item.label);
  const lastIndex = safeItems.length - 1;
  const safeLabel = normalizeBreadcrumbText(label) || DEFAULT_BREADCRUMB_LABEL;
  const safeTitle = normalizeOptionalBreadcrumbText(title);
  const safeHomeLabel = normalizeBreadcrumbText(homeLabel) || DEFAULT_HOME_LABEL;

  return (
    <nav
      aria-label={safeLabel}
      title={safeTitle}
      className={cn(
        'flex items-center space-x-1 text-sm text-muted-foreground',
        className
      )}
    >
      <Link to='/' className='hover:text-foreground transition-colors' aria-label={safeHomeLabel}>
        <Home aria-hidden='true' className='h-4 w-4' />
      </Link>
      {safeItems.map((item, index) => {
        const isCurrent = index === lastIndex;
        return (
          <div key={`${item.label}-${index}`} className='flex items-center space-x-1'>
            <ChevronRight className='h-4 w-4' aria-hidden='true' />
            {item.href && !isCurrent ? (
              <Link
                to={item.href}
                className='hover:text-foreground transition-colors'
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current={isCurrent ? 'page' : undefined}
                className={cn(
                  'transition-colors',
                  isCurrent
                    ? 'text-foreground font-medium'
                    : 'text-foreground'
                )}
              >
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default Breadcrumb;
