import type { AnchorHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface SkipLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'> {
  href: string;
  children: ReactNode;
}

const FALLBACK_SKIP_LINK_HREF = '#main-content';
const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

const sanitizeSkipLinkText = (value: string | number): string =>
  String(value).replace(ANSI_ESCAPE_PATTERN, '').replace(CONTROL_TEXT_PATTERN, '').trim();

const sanitizeSkipLinkOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const sanitized = sanitizeSkipLinkText(value);

  return sanitized.length > 0 ? sanitized : undefined;
};

const sanitizeSkipLinkNode = (children: ReactNode): ReactNode => {
  if (typeof children === 'string' || typeof children === 'number') {
    return sanitizeSkipLinkText(children);
  }

  if (Array.isArray(children)) {
    return children.map(sanitizeSkipLinkNode);
  }

  return children;
};

export function normalizeSkipLinkHref(href: string): string {
  const candidate = href.trim();
  if (
    candidate.length <= 1 ||
    !candidate.startsWith('#') ||
    /[\u0000-\u001F\u007F\s]/.test(candidate)
  ) {
    return FALLBACK_SKIP_LINK_HREF;
  }

  return candidate;
}

export const SkipLink = ({
  href,
  children,
  className,
  'aria-label': ariaLabel,
  title,
  ...props
}: SkipLinkProps) => {
  return (
    <a
      href={normalizeSkipLinkHref(href)}
      aria-label={sanitizeSkipLinkOptionalText(ariaLabel)}
      title={sanitizeSkipLinkOptionalText(title)}
      className={cn(
        'skip-link',
        'absolute -top-10 left-6 z-[var(--z-tooltip)] bg-background px-4 py-2 text-foreground',
        'focus:top-6 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'transition-all duration-200 font-medium rounded-md shadow-lg',
        className
      )}
      {...props}
    >
      {sanitizeSkipLinkNode(children)}
    </a>
  );
};
