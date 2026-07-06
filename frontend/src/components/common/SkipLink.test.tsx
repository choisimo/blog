import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { normalizeSkipLinkHref, SkipLink } from './SkipLink';

describe('SkipLink', () => {
  it('sanitizes link text and accessibility attributes while preserving href and className', () => {
    render(
      <SkipLink
        href='  #content  '
        aria-label={'\u001b]0;Hidden aria\u0007\u001b[31mSkip to content\u0000'}
        title={'\u001b]0;Hidden title\u0007Jump\u0007'}
        className='custom-skip-link'
        data-testid='skip-link'
      >
        Skip{'\u001b]0;Hidden child\u0007'} content
      </SkipLink>
    );

    const link = screen.getByRole('link', { name: 'Skip to content' });

    expect(link).toHaveAttribute('href', '#content');
    expect(link).toHaveAttribute('title', 'Jump');
    expect(link).toHaveTextContent('Skip content');
    expect(link).toHaveClass('skip-link');
    expect(link).toHaveClass('custom-skip-link');
    expect(link).toHaveAttribute('data-testid', 'skip-link');
    expect(link.textContent).not.toContain('Hidden');
  });

  it('preserves rich children and omits empty sanitized accessibility attributes', () => {
    const { container } = render(
      <SkipLink
        href='#main'
        aria-label={'\u001b]0;Hidden aria\u0007\u001b[32m\u0007'}
        title={'\u0008'}
      >
        <span data-testid='rich-child'>Rich child</span>
      </SkipLink>
    );

    const link = screen.getByRole('link', { name: 'Rich child' });

    expect(link).toHaveAttribute('href', '#main');
    expect(link).not.toHaveAttribute('aria-label');
    expect(link).not.toHaveAttribute('title');
    expect(screen.getByTestId('rich-child')).toHaveTextContent('Rich child');
    expect(container.textContent).not.toContain('Hidden');
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0007');
  });
});

describe('normalizeSkipLinkHref', () => {
  it('keeps valid fragment hrefs and falls back for unsafe values', () => {
    expect(normalizeSkipLinkHref('  #main-content  ')).toBe('#main-content');
    expect(normalizeSkipLinkHref('/main-content')).toBe('#main-content');
    expect(normalizeSkipLinkHref('#')).toBe('#main-content');
    expect(normalizeSkipLinkHref('#main content')).toBe('#main-content');
    expect(normalizeSkipLinkHref('#main\u0000content')).toBe('#main-content');
  });
});
