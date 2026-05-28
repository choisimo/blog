import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyBuildTimeRuntimeConfig,
  preloadRuntimeConfig,
} from '@/lib/runtime/preloadRuntimeConfig';

describe('runtime config preload', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    delete (window as Window & { APP_CONFIG?: unknown }).APP_CONFIG;
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    delete (window as Window & { APP_CONFIG?: unknown }).APP_CONFIG;
  });

  it('applies build-time runtime config before fetching runtime-config.json', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.nodove.com/');
    vi.stubEnv('VITE_CHAT_BASE_URL', 'https://chat.nodove.com/');
    vi.stubEnv('VITE_FEATURE_AI_ENABLED', 'true');
    vi.stubEnv('VITE_FEATURE_TERMINAL_ENABLED', 'false');

    applyBuildTimeRuntimeConfig();

    expect((window as Window & { APP_CONFIG?: Record<string, unknown> }).APP_CONFIG).toMatchObject({
      apiBaseUrl: 'https://api.nodove.com/',
      chatBaseUrl: 'https://chat.nodove.com/',
      features: {
        aiEnabled: true,
        terminalEnabled: false,
      },
    });
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

  it('keeps build-time feature flags when runtime-config.json only overrides a subset', async () => {
    vi.stubEnv('VITE_FEATURE_AI_ENABLED', 'true');
    vi.stubEnv('VITE_FEATURE_COMMENTS_ENABLED', 'false');

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          features: {
            commentsEnabled: true,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await preloadRuntimeConfig(fetchMock);

    expect((window as Window & { APP_CONFIG?: Record<string, unknown> }).APP_CONFIG).toMatchObject({
      features: {
        aiEnabled: true,
        commentsEnabled: true,
      },
    });
  });

  it('does not let a stale local runtime API base override production build config', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'noblog.nodove.com' },
    });
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.nodove.com');

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          apiBaseUrl: 'http://localhost:5080',
          chatBaseUrl: 'http://127.0.0.1:5080',
          terminalGatewayUrl: 'wss://terminal.example.com',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await preloadRuntimeConfig(fetchMock);

    expect((window as Window & { APP_CONFIG?: Record<string, unknown> }).APP_CONFIG).toMatchObject({
      apiBaseUrl: 'https://api.nodove.com',
      terminalGatewayUrl: 'wss://terminal.example.com',
    });
    expect(
      (window as Window & { APP_CONFIG?: Record<string, unknown> }).APP_CONFIG
        ?.chatBaseUrl
    ).toBeUndefined();
  });
});
