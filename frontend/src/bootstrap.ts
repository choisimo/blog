import { preloadRuntimeConfig } from './lib/runtime/preloadRuntimeConfig';

const BOOT_TIMEOUT_MS = 1500;

function waitForBootTimeout(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
}

async function mountAppSafely() {
  const { mountApp } = await import('./main.tsx');
  mountApp();
}

async function bootstrap() {
  await Promise.race([
    preloadRuntimeConfig(),
    waitForBootTimeout(BOOT_TIMEOUT_MS),
  ]);

  await mountAppSafely();
}

void bootstrap().catch(async (error) => {
  console.error('[bootstrap] runtime config preload failed, continuing with defaults', error);
  await mountAppSafely();
});
