const STORAGE_KEY = 'admin.returnTo';
export const DEFAULT_ADMIN_PATH = '/admin/config/health';

function sanitizeAdminPath(input: string | null | undefined): string {
  if (!input) {
    return DEFAULT_ADMIN_PATH;
  }

  try {
    const parsed = new URL(input, 'https://admin.local');
    const next = `${parsed.pathname}${parsed.search}${parsed.hash}`;

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

export function rememberAdminReturnPath(input: string | null | undefined): string {
  const next = sanitizeAdminPath(input);
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(STORAGE_KEY, next);
  }
  return next;
}

export function resolveAdminReturnPath(input?: string | null): string {
  if (typeof window === 'undefined') {
    return sanitizeAdminPath(input);
  }

  const stored = sessionStorage.getItem(STORAGE_KEY);
  return sanitizeAdminPath(stored || input);
}

export function consumeAdminReturnPath(input?: string | null): string {
  const next = resolveAdminReturnPath(input);
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(STORAGE_KEY);
  }
  return next;
}
