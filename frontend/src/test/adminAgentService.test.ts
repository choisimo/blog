import { afterEach, describe, expect, it, vi } from 'vitest';

const mockAdminFetchRaw = vi.hoisted(() => vi.fn());

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: vi.fn(() => 'https://worker.example.com'),
}));

vi.mock('@/services/admin/apiClient', () => ({
  adminFetchRaw: mockAdminFetchRaw,
}));

import { runBlogAgent } from '@/services/session/agent';

describe('admin agent service', () => {
  afterEach(() => {
    mockAdminFetchRaw.mockReset();
  });

  it('runs the blog agent through the shared admin API client', async () => {
    const data = {
      response: 'Draft updated',
      actions: [{ type: 'set_title', value: 'New title' }],
      sessionId: 'session-1',
      toolsUsed: ['blog_ops'],
      memoryUpdated: false,
      model: 'test-model',
    };
    mockAdminFetchRaw.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await runBlogAgent(
      {
        message: ' Improve this draft\r\nPreserve tone ',
        sessionId: ' session-1 ',
        maxIterations: 99,
        temperature: 3,
      },
    );

    expect(result).toEqual(data);
    expect(mockAdminFetchRaw).toHaveBeenCalledTimes(1);

    const [url, options] = mockAdminFetchRaw.mock.calls[0];
    expect(url).toBe('https://worker.example.com/api/v1/agent/run');
    expect(options).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Idempotency-Key': expect.stringMatching(/^agent-run:/),
        }),
      }),
    );
    expect(JSON.parse(String(options.body))).toEqual({
      message: 'Improve this draft\nPreserve tone',
      sessionId: 'session-1',
      mode: 'blog',
      maxIterations: 12,
      temperature: 2,
    });
  });

  it('rejects unsafe agent request payloads before admin fetch', async () => {
    await expect(
      runBlogAgent({
        message: ' ',
        sessionId: 'session-1',
      }),
    ).rejects.toThrow('Invalid AI agent message');
    await expect(
      runBlogAgent({
        message: 'Improve this draft',
        sessionId: 'session%0a1',
      }),
    ).rejects.toThrow('Invalid AI agent session id');

    expect(mockAdminFetchRaw).not.toHaveBeenCalled();
  });

  it('fails closed when the agent success envelope is missing required data', async () => {
    mockAdminFetchRaw.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { response: 'partial' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      runBlogAgent({
        message: 'Improve this draft',
        sessionId: 'session-1',
      }),
    ).rejects.toThrow('AI agent returned an invalid response');
  });

  it('fails closed when the agent returns unsafe tool or action metadata', async () => {
    mockAdminFetchRaw.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            response: 'Draft updated',
            actions: [{ type: 'set_cover_image', url: 'https://evil.example.com/cover.png' }],
            sessionId: 'session-1',
            toolsUsed: ['blog_ops\r\nInjected'],
            memoryUpdated: false,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      runBlogAgent({
        message: 'Improve this draft',
        sessionId: 'session-1',
      }),
    ).rejects.toThrow('AI agent returned an invalid response');
  });

  it('normalizes safe agent editor actions before returning them', async () => {
    mockAdminFetchRaw.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            response: 'Draft updated',
            actions: [
              { type: 'set_tags', value: ' react, testing ' },
              { type: 'append_content', content: ' First line\r\nSecond line ' },
            ],
            sessionId: 'session-1',
            toolsUsed: ['blog_ops'],
            memoryUpdated: false,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      runBlogAgent({
        message: 'Improve this draft',
        sessionId: 'session-1',
      }),
    ).resolves.toMatchObject({
      actions: [
        { type: 'set_tags', tags: ['react', 'testing'] },
        { type: 'append_content', markdown: 'First line\nSecond line' },
      ],
    });
  });
});
