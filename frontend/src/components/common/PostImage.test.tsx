import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { normalizePostImageSrc, PostImage } from './PostImage';

describe('PostImage', () => {
  it('sanitizes image alt text while preserving source and classes', () => {
    render(
      <PostImage
        src='/cover.png'
        alt={'\u001b]0;Hidden alt\u0007\u001b[31mCover image\u0000'}
        variant='card'
        className='custom-image'
        containerClassName='custom-container'
        showGradient={false}
      />
    );

    const image = screen.getByAltText('Cover image');

    expect(image).toHaveAttribute('src', '/cover.png');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveClass('custom-image');
    expect(image.closest('div')).toHaveClass('custom-container');
    expect(image.getAttribute('alt')).not.toContain('Hidden');
    expect(image.getAttribute('alt')).not.toContain('\u001b');
  });

  it('sanitizes title and alt before deriving fallback characters', () => {
    render(
      <PostImage
        src='/missing.png'
        title={'\u001b]0;Hidden title\u0007\u001b[32mDraft\u0007'}
        alt={'\u001b]0;Hidden alt\u0007\u001b[33mArticle\u0008'}
        variant='thumbnail'
      />
    );

    fireEvent.error(screen.getByAltText('Article'));

    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.queryByText(/Hidden/)).not.toBeInTheDocument();
    expect(screen.queryByText('\u001b')).not.toBeInTheDocument();
  });

  it('uses sanitized alt text for fallback when title sanitizes to empty', () => {
    const { container } = render(
      <PostImage
        title={'\u001b]0;Hidden title\u0007\u001b[31m\u0000'}
        alt={'\u001b]0;Hidden alt\u0007\u001b[34mavatar\u0009'}
        variant='avatar'
      />
    );

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Hidden');
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0009');
  });
});

describe('normalizePostImageSrc', () => {
  it('keeps safe image sources and rejects unsafe values', () => {
    expect(normalizePostImageSrc('/cover.png')).toBe('/cover.png');
    expect(normalizePostImageSrc('https://example.com/cover.png')).toBe(
      'https://example.com/cover.png'
    );
    expect(normalizePostImageSrc('data:image/png;base64,abc')).toBe(
      'data:image/png;base64,abc'
    );
    expect(normalizePostImageSrc('javascript:alert(1)')).toBeNull();
    expect(normalizePostImageSrc('//example.com/cover.png')).toBeNull();
    expect(normalizePostImageSrc('/cover\u0000.png')).toBeNull();
    expect(normalizePostImageSrc(undefined)).toBeNull();
  });
});
