import * as React from 'react';
import * as AspectRatioPrimitive from '@radix-ui/react-aspect-ratio';

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

const sanitizeAspectRatioText = (value: string | number): string =>
  String(value)
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();

const sanitizeAspectRatioOptionalText = (
  value: unknown
): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const sanitized = sanitizeAspectRatioText(value);
  return sanitized.length > 0 ? sanitized : undefined;
};

const sanitizeAspectRatioNode = (
  children: React.ReactNode
): React.ReactNode => {
  if (typeof children === 'string' || typeof children === 'number') {
    return sanitizeAspectRatioText(children);
  }

  if (Array.isArray(children)) {
    return children.map(sanitizeAspectRatioNode);
  }

  return children;
};

const AspectRatio = React.forwardRef<
  React.ElementRef<typeof AspectRatioPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AspectRatioPrimitive.Root>
>(({ children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <AspectRatioPrimitive.Root
    ref={ref}
    aria-label={sanitizeAspectRatioOptionalText(ariaLabel)}
    title={sanitizeAspectRatioOptionalText(title)}
    {...props}
  >
    {sanitizeAspectRatioNode(children)}
  </AspectRatioPrimitive.Root>
));
AspectRatio.displayName = AspectRatioPrimitive.Root.displayName;

export { AspectRatio };
