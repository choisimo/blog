import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

const sanitizeTabsText = (value: string | number): string =>
  String(value)
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();

const sanitizeTabsOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const sanitized = sanitizeTabsText(value);
  return sanitized.length > 0 ? sanitized : undefined;
};

const sanitizeTabsNode = (children: React.ReactNode): React.ReactNode => {
  if (typeof children === 'string' || typeof children === 'number') {
    return sanitizeTabsText(children);
  }

  if (Array.isArray(children)) {
    return children.map(sanitizeTabsNode);
  }

  return children;
};

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <TabsPrimitive.Root
    ref={ref}
    aria-label={sanitizeTabsOptionalText(ariaLabel)}
    title={sanitizeTabsOptionalText(title)}
    {...props}
  >
    {sanitizeTabsNode(children)}
  </TabsPrimitive.Root>
));
Tabs.displayName = TabsPrimitive.Root.displayName;

const tabsListVariants = cva(
  'inline-flex items-center justify-center',
  {
    variants: {
      variant: {
        default: 'h-10 rounded-md bg-muted p-1 text-muted-foreground border border-border/50',
        terminal: [
          'gap-3 border-b border-border/30 pb-3',
          'bg-transparent rounded-none p-0',
        ],
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants({ variant }), className)}
    aria-label={sanitizeTabsOptionalText(ariaLabel)}
    title={sanitizeTabsOptionalText(title)}
    {...props}
  >
    {sanitizeTabsNode(children)}
  </TabsPrimitive.List>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const tabsTriggerVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: [
          'rounded-sm px-3 py-1.5 text-sm font-medium',
          'data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/50',
          'hover:text-foreground',
        ],
        terminal: [
          // Base styles
          'bg-transparent px-4 py-2',
          'font-mono text-xs font-bold uppercase tracking-wider',
          'rounded-[4px]',
          'border border-[hsl(var(--terminal-inactive-border,var(--border)))]',
          'text-muted-foreground',
          // Hover effects
          'hover:border-primary hover:text-primary',
          'hover:shadow-[0_0_10px_hsl(var(--primary)/0.4)]',
          'hover:[text-shadow:0_0_5px_hsl(var(--primary))]',
          // Active state - Dark text on neon green background
          'data-[state=active]:bg-primary data-[state=active]:text-[hsl(210_50%_2%)]',
          'data-[state=active]:border-primary',
          'data-[state=active]:shadow-[0_0_10px_hsl(var(--primary)/0.4)]',
        ],
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
    VariantProps<typeof tabsTriggerVariants> {}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(
  ({ className, variant, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant }), className)}
    aria-label={sanitizeTabsOptionalText(ariaLabel)}
    title={sanitizeTabsOptionalText(title)}
    {...props}
  >
    {sanitizeTabsNode(children)}
  </TabsPrimitive.Trigger>
  )
);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    aria-label={sanitizeTabsOptionalText(ariaLabel)}
    title={sanitizeTabsOptionalText(title)}
    {...props}
  >
    {sanitizeTabsNode(children)}
  </TabsPrimitive.Content>
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
