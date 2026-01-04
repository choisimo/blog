// Default API URL for production
const DEFAULT_API_URL = 'https://blog-b.nodove.com';

/**
 * Normalize URL: remove trailing slash and /api suffix
 * This ensures consistent base URL regardless of how it was configured
 */
function normalizeBaseUrl(url: string): string {
  let normalized = url.trim();
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

  // 1) runtime injected config
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const fromRuntime = w?.APP_CONFIG?.apiBaseUrl || w?.__APP_CONFIG?.apiBaseUrl;
  if (typeof fromRuntime === 'string' && fromRuntime) {
    baseUrl = fromRuntime;
  }

  // 2) Vite env
  if (!baseUrl) {
    const fromEnv = import.meta?.env?.VITE_API_BASE_URL as string | undefined;
    if (typeof fromEnv === 'string' && fromEnv) {
      baseUrl = fromEnv;
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
        }
      }
    } catch {
      void 0;
    }
  }

  // 4) Default production URL
  if (!baseUrl) {
    baseUrl = DEFAULT_API_URL;
  }

  return normalizeBaseUrl(baseUrl);
}
