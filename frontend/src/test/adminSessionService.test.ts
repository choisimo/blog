import { afterEach, describe, expect, it, vi } from 'vitest';

const mockAdminFetchRaw = vi.hoisted(() => vi.fn());

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: vi.fn(() => 'https://worker.example.com'),
}));

vi.mock('@/services/admin/apiClient', () => ({
  adminFetchRaw: mockAdminFetchRaw,
}));

import {
  createPostPR,
  uploadPostImages,
} from '@/services/session/admin';

describe('admin session service', () => {
  afterEach(() => {
    mockAdminFetchRaw.mockReset();
  });

  it('creates post PRs through the shared admin API client', async () => {
    const data = {
      prUrl: 'https://github.com/example/blog/pull/1',
      status: 'succeeded',
      branch: 'post/test-post',
      path: 'frontend/public/posts/2026/test-post.md',
    };
    mockAdminFetchRaw.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await createPostPR(
      {
        title: 'Test Post',
        slug: 'test-post',
        year: 2026,
        content: '# Test',
      },
      'expired-access-token',
    );

    expect(result).toEqual(data);
    expect(mockAdminFetchRaw).toHaveBeenCalledTimes(1);

    const [url, options] = mockAdminFetchRaw.mock.calls[0];
    expect(url).toBe('https://worker.example.com/api/v1/admin/create-post-pr');
    expect(options).toEqual(expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(String(options.body))).toEqual({
      title: 'Test Post',
      slug: 'test-post',
      year: 2026,
      content: '# Test',
    });
  });

  it('uploads post images through the shared admin API client', async () => {
    mockAdminFetchRaw
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: { uploadUrl: '/images/upload-direct' },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: { url: '/images/2026/test-post/cover.png' },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    const file = new File(['image'], 'cover.png', { type: 'image/png' });
    const result = await uploadPostImages(
      { year: 2026, slug: 'test-post' },
      [file],
      'expired-access-token',
    );

    expect(result).toEqual({
      dir: '/images/2026/test-post',
      items: [
        {
          url: '/images/2026/test-post/cover.png',
          variantWebp: null,
        },
      ],
    });
    expect(mockAdminFetchRaw).toHaveBeenCalledTimes(2);

    const [presignUrl, presignOptions] = mockAdminFetchRaw.mock.calls[0];
    expect(presignUrl).toBe('https://worker.example.com/api/v1/images/presign');
    expect(JSON.parse(String(presignOptions.body))).toEqual({
      filename: 'cover.png',
      contentType: 'image/png',
      postId: '2026/test-post',
    });

    const [uploadUrl, uploadOptions] = mockAdminFetchRaw.mock.calls[1];
    expect(uploadUrl).toBe('https://worker.example.com/api/v1/images/upload-direct');
    expect(uploadOptions.body).toBeInstanceOf(FormData);
  });
});
