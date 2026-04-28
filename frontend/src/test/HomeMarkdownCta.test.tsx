import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HomeMarkdownCta } from '@/components/features/home';
import type { SiteContentBlock } from '@/services/content/site-content';

const baseBlock: SiteContentBlock = {
  key: 'home_ai_cta',
  markdown:
    '### AI Chat & Writing Assistant\n\n관리자가 작성한 **마크다운**입니다.',
  ctaLabel: 'AI 도구 열기',
  ctaHref: '/?ai=chat',
  enabled: true,
  updatedAt: null,
};

function renderCta(block: SiteContentBlock | null = baseBlock) {
  return render(
    <MemoryRouter>
      <HomeMarkdownCta block={block} state='ready' isTerminal={false} />
    </MemoryRouter>
  );
}

describe('HomeMarkdownCta', () => {
  it('renders admin-managed markdown and an internal CTA link', () => {
    renderCta();

    expect(screen.getByText('AI Chat & Writing Assistant')).toBeInTheDocument();
    expect(
      screen.getByText('마크다운', { selector: 'strong' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /AI 도구 열기/i })).toHaveAttribute(
      'href',
      '/?ai=chat'
    );
  });

  it('uses the safe markdown renderer for raw HTML and unsafe markdown links', () => {
    const { container } = renderCta({
      ...baseBlock,
      markdown:
        'Hello <script>alert("xss")</script> [unsafe](javascript:alert(1)) **safe**',
    });

    expect(container.querySelector('script')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'unsafe' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('safe', { selector: 'strong' })
    ).toBeInTheDocument();
  });

  it('does not render disabled content blocks', () => {
    const { container } = renderCta({
      ...baseBlock,
      enabled: false,
    });

    expect(container).toBeEmptyDOMElement();
  });
});
