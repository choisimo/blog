import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  mockConsumeAdminReturnPath,
  mockConsumeOAuthHandoff,
  mockSetTokens,
  mockSetTokensFromOAuth,
} = vi.hoisted(() => ({
  mockConsumeAdminReturnPath: vi.fn(() => '/admin/config/health'),
  mockConsumeOAuthHandoff: vi.fn(),
  mockSetTokens: vi.fn(),
  mockSetTokensFromOAuth: vi.fn(),
}));

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
