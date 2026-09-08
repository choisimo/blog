import {
  cloneElement,
  useRef,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import * as Dialog from '@radix-ui/react-dialog';

interface OverlayDialogProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactElement<{ children?: ReactNode }>;
  modal?: boolean;
  layer?: string;
  initialFocusRef?: RefObject<HTMLElement>;
  onReturnFocus?: () => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
}

/** Supplies Radix's shared focus/layer stack without replacing an overlay's layout. */
export function OverlayDialog({
  open,
  onClose,
  label,
  children,
  modal = true,
  layer = 'var(--z-dialog)',
  initialFocusRef,
  onReturnFocus,
  onEscapeKeyDown,
}: OverlayDialogProps) {
  const openerRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root
      open={open}
      modal={modal}
      onOpenChange={next => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal
        container={typeof document === 'undefined' ? undefined : document.body}
      >
        {modal && (
          <Dialog.Overlay className='fixed inset-0' style={{ zIndex: layer }} />
        )}
        <Dialog.Content
          asChild
          aria-label={label}
          aria-describedby={undefined}
          aria-modal={modal || undefined}
          data-overlay-dialog=''
          onInteractOutside={event => event.preventDefault()}
          onEscapeKeyDown={onEscapeKeyDown}
          onOpenAutoFocus={event => {
            openerRef.current =
              document.activeElement instanceof HTMLElement &&
              document.activeElement !== document.body
                ? document.activeElement
                : null;
            if (initialFocusRef?.current) {
              event.preventDefault();
              initialFocusRef.current.focus({ preventScroll: true });
            }
          }}
          onCloseAutoFocus={event => {
            event.preventDefault();
            if (onReturnFocus) {
              onReturnFocus();
              return;
            }
            const target = openerRef.current?.isConnected
              ? openerRef.current
              : document.getElementById('main-content');
            target?.focus({ preventScroll: true });
          }}
        >
          {cloneElement(
            children,
            {},
            <>
              <Dialog.Title className='sr-only'>{label}</Dialog.Title>
              {children.props.children}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
