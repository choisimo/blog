import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { AuthGuard } from '@/components/common/AuthGuard';
import { cancelTokenRefresh, useAuthStore } from '@/stores/session/useAuthStore';

vi.mock('@/services/session/auth', async () => {
  const actual = await vi.importActual<typeof import('@/services/session/auth')>(
    '@/services/session/auth'
  );
  return {
    ...actual,
    getMe: vi.fn(),
  };
});

function LoginProbe() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '';
  return (
    <div>
      <span data-testid="path">{location.pathname}</span>
      <span data-testid="from">{from}</span>
    </div>
  );
}

describe('AuthGuard admin routing', () => {
  beforeEach(() => {
    cancelTokenRefresh();
    sessionStorage.clear();
    localStorage.clear();
    act(() => {
      useAuthStore.getState().clearAuth();
    });
  });

  afterEach(() => {
    cancelTokenRefresh();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('redirects unauthenticated admin access to /admin/login with the original path', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/config/workers?tab=secrets']}>
        <Routes>
          <Route
            path="/admin/config/workers"
            element={
              <AuthGuard>
                <div>protected</div>
              </AuthGuard>
            }
          />
          <Route path="/admin/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('path')).toHaveTextContent('/admin/login');
    });

    expect(screen.getByTestId('from')).toHaveTextContent(
      '/admin/config/workers?tab=secrets'
    );
  });
});
