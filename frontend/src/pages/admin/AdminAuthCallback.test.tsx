import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  mockConsumeAdminReturnPath,
  mockConsumeOAuthHandoff,
  mockNavigate,
  mockSetTokens,
  mockSetTokensFromOAuth,
} = vi.hoisted(() => ({
  mockConsumeAdminReturnPath: vi.fn(() => '/admin/config/health'),
  mockConsumeOAuthHandoff: vi.fn(),
  mockNavigate: vi.fn(),
  mockSetTokens: vi.fn(),
  mockSetTokensFromOAuth: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/stores/session/useAuthStore', () => ({
  useAuthStore: () => ({
    setTokens: mockSetTokens,
    setTokensFromOAuth: mockSetTokensFromOAuth,
  }),
}));

vi.mock('@/services/session/adminReturnTo', () => ({
  consumeAdminReturnPath: mockConsumeAdminReturnPath,
}));

vi.mock('@/services/session/auth', () => ({
  consumeOAuthHandoff: mockConsumeOAuthHandoff,
}));

import AdminAuthCallback from './AdminAuthCallback';

function renderCallback(hash: string) {
  window.history.replaceState(null, '', `/admin/auth/callback${hash}`);

  return render(
    <MemoryRouter initialEntries={['/admin/auth/callback']}>
      <AdminAuthCallback />
    </MemoryRouter>,
  );
}

describe('AdminAuthCallback', () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('normalizes OAuth error hash values before displaying them', async () => {
    const rawError = '\u001b]0;ignored title\u0007Denied\u001b[31m now\u001b[0m';

    renderCallback(`#error=${encodeURIComponent(rawError)}`);

    expect(
      await screen.findByText('Authentication failed: Denied now'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ignored title/)).not.toBeInTheDocument();
  });

  it('does not continue a legacy callback when the mocked store rejects its tokens', async () => {
    mockSetTokensFromOAuth.mockReturnValueOnce(false);

    renderCallback(
      `#token=${encodeURIComponent('access token')}&refreshToken=refresh-token`,
    );

    expect(
      await screen.findByText('Authentication failed: invalid credentials'),
    ).toBeInTheDocument();
    expect(mockSetTokensFromOAuth).toHaveBeenCalledWith(
      'access token',
      'refresh-token',
    );
    expect(mockConsumeAdminReturnPath).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('continues a legacy callback when the mocked store accepts its tokens', async () => {
    mockSetTokensFromOAuth.mockReturnValueOnce(true);

    renderCallback('#token=opaque-access-token&refreshToken=opaque-refresh-token');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin/config/health', {
        replace: true,
      });
    });
    expect(mockSetTokensFromOAuth).toHaveBeenCalledWith(
      'opaque-access-token',
      'opaque-refresh-token',
    );
    expect(mockConsumeAdminReturnPath).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('');
  });

  it('normalizes handoff exchange errors before displaying them', async () => {
    mockConsumeOAuthHandoff.mockRejectedValueOnce(
      new Error('\u001b]2;ignored title\u0007Exchange\u001b[31m failed\u001b[0m'),
    );

    renderCallback('#handoff=oauth-handoff-test');

    await waitFor(() => {
      expect(mockConsumeOAuthHandoff).toHaveBeenCalledWith('oauth-handoff-test');
    });
    expect(
      await screen.findByText('Authentication failed: Exchange failed'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ignored title/)).not.toBeInTheDocument();
  });
});
