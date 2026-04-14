import type { PublicRuntimeConfig } from '@blog/shared/contracts/public-runtime-config';

type RuntimeWindow = Window & {
  APP_CONFIG?: Partial<PublicRuntimeConfig>;
};

const RUNTIME_CONFIG_PATH = '/runtime-config.json';

function isRuntimeConfig(value: unknown): value is Partial<PublicRuntimeConfig> {
  return typeof value === 'object' && value !== null;
}

export async function preloadRuntimeConfig(
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

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
    runtimeWindow.APP_CONFIG = {
      ...(runtimeWindow.APP_CONFIG ?? {}),
      ...json,
    };
  } catch (error) {
    console.warn('[runtime-config] preload skipped:', error);
  }
}
