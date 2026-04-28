import type {
  PublicRuntimeConfig,
  PublicRuntimeConfigFeatures,
} from '@blog/shared/contracts/public-runtime-config';

type RuntimeConfigPatch = Partial<Omit<PublicRuntimeConfig, 'features'>> & {
  features?: Partial<PublicRuntimeConfigFeatures>;
};

type RuntimeWindow = Window & {
  APP_CONFIG?: RuntimeConfigPatch;
};

const RUNTIME_CONFIG_PATH = '/runtime-config.json';

function isRuntimeConfig(value: unknown): value is Partial<PublicRuntimeConfig> {
  return typeof value === 'object' && value !== null;
}

function readBooleanEnv(value: string | boolean | undefined): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

export function applyBuildTimeRuntimeConfig(
  runtimeWindow?: RuntimeWindow
): void {
  const targetWindow =
    runtimeWindow ??
    (typeof window !== 'undefined' ? (window as RuntimeWindow) : undefined);

  if (!targetWindow) {
    return;
  }

  const nextConfig: RuntimeConfigPatch = {};
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  const chatBaseUrl = import.meta.env.VITE_CHAT_BASE_URL?.trim();
  const chatWsBaseUrl = import.meta.env.VITE_CHAT_WS_BASE_URL?.trim();
  const terminalGatewayUrl = import.meta.env.VITE_TERMINAL_GATEWAY_URL?.trim();
  const siteBaseUrl = import.meta.env.VITE_SITE_BASE_URL?.trim();
  const aiEnabled = readBooleanEnv(import.meta.env.VITE_FEATURE_AI_ENABLED);
  const ragEnabled = readBooleanEnv(import.meta.env.VITE_FEATURE_RAG_ENABLED);
  const terminalEnabled = readBooleanEnv(import.meta.env.VITE_FEATURE_TERMINAL_ENABLED);
  const aiInline = readBooleanEnv(import.meta.env.VITE_FEATURE_AI_INLINE);
  const codeExecutionEnabled = readBooleanEnv(import.meta.env.VITE_FEATURE_CODE_EXECUTION_ENABLED);
  const commentsEnabled = readBooleanEnv(import.meta.env.VITE_FEATURE_COMMENTS_ENABLED);

  if (siteBaseUrl) {
    nextConfig.siteBaseUrl = siteBaseUrl;
  }
  if (apiBaseUrl) {
    nextConfig.apiBaseUrl = apiBaseUrl;
  }
  if (chatBaseUrl) {
    nextConfig.chatBaseUrl = chatBaseUrl;
  }
  if (chatWsBaseUrl) {
    nextConfig.chatWsBaseUrl = chatWsBaseUrl;
  }
  if (terminalGatewayUrl) {
    nextConfig.terminalGatewayUrl = terminalGatewayUrl;
  }

  const features = {
    ...(aiEnabled !== undefined ? { aiEnabled } : {}),
    ...(ragEnabled !== undefined ? { ragEnabled } : {}),
    ...(terminalEnabled !== undefined ? { terminalEnabled } : {}),
    ...(aiInline !== undefined ? { aiInline } : {}),
    ...(codeExecutionEnabled !== undefined ? { codeExecutionEnabled } : {}),
    ...(commentsEnabled !== undefined ? { commentsEnabled } : {}),
  };

  if (Object.keys(features).length > 0) {
    nextConfig.features = features;
  }

  if (Object.keys(nextConfig).length === 0) {
    return;
  }

  targetWindow.APP_CONFIG = {
    ...(targetWindow.APP_CONFIG ?? {}),
    ...nextConfig,
    ...(nextConfig.features
      ? {
          features: {
            ...(targetWindow.APP_CONFIG?.features ?? {}),
            ...nextConfig.features,
          },
        }
      : {}),
  };
}

export async function preloadRuntimeConfig(
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  applyBuildTimeRuntimeConfig();

  try {
    const response = await fetchImpl(RUNTIME_CONFIG_PATH, { cache: 'no-store' });
    if (!response.ok) {
      return;
    }

    const json = (await response.json().catch(() => null)) as unknown;
    if (!isRuntimeConfig(json)) {
      return;
    }

    const runtimeWindow = window as RuntimeWindow;
    const runtimeConfig = json as RuntimeConfigPatch;

    runtimeWindow.APP_CONFIG = {
      ...(runtimeWindow.APP_CONFIG ?? {}),
      ...runtimeConfig,
      ...(runtimeConfig.features
        ? {
            features: {
              ...(runtimeWindow.APP_CONFIG?.features ?? {}),
              ...runtimeConfig.features,
            },
          }
        : {}),
    };
  } catch (error) {
    console.warn('[runtime-config] preload skipped:', error);
  }
}
