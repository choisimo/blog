import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef, useState } from 'react';
import { ClickableImage, ImageLightbox } from '@/components/features/blog/ImageLightbox';
import { PostImage } from '@/components/common/PostImage';

function loaded(image: HTMLElement) {
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: 1600 },
    naturalHeight: { configurable: true, value: 900 },
  });
  fireEvent.load(image);
}

// Use real Radix and button components. Only unavailable browser layout APIs are substituted.
describe('reading image lifecycle', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', class {
      private readonly callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) { this.callback = callback; }
      observe(target: Element) {
        this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      unobserve() { /* No native observer in jsdom. */ }
      disconnect() { /* No native observer in jsdom. */ }
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('falls back from a missing generated thumbnail once and makes original failure retryable', () => {
    render(<ClickableImage src='/images/diagram.png' alt='Diagram' />);
    const image = screen.getByRole('img', { name: 'Diagram' });
    expect(image).toHaveAttribute('src', '/images/diagram.thumb.webp');
    fireEvent.error(image);
    expect(screen.getByRole('img', { name: 'Diagram' })).toHaveAttribute('src', '/images/diagram.png');
    fireEvent.error(screen.getByRole('img', { name: 'Diagram' }));
    expect(screen.queryByRole('status', { name: 'Loading image thumbnail' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    const retry = screen.getByRole('img', { name: 'Diagram' });
    expect(retry).toHaveAttribute('src', '/images/diagram.png');
    loaded(retry);
    expect(screen.getByRole('button', { name: 'View Diagram in full size' })).toHaveAttribute('data-state', 'ready');
  });

  it('does not keep a failed thumbnail after the source changes', () => {
    const { rerender } = render(<ClickableImage src='/media/first.svg' alt='First' />);
    fireEvent.error(screen.getByRole('img', { name: 'First' }));
    rerender(<ClickableImage src='/media/second.svg' alt='Second' />);
    expect(screen.getByRole('img', { name: 'Second' })).toHaveAttribute('src', '/media/second.svg');
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });

  it('preserves validated intrinsic dimensions without accepting CSS units as sizes', () => {
    const { rerender } = render(<ClickableImage src='/media/tall.svg' alt='Tall' intrinsicWidth='600' intrinsicHeight='1200' />);
    expect(screen.getByRole('img', { name: 'Tall' })).toHaveAttribute('width', '600');
    expect(screen.getByRole('img', { name: 'Tall' })).toHaveAttribute('height', '1200');
    rerender(<ClickableImage src='/media/tall.svg' alt='Tall' intrinsicWidth='100%' intrinsicHeight='auto' />);
    expect(screen.getByRole('img', { name: 'Tall' })).not.toHaveAttribute('width');
  });

  it('ends lightbox loading on failure and permits an explicit retry', () => {
    render(<ImageLightbox src='/media/unavailable.svg' alt='Unavailable' open onOpenChange={vi.fn()} />);
    fireEvent.error(screen.getByTestId('lightbox-image'));
    expect(screen.queryByRole('status', { name: 'Loading image preview' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom in image preview' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    loaded(screen.getByTestId('lightbox-image'));
    expect(screen.getByTestId('lightbox-image')).toHaveAttribute('data-state', 'ready');
  });

  it('resets transforms without replacing a successfully loaded image', () => {
    render(<ImageLightbox src='/media/diagram.svg' alt='Diagram' open onOpenChange={vi.fn()} />);
    const image = screen.getByTestId('lightbox-image');
    loaded(image);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in image preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rotate image preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset image preview' }));
    expect(screen.getByTestId('lightbox-image')).toBe(image);
    expect(image).toHaveStyle({ transform: 'translate(0px, 0px) scale(1) rotate(0deg)' });
  });

  it('starts a new source at fit rather than reusing the previous transform', () => {
    const change = vi.fn();
    const { rerender } = render(<ImageLightbox src='/media/first.svg' open onOpenChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in image preview' }));
    rerender(<ImageLightbox src='/media/second.svg' open onOpenChange={change} />);
    expect(screen.getByTestId('lightbox-image')).toHaveStyle({ transform: 'translate(0px, 0px) scale(1) rotate(0deg)' });
    expect(screen.getByTestId('lightbox-image')).toHaveAttribute('src', '/media/second.svg');
  });

  it('does not zoom on a horizontal-only wheel event', () => {
    render(<ImageLightbox src='/media/diagram.svg' open onOpenChange={vi.fn()} />);
    fireEvent.wheel(screen.getByTestId('lightbox-container'), { deltaX: 10, deltaY: 0 });
    expect(screen.getByTestId('lightbox-image')).toHaveStyle({ transform: 'translate(0px, 0px) scale(1) rotate(0deg)' });
  });

  it('returns keyboard focus to the opener on Escape', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      const opener = useRef<HTMLButtonElement>(null);
      return <><button ref={opener} onClick={() => setOpen(true)}>Open image</button>
        <ImageLightbox src='/media/diagram.svg' open={open} onOpenChange={setOpen} returnFocusRef={opener} /></>;
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open image' });
    fireEvent.click(opener);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close image preview' })).toHaveFocus());
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('resets the shared post-card image error when its source changes', () => {
    const { rerender } = render(<PostImage src='/media/first.svg' alt='First' />);
    fireEvent.error(screen.getByRole('img', { name: 'First' }));
    rerender(<PostImage src='/media/second.svg' alt='Second' />);
    expect(screen.getByRole('img', { name: 'Second' })).toHaveAttribute('src', '/media/second.svg');
  });
});
