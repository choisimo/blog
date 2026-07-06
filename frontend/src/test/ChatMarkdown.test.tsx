import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ChatMarkdown, {
  normalizeMarkdownHref,
} from '@/components/molecules/ChatMarkdown';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));

describe('ChatMarkdown', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders safe markdown links with noopener metadata', () => {
    render(<ChatMarkdown content="[safe](https://example.com/path)" />);

    const link = screen.getByRole('link', { name: 'safe' });
    expect(link.getAttribute('href')).toBe('https://example.com/path');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders unsafe markdown links as plain text', () => {
    render(<ChatMarkdown content="[bad](javascript:alert(1))" />);

    expect(screen.getByText('bad')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'bad' })).toBeNull();
  });

  it('normalizes only allowed markdown link targets', () => {
    expect(normalizeMarkdownHref(' https://example.com/path ')).toBe(
      'https://example.com/path',
    );
    expect(normalizeMarkdownHref('mailto:support@example.com')).toBe(
      'mailto:support@example.com',
    );
    expect(normalizeMarkdownHref('/blog')).toBe('/blog');
    expect(normalizeMarkdownHref('#section')).toBe('#section');
    expect(normalizeMarkdownHref('relative-path')).toBeNull();
    expect(normalizeMarkdownHref('//example.com/path')).toBeNull();
    expect(normalizeMarkdownHref('javascript:alert(1)')).toBeNull();
    expect(normalizeMarkdownHref('https://example.com/\npath')).toBeNull();
  });

  it('renders nothing for non-string content at runtime', () => {
    const { container } = render(
      <ChatMarkdown content={null as unknown as string} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('ignores code-copy clicks when clipboard.writeText is unavailable', () => {
    vi.stubGlobal('navigator', { clipboard: {} });
    render(<ChatMarkdown content={'```ts\nconst value = 1;\n```'} />);

    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    }).not.toThrow();
  });
});
