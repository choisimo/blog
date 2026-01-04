// Default API URL for production
const DEFAULT_API_URL = 'https://api.nodove.com';

/**
 * Normalize URL: remove trailing slash and /api suffix
 * This ensures consistent base URL regardless of how it was configured
 */
function normalizeBaseUrl(url: string): string {
  let normalized = url.trim();

  // Migrate legacy AI endpoint domain to unified gateway
  // Some clients stored ai-check.nodove.com in localStorage (aiMemo.backendUrl)
  // which would cause chat session calls to go to /session on the legacy host.
  if (normalized.includes('ai-check.nodove.com')) {
    normalized = normalized.replace('ai-check.nodove.com', 'api.nodove.com');
  }

  // Remove trailing slash
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  // Remove trailing /api to prevent double /api/api paths
  if (normalized.endsWith('/api')) {
    normalized = normalized.slice(0, -4);
  }
  return normalized;
}

export function getApiBaseUrl(): string {
  let baseUrl: string | undefined;
  let source: 'runtime' | 'env' | 'localStorage' | 'default' | undefined;

  // 1) runtime injected config
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const fromRuntime = w?.APP_CONFIG?.apiBaseUrl || w?.__APP_CONFIG?.apiBaseUrl;
  if (typeof fromRuntime === 'string' && fromRuntime) {
    baseUrl = fromRuntime;
    source = 'runtime';
  }

  // 2) Vite env
  if (!baseUrl) {
    const fromEnv = import.meta?.env?.VITE_API_BASE_URL as string | undefined;
    if (typeof fromEnv === 'string' && fromEnv) {
      baseUrl = fromEnv;
      source = 'env';
    }
  }

  // 3) AI Memo localStorage (developer convenience)
  if (!baseUrl) {
    try {
      const v = localStorage.getItem('aiMemo.backendUrl');
      if (v) {
        const parsed = JSON.parse(v);
        if (typeof parsed === 'string' && parsed) {
          baseUrl = parsed;
          source = 'localStorage';
        }
      }
    } catch {
      void 0;
    }
  }

  // 4) Default production URL
  if (!baseUrl) {
    baseUrl = DEFAULT_API_URL;
    source = 'default';
  }

  const normalized = normalizeBaseUrl(baseUrl);

  // If legacy value came from localStorage, persist the migrated value
  if (source === 'localStorage' && typeof window !== 'undefined' && normalized !== baseUrl) {
    try {
      localStorage.setItem('aiMemo.backendUrl', JSON.stringify(normalized));
    } catch {
      void 0;
    }
  }

  // If runtime injected config is legacy, also normalize it in-memory
  if (source === 'runtime' && typeof window !== 'undefined' && normalized !== baseUrl) {
    try {
      const w2 = window as any;
      if (w2?.APP_CONFIG?.apiBaseUrl) w2.APP_CONFIG.apiBaseUrl = normalized;
      if (w2?.__APP_CONFIG?.apiBaseUrl) w2.__APP_CONFIG.apiBaseUrl = normalized;
    } catch {
      void 0;
    }
  }

  return normalized;
}
