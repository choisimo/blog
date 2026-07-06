import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { toggleVariants } from '@/components/ui/toggle';

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

const sanitizeToggleGroupText = (value: string | number): string =>
  String(value)
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();

const sanitizeToggleGroupOptionalText = (
  value: unknown
): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const sanitized = sanitizeToggleGroupText(value);
  return sanitized.length > 0 ? sanitized : undefined;
};

const sanitizeToggleGroupNode = (
  children: React.ReactNode
): React.ReactNode => {
  if (typeof children === 'string' || typeof children === 'number') {
    return sanitizeToggleGroupText(children);
  }

  if (Array.isArray(children)) {
    return children.map(sanitizeToggleGroupNode);
  }

  return children;
};

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants>
>({
  size: 'default',
  variant: 'default',
});

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(
  (
    { className, variant, size, children, 'aria-label': ariaLabel, title, ...props },
    ref
  ) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn('flex items-center justify-center gap-1', className)}
    aria-label={sanitizeToggleGroupOptionalText(ariaLabel)}
    title={sanitizeToggleGroupOptionalText(title)}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>
      {sanitizeToggleGroupNode(children)}
    </ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
  )
);

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleVariants>
>(
  (
    { className, children, variant, size, 'aria-label': ariaLabel, title, ...props },
    ref
  ) => {
  const context = React.useContext(ToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className
      )}
      aria-label={sanitizeToggleGroupOptionalText(ariaLabel)}
      title={sanitizeToggleGroupOptionalText(title)}
      {...props}
    >
      {sanitizeToggleGroupNode(children)}
    </ToggleGroupPrimitive.Item>
  );
  }
);

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
