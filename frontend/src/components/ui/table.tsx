import * as React from 'react';

import { cn } from '@/lib/utils';

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

const sanitizeTableText = (value: string | number): string =>
  String(value)
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();

const sanitizeTableOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const sanitized = sanitizeTableText(value);
  return sanitized.length > 0 ? sanitized : undefined;
};

const sanitizeTableNode = (children: React.ReactNode): React.ReactNode => {
  if (typeof children === 'string' || typeof children === 'number') {
    return sanitizeTableText(children);
  }

  if (Array.isArray(children)) {
    return children.map(sanitizeTableNode);
  }

  return children;
};

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <div className='relative w-full overflow-auto'>
    <table
      ref={ref}
      className={cn('w-full caption-bottom text-sm', className)}
      aria-label={sanitizeTableOptionalText(ariaLabel)}
      title={sanitizeTableOptionalText(title)}
      {...props}
    >
      {sanitizeTableNode(children)}
    </table>
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn('[&_tr]:border-b', className)}
    aria-label={sanitizeTableOptionalText(ariaLabel)}
    title={sanitizeTableOptionalText(title)}
    {...props}
  >
    {sanitizeTableNode(children)}
  </thead>
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    aria-label={sanitizeTableOptionalText(ariaLabel)}
    title={sanitizeTableOptionalText(title)}
    {...props}
  >
    {sanitizeTableNode(children)}
  </tbody>
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t bg-muted/50 font-medium [&>tr]:last:border-b-0',
      className
    )}
    aria-label={sanitizeTableOptionalText(ariaLabel)}
    title={sanitizeTableOptionalText(title)}
    {...props}
  >
    {sanitizeTableNode(children)}
  </tfoot>
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      className
    )}
    aria-label={sanitizeTableOptionalText(ariaLabel)}
    title={sanitizeTableOptionalText(title)}
    {...props}
  >
    {sanitizeTableNode(children)}
  </tr>
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
      className
    )}
    aria-label={sanitizeTableOptionalText(ariaLabel)}
    title={sanitizeTableOptionalText(title)}
    {...props}
  >
    {sanitizeTableNode(children)}
  </th>
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)}
    aria-label={sanitizeTableOptionalText(ariaLabel)}
    title={sanitizeTableOptionalText(title)}
    {...props}
  >
    {sanitizeTableNode(children)}
  </td>
));
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-sm text-muted-foreground', className)}
    aria-label={sanitizeTableOptionalText(ariaLabel)}
    title={sanitizeTableOptionalText(title)}
    {...props}
  >
    {sanitizeTableNode(children)}
  </caption>
));
TableCaption.displayName = 'TableCaption';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
