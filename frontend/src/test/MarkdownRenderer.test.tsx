import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import MarkdownRenderer, {
  normalizeMarkdownLinkHref,
} from '@/components/features/blog/MarkdownRenderer';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));

vi.mock('@/components/molecules/SparkInline', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/features/blog/ImageLightbox', () => ({
  ClickableImage: ({ alt }: { alt?: string }) => {
    if (alt === 'force-render-error') {
      throw new Error('Forced markdown renderer failure');
    }
    return <img alt={alt || ''} />;
  },
  EmbeddedVideo: ({ children }: { children?: ReactNode }) => (
    <video>{children}</video>
  ),
  NormalizedVideoSource: () => <source />,
}));

vi.mock('react-syntax-highlighter', () => {
  const Light = ({ children }: { children: ReactNode }) => (
    <pre>{children}</pre>
  );
  Light.registerLanguage = vi.fn();

  return { Light };
});

vi.mock('react-syntax-highlighter/dist/esm/styles/hljs', () => ({
  atomOneDark: { hljs: {} },
}));

describe('normalizeMarkdownLinkHref', () => {
  it('allows safe navigable links and rejects unsafe protocols', () => {
    expect(normalizeMarkdownLinkHref(' https://example.com/page ')).toBe(
      'https://example.com/page'
    );
    expect(normalizeMarkdownLinkHref('/posts/example')).toBe('/posts/example');
    expect(normalizeMarkdownLinkHref('#section')).toBe('#section');
    expect(normalizeMarkdownLinkHref('mailto:hello@example.com')).toBe(
      'mailto:hello@example.com'
    );
    expect(normalizeMarkdownLinkHref('javascript:alert(1)')).toBeUndefined();
    expect(normalizeMarkdownLinkHref('data:text/html,hello')).toBeUndefined();
  });
});

describe('MarkdownRenderer link boundaries', () => {
  it('removes unsafe link href and target attributes at render time', () => {
    render(
      <MarkdownRenderer content='[safe](https://example.com) [bad](javascript:alert(1))' />
    );

    expect(screen.getByRole('link', { name: 'safe' })).toHaveAttribute(
      'href',
      'https://example.com'
    );

    const unsafeAnchor = screen.getByText('bad').closest('a');

    expect(unsafeAnchor).not.toHaveAttribute('href');
    expect(unsafeAnchor).not.toHaveAttribute('target');
  });

  it('falls back to safe readable source when a custom renderer throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const source = [
      'Readable introduction.',
      '',
      '![force-render-error](/images/failure.png)',
      '',
      'Literal \\* marker and partial **draft',
    ].join('\n');

    try {
      const { container } = render(<MarkdownRenderer content={source} />);
      const fallback = container.querySelector(
        '[data-markdown-fallback="article"]'
      );

      expect(fallback).toBeInTheDocument();
      expect(fallback).toHaveAttribute('role', 'document');
      expect(fallback).toHaveTextContent('Readable introduction.');
      expect(fallback).toHaveTextContent(
        'Literal \\* marker and partial **draft'
      );
      expect(fallback?.querySelector('pre')).toHaveClass(
        'whitespace-pre-wrap',
        'break-words'
      );
      expect(container.querySelector('img')).not.toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });
});
