const STORAGE_KEY = 'admin.returnTo';
export const DEFAULT_ADMIN_PATH = '/admin/config/health';
const FALLBACK_ORIGIN = 'https://admin.local';
const RETURN_PATH_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;
const ENCODED_RETURN_PATH_CONTROL_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;

function getBaseUrl(): URL {
  const origin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : FALLBACK_ORIGIN;
  return new URL(origin);
}

function hasExplicitOrigin(input: string): boolean {
  return /^[a-z][a-z\d+\-.]*:/i.test(input) || input.startsWith('//');
}

function normalizeReturnPathInput(input: string | null | undefined): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (
    !value ||
    RETURN_PATH_CONTROL_PATTERN.test(value) ||
    ENCODED_RETURN_PATH_CONTROL_PATTERN.test(value)
  ) {
    return null;
  }
  return value;
}

function sanitizeAdminPath(input: string | null | undefined): string {
  const normalizedInput = normalizeReturnPathInput(input);
  if (!normalizedInput) {
    return DEFAULT_ADMIN_PATH;
  }

  try {
    const baseUrl = getBaseUrl();
    const parsed = new URL(normalizedInput, baseUrl);

    if (hasExplicitOrigin(normalizedInput) && parsed.origin !== baseUrl.origin) {
      return DEFAULT_ADMIN_PATH;
    }

    const next = `${parsed.pathname}${parsed.search}${parsed.hash}`;

    if (
      RETURN_PATH_CONTROL_PATTERN.test(next) ||
      ENCODED_RETURN_PATH_CONTROL_PATTERN.test(next)
    ) {
      return DEFAULT_ADMIN_PATH;
    }

    if (!next.startsWith('/admin/')) {
      return DEFAULT_ADMIN_PATH;
    }

    if (next.startsWith('/admin/login') || next.startsWith('/admin/auth/callback')) {
      return DEFAULT_ADMIN_PATH;
    }

    return next;
  } catch {
    return DEFAULT_ADMIN_PATH;
  }
}

function readStoredReturnPath(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredReturnPath(path: string): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, path);
  } catch {
    // Session storage can be blocked; return-path handling remains best-effort.
  }
}

function removeStoredReturnPath(): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Session storage can be blocked; consuming the path should remain non-fatal.
  }
}

export function rememberAdminReturnPath(input: string | null | undefined): string {
  const next = sanitizeAdminPath(input);
  writeStoredReturnPath(next);
  return next;
}

export function resolveAdminReturnPath(input?: string | null): string {
  if (typeof window === 'undefined') {
    return sanitizeAdminPath(input);
  }

  const stored = readStoredReturnPath();
  if (stored) {
    const next = sanitizeAdminPath(stored);
    if (next !== stored) {
      writeStoredReturnPath(next);
    }
    return next;
  }

  return sanitizeAdminPath(input);
}

export function consumeAdminReturnPath(input?: string | null): string {
  const next = resolveAdminReturnPath(input);
  removeStoredReturnPath();
  return next;
}
