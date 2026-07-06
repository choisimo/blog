import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetMe,
  mockGetValidAccessToken,
  mockIsAuthenticated,
  mockLogout,
} = vi.hoisted(() => ({
  mockGetMe: vi.fn(),
  mockGetValidAccessToken: vi.fn(),
  mockIsAuthenticated: vi.fn(),
  mockLogout: vi.fn(),
}));

vi.mock('@/stores/session/useAuthStore', () => ({
  useAuthStore: () => ({
    getValidAccessToken: mockGetValidAccessToken,
    isAuthenticated: mockIsAuthenticated,
    logout: mockLogout,
  }),
}));

vi.mock('@/services/session/auth', () => ({
  getMe: mockGetMe,
}));

import { AuthGuard } from '@/components/common/AuthGuard';

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/admin/config/logs?tab=errors']}>
      <Routes>
        <Route path="/admin/login" element={<div>login page</div>} />
        <Route
          path="/admin/config/logs"
          element={
            <AuthGuard>
              <div>admin secret</div>
            </AuthGuard>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function LoginStateProbe() {
  const location = useLocation();
  const state = location.state as { from?: string } | null;
  return <div>login from: {state?.from || 'none'}</div>;
}

function renderGuardAt(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin/login" element={<LoginStateProbe />} />
        <Route
          path="/admin/config/logs"
          element={
            <AuthGuard>
              <div>admin secret</div>
            </AuthGuard>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuthGuard', () => {
  afterEach(() => {
    mockGetMe.mockReset();
    mockGetValidAccessToken.mockReset();
    mockIsAuthenticated.mockReset();
    mockLogout.mockReset();
  });

  it('allows verified admin users through', async () => {
    mockIsAuthenticated.mockReturnValue(true);
    mockGetValidAccessToken.mockResolvedValue(' admin-token ');
    mockGetMe.mockResolvedValue({
      username: 'admin',
      email: 'admin@example.com',
      role: 'ADMIN',
      emailVerified: true,
    });

    renderGuard();

    expect(await screen.findByText('admin secret')).toBeInTheDocument();
    expect(mockGetMe).toHaveBeenCalledWith('admin-token');
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('logs out and redirects non-admin users', async () => {
    mockIsAuthenticated.mockReturnValue(true);
    mockGetValidAccessToken.mockResolvedValue('user-token');
    mockGetMe.mockResolvedValue({
      username: 'writer',
      email: 'writer@example.com',
      role: 'writer',
      emailVerified: true,
    });

    renderGuard();

    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('rejects header-breaking access tokens before verification', async () => {
    mockIsAuthenticated.mockReturnValue(true);
    mockGetValidAccessToken.mockResolvedValue('admin\r\nX-Injected: yes');

    renderGuard();

    await waitFor(() => {
      expect(screen.getByText('login page')).toBeInTheDocument();
    });
    expect(mockGetMe).not.toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('rejects control-contaminated access tokens before verification', async () => {
    mockIsAuthenticated.mockReturnValue(true);
    mockGetValidAccessToken.mockResolvedValue('admin-token\u0000');

    renderGuard();

    await waitFor(() => {
      expect(screen.getByText('login page')).toBeInTheDocument();
    });
    expect(mockGetMe).not.toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('normalizes unsafe login return state when redirecting unauthenticated users', async () => {
    mockIsAuthenticated.mockReturnValue(false);

    renderGuardAt('/admin/config/logs?next=%2F%2Fevil.test');

    expect(
      await screen.findByText('login from: /admin/config/health'),
    ).toBeInTheDocument();
    expect(mockGetMe).not.toHaveBeenCalled();
  });
});
