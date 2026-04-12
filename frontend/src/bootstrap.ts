import { preloadRuntimeConfig } from './lib/runtime/preloadRuntimeConfig';

await preloadRuntimeConfig();
await import('./main.tsx');
