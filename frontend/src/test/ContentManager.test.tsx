import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ContentManager,
  normalizeCtaHref,
} from '@/components/features/admin/content/ContentManager';

const mocks = vi.hoisted(() => ({
  getAdminSiteContentBlock: vi.fn(),
  saveSiteContentBlock: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/components/features/blog/SafeDescriptionMarkdown', () => ({
  SafeDescriptionMarkdown: ({ text }: { text: string }) => (
    <div data-testid='markdown-preview'>{text}</div>
  ),
}));

vi.mock('@/components/features/admin/content/PostEditorWorkspace', () => ({
  PostEditorWorkspace: () => <div>Mock post editor</div>,
}));

vi.mock('@/services/content/site-content', () => ({
  HOME_AI_CTA_BLOCK_KEY: 'home_ai_cta',
  DEFAULT_HOME_AI_CTA_BLOCK: {
    key: 'home_ai_cta',
    markdown: 'Default CTA markdown',
    ctaLabel: 'Open AI tools',
    ctaHref: '/?ai=chat',
    enabled: true,
    updatedAt: null,
  },
  getAdminSiteContentBlock: mocks.getAdminSiteContentBlock,
  saveSiteContentBlock: mocks.saveSiteContentBlock,
}));

function renderContentManager() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ContentManager subtab='home-cta' />
    </QueryClientProvider>,
  );
}

describe('ContentManager', () => {
  beforeEach(() => {
    mocks.getAdminSiteContentBlock.mockRejectedValue(
      new Error('Home CTA store unavailable'),
    );
    mocks.saveSiteContentBlock.mockResolvedValue({
      key: 'home_ai_cta',
      markdown: 'Saved CTA',
      ctaLabel: null,
      ctaHref: null,
      enabled: true,
      updatedAt: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('disables Home CTA editing and saving when the initial content load fails', async () => {
    renderContentManager();

    await waitFor(() => {
      expect(screen.getByText('Unable to load Home CTA')).toBeInTheDocument();
    });

    expect(screen.getByText('Home CTA store unavailable')).toBeInTheDocument();
    expect(mocks.getAdminSiteContentBlock).toHaveBeenCalledWith('home_ai_cta');
    expect(screen.getByRole('button', { name: 'Refresh content' }))
      .toHaveAttribute('title', 'Refresh content');

    expect(screen.getByLabelText('Markdown')).toBeDisabled();
    expect(screen.getByLabelText('CTA label')).toBeDisabled();
    expect(screen.getByLabelText('CTA href')).toBeDisabled();
    expect(screen.getByRole('switch', { name: /Enabled/i })).toBeDisabled();

    const saveButton = screen.getByRole('button', { name: /^Save$/i });
    expect(saveButton).toBeDisabled();
    fireEvent.click(saveButton);

    expect(mocks.saveSiteContentBlock).not.toHaveBeenCalled();
  });

  it('preserves unsaved Home CTA edits when content is refetched', async () => {
    mocks.getAdminSiteContentBlock
      .mockResolvedValueOnce({
        key: 'home_ai_cta',
        markdown: 'Remote CTA v1',
        ctaLabel: 'Open',
        ctaHref: '/open',
        enabled: true,
        updatedAt: null,
      })
      .mockResolvedValueOnce({
        key: 'home_ai_cta',
        markdown: 'Remote CTA v2',
        ctaLabel: 'Updated elsewhere',
        ctaHref: '/updated',
        enabled: false,
        updatedAt: null,
      });

    renderContentManager();

    const markdown = await screen.findByLabelText('Markdown');
    expect(markdown).toHaveValue('Remote CTA v1');

    fireEvent.change(markdown, { target: { value: 'Unsaved local CTA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh content' }));

    await waitFor(() => {
      expect(mocks.getAdminSiteContentBlock).toHaveBeenCalledTimes(2);
    });

    expect(markdown).toHaveValue('Unsaved local CTA');
    expect(screen.getByTestId('markdown-preview')).toHaveTextContent(
      'Unsaved local CTA',
    );
  });

  it('rejects polluted Home CTA hrefs before saving', async () => {
    mocks.getAdminSiteContentBlock.mockResolvedValueOnce({
      key: 'home_ai_cta',
      markdown: 'Remote CTA',
      ctaLabel: 'Open',
      ctaHref: '/open',
      enabled: true,
      updatedAt: null,
    });

    renderContentManager();

    const href = await screen.findByLabelText('CTA href');
    fireEvent.change(href, { target: { value: '/safe%0Aevil' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    expect(mocks.saveSiteContentBlock).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Save failed',
        description: 'CTA href is invalid.',
        variant: 'destructive',
      }),
    );
  });

  it('normalizes Home CTA hrefs with a strict URL body boundary', () => {
    expect(normalizeCtaHref(' /open ')).toBe('/open');
    expect(normalizeCtaHref('https://example.com/path')).toBe(
      'https://example.com/path',
    );
    expect(normalizeCtaHref('/open path')).toBeNull();
    expect(normalizeCtaHref('/open%20path')).toBeNull();
    expect(normalizeCtaHref('/open%0Apath')).toBeNull();
    expect(normalizeCtaHref('/open\\path')).toBeNull();
    expect(normalizeCtaHref('http://example.com')).toBeNull();
    expect(normalizeCtaHref('javascript:alert(1)')).toBeNull();
  });
});
