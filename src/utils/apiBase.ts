export function getApiBaseUrl(): string | null {
  // 1) runtime injected config
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const fromRuntime = w?.APP_CONFIG?.apiBaseUrl || w?.__APP_CONFIG?.apiBaseUrl;
  if (typeof fromRuntime === 'string' && fromRuntime) return fromRuntime;

  // 2) Vite env
  const fromEnv = import.meta?.env?.VITE_API_BASE_URL as string | undefined;
  if (typeof fromEnv === 'string' && fromEnv) return fromEnv;

  // 3) AI Memo localStorage (developer convenience)
  try {
    const v = localStorage.getItem('aiMemo.backendUrl');
    if (v) {
      const parsed = JSON.parse(v);
      if (typeof parsed === 'string' && parsed) return parsed;
    }
  } catch {
    void 0;
  }

  return null;
}
