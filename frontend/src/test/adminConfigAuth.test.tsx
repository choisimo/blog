import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetMe,
  mockGetTotpSetup,
  mockGetTotpSetupStatus,
  mockGetValidAccessToken,
  mockInitiateTotpChallenge,
  mockIsAuthenticated,
  mockConsumeAdminReturnPath,
  mockLogout,
  mockLocation,
  mockNavigate,
  mockRememberAdminReturnPath,
  mockScheduleTokenRefresh,
  mockSetTokens,
  mockVerifyTotpCode,
  mockVerifyTotpSetup,
} = vi.hoisted(() => ({
  mockGetMe: vi.fn(),
  mockGetTotpSetup: vi.fn(),
  mockGetTotpSetupStatus: vi.fn(),
  mockGetValidAccessToken: vi.fn(),
  mockInitiateTotpChallenge: vi.fn(),
  mockIsAuthenticated: vi.fn(),
  mockConsumeAdminReturnPath: vi.fn(() => '/admin/config/content'),
  mockLogout: vi.fn(),
  mockLocation: {
    pathname: '/admin/login',
    search: '',
    state: null as { from?: string } | null,
  },
  mockNavigate: vi.fn(),
  mockRememberAdminReturnPath: vi.fn(),
  mockScheduleTokenRefresh: vi.fn(),
  mockSetTokens: vi.fn(),
  mockVerifyTotpCode: vi.fn(),
  mockVerifyTotpSetup: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useLocation: () => mockLocation,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/services/session/auth', () => ({
  getMe: mockGetMe,
  getTotpSetup: mockGetTotpSetup,
  getTotpSetupStatus: mockGetTotpSetupStatus,
  initiateTotpChallenge: mockInitiateTotpChallenge,
  verifyTotpCode: mockVerifyTotpCode,
  verifyTotpSetup: mockVerifyTotpSetup,
}));

vi.mock('@/services/session/adminReturnTo', () => ({
  consumeAdminReturnPath: mockConsumeAdminReturnPath,
  rememberAdminReturnPath: mockRememberAdminReturnPath,
}));

vi.mock('@/stores/session/useAuthStore', () => ({
  migrateFromLegacyStorage: vi.fn(),
  scheduleTokenRefresh: mockScheduleTokenRefresh,
  useAuthStore: () => ({
    getValidAccessToken: mockGetValidAccessToken,
    isAuthenticated: mockIsAuthenticated,
    logout: mockLogout,
    setTokens: mockSetTokens,
    user: null,
  }),
}));

vi.mock('@/pages/admin/AdminDashboard', () => ({
  AdminDashboard: () => <div>Admin dashboard</div>,
}));

import AdminConfig from '@/pages/admin/AdminConfig';

function errorWithStatus(
  status: number,
  message: string,
): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

describe('AdminConfig auth boundaries', () => {
  afterEach(() => {
    mockGetMe.mockReset();
    mockGetTotpSetup.mockReset();
    mockGetTotpSetupStatus.mockReset();
    mockGetValidAccessToken.mockReset();
    mockInitiateTotpChallenge.mockReset();
    mockIsAuthenticated.mockReset();
    mockConsumeAdminReturnPath.mockClear();
    mockLogout.mockReset();
    mockNavigate.mockReset();
    mockScheduleTokenRefresh.mockReset();
    mockSetTokens.mockReset();
    mockRememberAdminReturnPath.mockClear();
    mockVerifyTotpCode.mockReset();
    mockVerifyTotpSetup.mockReset();
    mockLocation.pathname = '/admin/login';
    mockLocation.search = '';
    mockLocation.state = null;
    sessionStorage.clear();
  });

  it.each([
    [
      'transport rejection',
      '/admin/login',
      new Error('network failure\r\ninternal detail'),
    ],
    [
      'HTTP 503 rejection',
      '/admin/config',
      errorWithStatus(503, 'upstream unavailable'),
    ],
    [
      'HTTP 429 rejection',
      '/admin/login',
      errorWithStatus(429, 'rate limited'),
    ],
  ] as const)(
    'keeps persisted credentials and exposes retry for an inconclusive %s',
    async (_case, pathname, failure) => {
      mockLocation.pathname = pathname;
      mockIsAuthenticated.mockReturnValue(true);
      mockGetValidAccessToken.mockResolvedValue('admin-access-token');
      mockGetMe.mockRejectedValue(failure);

      render(<AdminConfig />);

      expect(
        await screen.findByRole('button', {
          name: 'Retry session validation',
        }),
      ).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Unable to verify the current admin session',
      );
      expect(screen.queryByText(failure.message)).not.toBeInTheDocument();
      expect(mockLogout).not.toHaveBeenCalled();
      expect(mockGetTotpSetupStatus).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockScheduleTokenRefresh).not.toHaveBeenCalled();
      expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument();
      expect(mockSetTokens).not.toHaveBeenCalled();
      expect(mockIsAuthenticated).toHaveBeenCalledTimes(1);
      expect(mockGetValidAccessToken).toHaveBeenCalledTimes(1);
      expect(mockGetMe).toHaveBeenCalledTimes(1);
      expect(mockGetMe).toHaveBeenCalledWith('admin-access-token');
    },
  );

  it('retries session validation once and suppresses overlapping retry activation', async () => {
    const user = {
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
      emailVerified: true,
    };
    let resolveRetry: (value: typeof user) => void = () => {};
    const retryResult = new Promise<typeof user>(resolve => {
      resolveRetry = resolve;
    });

    mockIsAuthenticated.mockReturnValue(true);
    mockGetValidAccessToken.mockResolvedValue('admin-access-token');
    mockGetMe
      .mockRejectedValueOnce(new Error('temporary transport failure'))
      .mockReturnValueOnce(retryResult);

    render(<AdminConfig />);

    const retryButton = await screen.findByRole('button', {
      name: 'Retry session validation',
    });

    act(() => {
      retryButton.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
      retryButton.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
    });

    await waitFor(() => {
      expect(mockGetMe).toHaveBeenCalledTimes(2);
    });
    expect(mockLogout).not.toHaveBeenCalled();

    await act(async () => {
      resolveRetry(user);
      await retryResult;
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
    expect(mockNavigate).toHaveBeenCalledWith('/admin/config/content', {
      replace: true,
    });
    expect(mockGetMe).toHaveBeenCalledTimes(2);
    expect(mockIsAuthenticated).toHaveBeenCalledTimes(2);
    expect(mockGetValidAccessToken).toHaveBeenCalledTimes(2);
    expect(mockScheduleTokenRefresh).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockGetTotpSetupStatus).not.toHaveBeenCalled();
  });

  it.each([401, 403])(
    'logs out and resolves the existing entry flow for a definitive HTTP %s rejection',
    async status => {
      mockIsAuthenticated.mockReturnValue(true);
      mockGetValidAccessToken.mockResolvedValue('admin-access-token');
      mockGetMe.mockRejectedValue(
        errorWithStatus(status, 'authentication rejected'),
      );
      mockLogout.mockResolvedValue(undefined);
      mockGetTotpSetupStatus.mockResolvedValue({ setupComplete: true });

      render(<AdminConfig />);

      expect(
        await screen.findByRole('button', { name: 'Get Challenge' }),
      ).toBeInTheDocument();
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockGetTotpSetupStatus).toHaveBeenCalledTimes(1);
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockScheduleTokenRefresh).not.toHaveBeenCalled();
      expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument();
    },
  );

  it('trims setup tokens before loading first-time TOTP setup', async () => {
    mockIsAuthenticated.mockReturnValue(false);
    mockGetTotpSetupStatus.mockResolvedValue({ setupComplete: false });
    mockGetTotpSetup.mockResolvedValue({ setupComplete: false });

    render(<AdminConfig />);

    fireEvent.change(await screen.findByLabelText('Access key'), {
      target: { value: ' setup-token ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));

    await waitFor(() => {
      expect(mockGetTotpSetup).toHaveBeenCalledWith('setup-token');
    });
  });

  it('keeps the access-key gate when TOTP setup success validation rejects', async () => {
    mockIsAuthenticated.mockReturnValue(false);
    mockGetTotpSetupStatus.mockResolvedValue({ setupComplete: false });
    mockGetTotpSetup.mockRejectedValue(new Error('Invalid response'));

    render(<AdminConfig />);

    fireEvent.change(await screen.findByLabelText('Access key'), {
      target: { value: 'setup-token' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid response',
    );
    expect(screen.getByLabelText('Access key')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Get Challenge' }),
    ).not.toBeInTheDocument();
  });

  it('keeps TOTP setup visible when setup verification rejects', async () => {
    mockIsAuthenticated.mockReturnValue(false);
    mockGetTotpSetupStatus.mockResolvedValue({ setupComplete: false });
    mockGetTotpSetup.mockResolvedValue({
      setupComplete: false,
      secret: 'totp-secret',
    });
    mockVerifyTotpSetup.mockRejectedValue(
      new Error('Setup verification failed'),
    );

    render(<AdminConfig />);

    fireEvent.change(await screen.findByLabelText('Access key'), {
      target: { value: 'setup-token' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));

    fireEvent.change(await screen.findByLabelText('Confirm code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Complete Setup' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Setup verification failed',
    );
    expect(screen.getByLabelText('Confirm code')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Get Challenge' }),
    ).not.toBeInTheDocument();
    expect(mockSetTokens).not.toHaveBeenCalled();
  });

  it('rejects header-breaking setup tokens before API calls', async () => {
    mockIsAuthenticated.mockReturnValue(false);
    mockGetTotpSetupStatus.mockResolvedValue({ setupComplete: false });

    render(<AdminConfig />);

    fireEvent.change(await screen.findByLabelText('Access key'), {
      target: { value: 'setup-token\r\nX-Injected: yes' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));

    expect(mockGetTotpSetup).not.toHaveBeenCalled();
  });

  it('rejects control-contaminated setup tokens before API calls', async () => {
    mockIsAuthenticated.mockReturnValue(false);
    mockGetTotpSetupStatus.mockResolvedValue({ setupComplete: false });

    render(<AdminConfig />);

    fireEvent.change(await screen.findByLabelText('Access key'), {
      target: { value: 'setup-token\u0000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));

    expect(mockGetTotpSetup).not.toHaveBeenCalled();
  });

  it('rejects malformed TOTP challenge responses before verification', async () => {
    mockIsAuthenticated.mockReturnValue(false);
    mockGetTotpSetupStatus.mockResolvedValue({ setupComplete: true });
    mockInitiateTotpChallenge.mockResolvedValue({
      challengeId: 'challenge-1\r\nX-Injected: yes',
    });

    render(<AdminConfig />);

    fireEvent.click(await screen.findByRole('button', { name: 'Get Challenge' }));

    expect(
      await screen.findByText('Invalid challenge response'),
    ).toBeInTheDocument();
    expect(mockVerifyTotpCode).not.toHaveBeenCalled();
  });

  it('keeps TOTP login active when the auth store rejects returned credentials', async () => {
    mockIsAuthenticated.mockReturnValue(false);
    mockGetTotpSetupStatus.mockResolvedValue({ setupComplete: true });
    mockInitiateTotpChallenge.mockResolvedValue({ challengeId: 'challenge-1' });
    mockVerifyTotpCode.mockResolvedValue({
      accessToken: 'access-token%0Ainjected',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        emailVerified: true,
      },
    });
    mockSetTokens.mockReturnValue(false);

    render(<AdminConfig />);

    fireEvent.click(await screen.findByRole('button', { name: 'Get Challenge' }));
    fireEvent.change(await screen.findByLabelText('TOTP code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid authentication response',
    );
    expect(screen.getByLabelText('TOTP code')).toBeInTheDocument();
    expect(screen.queryByText('Initializing…')).not.toBeInTheDocument();
    expect(mockScheduleTokenRefresh).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('preserves authenticated navigation when the auth store accepts credentials', async () => {
    const response = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        emailVerified: true,
      },
    };
    mockIsAuthenticated.mockReturnValue(false);
    mockGetTotpSetupStatus.mockResolvedValue({ setupComplete: true });
    mockInitiateTotpChallenge.mockResolvedValue({ challengeId: 'challenge-1' });
    mockVerifyTotpCode.mockResolvedValue(response);
    mockSetTokens.mockReturnValue(true);

    render(<AdminConfig />);

    fireEvent.click(await screen.findByRole('button', { name: 'Get Challenge' }));
    fireEvent.change(await screen.findByLabelText('TOTP code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
    expect(mockSetTokens).toHaveBeenCalledWith(
      response.accessToken,
      response.refreshToken,
      response.user,
    );
    expect(screen.queryByLabelText('TOTP code')).not.toBeInTheDocument();
  });
});
