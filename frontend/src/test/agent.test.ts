import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminFetchRawMock = vi.hoisted(() => vi.fn());
const getApiBaseUrlMock = vi.hoisted(() => vi.fn(() => 'https://api.example.test'));

vi.mock('@/services/admin/apiClient', () => ({
  adminFetchRaw: adminFetchRawMock,
}));

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: getApiBaseUrlMock,
}));

import { runBlogAgent } from '@/services/session/agent';

describe('agent service', () => {
  beforeEach(() => {
    adminFetchRawMock.mockReset();
    getApiBaseUrlMock.mockReturnValue('https://api.example.test');
  });

  it('normalizes request message controls and bounded numeric options', async () => {
    adminFetchRawMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          response: ' Done\u0000\nnow ',
          sessionId: 'agent-session',
          toolsUsed: [' search\u0000tool '],
          memoryUpdated: false,
          actions: [
            {
              type: 'set_title',
              value: ' My\u0000 Title ',
            },
            {
              type: 'insert_markdown',
              markdown: ' Hello\u0000\nworld ',
            },
          ],
        },
      }),
    });

    await expect(
      runBlogAgent({
        message: ' Draft\u0000\r\npost ',
        sessionId: 'agent-session',
        maxIterations: 99,
        temperature: -1,
      }),
    ).resolves.toMatchObject({
      response: 'Done \nnow',
      toolsUsed: ['search tool'],
      actions: [
        { type: 'set_title', value: 'My Title' },
        { type: 'insert_markdown', markdown: 'Hello \nworld' },
      ],
    });

    expect(adminFetchRawMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/agent/run',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          message: 'Draft \npost',
          sessionId: 'agent-session',
          mode: 'blog',
          maxIterations: 12,
          temperature: 0,
        }),
      }),
    );
  });

  it('sanitizes API error messages before throwing', async () => {
    adminFetchRawMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        ok: false,
        error: { message: ' Bad\u0000\nmessage ' },
      }),
    });

    await expect(
      runBlogAgent({ message: 'hello', sessionId: 'agent-session' }),
    ).rejects.toThrow('Bad message');
  });

  it('sanitizes rejected adminFetchRaw error messages before rethrowing', async () => {
    adminFetchRawMock.mockRejectedValue(
      new Error(' Bad\u0000\ntransport message '),
    );

    await expect(
      runBlogAgent({ message: 'hello', sessionId: 'agent-session' }),
    ).rejects.toThrow('Bad transport message');
  });

  it('normalizes token metadata before returning agent responses', async () => {
    adminFetchRawMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          response: 'Done',
          sessionId: 'agent-session',
          toolsUsed: [],
          memoryUpdated: false,
          tokens: {
            ' prompt\u0000tokens ': 10,
            completion: Number.POSITIVE_INFINITY,
            nested: {
              label: ' gpt\u0000usage ',
            },
          },
        },
      }),
    });

    await expect(
      runBlogAgent({ message: 'hello', sessionId: 'agent-session' }),
    ).resolves.toMatchObject({
      tokens: {
        'prompt tokens': 10,
        nested: {
          label: 'gpt usage',
        },
      },
    });
  });

  it('drops unsafe token metadata before returning agent responses', async () => {
    adminFetchRawMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          response: 'Done',
          sessionId: 'agent-session',
          toolsUsed: [],
          memoryUpdated: false,
          tokens: () => 1,
        },
      }),
    });

    await expect(
      runBlogAgent({ message: 'hello', sessionId: 'agent-session' }),
    ).resolves.not.toHaveProperty('tokens');
  });

  it('rejects invalid normalized session ids before calling the agent API', async () => {
    await expect(
      runBlogAgent({ message: 'hello', sessionId: 'bad/session' }),
    ).rejects.toThrow('Invalid AI agent session id');

    expect(adminFetchRawMock).not.toHaveBeenCalled();
  });
});
