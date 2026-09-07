import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { UI_ACTIONS, type ActionIdOfKind } from './action-definitions';
import { ACTION_ICONS } from './action-icons';

type ActionState =
  | { action: ActionIdOfKind<'command'>; pressed?: never; expanded?: never; controls?: string }
  | { action: ActionIdOfKind<'toggle'>; pressed: boolean; expanded?: never; controls?: string }
  | { action: ActionIdOfKind<'disclosure'>; pressed?: never; expanded: boolean; controls: string };

type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-label' | 'aria-pressed' | 'aria-expanded' | 'aria-controls' | 'aria-busy' | 'title'>;

export type ActionButtonProps = NativeButtonProps & ActionState & {
  /** Override only to name the affected object; keep the action meaning unchanged. */
  label?: string;
  iconOnly?: boolean;
  busy?: boolean;
  children?: ReactNode;
  variant?: 'ghost' | 'outline' | 'danger';
};

/** Native button/ref deliberately remains compatible with Radix Close asChild. */
export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton(
  { action, label, iconOnly = false, busy = false, pressed, expanded, controls,
    children, className = '', variant = 'ghost', disabled, onClick, type = 'button', ...props }, ref,
) {
  const name = label?.trim() || UI_ACTIONS[action].label;
  const Icon = busy ? Loader2 : ACTION_ICONS[action];
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={`ui-action-button ${className}`.trim()}
      data-action={action}
      data-toolbar-item=""
      data-variant={variant}
      data-icon-only={iconOnly || undefined}
      aria-label={name}
      title={iconOnly ? name : undefined}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      onClick={event => {
        // Includes aria-disabled consumers. Never dispatch a command from an unavailable control.
        if (disabled || busy || props['aria-disabled'] === true || props['aria-disabled'] === 'true') {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
    >
      <Icon className={busy ? 'ui-action-icon ui-action-icon--busy' : 'ui-action-icon'}
        aria-hidden="true" focusable="false" />
      {!iconOnly && <span>{children ?? name}</span>}
    </button>
  );
});
