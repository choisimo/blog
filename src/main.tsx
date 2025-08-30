import './polyfills';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Debug logs to diagnose blank screen
console.log('[main] script loaded');
const rootEl = document.getElementById('root');
console.log('[main] root element:', rootEl);
// Global error handlers
window.addEventListener('error', e => {
  console.error('[main] Global error:', e.message, e.error);
});
window.addEventListener('unhandledrejection', e => {
  console.error('[main] Unhandled rejection:', e.reason);
});
if (rootEl) {
  createRoot(rootEl).render(<App />);
  console.log('[main] React root mounted');
} else {
  console.error('[main] #root element not found');
}
