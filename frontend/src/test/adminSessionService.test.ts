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
      year: '2026',
      content: '# Test',
    });
  });

  it('normalizes create post request payloads before admin fetch', async () => {
    const data = {
      prUrl: 'https://github.com/example/blog/pull/1',
      status: 'pending',
      branch: 'post/test-post',
      path: 'frontend/public/posts/2026/test-post.md',
    };
    mockAdminFetchRaw.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      createPostPR({
        title: ' Test Post ',
        slug: ' Test Post!! ',
        year: ' 2026 ',
        content: ' # Test\r\nBody ',
        draft: true,
      }),
    ).resolves.toEqual(data);

    const [, options] = mockAdminFetchRaw.mock.calls[0];
    expect(JSON.parse(String(options.body))).toEqual({
      title: 'Test Post',
      slug: 'test-post',
      year: '2026',
      content: '# Test\nBody',
      draft: true,
    });
  });

  it('rejects invalid create post payloads before admin fetch', async () => {
    await expect(
      createPostPR({
        title: 'Test\r\nPost',
        slug: 'test-post',
        year: 2026,
        content: '# Test',
      }),
    ).rejects.toThrow('Invalid create post title');
    await expect(
      createPostPR({
        title: 'Test Post',
        slug: 'test-post',
        year: '20\n26',
        content: '# Test',
      }),
    ).rejects.toThrow('Invalid create post year');
    await expect(
      createPostPR({
        title: 'Test Post',
        slug: 'test-post',
        year: 2026,
        content: ' ',
      }),
    ).rejects.toThrow('Invalid create post content');

    expect(mockAdminFetchRaw).not.toHaveBeenCalled();
  });

  it('surfaces create post backend error messages', async () => {
    mockAdminFetchRaw.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: { message: 'Title is required' },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      createPostPR({
        title: '',
        slug: 'test-post',
        year: 2026,
        content: '# Test',
      }),
    ).rejects.toThrow('Title is required');
  });

  it('fails closed when create post success data is malformed', async () => {
    mockAdminFetchRaw.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { branch: 'post/test' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      createPostPR({
        title: 'Test Post',
        slug: 'test-post',
        year: 2026,
        content: '# Test',
      }),
    ).rejects.toThrow('Create post PR returned an invalid response');
  });

  it('normalizes create post PR response path fields', async () => {
    mockAdminFetchRaw.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            prUrl: ' https://github.com/example/blog/pull/1 ',
            status: 'pending',
            branch: ' post/test-post ',
            path: ' frontend/public/posts/2026/test-post.md ',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      createPostPR({
        title: 'Test Post',
        slug: 'test-post',
        year: 2026,
        content: '# Test',
      }),
    ).resolves.toMatchObject({
      prUrl: 'https://github.com/example/blog/pull/1',
      branch: 'post/test-post',
      path: 'frontend/public/posts/2026/test-post.md',
    });
  });

  it('fails closed when create post PR response paths contain line endings', async () => {
    mockAdminFetchRaw.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            branch: 'post/test-post',
            path: 'frontend/public/posts/2026/test-post.md\r\nX-Injected: yes',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      createPostPR({
        title: 'Test Post',
        slug: 'test-post',
        year: 2026,
        content: '# Test',
      }),
    ).rejects.toThrow('Create post PR returned an invalid response');

    mockAdminFetchRaw.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            branch: 'post/test-post%09tab',
            path: 'frontend/public/posts/2026/test-post.md',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      createPostPR({
        title: 'Test Post',
        slug: 'test-post',
        year: 2026,
        content: '# Test',
      }),
    ).rejects.toThrow('Create post PR returned an invalid response');
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

  it('leaves a later-file presign transport rejection unchanged', async () => {
    const laterPresignError = new Error(' Later\u0000\nmessage ');
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
            data: { url: '/images/2026/test-post/first.png' },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockRejectedValueOnce(laterPresignError);

    const firstFile = new File(['first'], 'first.png', { type: 'image/png' });
    const secondFile = new File(['second'], 'second.png', { type: 'image/png' });

    await expect(
      uploadPostImages(
        { year: 2026, slug: 'test-post' },
        [firstFile, secondFile],
      ),
    ).rejects.toBe(laterPresignError);
    expect(mockAdminFetchRaw).toHaveBeenCalledTimes(3);
    expect(mockAdminFetchRaw.mock.calls.map(([url]) => url)).toEqual([
      'https://worker.example.com/api/v1/images/presign',
      'https://worker.example.com/api/v1/images/upload-direct',
      'https://worker.example.com/api/v1/images/presign',
    ]);
  });

  it('rejects invalid image upload path values before admin fetch', async () => {
    const file = new File(['image'], 'cover.png', { type: 'image/png' });

    await expect(
      uploadPostImages(
        { year: '2026\r\nX-Injected: yes', slug: 'test-post' },
        [file],
      ),
    ).rejects.toThrow('Invalid image upload path');
    expect(mockAdminFetchRaw).not.toHaveBeenCalled();
  });

  it('rejects invalid image upload files before admin fetch', async () => {
    const file = new File(['image'], 'cover.png\r\nX-Injected: yes', {
      type: 'image/png',
    });

    await expect(
      uploadPostImages({ year: 2026, slug: 'test-post' }, [file]),
    ).rejects.toThrow('Invalid image upload file');
    expect(mockAdminFetchRaw).not.toHaveBeenCalled();
  });

  it('normalizes direct image upload response URLs', async () => {
    mockAdminFetchRaw
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: { uploadUrl: ' /images/upload-direct ' },
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
            data: { url: ' /images/2026/test-post/cover.png ' },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    const file = new File(['image'], 'cover.png', { type: 'image/png' });

    await expect(
      uploadPostImages({ year: '2026', slug: ' test-post ' }, [file]),
    ).resolves.toEqual({
      dir: '/images/2026/test-post',
      items: [
        {
          url: '/images/2026/test-post/cover.png',
          variantWebp: null,
        },
      ],
    });
  });

  it('falls back when a direct image presign returns a cross-origin upload URL', async () => {
    mockAdminFetchRaw
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: { uploadUrl: 'https://evil.example.com/images/upload-direct' },
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
            data: {
              dir: '/images/2026/test-post',
              items: [{ url: '/images/2026/test-post/cover.png' }],
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    const file = new File(['image'], 'cover.png', { type: 'image/png' });

    await expect(
      uploadPostImages({ year: 2026, slug: 'test-post' }, [file]),
    ).resolves.toEqual({
      dir: '/images/2026/test-post',
      items: [{ url: '/images/2026/test-post/cover.png' }],
    });
    expect(mockAdminFetchRaw).toHaveBeenCalledTimes(2);
    expect(mockAdminFetchRaw.mock.calls[1][0]).toBe(
      'https://worker.example.com/api/v1/images/upload',
    );
  });

  it('surfaces fallback image upload backend error messages', async () => {
    mockAdminFetchRaw
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: { message: 'Presign disabled' },
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: { message: 'Image upload too large' },
          }),
          {
            status: 413,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    const file = new File(['image'], 'cover.png', { type: 'image/png' });

    await expect(
      uploadPostImages({ year: 2026, slug: 'test-post' }, [file]),
    ).rejects.toThrow('Image upload too large');
  });

  it('fails closed when fallback image upload success data is malformed', async () => {
    mockAdminFetchRaw
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: { message: 'Presign disabled' },
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, data: { dir: '/images/2026/test-post' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const file = new File(['image'], 'cover.png', { type: 'image/png' });

    await expect(
      uploadPostImages({ year: 2026, slug: 'test-post' }, [file]),
    ).rejects.toThrow('Image upload returned an invalid response');
  });

  it('fails closed when fallback image upload returns unsafe image paths', async () => {
    mockAdminFetchRaw
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: { message: 'Presign disabled' },
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              dir: '/images/2026/test-post',
              items: [{ url: 'https://evil.example.com/cover.png' }],
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    const file = new File(['image'], 'cover.png', { type: 'image/png' });

    await expect(
      uploadPostImages({ year: 2026, slug: 'test-post' }, [file]),
    ).rejects.toThrow('Image upload returned an invalid response');
  });
});
