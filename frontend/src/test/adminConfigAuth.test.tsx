import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetMe,
  mockGetTotpSetup,
  mockGetTotpSetupStatus,
  mockGetValidAccessToken,
  mockInitiateTotpChallenge,
  mockIsAuthenticated,
  mockLogout,
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
  mockLogout: vi.fn(),
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
    useLocation: () => ({
      pathname: '/admin/login',
      search: '',
      state: null,
    }),
    useNavigate: () => vi.fn(),
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

vi.mock('@/stores/session/useAuthStore', () => ({
  migrateFromLegacyStorage: vi.fn(),
  scheduleTokenRefresh: vi.fn(),
  useAuthStore: () => ({
    getValidAccessToken: mockGetValidAccessToken,
    isAuthenticated: mockIsAuthenticated,
    logout: mockLogout,
    setTokens: mockSetTokens,
    user: null,
  }),
}));

import AdminConfig from '@/pages/admin/AdminConfig';

describe('AdminConfig auth boundaries', () => {
  afterEach(() => {
    mockGetMe.mockReset();
    mockGetTotpSetup.mockReset();
    mockGetTotpSetupStatus.mockReset();
    mockGetValidAccessToken.mockReset();
    mockInitiateTotpChallenge.mockReset();
    mockIsAuthenticated.mockReset();
    mockLogout.mockReset();
    mockSetTokens.mockReset();
    mockVerifyTotpCode.mockReset();
    mockVerifyTotpSetup.mockReset();
    sessionStorage.clear();
  });

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
});
