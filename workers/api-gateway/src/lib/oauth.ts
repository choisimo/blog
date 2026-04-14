/**
 * OAuth2 helpers for GitHub and Google OIDC
 * Manual fetch implementation — no Passport.js or oauth2 npm packages
 */

function base64UrlEncode(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256(input: string): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return new Uint8Array(digest);
}

export async function generatePkcePair(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = base64UrlEncode(bytes);
  const codeChallenge = base64UrlEncode(await sha256(codeVerifier));
  return { codeVerifier, codeChallenge };
}

/**
 * Build GitHub OAuth2 authorization URL
 */
export function buildGithubAuthUrl(
  state: string,
  clientId: string,
  redirectUri: string,
  codeChallenge?: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'user:email',
    state,
    allow_signup: 'false',
  });
  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange GitHub authorization code for the user's primary verified email
 */
export async function exchangeGithubCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<{ email: string }> {
  // Exchange code for access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`GitHub token exchange failed: ${tokenRes.status}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (tokenData.error || !tokenData.access_token) {
    throw new Error(`GitHub token error: ${tokenData.error ?? 'no access_token'}`);
  }

  // Fetch user emails
  const emailsRes = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'nodove-blog',
    },
  });

  if (!emailsRes.ok) {
    throw new Error(`GitHub email fetch failed: ${emailsRes.status}`);
  }

  const emails = (await emailsRes.json()) as Array<{
    email: string;
    primary: boolean;
    verified: boolean;
  }>;

  const primaryEmail = emails.find((e) => e.primary && e.verified);
  if (!primaryEmail) {
    throw new Error('No primary verified email found on GitHub account');
  }

  return { email: primaryEmail.email };
}

/**
 * Build Google OIDC authorization URL
 */
export function buildGoogleAuthUrl(
  state: string,
  clientId: string,
  redirectUri: string,
  codeChallenge?: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email',
    state,
    access_type: 'online',
  });
  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange Google authorization code for the user's email
 */
export async function exchangeGoogleCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<{ email: string }> {
  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    }).toString(),
  });

  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed: ${tokenRes.status}`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (tokenData.error || !tokenData.access_token) {
    throw new Error(
      `Google token error: ${tokenData.error_description ?? tokenData.error ?? 'no access_token'}`
    );
  }

  // Fetch user info
  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    throw new Error(`Google userinfo fetch failed: ${userRes.status}`);
  }

  const userInfo = (await userRes.json()) as { email?: string };
  if (!userInfo.email) {
    throw new Error('No email found in Google account');
  }

  return { email: userInfo.email };
}

/**
 * Check whether an email is in the allowed list
 * allowedEmailsCsv — comma-separated string from env var ADMIN_ALLOWED_EMAILS
 */
export function isEmailAllowed(email: string, allowedEmailsCsv: string): boolean {
  const allowed = allowedEmailsCsv
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
