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
        message: 'Improve this draft',
        sessionId: 'session-1',
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
      message: 'Improve this draft',
      sessionId: 'session-1',
      mode: 'blog',
      maxIterations: 6,
      temperature: 0.4,
    });
  });
});
