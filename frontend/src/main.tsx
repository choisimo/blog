import './polyfills';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const GLOBAL_ERROR_LOG_WINDOW_MS = 5000;
const globalErrorLastSeen = new Map<string, number>();

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

// Debug logs to diagnose blank screen
console.log('[main] script loaded');
const rootEl = document.getElementById('root');
console.log('[main] root element:', rootEl);
// Global error handlers
window.addEventListener('error', e => {
  const signature = `error:${e.message}:${toErrorSignature(e.error)}`;
  if (!shouldLogGlobalError(signature)) return;
  console.error('[main] Global error:', e.message, e.error);
});
window.addEventListener('unhandledrejection', e => {
  const signature = `unhandledrejection:${toErrorSignature(e.reason)}`;
  if (!shouldLogGlobalError(signature)) return;
  console.error('[main] Unhandled rejection:', e.reason);
});
if (rootEl) {
  createRoot(rootEl).render(<App />);
  console.log('[main] React root mounted');
} else {
  console.error('[main] #root element not found');
}
