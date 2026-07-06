import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from './AuthGuard';

const { authStoreMock, getMeMock, locationMock } = vi.hoisted(() => ({
  authStoreMock: {
    isAuthenticated: vi.fn(),
    getValidAccessToken: vi.fn(),
    logout: vi.fn(),
  },
  getMeMock: vi.fn(),
  locationMock: {
    pathname: '/admin/posts',
    search: '?tab=list',
  },
}));

vi.mock('@/stores/session/useAuthStore', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/services/session/auth', () => ({
  getMe: getMeMock,
}));

vi.mock('@/services/session/adminReturnTo', () => ({
  DEFAULT_ADMIN_PATH: '/admin',
}));

vi.mock('react-router-dom', () => ({
  Navigate: ({
    to,
    replace,
    state,
  }: {
    to: string;
    replace?: boolean;
    state?: { from?: string };
  }) => (
    <div
      data-testid='navigate'
      data-to={to}
      data-replace={String(replace)}
      data-from={state?.from}
    />
  ),
  useLocation: () => locationMock,
}));

describe('AuthGuard', () => {
  afterEach(() => {
    authStoreMock.isAuthenticated.mockReset();
    authStoreMock.getValidAccessToken.mockReset();
    authStoreMock.logout.mockReset();
    getMeMock.mockReset();
    locationMock.pathname = '/admin/posts';
    locationMock.search = '?tab=list';
  });

  it('sanitizes the verifying status accessibility label', () => {
    authStoreMock.isAuthenticated.mockReturnValue(true);
    authStoreMock.getValidAccessToken.mockReturnValue(new Promise(() => {}));

    render(
      <AuthGuard
        loadingLabel={'\u001b]0;Hidden label\u0007\u001b[31mChecking admin\u0000'}
      >
        <div>Secret admin</div>
      </AuthGuard>
    );

    const status = screen.getByRole('status', { name: 'Checking admin' });

    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status.getAttribute('aria-label')).not.toContain('Hidden');
    expect(status.getAttribute('aria-label')).not.toContain('\u001b');
    expect(status.querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByText('Secret admin')).not.toBeInTheDocument();
  });

  it('falls back to the default verifying label when sanitized label is empty', () => {
    authStoreMock.isAuthenticated.mockReturnValue(true);
    authStoreMock.getValidAccessToken.mockReturnValue(new Promise(() => {}));

    render(
      <AuthGuard loadingLabel={'\u001b]0;Hidden label\u0007\u001b[32m\u0007'}>
        <div>Secret admin</div>
      </AuthGuard>
    );

    expect(screen.getByRole('status', { name: '인증 확인 중' })).toBeInTheDocument();
  });

  it('renders children after an admin token is verified', async () => {
    authStoreMock.isAuthenticated.mockReturnValue(true);
    authStoreMock.getValidAccessToken.mockResolvedValue(' token ');
    getMeMock.mockResolvedValue({ role: ' ADMIN ' });

    render(
      <AuthGuard>
        <div>Authorized admin</div>
      </AuthGuard>
    );

    expect(await screen.findByText('Authorized admin')).toBeInTheDocument();
    expect(getMeMock).toHaveBeenCalledWith('token');
    expect(authStoreMock.logout).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated users with a normalized admin return path', async () => {
    authStoreMock.isAuthenticated.mockReturnValue(false);
    locationMock.pathname = '/admin/posts';
    locationMock.search = '?tab=list';

    render(
      <AuthGuard>
        <div>Secret admin</div>
      </AuthGuard>
    );

    const navigate = await screen.findByTestId('navigate');

    expect(navigate).toHaveAttribute('data-to', '/admin/login');
    expect(navigate).toHaveAttribute('data-replace', 'true');
    expect(navigate).toHaveAttribute('data-from', '/admin/posts?tab=list');
  });

  it('falls back to the default admin return path for unsafe paths', async () => {
    authStoreMock.isAuthenticated.mockReturnValue(false);
    locationMock.pathname = '/admin/%2fsecret';
    locationMock.search = '';

    render(
      <AuthGuard>
        <div>Secret admin</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByTestId('navigate')).toHaveAttribute('data-from', '/admin');
    });
  });
});
