import './polyfills';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const GLOBAL_ERROR_LOG_WINDOW_MS = 5000;
const globalErrorLastSeen = new Map<string, number>();
let root = null as ReturnType<typeof createRoot> | null;
let mounted = false;
let errorHandlersInstalled = false;

function toErrorSignature(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}:${value.message}:${value.stack || ''}`;
  }
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function shouldLogGlobalError(signature: string): boolean {
  const now = Date.now();
  const lastSeen = globalErrorLastSeen.get(signature) ?? 0;

  if (now - lastSeen < GLOBAL_ERROR_LOG_WINDOW_MS) {
    return false;
  }

  globalErrorLastSeen.set(signature, now);

  if (globalErrorLastSeen.size > 200) {
    for (const [key, ts] of globalErrorLastSeen) {
      if (now - ts > GLOBAL_ERROR_LOG_WINDOW_MS * 2) {
        globalErrorLastSeen.delete(key);
      }
    }
  }

  return true;
}

function installGlobalErrorHandlers() {
  if (errorHandlersInstalled || typeof window === 'undefined') {
    return;
  }

  errorHandlersInstalled = true;

  window.addEventListener('error', (event) => {
    const signature = `error:${event.message}:${toErrorSignature(event.error)}`;
    if (!shouldLogGlobalError(signature)) return;
    console.error('[main] Global error:', event.message, event.error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const signature = `unhandledrejection:${toErrorSignature(event.reason)}`;
    if (!shouldLogGlobalError(signature)) return;
    console.error('[main] Unhandled rejection:', event.reason);
  });
}

export function mountApp() {
  installGlobalErrorHandlers();

  if (mounted) {
    return;
  }

  const rootEl = document.getElementById('root');
  if (!rootEl) {
    console.error('[main] #root element not found');
    return;
  }

  root = root ?? createRoot(rootEl);
  root.render(<App />);
  mounted = true;
}
