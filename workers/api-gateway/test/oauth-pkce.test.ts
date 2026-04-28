import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildGithubAuthUrl,
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  generatePkcePair,
} from '../src/lib/oauth';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('oauth pkce helpers', () => {
  it('builds a GitHub auth URL with PKCE parameters', async () => {
    const { codeChallenge } = await generatePkcePair();
    const url = new URL(
      buildGithubAuthUrl(
        'state-token',
        'github-client-id',
        'https://api.example.com/api/v1/auth/oauth/github/callback',
        codeChallenge
      )
    );

    expect(url.origin).toBe('https://github.com');
    expect(url.searchParams.get('state')).toBe('state-token');
    expect(url.searchParams.get('code_challenge')).toBe(codeChallenge);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('builds a Google auth URL with PKCE parameters', async () => {
    const { codeChallenge } = await generatePkcePair();
    const url = new URL(
      buildGoogleAuthUrl(
        'state-token',
        'google-client-id',
        'https://api.example.com/api/v1/auth/oauth/google/callback',
        codeChallenge
      )
    );

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('state')).toBe('state-token');
    expect(url.searchParams.get('code_challenge')).toBe(codeChallenge);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('rejects Google OAuth users without a verified email', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === 'https://oauth2.googleapis.com/token') {
        return new Response(JSON.stringify({ access_token: 'access-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://www.googleapis.com/oauth2/v3/userinfo') {
        return new Response(
          JSON.stringify({
            email: 'admin@example.com',
            email_verified: false,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(null, { status: 404 });
    });

    await expect(
      exchangeGoogleCode(
        'code',
        'google-client-id',
        'google-client-secret',
        'https://api.example.com/api/v1/auth/oauth/google/callback',
        'code-verifier'
      )
    ).rejects.toThrow('Google email is not verified');
  });
});
