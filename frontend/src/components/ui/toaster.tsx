import type { ReactNode } from 'react';

import { useToast } from '@/hooks/ui/use-toast';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

const sanitizeToasterText = (value: string | number): string =>
  String(value).replace(ANSI_ESCAPE_PATTERN, '').replace(CONTROL_TEXT_PATTERN, '').trim();

const sanitizeToasterNode = (children: ReactNode): ReactNode => {
  if (typeof children === 'string' || typeof children === 'number') {
    return sanitizeToasterText(children);
  }

  if (Array.isArray(children)) {
    return children.map(sanitizeToasterNode);
  }

  return children;
};

const hasRenderableToasterNode = (children: ReactNode): boolean => {
  if (children === null || children === undefined || typeof children === 'boolean') {
    return false;
  }

  if (typeof children === 'string' || typeof children === 'number') {
    return sanitizeToasterText(children).length > 0;
  }

  if (Array.isArray(children)) {
    return children.some(hasRenderableToasterNode);
  }

  return true;
};

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const sanitizedTitle = sanitizeToasterNode(title);
        const sanitizedDescription = sanitizeToasterNode(description);
        const sanitizedAction = sanitizeToasterNode(action);

        return (
          <Toast key={id} {...props}>
            <div className='grid gap-1'>
              {hasRenderableToasterNode(title) && (
                <ToastTitle>{sanitizedTitle}</ToastTitle>
              )}
              {hasRenderableToasterNode(description) && (
                <ToastDescription>{sanitizedDescription}</ToastDescription>
              )}
            </div>
            {sanitizedAction}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
