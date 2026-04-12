import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { syncUnreadNotifications } from '@/services/realtime/notifications';
import { useAuthStore } from '@/stores/session/useAuthStore';

function createToken(expiresInSeconds = 3600) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      iat: Math.floor(Date.now() / 1000),
    })
  );
  return `${header}.${payload}.signature`;
}

describe('notification auth gating', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useAuthStore.getState().clearAuth();
    (window as Window & { APP_CONFIG?: { apiBaseUrl?: string | null } }).APP_CONFIG = {
      apiBaseUrl: 'https://api.nodove.com',
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearAuth();
  });

  it('does not fetch unread notifications without an admin session', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    await syncUnreadNotifications();

    expect(
      fetchSpy.mock.calls.some(([input]) =>
        String(input).includes('/api/v1/notifications/unread')
      )
    ).toBe(false);
  });

  it('fetches unread notifications after admin login', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    useAuthStore.getState().setTokens(createToken(), createToken(7 * 24 * 3600), {
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
      emailVerified: true,
    });

    await syncUnreadNotifications();

    expect(
      fetchSpy.mock.calls.some(([input]) =>
        String(input).includes('/api/v1/notifications/unread')
      )
    ).toBe(true);
  });
});
