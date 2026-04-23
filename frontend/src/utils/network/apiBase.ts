type RuntimeWindow = Window & {
  APP_CONFIG?: {
    apiBaseUrl?: string | null;
    chatBaseUrl?: string;
    chatWsBaseUrl?: string;
  };
  __APP_CONFIG?: { apiBaseUrl?: string | null };
};

let warnedMissingApiBase = false;

function normalizeBaseUrl(url: string): string {
  let normalized = url.trim();

  if (normalized.includes("ai-check.nodove.com")) {
    normalized = normalized.replace("ai-check.nodove.com", "api.nodove.com");
  }
  if (normalized.includes("blog-b.nodove.com")) {
    normalized = normalized.replace("blog-b.nodove.com", "api.nodove.com");
  }

  while (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  if (normalized.endsWith("/api")) {
    normalized = normalized.slice(0, -4);
  }
  return normalized;
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

export function getApiBaseUrl(): string {
  let baseUrl: string | undefined;
  let source: "runtime" | "build" | "localStorage" | "default" | undefined;

  const w = typeof window !== "undefined" ? (window as RuntimeWindow) : null;
  const fromRuntime = w?.APP_CONFIG?.apiBaseUrl || w?.__APP_CONFIG?.apiBaseUrl;
  if (typeof fromRuntime === "string" && fromRuntime) {
    baseUrl = fromRuntime;
    source = "runtime";
  }

  if (!baseUrl) {
    const fromBuild = import.meta.env.VITE_API_BASE_URL;
    if (typeof fromBuild === "string" && fromBuild.trim()) {
      baseUrl = fromBuild;
      source = "build";
    }
  }

  if (!baseUrl) {
    try {
      const v = localStorage.getItem("aiMemo.backendUrl");
      if (v) {
        const parsed = JSON.parse(v) as unknown;
        if (typeof parsed === "string" && parsed) {
          // Require an explicit localhost host/port match to avoid suffix spoofing.
          const isLocalhostOverride =
            /^http:\/\/localhost(:\d+)?(\/|$)/.test(parsed) ||
            /^http:\/\/127\.0\.0\.1(:\d+)?(\/|$)/.test(parsed);
          if (!import.meta.env.PROD || isLocalhostOverride) {
            baseUrl = parsed;
            source = "localStorage";
          }
        }
      }
    } catch { void 0; }
  }

  if (!baseUrl) {
    const hostname =
      typeof window !== "undefined" ? window.location.hostname : "";
    const isLocalhost = isLocalHostname(hostname);

    if (isLocalhost && !import.meta.env.PROD) {
      baseUrl = "http://localhost:5080";
      source = "default";
    } else {
      throw new Error(
        `[apiBase] Missing runtime API base for ${hostname || "<unknown>"}. ` +
          "Production origin must be provided explicitly via public runtime config.",
      );
    }

    if (typeof window !== "undefined" && !warnedMissingApiBase && source === "default") {
      warnedMissingApiBase = true;
      console.warn(
        "[apiBase] VITE_API_BASE_URL is not configured. " +
          `Falling back to ${baseUrl}.`,
      );
    }
  }

  const normalized = normalizeBaseUrl(baseUrl);

  if (
    source === "localStorage" &&
    typeof window !== "undefined" &&
    normalized !== baseUrl
  ) {
    try {
      localStorage.setItem("aiMemo.backendUrl", JSON.stringify(normalized));
    } catch {
      void 0;
    }
  }

  if (
    (source === "runtime" || source === "build") &&
    typeof window !== "undefined" &&
    normalized !== baseUrl
  ) {
    try {
      const w2 = window as RuntimeWindow;
      w2.APP_CONFIG = { ...(w2.APP_CONFIG ?? {}), apiBaseUrl: normalized };
      if (w2?.__APP_CONFIG?.apiBaseUrl) w2.__APP_CONFIG.apiBaseUrl = normalized;
    } catch { void 0; }
  }

  return normalized;
}
