type RuntimeWindow = Window & {
  APP_CONFIG?: { apiBaseUrl?: string; chatBaseUrl?: string; chatWsBaseUrl?: string };
  __APP_CONFIG?: { apiBaseUrl?: string };
};

function normalizeBaseUrl(url: string): string {
  let normalized = url.trim();

  if (normalized.includes('ai-check.nodove.com')) {
    normalized = normalized.replace('ai-check.nodove.com', 'api.nodove.com');
  }
  if (normalized.includes('blog-b.nodove.com')) {
    normalized = normalized.replace('blog-b.nodove.com', 'api.nodove.com');
  }

  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (normalized.endsWith('/api')) {
    normalized = normalized.slice(0, -4);
  }
  return normalized;
}

export function getApiBaseUrl(): string {
  let baseUrl: string | undefined;
  let source: 'runtime' | 'env' | 'localStorage' | 'default' | undefined;

  const w = typeof window !== 'undefined' ? (window as RuntimeWindow) : null;
  const fromRuntime = w?.APP_CONFIG?.apiBaseUrl || w?.__APP_CONFIG?.apiBaseUrl;
  if (typeof fromRuntime === 'string' && fromRuntime) {
    baseUrl = fromRuntime;
    source = 'runtime';
  }

  if (!baseUrl) {
    const fromEnv = import.meta?.env?.VITE_API_BASE_URL as string | undefined;
    if (typeof fromEnv === 'string' && fromEnv) {
      baseUrl = fromEnv;
      source = 'env';
    }
  }

  if (!baseUrl) {
    try {
      const v = localStorage.getItem('aiMemo.backendUrl');
      if (v) {
        const parsed = JSON.parse(v) as unknown;
        if (typeof parsed === 'string' && parsed) {
          baseUrl = parsed;
          source = 'localStorage';
        }
      }
    } catch { void 0; }
  }

  if (!baseUrl) {
    throw new Error(
      '[apiBase] VITE_API_BASE_URL is not configured. ' +
      'Set this environment variable or provide runtime config (APP_CONFIG.apiBaseUrl).'
    );
  }

  const normalized = normalizeBaseUrl(baseUrl);

  if (source === 'localStorage' && typeof window !== 'undefined' && normalized !== baseUrl) {
    try {
      localStorage.setItem('aiMemo.backendUrl', JSON.stringify(normalized));
    } catch { void 0; }
  }

  if (source === 'runtime' && typeof window !== 'undefined' && normalized !== baseUrl) {
    try {
      const w2 = window as RuntimeWindow;
      if (w2?.APP_CONFIG?.apiBaseUrl) w2.APP_CONFIG.apiBaseUrl = normalized;
      if (w2?.__APP_CONFIG?.apiBaseUrl) w2.__APP_CONFIG.apiBaseUrl = normalized;
    } catch { void 0; }
  }

  return normalized;
}
