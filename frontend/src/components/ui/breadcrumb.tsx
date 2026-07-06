import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { ChevronRight, MoreHorizontal } from 'lucide-react';

import { cn } from '@/lib/utils';

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

const sanitizeBreadcrumbText = (value: string | number): string =>
  String(value).replace(ANSI_ESCAPE_PATTERN, '').replace(CONTROL_TEXT_PATTERN, '').trim();

const sanitizeBreadcrumbOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const sanitized = sanitizeBreadcrumbText(value);

  return sanitized.length > 0 ? sanitized : undefined;
};

const sanitizeBreadcrumbNode = (children: React.ReactNode): React.ReactNode => {
  if (typeof children === 'string' || typeof children === 'number') {
    return sanitizeBreadcrumbText(children);
  }

  if (Array.isArray(children)) {
    return children.map(sanitizeBreadcrumbNode);
  }

  return children;
};

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<'nav'> & {
    separator?: React.ReactNode;
  }
>(
  (
    {
      children,
      separator: _separator,
      'aria-label': ariaLabel = 'breadcrumb',
      title,
      ...props
    },
    ref
  ) => (
    <nav
      ref={ref}
      aria-label={sanitizeBreadcrumbOptionalText(ariaLabel) ?? 'breadcrumb'}
      title={sanitizeBreadcrumbOptionalText(title)}
      {...props}
    >
      {sanitizeBreadcrumbNode(children)}
    </nav>
  )
);
Breadcrumb.displayName = 'Breadcrumb';

const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.ComponentPropsWithoutRef<'ol'>
>(({ children, className, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn(
      'flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5',
      className
    )}
    aria-label={sanitizeBreadcrumbOptionalText(ariaLabel)}
    title={sanitizeBreadcrumbOptionalText(title)}
    {...props}
  >
    {sanitizeBreadcrumbNode(children)}
  </ol>
));
BreadcrumbList.displayName = 'BreadcrumbList';

const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<'li'>
>(({ children, className, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <li
    ref={ref}
    className={cn('inline-flex items-center gap-1.5', className)}
    aria-label={sanitizeBreadcrumbOptionalText(ariaLabel)}
    title={sanitizeBreadcrumbOptionalText(title)}
    {...props}
  >
    {sanitizeBreadcrumbNode(children)}
  </li>
));
BreadcrumbItem.displayName = 'BreadcrumbItem';

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<'a'> & {
    asChild?: boolean;
  }
>(({ asChild, children, className, 'aria-label': ariaLabel, title, ...props }, ref) => {
  const Comp = asChild ? Slot : 'a';

  return (
    <Comp
      ref={ref}
      className={cn('transition-colors hover:text-foreground', className)}
      aria-label={sanitizeBreadcrumbOptionalText(ariaLabel)}
      title={sanitizeBreadcrumbOptionalText(title)}
      {...props}
    >
      {sanitizeBreadcrumbNode(children)}
    </Comp>
  );
});
BreadcrumbLink.displayName = 'BreadcrumbLink';

const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<'span'>
>(({ children, className, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <span
    ref={ref}
    role='link'
    aria-disabled='true'
    aria-current='page'
    className={cn('font-normal text-foreground', className)}
    aria-label={sanitizeBreadcrumbOptionalText(ariaLabel)}
    title={sanitizeBreadcrumbOptionalText(title)}
    {...props}
  >
    {sanitizeBreadcrumbNode(children)}
  </span>
));
BreadcrumbPage.displayName = 'BreadcrumbPage';

const BreadcrumbSeparator = ({
  children,
  className,
  'aria-label': ariaLabel,
  title,
  ...props
}: React.ComponentProps<'li'>) => (
  <li
    role='presentation'
    aria-hidden='true'
    className={cn('[&>svg]:size-3.5', className)}
    aria-label={sanitizeBreadcrumbOptionalText(ariaLabel)}
    title={sanitizeBreadcrumbOptionalText(title)}
    {...props}
  >
    {children === undefined || children === null ? (
      <ChevronRight />
    ) : (
      sanitizeBreadcrumbNode(children)
    )}
  </li>
);
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator';

const BreadcrumbEllipsis = ({
  className,
  'aria-label': ariaLabel,
  title,
  ...props
}: React.ComponentProps<'span'>) => (
  <span
    role='presentation'
    aria-hidden='true'
    className={cn('flex h-9 w-9 items-center justify-center', className)}
    aria-label={sanitizeBreadcrumbOptionalText(ariaLabel)}
    title={sanitizeBreadcrumbOptionalText(title)}
    {...props}
  >
    <MoreHorizontal className='h-4 w-4' />
    <span className='sr-only'>More</span>
  </span>
);
BreadcrumbEllipsis.displayName = 'BreadcrumbElipssis';

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
