import FingerprintJS from "@fingerprintjs/fingerprintjs";
import {
  sessionCreateRequestSchema,
  sessionResponseSchema,
  userPreferenceWriteSchema,
  userPreferencesResponseSchema,
} from "@blog/shared/contracts/auth";
import { getApiBaseUrl } from "@/utils/network/apiBase";
import { bearerAuth } from "@/lib/auth";
import {
  sha256,
  getCanvasFingerprint,
  getWebGLFingerprint,
  getAudioFingerprint,
} from "@/utils/fingerprint";

const SESSION_TOKEN_KEY = "nodove_session_token";
const FINGERPRINT_ID_KEY = "nodove_fingerprint_id";
const ADV_FINGERPRINT_KEY = "nodove_adv_fingerprint";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FingerprintComponents = {
  advancedVisitorId: string;
  visitorId: string | null;
  canvasHash: string;
  webglHash: string;
  audioHash: string;
  screenResolution: string;
  osVersion: string;
  fpjsBlocked: boolean;
};

type SessionData = {
  sessionToken: string;
  fingerprintId: string;
  expiresAt: string;
  isNewUser?: boolean;
  firstSeenAt?: string;
  visitCount?: number;
};

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

let cachedFingerprint: FingerprintComponents | null = null;
let sessionPromise: Promise<SessionData | null> | null = null;

function parseSessionResponse(payload: unknown): SessionData | null {
  const parsed = sessionResponseSchema.safeParse(payload);
  return parsed.success ? (parsed.data.data as SessionData) : null;
}

// ---------------------------------------------------------------------------
// Advanced Fingerprint Collection
// ---------------------------------------------------------------------------

/**
 * Collect a hybrid fingerprint that combines FingerprintJS (when available)
 * with custom Canvas / WebGL / Audio extractors.
 *
 * If FingerprintJS is blocked (e.g. AdBlock, Brave), the custom extractors
 * still produce a stable identifier.
 */
export async function getAdvancedFingerprint(): Promise<FingerprintComponents> {
  if (cachedFingerprint) {
    return cachedFingerprint;
  }

  // 1. Try FingerprintJS — may be blocked by ad-blockers
  let fpjsVisitorId: string | null = null;
  let fpjsBlocked = false;

  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    fpjsVisitorId = result.visitorId;
  } catch {
    fpjsBlocked = true;
  }

  // 2. Custom extractors — run in parallel, never throw
  const [canvasHash, webglHash, audioHash] = await Promise.all([
    getCanvasFingerprint().catch(() => ""),
    getWebGLFingerprint().catch(() => ""),
    getAudioFingerprint().catch(() => ""),
  ]);

  // 3. Additional environment signals
  const screenResolution =
    typeof screen !== "undefined"
      ? `${screen.width}x${screen.height}x${screen.colorDepth}`
      : "";

  const osVersion = extractOsVersion(navigator.userAgent);

  // 4. Combine all signals into a single advanced hash
  const rawMaterial = [
    fpjsVisitorId ?? "",
    canvasHash,
    webglHash,
    audioHash,
    screenResolution,
    osVersion,
  ].join("|");

  const advancedVisitorId = await sha256(rawMaterial);

  cachedFingerprint = {
    advancedVisitorId,
    visitorId: fpjsVisitorId,
    canvasHash,
    webglHash,
    audioHash,
    screenResolution,
    osVersion,
    fpjsBlocked,
  };

  // Persist for quick reactions / comment fingerprinting
  try {
    localStorage.setItem(ADV_FINGERPRINT_KEY, advancedVisitorId);
  } catch {
    // localStorage blocked — non-critical
  }

  return cachedFingerprint;
}

/**
 * Get cached advanced visitor ID synchronously (for quick use in reactions).
 * Returns null if fingerprint hasn't been generated yet.
 */
export function getCachedAdvancedVisitorId(): string | null {
  if (cachedFingerprint) return cachedFingerprint.advancedVisitorId;
  try {
    return localStorage.getItem(ADV_FINGERPRINT_KEY);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Legacy compatibility — kept for any consumers that import getFingerprint
// ---------------------------------------------------------------------------

export async function getFingerprint(): Promise<{
  visitorId: string;
  components: unknown;
}> {
  const adv = await getAdvancedFingerprint();
  return {
    visitorId: adv.advancedVisitorId,
    components: {
      canvasHash: adv.canvasHash,
      webglHash: adv.webglHash,
      audioHash: adv.audioHash,
      screenResolution: adv.screenResolution,
      osVersion: adv.osVersion,
      fpjsBlocked: adv.fpjsBlocked,
    },
  };
}

// ---------------------------------------------------------------------------
// Session Management
// ---------------------------------------------------------------------------

export async function createSession(): Promise<SessionData | null> {
  try {
    const fp = await getAdvancedFingerprint();
    const baseUrl = getApiBaseUrl();
    const body = sessionCreateRequestSchema.parse({
      fingerprint: {
        visitorId: fp.advancedVisitorId,
        advancedVisitorId: fp.advancedVisitorId,
        canvasHash: fp.canvasHash,
        webglHash: fp.webglHash,
        audioHash: fp.audioHash,
        screenResolution: fp.screenResolution,
        osVersion: fp.osVersion,
        fpjsBlocked: fp.fpjsBlocked,
        components: {
          canvasHash: fp.canvasHash,
          webglHash: fp.webglHash,
          audioHash: fp.audioHash,
        },
      },
      userAgent: navigator.userAgent,
    });

    const response = await fetch(`${baseUrl}/api/v1/user/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) return null;

    const data = parseSessionResponse(await response.json().catch(() => null));
    if (data) {
      localStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken);
      localStorage.setItem(FINGERPRINT_ID_KEY, data.fingerprintId);
      return data;
    }

    return null;
  } catch (err) {
    console.error("Failed to create session:", err);
    return null;
  }
}

export async function validateSession(
  token: string,
): Promise<SessionData | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/user/session/verify`, {
      headers: bearerAuth(token),
    });
    if (!response.ok) return null;

    return parseSessionResponse(await response.json().catch(() => null));
  } catch {
    return null;
  }
}

export async function recoverSession(
  oldToken: string,
): Promise<SessionData | null> {
  try {
    const fp = await getAdvancedFingerprint();
    const baseUrl = getApiBaseUrl();

    const response = await fetch(`${baseUrl}/api/v1/user/session/recover`, {
      method: "POST",
      headers: {
        ...bearerAuth(oldToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fingerprint: {
          advancedVisitorId: fp.advancedVisitorId,
          canvasHash: fp.canvasHash,
          webglHash: fp.webglHash,
          audioHash: fp.audioHash,
          screenResolution: fp.screenResolution,
          osVersion: fp.osVersion,
        },
      }),
    });

    if (!response.ok) return null;

    const data = parseSessionResponse(await response.json().catch(() => null));
    if (data) {
      localStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken);
      localStorage.setItem(FINGERPRINT_ID_KEY, data.fingerprintId);
      return data;
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Exponential Backoff Init
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

async function withExponentialBackoff<T>(
  fn: () => Promise<T | null>,
  maxRetries = MAX_RETRIES,
  baseDelay = BASE_DELAY_MS,
): Promise<T | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await fn();
    if (result !== null) return result;

    if (attempt < maxRetries) {
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return null;
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

    // Retry with exponential backoff (handles ad-blocker / network issues)
    return withExponentialBackoff(() => createSession());
  })();

  const result = await sessionPromise;

  // If initialization failed, allow future retries instead of caching null
  if (!result) {
    sessionPromise = null;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Storage Helpers
// ---------------------------------------------------------------------------

export function getStoredSessionToken(): string | null {
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function getStoredFingerprintId(): string | null {
  return localStorage.getItem(FINGERPRINT_ID_KEY);
}

export async function savePreference(
  key: string,
  value: unknown,
): Promise<boolean> {
  const token = getStoredSessionToken();
  if (!token) return false;

  try {
    const baseUrl = getApiBaseUrl();
    const body = userPreferenceWriteSchema.parse({ key, value });
    const response = await fetch(`${baseUrl}/api/v1/user/preferences`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...bearerAuth(token),
      },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getPreferences(): Promise<Record<
  string,
  unknown
> | null> {
  const token = getStoredSessionToken();
  if (!token) return null;

  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/user/preferences`, {
      headers: bearerAuth(token),
    });

    if (!response.ok) return null;

    const data = userPreferencesResponseSchema.safeParse(
      await response.json().catch(() => null),
    );
    return data.success ? data.data.data.preferences : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(FINGERPRINT_ID_KEY);
  localStorage.removeItem(ADV_FINGERPRINT_KEY);
  cachedFingerprint = null;
  sessionPromise = null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractOsVersion(ua: string): string {
  try {
    // Windows
    const winMatch = ua.match(/Windows NT ([\d.]+)/);
    if (winMatch) return `Windows/${winMatch[1]}`;

    // macOS
    const macMatch = ua.match(/Mac OS X ([\d_]+)/);
    if (macMatch) return `macOS/${macMatch[1].replace(/_/g, ".")}`;

    // Linux
    if (/Linux/.test(ua)) {
      const androidMatch = ua.match(/Android ([\d.]+)/);
      if (androidMatch) return `Android/${androidMatch[1]}`;
      return "Linux";
    }

    // iOS
    const iosMatch = ua.match(/iPhone OS ([\d_]+)/);
    if (iosMatch) return `iOS/${iosMatch[1].replace(/_/g, ".")}`;

    return "unknown";
  } catch {
    return "unknown";
  }
}
