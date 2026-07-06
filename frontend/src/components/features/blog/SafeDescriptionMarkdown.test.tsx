import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  normalizeDescriptionHref,
  SafeDescriptionMarkdown,
} from './SafeDescriptionMarkdown';

describe('SafeDescriptionMarkdown', () => {
  it('sanitizes markdown text, labels, titles, and safe links', () => {
    const { container } = render(
      <SafeDescriptionMarkdown
        label={'\u001b[35mDescription\u0000'}
        title={'\u001b[34mDescription title\u0007'}
        text={
          '\u001b[31m**Safe text**\u0000 [Good](\u001b[32mhttps://example.com/path\u0000)'
        }
      />
    );

    expect(screen.getByRole('region', { name: 'Description' })).toHaveAttribute(
      'title',
      'Description title'
    );
    expect(screen.getByText('Safe text')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Good' })).toHaveAttribute(
      'href',
      'https://example.com/path'
    );
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
    expect(container.textContent).not.toContain('[31m');
  });

  it('unwraps unsafe links and strips unsupported html and images', () => {
    const { container } = render(
      <SafeDescriptionMarkdown
        text={
          '<script>alert(1)</script> [Unsafe](javascript:alert(1)) ![bad](https://example.com/image.png)'
        }
      />
    );

    expect(screen.getByText('Unsafe')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Unsafe' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('alert(1)');
  });

  it('normalizes only safe markdown href values', () => {
    expect(normalizeDescriptionHref('#section')).toBe('#section');
    expect(normalizeDescriptionHref('/docs/path')).toBe('/docs/path');
    expect(normalizeDescriptionHref('mailto:person@example.com')).toBe(
      'mailto:person@example.com'
    );
    expect(normalizeDescriptionHref('https://example.com/path')).toBe(
      'https://example.com/path'
    );
    expect(normalizeDescriptionHref('https://user:pass@example.com/path')).toBeNull();
    expect(normalizeDescriptionHref('/docs/%2Fhidden')).toBeNull();
    expect(normalizeDescriptionHref('javascript:alert(1)')).toBeNull();
  });

  it('renders nothing for empty sanitized markdown', () => {
    const { container } = render(<SafeDescriptionMarkdown text={'\u001b[31m\u0000'} />);

    expect(container).toBeEmptyDOMElement();
  });
});
