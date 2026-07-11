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

  it('sanitizes rejected create-post transport error messages before throwing', async () => {
    adminFetchRawMock.mockRejectedValue(new Error(' Bad\u0000\nmessage '));

    await expect(
      createPostPR({ title: 'Hello', content: 'World' }),
    ).rejects.toHaveProperty('message', 'Bad message');
    expect(adminFetchRawMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['non-Error detail', { message: 'untrusted object message' }],
    ['empty detail', new Error('')],
    ['control-only detail', new Error('\u0000\n\t')],
    ['oversized detail', new Error('x'.repeat(1001))],
  ])(
    'uses the fixed fallback for %s from rejected create-post transport',
    async (_label, rejection) => {
      adminFetchRawMock.mockRejectedValue(rejection);

      await expect(
        createPostPR({ title: 'Hello', content: 'World' }),
      ).rejects.toHaveProperty('message', 'Failed to create PR');
    },
  );

  describe('create-post PR response URL normalization', () => {
    const validPayload = { title: 'Hello', content: 'World' };
    const claimedSuccessLocation = {
      branch: 'post-branch',
      path: 'content/posts/2026/demo.md',
    };

    function mockClaimedSuccess(data: Record<string, unknown>) {
      adminFetchRawMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          data: { ...claimedSuccessLocation, ...data },
        }),
      });
    }

    it.each([
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'blob:https://github.example/pull/123',
      'file:///tmp/pull/123',
    ])(
      'rejects a claimed-success response with PR URL %s',
      async (prUrl) => {
        mockClaimedSuccess({ prUrl, status: 'succeeded' });

        await expect(createPostPR(validPayload)).rejects.toHaveProperty(
          'message',
          'Create post PR returned an invalid response',
        );

        expect(adminFetchRawMock).toHaveBeenCalledTimes(1);
        expect(adminFetchRawMock).toHaveBeenNthCalledWith(
          1,
          'https://api.example.test/api/v1/admin/create-post-pr',
          {
            method: 'POST',
            body: JSON.stringify(validPayload),
          },
        );
      },
    );

    it('accepts a padded HTTPS PR URL and returns its trimmed value', async () => {
      mockClaimedSuccess({
        prUrl: '  https://github.example/blog/pull/123  ',
        status: 'succeeded',
      });

      const result = await createPostPR(validPayload);

      expect(result).toMatchObject({
        prUrl: 'https://github.example/blog/pull/123',
        status: 'succeeded',
        ...claimedSuccessLocation,
      });
    });

    it.each([
      ['absolute HTTP', 'http://github.example/blog/pull/123'],
      ['ordinary relative', 'blog/pull/123?view=files#diff'],
      ['root-relative', '/blog/pull/123'],
      ['protocol-relative', '//github.example/blog/pull/123'],
    ])('accepts an unchanged %s destination', async (_label, prUrl) => {
      mockClaimedSuccess({ prUrl, status: 'succeeded' });

      const result = await createPostPR(validPayload);

      expect(result.prUrl).toBe(prUrl);
    });

    it.each([
      ['absent', undefined],
      ['null', null],
      ['whitespace-only', ' \t\n '],
    ])(
      'preserves a pending outbox response when prUrl is %s',
      async (_label, prUrl) => {
        mockClaimedSuccess({
          status: 'pending',
          outboxId: 'outbox-123',
          ...(prUrl === undefined ? {} : { prUrl }),
        });

        const result = await createPostPR(validPayload);

        expect(result).toMatchObject({
          status: 'pending',
          outboxId: 'outbox-123',
          ...claimedSuccessLocation,
        });
        expect(result.prUrl).toBeUndefined();
      },
    );
  });

  it('sanitizes the rejected first image-presign transport error before throwing', async () => {
    const file = new File(['image'], 'cover.png', { type: 'image/png' });
    adminFetchRawMock.mockRejectedValue(new Error(' Bad\u0000\nmessage '));

    await expect(
      uploadPostImages({ year: '2026', slug: 'demo' }, [file]),
    ).rejects.toHaveProperty('message', 'Bad message');
    expect(adminFetchRawMock).toHaveBeenCalledTimes(1);
    expect(adminFetchRawMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/images/presign',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it.each([
    ['non-Error detail', { message: 'untrusted object message' }],
    ['empty detail', new Error('')],
    ['control-only detail', new Error('\u0000\n\t')],
    ['oversized detail', new Error('x'.repeat(1001))],
  ])(
    'uses the fixed fallback for %s from rejected first image-presign transport',
    async (_label, rejection) => {
      const file = new File(['image'], 'cover.png', { type: 'image/png' });
      adminFetchRawMock.mockRejectedValue(rejection);

      await expect(
        uploadPostImages({ year: '2026', slug: 'demo' }, [file]),
      ).rejects.toHaveProperty('message', 'Failed to presign image upload');
      expect(adminFetchRawMock).toHaveBeenCalledTimes(1);
      expect(adminFetchRawMock.mock.calls[0][0]).toBe(
        'https://api.example.test/api/v1/images/presign',
      );
    },
  );

  it('sanitizes the rejected first direct image-upload transport error before throwing', async () => {
    const file = new File(['image'], 'cover.png', { type: 'image/png' });
    adminFetchRawMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: { uploadUrl: '/images/upload-direct' },
        }),
      })
      .mockRejectedValueOnce(new Error(' Bad\u0000\nmessage '));

    await expect(
      uploadPostImages({ year: '2026', slug: 'demo' }, [file]),
    ).rejects.toHaveProperty('message', 'Bad message');
    expect(adminFetchRawMock).toHaveBeenCalledTimes(2);
    expect(adminFetchRawMock.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/api/v1/images/presign',
      'https://api.example.test/api/v1/images/upload-direct',
    ]);

    const [, uploadOptions] = adminFetchRawMock.mock.calls[1];
    expect(uploadOptions).toEqual(expect.objectContaining({ method: 'POST' }));
    expect(uploadOptions.body).toBeInstanceOf(FormData);
  });

  it.each([
    ['non-Error detail', { message: 'untrusted object message' }],
    ['empty detail', new Error('')],
    ['control-only detail', new Error('\u0000\n\t')],
    ['oversized detail', new Error('x'.repeat(1001))],
  ])(
    'uses the fixed fallback for %s from rejected first direct image-upload transport',
    async (_label, rejection) => {
      const file = new File(['image'], 'cover.png', { type: 'image/png' });
      adminFetchRawMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            data: { uploadUrl: '/images/upload-direct' },
          }),
        })
        .mockRejectedValueOnce(rejection);

      await expect(
        uploadPostImages({ year: '2026', slug: 'demo' }, [file]),
      ).rejects.toHaveProperty('message', 'Failed to upload image directly');
      expect(adminFetchRawMock).toHaveBeenCalledTimes(2);
      expect(adminFetchRawMock.mock.calls.map(([url]) => url)).toEqual([
        'https://api.example.test/api/v1/images/presign',
        'https://api.example.test/api/v1/images/upload-direct',
      ]);
    },
  );

  it('bounds a rejected compatibility upload after an unsuccessful first direct upload', async () => {
    const firstFile = new File(['first-image'], 'first.png', { type: 'image/png' });
    const secondFile = new File(['second-image'], 'second.jpg', { type: 'image/jpeg' });
    const compatibilityRejection = new Error(
      '  Compatibility\u0000\n upload\t rejected  ',
    );
    adminFetchRawMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: { uploadUrl: 'https://api.example.test/images/upload-direct' },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ ok: false }),
      })
      .mockRejectedValueOnce(compatibilityRejection);

    let thrown: unknown;
    try {
      await uploadPostImages(
        { year: ' 2026 ', slug: ' Demo Post!! ' },
        [firstFile, secondFile],
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBe(compatibilityRejection);
    expect((thrown as Error).message).toBe('Compatibility upload rejected');
    expect((thrown as Error).message).not.toBe(
      'Direct image upload failed after partial completion',
    );
    expect((thrown as Error).message).not.toMatch(/[\u0000-\u001F\u007F]/);
    expect((thrown as Error).message.length).toBeLessThanOrEqual(1000);

    expect(adminFetchRawMock).toHaveBeenCalledTimes(3);
    expect(adminFetchRawMock.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/api/v1/images/presign',
      'https://api.example.test/api/v1/images/upload-direct',
      'https://api.example.test/api/v1/images/upload',
    ]);
    expect(
      adminFetchRawMock.mock.calls.filter(
        ([url]) => url === 'https://api.example.test/api/v1/images/presign',
      ),
    ).toHaveLength(1);
    expect(adminFetchRawMock.mock.calls[3]).toBeUndefined();

    const [, directOptions] = adminFetchRawMock.mock.calls[1];
    expect(directOptions).toEqual(expect.objectContaining({ method: 'POST' }));
    expect(directOptions.body).toBeInstanceOf(FormData);

    const [, compatibilityOptions] = adminFetchRawMock.mock.calls[2];
    expect(compatibilityOptions).toEqual(
      expect.objectContaining({ method: 'POST' }),
    );
    expect(compatibilityOptions.body).toBeInstanceOf(FormData);

    const compatibilityBody = compatibilityOptions.body as FormData;
    expect(compatibilityBody.getAll('year')).toEqual(['2026']);
    expect(compatibilityBody.getAll('slug')).toEqual(['demo-post']);
    const compatibilityFiles = compatibilityBody.getAll('files') as File[];
    expect(compatibilityFiles).toHaveLength(2);
    expect(compatibilityFiles.map((file) => file.name)).toEqual([
      firstFile.name,
      secondFile.name,
    ]);
    expect(compatibilityFiles.map((file) => file.type)).toEqual([
      firstFile.type,
      secondFile.type,
    ]);
    expect(compatibilityFiles.map((file) => file.size)).toEqual([
      firstFile.size,
      secondFile.size,
    ]);
  });

  it.each([
    ['non-Error detail', { message: 'untrusted object message' }],
    ['empty detail', new Error('')],
    ['control-only detail', new Error('\u0000\n\t')],
    ['oversized detail', new Error('x'.repeat(1001))],
  ])(
    'uses the fixed fallback for %s from rejected compatibility upload transport',
    async (_label, rejection) => {
      const firstFile = new File(['first'], 'first.png', { type: 'image/png' });
      const secondFile = new File(['second'], 'second.png', { type: 'image/png' });
      adminFetchRawMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            data: { uploadUrl: '/images/upload-direct' },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ ok: false }),
        })
        .mockRejectedValueOnce(rejection);

      await expect(
        uploadPostImages(
          { year: '2026', slug: 'demo' },
          [firstFile, secondFile],
        ),
      ).rejects.toHaveProperty('message', 'Failed to upload');
      expect(adminFetchRawMock).toHaveBeenCalledTimes(3);
    },
  );

  it('leaves a later-file direct image-upload transport rejection unchanged', async () => {
    const laterDirectError = new Error(' Later\u0000\nmessage ');
    adminFetchRawMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: { uploadUrl: '/images/upload-direct-first' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: { url: '/images/2026/demo/first.png' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: { uploadUrl: '/images/upload-direct-second' },
        }),
      })
      .mockRejectedValueOnce(laterDirectError);

    const firstFile = new File(['first'], 'first.png', { type: 'image/png' });
    const secondFile = new File(['second'], 'second.png', { type: 'image/png' });

    await expect(
      uploadPostImages(
        { year: '2026', slug: 'demo' },
        [firstFile, secondFile],
      ),
    ).rejects.toBe(laterDirectError);
    expect(adminFetchRawMock).toHaveBeenCalledTimes(4);
    expect(adminFetchRawMock.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/api/v1/images/presign',
      'https://api.example.test/api/v1/images/upload-direct-first',
      'https://api.example.test/api/v1/images/presign',
      'https://api.example.test/api/v1/images/upload-direct-second',
    ]);
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
