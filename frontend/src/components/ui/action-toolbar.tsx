import { useEffect, useLayoutEffect, useRef, type HTMLAttributes } from 'react';
import { createToolbarFocusManager } from './toolbar-focus';

type ToolbarProps = Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'aria-label' | 'aria-orientation'> & {
  label: string;
  orientation?: 'horizontal' | 'vertical';
  loop?: boolean;
};
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Use ActionButton or button[data-toolbar-item]. Keep text inputs and selects outside. */
export function ActionToolbar({ label, orientation = 'horizontal', loop = true,
  className = '', children, onKeyDown, ...props }: ToolbarProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const manager = useRef<ReturnType<typeof createToolbarFocusManager> | null>(null);
  useBrowserLayoutEffect(() => {
    if (!rootRef.current) return;
    const instance = createToolbarFocusManager(rootRef.current, { orientation, loop });
    manager.current = instance;
    return () => { instance.destroy(); manager.current = null; };
  }, [orientation, loop]);
  return <div {...props} ref={rootRef} role="toolbar" aria-label={label} aria-orientation={orientation}
    className={`ui-action-toolbar ${className}`.trim()}
    onKeyDown={event => {
      onKeyDown?.(event);
      if (!event.defaultPrevented) manager.current?.onKeyDown({
        key: event.key, target: event.target, altKey: event.altKey, ctrlKey: event.ctrlKey,
        metaKey: event.metaKey, shiftKey: event.shiftKey, defaultPrevented: event.defaultPrevented,
        isComposing: event.nativeEvent.isComposing, preventDefault: () => event.preventDefault(),
      });
    }}>
    {children}
  </div>;
}
