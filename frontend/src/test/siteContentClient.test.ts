import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAdminSiteContentBlock,
  getSiteContentBlock,
  saveSiteContentBlock,
} from '@/services/content/site-content/client';
import { HOME_AI_CTA_BLOCK_KEY } from '@/services/content/site-content/types';

const mocks = vi.hoisted(() => ({
  adminApiFetch: vi.fn(),
}));

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: () => 'https://api.example.com',
}));

vi.mock('@/services/admin/apiClient', () => ({
  adminApiFetch: mocks.adminApiFetch,
}));

const validBlock = {
  key: HOME_AI_CTA_BLOCK_KEY,
  markdown: '### Hello',
  ctaLabel: 'Open',
  ctaHref: '/?ai=chat',
  enabled: true,
  updatedAt: null,
};

describe('site content client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns validated public site content blocks', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          block: {
            ...validBlock,
            ignored: 'value',
          },
        },
      }),
    });

    await expect(getSiteContentBlock(HOME_AI_CTA_BLOCK_KEY)).resolves.toEqual({
      ...validBlock,
      ignored: 'value',
    });
  });

  it('normalizes public CTA display fields while preserving markdown', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          block: {
            ...validBlock,
            markdown: '### Hello\n\nKeep raw markdown',
            ctaLabel: 'Open\nTools',
            ctaHref: '/safe%09evil',
          },
        },
      }),
    });

    await expect(getSiteContentBlock(HOME_AI_CTA_BLOCK_KEY)).resolves.toEqual({
      ...validBlock,
      markdown: '### Hello\n\nKeep raw markdown',
      ctaLabel: 'Open Tools',
      ctaHref: null,
    });
  });

  it('returns null for malformed public site content blocks', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          block: {
            ...validBlock,
            enabled: 'true',
          },
        },
      }),
    });

    await expect(getSiteContentBlock(HOME_AI_CTA_BLOCK_KEY)).resolves.toBeNull();
  });

  it('returns null for malformed admin load blocks', async () => {
    mocks.adminApiFetch.mockResolvedValue({
      ok: true,
      data: {
        block: {
          ...validBlock,
          updatedAt: 123,
        },
      },
    });

    await expect(
      getAdminSiteContentBlock(HOME_AI_CTA_BLOCK_KEY),
    ).resolves.toBeNull();
  });

  it('rejects malformed admin save blocks', async () => {
    mocks.adminApiFetch.mockResolvedValue({
      ok: true,
      data: {
        block: {
          ...validBlock,
          ctaHref: 123,
        },
      },
    });

    await expect(
      saveSiteContentBlock(HOME_AI_CTA_BLOCK_KEY, {
        markdown: '### Hello',
      }),
    ).rejects.toThrow('Failed to save site content block');
  });

  it('rejects polluted block keys before public and admin requests', async () => {
    await expect(
      getSiteContentBlock('home_ai_cta%0Aevil' as typeof HOME_AI_CTA_BLOCK_KEY),
    ).resolves.toBeNull();
    await expect(
      getAdminSiteContentBlock('home_ai_cta%0Aevil' as typeof HOME_AI_CTA_BLOCK_KEY),
    ).rejects.toThrow('Invalid site content block key');
    await expect(
      saveSiteContentBlock('home_ai_cta%0Aevil' as typeof HOME_AI_CTA_BLOCK_KEY, {
        markdown: '### Hello',
      }),
    ).rejects.toThrow('Invalid site content block key');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.adminApiFetch).not.toHaveBeenCalled();
  });

  it('rejects polluted CTA hrefs before admin save requests', async () => {
    await expect(
      saveSiteContentBlock(HOME_AI_CTA_BLOCK_KEY, {
        markdown: '### Hello',
        ctaLabel: 'Open\nTools',
        ctaHref: 'https://user:pass@example.com/safe',
      }),
    ).rejects.toThrow('Invalid site content CTA href');

    expect(mocks.adminApiFetch).not.toHaveBeenCalled();
  });

  it('normalizes admin save payload CTA fields while preserving markdown', async () => {
    mocks.adminApiFetch.mockResolvedValue({
      ok: true,
      data: {
        block: {
          ...validBlock,
          markdown: '### Hello\n\nKeep raw markdown',
          ctaLabel: 'Open Tools',
          ctaHref: '/safe',
        },
      },
    });

    await saveSiteContentBlock(HOME_AI_CTA_BLOCK_KEY, {
      markdown: '### Hello\n\nKeep raw markdown',
      ctaLabel: 'Open\nTools',
      ctaHref: ' /safe ',
    });

    expect(mocks.adminApiFetch).toHaveBeenCalledWith('/admin/home_ai_cta', {
      pathPrefix: '/api/v1/site-content',
      method: 'PUT',
      body: {
        markdown: '### Hello\n\nKeep raw markdown',
        ctaLabel: 'Open Tools',
        ctaHref: '/safe',
      },
    });
  });
});
