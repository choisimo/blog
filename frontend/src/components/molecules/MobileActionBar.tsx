import { useState, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import '@/styles/mobile-action-bar.css';

type MobileActionBarProps = HTMLAttributes<HTMLDivElement> & {
  scrollHidden?: boolean;
};

/** Shared mobile reading toolbar. Keep the DOM mounted for menus and focus return. */
export default function MobileActionBar({
  scrollHidden = false,
  className,
  children,
  ...props
}: MobileActionBarProps) {
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const concealed = scrollHidden && !keyboardFocus;
  return (
    <div
      {...props}
      ref={node => {
        if (node) node.inert = concealed || !!props.hidden;
      }}
      role='toolbar'
      className={cn('mobile-action-bar print:hidden', className)}
      data-scroll-hidden={concealed}
      aria-hidden={concealed || undefined}
      onFocusCapture={event => {
        if (event.currentTarget.contains(event.target as Node))
          setKeyboardFocus(event.target.matches(':focus-visible'));
      }}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setKeyboardFocus(false);
      }}
    >
      {children}
    </div>
  );
}
