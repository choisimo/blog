import { Link, useLocation } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavigationItemProps {
  name: string;
  href: string;
  icon: LucideIcon;
  isMobile?: boolean;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
  title?: string;
}

const ENCODED_NAVIGATION_CONTROL_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;
const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;

function stripUnsafeNavigationControls(value: string): string {
  return value
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function normalizeNavigationLabel(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const normalized = stripUnsafeNavigationControls(value)
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback;
}

function normalizeOptionalNavigationText(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const normalized = normalizeNavigationLabel(String(value));

  return normalized || undefined;
}

function normalizeNavigationHref(value: unknown): {
  href: string;
  external: boolean;
} {
  if (typeof value !== 'string') return { href: '/', external: false };
  const href = value.trim();
  if (
    !href ||
    /[\u0000-\u001F\u007F\s]/.test(href) ||
    ENCODED_NAVIGATION_CONTROL_PATTERN.test(href)
  ) {
    return { href: '/', external: false };
  }

  if (href.startsWith('/')) {
    return href.startsWith('//')
      ? { href: '/', external: false }
      : { href, external: false };
  }

  try {
    const parsed = new URL(href);
    if (parsed.username || parsed.password) {
      return { href: '/', external: false };
    }
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? { href: parsed.toString(), external: true }
      : { href: '/', external: false };
  } catch {
    return { href: '/', external: false };
  }
}

export function NavigationItem({
  name,
  href,
  icon: Icon,
  isMobile = false,
  onClick,
  className = '',
  ariaLabel,
  title,
}: NavigationItemProps) {
  const location = useLocation();
  const safeName = normalizeNavigationLabel(name, 'Navigation');
  const safeHref = normalizeNavigationHref(href);
  const safeAriaLabel = normalizeOptionalNavigationText(ariaLabel);
  const safeTitle = normalizeOptionalNavigationText(title);
  const isActive = !safeHref.external && location.pathname === safeHref.href;

  const baseClasses = isMobile
    ? 'flex items-center gap-3 rounded-md px-4 py-3 text-base font-medium transition-colors min-h-[44px]'
    : 'flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary';

  const activeClasses = isMobile
    ? 'bg-primary/10 text-primary'
    : 'text-primary';

  const inactiveClasses = isMobile
    ? 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
    : 'text-muted-foreground';

  if (safeHref.external) {
    return (
      <a
        href={safeHref.href}
        target='_blank'
        rel='noopener noreferrer'
        className={cn(baseClasses, inactiveClasses, className)}
        onClick={onClick}
        aria-label={safeAriaLabel}
        title={safeTitle}
      >
        <Icon className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden="true" />
        {safeName}
      </a>
    );
  }

  return (
    <Link
      to={safeHref.href}
      className={cn(
        baseClasses,
        isActive ? activeClasses : inactiveClasses,
        className
      )}
      onClick={onClick}
      aria-label={safeAriaLabel}
      title={safeTitle}
    >
      <Icon className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden="true" />
      {safeName}
    </Link>
  );
}
