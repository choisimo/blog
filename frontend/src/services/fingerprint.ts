import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { getApiBaseUrl } from '@/utils/apiBase';

const SESSION_TOKEN_KEY = 'nodove_session_token';
const FINGERPRINT_ID_KEY = 'nodove_fingerprint_id';

type SessionData = {
  sessionToken: string;
  fingerprintId: string;
  expiresAt: string;
  isNewUser?: boolean;
  firstSeenAt?: string;
  visitCount?: number;
};

let cachedFingerprint: { visitorId: string; components: unknown } | null = null;
let sessionPromise: Promise<SessionData | null> | null = null;

export async function getFingerprint(): Promise<{ visitorId: string; components: unknown }> {
  if (cachedFingerprint) {
    return cachedFingerprint;
  }

  const fp = await FingerprintJS.load();
  const result = await fp.get();

  cachedFingerprint = {
    visitorId: result.visitorId,
    components: result.components,
  };

  return cachedFingerprint;
}

export async function createSession(): Promise<SessionData | null> {
  try {
    const fingerprint = await getFingerprint();
    const baseUrl = getApiBaseUrl();

    const response = await fetch(`${baseUrl}/api/v1/user/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fingerprint: {
          visitorId: fingerprint.visitorId,
          components: fingerprint.components,
        },
        userAgent: navigator.userAgent,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json() as { ok: boolean; data?: SessionData };
    if (data.ok && data.data) {
      localStorage.setItem(SESSION_TOKEN_KEY, data.data.sessionToken);
      localStorage.setItem(FINGERPRINT_ID_KEY, data.data.fingerprintId);
      return data.data;
    }

    return null;
  } catch (err) {
    console.error('Failed to create session:', err);
    return null;
  }
}

export async function validateSession(token: string): Promise<SessionData | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/user/session/${token}`);
    if (!response.ok) return null;

    const data = await response.json() as { ok: boolean; data?: SessionData };
    return data.ok ? data.data || null : null;
  } catch {
    return null;
  }
}

export async function recoverSession(oldToken: string): Promise<SessionData | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/user/session/${oldToken}/recover`, {
      method: 'POST',
    });

    if (!response.ok) return null;

    const data = await response.json() as { ok: boolean; data?: SessionData };
    if (data.ok && data.data) {
      localStorage.setItem(SESSION_TOKEN_KEY, data.data.sessionToken);
      localStorage.setItem(FINGERPRINT_ID_KEY, data.data.fingerprintId);
      return data.data;
    }

    return null;
  } catch {
    return null;
  }
}

export async function initSession(): Promise<SessionData | null> {
  if (sessionPromise) {
    return sessionPromise;
  }

  sessionPromise = (async () => {
    const storedToken = localStorage.getItem(SESSION_TOKEN_KEY);

    if (storedToken) {
      const session = await validateSession(storedToken);
      if (session) {
        return session;
      }

      const recoveredSession = await recoverSession(storedToken);
      if (recoveredSession) {
        return recoveredSession;
      }
    }

    return createSession();
  })();

  return sessionPromise;
}

export function getStoredSessionToken(): string | null {
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function getStoredFingerprintId(): string | null {
  return localStorage.getItem(FINGERPRINT_ID_KEY);
}

export async function savePreference(key: string, value: unknown): Promise<boolean> {
  const token = getStoredSessionToken();
  if (!token) return false;

  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/user/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': token,
      },
      body: JSON.stringify({ key, value }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getPreferences(): Promise<Record<string, unknown> | null> {
  const token = getStoredSessionToken();
  if (!token) return null;

  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/user/preferences`, {
      headers: { 'X-Session-Token': token },
    });

    if (!response.ok) return null;

    const data = await response.json() as { ok: boolean; data?: { preferences: Record<string, unknown> } };
    return data.ok ? data.data?.preferences || null : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(FINGERPRINT_ID_KEY);
  cachedFingerprint = null;
  sessionPromise = null;
}
