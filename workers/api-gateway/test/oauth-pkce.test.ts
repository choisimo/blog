import { describe, expect, it } from 'vitest';
import {
  buildGithubAuthUrl,
  buildGoogleAuthUrl,
  generatePkcePair,
} from '../src/lib/oauth';

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
});
