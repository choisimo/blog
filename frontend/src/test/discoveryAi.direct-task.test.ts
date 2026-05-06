import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  getPrincipalToken: vi.fn(async () => 'principal-token'),
  refreshPrincipalTokenAfterAuthFailure: vi.fn(async () => 'fresh-principal-token'),
}));

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: () => 'https://api.example.com',
}));

vi.mock('@/services/session/userContentAuth', () => ({
  getPrincipalToken: authMocks.getPrincipalToken,
  refreshPrincipalTokenAfterAuthFailure: authMocks.refreshPrincipalTokenAfterAuthFailure,
}));

describe('discovery AI direct tasks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authMocks.getPrincipalToken.mockResolvedValue('principal-token');
    authMocks.refreshPrincipalTokenAfterAuthFailure.mockResolvedValue('fresh-principal-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the direct AI sketch endpoint with principal auth', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            mood: 'curious',
            bullets: ['AI-generated point'],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { sketch } = await import('@/services/discovery/ai');

    await expect(
      sketch({ paragraph: 'A paragraph about Unix pipes.' }),
    ).resolves.toEqual({
      mood: 'curious',
      bullets: ['AI-generated point'],
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/ai/sketch',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer principal-token',
        }),
      }),
    );
  });

  it('refreshes stale principal auth once when the server rejects an invalid signature', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: {
              message: 'Invalid signature',
              code: 'UNAUTHORIZED',
            },
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              mood: 'curious',
              bullets: ['Retried with fresh auth'],
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    const { sketch } = await import('@/services/discovery/ai');

    await expect(sketch({ paragraph: 'A paragraph.' })).resolves.toEqual({
      mood: 'curious',
      bullets: ['Retried with fresh auth'],
    });

    expect(authMocks.refreshPrincipalTokenAfterAuthFailure).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'https://api.example.com/api/v1/ai/sketch',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer principal-token',
        }),
      }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'https://api.example.com/api/v1/ai/sketch',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer fresh-principal-token',
        }),
      }),
    );
  });

  it('rejects server fallback data instead of rendering a local fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            mood: 'reflective',
            bullets: ['Original paragraph copied back'],
            _fallback: true,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { sketch } = await import('@/services/discovery/ai');

    await expect(
      sketch({ paragraph: 'Original paragraph copied back.' }),
    ).rejects.toThrow(/fallback/i);
  });

  it('rejects failed task responses instead of synthesizing fallback bullets', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            message: 'AI task failed',
            code: 'AI_TASK_FAILED',
          },
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { sketch } = await import('@/services/discovery/ai');

    await expect(
      sketch({ paragraph: 'This text should not become fallback bullets.' }),
    ).rejects.toThrow('AI task failed');
  });
});
