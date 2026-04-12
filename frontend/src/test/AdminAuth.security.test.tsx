import { act, render, waitFor } from '@testing-library/react';
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
import { DEFAULT_ADMIN_PATH } from '@/services/session/adminReturnTo';

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
    cancelTokenRefresh();
    localStorage.clear();
    sessionStorage.clear();
    act(() => {
      useAuthStore.getState().clearAuth();
    });
    window.history.replaceState(null, '', '/admin/auth/callback');
  });

  afterEach(() => {
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

  it('clears the OAuth callback hash after extracting tokens', async () => {
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

  it('falls back to the default admin route for unsafe stored redirects', async () => {
    sessionStorage.setItem('admin.returnTo', 'https://evil.example.com');
    window.history.replaceState(
      null,
      '',
      `/admin/auth/callback#token=${createToken()}&refreshToken=${createToken(7 * 24 * 3600)}`
    );

    render(<AdminAuthCallback />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(DEFAULT_ADMIN_PATH, { replace: true });
    });
  });

  it('no longer allows inline style or wildcard data attributes in blog markdown', () => {
    expect(blogMarkdownSanitizeSchema.attributes?.['*']).not.toContain('style');
    expect(blogMarkdownSanitizeSchema.attributes?.div).not.toContain('style');
    expect(blogMarkdownSanitizeSchema.attributes?.div).not.toContain('data-*');
    expect(blogMarkdownSanitizeSchema.attributes?.span).not.toContain('style');
    expect(blogMarkdownSanitizeSchema.attributes?.span).not.toContain('data-*');
  });
});
