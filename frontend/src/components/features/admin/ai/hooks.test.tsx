import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAdminApiFetch = vi.hoisted(() => vi.fn());

vi.mock('@/services/admin/apiClient', () => ({
  adminApiFetch: mockAdminApiFetch,
}));

import {
  useModels,
  usePlayground,
  useProviders,
  useRoutes,
  useTraces,
} from './hooks';

describe('AI admin hooks selector guards', () => {
  beforeEach(() => {
    mockAdminApiFetch.mockReset();
  });

  it('rejects polluted provider path selectors before API calls', async () => {
    const { result } = renderHook(() => useProviders());
    let response: unknown;

    await act(async () => {
      response = await result.current.deleteProvider('provider-1%0Aevil');
    });

    expect(response).toMatchObject({
      ok: false,
      error: 'Invalid provider selector',
    });
    expect(mockAdminApiFetch).not.toHaveBeenCalled();
  });

  it('normalizes model selectors in playground payloads while preserving prompts', async () => {
    mockAdminApiFetch.mockResolvedValue({
      ok: true,
      data: { results: [] },
    });
    const { result } = renderHook(() => usePlayground());

    await act(async () => {
      await result.current.runPlayground({
        model_ids: ['model-1%0Aevil', 'model-1'],
        user_prompt: 'keep raw prompt text\nas-is',
        system_prompt: 'system prompt',
      });
    });

    expect(mockAdminApiFetch).toHaveBeenCalledWith(
      '/playground/run',
      expect.objectContaining({
        pathPrefix: '/api/v1/admin/ai',
        method: 'POST',
        body: expect.objectContaining({
          model_ids: ['model-1'],
          user_prompt: 'keep raw prompt text\nas-is',
          system_prompt: 'system prompt',
        }),
      }),
    );
  });

  it('normalizes model and route payload selectors before update calls', async () => {
    mockAdminApiFetch.mockResolvedValue({
      ok: true,
      data: { id: 'route-1' },
    });
    const { result } = renderHook(() => useRoutes());

    await act(async () => {
      await result.current.updateRoute('route-1', {
        primaryModelId: 'model-1',
        fallbackModelIds: ['model-1', 'model-2%0Aevil', 'model-3'],
        contextWindowFallbackIds: ['model-4%0Aevil', 'model-5'],
      });
    });

    expect(mockAdminApiFetch).toHaveBeenCalledWith(
      '/routes/route-1',
      expect.objectContaining({
        pathPrefix: '/api/v1/admin/ai',
        method: 'PUT',
        body: {
          primaryModelId: 'model-1',
          fallbackModelIds: ['model-3'],
          contextWindowFallbackIds: ['model-5'],
        },
      }),
    );
  });

  it('rejects polluted trace detail selectors before API calls', async () => {
    const { result } = renderHook(() => useTraces());
    let response: unknown;

    await act(async () => {
      response = await result.current.fetchTraceDetail('trace-1%0Aevil');
    });

    expect(response).toMatchObject({
      ok: false,
      error: 'Invalid trace selector',
    });
    expect(mockAdminApiFetch).not.toHaveBeenCalled();
  });

  it('rejects polluted model selectors before model update calls', async () => {
    const { result } = renderHook(() => useModels());
    let response: unknown;

    await act(async () => {
      response = await result.current.updateModel('model-1%0Aevil', {
        isEnabled: false,
      });
    });

    expect(response).toMatchObject({
      ok: false,
      error: 'Invalid model selector',
    });
    expect(mockAdminApiFetch).not.toHaveBeenCalled();
  });
});
