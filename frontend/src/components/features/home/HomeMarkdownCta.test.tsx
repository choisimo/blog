import type { SiteContentBlock } from '@/services/content/site-content';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HomeMarkdownCta } from './HomeMarkdownCta';

vi.mock('@/components/features/blog/SafeDescriptionMarkdown', () => ({
  SafeDescriptionMarkdown: ({ text }: { text: string }) => <div>{text}</div>,
}));

function makeBlock(
  overrides: Partial<SiteContentBlock> = {}
): SiteContentBlock {
  return {
    id: 'home-ai-cta',
    key: 'home-ai-cta',
    enabled: true,
    markdown: 'Ask AI about this archive.',
    ctaHref: '/console',
    ctaLabel: 'Open console',
    ...overrides,
  } as unknown as SiteContentBlock;
}

function renderCta(block: SiteContentBlock) {
  render(
    <MemoryRouter>
      <HomeMarkdownCta block={block} state='ready' isTerminal={false} />
    </MemoryRouter>
  );
}

describe('HomeMarkdownCta', () => {
  it('sanitizes markdown and CTA label while preserving a safe internal CTA', () => {
    renderCta(
      makeBlock({
        markdown: '\u001b[31mAsk AI\u001b[0m now\u0007',
        ctaHref: '/console',
        ctaLabel: '\u001b[32mOpen console\u001b[0m\u0000',
      })
    );

    expect(screen.getByText('Ask AI now')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open console/i })).toHaveAttribute(
      'href',
      '/console'
    );
  });

  it('does not render configured CTAs with unsafe hrefs', () => {
    renderCta(
      makeBlock({
        ctaHref: 'javascript:alert(1)',
        ctaLabel: 'Launch',
      })
    );

    expect(screen.queryByRole('link', { name: /Launch/i })).not.toBeInTheDocument();
  });

  it('renders safe external CTAs with a blank-target boundary', () => {
    renderCta(
      makeBlock({
        ctaHref: 'HTTPS://example.com/learn',
        ctaLabel: 'Read more',
      })
    );

    const link = screen.getByRole('link', { name: /Read more/i });
    expect(link).toHaveAttribute('href', 'HTTPS://example.com/learn');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
