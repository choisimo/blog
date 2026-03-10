import { getApiBaseUrl } from '@/utils/network/apiBase';

export type CreatePostPayload = {
  title: string;
  slug?: string;
  year?: string | number;
  content: string;
  frontmatter?: Record<string, any>;
  draft?: boolean;
};

export type LoginResponse = {
  challengeId: string;
  message: string;
};

export type VerifyOtpResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: {
    username: string;
    email: string;
    role: string;
  };
};

/**
 * Step 1: Request a TOTP challenge (no credentials needed — TOTP is the secret).
 * Returns a short-lived challengeId (5 min TTL).
 * _username and _password are ignored but kept for backward compatibility.
 */
export async function adminLoginStep1(
  _username?: string,
  _password?: string
): Promise<LoginResponse> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/auth/totp/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error?.message || json?.error || 'Challenge request failed');
  }
  return {
    challengeId: json.data.challengeId as string,
    message: 'TOTP challenge issued — enter your authenticator code',
  };
}

/**
 * Step 2: Verify the TOTP code against the challenge.
 * challengeId is from adminLoginStep1; otp is the 6-digit TOTP code.
 */
export async function adminLoginStep2(
  challengeId: string,
  otp: string
): Promise<VerifyOtpResponse> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/auth/totp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, code: otp }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error?.message || json?.error || 'OTP verification failed');
  }
  return json.data as VerifyOtpResponse;
}

/**
 * @deprecated TOTP does not support resend. Calls adminLoginStep1() to issue a new challenge.
 */
export async function adminResendOtp(_sessionId: string): Promise<{ message: string; expiresAt: string }> {
  await adminLoginStep1();
  return {
    message: 'New TOTP challenge issued — enter your authenticator code',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };
}

/**
 * @deprecated Use adminLoginStep1 + adminLoginStep2 instead.
 */
export async function adminLogin(
  _username: string,
  _password: string
): Promise<string> {
  const { challengeId } = await adminLoginStep1();
  return challengeId;
}

export async function createPostPR(
  payload: CreatePostPayload,
  token: string
): Promise<{ prUrl: string; branch: string; path: string }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/admin/create-post-pr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || 'Failed to create PR');
  }
  return json.data as { prUrl: string; branch: string; path: string };
}

export async function uploadPostImages(
  params: { year: string | number; slug: string },
  files: File[],
  token: string
): Promise<{
  dir: string;
  items: Array<{ url: string; variantWebp?: { url: string } | null }>;
}> {
  const base = getApiBaseUrl();
  const fd = new FormData();
  fd.append('year', String(params.year));
  fd.append('slug', params.slug);
  for (const f of files) fd.append('files', f, f.name);

  const res = await fetch(`${base}/api/v1/images/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || 'Failed to upload');
  }
  return json.data as {
    dir: string;
    items: Array<{ url: string; variantWebp?: { url: string } | null }>;
  };
}
