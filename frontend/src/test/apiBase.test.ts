import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getApiBaseUrl } from '@/utils/network/apiBase';

describe('api base runtime contract', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    (window as Window & { APP_CONFIG?: { apiBaseUrl?: string | null } }).APP_CONFIG = undefined;
    (window as Window & { __APP_CONFIG?: { apiBaseUrl?: string | null } }).__APP_CONFIG = undefined;
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('uses the explicit runtime API base when present', () => {
    (window as Window & { APP_CONFIG?: { apiBaseUrl?: string | null } }).APP_CONFIG = {
      apiBaseUrl: 'https://api.example.com/',
    };

    expect(getApiBaseUrl()).toBe('https://api.example.com');
  });

  it('uses the build-time API base when runtime config is unavailable', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'noblog.nodove.com' },
    });
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.nodove.com/');

    expect(getApiBaseUrl()).toBe('https://api.nodove.com');
  });

  it('fails closed on non-local hosts when neither runtime nor build-time config is available', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'blog.nodove.com' },
    });

    expect(() => getApiBaseUrl()).toThrow(
      '[apiBase] Missing runtime API base for blog.nodove.com. Production origin must be provided explicitly via public runtime config.'
    );
  });

  it('keeps localhost fallback for local development', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'localhost' },
    });

    expect(getApiBaseUrl()).toBe('http://localhost:5080');
  });
});
