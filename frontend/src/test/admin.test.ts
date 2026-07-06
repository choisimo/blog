import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminFetchRawMock = vi.hoisted(() => vi.fn());
const getApiBaseUrlMock = vi.hoisted(() => vi.fn(() => 'https://api.example.test'));

vi.mock('@/services/admin/apiClient', () => ({
  adminFetchRaw: adminFetchRawMock,
}));

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: getApiBaseUrlMock,
}));

import { createPostPR, uploadPostImages } from '@/services/session/admin';

describe('admin session service', () => {
  beforeEach(() => {
    adminFetchRawMock.mockReset();
    getApiBaseUrlMock.mockReturnValue('https://api.example.test');
  });

  it('normalizes create-post title and content controls before POSTing', async () => {
    adminFetchRawMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          branch: 'post-branch',
          path: 'content/posts/2026/demo.md',
          status: 'pending',
        },
      }),
    });

    await expect(
      createPostPR({
        title: ' Hello\u0000\nWorld ',
        content: ' Line one\u0000\r\nLine two ',
        draft: true,
      }),
    ).resolves.toMatchObject({
      branch: 'post-branch',
      path: 'content/posts/2026/demo.md',
    });

    expect(adminFetchRawMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/admin/create-post-pr',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Hello World',
          content: 'Line one \nLine two',
          draft: true,
        }),
      }),
    );
  });

  it('sanitizes admin API error messages before throwing', async () => {
    adminFetchRawMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        ok: false,
        error: { message: ' Bad\u0000\nmessage ' },
      }),
    });

    await expect(
      createPostPR({ title: 'Hello', content: 'World' }),
    ).rejects.toThrow('Bad message');
  });

  it('rejects upload responses containing control characters in image paths', async () => {
    const file = new File(['image'], 'cover.png', { type: 'image/png' });
    adminFetchRawMock
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ ok: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            dir: '/images/2026/demo\u0000',
            items: [],
          },
        }),
      });

    await expect(
      uploadPostImages({ year: '2026', slug: 'demo' }, [file]),
    ).rejects.toThrow('Image upload returned an invalid response');
  });
});
