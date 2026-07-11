import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import AdminAuthCallback from '@/pages/admin/AdminAuthCallback';
import { blogMarkdownSanitizeSchema } from '@/components/features/blog/markdownSanitizeSchema';
import {
  cancelTokenRefresh,
  useAuthStore,
} from '@/stores/session/useAuthStore';
import {
  DEFAULT_ADMIN_PATH,
  rememberAdminReturnPath,
  resolveAdminReturnPath,
} from '@/services/session/adminReturnTo';

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

describe('admin auth security hardening', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.nodove.com');
    cancelTokenRefresh();
    localStorage.clear();
    sessionStorage.clear();
    act(() => {
      useAuthStore.getState().clearAuth();
    });
    window.history.replaceState(null, '', '/admin/auth/callback');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    cancelTokenRefresh();
    act(() => {
      useAuthStore.getState().clearAuth();
    });
    localStorage.clear();
    sessionStorage.clear();
  });

  it('persists admin auth in sessionStorage instead of localStorage', async () => {
    act(() => {
      useAuthStore.getState().setTokens(
        createToken(),
        createToken(7 * 24 * 3600),
        {
          username: 'admin',
          email: 'admin@example.com',
          role: 'admin',
          emailVerified: true,
        }
      );
    });

    await waitFor(() => {
      expect(sessionStorage.getItem('admin.auth')).toContain('admin@example.com');
    });

    expect(localStorage.getItem('admin.auth')).toBeNull();
  });

  it('consumes a one-time OAuth handoff and clears the callback hash', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            accessToken: 'opaque-access-token',
            refreshToken: 'opaque-refresh-token',
            tokenType: 'Bearer',
            expiresIn: 900,
            user: {
              username: 'admin',
              email: 'admin@example.com',
              role: 'admin',
              emailVerified: true,
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    sessionStorage.setItem('admin.returnTo', '/admin/config/logs');
    window.history.replaceState(
      null,
      '',
      '/admin/auth/callback#handoff=oauth-handoff-test'
    );

    render(<AdminAuthCallback />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin/config/logs', { replace: true });
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.nodove.com/api/v1/auth/oauth/handoff/consume',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(useAuthStore.getState().accessToken).toBe('opaque-access-token');
    expect(useAuthStore.getState().refreshToken).toBe('opaque-refresh-token');
    expect(window.location.hash).toBe('');
  });

  it('does not navigate when a handoff response is rejected by the auth store', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            accessToken: 'access token',
            refreshToken: 'refresh-token',
            tokenType: 'Bearer',
            expiresIn: 900,
            user: {
              username: 'admin',
              email: 'admin@example.com',
              role: 'admin',
              emailVerified: true,
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    sessionStorage.setItem('admin.returnTo', '/admin/config/logs');
    window.history.replaceState(
      null,
      '',
      '/admin/auth/callback#handoff=oauth-handoff-test'
    );

    render(<AdminAuthCallback />);

    expect(
      await screen.findByText('Authentication failed: invalid credentials'),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(sessionStorage.getItem('admin.returnTo')).toBe('/admin/config/logs');
    expect(window.location.hash).toBe('');
  });

  it('keeps supporting legacy OAuth token fragments during rollout', async () => {
    sessionStorage.setItem('admin.returnTo', '/admin/config/logs');
    window.history.replaceState(
      null,
      '',
      `/admin/auth/callback#token=${createToken()}&refreshToken=${createToken(7 * 24 * 3600)}`
    );

    render(<AdminAuthCallback />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin/config/logs', { replace: true });
    });

    expect(window.location.hash).toBe('');
  });

  it('does not navigate or consume the return path when the real store rejects legacy fragments', async () => {
    sessionStorage.setItem('admin.returnTo', '/admin/config/logs');
    window.history.replaceState(
      null,
      '',
      `/admin/auth/callback#token=${encodeURIComponent('access token')}&refreshToken=opaque-refresh-token`
    );

    render(<AdminAuthCallback />);

    expect(
      await screen.findByText('Authentication failed: invalid credentials'),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(sessionStorage.getItem('admin.returnTo')).toBe('/admin/config/logs');
    expect(window.location.hash).toBe('');
  });

  it('falls back to the default admin route for unsafe stored redirects', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            accessToken: createToken(),
            refreshToken: createToken(7 * 24 * 3600),
            tokenType: 'Bearer',
            expiresIn: 900,
            user: {
              username: 'admin',
              email: 'admin@example.com',
              role: 'admin',
              emailVerified: true,
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    sessionStorage.setItem('admin.returnTo', 'https://evil.example.com');
    window.history.replaceState(null, '', '/admin/auth/callback#handoff=oauth-handoff-test');
    render(<AdminAuthCallback />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(DEFAULT_ADMIN_PATH, { replace: true });
    });
  });

  it('rejects absolute cross-origin admin return paths', () => {
    expect(
      rememberAdminReturnPath('https://evil.example.com/admin/config/secrets'),
    ).toBe(DEFAULT_ADMIN_PATH);
    expect(sessionStorage.getItem('admin.returnTo')).toBe(DEFAULT_ADMIN_PATH);

    sessionStorage.clear();

    expect(
      resolveAdminReturnPath('//evil.example.com/admin/config/health'),
    ).toBe(DEFAULT_ADMIN_PATH);
  });

  it('heals unsafe stored admin return paths during resolution', () => {
    sessionStorage.setItem('admin.returnTo', 'https://evil.example.com/admin/config/logs');

    expect(resolveAdminReturnPath('/admin/config/secrets')).toBe(DEFAULT_ADMIN_PATH);
    expect(sessionStorage.getItem('admin.returnTo')).toBe(DEFAULT_ADMIN_PATH);

    sessionStorage.setItem('admin.returnTo', ' /admin/config/logs?tab=errors ');

    expect(resolveAdminReturnPath()).toBe('/admin/config/logs?tab=errors');
    expect(sessionStorage.getItem('admin.returnTo')).toBe('/admin/config/logs?tab=errors');
  });

  it('normalizes safe admin return paths and rejects CRLF variants', () => {
    expect(
      rememberAdminReturnPath(' /admin/config/logs?tab=errors '),
    ).toBe('/admin/config/logs?tab=errors');
    expect(sessionStorage.getItem('admin.returnTo')).toBe(
      '/admin/config/logs?tab=errors',
    );

    expect(
      rememberAdminReturnPath('/admin/config/logs\r\nX-Injected: yes'),
    ).toBe(DEFAULT_ADMIN_PATH);
    expect(
      resolveAdminReturnPath('/admin/config/logs?next=%0D%0AX-Injected%3Ayes'),
    ).toBe(DEFAULT_ADMIN_PATH);
  });

  it('treats OAuth errors as authoritative before consuming a handoff', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            accessToken: createToken(),
            refreshToken: createToken(7 * 24 * 3600),
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    window.history.replaceState(
      null,
      '',
      '/admin/auth/callback#error=access_denied&handoff=oauth-handoff-test'
    );

    render(<AdminAuthCallback />);

    expect(
      await screen.findByText('Authentication failed: access_denied'),
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('rejects header-breaking OAuth handoff values before exchange', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    window.history.replaceState(
      null,
      '',
      '/admin/auth/callback#handoff=oauth-handoff%0D%0AX-Injected%3A%20yes'
    );

    render(<AdminAuthCallback />);

    expect(
      await screen.findByText('Authentication failed: invalid handoff'),
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('rejects control-contaminated OAuth handoff values before exchange', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    window.history.replaceState(
      null,
      '',
      '/admin/auth/callback#handoff=oauth-handoff%00evil'
    );

    render(<AdminAuthCallback />);

    expect(
      await screen.findByText('Authentication failed: invalid handoff'),
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('rejects header-breaking legacy OAuth token fragments before storing auth', async () => {
    window.history.replaceState(
      null,
      '',
      `/admin/auth/callback#token=admin-token%0D%0AX-Injected%3A%20yes&refreshToken=${createToken(7 * 24 * 3600)}`
    );

    render(<AdminAuthCallback />);

    expect(
      await screen.findByText('Authentication failed: invalid tokens'),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('normalizes control-contaminated OAuth error messages before rendering', async () => {
    window.history.replaceState(
      null,
      '',
      '/admin/auth/callback#error=access%00denied%7Fnow'
    );

    render(<AdminAuthCallback />);

    expect(
      await screen.findByText('Authentication failed: access denied now'),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('no longer allows inline style or wildcard data attributes in blog markdown', () => {
    expect(blogMarkdownSanitizeSchema.attributes?.['*']).not.toContain('style');
    expect(blogMarkdownSanitizeSchema.attributes?.div).not.toContain('style');
    expect(blogMarkdownSanitizeSchema.attributes?.div).not.toContain('data-*');
    expect(blogMarkdownSanitizeSchema.attributes?.span).not.toContain('style');
    expect(blogMarkdownSanitizeSchema.attributes?.span).not.toContain('data-*');
  });
});
