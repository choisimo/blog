import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ChatMarkdown, { normalizeMarkdownHref } from './ChatMarkdown';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));

vi.mock('react-syntax-highlighter', () => {
  const Light = ({ children }: { children: React.ReactNode }) => (
    <pre data-testid='syntax-highlighter'>{children}</pre>
  );
  Light.registerLanguage = vi.fn();

  return { Light };
});

vi.mock('react-syntax-highlighter/dist/esm/styles/hljs', () => ({
  atomOneDark: {
    hljs: {},
  },
}));

vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/bash', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/css', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/go', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/java', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/javascript', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/json', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/kotlin', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/markdown', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/python', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/rust', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/sql', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/typescript', () => ({ default: {} }));
vi.mock('react-syntax-highlighter/dist/esm/languages/hljs/yaml', () => ({ default: {} }));

describe('ChatMarkdown', () => {
  it('sanitizes markdown content and root accessibility text while preserving safe links', () => {
    const { container } = render(
      <ChatMarkdown
        label={'\u001b[31mChat answer\u0000'}
        title={'Answer\u0007 title'}
        content={[
          '# \u001b[32mHeading\u001b[0m\u0000',
          '[Safe](https://example.com/docs)',
          '[Unsafe](javascript:alert(1))',
        ].join('\n\n')}
      />
    );

    const root = container.firstElementChild;
    const safeLink = screen.getByRole('link', { name: 'Safe' });

    expect(root).toHaveAttribute('aria-label', 'Chat answer');
    expect(root).toHaveAttribute('title', 'Answer title');
    expect(screen.getByRole('heading', { name: 'Heading' })).toBeInTheDocument();
    expect(safeLink).toHaveAttribute('href', 'https://example.com/docs');
    expect(safeLink).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Unsafe')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Unsafe' })).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
  });

  it('sanitizes streaming markdown before closing incomplete fences', () => {
    render(
      <ChatMarkdown
        isStreaming
        content={'```ts\nconst value = "\\u001b[31mred\\u001b[0m";\u0000'}
      />
    );

    expect(screen.getByTestId('syntax-highlighter')).toHaveTextContent(
      'const value = "\\u001b[31mred\\u001b[0m";'
    );
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
  });

  it('provides accessible copy labels for plain code blocks', () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(<ChatMarkdown content={'```\nplain code\n```'} />);

    const copyButton = screen.getByRole('button', { name: 'Copy code' });

    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('plain code');
  });
});

describe('normalizeMarkdownHref', () => {
  it('keeps safe markdown hrefs and rejects unsafe values', () => {
    expect(normalizeMarkdownHref('/docs')).toBe('/docs');
    expect(normalizeMarkdownHref('#section')).toBe('#section');
    expect(normalizeMarkdownHref('https://example.com/docs')).toBe(
      'https://example.com/docs'
    );
    expect(normalizeMarkdownHref('mailto:test@example.com')).toBe(
      'mailto:test@example.com'
    );
    expect(normalizeMarkdownHref('javascript:alert(1)')).toBeNull();
    expect(normalizeMarkdownHref('//example.com/docs')).toBeNull();
    expect(normalizeMarkdownHref('/bad\u0000path')).toBeNull();
    expect(normalizeMarkdownHref('/bad%00path')).toBeNull();
    expect(normalizeMarkdownHref('/../admin')).toBeNull();
    expect(normalizeMarkdownHref('/bad\\path')).toBeNull();
    expect(normalizeMarkdownHref('https://user:pass@example.com/docs')).toBeNull();
    expect(normalizeMarkdownHref('https://example.com/%0Aheader')).toBeNull();
    expect(normalizeMarkdownHref('mailto:test@example.com%0d%0abcc:evil@example.com')).toBeNull();
    expect(normalizeMarkdownHref('https://example.com/%E0%A4%A')).toBeNull();
    expect(normalizeMarkdownHref('https://example.com/\u001b[31mred')).toBeNull();
    expect(normalizeMarkdownHref('https://example.com/\u001b[31mred')).toBeNull();
  });
});
