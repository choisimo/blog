import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImageLightbox, {
  ClickableImage,
  EmbeddedVideo,
  NormalizedVideoSource,
} from './ImageLightbox';

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe('ImageLightbox media boundaries', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  it('sanitizes image alt and caption while preserving safe media sources', () => {
    render(
      <ClickableImage
        src='/media/safe-image.png'
        alt={'\u001b[31mSafe alt\u001b[0m\u0000'}
        caption={'\u001b[32mSafe caption\u001b[0m\u0007'}
      />
    );

    expect(
      screen.getByRole('button', { name: 'View Safe alt in full size' })
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Safe alt' })).toHaveAttribute(
      'data-src',
      '/media/safe-image.png'
    );
    expect(screen.getByRole('status', { name: 'Loading image thumbnail' })).toBeInTheDocument();
    expect(screen.getByText('Safe caption')).toBeInTheDocument();
  });

  it('exposes lightbox controls and loading state without leaking unsafe alt text', () => {
    render(
      <ImageLightbox
        src='/media/safe-image.png'
        alt={'\u001b[31mPreview title\u0000'}
        open
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Zoom out image preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom in image preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rotate image preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close image preview' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading image preview' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Preview title' })).toHaveAttribute(
      'src',
      '/media/safe-image.png'
    );
    expect(document.body.textContent).not.toContain('\u001b');
    expect(document.body.textContent).not.toContain('\u0000');
  });

  it('does not render images with unsafe media sources', () => {
    render(
      <ClickableImage
        src='javascript:alert(1)'
        alt='Unsafe alt'
        caption='Unsafe caption'
      />
    );

    expect(screen.queryByRole('img', { name: 'Unsafe alt' })).not.toBeInTheDocument();
    expect(screen.queryByText('Unsafe caption')).not.toBeInTheDocument();
  });

  it('sanitizes video labels and suppresses unsafe video sources', () => {
    const { rerender } = render(
      <EmbeddedVideo
        src='/media/safe-video.mp4'
        alt={'\u001b[31mSafe video\u001b[0m\u0000'}
        caption={'Video caption\u0007'}
      />
    );

    expect(screen.getByLabelText('Safe video')).toHaveAttribute(
      'data-src',
      '/media/safe-video.mp4'
    );
    expect(screen.getByText('Video caption')).toBeInTheDocument();

    rerender(<EmbeddedVideo src='data:text/html,unsafe' alt='Unsafe video' />);

    expect(screen.queryByLabelText('Unsafe video')).not.toBeInTheDocument();
  });

  it('does not render normalized video sources with unsafe src values', () => {
    const { container } = render(
      <video>
        <NormalizedVideoSource src='https://user:pass@example.com/video.mp4' />
        <NormalizedVideoSource src='/media/safe-video.webm' />
      </video>
    );

    expect(container.querySelectorAll('source')).toHaveLength(1);
    expect(container.querySelector('source')).toHaveAttribute(
      'src',
      '/media/safe-video.webm'
    );
  });
});
