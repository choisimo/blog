import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { ImageLightbox } from '@/components/features/blog/ImageLightbox';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: ReactNode;
    onOpenChange: (open: boolean) => void;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({
    children,
    hideClose: _hideClose,
    ...props
  }: HTMLAttributes<HTMLDivElement> & { hideClose?: boolean }) => (
    <div {...props}>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
}));

vi.mock('@/components/atoms/TouchIconButton', () => ({
  TouchIconButton: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type='button' {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@radix-ui/react-visually-hidden', () => ({
  VisuallyHidden: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe('ImageLightbox', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies one wheel zoom step per wheel event', () => {
    render(
      <ImageLightbox
        src='/image.jpg'
        alt='Sample image'
        open
        onOpenChange={vi.fn()}
      />
    );

    fireEvent.wheel(screen.getByTestId('lightbox-container'), {
      deltaY: -100,
    });

    expect(screen.getByTestId('lightbox-image')).toHaveStyle({
      transform: 'translate(0px, 0px) scale(1.15) rotate(0deg)',
    });
  });

  it('removes the native wheel listener when the dialog content unmounts', () => {
    const removeSpy = vi.spyOn(HTMLDivElement.prototype, 'removeEventListener');
    const { rerender } = render(
      <ImageLightbox
        src='/image.jpg'
        alt='Sample image'
        open
        onOpenChange={vi.fn()}
      />
    );

    rerender(
      <ImageLightbox
        src='/image.jpg'
        alt='Sample image'
        open={false}
        onOpenChange={vi.fn()}
      />
    );

    expect(removeSpy).toHaveBeenCalledWith('wheel', expect.any(Function));
  });
});
