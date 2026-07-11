import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetTotpSetupStatus,
  mockInitiateTotpChallenge,
  mockUseAuthStore,
} = vi.hoisted(() => ({
  mockGetTotpSetupStatus: vi.fn(),
  mockInitiateTotpChallenge: vi.fn(),
  mockUseAuthStore: vi.fn(),
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useLocation: () => ({
      pathname: '/admin/login',
      state: null,
    }),
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/services/session/auth', () => ({
  getMe: vi.fn(),
  getTotpSetup: vi.fn(),
  getTotpSetupStatus: mockGetTotpSetupStatus,
  initiateTotpChallenge: mockInitiateTotpChallenge,
  verifyTotpCode: vi.fn(),
  verifyTotpSetup: vi.fn(),
}));

vi.mock('@/services/session/adminReturnTo', () => ({
  consumeAdminReturnPath: vi.fn(() => '/admin/config/content'),
  rememberAdminReturnPath: vi.fn(),
}));

vi.mock('@/stores/session/useAuthStore', () => ({
  migrateFromLegacyStorage: vi.fn(),
  scheduleTokenRefresh: vi.fn(),
  useAuthStore: mockUseAuthStore,
}));

vi.mock('@/pages/admin/AdminDashboard', () => ({
  AdminDashboard: () => <div>Admin dashboard</div>,
}));

import AdminConfig from '@/pages/admin/AdminConfig';

describe('AdminConfig', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetTotpSetupStatus.mockReset();
    mockInitiateTotpChallenge.mockReset();
    mockUseAuthStore.mockReturnValue({
      getValidAccessToken: vi.fn(),
      isAuthenticated: vi.fn(() => false),
      logout: vi.fn(),
      setTokens: vi.fn(),
      user: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the TOTP challenge service error in the administrator alert', async () => {
    mockGetTotpSetupStatus.mockResolvedValue({ setupComplete: true });
    mockInitiateTotpChallenge.mockRejectedValue(
      new Error('Challenge locked Try again'),
    );

    render(<AdminConfig />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Get Challenge' }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Challenge locked Try again');
  });

  it('renders the TOTP setup status service error in the initial-gate alert', async () => {
    mockGetTotpSetupStatus.mockRejectedValue(
      new Error('Status lookup failed Try again'),
    );

    render(<AdminConfig />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Status lookup failed Try again');
    expect(screen.getByLabelText('Access key')).toBeInTheDocument();
  });

  it('keeps the initial gate when TOTP setup status success validation fails', async () => {
    mockGetTotpSetupStatus.mockRejectedValue(new Error('Invalid response'));

    render(<AdminConfig />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid response',
    );
    expect(screen.getByLabelText('Access key')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Get Challenge' }),
    ).not.toBeInTheDocument();
  });

  it('suppresses duplicate TOTP challenge requests while one is already running', async () => {
    mockGetTotpSetupStatus.mockResolvedValue({ setupComplete: true });
    let resolveChallenge: (value: { challengeId: string }) => void = () => {};
    mockInitiateTotpChallenge.mockReturnValue(
      new Promise(resolve => {
        resolveChallenge = resolve;
      }),
    );

    render(<AdminConfig />);

    const challengeButton = await screen.findByRole('button', {
      name: 'Get Challenge',
    });

    act(() => {
      challengeButton.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
      challengeButton.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
    });

    expect(mockInitiateTotpChallenge).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveChallenge({ challengeId: 'totp-challenge-1' });
    });

    await waitFor(() => {
      expect(screen.getByLabelText('TOTP code')).toBeInTheDocument();
    });
  });
});
