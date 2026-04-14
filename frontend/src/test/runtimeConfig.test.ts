import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { preloadRuntimeConfig } from '@/lib/runtime/preloadRuntimeConfig';

describe('runtime config preload', () => {
  beforeEach(() => {
    delete (window as Window & { APP_CONFIG?: unknown }).APP_CONFIG;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as Window & { APP_CONFIG?: unknown }).APP_CONFIG;
  });

  it('merges runtime-config.json into APP_CONFIG before app bootstrap', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          apiBaseUrl: 'https://api.example.com',
          terminalGatewayUrl: 'wss://terminal.example.com',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await preloadRuntimeConfig(fetchMock);

    expect(fetchMock).toHaveBeenCalledWith('/runtime-config.json', { cache: 'no-store' });
    expect((window as Window & { APP_CONFIG?: Record<string, unknown> }).APP_CONFIG).toMatchObject({
      apiBaseUrl: 'https://api.example.com',
      terminalGatewayUrl: 'wss://terminal.example.com',
    });
  });

  it('keeps bootstrap resilient when runtime-config.json is unavailable', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(preloadRuntimeConfig(fetchMock)).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
  });
});
